use anyhow::{anyhow, Context};
use cpal::traits::{DeviceTrait, StreamTrait};
use cpal::{Device, InputCallbackInfo, StreamConfig};
use hound::WavSpec;
use log::{info, warn};
use rubato::{SincFixedIn, SincInterpolationParameters, WindowFunction};
use std::sync::atomic::{AtomicBool, Ordering};
use std::thread;
use std::time::Duration;
use tauri::async_runtime;
use tokio::sync::mpsc;

// 导入 crate 中的其他模块
use crate::asr;
use crate::asr::config::AsrProviderConfig;
use crate::asr::provider::{CloudAsrProvider, LocalAsrProvider};
use crate::asr::AsrProvider;
use crate::audio;
use crate::utils;

// 全局录音状态标志（线程安全，编译时初始化）
static IS_RECORDING: AtomicBool = AtomicBool::new(false);

/// 获取可用的音频输入设备列表
#[tauri::command]
pub fn get_audio_devices() -> Result<Vec<audio::AudioDevice>, String> {
    Ok(audio::get_audio_devices())
}

/// 启动音频捕获和实时语音识别
/// 前端可以通过 invoke('start_audio_capture', {config: {...}, deviceName: "..."}) 调用此函数
#[tauri::command]
pub async fn start_audio_capture(
    config: AsrProviderConfig,
    device_name: Option<String>,
) -> Result<String, String> {
    // 使用 compare_exchange 原子化地"检查并设置"
    // 如果当前是 false（未在录音），则设置为 true（开始录音）
    match IS_RECORDING.compare_exchange(
        false,            // 期望值：当前应该是 false
        true,             // 新值：设置为 true
        Ordering::SeqCst, // 成功时的内存顺序
        Ordering::SeqCst, // 失败时的内存顺序
    ) {
        Ok(_) => {
            // 成功：之前是 false，现在已设置为 true
            info!("开始音频捕获，配置: {:?}, 设备: {:?}", config, device_name);

            // 在后台任务中执行音频捕获
            async_runtime::spawn_blocking(move || {
                let result = async_runtime::block_on(run_audio_capture(config, device_name));
                match result {
                    Ok(_) => {
                        info!("音频捕获正常结束");
                        IS_RECORDING.store(false, Ordering::SeqCst);
                    }
                    Err(e) => {
                        warn!("音频捕获错误: {}", e);
                        IS_RECORDING.store(false, Ordering::SeqCst);
                    }
                }
            });

            Ok("音频捕获已启动".to_string())
        }
        Err(_) => {
            // 失败：已经是 true（已在运行）
            Err("音频捕获已经在运行中".to_string())
        }
    }
}

/// 停止音频捕获
/// 前端可以通过 invoke('stop_audio_capture') 调用此函数
#[tauri::command]
pub fn stop_audio_capture() -> Result<String, String> {
    // swap：原子操作，设置新值并返回旧值
    let was_recording = IS_RECORDING.swap(false, Ordering::SeqCst);

    if was_recording {
        // 之前是 true（正在录音），已成功停止
        info!("停止音频捕获...");

        // 注意：音频文件会在 run_audio_capture() 结束时自动保存
        Ok("音频捕获已停止".to_string())
    } else {
        // 之前是 false（未在录音）
        Err("音频捕获未运行".to_string())
    }
}

/// 音频捕获的实际实现
async fn run_audio_capture(
    config: AsrProviderConfig,
    device_name: Option<String>,
) -> anyhow::Result<()> {
    // 根据设备名称查找设备，如果未指定则使用默认环回设备
    let device: Device = if let Some(name) = device_name {
        audio::find_device_by_name(&name).ok_or_else(|| anyhow::anyhow!("找不到设备: {}", name))?
    } else {
        audio::find_loopback_device().map_err(|e| {
            // 将结构化错误转换为 JSON 字符串，前端可以解析
            anyhow::anyhow!(
                "{}",
                serde_json::to_string(&e).unwrap_or_else(|_| e.message.clone())
            )
        })?
    };
    info!("找到设备：{}", device.name()?);

    /*
    获取设备的默认输出配置
    example:
        SupportedStreamConfig { channels: 2, sample_rate: SampleRate(48000), buffer_size: Range { min: 15, max: 4096 }, sample_format: F32 }
     */
    let default_input_config = device.default_input_config().expect("无法获取默认输入配置");
    info!("默认输入配置：{:?}", default_input_config);

    // 原始采样率
    let default_rate = default_input_config.sample_rate().0;
    // 原始通道数
    let default_channel_count: u16 = default_input_config.channels().into();

    // 输出目录（debug 和 release 都定义，避免作用域问题）
    let output_dir = "../audio_output";

    // WAV 文件写入器（仅在 debug 模式启用）
    #[cfg(debug_assertions)]
    let (original_writer, verification_writer) = {
        std::fs::create_dir_all(output_dir)?;
        info!("📁 调试模式：音频文件将保存到 {}", output_dir);

        // 创建原始音频文件写入器
        let original_spec = WavSpec {
            channels: default_channel_count,
            sample_rate: default_rate,
            bits_per_sample: 32,
            sample_format: hound::SampleFormat::Float,
        };
        let original_path = format!("{}/original_output.wav", output_dir);
        let original = utils::file::create_wav_writer(&original_path, original_spec)?;

        // 创建验证音频文件写入器
        let verification_spec = WavSpec {
            channels: 1,
            sample_rate: 16000,
            bits_per_sample: 16,
            sample_format: hound::SampleFormat::Int,
        };
        let verification_path = format!("{}/verification_output.wav", output_dir);
        let verification = utils::file::create_wav_writer(&verification_path, verification_spec)?;

        (original, verification)
    };

    #[cfg(not(debug_assertions))]
    info!("🚀 生产模式：WAV 文件写入已禁用（提升性能）");

    // 音频配置（frame_size=800，约50ms延迟，已优化）
    let audio_config = audio::AudioConfig {
        sample_rate_in: default_rate,    // 输入采样率
        sample_rate_out: 16000,          // 阿里云ASR要求的采样率
        channels: default_channel_count, // 通道数
        frame_size: 800,                 // 帧大小（优化为50ms延迟）
        gain: 3.0,                       // 音频增益（放大3倍提高识别准确性）
    };

    info!(
        "🔊 音频配置: {}Hz→{}Hz, {}通道, 帧大小={}, 增益={}x",
        audio_config.sample_rate_in,
        audio_config.sample_rate_out,
        audio_config.channels,
        audio_config.frame_size,
        audio_config.gain
    );

    // 计算重采样比例和延迟
    // input_duration_ms = frame_size / sample_rate_in * 1000
    // 不乘通道数：frame_size 是每通道的样本数，时长只与采样率相关
    let resample_ratio = audio_config.sample_rate_out as f64 / audio_config.sample_rate_in as f64;
    let input_duration_ms =
        (audio_config.frame_size as f64 / audio_config.sample_rate_in as f64 * 1000.0) as u64;

    info!(
        "⏱️  处理延迟: ~{}ms (帧大小={}, 重采样比例={:.2})",
        input_duration_ms, audio_config.frame_size, resample_ratio
    );

    if input_duration_ms > 100 {
        warn!("⚠️  延迟较高，可减小 frame_size 以优化");
    }

    let resampler = init_resampler(&audio_config, resample_ratio);
    let (tx, rx) = mpsc::channel::<Vec<f32>>(1000);

    info!("🤖 ASR: 启动语音识别，配置: {:?}", config);
    let provider: Box<dyn AsrProvider> = match config {
        AsrProviderConfig::Cloud(c) => Box::new(CloudAsrProvider::new(c)),
        AsrProviderConfig::Local(c) => Box::new(LocalAsrProvider::new(c)),
    };
    provider.recognize_stream(rx).await?;

    info!("🎙️  开始捕获音频...");

    // send + sync
    let mut recording_state = audio::RecordingState {
        resampler,
        sample_buffer: Vec::with_capacity(audio_config.frame_size * audio_config.channels as usize),
        channel_data: vec![
            Vec::with_capacity(audio_config.frame_size);
            audio_config.channels as usize
        ],
        tx,
        volume_stats: audio::VolumeStats {
            max_volume: 0.0,
            avg_volume: 0.0,
            frame_count: 0,
            low_volume_count: 0,
            window_low_count: 0,
        },
    };

    // 构建音频输入流
    let err_fn = |err| eprintln!("❌ 音频错误：{}", err);
    let stream_config: StreamConfig = default_input_config.clone().into();

    let stream = match default_input_config.sample_format() {
        cpal::SampleFormat::F32 => device.build_input_stream(
            &stream_config,
            move |data: &[f32], _: &InputCallbackInfo| {
                audio::process_audio_data(data, &mut recording_state, &audio_config);
            },
            err_fn,
            None,
        ),
        cpal::SampleFormat::I16 => device.build_input_stream(
            &stream_config,
            move |data: &[i16], _: &_| {
                audio::process_audio_data(data, &mut recording_state, &audio_config);
            },
            err_fn,
            None,
        ),
        cpal::SampleFormat::U16 => device.build_input_stream(
            &stream_config,
            move |data: &[u16], _: &_| {
                audio::process_audio_data(data, &mut recording_state, &audio_config);
            },
            err_fn,
            None,
        ),
        cpal::SampleFormat::I32 => device.build_input_stream(
            &stream_config,
            move |data: &[i32], _: &_| {
                audio::process_audio_data(data, &mut recording_state, &audio_config);
            },
            err_fn,
            None,
        ),
        cpal::SampleFormat::F64 => device.build_input_stream(
            &stream_config,
            move |data: &[f64], _: &_| {
                audio::process_audio_data(data, &mut recording_state, &audio_config);
            },
            err_fn,
            None,
        ),
        fmt => {
            return Err(anyhow!(
                "不支持的采样格式：{:?}",
                fmt
            ))
        }
    }?;

    stream.play()?;
    info!("✅ 音频流已启动，等待停止指令...");

    // 等待停止信号
    // 注意：这里使用 thread::sleep 而非 tokio::time::sleep 是因为：
    // 1. cpal::Stream 不是 Send，无法跨 await 点或移动到其他线程
    // 2. 必须在创建 stream 的同一线程中持有它直到停止
    // 3. 100ms 的轮询间隔对性能影响很小
    while IS_RECORDING.load(Ordering::Relaxed) {
        thread::sleep(Duration::from_millis(100));
    }

    info!("⏹️  收到停止信号，正在清理资源...");

    // 停止音频流
    drop(stream);

    // 保存 WAV 文件（仅在 debug 模式）
    #[cfg(debug_assertions)]
    {
        info!("💾 保存调试音频文件...");
        utils::file::save_wav_writer(original_writer)?;
        utils::file::save_wav_writer(verification_writer)?;
        info!("✅ 调试文件已保存到 {}", output_dir);
    }

    info!("✅ 音频捕获已完全停止");
    Ok(())
}

fn init_resampler(audio_config: &audio::AudioConfig, resample_ratio: f64) -> SincFixedIn<f32> {
    // 初始化重采样器（针对低延迟优化）
    // 参数说明：
    // - resample_ratio: 重采样比例 (输出/输入采样率)
    // - max_resample_ratio_relative: 最大相对比率，限制动态调整范围（如果不使用动态调整，影响内存分配）
    //   当前设置为 1.2，允许比率在 resample_ratio * 1.2 和 resample_ratio / 1.2 之间
    //   由于我们使用固定比率，1.2 足够且节省内存（原 2.0）
    // - sinc_len: 越小越快但质量略降，128 是平衡点（原256）
    // - interpolation: Linear 速度更快，Cubic 质量更高但慢
    // - oversampling_factor: 越小越快但质量略降，80 是平衡点（原160）
    // - f_cutoff: 越小越保守，0.95 更激进但质量略降
    let resampler: SincFixedIn<f32> = SincFixedIn::<f32>::new(
        resample_ratio, // 重采样比例, 必须大于0
        1.2,            // 最大相对比率：降低到 1.2 节省内存（原 2.0），因为不使用动态调整
        SincInterpolationParameters {
            sinc_len: 128, // 降低：256->128，提高速度（质量仍可接受）
            interpolation: rubato::SincInterpolationType::Linear, // Linear：速度快（已优化）
            oversampling_factor: 80, // 降低：160->80，平衡速度和质量
            f_cutoff: 0.95, // 提高：0.6->0.95，减少过度滤波
            window: WindowFunction::BlackmanHarris, // 保持高质量窗口函数
        },
        audio_config.frame_size,        // 输入数据的帧大小
        audio_config.channels as usize, // 输入/输出的通道数
    )
    .context("无法创建重采样器")
    .unwrap();
    resampler
}
