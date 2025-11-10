# VocoSphere

> Tauri + React + Vite + TypeScript（使用 pnpm）

跨平台桌面应用（Windows / macOS / Linux）。前端 React+Vite，后端 Rust（Tauri v2）。“Voco” 源自 voice/vox，点明语音核心；“Sphere” 暗示全景式覆盖，从实时/离线识别到字幕、音视频处理等多场景。

## ✨ 项目功能

本项目是一个集成了语音识别（ASR）和音频处理功能的 Tauri 桌面应用：

- 🎤 **实时语音识别**：通过 WebSocket 接入 Gummy / Paraformer ASR 协议，支持翻译、热词、情感识别等扩展能力
- 🔊 **音频采集与处理**：基于 `cpal + rubato` 的低延迟环回录音与重采样流水线，支持调试音频落盘
- 📼 **识别结果控制台**：内置识别/翻译双视图、时间轴标记、临时/最终结果区分，可一键清空
- 📝 **实时日志流**：Rust 自定义日志器推送到前端，支持自动滚动、测试日志注入与级别高亮
- 🛠️ **跨平台支持**：支持 Windows、macOS 和 Linux

## 🧭 应用界面

- **概览页**：整合 ASR 模型配置面板（本地持久化），并在非 Tauri 环境下给出提示，提供 `invoke('greet')` 快速回路验证。
- **音频页**：集中音频捕获控制，展示识别结果与翻译结果双 Tab 视图，包含帧时间戳、句子编号、临时/最终状态标记。
- **日志页**：实时订阅 Rust 端 `log-message` 事件，支持自动滚动、按需展示/隐藏、发送测试日志、清空/高亮不同级别。

---

## 🎯 快速入口

- 📘 **[文档总览](./docs/README.md)** - 汇总所有专题文档与学习路线
- 🧱 **[项目整理说明](./docs/项目整理说明.md)** - 架构、目录与代码组织概览
- 🛠️ **[bin/](./bin/)** - 工具脚本目录（镜像、诊断、修复）

---

## 📚 快速导航

- 🆕 **新手？** → [docs/README.md](./docs/README.md)
- 🔍 **遇到问题？** → [Cargo文件锁问题.md](./docs/Cargo文件锁问题.md) | [Cargo代理配置.md](./docs/Cargo代理配置.md)
- 🎛️ **ASR / 音频？** → [ASR模型配置系统.md](./docs/ASR模型配置系统.md) | [音频通道生命周期管理.md](./docs/音频通道生命周期管理.md)
- ⚡ **一键配置** → `./bin/setup-cargo-mirror.sh`（配置镜像源）

---

## ⚠️ 重要：如何正确运行应用

**如果遇到 `Cannot read properties of undefined (reading 'invoke')` 错误，说明你没有使用正确的启动方式！**

### ✅ 正确方式（三选一）

```bash
# 方式 1: 使用启动脚本（推荐）
./bin/start.sh          # macOS/Linux
./bin/start.bat         # Windows

# 方式 2: 使用 pnpm 命令
pnpm tauri dev

# 方式 3: 使用 npm script
pnpm tauri:dev
```

### ❌ 错误方式

```bash
pnpm dev           # ❌ 这只会启动 Vite，没有 Tauri 环境
npm run dev        # ❌ 同上
```

**记住：必须使用包含 `tauri` 的命令启动，否则无法调用 Rust 后端！**

---

## 目录结构

```
vocosphere/
├── src/                    # 前端代码（React + TypeScript + Vite）
│   ├── App.tsx             # React Router 入口，挂载三大页面
│   ├── main.tsx            # 应用启动入口
│   ├── theme.ts            # Ant Design 自定义主题
│   ├── components/
│   │   └── AsrConfig.tsx   # ASR 模型配置面板（含本地持久化）
│   ├── context/            # React 上下文（Environment / ASR / Logs）
│   │   ├── AppContext.tsx
│   │   ├── AsrContext.tsx
│   │   ├── EnvironmentContext.tsx
│   │   └── LogsContext.tsx
│   ├── layouts/
│   │   └── AppLayout.tsx   # 顶部导航 + 页面容器
│   └── pages/
│       ├── OverviewPage.tsx
│       ├── AudioPage.tsx
│       └── LogsPage.tsx
├── src-tauri/              # Tauri 后端（Rust）
│   └── src/
│       ├── app_state.rs    # 全局 AppHandle 存储与事件分发
│       ├── asr/            # 语音识别模块
│       │   ├── config.rs   # 模型与服务器配置
│       │   ├── events.rs   # 事件定义
│       │   └── websocket/  # WebSocket 协议实现（Gummy / Paraformer）
│       ├── audio/          # 音频处理流水线（配置、处理器、统计）
│       ├── audio_capture.rs # 音频采集命令（cpal + rubato）
│       ├── logger.rs       # 自定义日志器，推送 log-message 事件
│       ├── utils/          # 辅助工具（如 WAV 写入）
│       └── main.rs         # 主程序入口（命令注册、插件、启动流程）
├── bin/                    # 工具脚本 🛠️
│   ├── start.sh            # 启动脚本
│   ├── setup-cargo-mirror.sh  # 镜像源配置
│   ├── diagnose.sh         # 环境诊断
│   └── fix-cargo-lock.sh   # 修复工具
├── docs/                   # 项目文档 📚
│   ├── README.md           # 文档索引与学习路线
│   ├── 项目整理说明.md       # 架构与目录拆解
│   ├── Cargo代理配置.md     # 依赖下载加速
│   ├── ASR模型配置系统.md    # ASR 配置面板与数据流
│   ├── 音频通道生命周期管理.md # 环回录音与通道管理
│   └── ...                 # 更多专题文档
├── audio_output/           # 音频输出目录
├── index.html
├── vite.config.ts
└── package.json
```

查看 [docs/README.md](./docs/README.md) 了解完整文档列表。

## 技术栈

### 前端
- **React 18** - UI 框架
- **TypeScript** - 类型安全
- **Vite** - 快速构建工具
- **Ant Design 5** - 交互组件库
- **React Router 6** - 页面级路由与布局
- **React Context** - 按领域拆分的全局状态管理（Environment/ASR/Logs）
- **@tauri-apps/api** - 前端与 Rust 命令/事件通信

### 后端
- **Rust** - 高性能系统语言
- **Tauri v2** - 跨平台桌面框架
- **cpal** - 跨平台音频库
- **rubato** - 高质量音频重采样
- **tokio** - 异步运行时
- **tokio-tungstenite / tungstenite** - WebSocket 客户端
- **anyhow** - 错误处理
- **chrono** - 时间与格式化（日志时间戳）

### 开发工具
- **pnpm** - 包管理器
- **rustup** - Rust 工具链管理

## 开发环境准备

- 通用：Node.js 18+、pnpm
- Rust：`rustup`（stable toolchain）
- macOS：Xcode Command Line Tools（`xcode-select --install`）
- Windows：Visual Studio Build Tools（含 C++ 桌面开发组件）及 Windows 10/11 SDK

## 启动开发

```bash
pnpm install
pnpm tauri:dev
```

默认前端端口 `5173`，Tauri 将加载 Vite Dev Server。

## 构建生产包

请在目标平台上执行构建：

```bash
# 通用打包
pnpm tauri:build
# 或者使用别名（实质等价）
pnpm build:desktop
```

- macOS：生成 `.app` / `.dmg`
- Windows：生成 `.msi` / `.exe`
- Linux：生成发行版对应安装包（如 `.deb`、`.AppImage` 等）

构建产物位于 `src-tauri/target/<triple>/release/bundle/`。

## 前端调用 Rust 示例

前端在 `src/App.tsx` 使用：

```ts
import { invoke } from '@tauri-apps/api/core'
const msg = await invoke<string>('greet', { name: 'World' })
```

Rust 命令在 `src-tauri/src/main.rs`：

```rust
#[tauri::command]
fn greet(name: &str) -> String { format!("你好, {}! 来自 Rust 的问候。", name) }
```

音频捕获与识别订阅示例：

```ts
import { invoke } from '@tauri-apps/api/core'
import { listen } from '@tauri-apps/api/event'
import type { AsrModelConfig } from './components/AsrConfig'

const storedConfig = localStorage.getItem('asr_model_config')
if (!storedConfig) {
  throw new Error('请先在概览页完成模型配置')
}
const config: AsrModelConfig = JSON.parse(storedConfig)

await invoke<string>('start_audio_capture', { config })
const unlisten = await listen('asr-result', (event) => {
  console.log('ASR →', event.payload)
})

// ...在需要时停止
await invoke<string>('stop_audio_capture')
await unlisten()
```

## 主要模块说明

### ⚙️ 前端状态管理（`src/context/`）

- `EnvironmentProvider`：通过 `@tauri-apps/api/core.isTauri()` 判断运行环境，针对非 Tauri 环境弹出提醒。
- `AsrProvider`：持久化 ASR 模型配置、封装 `invoke('start_audio_capture') / invoke('stop_audio_capture')` 调用，并订阅 `asr-result` 事件维护识别/翻译列表。
- `LogsProvider`：监听 `log-message` 事件，提供自动滚动、显示/隐藏、发送测试日志等控制。
- `AppProvider`：按 Environment → ASR → Logs 的顺序组合上下文，供三大页面复用。

### 🎤 ASR（语音识别）模块
位于 `src-tauri/src/asr/` 目录，统一封装 WebSocket ASR 通道：

- `config.rs`：定义 Gummy / Paraformer 模型配置，提供默认服务器与开关项（翻译、情感、热词、ITN 等）。
- `events.rs`：约定跨线程事件载体，便于统一推送到前端。
- `websocket/common.rs`：提供通用连接管理、消息封装、心跳逻辑。
- `websocket/gummy/*`：兼容 Gummy 协议，支持实时翻译、多目标语言、词表。
- `websocket/paraformer/*`：封装 Paraformer 协议，支持情感识别、不流畅词过滤、方言定制。

### 🔊 音频处理模块
- **音频采集命令** (`audio_capture.rs`)
  - 使用 `AtomicBool` 管理捕获状态，确保一次只运行一个录音流程。
  - 通过 `cpal` 捕获环回设备输出，并将原始音频交给处理流水线。
  - 调用 `async_runtime::spawn_blocking` 启动阻塞捕获线程，停止时按 100ms 轮询退出。
  - Debug 模式自动写入 `audio_output/` 目录，保存原始/重采样 WAV 文件用于验证。
- **音频处理流水线** (`audio/`)
  - `config.rs`：集中管理采样率、帧大小、增益等参数。
  - `processor.rs`：基于 `rubato::SincFixedIn` 重采样，维护音量统计、分通道缓冲。
  - `mod.rs`：暴露 `find_loopback_device`、`process_audio_data`、`VolumeStats` 等核心 API。
- **ASR 协同**：捕获到的帧通过 `tokio::sync::mpsc` 发送给 `asr::websocket::start_asr_with_config`，实现音频与识别解耦。

### 🧩 事件与日志
- `app_state.rs`：在 `setup` 阶段记录全局 `AppHandle`，提供 `emit_event` 辅助函数，方便任意模块向前端广播。
- `logger.rs`：注册全局 `log::Log` 实现，将 Rust 日志格式化后通过 `log-message` 事件推送给前端，并保留控制台输出，便于本地调试。
- `main.rs`：统一初始化日志、注册 shell 插件、暴露 Tauri 命令（`greet`、`test_logs`、`start_audio_capture`、`stop_audio_capture`），并在启动时附加 `AppHandle` 与日志器。

### 🛠️ 工具模块

- **文件工具** (`utils/file.rs`)
  - 文件操作辅助函数
  - 路径处理工具

## 常见问题

### 环境与编译
- **缺少工具链**：按上文为对应平台安装编译依赖
- **端口占用**：调整 `vite.config.ts` 中 `server.port`
- **编译卡住**：查看 [docs/Cargo文件锁问题.md](./docs/Cargo文件锁问题.md)
- **下载很慢**：查看 [docs/Cargo代理配置.md](./docs/Cargo代理配置.md)

### 运行错误
- **`invoke` 错误**：请参考上文“⚠️ 重要：如何正确运行应用”章节
- **错误处理**：查看 [docs/anyhow错误处理详解.md](./docs/anyhow错误处理详解.md)

### 发布与签名
- **权限/签名**：macOS/Windows 发布时需按平台签名要求配置（见下方签名章节）

### 更多帮助
查看 [docs/README.md](./docs/README.md) 获取完整文档列表

## 学习资源

### 项目文档
- [项目整理说明](./docs/项目整理说明.md) - 项目架构和代码组织
- [ASR模型配置系统](./docs/ASR模型配置系统.md) - ASR 配置面板与链路说明
- [音频通道生命周期管理](./docs/音频通道生命周期管理.md) - 音频通道与采集流程解析

### Rust 学习

#### 错误处理
- [anyhow错误处理详解](./docs/anyhow错误处理详解.md) - Rust 错误处理最佳实践
- [expect和问号操作符对比](./docs/expect和问号操作符对比.md) - 错误处理方式对比

#### 延迟初始化
- [OnceLock和LazyLock详解](./docs/OnceLock和LazyLock详解.md) - 延迟初始化工具
- [延迟初始化方案对比](./docs/延迟初始化方案对比.md) - 各种方案对比

#### 并发编程 🆕
- [音频通道生命周期管理](./docs/音频通道生命周期管理.md) - mpsc 通道在本项目中的应用
- [mpsc通道实现原理](./docs/mpsc通道实现原理.md) - 深入解析 Tokio mpsc 内部机制
- [Rust与Java并发对比](./docs/Rust与Java并发对比.md) - 跨语言并发机制全面对比

#### 跨语言对比
- [Java和Rust原子操作对比](./docs/Java和Rust原子操作对比.md) - 原子操作对比

### 外部资源
- [Tauri 官方文档](https://tauri.app/)
- [Rust 官方文档](https://doc.rust-lang.org/)
- [React 官方文档](https://react.dev/)

## 脚本一览

- `pnpm dev`：仅启动前端 Vite
- `pnpm tauri:dev`：启动 Tauri（内含前端）
- `pnpm build`：前端构建
- `pnpm tauri:build`：桌面应用打包
- `pnpm build:desktop|build:mac|build:win|build:linux`：等价的别名

## 配置文件说明

- `package.json`：项目的包描述文件
  - 定义依赖与开发依赖（如 `react`、`vite`、`@tauri-apps/cli`）
  - 定义常用脚本（如 `dev`、`build`、`tauri:dev`、`tauri:build`）
  - 指定模块类型（`type: module`）等元信息

- `tsconfig.json`：TypeScript 主配置（面向前端源码 `src/`）
  - 设置编译目标、模块解析方式、`jsx` 转换、严格模式等
  - `noEmit: true` 表示仅做类型检查，产物交给 Vite 处理
  - `include: ["src"]` 限定生效范围在前端目录

- `tsconfig.node.json`：给 Node 环境脚本/配置文件使用的 TS 配置
  - 主要用于 `vite.config.ts` 等运行在 Node 环境的 TS 文件
  - 启用 `composite`，并设置 `moduleResolution: bundler`、`allowSyntheticDefaultImports` 等

- `vite.config.ts`：Vite 构建与开发服务器配置
  - 挂载 React 插件（`@vitejs/plugin-react`）
  - 配置开发服务器端口（`server.port = 5173`）和端口占用策略（`strictPort`）
  - 可在此扩展别名、环境变量、构建优化等

- `src-tauri/tauri.conf.json`：Tauri 应用的主配置文件
  - 应用基础信息：`productName`、`version`、`identifier`
  - 构建/开发联动：`build.beforeDevCommand`（开发前运行前端命令，如 `pnpm dev`）、`build.beforeBuildCommand`（构建前端产物，如 `pnpm build`）
  - 前端产物路径：`build.frontendDist`（生产构建后的静态目录，如 `dist`）
  - 开发地址：`build.devUrl`（开发时加载的 Vite Dev Server 地址）
  - 窗口配置：`app.windows`（标题、宽高等）
  - 打包配置：`bundle.targets`（目标平台/安装包类型），`bundle.active`（是否启用打包）

## 签名与公证（CI 与本地）

> 推荐用 GitHub Actions 在各平台构建并签名；未配置签名变量时依然可构建未经签名的安装包。

### macOS（签名 + 公证）

1) 准备
- Apple 开发者账号（Team ID）
- 创建 App-Specific Password（供公证使用）
- 准备签名证书（Developer ID Application）

2) GitHub Secrets（两种方案，二选一或混合）
- 账号方案（适合仅公证，不上传证书）：
  - `APPLE_ID`：你的 Apple ID（邮箱）
  - `APPLE_APP_SPECIFIC_PASSWORD`：App 专用密码
  - `APPLE_TEAM_ID`：团队 ID（如 ABCDE12345）
  - `APPLE_SIGNING_IDENTITY`：签名身份（如 Developer ID Application: Your Name (TEAMID)）
- 证书方案（直接在 CI 注入证书）：
  - `APPLE_CERTIFICATE`：p12/pfx 证书文件内容的 base64
  - `APPLE_CERTIFICATE_PASSWORD`：证书密码

3) CI 工作流
- 已配置于 `.github/workflows/tauri-build.yml`，`tauri-action` 会根据上述变量自动签名/公证

4) 本地调试（可选）
- 在 macOS 上安装对应证书到钥匙串，`pnpm tauri:build` 将尝试签名

### Windows（代码签名）

1) 准备
- 代码签名证书（通常为 pfx）与密码

2) GitHub Secrets
- `TAURI_PRIVATE_KEY`：pfx 文件内容的 base64（或 PEM 私钥内容，按证书来源而定）
- `TAURI_KEY_PASSWORD`：证书密码

3) CI 工作流
- `.github/workflows/tauri-build.yml` 已透传上述变量给 `tauri-action`，会在构建产物上签名

4) 本地调试（可选）
- 在 Windows 上安装证书到证书存储后执行 `pnpm tauri:build`
