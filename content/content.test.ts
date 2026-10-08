// Content validation. From Milestone 1 this also runs every SQL block and
// reference solution against PGlite.
import { PGlite } from '@electric-sql/pglite'
import { describe, expect, it } from 'vitest'
import { MODULES, PHASES } from './syllabus'
import { RESOURCES } from './resources'
import { clinicSeedSql, SIZES } from './datasets/clinic'

describe('syllabus', () => {
  it('has Module 0 (Foundations) and the 11 course modules, numbered 0 to 11 with unique ids', () => {
    expect(MODULES.map((m) => m.number)).toEqual([0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11])
    expect(new Set(MODULES.map((m) => m.id)).size).toBe(MODULES.length)
  })

  it('assigns every module to a known phase and totals about 220 hours', () => {
    for (const m of MODULES) expect(Object.keys(PHASES)).toContain(String(m.phase))
    const hours = MODULES.reduce((s, m) => s + m.hours, 0)
    expect(hours).toBeGreaterThanOrEqual(210)
    expect(hours).toBeLessThanOrEqual(230)
  })

  it('gives every module a lab and a completion checklist', () => {
    for (const m of MODULES) {
      expect(m.lab.length, m.id).toBeGreaterThan(10)
      expect(m.doneWhen.length, m.id).toBeGreaterThan(0)
    }
  })
})

describe('resources', () => {
  it('uses unique https URLs', () => {
    for (const r of RESOURCES) expect(r.url, r.title).toMatch(/^https:\/\//)
    expect(new Set(RESOURCES.map((r) => r.url)).size).toBe(RESOURCES.length)
  })
})

describe('clinic dataset', () => {
  it('rejects nonsense sizes', () => {
    expect(() => clinicSeedSql({ facilities: 0, patients: 1, visits: 1 })).toThrow()
    expect(() => clinicSeedSql({ facilities: 1.5, patients: 1, visits: 1 })).toThrow()
  })

  it('seeds deterministically and keeps every foreign key valid', async () => {
    const counts = async () => {
      const db = await PGlite.create()
      await db.exec(clinicSeedSql(SIZES.tiny))
      const { rows } = await db.query<{ v: string }>(
        `SELECT md5(string_agg(p.full_name || p.date_of_birth || coalesce(p.phone, ''), ',' ORDER BY p.id)) AS v FROM clinic.patients p`,
      )
      const visits = await db.query<{ n: number }>('SELECT count(*)::int AS n FROM clinic.visits')
      await db.close()
      return { hash: rows[0]?.v, visits: visits.rows[0]?.n }
    }
    const a = await counts()
    const b = await counts()
    expect(a.visits).toBe(SIZES.tiny.visits)
    expect(a.hash).toBe(b.hash)
  })
})
