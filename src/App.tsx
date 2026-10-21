import { createBrowserRouter } from 'react-router'
import { ProtectedRoute } from './components/ProtectedRoute'
import Dashboard from './pages/Dashboard'
import Home from './pages/Home'
import Login from './pages/Login'
import NotFound from './pages/NotFound'

export const router = createBrowserRouter([
  {
    path: '/',
    Component: Home,
  },
  {
    path: '/login',
    Component: Login,
  },
  {
    element: <ProtectedRoute />,
    children: [
      {
        path: '/dashboard',
        Component: Dashboard,
      },
    ],
  },
  {
    path: '*',
    Component: NotFound,
  },
])
