import { invoke } from '@tauri-apps/api/core'
import { listen } from '@tauri-apps/api/event'
import { message } from 'antd'
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
  type RefObject,
} from 'react'

import { useEnvironment } from './EnvironmentContext'

export interface LogMessage {
  level: string
  message: string
  target: string
  timestamp: string
}

interface LogsContextValue {
  logs: LogMessage[]
  clearLogs: () => void
  autoScroll: boolean
  setAutoScroll: (value: boolean) => void
  scrollToBottom: (smooth: boolean) => void
  logsContainerRef: RefObject<HTMLDivElement>
  logsEndRef: RefObject<HTMLDivElement>
  getLogColor: (level: string) => string
  getLogBgColor: (level: string) => string
  handleTestLogs: () => Promise<void>
}

const LogsContext = createContext<LogsContextValue | undefined>(undefined)

export const LogsProvider = ({ children }: { children: ReactNode }) => {
  const { isTauriEnv } = useEnvironment()
  const [logs, setLogs] = useState<LogMessage[]>([])
  const [autoScroll, setAutoScroll] = useState(true)

  const logsEndRef = useRef<HTMLDivElement>(null)
  const logsContainerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!isTauriEnv) {
      return
    }

    let unlistenLogs: (() => void) | undefined

    const setupListener = async () => {
      try {
        unlistenLogs = await listen<LogMessage>('log-message', (event) => {
          const logMsg = event.payload
          setLogs((prevLogs) => {
            const next = [...prevLogs, logMsg]
            return next.length > 500 ? next.slice(-500) : next
          })
        })
      } catch (error) {
        console.error('设置日志事件监听器失败:', error)
      }
    }

    setupListener()

    return () => {
      if (unlistenLogs) {
        unlistenLogs()
      }
    }
  }, [isTauriEnv])

  const scrollToBottom = useCallback((smooth: boolean) => {
    const container = logsContainerRef.current
    if (!container) return

    const behavior: ScrollBehavior = smooth ? 'smooth' : 'auto'

    requestAnimationFrame(() => {
      container.scrollTo({ top: container.scrollHeight, behavior })
    })
  }, [])

  useEffect(() => {
    if (autoScroll && logs.length > 0) {
      scrollToBottom(true)
    }
  }, [logs, autoScroll, scrollToBottom])

  const clearLogs = useCallback(() => {
    setLogs([])
  }, [])

  const handleTestLogs = useCallback(async () => {
    try {
      await invoke<string>('test_logs')
      message.success('已发送测试日志')
    } catch (error) {
      console.error('测试日志失败:', error)
      message.error('测试日志失败')
    }
  }, [])

  const getLogColor = useCallback((level: string) => {
    switch (level) {
      case 'ERROR':
        return '#f44336'
      case 'WARN':
        return '#ff9800'
      case 'INFO':
        return '#2196F3'
      case 'DEBUG':
        return '#9e9e9e'
      default:
        return '#000'
    }
  }, [])

  const getLogBgColor = useCallback((level: string) => {
    switch (level) {
      case 'ERROR':
        return '#ffebee'
      case 'WARN':
        return '#fff3e0'
      case 'INFO':
        return '#e3f2fd'
      case 'DEBUG':
        return '#f5f5f5'
      default:
        return '#fff'
    }
  }, [])

  const value = useMemo<LogsContextValue>(
    () => ({
      logs,
      clearLogs,
      autoScroll,
      setAutoScroll,
      scrollToBottom,
      logsContainerRef,
      logsEndRef,
      getLogColor,
      getLogBgColor,
      handleTestLogs,
    }),
    [logs, clearLogs, autoScroll, scrollToBottom, getLogColor, getLogBgColor, handleTestLogs]
  )

  return <LogsContext.Provider value={value}>{children}</LogsContext.Provider>
}

export const useLogs = () => {
  const context = useContext(LogsContext)
  if (!context) {
    throw new Error('useLogs 必须在 LogsProvider 内使用')
  }
  return context
}
