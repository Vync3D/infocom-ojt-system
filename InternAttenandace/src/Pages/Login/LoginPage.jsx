import { useState } from 'react'
import './LoginPage.css'
import { loginUser } from '../../firebase'

export default function LoginPage({ onLogin }) {
  const [showPassword, setShowPassword] = useState(false)
  const [loading, setLoading]           = useState(false)
  const [error, setError]               = useState('')
  const [form, setForm]                 = useState({ email: '', password: '', remember: false })

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target
    setForm(prev => ({ ...prev, [name]: type === 'checkbox' ? checked : value }))
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      const user = await loginUser(form.email, form.password)
      onLogin(user.role, user)
    } catch (err) {
      setError(getFriendlyError(err.code))
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="login-page">
      <div className="login-card">
        <div className="login-logo">Infocom<span>OJT</span></div>
        <div className="login-tagline">Attendance & Task Manager Portal</div>
        <h1 className="login-heading">Welcome back</h1>

        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label htmlFor="email">Email</label>
            <input
              id="email" name="email" type="text"
              placeholder="Enter your email"
              value={form.email} onChange={handleChange}
              autoComplete="email" required
            />
          </div>

          <div className="form-group">
            <label htmlFor="password">Password</label>
            <div className="password-wrap">
              <input
                id="password" name="password"
                type={showPassword ? 'text' : 'password'}
                placeholder="••••••••"
                value={form.password} onChange={handleChange}
                autoComplete="current-password" required
              />
              <button type="button" className="toggle-pw"
                onClick={() => setShowPassword(p => !p)}>
                {showPassword ? '🙈' : '👁'}
              </button>
            </div>
          </div>

          {error && <div className="login-error">{error}</div>}

          <div className="form-footer-row">
            <label className="remember">
              <input type="checkbox" name="remember"
                checked={form.remember} onChange={handleChange} />
              Remember me
            </label>
          </div>

          <button type="submit" className="btn-login" disabled={loading}>
            {loading ? 'Signing in...' : 'Sign In →'}
          </button>
        </form>

        <div className="divider"><span>InfocomOJT v1.0</span></div>
      </div>
    </div>
  )
}

function getFriendlyError(code) {
  switch (code) {
    case 'auth/user-not-found':
    case 'auth/wrong-password':
    case 'auth/invalid-credential':
      return 'Invalid email or password.'
    case 'auth/too-many-requests':
      return 'Too many attempts. Please try again later.'
    case 'auth/network-request-failed':
      return 'Network error. Check your connection.'
    default:
      return 'Something went wrong. Please try again.'
  }
}