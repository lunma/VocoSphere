#!/bin/bash

# Tauri 应用诊断脚本
# 帮助排查常见问题，检查开发环境配置

echo "🔍 Tauri 应用诊断工具"
echo "===================="
echo ""

# 期望的版本（从 .mise.toml 读取或硬编码）
EXPECTED_NODE="22.21.1"
EXPECTED_PNPM="10.23.0"
EXPECTED_RUST="1.91.1"

# 检查 mise
echo "🔧 检查 mise（工具链管理）..."
if command -v mise &> /dev/null; then
    MISE_VERSION=$(mise --version 2>/dev/null | head -n 1 || echo "已安装")
    echo "✅ mise 已安装: $MISE_VERSION"
    
    # 检查 .mise.toml
    if [ -f ".mise.toml" ]; then
        echo "✅ .mise.toml 配置文件存在"
        echo "💡 提示: 运行 'mise install' 自动安装所需工具版本"
    else
        echo "⚠️  .mise.toml 配置文件不存在"
    fi
else
    echo "⚠️  mise 未安装（推荐使用）"
    echo "   安装命令: curl https://mise.run | sh"
    echo "   或: brew install mise"
    echo "   📖 文档: https://mise.jdx.dev/"
fi
echo ""

# 检查 Node.js
echo "📦 检查 Node.js..."
if command -v node &> /dev/null; then
    NODE_VERSION=$(node --version | sed 's/v//')
    EXPECTED_MAJOR=$(echo "$EXPECTED_NODE" | cut -d. -f1)
    NODE_MAJOR=$(echo "$NODE_VERSION" | cut -d. -f1)
    
    if [ "$NODE_MAJOR" -eq "$EXPECTED_MAJOR" ]; then
        echo "✅ Node.js 已安装: v$NODE_VERSION（期望: v$EXPECTED_NODE）"
    else
        echo "⚠️  Node.js 版本不匹配: v$NODE_VERSION（期望: v$EXPECTED_NODE）"
        echo "   建议: 使用 mise 管理版本，运行 'mise install'"
    fi
else
    echo "❌ Node.js 未安装（期望: v$EXPECTED_NODE）"
    if command -v mise &> /dev/null && [ -f ".mise.toml" ]; then
        echo "   💡 运行 'mise install' 自动安装所需版本"
    else
        echo "   安装地址: https://nodejs.org/"
    fi
fi
echo ""

# 检查 pnpm
echo "📦 检查 pnpm..."
if command -v pnpm &> /dev/null; then
    PNPM_VERSION=$(pnpm --version)
    EXPECTED_MAJOR=$(echo "$EXPECTED_PNPM" | cut -d. -f1)
    PNPM_MAJOR=$(echo "$PNPM_VERSION" | cut -d. -f1)
    
    if [ "$PNPM_MAJOR" -eq "$EXPECTED_MAJOR" ]; then
        echo "✅ pnpm 已安装: v$PNPM_VERSION（期望: v$EXPECTED_PNPM）"
    else
        echo "⚠️  pnpm 版本不匹配: v$PNPM_VERSION（期望: v$EXPECTED_PNPM）"
        echo "   建议: 使用 mise 管理版本，运行 'mise install'"
    fi
else
    echo "❌ pnpm 未安装（期望: v$EXPECTED_PNPM）"
    if command -v mise &> /dev/null && [ -f ".mise.toml" ]; then
        echo "   💡 运行 'mise install' 自动安装所需版本"
    else
        echo "   安装命令: npm install -g pnpm@$EXPECTED_PNPM"
    fi
fi
echo ""

# 检查 Rust
echo "🦀 检查 Rust..."
if command -v rustc &> /dev/null; then
    RUST_VERSION=$(rustc --version | awk '{print $2}')
    EXPECTED_MAJOR=$(echo "$EXPECTED_RUST" | cut -d. -f1)
    RUST_MAJOR=$(echo "$RUST_VERSION" | cut -d. -f1)
    
    if [ "$RUST_MAJOR" -eq "$EXPECTED_MAJOR" ]; then
        echo "✅ Rust 已安装: $RUST_VERSION（期望: $EXPECTED_RUST）"
    else
        echo "⚠️  Rust 版本不匹配: $RUST_VERSION（期望: $EXPECTED_RUST）"
        echo "   建议: 使用 mise 管理版本，运行 'mise install'"
    fi
else
    echo "❌ Rust 未安装（期望: $EXPECTED_RUST）"
    if command -v mise &> /dev/null && [ -f ".mise.toml" ]; then
        echo "   💡 运行 'mise install' 自动安装所需版本"
    else
        echo "   安装地址: https://www.rust-lang.org/tools/install"
    fi
fi
echo ""

if command -v cargo &> /dev/null; then
    CARGO_VERSION=$(cargo --version | awk '{print $2}')
    echo "✅ Cargo 已安装: $CARGO_VERSION"
else
    echo "❌ Cargo 未安装"
fi
echo ""

# 检查 Tauri CLI
echo "🚀 检查 Tauri CLI..."
if command -v pnpm &> /dev/null && [ -d "node_modules" ]; then
    if pnpm tauri --version &> /dev/null 2>&1; then
        TAURI_VERSION=$(pnpm tauri --version 2>&1 | head -n 1)
        echo "✅ Tauri CLI 可用: $TAURI_VERSION"
    else
        echo "❌ Tauri CLI 不可用"
        echo "   运行: pnpm install"
    fi
else
    echo "⚠️  无法检查 Tauri CLI（需要先安装依赖）"
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

# 检查项目配置文件
echo "⚙️  检查项目配置..."
CONFIG_OK=true

if [ -f "src-tauri/tauri.conf.json" ]; then
    echo "✅ tauri.conf.json 存在"
else
    echo "❌ tauri.conf.json 不存在"
    CONFIG_OK=false
fi

if [ -f "src-tauri/Cargo.toml" ]; then
    echo "✅ Cargo.toml 存在"
else
    echo "❌ Cargo.toml 不存在"
    CONFIG_OK=false
fi

if [ -f "package.json" ]; then
    echo "✅ package.json 存在"
else
    echo "❌ package.json 不存在"
    CONFIG_OK=false
fi
echo ""

# 诊断总结和建议
echo "===================="
echo "📋 诊断总结"
echo "===================="
echo ""

# 检查是否有问题
HAS_ISSUES=false

if ! command -v node &> /dev/null; then
    HAS_ISSUES=true
fi

if ! command -v pnpm &> /dev/null; then
    HAS_ISSUES=true
fi

if ! command -v rustc &> /dev/null; then
    HAS_ISSUES=true
fi

if [ ! -d "node_modules" ]; then
    HAS_ISSUES=true
fi

if [ "$CONFIG_OK" = false ]; then
    HAS_ISSUES=true
fi

# 根据情况给出建议
if [ "$HAS_ISSUES" = true ]; then
    echo "⚠️  检测到一些问题，请先解决后再启动应用"
    echo ""
    echo "🔧 快速修复建议："
    echo ""
    
    if command -v mise &> /dev/null && [ -f ".mise.toml" ]; then
        echo "  1. 使用 mise 安装所需工具版本："
        echo "     mise install"
        echo ""
        echo "  2. 安装项目依赖："
        echo "     pnpm install"
        echo ""
        echo "  3. 启动开发服务器："
        echo "     mise task dev"
    else
        echo "  1. 安装 mise（推荐）："
        echo "     curl https://mise.run | sh"
        echo "     或: brew install mise"
        echo ""
        echo "  2. 安装所需工具："
        echo "     mise install"
        echo ""
        echo "  3. 安装项目依赖："
        echo "     pnpm install"
        echo ""
        echo "  4. 启动开发服务器："
        echo "     mise task dev"
        echo ""
        echo "  或者手动安装："
        echo "  - Node.js $EXPECTED_NODE"
        echo "  - pnpm $EXPECTED_PNPM"
        echo "  - Rust $EXPECTED_RUST"
    fi
else
    echo "✅ 所有基础检查通过！"
    echo ""
    echo "🚀 启动应用："
    echo ""
    
    if command -v mise &> /dev/null && [ -f ".mise.toml" ]; then
        echo "  方式 1（推荐）: mise task dev"
        echo "  方式 2: pnpm tauri dev"
        echo "  方式 3: ./bin/start.sh"
    else
        echo "  方式 1: pnpm tauri dev"
        echo "  方式 2: ./bin/start.sh"
        echo ""
        echo "💡 提示: 建议安装 mise 来管理工具链版本"
        echo "   curl https://mise.run | sh && mise install"
    fi
fi

echo ""
echo "⚠️  重要提示："
echo "  - ❌ 不要使用 'pnpm dev'（只会启动 Vite，没有 Tauri 环境）"
echo "  - ✅ 必须使用包含 'tauri' 的命令启动"
echo "  - ⏱️  首次运行需要编译 Rust 代码，可能需要几分钟"
echo ""
