import { Routes, Route } from 'react-router-dom'
import { AppProvider } from './context/AppContext'
import AppLayout from './layouts/AppLayout'
import OverviewPage from './pages/OverviewPage'
import AudioPage from './pages/AudioPage'
import LogsPage from './pages/LogsPage'

const App = () => {
  return (
    <AppProvider>
      <Routes>
        <Route path="/" element={<AppLayout />}>
          <Route index element={<OverviewPage />} />
          <Route path="audio" element={<AudioPage />} />
          <Route path="logs" element={<LogsPage />} />
        </Route>
      </Routes>
    </AppProvider>
  )
}

export default App


