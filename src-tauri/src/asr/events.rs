use serde::Serialize;

/// 前端监听的事件名称
pub const ASR_RESULT_EVENT: &str = "asr-result";

/// 结果类型：原始识别结果或翻译结果
#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "snake_case")]
pub enum AsrResultKind {
    Transcription,
    Translation,
}

/// 发送给前端的识别/翻译结果
#[derive(Debug, Clone, Serialize)]
pub struct AsrResultEvent {
    pub sentence_id: u32,
    pub begin_time: u64,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub end_time: Option<u64>,
    pub text: String,
    pub is_final: bool,
    pub kind: AsrResultKind,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub lang: Option<String>,
}
