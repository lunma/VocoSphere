import { invoke } from '@tauri-apps/api/core'
import { create } from 'zustand'
import { persist } from 'zustand/middleware'

import type { AsrModelConfig } from '@/types/asr'

import { useEnvironmentStore } from './environmentStore'

export interface AsrResultMessage {
  sentence_id: number
  begin_time: number
  end_time?: number | null
  text: string
  is_final: boolean
  kind: 'transcription' | 'translation'
  lang?: string | null
}

export interface AudioDevice {
  name: string
  device_type: 'microphone' | 'loopback'
  is_default: boolean
}

export interface DeviceError {
  error_type: string
  platform: string
  message: string
}

interface AsrStore {
  asrConfig: AsrModelConfig | null
  isCapturing: boolean
  audioStatus: string
  asrResults: AsrResultMessage[]
  audioDevices: AudioDevice[]
  selectedDevice: string | null

  setAsrConfig: (config: AsrModelConfig | null) => void
  setSelectedDevice: (device: string | null) => void
  addAsrResult: (result: AsrResultMessage) => void
  clearAsrResults: () => void
  refreshAudioDevices: () => Promise<void>
  handleStartAudioCapture: () => Promise<void>
  handleStopAudioCapture: () => Promise<void>
}

const getDeviceNotFoundMessage = (platform: string): string => {
  switch (platform) {
    case 'windows':
      return `找不到系统音频捕获设备。
请确保已启用"立体声混音"(Stereo Mix)或"Wave Out Mix"设备：
1. 右键点击系统托盘的声音图标
2. 选择"声音设置" -> "声音控制面板"
3. 在"录制"标签页中启用并设置为默认设备`
    case 'linux':
      return `找不到系统音频捕获设备。
请确保 PulseAudio 已安装并运行，
或者使用 'pactl list sources' 查看可用的 monitor 源`
    case 'macos':
      return `找不到系统音频捕获设备。
请安装 BlackHole 虚拟音频驱动：
1. 访问 https://github.com/ExistentialAudio/BlackHole
2. 下载并安装 BlackHole
3. 在系统设置中配置音频输出到 BlackHole
4. 刷新设备列表后选择 BlackHole 设备`
    default:
      return '找不到系统音频捕获设备'
  }
}

export const formatTimeRange = (begin: number, end?: number | null): string => {
  const beginSec = (begin / 1000).toFixed(2)
  if (end != null && end > 0) {
    return `${beginSec}s - ${(end / 1000).toFixed(2)}s`
  }
  return `${beginSec}s`
}

export const useAsrStore = create<AsrStore>()(
  persist(
    (set, get) => ({
      asrConfig: null,
      isCapturing: false,
      audioStatus: '',
      asrResults: [],
      audioDevices: [],
      selectedDevice: null,

      setAsrConfig: (config) => set({ asrConfig: config }),

      setSelectedDevice: (device) => set({ selectedDevice: device }),

      addAsrResult: (result) => {
        set((state) => {
          const normalized: AsrResultMessage = { ...result, end_time: result.end_time ?? null }
          const existingIndex = state.asrResults.findIndex(
            (item) =>
              item.kind === normalized.kind &&
              item.sentence_id === normalized.sentence_id &&
              (item.lang ?? '') === (normalized.lang ?? '')
          )

          let nextResults: AsrResultMessage[]
          if (existingIndex >= 0) {
            nextResults = [...state.asrResults]
            nextResults[existingIndex] = { ...nextResults[existingIndex], ...normalized }
          } else {
            nextResults = [...state.asrResults, normalized]
          }

          return {
            asrResults: nextResults.slice().sort((a, b) => {
              if (a.begin_time !== b.begin_time) return a.begin_time - b.begin_time
              if (a.sentence_id !== b.sentence_id) return a.sentence_id - b.sentence_id
              return (a.lang ?? '').localeCompare(b.lang ?? '')
            }),
          }
        })
      },

      clearAsrResults: () => set({ asrResults: [] }),

      refreshAudioDevices: async () => {
        if (!useEnvironmentStore.getState().isTauriEnv) return
        try {
          const deviceList = await invoke<AudioDevice[]>('get_audio_devices')
          const { selectedDevice } = get()

          let nextDevice = selectedDevice
          if (!selectedDevice && deviceList.length > 0) {
            nextDevice = (deviceList.find((d) => d.is_default) ?? deviceList[0]).name
          }
          if (
            selectedDevice &&
            deviceList.length > 0 &&
            !deviceList.some((d) => d.name === selectedDevice)
          ) {
            nextDevice = (deviceList.find((d) => d.is_default) ?? deviceList[0]).name
          }

          set({ audioDevices: deviceList, selectedDevice: nextDevice })
        } catch (error) {
          console.error('获取音频设备列表失败:', error)
        }
      },

      handleStartAudioCapture: async () => {
        const { asrConfig, selectedDevice } = get()
        if (!asrConfig) {
          set({ audioStatus: '错误: 配置尚未加载' })
          return
        }
        try {
          set({ audioStatus: '正在启动音频捕获...' })
          const result = await invoke<string>('start_audio_capture', {
            config: asrConfig,
            deviceName: selectedDevice,
          })
          set({ isCapturing: true, audioStatus: result + ' - 点击停止按钮结束捕获' })
        } catch (error: unknown) {
          let errorMessage = String(error)
          try {
            const deviceError: DeviceError = JSON.parse(errorMessage)
            if (deviceError.error_type === 'LOOPBACK_DEVICE_NOT_FOUND') {
              errorMessage = getDeviceNotFoundMessage(deviceError.platform)
            }
          } catch {
            // 非结构化错误，使用原始消息
          }
          set({ isCapturing: false, audioStatus: `错误: ${errorMessage}` })
        }
      },

      handleStopAudioCapture: async () => {
        try {
          set({ audioStatus: '正在停止音频捕获...' })
          const result = await invoke<string>('stop_audio_capture')
          set({ isCapturing: false, audioStatus: result })
        } catch (error) {
          set({ audioStatus: `错误: ${error}` })
        }
      },
    }),
    {
      name: 'asr_model_config',
      partialize: (state) => ({ asrConfig: state.asrConfig }),
    }
  )
)
