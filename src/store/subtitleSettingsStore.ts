import { create } from 'zustand'

export interface SubtitleSettings {
  enabled: boolean
  locked: boolean
  stylePreset: 'apple' | 'netflix' | 'youtube'
  fontSize: number
  fontColor: string
  backgroundColor: string
  backgroundOpacity: number
  fontFamily: string
  fontWeight: 'normal' | 'bold'
  fontStyle: 'normal' | 'italic'
  borderRadius: 'none' | 'small' | 'medium' | 'pill'
  windowX: number | null
  windowY: number | null
}

interface SubtitleSettingsStore extends SubtitleSettings {
  updateSetting: <K extends keyof SubtitleSettings>(key: K, value: SubtitleSettings[K]) => void
  resetSettings: () => void
}

export const DEFAULT_SETTINGS: SubtitleSettings = {
  enabled: false,
  locked: true,
  stylePreset: 'apple',
  fontSize: 18,
  fontColor: '#FFFFFF',
  backgroundColor: '#000000',
  backgroundOpacity: 60,
  fontFamily: 'Arial, Helvetica, sans-serif',
  fontWeight: 'normal',
  fontStyle: 'normal',
  borderRadius: 'pill',
  windowX: null,
  windowY: null,
}

export const useSubtitleSettingsStore = create<SubtitleSettingsStore>()((set) => ({
  ...DEFAULT_SETTINGS,
  updateSetting: (key, value) => set({ [key]: value }),
  resetSettings: () => set(DEFAULT_SETTINGS),
}))
