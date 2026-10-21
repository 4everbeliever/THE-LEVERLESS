import { Navigate } from 'react-router'
import { FullPageLoader } from '../components/FullPageLoader'
import { useAuth } from '../hooks/useAuth'

export default function Home() {
  const { session, isPending } = useAuth()

  if (isPending) return <FullPageLoader />

  return <Navigate to={session ? '/dashboard' : '/login'} replace />
}
