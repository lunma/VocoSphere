# 🚀 Cargo 下载加速配置指南

下载 Rust crate 太慢？这里有多种解决方案！

## 📋 目录

1. [方案 1：使用国内镜像源（推荐）](#方案-1使用国内镜像源推荐)
2. [方案 2：配置 VPN 代理](#方案-2配置-vpn-代理)
3. [方案 3：配置 Git 代理](#方案-3配置-git-代理)
4. [方案 4：配置 VS Code/Cursor 的 rust-analyzer](#方案-4配置-vs-codecursor-的-rust-analyzer)

---

## 方案 1：使用国内镜像源（推荐）

### 优点
- ✅ 不需要 VPN
- ✅ 速度最快（国内服务器）
- ✅ 免费稳定
- ✅ 配置简单

### 配置步骤

#### 1. 创建或编辑 Cargo 配置文件

```bash
# macOS/Linux
mkdir -p ~/.cargo
nano ~/.cargo/config.toml

# Windows
# 编辑 %USERPROFILE%\.cargo\config.toml
```

#### 2. 添加镜像源配置

**选项 A：字节跳动镜像（推荐）**

```toml
[source.crates-io]
replace-with = 'rsproxy-sparse'

[source.rsproxy]
registry = "https://rsproxy.cn/crates.io-index"

[source.rsproxy-sparse]
registry = "sparse+https://rsproxy.cn/index/"

[registries.rsproxy]
index = "https://rsproxy.cn/crates.io-index"

[net]
git-fetch-with-cli = true
```

**选项 B：中科大镜像**

```toml
[source.crates-io]
replace-with = 'ustc'

[source.ustc]
registry = "sparse+https://mirrors.ustc.edu.cn/crates.io-index/"

[net]
git-fetch-with-cli = true
```

**选项 C：清华大学镜像**

```toml
[source.crates-io]
replace-with = 'tuna'

[source.tuna]
registry = "https://mirrors.tuna.tsinghua.edu.cn/git/crates.io-index.git"

[net]
git-fetch-with-cli = true
```

#### 3. 保存并测试

```bash
# 清理缓存
cargo clean

# 重新构建（会使用新的镜像源）
cargo build
```

---

## 方案 2：配置 VPN 代理

### 适用场景
- 已有 VPN/代理服务
- 需要访问 GitHub 等国外资源
- 镜像源不稳定时的备选方案

### HTTP/HTTPS 代理

编辑 `~/.cargo/config.toml`（macOS/Linux）或 `%USERPROFILE%\.cargo\config.toml`（Windows）：

```toml
[http]
proxy = "http://127.0.0.1:7890"  # 替换为你的代理地址和端口

[https]
proxy = "http://127.0.0.1:7890"  # 替换为你的代理地址和端口
```

### SOCKS5 代理

```toml
[http]
proxy = "socks5://127.0.0.1:7891"  # 替换为你的 SOCKS5 代理地址和端口

[https]
proxy = "socks5://127.0.0.1:7891"
```

### 常见代理端口

| 代理软件 | HTTP/HTTPS 端口 | SOCKS5 端口 |
|---------|----------------|-------------|
| Clash | 7890 | 7891 |
| V2Ray | 10809 | 10808 |
| Shadowsocks | - | 1080 |
| Surge | 6152 | 6153 |

### 查找你的代理端口

**macOS:**
```bash
# Clash
cat ~/Library/Application\ Support/clash/config.yaml | grep -E "port|socks-port"

# 或者查看代理软件的设置面板
```

**Windows:**
```powershell
# 查看系统代理设置
netsh winhttp show proxy
```

### 临时使用代理（不修改配置文件）

```bash
# macOS/Linux
export http_proxy=http://127.0.0.1:7890
export https_proxy=http://127.0.0.1:7890
cargo build

# Windows PowerShell
$env:http_proxy="http://127.0.0.1:7890"
$env:https_proxy="http://127.0.0.1:7890"
cargo build
```

---

## 方案 3：配置 Git 代理

Cargo 也会通过 Git 下载一些依赖，所以也需要配置 Git 代理。

### 全局配置 Git 代理

```bash
# HTTP/HTTPS 代理
git config --global http.proxy http://127.0.0.1:7890
git config --global https.proxy http://127.0.0.1:7890

# SOCKS5 代理
git config --global http.proxy socks5://127.0.0.1:7891
git config --global https.proxy socks5://127.0.0.1:7891
```

### 只为 GitHub 配置代理

```bash
# 只为 GitHub 设置代理
git config --global http.https://github.com.proxy http://127.0.0.1:7890
git config --global https.https://github.com.proxy http://127.0.0.1:7890
```

### 查看当前 Git 代理配置

```bash
git config --global --get http.proxy
git config --global --get https.proxy
```

### 取消 Git 代理

```bash
git config --global --unset http.proxy
git config --global --unset https.proxy
```

---

## 方案 4：配置 VS Code/Cursor 的 rust-analyzer

rust-analyzer 也会下载 crate，需要单独配置。

### 方法 1：通过 VS Code 设置

1. 打开设置（`Cmd/Ctrl + ,`）
2. 搜索 `rust-analyzer`
3. 找到 `Rust-analyzer › Server: Extra Env`
4. 点击 "Edit in settings.json"

添加：

```json
{
  "rust-analyzer.server.extraEnv": {
    "http_proxy": "http://127.0.0.1:7890",
    "https_proxy": "http://127.0.0.1:7890"
  }
}
```

### 方法 2：全局环境变量

**macOS/Linux（添加到 ~/.zshrc 或 ~/.bashrc）：**

```bash
export http_proxy=http://127.0.0.1:7890
export https_proxy=http://127.0.0.1:7890
export HTTP_PROXY=$http_proxy
export HTTPS_PROXY=$https_proxy
```

然后重启终端和 VS Code。

**Windows（系统环境变量）：**

1. 右键"此电脑" → 属性 → 高级系统设置
2. 环境变量 → 系统变量 → 新建
3. 添加：
   - `http_proxy` = `http://127.0.0.1:7890`
   - `https_proxy` = `http://127.0.0.1:7890`

---

## 🎯 推荐配置方案

### 方案组合：镜像源 + 代理

**最佳实践：**

1. **主要使用国内镜像源**（日常开发）
2. **配置 VPN 代理作为备用**（镜像源失败时）
3. **为 GitHub 单独配置代理**（下载 Git 依赖）

### 完整配置示例

**~/.cargo/config.toml:**

```toml
# 1. 优先使用字节跳动镜像
[source.crates-io]
replace-with = 'rsproxy-sparse'

[source.rsproxy-sparse]
registry = "sparse+https://rsproxy.cn/index/"

# 2. 配置代理（镜像源失败时的备选）
[http]
proxy = "http://127.0.0.1:7890"

[https]
proxy = "http://127.0.0.1:7890"

# 3. 使用 Git CLI（更稳定）
[net]
git-fetch-with-cli = true
```

**Git 配置（只为 GitHub 设置代理）：**

```bash
git config --global http.https://github.com.proxy http://127.0.0.1:7890
```

---

## 🔍 验证配置是否生效

### 测试 Cargo 下载速度

```bash
# 清理缓存
cargo clean
rm -rf ~/.cargo/registry

# 重新构建（观察下载速度）
cd /Users/lunma/workspace/rust/web/tauri-app/src-tauri
time cargo build
```

### 检查使用的镜像源

```bash
# 查看 Cargo 配置
cargo config get source.crates-io.replace-with

# 查看完整配置
cat ~/.cargo/config.toml
```

### 测试代理连接

```bash
# 测试 HTTP 代理
curl -x http://127.0.0.1:7890 https://www.google.com

# 测试 SOCKS5 代理
curl -x socks5://127.0.0.1:7891 https://www.google.com
```

---

## 🐛 常见问题

### Q1: 配置后还是很慢？

**解决方案：**
1. 确认代理软件正在运行
2. 检查端口号是否正确
3. 尝试切换不同的镜像源
4. 清理 Cargo 缓存后重试

### Q2: 镜像源下载失败？

**解决方案：**
```bash
# 切换到其他镜像源
# 或者临时使用代理
export http_proxy=http://127.0.0.1:7890
cargo build
```

### Q3: Git 依赖下载失败？

**解决方案：**
```bash
# 为 Git 配置代理
git config --global http.proxy http://127.0.0.1:7890

# 或者在 Cargo.toml 中使用 HTTPS 替代 Git
# 从：
# dependency = { git = "https://github.com/..." }
# 改为使用镜像源
```

### Q4: 代理端口怎么查？

**解决方案：**
1. 打开你的代理软件（Clash/V2Ray/Surge 等）
2. 查看设置/偏好设置
3. 找到"端口设置"或"本地服务器"
4. 记下 HTTP 端口（通常是 7890）和 SOCKS5 端口（通常是 7891）

---

## 🚀 一键配置脚本

我为你创建了自动配置脚本！

### 使用方法

```bash
./setup-cargo-mirror.sh
```

查看下一节的脚本内容。

---

## 📚 相关资源

- [Cargo 官方文档 - 配置](https://doc.rust-lang.org/cargo/reference/config.html)
- [字节跳动镜像源](https://rsproxy.cn/)
- [中科大镜像源](https://mirrors.ustc.edu.cn/help/crates.io-index.html)
- [清华大学镜像源](https://mirrors.tuna.tsinghua.edu.cn/help/crates.io-index.git/)

---

## 💡 建议

1. **优先使用镜像源**：最快、最稳定、免费
2. **代理作为备选**：镜像源失败时使用
3. **定期清理缓存**：`cargo clean` 和 `rm -rf ~/.cargo/registry`
4. **更新 Rust**：`rustup update` 保持最新版本

---

**配置后记得重启 VS Code 和终端！**

