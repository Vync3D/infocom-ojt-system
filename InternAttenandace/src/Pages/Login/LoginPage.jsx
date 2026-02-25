import { useState } from 'react'
import './LoginPage.css'

export default function LoginPage({ onLogin }) {
  const [showPassword, setShowPassword] = useState(false)
  const [loading, setLoading]           = useState(false)
  const [form, setForm]                 = useState({ username: '', password: '', remember: false })

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target
    setForm(prev => ({ ...prev, [name]: type === 'checkbox' ? checked : value }))
  }

  const handleSubmit = (e) => {
    e.preventDefault()
    setLoading(true)

    // TODO: Replace with Firebase auth later.
    // After getting the user role, call onLogin(role):
    //   onLogin('student')    → student dashboard
    //   onLogin('supervisor') → supervisor dashboard
    setTimeout(() => {
      setLoading(false)
      onLogin('student')
    }, 1000)
  }

  return (
    <div className="login-page">
      <div className="login-card">
        <div className="login-logo">Infocom<span>OJT</span></div>
        <div className="login-tagline">Attendance & Task Manager Portal</div>

        <h1 className="login-heading">Welcome back</h1>

        <form onSubmit={handleSubmit}>
          {/* Username */}
          <div className="form-group">
            <label htmlFor="username">Username</label>
            <input
              id="username"
              name="username"
              type="text"
              placeholder="Enter your username"
              value={form.username}
              onChange={handleChange}
              autoComplete="username"
              required
            />
          </div>

          {/* Password */}
          <div className="form-group">
            <label htmlFor="password">Password</label>
            <div className="password-wrap">
              <input
                id="password"
                name="password"
                type={showPassword ? 'text' : 'password'}
                placeholder="••••••••"
                value={form.password}
                onChange={handleChange}
                autoComplete="current-password"
                required
              />
              <button
                type="button"
                className="toggle-pw"
                onClick={() => setShowPassword(p => !p)}
                aria-label="Toggle password visibility"
              >
                {showPassword ? '🙈' : '👁'}
              </button>
            </div>
          </div>

          {/* Remember */}
          <div className="form-footer-row">
            <label className="remember">
              <input
                type="checkbox"
                name="remember"
                checked={form.remember}
                onChange={handleChange}
              />
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