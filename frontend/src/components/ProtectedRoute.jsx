import { Navigate, Outlet, useLocation } from 'react-router-dom'
import { homePathFor, useAuth } from '../hooks/useAuth'
import Loading from './Loading'

/** UI-level guard only. The API enforces the real permissions. */
export default function ProtectedRoute({ roles }) {
  const { user, loading } = useAuth()
  const loc = useLocation()
  if (loading) return <Loading />
  if (!user) return <Navigate to="/login" state={{ from: loc }} replace />
  if (roles && !roles.includes(user.role)) return <Navigate to={homePathFor(user.role)} replace />
  return <Outlet />
}
