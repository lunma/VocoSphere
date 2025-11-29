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
