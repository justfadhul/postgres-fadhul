// One PostgreSQL engine for the whole app, started on first need: the learner
// sees the download size and agrees once; the clinic dataset is built the
// first time the database opens empty.
import { createContext, useCallback, useContext, useMemo, useRef, useState, type ReactNode } from 'react'
import { clinicSeedSql, SIZES, type SizeName } from '@content/datasets/clinic'
import { openEngine, type Engine } from '../db/engine'
import { SESSION_SETUP } from '../db/raw'
import { get, put } from '../storage/store'

export type EngineStatus = 'off' | 'needs-consent' | 'loading' | 'seeding' | 'ready' | 'error'

export interface EngineState {
  status: EngineStatus
  engine: Engine | null
  version: string
  dataset: SizeName
  error: string
  /** Start the engine (asks for consent first if the learner has not agreed yet). */
  request: () => void
  /** The learner agreed to the download. */
  consent: () => void
  /** Rebuild the clinic dataset, optionally at a new size. */
  reset: (size?: SizeName) => Promise<void>
  /** Cancel a running query by restarting the engine. */
  stop: () => void
}

const DB_NAME = 'dsm-workbench'
const Ctx = createContext<EngineState | null>(null)

let shared: Promise<Engine> | null = null

export function EngineProvider({ children }: { children: ReactNode }) {
  const [status, setStatus] = useState<EngineStatus>('off')
  const [engine, setEngine] = useState<Engine | null>(null)
  const [version, setVersion] = useState('')
  const [dataset, setDataset] = useState<SizeName>('standard')
  const [error, setError] = useState('')
  const starting = useRef(false)

  const boot = useCallback(async () => {
    if (starting.current) return
    starting.current = true
    setStatus('loading')
    setError('')
    try {
      shared ??= openEngine(DB_NAME)
      const e = await shared
      const size = ((await get<SizeName>('settings', 'datasetSize')) ?? 'standard') as SizeName
      setDataset(size)
      const has = await e.run(`SELECT to_regclass('clinic.visits') IS NOT NULL`)
      if (has.results[0]?.rows[0]?.[0] !== 't') {
        setStatus('seeding')
        await e.exec(clinicSeedSql(SIZES[size]))
        await e.exec(SESSION_SETUP)
      }
      const v = await e.run(`SELECT split_part(version(), ' on ', 1)`)
      setVersion(v.results[0]?.rows[0]?.[0] ?? '')
      setEngine(e)
      setStatus('ready')
    } catch (err) {
      shared = null
      setError((err as Error).message)
      setStatus('error')
    } finally {
      starting.current = false
    }
  }, [])

  const request = useCallback(() => {
    if (status === 'ready' || status === 'loading' || status === 'seeding') return
    void get<boolean>('settings', 'engineConsent').then(
      (ok) => (ok ? boot() : setStatus('needs-consent')),
      () => setStatus('needs-consent'),
    )
  }, [boot, status])

  const consent = useCallback(() => {
    void put('settings', 'engineConsent', true).finally(() => void boot())
  }, [boot])

  const reset = useCallback(
    async (size?: SizeName) => {
      if (!engine) return
      const next = size ?? dataset
      setStatus('seeding')
      try {
        await engine.exec(clinicSeedSql(SIZES[next]))
        await engine.exec(SESSION_SETUP)
        await put('settings', 'datasetSize', next)
        setDataset(next)
        setStatus('ready')
      } catch (err) {
        setError((err as Error).message)
        setStatus('error')
      }
    },
    [dataset, engine],
  )

  const stop = useCallback(() => {
    engine?.terminate()
    shared = null
    setEngine(null)
    void boot()
  }, [boot, engine])

  const value = useMemo(
    () => ({ status, engine, version, dataset, error, request, consent, reset, stop }),
    [status, engine, version, dataset, error, request, consent, reset, stop],
  )
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>
}

export function useEngine(): EngineState {
  const v = useContext(Ctx)
  if (!v) throw new Error('useEngine outside EngineProvider')
  return v
}
