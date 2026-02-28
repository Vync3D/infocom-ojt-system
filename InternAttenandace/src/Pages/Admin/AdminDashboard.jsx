import { useState, useEffect } from 'react'
import './AdminDashboard.css'
import {
  getAllInterns, addIntern, removeIntern,
  getAllTasks, assignTask,
  getAttendanceLogs, logoutUser
} from '../../firebase'

function getInitials(name) {
  return name?.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase() || '??'
}

function formatLog(log) {
  const timeInStr  = log.timeIn?.toDate  ? log.timeIn.toDate().toLocaleTimeString('en-US',  { hour: '2-digit', minute: '2-digit', hour12: true }) : '—'
  const timeOutStr = log.timeOut?.toDate ? log.timeOut.toDate().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true }) : '—'
  const dateStr    = log.date ? new Date(log.date + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric', weekday: 'short' }) : '—'
  return { date: dateStr, timeIn: timeInStr, timeOut: timeOutStr, duration: log.duration || '—', status: log.status || 'complete' }
}

const STATUS_LABELS   = { pending: 'Pending', 'in-progress': 'In Progress', done: 'Done' }
const PRIORITY_LABELS = { high: '↑ High', medium: '→ Medium', low: '↓ Low' }

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

// ── Add Intern Modal ──
function AddInternModal({ onAdd, onCancel }) {
  const [form, setForm]   = useState({ name: '', email: '', password: '', hoursRequired: '600' })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const handleChange = e => setForm(p => ({ ...p, [e.target.name]: e.target.value }))
  const handleSubmit = async (e) => {
    e.preventDefault()
    setLoading(true); setError('')
    try {
      await onAdd(form)
    } catch (err) {
      setError(err.message)
      setLoading(false)
    }
  }
  return (
    <div className="modal-overlay">
      <div className="modal">
        <div className="modal-title">Add New Intern</div>
        <div className="modal-sub">Creates a login account for the intern.</div>
        <form className="modal-form" onSubmit={handleSubmit}>
          <div className="modal-field"><label>Full Name</label><input name="name" placeholder="e.g. Maria Santos" value={form.name} onChange={handleChange} required /></div>
          <div className="modal-field"><label>Email</label><input name="email" type="email" placeholder="e.g. maria@email.com" value={form.email} onChange={handleChange} required /></div>
          <div className="modal-field"><label>Password</label><input name="password" type="password" placeholder="min. 6 characters" value={form.password} onChange={handleChange} required /></div>
          <div className="modal-field"><label>Required OJT Hours</label><input name="hoursRequired" type="number" value={form.hoursRequired} onChange={handleChange} /></div>
          {error && <div style={{ color: '#ff5f57', fontSize: '0.75rem', padding: '8px 0' }}>{error}</div>}
          <div className="modal-actions">
            <button type="button" className="btn-modal-cancel" onClick={onCancel}>Cancel</button>
            <button type="submit" className="btn-modal-confirm" disabled={loading}>{loading ? 'Creating...' : 'Add Intern'}</button>
          </div>
        </form>
      </div>
    </div>
  )
}

// ── Assign Task Modal ──
function AssignTaskModal({ interns, adminName, onAssign, onCancel }) {
  const [form, setForm]   = useState({ internUid: interns[0]?.uid || '', title: '', desc: '', priority: 'medium' })
  const [loading, setLoading] = useState(false)
  const handleChange = e => setForm(p => ({ ...p, [e.target.name]: e.target.value }))
  const handleSubmit = async (e) => {
    e.preventDefault()
    setLoading(true)
    await onAssign(form)
    setLoading(false)
  }
  return (
    <div className="modal-overlay">
      <div className="modal">
        <div className="modal-title">Assign New Task</div>
        <div className="modal-sub">Create and assign a task to an intern.</div>
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
              <option value="high">High</option>
              <option value="medium">Medium</option>
              <option value="low">Low</option>
            </select>
          </div>
          <div className="modal-actions">
            <button type="button" className="btn-modal-cancel" onClick={onCancel}>Cancel</button>
            <button type="submit" className="btn-modal-confirm" disabled={loading}>{loading ? 'Assigning...' : 'Assign Task'}</button>
          </div>
        </form>
      </div>
    </div>
  )
}

// ── Main Component ──
export default function AdminDashboard({ user, onLogout }) {
  const [tab, setTab]               = useState('interns')
  const [interns, setInterns]       = useState([])
  const [tasks, setTasks]           = useState([])
  const [modal, setModal]           = useState(null)
  const [selectedIntern, setSelectedIntern]         = useState(null)
  const [viewingAttendance, setViewingAttendance]   = useState(null)
  const [attendanceLogs, setAttendanceLogs]         = useState([])
  const [loadingData, setLoadingData] = useState(true)

  useEffect(() => {
    Promise.all([getAllInterns(), getAllTasks()])
      .then(([i, t]) => { setInterns(i); setTasks(t) })
      .catch(console.error)
      .finally(() => setLoadingData(false))
  }, [])

  useEffect(() => {
    if (!viewingAttendance) return
    getAttendanceLogs(viewingAttendance.uid).then(setAttendanceLogs).catch(console.error)
  }, [viewingAttendance])

  const handleAddIntern = async (form) => {
    await addIntern(form.email, form.password, form.name, parseInt(form.hoursRequired))
    const updated = await getAllInterns()
    setInterns(updated)
    setModal(null)
  }

  const handleRemoveIntern = async () => {
    await removeIntern(selectedIntern.uid)
    setInterns(p => p.filter(i => i.uid !== selectedIntern.uid))
    setModal(null)
    setSelectedIntern(null)
  }

  const handleAssignTask = async (form) => {
    await assignTask(form.internUid, form.title, form.desc, form.priority, user?.name || 'Admin')
    const updated = await getAllTasks()
    setTasks(updated)
    setModal(null)
  }

  const handleLogout = async () => {
    await logoutUser()
    onLogout()
  }

  const presentCount = interns.filter(i => i.present).length
  const totalHours   = interns.reduce((a, i) => a + Math.floor(i.hoursRendered || 0), 0)

  return (
    <div className="admin-dashboard">
      {modal === 'add'    && <AddInternModal onAdd={handleAddIntern} onCancel={() => setModal(null)} />}
      {modal === 'assign' && <AssignTaskModal interns={interns} adminName={user?.name} onAssign={handleAssignTask} onCancel={() => setModal(null)} />}
      {modal === 'confirm-remove' && <ConfirmModal name={selectedIntern?.name} onConfirm={handleRemoveIntern} onCancel={() => setModal(null)} />}

      <header className="admin-topbar">
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div className="admin-topbar-logo">Track<span>OJT</span></div>
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
          <div className="admin-stat-card"><div className="admin-stat-label">Present Today</div><div className="admin-stat-value green">{presentCount}</div></div>
          <div className="admin-stat-card"><div className="admin-stat-label">Total Hours (All)</div><div className="admin-stat-value orange">{totalHours}</div></div>
          <div className="admin-stat-card"><div className="admin-stat-label">Active Tasks</div><div className="admin-stat-value muted">{tasks.filter(t => t.status !== 'done').length}</div></div>
        </div>

        {/* Tabs */}
        <div className="admin-tabs">
          {[['interns','👥 Interns'],['tasks','✅ Tasks'],['attendance','◷ Attendance']].map(([key, label]) => (
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
                  <button className="btn-add" onClick={() => setModal('add')}>+ Add Intern</button>
                </div>
                <div className="intern-table-header">
                  <div className="intern-th">Intern</div>
                  <div className="intern-th">Hours Rendered</div>
                  <div className="intern-th">Tasks</div>
                  <div className="intern-th">Actions</div>
                </div>
                <div className="intern-rows">
                  {interns.length === 0 && (
                    <div style={{ padding: '48px 24px', textAlign: 'center', color: 'var(--muted)', fontSize: '0.8rem' }}>No interns yet. Add one!</div>
                  )}
                  {interns.map(intern => {
                    const internTasks = tasks.filter(t => t.internUid === intern.uid)
                    const done        = internTasks.filter(t => t.status === 'done').length
                    return (
                      <div className="intern-row" key={intern.uid}>
                        <div className="intern-name-cell">
                          <div className="intern-avatar">{getInitials(intern.name)}</div>
                          <div>
                            <div className="intern-name">{intern.name}</div>
                            <div className="intern-email">{intern.email}</div>
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
                  <div className="admin-card-title">Assigned Tasks</div>
                  <button className="btn-add" onClick={() => setModal('assign')}>+ Assign Task</button>
                </div>
                <div className="intern-table-header" style={{ gridTemplateColumns: '1.5fr 1.5fr 0.8fr 0.8fr 0.8fr' }}>
                  <div className="intern-th">Task</div>
                  <div className="intern-th">Intern</div>
                  <div className="intern-th">Priority</div>
                  <div className="intern-th">Status</div>
                  <div className="intern-th">Assigned By</div>
                </div>
                <div className="intern-rows">
                  {tasks.length === 0 && (
                    <div style={{ padding: '48px 24px', textAlign: 'center', color: 'var(--muted)', fontSize: '0.8rem' }}>No tasks assigned yet.</div>
                  )}
                  {tasks.map(task => {
                    const intern = interns.find(i => i.uid === task.internUid)
                    return (
                      <div className="intern-row" key={task.id} style={{ gridTemplateColumns: '1.5fr 1.5fr 0.8fr 0.8fr 0.8fr' }}>
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
                      </div>
                    )
                  })}
                </div>
              </div>
            )}

            {/* ── ATTENDANCE TAB ── */}
            {tab === 'attendance' && (
              <div className="admin-card">
                <div className="admin-card-header">
                  <div className="admin-card-title">Attendance Records</div>
                  <div className="assign-intern-select">
                    <span style={{ fontSize: '0.72rem', color: 'var(--muted)' }}>Viewing:</span>
                    <select className="assign-select"
                      value={viewingAttendance?.uid || ''}
                      onChange={e => setViewingAttendance(interns.find(i => i.uid === e.target.value))}>
                      <option value="">-- Select Intern --</option>
                      {interns.map(i => <option key={i.uid} value={i.uid}>{i.name}</option>)}
                    </select>
                  </div>
                </div>
                {viewingAttendance ? (
                  <>
                    <div className="attendance-intern-header">
                      <div className="intern-avatar">{getInitials(viewingAttendance.name)}</div>
                      <div>
                        <div className="attendance-intern-name">{viewingAttendance.name}</div>
                        <div className="attendance-intern-sub">{viewingAttendance.email} · {Math.floor(viewingAttendance.hoursRendered || 0)} hrs rendered</div>
                      </div>
                    </div>
                    <div className="intern-table-header" style={{ gridTemplateColumns: '1.2fr 1fr 1fr 0.8fr 0.8fr' }}>
                      <div className="intern-th">Date</div>
                      <div className="intern-th">Time In</div>
                      <div className="intern-th">Time Out</div>
                      <div className="intern-th">Duration</div>
                      <div className="intern-th">Status</div>
                    </div>
                    <div className="intern-rows">
                      {attendanceLogs.length === 0 && (
                        <div style={{ padding: '48px 24px', textAlign: 'center', color: 'var(--muted)', fontSize: '0.8rem' }}>No attendance records found.</div>
                      )}
                      {attendanceLogs.map((log, i) => {
                        const f = formatLog(log)
                        return (
                          <div className="intern-row" key={i} style={{ gridTemplateColumns: '1.2fr 1fr 1fr 0.8fr 0.8fr' }}>
                            <div className="intern-td" style={{ fontFamily: 'var(--font-display)', fontWeight: 600 }}>{f.date}</div>
                            <div className="intern-td" style={{ color: 'var(--accent)' }}>↓ {f.timeIn}</div>
                            <div className="intern-td" style={{ color: 'var(--accent2)' }}>↑ {f.timeOut}</div>
                            <div className="intern-td muted">{f.duration}</div>
                            <div><span className={`row-status ${f.status}`}>{f.status.charAt(0).toUpperCase() + f.status.slice(1)}</span></div>
                          </div>
                        )
                      })}
                    </div>
                  </>
                ) : (
                  <div style={{ padding: '60px 24px', textAlign: 'center', color: 'var(--muted)', fontSize: '0.8rem' }}>
                    <span style={{ fontSize: '2rem', display: 'block', marginBottom: '12px' }}>👆</span>
                    Select an intern above to view their attendance.
                  </div>
                )}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )
}