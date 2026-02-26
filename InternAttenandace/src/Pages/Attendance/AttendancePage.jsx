import './AttendancePage.css'

// ── Mock full attendance history (replace with Firebase data later) ──
const ALL_LOGS = [
  { date: 'Feb 26, Wed', timeIn: '8:00 AM', timeOut: '5:02 PM', duration: '9h 02m', status: 'complete' },
  { date: 'Feb 25, Tue', timeIn: '8:10 AM', timeOut: '5:00 PM', duration: '8h 50m', status: 'complete' },
  { date: 'Feb 24, Mon', timeIn: '8:02 AM', timeOut: '5:04 PM', duration: '9h 02m', status: 'complete' },
  { date: 'Feb 23, Sun', timeIn: '8:15 AM', timeOut: '5:00 PM', duration: '8h 45m', status: 'complete' },
  { date: 'Feb 22, Sat', timeIn: '8:00 AM', timeOut: '4:58 PM', duration: '8h 58m', status: 'complete' },
  { date: 'Feb 21, Fri', timeIn: '—',       timeOut: '—',       duration: '—',      status: 'absent'   },
  { date: 'Feb 20, Thu', timeIn: '8:32 AM', timeOut: '5:01 PM', duration: '8h 29m', status: 'late'     },
  { date: 'Feb 19, Wed', timeIn: '8:05 AM', timeOut: '5:00 PM', duration: '8h 55m', status: 'complete' },
  { date: 'Feb 18, Tue', timeIn: '8:00 AM', timeOut: '5:10 PM', duration: '9h 10m', status: 'complete' },
  { date: 'Feb 17, Mon', timeIn: '8:20 AM', timeOut: '5:00 PM', duration: '8h 40m', status: 'late'     },
  { date: 'Feb 16, Sun', timeIn: '8:00 AM', timeOut: '4:55 PM', duration: '8h 55m', status: 'complete' },
  { date: 'Feb 15, Sat', timeIn: '—',       timeOut: '—',       duration: '—',      status: 'absent'   },
]

const FILTERS = ['All', 'Complete', 'Late', 'Absent']

const STATUS_LABEL = { complete: 'Complete', late: 'Late', absent: 'Absent' }

export default function AttendancePage({ onBack }) {
  const filter   = 'All'
  const filtered = ALL_LOGS.filter(l => filter === 'All' || STATUS_LABEL[l.status] === filter)

  const totalDays    = ALL_LOGS.length
  const presentDays  = ALL_LOGS.filter(l => l.status !== 'absent').length
  const totalHours   = ALL_LOGS
    .filter(l => l.duration !== '—')
    .reduce((acc, l) => {
      const [h, m] = l.duration.replace('h','').replace('m','').trim().split(' ')
      return acc + parseInt(h) * 60 + parseInt(m)
    }, 0)
  const totalHrsFormatted = `${Math.floor(totalHours / 60)}h ${totalHours % 60}m`

  return (
    <div className="attendance-page">
      {/* Reuse topbar from dashboard styles */}
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

        {/* Summary Cards */}
        <div className="attendance-summary">
          <div className="summary-card">
            <div className="summary-label">Days Present</div>
            <div className="summary-value green">{presentDays}</div>
          </div>
          <div className="summary-card">
            <div className="summary-label">Total Hours</div>
            <div className="summary-value blue">{totalHrsFormatted}</div>
          </div>
          <div className="summary-card">
            <div className="summary-label">Absences</div>
            <div className="summary-value orange">{ALL_LOGS.filter(l => l.status === 'absent').length}</div>
          </div>
        </div>

        {/* Table */}
        <div className="attendance-table-card">
          <div className="table-header">
            <div className="th">Date</div>
            <div className="th">Time In</div>
            <div className="th">Time Out</div>
            <div className="th">Duration</div>
            <div className="th">Status</div>
          </div>
          <div className="table-rows">
            {filtered.length === 0 ? (
              <div className="table-empty">No records found.</div>
            ) : (
              filtered.map((log, i) => (
                <div className="table-row" key={i}>
                  <div className="td date">{log.date}</div>
                  <div className="td time-in">↓ {log.timeIn}</div>
                  <div className="td time-out">↑ {log.timeOut}</div>
                  <div className="td"><span className="duration">{log.duration}</span></div>
                  <div className="td status-col">
                    <span className={`row-status ${log.status}`}>{STATUS_LABEL[log.status]}</span>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

      </div>
    </div>
  )
}