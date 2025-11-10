use log::{LevelFilter, Metadata, Record};
use serde::{Deserialize, Serialize};
use std::sync::OnceLock;
use tauri::{AppHandle, Emitter};

/// 日志消息结构体，用于序列化发送到前端
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct LogMessage {
    /// 日志级别（DEBUG, INFO, WARN, ERROR）
    pub level: String,
    /// 日志消息内容
    pub message: String,
    /// 日志模块/目标
    pub target: String,
    /// 时间戳
    pub timestamp: String,
}

/// 自定义日志处理器，将日志发送到前端
pub struct TauriLogger {
    /// AppHandle 用于发送事件到前端
    /// - OnceLock: 只初始化一次，之后不可变
    /// - 适合"写一次，读多次"的场景，性能更好
    app_handle: OnceLock<AppHandle>,
    level: LevelFilter,
}

impl TauriLogger {
    /// 创建新的 TauriLogger 实例（编译时常量）
    pub const fn new(level: LevelFilter) -> Self {
        Self {
            app_handle: OnceLock::new(),
            level,
        }
    }

    /// 设置 AppHandle（在应用启动后调用，只能调用一次）
    pub fn set_app_handle(&self, handle: AppHandle) -> Result<(), AppHandle> {
        // OnceLock::set 只能成功一次，后续调用会失败（返回 Err）
        // 这正好符合我们的需求：只设置一次
        self.app_handle.set(handle)
    }

    /// 获取当前时间戳字符串
    fn get_timestamp() -> String {
        use std::time::{SystemTime, UNIX_EPOCH};
        let now = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .unwrap()
            .as_secs();

        // 格式化为可读时间
        let datetime = chrono::DateTime::from_timestamp(now as i64, 0)
            .unwrap_or_else(|| chrono::DateTime::UNIX_EPOCH);
        datetime.format("%H:%M:%S").to_string()
    }
}

impl log::Log for TauriLogger {
    fn enabled(&self, metadata: &Metadata) -> bool {
        metadata.level() <= self.level
    }

    fn log(&self, record: &Record) {
        if !self.enabled(record.metadata()) {
            return;
        }

        // 构造日志消息
        let log_msg = LogMessage {
            level: record.level().to_string(),
            message: format!("{}", record.args()),
            target: record.target().to_string(),
            timestamp: Self::get_timestamp(),
        };

        // 同时输出到控制台（开发模式下）
        println!(
            "[{}] {} - {} - {}",
            log_msg.timestamp, log_msg.level, log_msg.target, log_msg.message
        );

        // 发送到前端
        // OnceLock::get() 返回 Option<&T>，无需加锁，性能更好
        if let Some(app) = self.app_handle.get() {
            match app.emit("log-message", &log_msg) {
                Ok(_) => {
                    // 日志发送成功（调试时可以看到）
                }
                Err(e) => {
                    eprintln!("❌ 发送日志到前端失败: {:?}", e);
                }
            }
        } else {
            eprintln!("⚠️ AppHandle 未设置，日志无法发送到前端");
        }
    }

    fn flush(&self) {}
}

/// 全局日志处理器实例
/// 使用编译时初始化（const），零运行时开销
static LOGGER: TauriLogger = TauriLogger::new(LevelFilter::Debug);
static LOGGER_INITIALIZED: OnceLock<()> = OnceLock::new();

/// 初始化日志系统
pub fn init_logger() {
    LOGGER_INITIALIZED.get_or_init(|| {
        match log::set_logger(&LOGGER) {
            Ok(_) => {
                log::set_max_level(LevelFilter::Debug);
                println!("✅ 自定义 Tauri 日志器已注册");
            }
            Err(err) => {
                eprintln!("❌ 设置日志处理器失败: {:?}", err);
            }
        }
    });
}

/// 绑定 AppHandle，便于将日志事件发送给前端
pub fn attach_app_handle(app_handle: AppHandle) {
    match LOGGER.set_app_handle(app_handle) {
        Ok(()) => {
            log::info!("日志系统初始化完成");
        }
        Err(_) => {
            log::warn!("AppHandle 已设置，忽略重复绑定");
        }
    }
}
