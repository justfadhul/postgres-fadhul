# Data Systems Mastery

A free, static, offline-capable study platform for an 11-module course on databases and backend
systems. One learner, studying mostly on an iPhone in iOS Safari on a slow or metered connection.
Read `docs/BRIEF.md` (the requirements) and `docs/PROGRESS.md` (where things stand) before working.
Work one milestone at a time and stop for review at the end of each (brief, section 10).

## Commands

```bash
npm install                 # dependencies (the SessionStart hook does this in cloud sessions)
npm run dev                 # dev server at http://localhost:5173/
npm run check               # type check, lint, unit + content + spike tests, link check (the gate)
npm run build               # production build into dist/
npm run check:size          # first-load JS budget and engine download figure (after build)
npm run e2e:local           # Playwright: desktop Chromium + 360 px mobile Chromium
npx playwright test         # all projects, including WebKit iPhone (WebKit installed in CI)
npx vitest run tests/spikes # Milestone 0 engine spikes in Node
node scripts/check-deployed.mjs <url>  # check a live deployment (engine compression etc.)
make check LAB=<id>         # Codespace lab checker (inside the devcontainer)
```

In cloud sandboxes `playwright.config.ts` finds the pre-installed Chromium by itself; do not run
`playwright install` there. WebKit runs in CI. The link check skips itself when the sandbox has no
direct internet access and is strict in CI (`LINKCHECK_STRICT=1`).

## Architecture

Vite + React + TypeScript single-page app in `app/`, hosted on Vercel (free Hobby plan) as plain
static files from the domain root (`vercel.json`; Vercel builds on every push). Hash routes
(`#/resources`) mean no server rewrites and deep links work offline. Vercel gets no environment
variables: the app needs none. PostgreSQL
runs in the page as PGlite (PostgreSQL 18 compiled to WebAssembly) inside a Web Worker
(`app/src/db/pglite-worker.ts`), persisted to IndexedDB (`idb://`), loaded only when a workbench
or engine page first opens. The page talks to the worker through our own small protocol
(`app/src/db/protocol.ts`) because PGlite's PGliteWorker drops SQLSTATE codes from errors. Content
lives in `content/` as typed data and (from Milestone 1) MDX lessons, validated at build and test
time. All learner state stays in the browser, with JSON export and import. `labs/` holds the
Codespace labs that need a real machine; `.devcontainer/` defines that machine (Node LTS, Go,
PostgreSQL 18, Docker-in-Docker). There is no backend and no API key anywhere.

## Content rules

- Write lessons yourself; never reproduce text from books, courses or docs. Link to free sources
  (`content/resources.ts`); never depend on the two paid books from the original course.
- Every runnable SQL block and every reference solution is executed by a test against PGlite in
  Node. A lesson that fails this test does not ship.
- Two-session behaviour: record the transcript from real PostgreSQL in the devcontainer and embed
  it. Never write expected output from memory.
- State facts you can demonstrate. Where behaviour depends on version or settings, say so,
  including where PGlite differs from server PostgreSQL.
- Links are checked in CI. Replace dead links; never invent URLs.
- British English, plain language, define each term on first use.
- Synthetic clinic data only (patients, visits, prescriptions, stock). Never use or ask for real
  patient data. The cloud environment has credentials for other projects (Supabase etc.); never
  use them here.
- Label every exercise with its tier: Browser or Codespace.

## Mobile rules

- Design at 360 to 430 px first. No horizontal page scroll at 360 px; wide tables and plans scroll
  inside their own container (`.scroll-x`).
- Tap targets at least 44 px. No hover-only controls.
- Inputs and the editor use at least 16 px text so iOS does not zoom on focus.
- Keep the Run button and key row visible above the on-screen keyboard (`visualViewport`).
- Light theme by default, dark option. High contrast, system fonts, no web-font downloads.
- First load under 150 KB gzipped JavaScript before PGlite (`npm run check:size`). Load PGlite only
  when the workbench opens and show its download size first.
- Respect `prefers-reduced-motion`. Semantic HTML, labelled controls.
- Everything must work in iOS Safari. WebKit emulation is not iOS Safari: list what needs a check
  on a real iPhone.

## Definition of done (every milestone)

- `npm run check` passes: type check, lint, unit tests, content tests, link check.
- End-to-end tests pass in WebKit at an iPhone viewport and in desktop Chromium (CI).
- The site is deployed and the URL is in `docs/PROGRESS.md`.
- Works offline after first load, for everything in the browser tier.
- Each new module has been through the `fact-checker` and `grader-breaker` agents, with findings
  fixed or listed.
- `docs/PROGRESS.md` is current (use the `milestone-check` skill).
- Report failures plainly. If a test fails or a spike does not work, say so and propose options.

## Never

- Never weaken or delete a test to make it pass.
- Never add a backend, paid service, API key, analytics or account system.
- Never commit an `outputStyle` setting.
- Never write solution code for lab exercises in `labs/` (see `labs/CLAUDE.md`).
