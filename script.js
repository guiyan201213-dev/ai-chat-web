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

// 💥 核心网络请求：流式读取 (Streaming)
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

    // 预先建立一个空的 AI 气泡
    const aiMessageDiv = document.createElement('div');
    aiMessageDiv.classList.add('message', 'ai-message');
    const bubbleDiv = document.createElement('div');
    bubbleDiv.classList.add('bubble', 'glass-panel'); 
    bubbleDiv.innerHTML = '<span class="cursor">|</span>'; // 闪烁的光标
    aiMessageDiv.appendChild(bubbleDiv);
    chatBox.appendChild(aiMessageDiv);
    chatBox.scrollTop = chatBox.scrollHeight;

    try {
        const response = await fetch('/api/chat', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ message: text, model: modelSelect.value })
        });

        if (!response.ok) throw new Error('网络请求失败');
        
        // 💥 开始像水管一样接水
        const reader = response.body.getReader();
        const decoder = new TextDecoder("utf-8");
        let fullReply = "";
        let buffer = ""; // 防断行截断的缓冲区

        while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            
            buffer += decoder.decode(value, { stream: true });
            const lines = buffer.split('\n');
            buffer = lines.pop(); // 保留不完整的一行
            
            for (const line of lines) {
                if (line.startsWith('data: ')) {
                    const dataStr = line.slice(6).trim();
                    if (dataStr === '[DONE]') break;
                    try {
                        const parsed = JSON.parse(dataStr);
                        if (parsed.error) throw new Error(parsed.error);
                        if (parsed.text) {
                            fullReply += parsed.text;
                            // 实时渲染并向下滚动
                            bubbleDiv.innerHTML = safeMarkdown(fullReply) + '<span class="cursor">|</span>';
                            chatBox.scrollTop = chatBox.scrollHeight;
                        }
                    } catch (e) { /* 忽略单个碎片的 JSON 解析错误 */ }
                }
            }
        }
        
        // 传输完毕，去掉光标，加上一键复制按钮
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
    if(sender === 'ai') bubbleDiv.classList.add('glass-panel'); // AI气泡用玻璃态

    if (sender === 'user') {
        bubbleDiv.innerHTML = escapeHTML(text).replace(/\n/g, '<br>');
        messageDiv.appendChild(bubbleDiv);
    } else {
        bubbleDiv.innerHTML = safeMarkdown(text);
        messageDiv.appendChild(bubbleDiv);
        messageDiv.appendChild(createCopyButton(text)); // 历史记录恢复时也带上复制按钮
    }
    
    chatBox.appendChild(messageDiv);
    chatBox.scrollTop = chatBox.scrollHeight;
}

// 💥 新增：生成“一键复制”按钮
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

// 💥 更新：历史记录自带“删除功能”
function renderHistory() {
    historyList.innerHTML = '<div class="history-title">历史记录</div>';
    
    chats.forEach(chat => {
        const item = document.createElement('div');
        item.classList.add('history-item', 'glass-btn'); // 玻璃态列表项
        if (chat.id === currentChatId) item.classList.add('active');
        
        // 标题与删除按钮
        item.innerHTML = `
            <span class="title">${escapeHTML(chat.title)}</span>
            <button class="delete-btn" title="删除记录">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 6h18M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2"></path></svg>
            </button>
        `;
        
        // 点击切换历史记录
        item.addEventListener('click', () => {
            currentChatId = chat.id;
            chatBox.innerHTML = '';
            document.body.classList.add('chat-active'); 
            
            chat.messages.forEach(msg => { appendMessage(msg.content, msg.role); });
            renderHistory();
            if(window.innerWidth <= 768) sidebar.classList.remove('active');
        });

        // 💥 新增：点击删除按钮的独立逻辑
        item.querySelector('.delete-btn').addEventListener('click', (e) => {
            e.stopPropagation(); // 阻止触发上面的点击切换事件
            chats = chats.filter(c => c.id !== chat.id);
            localStorage.setItem('ai_chats', JSON.stringify(chats));
            if (currentChatId === chat.id) newChatBtn.click(); // 如果删的是当前的，自动清屏开启新对话
            renderHistory();
        });
        
        historyList.appendChild(item);
    });
}

function escapeHTML(str) { return str.replace(/[&<>'"]/g, tag => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[tag] || tag)); }
