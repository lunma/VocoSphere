import { useState, useEffect } from 'react'
import { theme, Segmented, Input, Switch, Select, Typography } from 'antd'

// 服务器配置
export interface ServerConfig {
  ws_url: string
  api_key: string
}

// ASR 配置类型定义
export interface GummyConfig {
  type: 'gummy'
  server_config: ServerConfig
  source_language: string
  language_hints?: string[]
  translation_enabled: boolean
  translation_target_languages: string[]
  vocabulary_id?: string
  punctuation_prediction_enabled: boolean
  itn_enabled: boolean
}

export interface ParaformerConfig {
  type: 'paraformer'
  server_config: ServerConfig
  source_language: string
  language_hints?: string[]
  vocabulary_id?: string
  disfluency_removal_enabled: boolean
  punctuation_prediction_enabled: boolean
  itn_enabled: boolean
  dialect?: string
  emotion_enabled: boolean
}

export type AsrModelConfig = GummyConfig | ParaformerConfig

// 默认服务器配置
const DEFAULT_SERVER_CONFIG: ServerConfig = {
  ws_url: 'wss://dashscope.aliyuncs.com/api-ws/v1/inference/',
  api_key: 'sk-xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx',
}

// 默认配置
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

const MODEL_SEGMENT_OPTIONS: { label: string; value: 'gummy' | 'paraformer' }[] = [
  { label: 'Gummy（支持翻译）', value: 'gummy' },
  { label: 'Paraformer（高准确率）', value: 'paraformer' },
]

// LocalStorage 键
const STORAGE_KEY = 'asr_model_config'

interface AsrConfigProps {
  onConfigChange: (config: AsrModelConfig) => void
}

export default function AsrConfig({ onConfigChange }: AsrConfigProps) {
  const { token } = theme.useToken()
  const { Title, Text } = Typography
  const [modelType, setModelType] = useState<'gummy' | 'paraformer'>('gummy')
  const [gummyConfig, setGummyConfig] = useState<GummyConfig>(DEFAULT_GUMMY_CONFIG)
  const [paraformerConfig, setParaformerConfig] = useState<ParaformerConfig>(DEFAULT_PARAFORMER_CONFIG)

  // 从 localStorage 加载配置
  useEffect(() => {
    try {
      const savedConfig = localStorage.getItem(STORAGE_KEY)
      if (savedConfig) {
        const config: any = JSON.parse(savedConfig)
        
        // 兼容旧版配置：如果没有 server_config，添加默认值
        if (config.type === 'gummy') {
          const gummyConf: GummyConfig = {
            ...DEFAULT_GUMMY_CONFIG,
            ...config,
            server_config: config.server_config || DEFAULT_SERVER_CONFIG,
          }
          setModelType('gummy')
          setGummyConfig(gummyConf)
          onConfigChange(gummyConf)
        } else if (config.type === 'paraformer') {
          const paraformerConf: ParaformerConfig = {
            ...DEFAULT_PARAFORMER_CONFIG,
            ...config,
            server_config: config.server_config || DEFAULT_SERVER_CONFIG,
          }
          setModelType('paraformer')
          setParaformerConfig(paraformerConf)
          onConfigChange(paraformerConf)
        } else {
          // 配置格式不正确，使用默认值
          console.warn('配置格式不正确，使用默认配置')
          onConfigChange(DEFAULT_GUMMY_CONFIG)
        }
      } else {
        // 首次加载，使用默认配置
        onConfigChange(DEFAULT_GUMMY_CONFIG)
      }
    } catch (error) {
      console.error('加载配置失败:', error)
      // 配置加载失败，清除损坏的配置
      localStorage.removeItem(STORAGE_KEY)
      onConfigChange(DEFAULT_GUMMY_CONFIG)
    }
  }, [onConfigChange])

  // 保存配置到 localStorage 并通知父组件
  const saveConfig = (config: AsrModelConfig) => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(config))
      onConfigChange(config)
    } catch (error) {
      console.error('保存配置失败:', error)
    }
  }

  // 切换模型类型
  const handleModelTypeChange = (type: 'gummy' | 'paraformer') => {
    setModelType(type)
    const config = type === 'gummy' ? gummyConfig : paraformerConfig
    saveConfig(config)
  }

  // 更新 Gummy 配置
  const updateGummyConfig = (updates: Partial<GummyConfig>) => {
    const newConfig = { ...gummyConfig, ...updates }
    setGummyConfig(newConfig)
    saveConfig(newConfig)
  }

  // 更新 Paraformer 配置
  const updateParaformerConfig = (updates: Partial<ParaformerConfig>) => {
    const newConfig = { ...paraformerConfig, ...updates }
    setParaformerConfig(newConfig)
    saveConfig(newConfig)
  }

  return (
    <div
      style={{
        padding: 24,
        backgroundColor: token.colorFillTertiary,
        borderRadius: token.borderRadiusLG,
        marginBottom: 24,
      }}
    >
      <Title level={4} style={{ marginTop: 0, marginBottom: 16 }}>
        ASR 模型配置
      </Title>

      {/* 模型选择 */}
      <div style={{ marginBottom: 24 }}>
        <Text style={{ display: 'block', marginBottom: 8, fontWeight: 600 }}>选择模型</Text>
        <Segmented
          block
          options={MODEL_SEGMENT_OPTIONS}
          value={modelType}
          onChange={(value) => handleModelTypeChange(value as 'gummy' | 'paraformer')}
        />
      </div>

      {/* Gummy 配置 */}
      {modelType === 'gummy' && (
        <div
          style={{
            backgroundColor: token.colorBgContainer,
            padding: 16,
            borderRadius: token.borderRadiusLG,
            border: `1px solid ${token.colorBorderSecondary}`,
            boxShadow: token.boxShadowSecondary,
          }}
        >
          <Title level={5} style={{ marginTop: 0 }}>
            Gummy 模型配置
          </Title>

          {/* 服务器配置 */}
          <div
            style={{
              marginBottom: 24,
              padding: 16,
              backgroundColor: token.colorFillSecondary,
              borderRadius: token.borderRadius,
              border: `1px solid ${token.colorBorderSecondary}`,
            }}
          >
            <Title level={5} style={{ marginTop: 0, marginBottom: 12 }}>
              服务器配置
            </Title>

            <div style={{ marginBottom: 12 }}>
              <Text style={{ display: 'block', marginBottom: 4, fontSize: 13, fontWeight: 500 }}>
                WebSocket URL
              </Text>
              <Input
                value={gummyConfig.server_config.ws_url}
                onChange={(event) =>
                  updateGummyConfig({
                    server_config: { ...gummyConfig.server_config, ws_url: event.target.value },
                  })
                }
                placeholder="wss://dashscope.aliyuncs.com/api-ws/v1/inference/"
                allowClear
              />
            </div>

            <div style={{ marginBottom: 0 }}>
              <Text style={{ display: 'block', marginBottom: 4, fontSize: 13, fontWeight: 500 }}>
                API Key
              </Text>
              <Input.Password
                value={gummyConfig.server_config.api_key}
                onChange={(event) =>
                  updateGummyConfig({
                    server_config: { ...gummyConfig.server_config, api_key: event.target.value },
                  })
                }
                placeholder="sk-xxxxxxxxxxxxxxxx"
                autoComplete="off"
              />
            </div>
          </div>

          {/* 源语言 */}
          <div style={{ marginBottom: 16 }}>
            <Text style={{ display: 'block', marginBottom: 4 }}>源语言</Text>
            <Select
              value={gummyConfig.source_language}
              onChange={(value: string) => updateGummyConfig({ source_language: value })}
              options={LANGUAGE_OPTIONS}
              style={{ width: '100%' }}
              showSearch
              optionFilterProp="label"
            />
          </div>

          {/* 翻译功能 */}
          <div style={{ marginBottom: 16 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <Switch
                checked={gummyConfig.translation_enabled}
                onChange={(checked) => updateGummyConfig({ translation_enabled: checked })}
              />
              <Text>启用翻译功能</Text>
            </div>
          </div>

          {/* 翻译目标语言 */}
          {gummyConfig.translation_enabled && (
            <div style={{ marginBottom: 16 }}>
              <Text style={{ display: 'block', marginBottom: 4 }}>翻译目标语言</Text>
              <Select
                mode="multiple"
                allowClear
                placeholder="选择翻译目标语言"
                value={gummyConfig.translation_target_languages}
                onChange={(values: string[]) =>
                  updateGummyConfig({ translation_target_languages: values })
                }
                options={LANGUAGE_OPTIONS}
                optionFilterProp="label"
                maxTagCount="responsive"
                style={{ width: '100%' }}
              />
            </div>
          )}

          {/* 标点符号预测 */}
          <div style={{ marginBottom: 16 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <Switch
                checked={gummyConfig.punctuation_prediction_enabled}
                onChange={(checked) =>
                  updateGummyConfig({ punctuation_prediction_enabled: checked })
                }
              />
              <Text>启用标点符号预测</Text>
            </div>
          </div>

          {/* 逆文本正则化 */}
          <div style={{ marginBottom: 16 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <Switch
                checked={gummyConfig.itn_enabled}
                onChange={(checked) => updateGummyConfig({ itn_enabled: checked })}
              />
              <Text>启用逆文本正则化（ITN）</Text>
            </div>
          </div>

          {/* 热词ID */}
          <div style={{ marginBottom: 16 }}>
            <Text style={{ display: 'block', marginBottom: 4 }}>热词 ID（可选）</Text>
            <Input
              value={gummyConfig.vocabulary_id || ''}
              onChange={(event) =>
                updateGummyConfig({ vocabulary_id: event.target.value || undefined })
              }
              placeholder="输入热词ID"
              allowClear
            />
          </div>
        </div>
      )}

      {/* Paraformer 配置 */}
      {modelType === 'paraformer' && (
        <div
          style={{
            backgroundColor: token.colorBgContainer,
            padding: 16,
            borderRadius: token.borderRadiusLG,
            border: `1px solid ${token.colorBorderSecondary}`,
            boxShadow: token.boxShadowSecondary,
          }}
        >
          <Title level={5} style={{ marginTop: 0 }}>
            Paraformer 模型配置
          </Title>

          {/* 服务器配置 */}
          <div
            style={{
              marginBottom: 24,
              padding: 16,
              backgroundColor: token.colorFillSecondary,
              borderRadius: token.borderRadius,
              border: `1px solid ${token.colorBorderSecondary}`,
            }}
          >
            <Title level={5} style={{ marginTop: 0, marginBottom: 12 }}>
              服务器配置
            </Title>

            <div style={{ marginBottom: 12 }}>
              <Text style={{ display: 'block', marginBottom: 4, fontSize: 13, fontWeight: 500 }}>
                WebSocket URL
              </Text>
              <Input
                value={paraformerConfig.server_config.ws_url}
                onChange={(event) =>
                  updateParaformerConfig({
                    server_config: { ...paraformerConfig.server_config, ws_url: event.target.value },
                  })
                }
                placeholder="wss://dashscope.aliyuncs.com/api-ws/v1/inference/"
                allowClear
              />
            </div>

            <div style={{ marginBottom: 0 }}>
              <Text style={{ display: 'block', marginBottom: 4, fontSize: 13, fontWeight: 500 }}>
                API Key
              </Text>
              <Input.Password
                value={paraformerConfig.server_config.api_key}
                onChange={(event) =>
                  updateParaformerConfig({
                    server_config: { ...paraformerConfig.server_config, api_key: event.target.value },
                  })
                }
                placeholder="sk-xxxxxxxxxxxxxxxx"
                autoComplete="off"
              />
            </div>
          </div>

          {/* 源语言 */}
          <div style={{ marginBottom: 16 }}>
            <Text style={{ display: 'block', marginBottom: 4 }}>源语言</Text>
            <Select
              value={paraformerConfig.source_language}
              onChange={(value: string) => updateParaformerConfig({ source_language: value })}
              options={LANGUAGE_OPTIONS}
              style={{ width: '100%' }}
              showSearch
              optionFilterProp="label"
            />
          </div>

          {/* 不流畅词过滤 */}
          <div style={{ marginBottom: 16 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <Switch
                checked={paraformerConfig.disfluency_removal_enabled}
                onChange={(checked) =>
                  updateParaformerConfig({ disfluency_removal_enabled: checked })
                }
              />
              <Text>启用不流畅词过滤（如：嗯、啊等语气词）</Text>
            </div>
          </div>

          {/* 标点符号预测 */}
          <div style={{ marginBottom: 16 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <Switch
                checked={paraformerConfig.punctuation_prediction_enabled}
                onChange={(checked) =>
                  updateParaformerConfig({ punctuation_prediction_enabled: checked })
                }
              />
              <Text>启用标点符号预测</Text>
            </div>
          </div>

          {/* 逆文本正则化 */}
          <div style={{ marginBottom: 16 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <Switch
                checked={paraformerConfig.itn_enabled}
                onChange={(checked) => updateParaformerConfig({ itn_enabled: checked })}
              />
              <Text>启用逆文本正则化（ITN）</Text>
            </div>
          </div>

          {/* 情感识别 */}
          <div style={{ marginBottom: 16 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <Switch
                checked={paraformerConfig.emotion_enabled}
                onChange={(checked) => updateParaformerConfig({ emotion_enabled: checked })}
              />
              <Text>启用情感识别（部分模型支持）</Text>
            </div>
          </div>

          {/* 方言设置 */}
          <div style={{ marginBottom: 16 }}>
            <Text style={{ display: 'block', marginBottom: 4 }}>方言设置（可选）</Text>
            <Input
              value={paraformerConfig.dialect || ''}
              onChange={(event) =>
                updateParaformerConfig({ dialect: event.target.value || undefined })
              }
              placeholder="如：四川话、粤语等"
              allowClear
            />
          </div>

          {/* 热词ID */}
          <div style={{ marginBottom: 16 }}>
            <Text style={{ display: 'block', marginBottom: 4 }}>热词 ID（可选）</Text>
            <Input
              value={paraformerConfig.vocabulary_id || ''}
              onChange={(event) =>
                updateParaformerConfig({ vocabulary_id: event.target.value || undefined })
              }
              placeholder="输入热词ID"
              allowClear
            />
          </div>
        </div>
      )}
    </div>
  )
}

