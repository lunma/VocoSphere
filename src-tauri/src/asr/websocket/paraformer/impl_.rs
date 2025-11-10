// Paraformer 模型实现
// 参考文档：https://help.aliyun.com/zh/model-studio/websocket-for-paraformer-real-time-service
use crate::asr::config::ParaformerConfig;
use crate::asr::websocket::common::{connect, send_audio_stream, WsStream};
use crate::asr::websocket::paraformer::handler::process_result;
use crate::asr::websocket::paraformer::protocol::{Event, Header, Parameters, Payload};
use futures::stream::{SplitSink, SplitStream};
use futures::{SinkExt, StreamExt};
use log::{debug, error, info, warn};
use std::collections::HashMap;
use tokio::net::TcpStream;
use tokio::sync::mpsc;
use tokio_tungstenite::{MaybeTlsStream, WebSocketStream};
use tungstenite::{Message, Utf8Bytes};
use uuid::Uuid;

/// 启动 Paraformer 模型识别（带配置）
pub async fn start_with_config(
    receiver: Option<mpsc::Receiver<Vec<f32>>>,
    config: ParaformerConfig,
) {
    let ws_stream = connect(&config.server_config.ws_url, &config.server_config.api_key).await;
    let WsStream {
        mut ws_write,
        mut ws_read,
    } = ws_stream;
    let task_id = Uuid::new_v4().to_string().replace("-", "");
    info!("task_id:{} , length:{}", task_id, task_id.len());

    info!("使用 Paraformer ASR 模型，配置: {:?}", config);
    info!("  - 特点：Paraformer 实时模型 V2，准确率高，性能优秀");
    info!("  - 适用：实时语音识别、复杂场景识别");
    info!(
        "  - 文档：https://help.aliyun.com/zh/model-studio/websocket-for-paraformer-real-time-service"
    );

    info!("功能配置:");
    info!("  - 识别功能: ✅ 开启");
    info!(
        "  - 标点符号预测: {}",
        if config.punctuation_prediction_enabled {
            "✅ 开启"
        } else {
            "❌ 关闭"
        }
    );
    info!(
        "  - 逆文本正则化: {}",
        if config.itn_enabled {
            "✅ 开启"
        } else {
            "❌ 关闭"
        }
    );
    info!(
        "  - 不流畅词过滤: {}",
        if config.disfluency_removal_enabled {
            "✅ 开启"
        } else {
            "❌ 关闭"
        }
    );
    if config.emotion_enabled {
        info!("  - 情感识别: ✅ 开启");
    }
    if let Some(ref dialect) = config.dialect {
        info!("  - 方言设置: {}", dialect);
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
            // 音频发送完成，发送结束指令（使用 Paraformer 协议）
            send_finish_task(&mut ws_write, task_id).await;
        });
    } else {
        error!("Paraformer 模型需要音频流接收器");
        return;
    }

    let source_language = Some(config.source_language.clone());

    tokio::spawn(async move {
        recognize_results(&mut ws_read, source_language).await;
    });

    info!("开始识别...");
}

/// 启动 Paraformer 任务（带配置）
async fn run_task_with_config(
    ws_write: &mut SplitSink<WebSocketStream<MaybeTlsStream<TcpStream>>, Message>,
    ws_read: &mut SplitStream<WebSocketStream<MaybeTlsStream<TcpStream>>>,
    task_id: &String,
    config: &ParaformerConfig,
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
            model: "paraformer-realtime-v2".to_string(),
            parameters: build_paraformer_parameters_from_config(config),
            input: HashMap::new(),
            ..Default::default()
        },
    };

    let run_task_json = match serde_json::to_string(&run_task) {
        Ok(json) => json,
        Err(e) => {
            error!("序列化 run-task 失败: {}", e);
            return false;
        }
    };
    info!("run_task_json:{}", run_task_json);
    if let Err(e) = ws_write
        .send(Message::Text(Utf8Bytes::from(run_task_json)))
        .await
    {
        error!("发送 run-task 指令失败: {}", e);
        return false;
    }
    info!("已发送run-task指令 (Paraformer)");

    let mut task_started = false;
    while let Some(msg) = ws_read.next().await {
        let msg = match msg {
            Ok(m) => m,
            Err(e) => {
                warn!("接收消息失败: {}，继续等待", e);
                continue;
            }
        };
        if let Message::Text(text) = msg {
            let event = match serde_json::from_str::<Event>(&text) {
                Ok(e) => e,
                Err(e) => {
                    warn!("解析事件失败: {}，原始消息: {}。继续等待", e, text);
                    continue;
                }
            };
            match event.header.event.as_str() {
                "task-started" => {
                    info!("收到task-started事件，开始发送音频流");
                    task_started = true;
                    break;
                }
                "task-failed" => {
                    let error_code = &event.header.error_code;
                    let error_msg = &event.header.error_message;
                    error!("❌ 任务启动失败: {} (错误代码: {})", error_msg, error_code);
                    if error_code == "DataInspectionFailed" {
                        warn!(
                            "💡 提示：如果频繁遇到内容检查失败，可设置 DISABLE_DATA_INSPECTION=true 禁用内容检查"
                        );
                    }
                    return false;
                }
                _ => warn!("等待task-started，收到其他事件: {}", event.header.event),
            }
        }
    }
    task_started
}

/// 从配置构建 Paraformer 模型参数
fn build_paraformer_parameters_from_config(config: &ParaformerConfig) -> Parameters {
    info!("使用 Paraformer 模型参数配置");
    Parameters {
        sample_rate: 16000,
        format: "pcm".to_string(),
        source_language: config.source_language.clone(),
        language_hints: config.language_hints.clone(),
        transcription_enabled: true, // 总是启用识别
        vocabulary_id: config.vocabulary_id.clone(),
        disfluency_removal_enabled: Some(config.disfluency_removal_enabled),
        punctuation_prediction_enabled: Some(config.punctuation_prediction_enabled),
        itn_enabled: Some(config.itn_enabled),
        dialect: config.dialect.clone(),
        emotion_enabled: Some(config.emotion_enabled),
    }
}

/// 从服务接收识别结果（Paraformer 专用）
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
                // 连接断开：记录日志，可以考虑重连
                warn!("⚠️ WebSocket 读取结束（连接可能已断开）。如需重连，请重启程序");
                break;
            }
            Some(msg) => {
                let msg = match msg {
                    Ok(m) => m,
                    Err(e) => {
                        warn!("⚠️ WebSocket 消息接收错误: {}。继续尝试接收", e);
                        continue; // 跳过这条消息，继续处理下一条
                    }
                };
                match msg {
                    Message::Text(text) => {
                        debug!("收到文本消息: {}", text);
                        match serde_json::from_str::<Event>(&text) {
                            Ok(event) => {
                                match event.header.event.as_str() {
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
                                        let error_code = &event.header.error_code;
                                        let error_msg = &event.header.error_message;

                                        // 根据错误类型决定是否继续
                                        match error_code.as_str() {
                                            "DataInspectionFailed" => {
                                                // 内容检查失败：非致命错误，记录但继续运行
                                                warn!(
                                                    "⚠️ 内容检查失败: {} (错误代码: {}). 继续运行，识别结果可能被过滤",
                                                    error_msg, error_code
                                                );
                                                // 不 break，继续处理后续消息
                                            }
                                            _ => {
                                                // 其他错误：记录详细日志，但不直接停止
                                                error!(
                                                    "❌ 任务失败: {} (错误代码: {})",
                                                    error_msg, error_code
                                                );

                                                // 对于某些严重错误，仍然需要停止（但先记录）
                                                if error_msg.contains("认证")
                                                    || error_msg.contains("权限")
                                                    || error_msg.contains("auth")
                                                {
                                                    error!(
                                                        "🔒 认证/权限错误，无法继续。请检查 API Key 配置"
                                                    );
                                                    break;
                                                } else {
                                                    // 其他错误：记录但继续尝试
                                                    warn!("⚠️ 遇到错误，但将继续尝试处理后续消息");
                                                }
                                            }
                                        }
                                    }
                                    _ => {
                                        debug!(
                                            "收到其他事件: {} (完整消息: {})",
                                            event.header.event, text
                                        );
                                    }
                                }
                            }
                            Err(e) => {
                                // 解析错误：记录日志但继续处理，不停止服务
                                warn!(
                                    "⚠️ 解析事件失败: {}，原始消息: {}。继续处理后续消息",
                                    e, text
                                );
                            }
                        }
                    }
                    Message::Close(close_frame) => {
                        if let Some(ref frame) = close_frame {
                            warn!(
                                "⚠️ WebSocket 连接已关闭: 代码={:?}, 原因={:?}",
                                frame.code, frame.reason
                            );
                        } else {
                            warn!("⚠️ WebSocket 连接已关闭（无详细信息）");
                        }
                        // 不直接 break，让上层决定是否重连
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

/// 发送结束指令（task-finished）
async fn send_finish_task(
    ws_write: &mut SplitSink<WebSocketStream<MaybeTlsStream<TcpStream>>, Message>,
    task_id: String,
) {
    let finish_task = Event {
        header: Header {
            action: "task-finished".to_string(),
            task_id: task_id,
            streaming: "duplex".to_string(),
            ..Default::default()
        },
        payload: Payload {
            input: HashMap::new(),
            ..Default::default()
        },
    };

    let finish_task_json = match serde_json::to_string(&finish_task) {
        Ok(json) => json,
        Err(e) => {
            error!("序列化 finish-task 失败: {}，跳过发送", e);
            return;
        }
    };
    if let Err(e) = ws_write
        .send(Message::Text(Utf8Bytes::from(finish_task_json)))
        .await
    {
        warn!("发送结束指令失败: {}（可能连接已断开）", e);
        return;
    }

    info!("已发送task-finished指令");
}
