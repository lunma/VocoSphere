import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react'
import { invoke } from '@tauri-apps/api/core'
import { listen } from '@tauri-apps/api/event'
import type { AsrModelConfig } from '../components/AsrConfig'
import { useEnvironment } from './EnvironmentContext'

export interface AsrResultMessage {
  sentence_id: number
  begin_time: number
  end_time?: number | null
  text: string
  is_final: boolean
  kind: 'transcription' | 'translation'
  lang?: string | null
}

interface AsrContextValue {
  asrConfig: AsrModelConfig | null
  setAsrConfig: (config: AsrModelConfig | null) => void
  isCapturing: boolean
  audioStatus: string
  handleStartAudioCapture: () => Promise<void>
  handleStopAudioCapture: () => Promise<void>
  asrResults: AsrResultMessage[]
  clearAsrResults: () => void
  formatTimeRange: (begin: number, end?: number | null) => string
}

const AsrContext = createContext<AsrContextValue | undefined>(undefined)

export const AsrProvider = ({ children }: { children: ReactNode }) => {
  const { isTauriEnv } = useEnvironment()
  const [asrConfig, setAsrConfig] = useState<AsrModelConfig | null>(null)
  const [isCapturing, setIsCapturing] = useState(false)
  const [audioStatus, setAudioStatus] = useState('')
  const [asrResults, setAsrResults] = useState<AsrResultMessage[]>([])

  useEffect(() => {
    if (!isTauriEnv) {
      return
    }

    let unlistenAsr: (() => void) | undefined

    const setupListener = async () => {
      try {
        unlistenAsr = await listen<AsrResultMessage>('asr-result', (event) => {
          const result = event.payload
          setAsrResults((prevResults) => {
            const normalized: AsrResultMessage = {
              ...result,
              end_time: result.end_time ?? null,
            }
            const existingIndex = prevResults.findIndex(
              (item) =>
                item.kind === normalized.kind &&
                item.sentence_id === normalized.sentence_id &&
                (item.lang ?? '') === (normalized.lang ?? '')
            )

            let nextResults: AsrResultMessage[]
            if (existingIndex >= 0) {
              nextResults = [...prevResults]
              nextResults[existingIndex] = {
                ...nextResults[existingIndex],
                ...normalized,
              }
            } else {
              nextResults = [...prevResults, normalized]
            }

            return nextResults
              .slice()
              .sort((a, b) => {
                if (a.begin_time !== b.begin_time) {
                  return a.begin_time - b.begin_time
                }
                if (a.sentence_id !== b.sentence_id) {
                  return a.sentence_id - b.sentence_id
                }
                return (a.lang ?? '').localeCompare(b.lang ?? '')
              })
          })
        })
      } catch (error) {
        console.error('设置 ASR 事件监听器失败:', error)
      }
    }

    setupListener()

    return () => {
      if (unlistenAsr) {
        unlistenAsr()
      }
    }
  }, [isTauriEnv])

  const handleStartAudioCapture = useCallback(async () => {
    try {
      if (!asrConfig) {
        setAudioStatus('错误: 配置尚未加载')
        return
      }

      setAudioStatus('正在启动音频捕获...')
      const result = await invoke<string>('start_audio_capture', { config: asrConfig })
      setIsCapturing(true)
      setAudioStatus(result + ' - 点击停止按钮结束捕获')
    } catch (error) {
      setAudioStatus(`错误: ${error}`)
      setIsCapturing(false)
    }
  }, [asrConfig])

  const handleStopAudioCapture = useCallback(async () => {
    try {
      setAudioStatus('正在停止音频捕获...')
      const result = await invoke<string>('stop_audio_capture')
      setIsCapturing(false)
      setAudioStatus(result)
    } catch (error) {
      setAudioStatus(`错误: ${error}`)
    }
  }, [])

  const clearAsrResults = useCallback(() => {
    setAsrResults([])
  }, [])

  const formatTimeRange = useCallback((begin: number, end?: number | null) => {
    const beginSec = (begin / 1000).toFixed(2)
    if (end != null && end > 0) {
      const endSec = (end / 1000).toFixed(2)
      return `${beginSec}s - ${endSec}s`
    }
    return `${beginSec}s`
  }, [])

  const value = useMemo<AsrContextValue>(
    () => ({
      asrConfig,
      setAsrConfig,
      isCapturing,
      audioStatus,
      handleStartAudioCapture,
      handleStopAudioCapture,
      asrResults,
      clearAsrResults,
      formatTimeRange,
    }),
    [
      asrConfig,
      isCapturing,
      audioStatus,
      handleStartAudioCapture,
      handleStopAudioCapture,
      asrResults,
      clearAsrResults,
      formatTimeRange,
    ]
  )

  return <AsrContext.Provider value={value}>{children}</AsrContext.Provider>
}

export const useAsr = () => {
  const context = useContext(AsrContext)
  if (!context) {
    throw new Error('useAsr 必须在 AsrProvider 内使用')
  }
  return context
}

