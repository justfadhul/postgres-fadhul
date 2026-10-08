// The course as a printed index: phases, then modules as large condensed rows.
// The current module opens to show its lessons and practice.
import { useState } from 'react'
import { Link } from 'wouter'
import { MODULE_CONTENT } from '@content/modules'
import { MODULES, PHASES, TIER_LABEL } from '@content/syllabus'
import { THREE_WAYS_IDS } from '@content/modules/m01/challenges'
import { IconTick } from '../layout/icons'
import { moduleProgress, type StateSnapshot } from './progress'

export function CourseIndex({ snapshot, wide }: { snapshot: StateSnapshot; wide: boolean }) {
  const firstOpen = MODULES.find((m) => MODULE_CONTENT[m.id] && moduleProgress(m.id, snapshot).percent < 100)?.id ?? MODULES[0]?.id
  const [open, setOpen] = useState<string | undefined>(firstOpen)

  return (
    <div>
      {Object.entries(PHASES).map(([n, label]) => (
        <section key={n} aria-labelledby={`phase-${n}`} style={{ marginTop: wide ? 28 : 24 }}>
          <h2 id={`phase-${n}`} className="eyebrow" style={{ paddingBottom: 8, borderBottom: wide ? '2px solid var(--ink)' : '1px solid var(--hair)' }}>
            Phase {n} · {label}
          </h2>
          {MODULES.filter((m) => m.phase === Number(n)).map((m) => {
            const content = MODULE_CONTENT[m.id]
            const p = moduleProgress(m.id, snapshot)
            const isOpen = open === m.id
            const state = !content ? (wide ? '' : `${m.hours} h`) : p.percent === 100 ? 'Done' : p.started ? `${p.percent}%` : 'Start'
            return (
              <div key={m.id} style={{ borderBottom: '1px solid var(--hair)' }}>
                <button
                  type="button"
                  aria-expanded={isOpen}
                  onClick={() => setOpen(isOpen ? undefined : m.id)}
                  style={{ width: '100%', display: 'flex', flexWrap: wide ? 'wrap' : 'nowrap', alignItems: 'baseline', gap: wide ? '8px 24px' : '0 12px', padding: wide ? '20px 0' : '18px 0', background: 'none', border: 0, textAlign: 'left', cursor: 'pointer' }}
                >
                  <span className="mono" style={{ fontSize: 13, color: 'var(--muted)', width: wide ? 28 : 22, flex: 'none' }}>{String(m.number).padStart(2, '0')}</span>
                  <span className="display" style={{ flex: wide ? '1 1 480px' : 1, minWidth: 0, overflowWrap: 'anywhere', fontSize: wide ? 64 : 34, color: content ? undefined : 'var(--muted)' }}>
                    {m.title}
                  </span>
                  {wide && <span style={{ fontSize: 14, color: 'var(--muted)', whiteSpace: 'nowrap' }}>{TIER_LABEL[m.tier]} · {m.hours} h</span>}
                  <span className="num" style={{ minWidth: wide ? 64 : 0, textAlign: 'right', fontSize: wide ? 20 : 12, fontWeight: wide ? 700 : 400, color: p.started ? 'var(--accent)' : 'var(--muted)', whiteSpace: 'nowrap' }}>
                    {state}
                  </span>
                </button>
                {isOpen && (
                  <div style={{ padding: wide ? '0 0 28px 52px' : '0 0 20px 34px' }}>
                    <p style={{ margin: '-6px 0 12px', fontSize: 13, color: 'var(--muted)' }}>
                      {m.hours} h · <span className="tag">{TIER_LABEL[m.tier]}</span> · Lab: {m.lab}
                    </p>
                    {content ? (
                      <div style={{ display: 'grid', gridTemplateColumns: wide ? 'repeat(2, minmax(0, 1fr))' : '1fr', gap: wide ? '0 48px' : 0 }}>
                        {content.lessons.map((l) => {
                          const done = snapshot.progress[l.id]?.status === 'done'
                          return (
                            <Link key={l.id} href={`/lesson/${l.id}`} style={{ display: 'flex', alignItems: 'center', gap: 12, minHeight: 48, borderTop: wide ? '1px solid var(--soft)' : undefined, fontSize: 15, textDecoration: 'none' }}>
                              {wide && <span className="mono" style={{ fontSize: 13, color: 'var(--muted)', width: 28 }}>{l.number}</span>}
                              <span className={`box${done ? ' done' : ''}`}>{done && <IconTick />}</span>
                              <span style={done ? { textDecoration: 'line-through', textDecorationColor: 'var(--accent)', color: 'var(--muted)' } : undefined}>{l.title}</span>
                              <span style={{ marginLeft: 'auto', fontSize: 12, color: 'var(--muted)', whiteSpace: 'nowrap' }}>{l.minutes} min</span>
                            </Link>
                          )
                        })}
                        <Link href={`/assignment/${m.id}`} style={{ display: 'flex', alignItems: 'center', gap: 12, minHeight: 48, borderTop: wide ? '1px solid var(--soft)' : undefined, fontSize: 15, textDecoration: 'none' }}>
                          {wide && <span className="mono" style={{ fontSize: 13, color: 'var(--muted)', width: 28 }}>Lab</span>}
                          <span className={`box${p.challengesPassed === p.challenges && p.challenges > 0 ? ' done' : ''}`} />
                          <span style={{ fontWeight: 600 }}>Assignment: {content.assignment.title}</span>
                          <span className="num" style={{ marginLeft: 'auto', fontSize: 12, color: 'var(--muted)', whiteSpace: 'nowrap' }}>
                            {content.assignment.challengeIds.filter((id) => snapshot.attempts[id]?.passed).length} / {content.assignment.challengeIds.length}
                          </span>
                        </Link>
                        {m.id === 'm01-sql-fluency' && THREE_WAYS_IDS.length > 0 && (
                          <Link href={`/workbench/${THREE_WAYS_IDS[0]}`} style={{ display: 'flex', alignItems: 'center', gap: 12, minHeight: 48, borderTop: wide ? '1px solid var(--soft)' : undefined, fontSize: 15, textDecoration: 'none' }}>
                            {wide && <span className="mono" style={{ fontSize: 13, color: 'var(--muted)', width: 28 }}>Lab</span>}
                            <span className={`box${THREE_WAYS_IDS.every((id) => snapshot.attempts[id]?.passed) ? ' done' : ''}`} />
                            <span style={{ fontWeight: 600 }}>Latest visit per patient, three ways</span>
                            <span className="num" style={{ marginLeft: 'auto', fontSize: 12, color: 'var(--muted)', whiteSpace: 'nowrap' }}>
                              {THREE_WAYS_IDS.filter((id) => snapshot.attempts[id]?.passed).length} / 3
                            </span>
                          </Link>
                        )}
                      </div>
                    ) : (
                      <>
                        <p style={{ margin: '0 0 8px', fontSize: 15 }}>Done when:</p>
                        <ul style={{ margin: 0, paddingLeft: 20, fontSize: 15 }}>
                          {m.doneWhen.map((d) => <li key={d}>{d}</li>)}
                        </ul>
                        <p className="muted" style={{ fontSize: 13 }}>Lessons for this module arrive in a later milestone.</p>
                      </>
                    )}
                  </div>
                )}
              </div>
            )
          })}
        </section>
      ))}
    </div>
  )
}
