import { useState, useEffect } from 'react'
import './AttendancePage.css'
import { getAttendanceLogs } from '../../firebase'

function formatLog(log) {
  const timeInStr  = log.timeIn?.toDate  ? log.timeIn.toDate().toLocaleTimeString('en-US',  { hour: '2-digit', minute: '2-digit', hour12: true }) : '—'
  const timeOutStr = log.timeOut?.toDate ? log.timeOut.toDate().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true }) : '—'
  const dateStr    = log.date ? new Date(log.date + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric', weekday: 'short' }) : '—'
  return { date: dateStr, timeIn: timeInStr, timeOut: timeOutStr, duration: log.duration || '—' }
}

// Get list of unique "YYYY-MM" months from logs, sorted newest first
function getAvailableMonths(logs) {
  const months = [...new Set(logs.map(l => l.date?.slice(0, 7)).filter(Boolean))]
  return months.sort((a, b) => b.localeCompare(a))
}

function monthLabel(ym) {
  const [year, month] = ym.split('-')
  const date = new Date(parseInt(year), parseInt(month) - 1, 1)
  return date.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })
}

export default function AttendancePage({ uid, onBack }) {
  const [logs, setLogs]           = useState([])
  const [loading, setLoading]     = useState(true)
  const [selectedMonth, setSelectedMonth] = useState('all')

  useEffect(() => {
    if (!uid) return
    getAttendanceLogs(uid)
      .then(setLogs)
      .catch(console.error)
      .finally(() => setLoading(false))
  }, [uid])

  const availableMonths = getAvailableMonths(logs)

  const filtered = selectedMonth === 'all'
    ? logs
    : logs.filter(l => l.date?.startsWith(selectedMonth))

  const presentDays = filtered.length
  const totalMins   = filtered
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

        {/* Page Header */}
        <div className="page-header">
          <button className="btn-back" onClick={onBack}>← Back</button>
          <div className="page-header-text">
            <div className="page-title">Attendance History</div>
            <div className="page-subtitle">Your complete time-in / time-out records</div>
          </div>
        </div>

        {/* Month Selector + Summary */}
        <div className="attendance-controls">
          <div className="month-select-wrap">
            <span className="month-select-label">📅 Month:</span>
            <select
              className="month-select"
              value={selectedMonth}
              onChange={e => setSelectedMonth(e.target.value)}
            >
              <option value="all">All Time</option>
              {availableMonths.map(m => (
                <option key={m} value={m}>{monthLabel(m)}</option>
              ))}
            </select>
          </div>
          <div className="attendance-summary" style={{ gridTemplateColumns: 'repeat(2, 1fr)', flex: 1 }}>
            <div className="summary-card"><div className="summary-label">Days Present</div><div className="summary-value green">{presentDays}</div></div>
            <div className="summary-card"><div className="summary-label">Total Hours</div><div className="summary-value blue">{totalHrsFormatted}</div></div>
          </div>
        </div>

        {/* Table */}
        <div className="attendance-table-card">
          <div className="table-header" style={{ gridTemplateColumns: '1.2fr 1fr 1fr 0.8fr' }}>
            <div className="th">Date</div>
            <div className="th">Time In</div>
            <div className="th">Time Out</div>
            <div className="th">Duration</div>
          </div>
          <div className="table-rows">
            {loading ? (
              <div className="table-empty">Loading...</div>
            ) : filtered.length === 0 ? (
              <div className="table-empty">No records for this month.</div>
            ) : (
              filtered.map((log, i) => {
                const f = formatLog(log)
                return (
                  <div className="table-row" key={i} style={{ gridTemplateColumns: '1.2fr 1fr 1fr 0.8fr' }}>
                    <div className="td date">{f.date}</div>
                    <div className="td time-in">↓ {f.timeIn}</div>
                    <div className="td time-out">↑ {f.timeOut}</div>
                    <div className="td"><span className="duration">{f.duration}</span></div>
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