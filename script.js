// 获取页面上的核心元素
const chatBox = document.getElementById('chat-box');
const userInput = document.getElementById('user-input');
const sendBtn = document.getElementById('send-btn');
const modelSelect = document.getElementById('model-select');

// 让输入框按回车键也能发送（按 Shift+Enter 是换行）
userInput.addEventListener('keypress', function (e) {
    if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault(); // 阻止默认的换行行为
        sendMessage();
    }
});

// 点击发送按钮触发发送
sendBtn.addEventListener('click', sendMessage);

// 核心发送逻辑
async function sendMessage() {
    const text = userInput.value.trim();
    if (!text) return; // 如果输入为空，什么都不做

    // 1. 把用户的话显示在界面上
    appendMessage(text, 'user');
    userInput.value = ''; // 清空输入框
    userInput.style.height = 'auto'; // 恢复输入框高度

    // 2. 显示 AI 正在思考的动画（这里先用简单的文字代替）
    const loadingMessageDiv = appendMessage('正在思考中...', 'ai', true);

    // 3. 向后端发送请求 (注意：我们等下就要去写这个 /api/chat 接口)
    try {
        const response = await fetch('/api/chat', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                message: text,
                model: modelSelect.value // 把当前选择的模型也发给后端
            })
        });

        if (!response.ok) {
            throw new Error('网络请求失败');
        }

        const data = await response.json();
        
        // 4. 把后端的真实回复替换掉“正在思考中...”
        loadingMessageDiv.querySelector('.bubble').textContent = data.reply;

    } catch (error) {
        console.error('Error:', error);
        loadingMessageDiv.querySelector('.bubble').textContent = "抱歉，服务器开小差了，请稍后再试。";
        loadingMessageDiv.querySelector('.bubble').style.color = "red";
    }
}

// 在聊天框里添加气泡的函数
function appendMessage(text, sender, isLoading = false) {
    // 创建一个新的 div
    const messageDiv = document.createElement('div');
    messageDiv.classList.add('message');
    
    // 判断是用户的还是 AI 的，加上对应的样式
    if (sender === 'user') {
        messageDiv.classList.add('user-message');
        messageDiv.innerHTML = `
            <div class="bubble">${escapeHTML(text)}</div>
        `;
    } else {
        messageDiv.classList.add('ai-message');
        messageDiv.innerHTML = `
            <div class="avatar">${isLoading ? '⏳' : '🤖'}</div>
            <div class="bubble">${escapeHTML(text)}</div>
        `;
    }

    // 把新气泡塞进聊天框
    chatBox.appendChild(messageDiv);
    
    // 让聊天框自动滚动到最底部，露出最新消息
    chatBox.scrollTop = chatBox.scrollHeight;

    return messageDiv; // 返回这个元素，方便后面修改它（比如替换 loading 状态）
}

// 安全处理：防止用户输入恶意代码 (XSS攻击)
function escapeHTML(str) {
    return str.replace(/[&<>'"]/g, 
        tag => ({
            '&': '&amp;',
            '<': '&lt;',
            '>': '&gt;',
            "'": '&#39;',
            '"': '&quot;'
        }[tag] || tag)
    );
}

// 输入框高度自适应（文字多了自动变高）
userInput.addEventListener('input', function() {
    this.style.height = 'auto';
    this.style.height = (this.scrollHeight) + 'px';
});
