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

// 💥 核心逻辑：本地保存历史记录
let chats = JSON.parse(localStorage.getItem('ai_chats')) || [];
let currentChatId = null;

// 初始化页面：渲染左侧历史列表
renderHistory();

// 侧边栏开关逻辑
if(menuBtn) menuBtn.addEventListener('click', () => sidebar.classList.add('active'));
if(closeSidebarBtn) closeSidebarBtn.addEventListener('click', () => sidebar.classList.remove('active'));

// 点击“开启新对话”
newChatBtn.addEventListener('click', () => {
    currentChatId = null;
    chatBox.innerHTML = ''; // 清空聊天区
    chatBox.appendChild(heroGreeting); // 把大字塞回来
    heroGreeting.style.display = 'block'; // 显示居中大字
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

    // 隐藏居中大字
    heroGreeting.style.display = 'none';

    // 处理新对话的保存逻辑
    if (!currentChatId) {
        currentChatId = Date.now().toString(); // 用时间戳做唯一ID
        chats.unshift({ 
            id: currentChatId, 
            title: text.substring(0, 15) + (text.length > 15 ? '...' : ''), // 用第一句话做标题
            messages: [] 
        });
    }

    // 把用户消息显示并保存
    appendMessage(text, 'user');
    saveMessageToLocal(currentChatId, 'user', text);
    renderHistory(); // 更新左侧列表
    
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
        
        // 替换动效，显示 AI 消息并保存
        loadingMessageDiv.querySelector('.bubble').innerHTML = escapeHTML(data.reply).replace(/\n/g, '<br>');
        saveMessageToLocal(currentChatId, 'ai', data.reply);

    } catch (error) {
        console.error('Error:', error);
        loadingMessageDiv.querySelector('.bubble').textContent = "抱歉，服务器开小差了，请稍后再试。";
        loadingMessageDiv.querySelector('.bubble').style.color = "red";
    }
}

// 在屏幕上添加气泡
function appendMessage(text, sender) {
    const messageDiv = document.createElement('div');
    messageDiv.classList.add('message', sender === 'user' ? 'user-message' : 'ai-message');
    messageDiv.innerHTML = `<div class="bubble">${escapeHTML(text).replace(/\n/g, '<br>')}</div>`;
    chatBox.appendChild(messageDiv);
    chatBox.scrollTop = chatBox.scrollHeight;
    return messageDiv;
}

// 呼吸灯气泡
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
