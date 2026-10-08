// psql's \d family through psql-describe, loaded only when a backslash command is first used.
import type { SqlSession } from '../db/engine'

export function isBackslash(sql: string): boolean {
  return sql.trim().startsWith('\\')
}

export async function describeCommand(session: SqlSession, cmd: string): Promise<string> {
  const { describe, describeDataToString } = await import('psql-describe')
  const out: string[] = []
  const runQuery = async (q: string) => {
    const r = await session.run(q)
    const last = r.results[r.results.length - 1]
    return { rows: last?.rows ?? [], fields: last?.fields ?? [], rowCount: last?.rows.length ?? 0 }
  }
  const { promise } = describe(cmd.trim(), 'postgres', runQuery, (item) => out.push(describeDataToString(item)))
  await promise
  return out.join('\n') || '(no output)'
}

export const DESCRIBE_HELP = `\\dt          list tables
\\d visits    describe a table: columns, indexes, constraints
\\di          list indexes
\\dn          list schemas
\\df name     list functions matching a name
\\du          list roles`
