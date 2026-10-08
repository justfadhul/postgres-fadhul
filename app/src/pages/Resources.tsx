import { RESOURCES } from '@content/resources'

export function Resources() {
  return (
    <>
      <h1>Free resources</h1>
      <p className="muted">Every resource here is free to read. Lessons link to the relevant part.</p>
      <ul className="card-list">
        {RESOURCES.map((r) => (
          <li key={r.url} className="card">
            <h3>
              <a href={r.url} target="_blank" rel="noreferrer">
                {r.title}
              </a>
            </h3>
            <div className="card__meta">{r.useFor}</div>
          </li>
        ))}
      </ul>
    </>
  )
}
