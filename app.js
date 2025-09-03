const express = require('express');
const cors = require('cors');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3008;

// 跨域配置
app.use(cors({
    origin: '*',
    methods: ['GET', 'POST', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'x-goog-api-key']
}));
app.use(express.json({ limit: '50mb' }));
app.use(express.static(path.join(__dirname, 'static')));

// 创建错误响应 JSON 格式
function createJsonErrorResponse(res, message, statusCode = 500) {
    return res.status(statusCode).json({ error: message });
}

// 调用 OpenRouter API
async function callOpenRouter(messages, apiKey) {
    if (!apiKey) {
        throw new Error("callOpenRouter received an empty apiKey.");
    }
    
    const openrouterPayload = {
        model: "google/gemini-2.5-flash-image-preview:free",
        messages
    };
    
    console.log("Sending SMARTLY EXTRACTED payload to OpenRouter:", JSON.stringify(openrouterPayload, null, 2));
    
    const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
        method: "POST",
        headers: {
            "Authorization": `Bearer ${apiKey}`,
            "Content-Type": "application/json"
        },
        body: JSON.stringify(openrouterPayload)
    });
    
    if (!response.ok) {
        const errorBody = await response.text();
        throw new Error(`OpenRouter API error: Unauthorized - ${errorBody}`);
    }
    
    const responseData = await response.json();
    console.log("OpenRouter Response:", JSON.stringify(responseData, null, 2));
    
    const message = responseData.choices?.[0]?.message;
    
    if (message?.images?.[0]?.image_url?.url) {
        return { type: 'image', content: message.images[0].image_url.url };
    }
    
    if (typeof message?.content === 'string' && message.content.startsWith('data:image/')) {
        return { type: 'image', content: message.content };
    }
    
    if (typeof message?.content === 'string' && message.content.trim() !== '') {
        return { type: 'text', content: message.content };
    }
    
    return { type: 'text', content: "[无法获取有效响应]" };
}

// 接口 1: Cherry Studio (Gemini, 流式)
app.post('*streamGenerateContent', async (req, res) => {
    try {
        const geminiRequest = req.body;
        let apiKey = req.headers.authorization?.replace("Bearer ", "") || req.headers['x-goog-api-key'] || "";
        
        if (!apiKey) {
            return createJsonErrorResponse(res, "API key is missing.", 401);
        }
        
        if (!geminiRequest.contents?.length) {
            return createJsonErrorResponse(res, "Invalid request: 'contents' array is missing.", 400);
        }
        
        // 智能历史处理
        const fullHistory = geminiRequest.contents;
        const lastUserMessageIndex = fullHistory.findLastIndex((msg) => msg.role === 'user');
        let relevantHistory = (lastUserMessageIndex !== -1) ? 
            fullHistory.slice(fullHistory.findLastIndex((msg, idx) => msg.role === 'model' && idx < lastUserMessageIndex), lastUserMessageIndex + 1) : 
            [];
        
        if (relevantHistory.length === 0 && lastUserMessageIndex !== -1) {
            relevantHistory = [fullHistory[lastUserMessageIndex]];
        }
        
        if (relevantHistory.length === 0) {
            return createJsonErrorResponse(res, "No user message found.", 400);
        }
        
        const openrouterMessages = relevantHistory.map((geminiMsg) => {
            const parts = geminiMsg.parts.map((p) => 
                p.text ? 
                    { type: "text", text: p.text } : 
                    { type: "image_url", image_url: { url: `data:${p.inlineData.mimeType};base64,${p.inlineData.data}` } }
            );
            return { 
                role: geminiMsg.role === 'model' ? 'assistant' : 'user', 
                content: parts 
            };
        });
        
        // 设置流式响应头
        res.setHeader('Content-Type', 'text/event-stream');
        res.setHeader('Cache-Control', 'no-cache');
        res.setHeader('Connection', 'keep-alive');
        
        try {
            const openRouterResult = await callOpenRouter(openrouterMessages, apiKey);
            
            const sendChunk = (data) => {
                res.write(`data: ${JSON.stringify(data)}\n\n`);
            };
            
            let textToStream = (openRouterResult.type === 'image') ? "生成图像" : openRouterResult.content;
            
            for (const char of textToStream) {
                sendChunk({ 
                    candidates: [{ 
                        content: { 
                            role: "model", 
                            parts: [{ text: char }] 
                        } 
                    }] 
                });
                await new Promise(resolve => setTimeout(resolve, 2));
            }
            
            if (openRouterResult.type === 'image') {
                const matches = openRouterResult.content.match(/^data:(.+);base64,(.*)$/);
                if (matches) {
                    sendChunk({ 
                        candidates: [{ 
                            content: { 
                                role: "model", 
                                parts: [{ 
                                    inlineData: { 
                                        mimeType: matches[1], 
                                        data: matches[2] 
                                    } 
                                }] 
                            } 
                        }] 
                    });
                }
            }
            
            sendChunk({ 
                candidates: [{ 
                    finishReason: "STOP", 
                    content: { role: "model", parts: [] } 
                }], 
                usageMetadata: { 
                    promptTokenCount: 264, 
                    totalTokenCount: 1578 
                } 
            });
            
            res.write("data: [DONE]\n\n");
            res.end();
        } catch (e) {
            console.error("Error inside stream:", e);
            const errorChunk = { error: { message: e.message, code: 500 } };
            res.write(`data: ${JSON.stringify(errorChunk)}\n\n`);
            res.end();
        }
    } catch (error) {
        createJsonErrorResponse(res, error.message, 500);
    }
});

// 接口 2: Cherry Studio (Gemini, 标准)
app.post('*generateContent', async (req, res) => {
    try {
        const geminiRequest = req.body;
        let apiKey = req.headers.authorization?.replace("Bearer ", "") || req.headers['x-goog-api-key'] || "";
        
        if (!apiKey) {
            return createJsonErrorResponse(res, "API key is missing.", 401);
        }
        
        if (!geminiRequest.contents?.length) {
            return createJsonErrorResponse(res, "Invalid request: 'contents' array is missing.", 400);
        }
        
        const fullHistory = geminiRequest.contents;
        const lastUserMessageIndex = fullHistory.findLastIndex((msg) => msg.role === 'user');
        let relevantHistory = (lastUserMessageIndex !== -1) ? 
            fullHistory.slice(fullHistory.findLastIndex((msg, idx) => msg.role === 'model' && idx < lastUserMessageIndex), lastUserMessageIndex + 1) : 
            [];
        
        if (relevantHistory.length === 0 && lastUserMessageIndex !== -1) {
            relevantHistory = [fullHistory[lastUserMessageIndex]];
        }
        
        if (relevantHistory.length === 0) {
            return createJsonErrorResponse(res, "No user message found.", 400);
        }
        
        const openrouterMessages = relevantHistory.map((geminiMsg) => {
            const parts = geminiMsg.parts.map((p) => 
                p.text ? 
                    { type: "text", text: p.text } : 
                    { type: "image_url", image_url: { url: `data:${p.inlineData.mimeType};base64,${p.inlineData.data}` } }
            );
            return { 
                role: geminiMsg.role === 'model' ? 'assistant' : 'user', 
                content: parts 
            };
        });
        
        const openRouterResult = await callOpenRouter(openrouterMessages, apiKey);
        
        const finalParts = [];
        if (openRouterResult.type === 'image') {
            const matches = openRouterResult.content.match(/^data:(.+);base64,(.*)$/);
            if (matches) {
                finalParts.push({ text: "生成图像" });
                finalParts.push({ inlineData: { mimeType: matches[1], data: matches[2] } });
            } else {
                finalParts.push({ text: "[图像解析失败]" });
            }
        } else {
            finalParts.push({ text: openRouterResult.content });
        }
        
        const responsePayload = { 
            candidates: [{ 
                content: { role: "model", parts: finalParts }, 
                finishReason: "STOP", 
                index: 0 
            }], 
            usageMetadata: { 
                promptTokenCount: 264, 
                totalTokenCount: 1578 
            } 
        };
        
        res.json(responsePayload);
    } catch (error) {
        createJsonErrorResponse(res, error.message, 500);
    }
});

// 接口 3: 专用 Web UI (nano banana)
app.post('/generate', async (req, res) => {
    try {
        const { prompt, images, apikey } = req.body;
        const openrouterApiKey = apikey || process.env.OPENROUTER_API_KEY;
        
        if (!openrouterApiKey) {
            return res.status(500).json({ error: "OpenRouter API key is not set." });
        }
        
        if (!prompt || !images || !images.length) {
            return res.status(400).json({ error: "Prompt and images are required." });
        }
        
        const webUiMessages = [{
            role: "user",
            content: [
                { type: "text", text: prompt },
                ...images.map(img => ({ type: "image_url", image_url: { url: img } }))
            ]
        }];
        
        const result = await callOpenRouter(webUiMessages, openrouterApiKey);
        
        if (result && result.type === 'image') {
            return res.json({ imageUrl: result.content });
        } else {
            const errorMessage = result ? `Model returned text instead of an image: ${result.content}` : "Model returned an empty response.";
            console.error("Error handling /generate request:", errorMessage);
            return res.status(500).json({ error: errorMessage });
        }
    } catch (error) {
        console.error("Error handling /generate request:", error);
        res.status(500).json({ error: error.message });
    }
});

// 启动服务器
app.listen(PORT, () => {
    console.log(`Nanobanana server is running on http://localhost:${PORT}`);
    console.log(`Static files served from: ${path.join(__dirname, 'static')}`);
});