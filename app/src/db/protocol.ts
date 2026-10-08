// Messages between the page and the PGlite worker. PGlite's own PGliteWorker
// forwards only error.message, which loses the SQLSTATE code that graders and
// the error display need, so the app uses this small protocol instead.

export type Request =
  | { id: number; method: 'open'; name: string }
  | { id: number; method: 'query'; sql: string; params?: unknown[] }
  | { id: number; method: 'exec'; sql: string }
  | { id: number; method: 'run'; sql: string; maxRows?: number }
  | { id: number; method: 'close' }

export type Response =
  | { id: number; ok: true; result: unknown }
  | { id: number; ok: false; error: SqlErrorFields }

/** The fields PostgreSQL sends with an error (see "Error and Notice Message Fields"). */
export interface SqlErrorFields {
  message: string
  code?: string
  severity?: string
  detail?: string
  hint?: string
  position?: string
  where?: string
  schema?: string
  table?: string
  column?: string
  dataType?: string
  constraint?: string
}

const FIELDS = ['code', 'severity', 'detail', 'hint', 'position', 'where', 'schema', 'table', 'column', 'dataType', 'constraint'] as const

export function toErrorFields(err: unknown): SqlErrorFields {
  const src = (err ?? {}) as Record<string, unknown>
  const out: SqlErrorFields = { message: typeof src.message === 'string' ? src.message : String(err) }
  for (const f of FIELDS) {
    const v = src[f]
    if (typeof v === 'string' && v !== '') out[f] = v
  }
  return out
}

export class SqlError extends Error implements SqlErrorFields {
  code?: string
  severity?: string
  detail?: string
  hint?: string
  position?: string
  where?: string
  schema?: string
  table?: string
  column?: string
  dataType?: string
  constraint?: string

  constructor(fields: SqlErrorFields) {
    super(fields.message)
    this.name = 'SqlError'
    Object.assign(this, fields)
  }
}
