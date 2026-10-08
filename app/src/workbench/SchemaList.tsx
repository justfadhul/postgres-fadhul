// The clinic schema as a ruled list (wide layout). Tap a table to see its columns.
import { useEffect, useState } from 'react'
import type { SqlSession } from '../db/engine'

interface TableInfo { name: string; rows: string }

export function SchemaList({ session, refreshKey, onInsert }: { session: SqlSession; refreshKey: number; onInsert: (text: string) => void }) {
  const [tables, setTables] = useState<TableInfo[]>([])
  const [open, setOpen] = useState('visits')
  const [cols, setCols] = useState<[string, string][]>([])

  useEffect(() => {
    void session
      .run(`SELECT c.relname, greatest(c.reltuples, 0)::bigint FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
            WHERE n.nspname = 'clinic' AND c.relkind IN ('r', 'p') ORDER BY 1`)
      .then((r) => setTables((r.results[0]?.rows ?? []).map(([name, rows]) => ({ name: name ?? '', rows: Number(rows ?? 0).toLocaleString('en-GB') }))), () => setTables([]))
  }, [session, refreshKey])

  useEffect(() => {
    if (!open) return
    void session
      .run(`SELECT column_name, data_type FROM information_schema.columns WHERE table_schema = 'clinic' AND table_name = ${`'${open.replace(/'/g, "''")}'`} ORDER BY ordinal_position`)
      .then((r) => setCols((r.results[0]?.rows ?? []).map(([n, t]) => [n ?? '', t ?? ''])), () => setCols([]))
  }, [session, open, refreshKey])

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', paddingBottom: 8, borderBottom: '2px solid var(--ink)' }}>
        <h2 className="eyebrow">clinic · tables</h2>
        <button type="button" className="mono" onClick={() => onInsert('\\dt')} style={{ background: 'none', border: 0, fontSize: 12, color: 'var(--muted)', cursor: 'pointer', minHeight: 32 }}>\dt</button>
      </div>
      {tables.map((t) => (
        <div key={t.name} style={{ borderBottom: '1px solid var(--hair)' }}>
          <button type="button" aria-expanded={open === t.name} onClick={() => setOpen(open === t.name ? '' : t.name)} style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 8, minHeight: 46, padding: 0, background: 'none', border: 0, textAlign: 'left', cursor: 'pointer' }}>
            <span className="mono" style={{ fontSize: 15, fontWeight: open === t.name ? 700 : 400, color: open === t.name ? 'var(--accent)' : undefined }}>{t.name}</span>
            <span className="mono num" style={{ marginLeft: 'auto', fontSize: 12, color: 'var(--muted)' }}>{t.rows}</span>
          </button>
          {open === t.name && (
            <div style={{ padding: '0 0 12px 14px', marginBottom: 10, borderLeft: '2px solid var(--accent)', display: 'flex', flexDirection: 'column', gap: 4 }}>
              {cols.map(([n, ty]) => (
                <button key={n} type="button" className="mono" title={`Insert ${n}`} onClick={() => onInsert(n)} style={{ display: 'flex', justifyContent: 'space-between', gap: 8, fontSize: 13, background: 'none', border: 0, padding: '2px 0', textAlign: 'left', cursor: 'pointer' }}>
                  <span>{n}</span><span style={{ color: 'var(--type)' }}>{ty}</span>
                </button>
              ))}
            </div>
          )}
        </div>
      ))}
      <p className="muted" style={{ fontSize: 12, marginTop: 10 }}>Row counts are estimates. Tap a column to insert its name.</p>
    </div>
  )
}
