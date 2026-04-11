import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { getCurrentWindow, LogicalSize, LogicalPosition } from '@tauri-apps/api/window'
import type { SubtitleSettings } from '@/store/subtitleSettingsStore'

import { useAsrStore, type AsrResultMessage } from '@/store/asrStore'
import { useEnvironmentStore } from '@/store/environmentStore'
import { useSubtitleSettingsStore } from '@/store/subtitleSettingsStore'

// 欢迎消息列表
const WELCOME_MESSAGES = [
  '🎤 字幕功能已启动，准备接收语音识别结果...',
  '✨ 字幕已就绪，开始你的语音之旅吧！',
  '🚀 字幕系统已激活，让我们开始吧！',
  '🎬 字幕已开启，准备好展示你的话语了吗？',
  '💬 字幕功能已启用，等待你的声音...',
  '🎯 字幕已就位，你的每一句话都会被记录！',
  '📝 字幕系统在线，说吧，我在听！',
  '🎪 字幕大舞台已搭建，请开始你的表演！',
  '🎨 字幕画布已展开，用你的声音作画吧！',
  '🎭 字幕剧场已开幕，主角就是你！',
  '🎵 字幕已调音，准备捕捉你的每一个音符！',
  '🎪 字幕马戏团已开演，你的声音是主角！',
  '🎲 字幕已掷骰，让我们看看你会说什么！',
  '🎁 字幕礼物已拆封，等待你的声音填满它！',
  '🎈 字幕气球已充气，准备承载你的话语！',
]

interface SubtitleItem {
  id: number
  sentenceId: number
  originalText: string
  translatedText?: string
  timestamp: number
  isFinal: boolean
}

// 欢迎消息在模块级别初始化，不依赖组件生命周期
// useState 惰性初始化函数在 React 18 StrictMode 下也只调用一次，彻底规避双挂载问题
const createInitialQueue = (): SubtitleItem[] => [
  {
    id: 0,
    sentenceId: -1,
    originalText: WELCOME_MESSAGES[Math.floor(Math.random() * WELCOME_MESSAGES.length)],
    timestamp: Date.now(),
    isFinal: true,
  },
]

const SubtitleOverlay = () => {
  const { asrResults, asrConfig } = useAsrStore()
  const settings = useSubtitleSettingsStore()
  const isTauriEnv = useEnvironmentStore((s) => s.isTauriEnv)

  // 使用惰性初始化，确保欢迎消息在 StrictMode 双挂载下仍能正确显示
  const [subtitleQueue, setSubtitleQueue] = useState<SubtitleItem[]>(createInitialQueue)
  // id 从 1 开始，0 已被欢迎消息占用
  const subtitleIdRef = useRef(1)
  const sentenceIdToSubtitleIdRef = useRef<Map<number, number>>(new Map())
  const bubbleObserverRef = useRef<ResizeObserver | null>(null)

  const isTranslationEnabled = asrConfig?.type === 'gummy' && asrConfig.translation_enabled

  // 处理 ASR 识别结果（始终处理，不依赖 settings.enabled）
  useEffect(() => {
    const finalTranscriptionResults = asrResults.filter(
      (item: AsrResultMessage) => item.kind === 'transcription' && item.is_final
    )
    const finalTranslationResults = asrResults.filter(
      (item: AsrResultMessage) => item.kind === 'translation' && item.is_final
    )

    if (finalTranscriptionResults.length === 0) return

    const groupedBySentenceId = new Map<
      number,
      { transcription: AsrResultMessage; translations: AsrResultMessage[] }
    >()

    finalTranscriptionResults.forEach((transcription: AsrResultMessage) => {
      if (transcription.is_final) {
        const translations = finalTranslationResults.filter(
          (t: AsrResultMessage) => t.sentence_id === transcription.sentence_id && t.is_final
        )
        groupedBySentenceId.set(transcription.sentence_id, { transcription, translations })
      }
    })

    setSubtitleQueue(() => {
      const now = Date.now()
      const sortedResults = Array.from(groupedBySentenceId.values()).sort(
        (a, b) => a.transcription.begin_time - b.transcription.begin_time
      )
      if (sortedResults.length === 0) return []

      const { transcription, translations } = sortedResults[sortedResults.length - 1]
      const originalText = transcription.text
      let translatedText: string | undefined
      if (isTranslationEnabled && translations.length > 0) {
        translatedText = translations.reduce((latest, current) =>
          current.begin_time > latest.begin_time ? current : latest
        ).text
      }

      const existingSubtitleId = sentenceIdToSubtitleIdRef.current.get(transcription.sentence_id)
      const id = existingSubtitleId ?? subtitleIdRef.current++
      if (!existingSubtitleId) {
        sentenceIdToSubtitleIdRef.current.set(transcription.sentence_id, id)
      }
      return [
        {
          id,
          sentenceId: transcription.sentence_id,
          originalText,
          translatedText,
          timestamp: now,
          isFinal: true,
        },
      ]
    })
  }, [asrResults, isTranslationEnabled])

  // 强制当前窗口（字幕悬浮窗）的 html / body / #root 保持透明，
  // 防止 Tauri 默认白色窗口背景或 Vite 注入的样式污染透明区域。
  useEffect(() => {
    document.documentElement.style.backgroundColor = 'transparent'
    document.body.style.backgroundColor = 'transparent'
    const root = document.getElementById('root')
    if (root) root.style.backgroundColor = 'transparent'
    return () => {
      document.documentElement.style.backgroundColor = ''
      document.body.style.backgroundColor = ''
      if (root) root.style.backgroundColor = ''
    }
  }, [])

  // 锁定状态变化时同步调用 setIgnoreCursorEvents：
  //   locked=true  → 鼠标穿透（展示模式，不影响用户操作其他窗口）
  //   locked=false → 鼠标可交互（编辑模式，允许拖动）
  useEffect(() => {
    if (!isTauriEnv) return
    getCurrentWindow()
      .setIgnoreCursorEvents(settings.locked)
      .catch(() => {})
  }, [isTauriEnv, settings.locked])

  // callback ref：气泡 DOM 挂载时立即注册 ResizeObserver
  // 内容尺寸变化时同步调整窗口大小，确保窗口始终贴合字幕内容
  // 注意：拖拽通过 data-tauri-drag-region 属性实现（解锁模式下），无需手动绑定 mousedown
  const bubbleRef = useCallback(
    (el: HTMLDivElement | null) => {
      if (bubbleObserverRef.current) {
        bubbleObserverRef.current.disconnect()
        bubbleObserverRef.current = null
      }
      if (!el || !isTauriEnv) return
      const win = getCurrentWindow()
      const observer = new ResizeObserver(() => {
        const w = Math.ceil(el.offsetWidth)
        const h = Math.ceil(el.offsetHeight)
        if (w > 0 && h > 0) win.setSize(new LogicalSize(w, h)).catch(() => {})
      })
      observer.observe(el)
      bubbleObserverRef.current = observer
    },
    [isTauriEnv]
  )

  // 位置恢复 + onMoved 持久化
  useEffect(() => {
    if (!isTauriEnv) return
    const win = getCurrentWindow()
    const { windowX, windowY } = settings
    if (windowX !== null && windowY !== null) {
      win.setPosition(new LogicalPosition(windowX, windowY)).catch(() => {})
    }
    const unlisten = win.onMoved(({ payload }) => {
      settings.updateSetting('windowX', payload.x)
      settings.updateSetting('windowY', payload.y)
    })
    return () => {
      unlisten.then((fn) => fn())
    }
  }, [isTauriEnv]) // eslint-disable-line react-hooks/exhaustive-deps

  // 颜色转 rgba
  const hexToRgba = (hex: string, opacity: number) => {
    const normalized = hex.startsWith('#') ? hex : `#${hex}`
    const r = parseInt(normalized.slice(1, 3), 16)
    const g = parseInt(normalized.slice(3, 5), 16)
    const b = parseInt(normalized.slice(5, 7), 16)
    return `rgba(${r}, ${g}, ${b}, ${opacity})`
  }

  // 解锁模式下展示用户配置的真实字幕样式（样式预设 + 背景色/透明度/圆角等）
  const bubbleStyle: React.CSSProperties = useMemo(() => {
    if (settings.stylePreset === 'netflix') {
      return {
        backgroundColor: 'transparent',
        padding: '8px 16px',
        borderRadius: 0,
        display: 'inline-block',
        maxWidth: '800px',
        wordWrap: 'break-word',
        lineHeight: 1.5,
        textAlign: 'center',
      }
    }

    if (settings.stylePreset === 'youtube') {
      return {
        backgroundColor: 'rgba(0,0,0,0.75)',
        padding: '6px 16px',
        borderRadius: '4px',
        display: 'inline-block',
        maxWidth: '800px',
        wordWrap: 'break-word',
        lineHeight: 1.5,
        textAlign: 'center',
      }
    }

    const radiusMap: Record<SubtitleSettings['borderRadius'], string> = {
      none: '0',
      small: '6px',
      medium: '14px',
      pill: '9999px',
    }
    return {
      backgroundColor: `rgba(0, 0, 0, ${settings.backgroundOpacity / 100})`,
      backdropFilter: 'blur(12px)',
      WebkitBackdropFilter: 'blur(12px)',
      padding: '12px 24px',
      borderRadius: radiusMap[settings.borderRadius],
      display: 'inline-block',
      maxWidth: '800px',
      wordWrap: 'break-word',
      lineHeight: 1.5,
      textAlign: 'center',
    }
  }, [settings.backgroundOpacity, settings.stylePreset, settings.borderRadius])

  // 锁定 / 解锁两种状态都以 bubbleStyle 为基础（保证背景、圆角等用户配置始终生效）。
  // 解锁（编辑）模式额外叠加虚线边框 + cursor:move，提示用户当前可拖拽。
  const containerStyle: React.CSSProperties = useMemo(
    () => ({
      ...bubbleStyle,
      transition: 'background-color 200ms ease, outline 200ms ease',
      ...(!settings.locked && {
        cursor: 'move',
        outline: '2px dashed rgba(255, 255, 255, 0.6)',
        outlineOffset: '3px',
      }),
    }),
    [settings.locked, bubbleStyle]
  )

  const originalTextStyle: React.CSSProperties = useMemo(() => {
    const textShadow = '1px 1px 2px rgba(0,0,0,0.8), -1px -1px 2px rgba(0,0,0,0.8)'
    if (settings.stylePreset === 'netflix') {
      return {
        color: '#FFFFFF',
        fontSize: `${Math.max(settings.fontSize, 20)}px`,
        fontFamily: settings.fontFamily,
        fontWeight: 700,
        fontStyle: settings.fontStyle,
        lineHeight: 1.5,
        letterSpacing: '0.02em',
        textShadow,
      }
    }
    if (settings.stylePreset === 'youtube') {
      return {
        color: '#FFFFFF',
        fontSize: `${Math.max(settings.fontSize, 18)}px`,
        fontFamily: settings.fontFamily,
        fontWeight: 400,
        fontStyle: settings.fontStyle,
        lineHeight: 1.5,
        textShadow,
      }
    }
    return {
      color: hexToRgba(settings.fontColor, 0.9),
      fontSize: `${settings.fontSize}px`,
      fontFamily: settings.fontFamily,
      fontWeight: settings.fontWeight,
      fontStyle: settings.fontStyle,
      lineHeight: 1.5,
      letterSpacing: '0.02em',
      textShadow,
    }
  }, [
    settings.fontColor,
    settings.fontSize,
    settings.fontFamily,
    settings.fontWeight,
    settings.fontStyle,
    settings.stylePreset,
  ])

  // bubbleStyle 现在在锁定和解锁两种模式下都会提供背景托底，
  // 不再需要用强制文字阴影来补救透明背景下的可读性问题。
  // netflix 预设本身的 textShadow 已在 originalTextStyle 中内置，无需额外覆盖。
  const effectiveOriginalTextStyle = originalTextStyle

  const translatedTextStyle: React.CSSProperties = useMemo(
    () => ({
      color: '#facc15',
      fontSize: `${Math.round(settings.fontSize * 1.35)}px`,
      fontFamily: settings.fontFamily,
      fontWeight: 'bold',
      fontStyle: settings.fontStyle,
      lineHeight: 1.5,
      textShadow: '1px 1px 2px rgba(0,0,0,0.8), -1px -1px 2px rgba(0,0,0,0.8)',
    }),
    [settings.fontFamily, settings.fontSize, settings.fontStyle]
  )

  if (subtitleQueue.length === 0) {
    return null
  }

  return (
    // 解锁模式：data-tauri-drag-region 让整个气泡区域成为系统级拖拽句柄，
    // 用户按住任意位置即可在屏幕上自由移动窗口。
    // 锁定模式：移除该属性；setIgnoreCursorEvents(true) 已在 useEffect 中处理鼠标穿透。
    <div
      ref={bubbleRef}
      {...(!settings.locked ? { 'data-tauri-drag-region': '' } : {})}
      style={containerStyle}
    >
      {subtitleQueue.map((item) => (
        <div
          key={item.id}
          style={{
            marginBottom: subtitleQueue.length > 1 ? '8px' : '0',
          }}
        >
          <div>
            {item.originalText.split('\n').map((line: string, index: number) => (
              <div key={index} style={effectiveOriginalTextStyle}>
                {line || '\u00A0'}
              </div>
            ))}
          </div>
          {item.translatedText && (
            <div style={{ marginTop: 2 }}>
              {item.translatedText.split('\n').map((line: string, index: number) => (
                <div key={index} style={translatedTextStyle}>
                  {line || '\u00A0'}
                </div>
              ))}
            </div>
          )}
        </div>
      ))}
    </div>
  )
}

export default SubtitleOverlay
