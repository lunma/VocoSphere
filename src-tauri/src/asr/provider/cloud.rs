use crate::asr::config::{CloudAsrConfig, OssConfig};
use crate::asr::events::{AsrResultEvent, AsrResultKind};
use crate::asr::subtitle::srt;
use crate::asr::websocket;
use crate::asr::AsrProvider;
use anyhow::Context;
use async_trait::async_trait;
use base64::{engine::general_purpose::STANDARD as BASE64, Engine as _};
use hmac::{Hmac, Mac};
use log::{info, warn};
use reqwest::Client;
use serde::Deserialize;
use sha1::Sha1;
use std::path::Path;
use tokio::sync::mpsc;
use uuid::Uuid;

type HmacSha1 = Hmac<Sha1>;

pub struct CloudAsrProvider {
    config: CloudAsrConfig,
}

impl CloudAsrProvider {
    pub fn new(config: CloudAsrConfig) -> Self {
        Self { config }
    }
}

#[async_trait]
impl AsrProvider for CloudAsrProvider {
    async fn recognize_stream(&self, rx: mpsc::Receiver<Vec<f32>>) -> anyhow::Result<()> {
        websocket::start_asr_with_config(Some(rx), self.config.streaming.clone()).await;
        Ok(())
    }

    async fn recognize_file(
        &self,
        input_path: &Path,
        output_path: &Path,
    ) -> anyhow::Result<Vec<AsrResultEvent>> {
        let ext = input_path
            .extension()
            .and_then(|e| e.to_str())
            .unwrap_or("bin");
        let object_key = format!("vocosphere/tmp/{}.{}", Uuid::new_v4(), ext);

        let data = std::fs::read(input_path)
            .with_context(|| format!("无法读取文件: {}", input_path.display()))?;

        info!("上传文件到 OSS: {}", object_key);
        let oss = OssClient::new(&self.config.oss);
        let public_url = oss
            .upload(data, &object_key, "application/octet-stream")
            .await?;
        info!("文件上传完成: {}", public_url);

        let fun_asr = FunAsrClient::new(self.config.file_asr_api_key.clone());
        let task_id = fun_asr.submit_task(&public_url).await?;
        info!("Fun-ASR 任务已提交: {}", task_id);

        let transcription_url = fun_asr.wait_for_result(&task_id).await?;
        info!("Fun-ASR 任务完成，结果 URL: {}", transcription_url);

        let sentences = fun_asr.download_transcription(&transcription_url).await?;
        info!("识别完成，共 {} 条句子", sentences.len());

        let events: Vec<AsrResultEvent> = sentences
            .iter()
            .enumerate()
            .map(|(idx, s)| AsrResultEvent {
                sentence_id: idx as u32,
                begin_time: s.begin_time,
                end_time: Some(s.end_time),
                text: s.text.clone(),
                is_final: true,
                kind: AsrResultKind::Transcription,
                lang: None,
            })
            .collect();

        srt::write_srt(&events, output_path)?;
        info!("SRT 文件已写出: {}", output_path.display());

        if let Err(e) = oss.delete(&object_key).await {
            warn!("删除 OSS 临时文件失败（不影响结果）: {}", e);
        }

        Ok(events)
    }
}

// ── OSS 客户端 ──────────────────────────────────────────────────────────────

struct OssClient<'a> {
    config: &'a OssConfig,
    client: Client,
}

impl<'a> OssClient<'a> {
    fn new(config: &'a OssConfig) -> Self {
        Self {
            config,
            client: Client::new(),
        }
    }

    async fn upload(
        &self,
        data: Vec<u8>,
        object_key: &str,
        content_type: &str,
    ) -> anyhow::Result<String> {
        let date = chrono::Utc::now()
            .format("%a, %d %b %Y %H:%M:%S GMT")
            .to_string();
        let signature = sign_oss_put(
            &self.config.access_key_secret,
            content_type,
            &date,
            &self.config.bucket,
            object_key,
        );
        let auth = format!("OSS {}:{}", self.config.access_key_id, signature);
        let url = format!(
            "https://{}.{}/{}",
            self.config.bucket, self.config.endpoint, object_key
        );

        let resp = self
            .client
            .put(&url)
            .header("Date", &date)
            .header("Content-Type", content_type)
            .header("x-oss-object-acl", "public-read")
            .header("Authorization", auth)
            .body(data)
            .send()
            .await
            .context("OSS PUT 请求失败")?;

        if !resp.status().is_success() {
            let status = resp.status();
            let body = resp.text().await.unwrap_or_default();
            anyhow::bail!("OSS 上传失败: HTTP {} — {}", status, body);
        }
        Ok(url)
    }

    async fn delete(&self, object_key: &str) -> anyhow::Result<()> {
        let date = chrono::Utc::now()
            .format("%a, %d %b %Y %H:%M:%S GMT")
            .to_string();
        let resource = format!("/{}/{}", self.config.bucket, object_key);
        let string_to_sign = format!("DELETE\n\n\n{}\n{}", date, resource);
        let mut mac = HmacSha1::new_from_slice(self.config.access_key_secret.as_bytes())
            .expect("valid key");
        mac.update(string_to_sign.as_bytes());
        let sig = BASE64.encode(mac.finalize().into_bytes());
        let auth = format!("OSS {}:{}", self.config.access_key_id, sig);
        let url = format!(
            "https://{}.{}/{}",
            self.config.bucket, self.config.endpoint, object_key
        );

        let resp = self
            .client
            .delete(&url)
            .header("Date", &date)
            .header("Authorization", auth)
            .send()
            .await
            .context("OSS DELETE 请求失败")?;

        if !resp.status().is_success() && resp.status().as_u16() != 404 {
            let status = resp.status();
            let body = resp.text().await.unwrap_or_default();
            anyhow::bail!("OSS 删除失败: HTTP {} — {}", status, body);
        }
        Ok(())
    }
}

/// OSS v1 签名：PUT 含 x-oss-object-acl:public-read
fn sign_oss_put(
    access_key_secret: &str,
    content_type: &str,
    date: &str,
    bucket: &str,
    object_key: &str,
) -> String {
    let canonicalized_headers = "x-oss-object-acl:public-read\n";
    let canonicalized_resource = format!("/{}/{}", bucket, object_key);
    let string_to_sign = format!(
        "PUT\n\n{}\n{}\n{}{}",
        content_type, date, canonicalized_headers, canonicalized_resource
    );
    let mut mac =
        HmacSha1::new_from_slice(access_key_secret.as_bytes()).expect("HMAC key valid");
    mac.update(string_to_sign.as_bytes());
    BASE64.encode(mac.finalize().into_bytes())
}

// ── Fun-ASR 客户端 ──────────────────────────────────────────────────────────

const FUNASR_API_BASE: &str = "https://dashscope.aliyuncs.com/api/v1";
const POLL_INTERVAL_SECS: u64 = 3;
const POLL_MAX_RETRIES: u32 = 200;

struct FunAsrClient {
    api_key: String,
    client: Client,
}

impl FunAsrClient {
    fn new(api_key: String) -> Self {
        Self {
            api_key,
            client: Client::new(),
        }
    }

    async fn submit_task(&self, file_url: &str) -> anyhow::Result<String> {
        let body = serde_json::json!({
            "model": "fun-asr",
            "input": { "file_urls": [file_url] },
            "parameters": {}
        });

        let resp = self
            .client
            .post(format!("{}/services/audio/asr/transcription", FUNASR_API_BASE))
            .header("Authorization", format!("Bearer {}", self.api_key))
            .header("X-DashScope-Async", "enable")
            .json(&body)
            .send()
            .await
            .context("Fun-ASR 提交任务请求失败")?;

        if !resp.status().is_success() {
            let status = resp.status();
            let text = resp.text().await.unwrap_or_default();
            anyhow::bail!("Fun-ASR 提交失败: HTTP {} — {}", status, text);
        }

        let result: TaskSubmitResponse = resp.json().await.context("解析提交响应失败")?;
        Ok(result.output.task_id)
    }

    async fn wait_for_result(&self, task_id: &str) -> anyhow::Result<String> {
        for attempt in 0..POLL_MAX_RETRIES {
            tokio::time::sleep(tokio::time::Duration::from_secs(POLL_INTERVAL_SECS)).await;

            let resp = self
                .client
                .get(format!("{}/tasks/{}", FUNASR_API_BASE, task_id))
                .header("Authorization", format!("Bearer {}", self.api_key))
                .send()
                .await
                .context("Fun-ASR 查询任务请求失败")?;

            if !resp.status().is_success() {
                let status = resp.status();
                let text = resp.text().await.unwrap_or_default();
                anyhow::bail!("Fun-ASR 查询失败: HTTP {} — {}", status, text);
            }

            let result: TaskQueryResponse = resp.json().await.context("解析查询响应失败")?;

            match result.output.task_status.as_str() {
                "SUCCEEDED" => {
                    let url = result
                        .output
                        .results
                        .and_then(|r| r.into_iter().find(|r| r.subtask_status == "SUCCEEDED"))
                        .map(|r| r.transcription_url)
                        .context("SUCCEEDED 但未找到 transcription_url")?;
                    return Ok(url);
                }
                "FAILED" => anyhow::bail!("Fun-ASR 任务失败"),
                status => {
                    info!("Fun-ASR 任务状态: {}（第 {} 次轮询）", status, attempt + 1);
                }
            }
        }
        anyhow::bail!("Fun-ASR 任务超时（超过 {} 次轮询）", POLL_MAX_RETRIES)
    }

    async fn download_transcription(&self, url: &str) -> anyhow::Result<Vec<FunAsrSentence>> {
        let resp = self
            .client
            .get(url)
            .send()
            .await
            .context("下载 transcription 结果失败")?;

        if !resp.status().is_success() {
            anyhow::bail!("下载识别结果失败: HTTP {}", resp.status());
        }

        let result: TranscriptionResponse =
            resp.json().await.context("解析识别结果 JSON 失败")?;

        Ok(result
            .transcripts
            .into_iter()
            .next()
            .map(|t| t.sentences)
            .unwrap_or_default())
    }
}

// ── 内部响应类型 ─────────────────────────────────────────────────────────────

#[derive(Deserialize)]
struct TaskSubmitResponse {
    output: TaskSubmitOutput,
}
#[derive(Deserialize)]
struct TaskSubmitOutput {
    task_id: String,
}
#[derive(Deserialize)]
struct TaskQueryResponse {
    output: TaskQueryOutput,
}
#[derive(Deserialize)]
struct TaskQueryOutput {
    task_status: String,
    results: Option<Vec<TaskResult>>,
}
#[derive(Deserialize)]
struct TaskResult {
    transcription_url: String,
    subtask_status: String,
}
#[derive(Deserialize)]
struct TranscriptionResponse {
    transcripts: Vec<Transcript>,
}
#[derive(Deserialize)]
struct Transcript {
    sentences: Vec<FunAsrSentence>,
}
#[derive(Deserialize)]
struct FunAsrSentence {
    text: String,
    begin_time: u64,
    end_time: u64,
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_sign_oss_put_is_base64() {
        let sig = sign_oss_put(
            "wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY",
            "application/octet-stream",
            "Thu, 01 Jan 2026 00:00:00 GMT",
            "my-bucket",
            "vocosphere/tmp/test.wav",
        );
        assert!(!sig.is_empty());
        assert!(sig
            .chars()
            .all(|c| c.is_alphanumeric() || c == '+' || c == '/' || c == '='));
    }

    #[test]
    fn test_sign_oss_put_deterministic() {
        let sig1 = sign_oss_put(
            "secret",
            "audio/wav",
            "Mon, 01 Jan 2024 12:00:00 GMT",
            "bucket",
            "key.wav",
        );
        let sig2 = sign_oss_put(
            "secret",
            "audio/wav",
            "Mon, 01 Jan 2024 12:00:00 GMT",
            "bucket",
            "key.wav",
        );
        assert_eq!(sig1, sig2);
    }
}
