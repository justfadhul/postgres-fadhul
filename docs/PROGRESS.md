# Progress

Read this with [`BRIEF.md`](BRIEF.md) at the start of every session. Newest milestone first.

**Site:** on Vercel, **not deployed yet**. The learner is importing the repository; put the
production URL here once it exists.
**Repository:** https://github.com/justfadhul/postgres-fadhul (default branch
`claude/eloquent-cannon-pvvwiw`)

## Milestone 0: scaffold, setup, spikes (built, stopped for review)

### Done

- `docs/BRIEF.md` saved verbatim; plan in [`PLAN.md`](PLAN.md), including where it disagrees with
  the brief.
- App shell: Vite 8, React 19, TypeScript 6, hash routes (wouter), PWA (vite-plugin-pwa), and
  light and dark themes. Pages: course map (11 modules from `content/syllabus.ts`), free
  resources, engine check.
- Engine: PGlite 0.5.8 (PostgreSQL 18.3) in a Web Worker over IndexedDB. A custom worker protocol
  keeps SQLSTATE and the other error fields. A Web Lock stops two tabs from opening the same
  database.
- Synthetic clinic dataset generator (`content/datasets/clinic.ts`), deterministic, four sizes.
- Spikes 1 to 5: all pass in Node, Chromium and WebKit. Report: [`SPIKES.md`](SPIKES.md).
- Checks: `npm run check` (types, lint, unit, content, spike tests, link check);
  `npm run check:size` (first load 76 KB gzipped against a 150 KB budget; engine 5.89 MB gzipped).
- End-to-end: 26 Playwright tests over WebKit iPhone 390, WebKit 360, Chromium desktop and
  Chromium 360. They cover layout (no sideways scroll, 44 px targets), routes, theme, offline
  shell, and the engine downloading only on request.
- Devcontainer: Ubuntu 24.04, PostgreSQL 18 (PGDG), Node LTS, Go, Docker-in-Docker, 2 cores.
  `make check LAB=env-check` checks the tools.
- CI (`.github/workflows/ci.yml`): check and e2e on every push. `devcontainer.yml` builds the
  Codespace image and runs the environment check.
- Hosting: Vercel (the learner's choice, replacing GitHub Pages). `vercel.json` sets the build
  (`npm run build && npm run check:size`, so a size-budget failure blocks the deploy), output `dist`
  and cache headers. Site served from `/`. The `deployed.yml` workflow runs
  `scripts/check-deployed.mjs` against each successful production deployment. It checks the shell,
  service worker and manifest, and fails if the engine travels uncompressed.
- Claude Code: `.claude/settings.json` (acceptEdits, narrow allow rules, `ask` for push and `gh`,
  deny `.env` and force-push), SessionStart hook, `CLAUDE.md`, `labs/CLAUDE.md`, agents
  (`fact-checker`, `mobile-qa`, `grader-breaker`) and skills (`new-lesson`, `new-challenge`,
  `milestone-check`). Explained in [`CLAUDE_CODE_SETUP.md`](CLAUDE_CODE_SETUP.md).

### Evidence

- Local sandbox: `npm run check` passed (13 tests; link check skipped because the sandbox proxy
  blocks those hosts). `npx playwright test --project=desktop-chromium --project=mobile-chromium-360`
  gave 14 passed, including the large dataset.
- CI run [37732615910](https://github.com/justfadhul/postgres-fadhul/actions/runs/37732615910):
  check passed; the strict link check found all 20 links OK; e2e gave 26 passed (WebKit
  included). (The GitHub Pages deploy job, since removed, failed because Pages was off.)
- Devcontainer run 1 failed in post-create: `sudo -u postgres` needs a password in the base image.
  Fixed with `runuser`. Run [37734051573](https://github.com/justfadhul/postgres-fadhul/actions/runs/37734051573)
  passed: the image builds, and `make check LAB=env-check` inside it reports Node 24.21, Go 1.27.1,
  Docker 29.8, the PostgreSQL 18.6 client and server, and SQLite 3.45.
- CI run [37734051616](https://github.com/justfadhul/postgres-fadhul/actions/runs/37734051616):
  check and e2e green again.

### Waiting on the learner

1. **Import the repository into Vercel** (Add New → Project → `justfadhul/postgres-fadhul`).
   `vercel.json` already sets the build, so accept the defaults. Add **no environment variables**.
   Production branch: the repository's default branch. Then send the production URL.
2. **Approve the spike results and tiers** in [`SPIKES.md`](SPIKES.md): Modules 2, 3 and 6 stay
   Browser tier; standard dataset by default.
3. **Run the engine check on your iPhone** (steps at the end of SPIKES.md) and send the copied
   results.
4. **Optional, recommended:** a separate cloud environment for this repo without the for-edith
   secrets (see CLAUDE_CODE_SETUP.md).

### Known issues

- Engine download is 5.9 MB gzipped, not under 3 MB as the brief assumed. Whether Vercel
  compresses `.wasm` and `.data` is unknown until the first deployment;
  `scripts/check-deployed.mjs` measures it. Vite's local preview server does **not** compress
  `.wasm` (12.8 MB on the wire), so local measurements say nothing about Vercel.
- WebKit's `navigator.storage.estimate()` figures look inflated in emulation; check on a real
  iPhone.
- `navigator.storage.persist()` was refused in all emulated browsers.
- Vite warns about `eval` inside PGlite's bundle. That is PGlite's own code, not something to fix
  here.
- The cloud build sandbox has no WebKit and no direct internet, so WebKit tests and the link check
  run only in CI. `playwright.config.ts` uses the sandbox's pre-installed Chromium.
- Not testable here: the devcontainer in a real Codespace (CI builds the same image instead), and
  iOS Safari itself.

### Decisions

- Hash routing instead of path routing with a 404 fallback (PLAN.md, item 2).
- Own worker protocol instead of `PGliteWorker` (SPIKES.md, finding 1).
- Not adopting `@electric-sql/pglite-repl`; Milestone 1 will try `psql-describe` for `\d`
  (PLAN.md, item 5).
- Dataset generated by SQL in the page (no download), default size standard.
- Hosting moved from GitHub Pages to Vercel at the learner's request; base path `/` (PLAN.md, item 9).
- Repository `postgres-fadhul` (PLAN.md, item 4).
- No mod in Milestone 0; this was a cloud session (CLAUDE_CODE_SETUP.md).

## Next: Milestone 1 (after approval)

1. If Vercel serves the engine uncompressed: pre-compressed engine files decompressed in the worker.
2. Storage module (IndexedDB) with JSON export and import, plus an export reminder.
3. Workbench: CodeMirror 6, Run, Explain, Reset, `\d` helpers, error display with position, and
   the iOS key row using `visualViewport`.
4. Lesson reader (MDX), quick checks, result grader with `mustPass` and `mustFail` tests.
5. Module 1 content end to end, `fact-checker` and `grader-breaker` passes, then stop for the
   learner to test on his iPhone.

## Suggestions outside the brief (not built)

- None yet.
