import { MODULE_CONTENT } from '@content/modules'
import { MODULES } from '@content/syllabus'
import { THREE_WAYS_IDS } from '@content/modules/m01/challenges'
import type { ActivityRecord, AnswerRecord, AttemptRecord, ProgressRecord } from '../storage/store'
import { todayKey } from '../storage/store'

export interface StateSnapshot {
  progress: Record<string, ProgressRecord>
  answers: Record<string, AnswerRecord>
  attempts: Record<string, AttemptRecord>
  activity: Record<string, ActivityRecord>
}

export interface ModuleProgress {
  id: string
  lessonsDone: number
  lessons: number
  challengesPassed: number
  challenges: number
  checksCorrect: number
  checksAnswered: number
  checks: number
  percent: number
  started: boolean
}

/** Extra challenge sets that count towards a module besides its assignment. */
const EXTRA_SETS: Record<string, string[]> = { 'm01-sql-fluency': THREE_WAYS_IDS }

export function moduleProgress(id: string, s: StateSnapshot): ModuleProgress {
  const c = MODULE_CONTENT[id]
  if (!c) return { id, lessonsDone: 0, lessons: 0, challengesPassed: 0, challenges: 0, checksCorrect: 0, checksAnswered: 0, checks: 0, percent: 0, started: false }
  const challengeIds = [...c.assignment.challengeIds, ...(EXTRA_SETS[id] ?? [])]
  const lessonsDone = c.lessons.filter((l) => s.progress[l.id]?.status === 'done').length
  const challengesPassed = challengeIds.filter((cid) => s.attempts[cid]?.passed).length
  const answered = c.checks.filter((q) => s.answers[q.id])
  const total = c.lessons.length + challengeIds.length
  const done = lessonsDone + challengesPassed
  return {
    id,
    lessonsDone,
    lessons: c.lessons.length,
    challengesPassed,
    challenges: challengeIds.length,
    checksCorrect: answered.filter((q) => s.answers[q.id]?.correct).length,
    checksAnswered: answered.length,
    checks: c.checks.length,
    percent: total ? Math.round((done / total) * 100) : 0,
    started: done > 0 || answered.length > 0 || c.lessons.some((l) => s.progress[l.id]),
  }
}

/** The next lesson to study: the first one not marked done, in course order. */
export function nextLesson(s: StateSnapshot) {
  for (const m of MODULES) {
    const c = MODULE_CONTENT[m.id]
    const l = c?.lessons.find((x) => s.progress[x.id]?.status !== 'done')
    if (c && l) return { module: m, lesson: l, content: c }
  }
  return undefined
}

export function hoursStudied(activity: Record<string, ActivityRecord>): number {
  const secs = Object.values(activity).reduce((sum, a) => sum + (a.seconds ?? 0), 0)
  return Math.round((secs / 3600) * 10) / 10
}

export interface DayCell {
  key: string
  date: Date
  seconds: number
  isToday: boolean
}

/** Monday to Sunday of the current week. */
export function thisWeek(activity: Record<string, ActivityRecord>, now = new Date()): DayCell[] {
  const monday = new Date(now.getFullYear(), now.getMonth(), now.getDate() - ((now.getDay() + 6) % 7))
  return Array.from({ length: 7 }, (_, i) => {
    const date = new Date(monday.getFullYear(), monday.getMonth(), monday.getDate() + i)
    const key = todayKey(date)
    return { key, date, seconds: activity[key]?.seconds ?? 0, isToday: key === todayKey(now) }
  })
}

/** Consecutive days with at least a minute of study, ending today (or yesterday if today has none yet). */
export function streak(activity: Record<string, ActivityRecord>, now = new Date()): number {
  const studied = (d: Date) => (activity[todayKey(d)]?.seconds ?? 0) >= 60
  const d = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  if (!studied(d)) d.setDate(d.getDate() - 1)
  let n = 0
  while (studied(d)) {
    n++
    d.setDate(d.getDate() - 1)
  }
  return n
}

export function formatMinutes(seconds: number): string {
  const m = Math.round(seconds / 60)
  if (m < 60) return `${m} min`
  return `${Math.floor(m / 60)} h ${m % 60} min`
}

/**
 * Whether to remind the learner to export. The brief asks for a reminder after each module: a
 * finished module with progress newer than the last export asks at once; otherwise, unsaved
 * progress asks once a week (or at once if the learner has never exported).
 */
export function exportReminder(s: StateSnapshot, lastExport: string | undefined, now: number) {
  const latest = [...Object.values(s.progress).map((p) => p.updatedAt), ...Object.values(s.attempts).map((a) => a.at)].sort().pop()
  const daysSinceExport = lastExport ? Math.floor((now - Date.parse(lastExport)) / 86_400_000) : undefined
  const unsaved = !!latest && (!lastExport || latest > lastExport)
  const finished = MODULES.filter((m) => MODULE_CONTENT[m.id] && moduleProgress(m.id, s).percent === 100).pop()
  const module = unsaved ? finished : undefined
  return { due: unsaved && (!!module || !lastExport || (daysSinceExport ?? 99) >= 7), module, daysSinceExport }
}
