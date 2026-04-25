import { invoke } from '@tauri-apps/api/core'
import { save } from '@tauri-apps/plugin-dialog'
import { Download, History } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { toast } from 'sonner'

import CustomSelect from '@/components/CustomSelect'
import { useEnvironmentStore } from '@/store/environmentStore'
import { useLogsStore, getLogBgColor, type LogMessage } from '@/store/logsStore'

const LogsPage = () => {
  const { logs, clearLogs } = useLogsStore()
  const isTauriEnv = useEnvironmentStore((s) => s.isTauriEnv)

  const logsContainerRef = useRef<HTMLDivElement>(null)
  const [autoScroll, setAutoScroll] = useState(true)

  useEffect(() => {
    if (!autoScroll || logs.length === 0) return
    const container = logsContainerRef.current
    if (!container) return
    requestAnimationFrame(() => {
      container.scrollTo({ top: container.scrollHeight, behavior: 'smooth' })
    })
  }, [logs, autoScroll])

  const handleTestLogs = async () => {
    if (!isTauriEnv) return
    try {
      await invoke<string>('test_logs')
      toast.success('已发送测试日志')
    } catch (error) {
      console.error('测试日志失败:', error)
      toast.error('测试日志失败')
    }
  }

  const handleExportLogs = async () => {
    if (!isTauriEnv || logs.length === 0) return
    try {
      const path = await save({
        filters: [{ name: '日志文件', extensions: ['txt', 'log'] }],
        defaultPath: `vocosphere_logs_${new Date().toISOString().slice(0, 10)}.txt`,
      })
      if (!path) return

      const content = logs
        .map((log) => `[${log.timestamp}] [${log.level}] [${log.target}] ${log.message}`)
        .join('\n')

      await invoke('write_text_file', { path, content })
      toast.success(`日志已导出：${path}`)
    } catch (error) {
      toast.error(`导出失败：${String(error)}`)
    }
  }

  const [levelFilter, setLevelFilter] = useState('ALL')
  const filteredLogs =
    levelFilter === 'ALL' ? logs : logs.filter((log) => log.level === levelFilter)

  const levelOptions = [
    { label: '全部日志', value: 'ALL' },
    { label: 'DEBUG', value: 'DEBUG' },
    { label: 'INFO', value: 'INFO' },
    { label: 'WARN', value: 'WARN' },
    { label: 'ERROR', value: 'ERROR' },
  ]

  const levelClass = (level: string) => {
    if (level === 'ERROR') return 'border-rose-200 bg-rose-50 text-rose-700'
    if (level === 'WARN') return 'border-amber-200 bg-amber-50 text-amber-700'
    if (level === 'INFO') return 'border-blue-200 bg-blue-50 text-blue-700'
    return 'border-slate-200 bg-slate-50 text-slate-600'
  }

  return (
    <div className="w-full max-w-7xl mx-auto">
      <section className="overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-[0_2px_12px_rgba(15,23,42,0.03)]">
        <div className="border-b border-slate-100 px-6 py-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <History className="h-5 w-5 text-blue-500" />
              <h2 className="text-base font-semibold text-slate-900">运行日志</h2>
              <span className="rounded-lg border border-slate-200/80 bg-slate-50 px-2 py-0.5 text-xs font-semibold text-slate-700">
                {logs.length}
              </span>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={handleTestLogs}
                className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-600 shadow-sm transition-all hover:bg-slate-50 hover:text-slate-900"
              >
                发送测试日志
              </button>
              <button
                type="button"
                onClick={() => setAutoScroll((v) => !v)}
                className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-600 shadow-sm transition-all hover:bg-slate-50 hover:text-slate-900"
              >
                {autoScroll ? '关闭自动滚动' : '开启自动滚动'}
              </button>
              <button
                type="button"
                onClick={handleExportLogs}
                disabled={logs.length === 0 || !isTauriEnv}
                className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-600 shadow-sm transition-all hover:bg-slate-50 hover:text-slate-900 disabled:opacity-40 disabled:cursor-not-allowed"
              >
                <Download size={14} />
                导出日志
              </button>
              <button
                type="button"
                onClick={clearLogs}
                className="rounded-xl bg-blue-600 px-3 py-2 text-sm font-medium text-white shadow-[0_4px_12px_rgba(37,99,235,0.25)] hover:shadow-[0_6px_16px_rgba(37,99,235,0.35)] active:translate-y-[1px] transition-all"
              >
                清空日志
              </button>
            </div>
          </div>
        </div>

        <div className="space-y-4 px-6 py-5">
          <div className="max-w-xs">
            <CustomSelect
              value={levelFilter}
              onChange={setLevelFilter}
              options={levelOptions}
              disabled={logs.length === 0}
            />
          </div>

          <div
            ref={logsContainerRef}
            className="max-h-[32rem] overflow-y-auto rounded-xl border border-slate-200/80 bg-slate-50/40 p-2"
          >
            {filteredLogs.length === 0 ? (
              <div className="py-10 text-center text-sm text-slate-500">暂无日志</div>
            ) : (
              <div className="space-y-2">
                {filteredLogs.map((log: LogMessage, index: number) => (
                  <article
                    key={`${log.timestamp}-${index}`}
                    className="rounded-xl border border-slate-200/80 bg-white px-4 py-3"
                    style={{ backgroundColor: getLogBgColor(log.level) }}
                  >
                    <div className="mb-2 flex flex-wrap items-center gap-2 text-xs text-slate-500">
                      <span
                        className={`inline-flex items-center rounded-lg border px-2 py-0.5 font-semibold ${levelClass(log.level)}`}
                      >
                        {log.level}
                      </span>
                      <span>{log.timestamp}</span>
                      <span>{log.target}</span>
                    </div>
                    <p className="text-sm text-slate-900">{log.message}</p>
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

export default LogsPage
