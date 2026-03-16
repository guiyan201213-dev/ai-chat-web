// 💥 填入你的 Supabase 密钥
const supabaseUrl = 'https://usotduffikxsrapjsanr.supabase.co'; 
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVzb3RkdWZmaWt4c3JhcGpzYW5yIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzM1NzEwNjgsImV4cCI6MjA4OTE0NzA2OH0.R_S5ddSNwtTubDj6lk300UxoN6ISJzJp09KHSFI9J2w'; 

document.addEventListener('DOMContentLoaded', () => {
    const supabase = (supabaseUrl.startsWith('https')) ? window.supabase.createClient(supabaseUrl, supabaseKey) : null;
    let currentSession = null;
    let currentUserId = null;

    // DOM 元素
    const chatBox = document.getElementById('chat-box');
    const userInput = document.getElementById('user-input');
    const sendBtn = document.getElementById('send-btn');
    const sidebar = document.getElementById('sidebar');
    const menuBtn = document.getElementById('menu-btn');
    const historyList = document.getElementById('history-list');
    const quickNewChatBtn = document.getElementById('quick-new-chat');
    const authModal = document.getElementById('auth-modal');

    // ==========================================
    // 1. 认证与云端拉取
    // ==========================================
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
                await fetchCloudChats(); // 登录后拉取云端记录
            } else {
                currentUserId = null;
                if(openBtn) openBtn.style.display = 'flex';
                if(infoPanel) infoPanel.style.display = 'none';
                chats = []; // 清空记录
                renderHistory();
            }
        });

        // 绑定弹窗按键
        document.getElementById('open-auth-modal').onclick = () => authModal.classList.add('show');
        document.getElementById('close-auth-modal').onclick = () => authModal.classList.remove('show');
        document.getElementById('github-login-btn').onclick = () => supabase.auth.signInWithOAuth({ provider: 'github' });
        document.getElementById('logout-btn').onclick = () => supabase.auth.signOut();

        // 邮箱认证
        document.getElementById('email-login-btn').onclick = async () => {
            const e = document.getElementById('auth-email').value, p = document.getElementById('auth-password').value;
            const { error } = await supabase.auth.signInWithPassword({ email: e, password: p });
            if (error) alert(error.message);
        };
        document.getElementById('email-signup-btn').onclick = async () => {
            const e = document.getElementById('auth-email').value, p = document.getElementById('auth-password').value;
            const { error } = await supabase.auth.signUp({ email: e, password: p });
            if (error) alert(error.message); else alert('注册成功/已发验证邮件！');
        };
    }

    // ==========================================
    // 2. 侧边栏高级交互
    // ==========================================
    // 桌面端悬停展开
    menuBtn.addEventListener('mouseenter', () => { if(window.innerWidth > 768) sidebar.classList.add('active'); });
    sidebar.addEventListener('mouseleave', () => { if(window.innerWidth > 768) sidebar.classList.remove('active'); });
    
    // 移动端点击展开，点击空白收起
    menuBtn.addEventListener('click', (e) => { e.stopPropagation(); sidebar.classList.toggle('active'); });
    document.addEventListener('click', (e) => {
        if (sidebar.classList.contains('active') && !sidebar.contains(e.target) && !menuBtn.contains(e.target)) {
            sidebar.classList.remove('active');
        }
    });

    // 快捷开启新对话
    const initNewChat = () => {
        if (currentAbortController) { currentAbortController.abort(); finishGenerationUI(); }
        currentChatId = null; 
        if(chatBox) chatBox.innerHTML = ''; 
        document.body.classList.remove('chat-active');
        quickNewChatBtn.style.display = 'none';
        document.querySelectorAll('.history-item').forEach(i => i.classList.remove('active'));
        if(window.innerWidth <= 768) sidebar.classList.remove('active');
    };
    document.getElementById('new-chat-btn').onclick = initNewChat;
    quickNewChatBtn.onclick = initNewChat;

    // ==========================================
    // 3. 模型菜单逻辑
    // ==========================================
    const modelToggle = document.getElementById('model-toggle');
    const modelMenu = document.getElementById('model-menu');
    const currentModelName = document.getElementById('current-model-name');
    let currentModelValue = 'deepseek-ai/DeepSeek-R1-0528-Qwen3-8B';

    modelToggle.onclick = (e) => { e.stopPropagation(); modelMenu.classList.toggle('show'); };
    document.addEventListener('click', (e) => {
        if (!modelMenu.contains(e.target)) modelMenu.classList.remove('show');
        // 关闭所有历史菜单的下拉框
        document.querySelectorAll('.item-dropdown').forEach(d => d.classList.remove('show'));
    });
    
    document.querySelectorAll('.model-option').forEach(opt => {
        opt.onclick = (e) => {
            e.stopPropagation();
            document.querySelectorAll('.model-option').forEach(i => i.classList.remove('active'));
            opt.classList.add('active');
            currentModelValue = opt.dataset.value;
            // 提取纯文本名字（去掉 Beta 标志）
            currentModelName.textContent = opt.querySelector('.opt-title').childNodes[0].textContent.trim();
            modelMenu.classList.remove('show');
        };
    });

    // ==========================================
    // 4. 云端历史记录逻辑 (核心重构)
    // ==========================================
    let chats = [];
    let currentChatId = null;

    async function fetchCloudChats() {
        if (!supabase || !currentUserId) return;
        const { data, error } = await supabase.from('chats').select('*').eq('user_id', currentUserId).order('created_at', { ascending: false });
        if (!error && data) { chats = data; renderHistory(); }
    }

    async function syncChatToCloud(id, role, content, title) {
        if (!supabase || !currentUserId) return; // 未登录不保存
        let chat = chats.find(c => c.id === id);
        if (!chat) {
            chat = { id, user_id: currentUserId, title, messages: [{ role, content }] };
            chats.unshift(chat);
            await supabase.from('chats').insert(chat);
        } else {
            chat.messages.push({ role, content });
            await supabase.from('chats').update({ messages: chat.messages }).eq('id', id);
        }
    }

    function renderHistory() {
        if (!historyList) return;
        historyList.innerHTML = '<div class="history-title">云端记录</div>';
        chats.forEach(chat => {
            const item = document.createElement('div'); 
            item.className = 'history-item glass-btn';
            if (chat.id === currentChatId) item.classList.add('active');
            
            // 💥 高级三点菜单
            item.innerHTML = `
                <span class="title">${escapeHTML(chat.title)}</span>
                <button class="item-menu-btn">⋮</button>
                <div class="item-dropdown"><button class="del-chat-btn">删除对话</button></div>
            `;
            
            // 点击切换对话
            item.onclick = () => {
                if (currentAbortController) { currentAbortController.abort(); finishGenerationUI(); }
                currentChatId = chat.id; chatBox.innerHTML = ''; 
                document.body.classList.add('chat-active'); 
                quickNewChatBtn.style.display = 'flex'; // 显示右上角加号
                chat.messages.forEach(msg => appendMessage(msg.content, msg.role));
                renderHistory();
            };

            // 三点菜单逻辑
            const menuBtn = item.querySelector('.item-menu-btn');
            const dropdown = item.querySelector('.item-dropdown');
            menuBtn.onclick = (e) => {
                e.stopPropagation();
                document.querySelectorAll('.item-dropdown').forEach(d => d.classList.remove('show'));
                dropdown.classList.add('show');
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

    // ==========================================
    // 5. 对话引擎
    // ==========================================
    let currentAbortController = null;
    if (userInput) {
        userInput.onkeypress = (e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage(); } };
        userInput.oninput = function() { this.style.height = 'auto'; this.style.height = this.scrollHeight + 'px'; };
    }
    if (sendBtn) sendBtn.onclick = sendMessage;

    async function sendMessage() {
        if (!userInput || !sendBtn || !chatBox) return;
        if (sendBtn.classList.contains('generating')) {
            if (currentAbortController) { currentAbortController.abort(); finishGenerationUI(); }
            return;
        }

        const text = userInput.value.trim();
        if (!text) return;

        document.body.classList.add('chat-active'); 
        quickNewChatBtn.style.display = 'flex'; // 开始对话就显示快捷新建
        sendBtn.classList.add('generating'); 
        currentAbortController = new AbortController();

        const isNewChat = !currentChatId;
        if (isNewChat) currentChatId = Date.now().toString();

        appendMessage(text, 'user');
        await syncChatToCloud(currentChatId, 'user', text, text.substring(0, 15));
        renderHistory();
        userInput.value = ''; userInput.style.height = 'auto';

        const aiMessageDiv = document.createElement('div'); aiMessageDiv.className = 'message ai-message';
        const bubbleDiv = document.createElement('div'); bubbleDiv.className = 'bubble glass-panel'; 
        bubbleDiv.innerHTML = '<div class="single-breathing-dot"></div>'; 
        aiMessageDiv.appendChild(bubbleDiv);
        chatBox.appendChild(aiMessageDiv);
        chatBox.scrollTop = chatBox.scrollHeight;

        const headers = { 'Content-Type': 'application/json' };
        if (currentSession) headers['Authorization'] = `Bearer ${currentSession.access_token}`;

        try {
            const response = await fetch('/api/chat', {
                method: 'POST', headers: headers,
                body: JSON.stringify({ message: text, model: currentModelValue }),
                signal: currentAbortController.signal 
            });

            const reader = response.body.getReader();
            const decoder = new TextDecoder("utf-8");
            let fullReply = "";
            let buffer = ""; 

            while (true) {
                const { done, value } = await reader.read();
                if (done) break;
                buffer += decoder.decode(value, { stream: true });
                const lines = buffer.split('\n'); buffer = lines.pop(); 
                for (const line of lines) {
                    if (line.startsWith('data: ')) {
                        const dataStr = line.slice(6).trim();
                        if (dataStr === '[DONE]') break;
                        try {
                            const parsed = JSON.parse(dataStr);
                            if (parsed.error) throw new Error(parsed.error);
                            if (parsed.text) {
                                fullReply += parsed.text;
                                bubbleDiv.innerHTML = safeMarkdown(fullReply);
                                chatBox.scrollTop = chatBox.scrollHeight;
                            }
                        } catch (e) {}
                    }
                }
            }
            bubbleDiv.innerHTML = safeMarkdown(fullReply);
            aiMessageDiv.appendChild(createCopyButton(fullReply));
            await syncChatToCloud(currentChatId, 'ai', fullReply);
        } catch (error) {
            if (error.name === 'AbortError') {
                if (!bubbleDiv.innerHTML.includes('single-breathing-dot')) {
                    aiMessageDiv.appendChild(createCopyButton(bubbleDiv.innerText));
                    await syncChatToCloud(currentChatId, 'ai', bubbleDiv.innerText + " [已中断]");
                } else { bubbleDiv.innerHTML = "<span style='color:var(--text-muted);'>[已取消]</span>"; }
            } else { bubbleDiv.innerHTML = "<span style='color:red;'>抱歉，请求失败。</span>"; }
        } finally { finishGenerationUI(); }
    }

    function finishGenerationUI() { if(sendBtn) sendBtn.classList.remove('generating'); currentAbortController = null; }
    function safeMarkdown(text) { try { return window.marked ? marked.parse(text) : escapeHTML(text).replace(/\n/g, '<br>'); } catch (e) { return escapeHTML(text).replace(/\n/g, '<br>'); } }

    function appendMessage(text, sender) {
        if (!chatBox) return;
        const messageDiv = document.createElement('div'); messageDiv.className = `message ${sender}-message`;
        const bubbleDiv = document.createElement('div'); bubbleDiv.className = 'bubble';
        if(sender === 'ai') bubbleDiv.classList.add('glass-panel'); 
        if (sender === 'user') { bubbleDiv.innerHTML = escapeHTML(text).replace(/\n/g, '<br>'); messageDiv.appendChild(bubbleDiv); } 
        else { bubbleDiv.innerHTML = safeMarkdown(text); messageDiv.appendChild(bubbleDiv); messageDiv.appendChild(createCopyButton(text)); }
        chatBox.appendChild(messageDiv); chatBox.scrollTop = chatBox.scrollHeight;
    }

    function createCopyButton(text) {
        const btn = document.createElement('button'); btn.className = 'copy-btn glass-btn'; btn.innerHTML = `复制`;
        btn.onclick = () => { navigator.clipboard.writeText(text).then(() => { const originalHTML = btn.innerHTML; btn.innerHTML = '✅ 已复制'; setTimeout(() => btn.innerHTML = originalHTML, 2000); }); };
        return btn;
    }
    function escapeHTML(str) { return str.replace(/[&<>'"]/g, tag => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[tag] || tag)); }
});
