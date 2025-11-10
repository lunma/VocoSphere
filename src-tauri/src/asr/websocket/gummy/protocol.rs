// Gummy 模型专用的 WebSocket 协议定义
// 参考文档：https://help.aliyun.com/zh/model-studio/gummy-real-time-speech-recognition
//
// Gummy 模型特点：
// - 支持实时语音识别（ASR）
// - 支持实时翻译功能
// - 支持标点符号预测和逆文本正则化（ITN）
// - 支持定制热词（vocabulary_id）
// - 支持多语言识别（source_language）

use serde::{Deserialize, Serialize};
use std::collections::HashMap;

fn is_default<T: Default + PartialEq>(v: &T) -> bool {
    *v == T::default()
}

// Gummy 事件结构
#[derive(Debug, Serialize, Deserialize)]
pub(crate) struct Event {
    pub header: Header,
    pub payload: Payload,
}

// Gummy 消息头部
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

// Gummy 消息负载
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
    // Gummy 特定：资源配置（如热词表）
    #[serde(rename = "resources", default, skip_serializing_if = "is_default")]
    pub resources: Option<Vec<Resource>>,
}

// Gummy 参数配置
#[derive(Debug, Serialize, Deserialize, Default, PartialEq)]
pub(crate) struct Parameters {
    // 音频格式参数
    #[serde(rename = "sample_rate")]
    pub sample_rate: u32,
    #[serde(rename = "format")]
    pub format: String,

    // 语言参数
    #[serde(
        rename = "source_language",
        default,
        skip_serializing_if = "is_default"
    )]
    pub source_language: String,
    #[serde(rename = "language_hints", default, skip_serializing_if = "is_default")]
    pub language_hints: Option<Vec<String>>,

    // Gummy 核心功能开关
    #[serde(rename = "transcription_enabled")]
    pub transcription_enabled: bool,
    #[serde(rename = "translation_enabled")]
    pub translation_enabled: bool,
    #[serde(rename = "translation_target_languages")]
    pub translation_target_languages: Vec<String>,

    // Gummy 特定配置
    #[serde(rename = "vocabulary_id", default, skip_serializing_if = "is_default")]
    pub vocabulary_id: Option<String>, // 定制热词ID
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
}

// Gummy 资源定义（用于热词等）
#[derive(Debug, Serialize, Deserialize, PartialEq)]
pub(crate) struct Resource {
    #[serde(rename = "resource_type")]
    pub resource_type: String,
    #[serde(rename = "resource_id")]
    pub resource_id: String,
}

// Gummy 输出结果
#[derive(Debug, Serialize, Deserialize, PartialEq)]
pub(crate) struct Output {
    // 识别结果
    #[serde(rename = "transcription")]
    pub transcription: Option<Transcription>,
    // 翻译结果（Gummy 特有）
    #[serde(rename = "translations", default)]
    pub translations: Option<Vec<Translation>>,
}

// Gummy 识别结果
#[derive(Debug, Serialize, Deserialize, PartialEq)]
pub(crate) struct Transcription {
    #[serde(rename = "sentence_id")]
    pub sentence_id: u32,
    #[serde(rename = "begin_time")]
    pub begin_time: u64,
    #[serde(rename = "end_time")]
    pub end_time: u64,
    #[serde(rename = "text")]
    pub text: String,
    #[serde(rename = "words")]
    pub words: Vec<Word>,
    #[serde(rename = "sentence_end")]
    pub sentence_end: bool,
}

// Gummy 翻译结果
#[derive(Debug, Serialize, Deserialize, PartialEq)]
pub(crate) struct Translation {
    #[serde(rename = "sentence_id")]
    pub sentence_id: u32,
    #[serde(rename = "begin_time")]
    pub begin_time: u64,
    #[serde(rename = "end_time")]
    pub end_time: u64,
    #[serde(rename = "text")]
    pub text: String,
    #[serde(rename = "lang")]
    pub lang: String,
    #[serde(rename = "words")]
    pub words: Vec<Word>,
    #[serde(rename = "sentence_end")]
    pub sentence_end: bool,
}

// Gummy 词级别信息
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
