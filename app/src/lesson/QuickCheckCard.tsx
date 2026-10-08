import { findCheck } from '../course/content'
import { useRecord } from '../storage/hooks'
import { put, type AnswerRecord } from '../storage/store'
import { highlightSql } from './highlight'

export function QuickCheckCard({ id }: { id: string }) {
  const check = findCheck(id)
  const saved = useRecord<AnswerRecord>('answers', id)
  if (!check) return <p role="alert">Missing quick check: {id}</p>
  const answered = !!saved
  return (
    <section aria-label="Quick check" style={{ margin: '28px 0', padding: '16px 0 0', borderTop: '2px solid var(--ink)', fontFamily: 'var(--sans)' }}>
      <p className="eyebrow">{check.kind === 'predict' ? 'Quick check · predict the output' : 'Quick check'}</p>
      <p style={{ fontSize: 19, fontWeight: 600, lineHeight: 1.4, margin: '10px 0 12px' }}>{check.prompt}</p>
      {check.sql && (
        <figure className="sql-block" style={{ margin: '0 0 12px' }}>
          <pre><code>{highlightSql(check.sql.trim())}</code></pre>
        </figure>
      )}
      <div role="group" aria-label="Answers">
        {check.options.map((o, i) => {
          const isRight = answered && i === check.answer
          const isWrongPick = answered && saved?.choice === i && i !== check.answer
          return (
            <button
              key={i}
              type="button"
              disabled={answered}
              aria-pressed={saved?.choice === i}
              onClick={() => void put('answers', id, { choice: i, correct: i === check.answer, at: new Date().toISOString() })}
              style={{
                width: '100%', display: 'flex', alignItems: 'center', gap: 14, minHeight: 54, padding: '8px 4px 8px 12px',
                background: 'none', border: 0, borderBottom: '1px solid var(--hair)', textAlign: 'left', fontSize: 16, cursor: answered ? 'default' : 'pointer',
                boxShadow: isRight ? 'inset 4px 0 0 var(--right)' : isWrongPick ? 'inset 4px 0 0 var(--accent)' : undefined,
                color: 'var(--ink)', opacity: 1,
              }}
            >
              <span className="mono" style={{ fontSize: 13, color: 'var(--muted)', width: 18 }}>{'ABCDEF'[i]}</span>
              <span style={{ flex: 1 }}>{o}</span>
              {isRight && <span style={{ fontSize: 12, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--right)' }}>Correct</span>}
              {isWrongPick && <span style={{ fontSize: 12, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--accent)' }}>Your answer</span>}
            </button>
          )
        })}
      </div>
      {answered && (
        <p role="status" style={{ margin: '14px 0 0', fontSize: 16, lineHeight: 1.6 }}>
          <b>{saved?.correct ? 'Right. ' : 'Not quite. '}</b>{check.explanation}
        </p>
      )}
    </section>
  )
}
