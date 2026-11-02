import { Navigate, Route, Routes } from 'react-router-dom'
import ProtectedRoute from './components/ProtectedRoute'
import Layout from './components/Layout'
import Loading from './components/Loading'
import { homePathFor, useAuth } from './hooks/useAuth'
import Login from './pages/Login'
import Register from './pages/Register'
import OwnerDashboard from './pages/OwnerDashboard'
import FamilyDashboard from './pages/FamilyDashboard'
import InsuranceDashboard from './pages/InsuranceDashboard'
import AdminDashboard from './pages/AdminDashboard'
import AccidentHistory from './pages/AccidentHistory'
import AccidentDetails from './pages/AccidentDetails'
import VehicleManagement from './pages/VehicleManagement'
import ClaimManagement from './pages/ClaimManagement'
import Notifications from './pages/Notifications'
import Profile from './pages/Profile'
import NotFound from './pages/NotFound'

function Home() {
  const { user, loading } = useAuth()
  if (loading) return <Loading />
  return <Navigate to={user ? homePathFor(user.role) : '/login'} replace />
}

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<Home />} />
      <Route path="/login" element={<Login />} />
      <Route path="/register" element={<Register />} />
      <Route element={<ProtectedRoute />}>
        <Route element={<Layout />}>
          <Route element={<ProtectedRoute roles={['OWNER']} />}><Route path="/owner" element={<OwnerDashboard />} /></Route>
          <Route element={<ProtectedRoute roles={['FAMILY']} />}><Route path="/family" element={<FamilyDashboard />} /></Route>
          <Route element={<ProtectedRoute roles={['INSURANCE']} />}><Route path="/insurance" element={<InsuranceDashboard />} /></Route>
          <Route element={<ProtectedRoute roles={['ADMIN']} />}><Route path="/admin" element={<AdminDashboard />} /></Route>
          <Route path="/accidents" element={<AccidentHistory />} />
          <Route path="/accidents/:accidentId" element={<AccidentDetails />} />
          <Route element={<ProtectedRoute roles={['OWNER', 'ADMIN']} />}><Route path="/vehicles" element={<VehicleManagement />} /></Route>
          <Route path="/vehicles/:vehicleId" element={<VehicleManagement />} />
          <Route element={<ProtectedRoute roles={['OWNER', 'INSURANCE', 'ADMIN']} />}>
            <Route path="/claims" element={<ClaimManagement />} />
            <Route path="/claims/:claimId" element={<ClaimManagement />} />
          </Route>
          <Route path="/notifications" element={<Notifications />} />
          <Route path="/profile" element={<Profile />} />
        </Route>
      </Route>
      <Route path="*" element={<NotFound />} />
    </Routes>
  )
}
