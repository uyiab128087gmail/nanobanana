# Nanobanana - 强大的AI图像分析工具

> 一个基于OpenRouter Gemini API的智能图像处理Web应用程序，提供强大的AI图像分析功能

## 功能特性

Nanobanana是一个功能强大的AI工具，具有以下特点：
- **API兼容性**：完全兼容Google Gemini API和OpenRouter
- **Web界面**：提供友好的用户界面进行AI图像分析

## 核心功能

### API接口支持
- **原生Gemini API兼容**：使用`@google/generative-ai` SDK无缝对接
- **流式与非流式**：支持`streamGenerateContent`和`generateContent`方法
- **多种认证方式**：支持标准认证格式和自定义认证头
- **安全认证**：支持`Authorization: Bearer`和`x-goog-api-key`双重认证
- **跨域支持**：内置CORS中间件解决跨域访问

### 智能Web UI界面
- **直观操作**：用户友好的图形界面
- **批量处理**：支持多图像同时分析
- **实时反馈**：提供处理进度和结果展示
- **多种输出格式**：支持文本、图像URL等多种输出
- **API密钥管理**：安全的API密钥存储和管理

### 技术架构特点
- **后端框架**：Node.js + Express
- **跨域处理**：CORS中间件
- **文件上传**：Multer中间件
- **前端技术**：原生JavaScript + HTML5 + CSS3
- **AI引擎**：基于OpenRouter的`google/gemini-2.5-flash-image-preview:free`

## 核心API接口

### 1. 流式生成
```
POST /v1beta/models/gemini-pro:streamGenerateContent
```
**功能**：流式AI文本生成
**认证**：Bearer Token或x-goog-api-key
**响应**：Server-Sent Events (SSE)流
**实现**：完全兼容Gemini SDK

### 2. 标准生成
```
POST /v1beta/models/gemini-pro:generateContent
```
**功能**：标准AI文本生成
**认证**：Bearer Token或x-goog-api-key
**响应**：JSON格式
**实现**：完全兼容Gemini SDK

### 3. Web UI专用接口
```
POST /generate
```
**功能**：为Web界面特别优化的生成接口
**请求格式**：
```json
{
  "prompt": "string - 提示文本",
  "images": ["string[] - base64编码图片"],
  "apikey": "string - OpenRouter API密钥"
}
```
**响应格式**：
```json
{
  "imageUrl": "string - 生成图片URL"
}
```

## 快速部署

### 本地开发

1. **克隆项目**
```bash
git clone [your-repo-url]
cd nanobanana
```

2. **安装依赖**
```bash
npm install
```

3. **配置环境变量**
```bash
# 创建.env文件
echo "OPENROUTER_API_KEY=你的OpenRouter密钥" > .env
```

4. **启动开发服务器**
```bash
npm run dev  # 开发模式(nodemon自动重启)
# 或
npm start    # 生产模式
```

### 生产环境部署

#### 使用PM2部署
```bash
# 安装PM2
npm install -g pm2

# 使用ecosystem配置启动
npm run pm2

# 或手动启动
pm2 start app.js --name "nanobanana"
```

#### 使用系统服务部署
1. 确保项目已上传到服务器
2. 安装Node.js和依赖包
3. 配置启动脚本：`app.js`
4. 配置监听端口3000
5. 设置环境变量：`OPENROUTER_API_KEY`

## 使用说明

### Web界面使用
1. 访问服务器主页
2. 输入您的OpenRouter API密钥
3. 上传需要分析的图片
4. 输入分析提示文本
5. 点击"分析"按钮
6. 查看分析结果

### API直接调用

#### 使用cURL调用
```bash
curl -X POST "http://your-domain:3000/v1beta/models/gemini-pro:generateContent" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_OPENROUTER_API_KEY" \
  -d '{
    "contents": [
      {
        "role": "user",
        "parts": [
          {"text": "分析这张图片"},
          {
            "inlineData": {
              "mimeType": "image/jpeg",
              "data": "BASE64_ENCODED_IMAGE_DATA"
            }
          }
        ]
      }
    ]
  }'
```

#### 使用Gemini SDK
```javascript
import { GoogleGenerativeAI } from "@google/generative-ai";

// 配置客户端
const genAI = new GoogleGenerativeAI("YOUR_OPENROUTER_API_KEY");
const model = genAI.getGenerativeModel({ 
  model: "gemini-pro",
  baseUrl: "http://your-domain:3000"
});

const result = await model.generateContent([
  "分析这张图片",
  { inlineData: { data: base64Image, mimeType: "image/jpeg" } }
]);
```

## 配置说明

### 环境变量
- `PORT`：服务监听端口，默认3000
- `OPENROUTER_API_KEY`：OpenRouter API密钥，必须配置

### CORS配置
项目已配置完整的CORS支持：
- 允许所有来源访问
- 支持GET、POST、OPTIONS方法
- 允许Content-Type、Authorization、x-goog-api-key请求头

## 安全特性

- **API密钥保护**：密钥仅在服务端处理，不暴露给客户端
- **请求验证**：完整的输入参数验证
- **错误处理**：友好的错误信息返回
- **文件大小限制**：JSON请求体限制50MB

## 项目结构

```
nanobanana/
├── app.js              # 主服务器文件
├── package.json        # 项目配置
├── ecosystem.config.js # PM2配置
├── static/            # 静态文件目录
│   ├── index.html     # 主页面
│   ├── style.css      # 样式文件
│   └── script.js      # 前端脚本
├── deploy-docs/       # 部署文档
└── README.md         # 项目说明
```

## 高级用法

### 开发者用法
- 使用原生Gemini SDK连接到OpenRouter
- 利用完整的流式API构建实时AI应用
- 集成到现有的AI工作流程

### 企业级用法
- 搭建私有AI图像分析服务
- 批量处理企业图片资产
- 构建AI驱动的内容管理系统

## 版本历史

- **v1.0.0**：初始版本
  - 完整的Gemini API兼容
  - 友好的Web UI界面
  - 流式和标准响应
  - CORS跨域支持配置

## 贡献指南

欢迎提交Issue和Pull Request来改进项目

## 开源协议

MIT License - 详见LICENSE文件

## 技术支持

如有问题，请通过GitHub Issues联系我们

---

*Nanobanana - 让AI图像分析更简单*