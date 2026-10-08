import { describe, expect, it } from 'vitest'
import { formatMinutes, streak, thisWeek } from './progress'

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
