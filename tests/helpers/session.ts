// A seeded, in-memory PGlite for Node tests, exposed through the same
// SqlSession interface the browser engine implements.
import { PGlite } from '@electric-sql/pglite'
import { btree_gist } from '@electric-sql/pglite/contrib/btree_gist'
import { clinicSeedSql, SIZES, type ClinicSize } from '@content/datasets/clinic'
import type { SqlSession } from '../../app/src/db/engine'
import { runRaw, SESSION_SETUP } from '../../app/src/db/raw'

export interface TestDb {
  pg: PGlite
  session: SqlSession
}

export async function seededDb(size: ClinicSize = SIZES.small): Promise<TestDb> {
  const pg = await PGlite.create({ extensions: { btree_gist } })
  await pg.exec(clinicSeedSql(size))
  await pg.exec(SESSION_SETUP)
  return {
    pg,
    session: { run: (sql, maxRows) => runRaw(pg, sql, maxRows), exec: (sql) => pg.exec(sql) },
  }
}
