export interface ServerConfig {
  ws_url: string
  api_key: string
}

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

export type AsrProvider = 'local' | 'cloud'

export interface LocalModelConfig {
  model_path: string
  language: string
  n_threads: number
}

export interface LocalConfig {
  recognition: LocalModelConfig
  translation: LocalModelConfig
}

export interface OssConfig {
  oss_endpoint: string
  oss_bucket: string
  oss_key_id: string
  oss_key_secret: string
}

export interface AsrFullConfig {
  /** 实时采集·语音识别 使用的推理方式 */
  realtimeRecProvider: AsrProvider
  /** 实时采集·语音翻译 使用的推理方式 */
  realtimeTransProvider: AsrProvider
  /** 文件识别·语音识别 使用的推理方式 */
  fileRecProvider: AsrProvider
  /** 文件识别·语音翻译 使用的推理方式 */
  fileTransProvider: AsrProvider
  local: LocalConfig
  cloud: {
    /** 语音识别模型：Gummy（translation_enabled 固定 false）或 Paraformer */
    recognition: AsrModelConfig
    /** 语音翻译模型：Gummy（translation_enabled 固定 true） */
    translation: GummyConfig
    /** 文件识别 OSS 配置 */
    oss: OssConfig
  }
}
