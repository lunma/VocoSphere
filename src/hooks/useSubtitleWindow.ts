import { emitTo } from '@tauri-apps/api/event'
import { useEffect } from 'react'

import { useEnvironmentStore } from '@/store/environmentStore'
import { useSubtitleSettingsStore } from '@/store/subtitleSettingsStore'

import type { SubtitleSettings } from '@/store/subtitleSettingsStore'

function extractSettings(
  state: ReturnType<typeof useSubtitleSettingsStore.getState>
): SubtitleSettings {
  const { updateSetting: _u, resetSettings: _r, ...settings } = state
  return settings
}

/**
 * 从主窗口直接控制字幕悬浮窗的显隐，并通过 Tauri 事件同步设置。
 * storage 事件在 Tauri WKWebView 跨窗口之间不可靠，
 * 因此显隐由主窗口持有 WebviewWindow 句柄直接调用，
 * 设置同步通过 emitTo('subtitle-overlay', 'subtitle-settings-sync') 完成。
 */
export const useSubtitleWindow = () => {
  const isTauriEnv = useEnvironmentStore((s) => s.isTauriEnv)
  const enabled = useSubtitleSettingsStore((s) => s.enabled)

  // 控制字幕窗口显隐：通过事件让字幕窗口控制自身（避免 getByLabel 异步时序问题）
  // 显示时同步推送最新设置，确保样式正确
  useEffect(() => {
    if (!isTauriEnv) return
    if (enabled) {
      emitTo(
        'subtitle-overlay',
        'subtitle-settings-sync',
        extractSettings(useSubtitleSettingsStore.getState())
      ).catch(() => {})
    }
    emitTo('subtitle-overlay', 'subtitle-visibility', { show: enabled }).catch(() => {})
  }, [isTauriEnv, enabled])

  // 订阅后续设置变更，实时同步到字幕窗口
  useEffect(() => {
    if (!isTauriEnv) return
    return useSubtitleSettingsStore.subscribe((state) => {
      emitTo('subtitle-overlay', 'subtitle-settings-sync', extractSettings(state)).catch(() => {})
    })
  }, [isTauriEnv])
}
