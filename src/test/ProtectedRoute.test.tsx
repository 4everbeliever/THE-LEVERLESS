import { render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { MemoryRouter, Route, Routes } from 'react-router'
import { ProtectedRoute } from '../components/ProtectedRoute'
import * as useAuthModule from '../hooks/useAuth'

vi.mock('../hooks/useAuth')

describe('ProtectedRoute', () => {
  it('shows loading indicator when session is pending', () => {
    vi.spyOn(useAuthModule, 'useAuth').mockReturnValue({
      session: null,
      user: null,
      isPending: true,
      error: null,
    } as any)

    render(
      <MemoryRouter initialEntries={['/dashboard']}>
        <Routes>
          <Route element={<ProtectedRoute />}>
            <Route path="/dashboard" element={<div>Protected Dashboard Content</div>} />
          </Route>
        </Routes>
      </MemoryRouter>
    )

    expect(screen.queryByText('Protected Dashboard Content')).not.toBeInTheDocument()
    expect(screen.getByRole('status', { hidden: true })).toBeInTheDocument()
  })

  it('redirects to /login when user is not authenticated', () => {
    vi.spyOn(useAuthModule, 'useAuth').mockReturnValue({
      session: null,
      user: null,
      isPending: false,
      error: null,
    } as any)

    render(
      <MemoryRouter initialEntries={['/dashboard']}>
        <Routes>
          <Route path="/login" element={<div>Login Page</div>} />
          <Route element={<ProtectedRoute />}>
            <Route path="/dashboard" element={<div>Protected Dashboard Content</div>} />
          </Route>
        </Routes>
      </MemoryRouter>
    )

    expect(screen.queryByText('Protected Dashboard Content')).not.toBeInTheDocument()
    expect(screen.getByText('Login Page')).toBeInTheDocument()
  })

  it('renders child routes when user is authenticated', () => {
    vi.spyOn(useAuthModule, 'useAuth').mockReturnValue({
      session: { user: { id: 'user-123', email: 'customer@example.com' } } as any,
      user: { id: 'user-123', email: 'customer@example.com' } as any,
      isPending: false,
      error: null,
    } as any)

    render(
      <MemoryRouter initialEntries={['/dashboard']}>
        <Routes>
          <Route element={<ProtectedRoute />}>
            <Route path="/dashboard" element={<div>Protected Dashboard Content</div>} />
          </Route>
        </Routes>
      </MemoryRouter>
    )

    expect(screen.getByText('Protected Dashboard Content')).toBeInTheDocument()
  })
})
