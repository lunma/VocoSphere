import { listen } from '@tauri-apps/api/event'
import { getCurrentWindow } from '@tauri-apps/api/window'
import { load } from '@tauri-apps/plugin-store'
import { useEffect } from 'react'
import * as React from 'react'
import { createRoot } from 'react-dom/client'

import './subtitle.css'
import SubtitleOverlay from './components/SubtitleOverlay'
import { useAsrListener } from './hooks/useTauriListeners'
import { useAsrStore } from './store/asrStore'
import { useSubtitleSettingsStore, DEFAULT_SETTINGS } from './store/subtitleSettingsStore'

import type { SubtitleSettings } from './store/subtitleSettingsStore'

const STORE_FILE = 'subtitle_settings.json'

const SubtitleApp = () => {
  useAsrListener()

  // 从 tauri-plugin-store 读取持久化设置，完成后根据 enabled 决定是否 show()。
  // 避免依赖主窗口推送事件，解决启动时的竞态问题。
  useEffect(() => {
    load(STORE_FILE, {
      autoSave: false,
      defaults: DEFAULT_SETTINGS as unknown as Record<string, unknown>,
    })
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
        if (useSubtitleSettingsStore.getState().enabled) {
          getCurrentWindow()
            .show()
            .catch(() => {})
        }
      })
      .catch(() => {
        // store 不存在时回退到默认值，enabled=false 不显示窗口
      })
  }, [])

  // 主窗口通过 emitTo 控制本窗口显隐。
  useEffect(() => {
    const unlisten = listen<{ show: boolean }>('subtitle-visibility', (event) => {
      const win = getCurrentWindow()
      if (event.payload.show) {
        win.show().catch(() => {})
      } else {
        win.hide().catch(() => {})
      }
    })
    return () => {
      unlisten.then((fn) => fn())
    }
  }, [])

  // 字幕窗口显示时主窗口主动推送最新设置（emitTo），同步到本窗口 store。
  useEffect(() => {
    const unlisten = listen<SubtitleSettings>('subtitle-settings-sync', (event) => {
      useSubtitleSettingsStore.setState(event.payload)
    })
    return () => {
      unlisten.then((fn) => fn())
    }
  }, [])

  // 接收主窗口广播的实时设置变更，同步到本窗口的 Zustand store。
  // SubtitleOverlay 从 store 读取，locked 变化会触发其内部 setIgnoreCursorEvents 副作用。
  useEffect(() => {
    const unlisten = listen<SubtitleSettings>('subtitle-settings-changed', (event) => {
      useSubtitleSettingsStore.setState(event.payload)
    })
    return () => {
      unlisten.then((fn) => fn())
    }
  }, [])

  // 新的音频捕获会话开始时，清除本窗口的旧 ASR 结果。
  // 两个窗口各持有独立的 Zustand 实例，主窗口的 clearAsrResults() 不会影响本窗口，
  // 若不清除，上一次会话的高 begin_time 会遮盖新会话的字幕（begin_time 从 0 重新计时）。
  useEffect(() => {
    const unlisten = listen('asr-session-reset', () => {
      useAsrStore.getState().clearAsrResults()
    })
    return () => {
      unlisten.then((fn) => fn())
    }
  }, [])

  // 字幕窗口位置变化时同步回 store 文件，保证下次启动能恢复位置。
  useEffect(() => {
    return useSubtitleSettingsStore.subscribe((state, prevState) => {
      if (state.windowX === prevState.windowX && state.windowY === prevState.windowY) return
      load(STORE_FILE, {
        autoSave: false,
        defaults: DEFAULT_SETTINGS as unknown as Record<string, unknown>,
      })
        .then(async (store) => {
          await store.set('windowX', state.windowX)
          await store.set('windowY', state.windowY)
          await store.save()
        })
        .catch(() => {})
    })
  }, [])

  return <SubtitleOverlay />
}

createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <SubtitleApp />
  </React.StrictMode>
)
