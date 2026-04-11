# VocoSphere

> Tauri + React + Vite + TypeScript（使用 pnpm）

跨平台桌面应用（Windows / macOS / Linux）。前端 React + Vite，后端 Rust（Tauri v2）。实时语音识别、字幕叠加与日志管理。

## ✨ 核心功能

- 🎤 **实时语音识别**：WebSocket 接入 Gummy / Paraformer ASR 协议，支持翻译、热词、情感识别
- 🔊 **音频采集处理**：基于 `cpal + rubato` 的低延迟环回录音与重采样（支持系统声音 / 麦克风）
- 📺 **字幕叠加显示**：全局悬浮字幕层，支持 Apple / Netflix / YouTube 三种预设样式，可配置字体、位置、透明度、阴影
- 📼 **识别结果展示**：识别 + 翻译按句子分组，临时 / 最终结果区分，时间轴标记
- 📝 **实时日志流**：Rust 日志推送到前端，支持自动滚动、级别过滤（DEBUG/INFO/WARN/ERROR）

## 🧭 应用界面

侧边栏可折叠，包含以下四个页面：

- **模型**（`/`）：ASR 模型配置（本地持久化），支持 Gummy / Paraformer 协议切换及参数调整
- **音频源**（`/audio`）：音频设备选择（系统环回 / 麦克风）、捕获控制、识别结果展示
- **字幕**（`/subtitle`）：字幕样式、位置、字体、阴影等参数配置
- **运行日志**（`/logs`）：实时日志订阅，自动滚动、级别过滤

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
├── src/                          # 前端（React + TypeScript + Vite）
│   ├── pages/                    # 页面
│   │   ├── ModelConfigPage.tsx   # ASR 模型配置页
│   │   ├── AudioSourceSettingsPage.tsx  # 音频源设置 + 识别结果
│   │   ├── SubtitleSettingsPage.tsx     # 字幕样式配置页
│   │   └── LogsPage.tsx          # 实时日志页
│   ├── components/               # 组件
│   │   ├── SubtitleOverlay.tsx   # 全局字幕叠加层（Portal 渲染）
│   │   ├── CustomSelect.tsx      # 自定义下拉选择器
│   │   └── ui/                   # shadcn/ui 基础组件
│   ├── context/                  # 状态管理
│   │   ├── AppContext.tsx         # 统一导出入口
│   │   ├── AsrContext.tsx        # ASR 状态与命令
│   │   ├── EnvironmentContext.tsx # 环境信息
│   │   └── LogsContext.tsx       # 日志订阅
│   ├── layouts/
│   │   └── AppLayout.tsx         # 可折叠侧边栏布局
│   ├── types/
│   │   └── asr.ts                # ASR 相关类型定义
│   └── lib/utils.ts              # Tailwind 工具函数
├── src-tauri/                    # 后端（Rust + Tauri v2）
│   ├── src/
│   │   ├── asr/                  # ASR 模块（WebSocket 协议）
│   │   │   ├── config.rs         # ASR 配置类型
│   │   │   ├── events.rs         # 事件推送到前端
│   │   │   └── websocket/        # Gummy / Paraformer 协议实现
│   │   ├── audio/                # 音频处理模块（cpal + rubato）
│   │   ├── audio_capture.rs      # Tauri 命令：get/start/stop_audio_capture
│   │   ├── logger.rs             # 日志推送到前端
│   │   ├── app_state.rs          # 全局 AppHandle 存储
│   │   └── main.rs               # 程序入口
├── bin/                          # 工具脚本
│   └── diagnose.sh               # 环境诊断脚本
├── docs/                         # 项目文档
└── .mise.toml                    # 工具链版本配置
```

查看 [docs/README.md](./docs/README.md) 了解完整文档列表。

---

## 🛠️ 技术栈

**前端**：React 18 + TypeScript + Vite + Tailwind CSS v4 + shadcn/ui + Lucide React + React Router v6 + sonner  
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

// 获取可用设备
const devices = await invoke<AudioDevice[]>('get_audio_devices')

// 启动捕获（支持指定设备）
await invoke('start_audio_capture', { config, deviceName: 'BlackHole 2ch' })

// 监听识别结果
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
- **字幕叠加** (`src/components/SubtitleOverlay.tsx`)：Portal 渲染至 body，实时监听 ASR 结果，支持多预设样式
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
