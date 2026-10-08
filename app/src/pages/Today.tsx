import { useState } from 'react'
import { Link } from 'wouter'
import { MODULE_CONTENT } from '@content/modules'
import { MODULES } from '@content/syllabus'
import { THREE_WAYS_IDS } from '@content/modules/m01/challenges'
import { CourseIndex } from '../course/CourseIndex'
import { exportReminder, formatMinutes, hoursStudied, moduleProgress, nextLesson, streak, thisWeek, type StateSnapshot } from '../course/progress'
import { useSnapshot } from '../course/useSnapshot'
import { IconMoon } from '../layout/icons'
import { useRecord } from '../storage/hooks'
import { useWide } from '../lib/useWide'
import { applyTheme, readTheme } from '../lib/theme'

const TOTAL_HOURS = MODULES.reduce((s, m) => s + m.hours, 0)

function todayLabel(d = new Date()) {
  return d.toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long' })
}

/** The first assignment or practice challenge not yet passed. */
function nextChallenge(s: StateSnapshot) {
  for (const m of MODULES) {
    const c = MODULE_CONTENT[m.id]
    if (!c) continue
    const ids = [...c.assignment.challengeIds, ...(m.id === 'm01-sql-fluency' ? THREE_WAYS_IDS : [])]
    const id = ids.find((x) => !s.attempts[x]?.passed)
    const ch = id && c.challenges.find((x) => x.id === id)
    if (ch) return ch
  }
  return undefined
}

function useTodayData() {
  const [now] = useState(() => Date.now())
  const s = useSnapshot()
  const lastExport = useRecord<string>('settings', 'lastExportAt')
  if (!s) return undefined
  const current = MODULES.find((m) => MODULE_CONTENT[m.id] && moduleProgress(m.id, s).percent < 100) ?? MODULES[0]!
  const mp = moduleProgress(current.id, s)
  const week = thisWeek(s.activity)
  const weekSeconds = week.reduce((a, d) => a + d.seconds, 0)
  const { due: backupDue, module: moduleBackup, daysSinceExport } = exportReminder(s, lastExport, now)
  return {
    s, current, mp, week, weekSeconds,
    hours: hoursStudied(s.activity),
    streak: streak(s.activity),
    next: nextLesson(s),
    challenge: nextChallenge(s),
    lastExport, daysSinceExport, backupDue, moduleBackup,
  }
}

type Data = NonNullable<ReturnType<typeof useTodayData>>

export function Today() {
  const wide = useWide()
  const d = useTodayData()
  if (!d) return <div className={wide ? 'page-wide' : 'page'} aria-busy="true" />
  return wide ? <TodayWide d={d} /> : <TodayNarrow d={d} />
}

function exportLine(d: Data) {
  if (d.moduleBackup) return `Module ${d.moduleBackup.number} finished: export now`
  if (!d.lastExport) return 'Never exported'
  return d.daysSinceExport === 0 ? 'Last export today' : `Last export ${d.daysSinceExport} day${d.daysSinceExport === 1 ? '' : 's'} ago`
}

function TodayNarrow({ d }: { d: Data }) {
  const maxDay = Math.max(1, ...d.week.map((x) => x.seconds))
  return (
    <div className="page">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12 }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          <p className="eyebrow">{todayLabel()}</p>
          <h1 className="display" style={{ fontSize: 48 }}>Today</h1>
        </div>
        <ThemeButton />
      </div>

      <div aria-label="Study days this week" style={{ display: 'grid', gridTemplateColumns: 'repeat(7, minmax(0, 1fr))', gap: 6, margin: '20px 0 16px', textAlign: 'center' }}>
        {d.week.map((day) => (
          <div key={day.key} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6 }}>
            <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--muted)' }}>{day.date.toLocaleDateString('en-GB', { weekday: 'narrow' })}</span>
            <span
              aria-label={`${day.date.toLocaleDateString('en-GB', { weekday: 'long' })}: ${day.seconds ? formatMinutes(day.seconds) : 'no study'}`}
              style={{
                width: '100%', aspectRatio: '1', borderRadius: 6, display: 'grid', placeItems: 'center', fontSize: 14, fontWeight: 600,
                background: day.isToday ? 'var(--accent)' : day.seconds >= 60 ? 'var(--pill)' : 'var(--surface2)',
                color: day.isToday ? 'var(--on-accent)' : day.seconds >= 60 ? 'var(--on-pill)' : 'var(--muted)',
              }}
            >
              {day.date.getDate()}
            </span>
          </div>
        ))}
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        <div className="card" style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) 112px', gap: 12, alignItems: 'end' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            <p className="eyebrow">Hours studied</p>
            <div className="num" style={{ fontSize: 42, fontWeight: 700, letterSpacing: '-0.03em', lineHeight: 1 }}>
              {d.hours}<span style={{ fontSize: 15, fontWeight: 500, letterSpacing: 0, color: 'var(--muted)', marginLeft: 4 }}>/ {TOTAL_HOURS} h</span>
            </div>
            <div style={{ fontSize: 13 }}>This week <b style={{ color: 'var(--accent)' }}>{formatMinutes(d.weekSeconds)}</b></div>
          </div>
          <div aria-hidden style={{ display: 'flex', alignItems: 'flex-end', gap: 6, height: 64 }}>
            {d.week.map((day) => (
              <i key={day.key} style={{ flex: 1, height: `${Math.max(8, (day.seconds / maxDay) * 100)}%`, borderRadius: 3, background: day.isToday ? 'var(--accent)' : 'var(--track)' }} />
            ))}
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 10 }}>
          <div className="card" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6 }}>
            <p className="eyebrow" style={{ alignSelf: 'flex-start' }}>Module {d.current.number}</p>
            <Ring percent={d.mp.percent} label={`Module ${d.current.number}, ${d.mp.percent} percent complete`} />
            <div style={{ fontSize: 13, color: 'var(--muted)' }}>{d.mp.lessonsDone} of {d.mp.lessons} lessons</div>
          </div>
          <div className="card" style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center', gap: 14 }}>
            <Meter label="Quick checks" value={`${d.mp.checksCorrect}/${d.mp.checks}`} fraction={d.mp.checks ? d.mp.checksCorrect / d.mp.checks : 0} />
            <Meter label="Challenges" value={`${d.mp.challengesPassed}/${d.mp.challenges}`} fraction={d.mp.challenges ? d.mp.challengesPassed / d.mp.challenges : 0} />
            <Meter label="Best exam" value="—" fraction={0} />
            <Meter label="Streak" value={`${d.streak} day${d.streak === 1 ? '' : 's'}`} fraction={Math.min(1, d.streak / 7)} accent />
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 10 }}>
          <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            <h2 style={{ margin: 0, fontSize: 19 }}>Continue</h2>
            <p style={{ margin: '0 0 12px', fontSize: 14, color: 'var(--muted)', flex: 1 }}>
              {d.next ? `${d.next.lesson.number} ${d.next.lesson.title} · ${d.next.lesson.minutes} min` : 'All available lessons are done.'}
            </p>
            {d.next && <Link href={`/lesson/${d.next.lesson.id}`} className="btn btn-primary btn-block">Resume</Link>}
          </div>
          <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            <h2 style={{ margin: 0, fontSize: 19 }}>Practise</h2>
            <p style={{ margin: '0 0 12px', fontSize: 14, color: 'var(--muted)', flex: 1 }}>{d.challenge ? d.challenge.title : 'Open the workbench and explore the data.'}</p>
            <Link href={d.challenge ? `/workbench/${d.challenge.id}` : '/workbench'} className="btn btn-primary btn-block">Open</Link>
          </div>
        </div>

        <Link href="/settings" className="card" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, minHeight: 56, fontSize: 15, textDecoration: 'none', borderLeft: d.backupDue ? '3px solid var(--accent)' : undefined }}>
          <span>Back up your progress</span>
          <span style={{ color: d.backupDue ? 'var(--accent)' : 'var(--muted)', fontSize: 13 }}>{exportLine(d)} ›</span>
        </Link>
      </div>
    </div>
  )
}

function TodayWide({ d }: { d: Data }) {
  return (
    <div className="page-wide">
      <section aria-label="Next up" style={{ display: 'flex', flexWrap: 'wrap', gap: '48px 64px', alignItems: 'flex-end', paddingBottom: 56, borderBottom: '1px solid var(--hair)' }}>
        <div style={{ flex: '3 1 620px', minWidth: 0, display: 'flex', flexDirection: 'column', gap: 22 }}>
          <p className="eyebrow">{todayLabel()} · next up</p>
          <h1 className="display" style={{ fontSize: 'clamp(72px, 9vw, 148px)' }}>{d.next ? d.next.lesson.title : 'All caught up'}</h1>
          {d.next && <p className="serif" style={{ margin: 0, maxWidth: 620, fontSize: 22, lineHeight: 1.5 }}>{d.next.lesson.summary}</p>}
          <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '12px 28px' }}>
            {d.next && <Link href={`/lesson/${d.next.lesson.id}`} className="btn btn-primary" style={{ minHeight: 52, padding: '0 26px', fontSize: 16 }}>Resume lesson <span aria-hidden>→</span></Link>}
            <Link href={d.challenge ? `/workbench/${d.challenge.id}` : '/workbench'} className="link" style={{ fontSize: 15 }}>
              {d.challenge ? `or practise: ${d.challenge.title}` : 'or open the workbench'}
            </Link>
          </div>
          {d.next && <p className="muted" style={{ margin: 0, fontSize: 14 }}>Module {d.next.module.number} · Lesson {d.next.lesson.number} · {d.next.lesson.minutes} minutes · Browser</p>}
        </div>
        <dl style={{ flex: '1 1 280px', margin: 0, borderTop: '2px solid var(--ink)' }}>
          <Stat label={`Hours studied, of ${TOTAL_HOURS}`} value={String(d.hours)} />
          <Stat label={`Module ${d.current.number} complete`} value={`${d.mp.percent}%`} accent />
          <Stat label="Study streak" value={`${d.streak} day${d.streak === 1 ? '' : 's'}`} />
          <Stat label="Challenges passed" value={`${d.mp.challengesPassed} / ${d.mp.challenges}`} />
        </dl>
      </section>

      <section aria-label="This week" style={{ padding: '40px 0 56px', borderBottom: '1px solid var(--hair)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 20 }}>
          <h2 className="eyebrow">This week</h2>
          <span className="muted" style={{ fontSize: 14 }}>
            {d.week.filter((x) => x.seconds >= 60).length} study day{d.week.filter((x) => x.seconds >= 60).length === 1 ? '' : 's'} · {formatMinutes(d.weekSeconds)}
            {d.backupDue && <> · <Link href="/settings" style={{ color: 'var(--accent)', fontWeight: 600 }}>{d.moduleBackup ? `Module ${d.moduleBackup.number} finished: back up your progress` : 'back up your progress'}</Link></>}
          </span>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, minmax(0, 1fr))', borderLeft: '1px solid var(--hair)' }}>
          {d.week.map((day) => (
            <div key={day.key} style={{ display: 'flex', flexDirection: 'column', gap: 6, padding: '14px 16px 18px', borderRight: '1px solid var(--hair)', borderTop: `4px solid ${day.isToday ? 'var(--accent)' : day.seconds >= 60 ? 'var(--ink)' : 'var(--soft)'}` }}>
              <span className="display" style={{ fontSize: 30 }}>{day.date.toLocaleDateString('en-GB', { weekday: 'short' })}</span>
              <span className="muted" style={{ fontSize: 13 }}>{day.date.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}</span>
              <span style={{ marginTop: 10, fontSize: 14, fontWeight: day.seconds ? 600 : 400, color: day.isToday ? 'var(--accent)' : day.seconds ? undefined : 'var(--muted)' }}>
                {day.isToday ? `Today · ${formatMinutes(day.seconds)}` : day.seconds ? formatMinutes(day.seconds) : '—'}
              </span>
            </div>
          ))}
        </div>
      </section>

      <section aria-label="Course" style={{ paddingTop: 48 }}>
        <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between', alignItems: 'baseline', gap: 12 }}>
          <h2 className="display" style={{ fontSize: 72 }}>Course</h2>
          <span className="eyebrow">{MODULES.length} modules · {TOTAL_HOURS} hours</span>
        </div>
        <CourseIndex snapshot={d.s} wide />
      </section>
    </div>
  )
}

function Stat({ label, value, accent }: { label: string; value: string; accent?: boolean }) {
  return (
    <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 16, padding: '16px 0', borderBottom: '1px solid var(--hair)' }}>
      <dt style={{ fontSize: 14, color: 'var(--muted)' }}>{label}</dt>
      <dd className="num" style={{ margin: 0, fontSize: 40, fontWeight: 700, letterSpacing: '-0.03em', color: accent ? 'var(--accent)' : undefined }}>{value}</dd>
    </div>
  )
}

function Meter({ label, value, fraction, accent }: { label: string; value: string; fraction: number; accent?: boolean }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--muted)', fontWeight: 600 }}>
        <span>{label}</span><span className="num">{value}</span>
      </div>
      <div style={{ height: 4, borderRadius: 2, background: 'var(--track)', overflow: 'hidden' }}>
        <div style={{ height: '100%', width: `${Math.round(fraction * 100)}%`, background: accent ? 'var(--accent)' : 'var(--ink)' }} />
      </div>
    </div>
  )
}

function Ring({ percent, label }: { percent: number; label: string }) {
  const c = 276.5
  return (
    <div role="img" aria-label={label} style={{ position: 'relative', width: 104, height: 104 }}>
      <svg viewBox="0 0 104 104" width="104" height="104" style={{ transform: 'rotate(-90deg)' }} aria-hidden>
        <circle cx="52" cy="52" r="44" fill="none" stroke="var(--track)" strokeWidth="10" />
        <circle cx="52" cy="52" r="44" fill="none" stroke="var(--accent)" strokeWidth="10" strokeLinecap="round" strokeDasharray={c} strokeDashoffset={c * (1 - percent / 100)} />
      </svg>
      <b className="num" style={{ position: 'absolute', inset: 0, display: 'grid', placeItems: 'center', fontSize: 22 }}>{percent}%</b>
    </div>
  )
}

function ThemeButton() {
  const [dark, setDark] = useState(() => readTheme() === 'dark')
  return (
    <button type="button" className="icon-btn" aria-label="Dark theme" aria-pressed={dark} onClick={() => { applyTheme(dark ? 'light' : 'dark'); setDark(!dark) }}>
      <IconMoon />
    </button>
  )
}
