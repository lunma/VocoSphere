pub mod config;
pub mod processor;

pub use config::{AudioConfig, RecordingState, VolumeStats};
pub use processor::{
    find_device_by_name, find_loopback_device, get_audio_devices, process_audio_data,
};
