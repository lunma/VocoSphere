use crate::audio::config::{AudioConfig, RecordingState, VolumeStats};
// use crate::utils::file; // 调试时启用文件写入，会降低性能
use cpal::traits::{DeviceTrait, HostTrait};
use cpal::Sample;
use rubato::Resampler;

// 在重采样后对样本进行音量调整
fn apply_gain(samples: &[f32], gain: f32) -> Vec<f32> {
    samples
        .iter()
        .map(|&s| {
            // 放大后限制在[-1.0, 1.0]范围内，避免失真
            (s * gain).clamp(-1.0, 1.0)
        })
        .collect()
}

// 更新音量统计信息
fn update_volume_stats(samples: &[f32], stats: &mut VolumeStats) {
    if samples.is_empty() {
        return;
    }

    // 计算 RMS（均方根）音量
    let sum_sq: f32 = samples.iter().map(|&s| s * s).sum();
    let rms = (sum_sq / samples.len() as f32).sqrt();

    // 计算峰值音量
    let peak = samples.iter().map(|&s| s.abs()).fold(0.0f32, f32::max);

    // 更新统计
    stats.frame_count += 1;
    stats.max_volume = stats.max_volume.max(peak);

    // 累积平均音量（移动平均）
    let alpha = 0.1; // 平滑因子
    stats.avg_volume = alpha * rms + (1.0 - alpha) * stats.avg_volume;

    // 检测低音量（RMS < 0.01 或峰值 < 0.05）
    if rms < 0.01 || peak < 0.05 {
        stats.low_volume_count += 1;
    }

    // 每100帧打印一次音量统计（避免频繁打印）
    if stats.frame_count % 100 == 0 {
        let low_volume_ratio = stats.low_volume_count as f32 / stats.frame_count as f32 * 100.0;
        log::debug!(
            "音量统计 - RMS: {:.4}, 峰值: {:.4}, 最大: {:.4}, 低音量帧: {:.1}%",
            rms,
            peak,
            stats.max_volume,
            low_volume_ratio
        );

        // 如果低音量帧比例过高，发出警告
        if low_volume_ratio > 50.0 {
            log::warn!(
                "⚠️ 检测到高比例低音量帧 ({:.1}%)，建议增加音频增益或检查音频输入源",
                low_volume_ratio
            );
        }

        // 如果峰值过低，也发出警告
        if stats.max_volume < 0.1 {
            log::warn!(
                "⚠️ 峰值音量过低 ({:.4})，建议增加音频增益（当前增益可能不够）",
                stats.max_volume
            );
        }
    }
}

pub fn process_audio_data<T>(input: &[T], state: &mut RecordingState, config: &AudioConfig)
where
    T: Sample,
{
    let samples = input
        .iter()
        .map(|s| s.to_float_sample().to_sample::<f32>())
        .collect::<Vec<f32>>();

    // 文件写入操作移到后台，避免在音频回调中阻塞
    // file::write_original_audio(&samples); // 调试时启用，会降低性能

    // 累计样本数据
    state.sample_buffer.extend_from_slice(&samples);

    // 处理累积的样本：当累积足够的样本时进行处理
    // frame_size 是输入帧大小（每通道的样本数）
    if state.sample_buffer.len() >= config.frame_size * config.channels as usize {
        // 分离通道
        for i in 0..config.channels as usize {
            state.channel_data[i].clear();
            for j in 0..config.frame_size {
                state.channel_data[i].push(state.sample_buffer[j * config.channels as usize + i]);
            }
        }

        // 重采样
        let resampler = &mut state.resampler;
        match resampler.process(&state.channel_data, None) {
            Ok(processed) => {
                // 强制转换为单声道（无论输入通道数）
                let mono_samples = mix_to_mono(&processed);

                // 更新音量统计
                update_volume_stats(&mono_samples, &mut state.volume_stats);

                // 应用音量增益（根据配置调整）
                let amplified_samples = if config.gain != 1.0 {
                    apply_gain(&mono_samples, config.gain)
                } else {
                    mono_samples
                };

                // 异步发送, 缓冲区满时丢弃数据（发送放大后的音频）
                if let Err(e) = state.tx.try_send(amplified_samples) {
                    eprintln!("警告: 音频数据通道已满，丢弃当前数据块: {:?}", e);
                }
            }
            Err(e) => eprintln!("Error resampling: {}", e),
        }
        // 清空已处理的样本数据
        state.sample_buffer.clear();
    }
}

// 关键修复2：多通道转单声道（混合所有通道样本的平均值）
fn mix_to_mono(channels: &[Vec<f32>]) -> Vec<f32> {
    if channels.is_empty() {
        return Vec::new();
    }

    if channels.len() == 1 {
        return channels[0].clone();
    }

    // 取所有通道中最长的帧长度（避免样本不足）
    let max_frames = channels.iter().map(|c| c.len()).max().unwrap_or(0);
    let mut mono = Vec::with_capacity(max_frames);

    for i in 0..max_frames {
        let mut sum = 0.0;
        let mut count = 0;
        // 累加所有通道的第i个样本
        for channel in channels {
            if i < channel.len() {
                sum += channel[i];
                count += 1;
            }
        }
        // 平均样本值（防止音量溢出）
        let sample = if count > 0 {
            (sum / count as f32).clamp(-1.0, 1.0)
        } else {
            0.0
        };
        mono.push(sample);
    }
    mono
}

pub fn find_loopback_device() -> Option<cpal::Device> {
    let host = cpal::default_host();

    #[cfg(target_os = "windows")]
    {
        for device in host.devices().ok()? {
            if let Ok(name) = device.name() {
                if name.contains("Loopback") {
                    return Some(device);
                }
            }
        }
        host.default_input_device()
    }

    #[cfg(target_os = "linux")]
    {
        host.default_input_device()
    }

    #[cfg(target_os = "macos")]
    {
        // 在 macOS 上查找 BlackHole 或其他虚拟音频设备作为环回设备
        for device in host.devices().ok()? {
            if let Ok(name) = device.name() {
                if name.to_lowercase().contains("blackhole")
                    || name.contains("Loopback")
                    || name.contains("Virtual")
                {
                    return Some(device);
                }
            }
        }

        // 如果没有找到专门的环回设备，则使用默认输入设备
        host.default_input_device()
    }

    #[cfg(not(any(target_os = "windows", target_os = "linux", target_os = "macos")))]
    {
        host.default_input_device()
    }
}

/// 获取所有可用的音频输入设备列表
pub fn get_audio_devices() -> Vec<(String, String)> {
    let host = cpal::default_host();
    let mut devices = Vec::new();

    if let Ok(device_iter) = host.devices() {
        for device in device_iter {
            if let Ok(name) = device.name() {
                // 检查设备是否有输入配置
                if device.default_input_config().is_ok() {
                    let device_type = if name.to_lowercase().contains("loopback")
                        || name.to_lowercase().contains("blackhole")
                        || name.to_lowercase().contains("virtual")
                    {
                        "环回设备"
                    } else {
                        "输入设备"
                    };
                    devices.push((name.clone(), format!("{} ({})", name, device_type)));
                }
            }
        }
    }

    // 如果没有找到设备，尝试添加默认设备
    if devices.is_empty() {
        if let Some(default_device) = host.default_input_device() {
            if let Ok(name) = default_device.name() {
                devices.push((name.clone(), format!("{} (默认)", name)));
            }
        }
    }

    devices
}

/// 根据设备名称查找设备
pub fn find_device_by_name(device_name: &str) -> Option<cpal::Device> {
    let host = cpal::default_host();

    if let Ok(device_iter) = host.devices() {
        for device in device_iter {
            if let Ok(name) = device.name() {
                if name == device_name {
                    return Some(device);
                }
            }
        }
    }

    // 如果找不到，返回默认设备
    host.default_input_device()
}

/// 验证重采样后的音频数据
/// 注意：此函数在音频回调中被调用，应尽可能快速执行
/// 目前已被禁用以避免性能问题，仅在需要调试时启用
#[allow(dead_code)]
fn validate_resampled_audio(samples: &[f32]) {
    // 快速检查：只检查严重问题，避免复杂计算
    if samples.is_empty() {
        return;
    }

    // 简化版本：只做最基本的检查，移除所有打印和复杂计算
    // 如果需要调试，可以启用，但会降低性能
    let _has_audio = samples.iter().any(|&s| s != 0.0);
    // 移除了所有日志输出和复杂验证，以保持回调函数快速执行
}
