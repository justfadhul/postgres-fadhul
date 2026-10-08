// All learner state lives here, in the browser's IndexedDB. Browser storage
// can be lost (Safari may clear a site that has not been used for a while), so
// everything can be exported to a JSON file and imported again.

export const STORES = ['progress', 'answers', 'attempts', 'drafts', 'activity', 'settings'] as const
export type StoreName = (typeof STORES)[number]

export interface ProgressRecord {
  status: 'started' | 'done'
  updatedAt: string
}
export interface AnswerRecord {
  choice: number
  correct: boolean
  at: string
}
export interface AttemptRecord {
  passed: boolean
  sql: string
  at: string
  tries: number
}
export interface DraftRecord {
  sql: string
  at: string
}
export interface ActivityRecord {
  seconds: number
}

export interface ExportFile {
  app: 'data-systems-mastery'
  schemaVersion: 1
  exportedAt: string
  stores: Record<StoreName, Record<string, unknown>>
}

const DB_NAME = 'dsm-state'
const DB_VERSION = 1
let dbPromise: Promise<IDBDatabase> | null = null

function open(): Promise<IDBDatabase> {
  dbPromise ??= new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION)
    req.onupgradeneeded = () => {
      for (const name of STORES) if (!req.result.objectStoreNames.contains(name)) req.result.createObjectStore(name)
    }
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => {
      dbPromise = null
      reject(req.error ?? new Error('Could not open browser storage'))
    }
  })
  return dbPromise
}

function done(tx: IDBTransaction): Promise<void> {
  return new Promise((resolve, reject) => {
    tx.oncomplete = () => resolve()
    tx.onerror = () => reject(tx.error)
    tx.onabort = () => reject(tx.error ?? new Error('Storage transaction aborted'))
  })
}

function request<T>(req: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error)
  })
}

type Listener = (store: StoreName) => void
const listeners = new Set<Listener>()

/** Called after every write, so screens can refresh. */
export function subscribe(fn: Listener): () => void {
  listeners.add(fn)
  return () => listeners.delete(fn)
}
function notify(store: StoreName) {
  for (const fn of listeners) fn(store)
}

export async function get<T>(store: StoreName, key: string): Promise<T | undefined> {
  const db = await open()
  return request(db.transaction(store).objectStore(store).get(key)) as Promise<T | undefined>
}

export async function put(store: StoreName, key: string, value: unknown): Promise<void> {
  const db = await open()
  const tx = db.transaction(store, 'readwrite')
  tx.objectStore(store).put(value, key)
  await done(tx)
  notify(store)
}

export async function remove(store: StoreName, key: string): Promise<void> {
  const db = await open()
  const tx = db.transaction(store, 'readwrite')
  tx.objectStore(store).delete(key)
  await done(tx)
  notify(store)
}

export async function all<T>(store: StoreName): Promise<Record<string, T>> {
  const db = await open()
  const os = db.transaction(store).objectStore(store)
  const [keys, values] = await Promise.all([request(os.getAllKeys()), request(os.getAll())])
  return Object.fromEntries(keys.map((k, i) => [String(k), values[i] as T]))
}

/** Read-modify-write in one transaction (used for counters such as study time). */
export async function update<T>(store: StoreName, key: string, fn: (old: T | undefined) => T): Promise<T> {
  const db = await open()
  const tx = db.transaction(store, 'readwrite')
  const os = tx.objectStore(store)
  const next = fn((await request(os.get(key))) as T | undefined)
  os.put(next, key)
  await done(tx)
  notify(store)
  return next
}

export async function exportAll(): Promise<ExportFile> {
  const entries = await Promise.all(STORES.map(async (s) => [s, await all(s)] as const))
  return {
    app: 'data-systems-mastery',
    schemaVersion: 1,
    exportedAt: new Date().toISOString(),
    stores: Object.fromEntries(entries) as ExportFile['stores'],
  }
}

/** Checks a parsed file before anything is replaced; throws a message the learner can act on. */
export function validateExport(data: unknown): ExportFile {
  const f = data as Partial<ExportFile> | null
  if (!f || typeof f !== 'object' || f.app !== 'data-systems-mastery') {
    throw new Error('This file is not a Data Systems Mastery progress export.')
  }
  if (f.schemaVersion !== 1) throw new Error(`This export uses format ${String(f.schemaVersion)}; this version of the site reads format 1.`)
  if (!f.stores || typeof f.stores !== 'object') throw new Error('The export has no data in it.')
  for (const [name, records] of Object.entries(f.stores)) {
    if (!(STORES as readonly string[]).includes(name)) throw new Error(`Unknown section "${name}" in the export.`)
    if (!records || typeof records !== 'object' || Array.isArray(records)) throw new Error(`Section "${name}" is damaged.`)
  }
  return f as ExportFile
}

/** Replaces all stored progress with the file's contents. */
export async function importAll(data: unknown): Promise<Record<StoreName, number>> {
  const file = validateExport(data)
  const db = await open()
  const tx = db.transaction([...STORES], 'readwrite')
  const counts = {} as Record<StoreName, number>
  for (const name of STORES) {
    const os = tx.objectStore(name)
    os.clear()
    const records = file.stores[name] ?? {}
    for (const [k, v] of Object.entries(records)) os.put(v, k)
    counts[name] = Object.keys(records).length
  }
  await done(tx)
  for (const name of STORES) notify(name)
  return counts
}

/** The local calendar date, used as the key for study time. */
export function todayKey(d = new Date()): string {
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}

/** Test helper: forget the open connection (fake-indexeddb is reset between tests). */
export function _resetForTests() {
  dbPromise = null
}
