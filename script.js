const chatBox = document.getElementById('chat-box');
const userInput = document.getElementById('user-input');
const sendBtn = document.getElementById('send-btn');
const modelSelect = document.getElementById('model-select');
const newChatBtn = document.getElementById('new-chat-btn');
const closeSidebarBtn = document.getElementById('close-sidebar-btn');
const menuBtn = document.getElementById('menu-btn');
const sidebar = document.getElementById('sidebar');
const historyList = document.getElementById('history-list');

let chats = [];
let currentChatId = null;
try {
    const localData = localStorage.getItem('ai_chats');
    if (localData) {
        chats = JSON.parse(localData);
        if (!Array.isArray(chats)) chats = [];
    }
} catch (e) {
    console.warn('缓存数据损坏，已重置为空。');
    chats = [];
}

renderHistory();

if(menuBtn) menuBtn.addEventListener('click', () => sidebar.classList.add('active'));
if(closeSidebarBtn) closeSidebarBtn.addEventListener('click', () => sidebar.classList.remove('active'));

// 💥 关键一：点击新对话时，撕下标签，页面回到初始空旷状态
newChatBtn.addEventListener('click', () => {
    currentChatId = null;
    chatBox.innerHTML = ''; 
    document.body.classList.remove('chat-active'); // 触发动画：方框飞回中央，大字降落
    
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

    // 💥 关键二：发出消息时，贴上标签，触发降落形变动画
    document.body.classList.add('chat-active'); 

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
        
        loadingMessageDiv.querySelector('.bubble').innerHTML = safeMarkdown(data.reply);
        saveMessageToLocal(currentChatId, 'ai', data.reply);

    } catch (error) {
        console.error('Error:', error);
        loadingMessageDiv.querySelector('.bubble').textContent = "抱歉，网络开小差了，请稍后再试。";
        loadingMessageDiv.querySelector('.bubble').style.color = "red";
    }
}

function safeMarkdown(text) {
    try {
        return marked.parse(text);
    } catch (e) {
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
            
            // 💥 关键三：点击历史记录时，也触发降落动画
            document.body.classList.add('chat-active'); 
            
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
