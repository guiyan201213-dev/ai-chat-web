// ==========================================
// 💥 必填项：初始化 Supabase (请替换为你自己的密钥)
// ==========================================
const supabaseUrl = 'https://usotduffikxsrapjsanr.supabase.co'; // 形如 https://xxxx.supabase.co
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVzb3RkdWZmaWt4c3JhcGpzYW5yIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzM1NzEwNjgsImV4cCI6MjA4OTE0NzA2OH0.R_S5ddSNwtTubDj6lk300UxoN6ISJzJp09KHSFI9J2w'; // 形如 eyJhbG...
const supabase = window.supabase.createClient(supabaseUrl, supabaseKey);
let currentSession = null;

const chatBox = document.getElementById('chat-box');
const userInput = document.getElementById('user-input');
const sendBtn = document.getElementById('send-btn');
const newChatBtn = document.getElementById('new-chat-btn');
const closeSidebarBtn = document.getElementById('close-sidebar-btn');
const menuBtn = document.getElementById('menu-btn');
const sidebar = document.getElementById('sidebar');
const historyList = document.getElementById('history-list');

// 登录 UI 元素
const loginBtn = document.getElementById('login-btn');
const logoutBtn = document.getElementById('logout-btn');
const userInfo = document.getElementById('user-info');
const userAvatar = document.getElementById('user-avatar');
const userName = document.getElementById('user-name');

// 💥 监听登录状态
supabase.auth.onAuthStateChange((event, session) => {
    currentSession = session; // 把凭证存起来，等下发给后端
    if (session) {
        loginBtn.style.display = 'none';
        userInfo.style.display = 'flex';
        userName.textContent = session.user.user_metadata.full_name || session.user.user_metadata.user_name || '用户';
        userAvatar.src = session.user.user_metadata.avatar_url || 'https://via.placeholder.com/150';
    } else {
        loginBtn.style.display = 'flex';
        userInfo.style.display = 'none';
    }
});

// 触发登录与退出
loginBtn.addEventListener('click', async () => {
    const { error } = await supabase.auth.signInWithOAuth({ provider: 'github' });
    if (error) alert('登录失败: ' + error.message);
});
logoutBtn.addEventListener('click', async () => { await supabase.auth.signOut(); });

let currentAbortController = null;
const modelToggle = document.getElementById('model-toggle');
const modelMenu = document.getElementById('model-menu');
const currentModelName = document.getElementById('current-model-name');
const modelOptions = document.querySelectorAll('.model-option');
let currentModelValue = 'deepseek-ai/DeepSeek-R1-0528-Qwen3-8B';

modelToggle.addEventListener('click', (e) => { e.stopPropagation(); modelMenu.classList.toggle('show'); });
document.addEventListener('click', () => { modelMenu.classList.remove('show'); });

modelOptions.forEach(option => {
    option.addEventListener('click', (e) => {
        e.stopPropagation();
        modelOptions.forEach(opt => opt.classList.remove('active'));
        option.classList.add('active');
        currentModelValue = option.dataset.value;
        currentModelName.textContent = option.querySelector('.opt-title').textContent.split(' ')[0];
        modelMenu.classList.remove('show');
    });
});

let chats = [];
let currentChatId = null;
try {
    const localData = localStorage.getItem('ai_chats');
    if (localData) { chats = JSON.parse(localData); if (!Array.isArray(chats)) chats = []; }
} catch (e) { chats = []; }

renderHistory();

if(menuBtn) menuBtn.addEventListener('click', () => sidebar.classList.add('active'));
if(closeSidebarBtn) closeSidebarBtn.addEventListener('click', () => sidebar.classList.remove('active'));

newChatBtn.addEventListener('click', () => {
    if (currentAbortController) { currentAbortController.abort(); finishGenerationUI(); }
    currentChatId = null; chatBox.innerHTML = ''; 
    document.body.classList.remove('chat-active'); 
    document.querySelectorAll('.history-item').forEach(item => item.classList.remove('active'));
    if(window.innerWidth <= 768) sidebar.classList.remove('active');
});

userInput.addEventListener('keypress', function (e) { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage(); } });
sendBtn.addEventListener('click', sendMessage);
userInput.addEventListener('input', function() { this.style.height = 'auto'; this.style.height = (this.scrollHeight) + 'px'; });

async function sendMessage() {
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
    aiMessageDiv.classList.add('message', 'ai-message');
    const bubbleDiv = document.createElement('div');
    bubbleDiv.classList.add('bubble', 'glass-panel'); 
    bubbleDiv.innerHTML = '<div class="single-breathing-dot"></div>'; 
    aiMessageDiv.appendChild(bubbleDiv);
    chatBox.appendChild(aiMessageDiv);
    chatBox.scrollTop = chatBox.scrollHeight;

    // 💥 核心修改：向后端发请求时，把通行证带上
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

function finishGenerationUI() { sendBtn.classList.remove('generating'); currentAbortController = null; }
function safeMarkdown(text) { try { return marked.parse(text); } catch (e) { return escapeHTML(text).replace(/\n/g, '<br>'); } }

function appendMessage(text, sender) {
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
    historyList.innerHTML = '<div class="history-title">历史记录</div>';
    chats.forEach(chat => {
        const item = document.createElement('div'); item.classList.add('history-item', 'glass-btn'); 
        if (chat.id === currentChatId) item.classList.add('active');
        item.innerHTML = `<span class="title">${escapeHTML(chat.title)}</span><button class="delete-btn" title="删除"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 6h18M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2"></path></svg></button>`;
        item.addEventListener('click', () => {
            if (currentAbortController) { currentAbortController.abort(); finishGenerationUI(); }
            currentChatId = chat.id; chatBox.innerHTML = ''; document.body.classList.add('chat-active'); 
            chat.messages.forEach(msg => { appendMessage(msg.content, msg.role); });
            renderHistory(); if(window.innerWidth <= 768) sidebar.classList.remove('active');
        });
        item.querySelector('.delete-btn').addEventListener('click', (e) => {
            e.stopPropagation(); chats = chats.filter(c => c.id !== chat.id); localStorage.setItem('ai_chats', JSON.stringify(chats));
            if (currentChatId === chat.id) newChatBtn.click(); renderHistory();
        });
        historyList.appendChild(item);
    });
}

function escapeHTML(str) { return str.replace(/[&<>'"]/g, tag => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[tag] || tag)); }
