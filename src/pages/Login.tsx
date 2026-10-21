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

export default function Login() {
  const [isSignUp, setIsSignUp] = useState(false)
  const [showPassword, setShowPassword] = useState(false)
  const [authError, setAuthError] = useState('')
  const [successMessage, setSuccessMessage] = useState('')
  const navigate = useNavigate()
  const location = useLocation()
  const { session, isPending: sessionPending } = useAuth()
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<LoginFormValues>({
    resolver: zodResolver(loginSchema),
    defaultValues: { email: '', password: '' },
  })

  if (!sessionPending && session) {
    return <Navigate to="/dashboard" replace />
  }

  const onSubmit = async (values: LoginFormValues) => {
    setAuthError('')
    setSuccessMessage('')

    if (isSignUp) {
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
        setSuccessMessage('Account created successfully! You can now sign in with your credentials.')
        setIsSignUp(false)
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
  }

  return (
    <main className="login-page">
      <section className="login-card">
        <div className="login-brand">
          <Brand />
          <span>Tool and equipment rentals across Bohol</span>
        </div>

        <div className="role-toggle" style={{ width: '100%', marginBottom: 20 }}>
          <button
            type="button"
            className={!isSignUp ? 'active' : ''}
            style={{ flex: 1, padding: '9px 12px', fontSize: 12, textAlign: 'center' }}
            onClick={() => {
              setIsSignUp(false)
              setAuthError('')
              setSuccessMessage('')
            }}
          >
            Sign in
          </button>
          <button
            type="button"
            className={isSignUp ? 'active' : ''}
            style={{ flex: 1, padding: '9px 12px', fontSize: 12, textAlign: 'center' }}
            onClick={() => {
              setIsSignUp(true)
              setAuthError('')
              setSuccessMessage('')
            }}
          >
            Create account
          </button>
        </div>

        <div className="login-heading">
          <span className="eyebrow">{isSignUp ? 'NEW CUSTOMER' : 'ACCOUNT ACCESS'}</span>
          <h1>{isSignUp ? 'Create your account' : 'Welcome back'}</h1>
          <p>
            {isSignUp
              ? 'Register to rent tools and equipment across Bohol.'
              : 'Sign in to manage your rentals and bookings.'}
          </p>
        </div>

        {successMessage && (
          <div className="login-alert" role="status" style={{ background: 'var(--green-bg)', borderColor: 'var(--green)' }}>
            <CheckCircle2 size={17} style={{ color: 'var(--green)' }} />
            <div>
              <strong style={{ color: 'var(--green)' }}>Account created</strong>
              <span style={{ color: 'var(--green)' }}>{successMessage}</span>
            </div>
          </div>
        )}

        {authError && (
          <div className="login-alert" role="alert">
            <AlertCircle size={17} />
            <div>
              <strong>{isSignUp ? 'Registration failed' : 'We couldn’t sign you in'}</strong>
              <span>{authError}</span>
            </div>
          </div>
        )}

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
                autoComplete={isSignUp ? 'new-password' : 'current-password'}
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

          <button className="button button-primary login-submit" type="submit" disabled={isSubmitting}>
            <span>
              {isSubmitting
                ? isSignUp
                  ? 'Creating account…'
                  : 'Signing in…'
                : isSignUp
                  ? 'Create account'
                  : 'Sign in'}
            </span>
            {!isSubmitting && <ArrowRight size={16} />}
          </button>
        </form>

        <p className="login-help">
          {isSignUp ? (
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
                  setIsSignUp(false)
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
                  setIsSignUp(true)
                  setAuthError('')
                  setSuccessMessage('')
                }}
              >
                Create an account
              </button>
            </>
          )}
        </p>
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
