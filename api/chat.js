const OpenAI = require('openai');

module.exports = async function handler(req, res) {
    if (req.method !== 'POST') return res.status(405).json({ reply: '只允许 POST' });
    
    const { message, model } = req.body;
    if (!message) return res.status(400).json({ reply: '空消息' });

    try {
        const apiKey = process.env.SILICONFLOW_API_KEY;
        const openai = new OpenAI({ apiKey: apiKey, baseURL: 'https://api.siliconflow.cn/v1' });

        // 💥 核心升级：开启 stream: true
        const stream = await openai.chat.completions.create({
            messages: [{ role: "user", content: message }],
            model: model,
            stream: true, 
        });

        // 💥 告诉前端：我准备好像水管一样持续喷射数据了
        res.writeHead(200, {
            'Content-Type': 'text/event-stream',
            'Cache-Control': 'no-cache',
            'Connection': 'keep-alive'
        });

        // 将大模型吐出来的字，一个个推给前端
        for await (const chunk of stream) {
            const content = chunk.choices[0]?.delta?.content || "";
            if (content) {
                res.write(`data: ${JSON.stringify({ text: content })}\n\n`);
            }
        }
        
        // 结束标记
        res.write('data: [DONE]\n\n');
        res.end();

    } catch (error) {
        console.error('API Error:', error);
        res.write(`data: ${JSON.stringify({ error: '服务器开小差了，请稍后再试' })}\n\n`);
        res.end();
    }
}
