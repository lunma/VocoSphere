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
