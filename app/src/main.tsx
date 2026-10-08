import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { App } from './App'
import { applyTheme, readTheme } from './lib/theme'
import './styles.css'

applyTheme(readTheme())

const root = document.getElementById('root')
if (!root) throw new Error('missing #root')
createRoot(root).render(
  <StrictMode>
    <App />
  </StrictMode>,
)

if (import.meta.env.PROD && 'serviceWorker' in navigator) {
  // Loaded after first paint so it never delays the shell.
  void import('virtual:pwa-register').then(({ registerSW }) => registerSW({ immediate: true }))
}
