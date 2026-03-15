const SB_URL = 'https://usotduffikxsrapjsanr.supabase.co';
const SB_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVzb3RkdWZmaWt4c3JhcGpzYW5yIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzM1NzEwNjgsImV4cCI6MjA4OTE0NzA2OH0.R_S5ddSNwtTubDj6lk300UxoN6ISJzJp09KHSFI9J2w';
const supabase = (SB_URL.startsWith('https')) ? window.supabase.createClient(SB_URL, SB_KEY) : null;

// 获取核心元素
const chatBox = document.getElementById('chat-box');
const userInput = document.getElementById('user-input');
const sendBtn = document.getElementById('send-btn');
const modelToggle = document.getElementById('model-toggle');
const modelMenu = document.getElementById('model-menu');
const modelText = document.getElementById('model-text');
const loginBtn = document.getElementById('login-btn');
const logoutBtn = document.getElementById('logout-btn');

let currentSession = null;
let currentModel = 'deepseek-ai/DeepSeek-R1-0528-Qwen3-8B';

// 1. 初始化登录
if (supabase) {
    supabase.auth.onAuthStateChange((event, session) => {
        currentSession = session;
        const infoPanel = document.getElementById('user-info');
        if (session) {
            loginBtn.style.display = 'none';
            infoPanel.style.display = 'flex';
            document.getElementById('user-avatar').src = session.user.user_metadata.avatar_url;
            document.getElementById('user-name').textContent = session.user.user_metadata.full_name || '用户';
        } else {
            loginBtn.style.display = 'block';
            infoPanel.style.display = 'none';
        }
    });
    loginBtn.onclick = () => supabase.auth.signInWithOAuth({ provider: 'github' });
    logoutBtn.onclick = () => supabase.auth.signOut();
}

// 2. 模型选择
modelToggle.onclick = (e) => { e.stopPropagation(); modelMenu.classList.toggle('show'); };
document.onclick = () => modelMenu.classList.remove('show');
document.querySelectorAll('.model-item').forEach(item => {
    item.onclick = (e) => {
        e.stopPropagation();
        currentModel = item.dataset.id;
        modelText.textContent = item.querySelector('b').textContent;
        document.querySelectorAll('.model-item').forEach(i => i.classList.remove('active'));
        item.classList.add('active');
        modelMenu.classList.remove('show');
    };
});

// 3. 发送逻辑
async function handleSend() {
    const text = userInput.value.trim();
    if (!text || sendBtn.disabled) return;

    document.body.classList.add('chat-active');
    sendBtn.disabled = true;

    // 添加用户气泡
    appendBubble(text, 'user');
    userInput.value = '';
    userInput.style.height = 'auto';

    // 准备 AI 气泡
    const aiBubble = appendBubble('...', 'ai');
    
    const headers = { 'Content-Type': 'application/json' };
    if (currentSession) headers['Authorization'] = `Bearer ${currentSession.access_token}`;

    try {
        const response = await fetch('/api/chat', {
            method: 'POST',
            headers: headers,
            body: JSON.stringify({ message: text, model: currentModel })
        });

        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let fullText = "";

        while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            
            const chunk = decoder.decode(value);
            const lines = chunk.split('\n');
            for (const line of lines) {
                if (line.startsWith('data: ')) {
                    const dataStr = line.slice(6).trim();
                    if (dataStr === '[DONE]') break;
                    try {
                        const parsed = JSON.parse(dataStr);
                        fullText += parsed.text;
                        aiBubble.innerHTML = window.marked ? marked.parse(fullText) : fullText;
                        chatBox.parentElement.scrollTop = chatBox.parentElement.scrollHeight;
                    } catch (e) {}
                }
            }
        }
    } catch (err) {
        aiBubble.textContent = "发送失败，请检查登录或网络。";
    } finally {
        sendBtn.disabled = false;
    }
}

function appendBubble(text, role) {
    const div = document.createElement('div');
    div.className = `bubble ${role}-message`;
    div.textContent = text;
    chatBox.appendChild(div);
    chatBox.parentElement.scrollTop = chatBox.parentElement.scrollHeight;
    return div;
}

sendBtn.onclick = handleSend;
userInput.oninput = () => { userInput.style.height = 'auto'; userInput.style.height = userInput.scrollHeight + 'px'; };
document.getElementById('new-chat-btn').onclick = () => location.reload();
document.getElementById('menu-btn').onclick = () => document.getElementById('sidebar').classList.add('active');
