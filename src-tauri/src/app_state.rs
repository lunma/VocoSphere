use serde::Serialize;
use std::sync::OnceLock;
use tauri::{AppHandle, Emitter};

static APP_HANDLE: OnceLock<AppHandle> = OnceLock::new();

/// 保存全局 AppHandle，便于其他模块发送事件到前端
pub fn set_app_handle(handle: AppHandle) {
    let _ = APP_HANDLE.set(handle);
}

/// 获取 AppHandle 副本
pub fn get_app_handle() -> Option<AppHandle> {
    APP_HANDLE.get().cloned()
}

/// 发送事件到前端
pub fn emit_event<T: Serialize>(event_name: &str, payload: &T) -> Result<(), String> {
    if let Some(app) = APP_HANDLE.get() {
        app.emit(event_name, payload)
            .map_err(|e| format!("发送事件失败: {e}"))
    } else {
        Err("AppHandle 尚未初始化".to_string())
    }
}
