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
#[derive(Debug, Clone, Serialize, Deserialize, Default)]
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

/// 向后兼容别名，待后续任务迁移完毕后删除
#[deprecated(note = "use CloudStreamingConfig directly; remove after all callers are migrated")]
pub type AsrModelConfig = CloudStreamingConfig;

fn default_ws_url() -> String {
    "wss://dashscope.aliyuncs.com/api-ws/v1/inference/".to_string()
}

fn default_api_key() -> String {
    String::new()
}

fn default_source_language() -> String {
    "zh".to_string()
}

fn default_true() -> bool {
    true
}

fn default_oss_endpoint() -> String {
    String::new()
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
        let back: AsrProviderConfig = serde_json::from_str(&json).unwrap();
        if let AsrProviderConfig::Cloud(c) = back {
            assert_eq!(c.file_asr_api_key, "sk-xxx");
            assert_eq!(c.oss.bucket, "my-bucket");
        } else {
            panic!("expected Cloud variant");
        }
    }

    #[test]
    fn test_provider_config_roundtrip_local() {
        let config = AsrProviderConfig::Local(LocalAsrConfig {});
        let json = serde_json::to_string(&config).unwrap();
        let back: AsrProviderConfig = serde_json::from_str(&json).unwrap();
        assert!(matches!(back, AsrProviderConfig::Local(_)));
    }
}
