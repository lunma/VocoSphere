@echo off
REM Tauri 应用启动脚本 (Windows)

echo 🚀 正在启动 Tauri 应用...
echo.
echo ⚠️  重要提示:
echo    - 如果你之前运行了 'pnpm dev' 或 'npm run dev'，请先按 Ctrl+C 停止
echo    - 必须使用 Tauri 命令才能使用 invoke 等 API
echo.
echo 正在检查依赖...

REM 检查 pnpm 是否安装
where pnpm >nul 2>nul
if %errorlevel% neq 0 (
    echo ❌ 错误: pnpm 未安装
    echo 请运行: npm install -g pnpm
    pause
    exit /b 1
)

REM 检查 Rust 是否安装
where cargo >nul 2>nul
if %errorlevel% neq 0 (
    echo ❌ 错误: Rust/Cargo 未安装
    echo 请访问: https://www.rust-lang.org/tools/install
    pause
    exit /b 1
)

echo ✅ 依赖检查通过
echo.
echo 正在启动 Tauri 开发服务器...
echo 如果是首次运行，可能需要几分钟来编译 Rust 代码
echo.

REM 启动 Tauri 开发服务器
pnpm tauri dev

