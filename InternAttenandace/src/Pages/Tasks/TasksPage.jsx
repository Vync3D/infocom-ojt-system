import { useState, useEffect } from 'react'
import './TasksPage.css'
import { getTasksForIntern, updateTaskStatus } from '../../firebase'

const FILTERS         = ['All', 'Pending', 'In Progress', 'Done']
const STATUS_LABELS   = { pending: 'Pending', 'in-progress': 'In Progress', done: 'Done' }
const PRIORITY_LABELS = { high: '↑ High', medium: '→ Medium', low: '↓ Low' }

export default function TasksPage({ uid, onBack }) {
  const [tasks, setTasks]   = useState([])
  const [filter, setFilter] = useState('All')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!uid) return
    getTasksForIntern(uid)
      .then(setTasks)
      .catch(console.error)
      .finally(() => setLoading(false))
  }, [uid])

  const handleStatusChange = async (id, newStatus) => {
    await updateTaskStatus(id, newStatus)
    setTasks(prev => prev.map(t => t.id === id ? { ...t, status: newStatus } : t))
  }

  const filtered = tasks.filter(t => filter === 'All' || STATUS_LABELS[t.status] === filter)

  const total      = tasks.length
  const pending    = tasks.filter(t => t.status === 'pending').length
  const inProgress = tasks.filter(t => t.status === 'in-progress').length
  const done       = tasks.filter(t => t.status === 'done').length

  return (
    <div className="tasks-page">
      <header className="topbar">
        <div className="topbar-logo">Track<span>OJT</span></div>
      </header>
      <div className="tasks-body">
        <div className="tasks-page-header">
          <button className="btn-back" onClick={onBack}>← Back</button>
          <div className="tasks-page-header-text">
            <div className="page-title">Tasks & Activities</div>
            <div className="page-subtitle">All tasks assigned to you by your seniors</div>
          </div>
        </div>

        <div className="tasks-summary">
          <div className="summary-card"><div className="summary-label">Total Tasks</div><div className="summary-value blue">{total}</div></div>
          <div className="summary-card"><div className="summary-label">Pending</div><div className="summary-value orange">{pending}</div></div>
          <div className="summary-card"><div className="summary-label">In Progress</div><div className="summary-value green">{inProgress}</div></div>
          <div className="summary-card"><div className="summary-label">Done</div><div className="summary-value red">{done}</div></div>
        </div>

        <div className="tasks-page-filters">
          {FILTERS.map(f => (
            <button key={f} className={`filter-btn ${filter === f ? 'active' : ''}`} onClick={() => setFilter(f)}>{f}</button>
          ))}
        </div>

        <div className="tasks-full-list">
          {loading ? (
            <div className="tasks-empty-state"><span>⏳</span>Loading tasks...</div>
          ) : filtered.length === 0 ? (
            <div className="tasks-empty-state"><span>📭</span>No tasks in this category.</div>
          ) : (
            filtered.map(task => (
              <div key={task.id} className={`task-full-card ${task.status === 'done' ? 'done-card' : ''}`}>
                <div className={`task-full-priority-bar ${task.priority}`} />
                <div className="task-full-content">
                  <div className="task-full-top">
                    <div className="task-full-title">{task.title}</div>
                    <span className={`priority-tag ${task.priority}`}>{PRIORITY_LABELS[task.priority]}</span>
                  </div>
                  <div className="task-full-desc">{task.desc}</div>
                  <div className="task-full-meta">
                    <div className="assigned-by">👤 Assigned by <strong>{task.assignedBy}</strong></div>
                    <div className="meta-divider" />
                    <span className={`status-tag ${task.status}`}>{STATUS_LABELS[task.status]}</span>
                  </div>
                  <div className="status-select-wrap">
                    <span className="status-select-label">Update status:</span>
                    <select
                      className={`status-select ${task.status}`}
                      value={task.status}
                      onChange={e => handleStatusChange(task.id, e.target.value)}
                    >
                      <option value="pending">Pending</option>
                      <option value="in-progress">In Progress</option>
                      <option value="done">Done</option>
                    </select>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  )
}