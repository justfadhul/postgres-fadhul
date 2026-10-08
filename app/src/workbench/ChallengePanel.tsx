import { useState } from 'react'
import { Link } from 'wouter'
import type { Challenge } from '@content/types'
import type { GradeReport } from '../grading/result'
import type { AttemptRecord } from '../storage/store'

interface Props {
  challenge: Challenge
  position: string
  attempt?: AttemptRecord
  grade: GradeReport | null
  nextHref?: string
  backHref: string
  dark: boolean
}

export function ChallengePanel({ challenge, position, attempt, grade, nextHref, backHref, dark }: Props) {
  const [hints, setHints] = useState(0)
  const [gaveUp, setGaveUp] = useState(false)
  const passed = !!attempt?.passed
  const muted = dark ? 'var(--ed-muted)' : 'var(--muted)'
  const line = dark ? 'var(--ed-line)' : 'var(--hair)'
  return (
    <section aria-label="Challenge" style={{ padding: dark ? '4px 16px 14px' : '0 0 20px', borderBottom: `1px solid ${line}` }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, alignItems: 'baseline', flexWrap: 'wrap' }}>
        <p className="eyebrow" style={{ color: muted }}>{position} · <span className="tag" style={{ color: 'inherit', borderColor: line }}>Browser</span></p>
        {passed && <span style={{ fontSize: 13, fontWeight: 700, color: dark ? '#5fd08a' : 'var(--right)' }}>Passed</span>}
      </div>
      <h2 style={{ margin: '6px 0 6px', fontSize: dark ? 20 : 26, lineHeight: 1.25 }}>{challenge.title}</h2>
      <p style={{ margin: 0, fontSize: dark ? 15 : 17, lineHeight: 1.55, whiteSpace: 'pre-line' }}>{challenge.prompt}</p>

      {challenge.hints.slice(0, hints).map((h, i) => (
        <p key={i} style={{ margin: '10px 0 0', fontSize: 14, color: muted }}><b>Hint {i + 1}:</b> {h}</p>
      ))}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0 18px', marginTop: 4 }}>
        {hints < challenge.hints.length && (
          <button type="button" className="link" style={{ fontSize: 14 }} onClick={() => setHints(hints + 1)}>Show a hint</button>
        )}
        {!passed && !gaveUp && (attempt?.tries ?? 0) >= 2 && (
          <button type="button" className="link" style={{ fontSize: 14 }} onClick={() => setGaveUp(true)}>Show the explanation</button>
        )}
        <Link href={backHref} className="link" style={{ fontSize: 14 }}>All challenges</Link>
      </div>

      {grade && (
        <div role="status" aria-live="polite" style={{ marginTop: 12, padding: '10px 12px', borderLeft: `3px solid ${grade.pass ? (dark ? '#5fd08a' : 'var(--right)') : '#f26b3a'}`, background: dark ? '#1f1f1f' : 'var(--surface)', borderRadius: 4 }}>
          <p style={{ margin: 0, fontWeight: 700 }}>{grade.pass ? 'Pass' : 'Not yet'}</p>
          <ul style={{ margin: '4px 0 0', paddingLeft: 18, fontSize: 14 }}>
            {grade.messages.map((m, i) => <li key={i}>{m}</li>)}
          </ul>
        </div>
      )}

      {(passed || gaveUp) && (
        <div style={{ marginTop: 12 }}>
          <p style={{ margin: 0, fontSize: 14, lineHeight: 1.55 }}><b>Explanation.</b> {challenge.explanation}</p>
          {gaveUp && !passed && (
            <details style={{ marginTop: 8 }}>
              <summary style={{ cursor: 'pointer', minHeight: 44, display: 'flex', alignItems: 'center', fontSize: 14 }}>One correct answer</summary>
              <pre className="scroll-x" style={{ margin: 0, fontSize: 13 }}>{challenge.grader.reference.trim()}</pre>
            </details>
          )}
          {passed && nextHref && <Link href={nextHref} className="btn btn-primary" style={{ marginTop: 10 }}>Next challenge →</Link>}
        </div>
      )}
    </section>
  )
}
