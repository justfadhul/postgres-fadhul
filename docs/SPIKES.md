# Milestone 0 spike report

Every spike is a test, not a claim. One suite (`app/src/spikes/suite.ts`) runs in two places:

- **Node:** `npx vitest run tests/spikes` (in-memory PGlite).
- **Browser:** `e2e/spikes.spec.ts` drives the in-app **Engine check** page (`#/spikes`). PGlite
  runs in a Web Worker and persists to IndexedDB.

Engine: **PostgreSQL 18.3 (PGlite 0.5.8)**, 32-bit WebAssembly. The devcontainer runs
PostgreSQL 18, so browser and Codespace use the same major version.

The figures below come from CI run
[37732615910](https://github.com/justfadhul/postgres-fadhul/actions/runs/37732615910) on GitHub's
`ubuntu-latest` runners, dated 8 October 2026. WebKit is Playwright's WebKit with an iPhone 13
profile (390 × 664). **It is not iOS Safari on a real iPhone**, so a phone will be slower; see
"What to check on your iPhone" below.

## Results

| # | Spike | Result | Evidence |
| --- | --- | --- | --- |
| 1 | PGlite loads, runs and persists in WebKit at an iPhone viewport | **Pass** | Cold start (download, `initdb`, start) 4.4 s. A marker row and the 100,000-visit dataset survived a page reload. Reopening from IndexedDB took 2.9 s. |
| 2 | Largest seeded dataset under about 10 s and stable | **Pass, standard is the default; large also passed** | Standard (20 facilities, 10,000 patients, 100,000 visits, 100,000 prescriptions): seeded in 4.6 s in WebKit (2.1 s of SQL plus counts and queries). Large (40 facilities, 25,000 patients, 250,000 visits): 8.5 s in WebKit. Three representative queries afterwards (`DISTINCT ON`, a window over a join, an aggregate join) ran without error: about 1.0 s on standard and 2.0 s on large. |
| 3 | `btree_gist` and exclusion constraints (Module 2) | **Pass** | `EXCLUDE USING gist (clinician_id WITH =, during WITH &&)` rejects an overlapping booking with SQLSTATE `23P01`. It accepts a back-to-back booking, and the same slot for another clinician. |
| 4 | `CREATE ROLE`, `SET ROLE`, row-level security (Module 6) | **Pass, so Module 6 stays Browser tier** | `SET ROLE` switches `current_user`. A policy using `current_setting('app.facility_id')` limits a clinician to their facility's rows. The audit log accepts `INSERT`, but `UPDATE` and `DELETE` fail with `42501`. A column privilege hides `notes` from a pharmacist. `RESET ROLE` restores the session. |
| 5 | `EXPLAIN (ANALYZE, BUFFERS)` gives usable plans (Module 3) | **Pass** | JSON plans include `Node Type`, `Actual Rows`, `Shared Hit Blocks` and `Index Name`. Before indexing: `Seq Scan`, 320 shared hits. After `CREATE INDEX`: `Bitmap Heap Scan > Bitmap Index Scan on visits_patient_idx`, 10 shared hits. Text plans include `actual time` and `Buffers:` lines. |

### Timings by browser (CI, milliseconds)

| Step | WebKit iPhone 390 | Chromium desktop | Chromium 360 |
| --- | --- | --- | --- |
| Cold start (download + `initdb` + start) | 4,396 | 3,760 | 3,880 |
| Seed standard (100,000 visits) | 4,563 | 3,339 | 2,489 |
| Seed large (250,000 visits) | 8,469 | 6,799 | 5,448 |
| Reopen from IndexedDB after reload | 2,897 | 2,213 | 1,626 |
| Exclusion / RLS / EXPLAIN spikes | 975 / 1,535 / 1,307 | 421 / 344 / 449 | 429 / 316 / 426 |

The Node run in the build sandbox gave similar numbers: standard seeded in 2.4 s, large in 6.1 s.

## Findings that change the design

1. **PGliteWorker drops error codes.** Through PGlite's own worker wrapper, a constraint
   violation reached the page as a plain `Error` with only a message: no SQLSTATE, `detail` or
   `constraint`. The first browser run of spikes 3 and 4 failed because of this. The fix is a
   small worker protocol of our own (`app/src/db/protocol.ts`) that copies every PostgreSQL
   error field. A unit test (`app/src/db/protocol.test.ts`) and the browser spikes now prove it.
2. **The engine is about 5.9 MB gzipped, not under 3 MB.** Measured from the build: `pglite.wasm`
   3.36 MB, `pglite.data` 2.09 MB, the worker 0.14 MB, `initdb.wasm` 0.14 MB and `btree_gist`
   0.02 MB. The site states this figure before downloading, and `npm run check:size` fails if it
   drifts by more than 10%. Whether GitHub Pages compresses `.wasm` and `.data` on the wire is not
   yet known: the deploy job prints it once Pages is switched on. If Pages does not, the transfer
   is about 16 MB and Milestone 1 should ship pre-compressed files (see PLAN.md, Risks).
3. **First start runs `initdb`** (about 2 to 3 s of the cold start). Reopening skips it. Shipping
   a pre-initialised data directory could remove it, at the cost of a slightly larger download.
4. **Storage figures from WebKit look unreliable.** `navigator.storage.estimate()` reported 285 to
   362 MB in Playwright's WebKit, against 27 to 54 MB in Chromium for the same data. Treat the
   number as approximate until it is checked on a real iPhone.
5. **`navigator.storage.persist()` returned false** in every emulated browser. Safari may grant
   it to a site added to the Home Screen. Export and import (Milestone 1) is the real safety net.

## Tier decisions proposed for approval

- Module 2 (exclusion constraints): **Browser**, confirmed.
- Module 3 (`EXPLAIN (ANALYZE, BUFFERS)`): **Browser**, confirmed. Plan graders check plan shape
  and buffers, never milliseconds.
- Module 6 (roles and RLS): **Browser**, confirmed. The policy grader uses `SET ROLE` because
  PGlite has one connection. Login-level topics (passwords, `pg_hba.conf`) become an optional
  Codespace exercise.
- Module 4 two-session labs: **Codespace**, as the brief says. PGlite has one connection.
- Default dataset: **standard** (100,000 visits). Large stays available for Module 3's
  performance work if it holds up on a real iPhone.

## What to check on your iPhone

Open the deployed site in Safari, go to **Engine check**, and use Wi-Fi the first time:

1. Tap **Download engine and run checks**. All six results should say Pass.
2. Tap **standard (100,000 visits)** and note the time.
3. Close Safari completely, reopen the page, and tap **Check saved data**. It should say the
   dataset survived the reload.
4. Optionally, try **large (250,000 visits)**. If Safari reloads the page or shows an error, that
   is the memory limit; tell me.
5. Tap **Copy results** and paste them back to me. They include the device, viewport and every
   timing.
6. Add the site to the Home Screen (Share → Add to Home Screen), open it from there, and repeat
   step 3.
