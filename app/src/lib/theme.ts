// Light by default; dark only when the learner chooses it. The choice is a
// per-device convenience, so localStorage is enough and failure is harmless.
export type Theme = 'light' | 'dark'

const KEY = 'dsm-theme'

export function readTheme(): Theme {
  try {
    return localStorage.getItem(KEY) === 'dark' ? 'dark' : 'light'
  } catch {
    return 'light'
  }
}

export function applyTheme(theme: Theme) {
  document.documentElement.dataset.theme = theme
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', theme === 'dark' ? '#0f1216' : '#0b5394')
  try {
    localStorage.setItem(KEY, theme)
  } catch {
    // Private mode or blocked storage: the theme still applies for this visit.
  }
}
