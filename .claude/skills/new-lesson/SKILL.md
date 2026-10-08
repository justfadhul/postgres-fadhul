---
name: new-lesson
description: Template and checklist for writing a new lesson in content/. Use when adding or rewriting a lesson for any module.
---

# New lesson

A lesson is 10 to 15 minutes of reading on a phone. Write it yourself in plain British English; never copy text from books, courses or documentation. Link to free sources instead.

## Where it goes

`content/modules/<module-id>/lessons/<nn>-<slug>.mdx`, with an entry in that module's `module.ts` lesson list. (Milestone 1 creates the first module; follow its layout.)

## Template

```mdx
---
title: Short, concrete title
minutes: 12
tier: B          # B = browser workbench, C = Codespace lab, B+C = both
---

One paragraph: what problem this solves in a clinic system, and what you will be able to do after.

## The idea
Explanation. Define each term the first time it appears.

## Worked example
Clinic-domain example on the seeded dataset (synthetic data only).

<SqlBlock id="unique-id">
SELECT ...
</SqlBlock>

<Diagram /> only where a picture explains better than text.

<QuickCheck id="..." />  (2 to 4 per lesson: multiple choice or predict-the-output, every answer explained)

## Free sources
- [PostgreSQL docs: exact page](https://www.postgresql.org/docs/current/...)
```

## Checklist (all must be true before the lesson ships)

- [ ] Readable before PGlite downloads: no content depends on the engine to render.
- [ ] Every runnable SQL block and every reference solution runs in the content tests against PGlite (`npx vitest run content`). A failing lesson does not ship.
- [ ] Two-session behaviour is shown as a transcript recorded from real PostgreSQL 18 in the devcontainer, never written from memory.
- [ ] Version- or settings-dependent behaviour is labelled, including any PGlite difference.
- [ ] Every link is real and passes `npm run check:links` in CI. No invented URLs.
- [ ] Examples use only the synthetic clinic dataset. No real patient data.
- [ ] Wide tables and plans are inside a scroll container.
- [ ] `fact-checker` has reviewed the module; findings fixed or listed in docs/PROGRESS.md.
