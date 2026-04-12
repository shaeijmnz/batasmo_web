import { Navigate, Route, Routes } from 'react-router-dom'
import Dashboard from './assets/admindashboard/dashboard'
import Clients from './assets/admindashboard/clients'
import Attorneys from './assets/admindashboard/attorneys'
import Requests from './assets/admindashboard/requests'
import Consultations from './assets/admindashboard/consultations'
import Reports from './assets/admindashboard/reports'
import Settings from './assets/admindashboard/settings'
import './assets/admindashboard/theme.css'

function App() {
  return (
    <Routes>
      <Route path="/" element={<Dashboard />} />
      <Route path="/clients" element={<Clients />} />
      <Route path="/attorneys" element={<Attorneys />} />
      <Route path="/requests" element={<Requests />} />
      <Route path="/consultations" element={<Consultations />} />
      <Route path="/reports" element={<Reports />} />
      <Route path="/settings" element={<Settings />} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}

export default App
