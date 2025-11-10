use rubato::SincFixedIn;
use tokio::sync::mpsc;

// 音频处理配置
pub struct AudioConfig {
    //输入音频采样率（每秒采样点数
    pub sample_rate_in: u32,
    //输出音频采样率（每秒采样点数）
    pub sample_rate_out: u32,
    //输入音频通道数(如1为单声道，2为立体声）
    pub channels: u16,
    //音频帧大小
    pub frame_size: usize,
    //音频增益（放大倍数，1.0为原始音量，2.0为放大2倍）
    pub gain: f32,
}

// 录音状态
pub struct RecordingState {
    // 重采样器
    pub resampler: SincFixedIn<f32>,
    // 输入音频缓存
    pub sample_buffer: Vec<f32>,
    // 输入音频通道数据
    pub channel_data: Vec<Vec<f32>>,
    // 发送通道，用于将处理后的音频数据发送到其他组件
    pub tx: mpsc::Sender<Vec<f32>>,
    // 音量统计（用于监控）
    pub volume_stats: VolumeStats,
}

// 音量统计信息
pub struct VolumeStats {
    pub max_volume: f32,
    pub avg_volume: f32,
    pub frame_count: u64,
    pub low_volume_count: u64, // 低音量帧计数
}
