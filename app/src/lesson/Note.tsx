import type { ReactNode } from 'react'

/** A margin note on wide screens, a callout on phones. */
export function Note({ term, children }: { term?: string; children: ReactNode }) {
  return (
    <aside className="note">
      {term && <span className="note-term">{term}</span>}
      {children}
    </aside>
  )
}
