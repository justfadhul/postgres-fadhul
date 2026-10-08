# Data Systems Mastery

A free, self-study platform for an 11-module course (plus a beginners' Module 0) on databases and backend systems, built for
studying on a phone. Lessons, a real PostgreSQL engine in the page (PGlite), auto-graded
challenges, timed exams and progress tracking, all in a static site with no backend.

- Requirements: [`docs/BRIEF.md`](docs/BRIEF.md)
- Plan: [`docs/PLAN.md`](docs/PLAN.md)
- Where things stand: [`docs/PROGRESS.md`](docs/PROGRESS.md)
- Engine spike results: [`docs/SPIKES.md`](docs/SPIKES.md)
- Claude Code setup: [`docs/CLAUDE_CODE_SETUP.md`](docs/CLAUDE_CODE_SETUP.md)
- Codespace labs: [`labs/README.md`](labs/README.md)

## Develop

```bash
npm install
npm run dev      # http://localhost:5173/
npm run check    # the gate: types, lint, tests, links
```

All example data is synthetic. Never add real patient data.
