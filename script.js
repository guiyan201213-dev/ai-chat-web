const chatBox = document.getElementById('chat-box');
const userInput = document.getElementById('user-input');
const sendBtn = document.getElementById('send-btn');
const newChatBtn = document.getElementById('new-chat-btn');
const closeSidebarBtn = document.getElementById('close-sidebar-btn');
const menuBtn = document.getElementById('menu-btn');
const sidebar = document.getElementById('sidebar');
const historyList = document.getElementById('history-list');

// 💥 自定义模型菜单逻辑
const modelToggle = document.getElementById('model-toggle');
const modelMenu = document.getElementById('model-menu');
const currentModelName = document.getElementById('current-model-name');
const modelOptions = document.querySelectorAll('.model-option');
let currentModelValue = 'deepseek-ai/DeepSeek-R1-0528-Qwen3-8B';

// 点击按钮打开/关闭面板
modelToggle.addEventListener('click', (e) => {
    e.stopPropagation();
    modelMenu.classList.toggle('show');
});

// 点击空白处收起面板
document.addEventListener('click', () => {
    modelMenu.classList.remove('show');
});

// 选择模型
modelOptions.forEach(option => {
    option.addEventListener('click', (e) => {
        e.stopPropagation();
        modelOptions.forEach(opt => opt.classList.remove('active'));
        option.classList.add('active');
        currentModelValue = option.dataset.value;
        // 把标题的文字提取出来填到按钮上
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
    currentChatId = null;
    chatBox.innerHTML = ''; 
    document.body.classList.remove('chat-active'); 
    document.querySelectorAll('.history-item').forEach(item => item.classList.remove('active'));
    if(window.innerWidth <= 768) sidebar.classList.remove('active');
});

userInput.addEventListener('keypress', function (e) {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage(); }
});
sendBtn.addEventListener('click', sendMessage);
userInput.addEventListener('input', function() {
    this.style.height = 'auto'; this.style.height = (this.scrollHeight) + 'px';
});

async function sendMessage() {
    const text = userInput.value.trim();
    if (!text) return;

    document.body.classList.add('chat-active'); 

    if (!currentChatId) {
        currentChatId = Date.now().toString();
        chats.unshift({ id: currentChatId, title: text.substring(0, 15), messages: [] });
    }

    appendMessage(text, 'user');
    saveMessageToLocal(currentChatId, 'user', text);
    renderHistory();
    
    userInput.value = '';
    userInput.style.height = 'auto';

    // 💥 初始化气泡，只放入一颗纯黑呼吸点
    const aiMessageDiv = document.createElement('div');
    aiMessageDiv.classList.add('message', 'ai-message');
    const bubbleDiv = document.createElement('div');
    bubbleDiv.classList.add('bubble', 'glass-panel'); 
    bubbleDiv.innerHTML = '<div class="single-breathing-dot"></div>'; 
    aiMessageDiv.appendChild(bubbleDiv);
    chatBox.appendChild(aiMessageDiv);
    chatBox.scrollTop = chatBox.scrollHeight;

    try {
        const response = await fetch('/api/chat', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ message: text, model: currentModelValue }) // 传自定义模型值
        });

        if (!response.ok) throw new Error('网络请求失败');
        
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
                            // 💥 纯净的文本渲染，没有光标，黑点会被替换掉
                            bubbleDiv.innerHTML = safeMarkdown(fullReply);
                            chatBox.scrollTop = chatBox.scrollHeight;
                        }
                    } catch (e) {}
                }
            }
        }
        
        // 结束时加上一键复制
        bubbleDiv.innerHTML = safeMarkdown(fullReply);
        aiMessageDiv.appendChild(createCopyButton(fullReply));
        saveMessageToLocal(currentChatId, 'ai', fullReply);

    } catch (error) {
        console.error('Error:', error);
        bubbleDiv.innerHTML = "抱歉，网络开小差了，请稍后再试。";
        bubbleDiv.style.color = "red";
    }
}

function safeMarkdown(text) {
    try { return marked.parse(text); } 
    catch (e) { return escapeHTML(text).replace(/\n/g, '<br>'); }
}

function appendMessage(text, sender) {
    const messageDiv = document.createElement('div');
    messageDiv.classList.add('message', sender === 'user' ? 'user-message' : 'ai-message');
    
    const bubbleDiv = document.createElement('div');
    bubbleDiv.classList.add('bubble');
    if(sender === 'ai') bubbleDiv.classList.add('glass-panel'); 

    if (sender === 'user') {
        bubbleDiv.innerHTML = escapeHTML(text).replace(/\n/g, '<br>');
        messageDiv.appendChild(bubbleDiv);
    } else {
        bubbleDiv.innerHTML = safeMarkdown(text);
        messageDiv.appendChild(bubbleDiv);
        messageDiv.appendChild(createCopyButton(text));
    }
    
    chatBox.appendChild(messageDiv);
    chatBox.scrollTop = chatBox.scrollHeight;
}

function createCopyButton(text) {
    const btn = document.createElement('button');
    btn.className = 'copy-btn glass-btn';
    btn.innerHTML = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path></svg> 复制`;
    btn.onclick = () => {
        navigator.clipboard.writeText(text).then(() => {
            const originalHTML = btn.innerHTML;
            btn.innerHTML = '✅ 已复制';
            setTimeout(() => btn.innerHTML = originalHTML, 2000);
        });
    };
    return btn;
}

function saveMessageToLocal(id, role, content) {
    const chat = chats.find(c => c.id === id);
    if (chat) {
        chat.messages.push({ role, content });
        localStorage.setItem('ai_chats', JSON.stringify(chats));
    }
}

function renderHistory() {
    historyList.innerHTML = '<div class="history-title">历史记录</div>';
    
    chats.forEach(chat => {
        const item = document.createElement('div');
        item.classList.add('history-item', 'glass-btn'); 
        if (chat.id === currentChatId) item.classList.add('active');
        
        item.innerHTML = `
            <span class="title">${escapeHTML(chat.title)}</span>
            <button class="delete-btn" title="删除记录">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 6h18M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2"></path></svg>
            </button>
        `;
        
        item.addEventListener('click', () => {
            currentChatId = chat.id;
            chatBox.innerHTML = '';
            document.body.classList.add('chat-active'); 
            
            chat.messages.forEach(msg => { appendMessage(msg.content, msg.role); });
            renderHistory();
            if(window.innerWidth <= 768) sidebar.classList.remove('active');
        });

        item.querySelector('.delete-btn').addEventListener('click', (e) => {
            e.stopPropagation(); 
            chats = chats.filter(c => c.id !== chat.id);
            localStorage.setItem('ai_chats', JSON.stringify(chats));
            if (currentChatId === chat.id) newChatBtn.click(); 
            renderHistory();
        });
        
        historyList.appendChild(item);
    });
}

function escapeHTML(str) { return str.replace(/[&<>'"]/g, tag => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[tag] || tag)); }
