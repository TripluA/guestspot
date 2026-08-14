export type Theme = 'light' | 'dark' | 'system'

const KEY = 'guestspot.theme'

export function getTheme(): Theme {
  const v = localStorage.getItem(KEY)
  return v === 'dark' || v === 'light' || v === 'system' ? v : 'system'
}

export function applyTheme(t: Theme) {
  const dark =
    t === 'dark' || (t === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches)
  document.documentElement.classList.toggle('dark', dark)
}

export function setTheme(t: Theme) {
  localStorage.setItem(KEY, t)
  applyTheme(t)
}

export function initTheme() {
  applyTheme(getTheme())
  window
    .matchMedia('(prefers-color-scheme: dark)')
    .addEventListener('change', () => {
      if (getTheme() === 'system') applyTheme('system')
    })
}
