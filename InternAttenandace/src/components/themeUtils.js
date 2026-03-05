export const THEMES = [
  {
    id: 'cyber',
    name: 'Cyber',
    desc: 'Default dark teal',
    preview: { bg: '#080a0d', surface: '#0e1117', accent: '#06b6d4', accent2: '#6366f1' },
  },
  {
    id: 'neon-purple',
    name: 'Neon Purple',
    desc: 'Deep purple & pink',
    preview: { bg: '#07050f', surface: '#0e0b1a', accent: '#a855f7', accent2: '#ec4899' },
  },
  {
    id: 'sunset',
    name: 'Sunset',
    desc: 'Warm orange & amber',
    preview: { bg: '#0d0805', surface: '#160f08', accent: '#f97316', accent2: '#eab308' },
  },
  {
    id: 'minimal-dark',
    name: 'Minimal Dark',
    desc: 'Pure black & white',
    preview: { bg: '#000000', surface: '#0a0a0a', accent: '#ffffff', accent2: '#888888' },
  },
  {
    id: 'minimal-light',
    name: 'Minimal Light',
    desc: 'Clean white',
    preview: { bg: '#f5f5f5', surface: '#ffffff', accent: '#111111', accent2: '#444444' },
  },
]

export function applyTheme(themeId) {
  document.documentElement.setAttribute('data-theme', themeId)
  localStorage.setItem('ojt-theme', themeId)
}

export function loadSavedTheme() {
  const saved = localStorage.getItem('ojt-theme') || 'cyber'
  document.documentElement.setAttribute('data-theme', saved)
  return saved
}