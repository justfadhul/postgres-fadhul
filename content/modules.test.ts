// Content tests: a lesson, check or challenge that fails here does not ship.
//  - every ```sql block in every lesson runs against the small dataset (same shape as standard),
//    and fails or returns the row count it says it does
//  - every quick check is placed in exactly one lesson, and verifiable ones are verified
//  - every challenge's reference runs; every mustPass passes; every mustFail fails
import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { compile } from '@mdx-js/mdx'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { SIZES } from './datasets/clinic'
import { MODULE_CONTENT } from './modules'
import { MODULES } from './syllabus'
import { seededDb, type TestDb } from '../tests/helpers/session'
import { gradeResult } from '../app/src/grading/result'
import { lastResultSet, type RunOutput } from '../app/src/db/raw'

let db: TestDb
beforeAll(async () => {
  db = await seededDb(SIZES.small)
}, 120_000)
afterAll(() => db.pg.close())

/** Rows joined by "; ", values by ", ", NULL as NULL: the format QuickCheck.verify.expect uses. */
function formatForCheck(out: RunOutput): string {
  const r = lastResultSet(out)
  return (r?.rows ?? []).map((row) => row.map((v) => v ?? 'NULL').join(', ')).join('; ')
}

async function runIsolated(sql: string): Promise<RunOutput> {
  await db.session.exec('BEGIN')
  try {
    return await db.session.run(sql)
  } finally {
    await db.session.exec('ROLLBACK')
  }
}

const SQL_BLOCK = /```sql\n([\s\S]*?)```/g
const CHECK_TAG = /<QuickCheck\s+id="([^"]+)"\s*\/>/g
// A block may state what it shows, and the test holds it to that:
//   -- Expect error 42803     the block must fail with this SQLSTATE
//   -- Expect no rows / -- Expect 2 rows
const EXPECT_ERROR = /^-- Expect error ([0-9A-Z]{5})\b/m
const EXPECT_ROWS = /^-- Expect (no|\d+) rows?\b/m

for (const [moduleId, mod] of Object.entries(MODULE_CONTENT)) {
  const dir = join('content/modules', moduleId.slice(0, 3), 'lessons')

  describe(`${moduleId}: structure`, () => {
    it('belongs to the syllabus', () => {
      expect(MODULES.map((m) => m.id)).toContain(moduleId)
    })
    it('has unique ids', () => {
      const ids = [...mod.lessons.map((l) => l.id), ...mod.checks.map((c) => c.id), ...mod.challenges.map((c) => c.id)]
      expect(new Set(ids).size).toBe(ids.length)
    })
    it('lists only existing challenges in the assignment', () => {
      const known = new Set(mod.challenges.map((c) => c.id))
      for (const id of mod.assignment.challengeIds) expect(known.has(id), id).toBe(true)
    })
  })

  const placed = new Map<string, string>()
  for (const lesson of mod.lessons) {
    const path = join(dir, lesson.file)
    describe(`${moduleId} ${lesson.number} ${lesson.title}`, () => {
      it('has its lesson file', () => {
        expect(existsSync(path), path).toBe(true)
      })
      if (!existsSync(path)) return
      const source = readFileSync(path, 'utf8')
      for (const m of source.matchAll(CHECK_TAG)) placed.set(m[1] ?? '', lesson.id)
      it('compiles as MDX', async () => {
        await expect(compile(source)).resolves.toBeDefined()
      })
      it('places only quick checks that exist', () => {
        const known = new Set(mod.checks.map((c) => c.id))
        for (const m of source.matchAll(CHECK_TAG)) expect(known.has(m[1] ?? ''), m[1]).toBe(true)
      })
      const blocks = [...source.matchAll(SQL_BLOCK)].map((m) => m[1] ?? '')
      blocks.forEach((sql, i) => {
        const label = sql.split('\n').find((l) => !l.startsWith('--'))?.slice(0, 60)
        const wantError = EXPECT_ERROR.exec(sql)?.[1]
        const wantRows = EXPECT_ROWS.exec(sql)?.[1]
        if (wantError) {
          it(`SQL block ${i + 1} fails with ${wantError}: ${label}`, async () => {
            await expect(runIsolated(sql)).rejects.toMatchObject({ code: wantError })
          })
          return
        }
        it(`runs SQL block ${i + 1}: ${label}`, async () => {
          const out = await runIsolated(sql)
          if (wantRows) expect(lastResultSet(out)?.totalRows ?? 0).toBe(wantRows === 'no' ? 0 : Number(wantRows))
        })
      })
    })
  }

  describe(`${moduleId}: quick checks`, () => {
    for (const check of mod.checks) {
      it(`${check.id} is placed in a lesson and well formed`, () => {
        expect(placed.has(check.id), `${check.id} is not placed in any lesson`).toBe(true)
        expect(check.options.length).toBeGreaterThanOrEqual(2)
        expect(check.answer).toBeGreaterThanOrEqual(0)
        expect(check.answer).toBeLessThan(check.options.length)
        expect(check.explanation.length).toBeGreaterThan(20)
        if (check.kind === 'predict') expect(check.sql, 'predict checks show SQL').toBeTruthy()
      })
      if (check.sql) {
        it(`${check.id}: shown SQL runs`, async () => {
          await expect(runIsolated(check.sql ?? '')).resolves.toBeDefined()
        })
      }
      if (check.verify) {
        it(`${check.id}: answer verified against PostgreSQL`, async () => {
          expect(formatForCheck(await runIsolated(check.verify?.sql ?? ''))).toBe(check.verify?.expect)
        })
      }
    }
  })

  describe(`${moduleId}: challenges`, () => {
    for (const ch of mod.challenges) {
      it(`${ch.id} has enough tests`, () => {
        expect(ch.tests.mustPass.length, 'at least 2 alternative correct answers').toBeGreaterThanOrEqual(2)
        expect(ch.tests.mustFail.length, 'at least 3 plausible wrong answers').toBeGreaterThanOrEqual(3)
      })
      it(`${ch.id}: reference returns rows`, async () => {
        const r = lastResultSet(await runIsolated(ch.grader.reference))
        expect(r?.rows.length ?? 0).toBeGreaterThan(0)
      })
      it(`${ch.id}: reference passes its own grader`, async () => {
        const rep = await gradeResult(db.session, ch.grader.reference, ch.grader)
        expect(rep.pass, rep.messages.join(' ')).toBe(true)
      })
      ch.tests.mustPass.forEach((sql, i) => {
        it(`${ch.id}: correct answer ${i + 1} passes`, async () => {
          const rep = await gradeResult(db.session, sql, ch.grader)
          expect(rep.pass, rep.messages.join(' ')).toBe(true)
        })
      })
      ch.tests.mustFail.forEach((sql, i) => {
        it(`${ch.id}: wrong answer ${i + 1} fails`, async () => {
          const rep = await gradeResult(db.session, sql, ch.grader)
          expect(rep.pass, `should fail: ${sql}`).toBe(false)
        })
      })
    }
  })
}
