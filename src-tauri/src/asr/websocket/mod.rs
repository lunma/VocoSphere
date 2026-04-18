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
