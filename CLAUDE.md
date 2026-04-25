# VocoSphere — Claude Code 开发指南

VocoSphere 是一款基于 Tauri v2 + React 18 的跨平台桌面应用，用于实时语音识别。
应用从系统音频设备采集音频，通过 WebSocket 发送至 ASR 服务（Gummy/Paraformer 协议），
并将识别结果以悬浮字幕的形式渲染在屏幕上。

---

## 技术栈

| 层级 | 技术 |
|---|---|
| 前端框架 | React 18、TypeScript 5、Vite 5 |
| 样式 | Tailwind CSS v4、shadcn/ui（radix-nova 主题）、Lucide React |
| 路由 | React Router v6 |
| 状态管理 | Zustand v5 |
| 设置持久化 | `@tauri-apps/plugin-store`（字幕设置）、localStorage（其他设置） |
| 消息提示 | sonner |
| Tauri IPC | `@tauri-apps/api` v2 |
| 后端 | Rust、Tauri v2 |
| 异步运行时 | tokio（full features） |
| 音频处理 | cpal + rubato |
| WebSocket | tokio-tungstenite + tokio-rustls |

---

## 项目结构（关键文件）

非显而易见的入口和跨域文件：

- `src/main.tsx` — 主窗口入口；`src/subtitle-main.tsx` — 字幕悬浮窗独立入口（对应 `subtitle-overlay.html`）
- `src/store/environmentStore.ts` — `isTauriEnv` 守卫来源
- `src/hooks/useSubtitleSettings.ts` — 字幕设置的持久化与 `subtitle-settings-changed` 广播（页面级 hook）
- `src/hooks/useSubtitleWindow.ts` — 主窗口控制字幕悬浮窗显隐（`subtitle-visibility`）及实时设置同步（`subtitle-settings-sync`）
- `src/hooks/useTauriListeners.ts` — 全局 `asr-result` / `log-message` 事件监听，在 App 根和字幕窗口均挂载
- `src-tauri/src/app_state.rs` — `OnceLock<AppHandle>` 全局存储
- `src-tauri/src/logger.rs` — 自定义 log 后端，将日志通过 `log-message` 事件转发前端
- `src/context/` — 已迁移至 Zustand；`AsrContext.tsx` / `LogsContext.tsx` 仅保留类型重导出，`EnvironmentContext.tsx` 仍在使用

---

## 开发命令

```bash
# 带 Tauri 环境运行（所有 Tauri API 功能必须使用此命令）
pnpm tauri dev

# 仅前端（无 Tauri IPC，功能受限）
pnpm dev

# 构建发布版本
pnpm tauri build
```

---

## 命名规范

| 对象 | 规范 | 示例 |
|---|---|---|
| React 组件 | PascalCase | `ModelConfigPage`、`CustomSelect` |
| 页面文件名 | `{功能名}Page.tsx` | `AudioSourceSettingsPage.tsx` |
| Store 文件 | `{名称}Store.ts` | `subtitleSettingsStore.ts` |
| Store Hook | `use{名称}Store()` | `useSubtitleSettingsStore()` |
| 业务 Hook | `use{功能}()` | `useSubtitleSettings()` |
| TypeScript 类型/接口 | PascalCase | `AsrResultMessage`、`AudioDevice` |
| 常量 | SCREAMING_SNAKE_CASE | `DEFAULT_SETTINGS`、`STORE_FILE` |
| React 函数/变量 | camelCase | `handleStartAudioCapture` |
| Rust 模块/文件 | snake_case | `audio_capture.rs`、`app_state.rs` |
| Rust 函数/变量 | snake_case | `get_audio_devices`、`is_recording` |
| Tauri 命令名 | snake_case | `start_audio_capture` |
| Tauri 事件名 | kebab-case | `asr-result`、`subtitle-settings-changed` |

---

## 前端开发规范

### 状态管理（Zustand）

- 全局状态用 Zustand store，每个功能域一个文件（`src/store/`）。
- Store 只负责**单个 Webview 内**的内存状态，**持久化逻辑放在业务 hook 中**，不在 store 里用 `persist` middleware。
- 读取 store：`useXxxStore()` selector 或 `useXxxStore.getState()`（在非 hook 上下文中）。
- 更新 store：通过 `store.setState()` 或 store 内定义的 action。
- **Zustand 实例不能跨 Webview 共享**——多窗口间的数据同步必须通过 Tauri Event，见下方《多窗口数据架构》章节。

### 业务 Hook

- 封装 Tauri 交互和副作用，让页面保持薄。
- 必须用 `isTauriEnv` 守卫所有 Tauri API 调用（`useEnvironmentStore((s) => s.isTauriEnv)`）。
- `useEffect` 中注册的 Tauri 事件监听器，**必须**在返回的清理函数中取消订阅（`unlisten.then(fn => fn())`）。

### 页面组件

- 页面是 store/hook 的薄消费层，**不要**在页面里直接调用 Tauri `invoke`，统一通过 hook 方法调用。
- 页面内容使用统一的容器结构：

```tsx
<div className="w-full max-w-5xl mx-auto space-y-6">
  {/* 内容区 */}
</div>
```

### 添加 shadcn/ui 组件

```bash
pnpm dlx shadcn@latest add <组件名>
```

组件会生成至 `src/components/ui/`，统一通过 `@/components/ui/<名称>` 导入。

### 路径别名

`@/` 映射到 `src/`，`src/` 内部的导入**必须**使用此别名。

---

## 字幕窗口架构

应用有两个独立 Webview 窗口：主窗口（`main`）和字幕悬浮窗（`subtitle-overlay`）。

### 数据流

```
主窗口
  ├─ useSubtitleSettings()        ← SubtitleSettingsPage 调用
  │    ├─ 读取：tauri-plugin-store → 初始化 Zustand store
  │    ├─ 写入：updateSetting(key, value)
  │    │    ├─ 更新 Zustand store（同步）
  │    │    ├─ 保存到 subtitle_settings.json（tauri-plugin-store）
  │    │    └─ emit('subtitle-settings-changed', newSettings)
  │    └─ resetSettings() 同理
  └─ useSubtitleWindow()          ← App 根挂载
       ├─ enabled 变化 → emitTo('subtitle-overlay', 'subtitle-visibility', { show })
       │    字幕窗口收到后自行调用 getCurrentWindow().show() / .hide()
       └─ enabled=true 时同步推送最新设置：
            emitTo('subtitle-overlay', 'subtitle-settings-sync', settings)

字幕窗口（subtitle-main.tsx）
  ├─ 启动时：load('subtitle_settings.json') → useSubtitleSettingsStore.setState()
  │           enabled=true → getCurrentWindow().show()
  ├─ listen('subtitle-settings-changed') → useSubtitleSettingsStore.setState(payload)
  ├─ listen('subtitle-settings-sync')    → useSubtitleSettingsStore.setState(payload)
  ├─ listen('subtitle-visibility')       → getCurrentWindow().show() / .hide()
  ├─ listen('asr-session-reset')         → useAsrStore.getState().clearAsrResults()
  │    ↑ 新会话开始时主窗口发出，字幕窗口清除旧结果（begin_time 从 0 重新计时）
  └─ subscribe(store) → windowX/Y 变化时回写到 subtitle_settings.json

SubtitleOverlay.tsx（字幕窗口内）
  ├─ useSubtitleSettingsStore()   ← 读取实时状态
  ├─ useEffect([locked]) → getCurrentWindow().setIgnoreCursorEvents(locked)
  └─ 将设置转换为内联样式（bubbleStyle、textStyle 等）
```

### 事件总线

| 事件名 | 方向 | 载荷 | 用途 |
|---|---|---|---|
| `subtitle-settings-changed` | 主窗口 → 字幕窗口 | `SubtitleSettings` | 设置变更时全量同步（`emit` 广播） |
| `subtitle-settings-sync` | 主窗口 → 字幕窗口 | `SubtitleSettings` | 字幕窗口显示时主动推送最新设置（`emitTo`） |
| `subtitle-visibility` | 主窗口 → 字幕窗口 | `{ show: boolean }` | 控制字幕窗口自身调用 show/hide（`emitTo`） |
| `asr-session-reset` | 主窗口 → 字幕窗口 | — | 新录音会话开始，字幕窗口清除旧 ASR 结果 |
| `asr-result` | Rust → 前端 | `AsrResultMessage` | 识别结果推送 |
| `log-message` | Rust → 前端 | `LogMessage` | 日志推送 |

### 字幕设置持久化

- 文件：`subtitle_settings.json`（存储在 Tauri 默认 appData 目录）
- 两个窗口都读同一个文件，主窗口负责写入。
- `windowX` / `windowY` 由字幕窗口在 `onMoved` 时写回。

---

## 样式规范（Tailwind CSS v4）

- 只使用 Tailwind 工具类；仅在动态计算值时使用内联 style。
- 设计 token 定义在 `src/index.css`，以 CSS 自定义属性形式存在（`--color-*`、`--radius-*`）。
- 颜色空间：所有主题色使用 OKLCH。
- 条件类合并使用 `cn()`（来自 `@/lib/utils`）。

**卡片标准写法：**
```tsx
<div className="border border-slate-200/80 bg-white shadow-[0_2px_12px_rgba(15,23,42,0.03)] rounded-2xl p-6">
```

**输入框标准写法：**
```tsx
<input className="w-full rounded-xl border border-slate-200 bg-slate-50/50 px-4 py-2.5 text-sm
  focus:outline-none focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500
  transition-all placeholder:text-slate-400" />
```

**按钮：** 使用 shadcn `<Button>` 的 variant（`default`、`outline`、`ghost`、`destructive`）。

**图标大小：** Lucide 图标在按钮内默认 `size={16}`，独立使用时 `size={18}`。

---

## Tauri IPC 规范

- 前端调用命令：`invoke<T>('command_name', { param })` — 来自 `@tauri-apps/api/core`
- 前端监听事件：`listen<T>('event-name', handler)` — 来自 `@tauri-apps/api/event`，组件卸载时调用返回的 `unlisten()`
- 跨窗口广播：`emit('event-name', payload)` — 来自 `@tauri-apps/api/event`
- Rust 命令：`#[tauri::command] async fn my_cmd(...) -> Result<T, String>`，在 `main.rs` 的 `generate_handler![]` 中注册
- Rust 发事件：`get_app_handle().emit("event-name", &payload).ok()`

---

## 设置持久化规范

| 设置类型 | 存储方式 | 说明 |
|---|---|---|
| 字幕样式/行为设置 | `@tauri-apps/plugin-store` | `subtitle_settings.json`，双窗口共享 |
| 其他用户设置 | `localStorage` | key 用 SCREAMING_SNAKE_CASE，定义在 store/hook 文件顶部 |

**tauri-plugin-store 使用要点：**
- `load()` 时必须传 `defaults`（`StoreOptions` 要求）、`autoSave: false`
- 写入后需手动调用 `store.save()`
- 缓存 store 实例避免重复打开文件（参考 `useSubtitleSettings.ts` 中的 `getStore()` 模式）

---

## Rust 开发规范

- 业务逻辑内部使用 `anyhow::Result`；仅在命令边界处转换为 `Result<T, String>`。
- 音频采集、网络等阻塞操作使用 `tokio::spawn` 放入后台任务。
- 单次初始化的全局变量使用 `OnceLock`（如 `AppHandle`）。
- 简单的并发标志使用 `AtomicBool` 而非 `Mutex`（如 `IS_RECORDING`），性能更好。
- 日志使用标准 `log` 宏：`log::info!`、`log::warn!`、`log::error!`。
  `logger.rs` 中的自定义后端会将所有日志通过 `log-message` 事件转发至前端。
- 向前端返回结构化错误时，序列化为 JSON 字符串，前端可解析后展示具体提示。
- 新增 Tauri 插件时，在 `Cargo.toml` 添加 crate，并在 `main.rs` 的 `builder` 链上注册 `.plugin(...)`。

### macOS 字幕悬浮窗（NSPanel）

字幕窗口在 macOS 上通过 `tauri_nspanel` 转换为 NSPanel，确保：
- 浮于所有普通窗口之上（`PanelLevel::Floating`）
- 不抢夺键盘焦点（`can_become_key_window: false`、`NonactivatingPanel`）
- 跨 Space 显示、全屏兼容（`can_join_all_spaces` + `full_screen_auxiliary`）
- 完全透明背景（`set_background_color(Some(Color(0,0,0,0)))`）

在 `main.rs` 的 `setup` 回调中 `#[cfg(target_os = "macos")]` 块内配置，非 macOS 走 `set_always_on_top` 方案。

---

## TypeScript 规范

- 已开启 `strict: true`，**不允许**隐式 `any`。
- 对象形状优先用 `interface`，联合类型/别名用 `type`。
- **不加分号**（Prettier 配置：`"semi": false`）。
- 每行最长 100 字符。
- 字符串使用单引号。

---

## 核心数据类型

```ts
// Rust 发出的 ASR 识别结果
interface AsrResultMessage {
  sentence_id: number
  begin_time: number
  end_time?: number
  text: string
  is_final: boolean
  kind: 'transcription' | 'translation'
  lang?: string
}

// Rust logger 发出的日志消息
interface LogMessage {
  level: 'DEBUG' | 'INFO' | 'WARN' | 'ERROR'
  message: string
  target: string
  timestamp: string
}

// Rust 返回的音频设备
interface AudioDevice {
  name: string
  is_loopback: boolean
}

// 字幕设置（subtitleSettingsStore.ts）
interface SubtitleSettings {
  enabled: boolean
  locked: boolean
  stylePreset: 'apple' | 'netflix' | 'youtube'
  fontSize: number
  fontColor: string
  backgroundColor: string
  backgroundOpacity: number
  fontFamily: string
  fontWeight: 'normal' | 'bold'
  fontStyle: 'normal' | 'italic'
  borderRadius: 'none' | 'small' | 'medium' | 'pill'
  windowX: number | null
  windowY: number | null
}
```

---

## ESLint 规范

- `import/order` 强制执行导入顺序：React → 第三方库 → 内部模块（`@/`） → 相对路径。
- 禁止未使用变量（用 `_` 前缀屏蔽警告）。
- `react-refresh/only-export-components`：组件文件中不要导出非组件内容。
- 检查命令：`pnpm lint`

---

## 代码改动工作流

**在执行任何代码改动之前**，必须先列出改动计划（TODO 清单），等待用户确认后再动手。

格式：
```
计划改动：
1. <文件路径> — <改动内容一句话描述>
2. ...

确认后开始执行？
```

以下情况不需要确认，可直接执行：
- 用户已在消息中明确说明"直接改"、"去做"等意图
- 只涉及单个文件的单处小修改（如改一个变量名、修正拼写）

---

## 重要注意事项

- **所有 Tauri API 调用必须用 `isTauriEnv` 守卫** — 应用可能在纯浏览器环境下运行（UI 开发时）。
- **字幕设置持久化使用 `tauri-plugin-store`**（`subtitle_settings.json`），不用 localStorage。
  其他设置（ASR 配置等）仍用 localStorage。
- 日志缓冲上限为 **500 条**，超出后丢弃旧条目。
- ASR 结果以 `sentence_id` 为键进行原地更新，实现流式转写的实时刷新效果。
- 新增页面后，需在 `src/App.tsx` 注册路由，并在 `src/layouts/AppLayout.tsx` 的 `MENU_ITEMS` 中添加导航入口。
- `subtitle-main.tsx` 是独立入口，通过 `subtitle-overlay.html` 加载，**不共享** `main.tsx` 的 Provider 树。
- `useSubtitleSettings()` 设计为在 `SubtitleSettingsPage` 内调用（页面级 hook），
  不需要在 App 根部挂载。字幕窗口自行从 store 文件加载设置，无需主窗口推送初始值。
