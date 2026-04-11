import { HelpCircle } from 'lucide-react'
import { useEffect, useState } from 'react'

import CustomSelect from '@/components/CustomSelect'
import { useAsrStore } from '@/store/asrStore'

import type { AsrModelConfig, GummyConfig, ParaformerConfig } from '@/types/asr'

const DEFAULT_SERVER_CONFIG = {
  ws_url: 'wss://dashscope.aliyuncs.com/api-ws/v1/inference/',
  api_key: 'sk-xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx',
}

const DEFAULT_GUMMY_CONFIG: GummyConfig = {
  type: 'gummy',
  server_config: DEFAULT_SERVER_CONFIG,
  source_language: 'zh',
  translation_enabled: false,
  translation_target_languages: [],
  punctuation_prediction_enabled: true,
  itn_enabled: true,
}

const DEFAULT_PARAFORMER_CONFIG: ParaformerConfig = {
  type: 'paraformer',
  server_config: DEFAULT_SERVER_CONFIG,
  source_language: 'zh',
  disfluency_removal_enabled: false,
  punctuation_prediction_enabled: true,
  itn_enabled: true,
  emotion_enabled: false,
}

const LANGUAGE_OPTIONS = [
  { label: '中文', value: 'zh' },
  { label: '英文', value: 'en' },
  { label: '日语', value: 'ja' },
  { label: '韩语', value: 'ko' },
  { label: '德语', value: 'de' },
  { label: '法语', value: 'fr' },
  { label: '俄语', value: 'ru' },
]

const inputCls =
  'w-full pl-3 pr-3 py-2.5 bg-slate-50/50 border border-slate-200 rounded-xl text-sm text-slate-800 shadow-sm hover:border-slate-300 focus:bg-white focus:outline-none focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500 transition-all'
const labelCls = 'mb-1.5 block text-sm font-medium text-slate-600'

function ToggleRow({
  label,
  checked,
  onChange,
  hint,
}: {
  label: string
  checked: boolean
  onChange: (checked: boolean) => void
  hint?: string
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
        className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors focus:outline-none focus:ring-4 focus:ring-blue-500/10 ${
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

const ModelConfigPage = () => {
  const { asrConfig, setAsrConfig } = useAsrStore()
  const isDev = import.meta.env.DEV

  const [name, setName] = useState('')
  const [greeting, setGreeting] = useState('')
  const [modelType, setModelType] = useState<'gummy' | 'paraformer'>('gummy')
  const [gummyConfig, setGummyConfig] = useState<GummyConfig>(DEFAULT_GUMMY_CONFIG)
  const [paraformerConfig, setParaformerConfig] =
    useState<ParaformerConfig>(DEFAULT_PARAFORMER_CONFIG)

  // 从 store（已由 persist 中间件恢复）初始化本地表单状态
  useEffect(() => {
    if (!asrConfig) {
      setAsrConfig(DEFAULT_GUMMY_CONFIG)
      return
    }
    if (asrConfig.type === 'gummy') {
      setModelType('gummy')
      setGummyConfig(asrConfig)
    } else {
      setModelType('paraformer')
      setParaformerConfig(asrConfig)
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const saveConfig = (config: AsrModelConfig) => setAsrConfig(config)

  const handleModelTypeChange = (type: 'gummy' | 'paraformer') => {
    setModelType(type)
    saveConfig(type === 'gummy' ? gummyConfig : paraformerConfig)
  }

  const updateGummyConfig = (updates: Partial<GummyConfig>) => {
    const newConfig = { ...gummyConfig, ...updates }
    setGummyConfig(newConfig)
    saveConfig(newConfig)
  }

  const updateParaformerConfig = (updates: Partial<ParaformerConfig>) => {
    const newConfig = { ...paraformerConfig, ...updates }
    setParaformerConfig(newConfig)
    saveConfig(newConfig)
  }

  const handleGreet = () => setGreeting(`你好，${name}!`)

  return (
    <div className="w-full max-w-5xl mx-auto space-y-6">
      <section className="overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-[0_2px_12px_rgba(15,23,42,0.03)]">
        <div className="border-b border-slate-100 px-6 py-5">
          <h2 className="text-base font-semibold text-slate-900">ASR 模型配置</h2>
          <p className="mt-1 text-sm text-slate-500">配置语音识别服务的连接参数与语言选项。</p>
        </div>

        <div className="px-6 pt-5">
          <div className="mb-6 flex gap-6 border-b border-slate-200">
            <button
              type="button"
              onClick={() => handleModelTypeChange('gummy')}
              className={`pb-3 text-sm border-b-2 transition-colors ${
                modelType === 'gummy'
                  ? 'border-blue-600 text-blue-700 font-semibold'
                  : 'border-transparent text-slate-500 hover:text-slate-800 hover:border-slate-300'
              }`}
            >
              Gummy（支持翻译）
            </button>
            <button
              type="button"
              onClick={() => handleModelTypeChange('paraformer')}
              className={`pb-3 text-sm border-b-2 transition-colors ${
                modelType === 'paraformer'
                  ? 'border-blue-600 text-blue-700 font-semibold'
                  : 'border-transparent text-slate-500 hover:text-slate-800 hover:border-slate-300'
              }`}
            >
              Paraformer（高准确率）
            </button>
          </div>
        </div>

        <div className="space-y-6 px-6 pb-6">
          {modelType === 'gummy' ? (
            <>
              <div className="space-y-4">
                <div>
                  <label className={labelCls}>WebSocket URL</label>
                  <input
                    value={gummyConfig.server_config.ws_url}
                    onChange={(e) =>
                      updateGummyConfig({
                        server_config: { ...gummyConfig.server_config, ws_url: e.target.value },
                      })
                    }
                    className={inputCls}
                  />
                </div>
                <div>
                  <label className={labelCls}>API Key</label>
                  <input
                    type="password"
                    value={gummyConfig.server_config.api_key}
                    onChange={(e) =>
                      updateGummyConfig({
                        server_config: { ...gummyConfig.server_config, api_key: e.target.value },
                      })
                    }
                    className={`${inputCls} font-mono`}
                    autoComplete="off"
                  />
                </div>
              </div>

              <div className="h-px bg-gradient-to-r from-transparent via-slate-100 to-transparent" />

              <div className="space-y-5">
                <div className="flex items-center justify-between gap-4">
                  <label className="text-sm font-medium text-slate-700">源语言</label>
                  <CustomSelect
                    value={gummyConfig.source_language}
                    onChange={(v) => updateGummyConfig({ source_language: v })}
                    options={LANGUAGE_OPTIONS}
                    className="max-w-52"
                  />
                </div>

                <ToggleRow
                  label="启用翻译功能"
                  hint="将识别结果实时翻译为目标语言"
                  checked={gummyConfig.translation_enabled}
                  onChange={(checked) => updateGummyConfig({ translation_enabled: checked })}
                />

                {gummyConfig.translation_enabled && (
                  <div className="ml-1 border-l-2 border-blue-200 pl-4 py-1">
                    <div className="flex items-center justify-between gap-4">
                      <label className="text-sm font-medium text-slate-700">翻译目标语言</label>
                      <CustomSelect
                        value={gummyConfig.translation_target_languages[0] ?? ''}
                        onChange={(v) =>
                          updateGummyConfig({ translation_target_languages: v ? [v] : [] })
                        }
                        options={LANGUAGE_OPTIONS}
                        placeholder="请选择"
                        className="max-w-52"
                      />
                    </div>
                  </div>
                )}

                <ToggleRow
                  label="启用标点符号预测"
                  checked={gummyConfig.punctuation_prediction_enabled}
                  onChange={(checked) =>
                    updateGummyConfig({ punctuation_prediction_enabled: checked })
                  }
                />

                <ToggleRow
                  label="启用逆文本正则化（ITN）"
                  checked={gummyConfig.itn_enabled}
                  onChange={(checked) => updateGummyConfig({ itn_enabled: checked })}
                />

                <div>
                  <label className={labelCls}>热词 ID（可选）</label>
                  <input
                    value={gummyConfig.vocabulary_id || ''}
                    onChange={(e) =>
                      updateGummyConfig({ vocabulary_id: e.target.value || undefined })
                    }
                    placeholder="输入热词 ID"
                    className={inputCls}
                  />
                </div>
              </div>
            </>
          ) : (
            <>
              <div className="space-y-4">
                <div>
                  <label className={labelCls}>WebSocket URL</label>
                  <input
                    value={paraformerConfig.server_config.ws_url}
                    onChange={(e) =>
                      updateParaformerConfig({
                        server_config: {
                          ...paraformerConfig.server_config,
                          ws_url: e.target.value,
                        },
                      })
                    }
                    className={inputCls}
                  />
                </div>
                <div>
                  <label className={labelCls}>API Key</label>
                  <input
                    type="password"
                    value={paraformerConfig.server_config.api_key}
                    onChange={(e) =>
                      updateParaformerConfig({
                        server_config: {
                          ...paraformerConfig.server_config,
                          api_key: e.target.value,
                        },
                      })
                    }
                    className={`${inputCls} font-mono`}
                    autoComplete="off"
                  />
                </div>
              </div>

              <div className="h-px bg-gradient-to-r from-transparent via-slate-100 to-transparent" />

              <div className="space-y-5">
                <div className="flex items-center justify-between gap-4">
                  <label className="text-sm font-medium text-slate-700">源语言</label>
                  <CustomSelect
                    value={paraformerConfig.source_language}
                    onChange={(v) => updateParaformerConfig({ source_language: v })}
                    options={LANGUAGE_OPTIONS}
                    className="max-w-52"
                  />
                </div>

                <ToggleRow
                  label="启用不流畅词过滤"
                  hint={'过滤"嗯、啊"等语气词'}
                  checked={paraformerConfig.disfluency_removal_enabled}
                  onChange={(checked) =>
                    updateParaformerConfig({ disfluency_removal_enabled: checked })
                  }
                />

                <ToggleRow
                  label="启用标点符号预测"
                  checked={paraformerConfig.punctuation_prediction_enabled}
                  onChange={(checked) =>
                    updateParaformerConfig({ punctuation_prediction_enabled: checked })
                  }
                />

                <ToggleRow
                  label="启用逆文本正则化（ITN）"
                  checked={paraformerConfig.itn_enabled}
                  onChange={(checked) => updateParaformerConfig({ itn_enabled: checked })}
                />

                <ToggleRow
                  label="启用情感识别（部分模型支持）"
                  checked={paraformerConfig.emotion_enabled}
                  onChange={(checked) => updateParaformerConfig({ emotion_enabled: checked })}
                />

                <div>
                  <label className={labelCls}>方言设置（可选）</label>
                  <input
                    value={paraformerConfig.dialect || ''}
                    onChange={(e) =>
                      updateParaformerConfig({ dialect: e.target.value || undefined })
                    }
                    placeholder="如：四川话、粤语等"
                    className={inputCls}
                  />
                </div>

                <div>
                  <label className={labelCls}>热词 ID（可选）</label>
                  <input
                    value={paraformerConfig.vocabulary_id || ''}
                    onChange={(e) =>
                      updateParaformerConfig({ vocabulary_id: e.target.value || undefined })
                    }
                    placeholder="输入热词 ID"
                    className={inputCls}
                  />
                </div>
              </div>
            </>
          )}
        </div>
      </section>

      {isDev && (
        <section className="overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-[0_2px_12px_rgba(15,23,42,0.03)]">
          <div className="border-b border-slate-100 px-6 py-4">
            <h3 className="text-base font-semibold text-slate-900">快速测试</h3>
          </div>
          <div className="space-y-4 px-6 py-5">
            <div className="flex flex-wrap items-center gap-3">
              <input
                value={name}
                placeholder="请输入名字"
                onChange={(e) => setName(e.target.value)}
                className={`${inputCls} max-w-xs`}
              />
              <button
                type="button"
                onClick={handleGreet}
                className="rounded-xl bg-blue-600 px-4 py-2 text-sm font-medium text-white shadow-[0_4px_12px_rgba(37,99,235,0.25)] hover:shadow-[0_6px_16px_rgba(37,99,235,0.35)] active:translate-y-[1px] transition-all"
              >
                调用 Rust
              </button>
            </div>
            {greeting && (
              <div className="rounded-xl border border-blue-100 bg-blue-50/60 px-4 py-3 text-sm text-blue-900">
                {greeting}
              </div>
            )}
            <div className="flex items-center gap-2 text-xs text-slate-500">
              <HelpCircle className="h-4 w-4" />
              配置改动会自动保存到本地并同步到 ASR Store。
            </div>
          </div>
        </section>
      )}
    </div>
  )
}

export default ModelConfigPage
