import { describe, expect, it } from 'vitest'
import { mergeStore } from './merge'

describe('merging progress from another device', () => {
  it('keeps a lesson done once it is done anywhere', () => {
    const phone = { l1: { status: 'done', updatedAt: '2026-10-01' } }
    const laptop = { l1: { status: 'started', updatedAt: '2026-10-05' }, l2: { status: 'started', updatedAt: '2026-10-05' } }
    expect(mergeStore('progress', laptop, phone)).toEqual({ l1: { status: 'done', updatedAt: '2026-10-05' }, l2: { status: 'started', updatedAt: '2026-10-05' } })
  })

  it('keeps a passed challenge passed, with the passing SQL', () => {
    const a = { c: { passed: true, sql: 'good', at: '2026-10-01', tries: 3 } }
    const b = { c: { passed: false, sql: 'later try', at: '2026-10-04', tries: 5 } }
    expect(mergeStore('attempts', b, a)).toEqual({ c: { passed: true, sql: 'good', at: '2026-10-04', tries: 5 } })
    expect(mergeStore('attempts', a, b)).toEqual(mergeStore('attempts', b, a))
  })

  it('takes the newer answer, draft and highlight', () => {
    expect(mergeStore('answers', { q: { choice: 1, correct: false, at: '1' } }, { q: { choice: 2, correct: true, at: '2' } })).toEqual({ q: { choice: 2, correct: true, at: '2' } })
    const old = { lessonId: 'l', quote: 'x', prefix: '', suffix: '', colour: 'yellow', note: '', at: '1', updatedAt: '1' }
    const deleted = { ...old, deleted: true, updatedAt: '3' }
    expect(mergeStore('annotations', { h: old }, { h: deleted })).toEqual({ h: deleted })
    expect(mergeStore('annotations', { h: deleted }, { h: old })).toEqual({ h: deleted })
  })

  it('never double counts study time', () => {
    const merged = mergeStore('activity', { d: { seconds: 600 } }, { d: { seconds: 900 } })
    expect(mergeStore('activity', merged, { d: { seconds: 900 } })).toEqual({ d: { seconds: 900 } })
  })

  it('keeps this device settings and adds missing ones', () => {
    expect(mergeStore('settings', { theme: 'dark' }, { theme: 'light', readingSize: 1.15 })).toEqual({ theme: 'dark', readingSize: 1.15 })
  })

  it('gives the same result however often it is repeated', () => {
    const a = { l1: { status: 'started', updatedAt: '1' } }
    const b = { l1: { status: 'done', updatedAt: '2' } }
    const once = mergeStore('progress', a, b)
    expect(mergeStore('progress', once, b)).toEqual(once)
  })
})
