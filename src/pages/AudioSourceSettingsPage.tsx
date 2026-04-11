import { useEffect, useMemo, useState, type ReactNode } from 'react'
import { Mic, Square } from 'lucide-react'

import CustomSelect from '@/components/CustomSelect'
import { useAsrStore, formatTimeRange, type AsrResultMessage } from '@/store/asrStore'

type CaptureMode = 'loopback' | 'microphone'

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
    asrConfig,
  } = useAsrStore()

  const [captureMode, setCaptureMode] = useState<CaptureMode>('loopback')

  const isTranslationEnabled = asrConfig?.type === 'gummy' && asrConfig.translation_enabled
  const sourceLanguage = asrConfig?.source_language || '未知'

  const filteredAudioDevices = useMemo(
    () => audioDevices.filter((device) => device.device_type === captureMode),
    [audioDevices, captureMode]
  )

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
          <h2 className="text-base font-semibold text-slate-900">识别输出</h2>
          <SecondaryButton className="px-3 py-2" disabled={false} onClick={clearAsrResults}>
            清空结果
          </SecondaryButton>
        </div>

        {groupedResults.length === 0 ? (
          <div className="py-12 flex items-center justify-center text-sm text-slate-500">
            暂未收到识别文本
          </div>
        ) : (
          <div className="px-6 py-6 space-y-4">
            {groupedResults.map(({ transcription, translations }: GroupedResult) => (
              <article
                key={`transcription-${transcription.sentence_id}-${transcription.lang ?? 'default'}`}
                className="rounded-2xl border border-slate-200/80 bg-white px-4 py-4"
              >
                <div className="flex flex-wrap items-center gap-2">
                  <Badge variant={transcription.is_final ? 'secondary' : 'outline'}>
                    {transcription.is_final ? '最终' : '临时'}
                  </Badge>
                  <div className="text-xs text-slate-500">
                    句子 #{transcription.sentence_id} ·{' '}
                    {formatTimeRange(transcription.begin_time, transcription.end_time)}
                  </div>
                </div>

                <div className="mt-3 space-y-2">
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge variant="outline">源语言: {sourceLanguage.toUpperCase()}</Badge>
                    {isTranslationEnabled &&
                      translations.map((t) => (
                        <Badge
                          key={`target-lang-${t.sentence_id}-${t.lang ?? 'default'}`}
                          variant="secondary"
                        >
                          目标语言: {t.lang?.toUpperCase() || '未知'}
                        </Badge>
                      ))}
                  </div>
                  <div className="text-sm text-slate-900 font-medium">
                    {transcription.text || '（空）'}
                  </div>
                  {isTranslationEnabled &&
                    translations.map((t) => (
                      <div
                        key={`translation-${t.sentence_id}-${t.lang ?? 'default'}`}
                        className="text-sm text-slate-600"
                      >
                        {t.text || '（空）'}
                      </div>
                    ))}
                </div>
              </article>
            ))}
          </div>
        )}
      </section>
    </div>
  )
}

export default AudioSourceSettingsPage
