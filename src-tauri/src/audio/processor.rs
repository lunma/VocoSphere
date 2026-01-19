use crate::audio::config::{AudioConfig, RecordingState, VolumeStats};
// use crate::utils::file; // 调试时启用文件写入，会降低性能
use cpal::traits::{DeviceTrait, HostTrait};
use cpal::Sample;
use rubato::Resampler;
use serde::Serialize;

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

/// 音频设备错误信息（结构化错误，便于前端显示）
#[derive(Debug, Clone, Serialize)]
pub struct DeviceError {
    pub error_type: String,  // "LOOPBACK_DEVICE_NOT_FOUND"
    pub platform: String,    // "windows" | "linux" | "macos"
    pub message: String,      // 简短的错误消息
}

impl DeviceError {
    pub fn loopback_not_found() -> Self {
        #[cfg(target_os = "windows")]
        {
            Self {
                error_type: "LOOPBACK_DEVICE_NOT_FOUND".to_string(),
                platform: "windows".to_string(),
                message: "找不到系统音频捕获设备".to_string(),
            }
        }
        #[cfg(target_os = "linux")]
        {
            Self {
                error_type: "LOOPBACK_DEVICE_NOT_FOUND".to_string(),
                platform: "linux".to_string(),
                message: "找不到系统音频捕获设备".to_string(),
            }
        }
        #[cfg(target_os = "macos")]
        {
            Self {
                error_type: "LOOPBACK_DEVICE_NOT_FOUND".to_string(),
                platform: "macos".to_string(),
                message: "找不到系统音频捕获设备".to_string(),
            }
        }
        #[cfg(not(any(target_os = "windows", target_os = "linux", target_os = "macos")))]
        {
            Self {
                error_type: "LOOPBACK_DEVICE_NOT_FOUND".to_string(),
                platform: "unknown".to_string(),
                message: "找不到系统音频捕获设备".to_string(),
            }
        }
    }
}

/// 检查设备是否是环回设备（用于系统音频捕获）
/// 返回优先级：数字越小优先级越高
fn is_loopback_device(device: &cpal::Device) -> Option<u8> {
    let name = device.name().ok()?;
    let name_lower = name.to_lowercase();
    
    // 验证设备是否支持输入配置
    if device.default_input_config().is_err() {
        return None;
    }

    #[cfg(target_os = "windows")]
    {
        // Windows 上 WASAPI loopback 设备的优先级匹配
        if name.contains("Stereo Mix") || name.contains("Wave Out Mix") {
            return Some(1); // 最高优先级
        }
        if name.contains("What U Hear") {
            return Some(2);
        }
        if name.contains("Loopback") {
            return Some(3);
        }
        if name.contains("VB-Audio Virtual") {
            return Some(4);
        }
    }

    #[cfg(target_os = "linux")]
    {
        // Linux 上 PulseAudio/PipeWire monitor 源的优先级匹配
        if name_lower.contains(".monitor") || name_lower.ends_with(" monitor") {
            return Some(1); // 最高优先级：标准 monitor 设备
        }
        if name_lower.contains("monitor") && !name_lower.contains("output") {
            return Some(2); // 次优先级：包含 monitor 但不包含 output
        }
    }

    #[cfg(target_os = "macos")]
    {
        // macOS 上虚拟音频设备的优先级匹配
        if name_lower.contains("blackhole") {
            return Some(1); // 最高优先级：BlackHole
        }
        if name_lower.contains("loopback") && !name_lower.contains("blackhole") {
            return Some(2); // 次优先级：Loopback（商业软件）
        }
        if name_lower.contains("virtual") 
            && !name_lower.contains("mic")
            && !name_lower.contains("microphone")
        {
            return Some(3); // 备选：其他虚拟设备（排除虚拟麦克风）
        }
    }

    None
}

pub fn find_loopback_device() -> Result<cpal::Device, DeviceError> {
    let host = cpal::default_host();

    let mut candidates: Vec<(cpal::Device, u8)> = Vec::new();

    for device in host.devices().map_err(|_| DeviceError::loopback_not_found())? {
        if let Some(priority) = is_loopback_device(&device) {
            candidates.push((device, priority));
        }
    }

    // 按优先级排序，返回优先级最高的设备
    candidates.sort_by_key(|(_, priority)| *priority);
    
    candidates
        .into_iter()
        .next()
        .map(|(device, _)| device)
        .ok_or_else(|| DeviceError::loopback_not_found())
}

/// 获取所有可用的音频输入设备列表
pub fn get_audio_devices() -> Vec<(String, String)> {
    let host = cpal::default_host();
    let mut devices = Vec::new();

    if let Ok(device_iter) = host.devices() {
        for device in device_iter {
            if let Ok(name) = device.name() {
                // is_loopback_device 内部已经检查了 default_input_config
                // 如果返回 Some，说明设备支持输入且是环回设备
                // 如果返回 None，可能是普通输入设备或不是输入设备
                if let Some(_priority) = is_loopback_device(&device) {
                    // 环回设备
                    devices.push((name.clone(), format!("{} (环回设备)", name)));
                } else if device.default_input_config().is_ok() {
                    // 普通输入设备（非环回）
                    devices.push((name.clone(), format!("{} (输入设备)", name)));
                }
            }
        }
    }

    // 如果没有找到设备，尝试添加默认设备
    if devices.is_empty() {
        if let Some(default_device) = host.default_input_device() {
            if let Ok(name) = default_device.name() {
                // 验证默认设备是否支持输入配置
                if default_device.default_input_config().is_ok() {
                    // 判断默认设备类型
                    let device_type = if is_loopback_device(&default_device).is_some() {
                        "环回设备"
                    } else {
                        "输入设备"
                    };
                    devices.push((name.clone(), format!("{} (默认 {})", name, device_type)));
                }
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
                    // 验证设备是否支持输入配置
                    if device.default_input_config().is_ok() {
                        return Some(device);
                    }
                }
            }
        }
    }
    // 如果找不到，不返回默认设备（因为默认设备可能是麦克风，不是用户指定的设备）
    None
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
