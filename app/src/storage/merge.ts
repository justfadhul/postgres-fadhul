// Combining progress from two devices. Each store has its own rule, chosen so that
// merging in either direction, any number of times, gives the same result and never
// loses work: a lesson once done stays done, a challenge once passed stays passed,
// the newer answer, draft, setting or highlight wins, and study time is never double counted.
import type { ActivityRecord, AnnotationRecord, AnswerRecord, AttemptRecord, DraftRecord, ProgressRecord, StoreName } from './store'

type Records = Record<string, unknown>
const later = (a = '', b = '') => (b > a ? b : a)

function mergeOne(store: StoreName, mine: unknown, theirs: unknown): unknown {
  if (mine === undefined) return theirs
  if (theirs === undefined) return mine
  switch (store) {
    case 'progress': {
      const a = mine as ProgressRecord, b = theirs as ProgressRecord
      return { status: a.status === 'done' || b.status === 'done' ? 'done' : 'started', updatedAt: later(a.updatedAt, b.updatedAt) } satisfies ProgressRecord
    }
    case 'attempts': {
      const a = mine as AttemptRecord, b = theirs as AttemptRecord
      // Keep the passing answer if there is one, otherwise the newer attempt.
      const pick = a.passed !== b.passed ? (a.passed ? a : b) : b.at > a.at ? b : a
      return { passed: a.passed || b.passed, sql: pick.sql, at: later(a.at, b.at), tries: Math.max(a.tries, b.tries) } satisfies AttemptRecord
    }
    case 'activity': {
      // The same day on two devices: each device's figure is a lower bound, so take the larger.
      const a = mine as ActivityRecord, b = theirs as ActivityRecord
      return { seconds: Math.max(a.seconds, b.seconds) } satisfies ActivityRecord
    }
    case 'answers':
      return (theirs as AnswerRecord).at > (mine as AnswerRecord).at ? theirs : mine
    case 'drafts':
      return (theirs as DraftRecord).at > (mine as DraftRecord).at ? theirs : mine
    case 'annotations':
      return (theirs as AnnotationRecord).updatedAt > (mine as AnnotationRecord).updatedAt ? theirs : mine
    case 'settings':
      // Settings are per device (theme, text size, engine consent); only fill in what is missing.
      return mine
  }
}

/** The records of one store after merging another device's copy into this one. */
export function mergeStore(store: StoreName, mine: Records, theirs: Records): Records {
  const out: Records = { ...mine }
  for (const [k, v] of Object.entries(theirs)) out[k] = mergeOne(store, mine[k], v)
  return out
}
