// Highlights and comments in a lesson. Select text to highlight it in one of three
// colours or to add a comment; tap a highlight to edit or delete it. Highlights are
// painted with the CSS Custom Highlight API, so the lesson's own DOM is never changed
// (React keeps owning it); each is found again from its quoted text (see anchor.ts).
import { useEffect, useRef, useState, type RefObject } from 'react'
import { all, put, subscribe, type AnnotationRecord, type HighlightColour } from '../storage/store'
import { locateQuote, quoteAt, trimSelection, type TextQuote } from './anchor'

export type Annotation = AnnotationRecord & { id: string }

export const COLOURS: { id: HighlightColour; label: string; swatch: string }[] = [
  { id: 'yellow', label: 'Yellow', swatch: 'rgb(255 204 0 / 0.55)' },
  { id: 'green', label: 'Green', swatch: 'rgb(52 199 89 / 0.4)' },
  { id: 'pink', label: 'Pink', swatch: 'rgb(255 55 95 / 0.32)' },
]

/** Text that changes while reading (buttons, query results) is not part of the highlightable text. */
const SKIP = '.sql-bar, .sql-result, button, [data-annotate="off"]'
const JUMP_KEY = 'dsm-jump-to-annotation'

export const highlightsSupported = () =>
  typeof CSS !== 'undefined' && 'highlights' in CSS && typeof (globalThis as { Highlight?: unknown }).Highlight === 'function'

interface TextIndex {
  text: string
  nodes: { node: Text; start: number }[]
}

function indexText(root: HTMLElement): TextIndex {
  const nodes: TextIndex['nodes'] = []
  let text = ''
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, {
    acceptNode: (n) => (n.parentElement?.closest(SKIP) ? NodeFilter.FILTER_REJECT : NodeFilter.FILTER_ACCEPT),
  })
  for (let n = walker.nextNode(); n; n = walker.nextNode()) {
    nodes.push({ node: n as Text, start: text.length })
    text += (n as Text).data
  }
  return { text, nodes }
}

/** A selection boundary as a position in the indexed text. */
function offsetOf(ix: TextIndex, container: Node, offset: number): number {
  const hit = ix.nodes.find((n) => n.node === container)
  if (hit) return hit.start + offset
  const probe = document.createRange()
  probe.setStart(container, offset)
  for (const n of ix.nodes) if (probe.comparePoint(n.node, 0) >= 0) return n.start
  return ix.text.length
}

function rangeAt(ix: TextIndex, start: number, end: number): Range | null {
  const from = ix.nodes.find((n) => start < n.start + n.node.data.length)
  const to = ix.nodes.find((n) => end > n.start && end <= n.start + n.node.data.length)
  if (!from || !to) return null
  const r = document.createRange()
  r.setStart(from.node, start - from.start)
  r.setEnd(to.node, end - to.start)
  return r
}

function caretAt(x: number, y: number): { node: Node; offset: number } | null {
  const d = document as Document & {
    caretPositionFromPoint?: (x: number, y: number) => { offsetNode: Node; offset: number } | null
    caretRangeFromPoint?: (x: number, y: number) => Range | null
  }
  const p = d.caretPositionFromPoint?.(x, y)
  if (p) return { node: p.offsetNode, offset: p.offset }
  const r = d.caretRangeFromPoint?.(x, y)
  return r ? { node: r.startContainer, offset: r.startOffset } : null
}

function newId(): string {
  return globalThis.crypto?.randomUUID?.() ?? `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`
}

/** Opening a lesson from the Highlights page scrolls to this highlight. */
export function requestJump(id: string) {
  try { sessionStorage.setItem(JUMP_KEY, id) } catch { /* private mode: the lesson just opens at the top */ }
}

/** The lesson's live (not deleted) annotations, kept up to date. */
export function useLessonAnnotations(lessonId: string): Annotation[] {
  const [items, setItems] = useState<Annotation[]>([])
  useEffect(() => {
    let live = true
    const load = () =>
      void all<AnnotationRecord>('annotations').then((recs) => {
        if (live) setItems(Object.entries(recs).filter(([, a]) => a.lessonId === lessonId && !a.deleted).map(([id, a]) => ({ ...a, id })))
      })
    load()
    const off = subscribe((s) => { if (s === 'annotations') load() })
    return () => { live = false; off() }
  }, [lessonId])
  return items
}

interface Pending extends TextQuote {
  rect: DOMRect
}

export function AnnotationLayer({ lessonId, article, ready, items }: { lessonId: string; article: RefObject<HTMLElement | null>; ready: boolean; items: Annotation[] }) {
  const ranges = useRef(new Map<string, Range>())
  const [pending, setPending] = useState<Pending | null>(null)
  const [openId, setOpenId] = useState<string | null>(null)
  const [missing, setMissing] = useState(0)
  const pressing = useRef(false)
  const supported = highlightsSupported()

  // Find every highlight in the text and paint it; again whenever the lesson's text changes.
  useEffect(() => {
    const root = article.current
    if (!ready || !root) return
    let timer = 0
    const paint = () => {
      const ix = indexText(root)
      const map = new Map<string, Range>()
      for (const a of items) {
        const start = locateQuote(ix.text, a)
        const r = start >= 0 ? rangeAt(ix, start, start + a.quote.length) : null
        if (r) map.set(a.id, r)
      }
      ranges.current = map
      setMissing(items.length - map.size)
      if (!supported) return
      for (const c of COLOURS) CSS.highlights.set(`dsm-${c.id}`, new Highlight(...items.filter((a) => a.colour === c.id && map.has(a.id)).map((a) => map.get(a.id)!)))
      CSS.highlights.set('dsm-note', new Highlight(...items.filter((a) => a.note.trim() && map.has(a.id)).map((a) => map.get(a.id)!)))
    }
    paint()
    // Coming from the Highlights page: scroll to the chosen one.
    try {
      const jump = sessionStorage.getItem(JUMP_KEY)
      const r = jump ? ranges.current.get(jump) : undefined
      if (jump && r) {
        sessionStorage.removeItem(JUMP_KEY)
        requestAnimationFrame(() => window.scrollTo({ top: window.scrollY + r.getBoundingClientRect().top - 120 }))
      }
    } catch { /* ignore */ }
    const mo = new MutationObserver(() => { clearTimeout(timer); timer = window.setTimeout(paint, 120) })
    mo.observe(root, { childList: true, subtree: true, characterData: true })
    return () => {
      mo.disconnect()
      clearTimeout(timer)
      if (supported) for (const k of ['dsm-yellow', 'dsm-green', 'dsm-pink', 'dsm-note']) CSS.highlights.delete(k)
    }
  }, [article, ready, items, supported])

  // A selection inside the lesson offers the highlight bar.
  useEffect(() => {
    let timer = 0
    const check = () => {
      const root = article.current
      const sel = document.getSelection()
      if (!root || !sel || sel.isCollapsed || sel.rangeCount === 0) {
        if (!pressing.current) setPending(null)
        return
      }
      const range = sel.getRangeAt(0)
      if (!root.contains(range.commonAncestorContainer)) { setPending(null); return }
      const ix = indexText(root)
      const [start, end] = trimSelection(ix.text, offsetOf(ix, range.startContainer, range.startOffset), offsetOf(ix, range.endContainer, range.endOffset))
      if (end <= start) { setPending(null); return }
      setPending({ ...quoteAt(ix.text, start, end), rect: range.getBoundingClientRect() })
    }
    const onChange = () => { clearTimeout(timer); timer = window.setTimeout(check, 180) }
    onChange() // a selection made before this listener started still counts
    document.addEventListener('selectionchange', onChange)
    window.addEventListener('scroll', onChange, { passive: true })
    return () => { document.removeEventListener('selectionchange', onChange); window.removeEventListener('scroll', onChange); clearTimeout(timer) }
  }, [article])

  // Tapping a highlight opens it.
  useEffect(() => {
    const root = article.current
    if (!root) return
    const onClick = (e: MouseEvent) => {
      if ((e.target as Element).closest('a, button, input, textarea, summary, .sql-block')) return
      const sel = document.getSelection()
      if (sel && !sel.isCollapsed) return
      const at = caretAt(e.clientX, e.clientY)
      if (!at) return
      for (const [id, r] of ranges.current) {
        try {
          if (r.isPointInRange(at.node, at.offset)) { setOpenId(id); return }
        } catch { /* the point is outside this range's document */ }
      }
    }
    root.addEventListener('click', onClick)
    return () => root.removeEventListener('click', onClick)
  }, [article, ready])

  async function create(colour: HighlightColour, withNote: boolean) {
    if (!pending) return
    const id = newId()
    const now = new Date().toISOString()
    const { quote, prefix, suffix } = pending
    await put('annotations', id, { lessonId, quote, prefix, suffix, colour, note: '', at: now, updatedAt: now } satisfies AnnotationRecord)
    document.getSelection()?.removeAllRanges()
    pressing.current = false
    setPending(null)
    if (withNote) setOpenId(id)
  }

  const open = items.find((a) => a.id === openId)
  return (
    <>
      {pending && <SelectionBar rect={pending.rect} onPress={() => { pressing.current = true }} onPick={(c) => void create(c, false)} onComment={() => void create('yellow', true)} />}
      {open && <AnnotationSheet key={open.id} annotation={open} onClose={() => setOpenId(null)} />}
      {missing > 0 && (
        <p className="muted" role="note" style={{ fontSize: 14, fontFamily: 'var(--sans)' }}>
          {missing === 1 ? 'One highlight' : `${missing} highlights`} could not be found in this version of the lesson; {missing === 1 ? 'it is' : 'they are'} still listed on the Highlights page.
        </p>
      )}
      {!supported && items.length > 0 && (
        <p className="muted" role="note" style={{ fontSize: 14, fontFamily: 'var(--sans)' }}>
          This browser cannot show highlights in the text. They are listed on the Highlights page.
        </p>
      )}
    </>
  )
}

function SelectionBar({ rect, onPress, onPick, onComment }: { rect: DOMRect; onPress: () => void; onPick: (c: HighlightColour) => void; onComment: () => void }) {
  const width = 236
  const height = 52
  // Below the selection, where iOS's own Copy menu is not; above it when there is no room below.
  const below = rect.bottom + 12 + height < window.innerHeight - 96
  const top = Math.min(Math.max(8, below ? rect.bottom + 12 : rect.top - height - 12), window.innerHeight - height - 8)
  const left = Math.min(Math.max(8, rect.left + rect.width / 2 - width / 2), window.innerWidth - width - 8)
  const keep = (e: React.PointerEvent | React.MouseEvent) => { e.preventDefault(); onPress() }
  return (
    <div role="toolbar" aria-label="Highlight the selected text" className="selection-bar" style={{ top, left, width, height }} onPointerDown={keep} onMouseDown={keep}>
      {COLOURS.map((c) => (
        <button key={c.id} type="button" aria-label={`Highlight ${c.label.toLowerCase()}`} onClick={() => onPick(c.id)}>
          <span className="swatch" style={{ background: c.swatch }} />
        </button>
      ))}
      <button type="button" className="selection-bar-comment" onClick={onComment}>Comment</button>
    </div>
  )
}

function AnnotationSheet({ annotation, onClose }: { annotation: Annotation; onClose: () => void }) {
  const ref = useRef<HTMLDialogElement>(null)
  const [note, setNote] = useState(annotation.note)
  const [colour, setColour] = useState(annotation.colour)

  useEffect(() => {
    const d = ref.current
    if (d && !d.open) d.showModal()
  }, [])

  async function save(changes: Partial<AnnotationRecord>) {
    const { id, ...rest } = annotation
    await put('annotations', id, { ...rest, note, colour, ...changes, updatedAt: new Date().toISOString() } satisfies AnnotationRecord)
  }

  const close = () => {
    if (note !== annotation.note || colour !== annotation.colour) void save({})
    ref.current?.close()
    onClose()
  }

  return (
    <dialog ref={ref} className="sheet" aria-labelledby="annotation-title" onCancel={(e) => { e.preventDefault(); close() }}>
      <p id="annotation-title" className="eyebrow" style={{ margin: 0 }}>{annotation.note ? 'Comment' : 'Highlight'}</p>
      <blockquote className="sheet-quote">{annotation.quote}</blockquote>
      <div role="group" aria-label="Colour" style={{ display: 'flex', gap: 8, margin: '4px 0 12px' }}>
        {COLOURS.map((c) => (
          <button key={c.id} type="button" className="icon-btn" aria-label={c.label} aria-pressed={colour === c.id} onClick={() => setColour(c.id)} style={{ outline: colour === c.id ? '2px solid var(--ink)' : undefined, outlineOffset: 2 }}>
            <span className="swatch" style={{ background: c.swatch }} />
          </button>
        ))}
      </div>
      <label htmlFor="annotation-note" style={{ display: 'block', fontWeight: 600, fontSize: 14, marginBottom: 6 }}>Your comment</label>
      <textarea id="annotation-note" className="input" rows={4} value={note} onChange={(e) => setNote(e.target.value)} placeholder="Why this matters, a question, an example from work…" style={{ width: '100%', fontSize: 16, resize: 'vertical' }} />
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, marginTop: 12 }}>
        <button type="button" className="link" style={{ color: 'var(--accent)' }} onClick={() => { void save({ deleted: true }); ref.current?.close(); onClose() }}>Delete highlight</button>
        <button type="button" className="btn btn-primary" onClick={close}>Done</button>
      </div>
    </dialog>
  )
}
