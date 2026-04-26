@echo off
chcp 65001 >nul
title RPG生成器 - 一键启动

echo ==============================================
echo   叙游工坊 RPG 生成器
echo ==============================================
echo.

where node >nul 2>nul
if %errorlevel% neq 0 (
    echo [错误] 未找到 Node.js，请先安装
    pause
    exit /b 1
)

echo [1/3] 安装后端依赖...
cd /d "%~dp0backend"
if not exist "node_modules" (call npm install) else (echo 已存在)

echo.
echo [2/3] 启动后端 (端口 3000)...
start "RPG-Backend" cmd /c "cd /d "%~dp0backend" && node server.js"
timeout /t 3 /nobreak >nul

echo.
echo [3/3] 启动前端...
cd /d "%~dp0frontend"
if not exist "node_modules" (call npm install)
start "RPG-Frontend" cmd /c "cd /d "%~dp0frontend" && npm run dev"

echo.
echo ==============================================
echo   后端: http://localhost:3000
echo   前端: http://localhost:5173
echo ==============================================

start http://localhost:5173
pause