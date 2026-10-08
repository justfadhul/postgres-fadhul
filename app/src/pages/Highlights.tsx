// Every highlight and comment, grouped by lesson in course order: for revision.
// Tap one to open the lesson at that place. Export as a Markdown file.
import { useEffect, useMemo, useState } from 'react'
import { Link, useLocation } from 'wouter'
import { allLessons } from '../course/content'
import { COLOURS, requestJump, type Annotation } from '../lesson/Annotations'
import { saveFile } from '../lib/saveFile'
import { useWide } from '../lib/useWide'
import { all, subscribe, type AnnotationRecord } from '../storage/store'

function useAllAnnotations(): Annotation[] | null {
  const [items, setItems] = useState<Annotation[] | null>(null)
  useEffect(() => {
    let live = true
    const load = () => void all<AnnotationRecord>('annotations').then((r) => {
      if (live) setItems(Object.entries(r).filter(([, a]) => !a.deleted).map(([id, a]) => ({ ...a, id })))
    })
    load()
    const off = subscribe((s) => { if (s === 'annotations') load() })
    return () => { live = false; off() }
  }, [])
  return items
}

export default function Highlights() {
  const wide = useWide()
  const items = useAllAnnotations()
  const [, navigate] = useLocation()
  const [query, setQuery] = useState('')
  const [onlyComments, setOnlyComments] = useState(false)

  const groups = useMemo(() => {
    const q = query.trim().toLowerCase()
    const shown = (items ?? []).filter((a) => (!onlyComments || a.note.trim()) && (!q || a.quote.toLowerCase().includes(q) || a.note.toLowerCase().includes(q)))
    return allLessons()
      .map((ref) => ({ ref, items: shown.filter((a) => a.lessonId === ref.lesson.id).sort((x, y) => x.at.localeCompare(y.at)) }))
      .filter((g) => g.items.length > 0)
  }, [items, query, onlyComments])

  async function exportText(share: boolean) {
    const lines = ['# Highlights and comments', '', `Exported ${new Date().toLocaleString('en-GB')} from Data Systems Mastery.`, '']
    for (const g of groups) {
      lines.push(`## ${g.ref.lesson.number} ${g.ref.lesson.title}`, '')
      for (const a of g.items) {
        lines.push(`> ${a.quote.replace(/\n+/g, ' ')}`, '')
        if (a.note.trim()) lines.push(a.note.trim(), '')
      }
    }
    await saveFile('dsm-highlights.md', lines.join('\n'), 'text/markdown', share)
  }

  const open = (a: Annotation) => { requestJump(a.id); navigate(`/lesson/${a.lessonId}`) }
  const total = items?.length ?? 0
  const canShare = typeof navigator !== 'undefined' && !!navigator.canShare

  return (
    <div className={wide ? 'page-wide' : 'page'} style={wide ? { maxWidth: 900 } : undefined}>
      <h1 className="display" style={{ fontSize: wide ? 96 : 44, margin: '0 0 8px' }}>Highlights</h1>
      <p className="muted" style={{ margin: '0 0 18px' }}>
        Everything you have highlighted or commented on, by lesson. Select text in any lesson to add more.
      </p>

      {items && total === 0 && (
        <div className="card">
          <p style={{ margin: 0 }}>Nothing yet. In a lesson, select a few words: a bar appears to highlight them in a colour or add a comment.</p>
          <Link href="/course" className="link">Go to the course</Link>
        </div>
      )}

      {total > 0 && (
        <>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, alignItems: 'center', marginBottom: 18 }}>
            <label htmlFor="hl-search" className="visually-hidden">Search highlights and comments</label>
            <input id="hl-search" type="search" className="input" placeholder="Search" value={query} onChange={(e) => setQuery(e.target.value)} style={{ flex: '1 1 200px' }} />
            <div className="segmented" role="group" aria-label="Show" style={{ flex: '0 0 auto' }}>
              <button type="button" aria-pressed={!onlyComments} onClick={() => setOnlyComments(false)} style={{ padding: '0 14px' }}>All</button>
              <button type="button" aria-pressed={onlyComments} onClick={() => setOnlyComments(true)} style={{ padding: '0 14px' }}>Comments</button>
            </div>
          </div>
          {groups.length === 0 && <p className="muted">Nothing matches.</p>}
          {groups.map((g) => (
            <section key={g.ref.lesson.id} aria-labelledby={`hl-${g.ref.lesson.id}`} style={{ marginBottom: 28 }}>
              <h2 id={`hl-${g.ref.lesson.id}`} className="eyebrow" style={{ margin: '0 0 6px' }}>
                {g.ref.lesson.number} · {g.ref.lesson.title}
              </h2>
              <ul style={{ listStyle: 'none', margin: 0, padding: 0 }}>
                {g.items.map((a) => (
                  <li key={a.id} style={{ borderTop: '1px solid var(--hair)' }}>
                    <button type="button" onClick={() => open(a)} style={{ display: 'block', width: '100%', textAlign: 'left', background: 'none', border: 0, padding: '14px 0', cursor: 'pointer', color: 'inherit' }}>
                      <span style={{ display: 'block', fontFamily: 'var(--serif)', fontSize: 17, lineHeight: 1.5, paddingLeft: 10, borderLeft: `4px solid ${COLOURS.find((c) => c.id === a.colour)?.swatch ?? 'var(--hair)'}` }}>
                        {a.quote}
                      </span>
                      {a.note.trim() && <span style={{ display: 'block', marginTop: 8, fontSize: 15, whiteSpace: 'pre-wrap' }}>{a.note}</span>}
                      <span className="muted" style={{ display: 'block', marginTop: 6, fontSize: 13 }}>
                        {new Date(a.updatedAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })} · open in the lesson →
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            </section>
          ))}
          <div className="btn-row" style={{ display: 'flex', flexWrap: 'wrap', gap: 10 }}>
            {canShare && <button type="button" className="btn" onClick={() => void exportText(true)}>Share as text…</button>}
            <button type="button" className="btn" onClick={() => void exportText(false)}>Download as text</button>
          </div>
        </>
      )}
    </div>
  )
}
