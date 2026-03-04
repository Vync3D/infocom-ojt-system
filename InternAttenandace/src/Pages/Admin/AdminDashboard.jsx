import { useState, useEffect } from 'react'
import './AdminDashboard.css'
import {
  getAllInterns, addIntern, removeIntern,
  getAllTasks, assignTask, assignGroupTask, deleteTask,
  getAttendanceLogs, getTodayAttendance, logoutUser, updateInternShift,
  getShiftSettings, saveShiftSettings, editAttendanceRecord,
  getAllAttendanceInRange
} from '../../firebase'

// ── Helpers ──
function getInitials(name) {
  return name?.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase() || '??'
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
function formatLog(log) {
  const timeInStr  = log.timeIn?.toDate  ? log.timeIn.toDate().toLocaleTimeString('en-US',  { hour: '2-digit', minute: '2-digit', hour12: true }) : '—'
  const timeOutStr = log.timeOut?.toDate ? log.timeOut.toDate().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true }) : '—'
  const dateStr    = log.date ? new Date(log.date + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric', weekday: 'short' }) : '—'
  return { date: dateStr, timeIn: timeInStr, timeOut: timeOutStr, duration: log.duration || '—' }
}

const STATUS_LABELS   = { pending: 'Pending', 'in-progress': 'In Progress', done: 'Done' }
const PRIORITY_LABELS = { high: '↑ High', medium: '→ Medium', low: '↓ Low' }

function to12Hour(time24) {
  if (!time24) return ''
  const [h, m] = time24.split(':').map(Number)
  const ampm = h >= 12 ? 'PM' : 'AM'
  const h12  = h % 12 || 12
  return `${h12}:${m.toString().padStart(2, '0')} ${ampm}`
}

// ── Confirm Delete Modal ──
function ConfirmModal({ name, onConfirm, onCancel }) {
  return (
    <div className="modal-overlay">
      <div className="modal">
        <div className="modal-title">Remove Intern</div>
        <div className="modal-sub">Are you sure you want to remove <strong>{name}</strong>? This cannot be undone.</div>
        <div className="modal-actions">
          <button className="btn-modal-cancel" onClick={onCancel}>Cancel</button>
          <button className="btn-modal-confirm" style={{ background: '#ff5f57' }} onClick={onConfirm}>Remove</button>
        </div>
      </div>
    </div>
  )
}

// ── Helpers ──
function generatePassword() {
  // 8 digit number password
  return Math.floor(10000000 + Math.random() * 90000000).toString()
}

// ── Add Intern Modal ──
function AddInternModal({ onAdd, onCancel, shiftSettings }) {
  const [form, setForm]       = useState({
    firstName: '', lastName: '', email: '',
    password: generatePassword(),
    hoursRequired: '600', shift: 'morning'
  })
  const [loading, setLoading] = useState(false)
  const [error, setError]     = useState('')
  const [created, setCreated] = useState(null) // holds { name, email, password } after success
  const [copied, setCopied]   = useState(false)

  const handleChange = e => setForm(p => ({ ...p, [e.target.name]: e.target.value }))

  const handleSubmit = async (e) => {
    e.preventDefault(); setLoading(true); setError('')
    try {
      const fullName = `${form.firstName.trim()} ${form.lastName.trim()}`
      await onAdd({ ...form, name: fullName })
      setCreated({ name: fullName, email: form.email, password: form.password })
    } catch (err) { setError(err.message) }
    finally { setLoading(false) }
  }

  const handleCopy = () => {
    navigator.clipboard.writeText(
      `Name: ${created.name}\nEmail: ${created.email}\nPassword: ${created.password}`
    )
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const shiftLabel = (key) => {
    const s = shiftSettings[key]
    return `${s.label} (${to12Hour(s.start)} – ${to12Hour(s.end)})`
  }

  // ── Success screen ──
  if (created) return (
    <div className="modal-overlay"><div className="modal">
      <div style={{ textAlign: 'center', marginBottom: 20 }}>
        <div style={{ fontSize: '2rem', marginBottom: 8 }}>✅</div>
        <div className="modal-title">Intern Created!</div>
        <div className="modal-sub">Share these credentials with the intern.</div>
      </div>
      <div className="credentials-box">
        <div className="credential-row"><span className="credential-label">Name</span><span className="credential-value">{created.name}</span></div>
        <div className="credential-row"><span className="credential-label">Email</span><span className="credential-value">{created.email}</span></div>
        <div className="credential-row"><span className="credential-label">Password</span><span className="credential-value credential-password">{created.password}</span></div>
      </div>
      <div className="modal-actions" style={{ marginTop: 20 }}>
        <button className="btn-modal-cancel" onClick={onCancel}>Close</button>
        <button className="btn-modal-confirm" onClick={handleCopy}>
          {copied ? '✓ Copied!' : '📋 Copy Credentials'}
        </button>
      </div>
    </div></div>
  )

  return (
    <div className="modal-overlay"><div className="modal">
      <div className="modal-title">Add New Intern</div>
      <div className="modal-sub">Creates a login account for the intern.</div>
      <form className="modal-form" onSubmit={handleSubmit}>
        {/* Split name fields */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          <div className="modal-field"><label>First Name</label><input name="firstName" placeholder="e.g. Maria" value={form.firstName} onChange={handleChange} required /></div>
          <div className="modal-field"><label>Last Name</label><input name="lastName" placeholder="e.g. Santos" value={form.lastName} onChange={handleChange} required /></div>
        </div>
        <div className="modal-field"><label>Email</label><input name="email" type="email" placeholder="e.g. maria@email.com" value={form.email} onChange={handleChange} required /></div>
        {/* Auto-generated password */}
        <div className="modal-field">
          <label>Password <span style={{ color: 'var(--muted)', fontWeight: 400, textTransform: 'none', letterSpacing: 0 }}>(auto-generated)</span></label>
          <div style={{ display: 'flex', gap: 8 }}>
            <input name="password" value={form.password} onChange={handleChange} style={{ flex: 1, fontFamily: 'var(--font-display)', letterSpacing: '0.1em', fontSize: '1rem' }} required />
            <button type="button" className="btn-icon" style={{ whiteSpace: 'nowrap' }} onClick={() => setForm(p => ({ ...p, password: generatePassword() }))}>↻ New</button>
          </div>
        </div>
        <div className="modal-field"><label>Required OJT Hours</label><input name="hoursRequired" type="number" value={form.hoursRequired} onChange={handleChange} /></div>
        <div className="modal-field">
          <label>Shift</label>
          <select name="shift" value={form.shift} onChange={handleChange}>
            <option value="morning">{shiftLabel('morning')}</option>
            <option value="mid">{shiftLabel('mid')}</option>
            <option value="gy">{shiftLabel('gy')}</option>
          </select>
        </div>
        {error && <div style={{ color: '#ff5f57', fontSize: '0.75rem', padding: '8px 0' }}>{error}</div>}
        <div className="modal-actions">
          <button type="button" className="btn-modal-cancel" onClick={onCancel}>Cancel</button>
          <button type="submit" className="btn-modal-confirm" disabled={loading}>{loading ? 'Creating...' : 'Add Intern'}</button>
        </div>
      </form>
    </div></div>
  )
}

// ── Assign SOLO Task Modal ──
function AssignSoloModal({ interns, onAssign, onCancel }) {
  const [form, setForm]       = useState({ internUid: interns[0]?.uid || '', title: '', desc: '', priority: 'medium' })
  const [loading, setLoading] = useState(false)
  const handleChange = e => setForm(p => ({ ...p, [e.target.name]: e.target.value }))
  const handleSubmit = async (e) => {
    e.preventDefault(); setLoading(true)
    await onAssign(form); setLoading(false)
  }
  return (
    <div className="modal-overlay"><div className="modal">
      <div className="modal-title">Assign Solo Task</div>
      <div className="modal-sub">Assign a task to a single intern.</div>
      <form className="modal-form" onSubmit={handleSubmit}>
        <div className="modal-field">
          <label>Assign To</label>
          <select name="internUid" value={form.internUid} onChange={handleChange}>
            {interns.map(i => <option key={i.uid} value={i.uid}>{i.name}</option>)}
          </select>
        </div>
        <div className="modal-field"><label>Task Title</label><input name="title" placeholder="e.g. Fix login bug" value={form.title} onChange={handleChange} required /></div>
        <div className="modal-field"><label>Description</label><input name="desc" placeholder="Task details..." value={form.desc} onChange={handleChange} /></div>
        <div className="modal-field">
          <label>Priority</label>
          <select name="priority" value={form.priority} onChange={handleChange}>
            <option value="high">High</option><option value="medium">Medium</option><option value="low">Low</option>
          </select>
        </div>
        <div className="modal-actions">
          <button type="button" className="btn-modal-cancel" onClick={onCancel}>Cancel</button>
          <button type="submit" className="btn-modal-confirm" disabled={loading}>{loading ? 'Assigning...' : 'Assign Task'}</button>
        </div>
      </form>
    </div></div>
  )
}

// ── Assign GROUP Task Modal ──
function AssignGroupModal({ interns, onAssign, onCancel }) {
  const [title, setTitle]         = useState('')
  const [desc, setDesc]           = useState('')
  const [priority, setPriority]   = useState('medium')
  const [leaderUid, setLeaderUid] = useState(interns[0]?.uid || '')
  const [memberUids, setMemberUids] = useState(interns[0] ? [interns[0].uid] : [])
  const [loading, setLoading]     = useState(false)
  const [error, setError]         = useState('')

  const toggleMember = (uid) => {
    setMemberUids(prev =>
      prev.includes(uid) ? prev.filter(id => id !== uid) : [...prev, uid]
    )
  }

  // Leader must always be a member
  const handleLeaderChange = (uid) => {
    setLeaderUid(uid)
    setMemberUids(prev => prev.includes(uid) ? prev : [...prev, uid])
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (memberUids.length < 2) { setError('A group task needs at least 2 members.'); return }
    if (!leaderUid) { setError('Please select a group leader.'); return }
    setLoading(true)
    await onAssign({ title, desc, priority, leaderUid, memberUids })
    setLoading(false)
  }

  return (
    <div className="modal-overlay"><div className="modal" style={{ maxWidth: 520 }}>
      <div className="modal-title">Assign Group Task</div>
      <div className="modal-sub">Assign a task to multiple interns. Only the leader can update the status.</div>
      <form className="modal-form" onSubmit={handleSubmit}>
        <div className="modal-field"><label>Task Title</label><input placeholder="e.g. Sprint 1 Feature Build" value={title} onChange={e => setTitle(e.target.value)} required /></div>
        <div className="modal-field"><label>Description</label><input placeholder="Task details..." value={desc} onChange={e => setDesc(e.target.value)} /></div>
        <div className="modal-field">
          <label>Priority</label>
          <select value={priority} onChange={e => setPriority(e.target.value)}>
            <option value="high">High</option><option value="medium">Medium</option><option value="low">Low</option>
          </select>
        </div>

        {/* Member picker */}
        <div className="modal-field">
          <label>Select Members <span style={{ color: 'var(--muted)', fontWeight: 400, textTransform: 'none', letterSpacing: 0 }}>({memberUids.length} selected)</span></label>
          <div className="member-picker">
            {interns.map(intern => (
              <div
                key={intern.uid}
                className={`member-chip ${memberUids.includes(intern.uid) ? 'selected' : ''}`}
                onClick={() => toggleMember(intern.uid)}
              >
                <div className="member-chip-avatar">{getInitials(intern.name)}</div>
                <span>{intern.name}</span>
                {memberUids.includes(intern.uid) && <span className="member-chip-check">✓</span>}
              </div>
            ))}
          </div>
        </div>

        {/* Leader picker — only shows selected members */}
        {memberUids.length > 0 && (
          <div className="modal-field">
            <label>Group Leader</label>
            <select value={leaderUid} onChange={e => handleLeaderChange(e.target.value)}>
              {interns.filter(i => memberUids.includes(i.uid)).map(i => (
                <option key={i.uid} value={i.uid}>{i.name}</option>
              ))}
            </select>
          </div>
        )}

        {error && <div style={{ color: '#ff5f57', fontSize: '0.75rem' }}>{error}</div>}
        <div className="modal-actions">
          <button type="button" className="btn-modal-cancel" onClick={onCancel}>Cancel</button>
          <button type="submit" className="btn-modal-confirm" disabled={loading}>{loading ? 'Assigning...' : 'Assign Group Task'}</button>
        </div>
      </form>
    </div></div>
  )
}

// ── Download Excel Modal ──
function DownloadExcelModal({ interns, onCancel }) {
  const today     = new Date().toISOString().split('T')[0]
  const monthAgo  = new Date(); monthAgo.setMonth(monthAgo.getMonth() - 1)
  const [dateFrom, setDateFrom] = useState(monthAgo.toISOString().split('T')[0])
  const [dateTo,   setDateTo]   = useState(today)
  const [loading,  setLoading]  = useState(false)
  const [error,    setError]    = useState('')

  const fmt = (ts) => {
    if (!ts?.toDate) return '—'
    return ts.toDate().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true })
  }

  const handleDownload = async () => {
    if (dateFrom > dateTo) { setError('Start date must be before end date.'); return }
    setLoading(true); setError('')
    try {
      const records = await getAllAttendanceInRange(dateFrom, dateTo)

      // Build a lookup: uid → intern name/shift
      const internMap = {}
      interns.forEach(i => { internMap[i.uid] = i })

      // Group records by month (YYYY-MM)
      const byMonth = {}
      records.forEach(r => {
        const month = r.date?.slice(0, 7)
        if (!month) return
        if (!byMonth[month]) byMonth[month] = []
        byMonth[month].push(r)
      })

      // Load SheetJS dynamically
      const XLSX = await import('https://cdn.sheetjs.com/xlsx-0.20.1/package/xlsx.mjs')
      const wb   = XLSX.utils.book_new()

      const months = Object.keys(byMonth).sort()
      if (months.length === 0) {
        setError('No attendance records found in this date range.'); setLoading(false); return
      }

      months.forEach(month => {
        const [year, mon] = month.split('-')
        const sheetName   = new Date(parseInt(year), parseInt(mon) - 1, 1)
          .toLocaleDateString('en-US', { month: 'long', year: 'numeric' })

        const rows = byMonth[month].map(r => {
          const intern   = internMap[r.uid]
          const shiftMap = { morning: 'Morning', mid: 'Mid', gy: 'GY' }
          return {
            'Name':      intern?.name  || 'Unknown',
            'Email':     intern?.email || '—',
            'Shift':     shiftMap[r.shift] || r.shift || '—',
            'Date':      r.date || '—',
            'Time In':   fmt(r.timeIn),
            'Time Out':  fmt(r.timeOut),
            'Duration':  r.duration || '—',
            'Status':    r.timeOut ? (r.status === 'late' ? 'Late' : 'Complete') : 'No Time Out',
          }
        })

        const ws = XLSX.utils.json_to_sheet(rows)

        // Column widths
        ws['!cols'] = [
          { wch: 22 }, { wch: 26 }, { wch: 10 },
          { wch: 14 }, { wch: 12 }, { wch: 12 },
          { wch: 12 }, { wch: 14 },
        ]

        // Header row bold styling
        const range = XLSX.utils.decode_range(ws['!ref'])
        for (let C = range.s.c; C <= range.e.c; C++) {
          const cell = ws[XLSX.utils.encode_cell({ r: 0, c: C })]
          if (cell) {
            cell.s = {
              font:      { bold: true, name: 'Arial', sz: 11, color: { rgb: 'FFFFFF' } },
              fill:      { fgColor: { rgb: '1E293B' } },
              alignment: { horizontal: 'center' },
            }
          }
        }

        XLSX.utils.book_append_sheet(wb, ws, sheetName.slice(0, 31))
      })

      // File name: InfocomOJT_Attendance_2026-01_to_2026-03.xlsx
      const fileName = `InfocomOJT_Attendance_${dateFrom}_to_${dateTo}.xlsx`
      XLSX.writeFile(wb, fileName)
      onCancel()
    } catch (e) {
      console.error(e)
      setError('Failed to generate Excel file. Please try again.')
    }
    setLoading(false)
  }

  return (
    <div className="modal-overlay"><div className="modal">
      <div className="modal-title">📥 Download Attendance</div>
      <div className="modal-sub">Export attendance records as an Excel file. Each month gets its own sheet.</div>
      <div className="modal-form">
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          <div className="modal-field">
            <label>From</label>
            <input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)} max={today} />
          </div>
          <div className="modal-field">
            <label>To</label>
            <input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)} max={today} />
          </div>
        </div>
        <div style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid var(--border)', borderRadius: 8, padding: '12px 14px', fontSize: '0.75rem', color: 'var(--muted)', lineHeight: 1.6 }}>
          📊 Records from <strong style={{ color: 'var(--text)' }}>{dateFrom}</strong> to <strong style={{ color: 'var(--text)' }}>{dateTo}</strong> will be exported.<br />
          Each month will be a separate sheet tab in the Excel file.
        </div>
        {error && <div style={{ color: '#ff5f57', fontSize: '0.75rem' }}>{error}</div>}
        <div className="modal-actions">
          <button className="btn-modal-cancel" onClick={onCancel}>Cancel</button>
          <button className="btn-modal-confirm" onClick={handleDownload} disabled={loading}>
            {loading ? '⏳ Generating...' : '⬇ Download Excel'}
          </button>
        </div>
      </div>
    </div></div>
  )
}

// ── Download Single Intern Excel Modal ──
function DownloadInternExcelModal({ intern, logs, onCancel }) {
  const [loading, setLoading] = useState(false)
  const [error,   setError]   = useState('')

  const fmt = (ts) => {
    if (!ts?.toDate) return '—'
    return ts.toDate().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true })
  }

  const handleDownload = async () => {
    if (logs.length === 0) { setError('No attendance records found for this intern.'); return }
    setLoading(true); setError('')
    try {
      const XLSX = await import('https://cdn.sheetjs.com/xlsx-0.20.1/package/xlsx.mjs')
      const wb   = XLSX.utils.book_new()
      const shiftMap = { morning: 'Morning', mid: 'Mid', gy: 'GY' }

      // Group by month
      const byMonth = {}
      logs.forEach(r => {
        const month = r.date?.slice(0, 7)
        if (!month) return
        if (!byMonth[month]) byMonth[month] = []
        byMonth[month].push(r)
      })

      const months = Object.keys(byMonth).sort()

      months.forEach(month => {
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
          'Overtime':  (() => {
            if (!r.timeOut) return '—'
            const shiftEnds = { morning: 15, mid: 22, gy: 7 }
            const endHour   = shiftEnds[r.shift] ?? 15
            const outHour   = r.timeOut.toDate().getHours()
            return outHour > endHour ? 'Yes' : 'No'
          })(),
        }))

        const ws = XLSX.utils.json_to_sheet([])

        // Title rows
        XLSX.utils.sheet_add_aoa(ws, [
          [`Attendance Report — ${intern.name}`],
          [`${intern.email}  |  Shift: ${shiftMap[intern.shift] || intern.shift}  |  ${sheetName}`],
          [],
        ], { origin: 'A1' })

        XLSX.utils.sheet_add_json(ws, rows, { origin: 'A4' })

        // Summary row
        const dataLen  = rows.length
        const lastRow  = 4 + dataLen + 1
        const doneRows = rows.filter(r => r['Status'] === 'Complete' || r['Status'] === 'Late')
        XLSX.utils.sheet_add_aoa(ws, [
          [],
          [`Total Days: ${dataLen}`, '', `Present: ${doneRows.length}`, '', `Missing Time Out: ${rows.filter(r => r['Status'] === 'No Time Out').length}`, '', `Late: ${rows.filter(r => r['Status'] === 'Late').length}`],
        ], { origin: `A${lastRow}` })

        ws['!cols'] = [{ wch: 14 }, { wch: 10 }, { wch: 12 }, { wch: 12 }, { wch: 12 }, { wch: 16 }, { wch: 10 }]

        // Merge title cell
        ws['!merges'] = [{ s: { r: 0, c: 0 }, e: { r: 0, c: 6 } }, { s: { r: 1, c: 0 }, e: { r: 1, c: 6 } }]

        XLSX.utils.book_append_sheet(wb, ws, sheetName.slice(0, 31))
      })

      const fileName = `${intern.name.replace(/\s+/g, '_')}_Attendance.xlsx`
      XLSX.writeFile(wb, fileName)
      onCancel()
    } catch (e) {
      console.error(e)
      setError('Failed to generate Excel file. Please try again.')
    }
    setLoading(false)
  }

  const months = [...new Set(logs.map(l => l.date?.slice(0, 7)).filter(Boolean))].sort()

  return (
    <div className="modal-overlay"><div className="modal">
      <div className="modal-title">📥 Download {intern.name}'s Attendance</div>
      <div className="modal-sub">Exports all attendance records for this intern. Each month gets its own sheet.</div>
      <div className="modal-form">
        {/* Summary of what will be exported */}
        <div style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid var(--border)', borderRadius: 8, padding: '14px 16px', display: 'flex', flexDirection: 'column', gap: 10 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div className="intern-avatar" style={{ width: 36, height: 36, fontSize: '0.75rem', flexShrink: 0 }}>
              {intern.name?.split(' ').map(n => n[0]).join('').slice(0,2).toUpperCase()}
            </div>
            <div>
              <div style={{ fontSize: '0.85rem', fontWeight: 700 }}>{intern.name}</div>
              <div style={{ fontSize: '0.7rem', color: 'var(--muted)' }}>{intern.email}</div>
            </div>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8, marginTop: 4 }}>
            {[['📋 Records', logs.length], ['📅 Months', months.length], ['⏱ Hours', `${Math.floor(intern.hoursRendered || 0)}h`]].map(([label, val]) => (
              <div key={label} style={{ background: 'rgba(255,255,255,0.03)', borderRadius: 6, padding: '8px 12px', textAlign: 'center' }}>
                <div style={{ fontSize: '1rem', fontWeight: 800, color: 'var(--accent)' }}>{val}</div>
                <div style={{ fontSize: '0.62rem', color: 'var(--muted)', marginTop: 2 }}>{label}</div>
              </div>
            ))}
          </div>
          {months.length > 0 && (
            <div style={{ fontSize: '0.68rem', color: 'var(--muted)' }}>
              Sheets: {months.map(m => monthLabel(m)).join(', ')}
            </div>
          )}
        </div>
        {error && <div style={{ color: '#ff5f57', fontSize: '0.75rem' }}>{error}</div>}
        <div className="modal-actions">
          <button className="btn-modal-cancel" onClick={onCancel}>Cancel</button>
          <button className="btn-modal-confirm" onClick={handleDownload} disabled={loading}>
            {loading ? '⏳ Generating...' : '⬇ Download Excel'}
          </button>
        </div>
      </div>
    </div></div>
  )
}

// ── Edit Attendance Modal ──
function EditAttendanceModal({ log, onSave, onCancel }) {
  const fmt24 = (date) => date
    ? date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false })
    : ''

  const [timeIn,  setTimeIn]  = useState(log.timeIn?.toDate  ? fmt24(log.timeIn.toDate())  : '')
  const [timeOut, setTimeOut] = useState(log.timeOut?.toDate ? fmt24(log.timeOut.toDate()) : '')
  const [saving,  setSaving]  = useState(false)
  const [error,   setError]   = useState('')

  const handleSave = async () => {
    if (!timeIn) { setError('Time in is required.'); return }
    setSaving(true); setError('')
    try { await onSave(timeIn, timeOut || null) }
    catch (e) { setError(e.message); setSaving(false) }
  }

  return (
    <div className="modal-overlay"><div className="modal">
      <div className="modal-title">Edit Attendance</div>
      <div className="modal-sub">
        Manually correct the time in/out for <strong>{log.date}</strong>.
      </div>
      <div className="modal-form">
        <div className="modal-field">
          <label>Time In</label>
          <input type="time" value={timeIn} onChange={e => setTimeIn(e.target.value)} />
        </div>
        <div className="modal-field">
          <label>Time Out <span style={{ color: 'var(--muted)', fontWeight: 400, textTransform: 'none', letterSpacing: 0 }}>(leave empty if still on shift)</span></label>
          <input type="time" value={timeOut} onChange={e => setTimeOut(e.target.value)} />
        </div>
        {error && <div style={{ color: '#ff5f57', fontSize: '0.75rem' }}>{error}</div>}
        <div className="modal-actions">
          <button className="btn-modal-cancel" onClick={onCancel}>Cancel</button>
          <button className="btn-modal-confirm" onClick={handleSave} disabled={saving}>
            {saving ? 'Saving...' : 'Save Changes'}
          </button>
        </div>
      </div>
    </div></div>
  )
}

// ── Settings Tab ──
function SettingsTab({ shiftSettings, onSave }) {
  const [settings, setSettings] = useState(JSON.parse(JSON.stringify(shiftSettings)))
  const [saved, setSaved]       = useState(false)
  const [saving, setSaving]     = useState(false)

  const handleChange = (shift, field, value) => {
    setSettings(prev => ({
      ...prev,
      [shift]: { ...prev[shift], [field]: value }
    }))
  }

  const handleSave = async () => {
    setSaving(true)
    await onSave(settings)
    setSaving(false)
    setSaved(true)
    setTimeout(() => setSaved(false), 2500)
  }

  const shiftKeys = ['morning', 'mid', 'gy']
  const shiftIcons = { morning: '🌅', mid: '🌤️', gy: '🌙' }

  return (
    <div className="admin-card">
      <div className="admin-card-header">
        <div className="admin-card-title">Shift Settings</div>
        <button className="btn-add" onClick={handleSave} disabled={saving}>
          {saving ? 'Saving...' : saved ? '✓ Saved!' : 'Save Changes'}
        </button>
      </div>
      <div className="settings-body">
        <div className="settings-desc">
          Configure the time range and late cutoff for each shift. These apply to all interns assigned to that shift.
        </div>
        <div className="shift-settings-grid">
          {shiftKeys.map(key => (
            <div className="shift-setting-card" key={key}>
              <div className="shift-setting-header">
                <span className="shift-setting-icon">{shiftIcons[key]}</span>
                <div>
                  <div className="shift-setting-name">{settings[key].label} Shift</div>
                  <div className="shift-setting-sub">
                    {to12Hour(settings[key].start)} – {to12Hour(settings[key].end)}
                  </div>
                </div>
              </div>
              <div className="shift-setting-fields">
                <div className="shift-field">
                  <label>Shift Label</label>
                  <input
                    value={settings[key].label}
                    onChange={e => handleChange(key, 'label', e.target.value)}
                  />
                </div>
                <div className="shift-field">
                  <label>Start Time</label>
                  <input
                    type="time"
                    value={settings[key].start}
                    onChange={e => handleChange(key, 'start', e.target.value)}
                  />
                </div>
                <div className="shift-field">
                  <label>End Time</label>
                  <input
                    type="time"
                    value={settings[key].end}
                    onChange={e => handleChange(key, 'end', e.target.value)}
                  />
                </div>
                <div className="shift-field">
                  <label>Late After</label>
                  <input
                    type="time"
                    value={settings[key].lateAfter}
                    onChange={e => handleChange(key, 'lateAfter', e.target.value)}
                  />
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

// ── Main Component ──
export default function AdminDashboard({ user, onLogout }) {
  const [tab, setTab]             = useState('interns')
  const [taskTab, setTaskTab]     = useState('solo')
  const [interns, setInterns]     = useState([])
  const [tasks, setTasks]         = useState([])
  const [modal, setModal]         = useState(null)
  const [selectedIntern, setSelectedIntern]       = useState(null)
  const [selectedTask, setSelectedTask]           = useState(null)
  const [viewingAttendance, setViewingAttendance] = useState(null)
  const [attendanceLogs, setAttendanceLogs]       = useState([])
  const [loadingData, setLoadingData]             = useState(true)
  const [todayAttendance, setTodayAttendance]     = useState([])
  const [selectedMonth, setSelectedMonth]         = useState('all')
  const [hoveredTaskId, setHoveredTaskId]         = useState(null)
  const [internShiftFilter, setInternShiftFilter] = useState('all')
  const [editingLog, setEditingLog]               = useState(null) // { log, internUid }
  const [shiftSettings, setShiftSettings]         = useState({
    morning: { label: 'Morning', start: '07:00', end: '15:00', lateAfter: '07:00' },
    mid:     { label: 'Mid',     start: '13:00', end: '22:00', lateAfter: '13:00' },
    gy:      { label: 'GY',      start: '22:00', end: '07:00', lateAfter: '22:00' },
  })

  useEffect(() => {
    Promise.all([getAllInterns(), getAllTasks(), getTodayAttendance(), getShiftSettings()])
      .then(([i, t, att, shifts]) => { setInterns(i); setTasks(t); setTodayAttendance(att); setShiftSettings(shifts) })
      .catch(console.error)
      .finally(() => setLoadingData(false))
  }, [])

  useEffect(() => {
    if (!viewingAttendance) return
    setSelectedMonth('all')
    getAttendanceLogs(viewingAttendance.uid).then(setAttendanceLogs).catch(console.error)
  }, [viewingAttendance])

  const handleAddIntern = async (form) => {
    await addIntern(form.email, form.password, form.name, parseInt(form.hoursRequired), form.shift)
    setInterns(await getAllInterns())
    // Don't close modal here — AddInternModal shows success screen itself
  }

  const handleRemoveIntern = async () => {
    await removeIntern(selectedIntern.uid)
    setInterns(p => p.filter(i => i.uid !== selectedIntern.uid))
    setModal(null); setSelectedIntern(null)
  }

  const handleAssignSolo = async (form) => {
    await assignTask(form.internUid, form.title, form.desc, form.priority, user?.name || 'Admin')
    setTasks(await getAllTasks()); setModal(null)
  }

  const handleAssignGroup = async (form) => {
    await assignGroupTask(form.memberUids, form.leaderUid, form.title, form.desc, form.priority, user?.name || 'Admin')
    setTasks(await getAllTasks()); setModal(null)
  }

  const handleDeleteTask = async () => {
    await deleteTask(selectedTask.id)
    setTasks(prev => prev.filter(t => t.id !== selectedTask.id))
    setModal(null); setSelectedTask(null)
  }

  const handleEditAttendance = async (timeInStr, timeOutStr) => {
    const { log, internUid } = editingLog
    const toDate = (str) => {
      const [h, m] = str.split(':').map(Number)
      const d = new Date(`${log.date}T00:00:00`)
      d.setHours(h, m, 0, 0)
      return d
    }
    const timeInDate  = toDate(timeInStr)
    const timeOutDate = timeOutStr ? toDate(timeOutStr) : null
    // If timeout is before timein (crosses midnight), add a day
    if (timeOutDate && timeOutDate < timeInDate) timeOutDate.setDate(timeOutDate.getDate() + 1)
    await editAttendanceRecord(internUid, log.date, timeInDate, timeOutDate)
    setAttendanceLogs(await getAttendanceLogs(internUid))
    setEditingLog(null)
  }

  const handleLogout = async () => { await logoutUser(); onLogout() }

  const presentCount = todayAttendance.filter(a => a.timeIn && !a.timeOut && interns.find(i => i.uid === a.uid)).length
  const soloTasks    = tasks.filter(t => t.type !== 'group')
  const groupTasks   = tasks.filter(t => t.type === 'group')

  return (
    <div className="admin-dashboard">
      {modal === 'add'          && <AddInternModal onAdd={handleAddIntern} onCancel={() => setModal(null)} shiftSettings={shiftSettings} />}
      {modal === 'assign-solo'  && <AssignSoloModal  interns={interns} onAssign={handleAssignSolo}  onCancel={() => setModal(null)} />}
      {modal === 'assign-group' && <AssignGroupModal interns={interns} onAssign={handleAssignGroup} onCancel={() => setModal(null)} />}
      {modal === 'confirm-remove' && <ConfirmModal name={selectedIntern?.name} onConfirm={handleRemoveIntern} onCancel={() => setModal(null)} />}
      {modal === 'confirm-delete-task' && (
        <div className="modal-overlay"><div className="modal">
          <div className="modal-title">Delete Task</div>
          <div className="modal-sub">Are you sure you want to delete <strong>"{selectedTask?.title}"</strong>? This cannot be undone.</div>
          <div className="modal-actions">
            <button className="btn-modal-cancel" onClick={() => { setModal(null); setSelectedTask(null) }}>Cancel</button>
            <button className="btn-modal-confirm" style={{ background: '#ff5f57' }} onClick={handleDeleteTask}>Delete</button>
          </div>
        </div></div>
      )}
      {editingLog && <EditAttendanceModal log={editingLog.log} onSave={handleEditAttendance} onCancel={() => setEditingLog(null)} />}
      {modal === 'download-excel' && <DownloadExcelModal interns={interns} onCancel={() => setModal(null)} />}
      {modal === 'download-excel-intern' && viewingAttendance && (
        <DownloadInternExcelModal intern={viewingAttendance} logs={attendanceLogs} onCancel={() => setModal(null)} />
      )}

      <header className="admin-topbar">
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div className="admin-topbar-logo">Infocom<span>OJT</span></div>
          <span className="admin-role-badge">Admin</span>
        </div>
        <div className="admin-topbar-right">
          <span style={{ fontSize: '0.75rem', color: 'var(--muted)' }}>{user?.name || 'Admin'}</span>
          <button className="btn-logout" onClick={handleLogout}>⎋ Logout</button>
        </div>
      </header>

      <div className="admin-body">
        {/* Stats */}
        <div className="admin-stats">
          <div className="admin-stat-card"><div className="admin-stat-label">Total Interns</div><div className="admin-stat-value blue">{interns.length}</div></div>

          {/* Present Now — hoverable */}
          <div className="admin-stat-card present-now-card">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div className="admin-stat-label">Present Now</div>
              <button
                className="present-refresh-btn"
                onClick={async (e) => { e.stopPropagation(); setTodayAttendance(await getTodayAttendance()) }}
                title="Refresh"
              >↺</button>
            </div>
            <div className="admin-stat-value green">{presentCount}</div>
            {/* Tooltip */}
            <div className="present-tooltip">
              <div className="present-tooltip-title">Currently In Office</div>
              {presentCount === 0 ? (
                <div className="present-tooltip-empty">No one is timed in right now.</div>
              ) : (
                todayAttendance
                  .filter(a => a.timeIn && !a.timeOut && interns.find(i => i.uid === a.uid))
                  .map(a => {
                    const intern  = interns.find(i => i.uid === a.uid)
                    const timeInStr = a.timeIn?.toDate
                      ? a.timeIn.toDate().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true })
                      : '—'
                    return (
                      <div className="present-tooltip-row" key={a.uid}>
                        <div className="present-tooltip-avatar">{getInitials(intern?.name)}</div>
                        <div>
                          <div className="present-tooltip-name">{intern?.name || 'Unknown'}</div>
                          <div className="present-tooltip-time">↓ Timed in at {timeInStr}</div>
                        </div>
                      </div>
                    )
                  })
              )}
            </div>
          </div>

          <div className="admin-stat-card"><div className="admin-stat-label">Active Tasks</div><div className="admin-stat-value muted">{tasks.filter(t => t.status !== 'done').length}</div></div>
        </div>

        {/* Main Tabs */}
        <div className="admin-tabs">
          {[['interns','👥 Interns'],['tasks','✅ Tasks'],['attendance','◷ Attendance'],['settings','⚙️ Settings']].map(([key, label]) => (
            <button key={key} className={`admin-tab ${tab === key ? 'active' : ''}`}
              onClick={() => { setTab(key); setViewingAttendance(null) }}>{label}</button>
          ))}
        </div>

        {loadingData ? (
          <div style={{ textAlign: 'center', padding: '60px', color: 'var(--muted)', fontSize: '0.8rem' }}>Loading...</div>
        ) : (
          <>
            {/* ── INTERNS TAB ── */}
            {tab === 'interns' && (
              <div className="admin-card">
                <div className="admin-card-header">
                  <div className="admin-card-title">All Interns</div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
                    {/* Shift filter */}
                    <div className="task-subtabs">
                      {[['all','All'], ['morning','🌅 Morning'], ['mid','🌤️ Mid'], ['gy','🌙 GY']].map(([val, label]) => (
                        <button
                          key={val}
                          className={`task-subtab ${internShiftFilter === val ? 'active' : ''}`}
                          onClick={() => setInternShiftFilter(val)}
                        >
                          {label}
                          <span className="subtab-count">
                            {val === 'all' ? interns.length : interns.filter(i => i.shift === val).length}
                          </span>
                        </button>
                      ))}
                    </div>
                    <button className="btn-add" onClick={() => setModal('add')}>+ Add Intern</button>
                  </div>
                </div>
                <div className="intern-table-header">
                  <div className="intern-th">Intern</div>
                  <div className="intern-th">Hours Rendered</div>
                  <div className="intern-th">Tasks</div>
                  <div className="intern-th">Actions</div>
                </div>
                <div className="intern-rows">
                  {interns.filter(intern => internShiftFilter === 'all' || intern.shift === internShiftFilter).length === 0 && internShiftFilter !== 'all' && (
                    <div style={{ padding: '48px 24px', textAlign: 'center', color: 'var(--muted)', fontSize: '0.8rem' }}>
                      No interns on {internShiftFilter} shift.
                    </div>
                  )}
                  {interns
                    .filter(intern => internShiftFilter === 'all' || intern.shift === internShiftFilter)
                    .map(intern => {
                    const internTasks = tasks.filter(t =>
                      (t.type !== 'group' && t.internUid === intern.uid) ||
                      (t.type === 'group' && t.memberUids?.includes(intern.uid))
                    )
                    const done = internTasks.filter(t => t.status === 'done').length
                    return (
                      <div className="intern-row" key={intern.uid}>
                        <div className="intern-name-cell">
                          <div className="intern-avatar">{getInitials(intern.name)}</div>
                          <div>
                            <div className="intern-name">{intern.name}</div>
                            <div style={{ display: 'flex', gap: '6px', alignItems: 'center', marginTop: '2px' }}>
                              <div className="intern-email">{intern.email}</div>
                              <span style={{
                                fontSize: '0.58rem', padding: '1px 6px', borderRadius: '100px',
                                textTransform: 'uppercase', letterSpacing: '0.07em', fontWeight: 600,
                                background: intern.shift === 'gy' ? 'rgba(0,120,255,0.08)' : intern.shift === 'mid' ? 'rgba(245,158,11,0.08)' : 'rgba(0,229,160,0.08)',
                                color: intern.shift === 'gy' ? 'var(--accent2)' : intern.shift === 'mid' ? '#f59e0b' : 'var(--accent)',
                                border: intern.shift === 'gy' ? '1px solid rgba(0,120,255,0.2)' : intern.shift === 'mid' ? '1px solid rgba(245,158,11,0.2)' : '1px solid rgba(0,229,160,0.2)',
                              }}>{intern.shift === 'gy' ? '🌙 GY' : intern.shift === 'mid' ? '🌤️ Mid' : '🌅 Morning'}</span>
                            </div>
                          </div>
                        </div>
                        <div className="intern-td">{Math.floor(intern.hoursRendered || 0)} hrs</div>
                        <div className="intern-td">{done}/{internTasks.length} done</div>
                        <div className="intern-actions">
                          <button className="btn-icon" onClick={() => { setViewingAttendance(intern); setTab('attendance') }}>◷ Attendance</button>
                          <button className="btn-icon danger" onClick={() => { setSelectedIntern(intern); setModal('confirm-remove') }}>✕</button>
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>
            )}

            {/* ── TASKS TAB ── */}
            {tab === 'tasks' && (
              <div className="admin-card">
                <div className="admin-card-header">
                  <div style={{ display: 'flex', align: 'center', gap: '12px', alignItems: 'center' }}>
                    <div className="admin-card-title">Tasks</div>
                    {/* Solo / Group subtabs */}
                    <div className="task-subtabs">
                      <button className={`task-subtab ${taskTab === 'solo' ? 'active' : ''}`} onClick={() => setTaskTab('solo')}>
                        Solo <span className="subtab-count">{soloTasks.length}</span>
                      </button>
                      <button className={`task-subtab ${taskTab === 'group' ? 'active' : ''}`} onClick={() => setTaskTab('group')}>
                        Group <span className="subtab-count">{groupTasks.length}</span>
                      </button>
                    </div>
                  </div>
                  <button className="btn-add" onClick={() => setModal(taskTab === 'solo' ? 'assign-solo' : 'assign-group')}>
                    + {taskTab === 'solo' ? 'Solo Task' : 'Group Task'}
                  </button>
                </div>

                {/* SOLO tasks list */}
                {taskTab === 'solo' && (
                  <>
                    <div className="intern-table-header" style={{ gridTemplateColumns: '1.5fr 1.2fr 0.8fr 0.8fr 0.8fr 0.5fr' }}>
                      <div className="intern-th">Task</div>
                      <div className="intern-th">Intern</div>
                      <div className="intern-th">Priority</div>
                      <div className="intern-th">Status</div>
                      <div className="intern-th">Assigned By</div>
                      <div className="intern-th"></div>
                    </div>
                    <div className="intern-rows">
                      {soloTasks.length === 0 && <div style={{ padding: '48px 24px', textAlign: 'center', color: 'var(--muted)', fontSize: '0.8rem' }}>No solo tasks yet.</div>}
                      {soloTasks.map(task => {
                        const intern = interns.find(i => i.uid === task.internUid)
                        return (
                          <div className="intern-row" key={task.id} style={{ gridTemplateColumns: '1.5fr 1.2fr 0.8fr 0.8fr 0.8fr 0.5fr' }}>
                            <div>
                              <div className="intern-name" style={{ fontSize: '0.85rem' }}>{task.title}</div>
                              {task.desc && <div className="intern-email">{task.desc.slice(0, 50)}{task.desc.length > 50 ? '...' : ''}</div>}
                            </div>
                            <div className="intern-name-cell">
                              <div className="intern-avatar" style={{ width: 28, height: 28, fontSize: '0.65rem' }}>{getInitials(intern?.name)}</div>
                              <span className="intern-td">{intern?.name || 'Unknown'}</span>
                            </div>
                            <div><span className={`priority-tag ${task.priority}`}>{PRIORITY_LABELS[task.priority]}</span></div>
                            <div><span className={`status-tag ${task.status}`}>{STATUS_LABELS[task.status]}</span></div>
                            <div className="intern-td muted">{task.assignedBy}</div>
                            <div>
                              <button className="btn-icon danger" onClick={() => { setSelectedTask(task); setModal('confirm-delete-task') }}>✕</button>
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  </>
                )}

                {/* GROUP tasks list */}
                {taskTab === 'group' && (
                  <>
                    <div className="intern-table-header" style={{ gridTemplateColumns: '1.5fr 1.2fr 1fr 0.8fr 0.5fr' }}>
                      <div className="intern-th">Task</div>
                      <div className="intern-th">Leader</div>
                      <div className="intern-th">Members</div>
                      <div className="intern-th">Status</div>
                      <div className="intern-th"></div>
                    </div>
                    <div className="intern-rows">
                      {groupTasks.length === 0 && <div style={{ padding: '48px 24px', textAlign: 'center', color: 'var(--muted)', fontSize: '0.8rem' }}>No group tasks yet.</div>}
                      {groupTasks.map(task => {
                        const leader  = interns.find(i => i.uid === task.leaderUid)
                        const members = (task.memberUids || []).map(uid => interns.find(i => i.uid === uid)).filter(Boolean)
                        return (
                          <div className="intern-row" key={task.id} style={{ gridTemplateColumns: '1.5fr 1.2fr 1fr 0.8fr 0.5fr' }}>
                            <div>
                              <div className="intern-name" style={{ fontSize: '0.85rem' }}>{task.title}</div>
                              {task.desc && <div className="intern-email">{task.desc.slice(0, 50)}{task.desc.length > 50 ? '...' : ''}</div>}
                              <span className={`priority-tag ${task.priority}`} style={{ marginTop: 6, display: 'inline-block' }}>{PRIORITY_LABELS[task.priority]}</span>
                            </div>
                            <div className="intern-name-cell">
                              <div className="intern-avatar" style={{ width: 28, height: 28, fontSize: '0.65rem' }}>{getInitials(leader?.name)}</div>
                              <div>
                                <div className="intern-td">{leader?.name || 'Unknown'}</div>
                                <div className="intern-email">Leader</div>
                              </div>
                            </div>
                            {/* Member avatars with hover tooltip */}
                            <div
                              className="member-avatars-wrap"
                              onMouseEnter={() => setHoveredTaskId(task.id)}
                              onMouseLeave={() => setHoveredTaskId(null)}
                            >
                              <div className="member-avatars">
                                {members.slice(0, 4).map((m, idx) => (
                                  <div key={m.uid} className="member-avatar-stack" style={{ zIndex: 10 - idx }}>{getInitials(m.name)}</div>
                                ))}
                                {members.length > 4 && <div className="member-avatar-stack more">+{members.length - 4}</div>}
                                <span className="intern-td" style={{ marginLeft: 8 }}>{members.length}</span>
                              </div>
                              {hoveredTaskId === task.id && (
                                <div className="members-tooltip">
                                  <div className="present-tooltip-title">Group Members</div>
                                  {members.map(m => (
                                    <div className="present-tooltip-row" key={m.uid}>
                                      <div className="present-tooltip-avatar">{getInitials(m.name)}</div>
                                      <div>
                                        <div className="present-tooltip-name">
                                          {m.name}
                                          {m.uid === task.leaderUid && <span style={{ color: 'var(--accent)', fontSize: '0.6rem', marginLeft: 6 }}>👑 Leader</span>}
                                        </div>
                                        <div className="present-tooltip-time">{m.email}</div>
                                      </div>
                                    </div>
                                  ))}
                                </div>
                              )}
                            </div>
                            <div><span className={`status-tag ${task.status}`}>{STATUS_LABELS[task.status]}</span></div>
                            <div>
                              <button className="btn-icon danger" onClick={() => { setSelectedTask(task); setModal('confirm-delete-task') }}>✕</button>
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  </>
                )}
              </div>
            )}

            {/* ── ATTENDANCE TAB ── */}
            {tab === 'attendance' && (
              <div className="admin-card">
                <div className="admin-card-header">
                  <div className="admin-card-title">Attendance Records</div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
                    <button className="btn-download-excel" onClick={() => setModal(viewingAttendance ? 'download-excel-intern' : 'download-excel')}>
                      📥 {viewingAttendance ? `Download ${viewingAttendance.name.split(' ')[0]}'s Excel` : 'Download Excel'}
                    </button>
                    <div className="assign-intern-select">
                      <span style={{ fontSize: '0.72rem', color: 'var(--muted)' }}>🔍 Intern:</span>
                      <select className="assign-select" value={viewingAttendance?.uid || ''}
                        onChange={e => setViewingAttendance(e.target.value ? interns.find(i => i.uid === e.target.value) : null)}>
                        <option value="">All Interns</option>
                        {interns.map(i => <option key={i.uid} value={i.uid}>{i.name}</option>)}
                      </select>
                    </div>
                    {viewingAttendance && (
                      <div className="assign-intern-select">
                        <span style={{ fontSize: '0.72rem', color: 'var(--muted)' }}>📅 Month:</span>
                        <select className="assign-select" value={selectedMonth} onChange={e => setSelectedMonth(e.target.value)}>
                          <option value="all">All Time</option>
                          {getAvailableMonths(attendanceLogs).map(m => (
                            <option key={m} value={m}>{monthLabel(m)}</option>
                          ))}
                        </select>
                      </div>
                    )}
                  </div>
                </div>

                {/* ── DEFAULT: All interns overview ── */}
                {!viewingAttendance && (
                  <>
                    <div className="intern-table-header" style={{ gridTemplateColumns: '1.8fr 0.9fr 1fr 1fr 1fr' }}>
                      <div className="intern-th">Intern</div>
                      <div className="intern-th">Shift</div>
                      <div className="intern-th">Today Status</div>
                      <div className="intern-th">Time In</div>
                      <div className="intern-th">Time Out</div>
                    </div>
                    <div className="intern-rows">
                      {interns.length === 0 && (
                        <div style={{ padding: '48px 24px', textAlign: 'center', color: 'var(--muted)', fontSize: '0.8rem' }}>No interns yet.</div>
                      )}
                      {interns.map(intern => {
                        const today   = new Date().toISOString().split('T')[0]
                        const rec     = todayAttendance.find(a => a.uid === intern.uid)
                        const timeIn  = rec?.timeIn?.toDate  ? rec.timeIn.toDate().toLocaleTimeString('en-US',  { hour: '2-digit', minute: '2-digit', hour12: true }) : '—'
                        const timeOut = rec?.timeOut?.toDate ? rec.timeOut.toDate().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true }) : '—'
                        const status  = !rec ? 'not-in' : rec.timeOut ? 'timed-out' : 'timed-in'
                        const shiftColors = {
                          morning: { bg: 'rgba(0,229,160,0.08)',   color: 'var(--accent)',  border: '1px solid rgba(0,229,160,0.2)' },
                          mid:     { bg: 'rgba(245,158,11,0.08)',  color: '#f59e0b',        border: '1px solid rgba(245,158,11,0.2)' },
                          gy:      { bg: 'rgba(0,120,255,0.08)',   color: 'var(--accent2)', border: '1px solid rgba(0,120,255,0.2)' },
                        }
                        const sc = shiftColors[intern.shift] || shiftColors.morning
                        return (
                          <div className="intern-row" key={intern.uid}
                            style={{ gridTemplateColumns: '1.8fr 0.9fr 1fr 1fr 1fr', cursor: 'pointer' }}
                            onClick={() => setViewingAttendance(intern)}
                          >
                            <div className="intern-name-cell">
                              <div className="intern-avatar">{getInitials(intern.name)}</div>
                              <div>
                                <div className="intern-name">{intern.name}</div>
                                <div className="intern-email">{intern.email}</div>
                              </div>
                            </div>
                            <div>
                              <span style={{ fontSize: '0.65rem', padding: '2px 8px', borderRadius: '100px', textTransform: 'uppercase', letterSpacing: '0.07em', fontWeight: 600, background: sc.bg, color: sc.color, border: sc.border }}>
                                {intern.shift === 'gy' ? '🌙 GY' : intern.shift === 'mid' ? '🌤️ Mid' : '🌅 Morning'}
                              </span>
                            </div>
                            <div>
                              {status === 'timed-in'  && <span className="att-status-badge in">● Timed In</span>}
                              {status === 'timed-out' && <span className="att-status-badge out">✓ Done</span>}
                              {status === 'not-in'    && <span className="att-status-badge absent">○ Not In</span>}
                            </div>
                            <div className="intern-td" style={{ color: 'var(--accent)' }}>{rec ? `↓ ${timeIn}` : '—'}</div>
                            <div className="intern-td" style={{ color: 'var(--accent2)' }}>{rec?.timeOut ? `↑ ${timeOut}` : '—'}</div>
                          </div>
                        )
                      })}
                    </div>
                  </>
                )}

                {/* ── FILTERED: Specific intern detail ── */}
                {viewingAttendance && (
                  <>
                    <div className="attendance-intern-header" style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                      <button className="btn-icon" onClick={() => setViewingAttendance(null)} style={{ fontSize: '0.75rem' }}>← All</button>
                      <div className="intern-avatar">{getInitials(viewingAttendance.name)}</div>
                      <div>
                        <div className="attendance-intern-name">{viewingAttendance.name}</div>
                        <div className="attendance-intern-sub">{viewingAttendance.email} · {Math.floor(viewingAttendance.hoursRendered || 0)} hrs rendered</div>
                      </div>
                    </div>
                    <div className="intern-table-header" style={{ gridTemplateColumns: '1.2fr 1fr 1fr 0.8fr 0.6fr' }}>
                      <div className="intern-th">Date</div>
                      <div className="intern-th">Time In</div>
                      <div className="intern-th">Time Out</div>
                      <div className="intern-th">Duration</div>
                      <div className="intern-th">Actions</div>
                    </div>
                    <div className="intern-rows">
                      {(() => {
                        const filteredLogs = selectedMonth === 'all' ? attendanceLogs : attendanceLogs.filter(l => l.date?.startsWith(selectedMonth))
                        if (filteredLogs.length === 0) return <div style={{ padding: '48px 24px', textAlign: 'center', color: 'var(--muted)', fontSize: '0.8rem' }}>No records found.</div>
                        return filteredLogs.map((log, i) => {
                          const f           = formatLog(log)
                          const incomplete  = log.timeIn && !log.timeOut
                          const isOvertime  = (() => {
                            if (!log.timeIn || !log.timeOut || !log.shift) return false
                            const shiftCfg  = shiftSettings[log.shift]
                            if (!shiftCfg) return false
                            const timeOutD  = log.timeOut.toDate()
                            const [eh, em]  = shiftCfg.end.split(':').map(Number)
                            const shiftEnd  = new Date(timeOutD)
                            shiftEnd.setHours(eh, em, 0, 0)
                            if (log.shift === 'gy' && eh < 12) shiftEnd.setDate(shiftEnd.getDate() + 1)
                            return timeOutD > shiftEnd
                          })()
                          return (
                            <div className={`intern-row ${incomplete ? 'row-incomplete' : ''}`} key={i} style={{ gridTemplateColumns: '1.2fr 1fr 1fr 0.8fr 0.6fr' }}>
                              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                <span className="intern-td" style={{ fontFamily: 'var(--font-display)', fontWeight: 600 }}>{f.date}</span>
                                {incomplete && <span className="att-flag">⚠️ No time out</span>}
                              </div>
                              <div className="intern-td" style={{ color: 'var(--accent)' }}>↓ {f.timeIn}</div>
                              <div className="intern-td" style={{ color: incomplete ? '#f59e0b' : 'var(--accent2)' }}>
                                {incomplete ? '— missing' : `↑ ${f.timeOut}`}
                              </div>
                              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                                <span className="intern-td muted">{f.duration}</span>
                                {isOvertime && <span className="att-overtime">⏱ OT</span>}
                              </div>
                              <div>
                                <button className="btn-icon" onClick={() => setEditingLog({ log, internUid: viewingAttendance.uid })}>✎ Edit</button>
                              </div>
                            </div>
                          )
                        })
                      })()}
                    </div>
                  </>
                )}
              </div>
            )}

            {/* ── SETTINGS TAB ── */}
            {tab === 'settings' && (
              <SettingsTab
                shiftSettings={shiftSettings}
                onSave={async (updated) => {
                  await saveShiftSettings(updated)
                  setShiftSettings(updated)
                }}
              />
            )}
          </>
        )}
      </div>
    </div>
  )
}