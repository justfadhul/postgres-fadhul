import type { Results } from '@electric-sql/pglite'
import { SqlError, type Request, type Response } from './protocol'
import type { RunOutput } from './raw'

type Call = Request extends infer R ? (R extends { id: number } ? Omit<R, 'id'> : never) : never

/** Anything that can run SQL as text: the browser engine, or PGlite directly in tests. */
export interface SqlSession {
  run(sql: string, maxRows?: number): Promise<RunOutput>
  exec(sql: string): Promise<unknown>
}

/** PGlite running in a Web Worker, persisted to IndexedDB. */
export class Engine implements SqlSession {
  #worker: Worker
  #next = 1
  #pending = new Map<number, { resolve: (v: unknown) => void; reject: (e: unknown) => void }>()

  private constructor() {
    this.#worker = new Worker(new URL('./pglite-worker.ts', import.meta.url), { type: 'module', name: 'pglite-worker' })
    this.#worker.onmessage = (e: MessageEvent<Response>) => {
      const p = this.#pending.get(e.data.id)
      if (!p) return
      this.#pending.delete(e.data.id)
      if (e.data.ok) p.resolve(e.data.result)
      else p.reject(new SqlError(e.data.error))
    }
    this.#worker.onerror = (e) => {
      const err = new Error(`Database worker failed: ${e.message}`)
      for (const p of this.#pending.values()) p.reject(err)
      this.#pending.clear()
    }
  }

  static async open(name: string): Promise<Engine> {
    const engine = new Engine()
    try {
      await engine.#call({ method: 'open', name })
    } catch (e) {
      engine.#worker.terminate()
      throw e
    }
    return engine
  }

  #call(msg: Call): Promise<unknown> {
    const id = this.#next++
    return new Promise((resolve, reject) => {
      this.#pending.set(id, { resolve, reject })
      this.#worker.postMessage({ ...msg, id })
    })
  }

  query<T = Record<string, unknown>>(sql: string, params?: unknown[]): Promise<Results<T>> {
    return this.#call({ method: 'query', sql, params }) as Promise<Results<T>>
  }

  exec(sql: string): Promise<Results[]> {
    return this.#call({ method: 'exec', sql }) as Promise<Results[]>
  }

  /** Runs statements and returns every result with values as PostgreSQL text. */
  run(sql: string, maxRows?: number): Promise<RunOutput> {
    return this.#call({ method: 'run', sql, maxRows }) as Promise<RunOutput>
  }

  /** Stops a runaway query by ending the worker. The database reopens from IndexedDB; only the running statement is lost. */
  terminate(): void {
    this.#worker.terminate()
    const err = new Error('Stopped. The query was cancelled and the database is restarting.')
    for (const p of this.#pending.values()) p.reject(err)
    this.#pending.clear()
  }

  async close(): Promise<void> {
    await this.#call({ method: 'close' })
    this.#worker.terminate()
  }
}

export function openEngine(name: string): Promise<Engine> {
  return Engine.open(name)
}
