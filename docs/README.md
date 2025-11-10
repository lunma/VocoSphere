# 📚 项目文档目录

欢迎查阅 Tauri 应用的完整文档！

## 🚀 从这里开始

### 🎉 最新更新
- 新增 **并发编程系列文档**（3 篇），深入解析 Rust mpsc 通道机制
- [音频通道生命周期管理.md](./音频通道生命周期管理.md) - 实战应用
- [mpsc通道实现原理.md](./mpsc通道实现原理.md) - 内部机制
- [Rust与Java并发对比.md](./Rust与Java并发对比.md) - 跨语言对比

### 新手必读
1. **[运行说明.md](./运行说明.md)** ⭐  
   详细的配置和运行指南，新手必读

2. **[Cargo代理配置.md](./Cargo代理配置.md)** ⭐  
   加速 Rust 依赖下载，强烈推荐配置

3. **[项目整理说明.md](./项目整理说明.md)**  
   项目结构和架构说明

## 📖 完整文档列表

### 入门指南
- **[运行说明.md](./运行说明.md)** - 详细的配置和运行指南

### 问题解决
- **[解决invoke错误.md](./解决invoke错误.md)** - 解决 `invoke` 相关错误
- **[Cargo文件锁问题.md](./Cargo文件锁问题.md)** - 解决编译卡住问题
- **[Cargo代理配置.md](./Cargo代理配置.md)** - 加速 Rust 依赖下载

### 功能说明
- **[audio_capture优化完成.md](./audio_capture优化完成.md)** - 音频采集模块优化说明
- **[项目整理说明.md](./项目整理说明.md)** - 项目结构和整理说明

### Rust 技术文档

#### 错误处理
- **[anyhow错误处理详解.md](./anyhow错误处理详解.md)** - Rust anyhow 错误处理库详解
- **[expect和问号操作符对比.md](./expect和问号操作符对比.md)** - Rust 错误处理方式对比

#### 延迟初始化
- **[OnceLock和LazyLock详解.md](./OnceLock和LazyLock详解.md)** - Rust 延迟初始化工具详解
- **[延迟初始化方案对比.md](./延迟初始化方案对比.md)** - 各种延迟初始化方案对比

#### 并发编程 ⭐ 新增
- **[音频通道生命周期管理.md](./音频通道生命周期管理.md)** - mpsc 通道在本项目中的应用实践
- **[mpsc通道实现原理.md](./mpsc通道实现原理.md)** - 深入解析 Tokio mpsc 的内部实现机制
- **[Rust与Java并发对比.md](./Rust与Java并发对比.md)** - Rust 和 Java 并发机制的全面对比

#### 跨语言对比
- **[Java和Rust原子操作对比.md](./Java和Rust原子操作对比.md)** - 跨语言原子操作对比

## 🔍 快速查找

### 遇到错误？

| 错误信息 | 查看文档 |
|---------|---------|
| `Cannot read properties of undefined (reading 'invoke')` | [解决invoke错误.md](./解决invoke错误.md) |
| `Blocking waiting for file lock` | [Cargo文件锁问题.md](./Cargo文件锁问题.md) |
| 下载依赖很慢 | [Cargo代理配置.md](./Cargo代理配置.md) |

### 想了解...

| 主题 | 查看文档 |
|-----|---------|
| 如何启动应用 | [运行说明.md](./运行说明.md) |
| 音频采集模块 | [audio_capture优化完成.md](./audio_capture优化完成.md) |
| 项目结构说明 | [项目整理说明.md](./项目整理说明.md) |
| 配置镜像源加速 | [Cargo代理配置.md](./Cargo代理配置.md) |
| Rust 错误处理 | [anyhow错误处理详解.md](./anyhow错误处理详解.md) |
| 音频通道生命周期 ⭐ | [音频通道生命周期管理.md](./音频通道生命周期管理.md) |
| mpsc 通道原理 ⭐ | [mpsc通道实现原理.md](./mpsc通道实现原理.md) |
| Rust vs Java 并发 ⭐ | [Rust与Java并发对比.md](./Rust与Java并发对比.md) |

## 💡 推荐阅读顺序

### 第一次使用
1. [运行说明.md](./运行说明.md) - 了解如何启动
2. [Cargo代理配置.md](./Cargo代理配置.md) - 配置加速
3. [项目整理说明.md](./项目整理说明.md) - 了解项目结构

### 深入学习 Rust
1. [anyhow错误处理详解.md](./anyhow错误处理详解.md) - 学习错误处理
2. [expect和问号操作符对比.md](./expect和问号操作符对比.md) - 错误处理方式
3. [OnceLock和LazyLock详解.md](./OnceLock和LazyLock详解.md) - 延迟初始化
4. [延迟初始化方案对比.md](./延迟初始化方案对比.md) - 方案对比
5. [音频通道生命周期管理.md](./音频通道生命周期管理.md) - 通道生命周期 ⭐
6. [mpsc通道实现原理.md](./mpsc通道实现原理.md) - 通道内部原理 ⭐
7. [Rust与Java并发对比.md](./Rust与Java并发对比.md) - 并发机制对比 ⭐

### 遇到问题
1. 查看错误速查表（上方 🔍 快速查找）
2. 对应的问题解决文档
3. 运行 `../bin/diagnose.sh` 诊断环境

## 🛠️ 配套工具

所有工具脚本位于 `../bin/` 目录：

- `start.sh` - 一键启动
- `setup-cargo-mirror.sh` - 配置镜像源
- `diagnose.sh` - 环境诊断
- `fix-cargo-lock.sh` - 修复编译问题

查看 [bin/README.md](../bin/README.md) 了解详情。

## 📝 文档编写原则

本项目的文档遵循以下原则：

1. **新手友好**：假设读者是第一次接触 Tauri
2. **问题导向**：从常见问题出发，提供解决方案
3. **图文并茂**：使用表格、代码块、emoji 增强可读性
4. **实用至上**：提供可直接使用的命令和配置

## 📚 Rust 学习路线图

如果您想深入学习本项目中使用的 Rust 技术，推荐以下学习路线：

### 初级 - 基础概念
1. [anyhow错误处理详解.md](./anyhow错误处理详解.md)
2. [expect和问号操作符对比.md](./expect和问号操作符对比.md)

### 中级 - 高级特性
3. [OnceLock和LazyLock详解.md](./OnceLock和LazyLock详解.md)
4. [延迟初始化方案对比.md](./延迟初始化方案对比.md)
5. [Java和Rust原子操作对比.md](./Java和Rust原子操作对比.md)

### 高级 - 并发编程 ⭐ 新增
6. [音频通道生命周期管理.md](./音频通道生命周期管理.md) - 了解通道在实际项目中的应用
7. [mpsc通道实现原理.md](./mpsc通道实现原理.md) - 深入理解通道的内部机制
8. [Rust与Java并发对比.md](./Rust与Java并发对比.md) - 从 Java 视角理解 Rust 并发

### 实践 - 项目应用
9. [audio_capture优化完成.md](./audio_capture优化完成.md) - 查看音频采集的完整实现

## 🌐 外部资源

### 框架与工具
- [Tauri 官方文档](https://tauri.app/)
- [Rust 官方文档](https://doc.rust-lang.org/)
- [React 官方文档](https://react.dev/)
- [Vite 官方文档](https://vitejs.dev/)

### 音频与并发
- [cpal 音频库](https://github.com/RustAudio/cpal)
- [Tokio 异步运行时](https://tokio.rs/)
- [Tokio mpsc 文档](https://docs.rs/tokio/latest/tokio/sync/mpsc/)
- [Rust 并发编程](https://doc.rust-lang.org/book/ch16-00-concurrency.html)

## 📞 需要帮助？

1. 查看本文档上方的 **🔍 快速查找** 部分
2. 查看 [运行说明.md](./运行说明.md) 了解启动问题
3. 查看 [Cargo文件锁问题.md](./Cargo文件锁问题.md) 解决编译问题
4. 运行 `../bin/diagnose.sh` 诊断环境

---

**提示**：所有文档均使用 Markdown 编写，可在任何文本编辑器或 GitHub 中查看。

