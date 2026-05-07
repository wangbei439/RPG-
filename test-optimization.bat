@echo off
REM RPG生成器快速测试脚本 (Windows)

echo ==========================================
echo RPG生成器 - 功能测试
echo ==========================================
echo.

set BASE_URL=http://localhost:3000

echo 1. 检查服务器状态...
curl -s "%BASE_URL%/api/health" >nul 2>&1
if %errorlevel% equ 0 (
    echo ✅ 服务器正在运行
    curl -s "%BASE_URL%/api/health"
) else (
    echo ❌ 服务器未运行，请先启动: cd backend ^&^& npm start
    exit /b 1
)

echo.
echo 2. 测试缓存统计...
curl -s "%BASE_URL%/api/debug/cache"
if %errorlevel% equ 0 (
    echo ✅ 缓存统计 API 正常
) else (
    echo ❌ 缓存统计 API 失败
)

echo.
echo 3. 测试示例游戏列表...
curl -s "%BASE_URL%/api/examples"
if %errorlevel% equ 0 (
    echo ✅ 示例游戏列表 API 正常
) else (
    echo ❌ 示例游戏列表 API 失败
)

echo.
echo 4. 测试示例游戏详情...
curl -s "%BASE_URL%/api/examples/example_magic_academy" >nul 2>&1
if %errorlevel% equ 0 (
    echo ✅ 示例游戏详情 API 正常
) else (
    echo ❌ 示例游戏详情 API 失败
)

echo.
echo ==========================================
echo 测试完成！
echo ==========================================
echo.
echo 📝 查看完整优化报告: OPTIMIZATION_REPORT.md
echo 🚀 启动前端: cd frontend ^&^& npm run dev
echo 🎮 访问应用: http://localhost:5173
echo.

pause
