import { invoke } from '@tauri-apps/api/core'
import { ChevronDown, FolderOpen } from 'lucide-react'
import { useCallback, useState } from 'react'

import CustomSelect from '@/components/CustomSelect'
import {
  ASR_FULL_CONFIG_KEY,
  DEFAULT_FULL_CONFIG,
  DEFAULT_GUMMY_RECOGNITION,
  DEFAULT_GUMMY_TRANSLATION,
  DEFAULT_LOCAL_CONFIG,
  DEFAULT_OSS_CONFIG,
  DEFAULT_PARAFORMER,
  useAsrStore,
} from '@/store/asrStore'

import type {
  AsrFullConfig,
  AsrProvider,
  GummyConfig,
  LocalModelConfig,
  OssConfig,
  ParaformerConfig,
} from '@/types/asr'

// ── 常量 ─────────────────────────────────────────────────────────────────────

const LANGUAGE_OPTIONS = [
  { label: '自动检测', value: 'auto' },
  { label: '中文', value: 'zh' },
  { label: '英文', value: 'en' },
  { label: '日语', value: 'ja' },
  { label: '韩语', value: 'ko' },
  { label: '粤语', value: 'yue' },
  { label: '德语', value: 'de' },
  { label: '法语', value: 'fr' },
  { label: '俄语', value: 'ru' },
]

const TARGET_LANGUAGE_OPTIONS = LANGUAGE_OPTIONS.filter((o) => o.value !== 'auto')

const WHISPER_MODELS = [
  {
    name: 'ggml-tiny',
    size: '75 MB',
    quality: '基础',
    note: '速度最快，精度较低',
    url: 'https://huggingface.co/ggerganov/whisper.cpp/resolve/main/ggml-tiny.bin',
  },
  {
    name: 'ggml-base',
    size: '142 MB',
    quality: '一般',
    note: '速度与精度均衡',
    url: 'https://huggingface.co/ggerganov/whisper.cpp/resolve/main/ggml-base.bin',
  },
  {
    name: 'ggml-small',
    size: '466 MB',
    quality: '良好',
    note: '适合日常使用',
    url: 'https://huggingface.co/ggerganov/whisper.cpp/resolve/main/ggml-small.bin',
  },
  {
    name: 'ggml-medium',
    size: '1.5 GB',
    quality: '很好',
    note: '高精度，需要较多内存',
    url: 'https://huggingface.co/ggerganov/whisper.cpp/resolve/main/ggml-medium.bin',
  },
  {
    name: 'ggml-large-v3',
    size: '3.1 GB',
    quality: '最佳',
    note: '最高精度，需要大量内存',
    url: 'https://huggingface.co/ggerganov/whisper.cpp/resolve/main/ggml-large-v3.bin',
  },
]

// ── 样式工具 ──────────────────────────────────────────────────────────────────

const inputCls =
  'w-full pl-3 pr-3 py-2.5 bg-slate-50/50 border border-slate-200 rounded-xl text-sm text-slate-800 shadow-sm hover:border-slate-300 focus:bg-white focus:outline-none focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500 transition-all'
const labelCls = 'mb-1.5 block text-sm font-medium text-slate-600'

// ── 工具子组件 ────────────────────────────────────────────────────────────────

function ServerConfigFields({
  wsUrl,
  apiKey,
  onWsUrl,
  onApiKey,
}: {
  wsUrl: string
  apiKey: string
  onWsUrl: (v: string) => void
  onApiKey: (v: string) => void
}) {
  const [visible, setVisible] = useState(false)
  return (
    <div className="space-y-4">
      <div>
        <label className={labelCls}>WebSocket URL</label>
        <input value={wsUrl} onChange={(e) => onWsUrl(e.target.value)} className={inputCls} />
      </div>
      <div>
        <label className={labelCls}>API Key</label>
        <div className="relative">
          <input
            type={visible ? 'text' : 'password'}
            value={apiKey}
            onChange={(e) => onApiKey(e.target.value)}
            autoComplete="off"
            className={`${inputCls} font-mono pr-10`}
          />
          <button
            type="button"
            onClick={() => setVisible((v) => !v)}
            className="absolute inset-y-0 right-0 flex items-center px-3 text-slate-400 hover:text-slate-600 transition-colors text-xs"
          >
            {visible ? '隐藏' : '显示'}
          </button>
        </div>
      </div>
    </div>
  )
}

function ToggleRow({
  label,
  hint,
  checked,
  onChange,
}: {
  label: string
  hint?: string
  checked: boolean
  onChange: (v: boolean) => void
}) {
  return (
    <div className="flex items-center justify-between gap-4">
      <div>
        <div className="text-sm font-medium text-slate-700">{label}</div>
        {hint && <div className="text-xs text-slate-500">{hint}</div>}
      </div>
      <button
        type="button"
        onClick={() => onChange(!checked)}
        className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors focus:outline-none ${
          checked ? 'bg-blue-600' : 'bg-slate-200'
        }`}
      >
        <span
          className={`inline-block h-4 w-4 transform rounded-full bg-white shadow-sm transition-transform ${
            checked ? 'translate-x-4' : 'translate-x-1'
          }`}
        />
      </button>
    </div>
  )
}

function AdvancedSection({ children }: { children: React.ReactNode }) {
  const [open, setOpen] = useState(false)
  return (
    <div>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="inline-flex items-center gap-1.5 rounded-xl bg-white px-4 py-2 text-sm font-medium text-slate-600 border border-slate-200 shadow-sm hover:bg-slate-50 transition-all"
      >
        高级配置
        <ChevronDown
          size={16}
          className={`transition-transform duration-200 ${open ? 'rotate-180' : ''}`}
        />
      </button>
      {open && (
        <div className="mt-3 space-y-4 rounded-xl border border-slate-200/80 bg-slate-50/40 px-4 py-4">
          {children}
        </div>
      )}
    </div>
  )
}

function SubTab({
  active,
  onClick,
  children,
}: {
  active: boolean
  onClick: () => void
  children: React.ReactNode
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`pb-2.5 text-sm border-b-2 transition-colors ${
        active
          ? 'border-blue-600 text-blue-700 font-semibold'
          : 'border-transparent text-slate-500 hover:text-slate-800 hover:border-slate-300'
      }`}
    >
      {children}
    </button>
  )
}

// ── 槽位激活按钮 ──────────────────────────────────────────────────────────────

interface SlotDef {
  label: string
  active: boolean
  onActivate: () => void
}

function SlotButtons({ slots }: { slots: SlotDef[] }) {
  return (
    <div className="flex flex-wrap gap-2 pt-4 border-t border-slate-100 mt-4">
      <span className="text-xs text-slate-400 self-center mr-1">激活为：</span>
      {slots.map((s) => (
        <button
          key={s.label}
          type="button"
          onClick={s.onActivate}
          className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium border transition-all ${
            s.active
              ? 'bg-blue-100 border-blue-200 text-blue-700'
              : 'bg-white border-slate-200 text-slate-500 hover:bg-slate-50 hover:border-slate-300'
          }`}
        >
          {s.active && (
            <span className="inline-block w-1.5 h-1.5 rounded-full bg-blue-500 shrink-0" />
          )}
          {s.label}
        </button>
      ))}
    </div>
  )
}

// ── 本地模型卡 ────────────────────────────────────────────────────────────────

function LocalModelCard({
  title,
  config,
  slots,
  note,
  onChange,
  isTauriEnv,
}: {
  title: string
  config: LocalModelConfig
  slots: SlotDef[]
  note?: string
  onChange: (c: LocalModelConfig) => void
  isTauriEnv: boolean
}) {
  const [showDownload, setShowDownload] = useState(false)
  const isAnyActive = slots.some((s) => s.active)

  const handleSelectModel = async () => {
    if (!isTauriEnv) return
    try {
      const path = await invoke<string | null>('select_model_file')
      if (path) onChange({ ...config, model_path: path })
    } catch {
      // ignore cancelled dialog
    }
  }

  return (
    <div
      className={`border rounded-2xl p-5 shadow-[0_2px_12px_rgba(15,23,42,0.03)] transition-colors ${
        isAnyActive ? 'border-blue-200 bg-blue-50/20' : 'border-slate-200/80 bg-white'
      }`}
    >
      <h3 className="text-sm font-semibold text-slate-700 mb-4">{title}</h3>

      {note && (
        <p className="mb-4 text-xs text-amber-600 bg-amber-50 border border-amber-200/80 rounded-xl px-3 py-2">
          {note}
        </p>
      )}

      <div className="space-y-4">
        <div>
          <label className={labelCls}>模型文件路径</label>
          <div className="flex gap-2">
            <input
              value={config.model_path}
              onChange={(e) => onChange({ ...config, model_path: e.target.value })}
              placeholder="/path/to/ggml-base.bin"
              className={`${inputCls} flex-1 font-mono text-xs`}
            />
            <button
              type="button"
              onClick={handleSelectModel}
              disabled={!isTauriEnv}
              className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-600 shadow-sm hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed transition-all"
            >
              <FolderOpen size={16} />
              浏览
            </button>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className={labelCls}>语言</label>
            <CustomSelect
              value={config.language}
              onChange={(v) => onChange({ ...config, language: v })}
              options={LANGUAGE_OPTIONS}
            />
          </div>
          <div>
            <label className={labelCls}>推理线程数</label>
            <input
              type="number"
              min={1}
              max={16}
              value={config.n_threads}
              onChange={(e) =>
                onChange({ ...config, n_threads: Math.max(1, parseInt(e.target.value) || 4) })
              }
              className={inputCls}
            />
          </div>
        </div>

        <div>
          <button
            type="button"
            onClick={() => setShowDownload((v) => !v)}
            className="inline-flex items-center gap-1.5 rounded-xl bg-white px-4 py-2 text-sm font-medium text-slate-600 border border-slate-200 shadow-sm hover:bg-slate-50 transition-all"
          >
            模型下载
            <ChevronDown
              size={16}
              className={`transition-transform duration-200 ${showDownload ? 'rotate-180' : ''}`}
            />
          </button>

          {showDownload && (
            <div className="mt-3 rounded-xl border border-slate-200/80 overflow-hidden">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-100 bg-slate-50/60">
                    <th className="px-3 py-2 text-left text-xs font-semibold text-slate-500">
                      模型
                    </th>
                    <th className="px-3 py-2 text-left text-xs font-semibold text-slate-500">
                      大小
                    </th>
                    <th className="px-3 py-2 text-left text-xs font-semibold text-slate-500">
                      精度
                    </th>
                    <th className="px-3 py-2 text-left text-xs font-semibold text-slate-500">
                      说明
                    </th>
                    <th className="px-3 py-2" />
                  </tr>
                </thead>
                <tbody>
                  {WHISPER_MODELS.map((m, idx) => (
                    <tr
                      key={m.name}
                      className={idx < WHISPER_MODELS.length - 1 ? 'border-b border-slate-100' : ''}
                    >
                      <td className="px-3 py-2 font-mono text-xs text-slate-700">{m.name}</td>
                      <td className="px-3 py-2 text-xs text-slate-500 whitespace-nowrap">
                        {m.size}
                      </td>
                      <td className="px-3 py-2 text-xs text-slate-600">{m.quality}</td>
                      <td className="px-3 py-2 text-xs text-slate-400">{m.note}</td>
                      <td className="px-3 py-2 text-right">
                        <button
                          type="button"
                          onClick={() => isTauriEnv && invoke('open_url', { url: m.url })}
                          disabled={!isTauriEnv}
                          className="text-xs text-blue-600 hover:text-blue-800 hover:underline disabled:opacity-40 disabled:cursor-not-allowed"
                        >
                          下载
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <p className="px-3 py-2 text-[11px] text-slate-400 border-t border-slate-100">
                点击「下载」在浏览器打开 HuggingFace 页面，下载后通过「浏览」按钮选择模型文件。
              </p>
            </div>
          )}
        </div>
      </div>

      <SlotButtons slots={slots} />
    </div>
  )
}

// ── 云端识别卡 ────────────────────────────────────────────────────────────────

function CloudRecognitionCard({
  gummy,
  paraformer,
  initTab,
  slots,
  onGummy,
  onParaformer,
  onTabChange,
}: {
  gummy: GummyConfig
  paraformer: ParaformerConfig
  initTab: 'gummy' | 'paraformer'
  slots: SlotDef[]
  onGummy: (c: GummyConfig) => void
  onParaformer: (c: ParaformerConfig) => void
  onTabChange: (tab: 'gummy' | 'paraformer') => void
}) {
  const [modelTab, setModelTab] = useState<'gummy' | 'paraformer'>(initTab)
  const isAnyActive = slots.some((s) => s.active)

  const switchTab = (tab: 'gummy' | 'paraformer') => {
    setModelTab(tab)
    onTabChange(tab)
  }

  return (
    <div
      className={`border rounded-2xl shadow-[0_2px_12px_rgba(15,23,42,0.03)] overflow-hidden transition-colors ${
        isAnyActive ? 'border-blue-200 bg-blue-50/20' : 'border-slate-200/80 bg-white'
      }`}
    >
      <div className="flex gap-5 px-5 pt-5 border-b border-slate-200">
        <h3 className="text-sm font-semibold text-slate-700 pb-2.5 self-center mr-2">
          语音识别模型
        </h3>
        <SubTab active={modelTab === 'gummy'} onClick={() => switchTab('gummy')}>
          Gummy（多语种）
        </SubTab>
        <SubTab active={modelTab === 'paraformer'} onClick={() => switchTab('paraformer')}>
          Paraformer（高精度）
        </SubTab>
      </div>

      <div className="p-5 space-y-5">
        {modelTab === 'gummy' ? (
          <>
            <ServerConfigFields
              wsUrl={gummy.server_config.ws_url}
              apiKey={gummy.server_config.api_key}
              onWsUrl={(v) =>
                onGummy({ ...gummy, server_config: { ...gummy.server_config, ws_url: v } })
              }
              onApiKey={(v) =>
                onGummy({ ...gummy, server_config: { ...gummy.server_config, api_key: v } })
              }
            />
            <AdvancedSection>
              <div className="flex items-center justify-between gap-4">
                <label className="text-sm font-medium text-slate-700">源语言</label>
                <CustomSelect
                  value={gummy.source_language}
                  onChange={(v) => onGummy({ ...gummy, source_language: v })}
                  options={LANGUAGE_OPTIONS}
                  className="max-w-52"
                />
              </div>
              <ToggleRow
                label="标点符号预测"
                checked={gummy.punctuation_prediction_enabled}
                onChange={(v) => onGummy({ ...gummy, punctuation_prediction_enabled: v })}
              />
              <ToggleRow
                label="数字格式化（ITN）"
                checked={gummy.itn_enabled}
                onChange={(v) => onGummy({ ...gummy, itn_enabled: v })}
              />
            </AdvancedSection>
          </>
        ) : (
          <>
            <ServerConfigFields
              wsUrl={paraformer.server_config.ws_url}
              apiKey={paraformer.server_config.api_key}
              onWsUrl={(v) =>
                onParaformer({
                  ...paraformer,
                  server_config: { ...paraformer.server_config, ws_url: v },
                })
              }
              onApiKey={(v) =>
                onParaformer({
                  ...paraformer,
                  server_config: { ...paraformer.server_config, api_key: v },
                })
              }
            />
            <AdvancedSection>
              <div className="flex items-center justify-between gap-4">
                <label className="text-sm font-medium text-slate-700">源语言</label>
                <CustomSelect
                  value={paraformer.source_language}
                  onChange={(v) => onParaformer({ ...paraformer, source_language: v })}
                  options={LANGUAGE_OPTIONS}
                  className="max-w-52"
                />
              </div>
              <ToggleRow
                label="语气词过滤"
                hint="过滤「嗯」「啊」等语气词"
                checked={paraformer.disfluency_removal_enabled}
                onChange={(v) => onParaformer({ ...paraformer, disfluency_removal_enabled: v })}
              />
              <ToggleRow
                label="标点符号预测"
                checked={paraformer.punctuation_prediction_enabled}
                onChange={(v) => onParaformer({ ...paraformer, punctuation_prediction_enabled: v })}
              />
              <ToggleRow
                label="数字格式化（ITN）"
                checked={paraformer.itn_enabled}
                onChange={(v) => onParaformer({ ...paraformer, itn_enabled: v })}
              />
              <ToggleRow
                label="情感识别"
                checked={paraformer.emotion_enabled}
                onChange={(v) => onParaformer({ ...paraformer, emotion_enabled: v })}
              />
            </AdvancedSection>
          </>
        )}

        <SlotButtons slots={slots} />
      </div>
    </div>
  )
}

// ── 云端翻译卡 ────────────────────────────────────────────────────────────────

function CloudTranslationCard({
  config,
  slots,
  onChange,
}: {
  config: GummyConfig
  slots: SlotDef[]
  onChange: (c: GummyConfig) => void
}) {
  const isAnyActive = slots.some((s) => s.active)

  return (
    <div
      className={`border rounded-2xl p-5 shadow-[0_2px_12px_rgba(15,23,42,0.03)] transition-colors ${
        isAnyActive ? 'border-blue-200 bg-blue-50/20' : 'border-slate-200/80 bg-white'
      }`}
    >
      <h3 className="text-sm font-semibold text-slate-700 mb-1">语音翻译模型</h3>
      <p className="text-xs text-slate-500 mb-4">
        基于 Gummy 模型，实时将语音识别结果翻译为目标语言，翻译功能自动开启。
      </p>

      <div className="space-y-5">
        <ServerConfigFields
          wsUrl={config.server_config.ws_url}
          apiKey={config.server_config.api_key}
          onWsUrl={(v) =>
            onChange({ ...config, server_config: { ...config.server_config, ws_url: v } })
          }
          onApiKey={(v) =>
            onChange({ ...config, server_config: { ...config.server_config, api_key: v } })
          }
        />
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className={labelCls}>源语言</label>
            <CustomSelect
              value={config.source_language}
              onChange={(v) => onChange({ ...config, source_language: v })}
              options={LANGUAGE_OPTIONS}
            />
          </div>
          <div>
            <label className={labelCls}>目标语言</label>
            <CustomSelect
              value={config.translation_target_languages[0] ?? 'zh'}
              onChange={(v) =>
                onChange({ ...config, translation_target_languages: v ? [v] : ['zh'] })
              }
              options={TARGET_LANGUAGE_OPTIONS}
            />
          </div>
        </div>
        <AdvancedSection>
          <ToggleRow
            label="标点符号预测"
            checked={config.punctuation_prediction_enabled}
            onChange={(v) => onChange({ ...config, punctuation_prediction_enabled: v })}
          />
          <ToggleRow
            label="数字格式化（ITN）"
            checked={config.itn_enabled}
            onChange={(v) => onChange({ ...config, itn_enabled: v })}
          />
        </AdvancedSection>
      </div>

      <SlotButtons slots={slots} />
    </div>
  )
}

// ── 主页面 ────────────────────────────────────────────────────────────────────

function loadSaved(): AsrFullConfig {
  try {
    const raw = localStorage.getItem(ASR_FULL_CONFIG_KEY)
    return raw ? (JSON.parse(raw) as AsrFullConfig) : DEFAULT_FULL_CONFIG
  } catch {
    return DEFAULT_FULL_CONFIG
  }
}

const ModelConfigPage = () => {
  const { setFullConfig } = useAsrStore()

  // 4 个独立槽位：从 store 读取，保证 summary card 实时响应
  const realtimeRecProvider = useAsrStore((s) => s.fullConfig.realtimeRecProvider ?? 'cloud')
  const realtimeTransProvider = useAsrStore((s) => s.fullConfig.realtimeTransProvider ?? 'cloud')
  const fileRecProvider = useAsrStore((s) => s.fullConfig.fileRecProvider ?? 'cloud')
  const fileTransProvider = useAsrStore((s) => s.fullConfig.fileTransProvider ?? 'cloud')

  // 模型配置
  const [gummyRec, setGummyRec] = useState<GummyConfig>(() => {
    const rec = loadSaved().cloud.recognition
    return rec.type === 'gummy' ? rec : DEFAULT_GUMMY_RECOGNITION
  })
  const [paraformerRec, setParaformerRec] = useState<ParaformerConfig>(() => {
    const rec = loadSaved().cloud.recognition
    return rec.type === 'paraformer' ? rec : DEFAULT_PARAFORMER
  })
  const [recModelTab, setRecModelTab] = useState<'gummy' | 'paraformer'>(() =>
    loadSaved().cloud.recognition.type === 'paraformer' ? 'paraformer' : 'gummy'
  )
  const [gummyTrans, setGummyTrans] = useState<GummyConfig>(
    () => loadSaved().cloud.translation ?? DEFAULT_GUMMY_TRANSLATION
  )
  const [ossConfig, setOssConfig] = useState<OssConfig>(
    () => loadSaved().cloud.oss ?? DEFAULT_OSS_CONFIG
  )
  const [localRec, setLocalRec] = useState<LocalModelConfig>(
    () => loadSaved().local?.recognition ?? DEFAULT_LOCAL_CONFIG.recognition
  )
  const [localTrans, setLocalTrans] = useState<LocalModelConfig>(
    () => loadSaved().local?.translation ?? DEFAULT_LOCAL_CONFIG.translation
  )

  const isTauriEnv = typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window
  const [modelLibTab, setModelLibTab] = useState<'recognition' | 'translation'>('recognition')
  const [recSourceTab, setRecSourceTab] = useState<'local' | 'cloud'>(() => {
    const s = loadSaved()
    return s.realtimeRecProvider === 'local' || s.fileRecProvider === 'local' ? 'local' : 'cloud'
  })
  const [transSourceTab, setTransSourceTab] = useState<'local' | 'cloud'>(() => {
    const s = loadSaved()
    return s.realtimeTransProvider === 'local' || s.fileTransProvider === 'local'
      ? 'local'
      : 'cloud'
  })

  // ── 保存辅助 ────────────────────────────────────────────────────────────────

  const saveCloud = useCallback(
    (updates: Partial<AsrFullConfig['cloud']> = {}) => {
      const current = useAsrStore.getState().fullConfig
      setFullConfig({ ...current, cloud: { ...current.cloud, ...updates } })
    },
    [setFullConfig]
  )

  // 槽位激活：直接写 store，summary card 通过 useAsrStore selector 自动响应
  const activateRealtimeRec = useCallback(
    (p: AsrProvider) => {
      const current = useAsrStore.getState().fullConfig
      setFullConfig({ ...current, realtimeRecProvider: p })
    },
    [setFullConfig]
  )
  const activateRealtimeTrans = useCallback(
    (p: AsrProvider) => {
      const current = useAsrStore.getState().fullConfig
      setFullConfig({ ...current, realtimeTransProvider: p })
    },
    [setFullConfig]
  )
  const activateFileRec = useCallback(
    (p: AsrProvider) => {
      const current = useAsrStore.getState().fullConfig
      setFullConfig({ ...current, fileRecProvider: p })
    },
    [setFullConfig]
  )
  const activateFileTrans = useCallback(
    (p: AsrProvider) => {
      const current = useAsrStore.getState().fullConfig
      setFullConfig({ ...current, fileTransProvider: p })
    },
    [setFullConfig]
  )

  // ── 模型配置回调 ─────────────────────────────────────────────────────────────

  const handleGummyRec = useCallback(
    (c: GummyConfig) => {
      setGummyRec(c)
      saveCloud({ recognition: { ...c, translation_enabled: false } })
    },
    [saveCloud]
  )

  const handleParaformerRec = useCallback(
    (c: ParaformerConfig) => {
      setParaformerRec(c)
      saveCloud({ recognition: c })
    },
    [saveCloud]
  )

  const handleRecModelTabChange = useCallback(
    (tab: 'gummy' | 'paraformer') => {
      setRecModelTab(tab)
      saveCloud({
        recognition: tab === 'gummy' ? { ...gummyRec, translation_enabled: false } : paraformerRec,
      })
    },
    [saveCloud, gummyRec, paraformerRec]
  )

  const handleGummyTrans = useCallback(
    (c: GummyConfig) => {
      setGummyTrans(c)
      saveCloud({ translation: { ...c, translation_enabled: true } })
    },
    [saveCloud]
  )

  const handleOss = useCallback(
    (updates: Partial<OssConfig>) => {
      const next = { ...ossConfig, ...updates }
      setOssConfig(next)
      saveCloud({ oss: next })
    },
    [ossConfig, saveCloud]
  )

  const handleLocalRec = useCallback(
    (c: LocalModelConfig) => {
      setLocalRec(c)
      const current = useAsrStore.getState().fullConfig
      setFullConfig({ ...current, local: { ...current.local, recognition: c } })
    },
    [setFullConfig]
  )

  const handleLocalTrans = useCallback(
    (c: LocalModelConfig) => {
      setLocalTrans(c)
      const current = useAsrStore.getState().fullConfig
      setFullConfig({ ...current, local: { ...current.local, translation: c } })
    },
    [setFullConfig]
  )

  // ── 摘要标签 ─────────────────────────────────────────────────────────────────

  const basename = (path: string) => (path ? (path.split(/[\\/]/).pop() ?? path) : '未配置')

  const ossReady =
    ossConfig.oss_endpoint &&
    ossConfig.oss_bucket &&
    ossConfig.oss_key_id &&
    ossConfig.oss_key_secret

  const slotLabel = (provider: AsrProvider, kind: 'rec' | 'trans') => {
    if (provider === 'local') {
      const name = kind === 'rec' ? basename(localRec.model_path) : basename(localTrans.model_path)
      return `本地 · ${name}`
    }
    if (kind === 'rec') {
      return ossReady ? '云端 · OSS + DashScope' : '云端 · OSS 未配置'
    }
    return '云端 · Gummy'
  }

  // 实时识别摘要忽略 OSS（用云端识别模型名）
  const realtimeRecLabel =
    realtimeRecProvider === 'local'
      ? `本地 · ${basename(localRec.model_path)}`
      : `云端 · ${recModelTab === 'gummy' ? 'Gummy' : 'Paraformer'}`

  return (
    <div className="w-full max-w-3xl mx-auto space-y-5">
      {/* ── 摘要卡 ──────────────────────────────────────────────────────────── */}
      <div className="border border-slate-200/80 bg-white shadow-[0_2px_12px_rgba(15,23,42,0.03)] rounded-2xl px-5 py-4">
        <p className="text-xs font-semibold uppercase tracking-wide text-slate-400 mb-3">
          当前激活配置
        </p>
        <div className="grid grid-cols-[auto_1fr_1fr] gap-x-4 gap-y-2 items-center text-sm">
          {/* header */}
          <div />
          <div className="text-xs font-medium text-slate-400">语音识别模型</div>
          <div className="text-xs font-medium text-slate-400">语音翻译模型</div>
          {/* 实时采集 */}
          <div className="text-xs font-medium text-slate-500 whitespace-nowrap">🎙 实时采集</div>
          <div className="text-xs text-slate-700 truncate">{realtimeRecLabel}</div>
          <div className="text-xs text-slate-700 truncate">
            {slotLabel(realtimeTransProvider, 'trans')}
          </div>
          {/* 文件识别 */}
          <div className="text-xs font-medium text-slate-500 whitespace-nowrap">🎬 文件识别</div>
          <div className="text-xs text-slate-700 truncate">{slotLabel(fileRecProvider, 'rec')}</div>
          <div className="text-xs text-slate-700 truncate">
            {slotLabel(fileTransProvider, 'trans')}
          </div>
        </div>
      </div>

      {/* ── 模型库 ───────────────────────────────────────────────────────────── */}
      <div className="border border-slate-200/80 bg-white shadow-[0_2px_12px_rgba(15,23,42,0.03)] rounded-2xl overflow-hidden">
        {/* Tab 栏 */}
        <div className="flex gap-6 px-6 pt-5 border-b border-slate-200">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-400 self-center mr-2">
            模型库
          </p>
          {(
            [
              { value: 'recognition', label: '语音识别' },
              { value: 'translation', label: '语音翻译' },
            ] as { value: 'recognition' | 'translation'; label: string }[]
          ).map(({ value, label }) => (
            <button
              key={value}
              type="button"
              onClick={() => setModelLibTab(value)}
              className={`pb-3 text-sm border-b-2 transition-colors ${
                modelLibTab === value
                  ? 'border-blue-600 text-blue-700 font-semibold'
                  : 'border-transparent text-slate-500 hover:text-slate-800 hover:border-slate-300'
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        {/* Tab 内容 */}
        <div>
          {modelLibTab === 'recognition' ? (
            <>
              {/* 语音识别：本地 / 云端 内层 Tab */}
              <div className="flex gap-5 px-6 border-b border-slate-100">
                {(
                  [
                    { value: 'local', label: '本地模型' },
                    { value: 'cloud', label: '云端模型' },
                  ] as { value: 'local' | 'cloud'; label: string }[]
                ).map(({ value, label }) => {
                  const isActive =
                    value === 'local'
                      ? realtimeRecProvider === 'local' || fileRecProvider === 'local'
                      : realtimeRecProvider === 'cloud' || fileRecProvider === 'cloud'
                  return (
                    <button
                      key={value}
                      type="button"
                      onClick={() => setRecSourceTab(value)}
                      className={`pb-3 pt-4 flex items-center gap-1.5 text-sm border-b-2 transition-colors ${
                        recSourceTab === value
                          ? 'border-blue-600 text-blue-700 font-semibold'
                          : 'border-transparent text-slate-500 hover:text-slate-800 hover:border-slate-300'
                      }`}
                    >
                      {label}
                      {isActive && (
                        <span className="inline-block w-1.5 h-1.5 rounded-full bg-blue-500" />
                      )}
                    </button>
                  )
                })}
              </div>

              <div className="p-5 space-y-4">
                {recSourceTab === 'local' ? (
                  <LocalModelCard
                    title="本地语音识别模型"
                    config={localRec}
                    onChange={handleLocalRec}
                    isTauriEnv={isTauriEnv}
                    slots={[
                      {
                        label: '实时·识别',
                        active: realtimeRecProvider === 'local',
                        onActivate: () => activateRealtimeRec('local'),
                      },
                      {
                        label: '文件·识别',
                        active: fileRecProvider === 'local',
                        onActivate: () => activateFileRec('local'),
                      },
                    ]}
                  />
                ) : (
                  <>
                    <CloudRecognitionCard
                      gummy={gummyRec}
                      paraformer={paraformerRec}
                      initTab={recModelTab}
                      onGummy={handleGummyRec}
                      onParaformer={handleParaformerRec}
                      onTabChange={handleRecModelTabChange}
                      slots={[
                        {
                          label: '实时·识别',
                          active: realtimeRecProvider === 'cloud',
                          onActivate: () => activateRealtimeRec('cloud'),
                        },
                        {
                          label: '文件·识别',
                          active: fileRecProvider === 'cloud',
                          onActivate: () => activateFileRec('cloud'),
                        },
                      ]}
                    />
                    <div className="border border-slate-200/80 rounded-2xl p-5 bg-slate-50/40">
                      <h3 className="text-sm font-semibold text-slate-700 mb-1">
                        文件识别存储（OSS）
                      </h3>
                      <p className="text-xs text-slate-500 mb-4">
                        视频字幕云端识别需要先将文件上传至 OSS，识别完成后自动删除。
                      </p>
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <label className={labelCls}>OSS Endpoint</label>
                          <input
                            value={ossConfig.oss_endpoint}
                            onChange={(e) => handleOss({ oss_endpoint: e.target.value })}
                            placeholder="oss-cn-beijing.aliyuncs.com"
                            className={inputCls}
                          />
                        </div>
                        <div>
                          <label className={labelCls}>Bucket</label>
                          <input
                            value={ossConfig.oss_bucket}
                            onChange={(e) => handleOss({ oss_bucket: e.target.value })}
                            placeholder="my-bucket"
                            className={inputCls}
                          />
                        </div>
                        <div>
                          <label className={labelCls}>Access Key ID</label>
                          <input
                            value={ossConfig.oss_key_id}
                            onChange={(e) => handleOss({ oss_key_id: e.target.value })}
                            placeholder="LTAI..."
                            className={inputCls}
                          />
                        </div>
                        <div>
                          <label className={labelCls}>Access Key Secret</label>
                          <input
                            type="password"
                            value={ossConfig.oss_key_secret}
                            onChange={(e) => handleOss({ oss_key_secret: e.target.value })}
                            placeholder="••••••••"
                            autoComplete="off"
                            className={`${inputCls} font-mono`}
                          />
                        </div>
                      </div>
                    </div>
                  </>
                )}
              </div>
            </>
          ) : (
            <>
              {/* 语音翻译：本地 / 云端 内层 Tab */}
              <div className="flex gap-5 px-6 border-b border-slate-100">
                {(
                  [
                    { value: 'local', label: '本地模型' },
                    { value: 'cloud', label: '云端模型' },
                  ] as { value: 'local' | 'cloud'; label: string }[]
                ).map(({ value, label }) => {
                  const isActive =
                    value === 'local'
                      ? realtimeTransProvider === 'local' || fileTransProvider === 'local'
                      : realtimeTransProvider === 'cloud' || fileTransProvider === 'cloud'
                  return (
                    <button
                      key={value}
                      type="button"
                      onClick={() => setTransSourceTab(value)}
                      className={`pb-3 pt-4 flex items-center gap-1.5 text-sm border-b-2 transition-colors ${
                        transSourceTab === value
                          ? 'border-blue-600 text-blue-700 font-semibold'
                          : 'border-transparent text-slate-500 hover:text-slate-800 hover:border-slate-300'
                      }`}
                    >
                      {label}
                      {isActive && (
                        <span className="inline-block w-1.5 h-1.5 rounded-full bg-blue-500" />
                      )}
                    </button>
                  )
                })}
              </div>

              <div className="p-5">
                {transSourceTab === 'local' ? (
                  <LocalModelCard
                    title="本地语音翻译模型"
                    config={localTrans}
                    onChange={handleLocalTrans}
                    isTauriEnv={isTauriEnv}
                    note="本地翻译基于 Whisper --translate，仅支持翻译至英文，不支持中文等其他目标语言。"
                    slots={[
                      {
                        label: '实时·翻译',
                        active: realtimeTransProvider === 'local',
                        onActivate: () => activateRealtimeTrans('local'),
                      },
                      {
                        label: '文件·翻译',
                        active: fileTransProvider === 'local',
                        onActivate: () => activateFileTrans('local'),
                      },
                    ]}
                  />
                ) : (
                  <CloudTranslationCard
                    config={gummyTrans}
                    onChange={handleGummyTrans}
                    slots={[
                      {
                        label: '实时·翻译',
                        active: realtimeTransProvider === 'cloud',
                        onActivate: () => activateRealtimeTrans('cloud'),
                      },
                      {
                        label: '文件·翻译',
                        active: fileTransProvider === 'cloud',
                        onActivate: () => activateFileTrans('cloud'),
                      },
                    ]}
                  />
                )}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  )
}

export default ModelConfigPage
