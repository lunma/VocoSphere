import { create } from 'zustand'

export interface LogMessage {
  level: string
  message: string
  target: string
  timestamp: string
}

interface LogsStore {
  logs: LogMessage[]

  addLog: (log: LogMessage) => void
  clearLogs: () => void
}

export const useLogsStore = create<LogsStore>((set) => ({
  logs: [],

  addLog: (log) =>
    set((state) => {
      const next = [...state.logs, log]
      return { logs: next.length > 500 ? next.slice(-500) : next }
    }),

  clearLogs: () => set({ logs: [] }),
}))

export const getLogColor = (level: string): string => {
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
}

export const getLogBgColor = (level: string): string => {
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
}
