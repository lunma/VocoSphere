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

## 项目结构

```
src/
  App.tsx                 # React Router 路由配置 + 全局 hook 挂载点
  main.tsx                # 主窗口入口
  subtitle-main.tsx       # 字幕悬浮窗入口（独立 webview）
  index.css               # Tailwind 指令 + OKLCH 主题 token
  subtitle.css            # 字幕窗口专用样式（透明背景等）
  store/
    environmentStore.ts   # 检测是否处于 Tauri 环境（isTauriEnv）
    asrStore.ts           # ASR 配置、设备列表、采集状态、识别结果
    logsStore.ts          # 日志流（上限 500 条）
    subtitleSettingsStore.ts  # 字幕设置 Zustand store（纯内存，持久化由 hook 负责）
  hooks/
    useTauriListeners.ts  # useAsrListener、useLogsListener（全局事件订阅）
    useSubtitleSettings.ts  # 字幕设置 hook：读写 plugin-store + 广播事件 + 窗口控制
  layouts/
    AppLayout.tsx          # 侧边栏 + 顶栏主布局
  pages/
    ModelConfigPage.tsx
    AudioSourceSettingsPage.tsx
    SubtitleSettingsPage.tsx  # 使用 useSubtitleSettings()
    LogsPage.tsx
  components/
    ui/                   # shadcn/ui 基础组件（Button、Card、Input 等）
    SubtitleOverlay.tsx   # 字幕渲染组件（字幕悬浮窗内使用）
    CustomSelect.tsx      # 自定义下拉选择器
  lib/
    utils.ts              # cn() 工具函数（tailwind-merge + clsx）

src-tauri/src/
  main.rs                 # Tauri 构建器 + 命令注册（含 tauri-plugin-store 注册）
  app_state.rs            # OnceLock<AppHandle> 全局存储
  logger.rs               # 自定义 log 后端 — 向前端发送 "log-message" 事件
  audio_capture.rs        # Tauri 命令：get_audio_devices、start/stop_audio_capture
  audio/
    mod.rs                # AudioDevice 结构体、设备枚举
    processor.rs          # 重采样管线（cpal → rubato）
  asr/
    mod.rs                # 协议分发（Gummy / Paraformer）
    gummy.rs              # Gummy WebSocket 客户端
    paraformer.rs         # Paraformer WebSocket 客户端
```

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
- `useEffect` 中注册的 Tauri 事件监听器，**必须**在返回的清理函数中取消订阅。

```tsx
useEffect(() => {
  if (!isTauriEnv) return
  const unlisten = listen<MyPayload>('my-event', (event) => {
    useMyStore.getState().setData(event.payload)
  })
  return () => { unlisten.then(fn => fn()) }
}, [isTauriEnv])
```

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
  └─ useSubtitleSettings()        ← SubtitleSettingsPage 调用
       ├─ 读取：tauri-plugin-store → 初始化 Zustand store
       ├─ 写入：updateSetting(key, value)
       │    ├─ 更新 Zustand store（同步）
       │    ├─ 保存到 subtitle_settings.json（tauri-plugin-store）
       │    ├─ emit('subtitle-settings-changed', newSettings)
       │    └─ enabled 切换 → WebviewWindow.show() / .hide()
       └─ resetSettings() 同理

字幕窗口（subtitle-main.tsx）
  ├─ 启动时：load('subtitle_settings.json') → useSubtitleSettingsStore.setState()
  │           enabled=true → getCurrentWindow().show()
  ├─ listen('subtitle-settings-changed') → useSubtitleSettingsStore.setState(payload)
  └─ subscribe(store) → windowX/Y 变化时回写到 subtitle_settings.json

SubtitleOverlay.tsx（字幕窗口内）
  ├─ useSubtitleSettingsStore()   ← 读取实时状态
  ├─ useEffect([locked]) → getCurrentWindow().setIgnoreCursorEvents(locked)
  └─ 将设置转换为内联样式（bubbleStyle、textStyle 等）
```

### 事件总线

| 事件名 | 方向 | 载荷 | 用途 |
|---|---|---|---|
| `subtitle-settings-changed` | 主窗口 → 字幕窗口 | `SubtitleSettings` | 实时同步全量设置 |
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

### 前端调用命令

```ts
import { invoke } from '@tauri-apps/api/core'

const result = await invoke<返回类型>('command_name', { param: value })
```

### 前端监听事件

```ts
import { listen } from '@tauri-apps/api/event'

const unlisten = await listen<PayloadType>('event-name', (event) => {
  console.log(event.payload)
})
// 组件卸载时调用 unlisten()
```

### 跨窗口广播事件

```ts
import { emit } from '@tauri-apps/api/event'

// 广播给所有窗口
emit('event-name', payload)
```

### Rust 定义命令

```rust
#[tauri::command]
async fn my_command(param: String) -> Result<String, String> {
    do_something(param).await.map_err(|e| e.to_string())
}
```

在 `main.rs` 中注册：
```rust
.invoke_handler(tauri::generate_handler![my_command])
```

### Rust 发送事件到前端

```rust
use crate::app_state::get_app_handle;

let app = get_app_handle();
app.emit("my-event", &payload).ok();
```

---

## 设置持久化规范

| 设置类型 | 存储方式 | 说明 |
|---|---|---|
| 字幕样式/行为设置 | `@tauri-apps/plugin-store` | `subtitle_settings.json`，双窗口共享 |
| 其他用户设置 | `localStorage` | key 用 SCREAMING_SNAKE_CASE，定义在 store/hook 文件顶部 |

**tauri-plugin-store 使用模式：**

```ts
import { load } from '@tauri-apps/plugin-store'

// defaults 必须提供（StoreOptions 要求）
const store = await load('myfile.json', {
  autoSave: false,
  defaults: MY_DEFAULTS as unknown as Record<string, unknown>,
})

await store.set('key', value)
await store.save()          // autoSave: false 时必须手动调用

const val = await store.get<MyType>('key')
```

缓存 store 实例避免重复打开文件（参考 `useSubtitleSettings.ts` 中的 `getStore()` 模式）。

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
