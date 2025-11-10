// Gummy 模型实现
// 参考文档：https://help.aliyun.com/zh/model-studio/gummy-real-time-speech-recognition
use crate::asr::config::GummyConfig;
use crate::asr::websocket::common::{connect, send_audio_stream, WsStream};
use crate::asr::websocket::gummy::handler::process_result;
use crate::asr::websocket::gummy::protocol::{Event, Header, Parameters, Payload};
use futures::stream::{SplitSink, SplitStream};
use futures::{SinkExt, StreamExt};
use log::{debug, error, info, warn};
use std::collections::HashMap;
use std::fs::File;
use std::io::Read;
use std::time::Duration;
use tokio::net::TcpStream;
use tokio::sync::mpsc;
use tokio_tungstenite::{MaybeTlsStream, WebSocketStream};
use tungstenite::{Message, Utf8Bytes};
use uuid::Uuid;

// 音频文件路径
const AUDIO_FILE: &str = "hello_world.wav";

/// 启动 Gummy 模型识别（带配置）
pub async fn start_with_config(receiver: Option<mpsc::Receiver<Vec<f32>>>, config: GummyConfig) {
    let ws_stream = connect(&config.server_config.ws_url, &config.server_config.api_key).await;
    let WsStream {
        mut ws_write,
        mut ws_read,
    } = ws_stream;
    let task_id = Uuid::new_v4().to_string().replace("-", "");
    info!("task_id:{} , length:{}", task_id, task_id.len());

    info!("使用 Gummy ASR 模型，配置: {:?}", config);
    info!("  - 特点：低延迟，专为实时流式识别优化");
    info!("  - 适用：实时语音识别、实时字幕、会议记录");
    info!("  - 文档：https://help.aliyun.com/zh/model-studio/gummy-real-time-speech-recognition");

    info!("功能配置:");
    info!(
        "  - 识别功能: {}",
        if config.punctuation_prediction_enabled {
            "✅ 开启"
        } else {
            "❌ 关闭"
        }
    );
    info!(
        "  - 翻译功能: {}",
        if config.translation_enabled {
            "✅ 开启"
        } else {
            "❌ 关闭"
        }
    );

    if !config.punctuation_prediction_enabled && !config.translation_enabled {
        warn!("⚠️ 警告：识别和翻译都已关闭，无法获得任何结果！");
    }

    // 启动模型
    let task_started = run_task_with_config(&mut ws_write, &mut ws_read, &task_id, &config).await;
    if !task_started {
        error!("未收到task-started事件，退出");
        return;
    }

    if let Some(mut rx) = receiver {
        tokio::spawn(async move {
            let mut ws_write = send_audio_stream(&mut rx, ws_write).await;
            // 音频发送完成，发送结束指令（使用 Gummy 协议）
            send_finish_task(&mut ws_write, task_id).await;
        });
    } else {
        send_file(ws_write, task_id).await;
    }

    let source_language = Some(config.source_language.clone());

    tokio::spawn(async move {
        recognize_results(&mut ws_read, source_language).await;
    });

    info!("开始识别...");
}

/// 从配置构建 Gummy 模型参数
fn build_gummy_parameters_from_config(config: &GummyConfig) -> Parameters {
    info!("使用 Gummy 模型参数配置");
    Parameters {
        sample_rate: 16000,
        format: "pcm".to_string(),
        source_language: config.source_language.clone(),
        language_hints: config.language_hints.clone(),
        transcription_enabled: true, // 总是启用识别
        translation_enabled: config.translation_enabled,
        translation_target_languages: config.translation_target_languages.clone(),
        vocabulary_id: config.vocabulary_id.clone(),
        punctuation_prediction_enabled: Some(config.punctuation_prediction_enabled),
        itn_enabled: Some(config.itn_enabled),
    }
}

/// 启动 Gummy 任务（带配置）
async fn run_task_with_config(
    ws_write: &mut SplitSink<WebSocketStream<MaybeTlsStream<TcpStream>>, Message>,
    ws_read: &mut SplitStream<WebSocketStream<MaybeTlsStream<TcpStream>>>,
    task_id: &String,
    config: &GummyConfig,
) -> bool {
    let run_task = Event {
        header: Header {
            action: String::from("run-task"),
            task_id: task_id.clone(),
            streaming: String::from("duplex"),
            ..Default::default()
        },
        payload: Payload {
            task_group: "audio".to_string(),
            task: "asr".to_string(),
            function: "recognition".to_string(),
            model: "gummy-realtime-v1".to_string(),
            parameters: build_gummy_parameters_from_config(config),
            input: HashMap::new(),
            ..Default::default()
        },
    };

    let run_task_json = serde_json::to_string(&run_task).unwrap();
    info!("run_task_json:{}", run_task_json);
    ws_write
        .send(Message::Text(Utf8Bytes::from(run_task_json)))
        .await
        .unwrap();
    info!("已发送run-task指令 (Gummy)");

    let mut task_started = false;
    while let Some(msg) = ws_read.next().await {
        if let Message::Text(text) = msg.unwrap() {
            let event = serde_json::from_str::<Event>(&text).unwrap();
            match event.header.event.as_str() {
                "task-started" => {
                    info!("收到task-started事件，开始发送音频流");
                    task_started = true;
                    break;
                }
                "task-failed" => {
                    error!("任务启动失败: {}", event.header.error_message);
                    break;
                }
                _ => warn!("等待task-started，收到其他事件: {}", event.header.event),
            }
        }
    }
    task_started
}

/// 从文件发送音频（用于测试）
async fn send_file(
    mut write: SplitSink<WebSocketStream<MaybeTlsStream<TcpStream>>, Message>,
    task_id: String,
) {
    // 读取音频文件并发送
    let mut audio_file = File::open(AUDIO_FILE).unwrap();
    let mut audio_data = Vec::new();
    audio_file.read_to_end(&mut audio_data).unwrap();
    info!("音频文件大小: {} bytes", audio_data.len());

    // 分块发送音频（每100ms发送约1024字节）
    let chunk_size = 1024;
    for chunk in audio_data.chunks(chunk_size) {
        write
            .send(Message::Binary(tungstenite::Bytes::copy_from_slice(chunk)))
            .await
            .unwrap();
        tokio::time::sleep(Duration::from_millis(100)).await;
    }
    info!("音频流发送完成");

    // 发送finish-task指令
    let finish_task = Event {
        header: Header {
            action: "finish-task".to_string(),
            task_id: task_id,
            streaming: "duplex".to_string(),
            ..Default::default()
        },
        payload: Payload {
            input: HashMap::new(),
            ..Default::default()
        },
    };

    let finish_task_json = serde_json::to_string(&finish_task).unwrap();
    write
        .send(Message::Text(Utf8Bytes::from(finish_task_json)))
        .await
        .unwrap();
    info!("已发送finish-task指令");
}

/// 发送结束指令（finish-task）
async fn send_finish_task(
    ws_write: &mut SplitSink<WebSocketStream<MaybeTlsStream<TcpStream>>, Message>,
    task_id: String,
) {
    let finish_task = Event {
        header: Header {
            action: "finish-task".to_string(),
            task_id: task_id,
            streaming: "duplex".to_string(),
            ..Default::default()
        },
        payload: Payload {
            input: HashMap::new(),
            ..Default::default()
        },
    };

    if let Err(e) = ws_write
        .send(Message::Text(Utf8Bytes::from(
            serde_json::to_string(&finish_task).unwrap(),
        )))
        .await
    {
        error!("发送结束指令失败: {}", e);
        return;
    }

    info!("已发送finish-task指令");
}

/// 从服务接收识别结果（Gummy 专用）
async fn recognize_results(
    ws_read: &mut SplitStream<WebSocketStream<MaybeTlsStream<TcpStream>>>,
    source_language: Option<String>,
) {
    info!("开始接收服务端数据");

    // 用于累积显示临时结果的缓冲区（按sentence_id分组）
    let mut temp_results: HashMap<u32, String> = HashMap::new();
    let mut last_sentence_id: u32 = 0;
    let mut last_end_time: Option<u64> = None; // 跟踪上一个结果的结束时间

    loop {
        match ws_read.next().await {
            None => {
                error!("读取数据失败");
                break;
            }
            Some(msg) => {
                let msg = msg.unwrap();
                match msg {
                    Message::Text(text) => {
                        debug!("收到文本消息: {}", text);
                        match serde_json::from_str::<Event>(&text) {
                            Ok(event) => match event.header.event.as_str() {
                                "result-generated" => {
                                    debug!("处理 result-generated 事件");
                                    process_result(
                                        event.payload.output,
                                        &mut temp_results,
                                        &mut last_sentence_id,
                                        &mut last_end_time,
                                        source_language.as_deref(),
                                    );
                                }
                                "task-started" => {
                                    info!("✅ 任务已启动");
                                }
                                "task-finished" => {
                                    info!("\n收到task-finished事件，任务完成");
                                    break;
                                }
                                "task-failed" => {
                                    error!("\n❌ 任务失败: {}", event.header.error_message);
                                    if !event.header.error_code.is_empty() {
                                        error!("错误代码: {}", event.header.error_code);
                                    }
                                    break;
                                }
                                _ => {
                                    debug!(
                                        "收到其他事件: {} (完整消息: {})",
                                        event.header.event, text
                                    );
                                }
                            },
                            Err(e) => {
                                error!("解析事件失败: {}，原始消息: {}", e, text);
                            }
                        }
                    }
                    Message::Close(_) => {
                        info!("连接已关闭");
                        break;
                    }
                    Message::Binary(_) => {
                        debug!("收到二进制消息（可能是音频响应）");
                    }
                    _ => {
                        debug!("收到其他类型的消息");
                    }
                }
            }
        }
    }
    info!("结束接收服务端数据");
}
