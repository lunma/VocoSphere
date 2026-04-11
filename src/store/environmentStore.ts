import { isTauri } from '@tauri-apps/api/core'
import { create } from 'zustand'

interface EnvironmentStore {
  isTauriEnv: boolean
}

export const useEnvironmentStore = create<EnvironmentStore>(() => {
  try {
    return { isTauriEnv: isTauri() }
  } catch {
    return { isTauriEnv: false }
  }
})
