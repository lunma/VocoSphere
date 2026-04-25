use crate::asr::config::LocalAsrConfig;
use crate::asr::events::{AsrResultEvent, AsrResultKind};
use crate::asr::AsrProvider;
use crate::app_state;
use async_trait::async_trait;
use serde::Deserialize;
use std::path::Path;
use tauri_plugin_shell::ShellExt;
use tokio::sync::mpsc;

pub struct LocalAsrProvider {
    config: LocalAsrConfig,
}

impl LocalAsrProvider {
    pub fn new(config: LocalAsrConfig) -> Self {
        Self { config }
    }
}

// ── whisper-cli JSON 输出结构 ──────────────────────────────────────────────────

#[derive(Deserialize)]
struct WhisperOutput {
    transcription: Vec<WhisperSegment>,
}

#[derive(Deserialize)]
struct WhisperSegment {
    offsets: WhisperOffsets,
    text: String,
}

#[derive(Deserialize)]
struct WhisperOffsets {
    from: u64,
    to: u64,
}

// ── Provider 实现 ─────────────────────────────────────────────────────────────

#[async_trait]
impl AsrProvider for LocalAsrProvider {
    async fn recognize_stream(&self, _rx: mpsc::Receiver<Vec<f32>>) -> anyhow::Result<()> {
        anyhow::bail!("本地 ASR 暂不支持流式识别，请切换至云端模式")
    }

    async fn recognize_file(
        &self,
        input_path: &Path,
        _output_path: &Path,
    ) -> anyhow::Result<Vec<AsrResultEvent>> {
        let app = app_state::get_app_handle()
            .ok_or_else(|| anyhow::anyhow!("AppHandle 未初始化"))?;

        let rec = &self.config.recognition;

        if rec.model_path.is_empty() {
            anyhow::bail!("请先在「模型」页配置本地语音识别模型路径");
        }

        // 将输入文件转为 16kHz 单声道 WAV（whisper-cli 要求）
        let wav_path = std::env::temp_dir().join("vocosphere_whisper_input.wav");
        let wav_str = wav_path.to_string_lossy().to_string();
        let input_str = input_path.to_string_lossy().to_string();

        let ffmpeg_out = app
            .shell()
            .sidecar("ffmpeg")
            .map_err(|e| anyhow::anyhow!("FFmpeg sidecar 错误: {e}"))?
            .args(["-y", "-i", &input_str, "-ar", "16000", "-ac", "1", "-vn", &wav_str])
            .output()
            .await
            .map_err(|e| anyhow::anyhow!("FFmpeg 执行失败: {e}"))?;

        if !ffmpeg_out.status.success() {
            let stderr = String::from_utf8_lossy(&ffmpeg_out.stderr);
            anyhow::bail!("FFmpeg 音频提取失败: {stderr}");
        }

        // 运行 whisper-cli，输出 JSON 到临时目录
        let out_prefix = std::env::temp_dir().join("vocosphere_whisper_out");
        let out_prefix_str = out_prefix.to_string_lossy().to_string();

        let lang_arg = if rec.language == "auto" { "auto".to_string() } else { rec.language.clone() };
        let threads_arg = rec.n_threads.to_string();

        let whisper_out = app
            .shell()
            .sidecar("whisper-cli")
            .map_err(|e| anyhow::anyhow!("whisper-cli sidecar 错误: {e}"))?
            .args([
                "-m", &rec.model_path,
                "-f", &wav_str,
                "-l", &lang_arg,
                "-p", &threads_arg,
                "-oj",
                "-of", &out_prefix_str,
                "--no-timestamps", "false",
            ])
            .output()
            .await
            .map_err(|e| anyhow::anyhow!("whisper-cli 执行失败: {e}"))?;

        if !whisper_out.status.success() {
            let stderr = String::from_utf8_lossy(&whisper_out.stderr);
            anyhow::bail!("whisper-cli 识别失败: {stderr}");
        }

        // 读取并解析 JSON 输出（whisper-cli 生成 <prefix>.json）
        let json_path = format!("{out_prefix_str}.json");
        let json_bytes = tokio::fs::read(&json_path)
            .await
            .map_err(|e| anyhow::anyhow!("读取 whisper-cli 输出失败: {json_path}: {e}"))?;

        let parsed: WhisperOutput = serde_json::from_slice(&json_bytes)
            .map_err(|e| anyhow::anyhow!("解析 whisper-cli JSON 失败: {e}"))?;

        let events: Vec<AsrResultEvent> = parsed
            .transcription
            .into_iter()
            .enumerate()
            .filter(|(_, seg)| !seg.text.trim().is_empty())
            .map(|(idx, seg)| AsrResultEvent {
                sentence_id: idx as u32,
                begin_time: seg.offsets.from,
                end_time: Some(seg.offsets.to),
                text: seg.text.trim().to_string(),
                is_final: true,
                kind: AsrResultKind::Transcription,
                lang: Some(rec.language.clone()),
            })
            .collect();

        Ok(events)
    }
}
