import { useState, useEffect } from 'react'
import { Logo } from '../components/Logo.jsx'
import { loginUser, registerUser, forgotPassword, resetPassword, getGoogleLoginUrl } from '../lib/api.js'

export function AuthPage({ initialMode = 'login', onAuthSuccess, onNavigate }) {
  const [mode, setMode] = useState(initialMode) // 'login', 'register', 'forgot', 'reset'
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [rememberMe, setRememberMe] = useState(true)

  // Token from query param for reset-password
  const [resetToken, setResetToken] = useState('')

  // State management
  const [loading, setLoading] = useState(false)
  const [oauthLoading, setOauthLoading] = useState(false)
  const [error, setError] = useState(null)
  const [fieldErrors, setFieldErrors] = useState({})
  const [successMessage, setSuccessMessage] = useState(null)
  const [devResetUrl, setDevResetUrl] = useState(null)

  useEffect(() => {
    setMode(initialMode)
    setError(null)
    setFieldErrors({})
    setSuccessMessage(null)

    // Check query params for OAuth errors or reset tokens
    const params = new URLSearchParams(window.location.search)
    const errParam = params.get('error')
    if (errParam) {
      if (errParam === 'access_denied') {
        setError('Google sign-in was canceled. You can try again or use email and password.')
      } else if (errParam === 'invalid_or_expired_oauth_state') {
        setError('Authentication session expired or security verification failed. Please try again.')
      } else if (errParam === 'unverified_google_email') {
        setError('Your Google account does not have a verified email address.')
      } else {
        setError(`Authentication error: ${errParam.replace(/_/g, ' ')}`)
      }
    }

    const tokenParam = params.get('token')
    if (tokenParam) {
      setResetToken(tokenParam)
      setMode('reset')
    }
  }, [initialMode])

  // Password strength calculation
  const getPasswordStrength = (pwd) => {
    if (!pwd) return { score: 0, label: '', color: '' }
    let score = 0
    if (pwd.length >= 8) score += 1
    if (/[A-Z]/.test(pwd) && /[a-z]/.test(pwd)) score += 1
    if (/[0-9]/.test(pwd)) score += 1
    if (/[^A-Za-z0-9]/.test(pwd)) score += 1

    if (score <= 1) return { score: 1, label: 'Weak', color: '#EF4444' }
    if (score === 2 || score === 3) return { score: 2, label: 'Good', color: '#F59E0B' }
    return { score: 3, label: 'Strong', color: '#2EC4B6' }
  }

  const pwdStrength = getPasswordStrength(password)

  const handleGoogleSignIn = () => {
    setOauthLoading(true)
    setError(null)
    try {
      window.location.href = getGoogleLoginUrl()
    } catch {
      setOauthLoading(false)
      setError('Could not connect to Google authentication service. Please check your connection.')
    }
  }

  const validateEmail = (val) => {
    const regex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    return regex.test(val.trim())
  }

  const handleLoginSubmit = async (e) => {
    e.preventDefault()
    setError(null)
    setFieldErrors({})

    const errors = {}
    if (!email.trim()) errors.email = 'Email address is required.'
    else if (!validateEmail(email)) errors.email = 'Please enter a valid email address.'
    if (!password) errors.password = 'Password is required.'

    if (Object.keys(errors).length > 0) {
      setFieldErrors(errors)
      return
    }

    setLoading(true)
    try {
      const response = await loginUser(email.trim(), password, rememberMe)
      if (onAuthSuccess) onAuthSuccess(response.user)
      if (onNavigate) onNavigate('/workspace')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Invalid credentials. Please verify your email and password.')
    } finally {
      setLoading(false)
    }
  }

  const handleRegisterSubmit = async (e) => {
    e.preventDefault()
    setError(null)
    setFieldErrors({})

    const errors = {}
    if (!name.trim()) errors.name = 'Full name is required.'
    if (!email.trim()) errors.email = 'Email address is required.'
    else if (!validateEmail(email)) errors.email = 'Please enter a valid email address.'
    if (!password) errors.password = 'Password is required.'
    else if (password.length < 8) errors.password = 'Password must be at least 8 characters.'
    if (password !== confirmPassword) errors.confirmPassword = 'Passwords do not match.'

    if (Object.keys(errors).length > 0) {
      setFieldErrors(errors)
      return
    }

    setLoading(true)
    try {
      const response = await registerUser(name.trim(), email.trim(), password)
      if (onAuthSuccess) onAuthSuccess(response.user)
      if (onNavigate) onNavigate('/workspace')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Registration failed. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  const handleForgotSubmit = async (e) => {
    e.preventDefault()
    setError(null)
    setFieldErrors({})

    if (!email.trim() || !validateEmail(email)) {
      setFieldErrors({ email: 'Please enter a valid email address.' })
      return
    }

    setLoading(true)
    try {
      const resp = await forgotPassword(email.trim())
      setSuccessMessage(resp.message || 'If an account exists with this email, password reset instructions have been sent.')
      if (resp.dev_reset_url) {
        setDevResetUrl(resp.dev_reset_url)
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to process password reset request. Please try again later.')
    } finally {
      setLoading(false)
    }
  }

  const handleResetSubmit = async (e) => {
    e.preventDefault()
    setError(null)
    setFieldErrors({})

    const errors = {}
    if (!resetToken) errors.token = 'Missing reset token. Please use the link sent to your email.'
    if (!password || password.length < 8) errors.password = 'New password must be at least 8 characters.'
    if (password !== confirmPassword) errors.confirmPassword = 'Passwords do not match.'

    if (Object.keys(errors).length > 0) {
      setFieldErrors(errors)
      return
    }

    setLoading(true)
    try {
      await resetPassword(resetToken, password)
      setSuccessMessage('Your password has been successfully updated. You can now sign in.')
      setTimeout(() => {
        if (onNavigate) onNavigate('/login')
        else setMode('login')
      }, 2000)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Password update failed. The token may be expired or invalid.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="auth-page">
      <div className="auth-container">
        {/* Top Logo Navigation */}
        <div className="auth-header-logo">
          <Logo size={36} showWordmark={true} onClick={() => onNavigate && onNavigate('/')} />
        </div>

        <div className="auth-card">
          {/* Header Typography */}
          {mode === 'login' && (
            <div className="auth-card-header">
              <h1>Welcome back</h1>
              <p>Sign in to continue exploring your documents with PDFBuddy.</p>
            </div>
          )}

          {mode === 'register' && (
            <div className="auth-card-header">
              <h1>Start understanding your documents</h1>
              <p>Create a free account to upload, vectorize, and interact with your PDFs.</p>
            </div>
          )}

          {mode === 'forgot' && (
            <div className="auth-card-header">
              <h1>Reset your password</h1>
              <p>Enter your account email and we will generate secure recovery instructions.</p>
            </div>
          )}

          {mode === 'reset' && (
            <div className="auth-card-header">
              <h1>Set new password</h1>
              <p>Choose a secure password with at least 8 characters.</p>
            </div>
          )}

          {/* Banner Messages */}
          {error && (
            <div className="auth-banner error" role="alert">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="12" cy="12" r="10" />
                <line x1="12" y1="8" x2="12" y2="12" />
                <line x1="12" y1="16" x2="12.01" y2="16" />
              </svg>
              <span>{error}</span>
            </div>
          )}

          {successMessage && (
            <div className="auth-banner success" role="status">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
                <polyline points="22 4 12 14.01 9 11.01" />
              </svg>
              <span>{successMessage}</span>
            </div>
          )}

          {/* Google OAuth (Available for Login & Register) */}
          {(mode === 'login' || mode === 'register') && (
            <>
              <button
                type="button"
                className="google-btn"
                onClick={handleGoogleSignIn}
                disabled={oauthLoading || loading}
              >
                {oauthLoading ? (
                  <span className="spinner-inline">Connecting to Google...</span>
                ) : (
                  <>
                    <svg viewBox="0 0 24 24" width="18" height="18" className="google-icon" xmlns="http://www.w3.org/2000/svg">
                      <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                      <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                      <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"/>
                      <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"/>
                    </svg>
                    Continue with Google
                  </>
                )}
              </button>

              <div className="auth-separator">
                <span>or continue with email</span>
              </div>
            </>
          )}

          {/* FORM: Login Mode */}
          {mode === 'login' && (
            <form onSubmit={handleLoginSubmit} className="auth-form" noValidate>
              <div className="form-group">
                <label htmlFor="login-email">Email address</label>
                <input
                  id="login-email"
                  type="email"
                  autoComplete="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="name@company.com"
                  className={fieldErrors.email ? 'input-error' : ''}
                  disabled={loading}
                />
                {fieldErrors.email && <span className="field-error-text">{fieldErrors.email}</span>}
              </div>

              <div className="form-group">
                <div className="label-row">
                  <label htmlFor="login-password">Password</label>
                  <button
                    type="button"
                    className="link-btn"
                    onClick={() => {
                      if (onNavigate) onNavigate('/forgot-password')
                      else setMode('forgot')
                    }}
                  >
                    Forgot password?
                  </button>
                </div>
                <div className="input-password-wrapper">
                  <input
                    id="login-password"
                    type={showPassword ? 'text' : 'password'}
                    autoComplete="current-password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••"
                    className={fieldErrors.password ? 'input-error' : ''}
                    disabled={loading}
                  />
                  <button
                    type="button"
                    className="password-toggle-btn"
                    onClick={() => setShowPassword(!showPassword)}
                    aria-label={showPassword ? 'Hide password' : 'Show password'}
                  >
                    {showPassword ? (
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24" />
                        <line x1="1" y1="1" x2="23" y2="23" />
                      </svg>
                    ) : (
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                        <circle cx="12" cy="12" r="3" />
                      </svg>
                    )}
                  </button>
                </div>
                {fieldErrors.password && <span className="field-error-text">{fieldErrors.password}</span>}
              </div>

              <div className="form-options">
                <label className="checkbox-label">
                  <input
                    type="checkbox"
                    checked={rememberMe}
                    onChange={(e) => setRememberMe(e.target.checked)}
                  />
                  <span>Remember me for 30 days</span>
                </label>
              </div>

              <button
                type="submit"
                className="btn-primary-teal btn-submit"
                disabled={loading || oauthLoading}
              >
                {loading ? 'Signing in...' : 'Sign In'}
              </button>

              <div className="auth-footer-switch">
                <span>Don&apos;t have an account? </span>
                <button
                  type="button"
                  className="link-btn-accent"
                  onClick={() => {
                    if (onNavigate) onNavigate('/register')
                    else setMode('register')
                  }}
                >
                  Sign up
                </button>
              </div>
            </form>
          )}

          {/* FORM: Register Mode */}
          {mode === 'register' && (
            <form onSubmit={handleRegisterSubmit} className="auth-form" noValidate>
              <div className="form-group">
                <label htmlFor="reg-name">Full name</label>
                <input
                  id="reg-name"
                  type="text"
                  autoComplete="name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Alex Morgan"
                  className={fieldErrors.name ? 'input-error' : ''}
                  disabled={loading}
                />
                {fieldErrors.name && <span className="field-error-text">{fieldErrors.name}</span>}
              </div>

              <div className="form-group">
                <label htmlFor="reg-email">Work email</label>
                <input
                  id="reg-email"
                  type="email"
                  autoComplete="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="name@company.com"
                  className={fieldErrors.email ? 'input-error' : ''}
                  disabled={loading}
                />
                {fieldErrors.email && <span className="field-error-text">{fieldErrors.email}</span>}
              </div>

              <div className="form-group">
                <label htmlFor="reg-password">Password</label>
                <div className="input-password-wrapper">
                  <input
                    id="reg-password"
                    type={showPassword ? 'text' : 'password'}
                    autoComplete="new-password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="At least 8 characters"
                    className={fieldErrors.password ? 'input-error' : ''}
                    disabled={loading}
                  />
                  <button
                    type="button"
                    className="password-toggle-btn"
                    onClick={() => setShowPassword(!showPassword)}
                    aria-label={showPassword ? 'Hide password' : 'Show password'}
                  >
                    {showPassword ? (
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24" />
                        <line x1="1" y1="1" x2="23" y2="23" />
                      </svg>
                    ) : (
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                        <circle cx="12" cy="12" r="3" />
                      </svg>
                    )}
                  </button>
                </div>
                {password && (
                  <div className="password-strength-indicator">
                    <div className="strength-bars">
                      <div className={`bar ${pwdStrength.score >= 1 ? 'active' : ''}`} style={{ backgroundColor: pwdStrength.color }}></div>
                      <div className={`bar ${pwdStrength.score >= 2 ? 'active' : ''}`} style={{ backgroundColor: pwdStrength.color }}></div>
                      <div className={`bar ${pwdStrength.score >= 3 ? 'active' : ''}`} style={{ backgroundColor: pwdStrength.color }}></div>
                    </div>
                    <span style={{ color: pwdStrength.color, fontSize: 12 }}>{pwdStrength.label}</span>
                  </div>
                )}
                {fieldErrors.password && <span className="field-error-text">{fieldErrors.password}</span>}
              </div>

              <div className="form-group">
                <label htmlFor="reg-confirm">Confirm password</label>
                <input
                  id="reg-confirm"
                  type={showPassword ? 'text' : 'password'}
                  autoComplete="new-password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="Repeat your password"
                  className={fieldErrors.confirmPassword ? 'input-error' : ''}
                  disabled={loading}
                />
                {fieldErrors.confirmPassword && <span className="field-error-text">{fieldErrors.confirmPassword}</span>}
              </div>

              <button
                type="submit"
                className="btn-primary-teal btn-submit"
                disabled={loading || oauthLoading}
              >
                {loading ? 'Creating account...' : 'Create Account'}
              </button>

              <div className="auth-footer-switch">
                <span>Already have an account? </span>
                <button
                  type="button"
                  className="link-btn-accent"
                  onClick={() => {
                    if (onNavigate) onNavigate('/login')
                    else setMode('login')
                  }}
                >
                  Sign in
                </button>
              </div>
            </form>
          )}

          {/* FORM: Forgot Password Mode */}
          {mode === 'forgot' && (
            <form onSubmit={handleForgotSubmit} className="auth-form" noValidate>
              <div className="form-group">
                <label htmlFor="forgot-email">Account email</label>
                <input
                  id="forgot-email"
                  type="email"
                  autoComplete="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="name@company.com"
                  className={fieldErrors.email ? 'input-error' : ''}
                  disabled={loading}
                />
                {fieldErrors.email && <span className="field-error-text">{fieldErrors.email}</span>}
              </div>

              <button
                type="submit"
                className="btn-primary-teal btn-submit"
                disabled={loading}
              >
                {loading ? 'Sending instructions...' : 'Send Reset Instructions'}
              </button>

              <div className="auth-footer-switch">
                <button
                  type="button"
                  className="link-btn-accent"
                  onClick={() => {
                    if (onNavigate) onNavigate('/login')
                    else setMode('login')
                  }}
                >
                  ← Back to sign in
                </button>
              </div>
            </form>
          )}

          {/* FORM: Reset Password Mode */}
          {mode === 'reset' && (
            <form onSubmit={handleResetSubmit} className="auth-form" noValidate>
              <div className="form-group">
                <label htmlFor="reset-new-password">New password</label>
                <input
                  id="reset-new-password"
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="At least 8 characters"
                  className={fieldErrors.password ? 'input-error' : ''}
                  disabled={loading}
                />
                {fieldErrors.password && <span className="field-error-text">{fieldErrors.password}</span>}
              </div>

              <div className="form-group">
                <label htmlFor="reset-confirm-password">Confirm new password</label>
                <input
                  id="reset-confirm-password"
                  type={showPassword ? 'text' : 'password'}
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="Repeat new password"
                  className={fieldErrors.confirmPassword ? 'input-error' : ''}
                  disabled={loading}
                />
                {fieldErrors.confirmPassword && <span className="field-error-text">{fieldErrors.confirmPassword}</span>}
              </div>

              <button
                type="submit"
                className="btn-primary-teal btn-submit"
                disabled={loading}
              >
                {loading ? 'Updating password...' : 'Update Password'}
              </button>

              <div className="auth-footer-switch">
                <button
                  type="button"
                  className="link-btn"
                  onClick={() => {
                    if (onNavigate) onNavigate('/login')
                    else setMode('login')
                  }}
                >
                  ← Cancel and return to sign in
                </button>
              </div>
            </form>
          )}
        </div>

        {/* Security / Subtext */}
        <div className="auth-footer-notice">
          <p>Your account and documents are protected.</p>
        </div>
      </div>
    </div>
  )
}
