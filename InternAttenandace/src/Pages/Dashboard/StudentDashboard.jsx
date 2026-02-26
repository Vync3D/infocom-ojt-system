import { useState, useEffect } from 'react'
import './StudentDashboard.css'
import AttendancePage from '../Attendance/AttendancePage'
import TasksPage from '../Tasks/TasksPage'

// ── Mock Data (replace with real API calls later) ──
const MOCK_USER = {
  name: 'Maria Santos',
  role: 'OJT Student',
  hoursRendered: 312,
  hoursRequired: 600,
}

const MOCK_TASKS = [
  { id: 1, title: 'UI Design Review',        desc: 'Review and finalize the mockups for the admin panel. Send feedback to the design lead.',    priority: 'high',   status: 'in-progress' },
  { id: 2, title: 'Backend API Integration', desc: 'Connect the front-end login form to the authentication API endpoint.',                       priority: 'high',   status: 'pending' },
  { id: 3, title: 'Weekly Report',           desc: "Compile this week's progress and submit to your supervisor by Friday EOD.",                  priority: 'medium', status: 'pending' },
  { id: 4, title: 'Database Schema Update',  desc: 'Update the attendance table to include time_out and total_hours columns.',                   priority: 'medium', status: 'done' },
  { id: 5, title: 'Onboarding Docs',         desc: 'Read through the company handbook and internal documentation wiki.',                         priority: 'low',    status: 'done' },
]

const MOCK_LOGS = [
  { date: 'Feb 24, Mon', timeIn: '8:02 AM', timeOut: '5:04 PM', duration: '9h 02m' },
  { date: 'Feb 23, Sun', timeIn: '8:15 AM', timeOut: '5:00 PM', duration: '8h 45m' },
  { date: 'Feb 22, Sat', timeIn: '8:00 AM', timeOut: '4:58 PM', duration: '8h 58m' },
]

// ── Helpers ──
function getInitials(name) {
  return name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase()
}

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

const STATUS_LABELS = { pending: 'Pending', 'in-progress': 'In Progress', done: 'Done' }
const FILTERS       = ['All', 'Pending', 'In Progress', 'Done']

export default function StudentDashboard({ onLogout }) {
  const now = useClockTime()
  const [page, setPage]             = useState('dashboard') // 'dashboard' | 'attendance'
  const [filter, setFilter]         = useState('All')
  const [timeState, setTimeState]   = useState('idle')
  const [timeInAt, setTimeInAt]     = useState(null)
  const [timeOutAt, setTimeOutAt]   = useState(null)
  const [logs, setLogs]             = useState(MOCK_LOGS)

  const user = MOCK_USER

  const filteredTasks = MOCK_TASKS.filter(t => {
    if (filter === 'All') return true
    return STATUS_LABELS[t.status] === filter
  })

  const handleTimeIn = () => {
    setTimeInAt(new Date())
    setTimeState('timed-in')
  }

  const handleTimeOut = () => {
    const t = new Date()
    setTimeOutAt(t)
    setTimeState('timed-out')
    const inTime   = formatLogTime(timeInAt)
    const outTime  = formatLogTime(t)
    const diffMs   = t - timeInAt
    const diffH    = Math.floor(diffMs / 3600000)
    const diffM    = Math.floor((diffMs % 3600000) / 60000)
    const duration = `${diffH}h ${diffM.toString().padStart(2, '0')}m`
    const dateStr  = t.toLocaleDateString('en-US', { month: 'short', day: 'numeric', weekday: 'short' })
    setLogs(prev => [{ date: dateStr, timeIn: inTime, timeOut: outTime, duration }, ...prev.slice(0, 4)])
  }

  const statusMessage = {
    idle:        'Not yet timed in today.',
    'timed-in':  `Timed in at ${timeInAt ? formatLogTime(timeInAt) : ''}. Have a productive day!`,
    'timed-out': `Timed out at ${timeOutAt ? formatLogTime(timeOutAt) : ''}. See you tomorrow!`,
  }[timeState]

  // ── Show attendance page ──
  if (page === 'attendance') {
    return <AttendancePage onBack={() => setPage('dashboard')} />
  }

  // ── Show tasks page ──
  if (page === 'tasks') {
    return <TasksPage onBack={() => setPage('dashboard')} />
  }

  return (
    <div className="dashboard">
      <header className="topbar">
        <div className="topbar-logo">Track<span>OJT</span></div>
        <div className="topbar-right">
          <span className="topbar-greeting">Hello, <strong>{user.name.split(' ')[0]}</strong></span>
          <button className="btn-logout" onClick={onLogout}>⎋ Logout</button>
        </div>
      </header>

      <div className="dashboard-body">

        {/* Profile Banner */}
        <div className="profile-banner">
          <div className="profile-left">
            <div className="avatar">{getInitials(user.name)}</div>
            <div>
              <div className="profile-name">{user.name}</div>
              <div className="profile-role">{user.role}</div>
            </div>
          </div>
          <div className="hours-total">
            <div className="hours-total-label">Total Hours Rendered</div>
            <div className="hours-total-value">{user.hoursRendered}<span>hrs</span></div>
          </div>
        </div>

        {/* Main Grid */}
        <div className="main-grid">

          {/* Time In/Out Card */}
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

            {timeState === 'idle'      && <button className="btn-timein"  onClick={handleTimeIn}>↓ Time In</button>}
            {timeState === 'timed-in'  && <button className="btn-timeout" onClick={handleTimeOut}>↑ Time Out</button>}
            {timeState === 'timed-out' && <button className="btn-timein"  disabled>✓ Done for today</button>}

            {/* Recent Logs */}
            <div className="attendance-log">
              <div className="log-title">Recent Attendance</div>
              <div className="log-rows">
                {logs.map((log, i) => (
                  <div className="log-row" key={i}>
                    <span className="log-row-date">{log.date}</span>
                    <div className="log-row-times">
                      <span className="log-time-in">↓ {log.timeIn}</span>
                      <span className="log-time-out">↑ {log.timeOut}</span>
                    </div>
                    <span className="log-duration">{log.duration}</span>
                  </div>
                ))}
              </div>

              {/* Show More Button */}
              <button className="btn-show-more" onClick={() => setPage('attendance')}>
                View Full History →
              </button>
            </div>
          </div>

          {/* Tasks Card */}
          <div className="tasks-card">
            <div className="card-header">
              <div className="card-title">Tasks & Activities</div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <span style={{ fontSize: '0.72rem', color: 'var(--muted)' }}>
                  {MOCK_TASKS.filter(t => t.status !== 'done').length} remaining
                </span>
                <button className="btn-show-more" style={{ margin: 0, width: 'auto', padding: '5px 12px' }} onClick={() => setPage('tasks')}>
                  View All →
                </button>
              </div>
            </div>

            <div className="tasks-filters">
              {FILTERS.map(f => (
                <button
                  key={f}
                  className={`filter-btn ${filter === f ? 'active' : ''}`}
                  onClick={() => setFilter(f)}
                >
                  {f}
                </button>
              ))}
            </div>

            <div className="tasks-list">
              {filteredTasks.length === 0 ? (
                <div className="tasks-empty">
                  <span className="tasks-empty-icon">📭</span>
                  No tasks in this category.
                </div>
              ) : (
                filteredTasks.map(task => (
                  <div className="task-item" key={task.id}>
                    <div className={`task-priority-bar ${task.priority}`} />
                    <div className="task-content">
                      <div className="task-top">
                        <div className="task-title">{task.title}</div>
                      </div>
                      <div className="task-desc">{task.desc}</div>
                      <div className="task-meta">
                        <span className={`priority-tag ${task.priority}`}>
                          {task.priority === 'high' ? '↑ High' : task.priority === 'medium' ? '→ Medium' : '↓ Low'}
                        </span>
                        <span className={`status-tag ${task.status}`}>
                          {STATUS_LABELS[task.status]}
                        </span>
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