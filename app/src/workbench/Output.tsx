// Results, errors, plans and \d output, styled for the dark editor (phone) or the paper page (wide).
import type { SqlErrorFields } from '../db/protocol'
import type { RawResult, RunOutput } from '../db/raw'
import { flatten, nodeDetail, nodeTitle, totalBuffers, type ExplainResult } from './explain'

export function ResultTable({ result, dark }: { result: RawResult; dark: boolean }) {
  return (
    <div className="scroll-x" style={dark ? { padding: '0 14px' } : undefined}>
      <table className="table">
        <thead>
          <tr>{result.fields.map((f, i) => <th key={i} scope="col">{f.name}</th>)}</tr>
        </thead>
        <tbody>
          {result.rows.map((row, r) => (
            <tr key={r}>
              {row.map((v, c) => (
                <td key={c} className={v === null ? 'null' : undefined} style={!dark && c === 0 ? { color: 'var(--type)' } : dark && c === 0 ? { color: 'var(--ed-num)' } : undefined}>
                  {v === null ? 'NULL' : v}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

export function RunSummary({ out }: { out: RunOutput }) {
  const sets = out.results.filter((r) => r.fields.length > 0)
  const last = sets[sets.length - 1]
  const statements = out.results.length
  const parts: string[] = []
  if (last) {
    parts.push(`${last.totalRows.toLocaleString('en-GB')} row${last.totalRows === 1 ? '' : 's'}`)
    // On a phone only the first few columns fit; say how many there are.
    if (last.fields.length > 2) parts.push(`${last.fields.length} columns`)
  }
  else {
    const affected = out.results.reduce((s, r) => s + (r.affectedRows ?? 0), 0)
    parts.push(affected ? `${affected.toLocaleString('en-GB')} row${affected === 1 ? '' : 's'} changed` : 'Done')
  }
  if (statements > 1) parts.push(`${statements} statements`)
  parts.push(`${out.ms} ms`)
  return <>{parts.join(' · ')}</>
}

export function RunOutputView({ out, dark }: { out: RunOutput; dark: boolean }) {
  const sets = out.results.filter((r) => r.fields.length > 0)
  const last = sets[sets.length - 1]
  return (
    <div>
      {out.notices.length > 0 && (
        <ul style={{ margin: dark ? '8px 14px' : '8px 0', padding: 0, listStyle: 'none', fontSize: 13, color: dark ? 'var(--ed-muted)' : 'var(--muted)' }}>
          {out.notices.map((n, i) => <li key={i}>{n}</li>)}
        </ul>
      )}
      {last ? (
        <>
          <ResultTable result={last} dark={dark} />
          {last.totalRows > last.rows.length && (
            <p style={{ margin: dark ? '8px 14px' : '8px 0', fontSize: 13, color: dark ? 'var(--ed-muted)' : 'var(--muted)' }}>
              Showing the first {last.rows.length.toLocaleString('en-GB')} of {last.totalRows.toLocaleString('en-GB')} rows. Add a LIMIT, or aggregate.
            </p>
          )}
          {sets.length > 1 && (
            <p style={{ margin: dark ? '8px 14px' : '8px 0', fontSize: 13, color: dark ? 'var(--ed-muted)' : 'var(--muted)' }}>
              Showing the last result of {sets.length}. Select one statement and run it to see another.
            </p>
          )}
        </>
      ) : (
        <p style={{ margin: dark ? '12px 14px' : '12px 0', fontSize: 15 }}>The statement ran and returned no rows to show.</p>
      )}
    </div>
  )
}

/** Turns PostgreSQL's 1-based character position into a line and column. */
export function lineCol(sql: string, position?: string): { line: number; col: number } | null {
  const p = Number(position)
  if (!p) return null
  const before = sql.slice(0, p - 1)
  const lines = before.split('\n')
  return { line: lines.length, col: (lines[lines.length - 1]?.length ?? 0) + 1 }
}

export function ErrorView({ error, sql, dark }: { error: SqlErrorFields; sql: string; dark: boolean }) {
  const where = lineCol(sql, error.position)
  const muted = dark ? 'var(--ed-muted)' : 'var(--muted)'
  return (
    <div role="alert" style={{ margin: dark ? '0 14px' : 0, padding: '12px 14px', borderLeft: '3px solid #f26b3a', background: dark ? '#221a17' : 'var(--surface)', borderRadius: 4 }}>
      <p style={{ margin: 0, fontWeight: 700 }}>
        <span style={{ color: dark ? '#f2a07a' : 'var(--accent)' }}>{error.severity ?? 'ERROR'}:</span> {error.message}
      </p>
      <p className="mono" style={{ margin: '6px 0 0', fontSize: 13, color: muted }}>
        {error.code && <>SQLSTATE {error.code}</>}
        {where && <> · line {where.line}, column {where.col}</>}
      </p>
      {error.detail && <p style={{ margin: '8px 0 0', fontSize: 14 }}><b>Detail:</b> {error.detail}</p>}
      {error.hint && <p style={{ margin: '8px 0 0', fontSize: 14 }}><b>Hint:</b> {error.hint}</p>}
      {error.code && (
        <p style={{ margin: '4px 0 0', fontSize: 14 }}>
          <a href="https://www.postgresql.org/docs/current/errcodes-appendix.html" target="_blank" rel="noreferrer" className="link" style={{ color: muted, fontSize: 14 }}>What SQLSTATE codes mean</a>
        </p>
      )}
    </div>
  )
}

export function PlanView({ result, dark }: { result: ExplainResult; dark: boolean }) {
  const rows = flatten(result.plan)
  const muted = dark ? 'var(--ed-muted)' : 'var(--muted)'
  const hot = dark ? '#f2a07a' : 'var(--accent)'
  return (
    <div style={{ padding: dark ? '0 14px' : 0 }}>
      <p style={{ margin: '0 0 8px', fontSize: 13, color: muted }}>
        {totalBuffers(result.plan).toLocaleString('en-GB')} buffers · planning {result.planningMs?.toFixed(1)} ms · execution {result.executionMs?.toFixed(1)} ms.
        Times vary between runs and devices; compare buffers and plan shape.
      </p>
      <ol style={{ listStyle: 'none', margin: 0, padding: 0 }}>
        {rows.map(({ node, depth }, i) => {
          const scan = node['Node Type'] === 'Seq Scan'
          return (
            <li key={i} style={{ padding: `10px 0 10px ${depth * 18}px`, borderBottom: `1px solid ${dark ? 'var(--ed-line)' : 'var(--hair)'}` }}>
              <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between', gap: '2px 12px' }}>
                <span style={{ fontWeight: 700, color: scan ? hot : undefined }}>{nodeTitle(node)}</span>
                <span className="mono num" style={{ fontSize: 12, color: muted }}>
                  {(node['Actual Rows'] ?? 0).toLocaleString('en-GB')} rows{node['Actual Loops'] && node['Actual Loops'] > 1 ? ` × ${node['Actual Loops']} loops` : ''} (est. {(node['Plan Rows'] ?? 0).toLocaleString('en-GB')})
                </span>
              </div>
              {nodeDetail(node) && <div className="mono" style={{ fontSize: 12, color: muted, marginTop: 2, overflowWrap: 'anywhere' }}>{nodeDetail(node)}</div>}
            </li>
          )
        })}
      </ol>
      <details className="disclosure" style={{ marginTop: 12 }}>
        <summary style={{ minHeight: 44, display: 'flex', alignItems: 'center', cursor: 'pointer', fontSize: 14 }}>Plan as text</summary>
        <pre className="scroll-x code-box">{result.text}</pre>
      </details>
    </div>
  )
}

export function DescribeView({ text, dark }: { text: string; dark: boolean }) {
  return <pre className="scroll-x" style={{ margin: dark ? '0 14px' : 0, fontSize: 13, lineHeight: 1.45, padding: '4px 0' }}>{text}</pre>
}
