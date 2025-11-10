import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'
import { isTauri } from '@tauri-apps/api/core'

interface EnvironmentContextValue {
  isTauriEnv: boolean
}

const EnvironmentContext = createContext<EnvironmentContextValue | undefined>(undefined)

export const EnvironmentProvider = ({ children }: { children: ReactNode }) => {
  const [isTauriEnv, setIsTauriEnv] = useState(false)

  useEffect(() => {
    try {
      setIsTauriEnv(isTauri())
    } catch (error) {
      console.error('Tauri 环境检查失败:', error)
      setIsTauriEnv(false)
    }
  }, [])

  return <EnvironmentContext.Provider value={{ isTauriEnv }}>{children}</EnvironmentContext.Provider>
}

export const useEnvironment = () => {
  const context = useContext(EnvironmentContext)
  if (!context) {
    throw new Error('useEnvironment 必须在 EnvironmentProvider 内使用')
  }
  return context
}

