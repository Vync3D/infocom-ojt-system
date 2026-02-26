import { useState } from 'react'
import './TasksPage.css'

// ── Mock Data (replace with Firebase later) ──
const INITIAL_TASKS = [
  {
    id: 1,
    title: 'UI Design Review',
    desc: 'Review and finalize the mockups for the admin panel. Make sure all components follow the design system. Send feedback to the design lead once done.',
    priority: 'high',
    status: 'in-progress',
    assignedBy: 'Sir Reyes',
  },
  {
    id: 2,
    title: 'Backend API Integration',
    desc: 'Connect the front-end login form to the authentication API endpoint. Test with valid and invalid credentials to ensure proper error handling.',
    priority: 'high',
    status: 'pending',
    assignedBy: 'Sir Reyes',
  },
  {
    id: 3,
    title: 'Weekly Report',
    desc: "Compile this week's progress and submit to your supervisor by Friday EOD. Include tasks completed, hours rendered, and blockers if any.",
    priority: 'medium',
    status: 'pending',
    assignedBy: 'Ma\'am Cruz',
  },
  {
    id: 4,
    title: 'Database Schema Update',
    desc: 'Update the attendance table to include time_out and total_hours columns. Run migration scripts and verify the changes in the staging environment.',
    priority: 'medium',
    status: 'done',
    assignedBy: 'Sir Reyes',
  },
  {
    id: 5,
    title: 'Onboarding Docs',
    desc: 'Read through the company handbook and internal documentation wiki. Take note of the coding standards and Git workflow guidelines.',
    priority: 'low',
    status: 'done',
    assignedBy: "Ma'am Cruz",
  },
]

const FILTERS      = ['All', 'Pending', 'In Progress', 'Done']
const STATUS_LABELS = { pending: 'Pending', 'in-progress': 'In Progress', done: 'Done' }
const PRIORITY_LABELS = { high: '↑ High', medium: '→ Medium', low: '↓ Low' }

export default function TasksPage({ onBack }) {
  const [tasks, setTasks]   = useState(INITIAL_TASKS)
  const [filter, setFilter] = useState('All')

  const filtered = tasks.filter(t => {
    if (filter === 'All') return true
    return STATUS_LABELS[t.status] === filter
  })

  const updateStatus = (id, newStatus) => {
    setTasks(prev => prev.map(t => t.id === id ? { ...t, status: newStatus } : t))
  }

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

        {/* Page Header */}
        <div className="tasks-page-header">
          <button className="btn-back" onClick={onBack}>← Back</button>
          <div className="tasks-page-header-text">
            <div className="page-title">Tasks & Activities</div>
            <div className="page-subtitle">All tasks assigned to you by your seniors</div>
          </div>
        </div>

        {/* Summary */}
        <div className="tasks-summary">
          <div className="summary-card">
            <div className="summary-label">Total Tasks</div>
            <div className="summary-value blue">{total}</div>
          </div>
          <div className="summary-card">
            <div className="summary-label">Pending</div>
            <div className="summary-value orange">{pending}</div>
          </div>
          <div className="summary-card">
            <div className="summary-label">In Progress</div>
            <div className="summary-value green">{inProgress}</div>
          </div>
          <div className="summary-card">
            <div className="summary-label">Done</div>
            <div className="summary-value red">{done}</div>
          </div>
        </div>

        {/* Filters */}
        <div className="tasks-page-filters">
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

        {/* Task Cards */}
        <div className="tasks-full-list">
          {filtered.length === 0 ? (
            <div className="tasks-empty-state">
              <span>📭</span>
              No tasks in this category.
            </div>
          ) : (
            filtered.map(task => (
              <div
                key={task.id}
                className={`task-full-card ${task.status === 'done' ? 'done-card' : ''}`}
              >
                <div className={`task-full-priority-bar ${task.priority}`} />
                <div className="task-full-content">

                  {/* Title + Priority tag */}
                  <div className="task-full-top">
                    <div className="task-full-title">{task.title}</div>
                    <span className={`priority-tag ${task.priority}`}>
                      {PRIORITY_LABELS[task.priority]}
                    </span>
                  </div>

                  {/* Description */}
                  <div className="task-full-desc">{task.desc}</div>

                  {/* Assigned by + status tag */}
                  <div className="task-full-meta">
                    <div className="assigned-by">
                      👤 Assigned by <strong>{task.assignedBy}</strong>
                    </div>
                    <div className="meta-divider" />
                    <span className={`status-tag ${task.status}`}>
                      {STATUS_LABELS[task.status]}
                    </span>
                  </div>

                  {/* Status updater */}
                  <div className="status-select-wrap">
                    <span className="status-select-label">Update status:</span>
                    <select
                      className={`status-select ${task.status}`}
                      value={task.status}
                      onChange={e => updateStatus(task.id, e.target.value)}
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