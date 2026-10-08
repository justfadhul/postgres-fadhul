import { useStore } from '../storage/hooks'
import type { ActivityRecord, AnswerRecord, AttemptRecord, ProgressRecord } from '../storage/store'
import type { StateSnapshot } from './progress'

/** Everything progress views need, kept fresh. Undefined until the first read finishes. */
export function useSnapshot(): StateSnapshot | undefined {
  const progress = useStore<ProgressRecord>('progress')
  const answers = useStore<AnswerRecord>('answers')
  const attempts = useStore<AttemptRecord>('attempts')
  const activity = useStore<ActivityRecord>('activity')
  if (!progress || !answers || !attempts || !activity) return undefined
  return { progress, answers, attempts, activity }
}
