import { Card, Space, Typography, Alert, Input, Button, theme, Tabs, Switch, Select } from 'antd'
import { useState, useEffect } from 'react'

import { useAsr } from '../context/AppContext'

import type { AsrModelConfig, GummyConfig, ParaformerConfig, ServerConfig } from '../types/asr'
import type { TabsProps } from 'antd'

const DEFAULT_SERVER_CONFIG: ServerConfig = {
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

const STORAGE_KEY = 'asr_model_config'

const ModelConfigPage = () => {
  const { token } = theme.useToken()
  const { Title, Text } = Typography
  const { setAsrConfig } = useAsr()
  const isDev = import.meta.env.DEV
  const [name, setName] = useState<string>('')
  const [greeting, setGreeting] = useState<string>('')
  const [modelType, setModelType] = useState<'gummy' | 'paraformer'>('gummy')
  const [gummyConfig, setGummyConfig] = useState<GummyConfig>(DEFAULT_GUMMY_CONFIG)
  const [paraformerConfig, setParaformerConfig] =
    useState<ParaformerConfig>(DEFAULT_PARAFORMER_CONFIG)

  useEffect(() => {
    try {
      const savedConfig = localStorage.getItem(STORAGE_KEY)
      if (savedConfig) {
        const storedConfig = JSON.parse(savedConfig) as Partial<AsrModelConfig>

        if (storedConfig.type === 'gummy') {
          const gummyConf: GummyConfig = {
            ...DEFAULT_GUMMY_CONFIG,
            ...storedConfig,
            server_config: storedConfig.server_config || DEFAULT_SERVER_CONFIG,
          }
          setModelType('gummy')
          setGummyConfig(gummyConf)
          setAsrConfig(gummyConf)
        } else if (storedConfig.type === 'paraformer') {
          const paraformerConf: ParaformerConfig = {
            ...DEFAULT_PARAFORMER_CONFIG,
            ...storedConfig,
            server_config: storedConfig.server_config || DEFAULT_SERVER_CONFIG,
          }
          setModelType('paraformer')
          setParaformerConfig(paraformerConf)
          setAsrConfig(paraformerConf)
        } else {
          console.warn('配置格式不正确，使用默认配置')
          setAsrConfig(DEFAULT_GUMMY_CONFIG)
        }
      } else {
        setAsrConfig(DEFAULT_GUMMY_CONFIG)
      }
    } catch (error) {
      console.error('加载配置失败:', error)
      localStorage.removeItem(STORAGE_KEY)
      setAsrConfig(DEFAULT_GUMMY_CONFIG)
    }
  }, [setAsrConfig])

  const saveConfig = (config: AsrModelConfig) => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(config))
      setAsrConfig(config)
    } catch (error) {
      console.error('保存配置失败:', error)
    }
  }

  const handleModelTypeChange = (type: 'gummy' | 'paraformer') => {
    setModelType(type)
    const config = type === 'gummy' ? gummyConfig : paraformerConfig
    saveConfig(config)
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

  const handleGreet = () => {
    setGreeting(`你好，${name}!`)
  }

  const tabItems: TabsProps['items'] = [
    {
      key: 'gummy',
      label: 'Gummy（支持翻译）',
      children: (
        <div
          style={{
            backgroundColor: token.colorBgContainer,
            padding: 16,
            borderRadius: token.borderRadiusLG,
            border: `1px solid ${token.colorBorderSecondary}`,
          }}
        >
          <div style={{ marginBottom: 24 }}>
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

            <div>
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

          <div style={{ marginBottom: 16 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <Switch
                checked={gummyConfig.translation_enabled}
                onChange={(checked) => updateGummyConfig({ translation_enabled: checked })}
              />
              <Text>启用翻译功能</Text>
            </div>
          </div>

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

          <div style={{ marginBottom: 16 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <Switch
                checked={gummyConfig.itn_enabled}
                onChange={(checked) => updateGummyConfig({ itn_enabled: checked })}
              />
              <Text>启用逆文本正则化（ITN）</Text>
            </div>
          </div>

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
      ),
    },
    {
      key: 'paraformer',
      label: 'Paraformer（高准确率）',
      children: (
        <div
          style={{
            backgroundColor: token.colorBgContainer,
            padding: 16,
            borderRadius: token.borderRadiusLG,
            border: `1px solid ${token.colorBorderSecondary}`,
          }}
        >
          <div style={{ marginBottom: 24 }}>
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
                    server_config: {
                      ...paraformerConfig.server_config,
                      ws_url: event.target.value,
                    },
                  })
                }
                placeholder="wss://dashscope.aliyuncs.com/api-ws/v1/inference/"
                allowClear
              />
            </div>

            <div>
              <Text style={{ display: 'block', marginBottom: 4, fontSize: 13, fontWeight: 500 }}>
                API Key
              </Text>
              <Input.Password
                value={paraformerConfig.server_config.api_key}
                onChange={(event) =>
                  updateParaformerConfig({
                    server_config: {
                      ...paraformerConfig.server_config,
                      api_key: event.target.value,
                    },
                  })
                }
                placeholder="sk-xxxxxxxxxxxxxxxx"
                autoComplete="off"
              />
            </div>
          </div>

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

          <div style={{ marginBottom: 16 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <Switch
                checked={paraformerConfig.itn_enabled}
                onChange={(checked) => updateParaformerConfig({ itn_enabled: checked })}
              />
              <Text>启用逆文本正则化（ITN）</Text>
            </div>
          </div>

          <div style={{ marginBottom: 16 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <Switch
                checked={paraformerConfig.emotion_enabled}
                onChange={(checked) => updateParaformerConfig({ emotion_enabled: checked })}
              />
              <Text>启用情感识别（部分模型支持）</Text>
            </div>
          </div>

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
      ),
    },
  ]

  return (
    <Space direction="vertical" size={24} style={{ width: '100%' }}>
      <div
        style={{
          padding: 24,
          backgroundColor: token.colorBgContainer,
          borderRadius: token.borderRadiusLG,
          marginBottom: 24,
          border: `1px solid ${token.colorBorderSecondary}`,
        }}
      >
        <Title level={4} style={{ marginTop: 0, marginBottom: 16 }}>
          ASR 模型配置
        </Title>

        <Tabs
          activeKey={modelType}
          onChange={(key) => handleModelTypeChange(key as 'gummy' | 'paraformer')}
          items={tabItems}
        />
      </div>

      {isDev && (
        <Card title="快速测试" variant="borderless">
          <Space direction="vertical" size={16} style={{ width: '100%' }}>
            <Space size={12} wrap>
              <Input
                value={name}
                placeholder="请输入名字"
                onChange={(e) => setName(e.target.value)}
                style={{ minWidth: 220 }}
              />
              <Button type="primary" onClick={handleGreet}>
                调用 Rust
              </Button>
            </Space>
            {greeting && <Alert type="info" showIcon message={<Text>{greeting}</Text>} />}
          </Space>
        </Card>
      )}
    </Space>
  )
}

export default ModelConfigPage
