import { isValidElement, useEffect, useState, type ComponentType, type ReactElement, type ReactNode } from 'react'
import { Link, useParams } from 'wouter'
import { TIER_LABEL } from '@content/syllabus'
import { findLesson, loadLessonBody } from '../course/content'
import { IconBack } from '../layout/icons'
import { Note } from '../lesson/Note'
import { QuickCheckCard } from '../lesson/QuickCheckCard'
import { SqlBlock } from '../lesson/SqlBlock'
import { useWide } from '../lib/useWide'
import { useRecord } from '../storage/hooks'
import { get, put, type ProgressRecord } from '../storage/store'

type Body = ComponentType<{ components?: Record<string, unknown> }>

const components = {
  pre: (props: { children?: ReactNode }) => {
    const child = props.children
    if (isValidElement(child)) {
      const p = (child as ReactElement<{ className?: string; children?: ReactNode }>).props
      if (p.className === 'language-sql') return <SqlBlock sql={String(p.children ?? '')} />
    }
    return <pre className="scroll-x" style={{ fontSize: 13, background: 'var(--surface)', padding: '12px 14px', borderRadius: 4, fontFamily: 'var(--mono)' }}>{props.children}</pre>
  },
  table: (props: { children?: ReactNode }) => <div className="scroll-x"><table>{props.children}</table></div>,
  a: (props: { href?: string; children?: ReactNode }) => (
    <a href={props.href} target={props.href?.startsWith('http') ? '_blank' : undefined} rel="noreferrer">{props.children}</a>
  ),
  QuickCheck: QuickCheckCard,
  Note,
}

function useReadingProgress() {
  const [p, setP] = useState(0)
  useEffect(() => {
    const onScroll = () => {
      const max = document.documentElement.scrollHeight - window.innerHeight
      setP(max > 0 ? Math.min(1, window.scrollY / max) : 0)
    }
    onScroll()
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])
  return p
}

export default function Lesson() {
  const { id = '' } = useParams<{ id: string }>()
  // Keyed by lesson, so moving to the next lesson starts with fresh state.
  return <LessonPage key={id} id={id} />
}

function LessonPage({ id }: { id: string }) {
  const ref = findLesson(id)
  const wide = useWide()
  const [Body, setBody] = useState<Body | null>(null)
  const [failed, setFailed] = useState('')
  const progress = useRecord<ProgressRecord>('progress', id)
  const reading = useReadingProgress()

  useEffect(() => {
    if (!ref) return
    window.scrollTo(0, 0)
    loadLessonBody(ref).then((m) => setBody(() => m.default), (e: Error) => setFailed(e.message))
    void get<ProgressRecord>('progress', ref.lesson.id).then((p) => {
      if (!p) void put('progress', ref.lesson.id, { status: 'started', updatedAt: new Date().toISOString() })
    })
  }, [ref])

  if (!ref) {
    return (
      <div className="page"><h1 className="display" style={{ fontSize: 40 }}>Lesson not found</h1><Link href="/course" className="link">Back to the course</Link></div>
    )
  }
  const { lesson, module, content, index } = ref
  const prev = content.lessons[index - 1]
  const next = content.lessons[index + 1]
  const done = progress?.status === 'done'
  const markDone = () => put('progress', lesson.id, { status: 'done', updatedAt: new Date().toISOString() })

  const bar = (
    <div aria-hidden style={{ position: 'sticky', top: 0, zIndex: 10, height: 3, background: 'var(--soft)' }}>
      <div style={{ width: `${Math.round(reading * 100)}%`, height: '100%', background: 'var(--accent)' }} />
    </div>
  )

  const footer = (
    <>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, alignItems: 'center', margin: '36px 0 0', fontFamily: 'var(--sans)' }}>
        {done ? (
          <p style={{ margin: 0, fontWeight: 600 }}>Lesson done. {next ? '' : 'Next: the assignment.'}</p>
        ) : (
          <button type="button" className="btn btn-primary" onClick={() => void markDone()}>Mark this lesson done</button>
        )}
        {!next && <Link href={`/assignment/${module.id}`} className="link">Open the assignment</Link>}
      </div>
      <nav aria-label="Lessons" style={{ display: 'flex', flexWrap: 'wrap', marginTop: wide ? 64 : 36, borderTop: '2px solid var(--ink)', fontFamily: 'var(--sans)' }}>
        {prev ? (
          <Link href={`/lesson/${prev.id}`} style={{ flex: '1 1 260px', display: 'flex', flexDirection: 'column', gap: 8, padding: '18px 20px 18px 0', textDecoration: 'none' }}>
            <span className="eyebrow">← Previous · {prev.number}</span>
            <span className="display" style={{ fontSize: wide ? 40 : 26, color: 'var(--muted)' }}>{prev.title}</span>
          </Link>
        ) : <span style={{ flex: '1 1 260px' }} />}
        {next && (
          <Link href={`/lesson/${next.id}`} onClick={() => { if (!done) void markDone() }} style={{ flex: '1 1 260px', display: 'flex', flexDirection: 'column', gap: 8, padding: '18px 0 18px 20px', borderLeft: '1px solid var(--hair)', textDecoration: 'none', textAlign: 'right' }}>
            <span className="eyebrow" style={{ color: 'var(--accent)' }}>{done ? 'Next' : 'Mark done and continue'} · {next.number} →</span>
            <span className="display" style={{ fontSize: wide ? 40 : 26 }}>{next.title}</span>
          </Link>
        )}
      </nav>
    </>
  )

  const body = failed ? <p role="alert">This lesson could not load: {failed}</p> : Body ? <Body components={components} /> : <p className="muted" aria-busy="true">Loading the lesson…</p>

  if (!wide) {
    return (
      <>
        {bar}
        <div className="page" style={{ paddingTop: 'calc(env(safe-area-inset-top) + 14px)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10, marginBottom: 18 }}>
            <Link href="/course" aria-label="Back to the course" className="icon-btn"><IconBack /></Link>
            <span className="chip">{lesson.number} · {lesson.minutes} min</span>
            <span style={{ width: 44 }} />
          </div>
          <p className="eyebrow">Module {module.number} · {module.title}</p>
          <h1 className="display" style={{ fontSize: 44, margin: '6px 0 18px' }}>{lesson.title}</h1>
          <article className="prose">{body}</article>
          {footer}
        </div>
      </>
    )
  }

  return (
    <>
      {bar}
      <div className="page-wide" style={{ maxWidth: 1120 }}>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px 28px', alignItems: 'baseline', paddingBottom: 16, borderBottom: '2px solid var(--ink)', maxWidth: 1000 }}>
          <Link href="/course" className="eyebrow" style={{ textDecoration: 'none' }}>Module {module.number} · {module.title}</Link>
          <span className="eyebrow">{lesson.minutes} min read</span>
          <span className="eyebrow">{TIER_LABEL[lesson.tier]}</span>
          {done && <span className="eyebrow" style={{ color: 'var(--right)' }}>Done</span>}
        </div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0 36px', alignItems: 'flex-end', margin: '36px 0 30px', maxWidth: 1000 }}>
          <span className="display" style={{ fontSize: 'clamp(72px, 8vw, 128px)', color: 'var(--accent)' }}>{lesson.number}</span>
          <h1 className="display" style={{ fontSize: 'clamp(72px, 8vw, 128px)', flex: '1 1 480px' }}>{lesson.title}</h1>
        </div>
        <p className="serif" style={{ fontSize: 26, lineHeight: 1.45, margin: '0 0 32px', maxWidth: 680 }}>{lesson.summary}</p>
        <article className="prose prose-wide" style={{ maxWidth: 680 }}>{body}</article>
        <div style={{ maxWidth: 1000 }}>{footer}</div>
      </div>
    </>
  )
}
