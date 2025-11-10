# 🔒 Cargo 文件锁问题解决方案

## 问题表现

启动应用时卡在：
```
Blocking waiting for file lock on package cache
```

## 🎯 原因分析

Cargo 正在等待包缓存的文件锁，可能是因为：

1. **rust-analyzer 正在分析代码**（IDE 的 Rust 插件）
2. **另一个 cargo 命令正在运行**
3. **之前的构建异常中断**，锁文件没有被清理
4. **首次编译需要下载大量依赖**（看起来像卡住）

## ✅ 解决方案

### 方案 1：耐心等待（推荐，首次运行）

如果是**首次运行**或**刚更新了依赖**：

```
⏰ 等待 2-3 分钟
```

首次编译需要：
- 下载所有 Rust 依赖包
- 编译 Tauri 核心库
- 编译你的项目代码

**这是正常的！** 只有首次编译慢，后续启动会很快。

### 方案 2：关闭 IDE 的 Rust 插件（临时）

如果等待后仍然卡住：

1. 在 Cursor/VS Code 中暂时禁用 rust-analyzer
2. 按 `Ctrl+C` 停止当前构建
3. 重新运行 `./start.sh` 或 `pnpm tauri dev`

### 方案 3：清理锁文件（强力）

按 `Ctrl+C` 停止，然后运行：

```bash
./fix-cargo-lock.sh
```

这个脚本会：
1. 停止所有 cargo 进程
2. 清理锁文件
3. 清理构建缓存

然后重新启动：
```bash
./start.sh
```

### 方案 4：手动清理（最彻底）

```bash
# 1. 停止当前进程（Ctrl+C）

# 2. 停止所有 cargo 进程
pkill -f cargo

# 3. 清理构建缓存
cd src-tauri
cargo clean
cd ..

# 4. 清理全局锁（可选）
rm -f ~/.cargo/.package-cache

# 5. 重新启动
pnpm tauri dev
```

## 🔍 检查进程

查看当前运行的 cargo 进程：

```bash
ps aux | grep cargo | grep -v grep
```

如果看到多个 `cargo metadata` 进程，那是 rust-analyzer 在工作。

## 💡 预防措施

### 1. 首次编译时保持耐心

```
首次编译：2-5 分钟（正常）
后续启动：10-30 秒
```

### 2. 避免同时运行多个 cargo 命令

不要同时运行：
- `cargo build`
- `cargo run`
- `pnpm tauri dev`

### 3. 让 rust-analyzer 完成分析

打开项目后，等待 IDE 底部的 rust-analyzer 状态完成（通常 1-2 分钟）。

### 4. 配置 rust-analyzer（可选）

在 VS Code/Cursor 设置中：

```json
{
  "rust-analyzer.cargo.buildScripts.enable": false,
  "rust-analyzer.checkOnSave.enable": false
}
```

这会减少 rust-analyzer 对 cargo 锁的使用，但会失去一些代码检查功能。

## 📊 当前状态判断

### 🟢 正常等待状态

```
Blocking waiting for file lock on package cache
(等待 2-3 分钟)
```

**处理：耐心等待**

### 🟡 可能卡住

```
Blocking waiting for file lock on package cache
(超过 5 分钟)
```

**处理：使用方案 2 或方案 3**

### 🔴 确定卡住

```
Blocking waiting for file lock on package cache
(超过 10 分钟)
```

**处理：Ctrl+C 停止，使用方案 3 或方案 4**

## 🎯 推荐流程

### 首次运行

```bash
# 1. 启动应用
./start.sh

# 2. 看到 "Blocking waiting..." 是正常的
#    耐心等待 2-5 分钟

# 3. 等待完成后，窗口会自动打开
```

### 后续运行

如果再次遇到：

```bash
# 1. 停止进程（Ctrl+C）

# 2. 运行修复脚本
./fix-cargo-lock.sh

# 3. 重新启动
./start.sh
```

## 🚀 验证问题已解决

成功启动后你会看到：

```
✅ Finished dev [unoptimized + debuginfo] target(s) in X.XXs
✅ Running tauri-app...
```

然后桌面窗口会自动打开。

## 📚 相关资源

- [Cargo 构建问题](https://doc.rust-lang.org/cargo/faq.html)
- [rust-analyzer 配置](https://rust-analyzer.github.io/)
- [Tauri 开发指南](https://tauri.app/v1/guides/)

## 💡 记住

> **首次编译慢是正常的，耐心等待！**
> 
> 后续启动会快很多（10-30 秒）

---

**还有问题？** 运行诊断工具：
```bash
./diagnose.sh
```

