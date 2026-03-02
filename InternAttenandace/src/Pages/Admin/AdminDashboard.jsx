import { useState, useEffect } from 'react'
import './AdminDashboard.css'
import {
  getAllInterns, addIntern, removeIntern,
  getAllTasks, assignTask, assignGroupTask,
  getAttendanceLogs, getTodayAttendance, logoutUser, updateInternShift
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
  const [form, setForm]       = useState({ name: '', email: '', password: '', hoursRequired: '600', shift: 'day' })
  const [loading, setLoading] = useState(false)
  const [error, setError]     = useState('')
  const handleChange = e => setForm(p => ({ ...p, [e.target.name]: e.target.value }))
  const handleSubmit = async (e) => {
    e.preventDefault(); setLoading(true); setError('')
    try { await onAdd(form) } catch (err) { setError(err.message); setLoading(false) }
  }
  return (
    <div className="modal-overlay"><div className="modal">
      <div className="modal-title">Add New Intern</div>
      <div className="modal-sub">Creates a login account for the intern.</div>
      <form className="modal-form" onSubmit={handleSubmit}>
        <div className="modal-field"><label>Full Name</label><input name="name" placeholder="e.g. Maria Santos" value={form.name} onChange={handleChange} required /></div>
        <div className="modal-field"><label>Email</label><input name="email" type="email" placeholder="e.g. maria@email.com" value={form.email} onChange={handleChange} required /></div>
        <div className="modal-field"><label>Password</label><input name="password" type="password" placeholder="min. 6 characters" value={form.password} onChange={handleChange} required /></div>
        <div className="modal-field"><label>Required OJT Hours</label><input name="hoursRequired" type="number" value={form.hoursRequired} onChange={handleChange} /></div>
        <div className="modal-field">
          <label>Shift</label>
          <select name="shift" value={form.shift} onChange={handleChange}>
            <option value="day">Day Shift (starts ~8–9 AM)</option>
            <option value="gy">GY Shift (starts ~10 PM)</option>
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

// ── Main Component ──
export default function AdminDashboard({ user, onLogout }) {
  const [tab, setTab]             = useState('interns')
  const [taskTab, setTaskTab]     = useState('solo')  // 'solo' | 'group'
  const [interns, setInterns]     = useState([])
  const [tasks, setTasks]         = useState([])
  const [modal, setModal]         = useState(null)
  const [selectedIntern, setSelectedIntern]       = useState(null)
  const [viewingAttendance, setViewingAttendance] = useState(null)
  const [attendanceLogs, setAttendanceLogs]       = useState([])
  const [loadingData, setLoadingData]             = useState(true)
  const [todayAttendance, setTodayAttendance]     = useState([])
  const [selectedMonth, setSelectedMonth]         = useState('all')

  useEffect(() => {
    Promise.all([getAllInterns(), getAllTasks(), getTodayAttendance()])
      .then(([i, t, att]) => { setInterns(i); setTasks(t); setTodayAttendance(att) })
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
    setInterns(await getAllInterns()); setModal(null)
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

  const handleLogout = async () => { await logoutUser(); onLogout() }

  const presentCount = todayAttendance.filter(a => a.timeIn && !a.timeOut).length
  const soloTasks    = tasks.filter(t => t.type !== 'group')
  const groupTasks   = tasks.filter(t => t.type === 'group')

  return (
    <div className="admin-dashboard">
      {modal === 'add'          && <AddInternModal onAdd={handleAddIntern} onCancel={() => setModal(null)} />}
      {modal === 'assign-solo'  && <AssignSoloModal  interns={interns} onAssign={handleAssignSolo}  onCancel={() => setModal(null)} />}
      {modal === 'assign-group' && <AssignGroupModal interns={interns} onAssign={handleAssignGroup} onCancel={() => setModal(null)} />}
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

          {/* Present Now — hoverable */}
          <div className="admin-stat-card present-now-card">
            <div className="admin-stat-label">Present Now</div>
            <div className="admin-stat-value green">{presentCount}</div>
            {/* Tooltip */}
            <div className="present-tooltip">
              <div className="present-tooltip-title">Currently In Office</div>
              {presentCount === 0 ? (
                <div className="present-tooltip-empty">No one is timed in right now.</div>
              ) : (
                todayAttendance
                  .filter(a => a.timeIn && !a.timeOut)
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
                  {interns.length === 0 && <div style={{ padding: '48px 24px', textAlign: 'center', color: 'var(--muted)', fontSize: '0.8rem' }}>No interns yet.</div>}
                  {interns.map(intern => {
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
                                background: intern.shift === 'gy' ? 'rgba(0,120,255,0.1)' : 'rgba(0,229,160,0.08)',
                                color: intern.shift === 'gy' ? 'var(--accent2)' : 'var(--accent)',
                                border: intern.shift === 'gy' ? '1px solid rgba(0,120,255,0.2)' : '1px solid rgba(0,229,160,0.2)',
                              }}>{intern.shift === 'gy' ? 'GY' : 'Day'}</span>
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
                    <div className="intern-table-header" style={{ gridTemplateColumns: '1.5fr 1.2fr 0.8fr 0.8fr 0.8fr' }}>
                      <div className="intern-th">Task</div>
                      <div className="intern-th">Intern</div>
                      <div className="intern-th">Priority</div>
                      <div className="intern-th">Status</div>
                      <div className="intern-th">Assigned By</div>
                    </div>
                    <div className="intern-rows">
                      {soloTasks.length === 0 && <div style={{ padding: '48px 24px', textAlign: 'center', color: 'var(--muted)', fontSize: '0.8rem' }}>No solo tasks yet.</div>}
                      {soloTasks.map(task => {
                        const intern = interns.find(i => i.uid === task.internUid)
                        return (
                          <div className="intern-row" key={task.id} style={{ gridTemplateColumns: '1.5fr 1.2fr 0.8fr 0.8fr 0.8fr' }}>
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
                  </>
                )}

                {/* GROUP tasks list */}
                {taskTab === 'group' && (
                  <>
                    <div className="intern-table-header" style={{ gridTemplateColumns: '1.5fr 1.2fr 0.8fr 0.8fr' }}>
                      <div className="intern-th">Task</div>
                      <div className="intern-th">Leader</div>
                      <div className="intern-th">Members</div>
                      <div className="intern-th">Status</div>
                    </div>
                    <div className="intern-rows">
                      {groupTasks.length === 0 && <div style={{ padding: '48px 24px', textAlign: 'center', color: 'var(--muted)', fontSize: '0.8rem' }}>No group tasks yet.</div>}
                      {groupTasks.map(task => {
                        const leader  = interns.find(i => i.uid === task.leaderUid)
                        const members = (task.memberUids || []).map(uid => interns.find(i => i.uid === uid)).filter(Boolean)
                        return (
                          <div className="intern-row" key={task.id} style={{ gridTemplateColumns: '1.5fr 1.2fr 0.8fr 0.8fr' }}>
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
                            {/* Member avatars stack */}
                            <div className="member-avatars">
                              {members.slice(0, 4).map((m, idx) => (
                                <div key={m.uid} className="member-avatar-stack" style={{ zIndex: 10 - idx }} title={m.name}>
                                  {getInitials(m.name)}
                                </div>
                              ))}
                              {members.length > 4 && <div className="member-avatar-stack more">+{members.length - 4}</div>}
                              <span className="intern-td" style={{ marginLeft: 8 }}>{members.length}</span>
                            </div>
                            <div><span className={`status-tag ${task.status}`}>{STATUS_LABELS[task.status]}</span></div>
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
                    <div className="assign-intern-select">
                      <span style={{ fontSize: '0.72rem', color: 'var(--muted)' }}>Intern:</span>
                      <select className="assign-select" value={viewingAttendance?.uid || ''}
                        onChange={e => setViewingAttendance(interns.find(i => i.uid === e.target.value))}>
                        <option value="">-- Select Intern --</option>
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
                {viewingAttendance ? (
                  <>
                    <div className="attendance-intern-header">
                      <div className="intern-avatar">{getInitials(viewingAttendance.name)}</div>
                      <div>
                        <div className="attendance-intern-name">{viewingAttendance.name}</div>
                        <div className="attendance-intern-sub">{viewingAttendance.email} · {Math.floor(viewingAttendance.hoursRendered || 0)} hrs rendered</div>
                      </div>
                    </div>
                    <div className="intern-table-header" style={{ gridTemplateColumns: '1.2fr 1fr 1fr 0.8fr' }}>
                      <div className="intern-th">Date</div><div className="intern-th">Time In</div>
                      <div className="intern-th">Time Out</div><div className="intern-th">Duration</div>
                    </div>
                    <div className="intern-rows">
                      {(() => {
                        const filteredLogs = selectedMonth === 'all' ? attendanceLogs : attendanceLogs.filter(l => l.date?.startsWith(selectedMonth))
                        if (filteredLogs.length === 0) return <div style={{ padding: '48px 24px', textAlign: 'center', color: 'var(--muted)', fontSize: '0.8rem' }}>No records found.</div>
                        return filteredLogs.map((log, i) => {
                          const f = formatLog(log)
                          return (
                            <div className="intern-row" key={i} style={{ gridTemplateColumns: '1.2fr 1fr 1fr 0.8fr' }}>
                              <div className="intern-td" style={{ fontFamily: 'var(--font-display)', fontWeight: 600 }}>{f.date}</div>
                              <div className="intern-td" style={{ color: 'var(--accent)' }}>↓ {f.timeIn}</div>
                              <div className="intern-td" style={{ color: 'var(--accent2)' }}>↑ {f.timeOut}</div>
                              <div className="intern-td muted">{f.duration}</div>
                            </div>
                          )
                        })
                      })()}
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