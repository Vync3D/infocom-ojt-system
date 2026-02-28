import { useState, useEffect } from 'react'
import './StudentDashboard.css'
import AttendancePage from '../Attendance/AttendancePage'
import TasksPage from '../Tasks/TasksPage'
import { timeIn, timeOut, getAttendanceLogs, getTasksForIntern, logoutUser } from '../../firebase'

function useClockTime() {
  const [now, setNow] = useState(new Date())
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 1000)
    return () => clearInterval(t)
  }, [])
  return now
}

function formatTime(date) {
  return date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: true })
}
function formatDate(date) {
  return date.toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })
}
function formatLogTime(date) {
  return date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true })
}
function getInitials(name) {
  return name?.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase() || '??'
}

const STATUS_LABELS = { pending: 'Pending', 'in-progress': 'In Progress', done: 'Done' }
const FILTERS       = ['All', 'Pending', 'In Progress', 'Done']

export default function StudentDashboard({ user, onLogout }) {
  const now = useClockTime()
  const [page, setPage]           = useState('dashboard')
  const [filter, setFilter]       = useState('All')
  const [timeState, setTimeState] = useState('idle')
  const [timeInAt, setTimeInAt]   = useState(null)
  const [logs, setLogs]           = useState([])
  const [tasks, setTasks]         = useState([])
  const [loadingIn, setLoadingIn]   = useState(false)
  const [loadingOut, setLoadingOut] = useState(false)
  const [error, setError]           = useState('')

  // Load attendance logs + tasks on mount
  useEffect(() => {
    if (!user?.uid) return
    const today = new Date().toISOString().split("T")[0]
    getAttendanceLogs(user.uid).then(fetchedLogs => {
      setLogs(fetchedLogs)
      const todayLog = fetchedLogs.find(l => l.date === today)
      if (todayLog) {
        if (todayLog.timeOut) setTimeState("timed-out")
        else { setTimeState("timed-in"); setTimeInAt(todayLog.timeIn?.toDate()) }
      }
    }).catch(console.error)
    getTasksForIntern(user.uid).then(setTasks).catch(console.error)
  }, [user?.uid])

  const handleTimeIn = async () => {
    setLoadingIn(true); setError('')
    try {
      await timeIn(user.uid)
      setTimeInAt(new Date())
      setTimeState('timed-in')
      const updated = await getAttendanceLogs(user.uid)
      setLogs(updated)
    } catch (err) {
      setError(err.message)
    } finally { setLoadingIn(false) }
  }

  const handleTimeOut = async () => {
    setLoadingOut(true); setError('')
    try {
      await timeOut(user.uid)
      setTimeState('timed-out')
      const updated = await getAttendanceLogs(user.uid)
      setLogs(updated)
    } catch (err) {
      setError(err.message)
    } finally { setLoadingOut(false) }
  }

  const handleLogout = async () => {
    await logoutUser()
    onLogout()
  }

  const filteredTasks = tasks.filter(t => {
    if (filter === 'All') return true
    return STATUS_LABELS[t.status] === filter
  })

  // Format log for display
  const formatLog = (log) => {
    const timeInStr  = log.timeIn?.toDate  ? formatLogTime(log.timeIn.toDate())  : log.timeIn  || '—'
    const timeOutStr = log.timeOut?.toDate ? formatLogTime(log.timeOut.toDate()) : log.timeOut || '—'
    const dateStr    = log.date ? new Date(log.date + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric', weekday: 'short' }) : '—'
    return { date: dateStr, timeIn: timeInStr, timeOut: timeOutStr, duration: log.duration || '—' }
  }

  const statusMessage = {
    idle:        'Not yet timed in today.',
    'timed-in':  `Timed in at ${timeInAt ? formatLogTime(timeInAt) : ''}. Have a productive day!`,
    'timed-out': 'Timed out. See you tomorrow!',
  }[timeState]

  if (page === 'attendance') return <AttendancePage uid={user?.uid} onBack={() => setPage('dashboard')} />
  if (page === 'tasks')      return <TasksPage      uid={user?.uid} onBack={() => setPage('dashboard')} />

  return (
    <div className="dashboard">
      <header className="topbar">
        <div className="topbar-logo">Track<span>OJT</span></div>
        <div className="topbar-right">
          <span className="topbar-greeting">Hello, <strong>{user?.name?.split(' ')[0] || 'Intern'}</strong></span>
          <button className="btn-logout" onClick={handleLogout}>⎋ Logout</button>
        </div>
      </header>

      <div className="dashboard-body">
        {/* Profile Banner */}
        <div className="profile-banner">
          <div className="profile-left">
            <div className="avatar">{getInitials(user?.name)}</div>
            <div>
              <div className="profile-name">{user?.name || 'Intern'}</div>
              <div className="profile-role">OJT Student</div>
            </div>
          </div>
          <div className="hours-total">
            <div className="hours-total-label">Total Hours Rendered</div>
            <div className="hours-total-value">{Math.floor(user?.hoursRendered || 0)}<span>hrs</span></div>
          </div>
        </div>

        <div className="main-grid">
          {/* Time Card */}
          <div className="time-card">
            <div className="card-header">
              <div className="card-title">Attendance</div>
              <span className={`card-badge ${timeState === 'timed-in' ? 'in' : 'out'}`}>
                {timeState === 'timed-in' ? '● Timed In' : '○ Not In'}
              </span>
            </div>
            <div className="time-display">
              <div className="current-time">{formatTime(now)}</div>
              <div className="current-date">{formatDate(now)}</div>
            </div>
            <div className={`time-status ${timeState}`}>{statusMessage}</div>
            {error && <div style={{ margin: '0 24px', padding: '8px 12px', background: 'rgba(255,95,87,0.08)', border: '1px solid rgba(255,95,87,0.2)', borderRadius: '6px', color: '#ff5f57', fontSize: '0.72rem' }}>{error}</div>}

            {timeState === 'idle'      && <button className="btn-timein"  onClick={handleTimeIn}  disabled={loadingIn}>{loadingIn  ? 'Logging...' : '↓ Time In'}</button>}
            {timeState === 'timed-in'  && <button className="btn-timeout" onClick={handleTimeOut} disabled={loadingOut}>{loadingOut ? 'Logging...' : '↑ Time Out'}</button>}
            {timeState === 'timed-out' && <button className="btn-timein"  disabled>✓ Done for today</button>}

            <div className="attendance-log">
              <div className="log-title">Recent Attendance</div>
              <div className="log-rows">
                {logs.slice(0, 3).map((log, i) => {
                  const f = formatLog(log)
                  return (
                    <div className="log-row" key={i}>
                      <span className="log-row-date">{f.date}</span>
                      <div className="log-row-times">
                        <span className="log-time-in">↓ {f.timeIn}</span>
                        <span className="log-time-out">↑ {f.timeOut}</span>
                      </div>
                      <span className="log-duration">{f.duration}</span>
                    </div>
                  )
                })}
                {logs.length === 0 && <div style={{ fontSize: '0.72rem', color: 'var(--muted)' }}>No records yet.</div>}
              </div>
              <button className="btn-show-more" onClick={() => setPage('attendance')}>View Full History →</button>
            </div>
          </div>

          {/* Tasks Card */}
          <div className="tasks-card">
            <div className="card-header">
              <div className="card-title">Tasks & Activities</div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <span style={{ fontSize: '0.72rem', color: 'var(--muted)' }}>
                  {tasks.filter(t => t.status !== 'done').length} remaining
                </span>
                <button className="btn-show-more" style={{ margin: 0, width: 'auto', padding: '5px 12px' }} onClick={() => setPage('tasks')}>
                  View All →
                </button>
              </div>
            </div>
            <div className="tasks-filters">
              {FILTERS.map(f => (
                <button key={f} className={`filter-btn ${filter === f ? 'active' : ''}`} onClick={() => setFilter(f)}>{f}</button>
              ))}
            </div>
            <div className="tasks-list">
              {filteredTasks.length === 0 ? (
                <div className="tasks-empty"><span className="tasks-empty-icon">📭</span>No tasks in this category.</div>
              ) : (
                filteredTasks.map(task => (
                  <div className="task-item" key={task.id}>
                    <div className={`task-priority-bar ${task.priority}`} />
                    <div className="task-content">
                      <div className="task-top"><div className="task-title">{task.title}</div></div>
                      <div className="task-desc">{task.desc}</div>
                      <div className="task-meta">
                        <span className={`priority-tag ${task.priority}`}>
                          {task.priority === 'high' ? '↑ High' : task.priority === 'medium' ? '→ Medium' : '↓ Low'}
                        </span>
                        <span className={`status-tag ${task.status}`}>{STATUS_LABELS[task.status]}</span>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}