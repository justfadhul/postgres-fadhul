import { RESOURCES } from '@content/resources'
import { useWide } from '../lib/useWide'

export function Resources() {
  const wide = useWide()
  return (
    <div className={wide ? 'page-wide' : 'page'} style={wide ? { maxWidth: 1000 } : undefined}>
      <h1 className="display" style={{ fontSize: wide ? 96 : 48 }}>Free resources</h1>
      <p className="serif" style={{ fontSize: wide ? 22 : 18, margin: '16px 0 28px', maxWidth: 640 }}>
        Everything here is free to read. Lessons link to the relevant part.
      </p>
      <ul style={{ listStyle: 'none', margin: 0, padding: 0, borderTop: '2px solid var(--ink)' }}>
        {RESOURCES.map((r) => (
          <li key={r.url} style={{ display: 'flex', flexWrap: 'wrap', gap: '4px 24px', alignItems: 'baseline', padding: '16px 0', borderBottom: '1px solid var(--hair)' }}>
            <a href={r.url} target="_blank" rel="noreferrer" style={{ flex: '1 1 320px', display: 'flex', alignItems: 'center', minHeight: 44, fontSize: 18, fontWeight: 600, textDecorationColor: 'var(--accent)', textUnderlineOffset: 4 }}>
              {r.title}
            </a>
            <span className="muted" style={{ fontSize: 14 }}>{r.useFor}</span>
          </li>
        ))}
      </ul>
    </div>
  )
}
