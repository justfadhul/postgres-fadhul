import { Link } from 'wouter'

export function NotFound() {
  return (
    <>
      <h1>Page not found</h1>
      <p>
        <Link href="/">Back to the course map</Link>
      </p>
    </>
  )
}
