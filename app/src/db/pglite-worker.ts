// Runs PostgreSQL (PGlite) off the main thread so long queries never freeze the page.
import { PGlite } from '@electric-sql/pglite'
import { btree_gist } from '@electric-sql/pglite/contrib/btree_gist'
import { toErrorFields, type Request, type Response } from './protocol'

let db: Promise<PGlite> | null = null

/** One open copy of a database at a time: a second tab must not write the same IndexedDB files. */
function holdLock(name: string): Promise<boolean> {
  return new Promise((resolve) => {
    void navigator.locks.request(`dsm-db:${name}`, { ifAvailable: true }, (lock) => {
      resolve(lock !== null)
      // Held until this worker is terminated or the tab closes.
      return lock ? new Promise<void>(() => {}) : undefined
    })
  })
}

async function handle(req: Request): Promise<unknown> {
  switch (req.method) {
    case 'open': {
      if (db) return true
      if (!(await holdLock(req.name))) {
        throw new Error('This database is open in another tab. Close the other tab and try again.')
      }
      // IndexedDB storage: PGlite's OPFS filesystem does not work in Safari.
      db = PGlite.create({ dataDir: `idb://${req.name}`, extensions: { btree_gist } })
      await db
      return true
    }
    case 'query':
      return (await ready()).query(req.sql, req.params)
    case 'exec':
      return (await ready()).exec(req.sql)
    case 'close':
      if (db) await (await db).close()
      db = null
      return true
  }
}

function ready(): Promise<PGlite> {
  if (!db) throw new Error('Database is not open')
  return db
}

// Requests run one at a time, in order: PGlite is a single connection.
let queue: Promise<unknown> = Promise.resolve()
self.onmessage = (e: MessageEvent<Request>) => {
  const req = e.data
  queue = queue.then(async () => {
    let res: Response
    try {
      res = { id: req.id, ok: true, result: await handle(req) }
    } catch (err) {
      res = { id: req.id, ok: false, error: toErrorFields(err) }
    }
    self.postMessage(res)
  })
}
