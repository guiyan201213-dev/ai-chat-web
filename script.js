// 初始化 Markdown 解析器和代码高亮
marked.setOptions({
    highlight: function(code, lang) {
        const language = hljs.getLanguage(lang) ? lang : 'plaintext';
        return hljs.highlight(code, { language }).value;
    },
    langPrefix: 'hljs language-'
});

const chatBox = document.getElementById('chat-box');
const userInput = document.getElementById('user-input');
const sendBtn = document.getElementById('send-btn');
const modelSelect = document.getElementById('model-select');
const newChatBtn = document.getElementById('new-chat-btn');
const closeSidebarBtn = document.getElementById('close-sidebar-btn');
const menuBtn = document.getElementById('menu-btn');
const sidebar = document.getElementById('sidebar');
const heroGreeting = document.getElementById('hero-greeting');
const historyList = document.getElementById('history-list');

// 💥 增加错误捕获：防止缓存出错导致全站崩溃
let chats = [];
try {
    chats = JSON.parse(localStorage.getItem('ai_chats')) || [];
} catch (e) {
    console.error("解析缓存失败，重置为空。");
    chats = [];
}
let currentChatId = null;

// 页面加载完毕即渲染历史
renderHistory();

// 侧边栏开关
if(menuBtn) menuBtn.addEventListener('click', () => sidebar.classList.add('active'));
if(closeSidebarBtn) closeSidebarBtn.addEventListener('click', () => sidebar.classList.remove('active'));

// 💥 核心修复：开启新对话的逻辑优化
newChatBtn.addEventListener('click', () => {
    currentChatId = null;
    chatBox.innerHTML = ''; // 清空聊天记录
    heroGreeting.classList.remove('hidden'); // 显示居中大字
    
    document.querySelectorAll('.history-item').forEach(item => item.classList.remove('active'));
    if(window.innerWidth <= 768) sidebar.classList.remove('active');
});

userInput.addEventListener('keypress', function (e) {
    if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        sendMessage();
    }
});

sendBtn.addEventListener('click', sendMessage);

userInput.addEventListener('input', function() {
    this.style.height = 'auto';
    this.style.height = (this.scrollHeight) + 'px';
});

async function sendMessage() {
    const text = userInput.value.trim();
    if (!text) return;

    // 发送消息时隐藏大字
    heroGreeting.classList.add('hidden');

    if (!currentChatId) {
        currentChatId = Date.now().toString();
        chats.unshift({ 
            id: currentChatId, 
            title: text.substring(0, 15) + (text.length > 15 ? '...' : ''), 
            messages: [] 
        });
    }

    appendMessage(text, 'user');
    saveMessageToLocal(currentChatId, 'user', text);
    renderHistory();
    
    userInput.value = '';
    userInput.style.height = 'auto';

    const loadingMessageDiv = appendLoadingBubble();

    try {
        const response = await fetch('/api/chat', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ message: text, model: modelSelect.value })
        });

        if (!response.ok) throw new Error('网络请求失败');
        
        const data = await response.json();
        
        // 💥 核心：将原本的直接显示替换为 Markdown 渲染
        loadingMessageDiv.querySelector('.bubble').innerHTML = marked.parse(data.reply);
        saveMessageToLocal(currentChatId, 'ai', data.reply);

    } catch (error) {
        console.error('Error:', error);
        loadingMessageDiv.querySelector('.bubble').textContent = "抱歉，服务器开小差了，请稍后再试。";
        loadingMessageDiv.querySelector('.bubble').style.color = "red";
    }
}

// 💥 核心：根据不同身份渲染文本或 Markdown
function appendMessage(text, sender) {
    const messageDiv = document.createElement('div');
    messageDiv.classList.add('message', sender === 'user' ? 'user-message' : 'ai-message');
    
    if (sender === 'user') {
        // 用户的话直接显示，防止被解析成奇怪的格式
        messageDiv.innerHTML = `<div class="bubble">${escapeHTML(text).replace(/\n/g, '<br>')}</div>`;
    } else {
        // AI 的话进行高级 Markdown 渲染
        messageDiv.innerHTML = `<div class="bubble">${marked.parse(text)}</div>`;
    }
    
    chatBox.appendChild(messageDiv);
    chatBox.scrollTop = chatBox.scrollHeight;
    return messageDiv;
}

function appendLoadingBubble() {
    const messageDiv = document.createElement('div');
    messageDiv.classList.add('message', 'ai-message');
    messageDiv.innerHTML = `
        <div class="bubble">
            <div class="typing-indicator"><div class="dot"></div><div class="dot"></div><div class="dot"></div></div>
        </div>`;
    chatBox.appendChild(messageDiv);
    chatBox.scrollTop = chatBox.scrollHeight;
    return messageDiv;
}

function saveMessageToLocal(id, role, content) {
    const chat = chats.find(c => c.id === id);
    if (chat) {
        chat.messages.push({ role, content });
        localStorage.setItem('ai_chats', JSON.stringify(chats));
    }
}

function renderHistory() {
    historyList.innerHTML = '<div class="history-title">历史对话记录</div>';
    
    chats.forEach(chat => {
        const item = document.createElement('div');
        item.classList.add('history-item');
        if (chat.id === currentChatId) item.classList.add('active');
        item.textContent = chat.title;
        
        item.addEventListener('click', () => {
            currentChatId = chat.id;
            chatBox.innerHTML = '';
            heroGreeting.classList.add('hidden'); // 隐藏大字
            
            chat.messages.forEach(msg => {
                appendMessage(msg.content, msg.role);
            });
            
            renderHistory();
            if(window.innerWidth <= 768) sidebar.classList.remove('active');
        });
        
        historyList.appendChild(item);
    });
}

function escapeHTML(str) {
    return str.replace(/[&<>'"]/g, tag => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[tag] || tag));
}function appendLoadingBubble() {
    const messageDiv = document.createElement('div');
    messageDiv.classList.add('message', 'ai-message');
    messageDiv.innerHTML = `
        <div class="bubble">
            <div class="typing-indicator"><div class="dot"></div><div class="dot"></div><div class="dot"></div></div>
        </div>`;
    chatBox.appendChild(messageDiv);
    chatBox.scrollTop = chatBox.scrollHeight;
    return messageDiv;
}

// 💥 核心功能：把消息存到浏览器的缓存里
function saveMessageToLocal(id, role, content) {
    const chat = chats.find(c => c.id === id);
    if (chat) {
        chat.messages.push({ role, content });
        localStorage.setItem('ai_chats', JSON.stringify(chats));
    }
}

// 💥 核心功能：渲染左侧的历史记录列表
function renderHistory() {
    // 保留标题，清空下面的列表
    historyList.innerHTML = '<div class="history-title">历史对话记录</div>';
    
    chats.forEach(chat => {
        const item = document.createElement('div');
        item.classList.add('history-item');
        if (chat.id === currentChatId) item.classList.add('active');
        item.textContent = chat.title;
        
        // 点击历史记录，加载以前的对话
        item.addEventListener('click', () => {
            currentChatId = chat.id;
            chatBox.innerHTML = '';
            heroGreeting.style.display = 'none'; // 隐藏大字
            
            // 重新在屏幕上打出历史气泡
            chat.messages.forEach(msg => {
                appendMessage(msg.content, msg.rol    chatBox.scrollTop = chatBox.scrollHeight;
    return messageDiv;
}

function escapeHTML(str) {
    return str.replace(/[&<>'"]/g, tag => ({
        '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;'
    }[tag] || tag));
}
