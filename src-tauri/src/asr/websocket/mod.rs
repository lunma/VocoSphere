mod common;
pub mod gummy;
pub mod paraformer;

use crate::asr::config::{AsrModelConfig, GummyConfig, ParaformerConfig};

/// 统一的 ASR 启动接口
/// 根据配置类型自动选择对应的模型
pub async fn start_asr_with_config(
    receiver: Option<tokio::sync::mpsc::Receiver<Vec<f32>>>,
    config: AsrModelConfig,
) {
    match config {
        AsrModelConfig::Gummy(gummy_config) => {
            start_gummy_asr(receiver, gummy_config).await;
        }
        AsrModelConfig::Paraformer(paraformer_config) => {
            start_paraformer_asr(receiver, paraformer_config).await;
        }
    }
}

/// 启动 Gummy ASR 服务（带配置）
pub async fn start_gummy_asr(
    receiver: Option<tokio::sync::mpsc::Receiver<Vec<f32>>>,
    config: GummyConfig,
) {
    gummy::start_with_config(receiver, config).await;
}

/// 启动 Paraformer ASR 服务（带配置）
pub async fn start_paraformer_asr(
    receiver: Option<tokio::sync::mpsc::Receiver<Vec<f32>>>,
    config: ParaformerConfig,
) {
    paraformer::start_with_config(receiver, config).await;
}
