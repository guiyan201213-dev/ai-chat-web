// ==========================================
// 💥 必填项：初始化 Supabase
// ==========================================
const supabaseUrl = 'https://usotduffikxsrapjsanr.supabase.co'; // 形如 https://xxxx.supabase.co
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVzb3RkdWZmaWt4c3JhcGpzYW5yIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzM1NzEwNjgsImV4cCI6MjA4OTE0NzA2OH0.R_S5ddSNwtTubDj6lk300UxoN6ISJzJp09KHSFI9J2w'; // 形如 eyJhbG...

// 1. 获取所有界面元素
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
const userAvatar = document.getElementById('user-avatar');
const userName = document.getElementById('user-name');

// 2. 💥 钛合金防崩溃装甲：智能初始化 Supabase
let supabase = null;
let currentSession = null;

try {
    // 确保填了真实网址，并且 HTML 里引了 supabase 库
    if (supabaseUrl.startsWith('https://') && window.supabase) {
        supabase = window.supabase.createClient(supabaseUrl, supabaseKey);
        
        // 监听登录状态
        supabase.auth.onAuthStateChange((event, session) => {
            currentSession = session; 
            if (session && userInfo && loginBtn) {
                loginBtn.style.display = 'none';
                userInfo.style.display = 'flex';
                if (userName) userName.textContent = session.user.user_metadata.full_name || session.user.user_metadata.user_name || '用户';
                if (userAvatar) userAvatar.src = session.user.user_metadata.avatar_url || 'https://via.placeholder.com/150';
            } else if (userInfo && loginBtn) {
                loginBtn.style.display = 'flex';
                userInfo.style.display = 'none';
            }
        });
    } else {
        console.warn('⚠️ Supabase 尚未激活，可能未填写密钥或未引入库。');
    }
} catch (e) {
    console.error('Supabase 初始化报错:', e);
}

// 3. 登录与退出逻辑 (带安全拦截)
if (loginBtn) {
    loginBtn.addEventListener('click', async () => {
        if (!supabase) return alert('提示：请先在 script.js 顶部填入真实的 Supabase 网址和密钥！');
        const { error } = await supabase.auth.signInWithOAuth({ provider: 'github' });
        if (error) alert('登录失败: ' + error.message);
    });
}

if (logoutBtn) {
    logoutBtn.addEventListener('click', async () => { 
        if (supabase) await supabase.auth.signOut(); 
    });
}

// 4. 模型菜单逻辑
let currentAbortController = null;
const modelToggle = document.getElementById('model-toggle');
const modelMenu = document.getElementById('model-menu');
const currentModelName = document.getElementById('current-model-name');
const modelOptions = document.querySelectorAll('.model-option');
let currentModelValue = 'deepseek-ai/DeepSeek-R1-0528-Qwen3-8B';

if (modelToggle && modelMenu) {
    modelToggle.addEventListener('click', (e) => { 
        e.stopPropagation(); 
        modelMenu.classList.toggle('show'); 
    });
    document.addEventListener('click', () => { modelMenu.classList.remove('show'); });
}

if (modelOptions.length > 0) {
    modelOptions.forEach(option => {
        option.addEventListener('click', (e) => {
            e.stopPropagation();
            modelOptions.forEach(opt => opt.classList.remove('active'));
            option.classList.add('active');
            currentModelValue = option.dataset.value;
            if (currentModelName) currentModelName.textContent = option.querySelector('.opt-title').textContent.split(' ')[0];
            if (modelMenu) modelMenu.classList.remove('show');
        });
    });
}

// 5. 历史记录与初始化逻辑
let chats = [];
let currentChatId = null;
try {
    const localData = localStorage.getItem('ai_chats');
    if (localData) { chats = JSON.parse(localData); if (!Array.isArray(chats)) chats = []; }
} catch (e) { chats = []; }

if (historyList) renderHistory();

if (menuBtn && sidebar) menuBtn.addEventListener('click', () => sidebar.classList.add('active'));
if (closeSidebarBtn && sidebar) closeSidebarBtn.addEventListener('click', () => sidebar.classList.remove('active'));

if (newChatBtn) {
    newChatBtn.addEventListener('click', () => {
        if (currentAbortController) { currentAbortController.abort(); finishGenerationUI(); }
        currentChatId = null; 
        if (chatBox) chatBox.innerHTML = ''; 
        document.body.classList.remove('chat-active'); 
        document.querySelectorAll('.history-item').forEach(item => item.classList.remove('active'));
        if(window.innerWidth <= 768 && sidebar) sidebar.classList.remove('active');
    });
}

if (userInput) {
    userInput.addEventListener('keypress', function (e) { 
        if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage(); } 
    });
    userInput.addEventListener('input', function() { 
        this.style.height = 'auto'; 
        this.style.height = (this.scrollHeight) + 'px'; 
    });
}

if (sendBtn) sendBtn.addEventListener('click', sendMessage);

// 6. 核心对话逻辑
async function sendMessage() {
    if (!userInput || !sendBtn || !chatBox) return; // 安全防御

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
    if (historyList) renderHistory();
    
    userInput.value = ''; 
    userInput.style.height = 'auto';

    const aiMessageDiv = document.createElement('div');
    aiMessageDiv.classList.add('message', 'ai-message');
    const bubbleDiv = document.createElement('div');
    bubbleDiv.classList.add('bubble', 'glass-panel'); 
    bubbleDiv.innerHTML = '<div class="single-breathing-dot"></div>'; 
    aiMessageDiv.appendChild(bubbleDiv);
    chatBox.appendChild(aiMessageDiv);
    chatBox.scrollTop = chatBox.scrollHeight;

    const headers = { 'Content-Type': 'application/json' };
    if (currentSession) { headers['Authorization'] = `Bearer ${currentSession.access_token}`; }

    try {
        const response = await fetch('/api/chat', {
            method: 'POST',
            headers: headers,
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
            const lines = buffer.split('\n');
            buffer = lines.pop(); 
            
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
            const currentHTML = bubbleDiv.innerHTML;
            if (!currentHTML.includes('single-breathing-dot')) {
                aiMessageDiv.appendChild(createCopyButton(bubbleDiv.innerText));
                saveMessageToLocal(currentChatId, 'ai', bubbleDiv.innerText + " [已中断]");
            } else { bubbleDiv.innerHTML = "<span style='color:var(--text-muted); font-size: 0.9em;'>[已取消生成]</span>"; }
        } else {
            console.error('Error:', error);
            bubbleDiv.innerHTML = "抱歉，网络开小差了，请稍后再试。";
            bubbleDiv.style.color = "red";
        }
    } finally {
        finishGenerationUI();
    }
}

function finishGenerationUI() { 
    if (sendBtn) sendBtn.classList.remove('generating'); 
    currentAbortController = null; 
}

function safeMarkdown(text) { 
    try { return window.marked ? marked.parse(text) : escapeHTML(text).replace(/\n/g, '<br>'); } 
    catch (e) { return escapeHTML(text).replace(/\n/g, '<br>'); } 
}

function appendMessage(text, sender) {
    if (!chatBox) return;
    const messageDiv = document.createElement('div');
    messageDiv.classList.add('message', sender === 'user' ? 'user-message' : 'ai-message');
    const bubbleDiv = document.createElement('div');
    bubbleDiv.classList.add('bubble');
    if(sender === 'ai') bubbleDiv.classList.add('glass-panel'); 
    if (sender === 'user') { bubbleDiv.innerHTML = escapeHTML(text).replace(/\n/g, '<br>'); messageDiv.appendChild(bubbleDiv); } 
    else { bubbleDiv.innerHTML = safeMarkdown(text); messageDiv.appendChild(bubbleDiv); messageDiv.appendChild(createCopyButton(text)); }
    chatBox.appendChild(messageDiv); chatBox.scrollTop = chatBox.scrollHeight;
}

function createCopyButton(text) {
    const btn = document.createElement('button'); btn.className = 'copy-btn glass-btn';
    btn.innerHTML = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path></svg> 复制`;
    btn.onclick = () => { navigator.clipboard.writeText(text).then(() => { const originalHTML = btn.innerHTML; btn.innerHTML = '✅ 已复制'; setTimeout(() => btn.innerHTML = originalHTML, 2000); }); };
    return btn;
}

function saveMessageToLocal(id, role, content) {
    const chat = chats.find(c => c.id === id);
    if (chat) { chat.messages.push({ role, content }); localStorage.setItem('ai_chats', JSON.stringify(chats)); }
}

function renderHistory() {
    if (!historyList) return;
    historyList.innerHTML = '<div class="history-title">历史记录</div>';
    chats.forEach(chat => {
        const item = document.createElement('div'); item.classList.add('history-item', 'glass-btn'); 
        if (chat.id === currentChatId) item.classList.add('active');
        item.innerHTML = `<span class="title">${escapeHTML(chat.title)}</span><button class="delete-btn" title="删除"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 6h18M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2"></path></svg></button>`;
        item.addEventListener('click', () => {
            if (currentAbortController) { currentAbortController.abort(); finishGenerationUI(); }
            currentChatId = chat.id; if(chatBox) chatBox.innerHTML = ''; document.body.classList.add('chat-active'); 
            chat.messages.forEach(msg => { appendMessage(msg.content, msg.role); });
            renderHistory(); if(window.innerWidth <= 768 && sidebar) sidebar.classList.remove('active');
        });
        item.querySelector('.delete-btn').addEventListener('click', (e) => {
            e.stopPropagation(); chats = chats.filter(c => c.id !== chat.id); localStorage.setItem('ai_chats', JSON.stringify(chats));
            if (currentChatId === chat.id && newChatBtn) newChatBtn.click(); renderHistory();
        });
        historyList.appendChild(item);
    });
}

function escapeHTML(str) { return str.replace(/[&<>'"]/g, tag => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[tag] || tag)); }
