import { useState, useEffect } from 'react'
import './StudentDashboard.css'
import AttendancePage from '../Attendance/AttendancePage'
import TasksPage from '../Tasks/TasksPage'
import { timeIn, timeOut, getAttendanceLogs, getTasksForInternAll, logoutUser, changePassword } from '../../firebase'
import ThemePicker from '../../components/ThemePicker'

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

// ── Change Password Modal ──
function ChangePwModal({ onClose }) {
  const [currentPw, setCurrentPw] = useState('')
  const [newPw,     setNewPw]     = useState('')
  const [confirmPw, setConfirmPw] = useState('')
  const [loading,   setLoading]   = useState(false)
  const [error,     setError]     = useState('')
  const [success,   setSuccess]   = useState(false)

  const handleSubmit = async () => {
    if (newPw.length < 6)       { setError('New password must be at least 6 characters.'); return }
    if (newPw !== confirmPw)    { setError('New passwords do not match.'); return }
    if (newPw === currentPw)    { setError('New password must be different from current.'); return }
    setLoading(true); setError('')
    try {
      await changePassword(currentPw, newPw)
      setSuccess(true)
    } catch (e) {
      if (e.code === 'auth/wrong-password' || e.code === 'auth/invalid-credential') setError('Current password is incorrect.')
      else setError(e.message)
    }
    setLoading(false)
  }

  return (
    <div className="modal-overlay" style={{ zIndex: 1000 }}>
      <div className="modal">
        {success ? (
          <div style={{ textAlign: 'center', padding: '12px 0' }}>
            <div style={{ fontSize: '2rem', marginBottom: 10 }}>✅</div>
            <div className="modal-title">Password Changed!</div>
            <div className="modal-sub">Your password has been updated successfully.</div>
            <div className="modal-actions" style={{ marginTop: 20 }}>
              <button className="btn-modal-confirm" onClick={onClose}>Done</button>
            </div>
          </div>
        ) : (
          <>
            <div className="modal-title">🔑 Change Password</div>
            <div className="modal-sub">Enter your current password to set a new one.</div>
            <div className="modal-form">
              <div className="modal-field">
                <label>Current Password</label>
                <input type="password" placeholder="Your current password" value={currentPw} onChange={e => setCurrentPw(e.target.value)} />
              </div>
              <div className="modal-field">
                <label>New Password</label>
                <input type="password" placeholder="Min. 6 characters" value={newPw} onChange={e => setNewPw(e.target.value)} />
              </div>
              <div className="modal-field">
                <label>Confirm New Password</label>
                <input type="password" placeholder="Repeat new password" value={confirmPw} onChange={e => setConfirmPw(e.target.value)} />
              </div>
              {error && <div style={{ color: '#ff5f57', fontSize: '0.75rem' }}>{error}</div>}
              <div className="modal-actions">
                <button className="btn-modal-cancel" onClick={onClose}>Cancel</button>
                <button className="btn-modal-confirm" onClick={handleSubmit} disabled={loading}>
                  {loading ? 'Saving...' : 'Change Password'}
                </button>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  )
}

export default function StudentDashboard({ user, onLogout }) {
  const now = useClockTime()
  const [page, setPage]             = useState('dashboard')
  const [filter, setFilter]         = useState('All')
  const [timeState, setTimeState]   = useState('idle')
  const [timeInAt, setTimeInAt]     = useState(null)
  const [logs, setLogs]             = useState([])
  const [tasks, setTasks]           = useState([])
  const [loadingIn, setLoadingIn]   = useState(false)
  const [loadingOut, setLoadingOut] = useState(false)
  const [error, setError]           = useState('')

  const shift = user?.shift || 'morning'

  useEffect(() => {
    if (!user?.uid) return

    // Use local date (not UTC) to avoid timezone mismatch
    const now       = new Date()
    const toLocal   = (d) => {
      const y = d.getFullYear()
      const m = String(d.getMonth() + 1).padStart(2, '0')
      const day = String(d.getDate()).padStart(2, '0')
      return `${y}-${m}-${day}`
    }
    const today = toLocal(now)

    // GY shift: if it's before noon, the active shift belongs to yesterday
    const checkDate = (() => {
      if (shift === 'gy' && now.getHours() < 12) {
        const y = new Date(now); y.setDate(y.getDate() - 1)
        return toLocal(y)
      }
      return today
    })()

    getAttendanceLogs(user.uid).then(fetchedLogs => {
      setLogs(fetchedLogs)
      // Only look at today's record — strictly match checkDate
      const todayLog = fetchedLogs.find(l => l.date === checkDate)
      if (todayLog) {
        if (todayLog.timeOut) setTimeState('timed-out')
        else { setTimeState('timed-in'); setTimeInAt(todayLog.timeIn?.toDate?.()) }
      } else {
        // No record for today — reset to idle (handles new day correctly)
        setTimeState('idle')
        setTimeInAt(null)
      }
    }).catch(console.error)

    getTasksForInternAll(user.uid).then(setTasks).catch(console.error)
  }, [user?.uid, shift])

  const handleTimeIn = async () => {
    setLoadingIn(true); setError('')
    try {
      await timeIn(user.uid, shift)
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
      await timeOut(user.uid, shift)
      setTimeState('timed-out')
      const updated = await getAttendanceLogs(user.uid)
      setLogs(updated)
    } catch (err) {
      setError(err.message)
    } finally { setLoadingOut(false) }
  }

  const handleLogout = async () => { await logoutUser(); onLogout() }

  const filteredTasks = tasks.filter(t => filter === 'All' || STATUS_LABELS[t.status] === filter)

  const formatLog = (log) => {
    const timeInStr  = log.timeIn?.toDate  ? formatLogTime(log.timeIn.toDate())  : '—'
    const timeOutStr = log.timeOut?.toDate ? formatLogTime(log.timeOut.toDate()) : '—'
    const dateStr    = log.date ? new Date(log.date + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric', weekday: 'short' }) : '—'
    return { date: dateStr, timeIn: timeInStr, timeOut: timeOutStr, duration: log.duration || '—' }
  }

  // Button label shows geofence check in progress
  const timeInLabel  = loadingIn  ? '📍 Checking location...' : '↓ Time In'
  const timeOutLabel = loadingOut ? '📍 Checking location...' : '↑ Time Out'

  const statusMessage = {
    idle:        'Not yet timed in today.',
    'timed-in':  `Timed in at ${timeInAt ? formatLogTime(timeInAt) : ''}. Have a productive day!`,
    'timed-out': 'Timed out. See you next shift!',
  }[timeState]

  // Overtime indicator — show if timed in and past shift end time
  const isOvertime = (() => {
    if (timeState !== 'timed-in' || !timeInAt) return false
    const shiftCfg = {
      morning: '15:00', mid: '22:00', gy: '07:00'
    }
    const endStr = shiftCfg[shift] || '15:00'
    const [eh, em] = endStr.split(':').map(Number)
    const now2 = new Date()
    // For GY shift end is early morning next day
    if (shift === 'gy') return now2.getHours() >= 7 && now2.getHours() < 12
    return now2.getHours() > eh || (now2.getHours() === eh && now2.getMinutes() >= em)
  })()

  // Shift badge
  const shiftConfig = {
    morning: { label: '🌅 Morning Shift', bg: 'rgba(0,229,160,0.08)',   color: 'var(--accent)',  border: '1px solid rgba(0,229,160,0.2)' },
    mid:     { label: '🌤️ Mid Shift',     bg: 'rgba(245,158,11,0.08)',  color: '#f59e0b',        border: '1px solid rgba(245,158,11,0.2)' },
    gy:      { label: '🌙 GY Shift',      bg: 'rgba(0,120,255,0.08)',   color: 'var(--accent2)', border: '1px solid rgba(0,120,255,0.2)' },
  }
  const sc = shiftConfig[shift] || shiftConfig['morning']
  const shiftBadge = (
    <span style={{ fontSize: '0.62rem', background: sc.bg, color: sc.color, border: sc.border, padding: '2px 8px', borderRadius: '100px', letterSpacing: '0.08em', textTransform: 'uppercase' }}>
      {sc.label}
    </span>
  )

  const [showChangePw, setShowChangePw] = useState(false)
  const [showTheme, setShowTheme]       = useState(false)

  if (page === 'attendance') return <AttendancePage uid={user?.uid} user={user} onBack={() => setPage('dashboard')} />
  if (page === 'tasks')      return <TasksPage      uid={user?.uid} onBack={() => setPage('dashboard')} />

  return (
    <div className="dashboard">
      <header className="topbar">
        <div className="topbar-logo">Infocom<span>OJT</span></div>
        <div className="topbar-right">
          <span className="topbar-greeting">Hello, <strong>{user?.name?.split(' ')[0] || 'Intern'}</strong></span>
          <button className="btn-logout" style={{ background: 'rgba(255,255,255,0.05)', color: 'var(--muted)', borderColor: 'var(--border)' }} onClick={() => setShowTheme(true)}>🎨 Theme</button>
          <button className="btn-logout" style={{ background: 'rgba(255,255,255,0.06)', color: 'var(--muted)', borderColor: 'var(--border)' }} onClick={() => setShowChangePw(true)}>🔑 Password</button>
          <button className="btn-logout" onClick={handleLogout}>⎋ Logout</button>
        </div>
      </header>

      {showTheme && <ThemePicker onClose={() => setShowTheme(false)} />}
      {/* Change Password Modal */}
      {showChangePw && <ChangePwModal onClose={() => setShowChangePw(false)} />}

      <div className="dashboard-body">
        {/* Profile Banner */}
        <div className="profile-banner">
          <div className="profile-left">
            <div className="avatar" style={user?.avatarColor ? { background: user.avatarColor + '22', border: `2px solid ${user.avatarColor}55`, color: user.avatarColor } : {}}>{getInitials(user?.name)}</div>
            <div>
              <div className="profile-name">{user?.name || 'Intern'}</div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '4px' }}>
                <div className="profile-role">OJT Student</div>
                {shiftBadge}
              </div>
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
            {isOvertime && (
              <div style={{ margin: '0 24px 12px', padding: '8px 14px', background: 'rgba(168,85,247,0.08)', border: '1px solid rgba(168,85,247,0.2)', borderRadius: '8px', color: '#a855f7', fontSize: '0.75rem' }}>
                ⏱ You are currently on <strong>overtime</strong>. Great dedication!
              </div>
            )}

            {/* Error — includes geofence errors */}
            {error && (
              <div className="timein-error">
                <span>📍</span> {error}
              </div>
            )}

            {timeState === 'idle'      && <button className="btn-timein"  onClick={handleTimeIn}  disabled={loadingIn}>{timeInLabel}</button>}
            {timeState === 'timed-in'  && <button className="btn-timeout" onClick={handleTimeOut} disabled={loadingOut}>{timeOutLabel}</button>}
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