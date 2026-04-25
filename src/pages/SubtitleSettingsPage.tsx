import CustomSelect from '@/components/CustomSelect'
import { useSubtitleSettings } from '@/hooks/useSubtitleSettings'

import type { SubtitleSettings } from '@/store/subtitleSettingsStore'

const FONT_FAMILIES = [
  { label: '无衬线（Arial）', value: 'Arial, Helvetica, sans-serif' },
  { label: '衬线（Times New Roman）', value: "'Times New Roman', Times, serif" },
  { label: '休闲体（Trebuchet MS）', value: "'Trebuchet MS', 'Comic Sans MS', cursive" },
  { label: '中文黑体', value: "'PingFang SC', 'Hiragino Sans GB', 'Microsoft YaHei', sans-serif" },
  { label: '中文宋体', value: "'STSong', 'Songti SC', 'SimSun', serif" },
]

const inputCls =
  'w-full pl-3 pr-3 py-2.5 bg-slate-50/50 border border-slate-200 rounded-xl text-sm text-slate-800 shadow-sm hover:border-slate-300 focus:bg-white focus:outline-none focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500 transition-all disabled:opacity-60 disabled:cursor-not-allowed'

const SELECT_OPTIONS = {
  stylePreset: [
    { label: 'Apple / 现代 SaaS', value: 'apple' },
    { label: 'Netflix / 影视级纯净', value: 'netflix' },
    { label: 'YouTube / 经典流媒体', value: 'youtube' },
  ],
  fontWeight: [
    { label: '正常', value: 'normal' },
    { label: '粗体', value: 'bold' },
  ],
  fontStyle: [
    { label: '正常', value: 'normal' },
    { label: '斜体', value: 'italic' },
  ],
  borderRadius: [
    { label: '矩形', value: 'none' },
    { label: '小圆角', value: 'small' },
    { label: '圆角', value: 'medium' },
    { label: '胶囊形', value: 'pill' },
  ],
}

const SubtitleSettingsPage = () => {
  const { updateSetting, resetSettings, ...settings } = useSubtitleSettings()
  const enabled = settings.enabled

  return (
    <div className="w-full max-w-5xl mx-auto space-y-6">
      <section className="overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-[0_2px_12px_rgba(15,23,42,0.03)]">
        <div className="border-b border-slate-100 px-6 py-5">
          <h2 className="text-base font-semibold text-slate-900">字幕设置</h2>
          <p className="mt-1 text-sm text-slate-500">
            配置字幕样式与字体。字幕位置可在屏幕上直接拖动调整。
          </p>
        </div>

        <div className="space-y-6 px-6 py-6">
          <div className="flex items-center justify-between gap-4">
            <div>
              <div className="text-sm font-medium text-slate-700">启用字幕</div>
              <div className="text-xs text-slate-500">
                {enabled ? '字幕功能已启用' : '字幕功能已禁用'}
              </div>
            </div>
            <button
              type="button"
              onClick={() => updateSetting('enabled', !settings.enabled)}
              className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors focus:outline-none focus:ring-4 focus:ring-blue-500/10 ${
                settings.enabled ? 'bg-blue-600' : 'bg-slate-200'
              }`}
            >
              <span
                className={`inline-block h-4 w-4 transform rounded-full bg-white shadow-sm transition-transform ${
                  settings.enabled ? 'translate-x-4' : 'translate-x-1'
                }`}
              />
            </button>
          </div>

          <div className="flex items-center justify-between gap-4">
            <div>
              <div className="text-sm font-medium text-slate-700">位置锁定</div>
              <div className="text-xs text-slate-500">
                {settings.locked
                  ? '已锁定 — 鼠标穿透，不影响其他窗口操作'
                  : '已解锁 — 可拖动字幕到屏幕任意位置'}
              </div>
            </div>
            <button
              type="button"
              onClick={() => updateSetting('locked', !settings.locked)}
              disabled={!enabled}
              className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors focus:outline-none focus:ring-4 focus:ring-blue-500/10 disabled:opacity-50 disabled:cursor-not-allowed ${
                settings.locked ? 'bg-blue-600' : 'bg-slate-200'
              }`}
            >
              <span
                className={`inline-block h-4 w-4 transform rounded-full bg-white shadow-sm transition-transform ${
                  settings.locked ? 'translate-x-4' : 'translate-x-1'
                }`}
              />
            </button>
          </div>

          <div className="flex items-center justify-between gap-4">
            <div>
              <div className="text-sm font-medium text-slate-700">流式字幕</div>
              <div className="text-xs text-slate-500">
                实时显示识别过程中的文字，包含回撤修正效果
              </div>
            </div>
            <button
              type="button"
              onClick={() => updateSetting('streamingSubtitles', !settings.streamingSubtitles)}
              disabled={!enabled}
              className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors focus:outline-none focus:ring-4 focus:ring-blue-500/10 disabled:opacity-50 disabled:cursor-not-allowed ${
                settings.streamingSubtitles ? 'bg-blue-600' : 'bg-slate-200'
              }`}
            >
              <span
                className={`inline-block h-4 w-4 transform rounded-full bg-white shadow-sm transition-transform ${
                  settings.streamingSubtitles ? 'translate-x-4' : 'translate-x-1'
                }`}
              />
            </button>
          </div>

          <div className="h-px bg-gradient-to-r from-transparent via-slate-100 to-transparent" />

          <div>
            <label className="mb-1.5 block text-sm font-medium text-slate-600">内置样式</label>
            <CustomSelect
              value={settings.stylePreset}
              onChange={(v) => updateSetting('stylePreset', v as SubtitleSettings['stylePreset'])}
              disabled={!enabled}
              options={SELECT_OPTIONS.stylePreset}
            />
          </div>

          <div className="grid gap-5 md:grid-cols-2">
            <div>
              <label className="mb-1.5 block text-sm font-medium text-slate-600">字体大小</label>
              <input
                type="number"
                value={settings.fontSize}
                min={12}
                max={72}
                onChange={(e) => updateSetting('fontSize', Number(e.target.value))}
                disabled={!enabled}
                className={inputCls}
              />
            </div>

            <div>
              <label className="mb-1.5 block text-sm font-medium text-slate-600">字体</label>
              <CustomSelect
                value={settings.fontFamily}
                onChange={(v) => updateSetting('fontFamily', v)}
                disabled={!enabled}
                options={FONT_FAMILIES}
              />
            </div>

            <div>
              <label className="mb-1.5 block text-sm font-medium text-slate-600">字体粗细</label>
              <CustomSelect
                value={settings.fontWeight}
                onChange={(v) => updateSetting('fontWeight', v as SubtitleSettings['fontWeight'])}
                disabled={!enabled}
                options={SELECT_OPTIONS.fontWeight}
              />
            </div>

            <div>
              <label className="mb-1.5 block text-sm font-medium text-slate-600">字体风格</label>
              <CustomSelect
                value={settings.fontStyle}
                onChange={(v) => updateSetting('fontStyle', v as SubtitleSettings['fontStyle'])}
                disabled={!enabled}
                options={SELECT_OPTIONS.fontStyle}
              />
            </div>

            <div>
              <label className="mb-1.5 block text-sm font-medium text-slate-600">边角形状</label>
              <CustomSelect
                value={settings.borderRadius}
                onChange={(v) =>
                  updateSetting('borderRadius', v as SubtitleSettings['borderRadius'])
                }
                disabled={!enabled}
                options={SELECT_OPTIONS.borderRadius}
              />
            </div>
          </div>

          <div>
            <label className="mb-1.5 block text-sm font-medium text-slate-600">
              背景透明度：{settings.backgroundOpacity}%
            </label>
            <input
              type="range"
              min={0}
              max={100}
              value={settings.backgroundOpacity}
              onChange={(e) => updateSetting('backgroundOpacity', Number(e.target.value))}
              disabled={!enabled}
              className="w-full accent-blue-600 disabled:opacity-50"
            />
          </div>
        </div>

        <div className="flex justify-end gap-3 border-t border-slate-100 bg-slate-50/50 px-6 py-4">
          <button
            type="button"
            onClick={resetSettings}
            className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-600 shadow-sm transition-all hover:bg-slate-50 hover:text-slate-900"
          >
            恢复默认
          </button>
        </div>
      </section>
    </div>
  )
}

export default SubtitleSettingsPage
