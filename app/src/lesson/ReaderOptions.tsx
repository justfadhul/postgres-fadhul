// The "Aa" sheet in a lesson: jump to a section, change text size and font, and see
// this lesson's highlights. Size and font are per-device settings.
import { useEffect, useRef, useState, type RefObject } from 'react'
import { Link } from 'wouter'
import { useRecord } from '../storage/hooks'
import { put } from '../storage/store'
import type { Annotation } from './Annotations'

export const SIZES = [
  { label: 'Small', value: 0.9 },
  { label: 'Medium', value: 1 },
  { label: 'Large', value: 1.15 },
  { label: 'Larger', value: 1.3 },
] as const
export type ReadingFont = 'auto' | 'sans' | 'serif'

/** The learner's reading preferences, applied to the lesson's article. */
export function useReadingPrefs() {
  const size = useRecord<number>('settings', 'readingSize') ?? 1
  const font = useRecord<ReadingFont>('settings', 'readingFont') ?? 'auto'
  return { size, font }
}

export function ReaderOptions({ article, annotations, onClose }: { article: RefObject<HTMLElement | null>; annotations: Annotation[]; onClose: () => void }) {
  const ref = useRef<HTMLDialogElement>(null)
  const { size, font } = useReadingPrefs()
  const [sections] = useState(() => [...(article.current?.querySelectorAll('h2') ?? [])].map((h) => ({ el: h, title: h.textContent ?? '' })))

  useEffect(() => {
    const d = ref.current
    if (d && !d.open) d.showModal()
  }, [])

  const close = () => { ref.current?.close(); onClose() }
  const comments = annotations.filter((a) => a.note.trim()).length

  return (
    <dialog ref={ref} className="sheet" aria-labelledby="reader-title" onCancel={(e) => { e.preventDefault(); close() }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12 }}>
        <h2 id="reader-title" className="display" style={{ fontSize: 28, margin: 0 }}>Reading</h2>
        <button type="button" className="btn" onClick={close}>Close</button>
      </div>

      {sections.length > 0 && (
        <nav aria-label="Lesson contents" style={{ marginTop: 14 }}>
          <p className="eyebrow" style={{ margin: '0 0 4px' }}>Contents</p>
          <ol style={{ listStyle: 'none', margin: 0, padding: 0 }}>
            {sections.map((s, i) => (
              <li key={i} style={{ borderBottom: '1px solid var(--hair)' }}>
                <button type="button" onClick={() => { close(); requestAnimationFrame(() => requestAnimationFrame(() => { s.el.setAttribute('tabindex', '-1'); s.el.focus({ preventScroll: true }); s.el.scrollIntoView({ block: 'start' }) })) }}
                  style={{ width: '100%', minHeight: 44, textAlign: 'left', background: 'none', border: 0, padding: '6px 0', fontSize: 16, cursor: 'pointer' }}>
                  {s.title}
                </button>
              </li>
            ))}
          </ol>
        </nav>
      )}

      <p className="eyebrow" style={{ margin: '18px 0 6px' }}>Text size</p>
      <div className="segmented" role="group" aria-label="Text size">
        {SIZES.map((s) => (
          <button key={s.label} type="button" aria-pressed={size === s.value} aria-label={s.label} onClick={() => void put('settings', 'readingSize', s.value)} style={{ fontSize: 13 + (s.value - 0.9) * 30 }}>A</button>
        ))}
      </div>

      <p className="eyebrow" style={{ margin: '18px 0 6px' }}>Font</p>
      <div className="segmented" role="group" aria-label="Font">
        {(['auto', 'sans', 'serif'] as const).map((f) => (
          <button key={f} type="button" aria-pressed={font === f} onClick={() => void put('settings', 'readingFont', f)} style={{ fontFamily: f === 'serif' ? 'var(--serif)' : f === 'sans' ? 'var(--sans)' : undefined }}>
            {f === 'auto' ? 'Default' : f === 'sans' ? 'Sans' : 'Serif'}
          </button>
        ))}
      </div>

      <p className="eyebrow" style={{ margin: '18px 0 6px' }}>Your highlights</p>
      <p style={{ margin: 0, fontSize: 15 }}>
        {annotations.length === 0
          ? 'None yet. Select any text in the lesson to highlight it or add a comment.'
          : `${annotations.length} highlight${annotations.length === 1 ? '' : 's'}${comments ? `, ${comments} with a comment` : ''}. Tap a highlight to change it.`}
      </p>
      <Link href="/highlights" className="link" onClick={close}>All highlights and comments</Link>
    </dialog>
  )
}
