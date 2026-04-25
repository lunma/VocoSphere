import { invoke, convertFileSrc } from '@tauri-apps/api/core'
import { listen } from '@tauri-apps/api/event'
import { save } from '@tauri-apps/plugin-dialog'
import { useCallback, useEffect, useRef, useState } from 'react'

import { ASR_FULL_CONFIG_KEY, DEFAULT_OSS_CONFIG, useAsrStore } from '@/store/asrStore'
import { useEnvironmentStore } from '@/store/environmentStore'

import type { RefObject } from 'react'

// ── 类型定义 ─────────────────────────────────────────────────────────────────

export interface SubtitleItem {
  id: number
  beginMs: number
  endMs: number
  text: string
  translatedText?: string
}

export type ExportFormat = 'original' | 'translated' | 'bilingual'

// ── 错误信息本地化 ────────────────────────────────────────────────────────────

function localizeError(err: unknown, prefix = ''): string {
  const raw = String(err)
  const label = prefix ? `${prefix}错误：` : '错误：'

  if (raw.includes('SignatureDoesNotMatch') || raw.includes('InvalidAccessKeyId'))
    return `${label}OSS 认证失败，请检查「模型」页 Access Key ID / Secret`
  if (raw.includes('NoSuchBucket') || raw.includes('InvalidBucketName'))
    return `${label}OSS Bucket 不存在或名称错误，请检查「模型」页配置`
  if (raw.includes('NoSuchKey')) return `${label}OSS 文件未找到，可能已被删除或路径配置有误`
  if (raw.includes('InvalidApiKey') || raw.includes('Unauthorized') || raw.includes('401'))
    return `${label}API Key 无效或已过期，请在「模型」页重新配置`
  if (raw.includes('Throttling') || raw.includes('429')) return `${label}请求被限流，请稍后重试`
  if (raw.includes('timed out') || raw.includes('timeout') || raw.includes('ConnectionRefused'))
    return `${label}网络连接超时，请检查网络后重试`
  if (raw.includes('超过 2 GB')) return raw // 已是中文，直接返回
  if (raw.includes('No such file') || raw.includes('os error 2'))
    return `${label}文件不存在或已被移动，请重新选择`

  return `${label}${raw}`
}

// ── 时间格式工具 ──────────────────────────────────────────────────────────────

export function msToSrtTime(ms: number): string {
  const h = Math.floor(ms / 3_600_000)
  const m = Math.floor((ms % 3_600_000) / 60_000)
  const s = Math.floor((ms % 60_000) / 1_000)
  const millis = ms % 1000
  return (
    [String(h).padStart(2, '0'), String(m).padStart(2, '0'), String(s).padStart(2, '0')].join(':') +
    ',' +
    String(millis).padStart(3, '0')
  )
}

export function srtTimeToMs(time: string): number {
  const match = time.match(/(\d+):(\d+):(\d+)[,.](\d+)/)
  if (!match) return 0
  return (
    parseInt(match[1]) * 3_600_000 +
    parseInt(match[2]) * 60_000 +
    parseInt(match[3]) * 1_000 +
    parseInt(match[4].padEnd(3, '0').slice(0, 3))
  )
}

// ── Hook ─────────────────────────────────────────────────────────────────────

export function useVideoSubtitle(videoRef: RefObject<HTMLVideoElement | null>) {
  const isTauriEnv = useEnvironmentStore((s) => s.isTauriEnv)
  const ossConfig = useAsrStore((s) => s.fullConfig.cloud.oss ?? DEFAULT_OSS_CONFIG)
  const provider = useAsrStore((s) => s.fullConfig.fileRecProvider)

  const [videoPath, setVideoPath] = useState<string | null>(null)
  const [videoSrc, setVideoSrc] = useState<string | null>(null)
  const [audioPath, setAudioPath] = useState<string | null>(null)
  const [subtitles, setSubtitles] = useState<SubtitleItem[]>([])
  const [currentTimeMs, setCurrentTimeMs] = useState(0)
  const [isExtracting, setIsExtracting] = useState(false)
  const [isRecognizing, setIsRecognizing] = useState(false)
  const [isExporting, setIsExporting] = useState(false)
  const [isTranslating, setIsTranslating] = useState(false)
  const [exportProgress, setExportProgress] = useState(0)
  const [isPlaying, setIsPlaying] = useState(false)
  const [statusMsg, setStatusMsg] = useState('')

  const wsRef = useRef<import('wavesurfer.js').default | null>(null)
  const seekingRef = useRef(false)

  // ── 视频时间同步 ────────────────────────────────────────────────────────────

  useEffect(() => {
    const video = videoRef.current
    if (!video) return

    const onTimeUpdate = () => {
      const ms = Math.round(video.currentTime * 1000)
      setCurrentTimeMs(ms)

      if (!seekingRef.current && wsRef.current && isFinite(video.duration) && video.duration > 0) {
        wsRef.current.seekTo(video.currentTime / video.duration)
      }
    }

    video.addEventListener('timeupdate', onTimeUpdate)
    return () => video.removeEventListener('timeupdate', onTimeUpdate)
  }, [videoRef, videoSrc])

  // ── 播放状态同步 ────────────────────────────────────────────────────────────

  useEffect(() => {
    const video = videoRef.current
    if (!video) return
    const onPlay = () => setIsPlaying(true)
    const onPause = () => setIsPlaying(false)
    video.addEventListener('play', onPlay)
    video.addEventListener('pause', onPause)
    return () => {
      video.removeEventListener('play', onPlay)
      video.removeEventListener('pause', onPause)
    }
  }, [videoRef, videoSrc])

  // ── 导出进度事件监听 ────────────────────────────────────────────────────────

  useEffect(() => {
    if (!isTauriEnv) return
    let unlisten: (() => void) | null = null
    listen<number>('video-export-progress', (e) => {
      setExportProgress(e.payload)
    }).then((fn) => {
      unlisten = fn
    })
    return () => {
      unlisten?.()
    }
  }, [isTauriEnv])

  // ── 播放/暂停控制 ───────────────────────────────────────────────────────────

  const togglePlay = useCallback(() => {
    const video = videoRef.current
    if (!video) return
    if (video.paused) {
      video.play()
    } else {
      video.pause()
    }
  }, [videoRef])

  // ── 字幕更新 ────────────────────────────────────────────────────────────────

  const updateSubtitle = useCallback((id: number, updates: Partial<SubtitleItem>) => {
    setSubtitles((prev) => prev.map((s) => (s.id === id ? { ...s, ...updates } : s)))
  }, [])

  const removeSubtitle = useCallback((id: number) => {
    setSubtitles((prev) => prev.filter((s) => s.id !== id))
  }, [])

  // ── 跳转 ────────────────────────────────────────────────────────────────────

  const seekToMs = useCallback(
    (ms: number) => {
      if (!videoRef.current) return
      videoRef.current.currentTime = ms / 1000
    },
    [videoRef]
  )

  // ── 导入视频（选文件 → 提取音频 → ASR） ────────────────────────────────────

  const importVideo = useCallback(async () => {
    if (!isTauriEnv) return
    setStatusMsg('')

    interface AsrResultEvent {
      sentence_id: number
      begin_time: number
      end_time: number | null
      text: string
      is_final: boolean
    }

    const fullConfig = (() => {
      try {
        const raw = localStorage.getItem(ASR_FULL_CONFIG_KEY)
        return raw ? JSON.parse(raw) : null
      } catch {
        return null
      }
    })()

    // 云端模式：OSS 预校验
    if (provider === 'cloud') {
      if (
        !ossConfig.oss_endpoint ||
        !ossConfig.oss_bucket ||
        !ossConfig.oss_key_id ||
        !ossConfig.oss_key_secret
      ) {
        setStatusMsg('请先在「模型」页 → 文件识别（OSS）配置 OSS 参数')
        return
      }
    }

    // 本地模式：识别模型路径校验
    if (provider === 'local') {
      const modelPath = fullConfig?.local?.recognition?.model_path ?? ''
      if (!modelPath) {
        setStatusMsg('请先在「模型」页 → 本地 → 语音识别模型配置模型路径')
        return
      }
    }

    try {
      const path = await invoke<string | null>('select_video')
      if (!path) return

      setVideoPath(path)
      setVideoSrc(convertFileSrc(path))
      setSubtitles([])
      setAudioPath(null)
      setCurrentTimeMs(0)

      setIsExtracting(true)
      setIsRecognizing(true)
      setStatusMsg('正在提取音轨 & 识别字幕…')

      let asrConfig: unknown
      if (provider === 'local') {
        const rec = fullConfig?.local?.recognition ?? {}
        asrConfig = {
          type: 'local',
          recognition: {
            model_path: rec.model_path ?? '',
            language: rec.language ?? 'auto',
            n_threads: rec.n_threads ?? 4,
          },
          translation: fullConfig?.local?.translation ?? {
            model_path: '',
            language: 'auto',
            n_threads: 4,
          },
        }
      } else {
        const recognition = fullConfig?.cloud?.recognition
        if (!recognition) {
          setStatusMsg('请先在「模型」页配置云端 ASR 参数')
          setIsExtracting(false)
          setIsRecognizing(false)
          return
        }
        asrConfig = {
          type: 'cloud',
          streaming: recognition,
          oss: {
            endpoint: ossConfig.oss_endpoint,
            bucket: ossConfig.oss_bucket,
            access_key_id: ossConfig.oss_key_id,
            access_key_secret: ossConfig.oss_key_secret,
          },
          file_asr_api_key: recognition.server_config?.api_key ?? '',
        }
      }

      const [wavPath, events] = await Promise.all([
        invoke<string>('extract_audio', { videoPath: path }),
        invoke<AsrResultEvent[]>('start_video_asr', {
          config: asrConfig,
          filePath: path,
        }),
      ])

      setAudioPath(wavPath)
      setIsExtracting(false)
      setIsRecognizing(false)

      const items: SubtitleItem[] = events
        .filter((e) => e.is_final && e.text.trim())
        .map((e, idx) => ({
          id: idx,
          beginMs: e.begin_time,
          endMs: e.end_time ?? e.begin_time + 2000,
          text: e.text,
        }))

      setSubtitles(items)
      setStatusMsg(`识别完成，共 ${items.length} 条字幕`)
    } catch (err) {
      setStatusMsg(localizeError(err))
    } finally {
      setIsExtracting(false)
      setIsRecognizing(false)
    }
  }, [isTauriEnv, ossConfig, provider])

  // ── 导出视频（含格式选择：原文/译文/双语） ────────────────────────────────────

  const exportVideo = useCallback(
    async (format: ExportFormat = 'original') => {
      if (!isTauriEnv || !videoPath || subtitles.length === 0) return
      setStatusMsg('')

      try {
        const outputPath = await save({
          filters: [{ name: '视频文件', extensions: ['mp4'] }],
          defaultPath: 'output.mp4',
        })
        if (!outputPath) return

        setExportProgress(0)
        setIsExporting(true)
        setStatusMsg('正在烧录字幕并导出…')

        const resolveText = (s: SubtitleItem) => {
          if (format === 'translated') return s.translatedText ?? s.text
          if (format === 'bilingual' && s.translatedText) return `${s.text}\n${s.translatedText}`
          return s.text
        }

        const rustSubtitles = subtitles.map((s) => ({
          id: s.id,
          begin_ms: s.beginMs,
          end_ms: s.endMs,
          text: resolveText(s),
        }))

        await invoke<string>('export_video_with_subtitles', {
          videoPath,
          subtitles: rustSubtitles,
          outputPath,
        })

        setStatusMsg(`导出完成：${outputPath}`)
      } catch (err) {
        setStatusMsg(localizeError(err, '导出'))
      } finally {
        setIsExporting(false)
      }
    },
    [isTauriEnv, videoPath, subtitles]
  )

  // ── 导出 SRT 文件 ────────────────────────────────────────────────────────────

  const exportSrt = useCallback(
    async (format: ExportFormat = 'original') => {
      if (!isTauriEnv || subtitles.length === 0) return
      setStatusMsg('')

      try {
        const outputPath = await save({
          filters: [{ name: 'SRT 字幕文件', extensions: ['srt'] }],
          defaultPath: 'subtitles.srt',
        })
        if (!outputPath) return

        const resolveText = (s: SubtitleItem) => {
          if (format === 'translated') return s.translatedText ?? s.text
          if (format === 'bilingual' && s.translatedText) return `${s.text}\n${s.translatedText}`
          return s.text
        }

        const content = subtitles
          .map((s, idx) =>
            [
              String(idx + 1),
              `${msToSrtTime(s.beginMs)} --> ${msToSrtTime(s.endMs)}`,
              resolveText(s),
              '',
            ].join('\n')
          )
          .join('\n')

        await invoke('write_text_file', { path: outputPath, content })
        setStatusMsg(`SRT 已导出：${outputPath}`)
      } catch (err) {
        setStatusMsg(localizeError(err, '导出'))
      }
    },
    [isTauriEnv, subtitles]
  )

  // ── 翻译字幕（使用翻译模型独立 API Key） ────────────────────────────────────

  const translateSubtitles = useCallback(
    async (targetLang = 'zh') => {
      if (!isTauriEnv || subtitles.length === 0) return
      setStatusMsg('')

      const apiKey = (() => {
        try {
          const raw = localStorage.getItem(ASR_FULL_CONFIG_KEY)
          const config = raw ? JSON.parse(raw) : null
          return config?.cloud?.translation?.server_config?.api_key ?? ''
        } catch {
          return ''
        }
      })()

      if (!apiKey) {
        setStatusMsg('请先在「模型」页 → 语音翻译模型配置 API Key')
        return
      }

      try {
        setIsTranslating(true)
        setStatusMsg('正在翻译字幕…')

        const texts = subtitles.map((s) => s.text)
        const translated = await invoke<string[]>('translate_subtitles', {
          apiKey,
          texts,
          targetLang,
        })

        setSubtitles((prev) =>
          prev.map((s, idx) => ({ ...s, translatedText: translated[idx] ?? s.translatedText }))
        )
        setStatusMsg(`翻译完成，共 ${translated.length} 条`)
      } catch (err) {
        setStatusMsg(localizeError(err, '翻译'))
      } finally {
        setIsTranslating(false)
      }
    },
    [isTauriEnv, subtitles]
  )

  // ── WaveSurfer 挂载点回调 ────────────────────────────────────────────────────

  const mountWaveSurfer = useCallback(
    async (container: HTMLDivElement | null) => {
      if (wsRef.current) {
        wsRef.current.destroy()
        wsRef.current = null
      }
      if (!container || !audioPath) return

      const WaveSurfer = (await import('wavesurfer.js')).default
      const ws = WaveSurfer.create({
        container,
        url: convertFileSrc(audioPath),
        waveColor: '#94a3b8',
        progressColor: '#3b82f6',
        height: 72,
        barWidth: 2,
        barGap: 1,
        barRadius: 2,
        interact: true,
        normalize: true,
      })

      ws.setMuted(true)

      ws.on('interaction', (time: number) => {
        seekingRef.current = true
        if (videoRef.current) {
          videoRef.current.currentTime = time
        }
        setTimeout(() => {
          seekingRef.current = false
        }, 100)
      })

      wsRef.current = ws
    },
    [audioPath, videoRef]
  )

  return {
    videoPath,
    videoSrc,
    audioPath,
    subtitles,
    currentTimeMs,
    isExtracting,
    isRecognizing,
    isExporting,
    isTranslating,
    exportProgress,
    isPlaying,
    statusMsg,
    updateSubtitle,
    removeSubtitle,
    seekToMs,
    togglePlay,
    importVideo,
    exportVideo,
    exportSrt,
    translateSubtitles,
    mountWaveSurfer,
  }
}
