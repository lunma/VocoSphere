import { AlertTriangle, Download, Film, Pause, Play, Trash2, Upload } from 'lucide-react'
import { useEffect, useMemo, useRef, useState } from 'react'

import { Button } from '@/components/ui/button'
import { msToSrtTime, srtTimeToMs, useVideoSubtitle } from '@/hooks/useVideoSubtitle'
import { useAsrStore } from '@/store/asrStore'
import { useEnvironmentStore } from '@/store/environmentStore'

import type { ExportFormat, SubtitleItem } from '@/hooks/useVideoSubtitle'

// ── 字幕行组件 ────────────────────────────────────────────────────────────────

interface SubtitleRowProps {
  item: SubtitleItem
  index: number
  isActive: boolean
  onSeek: (ms: number) => void
  onUpdate: (id: number, updates: Partial<SubtitleItem>) => void
  onRemove: (id: number) => void
}

function SubtitleRow({ item, index, isActive, onSeek, onUpdate, onRemove }: SubtitleRowProps) {
  const [beginInput, setBeginInput] = useState(msToSrtTime(item.beginMs))
  const [endInput, setEndInput] = useState(msToSrtTime(item.endMs))

  useEffect(() => {
    setBeginInput(msToSrtTime(item.beginMs))
  }, [item.beginMs])

  useEffect(() => {
    setEndInput(msToSrtTime(item.endMs))
  }, [item.endMs])

  const commitBegin = () => {
    const ms = srtTimeToMs(beginInput)
    if (ms >= 0) onUpdate(item.id, { beginMs: ms })
    else setBeginInput(msToSrtTime(item.beginMs))
  }

  const commitEnd = () => {
    const ms = srtTimeToMs(endInput)
    if (ms > 0) onUpdate(item.id, { endMs: ms })
    else setEndInput(msToSrtTime(item.endMs))
  }

  return (
    <div
      className={`border-b border-slate-100 px-3 py-2.5 transition-colors ${
        isActive ? 'bg-blue-50/70' : 'hover:bg-slate-50/60'
      }`}
    >
      <div className="flex items-center gap-1.5 mb-1.5">
        <button
          type="button"
          onClick={() => onSeek(item.beginMs)}
          className="text-xs font-mono text-slate-400 w-6 shrink-0 text-left hover:text-blue-500 transition-colors"
        >
          {index + 1}
        </button>
        <input
          value={beginInput}
          onChange={(e) => setBeginInput(e.target.value)}
          onBlur={commitBegin}
          onKeyDown={(e) => e.key === 'Enter' && commitBegin()}
          className="w-[112px] shrink-0 rounded-md border border-slate-200 bg-white px-1.5 py-0.5 font-mono text-[11px] text-slate-600 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400"
        />
        <span className="text-slate-300 text-xs shrink-0">→</span>
        <input
          value={endInput}
          onChange={(e) => setEndInput(e.target.value)}
          onBlur={commitEnd}
          onKeyDown={(e) => e.key === 'Enter' && commitEnd()}
          className="w-[112px] shrink-0 rounded-md border border-slate-200 bg-white px-1.5 py-0.5 font-mono text-[11px] text-slate-600 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400"
        />
        <button
          type="button"
          onClick={() => onRemove(item.id)}
          className="ml-auto shrink-0 rounded p-0.5 text-slate-300 hover:text-red-400 hover:bg-red-50 transition-colors"
        >
          <Trash2 size={12} />
        </button>
      </div>
      <textarea
        value={item.text}
        onChange={(e) => onUpdate(item.id, { text: e.target.value })}
        rows={2}
        className="w-full resize-none rounded-md border border-slate-100 bg-slate-50/50 px-2 py-1 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-300 transition-all"
      />
      {item.translatedText && (
        <p className="mt-1 px-2 text-xs text-slate-400 italic">{item.translatedText}</p>
      )}
    </div>
  )
}

// ── 主页面 ────────────────────────────────────────────────────────────────────

const VideoSubtitlePage = () => {
  const isTauriEnv = useEnvironmentStore((s) => s.isTauriEnv)
  const ossConfig = useAsrStore((s) => s.fullConfig.cloud.oss)
  const videoRef = useRef<HTMLVideoElement>(null)
  const waveContainerRef = useRef<HTMLDivElement>(null)
  const subtitleListRef = useRef<HTMLDivElement>(null)
  const [subtitleSupported, setSubtitleSupported] = useState<boolean | null>(null)
  const [exportFormat, setExportFormat] = useState<ExportFormat>('original')

  const {
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
  } = useVideoSubtitle(videoRef)

  const hasTranslation = subtitles.some((s) => s.translatedText)

  // 页面挂载时检测 FFmpeg 是否支持字幕烧录
  useEffect(() => {
    if (!isTauriEnv) return
    import('@tauri-apps/api/core')
      .then(({ invoke }) => invoke<boolean>('check_ffmpeg_subtitle_support'))
      .then((supported) => setSubtitleSupported(supported))
      .catch(() => setSubtitleSupported(false))
  }, [isTauriEnv])

  // 波形图：audioPath 变化时重新挂载 WaveSurfer
  useEffect(() => {
    mountWaveSurfer(waveContainerRef.current)
  }, [mountWaveSurfer])

  // 当前激活字幕索引（含缓冲：早 200ms 高亮）
  const activeIndex = useMemo(
    () =>
      subtitles.findIndex(
        (s) => currentTimeMs >= s.beginMs - 200 && currentTimeMs <= s.endMs + 200
      ),
    [currentTimeMs, subtitles]
  )

  // 激活字幕变化时自动滚动列表
  useEffect(() => {
    if (activeIndex < 0 || !subtitleListRef.current) return
    const el = subtitleListRef.current.children[activeIndex] as HTMLElement | undefined
    el?.scrollIntoView({ block: 'nearest', behavior: 'smooth' })
  }, [activeIndex])

  const isBusy = isExtracting || isRecognizing || isExporting || isTranslating

  const busyLabel = isExtracting
    ? '提取音频中…'
    : isRecognizing
      ? 'ASR 识别中…'
      : isExporting
        ? '导出中…'
        : null

  const ossReady =
    ossConfig &&
    ossConfig.oss_endpoint.length > 0 &&
    ossConfig.oss_bucket.length > 0 &&
    ossConfig.oss_key_id.length > 0 &&
    ossConfig.oss_key_secret.length > 0

  return (
    <div className="w-full space-y-4">
      {/* FFmpeg 字幕滤镜不支持警告 */}
      {subtitleSupported === false && (
        <div className="flex items-start gap-3 rounded-xl border border-amber-200/80 bg-amber-50/60 px-4 py-3 text-sm text-amber-800">
          <AlertTriangle size={16} className="mt-0.5 shrink-0 text-amber-500" />
          <span>
            当前 FFmpeg 不支持字幕烧录（缺少 libass 编译选项），导出视频时字幕将无法嵌入。
            请更换包含 libass 的 FFmpeg。
          </span>
        </div>
      )}

      {/* OSS 未配置提示 */}
      {!ossReady && (
        <div className="flex items-start gap-3 rounded-xl border border-blue-200/80 bg-blue-50/60 px-4 py-3 text-sm text-blue-700">
          <AlertTriangle size={16} className="mt-0.5 shrink-0 text-blue-500" />
          <span>
            请先在「模型」页 → 云端 → 文件识别（OSS）配置 OSS 参数，否则无法进行视频字幕识别。
          </span>
        </div>
      )}

      {/* 主操作区：视频 + 字幕列表 */}
      <div className="grid grid-cols-5 gap-4" style={{ height: 440 }}>
        {/* 左：视频播放区 */}
        <div className="col-span-3 border border-slate-200/80 bg-white shadow-[0_2px_12px_rgba(15,23,42,0.03)] rounded-2xl overflow-hidden flex flex-col">
          <div className="flex items-center justify-between px-4 py-3 border-b border-slate-100">
            <span className="text-sm font-semibold text-slate-700">视频预览</span>
            <Button
              size="sm"
              variant="outline"
              onClick={importVideo}
              disabled={isBusy || !isTauriEnv}
            >
              <Upload size={14} className="mr-1.5" />
              导入视频
            </Button>
          </div>

          <div className="flex-1 flex items-center justify-center bg-slate-950 relative">
            {videoSrc ? (
              <video
                ref={videoRef}
                src={videoSrc}
                controls
                className="w-full h-full object-contain"
              />
            ) : (
              <button
                type="button"
                onClick={importVideo}
                disabled={isBusy || !isTauriEnv}
                className="flex flex-col items-center gap-3 text-slate-500 hover:text-slate-300 transition-colors disabled:opacity-40"
              >
                <Film size={40} strokeWidth={1} />
                <span className="text-sm">点击导入视频文件</span>
              </button>
            )}

            {isBusy && (
              <div className="absolute inset-0 bg-black/60 flex flex-col items-center justify-center gap-3 px-8">
                <div className="h-8 w-8 rounded-full border-2 border-blue-400 border-t-transparent animate-spin" />
                <span className="text-sm text-white/80">{busyLabel}</span>
                {isExporting && exportProgress > 0 && (
                  <div className="w-full max-w-xs">
                    <div className="flex justify-between text-xs text-white/60 mb-1">
                      <span>烧录进度</span>
                      <span>{exportProgress}%</span>
                    </div>
                    <div className="h-1.5 w-full rounded-full bg-white/20 overflow-hidden">
                      <div
                        className="h-full rounded-full bg-blue-400 transition-all duration-300"
                        style={{ width: `${exportProgress}%` }}
                      />
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        {/* 右：字幕编辑列表 */}
        <div className="col-span-2 border border-slate-200/80 bg-white shadow-[0_2px_12px_rgba(15,23,42,0.03)] rounded-2xl overflow-hidden flex flex-col">
          <div className="px-4 py-3 border-b border-slate-100 shrink-0 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-sm font-semibold text-slate-700">
                字幕列表
                {subtitles.length > 0 && (
                  <span className="ml-2 text-xs font-normal text-slate-400">
                    {subtitles.length} 条
                  </span>
                )}
              </span>
              <Button
                size="sm"
                variant="outline"
                onClick={() => translateSubtitles('zh')}
                disabled={isBusy || subtitles.length === 0 || !isTauriEnv}
              >
                {isTranslating ? '翻译中…' : '翻译 → 中文'}
              </Button>
            </div>

            {/* 导出格式选择（有翻译时显示） */}
            {hasTranslation && (
              <div className="flex items-center gap-1.5">
                {(
                  [
                    { value: 'original', label: '原文' },
                    { value: 'translated', label: '译文' },
                    { value: 'bilingual', label: '双语' },
                  ] as { value: ExportFormat; label: string }[]
                ).map((opt) => (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => setExportFormat(opt.value)}
                    className={`px-2.5 py-1 rounded-lg text-xs font-medium border transition-all ${
                      exportFormat === opt.value
                        ? 'bg-blue-50 border-blue-200 text-blue-700'
                        : 'bg-white border-slate-200 text-slate-500 hover:bg-slate-50'
                    }`}
                  >
                    {opt.label}
                  </button>
                ))}
                <span className="ml-auto flex gap-1.5">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => exportSrt(exportFormat)}
                    disabled={isBusy || subtitles.length === 0 || !isTauriEnv}
                  >
                    <Download size={13} className="mr-1" />
                    SRT
                  </Button>
                  <Button
                    size="sm"
                    onClick={() => exportVideo(exportFormat)}
                    disabled={isBusy || subtitles.length === 0 || !isTauriEnv}
                  >
                    导出视频
                  </Button>
                </span>
              </div>
            )}

            {/* 无翻译时的简单导出行 */}
            {!hasTranslation && (
              <div className="flex justify-end gap-1.5">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => exportSrt('original')}
                  disabled={isBusy || subtitles.length === 0 || !isTauriEnv}
                >
                  <Download size={13} className="mr-1" />
                  SRT
                </Button>
                <Button
                  size="sm"
                  onClick={() => exportVideo('original')}
                  disabled={isBusy || subtitles.length === 0 || !isTauriEnv}
                >
                  导出视频
                </Button>
              </div>
            )}
          </div>

          {subtitles.length === 0 ? (
            <div className="flex-1 flex items-center justify-center text-sm text-slate-400">
              {isRecognizing ? '识别中，请稍候…' : '导入视频后自动识别字幕'}
            </div>
          ) : (
            <div ref={subtitleListRef} className="flex-1 overflow-y-auto">
              {subtitles.map((item, idx) => (
                <SubtitleRow
                  key={item.id}
                  item={item}
                  index={idx}
                  isActive={idx === activeIndex}
                  onSeek={seekToMs}
                  onUpdate={updateSubtitle}
                  onRemove={removeSubtitle}
                />
              ))}
            </div>
          )}
        </div>
      </div>

      {/* 波形图 */}
      <div className="border border-slate-200/80 bg-white shadow-[0_2px_12px_rgba(15,23,42,0.03)] rounded-2xl px-4 py-3">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold text-slate-500">音频波形</span>
            {audioPath && (
              <button
                type="button"
                onClick={togglePlay}
                className="flex items-center justify-center h-6 w-6 rounded-full bg-slate-100 hover:bg-blue-100 hover:text-blue-600 text-slate-500 transition-colors"
                title={isPlaying ? '暂停' : '播放'}
              >
                {isPlaying ? <Pause size={12} /> : <Play size={12} />}
              </button>
            )}
          </div>
          {audioPath && (
            <span className="text-[11px] text-slate-400 font-mono truncate max-w-xs">
              {audioPath}
            </span>
          )}
        </div>
        <div
          ref={waveContainerRef}
          className={`w-full rounded-lg overflow-hidden bg-slate-950 ${audioPath ? '' : 'h-[72px] flex items-center justify-center'}`}
        >
          {!audioPath && <span className="text-xs text-slate-600">导入视频后显示波形</span>}
        </div>
      </div>

      {/* 状态栏 */}
      {statusMsg && (
        <p
          className={`text-sm px-1 ${statusMsg.startsWith('错误') || statusMsg.startsWith('请先') ? 'text-red-500' : 'text-slate-500'}`}
        >
          {statusMsg}
        </p>
      )}
    </div>
  )
}

export default VideoSubtitlePage
