import { useState, useEffect } from 'react'
import './AttendancePage.css'
import { getAttendanceLogs } from '../../firebase'

function formatLog(log) {
  const timeInStr  = log.timeIn?.toDate  ? log.timeIn.toDate().toLocaleTimeString('en-US',  { hour: '2-digit', minute: '2-digit', hour12: true }) : '—'
  const timeOutStr = log.timeOut?.toDate ? log.timeOut.toDate().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true }) : '—'
  const dateStr    = log.date ? new Date(log.date + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric', weekday: 'short' }) : '—'
  return { date: dateStr, timeIn: timeInStr, timeOut: timeOutStr, duration: log.duration || '—', status: log.status || 'complete' }
}

const FILTERS = ['All', 'Complete', 'Late', 'Absent']

export default function AttendancePage({ uid, onBack }) {
  const [logs, setLogs]       = useState([])
  const [filter, setFilter]   = useState('All')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!uid) return
    getAttendanceLogs(uid)
      .then(setLogs)
      .catch(console.error)
      .finally(() => setLoading(false))
  }, [uid])

  const filtered = logs.filter(l => {
    if (filter === 'All') return true
    return l.status?.toLowerCase() === filter.toLowerCase()
  })

  const presentDays = logs.filter(l => l.status !== 'absent').length
  const absences    = logs.filter(l => l.status === 'absent').length
  const totalMins   = logs
    .filter(l => l.duration && l.duration !== '—')
    .reduce((acc, l) => {
      const match = l.duration.match(/(\d+)h\s*(\d+)m/)
      if (!match) return acc
      return acc + parseInt(match[1]) * 60 + parseInt(match[2])
    }, 0)
  const totalHrsFormatted = `${Math.floor(totalMins / 60)}h ${totalMins % 60}m`

  return (
    <div className="attendance-page">
      <header className="topbar">
        <div className="topbar-logo">Track<span>OJT</span></div>
      </header>
      <div className="attendance-body">
        <div className="page-header">
          <button className="btn-back" onClick={onBack}>← Back</button>
          <div className="page-header-text">
            <div className="page-title">Attendance History</div>
            <div className="page-subtitle">Your complete time-in / time-out records</div>
          </div>
        </div>

        <div className="attendance-summary">
          <div className="summary-card"><div className="summary-label">Days Present</div><div className="summary-value green">{presentDays}</div></div>
          <div className="summary-card"><div className="summary-label">Total Hours</div><div className="summary-value blue">{totalHrsFormatted}</div></div>
          <div className="summary-card"><div className="summary-label">Absences</div><div className="summary-value orange">{absences}</div></div>
        </div>

        <div className="attendance-filters">
          {FILTERS.map(f => (
            <button key={f} className={`filter-btn ${filter === f ? 'active' : ''}`} onClick={() => setFilter(f)}>{f}</button>
          ))}
        </div>

        <div className="attendance-table-card">
          <div className="table-header">
            <div className="th">Date</div>
            <div className="th">Time In</div>
            <div className="th">Time Out</div>
            <div className="th">Duration</div>
            <div className="th">Status</div>
          </div>
          <div className="table-rows">
            {loading ? (
              <div className="table-empty">Loading...</div>
            ) : filtered.length === 0 ? (
              <div className="table-empty">No records found.</div>
            ) : (
              filtered.map((log, i) => {
                const f = formatLog(log)
                return (
                  <div className="table-row" key={i}>
                    <div className="td date">{f.date}</div>
                    <div className="td time-in">↓ {f.timeIn}</div>
                    <div className="td time-out">↑ {f.timeOut}</div>
                    <div className="td"><span className="duration">{f.duration}</span></div>
                    <div className="td status-col">
                      <span className={`row-status ${f.status}`}>{f.status.charAt(0).toUpperCase() + f.status.slice(1)}</span>
                    </div>
                  </div>
                )
              })
            )}
          </div>
        </div>
      </div>
    </div>
  )
}