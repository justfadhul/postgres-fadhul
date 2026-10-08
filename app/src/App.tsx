import { lazy, Suspense, useState, type ReactNode } from 'react'
import { Link, Route, Router, Switch, useLocation } from 'wouter'
import { useHashLocation } from 'wouter/use-hash-location'
import { CourseMap } from './pages/CourseMap'
import { Resources } from './pages/Resources'
import { NotFound } from './pages/NotFound'
import { applyTheme, readTheme, type Theme } from './lib/theme'

// PGlite is only pulled in by these routes, so the shell stays small.
const Spikes = lazy(() => import('./pages/Spikes'))

function NavLink({ href, children }: { href: string; children: ReactNode }) {
  const [location] = useLocation()
  const active = href === '/' ? location === '/' : location.startsWith(href)
  return (
    <Link href={href} aria-current={active ? 'page' : undefined}>
      {children}
    </Link>
  )
}

function ThemeToggle() {
  const [theme, setTheme] = useState<Theme>(readTheme)
  const next: Theme = theme === 'light' ? 'dark' : 'light'
  return (
    <button
      type="button"
      className="btn"
      aria-label={`Switch to ${next} theme`}
      onClick={() => {
        applyTheme(next)
        setTheme(next)
      }}
    >
      {theme === 'light' ? 'Dark' : 'Light'}
    </button>
  )
}

export function App() {
  return (
    // Hash routes need no server rewrites and work offline from the service worker.
    <Router hook={useHashLocation}>
      <a className="skip-link" href="#main" onClick={(e) => { e.preventDefault(); document.getElementById('main')?.focus() }}>
        Skip to content
      </a>
      <header className="app-header">
        <div className="app-header__row">
          <Link href="/" className="brand">
            Data Systems Mastery
          </Link>
          <ThemeToggle />
        </div>
        <nav className="nav" aria-label="Main">
          <NavLink href="/">Course</NavLink>
          <NavLink href="/resources">Resources</NavLink>
          <NavLink href="/spikes">Engine check</NavLink>
        </nav>
      </header>
      <main id="main" tabIndex={-1}>
        <Suspense fallback={<p className="muted">Loading…</p>}>
          <Switch>
            <Route path="/" component={CourseMap} />
            <Route path="/resources" component={Resources} />
            <Route path="/spikes" component={Spikes} />
            <Route component={NotFound} />
          </Switch>
        </Suspense>
      </main>
    </Router>
  )
}
