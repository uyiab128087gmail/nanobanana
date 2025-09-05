#!/bin/bash

echo "=== OpenRouter使用量控制测试 ==="
echo ""

# 测试1: 查看使用量脚本
echo "1. 测试使用量查询脚本:"
cd /www/wwwroot/nanobanana
./check_usage.sh
echo ""

# 测试2: 通过API查看使用量
echo "2. 测试API使用量查询:"
curl -s http://localhost:3008/api/usage | jq . || echo "请先启动服务器"
echo ""

# 测试3: 模拟图片生成请求（如果服务运行）
echo "3. 测试生成请求（需要服务器运行）:"
echo "可以通过Web界面测试，或使用以下curl命令:"
echo "curl -X POST http://localhost:3008/generate \\"
echo "  -H \"Content-Type: application/json\" \\"
echo "  -d \"{\\\"prompt\\\":\\\"test image\\\"}\""
echo ""

echo "=== 测试完成 ==="
