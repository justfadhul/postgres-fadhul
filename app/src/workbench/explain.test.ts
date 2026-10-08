import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { SIZES } from '@content/datasets/clinic'
import { seededDb, type TestDb } from '../../../tests/helpers/session'
import { explain, flatten, nodeTitle, singleStatement, totalBuffers } from './explain'

let db: TestDb
beforeAll(async () => { db = await seededDb(SIZES.tiny) })
afterAll(() => db.pg.close())

describe('explain', () => {
  it('accepts one statement and refuses several', () => {
    expect(singleStatement('select 1;  ')).toBe('select 1')
    expect(singleStatement("select ';'")).toBe("select ';'")
    expect(singleStatement('select 1; select 2')).toBeNull()
  })
  it('returns a plan with buffers and text', async () => {
    const r = await explain(db.session, 'SELECT * FROM visits WHERE patient_id = 7')
    expect(flatten(r.plan).map((x) => x.node['Node Type'])).toContain('Seq Scan')
    expect(nodeTitle(r.plan)).toMatch(/Seq Scan on visits/)
    expect(totalBuffers(r.plan)).toBeGreaterThan(0)
    expect(r.text).toMatch(/Buffers:/)
  })
  it('rolls back what ANALYZE executed', async () => {
    await explain(db.session, 'DELETE FROM prescriptions')
    const out = await db.session.run('SELECT count(*) > 0 FROM prescriptions')
    expect(out.results[0]?.rows[0]?.[0]).toBe('t')
  })
})
