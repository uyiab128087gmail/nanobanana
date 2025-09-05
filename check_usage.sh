#!/bin/bash

# OpenRouter使用量查询脚本

# 从.env文件读取API密钥
if [ -f ".env" ]; then
    export $(grep -v "^#" .env | xargs)
fi

if [ -z "$OPENROUTER_API_KEY" ]; then
    echo "错误: 未找到OPENROUTER_API_KEY环境变量"
    echo "请确保.env文件中包含API密钥"
    exit 1
fi

echo "正在查询OpenRouter使用量..."
echo "=================================="

# 查询账户余额和使用情况
response=$(curl -s -H "Authorization: Bearer $OPENROUTER_API_KEY" \
    "https://openrouter.ai/api/v1/auth/key")

echo "API Key信息:"
echo "$response" | jq -r ".data.label // \"未知\""

# 显示完整的API响应用于调试
echo ""
echo "原始响应数据:"
echo "$response" | jq .

# 从响应中提取使用信息
usage=$(echo "$response" | jq -r ".data.usage // 0")
limit=$(echo "$response" | jq -r ".data.limit // null")
rate_limit=$(echo "$response" | jq -r ".data.rate_limit // null")

echo ""
echo "=================================="
echo "使用情况摘要:"
echo "已使用: $usage"
echo "限制: $limit"
echo "速率限制: $rate_limit"

# 检查是否有付费余额
paid_credits=$(echo "$response" | jq -r ".data.credits // 0")
if [ "$paid_credits" != "0" ] && [ "$paid_credits" != "null" ]; then
    echo "账户类型: 付费账户(余额: $paid_credits) - 仅使用免费额度"
else
    echo "账户类型: 免费账户"
fi

# 判断使用状态
if [ "$limit" = "null" ] || [ "$limit" = "0" ]; then
    if [ "$usage" = "0" ] || [ "$usage" = "null" ]; then
        echo "状态: ✅ 可以使用(免费额度未明确，但无使用记录)"
        exit 0
    else
        echo "状态: ⚠️ 有使用记录($usage)但免费限制不明确，请谨慎使用"
        exit 2
    fi
else
    # 计算剩余额度
    remaining=$(echo "$limit - $usage" | bc -l 2>/dev/null || echo "0")
    echo "剩余免费额度: $remaining"
    
    # 检查是否超额
    if [ "$(echo "$usage >= $limit" | bc -l 2>/dev/null)" = "1" ]; then
        echo "❌ 免费额度已用尽! 不会使用付费点数"
        exit 1
    else
        if [ "$limit" != "0" ]; then
            usage_percent=$(echo "scale=1; $usage * 100 / $limit" | bc -l 2>/dev/null || echo "0")
            echo "✅ 仍有免费额度可用 (已使用${usage_percent}%)"
        else
            echo "✅ 可以使用"
        fi
        exit 0
    fi
fi