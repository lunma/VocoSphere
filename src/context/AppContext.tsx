import type { ReactNode } from 'react'
import { EnvironmentProvider, useEnvironment } from './EnvironmentContext'
import { AsrProvider, useAsr, type AsrResultMessage } from './AsrContext'
import { LogsProvider, useLogs, type LogMessage } from './LogsContext'

export const AppProvider = ({ children }: { children: ReactNode }) => {
  return (
    <EnvironmentProvider>
      <AsrProvider>
        <LogsProvider>{children}</LogsProvider>
      </AsrProvider>
    </EnvironmentProvider>
  )
}

export { useEnvironment, useAsr, useLogs, type AsrResultMessage, type LogMessage }
