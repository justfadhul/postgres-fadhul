// EXPLAIN (ANALYZE, BUFFERS) helpers. ANALYZE really runs the statement, so it
// always runs inside a transaction that is rolled back.
import type { SqlSession } from '../db/engine'
import { stripSql } from '../grading/result'

export interface PlanNode {
  'Node Type': string
  'Relation Name'?: string
  Alias?: string
  'Index Name'?: string
  'Join Type'?: string
  'Parent Relationship'?: string
  'Plan Rows'?: number
  'Actual Rows'?: number
  'Actual Loops'?: number
  'Shared Hit Blocks'?: number
  'Shared Read Blocks'?: number
  Filter?: string
  'Rows Removed by Filter'?: number
  'Index Cond'?: string
  'Hash Cond'?: string
  'Merge Cond'?: string
  'Join Filter'?: string
  'Sort Key'?: string[]
  'Group Key'?: string[]
  Plans?: PlanNode[]
}

export interface ExplainResult {
  plan: PlanNode
  executionMs?: number
  planningMs?: number
  text: string
}

/** The statement without trailing semicolons, or null if the text holds more than one statement. */
export function singleStatement(sql: string): string | null {
  const trimmed = sql.trim().replace(/;\s*$/g, '').trim()
  if (!trimmed) return null
  return stripSql(trimmed).includes(';') ? null : trimmed
}

export async function explain(session: SqlSession, sql: string): Promise<ExplainResult> {
  const stmt = singleStatement(sql)
  if (!stmt) throw new Error('Explain works on one statement at a time. Select the statement you want, then press Explain.')
  await session.exec('BEGIN')
  try {
    const json = await session.run(`EXPLAIN (ANALYZE, BUFFERS, FORMAT JSON) ${stmt}`)
    const text = await session.run(`EXPLAIN (ANALYZE, BUFFERS) ${stmt}`)
    const parsed = JSON.parse(json.results[0]?.rows[0]?.[0] ?? '[]') as { Plan: PlanNode; 'Execution Time'?: number; 'Planning Time'?: number }[]
    const top = parsed[0]
    if (!top) throw new Error('EXPLAIN returned no plan.')
    return {
      plan: top.Plan,
      executionMs: top['Execution Time'],
      planningMs: top['Planning Time'],
      text: (text.results[0]?.rows ?? []).map((r) => r[0] ?? '').join('\n'),
    }
  } finally {
    await session.exec('ROLLBACK')
  }
}

export function flatten(plan: PlanNode, depth = 0, out: { node: PlanNode; depth: number }[] = []) {
  out.push({ node: plan, depth })
  for (const child of plan.Plans ?? []) flatten(child, depth + 1, out)
  return out
}

/** Buffers touched by the whole plan (the top node's counts include its children). */
export function totalBuffers(plan: PlanNode): number {
  return (plan['Shared Hit Blocks'] ?? 0) + (plan['Shared Read Blocks'] ?? 0)
}

export function nodeTitle(n: PlanNode): string {
  const on = n['Relation Name'] ? ` on ${n['Relation Name']}` : ''
  const using = n['Index Name'] ? ` using ${n['Index Name']}` : ''
  const join = n['Join Type'] && n['Node Type'].includes('Join') ? ` (${n['Join Type']})` : ''
  return `${n['Node Type']}${join}${using}${on}`
}

export function nodeDetail(n: PlanNode): string {
  const parts: string[] = []
  for (const k of ['Index Cond', 'Hash Cond', 'Merge Cond', 'Join Filter', 'Filter'] as const) if (n[k]) parts.push(`${k}: ${n[k]}`)
  if (n['Rows Removed by Filter']) parts.push(`${n['Rows Removed by Filter'].toLocaleString('en-GB')} rows removed`)
  if (n['Sort Key']) parts.push(`Sort: ${n['Sort Key'].join(', ')}`)
  if (n['Group Key']) parts.push(`Group: ${n['Group Key'].join(', ')}`)
  const hit = n['Shared Hit Blocks'] ?? 0, read = n['Shared Read Blocks'] ?? 0
  if (hit || read) parts.push(`buffers: ${hit.toLocaleString('en-GB')} hit${read ? `, ${read.toLocaleString('en-GB')} read` : ''}`)
  return parts.join(' · ')
}
