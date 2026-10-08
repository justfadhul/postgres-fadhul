# Progress

Read this with [`BRIEF.md`](BRIEF.md) at the start of every session. Newest milestone first.

**Site:** https://postgres-fadhul.vercel.app/ (Vercel, production domain; every push to the default
branch deploys). Per-deployment URLs sit behind Vercel's login, so share only this one.
**Repository:** https://github.com/justfadhul/postgres-fadhul (default branch
`claude/eloquent-cannon-pvvwiw`)

## Milestone 1: Module 1 end to end (built, stopped for the learner's iPhone test)

### Done

- **Design:** rebuilt to the approved Claude Design prototype (warm paper, ink, orange accent,
  condensed display type, small radii). Phone: cards and a bottom tab bar. Wide screens (960 px and
  up): an editorial layout with a masthead. Light by default, dark option.
- **Workbench** (`#/workbench`, `#/workbench/<challenge>`): CodeMirror 6 with PostgreSQL
  highlighting at 16 px; Run (Cmd/Ctrl+Enter), Explain (`EXPLAIN (ANALYZE, BUFFERS)` in a rolled-back
  transaction, shown as a readable tree with buffer counts), Reset dataset, `\d` helpers through
  `psql-describe`, errors with SQLSTATE and a caret at the error position, and Stop for a runaway
  query (restarts the worker; data is kept). On phones: a dark editor, a key row of SQL symbols and
  a dock with Run, both kept above the on-screen keyboard with `visualViewport`.
- **Engine:** downloads only after the learner agrees, with the size shown first; seeds the
  standard clinic dataset on first open; values come back as PostgreSQL text so output matches psql.
- **Lessons:** MDX reader with runnable SQL blocks (run in a rolled-back transaction, or open in the
  workbench), quick checks with explanations, margin notes on wide screens, Mark as done.
- **Grading:** result grader (reference and learner query on the same data, in one rolled-back
  transaction; numbers by value, everything else as text; order only when asked; `requires` and
  `forbids` shape rules over SQL with comments, strings and quoted names removed by a small lexer).
  `setup` adds test rows the generated data lacks (ties, patients with no visits, visits just after
  midnight Kampala time on boundary days, visits away from home, a three-step referral chain); the
  learner can read them under the challenge.
- **Progress:** IndexedDB (lessons done, quick-check answers, attempts, drafts, study time, streak),
  Today page with the next lesson and this week's time, JSON export (share sheet or download) and
  import with validation, a reminder on Today to export after each finished module (and weekly
  otherwise), theme setting, storage persistence request.
- **PWA:** the app shell and lessons work offline after the first visit; the engine is cached after
  its first download.
- **Module 1, SQL fluency:** 7 lessons (joins, grouping, subqueries and CTEs, recursive CTEs,
  window functions, NULL, dates and time zones) with 45 runnable SQL blocks; 24 quick checks (20
  verified against PostgreSQL by the tests); a 30-query assignment; "latest visit three ways"
  (DISTINCT ON, window, LATERAL) with a measured comparison. All Browser tier.
- **Content tests:** every SQL block runs (and fails with the stated SQLSTATE, or returns the stated
  row count, where the lesson says so); every quick check is placed and verified; every challenge's
  reference passes its own grader; 134 alternative correct answers pass and 239 plausible wrong
  answers fail. CI runs them on the small and the standard dataset.

### Evidence

- `npm run check`: 652 tests passed, 1 skipped (the large seed, run in CI with `SPIKE_LARGE=1`).
  Content tests on standard (`CONTENT_SIZE=standard`): 605 passed in 2 minutes.
- `npm run check:size`: first-load JavaScript 117.4 KB gzipped (budget 150 KB); engine 5.89 MB
  gzipped.
- Deployed check, run [37746425092](https://github.com/justfadhul/postgres-fadhul/actions/runs/37746425092)
  against https://postgres-fadhul.vercel.app/: shell, service worker and manifest served; engine
  Brotli-compressed by Vercel, 5.50 MB on the wire, cached for a year (SPIKES.md, finding 2).
- Local end-to-end (desktop Chromium and 360 px mobile Chromium): 19 passed, 3 skipped (WebKit-only
  or large-seed cases). Covers layout at every route (no sideways scroll, 44 px targets), Run,
  error position, `\dt`, Explain, passing challenge a01, lesson block, quick check, Mark as done,
  the key row, export and import, offline lessons, and no engine download before consent.
- **fact-checker** on all 7 lessons and the quick checks: 5 wrong claims and 15 unclear ones. All
  fixed (commit 4f641ed): the foreign key note, "aggregates skip NULLs", a wrong cross-reference,
  the server time zone default, the CYCLE explanation, `transform_null_equals`, terms defined on
  first use, an untestable MySQL remark removed. The three error examples are now runnable and
  tested for their SQLSTATE; a test checks that PGlite starts in `Etc/GMT0`.
- **grader-breaker** on all 33 challenges: about 250 attacks on small, standard and large. Before
  the fixes, wrong answers passed in a21 and a23 (on standard), a30 (on small), and through
  shape-rule tricks (`AS "distinct on"`, dollar quotes, nested comments, a dummy `WITH RECURSIVE`).
  Fixed by rewording a21, a23 and a30, the lexer in `stripSql`, and grader `setup` rows (commit
  f979407). Timings measured for the three-ways text: LATERAL without an index took 308 s on
  standard in Node; with the index, all three took under 0.6 s.

- **mobile-qa** at 360 and 390 px, light and dark (92 screenshots): no sideways page scroll, 16 px
  inputs, no hover-only controls. Fixed: Check feedback was off-screen on phones (now in the Check
  tab and scrolled into view); "Next challenge" was invisible in light theme on the dark workbench;
  the editor did not wrap long lines; a one-column result scrolled sideways; long tasks pushed the
  editor off the first screen (now clamped, with "Show the whole task"); tabs, Resources links, the
  SQLSTATE link and schema buttons under 44 px; contrast of the light accent (now #b83c0b, 4.8:1),
  SQL comments and unfinished module titles; the More menu now closes on an outside tap; no
  open/closed marker on expandable sections; the browser bar was tinted blue. The tap-target test
  now checks width as well as height, and covers tabs and expandable sections.
- **A real bug found through CI:** lessons jumped back to the top while being scrolled (the
  reading-progress bar re-rendered the page, and an effect that should run once per lesson ran on
  every render). Fixed, with an e2e test that fails on the old code. Please confirm on the iPhone
  that a long lesson scrolls normally.

### Known issues

- **One grader leak left:** in the LATERAL version of "latest visit", an answer with no id
  tie-break passes, because the index the task asks for returns tied rows in id order anyway. The
  answer is right by accident, not by rule. Listed, not fixed.
- Two alternative answers are slow on standard without an index (a14's second one 11 s, a15's
  second one 6 s in Node); a phone will be slower. Stop cancels them.
- The engine is 5.5 MB on the wire, not under 3 MB as the brief assumed (SPIKES.md, finding 2).
- `navigator.storage.persist()` returned false on the iPhone in Safari; it may be granted to the
  Home Screen app. Export is the safety net, and Today reminds about it.
- Safari's storage figure (475 MB) is unexplained until the phone prints `pg_database_size`.
- WebKit tests and the link check run only in CI (this sandbox has no WebKit and no direct
  internet).
- Wide results and the key row scroll sideways inside their own box; the result summary now says
  how many columns there are, and the key row fades at the edge, but there is no fade on tables.
- Seen once by mobile-qa and not reproduced in 8 later tries: the phone workbench stayed on
  "Starting PostgreSQL…" for over 3 minutes. If it happens on the iPhone, please note what was on
  screen.
- The link to Use The Index, Luke points at the book's home page; the dates chapter URL was not
  verified, so it is not linked directly.

### Check by hand on the iPhone

WebKit emulation is not iOS Safari. Please try these on the phone, at
https://postgres-fadhul.vercel.app/:

1. Open a lesson, tap **Run** on a SQL block, accept the download, and wait for the answer.
2. Workbench: tap into the editor. Do the key row and the Run dock stay above the keyboard, and
   does the editor not zoom? Type with the key row, run, then try an error and a wide result
   (does the table scroll sideways inside its box, not the page?).
3. A challenge: get one wrong, read the message, then pass it. Try **Show a hint**.
4. Turn on Airplane Mode, reload, and open a lesson you have not opened before.
5. Settings: **Export** (does the share sheet appear?), then **Import** the file back.
6. Optional: Add to Home Screen, open it from there, and see whether Settings now says storage is
   persistent.
7. Engine check (`#/spikes`): **Download engine and run checks**, then **standard**. Copy and send
   the results (they include exclusion constraints, row-level security and EXPLAIN on the phone,
   and the database's own size).
8. Anything that feels wrong: text size, contrast in dark mode, buttons too close together.

### Decisions

- Modules 2, 3 and 6 stay Browser tier; standard dataset by default (spike results approved).
- Hosting on Vercel, checked at the production domain; no environment variables.
- Lesson blocks may state `-- Expect error XXXXX` or `-- Expect N rows`, and the tests hold them
  to it (new-lesson skill).
- Graders may add `setup` rows, shown to the learner (new-challenge skill).
- CI also runs the content tests on the standard dataset, the one learners use.

### Next

Milestone 2 (Modules 2 and 3, constraint and plan graders) starts only after the learner has used
Module 1 on the iPhone and said what to change (BRIEF.md, section 10).

## Milestone 0: scaffold, setup, spikes (done)

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

1. ~~Import the repository into Vercel~~ and the production domain: done
   (https://postgres-fadhul.vercel.app/).
2. ~~Approve the spike results and tiers~~: approved.
3. One more engine check on the iPhone: now item 7 of Milestone 1's "Check by hand".
4. **Optional, recommended:** a separate cloud environment for this repo without the for-edith
   secrets (see CLAUDE_CODE_SETUP.md).

### Known issues

- Engine download is 5.9 MB gzipped, not under 3 MB as the brief assumed. Vercel serves it with
  Brotli, 5.50 MB on the wire (see Milestone 1). Vite's local preview server does **not** compress
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

## Suggestions outside the brief (not built)

- None yet.
