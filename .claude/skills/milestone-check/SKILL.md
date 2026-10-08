---
name: milestone-check
description: Runs the full definition-of-done checks for a milestone (npm run check, build size, end-to-end tests) and updates docs/PROGRESS.md. Use at the end of every milestone, before stopping for review.
disable-model-invocation: true
---

# Milestone check

Run each step and record the real output. Report failures plainly; never mark an item done that did not pass.

1. `npm run check` (type check, lint, unit tests, content tests, link check). In a sandbox without network the link check prints SKIPPED; say so, and confirm it passed in CI.
2. `npm run build && npm run check:size` (first-load JS budget 150 KB gzipped; engine size figure shown to the learner within 10%).
3. `npx playwright test --project=desktop-chromium --project=mobile-chromium-360`. WebKit projects (`iphone-webkit`, `iphone-webkit-360`) run in CI; if WebKit is not installed locally, read the latest CI run instead and quote its result.
4. Confirm the latest CI run on the branch is green, the Vercel production deployment succeeded, and the "Deployed site" workflow (`node scripts/check-deployed.mjs <url>`) passed; put the site URL in docs/PROGRESS.md.
5. For each module finished in this milestone: run the `fact-checker` and `grader-breaker` agents and list their findings as fixed or open.
6. Update `docs/PROGRESS.md`:
   - **Done** (with evidence: commands and results)
   - **Next** (the next milestone's first items)
   - **Known issues** (including things to check by hand on a real iPhone)
   - **Decisions** (anything that changed the plan, with the reason)
7. Stop and ask for review. Do not start the next milestone.
