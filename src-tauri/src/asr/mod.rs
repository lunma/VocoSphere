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
