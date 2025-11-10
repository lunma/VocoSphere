#!/bin/bash

# Tauri 应用诊断脚本
# 帮助排查常见问题

echo "🔍 Tauri 应用诊断工具"
echo "===================="
echo ""

# 检查 Node.js
echo "📦 检查 Node.js..."
if command -v node &> /dev/null; then
    NODE_VERSION=$(node --version)
    echo "✅ Node.js 已安装: $NODE_VERSION"
else
    echo "❌ Node.js 未安装"
fi
echo ""

# 检查 pnpm
echo "📦 检查 pnpm..."
if command -v pnpm &> /dev/null; then
    PNPM_VERSION=$(pnpm --version)
    echo "✅ pnpm 已安装: v$PNPM_VERSION"
else
    echo "❌ pnpm 未安装"
    echo "   安装命令: npm install -g pnpm"
fi
echo ""

# 检查 Rust
echo "🦀 检查 Rust..."
if command -v rustc &> /dev/null; then
    RUST_VERSION=$(rustc --version)
    echo "✅ Rust 已安装: $RUST_VERSION"
else
    echo "❌ Rust 未安装"
    echo "   安装地址: https://www.rust-lang.org/tools/install"
fi
echo ""

if command -v cargo &> /dev/null; then
    CARGO_VERSION=$(cargo --version)
    echo "✅ Cargo 已安装: $CARGO_VERSION"
else
    echo "❌ Cargo 未安装"
fi
echo ""

# 检查 Tauri CLI
echo "🚀 检查 Tauri CLI..."
if pnpm tauri --version &> /dev/null; then
    TAURI_VERSION=$(pnpm tauri --version 2>&1 | head -n 1)
    echo "✅ Tauri CLI 可用: $TAURI_VERSION"
else
    echo "❌ Tauri CLI 不可用"
    echo "   运行: pnpm install"
fi
echo ""

# 检查依赖
echo "📚 检查项目依赖..."
if [ -d "node_modules" ]; then
    echo "✅ node_modules 存在"
else
    echo "❌ node_modules 不存在"
    echo "   运行: pnpm install"
fi
echo ""

# 检查 Tauri 配置
echo "⚙️  检查 Tauri 配置..."
if [ -f "src-tauri/tauri.conf.json" ]; then
    echo "✅ tauri.conf.json 存在"
else
    echo "❌ tauri.conf.json 不存在"
fi
echo ""

# 检查 Rust 项目
if [ -f "src-tauri/Cargo.toml" ]; then
    echo "✅ Cargo.toml 存在"
else
    echo "❌ Cargo.toml 不存在"
fi
echo ""

# 给出建议
echo "===================="
echo "📋 诊断总结"
echo "===================="
echo ""
echo "如果所有检查都通过，请使用以下命令启动应用："
echo ""
echo "  ./bin/start.sh"
echo ""
echo "或者："
echo ""
echo "  pnpm tauri dev"
echo ""
echo "⚠️  重要提示："
echo "  - 不要使用 'pnpm dev'，必须使用 'pnpm tauri dev'"
echo "  - 如果正在运行其他服务器，请先停止（Ctrl+C）"
echo "  - 首次运行需要编译 Rust 代码，可能需要几分钟"
echo ""

