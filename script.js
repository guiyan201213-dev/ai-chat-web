const chatBox = document.getElementById('chat-box');
const userInput = document.getElementById('user-input');
const sendBtn = document.getElementById('send-btn');
const modelSelect = document.getElementById('model-select');
const newChatBtn = document.getElementById('new-chat-btn');
const menuBtn = document.getElementById('menu-btn');
const sidebar = document.getElementById('sidebar');

// 手机端侧边栏切换
if(menuBtn) {
    menuBtn.addEventListener('click', () => {
        sidebar.classList.toggle('active');
    });
}

// 💥 新增：点击“新对话”按钮清空屏幕
newChatBtn.addEventListener('click', () => {
    chatBox.innerHTML = `
        <div class="message ai-message">
            <div class="bubble">
                你好！我是你的专属 AI 助手。请问今天想聊点什么？
            </div>
        </div>
    `;
    if(window.innerWidth <= 768) { sidebar.classList.remove('active'); }
});

// 输入框回车发送
userInput.addEventListener('keypress', function (e) {
    if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        sendMessage();
    }
});

sendBtn.addEventListener('click', sendMessage);

// 输入框高度自适应
userInput.addEventListener('input', function() {
    this.style.height = 'auto';
    this.style.height = (this.scrollHeight) + 'px';
});

async function sendMessage() {
    const text = userInput.value.trim();
    if (!text) return;

    appendMessage(text, 'user');
    userInput.value = '';
    userInput.style.height = 'auto';

    // 💥 改变：这里调用的是带呼吸灯动效的气泡
    const loadingMessageDiv = appendLoadingBubble();

    try {
        const response = await fetch('/api/chat', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                message: text,
                model: modelSelect.value
            })
        });

        if (!response.ok) throw new Error('网络请求失败');
        
        const data = await response.json();
        
        // 替换呼吸灯为真实文字
        loadingMessageDiv.querySelector('.bubble').innerHTML = escapeHTML(data.reply).replace(/\n/g, '<br>');

    } catch (error) {
        console.error('Error:', error);
        loadingMessageDiv.querySelector('.bubble').textContent = "抱歉，服务器开小差了，请稍后再试。";
        loadingMessageDiv.querySelector('.bubble').style.color = "red";
    }
}

function appendMessage(text, sender) {
    const messageDiv = document.createElement('div');
    messageDiv.classList.add('message');
    
    if (sender === 'user') {
        messageDiv.classList.add('user-message');
        messageDiv.innerHTML = `<div class="bubble">${escapeHTML(text).replace(/\n/g, '<br>')}</div>`;
    } 

    chatBox.appendChild(messageDiv);
    chatBox.scrollTop = chatBox.scrollHeight;
    return messageDiv;
}

// 💥 新增：专属的呼吸灯气泡生成函数
function appendLoadingBubble() {
    const messageDiv = document.createElement('div');
    messageDiv.classList.add('message', 'ai-message');
    messageDiv.innerHTML = `
        <div class="bubble">
            <div class="typing-indicator">
                <div class="dot"></div>
                <div class="dot"></div>
                <div class="dot"></div>
            </div>
        </div>
    `;
    chatBox.appendChild(messageDiv);
    chatBox.scrollTop = chatBox.scrollHeight;
    return messageDiv;
}

function escapeHTML(str) {
    return str.replace(/[&<>'"]/g, tag => ({
        '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;'
    }[tag] || tag));
}
