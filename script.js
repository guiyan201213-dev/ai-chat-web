// ==========================================
// 💥 填入你的 Supabase 密钥
// ==========================================
const supabaseUrl = 'https://usotduffikxsrapjsanr.supabase.co'; // 替换为真实的 URL
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVzb3RkdWZmaWt4c3JhcGpzYW5yIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzM1NzEwNjgsImV4cCI6MjA4OTE0NzA2OH0.R_S5ddSNwtTubDj6lk300UxoN6ISJzJp09KHSFI9J2w'; // 替换为真实的 Key

// 💥 绝对防御机制：必须等整个网页渲染完毕再执行 JS
document.addEventListener('DOMContentLoaded', () => {
    
    // 获取元素（如果没找到也不会报错卡死）
    const chatBox = document.getElementById('chat-box');
    const userInput = document.getElementById('user-input');
    const sendBtn = document.getElementById('send-btn');
    const newChatBtn = document.getElementById('new-chat-btn');
    const closeSidebarBtn = document.getElementById('close-sidebar-btn');
    const menuBtn = document.getElementById('menu-btn');
    const sidebar = document.getElementById('sidebar');
    const historyList = document.getElementById('history-list');
    
    const loginBtn = document.getElementById('login-btn');
    const logoutBtn = document.getElementById('logout-btn');
    const userInfo = document.getElementById('user-info');
    
    // 初始化 Supabase
    let supabase = null;
    let currentSession = null;
    try {
        if (typeof window.supabase !== 'undefined' && supabaseUrl.includes('supabase.co')) {
            supabase = window.supabase.createClient(supabaseUrl, supabaseKey);
            
            supabase.auth.onAuthStateChange((event, session) => {
                currentSession = session; 
                if (session && userInfo && loginBtn) {
                    loginBtn.style.display = 'none';
                    userInfo.style.display = 'flex';
                    document.getElementById('user-avatar').src = session.user.user_metadata.avatar_url;
                    document.getElementById('user-name').textContent = session.user.user_metadata.full_name || '用户';
                } else if (userInfo && loginBtn) {
                    loginBtn.style.display = 'flex';
                    userInfo.style.display = 'none';
                }
            });
        }
    } catch (e) { console.error('Supabase 启动失败:', e); }

    // 登录退出逻辑
    if (loginBtn) loginBtn.onclick = () => {
        if (!supabase) alert('请先在 script.js 顶部填入 Supabase 密钥');
        else supabase.auth.signInWithOAuth({ provider: 'github' });
    };
    if (logoutBtn) logoutBtn.onclick = () => { if (supabase) supabase.auth.signOut(); };

    // 模型菜单逻辑
    let currentAbortController = null;
    const modelToggle = document.getElementById('model-toggle');
    const modelMenu = document.getElementById('model-menu');
    const currentModelName = document.getElementById('current-model-name');
    let currentModelValue = 'deepseek-ai/DeepSeek-R1-0528-Qwen3-8B';

    if (modelToggle && modelMenu) {
        modelToggle.onclick = (e) => { e.stopPropagation(); modelMenu.classList.toggle('show'); };
        document.addEventListener('click', () => modelMenu.classList.remove('show'));
    }
    
    document.querySelectorAll('.model-option').forEach(opt => {
        opt.onclick = (e) => {
            e.stopPropagation();
            document.querySelectorAll('.model-option').forEach(i => i.classList.remove('active'));
            opt.classList.add('active');
            currentModelValue = opt.dataset.value;
            if (currentModelName) currentModelName.textContent = opt.querySelector('.opt-title').textContent.split(' ')[0];
            if (modelMenu) modelMenu.classList.remove('show');
        };
    });

    // 历史记录与页面操作
    let chats = [];
    let currentChatId = null;
    try {
        const localData = localStorage.getItem('ai_chats');
        if (localData) { chats = JSON.parse(localData); if (!Array.isArray(chats)) chats = []; }
    } catch (e) { chats = []; }

    function renderHistory() {
        if (!historyList) return;
        historyList.innerHTML = '<div class="history-title">历史记录</div>';
        chats.forEach(chat => {
            const item = document.createElement('div'); item.className = 'history-item glass-btn';
            if (chat.id === currentChatId) item.classList.add('active');
            item.innerHTML = `<span class="title">${escapeHTML(chat.title)}</span><button class="delete-btn" title="删除">🗑️</button>`;
            
            item.onclick = () => {
                if (currentAbortController) { currentAbortController.abort(); finishGenerationUI(); }
                currentChatId = chat.id; if(chatBox) chatBox.innerHTML = ''; document.body.classList.add('chat-active'); 
                chat.messages.forEach(msg => appendMessage(msg.content, msg.role));
                renderHistory(); if (window.innerWidth <= 768 && sidebar) sidebar.classList.remove('active');
            };
            item.querySelector('.delete-btn').onclick = (e) => {
                e.stopPropagation(); chats = chats.filter(c => c.id !== chat.id); localStorage.setItem('ai_chats', JSON.stringify(chats));
                if (currentChatId === chat.id && newChatBtn) newChatBtn.click(); renderHistory();
            };
            historyList.appendChild(item);
        });
    }
    renderHistory();

    if (newChatBtn) newChatBtn.onclick = () => location.reload(); // 极度稳定：刷新重置
    if (menuBtn && sidebar) menuBtn.onclick = () => sidebar.classList.add('active');
    if (closeSidebarBtn && sidebar) closeSidebarBtn.onclick = () => sidebar.classList.remove('active');

    if (userInput) {
        userInput.onkeypress = (e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage(); } };
        userInput.oninput = function() { this.style.height = 'auto'; this.style.height = this.scrollHeight + 'px'; };
    }
    if (sendBtn) sendBtn.onclick = sendMessage;

    // 核心发送引擎
    async function sendMessage() {
        if (!userInput || !sendBtn || !chatBox) return;

        if (sendBtn.classList.contains('generating')) {
            if (currentAbortController) { currentAbortController.abort(); finishGenerationUI(); }
            return;
        }

        const text = userInput.value.trim();
        if (!text) return;

        document.body.classList.add('chat-active'); 
        sendBtn.classList.add('generating'); 
        currentAbortController = new AbortController();

        if (!currentChatId) {
            currentChatId = Date.now().toString();
            chats.unshift({ id: currentChatId, title: text.substring(0, 15), messages: [] });
        }

        appendMessage(text, 'user');
        saveMessageToLocal(currentChatId, 'user', text);
        renderHistory();
        userInput.value = ''; userInput.style.height = 'auto';

        const aiMessageDiv = document.createElement('div');
        aiMessageDiv.className = 'message ai-message';
        const bubbleDiv = document.createElement('div');
        bubbleDiv.className = 'bubble glass-panel'; 
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
            saveMessageToLocal(currentChatId, 'ai', fullReply);
        } catch (error) {
            if (error.name === 'AbortError') {
                if (!bubbleDiv.innerHTML.includes('single-breathing-dot')) {
                    aiMessageDiv.appendChild(createCopyButton(bubbleDiv.innerText));
                    saveMessageToLocal(currentChatId, 'ai', bubbleDiv.innerText + " [已中断]");
                } else { bubbleDiv.innerHTML = "<span style='color:var(--text-muted); font-size: 0.9em;'>[已取消生成]</span>"; }
            } else {
                bubbleDiv.innerHTML = "抱歉，网络开小差了，请重试。";
                bubbleDiv.style.color = "red";
            }
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
        const btn = document.createElement('button'); btn.className = 'copy-btn glass-btn';
        btn.innerHTML = `复制`;
        btn.onclick = () => { navigator.clipboard.writeText(text).then(() => { const originalHTML = btn.innerHTML; btn.innerHTML = '✅ 已复制'; setTimeout(() => btn.innerHTML = originalHTML, 2000); }); };
        return btn;
    }

    function saveMessageToLocal(id, role, content) {
        const chat = chats.find(c => c.id === id);
        if (chat) { chat.messages.push({ role, content }); localStorage.setItem('ai_chats', JSON.stringify(chats)); }
    }
    function escapeHTML(str) { return str.replace(/[&<>'"]/g, tag => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[tag] || tag)); }
});
