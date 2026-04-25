use crate::asr::config::AsrProviderConfig;
use crate::asr::events::AsrResultEvent;
use crate::asr::provider::{CloudAsrProvider, LocalAsrProvider};
use crate::asr::AsrProvider;
use reqwest::Client;
use serde::Deserialize;
use std::fmt::Write as FmtWrite;
use tauri::Emitter;
use tauri_plugin_shell::process::CommandEvent;
use tauri_plugin_shell::ShellExt;

/// 前端传入的单条字幕（用于导出）
#[derive(Debug, Deserialize)]
pub struct SubtitleItem {
    #[allow(dead_code)]
    pub id: u32,
    pub begin_ms: u64,
    pub end_ms: u64,
    pub text: String,
}

/// 调用 ffmpeg sidecar 获取版本信息，验证 sidecar 配置是否正确
#[tauri::command]
pub async fn get_ffmpeg_version(app: tauri::AppHandle) -> Result<String, String> {
    let output = app
        .shell()
        .sidecar("ffmpeg")
        .map_err(|e| e.to_string())?
        .args(["-version"])
        .output()
        .await
        .map_err(|e| e.to_string())?;

    if output.status.success() {
        let stdout = String::from_utf8_lossy(&output.stdout);
        let first_line = stdout.lines().next().unwrap_or("").to_string();
        Ok(first_line)
    } else {
        let stderr = String::from_utf8_lossy(&output.stderr).to_string();
        Err(stderr)
    }
}

/// 检测 FFmpeg sidecar 是否内置 subtitles 滤镜（依赖 libass）
/// 返回 true 表示支持字幕烧录，false 表示不支持
#[tauri::command]
pub async fn check_ffmpeg_subtitle_support(app: tauri::AppHandle) -> Result<bool, String> {
    let output = app
        .shell()
        .sidecar("ffmpeg")
        .map_err(|e| e.to_string())?
        .args(["-filters"])
        .output()
        .await
        .map_err(|e| e.to_string())?;

    // ffmpeg -filters 将结果输出到 stdout；部分版本也会在 stderr 输出
    let stdout = String::from_utf8_lossy(&output.stdout);
    let stderr = String::from_utf8_lossy(&output.stderr);
    Ok(stdout.contains("subtitles") || stderr.contains("subtitles"))
}

/// 打开视频文件选择对话框，返回所选文件的绝对路径（用户取消则返回 null）
#[tauri::command]
pub async fn select_video(app: tauri::AppHandle) -> Result<Option<String>, String> {
    use tauri_plugin_dialog::DialogExt;

    let path = tauri::async_runtime::spawn_blocking(move || {
        app.dialog()
            .file()
            .add_filter("视频文件", &["mp4", "mkv", "avi", "mov", "webm", "m4v"])
            .blocking_pick_file()
    })
    .await
    .map_err(|e| e.to_string())?;

    Ok(path
        .and_then(|p| p.into_path().ok())
        .map(|p| p.to_string_lossy().to_string()))
}

/// 打开文件选择对话框，用于选取本地 Whisper 模型文件（.bin）
#[tauri::command]
pub async fn select_model_file(app: tauri::AppHandle) -> Result<Option<String>, String> {
    use tauri_plugin_dialog::DialogExt;

    let path = tauri::async_runtime::spawn_blocking(move || {
        app.dialog()
            .file()
            .add_filter("Whisper 模型", &["bin"])
            .blocking_pick_file()
    })
    .await
    .map_err(|e| e.to_string())?;

    Ok(path
        .and_then(|p| p.into_path().ok())
        .map(|p| p.to_string_lossy().to_string()))
}

/// 用 FFmpeg sidecar 从视频中提取 16kHz 单声道 WAV，写入系统临时目录
/// 返回生成的 WAV 文件绝对路径
#[tauri::command]
pub async fn extract_audio(app: tauri::AppHandle, video_path: String) -> Result<String, String> {
    let out_path = std::env::temp_dir().join("vocosphere_video_audio.wav");
    let out_str = out_path.to_string_lossy().to_string();

    let output = app
        .shell()
        .sidecar("ffmpeg")
        .map_err(|e| e.to_string())?
        .args([
            "-y",
            "-i",
            &video_path,
            "-ar",
            "16000",
            "-ac",
            "1",
            "-vn",
            &out_str,
        ])
        .output()
        .await
        .map_err(|e| e.to_string())?;

    if output.status.success() {
        Ok(out_str)
    } else {
        Err(String::from_utf8_lossy(&output.stderr).to_string())
    }
}

/// 文件 ASR：直接传入原始视频/音频文件路径，上传 OSS 后调用云端识别
/// Fun-ASR 原生支持 mp4/mkv/mov 等格式，无需提前提取音轨
/// 返回识别结果数组（前端再编辑，最终通过 export_video_with_subtitles 导出）
#[tauri::command]
pub async fn start_video_asr(
    config: AsrProviderConfig,
    file_path: String,
) -> Result<Vec<AsrResultEvent>, String> {
    // 2 GB 预检：OSS 单次上传限制 5 GB，但实际 ASR 建议不超过 2 GB
    const MAX_BYTES: u64 = 2 * 1024 * 1024 * 1024;
    let file_size = std::fs::metadata(&file_path)
        .map(|m| m.len())
        .unwrap_or(0);
    if file_size > MAX_BYTES {
        return Err(format!(
            "文件大小 {:.1} GB 超过 2 GB 限制，请先压缩视频后再处理",
            file_size as f64 / (1024.0 * 1024.0 * 1024.0)
        ));
    }

    let temp_srt = std::env::temp_dir().join("vocosphere_video_asr.srt");
    let provider: Box<dyn AsrProvider> = match config {
        AsrProviderConfig::Cloud(c) => Box::new(CloudAsrProvider::new(c)),
        AsrProviderConfig::Local(c) => Box::new(LocalAsrProvider::new(c)),
    };
    provider
        .recognize_file(std::path::Path::new(&file_path), &temp_srt)
        .await
        .map_err(|e| e.to_string())
}

/// 将前端字幕数组写成 SRT 并用 FFmpeg sidecar 烧录进视频
/// 通过 Tauri 事件 `video-export-progress` 实时推送进度（0-100）
#[tauri::command]
pub async fn export_video_with_subtitles(
    app: tauri::AppHandle,
    video_path: String,
    subtitles: Vec<SubtitleItem>,
    output_path: String,
) -> Result<String, String> {
    let srt_path = std::env::temp_dir().join("vocosphere_export_subtitles.srt");
    std::fs::write(&srt_path, build_srt(&subtitles)).map_err(|e| e.to_string())?;

    let srt_str = srt_path.to_string_lossy().to_string();
    let srt_filter = build_subtitles_filter_path(&srt_str);

    // 先获取视频时长用于进度百分比计算（失败时降级为 0，仅显示旋转动画）
    let duration_ms = get_video_duration_ms(&app, &video_path).await.unwrap_or(0);

    let (mut rx, _child) = app
        .shell()
        .sidecar("ffmpeg")
        .map_err(|e| e.to_string())?
        .args([
            "-y",
            "-i",
            &video_path,
            "-vf",
            &format!("subtitles='{}'", srt_filter),
            "-c:a",
            "copy",
            "-progress",
            "pipe:1",
            &output_path,
        ])
        .spawn()
        .map_err(|e| e.to_string())?;

    let mut stderr_buf = String::new();

    while let Some(event) = rx.recv().await {
        match event {
            CommandEvent::Stdout(line) => {
                let text = String::from_utf8_lossy(&line);
                if let Some(time_str) = text.trim().strip_prefix("out_time=") {
                    if let Some(ms) = parse_ffmpeg_time(time_str.trim()) {
                        let percent = if duration_ms > 0 {
                            ((ms * 100) / duration_ms).min(99)
                        } else {
                            0
                        };
                        app.emit("video-export-progress", percent).ok();
                    }
                }
            }
            CommandEvent::Stderr(line) => {
                stderr_buf.push_str(&String::from_utf8_lossy(&line));
                stderr_buf.push('\n');
            }
            CommandEvent::Terminated(status) => {
                if status.code.unwrap_or(1) != 0 {
                    if stderr_buf.contains("libass")
                        || (stderr_buf.contains("subtitles")
                            && stderr_buf.contains("No such filter"))
                    {
                        return Err("字幕烧录失败：当前 FFmpeg 不支持 subtitles 滤镜（缺少 libass）。请使用包含 libass 的 FFmpeg 版本。".to_string());
                    }
                    return Err(stderr_buf);
                }
                app.emit("video-export-progress", 100u64).ok();
            }
            _ => {}
        }
    }

    Ok(output_path)
}

/// 解析 FFmpeg -progress 输出的 out_time 字段（格式 HH:MM:SS.ffffff）为毫秒
fn parse_ffmpeg_time(s: &str) -> Option<u64> {
    let parts: Vec<&str> = s.split(':').collect();
    if parts.len() != 3 {
        return None;
    }
    let h: u64 = parts[0].trim().parse().ok()?;
    let m: u64 = parts[1].trim().parse().ok()?;
    let sec: f64 = parts[2].trim().parse().ok()?;
    Some(h * 3_600_000 + m * 60_000 + (sec * 1000.0) as u64)
}

/// 通过 `ffmpeg -i` 从 stderr 解析视频总时长（毫秒），失败返回 Err
async fn get_video_duration_ms(app: &tauri::AppHandle, video_path: &str) -> anyhow::Result<u64> {
    let output = app
        .shell()
        .sidecar("ffmpeg")
        .map_err(|e| anyhow::anyhow!(e.to_string()))?
        .args(["-i", video_path, "-f", "null", "-"])
        .output()
        .await
        .map_err(|e| anyhow::anyhow!(e.to_string()))?;

    let stderr = String::from_utf8_lossy(&output.stderr);
    for line in stderr.lines() {
        if let Some(pos) = line.find("Duration:") {
            let time_str = line[pos + 9..]
                .trim()
                .split(',')
                .next()
                .unwrap_or("")
                .trim();
            if let Some(ms) = parse_ffmpeg_time(time_str) {
                return Ok(ms);
            }
        }
    }
    anyhow::bail!("could not parse duration from ffmpeg output")
}

/// 批量翻译字幕文本
/// api_key:     DashScope API Key（复用 ASR 配置中的同一个 Key）
/// texts:       待翻译文本列表
/// target_lang: 目标语言代码，默认 "zh"（中文）
#[tauri::command]
pub async fn translate_subtitles(
    api_key: String,
    texts: Vec<String>,
    target_lang: String,
) -> Result<Vec<String>, String> {
    if texts.is_empty() {
        return Ok(vec![]);
    }

    let lang_label = match target_lang.as_str() {
        "zh" => "中文",
        "en" => "英文",
        "ja" => "日文",
        "ko" => "韩文",
        "fr" => "法文",
        "de" => "德文",
        "es" => "西班牙文",
        "ru" => "俄文",
        other => other,
    };

    // 每批最多 80 条，避免超出上下文限制
    const BATCH: usize = 80;
    let mut result: Vec<String> = Vec::with_capacity(texts.len());

    let client = Client::new();

    for chunk in texts.chunks(BATCH) {
        let input_json = serde_json::to_string(chunk).map_err(|e| e.to_string())?;

        let body = serde_json::json!({
            "model": "qwen-turbo",
            "input": {
                "messages": [
                    {
                        "role": "system",
                        "content": format!(
                            "你是专业字幕翻译器。将输入的 JSON 字符串数组中每条字幕翻译为{}，\
                             保持原有顺序和数量，直接输出合法 JSON 数组，不要有任何解释或额外内容。",
                            lang_label
                        )
                    },
                    {
                        "role": "user",
                        "content": input_json
                    }
                ]
            },
            "parameters": { "result_format": "message" }
        });

        let resp = client
            .post("https://dashscope.aliyuncs.com/api/v1/services/aigc/text-generation/generation")
            .header("Authorization", format!("Bearer {}", api_key))
            .json(&body)
            .send()
            .await
            .map_err(|e| e.to_string())?;

        if !resp.status().is_success() {
            let status = resp.status();
            let text = resp.text().await.unwrap_or_default();
            return Err(format!("翻译 API 错误: HTTP {} — {}", status, text));
        }

        let json: serde_json::Value = resp.json().await.map_err(|e| e.to_string())?;

        let content = json
            .pointer("/output/choices/0/message/content")
            .and_then(|v| v.as_str())
            .ok_or_else(|| "翻译响应格式异常".to_string())?;

        // 容忍模型在 JSON 前后附加 markdown 代码块
        let content = content
            .trim()
            .trim_start_matches("```json")
            .trim_start_matches("```")
            .trim_end_matches("```")
            .trim();

        let batch_result: Vec<String> =
            serde_json::from_str(content).map_err(|_| {
                format!("翻译结果解析失败，原始内容：{}", content)
            })?;

        if batch_result.len() != chunk.len() {
            return Err(format!(
                "翻译结果数量不匹配：期望 {}，实际 {}",
                chunk.len(),
                batch_result.len()
            ));
        }

        result.extend(batch_result);
    }

    Ok(result)
}

// ── 内部工具函数 ──────────────────────────────────────────────────────────────

fn ms_to_srt_time(ms: u64) -> String {
    let h = ms / 3_600_000;
    let m = (ms % 3_600_000) / 60_000;
    let s = (ms % 60_000) / 1_000;
    let millis = ms % 1_000;
    format!("{:02}:{:02}:{:02},{:03}", h, m, s, millis)
}

fn build_srt(items: &[SubtitleItem]) -> String {
    let mut out = String::new();
    for (idx, item) in items.iter().enumerate() {
        let end_ms = if item.end_ms > item.begin_ms {
            item.end_ms
        } else {
            item.begin_ms + 2000
        };
        writeln!(out, "{}", idx + 1).unwrap();
        writeln!(
            out,
            "{} --> {}",
            ms_to_srt_time(item.begin_ms),
            ms_to_srt_time(end_ms)
        )
        .unwrap();
        writeln!(out, "{}", item.text).unwrap();
        writeln!(out).unwrap();
    }
    out
}

/// 对 subtitles filter 的路径进行平台适配转义
fn build_subtitles_filter_path(path: &str) -> String {
    #[cfg(target_os = "windows")]
    {
        // Windows：反斜杠 → 正斜杠，冒号需转义（驱动器号后的 : → \:）
        path.replace('\\', "/").replacen(':', r"\:", 1)
    }
    #[cfg(not(target_os = "windows"))]
    {
        path.replace('\'', r"\'")
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_ms_to_srt_time() {
        assert_eq!(ms_to_srt_time(0), "00:00:00,000");
        assert_eq!(ms_to_srt_time(1200), "00:00:01,200");
        assert_eq!(ms_to_srt_time(3_661_500), "01:01:01,500");
    }

    #[test]
    fn test_build_srt_basic() {
        let items = vec![
            SubtitleItem { id: 0, begin_ms: 1000, end_ms: 3000, text: "Hello".into() },
            SubtitleItem { id: 1, begin_ms: 4000, end_ms: 6500, text: "World".into() },
        ];
        let srt = build_srt(&items);
        assert!(srt.contains("00:00:01,000 --> 00:00:03,000"));
        assert!(srt.contains("Hello"));
        assert!(srt.contains("00:00:04,000 --> 00:00:06,500"));
    }

    #[test]
    fn test_build_srt_fallback_end() {
        let items = vec![SubtitleItem { id: 0, begin_ms: 5000, end_ms: 0, text: "X".into() }];
        let srt = build_srt(&items);
        // end_ms ≤ begin_ms → fallback +2000ms
        assert!(srt.contains("00:00:05,000 --> 00:00:07,000"));
    }
}
