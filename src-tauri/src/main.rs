// 在 Windows 打包运行时隐藏黑色控制台窗口；调试模式仍保留控制台方便看日志。
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

// 声明项目模块
use tauri::window::Color;
use tauri::Manager;
// macOS：字幕悬浮窗专用 NSPanel 类型
// NonactivatingPanel + 不可成为 key window，确保字幕层不抢夺焦点
#[cfg(target_os = "macos")]
tauri_nspanel::tauri_panel! {
    SubtitlePanel {
        config: {
            can_become_key_window: false,
            is_floating_panel: true
        }
    }
}

mod app_state;
mod asr; // ASR（自动语音识别）模块
mod audio; // 音频处理模块
mod audio_capture; // 音频捕获功能模块（对外暴露的 Tauri 命令）
mod file_recognition; // 文件识别命令
mod logger; // 日志模块（将日志发送到前端）
mod utils; // 工具函数模块
mod video_subtitle; // 视频字幕功能模块

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

/// 将文本内容写入本地文件（用于日志导出）
#[tauri::command]
async fn write_text_file(path: String, content: String) -> Result<(), String> {
    std::fs::write(&path, content).map_err(|e| e.to_string())
}

/// 用系统默认浏览器打开 URL
#[tauri::command]
#[allow(deprecated)]
async fn open_url(app: tauri::AppHandle, url: String) -> Result<(), String> {
    use tauri_plugin_shell::ShellExt;
    app.shell().open(&url, None).map_err(|e| e.to_string())
}

/// 测试日志功能的命令
#[tauri::command]
fn test_logs() -> String {
    log::debug!("这是一条 DEBUG 级别的日志");
    log::info!("这是一条 INFO 级别的日志");
    log::warn!("这是一条 WARN 级别的日志");
    log::error!("这是一条 ERROR 级别的日志");

    log::info!("正在初始化系统...");
    log::debug!("加载配置文件: config.json");
    log::info!("系统初始化完成");
    log::warn!("检测到旧版本数据，将自动迁移");

    "已发送测试日志，请查看日志面板".to_string()
}

// 当前仅为桌面端构建
pub fn main() {
    // 提前初始化日志系统，确保在 Tauri 注册默认日志器之前挂载
    logger::init_logger();

    let builder = tauri::Builder::default()
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_store::Builder::new().build())
        .plugin(tauri_plugin_dialog::init());

    // macOS：注册 NSPanel 插件（管理 WebviewPanelManager 状态）
    #[cfg(target_os = "macos")]
    let builder = builder.plugin(tauri_nspanel::init());

    builder
        // 注册前端可调用的命令处理器
        .invoke_handler(tauri::generate_handler![
            greet,
            test_logs,
            write_text_file,
            audio_capture::get_audio_devices,
            audio_capture::start_audio_capture,
            audio_capture::stop_audio_capture,
            video_subtitle::get_ffmpeg_version,
            video_subtitle::check_ffmpeg_subtitle_support,
            video_subtitle::select_video,
            video_subtitle::select_model_file,
            open_url,
            video_subtitle::extract_audio,
            video_subtitle::start_video_asr,
            video_subtitle::export_video_with_subtitles,
            video_subtitle::translate_subtitles,
            file_recognition::recognize_file
        ])
        // 设置应用启动后的回调
        .setup(|app| {
            // 保存 AppHandle 供全局使用
            app_state::set_app_handle(app.handle().clone());
            // 初始化日志系统
            logger::attach_app_handle(app.handle().clone());
            log::info!("Tauri 应用启动成功");

            // macOS：将字幕悬浮窗转换为 NSPanel
            #[cfg(target_os = "macos")]
            {
                use tauri_nspanel::{CollectionBehavior, PanelLevel, StyleMask, WebviewWindowExt};

                if let Some(subtitle_win) = app.get_webview_window("subtitle-overlay") {
                    match subtitle_win.to_panel::<SubtitlePanel>() {
                        Ok(panel) => {
                            subtitle_win
                                .set_background_color(Some(Color(0, 0, 0, 0)))
                                .ok();

                            // Floating level（4）让字幕浮于普通窗口之上
                            panel.set_level(PanelLevel::Floating.value());

                            // 只保留 NonactivatingPanel，去掉 HUDBackground（灰色毛玻璃底板）
                            panel.set_style_mask(StyleMask::empty().nonactivating_panel().into());

                            // CanJoinAllSpaces | Stationary | IgnoresCycle | FullScreenAuxiliary
                            panel.set_collection_behavior(
                                CollectionBehavior::new()
                                    .can_join_all_spaces()
                                    .stationary()
                                    .ignores_cycle()
                                    .full_screen_auxiliary()
                                    .into(),
                            );

                            panel.set_hides_on_deactivate(false);
                            panel.set_becomes_key_only_if_needed(false);
                            panel.set_has_shadow(false);

                            log::info!(
                                "字幕悬浮窗已转换为 NSPanel（跨 Space、全屏兼容、完全透明）"
                            );
                        }
                        Err(e) => {
                            log::error!("字幕窗口转 NSPanel 失败，跳过面板配置: {:?}", e);
                        }
                    }
                }
            }

            // 非 macOS：初始化字幕窗口背景及悬浮特性
            #[cfg(not(target_os = "macos"))]
            {
                if let Some(subtitle_win) = app.get_webview_window("subtitle-overlay") {
                    // 1. 设置背景透明
                    subtitle_win
                        .set_background_color(Some(Color(0, 0, 0, 0)))
                        .ok();

                    // 2. 设置窗口置顶（让字幕始终在最上层）
                    subtitle_win.set_always_on_top(true).ok();

                    // 3. 开启鼠标穿透（让鼠标点击可以穿透字幕窗口，点到后面的网页或应用）
                    // 注意：开启此功能后，字幕窗口将无法响应鼠标事件。如果你的字幕需要拖拽，请在前端控制或动态切换此状态。
                    // 前端已经实现
                    //subtitle_win.set_ignore_cursor_events(true).ok();

                    // 4. 不在任务栏显示（可选，让它更像一个纯粹的挂件）
                    subtitle_win.set_skip_taskbar(true).ok();

                    log::info!("字幕悬浮窗初始化完成（非 macOS 路径，已开启置顶与穿透）");
                }
            }

            Ok(())
        })
        // 运行 Tauri 应用，传入自动生成的上下文信息
        .run(tauri::generate_context!())
        // 如果应用运行失败，则 panic 并显示错误信息
        .expect("error while running tauri application");
}
