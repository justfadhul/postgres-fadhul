// A runnable SQL block in a lesson: run it here, or open it in the workbench.
import { useState } from 'react'
import { useLocation } from 'wouter'
import { toErrorFields, type SqlErrorFields } from '../db/protocol'
import type { RunOutput } from '../db/raw'
import { put } from '../storage/store'
import { useEngine } from '../workbench/EngineContext'
import { EngineGate } from '../workbench/EngineGate'
import { ErrorView, RunOutputView, RunSummary } from '../workbench/Output'
import { highlightSql } from './highlight'

export function SqlBlock({ sql }: { sql: string }) {
  const code = sql.replace(/\n$/, '')
  const { engine, status, request } = useEngine()
  const [, navigate] = useLocation()
  const [asked, setAsked] = useState(false)
  const [out, setOut] = useState<RunOutput | null>(null)
  const [error, setError] = useState<SqlErrorFields | null>(null)
  const [busy, setBusy] = useState(false)

  async function run() {
    setAsked(true)
    if (!engine || status !== 'ready') { request(); return }
    setBusy(true)
    try {
      // Lesson examples never change the learner's data.
      await engine.exec('BEGIN')
      try { setOut(await engine.run(code, 50)); setError(null) } finally { await engine.exec('ROLLBACK') }
    } catch (e) {
      setOut(null); setError(toErrorFields(e))
    } finally {
      setBusy(false)
    }
  }

  async function openInWorkbench() {
    await put('drafts', 'wb:scratch', { sql: `${code}\n`, at: new Date().toISOString() })
    navigate('/workbench')
  }

  return (
    <>
      <figure className="sql-block">
        <pre><code>{highlightSql(code)}</code></pre>
        <figcaption className="sql-bar">
          <span>{out ? <RunSummary out={out} /> : 'Browser · runs on your device'}</span>
          <span style={{ display: 'flex', gap: 8 }}>
            <button type="button" className="btn" onClick={() => void openInWorkbench()}>Open in workbench</button>
            <button type="button" className="btn btn-run" disabled={busy} onClick={() => void run()}>{busy ? 'Running…' : out ? 'Run again' : 'Run'}</button>
          </span>
        </figcaption>
      </figure>
      {asked && status !== 'ready' && <div className="sql-result"><EngineGate compact><span /></EngineGate></div>}
      {(out || error) && (
        <div className="sql-result">
          {error ? <ErrorView error={error} sql={code} dark={false} /> : out && <RunOutputView out={out} dark={false} />}
        </div>
      )}
    </>
  )
}
