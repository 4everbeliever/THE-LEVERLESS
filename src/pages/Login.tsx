import { zodResolver } from '@hookform/resolvers/zod'
import { AlertCircle, ArrowRight, CheckCircle2, Eye, EyeOff, LockKeyhole, Mail, Send } from 'lucide-react'
import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { Navigate, useLocation, useNavigate } from 'react-router'
import { useQueryClient } from '@tanstack/react-query'
import { z } from 'zod'
import { Brand } from '../components/Brand'
import { authSessionKey, useAuth } from '../hooks/useAuth'
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
  const [isResending, setIsResending] = useState(false)
  const [isRecoverySession, setIsRecoverySession] = useState(
    () => typeof window !== 'undefined' && window.location.hash.includes('type=recovery')
  )
  const navigate = useNavigate()
  const location = useLocation()
  const queryClient = useQueryClient()
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

  const isEmailUnconfirmed =
    Boolean(authError) &&
    (authError.toLowerCase().includes('email not confirmed') ||
      authError.toLowerCase().includes('not confirmed'))

  const handleResendConfirmation = async () => {
    const emailValue = getValues('email')?.trim().toLowerCase()
    if (!emailValue || !emailValue.includes('@')) {
      setAuthError('Please enter your email address in the field below first.')
      return
    }

    setIsResending(true)
    try {
      const { error } = await supabase.auth.resend({
        type: 'signup',
        email: emailValue,
      })

      if (error) {
        if (error.message.toLowerCase().includes('rate limit')) {
          setAuthError('Supabase email rate limit exceeded. If testing locally, disable "Confirm email" in Supabase Dashboard (Authentication > Providers > Email) or run migration 0004 in the SQL editor.')
        } else {
          setAuthError(error.message)
        }
      } else {
        setSuccessMessage(`Confirmation email resent to ${emailValue}. Please check your inbox and spam folder.`)
        setAuthError('')
      }
    } catch (err) {
      setAuthError(err instanceof Error ? err.message : 'Failed to resend confirmation email.')
    } finally {
      setIsResending(false)
    }
  }

  const onResetPassword = async (e: React.FormEvent) => {
    e.preventDefault()
    setAuthError('')
    setSuccessMessage('')

    const emailValue = getValues('email')?.trim().toLowerCase()
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

    const cleanEmail = values.email.trim().toLowerCase()
    const cleanPassword = values.password

    try {
      if (mode === 'signup') {
        const { data, error } = await supabase.auth.signUp({
          email: cleanEmail,
          password: cleanPassword,
        })

        if (error) {
          if (error.message.toLowerCase().includes('rate limit')) {
            setAuthError('Supabase email rate limit exceeded. In your Supabase Dashboard, go to Authentication > Providers > Email and turn off "Confirm email", or run migration 0004 in the SQL editor.')
          } else {
            setAuthError(error.message)
          }
          return
        }

        // Supabase returns empty identities when email is already registered
        if (data?.user && Array.isArray(data.user.identities) && data.user.identities.length === 0) {
          setAuthError('An account with this email address already exists. Please sign in with your password, or use "Forgot password?" below.')
          setMode('signin')
          return
        }

        if (data?.session) {
          // Immediately set cache so ProtectedRoute does not redirect
          queryClient.setQueryData(authSessionKey, data.session)
          navigate('/dashboard', { replace: true })
        } else {
          setSuccessMessage('Account created successfully! Check your email inbox for the confirmation link if required, then sign in.')
          setMode('signin')
        }
        return
      }

      const { data, error } = await supabase.auth.signInWithPassword({
        email: cleanEmail,
        password: cleanPassword,
      })

      if (error) {
        setAuthError(error.message)
        return
      }

      if (data?.session) {
        // Synchronously update query cache before navigating
        queryClient.setQueryData(authSessionKey, data.session)
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

        {isEmailUnconfirmed ? (
          <div
            className="login-alert"
            role="alert"
            style={{
              background: '#fffbeb',
              border: '1px solid #fde68a',
              color: '#92400e',
              display: 'flex',
              gap: 12,
              alignItems: 'flex-start',
              padding: 14,
              borderRadius: 8,
              marginBottom: 16,
            }}
          >
            <AlertCircle size={18} style={{ color: '#b45309', flexShrink: 0, marginTop: 2 }} />
            <div style={{ flex: 1, minWidth: 0 }}>
              <strong style={{ color: '#92400e', fontSize: 13, fontWeight: 700, display: 'block' }}>
                Email Confirmation Required
              </strong>
              <p style={{ color: '#b45309', fontSize: 12, margin: '4px 0 10px', lineHeight: 1.45 }}>
                Your account was created, but your email address has not been confirmed yet. Please check your inbox (and spam folder) for the confirmation link.
              </p>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center', marginBottom: 8 }}>
                <button
                  type="button"
                  className="button button-secondary"
                  disabled={isResending}
                  onClick={handleResendConfirmation}
                  style={{ fontSize: 11, padding: '5px 12px', height: 'auto', display: 'inline-flex', alignItems: 'center', gap: 6 }}
                >
                  <Send size={12} />
                  <span>{isResending ? 'Sending link…' : 'Resend confirmation email'}</span>
                </button>
              </div>
              <div
                style={{
                  fontSize: 11,
                  color: '#78350f',
                  borderTop: '1px dashed #fcd34d',
                  paddingTop: 8,
                  marginTop: 6,
                  lineHeight: 1.4,
                }}
              >
                🛠️ <strong>Instant fix for local testing:</strong> In your Supabase Dashboard, go to <em>Authentication &gt; Providers &gt; Email</em> and turn off <em>Confirm email</em>, or execute <code>supabase/migrations/0004_auto_confirm_and_auth_fixes.sql</code> in the Supabase SQL editor.
              </div>
            </div>
          </div>
        ) : authError ? (
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
        ) : null}

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
