import { AsrProvider, useAsr, type AsrResultMessage } from './AsrContext'
import { EnvironmentProvider, useEnvironment } from './EnvironmentContext'
import { LogsProvider, useLogs, type LogMessage } from './LogsContext'

import type { ReactNode } from 'react'

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
