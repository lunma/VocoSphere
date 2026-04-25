import { Mic, Square } from 'lucide-react'
import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react'

import CustomSelect from '@/components/CustomSelect'
import { useAsrStore, formatTimeRange, type AsrResultMessage } from '@/store/asrStore'

const CAPTURE_MODE_KEY = 'CAPTURE_MODE'

interface GroupedResult {
  transcription: AsrResultMessage
  translations: AsrResultMessage[]
}

function Badge({ variant, children }: { variant: 'secondary' | 'outline'; children: ReactNode }) {
  const className =
    variant === 'secondary'
      ? 'inline-flex items-center rounded-lg border border-slate-200/80 bg-slate-50 px-2 py-0.5 text-xs font-semibold text-slate-700'
      : 'inline-flex items-center rounded-lg border border-slate-200/80 bg-transparent px-2 py-0.5 text-xs font-semibold text-slate-600'
  return <span className={className}>{children}</span>
}

function PrimaryButton({
  disabled,
  onClick,
  children,
}: {
  disabled?: boolean
  onClick: () => void
  children: ReactNode
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className="inline-flex items-center justify-center rounded-xl bg-blue-600 px-4 py-2 text-sm font-medium text-white shadow-[0_4px_12px_rgba(37,99,235,0.25)] hover:shadow-[0_6px_16px_rgba(37,99,235,0.35)] active:translate-y-[1px] focus:outline-none focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
    >
      {children}
    </button>
  )
}

function SecondaryButton({
  disabled,
  onClick,
  children,
  className,
}: {
  disabled?: boolean
  onClick: () => void
  children: ReactNode
  className?: string
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className={`inline-flex items-center justify-center rounded-xl bg-white px-4 py-2 text-sm font-medium text-slate-600 border border-slate-200 shadow-sm hover:bg-slate-50 hover:text-slate-900 active:translate-y-[1px] focus:outline-none focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500 transition-all disabled:opacity-50 disabled:cursor-not-allowed ${className ?? ''}`}
    >
      {children}
    </button>
  )
}

const AudioSourceSettingsPage = () => {
  const {
    handleStartAudioCapture,
    handleStopAudioCapture,
    isCapturing,
    audioStatus,
    asrResults,
    clearAsrResults,
    audioDevices,
    selectedDevice,
    setSelectedDevice,
    refreshAudioDevices,
    fullConfig,
    captureMode,
    setCaptureMode,
    captureTarget,
    setCaptureTarget,
  } = useAsrStore()

  const activeRealtimeProvider =
    captureTarget === 'recognition'
      ? fullConfig.realtimeRecProvider
      : fullConfig.realtimeTransProvider
  const cloudConfig = activeRealtimeProvider === 'cloud' ? fullConfig.cloud : null
  const recognition = cloudConfig?.recognition ?? null
  const isTranslationConfigured =
    cloudConfig?.translation?.type === 'gummy' &&
    cloudConfig.translation.server_config.api_key.length > 0
  const isTranslationEnabled = recognition?.type === 'gummy' && recognition.translation_enabled
  const sourceLanguage = recognition?.source_language || '未知'

  const filteredAudioDevices = useMemo(
    () => audioDevices.filter((device) => device.device_type === captureMode),
    [audioDevices, captureMode]
  )

  // 恢复上次选择的捕获模式
  useEffect(() => {
    const saved = localStorage.getItem(CAPTURE_MODE_KEY)
    if (saved === 'microphone' || saved === 'loopback') {
      setCaptureMode(saved)
    }
  }, [setCaptureMode])

  // 持久化捕获模式变更
  useEffect(() => {
    localStorage.setItem(CAPTURE_MODE_KEY, captureMode)
  }, [captureMode])

  useEffect(() => {
    if (isCapturing) return
    if (filteredAudioDevices.length === 0) return
    if (!selectedDevice || !filteredAudioDevices.some((d) => d.name === selectedDevice)) {
      setSelectedDevice(filteredAudioDevices[0].name)
    }
  }, [captureMode, filteredAudioDevices, isCapturing, selectedDevice, setSelectedDevice])

  const handleStartWithClear = async () => {
    clearAsrResults()
    await handleStartAudioCapture()
  }

  const groupedResults = useMemo(() => {
    const transcriptionResults = asrResults.filter(
      (item: AsrResultMessage) => item.kind === 'transcription'
    )
    const translationResults = asrResults.filter(
      (item: AsrResultMessage) => item.kind === 'translation'
    )
    return transcriptionResults
      .map((transcription) => ({
        transcription,
        translations: translationResults.filter((t) => t.sentence_id === transcription.sentence_id),
      }))
      .sort((a, b) => a.transcription.begin_time - b.transcription.begin_time)
  }, [asrResults])

  const resultsContainerRef = useRef<HTMLDivElement>(null)
  const [autoScroll, setAutoScroll] = useState(true)

  useEffect(() => {
    if (!autoScroll || groupedResults.length === 0) return
    const container = resultsContainerRef.current
    if (!container) return
    requestAnimationFrame(() => {
      container.scrollTo({ top: container.scrollHeight, behavior: 'smooth' })
    })
  }, [groupedResults, autoScroll])

  return (
    <div className="w-full max-w-5xl mx-auto flex flex-col gap-6">
      <section className="bg-white rounded-2xl border border-slate-200/80 shadow-[0_2px_12px_rgba(15,23,42,0.03)] overflow-hidden">
        <div className="px-6 py-5 border-b border-slate-100">
          <h2 className="text-base font-semibold text-slate-900">音频源设置</h2>
        </div>

        <div className="px-6 py-6 space-y-6">
          <div className="space-y-2">
            <div className="text-sm font-semibold text-slate-700">捕获模式</div>
            <div className="grid gap-3">
              {(['loopback', 'microphone'] as const).map((mode) => (
                <label
                  key={mode}
                  className={`flex items-center gap-3 rounded-xl border px-4 py-3 transition-all ${
                    captureMode === mode
                      ? 'border-blue-200/80 bg-blue-50/50'
                      : 'border-slate-200 bg-white'
                  } ${isCapturing ? 'opacity-60 cursor-not-allowed' : 'cursor-pointer'}`}
                >
                  <input
                    type="radio"
                    name="captureMode"
                    value={mode}
                    checked={captureMode === mode}
                    disabled={isCapturing}
                    onChange={() => setCaptureMode(mode)}
                    className="h-4 w-4 text-blue-600 focus:ring-blue-500/10"
                  />
                  <span className="text-sm font-medium text-slate-700">
                    {mode === 'loopback' ? '系统内部声音（Loopback/扬声器）' : '麦克风声音'}
                  </span>
                </label>
              ))}
            </div>
          </div>

          <div className="space-y-2">
            <div className="text-sm font-semibold text-slate-700">选择具体设备</div>
            <CustomSelect
              value={selectedDevice ?? ''}
              disabled={isCapturing || filteredAudioDevices.length === 0}
              onChange={setSelectedDevice}
              placeholder="暂无可用设备"
              options={filteredAudioDevices.map((device) => ({
                label: `${device.name}${device.is_default ? '（默认）' : ''}`,
                value: device.name,
              }))}
            />
          </div>

          <div className="space-y-2">
            <div className="text-sm font-semibold text-slate-700">捕获目标</div>
            <div className="grid gap-3">
              {(
                [
                  { value: 'recognition', label: '语音识别', hint: '将语音转为文字' },
                  {
                    value: 'translation',
                    label: '语音翻译',
                    hint: isTranslationConfigured
                      ? '识别并实时翻译（需在「模型」页配置翻译模型）'
                      : '需先在「模型」页配置翻译模型 API Key',
                  },
                ] as const
              ).map(({ value, label, hint }) => (
                <label
                  key={value}
                  className={`flex items-start gap-3 rounded-xl border px-4 py-3 transition-all ${
                    captureTarget === value
                      ? 'border-blue-200/80 bg-blue-50/50'
                      : 'border-slate-200 bg-white'
                  } ${isCapturing || (value === 'translation' && !isTranslationConfigured) ? 'opacity-60 cursor-not-allowed' : 'cursor-pointer'}`}
                >
                  <input
                    type="radio"
                    name="captureTarget"
                    value={value}
                    checked={captureTarget === value}
                    disabled={isCapturing || (value === 'translation' && !isTranslationConfigured)}
                    onChange={() => setCaptureTarget(value)}
                    className="mt-0.5 h-4 w-4 text-blue-600 focus:ring-blue-500/10"
                  />
                  <div>
                    <div className="text-sm font-medium text-slate-700">{label}</div>
                    <div className="text-xs text-slate-500 mt-0.5">{hint}</div>
                  </div>
                </label>
              ))}
            </div>
          </div>

          {audioStatus && (
            <div
              className={`rounded-xl border px-4 py-3 text-sm ${
                isCapturing
                  ? 'border-emerald-200/80 bg-emerald-50/50 text-emerald-900'
                  : 'border-blue-200/80 bg-blue-50/50 text-blue-900'
              }`}
            >
              {audioStatus}
            </div>
          )}
        </div>

        <div className="px-6 py-4 bg-slate-50/50 border-t border-slate-100 flex flex-wrap items-center justify-end gap-3">
          <SecondaryButton disabled={isCapturing} onClick={() => refreshAudioDevices()}>
            刷新设备
          </SecondaryButton>
          <PrimaryButton disabled={isCapturing} onClick={handleStartWithClear}>
            <span className="inline-flex items-center gap-2">
              <Mic className="h-4 w-4" />
              {isCapturing ? '运行中...' : '启动音频捕获'}
            </span>
          </PrimaryButton>
          <SecondaryButton disabled={!isCapturing} onClick={() => handleStopAudioCapture()}>
            <span className="inline-flex items-center gap-2">
              <Square className="h-4 w-4" />
              停止捕获
            </span>
          </SecondaryButton>
        </div>
      </section>

      <section className="bg-white rounded-2xl border border-slate-200/80 shadow-[0_2px_12px_rgba(15,23,42,0.03)] overflow-hidden">
        <div className="px-6 py-5 border-b border-slate-100 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <h2 className="text-base font-semibold text-slate-900">识别输出</h2>
            <span className="inline-flex items-center rounded-lg border border-slate-200/80 bg-slate-50 px-2 py-0.5 text-xs font-semibold text-slate-700">
              {groupedResults.length}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <SecondaryButton className="px-3 py-2" onClick={() => setAutoScroll((v) => !v)}>
              {autoScroll ? '关闭自动滚动' : '开启自动滚动'}
            </SecondaryButton>
            <SecondaryButton className="px-3 py-2" onClick={clearAsrResults}>
              清空结果
            </SecondaryButton>
          </div>
        </div>

        <div className="px-6 py-5">
          <div
            ref={resultsContainerRef}
            className="max-h-128 overflow-y-auto rounded-xl border border-slate-200/80 bg-slate-50/40 p-2"
          >
            {groupedResults.length === 0 ? (
              <div className="py-10 text-center text-sm text-slate-500">暂未收到识别文本</div>
            ) : (
              <div className="space-y-1.5">
                {groupedResults.map(({ transcription, translations }: GroupedResult) => (
                  <article
                    key={`transcription-${transcription.sentence_id}-${transcription.lang ?? 'default'}`}
                    className="rounded-xl border border-slate-200/80 bg-white px-4 py-3"
                  >
                    <div className="mb-1.5 flex flex-wrap items-center gap-2 text-xs text-slate-500">
                      <Badge variant={transcription.is_final ? 'secondary' : 'outline'}>
                        {transcription.is_final ? '最终' : '临时'}
                      </Badge>
                      <span>#{transcription.sentence_id}</span>
                      <span>
                        {formatTimeRange(transcription.begin_time, transcription.end_time)}
                      </span>
                      <span>{sourceLanguage.toUpperCase()}</span>
                      {isTranslationEnabled &&
                        translations.map((t) => (
                          <span key={`lang-${t.sentence_id}-${t.lang ?? 'default'}`}>
                            → {t.lang?.toUpperCase() || '未知'}
                          </span>
                        ))}
                    </div>
                    <p className="text-sm text-slate-900">{transcription.text || '（空）'}</p>
                    {isTranslationEnabled &&
                      translations.map((t) => (
                        <p
                          key={`translation-${t.sentence_id}-${t.lang ?? 'default'}`}
                          className="mt-1 text-sm text-slate-500"
                        >
                          {t.text || '（空）'}
                        </p>
                      ))}
                  </article>
                ))}
              </div>
            )}
          </div>
        </div>
      </section>
    </div>
  )
}

export default AudioSourceSettingsPage
