// Milestone 0 spikes in Node. The browser runs the same suite through a Web
// Worker in e2e/spikes.spec.ts.
import { PGlite } from '@electric-sql/pglite'
import { btree_gist } from '@electric-sql/pglite/contrib/btree_gist'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { SIZES } from '@content/datasets/clinic'
import { spikeExclusion, spikeExplain, spikeRolesRls, spikeSeed, spikeVersion, type SpikeResult } from '../../app/src/spikes/suite'

let db: PGlite

beforeAll(async () => {
  db = await PGlite.create({ extensions: { btree_gist } })
})
afterAll(async () => {
  await db.close()
})

function report(r: SpikeResult) {
  console.log(`[spike] ${r.pass ? 'PASS' : 'FAIL'} ${r.title} (${r.ms} ms)\n  ${r.details.join('\n  ')}`)
  expect(r.pass, r.details.join('\n')).toBe(true)
}

describe('Milestone 0 spikes (Node, in-memory PGlite)', () => {
  it('reports the engine version', async () => report(await spikeVersion(db)))
  it('starts in GMT before the course sets a zone (lesson 1.7 says so)', async () => {
    const { rows } = await db.query<{ TimeZone: string }>('SHOW TimeZone')
    expect(rows[0]?.TimeZone).toBe('Etc/GMT0')
  })
  it('spike 3: btree_gist exclusion constraints', async () => report(await spikeExclusion(db)))
  it('spike 4: roles, SET ROLE and row-level security', async () => report(await spikeRolesRls(db)))
  it('spike 5: EXPLAIN (ANALYZE, BUFFERS)', async () => report(await spikeExplain(db)))
  it('spike 2: seeds the standard clinic dataset', async () => report(await spikeSeed(db, SIZES.standard, 'standard')))
  it.runIf(process.env.SPIKE_LARGE === '1')('spike 2: seeds the large clinic dataset', async () =>
    report(await spikeSeed(db, SIZES.large, 'large')),
  )
})
