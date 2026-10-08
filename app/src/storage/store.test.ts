import 'fake-indexeddb/auto'
import { describe, expect, it } from 'vitest'
import { all, exportAll, get, importAll, put, subscribe, todayKey, update, validateExport } from './store'

describe('store', () => {
  it('stores, reads and notifies', async () => {
    const seen: string[] = []
    const off = subscribe((s) => seen.push(s))
    await put('progress', 'm01-l01', { status: 'done', updatedAt: '2026-10-08T00:00:00Z' })
    expect(await get('progress', 'm01-l01')).toEqual({ status: 'done', updatedAt: '2026-10-08T00:00:00Z' })
    expect(seen).toContain('progress')
    off()
  })

  it('updates counters atomically', async () => {
    await update<{ seconds: number }>('activity', '2026-10-08', (old) => ({ seconds: (old?.seconds ?? 0) + 30 }))
    await update<{ seconds: number }>('activity', '2026-10-08', (old) => ({ seconds: (old?.seconds ?? 0) + 30 }))
    expect(await get('activity', '2026-10-08')).toEqual({ seconds: 60 })
  })

  it('exports and imports everything', async () => {
    await put('answers', 'm01-qc-01-1', { choice: 1, correct: true, at: 'x' })
    const file = await exportAll()
    expect(file.app).toBe('data-systems-mastery')
    expect(file.stores.answers['m01-qc-01-1']).toBeTruthy()

    await put('answers', 'stray', { choice: 0, correct: false, at: 'y' })
    const roundTrip = JSON.parse(JSON.stringify(file))
    const counts = await importAll(roundTrip)
    expect(counts.answers).toBe(1)
    expect(Object.keys(await all('answers'))).toEqual(['m01-qc-01-1'])
  })

  it('rejects files that are not exports', () => {
    expect(() => validateExport({ hello: 1 })).toThrow(/not a Data Systems Mastery/)
    expect(() => validateExport({ app: 'data-systems-mastery', schemaVersion: 9, stores: {} })).toThrow(/format 9/)
    expect(() => validateExport({ app: 'data-systems-mastery', schemaVersion: 1, stores: { secrets: {} } })).toThrow(/Unknown section/)
  })

  it('uses the local date as the activity key', () => {
    expect(todayKey(new Date(2026, 9, 8, 23, 59))).toBe('2026-10-08')
  })
})

describe('merge import', () => {
  it('adds the other device progress without losing this one', async () => {
    const { mergeImport } = await import('./store')
    await put('progress', 'm01-l03', { status: 'done', updatedAt: '2026-10-02T00:00:00Z' })
    const file = await exportAll()
    file.stores.progress = { 'm01-l03': { status: 'started', updatedAt: '2026-10-09T00:00:00Z' }, 'm01-l04': { status: 'done', updatedAt: '2026-10-09T00:00:00Z' } }
    const changed = await mergeImport(JSON.parse(JSON.stringify(file)))
    expect(changed.progress).toBe(2)
    expect(await get('progress', 'm01-l03')).toEqual({ status: 'done', updatedAt: '2026-10-09T00:00:00Z' })
    expect(await get('progress', 'm01-l04')).toEqual({ status: 'done', updatedAt: '2026-10-09T00:00:00Z' })
  })
})
