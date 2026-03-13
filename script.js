// 核心节点获取
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

// 💥 强力防崩溃读取缓存
let chats = [];
let currentChatId = null;
try {
    const localData = localStorage.getItem('ai_chats');
    if (localData) {
        chats = JSON.parse(localData);
        if (!Array.isArray(chats)) chats = []; // 发现数据不是数组，强行矫正
    }
} catch (e) {
    console.warn('缓存数据损坏，已重置为空。');
    chats = [];
}

// 初始化渲染
renderHistory();

// 侧边栏交互
if(menuBtn) menuBtn.addEventListener('click', () => sidebar.classList.add('active'));
if(closeSidebarBtn) closeSidebarBtn.addEventListener('click', () => sidebar.classList.remove('active'));

// 点击“开启新对话”
newChatBtn.addEventListener('click', () => {
    currentChatId = null;
    chatBox.innerHTML = ''; 
    heroGreeting.style.display = 'block'; // 让大字回来
    setTimeout(() => heroGreeting.classList.remove('hidden'), 50); // 柔和显示
    
    document.querySelectorAll('.history-item').forEach(item => item.classList.remove('active'));
    if(window.innerWidth <= 768) sidebar.classList.remove('active');
});

// 输入框逻辑
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

// 核心发送逻辑
async function sendMessage() {
    const text = userInput.value.trim();
    if (!text) return;

    // 发消息时隐藏大字
    heroGreeting.classList.add('hidden');
    setTimeout(() => { if(heroGreeting.classList.contains('hidden')) heroGreeting.style.display = 'none'; }, 300);

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
        
        // 💥 安全的 Markdown 渲染
        loadingMessageDiv.querySelector('.bubble').innerHTML = safeMarkdown(data.reply);
        saveMessageToLocal(currentChatId, 'ai', data.reply);

    } catch (error) {
        console.error('Error:', error);
        loadingMessageDiv.querySelector('.bubble').textContent = "抱歉，网络开小差了，请稍后再试。";
        loadingMessageDiv.querySelector('.bubble').style.color = "red";
    }
}

// 安全渲染函数
function safeMarkdown(text) {
    try {
        // 使用现代版 marked.parse 解析
        return marked.parse(text);
    } catch (e) {
        // 万一解析库出问题，退回到普通文本换行，绝不让屏幕崩溃
        console.error('Markdown解析失败', e);
        return escapeHTML(text).replace(/\n/g, '<br>');
    }
}

function appendMessage(text, sender) {
    const messageDiv = document.createElement('div');
    messageDiv.classList.add('message', sender === 'user' ? 'user-message' : 'ai-message');
    
    if (sender === 'user') {
        messageDiv.innerHTML = `<div class="bubble">${escapeHTML(text).replace(/\n/g, '<br>')}</div>`;
    } else {
        messageDiv.innerHTML = `<div class="bubble">${safeMarkdown(text)}</div>`;
    }
    
    chatBox.appendChild(messageDiv);
    chatBox.scrollTop = chatBox.scrollHeight;
    return messageDiv;
}

function appendLoadingBubble() {
    const messageDiv = document.createElement('div');
    messageDiv.classList.add('message', 'ai-message');
    messageDiv.innerHTML = `<div class="bubble"><div class="typing-indicator"><div class="dot"></div><div class="dot"></div><div class="dot"></div></div></div>`;
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
            heroGreeting.style.display = 'none'; // 切换记录时隐藏大字
            
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
}
