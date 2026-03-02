import { useState, useEffect } from 'react'
import './index.css'
import { getAuth, onAuthStateChanged } from 'firebase/auth'
import { getUser } from './firebase'
import LoginPage from './Pages/Login/LoginPage'
import StudentDashboard from './Pages/Dashboard/StudentDashboard'
import AdminDashboard from './Pages/Admin/AdminDashboard'

function Loader() {
  return (
    <div className="loader">
      <div className="loader-logo">Track<span>OJT</span></div>
      <div className="loader-bar-wrap"><div className="loader-bar" /></div>
      <div className="loader-status">Initializing workspace...</div>
    </div>
  )
}

export default function App() {
  const [loading, setLoading]       = useState(true)
  const [page, setPage]             = useState('login')
  const [currentUser, setCurrentUser] = useState(null)

  useEffect(() => {
    const auth = getAuth()

    // Listen for auth state — fires on every page load/refresh
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      if (firebaseUser) {
        // User is still logged in — fetch their Firestore profile
        try {
          const userData = await getUser(firebaseUser.uid)
          if (userData) {
            setCurrentUser(userData)
            setPage(userData.role === 'admin' ? 'admin-dashboard' : 'student-dashboard')
          } else {
            setPage('login')
          }
        } catch (err) {
          console.error(err)
          setPage('login')
        }
      } else {
        // No logged in user
        setPage('login')
      }
      setLoading(false)
    })

    return () => unsubscribe()
  }, [])

  const handleLogin = (role, user) => {
    setCurrentUser(user)
    setPage(role === 'admin' ? 'admin-dashboard' : 'student-dashboard')
  }

  const handleLogout = () => {
    setCurrentUser(null)
    setPage('login')
  }

  if (loading) return <Loader />

  return (
    <>
      {page === 'login'              && <LoginPage        onLogin={handleLogin} />}
      {page === 'student-dashboard'  && <StudentDashboard user={currentUser} onLogout={handleLogout} />}
      {page === 'admin-dashboard'    && <AdminDashboard   user={currentUser} onLogout={handleLogout} />}
    </>
  )
}