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
