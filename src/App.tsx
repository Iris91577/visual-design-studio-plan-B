import { BrowserRouter, Route, Routes, useParams } from 'react-router-dom'
import { ToastProvider } from './components/ui'
import { Landing } from './pages/Landing'
import { ParticipantEntry, ResearcherPreview } from './pages/Participant'
import { AdminLayout, AdminLogin, RequireResearcher } from './pages/admin/AdminLayout'
import { ExperimentsPage } from './pages/admin/Experiments'
import { ExperimentEditor } from './pages/admin/ExperimentEditor'
import { SessionsPage } from './pages/admin/Sessions'
import { SessionDetail } from './pages/admin/SessionDetail'

function KeyedExperimentEditor() {
  const { id } = useParams()
  return <ExperimentEditor key={id} />
}

export default function App() {
  return (
    <ToastProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<Landing />} />
          {/* Participant study link — condition is fixed by the link code */}
          <Route path="/s/:code" element={<ParticipantEntry />} />
          {/* Researcher previews of each condition */}
          <Route path="/demo/:condition" element={<ResearcherPreview />} />
          <Route path="/admin/login" element={<AdminLogin />} />
          <Route path="/admin" element={<RequireResearcher><AdminLayout /></RequireResearcher>}>
            <Route index element={<ExperimentsPage />} />
            <Route path="experiments/:id" element={<KeyedExperimentEditor />} />
            <Route path="sessions" element={<SessionsPage />} />
            <Route path="sessions/:id" element={<SessionDetail />} />
          </Route>
          <Route path="*" element={<Landing />} />
        </Routes>
      </BrowserRouter>
    </ToastProvider>
  )
}
