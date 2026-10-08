// Running SQL the way psql shows it: every value as PostgreSQL's own text
// output (timestamps in the session time zone, numerics with their scale,
// booleans as t/f), never converted to JavaScript types. Used by the worker
// in the browser and directly by the Node tests, so both see the same thing.
import type { PGlite } from '@electric-sql/pglite'

/**
 * PGlite merges `parsers` into its defaults with an object spread, so a Proxy
 * does not work: list every built-in type OID explicitly. Types without an
 * entry (user-defined ones) already arrive as text.
 */
export const RAW_PARSERS: Record<number, (value: string) => string> = Object.fromEntries(
  Array.from({ length: 16384 }, (_, oid) => [oid, (value: string) => value]),
)

/** Settings every session starts with. Lessons explain both. */
export const SESSION_SETUP = `SET TIME ZONE 'Africa/Kampala'; SET search_path = clinic, public;`

export interface RawField {
  name: string
  dataTypeID: number
}

export interface RawResult {
  fields: RawField[]
  rows: (string | null)[][]
  /** Rows the statement produced, before any truncation for display. */
  totalRows: number
  /** Rows changed by INSERT, UPDATE or DELETE, when PostgreSQL reports it. */
  affectedRows?: number
}

export interface RunOutput {
  results: RawResult[]
  notices: string[]
  ms: number
}

/** Runs one or more statements and returns every result, values as text. */
export async function runRaw(db: Pick<PGlite, 'exec'>, sql: string, maxRows = Infinity): Promise<RunOutput> {
  const notices: string[] = []
  const t0 = performance.now()
  const results = await db.exec(sql, {
    rowMode: 'array',
    parsers: RAW_PARSERS,
    onNotice: (n) => notices.push(`${n.severity}: ${n.message}`),
  })
  const ms = Math.round(performance.now() - t0)
  return {
    ms,
    notices,
    results: results.map((r) => {
      const rows = r.rows as unknown as (string | null)[][]
      return {
        fields: r.fields.map((f) => ({ name: f.name, dataTypeID: f.dataTypeID })),
        rows: rows.length > maxRows ? rows.slice(0, maxRows) : rows,
        totalRows: rows.length,
        affectedRows: r.affectedRows,
      }
    }),
  }
}

/** The last result that returned columns, which is what a learner means by "the answer". */
export function lastResultSet(out: RunOutput): RawResult | undefined {
  for (let i = out.results.length - 1; i >= 0; i--) {
    const r = out.results[i]
    if (r && r.fields.length > 0) return r
  }
  return undefined
}
