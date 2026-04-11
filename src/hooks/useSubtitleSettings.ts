import { useCallback, useEffect } from 'react'
import { load } from '@tauri-apps/plugin-store'
import { emit } from '@tauri-apps/api/event'
import { WebviewWindow } from '@tauri-apps/api/webviewWindow'

import { useSubtitleSettingsStore, DEFAULT_SETTINGS } from '@/store/subtitleSettingsStore'
import { useEnvironmentStore } from '@/store/environmentStore'
import type { SubtitleSettings } from '@/store/subtitleSettingsStore'

const STORE_FILE = 'subtitle_settings.json'

// Module-level store promise cache — avoids reopening the file on every call
let storePromise: ReturnType<typeof load> | null = null
const getStore = () => {
  if (!storePromise) {
    storePromise = load(STORE_FILE, {
      autoSave: false,
      defaults: DEFAULT_SETTINGS as unknown as Record<string, unknown>,
    })
  }
  return storePromise
}

function extractSettings(
  state: ReturnType<typeof useSubtitleSettingsStore.getState>
): SubtitleSettings {
  const { updateSetting: _u, resetSettings: _r, ...settings } = state
  return settings
}

/**
 * 主窗口使用的字幕设置 hook。
 *
 * - 挂载时从 tauri-plugin-store 读取已持久化的配置，回退至默认值。
 * - updateSetting：更新 Zustand → 保存到 store 文件 → emit('subtitle-settings-changed')。
 * - enabled 切换时直接调用 WebviewWindow.show() / .hide()。
 * - locked 切换时，字幕窗口通过监听 subtitle-settings-changed 事件自行调用
 *   setIgnoreCursorEvents()，无需额外事件。
 */
export const useSubtitleSettings = () => {
  const isTauriEnv = useEnvironmentStore((s) => s.isTauriEnv)
  const storeState = useSubtitleSettingsStore()

  // ── 初始化：从 tauri-plugin-store 读取持久化设置 ──────────────────────────
  useEffect(() => {
    if (!isTauriEnv) return
    getStore()
      .then(async (store) => {
        const partial: Partial<SubtitleSettings> = {}
        for (const key of Object.keys(DEFAULT_SETTINGS) as (keyof SubtitleSettings)[]) {
          const val = await store.get<SubtitleSettings[typeof key]>(key)
          if (val !== undefined && val !== null) {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            ;(partial as any)[key] = val
          }
        }
        if (Object.keys(partial).length > 0) {
          useSubtitleSettingsStore.setState(partial)
        }
      })
      .catch(() => {})
  }, [isTauriEnv])

  // ── updateSetting：更新状态 + 持久化 + 广播事件 ───────────────────────────
  const updateSetting = useCallback(
    async <K extends keyof SubtitleSettings>(key: K, value: SubtitleSettings[K]) => {
      // 1. 更新 Zustand（同步）
      useSubtitleSettingsStore.getState().updateSetting(key, value)

      // 2. 取出最新完整设置
      const newSettings = extractSettings(useSubtitleSettingsStore.getState())

      if (!isTauriEnv) return

      // 3. 保存单个字段到 store 文件
      try {
        const store = await getStore()
        await store.set(key as string, value)
        await store.save()
      } catch {
        // 持久化失败不影响运行时状态
      }

      // 4. 广播最新配置给字幕窗口
      emit('subtitle-settings-changed', newSettings).catch(() => {})

      // 5. 特殊处理：enabled 切换 → 显示 / 隐藏字幕窗口
      if (key === 'enabled') {
        const win = await WebviewWindow.getByLabel('subtitle-overlay')
        if (value) {
          win?.show().catch(() => {})
        } else {
          win?.hide().catch(() => {})
        }
      }
    },
    [isTauriEnv]
  )

  // ── resetSettings：恢复默认 + 持久化 + 广播 ──────────────────────────────
  const resetSettings = useCallback(async () => {
    useSubtitleSettingsStore.getState().resetSettings()
    const newSettings = extractSettings(useSubtitleSettingsStore.getState())

    if (!isTauriEnv) return

    try {
      const store = await getStore()
      for (const [key, value] of Object.entries(newSettings)) {
        await store.set(key, value)
      }
      await store.save()
    } catch {
      //--
    }

    emit('subtitle-settings-changed', newSettings).catch(() => {})

    // 默认值 enabled=false，隐藏字幕窗口
    const win = await WebviewWindow.getByLabel('subtitle-overlay')
    win?.hide().catch(() => {})
  }, [isTauriEnv])

  const { updateSetting: _u, resetSettings: _r, ...settings } = storeState

  return { ...settings, updateSetting, resetSettings }
}
