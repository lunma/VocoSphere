import { Routes, Route } from 'react-router-dom'

import { AppProvider } from './context/AppContext'
import AppLayout from './layouts/AppLayout'
import AudioCapturePage from './pages/AudioCapturePage'
import LogsPage from './pages/LogsPage'
import ModelConfigPage from './pages/ModelConfigPage'

const App = () => {
  return (
    <AppProvider>
      <Routes>
        <Route path="/" element={<AppLayout />}>
          <Route index element={<ModelConfigPage />} />
          <Route path="audio" element={<AudioCapturePage />} />
          <Route path="logs" element={<LogsPage />} />
        </Route>
      </Routes>
    </AppProvider>
  )
}

export default App
