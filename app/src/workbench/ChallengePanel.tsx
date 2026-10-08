import { useState } from 'react'
import { Link } from 'wouter'
import type { Challenge } from '@content/types'
import type { AttemptRecord } from '../storage/store'

interface Props {
  challenge: Challenge
  position: string
  attempt?: AttemptRecord
  nextHref?: string
  backHref: string
  dark: boolean
}

export function ChallengePanel({ challenge, position, attempt, nextHref, backHref, dark }: Props) {
  const [hints, setHints] = useState(0)
  const [gaveUp, setGaveUp] = useState(false)
  // On a phone a long task would push the editor off the first screen: show the start, tap for the rest.
  const long = dark && challenge.prompt.length > 280
  const [fullPrompt, setFullPrompt] = useState(false)
  const [copied, setCopied] = useState(false)
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
      <p
        id={`prompt-${challenge.id}`}
        style={{
          margin: 0, fontSize: dark ? 15 : 17, lineHeight: 1.55, whiteSpace: 'pre-line',
          ...(long && !fullPrompt ? { display: '-webkit-box', WebkitLineClamp: 5, WebkitBoxOrient: 'vertical' as const, overflow: 'hidden' } : {}),
        }}
      >
        {challenge.prompt}
      </p>
      {long && (
        <button type="button" className="link" aria-expanded={fullPrompt} aria-controls={`prompt-${challenge.id}`} style={{ fontSize: 14 }} onClick={() => setFullPrompt(!fullPrompt)}>
          {fullPrompt ? 'Show less' : 'Show the whole task'}
        </button>
      )}

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
      {challenge.grader.setup && (
        <details className="disclosure" style={{ marginTop: 4 }}>
          <summary style={{ cursor: 'pointer', minHeight: 44, display: 'flex', alignItems: 'center', fontSize: 14, fontWeight: 600 }}>
            The grader adds test rows
          </summary>
          <p style={{ margin: '0 0 6px', fontSize: 14, color: muted }}>
            The clinic data lacks some cases this task asks about, so before checking, the grader runs this SQL inside a
            transaction it rolls back afterwards. Your query must give the right answer with these rows too. Paste it above
            your query in the workbench to see them; Reset the dataset afterwards, or wrap it all in BEGIN … ROLLBACK.
          </p>
          <button
            type="button"
            className="btn"
            style={{ marginBottom: 8, ...(dark ? { background: '#262626', color: '#eee', borderColor: '#333' } : {}) }}
            onClick={() => void navigator.clipboard?.writeText(challenge.grader.setup?.trim() ?? '').then(() => setCopied(true), () => setCopied(false))}
          >
            {copied ? 'Copied' : 'Copy the SQL'}
          </button>
          <pre className="scroll-x code-box">{challenge.grader.setup.trim()}</pre>
        </details>
      )}


      {(passed || gaveUp) && (
        <div style={{ marginTop: 12 }}>
          <p style={{ margin: 0, fontSize: 14, lineHeight: 1.55 }}><b>Explanation.</b> {challenge.explanation}</p>
          {gaveUp && !passed && (
            <details className="disclosure" style={{ marginTop: 8 }}>
              <summary style={{ cursor: 'pointer', minHeight: 44, display: 'flex', alignItems: 'center', fontSize: 14, fontWeight: 600 }}>One correct answer</summary>
              <pre className="scroll-x code-box">{challenge.grader.reference.trim()}</pre>
            </details>
          )}
          {passed && nextHref && (
            <Link href={nextHref} className="btn btn-primary" style={{ marginTop: 10, ...(dark ? { background: '#efefec', color: '#151515', borderColor: '#efefec' } : {}) }}>
              Next challenge →
            </Link>
          )}
        </div>
      )}
    </section>
  )
}
