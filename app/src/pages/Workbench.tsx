// The SQL workbench: one data flow, two layouts. Phone: a dark full-screen tool
// with a key row and Run dock kept above the keyboard. Wide: a paper page with
// the schema, a dark editor and output tabs.
import { useEffect, useRef, useState } from 'react'
import { Link, useParams } from 'wouter'
import { THREE_WAYS_IDS } from '@content/modules/m01/challenges'
import { findChallenge } from '../course/content'
import type { SqlErrorFields } from '../db/protocol'
import { toErrorFields } from '../db/protocol'
import type { RunOutput } from '../db/raw'
import { gradeResult, type GradeReport } from '../grading/result'
import { IconBack, IconPlan, IconPlay, IconReset } from '../layout/icons'
import { useWide } from '../lib/useWide'
import { useRecord } from '../storage/hooks'
import { get, put, update, type AttemptRecord, type DraftRecord } from '../storage/store'
import { ChallengePanel } from '../workbench/ChallengePanel'
import { describeCommand, DESCRIBE_HELP, isBackslash } from '../workbench/describe'
import { useEngine } from '../workbench/EngineContext'
import { EngineGate } from '../workbench/EngineGate'
import { explain, type ExplainResult } from '../workbench/explain'
import { DescribeView, ErrorView, PlanView, RunOutputView, RunSummary } from '../workbench/Output'
import { SchemaList } from '../workbench/SchemaList'
import { SqlEditor, type EditorHandle } from '../workbench/SqlEditor'
import { ThreeWays } from '../workbench/ThreeWays'
import { useKeyboardInset } from '../workbench/useKeyboardInset'

const KEYS = ['(', ')', ';', '*', ',', "'", '=', '_', '\t', '\\d']
const SCRATCH_DEFAULT = `-- Try anything. Run with the button or Cmd/Ctrl+Enter.\n-- \\dt lists the tables; \\d visits describes one.\nSELECT * FROM visits\nORDER BY visit_at DESC\nLIMIT 10;\n`

type Tab = 'results' | 'plan' | 'check'

export default function Workbench() {
  const params = useParams<{ id?: string }>()
  // Keyed by challenge, so switching challenges starts with fresh output and the right draft.
  return <WorkbenchPage key={params.id ?? 'scratch'} id={params.id} />
}

function WorkbenchPage({ id }: { id?: string }) {
  const wide = useWide()
  const engineState = useEngine()
  const { engine, status, version, dataset, request, reset, stop } = engineState
  const ref = findChallenge(id ?? '')
  const challenge = ref?.challenge
  const draftKey = `wb:${challenge?.id ?? 'scratch'}`
  const attempt = useRecord<AttemptRecord>('attempts', challenge?.id ?? '-')

  const editor = useRef<EditorHandle>(null)
  const [sql, setSql] = useState<string | null>(null)
  const [out, setOut] = useState<RunOutput | null>(null)
  const [error, setError] = useState<SqlErrorFields | null>(null)
  const [ran, setRan] = useState({ text: '', offset: 0 })
  const [plan, setPlan] = useState<ExplainResult | null>(null)
  const [described, setDescribed] = useState<string | null>(null)
  const [grade, setGrade] = useState<GradeReport | null>(null)
  const [tab, setTab] = useState<Tab>('results')
  const [busy, setBusy] = useState(false)
  const [schemaKey, setSchemaKey] = useState(0)
  const inset = useKeyboardInset()

  useEffect(() => { request() }, [request])

  // Load the saved draft for this challenge (or the scratch pad).
  useEffect(() => {
    void get<DraftRecord>('drafts', draftKey).then((d) => setSql(d?.sql ?? challenge?.starter ?? (challenge ? '' : SCRATCH_DEFAULT)), () => setSql(''))
  }, [draftKey, challenge])

  // Save drafts as the learner types.
  useEffect(() => {
    if (sql === null) return
    const t = setTimeout(() => void put('drafts', draftKey, { sql, at: new Date().toISOString() }), 400)
    return () => clearTimeout(t)
  }, [sql, draftKey])

  const current = () => editor.current?.selectionOrAll() ?? { text: sql ?? '', offset: 0 }

  async function run() {
    if (!engine || busy) return
    const { text, offset } = current()
    setBusy(true); setError(null); setDescribed(null); setTab('results'); setRan({ text, offset })
    try {
      if (isBackslash(text)) {
        setOut(null)
        setDescribed(await describeCommand(engine, text))
      } else {
        setOut(await engine.run(text, 500))
        if (/\b(create|drop|alter)\b/i.test(text)) setSchemaKey((k) => k + 1)
      }
    } catch (e) {
      setOut(null)
      setError(toErrorFields(e))
    } finally {
      setBusy(false)
    }
  }

  async function doExplain() {
    if (!engine || busy) return
    const { text, offset } = current()
    setBusy(true); setTab('plan'); setRan({ text, offset })
    try {
      setPlan(await explain(engine, text)); setError(null)
    } catch (e) {
      setPlan(null); setError(toErrorFields(e))
    } finally {
      setBusy(false)
    }
  }

  async function check() {
    if (!engine || busy || !challenge) return
    const text = sql ?? ''
    setBusy(true); setTab('check')
    try {
      const rep = await gradeResult(engine, text, challenge.grader)
      setGrade(rep)
      setRan({ text, offset: 0 })
      setError(rep.error ?? null)
      await update<AttemptRecord>('attempts', challenge.id, (old) => ({
        passed: (old?.passed ?? false) || rep.pass,
        sql: rep.pass ? text : old?.passed ? old.sql : text,
        at: new Date().toISOString(),
        tries: (old?.tries ?? 0) + 1,
      }))
    } finally {
      setBusy(false)
    }
  }

  // Where this challenge sits and what comes next.
  const ids = ref ? (THREE_WAYS_IDS.includes(ref.challenge.id) ? THREE_WAYS_IDS : ref.content.assignment.challengeIds) : []
  const pos = challenge ? ids.indexOf(challenge.id) : -1
  const position = !challenge ? '' : THREE_WAYS_IDS.includes(challenge.id) ? `Three ways · ${pos + 1} of 3` : `Assignment · ${pos + 1} of ${ids.length}`
  const nextId = pos >= 0 ? ids[pos + 1] : undefined
  const backHref = ref ? `/assignment/${ref.module.id}` : '/'
  const dark = !wide
  const ready = status === 'ready' && engine && sql !== null

  const output = (
    <div style={{ paddingTop: 8 }}>
      {busy && (
        <p role="status" style={{ margin: dark ? '8px 14px' : '8px 0', fontSize: 14, display: 'flex', alignItems: 'center', gap: 14 }}>
          <span style={{ opacity: 0.8 }}>Running…</span>
          <button type="button" className="link" style={{ fontSize: 14 }} onClick={() => { stop(); setBusy(false) }}>Stop</button>
        </p>
      )}
      {!busy && tab === 'results' && error && <ErrorView error={error} sql={ran.text} dark={dark} />}
      {!busy && tab === 'results' && !error && described !== null && <DescribeView text={described} dark={dark} />}
      {!busy && tab === 'results' && !error && out && <RunOutputView out={out} dark={dark} />}
      {!busy && tab === 'plan' && error && <ErrorView error={error} sql={ran.text} dark={dark} />}
      {!busy && tab === 'plan' && !error && plan && <PlanView result={plan} dark={dark} />}
      {!busy && tab === 'check' && grade?.error && <ErrorView error={grade.error} sql={ran.text} dark={dark} />}
      {!busy && tab === 'check' && grade && !grade.error && (
        <p style={{ margin: dark ? '8px 14px' : '8px 0', fontSize: 14 }}>{grade.pass ? 'Your rows match the reference answer.' : 'See the feedback above the editor.'}</p>
      )}
      {!busy && !out && !error && described === null && !plan && tab === 'results' && (
        <pre className="scroll-x" style={{ margin: dark ? '8px 14px' : '8px 0', fontSize: 13, opacity: 0.75 }}>{DESCRIBE_HELP}</pre>
      )}
    </div>
  )

  const tabs = (
    <div role="tablist" aria-label="Output" style={{ display: 'flex', gap: dark ? 18 : 28 }}>
      {(['results', 'plan', ...(challenge ? ['check'] : [])] as Tab[]).map((t) => (
        <button key={t} type="button" role="tab" aria-selected={tab === t} onClick={() => setTab(t)}
          style={{ minHeight: 44, padding: 0, background: 'none', border: 0, borderBottom: `${dark ? 2 : 4}px solid ${tab === t ? '#f26b3a' : 'transparent'}`, marginBottom: -2, fontSize: 15, fontWeight: 700, color: tab === t ? undefined : dark ? 'var(--ed-muted)' : 'var(--muted)', cursor: 'pointer' }}>
          {t === 'results' ? 'Results' : t === 'plan' ? 'Plan' : 'Check answer'}
        </button>
      ))}
    </div>
  )

  const challengePanel = challenge && (
    <ChallengePanel challenge={challenge} position={position} attempt={attempt} grade={grade} nextHref={nextId ? `/workbench/${nextId}` : undefined} backHref={backHref} dark={dark} />
  )

  if (!wide) {
    return (
      <div className="ed" style={{ minHeight: '100dvh', paddingBottom: 150 + inset }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10, padding: 'calc(env(safe-area-inset-top) + 12px) 12px 10px' }}>
          <Link href={challenge ? backHref : '/'} aria-label={challenge ? 'Back to the challenges' : 'Back to Today'} className="icon-btn" style={{ background: '#222', borderColor: '#333', color: '#ddd' }}><IconBack /></Link>
          <span className="chip" style={{ background: '#262626', color: '#ddd', minWidth: 0, overflow: 'hidden' }}>
            <span className="dot" style={{ background: status === 'ready' ? '#3fb950' : '#888' }} />
            <span style={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>{status === 'ready' ? `${version.replace(/ \(PGlite[^)]*\)/, '')} · ${dataset}` : 'PostgreSQL'}</span>
          </span>
          <details style={{ position: 'relative' }}>
            <summary aria-label="More actions" className="icon-btn" style={{ listStyle: 'none', background: '#222', borderColor: '#333', color: '#ddd' }}>•••</summary>
            <div style={{ position: 'absolute', right: 0, top: 50, zIndex: 30, minWidth: 220, background: '#232323', border: '1px solid #333', borderRadius: 6, padding: 6, display: 'flex', flexDirection: 'column' }}>
              <button type="button" className="btn" style={{ border: 0, justifyContent: 'flex-start', color: '#eee' }} onClick={() => { if (window.confirm('Rebuild the clinic dataset? Tables you created in the clinic schema are removed.')) void reset().then(() => setSchemaKey((k) => k + 1)) }}>Reset dataset</button>
              <Link href="/settings" className="btn" style={{ border: 0, justifyContent: 'flex-start', color: '#eee' }}>Settings</Link>
            </div>
          </details>
        </div>
        {challengePanel}
        {engine && challenge && THREE_WAYS_IDS.includes(challenge.id) && <ThreeWays session={engine} dark />}
        <div style={{ marginTop: 8 }}>
          <EngineGate dark>
            {sql !== null && <SqlEditor ref={editor} value={sql} onChange={setSql} onRun={() => void run()} errorPosition={Number(error?.position) || null} errorOffset={ran.offset} label="SQL editor" />}
          </EngineGate>
        </div>
        {ready && (
          <section aria-label="Output" style={{ margin: '6px 12px 0', borderRadius: 6, background: 'var(--ed-bar)', border: '1px solid var(--ed-line)', overflow: 'hidden' }}>
            <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8, padding: '0 14px', borderBottom: '1px solid var(--ed-line)', fontSize: 13, color: 'var(--ed-muted)' }}>
              {tabs}
              {out && tab === 'results' && <span><RunSummary out={out} /></span>}
            </header>
            <div style={{ paddingBottom: 10 }}>{output}</div>
          </section>
        )}
        <div style={{ position: 'fixed', left: 0, right: 0, bottom: inset, zIndex: 25, padding: `24px 12px calc(${inset ? '8px' : 'env(safe-area-inset-bottom) + 12px'})`, background: 'linear-gradient(to top, var(--ed-bg) 72%, rgba(22,22,22,0))' }}>
          <div role="toolbar" aria-label="SQL keys" className="scroll-x" style={{ display: 'flex', gap: 6, paddingBottom: 10 }}>
            {KEYS.map((k) => (
              <button key={k} type="button" aria-label={k === '\t' ? 'Tab' : `Insert ${k}`} onMouseDown={(e) => e.preventDefault()} onClick={() => editor.current?.insert(k === '\t' ? '  ' : k)}
                style={{ flex: 'none', minWidth: 44, height: 44, padding: '0 12px', borderRadius: 4, background: 'var(--ed-key)', border: 0, color: '#e7e7e7', fontFamily: k === '\t' ? 'var(--sans)' : 'var(--mono)', fontSize: k === '\t' ? 15 : 17 }}>
                {k === '\t' ? 'Tab' : k}
              </button>
            ))}
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button type="button" disabled={!ready || busy} onMouseDown={(e) => e.preventDefault()} onClick={() => void run()} style={{ flex: 1, display: 'flex', alignItems: 'center', gap: 12, minHeight: 56, padding: '0 18px', borderRadius: 6, background: 'var(--ed-key)', border: 0, color: '#efefef', fontSize: 17, fontWeight: 600 }}>
              <span style={{ color: 'var(--ed-fn)' }}><IconPlay /></span>Run
            </button>
            {challenge && (
              <button type="button" disabled={!ready || busy} onMouseDown={(e) => e.preventDefault()} onClick={() => void check()} style={{ minHeight: 56, padding: '0 16px', borderRadius: 6, background: '#efefec', border: 0, color: '#151515', fontSize: 16, fontWeight: 700 }}>Check</button>
            )}
            <button type="button" aria-label="Explain plan" disabled={!ready || busy} onMouseDown={(e) => e.preventDefault()} onClick={() => void doExplain()} style={{ width: 56, height: 56, borderRadius: 6, background: 'var(--ed-key)', border: 0, color: '#ddd', display: 'grid', placeItems: 'center' }}><IconPlan /></button>
            {!challenge && (
              <button type="button" aria-label="Reset dataset" disabled={!ready || busy} onClick={() => { if (window.confirm('Rebuild the clinic dataset? Tables you created in the clinic schema are removed.')) void reset().then(() => setSchemaKey((k) => k + 1)) }} style={{ width: 56, height: 56, borderRadius: 6, background: 'var(--ed-key)', border: 0, color: '#ddd', display: 'grid', placeItems: 'center' }}><IconReset /></button>
            )}
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="page-wide" style={{ maxWidth: 1440, paddingTop: 40 }}>
      <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between', alignItems: 'flex-end', gap: 20, paddingBottom: 20, borderBottom: '2px solid var(--ink)' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <p className="eyebrow">{challenge ? position : `${version || 'PostgreSQL'} in this browser · ${dataset} dataset`}</p>
          <h1 className="display" style={{ fontSize: 96 }}>Workbench</h1>
        </div>
        <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 10 }}>
          <button type="button" className="btn" disabled={!ready || busy} onClick={() => { if (window.confirm('Rebuild the clinic dataset? Tables you created in the clinic schema are removed.')) void reset().then(() => setSchemaKey((k) => k + 1)) }}>Reset data</button>
          <button type="button" className="btn" disabled={!ready || busy} onClick={() => void doExplain()}>Explain</button>
          {challenge && <button type="button" className="btn" disabled={!ready || busy} onClick={() => void check()}>Check answer</button>}
          <button type="button" className="btn btn-primary" disabled={!ready || busy} onClick={() => void run()}><IconPlay />Run <span style={{ fontWeight: 400, opacity: 0.65, fontSize: 13 }}>⌘↵</span></button>
        </div>
      </div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '32px 48px', paddingTop: 28, alignItems: 'flex-start' }}>
        <aside aria-label="Schema" style={{ flex: '1 1 240px', minWidth: 0 }}>
          {engine && status === 'ready' ? <SchemaList session={engine} refreshKey={schemaKey} onInsert={(t) => editor.current?.insert(t)} /> : <p className="muted" style={{ fontSize: 14 }}>The schema appears when PostgreSQL is running.</p>}
        </aside>
        <section aria-label="Editor and output" style={{ flex: '999 1 640px', minWidth: 0 }}>
          {challengePanel}
          {engine && challenge && THREE_WAYS_IDS.includes(challenge.id) && <ThreeWays session={engine} dark={false} />}
          <div style={{ marginTop: challenge ? 20 : 0, borderRadius: 4, overflow: 'hidden' }}>
            <EngineGate>
              {sql !== null && <SqlEditor ref={editor} value={sql} onChange={setSql} onRun={() => void run()} errorPosition={Number(error?.position) || null} errorOffset={ran.offset} label="SQL editor" />}
            </EngineGate>
          </div>
          {ready && (
            <>
              <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: 12, marginTop: 24, borderBottom: '2px solid var(--ink)' }}>
                {tabs}
                {out && tab === 'results' && <span className="muted num" style={{ fontSize: 13 }}><RunSummary out={out} /></span>}
              </div>
              {output}
            </>
          )}
        </section>
      </div>
    </div>
  )
}
