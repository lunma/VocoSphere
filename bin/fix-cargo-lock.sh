#!/bin/bash

# 修复 Cargo 文件锁问题

echo "🔧 修复 Cargo 文件锁问题..."
echo ""

# 停止所有 cargo 进程（除了当前脚本）
echo "1️⃣ 停止运行中的 cargo 进程..."
pkill -f "cargo run" 2>/dev/null || echo "   没有找到 cargo run 进程"
pkill -f "cargo metadata" 2>/dev/null || echo "   没有找到 cargo metadata 进程"

sleep 1

# 删除锁文件
echo ""
echo "2️⃣ 清理可能的锁文件..."

# 清理项目的 target 目录中的锁
if [ -d "src-tauri/target" ]; then
    find src-tauri/target -name ".cargo-lock" -delete 2>/dev/null
    echo "   ✅ 已清理 target 目录中的锁文件"
fi

# 清理全局 Cargo 缓存中的锁（谨慎操作）
# 注意：这可能影响其他 Rust 项目
CARGO_HOME="${CARGO_HOME:-$HOME/.cargo}"
if [ -f "$CARGO_HOME/.package-cache" ]; then
    rm -f "$CARGO_HOME/.package-cache" 2>/dev/null
    echo "   ✅ 已清理全局包缓存锁"
fi

echo ""
echo "3️⃣ 清理构建缓存..."
cd src-tauri
cargo clean
cd ..

echo ""
echo "✅ 清理完成！"
echo ""
echo "现在请重新运行："
echo "  ./start.sh"
echo ""
echo "或者："
echo "  pnpm tauri dev"
echo ""

