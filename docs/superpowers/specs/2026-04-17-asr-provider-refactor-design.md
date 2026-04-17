# ASR Provider 重构设计

**日期：** 2026-04-17  
**状态：** 已批准，待实施

---

## 背景

当前后端 ASR 代码直接耦合 WebSocket 协议（Gummy / Paraformer），缺乏统一抽象。需要：

1. 抽象 `AsrProvider` trait，区分本地（`LocalAsrProvider`）和云端（`CloudAsrProvider`）
2. 区分两种识别模式：**流式识别**（实时麦克风）和**文件识别**（录音文件）
3. 文件识别使用阿里云 Fun-ASR RESTful API（异步批量），结果写出为 SRT 字幕文件

---

## Provider Trait

```rust
#[async_trait]
pub trait AsrProvider: Send + Sync {
    /// 流式识别：消费音频 channel，实时推送 asr-result 事件到前端
    async fn recognize_stream(
        &self,
        rx: tokio::sync::mpsc::Receiver<Vec<f32>>,
    ) -> anyhow::Result<()>;

    /// 文件识别：上传文件 → 调用 Fun-ASR API → 写 SRT → 返回完整结果
    async fn recognize_file(
        &self,
        input_path: &std::path::Path,
        output_path: &std::path::Path,
    ) -> anyhow::Result<Vec<crate::asr::events::AsrResultEvent>>;
}
```

- `recognize_stream`：结果通过 `asr-result` Tauri 事件实时推送前端（不变）
- `recognize_file`：同步返回完整 `Vec<AsrResultEvent>`，前端收到后整体渲染；同时写出 SRT 文件

---

## 模块结构

```
src-tauri/src/asr/
├── mod.rs               — AsrProvider trait 定义 + 重导出
├── config.rs            — 所有配置类型（见下）
├── events.rs            — 不变（AsrResultEvent, ASR_RESULT_EVENT）
├── provider/
│   ├── mod.rs           — 导出两个 provider
│   ├── cloud.rs         — CloudAsrProvider 实现
│   └── local.rs         — LocalAsrProvider（todo!()）
├── websocket/           — 不变（cloud.rs 内部用于流式识别）
└── subtitle/
    └── srt.rs           — SRT 序列化工具
```

新增 Tauri 命令文件：

```
src-tauri/src/
└── file_recognition.rs  — recognize_file Tauri 命令
```

---

## Config 层级

```rust
/// 顶层 Provider 配置（前端传入 Tauri 命令）
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(tag = "type")]
pub enum AsrProviderConfig {
    #[serde(rename = "local")]
    Local(LocalAsrConfig),
    #[serde(rename = "cloud")]
    Cloud(CloudAsrConfig),
}

/// 云端 Provider 配置
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CloudAsrConfig {
    /// 流式识别模型配置（Gummy 或 Paraformer）
    pub streaming: CloudStreamingConfig,
    /// OSS 上传配置（用于文件识别）
    pub oss: OssConfig,
    /// 文件识别 API Key（DashScope，可与流式共用）
    pub file_asr_api_key: String,
}

/// 流式识别模型（原 AsrModelConfig 改名）
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(tag = "type")]
pub enum CloudStreamingConfig {
    #[serde(rename = "gummy")]
    Gummy(GummyConfig),
    #[serde(rename = "paraformer")]
    Paraformer(ParaformerConfig),
}

/// OSS 配置
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct OssConfig {
    pub endpoint: String,        // e.g. "https://oss-cn-beijing.aliyuncs.com"
    pub bucket: String,
    pub access_key_id: String,
    pub access_key_secret: String,
}

/// 本地 Provider 配置（占位）
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct LocalAsrConfig {
    // todo: 本地模型路径等，待确定具体模型后填充
}
```

---

## CloudAsrProvider 实现

### 流式识别（`recognize_stream`）

委托给现有 `asr::websocket` 模块，按 `CloudStreamingConfig` 分发：

```
recognize_stream(rx)
  match streaming_config
    Gummy   → websocket::gummy::start_with_config(Some(rx), gummy_config)
    Paraformer → websocket::paraformer::start_with_config(Some(rx), paraformer_config)
```

### 文件识别（`recognize_file`）

使用 Fun-ASR RESTful API（阿里云百炼）：

```
recognize_file(input_path, output_path)
  1. OssClient::upload(input_path, oss_config) → public_url
  2. POST https://dashscope.aliyuncs.com/api/v1/services/audio/asr/transcription
       headers: Authorization: Bearer {api_key}
                Content-Type: application/json
                X-DashScope-Async: enable
       body: { model: "fun-asr", input: { file_urls: [public_url] } }
     → task_id
  3. 轮询 GET /api/v1/tasks/{task_id}（间隔 3s）
       PENDING/RUNNING → 继续等待
       FAILED          → 返回错误
       SUCCEEDED       → transcription_url
  4. GET transcription_url → 解析 transcripts[0].sentences
  5. sentences → 映射为 Vec<AsrResultEvent>（is_final: true）
  6. SrtWriter::write(sentences, output_path)
  7. 返回 Vec<AsrResultEvent>
```

**Fun-ASR 识别结果数据结构：**

```json
{
  "transcripts": [{
    "channel_id": 0,
    "text": "全文",
    "sentences": [{
      "text": "句子文本",
      "begin_time": 100,
      "end_time": 3820
    }]
  }]
}
```

---

## Tauri 命令

### 现有命令（`audio_capture.rs`）

```rust
// config 类型从 AsrModelConfig 改为 AsrProviderConfig
#[tauri::command]
pub async fn start_audio_capture(
    config: AsrProviderConfig,
    device_name: Option<String>,
) -> Result<String, String>

#[tauri::command]
pub fn stop_audio_capture() -> Result<String, String>
```

### 新增命令（`file_recognition.rs`）

```rust
#[tauri::command]
pub async fn recognize_file(
    config: AsrProviderConfig,
    input_path: String,
    output_path: String,
) -> Result<Vec<AsrResultEvent>, String>
```

---

## SRT 格式

只有 `is_final: true` 的 sentence 写入 SRT。`end_time` 为 None 时，用 `begin_time + 2000ms` 作为保底。

```
1
00:00:01,200 --> 00:00:03,820
你好，欢迎使用 VocoSphere

2
00:00:04,100 --> 00:00:06,500
这是第二句话
```

---

## LocalAsrProvider

```rust
pub struct LocalAsrProvider {
    config: LocalAsrConfig,
}

#[async_trait]
impl AsrProvider for LocalAsrProvider {
    async fn recognize_stream(&self, _rx: Receiver<Vec<f32>>) -> anyhow::Result<()> {
        todo!("本地 ASR 流式识别待实现")
    }

    async fn recognize_file(&self, _input: &Path, _output: &Path) -> anyhow::Result<Vec<AsrResultEvent>> {
        todo!("本地 ASR 文件识别待实现")
    }
}
```

---

## 不改动的部分

- `asr/websocket/` 目录全部保持不变
- `asr/events.rs` 不变
- `audio/` 模块不变
- `audio_capture.rs` 中 `stop_audio_capture`、`get_audio_devices`、音频处理逻辑不变
- 前端代码不在本次重构范围内（前端 config 结构调整另行处理）
