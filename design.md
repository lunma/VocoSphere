# 任务背景与目标

项目中，新增一个独立的【视频自动加字幕】功能模块。
核心架构为：前端负责 UI 交互和播放，Rust 后端负责本地文件处理和调用 FFmpeg。

# 执行原则 (非常重要)

1. **环境说明**：本项目使用 Nix 管理环境，Nix 已经在 `src-tauri/binaries/` 目录下自动生成了符合 Tauri 规范的 `ffmpeg-<target-triple>` 二进制文件。
2. **Sidecar 机制**：在 Rust 端调用 FFmpeg 时，**必须且只能使用** Tauri 的 Sidecar API：`tauri_plugin_shell::ShellExt` 和 `app.shell().sidecar("ffmpeg")`。绝对不要使用 `std::process::Command`。
3. **不破坏现有代码**：这是一个新增功能，请将其封装为独立的 React 组件/页面。
4. **Tauri 2 规范**：严格使用 Tauri v2 的 API 和配置方式。

# 执行步骤拆解

请按以下步骤逐步实现，每完成一步请与我确认后再进行下一步：

## Step 1: 环境检查与配置补全

1. 检查并安装前端缺失的依赖：`wavesurfer.js` (用于波形图)。
2. 检查并确保 Tauri v2 插件已安装并注册：`@tauri-apps/plugin-dialog`, `@tauri-apps/plugin-fs`, `@tauri-apps/plugin-shell`。
3. 在 `tauri.conf.json` 中配置 FFmpeg 作为 Sidecar (在 `bundle` 外部或内部配置 `externalBin: ["binaries/ffmpeg"]`，请根据 Tauri 2 文档正确配置)。
4. 确保 Tauri 的 `asset` 协议已开启，以便前端能通过 `asset://localhost/绝对路径` 播放本地视频。

## Step 2: 编写 Rust 后端核心逻辑

在 Rust 端新建一个模块处理字幕相关逻辑，并注册以下 Tauri Commands：

1. `select_video`: 调用 dialog 插件选择本地视频，返回绝对路径。
2. `extract_audio`: 使用 `app.shell().sidecar("ffmpeg")` 调用 FFmpeg，从传入的视频路径提取 16kHz 单声道 `.wav` 音频到系统临时目录 (`std::env::temp_dir()`)，返回音频绝对路径。
3. `start_asr`: 接收音频路径，返回文件字幕 JSON 数组。
4. `export_video_with_subtitles`: 接收视频路径和修改后的字幕 JSON。先将 JSON 在临时目录生成 `.srt` 文件，然后使用 `app.shell().sidecar("ffmpeg")` 将字幕烧录进视频，导出到用户选择的保存路径。

## Step 3: 前端 UI 布局与视频加载 (新增组件)

1. 创建一个新的主组件，界面分为三部分：左上角视频播放区，右上角字幕列表区，底部音频波形区。
2. 实现“导入视频”按钮，调用 `select_video` 获取路径后，使用 Tauri 的 `convertFileSrc` 将其赋值给 `<video>` 标签播放。

## Step 4: 波形图与字幕编辑器交互

1. 视频加载后，自动调用 `extract_audio` 和 `start_asr` 获取字幕数据。
2. 在底部使用 `wavesurfer.js` 渲染音频波形（加载提取出的临时 wav 文件）。
3. 在右上角渲染字幕列表（包含 Start Time, End Time, Text 的输入框）。
4. **交互联动**：点击字幕列表某一项，视频和波形图跳转到对应时间；波形图播放时，高亮当前字幕。允许用户在输入框中修改字幕文本。

## Step 5: 导出功能集成

1. 实现“导出视频”按钮。
2. 将当前前端状态中的字幕 JSON 数组和原视频路径发送给 `export_video_with_subtitles`。
3. 在前端展示导出进度（Loading 状态即可）。

请先阅读并理解我的现有项目结构，然后告诉我你的执行计划，我们从 Step 1 开始。
