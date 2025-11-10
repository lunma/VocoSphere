# ASR 模型配置系统

## 概述

本系统支持从前端传递 Gummy 和 Paraformer 两种 ASR 模型的配置参数，并在应用重启后自动回显已保存的配置。

## 功能特性

### 1. 模型选择
- **Gummy 模型**：支持实时语音识别和翻译功能
- **Paraformer 模型**：高准确率，专注于语音识别

### 2. 配置持久化
- 配置信息保存在浏览器的 `localStorage` 中
- 应用重启后自动加载上次的配置
- 配置变更实时保存

## Gummy 模型配置项

| 配置项 | 类型 | 默认值 | 说明 |
|--------|------|--------|------|
| `source_language` | string | "zh" | 源语言（zh/en/ja/ko/de/fr/ru等） |
| `language_hints` | string[] | - | 语言提示列表（可选） |
| `translation_enabled` | boolean | false | 是否启用翻译功能 |
| `translation_target_languages` | string[] | [] | 翻译目标语言列表 |
| `vocabulary_id` | string | - | 定制热词ID（可选） |
| `punctuation_prediction_enabled` | boolean | true | 标点符号预测 |
| `itn_enabled` | boolean | true | 逆文本正则化（ITN） |

### Gummy 模型特点
- ✅ 支持实时语音识别
- ✅ 支持实时翻译功能
- ✅ 支持多语言识别
- ✅ 支持标点符号预测和ITN
- ✅ 支持定制热词

## Paraformer 模型配置项

| 配置项 | 类型 | 默认值 | 说明 |
|--------|------|--------|------|
| `source_language` | string | "zh" | 源语言（zh/en/ja/ko/de/fr/ru等） |
| `language_hints` | string[] | - | 语言提示列表（可选） |
| `vocabulary_id` | string | - | 定制热词ID（可选） |
| `disfluency_removal_enabled` | boolean | false | 不流畅词过滤（如：嗯、啊等语气词） |
| `punctuation_prediction_enabled` | boolean | true | 标点符号预测 |
| `itn_enabled` | boolean | true | 逆文本正则化（ITN） |
| `dialect` | string | - | 方言设置（可选） |
| `emotion_enabled` | boolean | false | 情感识别（部分模型支持） |

### Paraformer 模型特点
- ✅ 高准确率，性能优秀
- ✅ 支持多语言和方言识别
- ✅ 支持不流畅词过滤
- ✅ 支持标点符号预测和ITN
- ✅ 部分模型支持情感识别
- ❌ **不支持翻译功能**

## 使用方法

### 前端使用

1. **选择模型**：点击 "Gummy" 或 "Paraformer" 按钮选择模型
2. **配置参数**：根据模型类型填写不同的配置信息
3. **启动识别**：配置会自动保存并传递给后端

```tsx
import AsrConfig, { AsrModelConfig } from './components/AsrConfig'

function App() {
  const [asrConfig, setAsrConfig] = useState<AsrModelConfig | null>(null)

  const handleStartCapture = async () => {
    if (!asrConfig) {
      console.error('配置尚未加载')
      return
    }
    
    await invoke('start_audio_capture', { config: asrConfig })
  }

  return (
    <>
      <AsrConfig onConfigChange={setAsrConfig} />
      <button onClick={handleStartCapture}>启动识别</button>
    </>
  )
}
```

### 后端使用

配置会通过 Tauri 的 `invoke` 命令传递到 Rust 后端：

```rust
#[tauri::command]
pub async fn start_audio_capture(config: crate::asr::config::AsrModelConfig) 
    -> Result<String, String> 
{
    match config {
        AsrModelConfig::Gummy(gummy_config) => {
            asr::websocket::start_gummy_asr(Some(rx), gummy_config).await;
        }
        AsrModelConfig::Paraformer(paraformer_config) => {
            asr::websocket::start_paraformer_asr(Some(rx), paraformer_config).await;
        }
    }
    Ok("音频捕获已启动".to_string())
}
```

## 配置数据结构

### Rust 后端

```rust
// src-tauri/src/asr/config.rs

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(tag = "type")]
pub enum AsrModelConfig {
    #[serde(rename = "gummy")]
    Gummy(GummyConfig),
    #[serde(rename = "paraformer")]
    Paraformer(ParaformerConfig),
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct GummyConfig {
    pub source_language: String,
    pub translation_enabled: bool,
    // ... 其他配置项
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ParaformerConfig {
    pub source_language: String,
    pub disfluency_removal_enabled: bool,
    // ... 其他配置项
}
```

### TypeScript 前端

```typescript
// src/components/AsrConfig.tsx

export interface GummyConfig {
  type: 'gummy'
  source_language: string
  translation_enabled: boolean
  // ... 其他配置项
}

export interface ParaformerConfig {
  type: 'paraformer'
  source_language: string
  disfluency_removal_enabled: boolean
  // ... 其他配置项
}

export type AsrModelConfig = GummyConfig | ParaformerConfig
```

## 配置存储

配置保存在浏览器的 `localStorage` 中，键名为 `asr_model_config`。

示例配置（JSON）：

```json
{
  "type": "gummy",
  "source_language": "zh",
  "translation_enabled": true,
  "translation_target_languages": ["en"],
  "punctuation_prediction_enabled": true,
  "itn_enabled": true
}
```

## 注意事项

1. **配置验证**：前端会在启动识别前检查配置是否已加载
2. **类型安全**：使用 TypeScript 和 Rust 的类型系统确保配置正确
3. **向后兼容**：保留了旧版接口（已标记为 deprecated）
4. **配置回显**：应用启动时自动从 localStorage 加载配置
5. **实时保存**：任何配置更改都会立即保存到 localStorage

## 故障排查

### 配置未生效

1. 检查浏览器控制台是否有错误
2. 检查 localStorage 中的 `asr_model_config` 是否正确
3. 确认配置已通过 `onConfigChange` 回调传递

### 配置丢失

- 配置保存在 localStorage 中，清除浏览器缓存会导致配置丢失
- 可以手动备份 localStorage 中的配置数据

### 类型不匹配

- 确保前后端的配置类型定义一致
- 检查 serde 序列化配置（特别是 `#[serde(tag = "type")]`）

## 相关文件

### 后端
- `src-tauri/src/asr/config.rs` - 配置数据结构定义
- `src-tauri/src/audio_capture.rs` - 音频捕获命令（接收配置）
- `src-tauri/src/asr/websocket/mod.rs` - ASR WebSocket 启动函数
- `src-tauri/src/asr/websocket/gummy/impl_.rs` - Gummy 模型实现
- `src-tauri/src/asr/websocket/paraformer/impl_.rs` - Paraformer 模型实现

### 前端
- `src/components/AsrConfig.tsx` - 配置组件
- `src/App.tsx` - 主应用（集成配置组件）

## 未来改进

- [ ] 支持导入/导出配置
- [ ] 支持多配置预设管理
- [ ] 添加配置验证和错误提示
- [ ] 支持从后端获取模型能力并动态显示配置项
- [ ] 添加配置重置功能

