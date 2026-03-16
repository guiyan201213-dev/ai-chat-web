const OpenAI = require('openai');

module.exports = async function handler(req, res) {
    if (req.method !== 'POST') return res.status(405).json({ reply: '只允许 POST' });

    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        res.writeHead(200, { 'Content-Type': 'text/event-stream; charset=utf-8' });
        res.write(`data: ${JSON.stringify({ text: "🛑 请先在左侧边栏登录后再使用。" })}\n\n`);
        return res.end('data: [DONE]\n\n');
    }

    const token = authHeader.split(' ')[1];
    try {
        const verifyRes = await fetch(`${process.env.SUPABASE_URL}/auth/v1/user`, {
            headers: { 'Authorization': `Bearer ${token}`, 'apikey': process.env.SUPABASE_ANON_KEY }
        });
        if (!verifyRes.ok) throw new Error('Token 失效');
    } catch (error) {
        res.writeHead(200, { 'Content-Type': 'text/event-stream; charset=utf-8' });
        res.write(`data: ${JSON.stringify({ text: "⚠️ 登录凭证已失效，请重新登录。" })}\n\n`);
        return res.end('data: [DONE]\n\n');
    }

    const { message, model } = req.body;
    if (!message) return res.status(400).json({ reply: '空消息' });

    try {
        // 💥 智能路由：判断模型应该发给哪个平台
        let apiKey, baseURL;
        const iflowModels = ['qwen3-max', 'kimi-k2-0905', 'iflow-rome-30ba3b'];
        
        if (iflowModels.includes(model)) {
            apiKey = process.env.IFLOW_API_KEY; // 新厂密钥
            baseURL = 'https://apis.iflow.cn/v1'; // 新厂地址
        } else {
            apiKey = process.env.SILICONFLOW_API_KEY; // 原厂密钥
            baseURL = 'https://api.siliconflow.cn/v1'; // 原厂地址
        }

        const openai = new OpenAI({ apiKey: apiKey, baseURL: baseURL });
        const stream = await openai.chat.completions.create({
            messages: [{ role: "user", content: message }],
            model: model, stream: true, 
        });

        res.writeHead(200, { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache', 'Connection': 'keep-alive' });

        for await (const chunk of stream) {
            const content = chunk.choices[0]?.delta?.content || "";
            if (content) res.write(`data: ${JSON.stringify({ text: content })}\n\n`);
        }
        res.end('data: [DONE]\n\n');

    } catch (error) {
        res.write(`data: ${JSON.stringify({ error: '服务器开小差了，请稍后再试' })}\n\n`);
        res.end();
    }
}
