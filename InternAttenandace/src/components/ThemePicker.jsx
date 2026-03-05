import { useState } from 'react'
import './ThemePicker.css'
import { THEMES, applyTheme } from './themeUtils'

export default function ThemePicker({ onClose }) {
  const [active, setActive] = useState(localStorage.getItem('ojt-theme') || 'cyber')

  const handlePick = (id) => {
    setActive(id)
    applyTheme(id)
  }

  return (
    <div className="theme-picker-overlay" onClick={onClose}>
      <div className="theme-picker-panel" onClick={e => e.stopPropagation()}>
        <div className="theme-picker-header">
          <div className="theme-picker-title">🎨 Choose Theme</div>
          <button className="theme-picker-close" onClick={onClose}>✕</button>
        </div>

        <div className="theme-picker-section-label">Color Themes</div>
        <div className="theme-picker-grid">
          {THEMES.slice(0, 3).map(t => (
            <ThemeCard key={t.id} theme={t} active={active === t.id} onPick={handlePick} />
          ))}
        </div>

        <div className="theme-picker-section-label" style={{ marginTop: 16 }}>Minimalistic</div>
        <div className="theme-picker-grid">
          {THEMES.slice(3).map(t => (
            <ThemeCard key={t.id} theme={t} active={active === t.id} onPick={handlePick} />
          ))}
        </div>
      </div>
    </div>
  )
}

function ThemeCard({ theme, active, onPick }) {
  const { preview } = theme
  return (
    <button
      className={`theme-card ${active ? 'active' : ''}`}
      onClick={() => onPick(theme.id)}
    >
      <div className="theme-preview" style={{ background: preview.bg }}>
        <div className="theme-preview-bar" style={{ background: preview.surface, borderBottom: `1px solid ${preview.accent}22` }}>
          <div className="theme-preview-dot" style={{ background: preview.accent }} />
          <div className="theme-preview-dot" style={{ background: preview.accent2, opacity: 0.7 }} />
        </div>
        <div className="theme-preview-body">
          <div className="theme-preview-line" style={{ background: preview.accent + '33', width: '55%' }} />
          <div className="theme-preview-line" style={{ background: preview.surface, width: '80%' }} />
          <div className="theme-preview-line" style={{ background: preview.surface, width: '65%' }} />
          <div className="theme-preview-accent-bar" style={{ background: preview.accent }} />
        </div>
      </div>
      <div className="theme-card-label">
        <span className="theme-card-name">{theme.name}</span>
        <span className="theme-card-desc">{theme.desc}</span>
      </div>
      {active && <div className="theme-card-check">✓</div>}
    </button>
  )
}