// 在 Windows 打包运行时隐藏黑色控制台窗口；调试模式仍保留控制台方便看日志。
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

// 声明项目模块
mod app_state;
mod asr; // ASR（自动语音识别）模块
mod audio; // 音频处理模块
mod audio_capture; // 音频捕获功能模块（对外暴露的 Tauri 命令）
mod logger; // 日志模块（将日志发送到前端）
mod utils; // 工具函数模块

#[tauri::command]
fn greet(name: &str) -> String {
    log::info!("收到前端的问候请求，名字: {}", name);
    log::debug!("这是一条调试日志");
    log::warn!("这是一条警告日志示例");

    if name.is_empty() {
        log::error!("名字不能为空！");
        return "错误：名字不能为空".to_string();
    }

    format!("你好, {}! 来自 Rust 的问候。", name)
}

/// 测试日志功能的命令
#[tauri::command]
fn test_logs() -> String {
    log::debug!("这是一条 DEBUG 级别的日志");
    log::info!("这是一条 INFO 级别的日志");
    log::warn!("这是一条 WARN 级别的日志");
    log::error!("这是一条 ERROR 级别的日志");

    // 模拟一些实际场景的日志
    log::info!("正在初始化系统...");
    log::debug!("加载配置文件: config.json");
    log::info!("系统初始化完成");
    log::warn!("检测到旧版本数据，将自动迁移");

    "已发送测试日志，请查看日志面板".to_string()
}

// 当前仅为桌面端构建
// #[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn main() {
    // 提前初始化日志系统，确保在 Tauri 注册默认日志器之前挂载
    logger::init_logger();

    // 创建默认的 Tauri 应用构建器
    tauri::Builder::default()
        // 注册 shell 插件，用于执行系统命令
        .plugin(tauri_plugin_shell::init())
        // 注册前端可调用的命令处理器
        .invoke_handler(tauri::generate_handler![
            greet,
            test_logs,
            audio_capture::get_audio_devices,
            audio_capture::start_audio_capture,
            audio_capture::stop_audio_capture
        ])
        // 设置应用启动后的回调
        .setup(|app| {
            // 保存 AppHandle 供全局使用
            app_state::set_app_handle(app.handle().clone());
            // 初始化日志系统
            logger::attach_app_handle(app.handle().clone());
            log::info!("Tauri 应用启动成功");
            Ok(())
        })
        // 运行 Tauri 应用，传入自动生成的上下文信息
        .run(tauri::generate_context!())
        // 如果应用运行失败，则 panic 并显示错误信息
        .expect("error while running tauri application");
}
