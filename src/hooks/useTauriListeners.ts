import { listen } from '@tauri-apps/api/event'
import { useEffect } from 'react'

import { useAsrStore, type AsrResultMessage } from '@/store/asrStore'
import { useEnvironmentStore } from '@/store/environmentStore'
import { useLogsStore, type LogMessage } from '@/store/logsStore'

export const useAsrListener = () => {
  const isTauriEnv = useEnvironmentStore((s) => s.isTauriEnv)

  useEffect(() => {
    if (!isTauriEnv) return
    const unlisten = listen<AsrResultMessage>('asr-result', (event) => {
      useAsrStore.getState().addAsrResult(event.payload)
    })
    return () => {
      unlisten.then((fn) => fn())
    }
  }, [isTauriEnv])
}

export const useLogsListener = () => {
  const isTauriEnv = useEnvironmentStore((s) => s.isTauriEnv)

  useEffect(() => {
    if (!isTauriEnv) return
    const unlisten = listen<LogMessage>('log-message', (event) => {
      useLogsStore.getState().addLog(event.payload)
    })
    return () => {
      unlisten.then((fn) => fn())
    }
  }, [isTauriEnv])
}
