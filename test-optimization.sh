#!/bin/bash
# RPG生成器快速测试脚本

echo "=========================================="
echo "RPG生成器 - 功能测试"
echo "=========================================="
echo ""

BASE_URL="http://localhost:3000"

# 检查服务器是否运行
echo "1. 检查服务器状态..."
if curl -s "${BASE_URL}/api/health" > /dev/null 2>&1; then
    echo "✅ 服务器正在运行"
    curl -s "${BASE_URL}/api/health" | python -m json.tool 2>/dev/null || echo "健康检查响应已接收"
else
    echo "❌ 服务器未运行，请先启动: cd backend && npm start"
    exit 1
fi

echo ""
echo "2. 测试缓存统计..."
CACHE_STATS=$(curl -s "${BASE_URL}/api/debug/cache")
if [ $? -eq 0 ]; then
    echo "✅ 缓存统计 API 正常"
    echo "$CACHE_STATS" | python -m json.tool 2>/dev/null || echo "$CACHE_STATS"
else
    echo "❌ 缓存统计 API 失败"
fi

echo ""
echo "3. 测试示例游戏列表..."
EXAMPLES=$(curl -s "${BASE_URL}/api/examples")
if [ $? -eq 0 ]; then
    echo "✅ 示例游戏列表 API 正常"
    echo "$EXAMPLES" | python -m json.tool 2>/dev/null || echo "$EXAMPLES"
else
    echo "❌ 示例游戏列表 API 失败"
fi

echo ""
echo "4. 测试示例游戏详情..."
EXAMPLE_DETAIL=$(curl -s "${BASE_URL}/api/examples/example_magic_academy")
if [ $? -eq 0 ]; then
    echo "✅ 示例游戏详情 API 正常"
    echo "魔法学院示例已加载"
else
    echo "❌ 示例游戏详情 API 失败"
fi

echo ""
echo "=========================================="
echo "测试完成！"
echo "=========================================="
echo ""
echo "📝 查看完整优化报告: OPTIMIZATION_REPORT.md"
echo "🚀 启动前端: cd frontend && npm run dev"
echo "🎮 访问应用: http://localhost:5173"
echo ""
