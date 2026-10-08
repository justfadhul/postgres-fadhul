import { PGlite } from '@electric-sql/pglite'
import { describe, expect, it } from 'vitest'
import { SqlError, toErrorFields } from './protocol'

describe('toErrorFields', () => {
  it('keeps the SQLSTATE and detail from a real PostgreSQL error', async () => {
    const db = await PGlite.create()
    await db.exec('CREATE TABLE t (id int PRIMARY KEY); INSERT INTO t VALUES (1);')
    const err = await db.exec('INSERT INTO t VALUES (1)').catch((e: unknown) => e)
    const fields = toErrorFields(err)
    expect(fields.code).toBe('23505')
    expect(fields.constraint).toBe('t_pkey')
    expect(fields.detail).toContain('already exists')
    // Structured clone (postMessage) keeps plain objects intact.
    const roundTrip = new SqlError(structuredClone(fields))
    expect(roundTrip.code).toBe('23505')
    expect(roundTrip.message).toContain('duplicate key')
    await db.close()
  })

  it('handles non-database errors', () => {
    expect(toErrorFields(new Error('boom'))).toEqual({ message: 'boom' })
    expect(toErrorFields('text')).toEqual({ message: 'text' })
  })
})
