# Plan

This is the plan the brief asks for (section 3). It covers architecture, the Milestone 0 spikes,
the content model and the milestones, and says where it departs from the brief and why.
Spike results are in [`SPIKES.md`](SPIKES.md); current status is in [`PROGRESS.md`](PROGRESS.md).

## Where this plan disagrees with the brief

| # | Brief says | This build does | Why |
| --- | --- | --- | --- |
| 1 | PGlite is under 3 MB gzipped | Shows the real figure: **about 5.9 MB gzipped** (PGlite 0.5.8) | Measured from the build (`npm run check:size`): `pglite.wasm` 3.4 MB + `pglite.data` 2.1 MB + worker 0.14 MB + `initdb.wasm` 0.14 MB + `btree_gist` 0.02 MB. It downloads once, only when the learner opens the workbench, and the service worker keeps it. Ways to shrink it are listed under Risks; none is worth taking before Milestone 1 testing. |
| 2 | Handle `/repo-name/` in the router | Hash routes (`#/module/1`) plus Vite `base` | GitHub Pages has no rewrite rules. Path routes need a copied `404.html`, which returns HTTP 404 for every deep link. Hash routes work on Pages, offline, and from a Home Screen icon with no tricks. The base path still matters for assets and the service worker scope, and both use it. |
| 3 | Run PGlite in a Web Worker (implied: PGlite's `PGliteWorker`) | A small worker protocol of our own (`app/src/db/protocol.ts`) | Spike finding: `PGliteWorker` forwards only `error.message` from the worker, so SQLSTATE codes, `detail`, `constraint` and `position` are lost. The constraint grader needs the code and the error display needs the position. The protocol is about 150 lines, keeps every error field, and uses a Web Lock so two tabs never open the same IndexedDB database. |
| 4 | Repository `data-systems-mastery` | Repository `justfadhul/postgres-fadhul`, site at `/postgres-fadhul/` | The repository already existed. Renaming later needs one change: `BASE_PATH` (or the default in `vite.config.ts` and `playwright.config.ts`). The npm package is still called `data-systems-mastery`. |
| 5 | Evaluate `@electric-sql/pglite-repl` before writing `\d` helpers | Do not adopt it; use its describe engine (`psql-describe`) directly in Milestone 1 | `pglite-repl` brings React 19, `@uiw/react-codemirror`, two themes and `pglite-react`, has no mobile key row and talks to `PGliteWorker` (problem 3). The `\d` logic it uses comes from `psql-describe`, which we can call on our own CodeMirror 6 editor. To be proven with a test in Milestone 1. |
| 6 | Module 6 is Browser tier if the spike passes | Browser tier, with one adjustment | The spike passed: roles, `SET ROLE`, grants, column privileges and row-level security all work. PGlite has one connection, so the policy grader switches with `SET ROLE` rather than logging in as each role. That tests the same policies. Anything about logins themselves (passwords, `pg_hba.conf`) becomes an optional Codespace exercise. |
| 7 | Start in Plan mode and wait for approval | The plan is written here and Milestone 0 is built, then work stops | The learner asked for the brief to be executed in this session. The stop after Milestone 0, for approval of spike results and tier changes, still holds. |
| 8 | (Not in the brief) | Ask the learner to add the site to the Home Screen | Safari can delete IndexedDB data for a website that has not been used for 7 days. Home Screen web apps are exempt. Progress also has JSON export and import (Milestone 1), with a reminder after each module. |

## Architecture

```
app/            Vite + React + TypeScript platform (hash routes, PWA)
  src/db/       PGlite worker, worker protocol, engine client
  src/spikes/   Milestone 0 spike suite (also used by tests/spikes)
  src/pages/    Course map, resources, engine check (+ workbench, lessons, exams later)
content/        Syllabus, resources, datasets; from M1 lessons (MDX) and question banks
labs/           Codespace labs: scaffolding + tests, never solutions
tests/          Node tests (spikes now; graders and content runners later)
e2e/            Playwright: WebKit iPhone 360/390, Chromium desktop and 360
scripts/        Link checker, bundle size checker
.devcontainer/  Node LTS, Go, PostgreSQL 18, Docker-in-Docker
.github/        CI (check, e2e, deploy to Pages), devcontainer build
```

- **Static only.** GitHub Pages, deployed by GitHub Actions from the default branch after `check`
  and `e2e` pass. No backend, no keys, no analytics.
- **First load.** React, the router and the shell: 77 KB gzipped (budget 150 KB). Lessons render
  without the engine.
- **Engine.** PGlite 0.5.8, which is PostgreSQL 18.3, the same major version as the devcontainer.
  It runs in a module Web Worker and is stored in IndexedDB (`idb://`). OPFS is avoided because
  it fails in Safari. It loads only when a workbench opens, after showing the download size.
  Requests are queued: PGlite has one connection.
- **Offline.** `vite-plugin-pwa` (Workbox) precaches the shell. Engine files (worker, `.wasm`,
  `.data`, extensions) are cached on first use (`CacheFirst` on hashed `/assets/`), so visitors who
  never open the workbench do not download them.
- **State.** One storage module (`app/src/storage/`, Milestone 1) over IndexedDB, with these
  stores: `progress`, `answers`, `drafts`, `examAttempts` and `settings`. Each record carries
  `schemaVersion`. Export and import produce one JSON file. The learner's database lives in a
  separate PGlite IndexedDB database and can be reset to the seeded dataset at any time. Theme is
  the one per-device setting kept in `localStorage`.
- **Dataset.** Generated in the page by SQL (`content/datasets/clinic.ts`, `generate_series` with
  a fixed seed), so it costs no download. Sizes: tiny (tests), small, standard (20 facilities,
  10,000 patients, 100,000 visits) and large (250,000 visits).
- **Testing.** Vitest runs in Node against real PGlite for spikes, graders and content: every SQL
  block and reference solution runs. Playwright runs WebKit at 360 and 390 px plus Chromium. CI
  also builds the devcontainer and runs `make check LAB=env-check` inside it.

## The workbench (Milestone 1)

- CodeMirror 6 (`@codemirror/lang-sql`, PostgreSQL dialect) at 16 px. The editor is loaded with
  the workbench, not the shell.
- Run, Explain (`EXPLAIN (ANALYZE, BUFFERS)` shown as an indented tree and as raw text), Reset
  (re-seed), and `version()` shown in the header.
- Results: a table inside its own horizontal scroller, row count and time. Errors show
  PostgreSQL's message, SQLSTATE, detail and hint, with the error position underlined in the
  editor.
- psql helpers `\d`, `\dt`, `\di`, `\dv`, `\df`, `\dn`, `\du` through `psql-describe`, with a
  fallback to our own catalogue queries for anything it gets wrong in PGlite.
- A key row above the iOS keyboard (`( ) ; * , ' = _`, Tab, Run), positioned with
  `visualViewport`, all keys at least 44 px.
- SQL blocks in lessons open in the workbench with the block's text.

## Graders (Milestones 1 to 4)

All graders run in the same worker, inside a transaction or a throwaway schema so the learner's
database is untouched. They return a list of human-readable findings, not just a score.

- **Result:** run reference and learner query; compare column count, then rows as multisets
  (or sequences when `ordered: true`). Values are normalised (numeric precision, timestamps to
  UTC, NULL as its own value).
- **Constraint:** apply the learner's schema, then run each attack; each must fail with the
  expected SQLSTATE class (`23xxx`). Valid statements must succeed, so a schema that rejects
  everything does not pass.
- **Plan:** `EXPLAIN (ANALYZE, BUFFERS, FORMAT JSON)`, then check node types, index names, join
  type and a bound on shared buffers. Never milliseconds.
- **Policy:** for each role, `SET ROLE` and the `app.*` settings, then check visible rows and
  refused actions (SQLSTATE `42501`).

Each challenge ships `mustPass` and `mustFail` answers that the content tests run. The
`grader-breaker` agent adds more.

## Content model

```
content/
  syllabus.ts                       module outlines (exists)
  resources.ts                      free sources, link-checked (exists)
  datasets/clinic.ts                synthetic dataset generator (exists)
  types.ts                          Lesson, QuickCheck, Challenge, Assignment, ExamBank types (M1)
  modules/m01-sql-fluency/
    module.ts                       lesson order, assignment, checklist ids
    lessons/01-joins.mdx            prose + <SqlBlock> + <QuickCheck> + <Diagram>
    checks.ts                       quick checks (multiple choice, predict-the-output)
    challenges.ts                   graded challenges with mustPass/mustFail
    assignment.ts                   the module lab as graded tasks (e.g. the 30 reports)
  exams/phase-1.ts                  bank of at least twice the exam size; mix of MCQ,
                                    practical SQL and written answers with rubrics
```

- IDs are stable strings (`m01-c07-latest-visit`), because progress is keyed by them.
- Validation happens at build and test time. `content.test.ts` checks the shape, runs every
  `<SqlBlock>` and every reference solution against PGlite, and checks that each bank is at least
  twice its exam's size. Lesson MDX is compiled at build time, so a broken lesson fails the build.
- Written answers have a rubric for self-marking and a "Copy for review" button that copies the
  question, answer and rubric for pasting into a Claude chat.

## Exams (Milestone 3)

The deadline is stored as a wall-clock time, so closing the tab does not stop the clock. Answers
autosave to IndexedDB on every change, and the attempt resumes where it was left. Questions are
drawn by a seeded shuffle from the bank. The pass mark is 70%. After submission a review shows
every question, the learner's answer, the correct answer and the explanation.

## Codespace labs (Milestones 3 to 6)

Every lab page has the tier label, an "Open in Codespaces" button
(`https://codespaces.new/justfadhul/postgres-fadhul?quickstart=1`), steps, and a reminder to stop
the codespace. `make check LAB=<id>` runs the lab's tests and prints a completion code: a short
hash of the lab id and a fixed salt, which the site checks offline. That is a convenience, not
security. Labs ship tests and scaffolding only. For the Go engine, the CLI contract is
`put <key> <value>`, `get <key>`, `delete <key>`, `scan <from> <to>`, one command per line on
stdin, with line-based responses. The crash harness sends writes, records which were
acknowledged, runs `kill -9` at random moments 200 times, and checks that every acknowledged
write survives and scans stay ordered. The checker is validated against a throwaway
implementation that is never committed.

## Milestones

| # | Scope | Stop for |
| --- | --- | --- |
| 0 | Scaffold, Claude Code setup, devcontainer, CI, Pages deploy of the shell, spike report | Approval of spike results and tier changes (**now**) |
| 1 | Storage module, export/import, workbench, lesson reader (MDX), quick checks, result grader, course map with progress, PWA polish. Module 1 complete end to end: lessons, quick checks, challenges, the 30-report assignment, "latest visit three ways" | The learner testing on his own iPhone |
| 2 | Modules 2 and 3, constraint and plan graders | Review |
| 3 | Module 4 (browser parts plus Codespace two-session labs with recorded transcripts), lab framework and completion codes, exam engine, Phase 1 exam | Review |
| 4 | Modules 5 to 7, policy grader, Phase 2 exam | Review |
| 5 | Module 8: guide, stage checkers, crash-test harness, Phase 3 exam | Review |
| 6 | Modules 9 to 11, Phase 4 exam, final exam | Review |
| 7 | Optional mod (only in a terminal or desktop session on 2.1.287 or later), polish, accessibility pass | Handover |

## Risks and options

- **Engine size (5.9 MB).** Before Milestone 1, check how GitHub Pages actually serves `.wasm` and
  `.data` (the deploy job prints this). If Pages does not compress them, the download is about
  16 MB. The fix would be to ship pre-compressed copies and decompress them in the worker with
  `DecompressionStream`; PGlite accepts `pgliteWasmModule` and `fsBundle`. Further savings:
  prebuild an initialised data directory so first start skips `initdb` (it costs about 3 s), and
  load `btree_gist` only for Module 2.
- **iOS memory.** The large dataset (250,000 visits) works in desktop emulation. A real iPhone
  may hit memory limits. The engine check page lets the learner measure this on his phone; the
  standard size is the default until then.
- **Safari storage eviction.** Covered by Home Screen install, `navigator.storage.persist()`,
  export reminders and a "restore from file" path.
- **WebKit emulation is not iOS Safari.** Every milestone lists what to check by hand on the
  phone.
- **Codespace hours.** 2-core machine, a stop reminder on every lab page, and labs sized to finish
  in one or two sittings.
