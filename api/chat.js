// 只需要引入 OpenAI 官方包，因为硅基流动完美兼容它
const OpenAI = require('openai');

module.exports = async function handler(req, res) {
    // 1. 只允许 POST 请求
    if (req.method !== 'POST') {
        return res.status(405).json({ reply: '只允许 POST 请求哦~' });
    }

    // 2. 接收前端传过来的参数 (message 是问题，model 是你选的硅基流动模型ID)
    const { message, model } = req.body;

    if (!message) {
        return res.status(400).json({ reply: '你好像什么都没说呢。' });
    }

    try {
        // 3. 从 Vercel 环境变量中获取硅基流动的 API Key
        const apiKey = process.env.SILICONFLOW_API_KEY;
        if (!apiKey) {
            return res.status(500).json({ reply: '系统提示：站长还没有在 Vercel 后台配置 SILICONFLOW_API_KEY 哦！' });
        }

        // 4. 配置接口连接：填入硅基流动的专属地址和你的 Key
        const openai = new OpenAI({
            apiKey: apiKey,
            baseURL: 'https://api.siliconflow.cn/v1', // 🚀 关键：指向硅基流动的服务器
        });

        // 5. 发送请求给模型
        const completion = await openai.chat.completions.create({
            messages: [{ role: "user", content: message }],
            model: model, // 🚀 关键：这里直接使用前端传过来的模型 ID
        });

        // 6. 提取回复并返回给前端
        const replyText = completion.choices[0].message.content;
        res.status(200).json({ reply: replyText });

    } catch (error) {
        console.error('API 调用失败:', error);
        res.status(500).json({ 
            reply: `抱歉，接口开小差了。错误信息: ${error.message || '未知错误'}` 
        });
    }
}
