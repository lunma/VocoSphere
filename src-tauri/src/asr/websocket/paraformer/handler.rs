// Paraformer 模型专用的识别结果处理
use crate::app_state;
use crate::asr::events::{AsrResultEvent, AsrResultKind, ASR_RESULT_EVENT};
use crate::asr::websocket::paraformer::protocol::Output;
use log::{info, warn};
use std::collections::HashMap;

/// 处理 Paraformer 识别结果
pub(crate) fn process_result(
    output: Option<Output>,
    temp_results: &mut HashMap<u32, String>,
    last_sentence_id: &mut u32,
    last_end_time: &mut Option<u64>,
    source_language: Option<&str>,
) {
    if let Some(output) = output {
        log::debug!(
            "处理输出结果，transcription: {:?}, emotion: {:?}",
            output.transcription.is_some(),
            output.emotion.is_some()
        );
        // 处理识别结果
        if let Some(transcription) = &output.transcription {
            let sentence_id = transcription.sentence_id;
            let text = &transcription.text;

            if transcription.sentence_end {
                // 最终结果：显示完整识别结果
                let begin_time_sec = transcription.begin_time as f64 / 1000.0;
                let time_info = if let Some(end_time) = transcription.end_time {
                    let end_time_sec = end_time as f64 / 1000.0;
                    format!("[时间: {:.2}s-{:.2}s]", begin_time_sec, end_time_sec)
                } else {
                    String::new()
                };

                // 检查时间间隔
                let gap_info = if let Some(last_end) = *last_end_time {
                    if transcription.begin_time > last_end {
                        let gap_ms = transcription.begin_time - last_end;
                        let gap_sec = gap_ms as f64 / 1000.0;
                        if gap_sec > 1.0 {
                            format!(" ⚠️ [间隔: {:.2}s]", gap_sec)
                        } else {
                            String::new()
                        }
                    } else {
                        String::new()
                    }
                } else {
                    String::new()
                };

                info!("🎵 【完整结果】{}{}: {}", time_info, gap_info, text);

                // 更新最后结束时间
                if let Some(end_time) = transcription.end_time {
                    *last_end_time = Some(end_time);
                }

                // 清除这个句子的临时结果
                temp_results.remove(&sentence_id);

                // 如果这是新的句子ID，更新
                if sentence_id >= *last_sentence_id {
                    *last_sentence_id = sentence_id + 1;
                }

                if let Err(err) = app_state::emit_event(
                    ASR_RESULT_EVENT,
                    &AsrResultEvent {
                        sentence_id,
                        begin_time: transcription.begin_time,
                        end_time: transcription.end_time,
                        text: text.clone(),
                        is_final: true,
                        kind: AsrResultKind::Transcription,
                        lang: source_language.map(|lang| lang.to_string()),
                    },
                ) {
                    warn!("发送识别结果到前端失败: {}", err);
                }
            } else {
                // 临时结果：更新显示
                if text.len() > 0 {
                    let existing = temp_results.get(&sentence_id);
                    // 只有当文本发生变化时才显示
                    if existing.is_none() || existing.unwrap() != text {
                        temp_results.insert(sentence_id, text.clone());
                        // 显示时间信息：如果有结束时间显示完整范围，否则只显示开始时间
                        let time_info = if let Some(end_time) = transcription.end_time {
                            format!(
                                "[时间: {:.2}s-{:.2}s]",
                                transcription.begin_time as f64 / 1000.0,
                                end_time as f64 / 1000.0
                            )
                        } else {
                            // 临时结果阶段可能没有结束时间，只显示开始时间
                            format!("[开始: {:.2}s]", transcription.begin_time as f64 / 1000.0)
                        };
                        info!("🔄 【识别中】{}: {}", time_info, text);

                        if let Err(err) = app_state::emit_event(
                            ASR_RESULT_EVENT,
                            &AsrResultEvent {
                                sentence_id,
                                begin_time: transcription.begin_time,
                                end_time: transcription.end_time,
                                text: text.clone(),
                                is_final: false,
                                kind: AsrResultKind::Transcription,
                                lang: source_language.map(|lang| lang.to_string()),
                            },
                        ) {
                            warn!("发送临时识别结果到前端失败: {}", err);
                        }
                    }
                }
            }
        }

        // 处理情感识别结果（Paraformer 特有功能，如果启用）
        if let Some(emotion) = &output.emotion {
            info!(
                "💭 【情感识别】类型: {}, 得分: {:.2}",
                emotion.emotion_type, emotion.emotion_score
            );
        }
    }
}
