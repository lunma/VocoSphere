# ASR Provider 重构实施计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 重构后端 ASR 代码，引入 `AsrProvider` trait 抽象本地/云端 provider，区分流式识别（实时麦克风）和文件识别（Fun-ASR RESTful API），文件识别结果写出 SRT 字幕文件。

**Architecture:** `AsrProvider` trait 定义两个方法：`recognize_stream`（流式，保留现有 WebSocket 路径）和 `recognize_file`（文件，走 OSS 上传 + Fun-ASR 异步 API）。`CloudAsrProvider` 实现两者，`LocalAsrProvider` 占位 `todo!()`。新增独立 Tauri 命令 `recognize_file`，返回完整 `Vec<AsrResultEvent>` 并落盘 SRT。

**Tech Stack:** Rust, async-trait 0.1, reqwest 0.12, hmac 0.12, sha1 0.10, base64 0.22, chrono（已有），tempfile（dev，测试用）

**Spec:** `docs/superpowers/specs/2026-04-17-asr-provider-refactor-design.md`

---

## 文件变更总览

| 操作 | 路径 | 职责 |
|---|---|---|
| 修改 | `src-tauri/Cargo.toml` | 添加新依赖 |
| 修改 | `src-tauri/src/asr/config.rs` | 重构配置类型 |
| 修改 | `src-tauri/src/asr/mod.rs` | 定义 AsrProvider trait |
| 修改 | `src-tauri/src/asr/websocket/mod.rs` | 更新函数签名 |
| 新建 | `src-tauri/src/asr/subtitle/mod.rs` | 字幕子模块入口 |
| 新建 | `src-tauri/src/asr/subtitle/srt.rs` | SRT 序列化 |
| 新建 | `src-tauri/src/asr/provider/mod.rs` | Provider 子模块入口 |
| 新建 | `src-tauri/src/asr/provider/local.rs` | LocalAsrProvider |
| 新建 | `src-tauri/src/asr/provider/cloud.rs` | CloudAsrProvider |
| 新建 | `src-tauri/src/file_recognition.rs` | recognize_file 命令 |
| 修改 | `src-tauri/src/audio_capture.rs` | 更新 config 类型和调用方式 |
| 修改 | `src-tauri/src/main.rs` | 注册新命令 |

---

### Task 1: 添加依赖

**Files:**
- Modify: `src-tauri/Cargo.toml`

- [ ] **Step 1: 在 `[dependencies]` 末尾追加**

```toml
async-trait = "0.1"
reqwest = { version = "0.12", features = ["json"] }
hmac = "0.12"
sha1 = "0.10"
base64 = "0.22"
```

在 `[profile.release]` 之前插入：
```toml
[dev-dependencies]
tempfile = "3"
```

- [ ] **Step 2: 验证编译**

Run: `cd src-tauri && cargo check`
Expected: 通过（新增 crate 解析成功）

- [ ] **Step 3: Commit**

```bash
git add src-tauri/Cargo.toml
git commit -m "chore: add async-trait, reqwest, hmac, sha1, base64 dependencies"
```

---

### Task 2: 重构 asr/config.rs

**Files:**
- Modify: `src-tauri/src/asr/config.rs`

- [ ] **Step 1: 先写失败测试**

在 `src-tauri/src/asr/config.rs` 底部添加：

```rust
#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_provider_config_roundtrip_cloud() {
        let config = AsrProviderConfig::Cloud(CloudAsrConfig {
            streaming: CloudStreamingConfig::Gummy(GummyConfig::default()),
            oss: OssConfig {
                endpoint: "oss-cn-beijing.aliyuncs.com".to_string(),
                bucket: "my-bucket".to_string(),
                access_key_id: "key_id".to_string(),
                access_key_secret: "key_secret".to_string(),
            },
            file_asr_api_key: "sk-xxx".to_string(),
        });
        let json = serde_json::to_string(&config).unwrap();
        let _: AsrProviderConfig = serde_json::from_str(&json).unwrap();
    }

    #[test]
    fn test_provider_config_roundtrip_local() {
        let config = AsrProviderConfig::Local(LocalAsrConfig {});
        let json = serde_json::to_string(&config).unwrap();
        let _: AsrProviderConfig = serde_json::from_str(&json).unwrap();
    }
}
```

- [ ] **Step 2: 运行确认失败**

Run: `cd src-tauri && cargo test asr::config 2>&1 | head -5`
Expected: 编译失败（类型未定义）

- [ ] **Step 3: 用新实现替换整个文件**

完整替换 `src-tauri/src/asr/config.rs`：

```rust
use serde::{Deserialize, Serialize};

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
    /// 流式识别模型（Gummy 或 Paraformer）
    #[serde(default)]
    pub streaming: CloudStreamingConfig,
    /// OSS 上传配置（文件识别使用）
    #[serde(default)]
    pub oss: OssConfig,
    /// 文件识别 DashScope API Key
    #[serde(default = "default_api_key")]
    pub file_asr_api_key: String,
}

impl Default for CloudAsrConfig {
    fn default() -> Self {
        Self {
            streaming: CloudStreamingConfig::default(),
            oss: OssConfig::default(),
            file_asr_api_key: default_api_key(),
        }
    }
}

/// 流式识别模型选择（原 AsrModelConfig 改名）
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(tag = "type")]
pub enum CloudStreamingConfig {
    #[serde(rename = "gummy")]
    Gummy(GummyConfig),
    #[serde(rename = "paraformer")]
    Paraformer(ParaformerConfig),
}

impl Default for CloudStreamingConfig {
    fn default() -> Self {
        Self::Gummy(GummyConfig::default())
    }
}

/// OSS 上传配置
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct OssConfig {
    /// OSS endpoint host，如 oss-cn-beijing.aliyuncs.com
    #[serde(default = "default_oss_endpoint")]
    pub endpoint: String,
    #[serde(default)]
    pub bucket: String,
    #[serde(default)]
    pub access_key_id: String,
    #[serde(default)]
    pub access_key_secret: String,
}

impl Default for OssConfig {
    fn default() -> Self {
        Self {
            endpoint: default_oss_endpoint(),
            bucket: String::new(),
            access_key_id: String::new(),
            access_key_secret: String::new(),
        }
    }
}

/// 本地 Provider 配置（占位，待后续填充）
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct LocalAsrConfig {}

/// 服务器配置（WebSocket URL 和 API Key）
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ServerConfig {
    #[serde(default = "default_ws_url")]
    pub ws_url: String,
    #[serde(default = "default_api_key")]
    pub api_key: String,
}

impl Default for ServerConfig {
    fn default() -> Self {
        Self {
            ws_url: default_ws_url(),
            api_key: default_api_key(),
        }
    }
}

/// Gummy 模型配置
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct GummyConfig {
    #[serde(default)]
    pub server_config: ServerConfig,
    #[serde(default = "default_source_language")]
    pub source_language: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub language_hints: Option<Vec<String>>,
    #[serde(default)]
    pub translation_enabled: bool,
    #[serde(default)]
    pub translation_target_languages: Vec<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub vocabulary_id: Option<String>,
    #[serde(default = "default_true")]
    pub punctuation_prediction_enabled: bool,
    #[serde(default = "default_true")]
    pub itn_enabled: bool,
}

impl Default for GummyConfig {
    fn default() -> Self {
        Self {
            server_config: ServerConfig::default(),
            source_language: default_source_language(),
            language_hints: None,
            translation_enabled: false,
            translation_target_languages: vec![],
            vocabulary_id: None,
            punctuation_prediction_enabled: true,
            itn_enabled: true,
        }
    }
}

/// Paraformer 模型配置
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ParaformerConfig {
    #[serde(default)]
    pub server_config: ServerConfig,
    #[serde(default = "default_source_language")]
    pub source_language: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub language_hints: Option<Vec<String>>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub vocabulary_id: Option<String>,
    #[serde(default)]
    pub disfluency_removal_enabled: bool,
    #[serde(default = "default_true")]
    pub punctuation_prediction_enabled: bool,
    #[serde(default = "default_true")]
    pub itn_enabled: bool,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub dialect: Option<String>,
    #[serde(default)]
    pub emotion_enabled: bool,
}

impl Default for ParaformerConfig {
    fn default() -> Self {
        Self {
            server_config: ServerConfig::default(),
            source_language: default_source_language(),
            language_hints: None,
            vocabulary_id: None,
            disfluency_removal_enabled: false,
            punctuation_prediction_enabled: true,
            itn_enabled: true,
            dialect: None,
            emotion_enabled: false,
        }
    }
}

fn default_ws_url() -> String {
    "wss://dashscope.aliyuncs.com/api-ws/v1/inference/".to_string()
}

fn default_api_key() -> String {
    "sk-xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx".to_string()
}

fn default_source_language() -> String {
    "zh".to_string()
}

fn default_true() -> bool {
    true
}

fn default_oss_endpoint() -> String {
    "oss-cn-beijing.aliyuncs.com".to_string()
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_provider_config_roundtrip_cloud() {
        let config = AsrProviderConfig::Cloud(CloudAsrConfig {
            streaming: CloudStreamingConfig::Gummy(GummyConfig::default()),
            oss: OssConfig {
                endpoint: "oss-cn-beijing.aliyuncs.com".to_string(),
                bucket: "my-bucket".to_string(),
                access_key_id: "key_id".to_string(),
                access_key_secret: "key_secret".to_string(),
            },
            file_asr_api_key: "sk-xxx".to_string(),
        });
        let json = serde_json::to_string(&config).unwrap();
        let _: AsrProviderConfig = serde_json::from_str(&json).unwrap();
    }

    #[test]
    fn test_provider_config_roundtrip_local() {
        let config = AsrProviderConfig::Local(LocalAsrConfig {});
        let json = serde_json::to_string(&config).unwrap();
        let _: AsrProviderConfig = serde_json::from_str(&json).unwrap();
    }
}
```

- [ ] **Step 4: 运行测试**

Run: `cd src-tauri && cargo test asr::config`
Expected: 2 tests pass

- [ ] **Step 5: Commit**

```bash
git add src-tauri/src/asr/config.rs
git commit -m "refactor: rename AsrModelConfig→CloudStreamingConfig, add AsrProviderConfig/OssConfig/LocalAsrConfig"
```

---

### Task 3: 更新 asr/websocket/mod.rs

**Files:**
- Modify: `src-tauri/src/asr/websocket/mod.rs`

- [ ] **Step 1: 替换整个文件**

```rust
mod common;
pub mod gummy;
pub mod paraformer;

use crate::asr::config::{CloudStreamingConfig, GummyConfig, ParaformerConfig};

/// 统一的流式 ASR 启动接口，按 CloudStreamingConfig 分发
pub async fn start_asr_with_config(
    receiver: Option<tokio::sync::mpsc::Receiver<Vec<f32>>>,
    config: CloudStreamingConfig,
) {
    match config {
        CloudStreamingConfig::Gummy(c) => start_gummy_asr(receiver, c).await,
        CloudStreamingConfig::Paraformer(c) => start_paraformer_asr(receiver, c).await,
    }
}

/// 启动 Gummy ASR 服务
pub async fn start_gummy_asr(
    receiver: Option<tokio::sync::mpsc::Receiver<Vec<f32>>>,
    config: GummyConfig,
) {
    gummy::start_with_config(receiver, config).await;
}

/// 启动 Paraformer ASR 服务
pub async fn start_paraformer_asr(
    receiver: Option<tokio::sync::mpsc::Receiver<Vec<f32>>>,
    config: ParaformerConfig,
) {
    paraformer::start_with_config(receiver, config).await;
}
```

- [ ] **Step 2: 验证**

Run: `cd src-tauri && cargo check 2>&1 | grep "websocket\|config"` 
Expected: 无错误

---

### Task 4: 创建 asr/subtitle/srt.rs

**Files:**
- Create: `src-tauri/src/asr/subtitle/mod.rs`
- Create: `src-tauri/src/asr/subtitle/srt.rs`

- [ ] **Step 1: 创建 subtitle/mod.rs**

```rust
pub mod srt;
```

- [ ] **Step 2: 创建 srt.rs（先写测试）**

创建 `src-tauri/src/asr/subtitle/srt.rs`，内容只含测试部分：

```rust
use crate::asr::events::{AsrResultEvent, AsrResultKind};
use std::fmt::Write as FmtWrite;
use std::path::Path;

fn format_srt_time(ms: u64) -> String {
    todo!()
}

pub fn write_srt(events: &[AsrResultEvent], path: &Path) -> anyhow::Result<()> {
    todo!()
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_format_zero() {
        assert_eq!(format_srt_time(0), "00:00:00,000");
    }

    #[test]
    fn test_format_millis() {
        assert_eq!(format_srt_time(1200), "00:00:01,200");
    }

    #[test]
    fn test_format_hour() {
        assert_eq!(format_srt_time(3_661_500), "01:01:01,500");
    }

    #[test]
    fn test_write_srt_basic() {
        let events = vec![
            AsrResultEvent {
                sentence_id: 0,
                begin_time: 1200,
                end_time: Some(3820),
                text: "你好世界".to_string(),
                is_final: true,
                kind: AsrResultKind::Transcription,
                lang: None,
            },
            AsrResultEvent {
                sentence_id: 1,
                begin_time: 4000,
                end_time: None,
                text: "第二句".to_string(),
                is_final: true,
                kind: AsrResultKind::Transcription,
                lang: None,
            },
        ];
        let dir = tempfile::tempdir().unwrap();
        let path = dir.path().join("out.srt");
        write_srt(&events, &path).unwrap();
        let content = std::fs::read_to_string(&path).unwrap();
        assert!(content.contains("00:00:01,200 --> 00:00:03,820"));
        assert!(content.contains("你好世界"));
        assert!(content.contains("00:00:04,000 --> 00:00:06,000"));
        assert!(content.contains("第二句"));
    }

    #[test]
    fn test_write_srt_skips_non_final() {
        let events = vec![
            AsrResultEvent {
                sentence_id: 0,
                begin_time: 0,
                end_time: None,
                text: "临时结果".to_string(),
                is_final: false,
                kind: AsrResultKind::Transcription,
                lang: None,
            },
            AsrResultEvent {
                sentence_id: 0,
                begin_time: 0,
                end_time: Some(1000),
                text: "最终结果".to_string(),
                is_final: true,
                kind: AsrResultKind::Transcription,
                lang: None,
            },
        ];
        let dir = tempfile::tempdir().unwrap();
        let path = dir.path().join("out.srt");
        write_srt(&events, &path).unwrap();
        let content = std::fs::read_to_string(&path).unwrap();
        assert!(!content.contains("临时结果"));
        assert!(content.contains("最终结果"));
    }
}
```

- [ ] **Step 3: 运行确认失败（todo!() panic）**

Run: `cd src-tauri && cargo test asr::subtitle::srt 2>&1 | tail -5`
Expected: 测试 panic（todo! 触发）

- [ ] **Step 4: 实现 format_srt_time 和 write_srt**

用完整实现替换 `srt.rs` 中的两个 `todo!()`：

```rust
use crate::asr::events::{AsrResultEvent, AsrResultKind};
use std::fmt::Write as FmtWrite;
use std::path::Path;

/// 毫秒 → SRT 时间格式 HH:MM:SS,mmm
fn format_srt_time(ms: u64) -> String {
    let hours = ms / 3_600_000;
    let minutes = (ms % 3_600_000) / 60_000;
    let seconds = (ms % 60_000) / 1_000;
    let millis = ms % 1_000;
    format!("{:02}:{:02}:{:02},{:03}", hours, minutes, seconds, millis)
}

/// 将识别结果写出为 SRT 字幕文件
/// 只写 is_final=true 的结果；end_time 缺失时用 begin_time + 2000ms 补全
pub fn write_srt(events: &[AsrResultEvent], path: &Path) -> anyhow::Result<()> {
    let mut content = String::new();
    let finals: Vec<&AsrResultEvent> = events.iter().filter(|e| e.is_final).collect();
    for (idx, event) in finals.iter().enumerate() {
        let begin = format_srt_time(event.begin_time);
        let end = format_srt_time(event.end_time.unwrap_or(event.begin_time + 2000));
        writeln!(content, "{}", idx + 1).unwrap();
        writeln!(content, "{} --> {}", begin, end).unwrap();
        writeln!(content, "{}", event.text).unwrap();
        writeln!(content).unwrap();
    }
    std::fs::write(path, content)?;
    Ok(())
}

#[cfg(test)]
mod tests {
    // ... 保持不变
}
```

（`#[cfg(test)]` 块保持 Step 2 的内容不变）

- [ ] **Step 5: 运行测试**

Run: `cd src-tauri && cargo test asr::subtitle::srt`
Expected: 4 tests pass

- [ ] **Step 6: Commit**

```bash
git add src-tauri/src/asr/subtitle/
git commit -m "feat: add SRT subtitle serialization with tests"
```

---

### Task 5: 定义 AsrProvider trait，更新 asr/mod.rs

**Files:**
- Modify: `src-tauri/src/asr/mod.rs`

- [ ] **Step 1: 替换整个文件**

```rust
pub mod config;
pub mod events;
pub mod provider;
pub mod subtitle;
pub mod websocket;

use async_trait::async_trait;
use std::path::Path;
use tokio::sync::mpsc;

#[async_trait]
pub trait AsrProvider: Send + Sync {
    /// 流式识别：消费音频 channel，实时推送 asr-result 事件到前端
    async fn recognize_stream(&self, rx: mpsc::Receiver<Vec<f32>>) -> anyhow::Result<()>;

    /// 文件识别：上传 OSS → Fun-ASR → 写 SRT → 返回完整结果
    async fn recognize_file(
        &self,
        input_path: &Path,
        output_path: &Path,
    ) -> anyhow::Result<Vec<events::AsrResultEvent>>;
}
```

- [ ] **Step 2: 验证（预期 provider 模块未找到）**

Run: `cd src-tauri && cargo check 2>&1 | grep "error"`
Expected: 错误只来自 `provider` 模块未创建（subtitle 已存在，websocket 无误）

---

### Task 6: 创建 asr/provider/ 三个文件

**Files:**
- Create: `src-tauri/src/asr/provider/mod.rs`
- Create: `src-tauri/src/asr/provider/local.rs`
- Create: `src-tauri/src/asr/provider/cloud.rs`

- [ ] **Step 1: 创建 provider/local.rs**

```rust
use crate::asr::config::LocalAsrConfig;
use crate::asr::events::AsrResultEvent;
use crate::asr::AsrProvider;
use async_trait::async_trait;
use std::path::Path;
use tokio::sync::mpsc;

pub struct LocalAsrProvider {
    #[allow(dead_code)]
    config: LocalAsrConfig,
}

impl LocalAsrProvider {
    pub fn new(config: LocalAsrConfig) -> Self {
        Self { config }
    }
}

#[async_trait]
impl AsrProvider for LocalAsrProvider {
    async fn recognize_stream(&self, _rx: mpsc::Receiver<Vec<f32>>) -> anyhow::Result<()> {
        todo!("本地 ASR 流式识别待实现")
    }

    async fn recognize_file(
        &self,
        _input_path: &Path,
        _output_path: &Path,
    ) -> anyhow::Result<Vec<AsrResultEvent>> {
        todo!("本地 ASR 文件识别待实现")
    }
}
```

- [ ] **Step 2: 创建 provider/cloud.rs（含测试和完整实现）**

创建 `src-tauri/src/asr/provider/cloud.rs`：

```rust
use crate::asr::config::{CloudAsrConfig, OssConfig};
use crate::asr::events::{AsrResultEvent, AsrResultKind};
use crate::asr::subtitle::srt;
use crate::asr::websocket;
use crate::asr::AsrProvider;
use anyhow::Context;
use async_trait::async_trait;
use base64::{engine::general_purpose::STANDARD as BASE64, Engine as _};
use hmac::{Hmac, Mac};
use log::{info, warn};
use reqwest::Client;
use serde::Deserialize;
use sha1::Sha1;
use std::path::Path;
use tokio::sync::mpsc;
use uuid::Uuid;

type HmacSha1 = Hmac<Sha1>;

pub struct CloudAsrProvider {
    config: CloudAsrConfig,
}

impl CloudAsrProvider {
    pub fn new(config: CloudAsrConfig) -> Self {
        Self { config }
    }
}

#[async_trait]
impl AsrProvider for CloudAsrProvider {
    async fn recognize_stream(&self, rx: mpsc::Receiver<Vec<f32>>) -> anyhow::Result<()> {
        websocket::start_asr_with_config(Some(rx), self.config.streaming.clone()).await;
        Ok(())
    }

    async fn recognize_file(
        &self,
        input_path: &Path,
        output_path: &Path,
    ) -> anyhow::Result<Vec<AsrResultEvent>> {
        let ext = input_path
            .extension()
            .and_then(|e| e.to_str())
            .unwrap_or("bin");
        let object_key = format!("vocosphere/tmp/{}.{}", Uuid::new_v4(), ext);

        let data = std::fs::read(input_path)
            .with_context(|| format!("无法读取文件: {}", input_path.display()))?;

        info!("上传文件到 OSS: {}", object_key);
        let oss = OssClient::new(&self.config.oss);
        let public_url = oss
            .upload(data, &object_key, "application/octet-stream")
            .await?;
        info!("文件上传完成: {}", public_url);

        let fun_asr = FunAsrClient::new(self.config.file_asr_api_key.clone());
        let task_id = fun_asr.submit_task(&public_url).await?;
        info!("Fun-ASR 任务已提交: {}", task_id);

        let transcription_url = fun_asr.wait_for_result(&task_id).await?;
        info!("Fun-ASR 任务完成，结果 URL: {}", transcription_url);

        let sentences = fun_asr.download_transcription(&transcription_url).await?;
        info!("识别完成，共 {} 条句子", sentences.len());

        let events: Vec<AsrResultEvent> = sentences
            .iter()
            .enumerate()
            .map(|(idx, s)| AsrResultEvent {
                sentence_id: idx as u32,
                begin_time: s.begin_time,
                end_time: Some(s.end_time),
                text: s.text.clone(),
                is_final: true,
                kind: AsrResultKind::Transcription,
                lang: None,
            })
            .collect();

        srt::write_srt(&events, output_path)?;
        info!("SRT 文件已写出: {}", output_path.display());

        if let Err(e) = oss.delete(&object_key).await {
            warn!("删除 OSS 临时文件失败（不影响结果）: {}", e);
        }

        Ok(events)
    }
}

// ── OSS 客户端 ──────────────────────────────────────────────────────────────

struct OssClient<'a> {
    config: &'a OssConfig,
    client: Client,
}

impl<'a> OssClient<'a> {
    fn new(config: &'a OssConfig) -> Self {
        Self {
            config,
            client: Client::new(),
        }
    }

    async fn upload(
        &self,
        data: Vec<u8>,
        object_key: &str,
        content_type: &str,
    ) -> anyhow::Result<String> {
        let date = chrono::Utc::now()
            .format("%a, %d %b %Y %H:%M:%S GMT")
            .to_string();
        let signature = sign_oss_put(
            &self.config.access_key_secret,
            content_type,
            &date,
            &self.config.bucket,
            object_key,
        );
        let auth = format!("OSS {}:{}", self.config.access_key_id, signature);
        let url = format!(
            "https://{}.{}/{}",
            self.config.bucket, self.config.endpoint, object_key
        );

        let resp = self
            .client
            .put(&url)
            .header("Date", &date)
            .header("Content-Type", content_type)
            .header("x-oss-object-acl", "public-read")
            .header("Authorization", auth)
            .body(data)
            .send()
            .await
            .context("OSS PUT 请求失败")?;

        if !resp.status().is_success() {
            let status = resp.status();
            let body = resp.text().await.unwrap_or_default();
            anyhow::bail!("OSS 上传失败: HTTP {} — {}", status, body);
        }
        Ok(url)
    }

    async fn delete(&self, object_key: &str) -> anyhow::Result<()> {
        let date = chrono::Utc::now()
            .format("%a, %d %b %Y %H:%M:%S GMT")
            .to_string();
        let resource = format!("/{}/{}", self.config.bucket, object_key);
        let string_to_sign = format!("DELETE\n\n\n{}\n{}", date, resource);
        let mut mac = HmacSha1::new_from_slice(self.config.access_key_secret.as_bytes())
            .expect("valid key");
        mac.update(string_to_sign.as_bytes());
        let sig = BASE64.encode(mac.finalize().into_bytes());
        let auth = format!("OSS {}:{}", self.config.access_key_id, sig);
        let url = format!(
            "https://{}.{}/{}",
            self.config.bucket, self.config.endpoint, object_key
        );

        let resp = self
            .client
            .delete(&url)
            .header("Date", &date)
            .header("Authorization", auth)
            .send()
            .await
            .context("OSS DELETE 请求失败")?;

        if !resp.status().is_success() && resp.status().as_u16() != 404 {
            let status = resp.status();
            let body = resp.text().await.unwrap_or_default();
            anyhow::bail!("OSS 删除失败: HTTP {} — {}", status, body);
        }
        Ok(())
    }
}

/// OSS v1 签名：PUT 含 x-oss-object-acl:public-read
fn sign_oss_put(
    access_key_secret: &str,
    content_type: &str,
    date: &str,
    bucket: &str,
    object_key: &str,
) -> String {
    let canonicalized_headers = "x-oss-object-acl:public-read\n";
    let canonicalized_resource = format!("/{}/{}", bucket, object_key);
    let string_to_sign = format!(
        "PUT\n\n{}\n{}\n{}{}",
        content_type, date, canonicalized_headers, canonicalized_resource
    );
    let mut mac =
        HmacSha1::new_from_slice(access_key_secret.as_bytes()).expect("HMAC key valid");
    mac.update(string_to_sign.as_bytes());
    BASE64.encode(mac.finalize().into_bytes())
}

// ── Fun-ASR 客户端 ──────────────────────────────────────────────────────────

const FUNASR_API_BASE: &str = "https://dashscope.aliyuncs.com/api/v1";
const POLL_INTERVAL_SECS: u64 = 3;
const POLL_MAX_RETRIES: u32 = 200;

struct FunAsrClient {
    api_key: String,
    client: Client,
}

impl FunAsrClient {
    fn new(api_key: String) -> Self {
        Self {
            api_key,
            client: Client::new(),
        }
    }

    async fn submit_task(&self, file_url: &str) -> anyhow::Result<String> {
        let body = serde_json::json!({
            "model": "fun-asr",
            "input": { "file_urls": [file_url] },
            "parameters": {}
        });

        let resp = self
            .client
            .post(format!("{}/services/audio/asr/transcription", FUNASR_API_BASE))
            .header("Authorization", format!("Bearer {}", self.api_key))
            .header("X-DashScope-Async", "enable")
            .json(&body)
            .send()
            .await
            .context("Fun-ASR 提交任务请求失败")?;

        if !resp.status().is_success() {
            let status = resp.status();
            let text = resp.text().await.unwrap_or_default();
            anyhow::bail!("Fun-ASR 提交失败: HTTP {} — {}", status, text);
        }

        let result: TaskSubmitResponse = resp.json().await.context("解析提交响应失败")?;
        Ok(result.output.task_id)
    }

    async fn wait_for_result(&self, task_id: &str) -> anyhow::Result<String> {
        for attempt in 0..POLL_MAX_RETRIES {
            tokio::time::sleep(tokio::time::Duration::from_secs(POLL_INTERVAL_SECS)).await;

            let resp = self
                .client
                .get(format!("{}/tasks/{}", FUNASR_API_BASE, task_id))
                .header("Authorization", format!("Bearer {}", self.api_key))
                .send()
                .await
                .context("Fun-ASR 查询任务请求失败")?;

            if !resp.status().is_success() {
                let status = resp.status();
                let text = resp.text().await.unwrap_or_default();
                anyhow::bail!("Fun-ASR 查询失败: HTTP {} — {}", status, text);
            }

            let result: TaskQueryResponse = resp.json().await.context("解析查询响应失败")?;

            match result.output.task_status.as_str() {
                "SUCCEEDED" => {
                    let url = result
                        .output
                        .results
                        .and_then(|r| {
                            r.into_iter().find(|r| r.subtask_status == "SUCCEEDED")
                        })
                        .map(|r| r.transcription_url)
                        .context("SUCCEEDED 但未找到 transcription_url")?;
                    return Ok(url);
                }
                "FAILED" => anyhow::bail!("Fun-ASR 任务失败"),
                status => {
                    info!("Fun-ASR 任务状态: {}（第 {} 次轮询）", status, attempt + 1);
                }
            }
        }
        anyhow::bail!("Fun-ASR 任务超时（超过 {} 次轮询）", POLL_MAX_RETRIES)
    }

    async fn download_transcription(&self, url: &str) -> anyhow::Result<Vec<FunAsrSentence>> {
        let resp = self
            .client
            .get(url)
            .send()
            .await
            .context("下载 transcription 结果失败")?;

        if !resp.status().is_success() {
            anyhow::bail!("下载识别结果失败: HTTP {}", resp.status());
        }

        let result: TranscriptionResponse =
            resp.json().await.context("解析识别结果 JSON 失败")?;

        Ok(result
            .transcripts
            .into_iter()
            .next()
            .map(|t| t.sentences)
            .unwrap_or_default())
    }
}

// ── 内部响应类型 ─────────────────────────────────────────────────────────────

#[derive(Deserialize)]
struct TaskSubmitResponse {
    output: TaskSubmitOutput,
}
#[derive(Deserialize)]
struct TaskSubmitOutput {
    task_id: String,
}
#[derive(Deserialize)]
struct TaskQueryResponse {
    output: TaskQueryOutput,
}
#[derive(Deserialize)]
struct TaskQueryOutput {
    task_status: String,
    results: Option<Vec<TaskResult>>,
}
#[derive(Deserialize)]
struct TaskResult {
    transcription_url: String,
    subtask_status: String,
}
#[derive(Deserialize)]
struct TranscriptionResponse {
    transcripts: Vec<Transcript>,
}
#[derive(Deserialize)]
struct Transcript {
    sentences: Vec<FunAsrSentence>,
}
#[derive(Deserialize)]
struct FunAsrSentence {
    text: String,
    begin_time: u64,
    end_time: u64,
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_sign_oss_put_is_base64() {
        let sig = sign_oss_put(
            "wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY",
            "application/octet-stream",
            "Thu, 01 Jan 2026 00:00:00 GMT",
            "my-bucket",
            "vocosphere/tmp/test.wav",
        );
        assert!(!sig.is_empty());
        assert!(sig
            .chars()
            .all(|c| c.is_alphanumeric() || c == '+' || c == '/' || c == '='));
    }

    #[test]
    fn test_sign_oss_put_deterministic() {
        let sig1 = sign_oss_put(
            "secret",
            "audio/wav",
            "Mon, 01 Jan 2024 12:00:00 GMT",
            "bucket",
            "key.wav",
        );
        let sig2 = sign_oss_put(
            "secret",
            "audio/wav",
            "Mon, 01 Jan 2024 12:00:00 GMT",
            "bucket",
            "key.wav",
        );
        assert_eq!(sig1, sig2);
    }
}
```

- [ ] **Step 3: 创建 provider/mod.rs**

```rust
pub mod cloud;
pub mod local;

pub use cloud::CloudAsrProvider;
pub use local::LocalAsrProvider;
```

- [ ] **Step 4: 运行测试**

Run: `cd src-tauri && cargo test asr::provider::cloud`
Expected: 2 tests pass

- [ ] **Step 5: cargo check 全量检查**

Run: `cd src-tauri && cargo check`
Expected: 无错误

- [ ] **Step 6: Commit**

```bash
git add src-tauri/src/asr/provider/
git commit -m "feat: add CloudAsrProvider (stream + file) and LocalAsrProvider (todo)"
```

---

### Task 7: 创建 file_recognition.rs

**Files:**
- Create: `src-tauri/src/file_recognition.rs`

- [ ] **Step 1: 创建文件**

```rust
use crate::asr::config::AsrProviderConfig;
use crate::asr::events::AsrResultEvent;
use crate::asr::provider::{CloudAsrProvider, LocalAsrProvider};
use crate::asr::AsrProvider;
use log::info;
use std::path::Path;

/// 音频文件识别：OSS 上传 → Fun-ASR → 写 SRT → 返回完整结果列表
#[tauri::command]
pub async fn recognize_file(
    config: AsrProviderConfig,
    input_path: String,
    output_path: String,
) -> Result<Vec<AsrResultEvent>, String> {
    info!("开始文件识别: {} → {}", input_path, output_path);
    let provider: Box<dyn AsrProvider> = match config {
        AsrProviderConfig::Cloud(c) => Box::new(CloudAsrProvider::new(c)),
        AsrProviderConfig::Local(c) => Box::new(LocalAsrProvider::new(c)),
    };
    provider
        .recognize_file(Path::new(&input_path), Path::new(&output_path))
        .await
        .map_err(|e| e.to_string())
}
```

- [ ] **Step 2: 验证**

Run: `cd src-tauri && cargo check 2>&1 | grep "file_recognition"`
Expected: 无错误

---

### Task 8: 更新 audio_capture.rs

**Files:**
- Modify: `src-tauri/src/audio_capture.rs`

- [ ] **Step 1: 在现有 `use crate::asr;` 下方追加导入**

在 `use crate::asr;` 行下方添加：

```rust
use crate::asr::config::AsrProviderConfig;
use crate::asr::provider::{CloudAsrProvider, LocalAsrProvider};
use crate::asr::AsrProvider;
```

- [ ] **Step 2: 更新 start_audio_capture 签名**

找到：
```rust
pub async fn start_audio_capture(
    config: crate::asr::config::AsrModelConfig,
    device_name: Option<String>,
) -> Result<String, String> {
```

替换为：
```rust
pub async fn start_audio_capture(
    config: AsrProviderConfig,
    device_name: Option<String>,
) -> Result<String, String> {
```

- [ ] **Step 3: 更新 run_audio_capture 签名**

找到：
```rust
async fn run_audio_capture(
    config: crate::asr::config::AsrModelConfig,
    device_name: Option<String>,
) -> anyhow::Result<()> {
```

替换为：
```rust
async fn run_audio_capture(
    config: AsrProviderConfig,
    device_name: Option<String>,
) -> anyhow::Result<()> {
```

- [ ] **Step 4: 替换 ASR 启动调用**

找到：
```rust
    // 使用统一的 ASR 启动接口
    info!("🤖 ASR: 启动语音识别，配置: {:?}", config);
    asr::websocket::start_asr_with_config(Some(rx), config).await;
```

替换为：
```rust
    info!("🤖 ASR: 启动语音识别，配置: {:?}", config);
    let provider: Box<dyn AsrProvider> = match config {
        AsrProviderConfig::Cloud(c) => Box::new(CloudAsrProvider::new(c)),
        AsrProviderConfig::Local(c) => Box::new(LocalAsrProvider::new(c)),
    };
    provider.recognize_stream(rx).await?;
```

- [ ] **Step 5: 验证**

Run: `cd src-tauri && cargo check`
Expected: 无错误

- [ ] **Step 6: Commit**

```bash
git add src-tauri/src/audio_capture.rs
git commit -m "refactor: audio_capture uses AsrProvider trait instead of websocket directly"
```

---

### Task 9: 更新 main.rs，注册新命令

**Files:**
- Modify: `src-tauri/src/main.rs`

- [ ] **Step 1: 添加 mod 声明**

找到：
```rust
mod video_subtitle; // 视频字幕功能模块
```

在其后添加：
```rust
mod file_recognition;
```

- [ ] **Step 2: 注册命令**

找到：
```rust
        .invoke_handler(tauri::generate_handler![
            greet,
            test_logs,
            audio_capture::get_audio_devices,
            audio_capture::start_audio_capture,
            audio_capture::stop_audio_capture,
            video_subtitle::get_ffmpeg_version
        ])
```

替换为：
```rust
        .invoke_handler(tauri::generate_handler![
            greet,
            test_logs,
            audio_capture::get_audio_devices,
            audio_capture::start_audio_capture,
            audio_capture::stop_audio_capture,
            video_subtitle::get_ffmpeg_version,
            file_recognition::recognize_file
        ])
```

- [ ] **Step 3: 全量编译验证**

Run: `cd src-tauri && cargo check`
Expected: 无错误，无 unused import 警告（如有，修复）

- [ ] **Step 4: 运行全部测试**

Run: `cd src-tauri && cargo test`
Expected: 8 tests pass（config × 2, srt × 4, cloud signing × 2）

- [ ] **Step 5: Commit**

```bash
git add src-tauri/src/main.rs
git commit -m "feat: register recognize_file Tauri command"
```

---

## 自检

**Spec 覆盖：**
- ✅ `AsrProvider` trait（Task 5）
- ✅ `CloudAsrProvider::recognize_stream`（Task 6）
- ✅ `CloudAsrProvider::recognize_file` + OSS + Fun-ASR（Task 6）
- ✅ `LocalAsrProvider`（todo!()，Task 6）
- ✅ 配置重构（Task 2）
- ✅ SRT 写出（Task 4）
- ✅ `recognize_file` Tauri 命令（Task 7）
- ✅ `audio_capture.rs` 更新（Task 8）

**类型一致性：**
- `CloudStreamingConfig` — Task 2 定义，Task 3/6 使用，一致
- `AsrProviderConfig` — Task 2 定义，Task 7/8/9 使用，一致
- `CloudAsrProvider::new(CloudAsrConfig)` — Task 6 定义，Task 7/8 使用，一致
- `recognize_stream(rx: mpsc::Receiver<Vec<f32>>)` — Task 5 trait，Task 6 impl，Task 8 调用，一致
