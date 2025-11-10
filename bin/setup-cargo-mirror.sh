#!/bin/bash

# Cargo 镜像源/代理一键配置脚本

echo "🚀 Cargo 下载加速配置工具"
echo "=========================="
echo ""

CARGO_CONFIG_DIR="$HOME/.cargo"
CARGO_CONFIG_FILE="$CARGO_CONFIG_DIR/config.toml"

# 创建 .cargo 目录
mkdir -p "$CARGO_CONFIG_DIR"

# 备份现有配置
if [ -f "$CARGO_CONFIG_FILE" ]; then
    BACKUP_FILE="$CARGO_CONFIG_FILE.backup.$(date +%Y%m%d_%H%M%S)"
    cp "$CARGO_CONFIG_FILE" "$BACKUP_FILE"
    echo "✅ 已备份现有配置到: $BACKUP_FILE"
    echo ""
fi

echo "请选择配置方案："
echo ""
echo "1. 字节跳动镜像源（推荐，国内最快）"
echo "2. 中科大镜像源"
echo "3. 清华大学镜像源"
echo "4. 配置 VPN 代理（需要代理软件）"
echo "5. 镜像源 + 代理（推荐组合）"
echo "6. 恢复默认配置"
echo ""
read -p "请输入选项 (1-6): " choice

case $choice in
    1)
        echo ""
        echo "正在配置字节跳动镜像源..."
        cat > "$CARGO_CONFIG_FILE" << 'EOF'
# 字节跳动 Rust 镜像源
[source.crates-io]
replace-with = 'rsproxy-sparse'

[source.rsproxy-sparse]
registry = "sparse+https://rsproxy.cn/index/"

[net]
git-fetch-with-cli = true
EOF
        echo "✅ 字节跳动镜像源配置完成！"
        ;;
    
    2)
        echo ""
        echo "正在配置中科大镜像源..."
        cat > "$CARGO_CONFIG_FILE" << 'EOF'
# 中科大 Rust 镜像源
[source.crates-io]
replace-with = 'ustc'

[source.ustc]
registry = "sparse+https://mirrors.ustc.edu.cn/crates.io-index/"

[net]
git-fetch-with-cli = true
EOF
        echo "✅ 中科大镜像源配置完成！"
        ;;
    
    3)
        echo ""
        echo "正在配置清华大学镜像源..."
        cat > "$CARGO_CONFIG_FILE" << 'EOF'
# 清华大学 Rust 镜像源
[source.crates-io]
replace-with = 'tuna'

[source.tuna]
registry = "https://mirrors.tuna.tsinghua.edu.cn/git/crates.io-index.git"

[net]
git-fetch-with-cli = true
EOF
        echo "✅ 清华大学镜像源配置完成！"
        ;;
    
    4)
        echo ""
        echo "配置 VPN 代理"
        echo "-------------"
        echo ""
        echo "常见代理端口："
        echo "  - Clash: HTTP 7890, SOCKS5 7891"
        echo "  - V2Ray: HTTP 10809, SOCKS5 10808"
        echo "  - Shadowsocks: SOCKS5 1080"
        echo ""
        read -p "请输入代理类型 (http/socks5): " proxy_type
        read -p "请输入代理地址 (默认 127.0.0.1): " proxy_host
        proxy_host=${proxy_host:-127.0.0.1}
        read -p "请输入代理端口 (例如 7890): " proxy_port
        
        if [ -z "$proxy_port" ]; then
            echo "❌ 端口不能为空！"
            exit 1
        fi
        
        echo ""
        echo "正在配置代理..."
        
        if [ "$proxy_type" = "socks5" ]; then
            cat > "$CARGO_CONFIG_FILE" << EOF
# VPN 代理配置 (SOCKS5)
[http]
proxy = "socks5://$proxy_host:$proxy_port"

[https]
proxy = "socks5://$proxy_host:$proxy_port"

[net]
git-fetch-with-cli = true
EOF
        else
            cat > "$CARGO_CONFIG_FILE" << EOF
# VPN 代理配置 (HTTP)
[http]
proxy = "http://$proxy_host:$proxy_port"

[https]
proxy = "http://$proxy_host:$proxy_port"

[net]
git-fetch-with-cli = true
EOF
        fi
        
        echo "✅ 代理配置完成！"
        echo ""
        echo "⚠️  请确保代理软件正在运行！"
        ;;
    
    5)
        echo ""
        echo "配置镜像源 + 代理组合"
        echo "-------------------"
        echo ""
        read -p "请输入代理地址 (默认 127.0.0.1): " proxy_host
        proxy_host=${proxy_host:-127.0.0.1}
        read -p "请输入 HTTP 代理端口 (默认 7890): " proxy_port
        proxy_port=${proxy_port:-7890}
        
        echo ""
        echo "正在配置..."
        cat > "$CARGO_CONFIG_FILE" << EOF
# 字节跳动镜像源（主要）
[source.crates-io]
replace-with = 'rsproxy-sparse'

[source.rsproxy-sparse]
registry = "sparse+https://rsproxy.cn/index/"

# VPN 代理（备用）
[http]
proxy = "http://$proxy_host:$proxy_port"

[https]
proxy = "http://$proxy_host:$proxy_port"

# 使用 Git CLI
[net]
git-fetch-with-cli = true
EOF
        
        echo "✅ 镜像源 + 代理配置完成！"
        echo ""
        echo "📝 说明："
        echo "  - 主要使用字节跳动镜像源（最快）"
        echo "  - 镜像源失败时自动使用代理"
        ;;
    
    6)
        echo ""
        echo "正在恢复默认配置..."
        cat > "$CARGO_CONFIG_FILE" << 'EOF'
# Cargo 默认配置
[net]
git-fetch-with-cli = true
EOF
        echo "✅ 已恢复为默认配置"
        ;;
    
    *)
        echo "❌ 无效选项！"
        exit 1
        ;;
esac

echo ""
echo "=========================="
echo "📁 配置文件位置: $CARGO_CONFIG_FILE"
echo ""
echo "查看配置："
echo "  cat $CARGO_CONFIG_FILE"
echo ""
echo "测试配置："
echo "  cd src-tauri && cargo clean && cargo build"
echo ""
echo "💡 建议："
echo "  1. 清理缓存: cargo clean"
echo "  2. 重启 VS Code/Cursor"
echo "  3. 重新构建项目"
echo ""
echo "🎯 如需配置 Git 代理，请运行："
echo "  git config --global http.proxy http://127.0.0.1:7890"
echo ""
echo "✅ 配置完成！"

