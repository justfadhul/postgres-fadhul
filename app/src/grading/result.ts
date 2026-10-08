// The result grader: runs the reference query and the learner's query on the
// same data and compares the rows. Order matters only when the task says so.
// Everything runs inside a transaction that is always rolled back, so grading
// never changes the learner's database.

import type { ResultGrader, SqlPattern } from '@content/types'
import type { SqlSession } from '../db/engine'
import { toErrorFields, type SqlErrorFields } from '../db/protocol'
import { lastResultSet, type RawResult } from '../db/raw'

export interface GradeReport {
  pass: boolean
  messages: string[]
  error?: SqlErrorFields
  learner?: RawResult
  expected?: RawResult
}

/**
 * Removes comments, string literals and quoted identifiers so patterns only see
 * SQL structure. One pass from left to right, as PostgreSQL's lexer reads it:
 * a `--` inside a string is not a comment, block comments nest, and dollar
 * quotes ($$…$$, $tag$…$tag$) and E'…' escapes are understood.
 */
export function stripSql(sql: string): string {
  let out = ''
  let i = 0
  while (i < sql.length) {
    const c = sql[i]
    const n = sql[i + 1]
    if (c === '-' && n === '-') {
      const end = sql.indexOf('\n', i)
      i = end < 0 ? sql.length : end
      out += ' '
      continue
    }
    if (c === '/' && n === '*') {
      let depth = 1
      i += 2
      while (i < sql.length && depth > 0) {
        if (sql.startsWith('/*', i)) { depth++; i += 2 }
        else if (sql.startsWith('*/', i)) { depth--; i += 2 }
        else i++
      }
      out += ' '
      continue
    }
    const tag = c === '$' && !/[\w$]/.test(sql[i - 1] ?? '') ? /^\$(?:[A-Za-z_][A-Za-z0-9_]*)?\$/.exec(sql.slice(i))?.[0] : undefined
    if (tag) {
      const end = sql.indexOf(tag, i + tag.length)
      i = end < 0 ? sql.length : end + tag.length
      out += "''"
      continue
    }
    if (c === "'" || c === '"') {
      const escapes = c === "'" && /(^|[^\w])[eE]$/.test(sql.slice(0, i))
      i++
      while (i < sql.length) {
        if (escapes && sql[i] === '\\') { i += 2; continue }
        if (sql[i] === c) {
          if (sql[i + 1] === c) { i += 2; continue }
          i++
          break
        }
        i++
      }
      out += c + c
      continue
    }
    out += c
    i++
  }
  return out
}

const TRANSACTION_CONTROL = /(^|;)\s*(begin|commit|rollback|abort|end|start\s+transaction|savepoint|release)\b/i

function patternFails(sql: string, patterns: SqlPattern[] | undefined, wanted: boolean): string[] {
  const stripped = stripSql(sql)
  return (patterns ?? []).filter((p) => new RegExp(p.pattern, 'i').test(stripped) !== wanted).map((p) => p.message)
}

const NUMERIC_TYPES = new Set([20, 21, 23, 26, 700, 701, 1700])

/** A value's comparable form: numbers by value (to 6 decimal places), everything else as PostgreSQL's text. */
export function normaliseValue(value: string | null, typeId: number): string {
  if (value === null) return '\u0000NULL'
  if (NUMERIC_TYPES.has(typeId)) {
    const n = Number(value)
    if (Number.isFinite(n)) return `n:${Math.round(n * 1e6) / 1e6}`
  }
  return `t:${value}`
}

const isNumeric = (typeId: number | undefined) => NUMERIC_TYPES.has(typeId ?? 25)

function rowKey(row: (string | null)[], fields: RawResult['fields']): string {
  return JSON.stringify(row.map((v, i) => normaliseValue(v, fields[i]?.dataTypeID ?? 25)))
}

function showRow(row: (string | null)[]): string {
  return `(${row.map((v) => (v === null ? 'NULL' : v)).join(', ')})`
}

export function compareResults(expected: RawResult, actual: RawResult, ordered: boolean): string[] {
  const problems: string[] = []
  if (expected.fields.length !== actual.fields.length) {
    problems.push(
      `Expected ${expected.fields.length} column${expected.fields.length === 1 ? '' : 's'} (${expected.fields.map((f) => f.name).join(', ')}), ` +
        `but your query returned ${actual.fields.length} (${actual.fields.map((f) => f.name).join(', ')}).`,
    )
    return problems
  }
  expected.fields.forEach((f, i) => {
    const a = actual.fields[i]
    if (a && isNumeric(f.dataTypeID) !== isNumeric(a.dataTypeID)) {
      problems.push(
        isNumeric(f.dataTypeID)
          ? `Column ${i + 1} (${a.name}) should be a number, but yours is not. Check for a cast to text or to_char.`
          : `Column ${i + 1} (${a.name}) should not be a number, but yours is. Check the expression in that column.`,
      )
    }
  })
  if (expected.rows.length !== actual.rows.length) {
    problems.push(`Expected ${expected.rows.length} row${expected.rows.length === 1 ? '' : 's'}, but your query returned ${actual.rows.length}.`)
  }
  if (ordered) {
    const n = Math.min(expected.rows.length, actual.rows.length)
    for (let i = 0; i < n; i++) {
      const e = expected.rows[i] ?? [], a = actual.rows[i] ?? []
      if (rowKey(e, expected.fields) !== rowKey(a, actual.fields)) {
        problems.push(`Row ${i + 1} differs: expected ${showRow(e)}, got ${showRow(a)}. Check the values and the ORDER BY.`)
        break
      }
    }
    return problems
  }
  const counts = new Map<string, { n: number; row: (string | null)[] }>()
  for (const r of expected.rows) {
    const k = rowKey(r, expected.fields)
    counts.set(k, { n: (counts.get(k)?.n ?? 0) + 1, row: r })
  }
  const extra: (string | null)[][] = []
  for (const r of actual.rows) {
    const k = rowKey(r, actual.fields)
    const c = counts.get(k)
    if (c && c.n > 0) c.n--
    else extra.push(r)
  }
  const missing = [...counts.values()].flatMap((c) => Array.from({ length: c.n }, () => c.row))
  if (missing.length) problems.push(`Missing ${missing.length} expected row${missing.length === 1 ? '' : 's'}, for example ${showRow(missing[0] ?? [])}.`)
  if (extra.length) problems.push(`${extra.length} row${extra.length === 1 ? '' : 's'} should not be there, for example ${showRow(extra[0] ?? [])}.`)
  return problems
}

export async function gradeResult(session: SqlSession, learnerSql: string, grader: ResultGrader): Promise<GradeReport> {
  if (!stripSql(learnerSql).trim()) return { pass: false, messages: ['Write a query first.'] }
  if (TRANSACTION_CONTROL.test(stripSql(learnerSql))) {
    return { pass: false, messages: ['Leave out BEGIN, COMMIT and ROLLBACK here: the grader runs your query inside its own transaction.'] }
  }
  const shape = [...patternFails(learnerSql, grader.requires, true), ...patternFails(learnerSql, grader.forbids, false)]

  let expected: RawResult | undefined
  let learner: RawResult | undefined
  let error: SqlErrorFields | undefined
  await session.exec('BEGIN')
  try {
    // Extra rows for cases the dataset lacks (ties, patients with no visits…), rolled back with everything else.
    if (grader.setup) {
      try {
        await session.exec(grader.setup)
      } catch (e) {
        const f = toErrorFields(e)
        return { pass: false, messages: [`The grader's test rows could not be added (${f.message}). Has the dataset changed? Reset it from the workbench menu.`] }
      }
    }
    // Reference first, so a learner's INSERT or DELETE cannot change the expected answer.
    try {
      expected = lastResultSet(await session.run(grader.reference))
    } catch (e) {
      const f = toErrorFields(e)
      return { pass: false, messages: [`The reference answer failed (${f.message}). Has the dataset changed? Reset it from the workbench menu.`] }
    }
    try {
      learner = lastResultSet(await session.run(learnerSql))
    } catch (e) {
      error = toErrorFields(e)
    }
  } finally {
    await session.exec('ROLLBACK')
  }

  if (error) return { pass: false, messages: [`PostgreSQL rejected the query: ${error.message}`, ...shape], error, expected }
  if (!expected) return { pass: false, messages: ['The reference answer returned no rows to compare. This is a content bug; please report it.'] }
  if (!learner) return { pass: false, messages: ['Your SQL ran but returned no result set. The answer should be a SELECT.', ...shape], expected }
  const problems = [...compareResults(expected, learner, grader.ordered), ...shape]
  return { pass: problems.length === 0, messages: problems.length ? problems : ['Correct: same rows as the reference answer.'], learner, expected }
}
