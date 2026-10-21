import { Navigate, Outlet, useLocation } from 'react-router'
import { useAuth } from '../hooks/useAuth'
import { FullPageLoader } from './FullPageLoader'

export function ProtectedRoute() {
  const { session, isPending } = useAuth()
  const location = useLocation()

  if (isPending) return <FullPageLoader />

  if (!session) {
    return <Navigate to="/login" replace state={{ from: location.pathname }} />
  }

  return <Outlet />
}
