import { MODULES, PHASES, TIER_LABEL } from '@content/syllabus'

const phases = Object.entries(PHASES).map(([n, title]) => ({ n: Number(n), title }))

export function CourseMap() {
  const totalHours = MODULES.reduce((sum, m) => sum + m.hours, 0)
  return (
    <>
      <h1>Course map</h1>
      <p className="muted">
        {MODULES.length} modules, about {totalHours} hours. Lessons arrive module by module; this is the empty shell
        from Milestone 0.
      </p>
      {phases.map((phase) => (
        <section key={phase.n} aria-labelledby={`phase-${phase.n}`}>
          <h2 id={`phase-${phase.n}`}>
            Phase {phase.n}: {phase.title}
          </h2>
          <ol className="card-list">
            {MODULES.filter((m) => m.phase === phase.n).map((m) => (
              <li key={m.id} className="card">
                <h3>
                  {m.number}. {m.title}
                </h3>
                <div className="card__meta">
                  <span>{m.hours} h</span>
                  <span className="badge">{TIER_LABEL[m.tier]}</span>
                  <span>Not started</span>
                </div>
              </li>
            ))}
          </ol>
        </section>
      ))}
    </>
  )
}
