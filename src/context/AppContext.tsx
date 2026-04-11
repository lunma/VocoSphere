// 原有 Context 已迁移至 Zustand stores：
//   src/store/environmentStore.ts  →  useEnvironmentStore
//   src/store/asrStore.ts          →  useAsrStore
//   src/store/logsStore.ts         →  useLogsStore
//
// 保留类型重导出以兼容尚未迁移的引用。

export type { AsrResultMessage, AudioDevice } from '@/store/asrStore'
export type { LogMessage } from '@/store/logsStore'
