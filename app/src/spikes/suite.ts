// Milestone 0 spikes. The same functions run in Node (Vitest, in-memory PGlite)
// and in the browser (PGlite in a Web Worker, persisted to IndexedDB), so a pass
// in one place is the same check as a pass in the other.

import { clinicSeedSql, type ClinicSize } from '@content/datasets/clinic'

export interface SqlRunner {
  exec(sql: string): Promise<unknown>
  query<T = Record<string, unknown>>(sql: string, params?: unknown[]): Promise<{ rows: T[] }>
}

export interface SpikeResult {
  id: string
  title: string
  pass: boolean
  ms: number
  details: string[]
}

class SpikeFailure extends Error {}

function check(cond: unknown, message: string): asserts cond {
  if (!cond) throw new SpikeFailure(message)
}

/** Runs `fn` and returns the SQLSTATE it fails with, or null if it succeeds. */
export async function sqlstateOf(fn: () => Promise<unknown>): Promise<string | null> {
  try {
    await fn()
    return null
  } catch (e) {
    const code = (e as { code?: unknown }).code
    return typeof code === 'string' ? code : `no-code: ${(e as Error).message}`
  }
}

async function timed(id: string, title: string, body: (log: (s: string) => void) => Promise<void>): Promise<SpikeResult> {
  const details: string[] = []
  const t0 = performance.now()
  try {
    await body((s) => details.push(s))
    return { id, title, pass: true, ms: Math.round(performance.now() - t0), details }
  } catch (e) {
    details.push(`FAILED: ${(e as Error).message}`)
    return { id, title, pass: false, ms: Math.round(performance.now() - t0), details }
  }
}

export function spikeVersion(db: SqlRunner) {
  return timed('version', 'Engine version', async (log) => {
    const { rows } = await db.query<{ version: string; server_version_num: string }>(
      `SELECT version(), current_setting('server_version_num') AS server_version_num`,
    )
    const row = rows[0]
    check(row, 'version() returned no row')
    log(row.version)
    check(Number(row.server_version_num) >= 170000, `expected PostgreSQL 17 or later, got ${row.server_version_num}`)
  })
}

/** Spike 3: btree_gist and exclusion constraints (Module 2). */
export function spikeExclusion(db: SqlRunner) {
  return timed('exclusion', 'btree_gist and exclusion constraints', async (log) => {
    await db.exec(`
      DROP SCHEMA IF EXISTS spike_excl CASCADE;
      CREATE SCHEMA spike_excl;
      CREATE EXTENSION IF NOT EXISTS btree_gist;
      CREATE TABLE spike_excl.appointments (
        id            serial PRIMARY KEY,
        clinician_id  integer NOT NULL,
        during        tstzrange NOT NULL,
        EXCLUDE USING gist (clinician_id WITH =, during WITH &&)
      );
      INSERT INTO spike_excl.appointments (clinician_id, during)
      VALUES (1, tstzrange('2025-03-03 09:00+03', '2025-03-03 09:30+03'));
    `)
    log('Created a gist exclusion constraint on (clinician_id =, during &&).')

    const overlap = await sqlstateOf(() =>
      db.exec(`INSERT INTO spike_excl.appointments (clinician_id, during)
               VALUES (1, tstzrange('2025-03-03 09:15+03', '2025-03-03 09:45+03'))`),
    )
    check(overlap === '23P01', `overlapping booking should fail with 23P01, got ${overlap}`)
    log('Overlapping booking for the same clinician rejected with SQLSTATE 23P01 (exclusion_violation).')

    const adjacent = await sqlstateOf(() =>
      db.exec(`INSERT INTO spike_excl.appointments (clinician_id, during)
               VALUES (1, tstzrange('2025-03-03 09:30+03', '2025-03-03 10:00+03'))`),
    )
    check(adjacent === null, `back-to-back booking should succeed, got ${adjacent}`)
    log('Back-to-back booking accepted ([) ranges do not overlap).')

    const other = await sqlstateOf(() =>
      db.exec(`INSERT INTO spike_excl.appointments (clinician_id, during)
               VALUES (2, tstzrange('2025-03-03 09:15+03', '2025-03-03 09:45+03'))`),
    )
    check(other === null, `same time for another clinician should succeed, got ${other}`)
    log('Same time slot for a different clinician accepted.')
    await db.exec('DROP SCHEMA spike_excl CASCADE')
  })
}

/** Spike 4: CREATE ROLE, SET ROLE, grants, column privileges and row-level security (Module 6). */
export function spikeRolesRls(db: SqlRunner) {
  return timed('rls', 'Roles, SET ROLE and row-level security', async (log) => {
    await db.exec(`
      DROP SCHEMA IF EXISTS spike_rls CASCADE;
      DROP ROLE IF EXISTS spike_clinician;
      DROP ROLE IF EXISTS spike_pharmacist;
      CREATE SCHEMA spike_rls;
      CREATE ROLE spike_clinician NOLOGIN;
      CREATE ROLE spike_pharmacist NOLOGIN;
      CREATE TABLE spike_rls.patients (id int PRIMARY KEY, facility_id int NOT NULL, name text, notes text);
      INSERT INTO spike_rls.patients VALUES
        (1, 1, 'Grace Nakato', 'note a'), (2, 1, 'Moses Okello', 'note b'), (3, 2, 'Ruth Atim', 'note c');
      CREATE TABLE spike_rls.audit_log (id serial PRIMARY KEY, actor text NOT NULL DEFAULT current_user, action text NOT NULL);
      GRANT USAGE ON SCHEMA spike_rls TO spike_clinician, spike_pharmacist;
      GRANT SELECT ON spike_rls.patients TO spike_clinician;
      GRANT SELECT (id, facility_id, name) ON spike_rls.patients TO spike_pharmacist;
      GRANT SELECT, INSERT ON spike_rls.audit_log TO spike_clinician;
      GRANT USAGE ON SEQUENCE spike_rls.audit_log_id_seq TO spike_clinician;
      ALTER TABLE spike_rls.patients ENABLE ROW LEVEL SECURITY;
      CREATE POLICY facility_scope ON spike_rls.patients FOR SELECT TO spike_clinician
        USING (facility_id = current_setting('app.facility_id')::int);
      CREATE POLICY pharmacist_all ON spike_rls.patients FOR SELECT TO spike_pharmacist USING (true);
    `)
    try {
      await db.exec(`SET app.facility_id = '1'; SET ROLE spike_clinician;`)
      const who = await db.query<{ current_user: string }>('SELECT current_user')
      check(who.rows[0]?.current_user === 'spike_clinician', `SET ROLE did not switch user: ${JSON.stringify(who.rows)}`)
      log('SET ROLE spike_clinician switched current_user.')

      const seen = await db.query<{ id: number }>('SELECT id FROM spike_rls.patients ORDER BY id')
      check(
        JSON.stringify(seen.rows.map((r) => r.id)) === '[1,2]',
        `clinician at facility 1 should see patients 1 and 2, saw ${JSON.stringify(seen.rows)}`,
      )
      log('RLS policy using current_setting(app.facility_id) limited the clinician to facility 1 rows.')

      await db.exec(`INSERT INTO spike_rls.audit_log (action) VALUES ('viewed patient 1')`)
      const upd = await sqlstateOf(() => db.exec(`UPDATE spike_rls.audit_log SET action = 'tampered'`))
      check(upd === '42501', `UPDATE on audit log should fail with 42501, got ${upd}`)
      const del = await sqlstateOf(() => db.exec(`DELETE FROM spike_rls.audit_log`))
      check(del === '42501', `DELETE on audit log should fail with 42501, got ${del}`)
      log('Clinician can INSERT into the audit log but UPDATE and DELETE fail with 42501.')

      await db.exec('RESET ROLE; SET ROLE spike_pharmacist;')
      const notes = await sqlstateOf(() => db.query('SELECT notes FROM spike_rls.patients'))
      check(notes === '42501', `pharmacist reading notes should fail with 42501, got ${notes}`)
      const names = await db.query('SELECT id, name FROM spike_rls.patients')
      check(names.rows.length === 3, `pharmacist should see 3 names, saw ${names.rows.length}`)
      log('Column privilege hides notes from the pharmacist; permitted columns are readable.')
    } finally {
      await db.exec('RESET ROLE; RESET app.facility_id;')
    }
    const back = await db.query<{ current_user: string }>('SELECT current_user')
    check(back.rows[0]?.current_user !== 'spike_clinician', 'RESET ROLE did not restore the session user')
    await db.exec(`
      DROP SCHEMA spike_rls CASCADE;
      DROP ROLE spike_clinician;
      DROP ROLE spike_pharmacist;
    `)
    log('RESET ROLE restored the session user; roles dropped cleanly.')
  })
}

interface PlanNode {
  'Node Type': string
  'Index Name'?: string
  'Actual Rows'?: number
  'Shared Hit Blocks'?: number
  'Shared Read Blocks'?: number
  Plans?: PlanNode[]
}

function walk(node: PlanNode, out: PlanNode[] = []): PlanNode[] {
  out.push(node)
  for (const child of node.Plans ?? []) walk(child, out)
  return out
}

/** Spike 5: EXPLAIN (ANALYZE, BUFFERS) returns plans a grader can inspect (Module 3). */
export function spikeExplain(db: SqlRunner) {
  return timed('explain', 'EXPLAIN (ANALYZE, BUFFERS)', async (log) => {
    await db.exec(`
      DROP SCHEMA IF EXISTS spike_explain CASCADE;
      CREATE SCHEMA spike_explain;
      CREATE TABLE spike_explain.visits AS
        SELECT g AS id, 1 + g % 5000 AS patient_id, timestamptz '2024-01-01' + g * interval '5 minutes' AS visit_at
        FROM generate_series(1, 50000) g;
      ANALYZE spike_explain.visits;
    `)
    const planOf = async (sql: string) => {
      const { rows } = await db.query<{ 'QUERY PLAN': unknown }>(`EXPLAIN (ANALYZE, BUFFERS, FORMAT JSON) ${sql}`)
      const raw = rows[0]?.['QUERY PLAN']
      const parsed = (typeof raw === 'string' ? JSON.parse(raw) : raw) as { Plan: PlanNode }[]
      const plan = parsed[0]?.Plan
      check(plan, 'EXPLAIN returned no plan')
      return walk(plan)
    }
    const q = 'SELECT * FROM spike_explain.visits WHERE patient_id = 42'
    const before = await planOf(q)
    check(before.some((n) => n['Node Type'] === 'Seq Scan'), `expected a Seq Scan before indexing, got ${before.map((n) => n['Node Type'])}`)
    check(typeof before[0]?.['Actual Rows'] === 'number', 'plan has no Actual Rows (ANALYZE missing)')
    check(typeof before[0]?.['Shared Hit Blocks'] === 'number', 'plan has no Shared Hit Blocks (BUFFERS missing)')
    log(`Before index: ${before.map((n) => n['Node Type']).join(' > ')}, shared hit blocks ${before[0]?.['Shared Hit Blocks']}, read ${before[0]?.['Shared Read Blocks']}.`)

    await db.exec('CREATE INDEX visits_patient_idx ON spike_explain.visits (patient_id); ANALYZE spike_explain.visits;')
    const after = await planOf(q)
    const usesIndex = after.some((n) => n['Index Name'] === 'visits_patient_idx')
    check(usesIndex, `expected visits_patient_idx after indexing, got ${after.map((n) => n['Node Type'])}`)
    log(`After index: ${after.map((n) => `${n['Node Type']}${n['Index Name'] ? ` on ${n['Index Name']}` : ''}`).join(' > ')}, shared hit blocks ${after[0]?.['Shared Hit Blocks']}.`)

    const text = await db.query<{ 'QUERY PLAN': string }>(`EXPLAIN (ANALYZE, BUFFERS) ${q}`)
    const lines = text.rows.map((r) => r['QUERY PLAN'])
    check(lines.some((l) => l.includes('Buffers:')), 'text plan has no Buffers: line')
    check(lines.some((l) => l.includes('actual time')), 'text plan has no actual time')
    log('Text-format plan includes "actual time" and "Buffers:" lines.')
    await db.exec('DROP SCHEMA spike_explain CASCADE')
  })
}

export interface SeedReport extends SpikeResult {
  size: ClinicSize
  counts: Record<string, number>
}

/** Spike 2: seed the synthetic clinic dataset and run representative queries on it. */
export async function spikeSeed(db: SqlRunner, size: ClinicSize, label: string): Promise<SeedReport> {
  const counts: Record<string, number> = {}
  const result = await timed(`seed-${label}`, `Seed ${label}: ${size.facilities} facilities, ${size.patients} patients, ${size.visits} visits`, async (log) => {
    const t0 = performance.now()
    await db.exec(clinicSeedSql(size))
    log(`Seed SQL finished in ${Math.round(performance.now() - t0)} ms.`)
    for (const t of ['facilities', 'clinicians', 'patients', 'visits', 'prescriptions', 'stock']) {
      const { rows } = await db.query<{ n: number }>(`SELECT count(*)::int AS n FROM clinic.${t}`)
      counts[t] = rows[0]?.n ?? -1
    }
    check(counts.visits === size.visits, `expected ${size.visits} visits, got ${counts.visits}`)
    check(counts.patients === size.patients, `expected ${size.patients} patients, got ${counts.patients}`)
    log(`Row counts: ${Object.entries(counts).map(([k, v]) => `${k} ${v}`).join(', ')}.`)

    const t1 = performance.now()
    await db.query(`
      SELECT DISTINCT ON (patient_id) patient_id, visit_at, diagnosis_code
      FROM clinic.visits ORDER BY patient_id, visit_at DESC`)
    await db.query(`
      SELECT f.name, date_trunc('month', v.visit_at AT TIME ZONE 'Africa/Kampala') AS month, count(*),
             rank() OVER (PARTITION BY date_trunc('month', v.visit_at AT TIME ZONE 'Africa/Kampala') ORDER BY count(*) DESC)
      FROM clinic.visits v JOIN clinic.facilities f ON f.id = v.facility_id
      GROUP BY f.name, month`)
    await db.query(`
      SELECT d.name, sum(p.quantity) FROM clinic.prescriptions p JOIN clinic.drugs d ON d.id = p.drug_id
      WHERE p.dispensed GROUP BY d.name ORDER BY 2 DESC`)
    log(`Three representative queries (DISTINCT ON, window over join, aggregate join) took ${Math.round(performance.now() - t1)} ms.`)
  })
  return { ...result, size, counts }
}

export async function runCoreSpikes(db: SqlRunner): Promise<SpikeResult[]> {
  const out: SpikeResult[] = []
  // Sequential on purpose: PGlite is a single connection.
  out.push(await spikeVersion(db))
  out.push(await spikeExclusion(db))
  out.push(await spikeRolesRls(db))
  out.push(await spikeExplain(db))
  return out
}
