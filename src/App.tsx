import { useEffect } from 'react'
import { Routes, Route } from 'react-router-dom'
import { Toaster } from 'sonner'

import { useAsrListener, useLogsListener } from './hooks/useTauriListeners'
import AppLayout from './layouts/AppLayout'
import AudioSourceSettingsPage from './pages/AudioSourceSettingsPage'
import LogsPage from './pages/LogsPage'
import ModelConfigPage from './pages/ModelConfigPage'
import SubtitleSettingsPage from './pages/SubtitleSettingsPage'
import VideoSubtitlePage from './pages/VideoSubtitlePage'
import { useAsrStore } from './store/asrStore'
import { useEnvironmentStore } from './store/environmentStore'

const App = () => {
  useAsrListener()
  useLogsListener()

  const isTauriEnv = useEnvironmentStore((s) => s.isTauriEnv)
  useEffect(() => {
    if (!isTauriEnv) return
    useAsrStore.getState().refreshAudioDevices()
  }, [isTauriEnv])

  return (
    <>
      <Routes>
        <Route path="/" element={<AppLayout />}>
          <Route index element={<ModelConfigPage />} />
          <Route path="audio" element={<AudioSourceSettingsPage />} />
          <Route path="subtitle" element={<SubtitleSettingsPage />} />
          <Route path="logs" element={<LogsPage />} />
          <Route path="video-subtitle" element={<VideoSubtitlePage />} />
        </Route>
      </Routes>
      <Toaster position="top-right" />
    </>
  )
}

export default App
