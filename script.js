const supabaseUrl = 'https://usotduffikxsrapjsanr.supabase.co'; 
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVzb3RkdWZmaWt4c3JhcGpzYW5yIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzM1NzEwNjgsImV4cCI6MjA4OTE0NzA2OH0.R_S5ddSNwtTubDj6lk300UxoN6ISJzJp09KHSFI9J2w'; 

document.addEventListener('DOMContentLoaded', () => {
    const supabase = (supabaseUrl.startsWith('https')) ? window.supabase.createClient(supabaseUrl, supabaseKey) : null;
    let currentSession = null;
    let currentUserId = null;

    // 💥 1. 核心提示引擎 (替代 alert)
    function showToast(message, type = 'info') {
        const container = document.getElementById('toast-container');
        if(!container) return;
        const toast = document.createElement('div');
        toast.className = `custom-toast ${type}`;
        const icon = type === 'error' ? '⚠️' : (type === 'success' ? '✅' : 'ℹ️');
        toast.innerHTML = `<span>${icon}</span> ${message}`;
        container.appendChild(toast);
        setTimeout(() => {
            toast.style.animation = 'toastFadeOut 0.4s cubic-bezier(0.2, 0.8, 0.2, 1) forwards';
            setTimeout(() => toast.remove(), 400);
        }, 3000);
    }

    const chatBox = document.getElementById('chat-box');
    const userInput = document.getElementById('user-input');
    const sendBtn = document.getElementById('send-btn');
    const sidebar = document.getElementById('sidebar');
    const menuBtn = document.getElementById('menu-btn');
    const historyList = document.getElementById('history-list');
    const quickNewChatBtn = document.getElementById('quick-new-chat');
    const authModal = document.getElementById('auth-modal');

    // 💥 2. 模态框标签切换逻辑
    document.querySelectorAll('.auth-tab').forEach(tab => {
        tab.onclick = () => {
            document.querySelectorAll('.auth-tab').forEach(t => t.classList.remove('active'));
            document.querySelectorAll('.auth-form').forEach(f => f.classList.remove('active'));
            tab.classList.add('active');
            document.getElementById(tab.dataset.target).classList.add('active');
        };
    });

    // 3. 认证逻辑
    if (supabase) {
        supabase.auth.onAuthStateChange(async (event, session) => {
            currentSession = session;
            const openBtn = document.getElementById('open-auth-modal');
            const infoPanel = document.getElementById('user-info');
            
            if (session) {
                currentUserId = session.user.id;
                if(openBtn) openBtn.style.display = 'none';
                if(infoPanel) infoPanel.style.display = 'flex';
                document.getElementById('user-avatar').src = session.user.user_metadata.avatar_url || 'https://via.placeholder.com/150';
                document.getElementById('user-name').textContent = session.user.user_metadata.full_name || session.user.email.split('@')[0];
                authModal.classList.remove('show');
                fetchCloudChats().catch(e => console.error("拉取云端失败", e)); 
            } else {
                currentUserId = null;
                if(openBtn) openBtn.style.display = 'flex';
                if(infoPanel) infoPanel.style.display = 'none';
                chats = []; renderHistory();
            }
        });

        document.getElementById('logout-btn').onclick = async () => {
            await supabase.auth.signOut();
            window.location.reload(); 
        };

        document.getElementById('open-auth-modal').onclick = () => authModal.classList.add('show');
        document.getElementById('close-auth-modal').onclick = () => authModal.classList.remove('show');
        document.getElementById('github-login-btn').onclick = () => supabase.auth.signInWithOAuth({ provider: 'github' });
        
        // 💥 邮箱登录
        document.getElementById('do-login-btn').onclick = async () => {
            const e = document.getElementById('login-email').value.trim();
            const p = document.getElementById('login-password').value.trim();
            if(!e || !p) return showToast('请输入邮箱和密码', 'error');
            const { error } = await supabase.auth.signInWithPassword({ email: e, password: p });
            if (error) showToast('登录失败: ' + error.message, 'error');
            else showToast('登录成功！', 'success');
        };

        // 💥 邮箱注册 (包含用户名)
        document.getElementById('do-signup-btn').onclick = async () => {
            const u = document.getElementById('signup-username').value.trim();
            const e = document.getElementById('signup-email').value.trim();
            const p = document.getElementById('signup-password').value.trim();
            
            if(!u || !e || !p) return showToast('请填写完整的注册信息', 'error');
            if(p.length < 6) return showToast('密码至少需要 6 位数字或字母', 'error');

            const { error } = await supabase.auth.signUp({ 
                email: e, password: p, 
                options: { data: { full_name: u } } // 将用户名存入数据库
            });
            
            if (error) {
                showToast(error.message, 'error');
            } else {
                showToast('注册成功！请前往邮箱点击激活链接。', 'success');
                document.querySelector('.auth-tab[data-target="login-form"]').click(); // 自动切回登录页面
            }
        };
    }

    menuBtn.addEventListener('mouseenter', () => { if(window.innerWidth > 768) sidebar.classList.add('active'); });
    sidebar.addEventListener('mouseleave', () => { if(window.innerWidth > 768) sidebar.classList.remove('active'); });
    menuBtn.onclick = (e) => { e.stopPropagation(); sidebar.classList.toggle('active'); };
    document.addEventListener('click', (e) => {
        if (sidebar.classList.contains('active') && !sidebar.contains(e.target) && !menuBtn.contains(e.target)) sidebar.classList.remove('active');
    });

    const initNewChat = () => {
        if (currentAbortController) { currentAbortController.abort(); }
        currentChatId = null; chatBox.innerHTML = ''; document.body.classList.remove('chat-active');
        quickNewChatBtn.style.display = 'none'; renderHistory();
    };
    document.getElementById('new-chat-btn').onclick = initNewChat;
    quickNewChatBtn.onclick = initNewChat;

    const modelToggle = document.getElementById('model-toggle');
    const modelMenu = document.getElementById('model-menu');
    const currentModelName = document.getElementById('current-model-name');
    let currentModelValue = 'deepseek-ai/DeepSeek-R1-0528-Qwen3-8B';

    modelToggle.onclick = (e) => { e.stopPropagation(); modelMenu.classList.toggle('show'); };
    document.addEventListener('click', () => modelMenu.classList.remove('show'));
    
    document.querySelectorAll('.model-option').forEach(opt => {
        opt.onclick = (e) => {
            e.stopPropagation(); document.querySelectorAll('.model-option').forEach(i => i.classList.remove('active'));
            opt.classList.add('active'); currentModelValue = opt.dataset.value;
            currentModelName.textContent = opt.querySelector('.opt-title').childNodes[0].textContent.trim();
            modelMenu.classList.remove('show');
        };
    });

    let chats = []; let currentChatId = null;

    async function fetchCloudChats() {
        if (!supabase || !currentUserId) return;
        const { data, error } = await supabase.from('chats').select('*').eq('user_id', currentUserId).order('created_at', { ascending: false });
        if (!error && data) { chats = data; renderHistory(); }
    }

    async function syncChatToCloud(id, role, content, title) {
        if (!supabase || !currentUserId) return; 
        let chat = chats.find(c => c.id === id);
        if (!chat) {
            chat = { id, user_id: currentUserId, title, messages: [{ role, content }] };
            chats.unshift(chat); await supabase.from('chats').insert(chat);
        } else {
            chat.messages.push({ role, content });
            await supabase.from('chats').update({ messages: chat.messages }).eq('id', id);
        }
    }

    function renderHistory() {
        if (!historyList) return;
        historyList.innerHTML = '<div class="history-title">云端记录</div>';
        chats.forEach(chat => {
            const item = document.createElement('div'); item.className = 'history-item glass-btn';
            if (chat.id === currentChatId) item.classList.add('active');
            item.innerHTML = `<span class="title">${escapeHTML(chat.title)}</span><button class="item-menu-btn">⋮</button><div class="item-dropdown"><button class="del-chat-btn">删除</button></div>`;
            item.onclick = () => {
                currentChatId = chat.id; chatBox.innerHTML = ''; document.body.classList.add('chat-active'); 
                chat.messages.forEach(msg => appendMessage(msg.content, msg.role)); renderHistory();
            };
            item.querySelector('.item-menu-btn').onclick = (e) => {
                e.stopPropagation(); document.querySelectorAll('.item-dropdown').forEach(d => d.classList.remove('show'));
                item.querySelector('.item-dropdown').classList.add('show');
            };
            item.querySelector('.del-chat-btn').onclick = async (e) => {
                e.stopPropagation();
                if (supabase) await supabase.from('chats').delete().eq('id', chat.id);
                chats = chats.filter(c => c.id !== chat.id);
                if (currentChatId === chat.id) initNewChat(); else renderHistory();
            };
            historyList.appendChild(item);
        });
    }

    let currentAbortController = null;
    sendBtn.onclick = sendMessage;
    userInput.onkeypress = (e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage(); } };

    async function sendMessage() {
        const text = userInput.value.trim();
        if (!text || sendBtn.classList.contains('generating')) return;

        document.body.classList.add('chat-active');
        sendBtn.classList.add('generating');
        quickNewChatBtn.style.display = 'flex';
        currentAbortController = new AbortController();

        if (!currentChatId) currentChatId = Date.now().toString();

        appendMessage(text, 'user');
        syncChatToCloud(currentChatId, 'user', text, text.substring(0, 15)).catch(e => console.error(e));
        
        userInput.value = ''; userInput.style.height = 'auto';

        const aiDiv = document.createElement('div'); aiDiv.className = 'message ai-message';
        const bubble = document.createElement('div'); bubble.className = 'bubble glass-panel';
        bubble.innerHTML = '<div class="single-breathing-dot"></div>';
        aiDiv.appendChild(bubble); chatBox.appendChild(aiDiv); chatBox.scrollTop = chatBox.scrollHeight;

        try {
            const headers = { 'Content-Type': 'application/json' };
            if (currentSession) headers['Authorization'] = `Bearer ${currentSession.access_token}`;

            const response = await fetch('/api/chat', {
                method: 'POST', headers: headers,
                body: JSON.stringify({ message: text, model: currentModelValue }),
                signal: currentAbortController.signal 
            });

            if (!response.ok) throw new Error("后端连接失败");

            const reader = response.body.getReader();
            const decoder = new TextDecoder("utf-8");
            let fullReply = "";

            while (true) {
                const { done, value } = await reader.read();
                if (done) break;
                const lines = decoder.decode(value).split('\n');
                for (const line of lines) {
                    if (line.startsWith('data: ')) {
                        const dataStr = line.slice(6).trim();
                        if (dataStr === '[DONE]') break;
                        try {
                            const parsed = JSON.parse(dataStr);
                            if (parsed.text) {
                                fullReply += parsed.text;
                                bubble.innerHTML = marked.parse(fullReply);
                                chatBox.scrollTop = chatBox.scrollHeight;
                            }
                        } catch (e) {}
                    }
                }
            }
            syncChatToCloud(currentChatId, 'ai', fullReply).catch(e => console.error(e));
        } catch (error) {
            bubble.innerHTML = `<span style="color:#ff4d4f">⚠️ 错误：${error.message}</span>`;
        } finally {
            sendBtn.classList.remove('generating');
        }
    }

    function appendMessage(text, role) {
        const div = document.createElement('div'); div.className = `message ${role}-message`;
        const bub = document.createElement('div'); bub.className = 'bubble';
        if(role === 'ai') bub.classList.add('glass-panel');
        bub.innerHTML = (role === 'ai' && window.marked) ? marked.parse(text) : escapeHTML(text).replace(/\n/g, '<br>');
        div.appendChild(bub); chatBox.appendChild(div); chatBox.scrollTop = chatBox.scrollHeight;
    }
    function escapeHTML(str) { return str.replace(/[&<>'"]/g, tag => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[tag] || tag)); }
});
