// ASR 模型配置模块
// 定义 Gummy 和 Paraformer 模型的配置数据结构

use serde::{Deserialize, Serialize};

/// 服务器配置（WebSocket URL 和 API Key）
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ServerConfig {
    /// WebSocket 服务器地址
    #[serde(default = "default_ws_url")]
    pub ws_url: String,

    /// API Key
    #[serde(default = "default_api_key")]
    pub api_key: String,
}

/// ASR 模型类型
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(tag = "type")]
pub enum AsrModelConfig {
    #[serde(rename = "gummy")]
    Gummy(GummyConfig),
    #[serde(rename = "paraformer")]
    Paraformer(ParaformerConfig),
}

/// Gummy 模型配置
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct GummyConfig {
    /// 服务器配置（WebSocket URL 和 API Key）
    #[serde(default)]
    pub server_config: ServerConfig,

    /// 源语言（如：zh、en、ja、ko、de、fr、ru 等）
    #[serde(default = "default_source_language")]
    pub source_language: String,

    /// 语言提示列表（可选）
    #[serde(skip_serializing_if = "Option::is_none")]
    pub language_hints: Option<Vec<String>>,

    /// 是否启用翻译功能
    #[serde(default)]
    pub translation_enabled: bool,

    /// 翻译目标语言列表（如：["en", "ja"]）
    #[serde(default)]
    pub translation_target_languages: Vec<String>,

    /// 定制热词ID（可选）
    #[serde(skip_serializing_if = "Option::is_none")]
    pub vocabulary_id: Option<String>,

    /// 标点符号预测（默认开启）
    #[serde(default = "default_true")]
    pub punctuation_prediction_enabled: bool,

    /// 逆文本正则化（默认开启）
    #[serde(default = "default_true")]
    pub itn_enabled: bool,
}

/// Paraformer 模型配置
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ParaformerConfig {
    /// 服务器配置（WebSocket URL 和 API Key）
    #[serde(default)]
    pub server_config: ServerConfig,

    /// 源语言（如：zh、en、ja、ko、de、fr、ru 等）
    #[serde(default = "default_source_language")]
    pub source_language: String,

    /// 语言提示列表（可选）
    #[serde(skip_serializing_if = "Option::is_none")]
    pub language_hints: Option<Vec<String>>,

    /// 定制热词ID（可选）
    #[serde(skip_serializing_if = "Option::is_none")]
    pub vocabulary_id: Option<String>,

    /// 不流畅词过滤（如：嗯、啊等语气词）
    #[serde(default)]
    pub disfluency_removal_enabled: bool,

    /// 标点符号预测（默认开启）
    #[serde(default = "default_true")]
    pub punctuation_prediction_enabled: bool,

    /// 逆文本正则化（默认开启）
    #[serde(default = "default_true")]
    pub itn_enabled: bool,

    /// 方言设置（可选，如：四川话、粤语等）
    #[serde(skip_serializing_if = "Option::is_none")]
    pub dialect: Option<String>,

    /// 情感识别（部分模型支持）
    #[serde(default)]
    pub emotion_enabled: bool,
}

// 默认值函数
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

impl Default for ServerConfig {
    fn default() -> Self {
        Self {
            ws_url: default_ws_url(),
            api_key: default_api_key(),
        }
    }
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
