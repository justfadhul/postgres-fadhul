import { useSyncExternalStore } from 'react'

const QUERY = '(min-width: 960px)'

function subscribe(cb: () => void) {
  const mq = window.matchMedia(QUERY)
  mq.addEventListener('change', cb)
  return () => mq.removeEventListener('change', cb)
}

/** True on desktop and landscape tablets: the editorial layout. False on phones: the card layout. */
export function useWide(): boolean {
  return useSyncExternalStore(subscribe, () => window.matchMedia(QUERY).matches, () => false)
}
