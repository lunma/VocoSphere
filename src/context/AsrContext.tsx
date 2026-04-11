import { invoke } from '@tauri-apps/api/core'
import { listen } from '@tauri-apps/api/event'
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react'

import { useEnvironment } from './EnvironmentContext'

import type { AsrModelConfig } from '../types/asr'

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
  /// "microphone" | "loopback"
  device_type: 'microphone' | 'loopback'
  is_default: boolean
}

export interface DeviceError {
  error_type: string
  platform: string
  message: string
}

interface AsrContextValue {
  asrConfig: AsrModelConfig | null
  setAsrConfig: (config: AsrModelConfig | null) => void
  isCapturing: boolean
  audioStatus: string
  audioDevices: AudioDevice[]
  selectedDevice: string | null
  setSelectedDevice: (device: string | null) => void
  refreshAudioDevices: () => Promise<void>
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
  const [audioDevices, setAudioDevices] = useState<AudioDevice[]>([])
  const [selectedDevice, setSelectedDevice] = useState<string | null>(null)

  // 获取音频设备列表
  const refreshAudioDevices = useCallback(async () => {
    if (!isTauriEnv) {
      return
    }

    try {
      const deviceList = await invoke<AudioDevice[]>('get_audio_devices')
      setAudioDevices(deviceList)

      // 如果没有选中设备且设备列表不为空，优先选择 is_default=true 的设备
      if (!selectedDevice && deviceList.length > 0) {
        const defaultDevice = deviceList.find((d) => d.is_default) ?? deviceList[0]
        setSelectedDevice(defaultDevice.name)
      }

      // 如果当前 selectedDevice 不在新列表里，则回退到默认设备
      if (
        selectedDevice &&
        deviceList.length > 0 &&
        !deviceList.some((d) => d.name === selectedDevice)
      ) {
        const defaultDevice = deviceList.find((d) => d.is_default) ?? deviceList[0]
        setSelectedDevice(defaultDevice.name)
      }
    } catch (error) {
      console.error('获取音频设备列表失败:', error)
    }
  }, [isTauriEnv, selectedDevice])

  // 初始化时获取设备列表
  useEffect(() => {
    if (isTauriEnv) {
      refreshAudioDevices()
    }
  }, [isTauriEnv, refreshAudioDevices])

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

            return nextResults.slice().sort((a, b) => {
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

  // 根据平台返回设备未找到的详细提示信息
  const getDeviceNotFoundMessage = useCallback((platform: string): string => {
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
  }, [])

  const handleStartAudioCapture = useCallback(async () => {
    try {
      if (!asrConfig) {
        setAudioStatus('错误: 配置尚未加载')
        return
      }

      setAudioStatus('正在启动音频捕获...')
      const result = await invoke<string>('start_audio_capture', {
        config: asrConfig,
        deviceName: selectedDevice,
      })
      setIsCapturing(true)
      setAudioStatus(result + ' - 点击停止按钮结束捕获')
    } catch (error: unknown) {
      // 尝试解析结构化错误
      let errorMessage = String(error)

      try {
        const deviceError: DeviceError = JSON.parse(errorMessage)
        if (deviceError.error_type === 'LOOPBACK_DEVICE_NOT_FOUND') {
          errorMessage = getDeviceNotFoundMessage(deviceError.platform)
        }
      } catch {
        // 如果不是结构化错误，使用原始错误消息
      }

      setAudioStatus(`错误: ${errorMessage}`)
      setIsCapturing(false)
    }
  }, [asrConfig, selectedDevice, getDeviceNotFoundMessage])

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
      audioDevices,
      selectedDevice,
      setSelectedDevice,
      refreshAudioDevices,
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
      audioDevices,
      selectedDevice,
      refreshAudioDevices,
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
