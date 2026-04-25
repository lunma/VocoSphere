# VocoSphere

跨平台桌面应用（macOS / Windows / Linux）。前端 React + Vite，后端 Rust（Tauri v2）。实时语音识别、字幕叠加与日志管理。

## ✨ 核心功能

- 🎤 **实时语音识别**：WebSocket 接入 Gummy / Paraformer ASR 协议，支持翻译、热词、情感识别
- 🔊 **音频采集处理**：基于 `cpal + rubato` 的低延迟环回录音与重采样（支持系统声音 / 麦克风）
- 📺 **字幕叠加显示**：全局悬浮字幕层，支持 Apple / Netflix / YouTube 三种预设样式，可配置字体、位置、透明度、阴影
- 📝 **实时日志流**：Rust 日志推送到前端，支持自动滚动、级别过滤（DEBUG/INFO/WARN/ERROR）

## 🧭 应用界面

侧边栏可折叠，包含以下四个页面：

- **模型**（`/`）：ASR 模型配置，支持 Gummy / Paraformer 协议切换及参数调整
- **音频源**（`/audio`）：音频设备选择、捕获控制、识别结果展示
- **字幕**（`/subtitle`）：字幕样式、位置、字体、阴影等参数配置
- **运行日志**（`/logs`）：实时日志订阅，自动滚动、级别过滤

---

## 🚀 快速开始

```bash
# 1. 安装工具链（Node.js 22.21.1、pnpm 10.23.0、Rust 1.91.1）
mise install

# 2. 下载 ffmpeg sidecar
bash scripts/setup-ffmpeg.sh          # macOS / Linux
# PowerShell scripts\setup-ffmpeg.ps1  # Windows

# 3. 安装前端依赖
pnpm install

# 4. 启动开发服务器
pnpm tauri dev
```

> ⚠️ **注意**：必须使用 `pnpm tauri dev` 启动，`pnpm dev` 只启动 Vite，无法调用 Rust 后端。

---

## 📁 项目结构

```
vocosphere/
├── src/                          # 前端（React + TypeScript + Vite）
│   ├── pages/                    # 页面组件
│   ├── components/               # UI 组件（SubtitleOverlay、CustomSelect、shadcn/ui）
│   ├── store/                    # Zustand 状态管理
│   ├── hooks/                    # 业务 Hook（Tauri 交互、字幕窗口控制）
│   ├── context/                  # 遗留 Context（类型重导出，逐步迁移至 store/）
│   ├── layouts/                  # AppLayout（可折叠侧边栏）
│   └── types/                    # TypeScript 类型定义
├── src-tauri/                    # 后端（Rust + Tauri v2）
│   ├── src/
│   │   ├── asr/                  # ASR 模块（Gummy / Paraformer WebSocket 协议）
│   │   ├── audio/                # 音频处理（cpal + rubato）
│   │   ├── audio_capture.rs      # Tauri 命令：get/start/stop_audio_capture
│   │   ├── logger.rs             # 日志推送到前端
│   │   ├── app_state.rs          # 全局 AppHandle 存储
│   │   └── main.rs               # 程序入口
│   ├── binaries/                 # ffmpeg sidecar（由 setup-ffmpeg 脚本或 CI 自动生成，已 gitignore）
│   └── capabilities/             # Tauri 权限配置
├── scripts/                      # 开发辅助脚本（setup-ffmpeg.sh / setup-ffmpeg.ps1）
├── .mise.toml                    # mise 工具链版本配置
└── docs/                         # 项目文档与学习笔记
```

---

## 🛠️ 技术栈

**前端**：React 18 · TypeScript · Vite · Tailwind CSS v4 · shadcn/ui · Zustand v5 · React Router v6 · sonner

**后端**：Rust · Tauri v2 · cpal · rubato · tokio · tokio-tungstenite

---

## 📝 开发与构建

```bash
pnpm install          # 安装依赖
pnpm tauri dev        # 启动开发服务器
pnpm tauri build      # 构建生产包（产物：src-tauri/target/<triple>/release/bundle/）
pnpm lint             # 检查代码质量
pnpm format:check     # 检查格式
pnpm lint:fix         # 自动修复 lint
pnpm format           # 格式化代码
```

**构建产物**：macOS (`.app` / `.dmg`) · Windows (`.msi` / `.exe`) · Linux (`.deb` / `.AppImage`)

---

## 🔍 常见问题

- **`invoke` 报错**：确保使用 `pnpm tauri dev` 而非 `pnpm dev`
- **环境诊断**：macOS/Linux 运行 `./bin/diagnose.sh`，Windows 运行 `pwsh bin\diagnose.ps1`

---

## 🔐 签名与发布

当前已禁用代码签名。如需启用，在 `.github/workflows/vocosphere-build.yml` 中配置 GitHub Secrets。
详见 [Tauri 签名文档](https://tauri.app/v2/guides/distribution/signing)。
