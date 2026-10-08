# Build brief: Data Systems Mastery study platform

You are building a self-study web platform for one learner. Read this whole brief before doing anything. Your first action is to save it verbatim as `docs/BRIEF.md` so later sessions can re-read it.

## 1. Who it is for and what it does

The learner is a medical doctor who builds hospital software in Uganda. He is working through an 11-module, roughly 220-hour course on databases and backend systems (syllabus in Appendix A). He studies mostly on an iPhone, often on a slow or metered connection.

The platform must let him:

1. Read each module's lessons.
2. Run real SQL against a real PostgreSQL engine inside the page.
3. Do auto-graded challenges and assignments.
4. Sit timed exams.
5. Track progress through the course.

## 2. Hard constraints

These are not negotiable. If one blocks you, stop and say so instead of working around it.

- **Free only.** No paid service, paid API, paid book or trial that expires. No API keys in the app. Hosting, CI and every dependency must be free for a personal account.
- **No backend.** A static site. All state lives in the browser, with export and import. This keeps it free and makes it work offline.
- **iPhone first.** Design and test at 360 to 430 px wide before desktop. Everything must work in iOS Safari.
- **Be honest about what a browser cannot do.** Do not fake a lab. If something needs a real operating system, send the learner to a GitHub Codespace (section 5).
- **Original content.** Write the lessons yourself. Do not reproduce text from books, courses or documentation. Link to free sources instead.
- **Synthetic data only.** Examples use a clinic domain (patients, visits, prescriptions, stock). Never use or request real patient data.

## 3. How to start

1. Stay in Plan mode. The repo is empty, so there is nothing to explore.
2. Produce a plan covering architecture, the spike list in section 5, the content model, and milestones (section 10). Say where you disagree with this brief and why.
3. Wait for approval. After approval, do Milestone 0 only, then stop.

Work in milestones. At the end of each, update `docs/PROGRESS.md` (what is done, what is next, known issues, decisions made) and stop for review. A later session will start from `docs/BRIEF.md` and `docs/PROGRESS.md` with no memory of this one.

## 4. Architecture defaults

Use these unless your plan gives a concrete reason for something else.

- **Repo:** one public repository, suggested name `data-systems-mastery`. It must be public because GitHub Pages on a free account only serves public repositories. `app/` holds the platform, `labs/` holds the Codespace labs, `content/` holds lessons and question banks.
- **App:** Vite, React, TypeScript. Lessons as MDX. Question banks as typed data files validated at build time.
- **Editor:** CodeMirror 6. Do not use Monaco; it does not support mobile browsers.
- **Database in the page:** PGlite (PostgreSQL compiled to WebAssembly), run in a Web Worker, persisted with its IndexedDB filesystem. PGlite's OPFS filesystem does not work in Safari.
- **Offline:** an installable PWA. Cache lessons and the PGlite bundle after first load.
- **Hosting:** GitHub Pages, deployed by GitHub Actions. Handle the `/repo-name/` base path in the router and the service worker scope.
- **State:** progress, answers and drafts in IndexedDB behind one small storage module. Treat browser storage as losable: provide export to and import from a JSON file, and remind the learner to export after each module.

## 5. The code workbench

The learner asked for an in-platform codespace. Give him two tiers and label every exercise with its tier.

### Browser tier

A SQL workbench that runs entirely in the page:

- Editor, Run button, results table, error display with PostgreSQL's own message, and an `EXPLAIN` view.
- A reset button that restores the seeded dataset.
- psql-style helpers such as `\d` and `\dt`. Evaluate `@electric-sql/pglite-repl` before writing your own.
- A key row above the iOS keyboard with `( ) ; * , ' = _`, Tab and Run.
- Show the engine's `version()`. PGlite may trail the current PostgreSQL release, so note any behaviour difference in the lesson where it matters.

PGlite is single user and single connection. Two concurrent sessions are impossible in the page, so two-session transaction labs belong in the Codespace tier.

### Codespace tier

Labs that need a real machine: concurrent sessions, write-ahead log archiving and recovery, replication, the Node API lab, and the Go storage engine.

- Add a devcontainer at the repo root with Node LTS, Go, PostgreSQL 18 and Docker-in-Docker.
- Default to a 2-core machine. A free personal account gets 120 core-hours and 15 GB a month, which is 60 hours on 2 cores. Tell the learner on every lab page to stop the Codespace when finished.
- Each lab page has an "Open in Codespaces" button, step-by-step instructions, and a checker: `make check LAB=<id>` runs the lab's tests and prints a short completion code. The platform accepts the code offline to mark the lab done. This is a convenience for an honest learner, not security.
- Labs ship tests and scaffolding only, never solutions. For the Go storage engine, define a small command-line contract (`put`, `get`, `delete`, `scan`) so the checker and crash test can drive his binary as a black box. Validate the checker against a throwaway implementation that you do not commit.

### Spikes to run in Milestone 0

Prove each with a test before designing around it, and report the results:

1. PGlite loads, runs and persists in WebKit at an iPhone viewport.
2. The largest seeded dataset that loads in under about 10 seconds and stays stable. Start at 20 facilities, 10,000 patients and 100,000 visits.
3. `btree_gist` and exclusion constraints work (Module 2).
4. `CREATE ROLE`, `SET ROLE` and row-level security policies work (Module 6). If not, Module 6 labs move to the Codespace tier.
5. `EXPLAIN (ANALYZE, BUFFERS)` returns usable plans (Module 3).

## 6. Learning features

- **Lessons.** Several short lessons per module, readable in 10 to 15 minutes each. Explanation, worked example, runnable SQL blocks that open in the workbench, a diagram where a picture explains better than text, then links to free sources. Lessons must be readable before PGlite downloads.
- **Quick checks.** A few questions inside each lesson: multiple choice and predict-the-output. Explain every answer.
- **Challenges.** Auto-graded tasks. Build these grader types:
  - Result grader: runs the learner's query and a reference query and compares result sets, order-sensitive only when the task demands an order.
  - Constraint grader: runs "attack" statements against the learner's schema; each must fail with a constraint error.
  - Plan grader: checks plan shape (node types, index used, buffers read). Never grade on milliseconds; phones vary too much.
  - Policy grader: connects as each role and checks what is visible and what is refused.
- **Assignments.** One per module, taken from that module's lab in Appendix A. The module's "done when" list is its completion checklist.
- **Exams.** One per phase and a final. Timed, autosaved, resumable, drawn at random from a bank at least twice the exam's size. Mix of multiple choice, practical SQL graded automatically, and short written answers. Pass mark 70%. After submission, show a review with explanations.
- **Written answers.** No paid API. Show the rubric for self-marking, and add a "Copy for review" button that copies the question, the answer and the rubric so he can paste them into a Claude chat.
- **Progress.** A course map showing each module's state, time spent, scores, and what to do next.

Answers are visible in a static site's source. That is acceptable here; do not spend effort hiding them.

## 7. Content rules

- Every runnable SQL block and every reference solution is executed by a test against PGlite in Node. A lesson that fails this test does not ship.
- Where a lesson shows two-session behaviour, record the transcript from real PostgreSQL in the devcontainer and embed it. Do not write expected output from memory.
- State facts you can demonstrate. Where behaviour depends on version or settings, say so.
- Run a link checker in CI. Replace dead links; do not invent URLs.
- British English. Plain language. Define each term on first use.
- Use the free resources in Appendix B. The original course cited two paid books; this build must not depend on them.

## 8. Mobile requirements

- Layout works from 360 px with no horizontal page scroll. Wide tables and plans scroll inside their own container.
- Tap targets at least 44 px. No hover-only controls.
- Inputs and the editor use at least 16 px text, so iOS does not zoom on focus.
- Keep the Run button and key row visible above the on-screen keyboard; use the `visualViewport` API.
- Light theme by default, with a dark option. High contrast, system fonts, no web-font downloads.
- Small first load: aim for under 150 KB of gzipped JavaScript before PGlite. Load PGlite only when the workbench first opens, and show its size (under 3 MB gzipped) before downloading.
- Respect reduced-motion settings. Use semantic HTML and labelled controls.

## 9. Claude Code setup to create in this repo

The learner wants to try Claude Code's modes and mods. Set up the following in Milestone 0 (the mod comes later) and explain each choice in `docs/CLAUDE_CODE_SETUP.md`, in plain language, including how he switches modes from his phone. Check `claude --version` and the current docs at code.claude.com before writing config; syntax changes between versions.

### Permission modes

- Planning: Plan mode.
- Building: Auto mode if the session offers it, otherwise Accept edits.
- Never use bypass permissions.
- In `.claude/settings.json` set `permissions.defaultMode` to `acceptEdits`. A project file cannot set `auto`; that value is ignored there.

### `.claude/settings.json`

Start from this and adjust to the tools you actually use. Keep rules narrow; Auto mode drops broad allow rules.

```json
{
  "permissions": {
    "defaultMode": "acceptEdits",
    "allow": [
      "Bash(npm run *)",
      "Bash(npm install *)",
      "Bash(npx vitest *)",
      "Bash(npx playwright *)",
      "Bash(go test *)",
      "Bash(go vet *)",
      "Bash(make check *)",
      "Bash(git status)",
      "Bash(git diff *)",
      "Bash(git add *)",
      "Bash(git commit *)"
    ],
    "ask": ["Bash(git push *)", "Bash(gh *)"],
    "deny": ["Read(./.env)", "Read(./.env.*)", "Bash(git push --force *)"]
  }
}
```

### `CLAUDE.md`

Under 200 lines. Include the commands, a one-paragraph architecture summary, the content rules from section 7, the mobile rules from section 8, the definition of done from section 11, and this rule: never weaken or delete a test to make it pass.

Add `labs/CLAUDE.md` with one instruction for study sessions: act as a tutor; explain, review and give hints, but do not write solution code for lab exercises.

### Subagents in `.claude/agents/`

- `fact-checker`: read-only plus web fetch. Checks each lesson's claims against PostgreSQL documentation and the sources in Appendix B. Reports discrepancies; never edits.
- `mobile-qa`: runs the mobile end-to-end tests, reviews screenshots at 360 and 390 px wide, and reports layout and keyboard problems.
- `grader-breaker`: tries to defeat each grader. A plausible wrong answer must fail, and a correct answer written a different way must pass.

Run `fact-checker` and `grader-breaker` on every module before calling it done.

### Skills in `.claude/skills/`

- `new-lesson`: the lesson template and checklist.
- `new-challenge`: the challenge format, grader choice and required tests.
- `milestone-check`: runs `npm run check` and the mobile tests, then updates `docs/PROGRESS.md`.

### Output style

Do not commit an `outputStyle`; build sessions should use the default. In `docs/CLAUDE_CODE_SETUP.md`, tell the learner to run `/output-style Learning` in the terminal when he studies in `labs/`. That style asks him to write the key code himself.

### A mod (optional, last)

Mods are plugins of JavaScript or TypeScript hooks that run inside Claude Code. They need version 2.1.287 or later, they draw only in the terminal and the desktop Code tab, and they draw nothing in cloud sessions. They run unsandboxed with full permissions.

Build it in Milestone 7, and only if that session is a terminal or desktop session on a new enough version:

- Load the `plugin-authoring` skill and follow it.
- Build one small mod: a status-line entry showing the current milestone and whether the last `npm run check` passed, plus a `/milestone` command that prints the next unfinished item from `docs/PROGRESS.md`.
- No network calls. No pane; panes need a wide terminal and he works on a phone.
- Run `claude plugin validate` and write at least one test.

Otherwise skip it and say why in the setup document.

### Hooks

Optional. Do not rely on a hook for correctness; `npm run check` is the gate.

## 10. Milestones

Stop at the end of each one.

| # | Scope | Stop for |
| --- | --- | --- |
| 0 | Repo scaffold, Claude Code setup, devcontainer, CI, Pages deploy of an empty shell, spike report | Approval of spike results and any tier changes |
| 1 | Workbench, lesson reader, quick checks, result grader, progress, export and import, PWA. Module 1 complete end to end | The learner testing on his own iPhone |
| 2 | Modules 2 and 3, with the constraint and plan graders | Review |
| 3 | Module 4, the Codespace lab framework and completion codes, the exam engine, the Phase 1 exam | Review |
| 4 | Modules 5 to 7, the policy grader, the Phase 2 exam | Review |
| 5 | Module 8: guide, stage checkers, crash-test harness, the Phase 3 exam | Review |
| 6 | Modules 9 to 11, the Phase 4 exam, the final exam | Review |
| 7 | The optional mod, polish, accessibility pass | Handover |

Milestone 1 is a vertical slice on purpose. Do not write content for later modules until he has used Module 1 on his phone and said what to change.

## 11. Definition of done, every milestone

- `npm run check` passes: type check, lint, unit tests, content tests, link check.
- End-to-end tests pass in WebKit at an iPhone viewport and in desktop Chromium. WebKit emulation is not real iOS Safari, so list anything the learner should check by hand.
- The site is deployed and the URL is in `docs/PROGRESS.md`.
- Works offline after first load, for everything in the browser tier.
- Each new module has been through `fact-checker` and `grader-breaker`, with their findings fixed or listed.
- `docs/PROGRESS.md` is current.

Report failures plainly. If a test fails or a spike does not work, say so and propose options; do not hide it or mark the item done.

## 12. Out of scope

Accounts, sync between devices, a server, AI features inside the app, in-browser Go, analytics, payments, and hiding answers. Raise any of these as a suggestion in `docs/PROGRESS.md`; do not build them unasked.

---

## Appendix A: Syllabus

Tier: B = browser workbench, C = Codespace lab, B+C = both.

**Phase 1: Use the database well**

1. **SQL fluency** (15 h, B). Joins, aggregation, subqueries and common table expressions including recursive ones, window functions, NULL and three-valued logic, dates and time zones. Lab: 30 reporting queries over the seeded clinic dataset. Done when: all 30 pass; "latest visit per patient" written three ways (`DISTINCT ON`, window function, lateral join) with the fastest identified.
2. **Data modelling and integrity** (15 h, B). Keys including UUIDv7, normalisation and when to denormalise, constraints including exclusion constraints, type choices (`timestamptz`, `numeric`), append-only history, migrations. Lab: an outpatient schema where a clinician cannot be double-booked, stock cannot go negative, every dispensed item references a prescription, and clinical records are never hard-deleted. Done when: 12 attack statements are all rejected by constraints.
3. **Indexes and query performance** (20 h, B). B-trees, composite column order, covering, partial and expression indexes, GIN, `EXPLAIN (ANALYZE, BUFFERS)`, join algorithms, keyset pagination, the write cost of indexes. Lab: fix 10 slow queries; measure insert cost with 0, 3 and 8 indexes. Done when: each query's plan improves as specified; scan type predicted correctly for 8 of 10 new queries.
4. **Transactions and concurrency** (20 h, B+C). ACID, multi-version concurrency control, isolation levels, lost update, non-repeatable read, phantom, write skew, row locks, `SKIP LOCKED`, deadlocks, optimistic concurrency, retries, idempotency keys. Lab (C): reproduce each anomaly in two sessions; solve "two pharmacists dispense the last unit" three ways; fire 50 concurrent dispenses at 10 units. Done when: exactly 10 succeed for each solution; a deliberate deadlock is found in the server log.

**Phase 2: Understand and run it**

5. **PostgreSQL internals and operations** (15 h, C). Heap pages and row versions, VACUUM and bloat, the write-ahead log, checkpoints, backups, point-in-time recovery, connection pooling, monitoring. Lab: inspect pages with `pageinspect`; create and clear bloat; archive the log, take a base backup, drop a table, restore to one minute before. Done when: the restore drill is done twice, the second time in under 30 minutes; a one-page runbook exists.
6. **Security and access control** (12 h, B if the spike passes, else C). Roles and least privilege, row-level security, SQL injection, encryption trade-offs, append-only audit logging, secrets, Uganda's Data Protection and Privacy Act, 2019. Lab: clinicians see only their facility's patients; pharmacists see prescriptions but not notes; nobody can change the audit table. Done when: 15 forbidden actions all fail.
7. **Backend architecture** (15 h, C). Transaction boundaries, idempotent endpoints, keyset pagination in an API, zero-downtime migrations, the transactional outbox, caching, integration tests, logging. Lab: a small TypeScript API with an idempotent dispense endpoint, a paginated visit list, an outbox worker for reminders, and a no-downtime column rename. Done when: retries never dispense twice; killing the worker loses and duplicates nothing.

**Phase 3: Build it yourself**

8. **Build your own storage engine** (45 h, C). In Go, typed by the learner. Stages: Go basics; append-only log with in-memory hash index; durability with `fsync`, checksums and torn-record detection; compaction; on-disk B+tree with range scans; benchmarks and write-up. Done when: 200 `kill -9` crash runs lose no acknowledged write; range scans are ordered after restart. Note in the lesson that `kill -9` simulates a process crash only, not power loss.

**Phase 4: Distribute it**

9. **Replication and distributed data** (20 h, C). Leader and follower replication, lag and stale reads, failover and split brain, sharding overview, clocks, consistency models, Raft conceptually. Lab: two PostgreSQL containers with streaming replication; measure lag; pause the replica; promote it and find a lost acknowledged write. Done when: the lost write is demonstrated and the synchronous-commit fix explained.
10. **Offline-first sync** (15 h, C). Local store with an operation log, pull by cursor and push by operation, why last-write-wins loses data, per-field merge rules, conflict-free replicated data types, tombstones, idempotent replay, schema versions. Lab: two SQLite "devices" and one PostgreSQL server; a conflict policy per table (clinical notes append-only; stock as deltas; appointment status by fixed state order; phone number last-write-wins with history). Done when: both sync orders converge; replaying a batch changes nothing.
11. **Capstone** (25 h, C). An 8 to 10 page data-layer design for a hospital platform, a working prescription-to-dispensing-to-stock slice with concurrency, access-control and sync tests, and a review of 10 ways it could lose or corrupt data.

## Appendix B: Free resources

Link to these from lessons. All were free to read when this brief was written; the link checker must confirm each.

| Resource | Use for |
| --- | --- |
| PostgreSQL documentation, https://www.postgresql.org/docs/current/ | Modules 1 to 6, the authority on behaviour |
| PostgreSQL Exercises, https://pgexercises.com/ | Module 1 practice |
| Use The Index, Luke, https://use-the-index-luke.com/ | Module 3 |
| CMU 15-445 Intro to Database Systems, https://15445.courses.cs.cmu.edu/ | Storage, indexes, transactions, recovery |
| Hermitage isolation tests, https://github.com/ept/hermitage | Module 4 |
| The Internals of PostgreSQL, https://www.interdb.jp/pg/ | Module 5 |
| PostgreSQL 14 Internals (Rogov), free PDF, https://postgrespro.com/community/books/internals | Module 5 |
| Supabase row-level security guide, https://supabase.com/docs/guides/database/postgres/row-level-security | Module 6 |
| OWASP Top Ten, https://owasp.org/www-project-top-ten/ | Module 6 |
| A Tour of Go, https://go.dev/tour/ | Module 8, stage 1 |
| Build Your Own Database, Part I (chapters 0 to 7 are free online), https://build-your-own.org/database/ | Module 8, B-tree and crash recovery |
| Operating Systems: Three Easy Pieces, chapter 42 "FSCK and Journaling", https://pages.cs.wisc.edu/~remzi/OSTEP/ | Module 8, crash consistency |
| The Bitcask paper, "A Log-Structured Hash Table for Fast Key/Value Data" | Module 8, stage 2 |
| Kleppmann, Distributed Systems lecture notes, https://www.cl.cam.ac.uk/teaching/2122/ConcDisSys/dist-sys-notes.pdf, and videos, https://www.youtube.com/playlist?list=PLeKd45zvjcDFUEv_ohr_HdUFe97RItdiB | Modules 9 and 10 |
| MIT 6.5840 Distributed Systems, lecture notes and labs, https://pdos.csail.mit.edu/6.824/ | Module 9 |
| Raft, https://raft.github.io/ | Module 9 |
| Jepsen consistency models, https://jepsen.io/consistency | Module 9 |
| Local-first software, https://www.inkandswitch.com/essay/local-first/ | Module 10 |
| crdt.tech, https://crdt.tech/ | Module 10 |
