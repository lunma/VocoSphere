// Paraformer 模型专用的 WebSocket 协议定义
// 参考文档：
// - https://help.aliyun.com/zh/model-studio/websocket-for-paraformer-real-time-service
// - https://help.aliyun.com/zh/model-studio/real-time-websocket-api
//
// Paraformer 模型特点：
// - 专注于实时语音识别（ASR）
// - 支持多语言和方言识别
// - 支持标点符号预测和逆文本正则化（ITN）
// - 支持定制热词（vocabulary_id）
// - 支持不流畅词过滤（disfluency_removal_enabled）
// - 部分模型支持情感识别

use serde::{Deserialize, Serialize};
use std::collections::HashMap;

fn is_default<T: Default + PartialEq>(v: &T) -> bool {
    *v == T::default()
}

// Paraformer 事件结构
#[derive(Debug, Serialize, Deserialize)]
pub(crate) struct Event {
    pub header: Header,
    pub payload: Payload,
}

// Paraformer 消息头部
#[derive(Debug, Serialize, Deserialize, Default, PartialEq)]
pub(crate) struct Header {
    #[serde(rename = "action", default, skip_serializing_if = "is_default")]
    pub action: String,
    #[serde(rename = "task_id", default, skip_serializing_if = "is_default")]
    pub task_id: String,
    #[serde(rename = "streaming", default, skip_serializing_if = "is_default")]
    pub streaming: String,
    #[serde(rename = "event", default, skip_serializing_if = "is_default")]
    pub event: String,
    #[serde(rename = "error_code", default, skip_serializing_if = "is_default")]
    pub error_code: String,
    #[serde(rename = "error_message", default, skip_serializing_if = "is_default")]
    pub error_message: String,
    #[serde(rename = "attributes", default, skip_serializing_if = "is_default")]
    pub attributes: HashMap<String, String>,
}

// Paraformer 消息负载
#[derive(Debug, Serialize, Deserialize, Default, PartialEq)]
pub(crate) struct Payload {
    #[serde(rename = "task_group", default, skip_serializing_if = "is_default")]
    pub task_group: String,
    #[serde(rename = "task", default, skip_serializing_if = "is_default")]
    pub task: String,
    #[serde(rename = "function", default, skip_serializing_if = "is_default")]
    pub function: String,
    #[serde(rename = "model", default, skip_serializing_if = "is_default")]
    pub model: String,
    #[serde(rename = "parameters", default, skip_serializing_if = "is_default")]
    pub parameters: Parameters,
    #[serde(rename = "input", default)]
    pub input: HashMap<String, String>,
    #[serde(rename = "output", default, skip_serializing_if = "is_default")]
    pub output: Option<Output>,
    // Paraformer 特定：资源配置（如热词表）
    #[serde(rename = "resources", default, skip_serializing_if = "is_default")]
    pub resources: Option<Vec<Resource>>,
}

// Paraformer 参数配置
#[derive(Debug, Serialize, Deserialize, Default, PartialEq)]
pub(crate) struct Parameters {
    // 音频格式参数
    #[serde(rename = "sample_rate")]
    pub sample_rate: u32, // 支持 8000/16000/48000
    #[serde(rename = "format")]
    pub format: String, // pcm 或 wav

    // 语言参数
    #[serde(
        rename = "source_language",
        default,
        skip_serializing_if = "is_default"
    )]
    pub source_language: String, // zh(中文)、en(英文)、ja(日语)、ko(韩语)、de(德语)、fr(法语)、ru(俄语) 等
    #[serde(rename = "language_hints", default, skip_serializing_if = "is_default")]
    pub language_hints: Option<Vec<String>>, // 语言提示列表

    // Paraformer 核心功能开关（注意：Paraformer 不支持翻译功能）
    #[serde(rename = "transcription_enabled")]
    pub transcription_enabled: bool,

    // Paraformer 特定配置
    #[serde(rename = "vocabulary_id", default, skip_serializing_if = "is_default")]
    pub vocabulary_id: Option<String>, // 定制热词ID
    #[serde(
        rename = "disfluency_removal_enabled",
        default,
        skip_serializing_if = "Option::is_none"
    )]
    pub disfluency_removal_enabled: Option<bool>, // 不流畅词过滤（如：嗯、啊等语气词）
    #[serde(
        rename = "punctuation_prediction_enabled",
        default,
        skip_serializing_if = "Option::is_none"
    )]
    pub punctuation_prediction_enabled: Option<bool>, // 标点符号预测（默认开启）
    #[serde(
        rename = "itn_enabled",
        default,
        skip_serializing_if = "Option::is_none"
    )]
    pub itn_enabled: Option<bool>, // 逆文本正则化（默认开启）
    #[serde(rename = "dialect", default, skip_serializing_if = "is_default")]
    pub dialect: Option<String>, // 方言设置（如：四川话、粤语等）

    // 情感识别（部分 Paraformer 模型支持）
    #[serde(
        rename = "emotion_enabled",
        default,
        skip_serializing_if = "Option::is_none"
    )]
    pub emotion_enabled: Option<bool>, // 情感识别开关
}

// Paraformer 资源定义（用于热词等）
#[derive(Debug, Serialize, Deserialize, PartialEq)]
pub(crate) struct Resource {
    #[serde(rename = "resource_type")]
    pub resource_type: String,
    #[serde(rename = "resource_id")]
    pub resource_id: String,
}

// Paraformer 输出结果（注意：Paraformer 不支持翻译功能）
#[derive(Debug, Serialize, Deserialize, PartialEq)]
pub(crate) struct Output {
    // 识别结果（Paraformer 返回的是 sentence 字段，不是 transcription）
    #[serde(rename = "sentence", default)]
    pub transcription: Option<Transcription>,
    // 情感识别结果（如果启用）
    #[serde(rename = "emotion", default)]
    pub emotion: Option<Emotion>,
}

// Paraformer 识别结果
#[derive(Debug, Serialize, Deserialize, PartialEq)]
pub(crate) struct Transcription {
    #[serde(rename = "sentence_id")]
    pub sentence_id: u32,
    #[serde(rename = "begin_time")]
    pub begin_time: u64,
    #[serde(rename = "end_time", default)]
    pub end_time: Option<u64>, // Paraformer 在识别过程中会返回 null
    #[serde(rename = "text")]
    pub text: String,
    #[serde(rename = "words")]
    pub words: Vec<Word>,
    #[serde(rename = "sentence_end")]
    pub sentence_end: bool,
    #[serde(rename = "sentence_begin", default, skip_serializing_if = "is_default")]
    pub sentence_begin: bool,
    #[serde(rename = "channel_id", default, skip_serializing_if = "is_default")]
    pub channel_id: u32,
    #[serde(
        rename = "speaker_id",
        default,
        skip_serializing_if = "Option::is_none"
    )]
    pub speaker_id: Option<u32>,
    #[serde(rename = "stash", default, skip_serializing_if = "Option::is_none")]
    pub stash: Option<HashMap<String, serde_json::Value>>,
}

// Paraformer 情感识别结果（部分模型支持）
#[derive(Debug, Serialize, Deserialize, PartialEq)]
pub(crate) struct Emotion {
    #[serde(rename = "sentence_id")]
    pub sentence_id: u32,
    #[serde(rename = "emotion_type")]
    pub emotion_type: String, // 情感类型：如 positive, negative, neutral
    #[serde(rename = "emotion_score")]
    pub emotion_score: f32, // 情感得分
}

// Paraformer 词级别信息
#[derive(Debug, Serialize, Deserialize, PartialEq)]
pub(crate) struct Word {
    #[serde(rename = "begin_time")]
    pub begin_time: u64,
    #[serde(rename = "end_time")]
    pub end_time: u64,
    #[serde(rename = "text")]
    pub text: String,
    #[serde(rename = "punctuation")]
    pub punctuation: String,
    #[serde(rename = "fixed")]
    pub fixed: bool,
}
