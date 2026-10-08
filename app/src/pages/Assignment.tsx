import { Link, useParams } from 'wouter'
import { MODULES } from '@content/syllabus'
import { moduleContent } from '../course/content'
import { IconBack, IconTick } from '../layout/icons'
import { useWide } from '../lib/useWide'
import { useStore } from '../storage/hooks'
import type { AttemptRecord } from '../storage/store'

export function Assignment() {
  const { id = '' } = useParams<{ id: string }>()
  const wide = useWide()
  const module = MODULES.find((m) => m.id === id)
  const content = moduleContent(id)
  const attempts = useStore<AttemptRecord>('attempts') ?? {}
  if (!module || !content) return <div className="page"><p>No assignment here yet.</p><Link href="/course" className="link">Back to the course</Link></div>

  const list = content.assignment.challengeIds.map((cid) => content.challenges.find((c) => c.id === cid)).filter((c) => !!c)
  const passed = list.filter((c) => attempts[c.id]?.passed).length
  return (
    <div className={wide ? 'page-wide' : 'page'} style={wide ? { maxWidth: 1100 } : undefined}>
      {!wide && <Link href="/course" aria-label="Back to the course" className="icon-btn" style={{ marginBottom: 16 }}><IconBack /></Link>}
      <p className="eyebrow">Module {module.number} · {module.title} · assignment</p>
      <h1 className="display" style={{ fontSize: wide ? 96 : 44, margin: '8px 0 16px' }}>{content.assignment.title}</h1>
      <p className={wide ? 'serif' : undefined} style={{ fontSize: wide ? 22 : 17, maxWidth: 680, margin: '0 0 8px' }}>{content.assignment.intro}</p>
      <p className="muted num" style={{ fontSize: 14, margin: '0 0 24px' }}>{passed} of {list.length} passed. Done when: {module.doneWhen.join(' ')}</p>
      <ol style={{ listStyle: 'none', margin: 0, padding: 0, borderTop: '2px solid var(--ink)' }}>
        {list.map((c, i) => {
          const a = attempts[c.id]
          return (
            <li key={c.id} style={{ borderBottom: '1px solid var(--hair)' }}>
              <Link href={`/workbench/${c.id}`} style={{ display: 'flex', alignItems: 'center', gap: 14, minHeight: 56, padding: '8px 0', textDecoration: 'none' }}>
                <span className="mono num" style={{ width: 28, fontSize: 13, color: 'var(--muted)' }}>{String(i + 1).padStart(2, '0')}</span>
                <span className={`box${a?.passed ? ' done' : ''}`}>{a?.passed && <IconTick />}</span>
                <span style={{ flex: 1, fontSize: wide ? 18 : 16, fontWeight: a?.passed ? 400 : 600 }}>{c.title}</span>
                <span style={{ fontSize: 12, color: a?.passed ? 'var(--right)' : 'var(--muted)', whiteSpace: 'nowrap' }}>
                  {a?.passed ? 'Passed' : a ? `${a.tries} ${a.tries === 1 ? 'try' : 'tries'}` : ''}
                </span>
              </Link>
            </li>
          )
        })}
      </ol>
    </div>
  )
}
