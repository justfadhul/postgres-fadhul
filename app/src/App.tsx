import { lazy, Suspense } from 'react'
import { Route, Router, Switch } from 'wouter'
import { useHashLocation } from 'wouter/use-hash-location'
import { Shell } from './layout/Shell'
import { Assignment } from './pages/Assignment'
import { Course } from './pages/Course'
import { NotFound } from './pages/NotFound'
import { Resources } from './pages/Resources'
import { Settings } from './pages/Settings'
import { Today } from './pages/Today'
import { EngineProvider } from './workbench/EngineContext'

// Heavier screens load on demand: the editor with the workbench, lesson bodies with lessons.
const Workbench = lazy(() => import('./pages/Workbench'))
const Lesson = lazy(() => import('./pages/Lesson'))
const Spikes = lazy(() => import('./pages/Spikes'))
const Highlights = lazy(() => import('./pages/Highlights'))

export function App() {
  return (
    // Hash routes need no server rewrites and work offline from the service worker.
    <Router hook={useHashLocation}>
      <EngineProvider>
        <Shell>
          <Suspense fallback={<p className="page muted" aria-busy="true">Loading…</p>}>
            <Switch>
              <Route path="/" component={Today} />
              <Route path="/course" component={Course} />
              <Route path="/lesson/:id" component={Lesson} />
              <Route path="/assignment/:id" component={Assignment} />
              <Route path="/workbench" component={Workbench} />
              <Route path="/workbench/:id" component={Workbench} />
              <Route path="/highlights" component={Highlights} />
              <Route path="/resources" component={Resources} />
              <Route path="/settings" component={Settings} />
              <Route path="/spikes" component={Spikes} />
              <Route component={NotFound} />
            </Switch>
          </Suspense>
        </Shell>
      </EngineProvider>
    </Router>
  )
}
