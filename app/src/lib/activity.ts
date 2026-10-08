import { useEffect } from 'react'
import { todayKey, update, type ActivityRecord } from '../storage/store'

const TICK = 30

/** Adds study time while `active` is true and the page is visible. */
export function useStudyTimer(active: boolean) {
  useEffect(() => {
    if (!active) return
    const id = window.setInterval(() => {
      if (document.visibilityState !== 'visible') return
      void update<ActivityRecord>('activity', todayKey(), (old) => ({ seconds: (old?.seconds ?? 0) + TICK })).catch(() => undefined)
    }, TICK * 1000)
    return () => window.clearInterval(id)
  }, [active])
}
