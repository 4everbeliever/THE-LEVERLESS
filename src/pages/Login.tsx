import { zodResolver } from '@hookform/resolvers/zod'
import { AlertCircle, ArrowRight, CheckCircle2, Eye, EyeOff, LockKeyhole, Mail } from 'lucide-react'
import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { Navigate, useLocation, useNavigate } from 'react-router'
import { z } from 'zod'
import { Brand } from '../components/Brand'
import { useAuth } from '../hooks/useAuth'
import { supabase } from '../lib/supabase'
import type { LoginFormValues } from '../types/auth'

const loginSchema = z.object({
  email: z.email('Enter a valid email address.'),
  password: z.string().min(8, 'Password must be at least 8 characters.'),
})

type AuthMode = 'signin' | 'signup' | 'reset'

export default function Login() {
  const [mode, setMode] = useState<AuthMode>('signin')
  const [showPassword, setShowPassword] = useState(false)
  const [authError, setAuthError] = useState('')
  const [successMessage, setSuccessMessage] = useState('')
  const [isRecoverySession, setIsRecoverySession] = useState(
    () => typeof window !== 'undefined' && window.location.hash.includes('type=recovery')
  )
  const navigate = useNavigate()
  const location = useLocation()
  const { session, isPending: sessionPending } = useAuth()
  const {
    register,
    handleSubmit,
    getValues,
    formState: { errors, isSubmitting },
  } = useForm<LoginFormValues>({
    resolver: zodResolver(loginSchema),
    defaultValues: { email: '', password: '' },
  })

  if (!sessionPending && session && !isRecoverySession) {
    return <Navigate to="/dashboard" replace />
  }

  const onResetPassword = async (e: React.FormEvent) => {
    e.preventDefault()
    setAuthError('')
    setSuccessMessage('')

    const emailValue = getValues('email')
    if (!emailValue || !emailValue.includes('@')) {
      setAuthError('Please enter a valid email address.')
      return
    }

    const { error } = await supabase.auth.resetPasswordForEmail(emailValue, {
      redirectTo: `${window.location.origin}/login`,
    })

    if (error) {
      setAuthError(error.message)
      return
    }

    setSuccessMessage('Password reset link sent! Please check your email inbox.')
  }

  const onUpdateNewPassword = async (e: React.FormEvent) => {
    e.preventDefault()
    setAuthError('')
    setSuccessMessage('')

    const passwordValue = getValues('password')
    if (!passwordValue || passwordValue.length < 8) {
      setAuthError('Password must be at least 8 characters.')
      return
    }

    const { error } = await supabase.auth.updateUser({ password: passwordValue })
    if (error) {
      setAuthError(error.message)
      return
    }

    setIsRecoverySession(false)
    navigate('/dashboard', { replace: true })
  }

  const onSubmit = async (values: LoginFormValues) => {
    setAuthError('')
    setSuccessMessage('')

    try {
      if (mode === 'signup') {
        const { data, error } = await supabase.auth.signUp({
          email: values.email,
          password: values.password,
        })

        if (error) {
          setAuthError(error.message)
          return
        }

        if (data?.session) {
          navigate('/dashboard', { replace: true })
        } else {
          setSuccessMessage('Account created successfully! Check your email if confirmation is required, then sign in.')
          setMode('signin')
        }
        return
      }

      const { error } = await supabase.auth.signInWithPassword(values)

      if (error) {
        setAuthError(error.message)
        return
      }

      const destination =
        typeof location.state === 'object' &&
        location.state &&
        'from' in location.state &&
        typeof location.state.from === 'string'
          ? location.state.from
          : '/dashboard'

      navigate(destination, { replace: true })
    } catch (error) {
      setAuthError(
        error instanceof DOMException && error.name === 'AbortError'
          ? 'The request timed out while contacting Supabase. Check your connection and try again.'
          : error instanceof Error
            ? error.message
            : 'An unexpected authentication error occurred. Please try again.',
      )
    }
  }

  return (
    <main className="login-page">
      <section className="login-card">
        <div className="login-brand">
          <Brand />
          <span>Tool and equipment rentals across Bohol</span>
        </div>

        {!isRecoverySession && (
          <div className="role-toggle" style={{ width: '100%', marginBottom: 20 }}>
            <button
              type="button"
              className={mode === 'signin' ? 'active' : ''}
              style={{ flex: 1, padding: '9px 12px', fontSize: 12, textAlign: 'center' }}
              onClick={() => {
                setMode('signin')
                setAuthError('')
                setSuccessMessage('')
              }}
            >
              Sign in
            </button>
            <button
              type="button"
              className={mode === 'signup' ? 'active' : ''}
              style={{ flex: 1, padding: '9px 12px', fontSize: 12, textAlign: 'center' }}
              onClick={() => {
                setMode('signup')
                setAuthError('')
                setSuccessMessage('')
              }}
            >
              Create account
            </button>
          </div>
        )}

        <div className="login-heading">
          <span className="eyebrow">
            {isRecoverySession
              ? 'NEW PASSWORD'
              : mode === 'signup'
                ? 'NEW CUSTOMER'
                : mode === 'reset'
                  ? 'PASSWORD RECOVERY'
                  : 'ACCOUNT ACCESS'}
          </span>
          <h1>
            {isRecoverySession
              ? 'Choose new password'
              : mode === 'signup'
                ? 'Create your account'
                : mode === 'reset'
                  ? 'Reset password'
                  : 'Welcome back'}
          </h1>
          <p>
            {isRecoverySession
              ? 'Enter a new password for your Toolshed Rentals account.'
              : mode === 'signup'
                ? 'Register to rent tools and equipment across Bohol.'
                : mode === 'reset'
                  ? 'Enter your email and we’ll send you a password reset link.'
                  : 'Sign in to manage your rentals and bookings.'}
          </p>
        </div>

        {successMessage && (
          <div className="login-alert" role="status" style={{ background: 'var(--green-bg)', borderColor: 'var(--green)' }}>
            <CheckCircle2 size={17} style={{ color: 'var(--green)' }} />
            <div>
              <strong style={{ color: 'var(--green)' }}>Success</strong>
              <span style={{ color: 'var(--green)' }}>{successMessage}</span>
            </div>
          </div>
        )}

        {authError && (
          <div className="login-alert" role="alert">
            <AlertCircle size={17} />
            <div>
              <strong>
                {mode === 'signup'
                  ? 'Registration failed'
                  : mode === 'reset'
                    ? 'Reset failed'
                    : 'We couldn’t sign you in'}
              </strong>
              <span>{authError}</span>
            </div>
          </div>
        )}

        {isRecoverySession ? (
          <form className="login-form" onSubmit={onUpdateNewPassword}>
            <label className="field">
              <span className="field-label">New Password</span>
              <span className="login-input-wrap">
                <LockKeyhole size={16} />
                <input
                  className="input"
                  type={showPassword ? 'text' : 'password'}
                  placeholder="At least 8 characters"
                  {...register('password')}
                />
                <button
                  className="password-toggle"
                  type="button"
                  onClick={() => setShowPassword(v => !v)}
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                >
                  {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </span>
            </label>
            <button className="button button-primary login-submit" type="submit">
              <span>Save new password</span>
              <ArrowRight size={16} />
            </button>
          </form>
        ) : mode === 'reset' ? (
          <form className="login-form" onSubmit={onResetPassword}>
            <label className="field">
              <span className="field-label">Email address</span>
              <span className="login-input-wrap">
                <Mail size={16} />
                <input
                  className="input"
                  type="email"
                  placeholder="you@example.com"
                  {...register('email')}
                />
              </span>
            </label>
            <button className="button button-primary login-submit" type="submit">
              <span>Send reset link</span>
              <ArrowRight size={16} />
            </button>
            <p className="login-help">
              Remember your password?{' '}
              <button
                type="button"
                style={{
                  background: 'none',
                  border: 'none',
                  color: 'var(--orange)',
                  fontWeight: 700,
                  cursor: 'pointer',
                  padding: 0,
                }}
                onClick={() => {
                  setMode('signin')
                  setAuthError('')
                  setSuccessMessage('')
                }}
              >
                Sign in
              </button>
            </p>
          </form>
        ) : (
          <form className="login-form" onSubmit={handleSubmit(onSubmit)} noValidate>
            <label className={`field ${errors.email ? 'field-error' : ''}`}>
              <span className="field-label">Email address</span>
              <span className="login-input-wrap">
                <Mail size={16} />
                <input
                  className="input"
                  type="email"
                  autoComplete="email"
                  placeholder="you@example.com"
                  {...register('email')}
                />
              </span>
              {errors.email && <span className="error-text">{errors.email.message}</span>}
            </label>

            <label className={`field ${errors.password ? 'field-error' : ''}`}>
              <span className="field-label">Password</span>
              <span className="login-input-wrap">
                <LockKeyhole size={16} />
                <input
                  className="input"
                  type={showPassword ? 'text' : 'password'}
                  autoComplete={mode === 'signup' ? 'new-password' : 'current-password'}
                  placeholder="At least 8 characters"
                  {...register('password')}
                />
                <button
                  className="password-toggle"
                  type="button"
                  onClick={() => setShowPassword(value => !value)}
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                >
                  {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </span>
              {errors.password && <span className="error-text">{errors.password.message}</span>}
            </label>

            {mode === 'signin' && (
              <div style={{ textAlign: 'right', marginTop: -6, marginBottom: 2 }}>
                <button
                  type="button"
                  style={{
                    background: 'none',
                    border: 'none',
                    color: 'var(--muted)',
                    fontSize: 11,
                    fontWeight: 600,
                    cursor: 'pointer',
                    padding: 0,
                  }}
                  onClick={() => {
                    setMode('reset')
                    setAuthError('')
                    setSuccessMessage('')
                  }}
                >
                  Forgot password?
                </button>
              </div>
            )}

            <button className="button button-primary login-submit" type="submit" disabled={isSubmitting}>
              <span>
                {isSubmitting
                  ? mode === 'signup'
                    ? 'Creating account…'
                    : 'Signing in…'
                  : mode === 'signup'
                    ? 'Create account'
                    : 'Sign in'}
              </span>
              {!isSubmitting && <ArrowRight size={16} />}
            </button>
          </form>
        )}

        {!isRecoverySession && mode !== 'reset' && (
          <p className="login-help">
            {mode === 'signup' ? (
              <>
                Already have an account?{' '}
                <button
                  type="button"
                  style={{
                    background: 'none',
                    border: 'none',
                    color: 'var(--orange)',
                    fontWeight: 700,
                    cursor: 'pointer',
                    padding: 0,
                  }}
                  onClick={() => {
                    setMode('signin')
                    setAuthError('')
                    setSuccessMessage('')
                  }}
                >
                  Sign in
                </button>
              </>
            ) : (
              <>
                Don’t have an account?{' '}
                <button
                  type="button"
                  style={{
                    background: 'none',
                    border: 'none',
                    color: 'var(--orange)',
                    fontWeight: 700,
                    cursor: 'pointer',
                    padding: 0,
                  }}
                  onClick={() => {
                    setMode('signup')
                    setAuthError('')
                    setSuccessMessage('')
                  }}
                >
                  Create an account
                </button>
              </>
            )}
          </p>
        )}
      </section>

      <aside className="login-aside" aria-hidden="true">
        <div className="login-aside-content">
          <span className="login-aside-mark">TS</span>
          <blockquote>
            “The right tools, right when your project needs them.”
          </blockquote>
          <p>Serving Tagbilaran, Panglao, Tubigon, and communities across Bohol.</p>
        </div>
      </aside>
    </main>
  )
}
