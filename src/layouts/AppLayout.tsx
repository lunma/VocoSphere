import {
  FileText,
  History,
  Settings2,
  PanelLeftClose,
  PanelLeftOpen,
  Volume2,
  Film,
} from 'lucide-react'
import { useMemo, useState } from 'react'
import { Outlet, useLocation, useNavigate } from 'react-router-dom'

import type { ReactNode } from 'react'

type SectionPath = '/' | '/audio' | '/logs' | '/subtitle' | '/video-subtitle'

interface MenuItem {
  path: SectionPath
  label: string
  icon: ReactNode
}

const MENU_ITEMS: MenuItem[] = [
  { path: '/', label: '模型', icon: <Settings2 size={18} /> },
  { path: '/audio', label: '音频源', icon: <Volume2 size={18} /> },
  { path: '/subtitle', label: '字幕', icon: <FileText size={18} /> },
  { path: '/logs', label: '运行日志', icon: <History size={18} /> },
  { path: '/video-subtitle', label: '视频字幕', icon: <Film size={18} /> },
]

const AppLayout = () => {
  const location = useLocation()
  const navigate = useNavigate()
  const [collapsed, setCollapsed] = useState(false)

  const activeKey = useMemo<SectionPath>(() => {
    const match = MENU_ITEMS.find((item) =>
      item.path === '/' ? location.pathname === '/' : location.pathname.startsWith(item.path)
    )
    return match ? match.path : '/'
  }, [location.pathname])

  return (
    <div className="flex h-screen bg-slate-50 font-sans text-slate-900">
      <aside
        className={`${
          collapsed ? 'w-16' : 'w-64'
        } shrink-0 border-r border-slate-200/80 bg-white flex flex-col justify-between`}
      >
        <div>
          <div
            className={`h-16 border-b border-slate-100 ${
              collapsed ? 'flex items-center justify-center px-2' : 'flex items-center px-6'
            }`}
          >
            {collapsed ? (
              <span className="text-base font-bold tracking-tight text-slate-900">VS</span>
            ) : (
              <div className="flex flex-col">
                <span className="text-lg font-bold tracking-tight text-slate-900">VocoSphere</span>
                <span className="text-[11px] font-medium text-slate-500">实时语音识别与翻译</span>
              </div>
            )}
          </div>

          <nav className={`${collapsed ? 'p-2' : 'p-3'} space-y-1`}>
            {MENU_ITEMS.map((item) => {
              const selected = item.path === activeKey

              return (
                <button
                  key={item.path}
                  type="button"
                  aria-current={selected ? 'page' : undefined}
                  onClick={() => {
                    if (location.pathname !== item.path) navigate(item.path)
                  }}
                  className={`w-full rounded-lg text-sm font-medium transition-colors flex items-center ${
                    collapsed ? 'justify-center px-2 py-2' : 'gap-3 px-3 py-2'
                  } border ${
                    selected
                      ? 'bg-blue-50 text-blue-700 border-blue-100/50'
                      : 'border-transparent text-slate-500 hover:bg-slate-50 hover:text-slate-900'
                  }`}
                  title={collapsed ? item.label : undefined}
                >
                  <span className={selected ? 'text-blue-600' : 'text-slate-500/90'}>
                    {item.icon}
                  </span>
                  {!collapsed && item.label}
                </button>
              )
            })}
          </nav>
        </div>

        <div className="p-4 border-t border-slate-100">
          <button
            type="button"
            onClick={() => setCollapsed(!collapsed)}
            className={`w-full rounded-md px-2 py-1.5 text-sm font-medium transition-colors hover:bg-slate-50 text-slate-500 hover:text-slate-900 flex items-center ${
              collapsed ? 'justify-center' : 'gap-2'
            }`}
          >
            {collapsed ? (
              <PanelLeftOpen className="h-4 w-4" />
            ) : (
              <PanelLeftClose className="h-4 w-4" />
            )}
            {!collapsed && '收起'}
          </button>
        </div>
      </aside>

      <div className="flex-1 overflow-y-auto">
        <header className="sticky top-0 z-10 h-16 px-8 flex items-center bg-slate-50/80 backdrop-blur-md border-b border-slate-200/80">
          <h1 className="text-lg font-semibold text-slate-900">
            {MENU_ITEMS.find((item) => item.path === activeKey)?.label}
          </h1>
        </header>

        <main className="bg-slate-50 p-6 md:p-10">
          <div className="w-full">
            <Outlet />
          </div>
        </main>
      </div>
    </div>
  )
}

export default AppLayout
