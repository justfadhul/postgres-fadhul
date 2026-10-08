// After "latest visit per patient" is written three ways: measure each plan and
// ask which reads the fewest buffers. Graded against the measurement, not a fixed answer.
import { useEffect, useState } from 'react'
import { THREE_WAYS_IDS } from '@content/modules/m01/challenges'
import type { SqlSession } from '../db/engine'
import { useRecord, useStore } from '../storage/hooks'
import { put, type AttemptRecord } from '../storage/store'
import { explain, totalBuffers } from './explain'

const LABELS: Record<string, string> = {
  'm01-latest-distinct-on': 'DISTINCT ON',
  'm01-latest-window': 'Window function',
  'm01-latest-lateral': 'LATERAL join',
}
export const FASTEST_KEY = 'm01-three-ways-fastest'

interface Measure { id: string; buffers: number; ms: number }

export function ThreeWays({ session, dark }: { session: SqlSession; dark: boolean }) {
  const attempts = useStore<AttemptRecord>('attempts')
  const saved = useRecord<{ choice: string; correct: boolean }>('progress', FASTEST_KEY)
  const [measures, setMeasures] = useState<Measure[] | null>(null)
  const [err, setErr] = useState('')
  const allPassed = !!attempts && THREE_WAYS_IDS.every((id) => attempts[id]?.passed)

  useEffect(() => {
    if (!allPassed || !attempts) return
    let live = true
    void (async () => {
      try {
        const out: Measure[] = []
        for (const id of THREE_WAYS_IDS) {
          const r = await explain(session, attempts[id]?.sql ?? '')
          out.push({ id, buffers: totalBuffers(r.plan), ms: r.executionMs ?? 0 })
        }
        if (live) setMeasures(out)
      } catch (e) {
        if (live) setErr((e as Error).message)
      }
    })()
    return () => { live = false }
  }, [allPassed, attempts, session])

  if (!allPassed) return null
  const line = dark ? 'var(--ed-line)' : 'var(--hair)'
  const fewest = measures ? Math.min(...measures.map((m) => m.buffers)) : 0
  return (
    <section aria-label="Compare the three ways" style={{ padding: dark ? '14px 16px' : '20px 0', borderBottom: `1px solid ${line}` }}>
      <p className="eyebrow">All three ways pass</p>
      <h2 style={{ margin: '6px 0', fontSize: 20 }}>Which reads the fewest buffers?</h2>
      <p style={{ margin: '0 0 10px', fontSize: 14 }}>Each of your answers was run with EXPLAIN (ANALYZE, BUFFERS). Buffers are pages of data read; they are a steadier measure than milliseconds, which change from run to run.</p>
      {err && <p role="alert">{err}</p>}
      {measures && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {measures.map((m) => {
            const chosen = saved?.choice === m.id
            return (
              <button
                key={m.id}
                type="button"
                disabled={!!saved}
                onClick={() => void put('progress', FASTEST_KEY, { status: 'done', updatedAt: new Date().toISOString(), choice: m.id, correct: m.buffers === fewest })}
                style={{ display: 'flex', alignItems: 'center', gap: 12, minHeight: 52, padding: '0 14px', borderRadius: 4, border: `${chosen ? 2 : 1}px solid ${chosen ? (m.buffers === fewest ? '#2f9e55' : '#f26b3a') : line}`, background: 'transparent', textAlign: 'left', cursor: saved ? 'default' : 'pointer' }}
              >
                <b style={{ flex: 1 }}>{LABELS[m.id] ?? m.id}</b>
                {saved && <span className="mono num" style={{ fontSize: 13 }}>{m.buffers.toLocaleString('en-GB')} buffers · {m.ms.toFixed(1)} ms</span>}
              </button>
            )
          })}
          {saved && (
            <p role="status" style={{ margin: '4px 0 0', fontSize: 14 }}>
              {saved.correct ? 'Right: that one read the fewest buffers.' : `Not this time: ${LABELS[measures.find((m) => m.buffers === fewest)?.id ?? ''] ?? ''} read the fewest.`}{' '}
              The ranking depends on the data and on indexes; Module 3 shows how an index on (patient_id, visit_at) changes it.
            </p>
          )}
        </div>
      )}
    </section>
  )
}
