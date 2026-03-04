import { useState, useEffect } from 'react'
import './AttendancePage.css'
import { getAttendanceLogs } from '../../firebase'

function formatLog(log) {
  const timeInStr  = log.timeIn?.toDate  ? log.timeIn.toDate().toLocaleTimeString('en-US',  { hour: '2-digit', minute: '2-digit', hour12: true }) : '—'
  const timeOutStr = log.timeOut?.toDate ? log.timeOut.toDate().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true }) : '—'
  const dateStr    = log.date ? new Date(log.date + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric', weekday: 'short' }) : '—'
  return { date: dateStr, timeIn: timeInStr, timeOut: timeOutStr, duration: log.duration || '—' }
}

function getAvailableMonths(logs) {
  const months = [...new Set(logs.map(l => l.date?.slice(0, 7)).filter(Boolean))]
  return months.sort((a, b) => b.localeCompare(a))
}

function monthLabel(ym) {
  const [year, month] = ym.split('-')
  return new Date(parseInt(year), parseInt(month) - 1, 1)
    .toLocaleDateString('en-US', { month: 'long', year: 'numeric' })
}

async function downloadMyExcel(user, logs) {
  if (!logs.length) return alert('No attendance records to export.')
  const XLSX     = await import('https://cdn.sheetjs.com/xlsx-0.20.1/package/xlsx.mjs')
  const wb       = XLSX.utils.book_new()
  const shiftMap = { morning: 'Morning', mid: 'Mid', gy: 'GY' }

  const fmt = (ts) => ts?.toDate ? ts.toDate().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true }) : '—'

  // Group by month
  const byMonth = {}
  logs.forEach(r => {
    const month = r.date?.slice(0, 7)
    if (!month) return
    if (!byMonth[month]) byMonth[month] = []
    byMonth[month].push(r)
  })

  Object.keys(byMonth).sort().forEach(month => {
    const [year, mon] = month.split('-')
    const sheetName   = new Date(parseInt(year), parseInt(mon) - 1, 1)
      .toLocaleDateString('en-US', { month: 'long', year: 'numeric' })

    const rows = byMonth[month].map(r => ({
      'Date':      r.date || '—',
      'Shift':     shiftMap[r.shift] || r.shift || '—',
      'Time In':   fmt(r.timeIn),
      'Time Out':  fmt(r.timeOut),
      'Duration':  r.duration || '—',
      'Status':    !r.timeOut ? 'No Time Out' : r.status === 'late' ? 'Late' : 'Complete',
    }))

    const ws = XLSX.utils.json_to_sheet([])
    XLSX.utils.sheet_add_aoa(ws, [
      [`Attendance Report — ${user.name}`],
      [`${user.email}  |  Shift: ${shiftMap[user.shift] || user.shift}  |  ${sheetName}`],
      [],
    ], { origin: 'A1' })
    XLSX.utils.sheet_add_json(ws, rows, { origin: 'A4' })

    // Summary
    const lastRow = 4 + rows.length + 1
    XLSX.utils.sheet_add_aoa(ws, [
      [],
      [`Total: ${rows.length} days`, '', `Late: ${rows.filter(r => r['Status'] === 'Late').length}`, '', `Missing Time Out: ${rows.filter(r => r['Status'] === 'No Time Out').length}`],
    ], { origin: `A${lastRow}` })

    ws['!cols']   = [{ wch: 14 }, { wch: 10 }, { wch: 12 }, { wch: 12 }, { wch: 12 }, { wch: 16 }]
    ws['!merges'] = [{ s: { r: 0, c: 0 }, e: { r: 0, c: 5 } }, { s: { r: 1, c: 0 }, e: { r: 1, c: 5 } }]
    XLSX.utils.book_append_sheet(wb, ws, sheetName.slice(0, 31))
  })

  XLSX.writeFile(wb, `${user.name.replace(/\s+/g, '_')}_Attendance.xlsx`)
}

export default function AttendancePage({ uid, user, onBack }) {
  const [logs, setLogs]                   = useState([])
  const [loading, setLoading]             = useState(true)
  const [selectedMonth, setSelectedMonth] = useState('all')
  const [downloading, setDownloading]     = useState(false)

  useEffect(() => {
    if (!uid) return
    getAttendanceLogs(uid)
      .then(setLogs)
      .catch(console.error)
      .finally(() => setLoading(false))
  }, [uid])

  const availableMonths = getAvailableMonths(logs)
  const filtered        = selectedMonth === 'all' ? logs : logs.filter(l => l.date?.startsWith(selectedMonth))
  const presentDays     = filtered.length
  const totalMins       = filtered
    .filter(l => l.duration && l.duration !== '—')
    .reduce((acc, l) => {
      const match = l.duration.match(/(\d+)h\s*(\d+)m/)
      if (!match) return acc
      return acc + parseInt(match[1]) * 60 + parseInt(match[2])
    }, 0)
  const totalHrsFormatted = `${Math.floor(totalMins / 60)}h ${totalMins % 60}m`

  const handleDownload = async () => {
    setDownloading(true)
    await downloadMyExcel(user, logs)
    setDownloading(false)
  }

  return (
    <div className="attendance-page">
      <header className="topbar">
        <div className="topbar-logo">Infocom<span>OJT</span></div>
      </header>
      <div className="attendance-body">

        {/* Page Header */}
        <div className="page-header">
          <button className="btn-back" onClick={onBack}>← Back</button>
          <div className="page-header-text">
            <div className="page-title">Attendance History</div>
            <div className="page-subtitle">Your complete time-in / time-out records</div>
          </div>
          <button
            className="btn-download-excel"
            onClick={handleDownload}
            disabled={downloading || loading}
            style={{ marginLeft: 'auto', fontSize: '0.75rem', padding: '8px 16px' }}
          >
            {downloading ? '⏳ Generating...' : '📥 Download Excel'}
          </button>
        </div>

        {/* Month Selector + Summary */}
        <div className="attendance-controls">
          <div className="month-select-wrap">
            <span className="month-select-label">📅 Month:</span>
            <select className="month-select" value={selectedMonth} onChange={e => setSelectedMonth(e.target.value)}>
              <option value="all">All Time</option>
              {availableMonths.map(m => <option key={m} value={m}>{monthLabel(m)}</option>)}
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