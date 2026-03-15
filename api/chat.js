const OpenAI = require('openai');

module.exports = async function handler(req, res) {
    if (req.method !== 'POST') return res.status(405).json({ reply: '只允许 POST' });

    // ==========================================
    // 🛡️ 第一道防线：检查是否携带了登录通行证
    // ==========================================
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        // 如果没有通行证，伪装成大模型流式输出一条警告，然后立刻切断
        res.writeHead(200, { 'Content-Type': 'text/event-stream; charset=utf-8', 'Cache-Control': 'no-cache', 'Connection': 'keep-alive' });
        res.write(`data: ${JSON.stringify({ text: "🛑 **系统拦截：** 发现未授权访问！\n\n为了保护 API 额度，请先在左侧边栏使用 **GitHub 登录** 后再进行对话。" })}\n\n`);
        res.write('data: [DONE]\n\n');
        return res.end();
    }

    const token = authHeader.split(' ')[1];

    // ==========================================
    // 🛡️ 第二道防线：去 Supabase 验证通行证是真还是假
    // ==========================================
    try {
        const verifyRes = await fetch(`${process.env.SUPABASE_URL}/auth/v1/user`, {
            headers: { 
                'Authorization': `Bearer ${token}`, 
                'apikey': process.env.SUPABASE_ANON_KEY 
            }
        });
        if (!verifyRes.ok) throw new Error('Token 无效或已过期');
    } catch (error) {
        res.writeHead(200, { 'Content-Type': 'text/event-stream; charset=utf-8', 'Cache-Control': 'no-cache' });
        res.write(`data: ${JSON.stringify({ text: "⚠️ **身份验证失败：** 您的登录凭证已失效，请在左侧边栏退出后重新登录。" })}\n\n`);
        res.write('data: [DONE]\n\n');
        return res.end();
    }

    // ==========================================
    // 🚀 安检通过：正常调用大模型
    // ==========================================
    const { message, model } = req.body;
    if (!message) return res.status(400).json({ reply: '空消息' });

    try {
        const apiKey = process.env.SILICONFLOW_API_KEY;
        const openai = new OpenAI({ apiKey: apiKey, baseURL: 'https://api.siliconflow.cn/v1' });

        const stream = await openai.chat.completions.create({
            messages: [{ role: "user", content: message }],
            model: model,
            stream: true, 
        });

        res.writeHead(200, { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache', 'Connection': 'keep-alive' });

        for await (const chunk of stream) {
            const content = chunk.choices[0]?.delta?.content || "";
            if (content) res.write(`data: ${JSON.stringify({ text: content })}\n\n`);
        }
        
        res.write('data: [DONE]\n\n');
        res.end();

    } catch (error) {
        console.error('API Error:', error);
        res.write(`data: ${JSON.stringify({ error: '服务器开小差了，请稍后再试' })}\n\n`);
        res.end();
    }
}
