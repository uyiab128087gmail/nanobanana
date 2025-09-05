require('dotenv').config();
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

// 检查OpenRouter使用量和费用
async function checkOpenRouterUsage(apiKey, modelName) {
    try {
        console.log("检查OpenRouter使用量...");
        
        // 查询API密钥信息
        const response = await fetch("https://openrouter.ai/api/v1/auth/key", {
            method: "GET",
            headers: {
                "Authorization": `Bearer ${apiKey}`,
                "Content-Type": "application/json"
            }
        });

        if (!response.ok) {
            throw new Error(`API查询失败: ${response.status}`);
        }

        const data = await response.json();
        console.log("OpenRouter账户信息:", JSON.stringify(data, null, 2));

        const usage = data.data?.usage || 0;
        const limit = data.data?.limit || null;
        const credits = data.data?.credits || null;

        console.log(`API账户详情: usage=${usage}, limit=${limit}, credits=${credits}`);
        console.log(`使用的模型: ${modelName}`);

        // 检查是否使用免费模型
        const isFreeModel = modelName && modelName.includes(':free');
        
        // 新的逻辑：对免费模型更宽松，只关注免费额度
        
        // 情况1: 有明确的免费额度限制
        if (limit && limit > 0) {
            if (usage >= limit) {
                return {
                    canProceed: false,
                    reason: `免费额度已用尽。已使用: ${usage}/${limit}，不会使用付费点数。`,
                    usage: usage,
                    limit: limit
                };
            }

            const remaining = limit - usage;
            const usagePercent = (usage / limit) * 100;

            if (usagePercent > 90) {
                console.log(`⚠️ 警告: 免费额度即将用尽 (已使用${usagePercent.toFixed(1)}%)`);
            }

            return {
                canProceed: true,
                usage: usage,
                limit: limit,
                remaining: remaining,
                usagePercent: usagePercent.toFixed(1),
                accountType: credits > 0 ? "付费账户(仅使用免费额度)" : "免费账户"
            };
        }

        // 情况2: 没有limit信息，但usage为0 - 可能是新账户或免费额度未显示
        if (usage === 0) {
            console.log("未检测到明确的免费额度限制，但usage为0，允许尝试调用");
            return {
                canProceed: true,
                usage: usage,
                limit: limit || "未知",
                remaining: "未知",
                usagePercent: "0",
                accountType: credits > 0 ? "付费账户(仅使用免费额度)" : "免费账户",
                warning: "免费额度信息不明确，仅使用免费部分",
                credits: credits
            };
        }

        // 情况3: 有usage但没有limit - 对于免费模型，允许继续使用
        if (usage > 0 && !limit) {
            // 如果明确使用免费模型，允许继续
            if (isFreeModel) {
                console.log(`使用免费模型 ${modelName}，尽管无法确定额度限制，仍允许调用`);
                return {
                    canProceed: true,
                    usage: usage,
                    limit: "未知",
                    remaining: "未知",
                    usagePercent: "未知",
                    accountType: credits > 0 ? "付费账户(使用免费模型)" : "免费账户",
                    warning: `使用免费模型，当前使用量: ${usage}`
                };
            }
            
            // 对于非免费模型，严格控制
            return {
                canProceed: false,
                reason: `已有使用记录(${usage})但无法确定免费额度限制。为避免使用付费点数，停止调用。`,
                usage: usage,
                limit: limit,
                accountType: credits > 0 ? "付费账户" : "未知"
            };
        }

        // 其他未知情况 - 对免费模型更宽松
        if (isFreeModel) {
            console.log(`使用免费模型 ${modelName}，允许尝试调用`);
            return {
                canProceed: true,
                usage: usage,
                limit: limit || "未知",
                remaining: "未知",
                usagePercent: "未知",
                accountType: credits > 0 ? "付费账户(使用免费模型)" : "未知",
                warning: "使用免费模型"
            };
        }
        
        return {
            canProceed: false,
            reason: `账户状态不明确(usage=${usage}, limit=${limit})，为避免意外使用付费点数，停止调用。`,
            usage: usage,
            limit: limit,
            accountType: credits > 0 ? "付费账户" : "未知"
        };

    } catch (error) {
        console.error("检查使用量失败:", error);
        // 如果无法检查，为安全起见拒绝调用
        return {
            canProceed: false,
            reason: `无法验证账户状态: ${error.message}。为安全起见停止调用。`,
            error: error.message
        };
    }
}

// 调用 OpenRouter API
async function callOpenRouter(messages, apiKey) {
    if (!apiKey) {
        throw new Error("callOpenRouter received an empty apiKey.");
    }
    
    const openrouterPayload = {
        model: "google/gemini-2.5-flash-image-preview:free",
        messages,
        // 确保每次请求都是独立的，不保留对话历史
        temperature: 0.7,
        max_tokens: 4000,
        // 添加随机种子确保每次请求独立
        seed: Math.floor(Math.random() * 1000000)
    };
    
    console.log("Sending payload to OpenRouter:", JSON.stringify(openrouterPayload, null, 2));
    
    const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
        method: "POST",
        headers: {
            "Authorization": `Bearer ${apiKey}`,
            "Content-Type": "application/json",
            // 添加请求ID确保每次请求独立
            "X-Request-ID": `img-gen-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
            // 明确不希望保留对话历史
            "HTTP-Referer": "https://nanobanana.local",
            "User-Agent": "NanoBanana-ImageGen/1.0"
        },
        body: JSON.stringify(openrouterPayload)
    });
    
    if (!response.ok) {
        const errorBody = await response.text();
        throw new Error(`OpenRouter API error: ${response.status} - ${errorBody}`);
    }
    
    const responseData = await response.json();
    console.log("OpenRouter Full Response:", JSON.stringify(responseData, null, 2));
    
    const message = responseData.choices?.[0]?.message;
    
    // 检查多种可能的图像返回格式
    console.log("Message content type:", typeof message?.content);
    console.log("Message content:", message?.content);
    
    // 1. 检查是否有直接的图像URL
    if (message?.images?.[0]?.image_url?.url) {
        console.log("Found image in message.images");
        return { type: 'image', content: message.images[0].image_url.url };
    }
    
    // 2. 检查content是否是base64图像
    if (typeof message?.content === 'string' && message.content.startsWith('data:image/')) {
        console.log("Found base64 image in content");
        return { type: 'image', content: message.content };
    }
    
    // 3. 检查content是否包含图像URL
    if (typeof message?.content === 'string' && (
        message.content.includes('http') && (
            message.content.includes('.jpg') || 
            message.content.includes('.png') || 
            message.content.includes('.jpeg') || 
            message.content.includes('.webp')
        )
    )) {
        console.log("Found URL in text content");
        // 提取URL
        const urlMatch = message.content.match(/(https?:\/\/[^\s]+\.(jpg|jpeg|png|webp))/i);
        if (urlMatch) {
            return { type: 'image', content: urlMatch[1] };
        }
    }
    
    // 4. 检查是否是"图像生成"相关的文本（可能表示模型正在生成图片）
    if (typeof message?.content === 'string' && 
        (message.content.includes('图像生成') || 
         message.content.includes('生成图像') ||
         message.content.includes('Image generated') ||
         message.content.toLowerCase().includes('generating image'))) {
        console.log("Model indicated image generation but no image found in response");
        return { type: 'text', content: `模型表示正在生成图像，但响应中未找到实际图片。可能需要稍后重试或检查API配置。原始响应：${message.content}` };
    }
    
    // 5. 如果是其他文本内容
    if (typeof message?.content === 'string' && message.content.trim() !== '') {
        console.log("Returning text content");
        return { type: 'text', content: message.content };
    }
    
    console.log("No valid response found");
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
        const { prompt, images } = req.body;
        const openrouterApiKey = process.env.OPENROUTER_API_KEY;
        
        if (!openrouterApiKey) {
            return res.status(500).json({ error: "OpenRouter API key is not set." });
        }
        
        if (!prompt) {
            return res.status(400).json({ error: "Prompt is required." });
        }

        // 在调用API之前检查使用量和费用
        console.log("开始检查OpenRouter使用量...");
        const modelName = "google/gemini-2.5-flash-image-preview:free";
        const usageCheck = await checkOpenRouterUsage(openrouterApiKey, modelName);
        
        if (!usageCheck.canProceed) {
            console.log("使用量检查失败:", usageCheck.reason);
            return res.status(403).json({ 
                error: usageCheck.reason,
                usage: usageCheck.usage,
                limit: usageCheck.limit
            });
        }
        
        console.log(`✅ 使用量检查通过 - 已使用: ${usageCheck.usage}/${usageCheck.limit} (${usageCheck.usagePercent}%)`);
        
        // 如果使用量超过80%，给出警告
        if (parseFloat(usageCheck.usagePercent) > 80) {
            console.log(`⚠️ 警告: 免费额度使用率较高 (${usageCheck.usagePercent}%)`);
        }
        
        // 构建消息内容，images是可选的
        // 使用英文指令，更明确地要求生成图片
        const enhancedPrompt = images && images.length > 0 
            ? `Generate an image based on the uploaded image(s) and this description: ${prompt}. Please create and return an actual image, not just text description.` 
            : `Create and generate an actual image of: ${prompt}. Return the generated image, not just a text description. Use your image generation capabilities.`;
            
        const messageContent = [{ type: "text", text: enhancedPrompt }];
        if (images && images.length > 0) {
            messageContent.push(...images.map(img => ({ type: "image_url", image_url: { url: img } })));
        }
        
        const webUiMessages = [
            {
                role: "system",
                content: [{ type: "text", text: "This is a new, independent image generation request with no previous context or history. You are an AI image generator. When asked to create or generate an image, you must produce an actual image file, not just describe what the image would look like. Ignore any previous conversations or requests. Focus only on this current request." }]
            },
            {
                role: "user",
                content: messageContent
            }
        ];
        
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

// 接口 4: 查询使用量状态
app.get('/api/usage', async (req, res) => {
    try {
        const openrouterApiKey = process.env.OPENROUTER_API_KEY;
        
        if (!openrouterApiKey) {
            return res.status(500).json({ error: "OpenRouter API key is not set." });
        }

        const modelName = "google/gemini-2.5-flash-image-preview:free";
        const usageCheck = await checkOpenRouterUsage(openrouterApiKey, modelName);
        
        // 返回使用量信息（不管是否可以继续）
        return res.json({
            canProceed: usageCheck.canProceed,
            reason: usageCheck.reason || "正常",
            usage: usageCheck.usage,
            limit: usageCheck.limit,
            remaining: usageCheck.remaining || "未知",
            usagePercent: usageCheck.usagePercent || "0",
            accountType: usageCheck.accountType || "未知",
            warning: usageCheck.warning || null,
            credits: usageCheck.credits || null,
            timestamp: new Date().toISOString()
        });
        
    } catch (error) {
        console.error("查询使用量失败:", error);
        res.status(500).json({ error: error.message });
    }
});

// 启动服务器
app.listen(PORT, () => {
    console.log(`Nanobanana server is running on http://localhost:${PORT}`);
    console.log(`Static files served from: ${path.join(__dirname, 'static')}`);
});