import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { MemoryRouter, Route, Routes } from 'react-router'
import Login from '../pages/Login'
import { supabase } from '../lib/supabase'

vi.mock('../lib/supabase', () => ({
  supabase: {
    auth: {
      getSession: vi.fn().mockResolvedValue({ data: { session: null }, error: null }),
      onAuthStateChange: vi.fn().mockReturnValue({
        data: { subscription: { unsubscribe: vi.fn() } },
      }),
      signInWithPassword: vi.fn(),
      signUp: vi.fn(),
      resend: vi.fn(),
      resetPasswordForEmail: vi.fn(),
      updateUser: vi.fn(),
    },
  },
}))

function renderLogin() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  })

  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={['/login']}>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route path="/dashboard" element={<div>Dashboard Page</div>} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>
  )
}

describe('Login Component', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('renders login form by default and can switch to signup', async () => {
    const user = userEvent.setup()
    const { container } = renderLogin()

    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('Welcome back')
    expect(container.querySelector('button[type="submit"]')).toHaveTextContent('Sign in')

    // Switch to create account
    const createAccountTab = screen.getAllByRole('button', { name: /create account/i })[0]
    await user.click(createAccountTab)
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('Create your account')
  })

  it('displays Email Confirmation alert and resend button when sign in fails with unconfirmed email', async () => {
    const user = userEvent.setup()
    vi.mocked(supabase.auth.signInWithPassword).mockResolvedValueOnce({
      data: { user: null, session: null },
      error: { name: 'AuthApiError', message: 'Email not confirmed', status: 400 } as any,
    })

    const { container } = renderLogin()

    await user.type(screen.getByPlaceholderText('you@example.com'), 'testuser@gmail.com')
    await user.type(screen.getByPlaceholderText('At least 8 characters'), 'Password123!')
    const submitBtn = container.querySelector('button[type="submit"]')!
    await user.click(submitBtn)

    await waitFor(() => {
      expect(screen.getByText('Email Confirmation Required')).toBeInTheDocument()
    })
    expect(screen.getByRole('button', { name: /Resend confirmation email/i })).toBeInTheDocument()
  })

  it('successfully resends confirmation email when button is clicked', async () => {
    const user = userEvent.setup()
    vi.mocked(supabase.auth.signInWithPassword).mockResolvedValueOnce({
      data: { user: null, session: null },
      error: { name: 'AuthApiError', message: 'Email not confirmed', status: 400 } as any,
    })
    vi.mocked(supabase.auth.resend).mockResolvedValueOnce({
      data: { user: null, session: null },
      error: null,
    })

    const { container } = renderLogin()

    await user.type(screen.getByPlaceholderText('you@example.com'), 'testuser@gmail.com')
    await user.type(screen.getByPlaceholderText('At least 8 characters'), 'Password123!')
    const submitBtn = container.querySelector('button[type="submit"]')!
    await user.click(submitBtn)

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /Resend confirmation email/i })).toBeInTheDocument()
    })

    await user.click(screen.getByRole('button', { name: /Resend confirmation email/i }))

    await waitFor(() => {
      expect(supabase.auth.resend).toHaveBeenCalledWith({
        type: 'signup',
        email: 'testuser@gmail.com',
      })
      expect(screen.getByText(/Confirmation email resent to testuser@gmail\.com/i)).toBeInTheDocument()
    })
  })

  it('redirects to dashboard upon successful sign in', async () => {
    const user = userEvent.setup()
    vi.mocked(supabase.auth.signInWithPassword).mockResolvedValueOnce({
      data: {
        session: { access_token: 'valid-token', user: { id: 'user-1', email: 'test@example.com' } } as any,
        user: { id: 'user-1', email: 'test@example.com' } as any,
      },
      error: null,
    })

    const { container } = renderLogin()

    await user.type(screen.getByPlaceholderText('you@example.com'), 'test@example.com')
    await user.type(screen.getByPlaceholderText('At least 8 characters'), 'Password123!')
    const submitBtn = container.querySelector('button[type="submit"]')!
    await user.click(submitBtn)

    await waitFor(() => {
      expect(screen.getByText('Dashboard Page')).toBeInTheDocument()
    })
  })
})
