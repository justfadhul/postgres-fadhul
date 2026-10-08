import { MODULES } from '@content/syllabus'
import { CourseIndex } from '../course/CourseIndex'
import { useSnapshot } from '../course/useSnapshot'
import { useWide } from '../lib/useWide'

export function Course() {
  const wide = useWide()
  const s = useSnapshot()
  const hours = MODULES.reduce((a, m) => a + m.hours, 0)
  return (
    <div className={wide ? 'page-wide' : 'page'}>
      <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between', alignItems: 'baseline', gap: 8 }}>
        <p className="eyebrow" style={{ order: wide ? 2 : 0, width: wide ? undefined : '100%' }}>{MODULES.length} modules · {hours} hours</p>
        <h1 className="display" style={{ fontSize: wide ? 96 : 48 }}>Course</h1>
      </div>
      {s ? <CourseIndex snapshot={s} wide={wide} /> : <p aria-busy="true" className="muted">Loading…</p>}
    </div>
  )
}
