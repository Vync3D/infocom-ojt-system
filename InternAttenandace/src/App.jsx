import { useState, useEffect } from 'react'
import './index.css'
import LoginPage from './Pages/Login/LoginPage'
import StudentDashboard from './Pages/Dashboard/StudentDashboard'
import AdminDashboard from './Pages/Admin/AdminDashboard'

function Loader({ onDone }) {
  useEffect(() => {
    const t = setTimeout(onDone, 2100)
    return () => clearTimeout(t)
  }, [onDone])

  return (
    <div className="loader">
      <div className="loader-logo">Track<span>OJT</span></div>
      <div className="loader-bar-wrap"><div className="loader-bar" /></div>
      <div className="loader-status">Initializing workspace...</div>
    </div>
  )
}

export default function App() {
  const [loading, setLoading] = useState(true)
  const [page, setPage]       = useState('login')
  const [currentUser, setCurrentUser] = useState(null)

  if (loading) return <Loader onDone={() => setLoading(false)} />

  const handleLogin = (role, user) => {
    setCurrentUser(user)
    setPage(role === 'admin' ? 'admin-dashboard' : 'student-dashboard')
  }

  const handleLogout = () => {
    setCurrentUser(null)
    setPage('login')
  }

  return (
    <>
      {page === 'login' && <LoginPage onLogin={handleLogin} />}
      {page === 'student-dashboard' && <StudentDashboard user={currentUser} onLogout={handleLogout} />}
      {page === 'admin-dashboard'   && <AdminDashboard   user={currentUser} onLogout={handleLogout} />}
    </>
  )
}