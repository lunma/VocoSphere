# VocoSphere

> Tauri + React + Vite + TypeScript（使用 pnpm）

跨平台桌面应用（Windows / macOS / Linux）。前端 React+Vite，后端 Rust（Tauri v2）。实时语音识别、音频处理与日志管理。

## ✨ 核心功能

- 🎤 **实时语音识别**：WebSocket 接入 Gummy / Paraformer ASR 协议，支持翻译、热词、情感识别
- 🔊 **音频采集处理**：基于 `cpal + rubato` 的低延迟环回录音与重采样
- 📼 **识别结果展示**：识别/翻译双视图、时间轴标记、临时/最终结果区分
- 📝 **实时日志流**：Rust 日志推送到前端，支持自动滚动、级别过滤（DEBUG/INFO/WARN/ERROR）

## 🧭 应用界面

- **模型配置页**：ASR 模型配置（本地持久化），支持 Gummy / Paraformer 协议切换
- **音频捕获页**：音频设备选择、捕获控制，识别结果与翻译结果双 Tab 视图
- **日志页**：实时日志订阅，自动滚动、级别过滤

---

## 🚀 快速开始

### 1. 安装 mise（推荐）

```bash
curl https://mise.run | sh
# 或: brew install mise
```

### 2. 安装工具链

```bash
# 进入项目目录
mise install  # 自动安装 Node.js 22.21.1, pnpm 10.23.0, Rust 1.91.1
```

### 3. 安装依赖并启动

```bash
pnpm install
mise task dev  # 或: pnpm tauri dev
```

### 可用命令

```bash
mise task dev      # 启动开发服务器
mise task build    # 构建应用
mise task qa       # 代码质量检查（格式 + lint）
mise task clean    # 清理构建产物
mise task diagnose # 环境诊断
```

---

## ⚠️ 重要提示

**如果遇到 `Cannot read properties of undefined (reading 'invoke')` 错误，说明没有使用正确的启动方式！**

### ✅ 正确启动方式

```bash
mise task dev    # 推荐
pnpm tauri dev   # 或使用此命令
```

### ❌ 错误方式

```bash
pnpm dev  # ❌ 这只会启动 Vite，没有 Tauri 环境
```

**必须使用包含 `tauri` 的命令启动，否则无法调用 Rust 后端！**

---

## 📁 项目结构

```
vocosphere/
├── src/                      # 前端（React + TypeScript + Vite）
│   ├── pages/                # 页面：ModelConfigPage, AudioCapturePage, LogsPage
│   ├── components/           # 组件：AsrConfig
│   ├── context/              # 状态管理：Environment, ASR, Logs
│   └── layouts/              # 布局：AppLayout
├── src-tauri/                # 后端（Rust + Tauri）
│   ├── src/
│   │   ├── asr/              # ASR 模块（WebSocket 协议）
│   │   ├── audio/            # 音频处理模块
│   │   ├── audio_capture.rs  # 音频采集命令
│   │   └── main.rs           # 主程序入口
├── bin/                      # 工具脚本
│   └── diagnose.sh           # 环境诊断脚本
├── docs/                      # 项目文档
└── .mise.toml                # 工具链版本配置
```

查看 [docs/README.md](./docs/README.md) 了解完整文档列表。

---

## 🛠️ 技术栈

**前端**：React 18 + TypeScript + Vite + Ant Design 5 + ESLint + Prettier  
**后端**：Rust + Tauri v2 + cpal + rubato + tokio + tokio-tungstenite

---

## 📝 开发与构建

### 开发

```bash
pnpm install          # 安装依赖
pnpm tauri dev        # 启动开发服务器（端口 5173）
```

### 构建

```bash
pnpm tauri build      # 构建生产包
# 产物位置: src-tauri/target/<triple>/release/bundle/
```

**构建产物**：macOS (`.app`/`.dmg`) | Windows (`.msi`/`.exe`) | Linux (`.deb`/`.rpm`/`.AppImage`)

### 代码质量

```bash
pnpm lint           # 检查代码质量
pnpm lint:fix       # 自动修复
pnpm format         # 格式化代码
pnpm format:check   # 检查格式
```

---

## 📝 使用示例

### 前端调用 Rust 命令

```ts
import { invoke } from '@tauri-apps/api/core'
const result = await invoke<string>('greet', { name: 'World' })
```

### 音频捕获与 ASR 识别

```ts
import { invoke } from '@tauri-apps/api/core'
import { listen } from '@tauri-apps/api/event'

await invoke('start_audio_capture', { config })
const unlisten = await listen('asr-result', (event) => {
  console.log('ASR 结果:', event.payload)
})
await invoke('stop_audio_capture')
```

---

## 🔍 常见问题

### 环境问题
- **缺少工具链**：运行 `mise install` 或 `./bin/diagnose.sh` 诊断环境
- **编译卡住**：查看 [Cargo文件锁问题.md](./docs/Cargo文件锁问题.md)
- **下载慢**：查看 [Cargo代理配置.md](./docs/Cargo代理配置.md)

### 运行错误
- **`invoke` 错误**：确保使用 `pnpm tauri dev` 而非 `pnpm dev`
- **环境检查**：运行 `./bin/diagnose.sh` 或 `mise task diagnose`

---

## 📚 快速导航

- 🆕 **新手入门** → [docs/README.md](./docs/README.md)
- 🔍 **问题排查** → [Cargo文件锁问题.md](./docs/Cargo文件锁问题.md) | [Cargo代理配置.md](./docs/Cargo代理配置.md)
- 🎛️ **ASR/音频** → [ASR模型配置系统.md](./docs/ASR模型配置系统.md) | [音频通道生命周期管理.md](./docs/音频通道生命周期管理.md)
- ⚡ **一键配置** → `./bin/setup-cargo-mirror.sh`

---

## 📖 主要模块

- **前端状态管理** (`src/context/`)：EnvironmentProvider, AsrProvider, LogsProvider
- **ASR 模块** (`src-tauri/src/asr/`)：Gummy / Paraformer WebSocket 协议实现
- **音频处理** (`src-tauri/src/audio/`)：基于 cpal 的音频采集与 rubato 重采样

---

## 🔐 签名与发布

> 当前项目已禁用代码签名，构建时不会进行签名/公证。

如需启用签名，请在 `.github/workflows/tauri-build.yml` 中配置 GitHub Secrets。  
详细说明：[Tauri 应用签名文档](https://tauri.app/v2/guides/distribution/signing)

---

## 🎓 学习资源

### 项目文档
- [项目整理说明](./docs/项目整理说明.md) - 架构与代码组织
- [ASR模型配置系统](./docs/ASR模型配置系统.md) - ASR 配置与数据流
- [音频通道生命周期管理](./docs/音频通道生命周期管理.md) - 音频处理流程

### Rust 学习
- [anyhow错误处理详解](./docs/anyhow错误处理详解.md)
- [mpsc通道实现原理](./docs/mpsc通道实现原理.md)
- [Rust与Java并发对比](./docs/Rust与Java并发对比.md)

### 外部资源
- [Tauri 官方文档](https://tauri.app/)
- [Rust 官方文档](https://doc.rust-lang.org/)
- [React 官方文档](https://react.dev/)
