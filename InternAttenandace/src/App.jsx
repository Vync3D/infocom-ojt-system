import { useState, useEffect } from 'react'
import './index.css'
import LoginPage from './Pages/Login/LoginPage'
import StudentDashboard from './Pages/Dashboard/StudentDashboard'

function Loader({ onDone }) {
  useEffect(() => {
    const t = setTimeout(onDone, 2100)
    return () => clearTimeout(t)
  }, [onDone])

  return (
    <div className="loader">
      <div className="loader-logo">Track<span>OJT</span></div>
      <div className="loader-bar-wrap">
        <div className="loader-bar" />
      </div>
      <div className="loader-status">Initializing workspace...</div>
    </div>
  )
}

export default function App() {
  const [loading, setLoading] = useState(true)
  const [page, setPage]       = useState('login') // 'login' | 'student-dashboard'

  if (loading) return <Loader onDone={() => setLoading(false)} />

  return (
    <>
      {page === 'login' && (
        <LoginPage onLogin={(role) => {
          // TODO: When your API returns a role, route accordingly:
          // role === 'supervisor' → setPage('supervisor-dashboard')
          // For now, all logins go to student dashboard
          setPage('student-dashboard')
        }} />
      )}
      {page === 'student-dashboard' && (
        <StudentDashboard onLogout={() => setPage('login')} />
      )}
    </>
  )
}