// 共用模块：包含所有模型共用的 WebSocket 连接和音频处理逻辑
// 注意：识别结果处理逻辑和协议相关逻辑已移至各模型目录下
// 本模块不依赖任何模型的协议定义，保持完全独立
use futures::stream::{SplitSink, SplitStream};
use futures::{SinkExt, StreamExt};
use log::{info, warn};
use std::time::Instant;
use tokio::net::TcpStream;
use tokio::sync::mpsc;
use tokio_tungstenite::{MaybeTlsStream, WebSocketStream};
use tungstenite::client::IntoClientRequest;
use tungstenite::{Bytes, Message};

// 音频处理工具：将f32采样转换为16位PCM字节流
pub(crate) mod audio_processor {
    /// 将f32音频采样（范围[-1.0, 1.0]）转换为16位有符号整数PCM
    pub fn f32_to_pcm16(sample: f32) -> i16 {
        let clamped = sample.clamp(-1.0, 1.0);
        (clamped * 32767.0) as i16
    }

    /// 将Vec<f32>批量转换为PCM字节流（小端序）
    pub fn f32_vec_to_pcm_bytes(samples: &[f32]) -> Vec<u8> {
        let mut bytes = Vec::with_capacity(samples.len() * 2);
        for &sample in samples {
            let pcm = f32_to_pcm16(sample);
            bytes.extend_from_slice(&pcm.to_le_bytes());
        }
        bytes
    }
}

pub(crate) struct WsStream {
    pub ws_write: SplitSink<WebSocketStream<MaybeTlsStream<TcpStream>>, Message>,
    pub ws_read: SplitStream<WebSocketStream<MaybeTlsStream<TcpStream>>>,
}

/// 建立 WebSocket 连接
pub(crate) async fn connect(ws_url: &str, api_key: &str) -> WsStream {
    info!("websocket connecting to: {}", ws_url);

    let mut request = ws_url.into_client_request().unwrap();
    let headers = request.headers_mut();
    headers.insert(
        "Authorization",
        format!("Bearer {}", api_key).parse().unwrap(),
    );

    // 内容检查：可通过环境变量 DISABLE_DATA_INSPECTION=true 禁用
    // 如果遇到 DataInspectionFailed 错误，可以设置此环境变量
    let disable_inspection = std::env::var("DISABLE_DATA_INSPECTION")
        .unwrap_or_else(|_| "false".to_string())
        .parse::<bool>()
        .unwrap_or(false);

    if !disable_inspection {
        headers.insert("X-DashScope-DataInspection", "enable".parse().unwrap());
        info!("📋 内容检查已启用（可通过 DISABLE_DATA_INSPECTION=true 禁用）");
    } else {
        warn!("⚠️ 内容检查已禁用（DISABLE_DATA_INSPECTION=true）");
    }

    let (ws_stream, response) =
        tokio_tungstenite::connect_async_tls_with_config(request, None, false, None)
            .await
            .unwrap();

    // 打印连接响应信息
    info!("WebSocket 连接响应状态码: {}", response.status());
    info!(
        "WebSocket 连接响应状态文本: {}",
        response.status().canonical_reason().unwrap_or("未知")
    );
    info!("WebSocket 连接响应头部:");
    for (name, value) in response.headers() {
        if let Ok(value_str) = value.to_str() {
            info!("  {}: {}", name, value_str);
        } else {
            info!("  {}: <二进制数据>", name);
        }
    }

    let (ws_write, ws_read) = ws_stream.split();
    WsStream { ws_write, ws_read }
}

/// 发送音频流到 WebSocket
/// 返回 ws_write 供调用者发送结束指令
/// 注意：不包含任何协议相关的逻辑，只负责音频流发送
pub(crate) async fn send_audio_stream(
    receiver: &mut mpsc::Receiver<Vec<f32>>,
    mut ws_write: SplitSink<WebSocketStream<MaybeTlsStream<TcpStream>>, Message>,
) -> SplitSink<WebSocketStream<MaybeTlsStream<TcpStream>>, Message> {
    let start_time = Instant::now();
    let mut total_bytes = 0u64;
    let mut frame_count = 0u64;
    let mut last_stats_time = Instant::now();

    while let Some(samples) = receiver.recv().await {
        // 转换f32音频数据为PCM字节流
        let pcm_bytes = audio_processor::f32_vec_to_pcm_bytes(&samples);
        let pcm_bytes_len = pcm_bytes.len();

        // 发送音频数据到WebSocket（实时流，不延迟以保持低延迟）
        if let Err(e) = ws_write.send(Message::Binary(Bytes::from(pcm_bytes))).await {
            // 发送失败可能是连接断开，记录警告但不立即停止
            // 让上层逻辑决定是否重连
            warn!("⚠️ 发送音频失败: {}（连接可能已断开，继续尝试）", e);
            // 短暂延迟后继续，避免快速重试导致资源浪费
            tokio::time::sleep(std::time::Duration::from_millis(100)).await;
            // 继续尝试发送（而不是立即返回），让调用者决定何时停止
        }

        // 统计发送情况
        total_bytes += pcm_bytes_len as u64;
        frame_count += 1;

        // 每5秒打印一次发送统计
        let elapsed = last_stats_time.elapsed();
        if elapsed.as_secs() >= 5 {
            let duration = start_time.elapsed().as_secs_f64();
            let avg_bitrate = (total_bytes as f64 * 8.0 / duration) / 1000.0; // kbps
            info!(
                "📤 发送统计: {} 帧, {:.1} KB, 平均 {:.1} kbps, 速率: {:.1} 帧/秒",
                frame_count,
                total_bytes as f64 / 1024.0,
                avg_bitrate,
                frame_count as f64 / duration
            );
            last_stats_time = Instant::now();
        }

        // 实时流不需要延迟，让tokio调度器自然处理
        tokio::task::yield_now().await;
    }

    info!("音频流发送完成");
    ws_write
}
