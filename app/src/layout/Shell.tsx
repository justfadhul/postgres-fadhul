import type { ReactNode } from 'react'
import { Link, useLocation } from 'wouter'
import { useWide } from '../lib/useWide'
import { useStudyTimer } from '../lib/activity'
import { IconCode, IconHome, IconList, IconMore } from './icons'

const NAV = [
  { href: '/', label: 'Today', icon: IconHome, match: (p: string) => p === '/' },
  { href: '/course', label: 'Course', icon: IconList, match: (p: string) => p.startsWith('/course') || p.startsWith('/lesson') || p.startsWith('/assignment') },
  { href: '/workbench', label: 'Workbench', icon: IconCode, match: (p: string) => p.startsWith('/workbench') },
  { href: '/settings', label: 'More', icon: IconMore, match: (p: string) => p.startsWith('/settings') || p.startsWith('/resources') || p.startsWith('/spikes') },
]

const WIDE_NAV = [
  { href: '/', label: 'Today', match: NAV[0]!.match },
  { href: '/course', label: 'Course', match: NAV[1]!.match },
  { href: '/workbench', label: 'Workbench', match: NAV[2]!.match },
  { href: '/resources', label: 'Resources', match: (p: string) => p.startsWith('/resources') },
  { href: '/settings', label: 'Settings', match: (p: string) => p.startsWith('/settings') || p.startsWith('/spikes') },
]

export function Shell({ children }: { children: ReactNode }) {
  const wide = useWide()
  const [path] = useLocation()
  const studying = path.startsWith('/lesson') || path.startsWith('/workbench')
  useStudyTimer(studying)
  // The phone workbench is a full-screen dark tool with its own controls.
  const hideBottomNav = !wide && path.startsWith('/workbench')

  return (
    <>
      <a className="skip-link" href="#main" onClick={(e) => { e.preventDefault(); document.getElementById('main')?.focus() }}>
        Skip to content
      </a>
      {wide && (
        <header className="masthead">
          <Link href="/" className="display" style={{ fontSize: 22, lineHeight: 1, textDecoration: 'none' }}>
            Data Systems Mastery
          </Link>
          <nav aria-label="Main">
            {WIDE_NAV.map((n) => (
              <Link key={n.href} href={n.href} aria-current={n.match(path) ? 'page' : undefined}>
                {n.label}
              </Link>
            ))}
          </nav>
          <Link href="/settings" className="link" style={{ fontSize: 14 }}>
            Export progress
          </Link>
        </header>
      )}
      <main id="main" tabIndex={-1} style={{ outline: 'none' }}>
        {children}
      </main>
      {!wide && !hideBottomNav && (
        <nav className="bottom-nav" aria-label="Main">
          {NAV.map((n) => (
            <Link key={n.href} href={n.href} aria-label={n.label} aria-current={n.match(path) ? 'page' : undefined}>
              <n.icon />
            </Link>
          ))}
        </nav>
      )}
    </>
  )
}
