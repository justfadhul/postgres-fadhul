// Milestone 0 engine check. It runs the same spike suite as tests/spikes in the
// learner's own browser, so results from a real iPhone can be compared with the
// WebKit emulation in CI.
import { useRef, useState } from 'react'
import { SIZES, type SizeName } from '@content/datasets/clinic'
import { openEngine, type Engine } from '../db/engine'
import { ENGINE_DOWNLOAD_BYTES, formatMB } from '../db/engineSize'
import { runCoreSpikes, spikeSeed, type SpikeResult } from '../spikes/suite'

const DB_NAME = 'dsm-engine-check'

interface Report {
  environment: Record<string, unknown>
  results: SpikeResult[]
}

function environment(): Record<string, unknown> {
  const nav = navigator as Navigator & { deviceMemory?: number }
  return {
    userAgent: navigator.userAgent,
    viewport: `${window.innerWidth}x${window.innerHeight}`,
    devicePixelRatio: window.devicePixelRatio,
    hardwareConcurrency: navigator.hardwareConcurrency,
    deviceMemoryGB: nav.deviceMemory ?? 'not reported',
    crossOriginIsolated: window.crossOriginIsolated,
  }
}

async function storageInfo(): Promise<string[]> {
  const out: string[] = []
  if (!navigator.storage?.estimate) return ['navigator.storage.estimate() is not available.']
  const est = await navigator.storage.estimate()
  out.push(`Storage used ${formatMB(est.usage ?? 0)} of a ${formatMB(est.quota ?? 0)} quota.`)
  if (navigator.storage.persisted) out.push(`Persistent storage granted: ${await navigator.storage.persisted()}.`)
  return out
}

function timedStep(id: string, title: string, fn: (log: (s: string) => void) => Promise<void>): Promise<SpikeResult> {
  const details: string[] = []
  const t0 = performance.now()
  return fn((s) => details.push(s)).then(
    () => ({ id, title, pass: true, ms: Math.round(performance.now() - t0), details }),
    (e: unknown) => {
      details.push(`FAILED: ${(e as Error).message}`)
      return { id, title, pass: false, ms: Math.round(performance.now() - t0), details }
    },
  )
}

export default function Spikes() {
  const engine = useRef<Engine | null>(null)
  const [busy, setBusy] = useState<string | null>(null)
  const [report, setReport] = useState<Report>({ environment: {}, results: [] })
  const [copied, setCopied] = useState(false)

  const add = (r: SpikeResult) =>
    setReport((prev) => ({ environment: environment(), results: [...prev.results.filter((x) => x.id !== r.id), r] }))

  async function ensureEngine(): Promise<Engine> {
    if (engine.current) return engine.current
    let opened: Engine | null = null
    const r = await timedStep('boot', 'Download and start the engine (Web Worker, IndexedDB)', async (log) => {
      opened = await openEngine(DB_NAME)
      const { rows } = await opened.query<{ v: string }>('SELECT version() AS v')
      log(rows[0]?.v ?? 'no version')
    })
    add(r)
    if (!opened) throw new Error('engine did not start')
    engine.current = opened
    return opened
  }

  async function run(label: string, body: () => Promise<void>) {
    setBusy(label)
    setCopied(false)
    try {
      await body()
    } catch (e) {
      add({ id: `error-${label}`, title: `${label} stopped`, pass: false, ms: 0, details: [(e as Error).message] })
    } finally {
      setBusy(null)
    }
  }

  const runCore = () =>
    run('core', async () => {
      const db = await ensureEngine()
      for (const r of await runCoreSpikes(db)) add(r)
      add(
        await timedStep('persist-write', 'Write a marker row to IndexedDB-backed storage', async (log) => {
          await db.exec(`CREATE TABLE IF NOT EXISTS public.spike_persist (id int PRIMARY KEY, written_at timestamptz NOT NULL)`)
          const { rows } = await db.query<{ written_at: string }>(
            `INSERT INTO public.spike_persist VALUES (1, now())
             ON CONFLICT (id) DO UPDATE SET written_at = excluded.written_at RETURNING written_at::text`,
          )
          log(`Marker written at ${rows[0]?.written_at}. Reload the page, then press "Check saved data".`)
          if (navigator.storage?.persist) log(`navigator.storage.persist() returned ${await navigator.storage.persist()}.`)
          for (const s of await storageInfo()) log(s)
        }),
      )
    })

  const runSeed = (name: SizeName) =>
    run(`seed-${name}`, async () => {
      const db = await ensureEngine()
      add(await spikeSeed(db, SIZES[name], name))
      add(await timedStep('storage', 'Storage after seeding', async (log) => {
        for (const s of await storageInfo()) log(s)
      }))
    })

  const checkSaved = () =>
    run('reopen', async () => {
      const fresh = !engine.current
      const db = await ensureEngine()
      add(
        await timedStep('persist-read', 'Read back saved data', async (log) => {
          log(fresh ? 'Engine opened from existing IndexedDB data (see the boot step for the reopen time).' : 'Engine was already open in this page; reload first for a true reopen test.')
          const marker = await db.query<{ written_at: string }>(
            `SELECT written_at::text FROM public.spike_persist WHERE id = 1`,
          ).catch(() => ({ rows: [] as { written_at: string }[] }))
          if (!marker.rows[0]) throw new Error('No marker row found. Run the checks first, then reload.')
          log(`Marker found, written at ${marker.rows[0].written_at}.`)
          const visits = await db
            .query<{ n: number }>(`SELECT count(*)::int AS n FROM clinic.visits`)
            .then((r) => r.rows[0]?.n ?? 0)
            .catch(() => 0)
          log(visits ? `Seeded dataset survived the reload: ${visits} visits.` : 'No seeded dataset saved yet.')
        }),
      )
    })

  const json = JSON.stringify(report, null, 2)
  const done = report.results.length > 0

  return (
    <>
      <h1>Engine check</h1>
      <p>
        This page tests whether PostgreSQL runs properly in this browser: the engine loads in a background worker, saves to
        the browser's storage, and supports the features later modules need.
      </p>
      <div className="notice" role="note">
        The first run downloads the database engine, about <strong>{formatMB(ENGINE_DOWNLOAD_BYTES)}</strong> compressed.
        It is cached afterwards. Use Wi-Fi if your data is metered.
      </div>

      <div className="btn-row">
        <button type="button" className="btn btn--primary" disabled={busy !== null} onClick={runCore} data-testid="run-core">
          {busy === 'core' ? 'Running…' : 'Download engine and run checks'}
        </button>
        <button type="button" className="btn" disabled={busy !== null} onClick={checkSaved} data-testid="check-saved">
          Check saved data
        </button>
      </div>
      <h2>Dataset size</h2>
      <p className="muted">Seeds the synthetic clinic data. Larger sizes take longer and use more storage.</p>
      <div className="btn-row">
        {(Object.keys(SIZES) as SizeName[]).map((name) => (
          <button key={name} type="button" className="btn" disabled={busy !== null} onClick={() => runSeed(name)} data-testid={`seed-${name}`}>
            {busy === `seed-${name}` ? 'Seeding…' : `${name} (${SIZES[name].visits.toLocaleString('en-GB')} visits)`}
          </button>
        ))}
      </div>

      <section aria-live="polite" aria-busy={busy !== null}>
        <h2>Results</h2>
        {!done && <p className="muted">No results yet.</p>}
        {report.results.map((r) => (
          <div key={r.id} className={`result ${r.pass ? 'status--pass' : 'status--fail'}`} data-testid={`result-${r.id}`} data-pass={r.pass}>
            <strong>
              {r.pass ? 'Pass' : 'Fail'}: {r.title}
            </strong>{' '}
            <span>({r.ms.toLocaleString('en-GB')} ms)</span>
            <ul>
              {r.details.map((d, i) => (
                <li key={i}>{d}</li>
              ))}
            </ul>
          </div>
        ))}
      </section>
      {done && (
        <>
          <div className="btn-row">
            <button
              type="button"
              className="btn"
              onClick={() =>
                navigator.clipboard.writeText(json).then(
                  () => setCopied(true),
                  () => setCopied(false),
                )
              }
            >
              {copied ? 'Copied' : 'Copy results'}
            </button>
          </div>
          <details>
            <summary>Raw results (JSON)</summary>
            <pre className="log" data-testid="spike-json">
              {json}
            </pre>
          </details>
        </>
      )}
    </>
  )
}
