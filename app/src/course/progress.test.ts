import { describe, expect, it } from 'vitest'
import { MODULE_CONTENT } from '@content/modules'
import { THREE_WAYS_IDS } from '@content/modules/m01/challenges'
import { exportReminder, formatMinutes, streak, thisWeek, type StateSnapshot } from './progress'

const at = (y: number, m: number, d: number) => new Date(y, m - 1, d, 12)

describe('progress helpers', () => {
  it('counts a streak ending today or yesterday', () => {
    const a = { '2026-10-06': { seconds: 600 }, '2026-10-07': { seconds: 120 }, '2026-10-08': { seconds: 30 } }
    expect(streak(a, at(2026, 10, 8))).toBe(2) // today has under a minute, so the streak ends yesterday
    expect(streak({ ...a, '2026-10-08': { seconds: 90 } }, at(2026, 10, 8))).toBe(3)
    expect(streak({}, at(2026, 10, 8))).toBe(0)
  })
  it('builds Monday to Sunday', () => {
    const w = thisWeek({}, at(2026, 10, 8)) // a Thursday
    expect(w.map((d) => d.date.getDay())).toEqual([1, 2, 3, 4, 5, 6, 0])
    expect(w.find((d) => d.isToday)?.key).toBe('2026-10-08')
  })
  it('formats minutes', () => {
    expect(formatMinutes(1800)).toBe('30 min')
    expect(formatMinutes(4500)).toBe('1 h 15 min')
  })
})

describe('export reminder', () => {
  const m1 = MODULE_CONTENT['m01-sql-fluency']!
  const T = '2026-10-08T10:00:00.000Z'
  const now = Date.parse('2026-10-09T10:00:00.000Z')
  const snap = (finished: boolean): StateSnapshot => {
    const lessons = finished ? m1.lessons : m1.lessons.slice(0, 1)
    const challenges = finished ? [...m1.assignment.challengeIds, ...THREE_WAYS_IDS] : []
    return {
      progress: Object.fromEntries(lessons.map((l) => [l.id, { status: 'done' as const, updatedAt: T }])),
      attempts: Object.fromEntries(challenges.map((id) => [id, { passed: true, sql: 'select 1', at: T, tries: 1 }])),
      answers: {},
      activity: {},
    }
  }
  it('asks at once when a module is finished and not exported since', () => {
    const r = exportReminder(snap(true), '2026-10-07T10:00:00.000Z', now)
    expect(r.due).toBe(true)
    expect(r.module?.number).toBe(1)
  })
  it('stays quiet after the export that follows the module', () => {
    expect(exportReminder(snap(true), '2026-10-08T11:00:00.000Z', now).due).toBe(false)
  })
  it('otherwise waits a week, unless there has never been an export', () => {
    expect(exportReminder(snap(false), '2026-10-07T10:00:00.000Z', now).due).toBe(false)
    expect(exportReminder(snap(false), '2026-10-01T10:00:00.000Z', now).due).toBe(true)
    expect(exportReminder(snap(false), undefined, now).due).toBe(true)
  })
})
