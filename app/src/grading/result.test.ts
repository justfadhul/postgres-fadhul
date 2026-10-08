import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { seededDb, type TestDb } from '../../../tests/helpers/session'
import { compareResults, gradeResult, normaliseValue, stripSql } from './result'

let db: TestDb
beforeAll(async () => {
  db = await seededDb()
})
afterAll(() => db.pg.close())

const visitsPerType = {
  kind: 'result' as const,
  reference: `SELECT visit_type, count(*) AS visits FROM clinic.visits GROUP BY visit_type`,
  ordered: false,
}

describe('stripSql', () => {
  it('removes comments and string contents', () => {
    expect(stripSql(`select 'distinct on' -- distinct on\n/* over */ from t`)).not.toMatch(/distinct on|over/i)
  })
  it('removes quoted identifiers, dollar quotes and nested comments', () => {
    expect(stripSql(`select 1 as "distinct on"`)).not.toMatch(/distinct/i)
    expect(stripSql(`select $$lateral$$, $q$ over $q$`)).not.toMatch(/lateral|over/i)
    expect(stripSql(`select 1 /* a /* lateral */ over */ from t`)).toBe('select 1   from t')
    expect(stripSql(`select E'it\\'s over' from t`)).not.toMatch(/over/i)
  })
  it('does not treat -- or /* inside a string as a comment', () => {
    expect(stripSql(`select * from v where t <> '--' and row_number() over ()`)).toMatch(/over/)
    expect(stripSql(`select '/*' , lateral, '*/'`)).toMatch(/lateral/)
  })
  it('keeps the SQL around a dollar sign that is not a quote', () => {
    expect(stripSql(`select $1, a$b over`)).toMatch(/over/)
  })
})

describe('normaliseValue', () => {
  it('compares numbers by value and text exactly', () => {
    expect(normaliseValue('1.50', 1700)).toBe(normaliseValue('1.5', 1700))
    expect(normaliseValue('3', 20)).toBe(normaliseValue('3.0', 1700))
    expect(normaliseValue('1.50', 25)).not.toBe(normaliseValue('1.5', 25))
    expect(normaliseValue(null, 25)).not.toBe(normaliseValue('NULL', 25))
  })
})

describe('compareResults', () => {
  const f = [{ name: 'a', dataTypeID: 23 }]
  const r = (rows: (string | null)[][]) => ({ fields: f, rows, totalRows: rows.length })
  it('ignores order unless asked', () => {
    expect(compareResults(r([['1'], ['2']]), r([['2'], ['1']]), false)).toEqual([])
    expect(compareResults(r([['1'], ['2']]), r([['2'], ['1']]), true)[0]).toMatch(/Row 1 differs/)
  })
  it('names a column whose type is wrong', () => {
    const text = { fields: [{ name: 'a', dataTypeID: 25 }], rows: [['15.4']], totalRows: 1 }
    expect(compareResults({ ...r([['15.4']]), fields: [{ name: 'a', dataTypeID: 1700 }] }, text, false)[0]).toMatch(/Column 1 \(a\) should be a number/)
  })
  it('counts duplicates', () => {
    expect(compareResults(r([['1'], ['1']]), r([['1']]), false).join(' ')).toMatch(/Expected 2 rows.*Missing 1/)
  })
})

describe('gradeResult', () => {
  it('passes a correct answer written differently', async () => {
    const rep = await gradeResult(db.session, `select v.visit_type, count(v.id) from clinic.visits v group by 1 order by 2 desc`, visitsPerType)
    expect(rep.messages).toEqual(['Correct: same rows as the reference answer.'])
    expect(rep.pass).toBe(true)
  })
  it('fails a plausible wrong answer and says why', async () => {
    const rep = await gradeResult(db.session, `select visit_type, count(distinct patient_id) from clinic.visits group by visit_type`, visitsPerType)
    expect(rep.pass).toBe(false)
    expect(rep.messages.join(' ')).toMatch(/Missing/)
  })
  it('runs the setup rows for both queries, then rolls them back', async () => {
    const withSetup = {
      ...visitsPerType,
      setup: `INSERT INTO clinic.visits SELECT -1, patient_id, facility_id, clinician_id, visit_at, 'emergency', NULL FROM clinic.visits LIMIT 1`,
    }
    const plain = await gradeResult(db.session, visitsPerType.reference, visitsPerType)
    const rep = await gradeResult(db.session, `select visit_type, count(*) from clinic.visits group by 1`, withSetup)
    expect(rep.pass).toBe(true)
    const em = (r?: { rows: (string | null)[][] }) => r?.rows.find((x) => x[0] === 'emergency')?.[1]
    expect(Number(em(rep.expected))).toBe(Number(em(plain.expected)) + 1)
    const after = await db.session.run(`select count(*) from clinic.visits where id = -1`)
    expect(after.results[0]?.rows[0]?.[0]).toBe('0')
  })
  it('reports PostgreSQL errors with the SQLSTATE', async () => {
    const rep = await gradeResult(db.session, `select visit_typo from clinic.visits`, visitsPerType)
    expect(rep.pass).toBe(false)
    expect(rep.error?.code).toBe('42703')
  })
  it('never changes the data', async () => {
    await gradeResult(db.session, `delete from clinic.visits; select 1`, visitsPerType)
    const out = await db.session.run(`select count(*) from clinic.visits`)
    expect(out.results[0]?.rows[0]?.[0]).toBe('20000')
  })
  it('refuses transaction control', async () => {
    const rep = await gradeResult(db.session, `commit; select 1`, visitsPerType)
    expect(rep.messages[0]).toMatch(/Leave out BEGIN/)
  })
  it('enforces required shapes', async () => {
    const rep = await gradeResult(db.session, `select visit_type, count(*) from clinic.visits group by visit_type`, {
      ...visitsPerType,
      requires: [{ pattern: '\\bover\\s*\\(', message: 'Use a window function.' }],
    })
    expect(rep.pass).toBe(false)
    expect(rep.messages).toContain('Use a window function.')
  })
  it('shows timestamps in Kampala time', async () => {
    const out = await db.session.run(`select timestamptz '2025-03-03 06:00+00'`)
    expect(out.results[0]?.rows[0]?.[0]).toBe('2025-03-03 09:00:00+03')
  })
})
