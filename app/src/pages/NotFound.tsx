import { Link } from 'wouter'

export function NotFound() {
  return (
    <div className="page">
      <h1 className="display" style={{ fontSize: 44 }}>Page not found</h1>
      <p><Link href="/" className="link">Back to Today</Link></p>
    </div>
  )
}
