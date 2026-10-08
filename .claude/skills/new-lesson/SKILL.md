---
name: new-lesson
description: Template, conventions and checklist for writing a lesson in content/. Use when adding or rewriting a lesson for any module.
---

# New lesson

A lesson is 10 to 15 minutes of reading on a phone, for a medical doctor who builds hospital
software. Write it yourself in plain British English; never copy or closely paraphrase text from
books, courses or documentation. Link to free sources instead.

## Where it goes

- Text: `content/modules/<mNN>/lessons/<nn>-<slug>.mdx` (no frontmatter, no H1: the title comes
  from the lesson's entry in `content/modules/<mNN>/index.ts`).
- Quick checks: `content/modules/<mNN>/checks.ts` (type `QuickCheck` in `content/types.ts`).
- Run `npx vitest run content/modules.test.ts` until it passes. A failing lesson does not ship.

## The data

The synthetic clinic dataset is in `content/datasets/clinic.ts`: read it before writing. Tables
in schema `clinic`: `facilities` (with `referral_facility_id`), `clinicians`, `patients`,
`diagnoses`, `visits`, `drugs`, `prescriptions`, `stock`. Every session starts with
`SET TIME ZONE 'Africa/Kampala'; SET search_path = clinic, public;`, so lessons use unqualified
table names (`visits`, not `clinic.visits`) and timestamps print in Kampala time (+03). The
learner's default dataset is "standard" (20 facilities, 10,000 patients, 100,000 visits); the
tests use "small" (10 facilities, 2,000 patients, 20,000 visits), same shape. Data is generated,
so never state a specific count or name as fact in prose; prefer "your result will show…" or
relative claims. `verify` is only for facts that do not depend on the data (for example
`SELECT NULL = NULL`).

## MDX conventions

- `## Heading` sections. Short paragraphs. Define each term in **bold** the first time.
- A fenced block marked `sql` is **runnable**: the learner can run it, and the tests run it.
  Each block must run on its own (blocks run in separate rolled-back transactions). Keep result
  sets small (`LIMIT`), since a phone shows them.
- When the prose says what a block does, make the test hold it to that with a first-line comment:
  `-- Expect error 42803` (must fail with that SQLSTATE), `-- Expect no rows` or `-- Expect 2 rows`.
  Show common mistakes this way, so the learner can run them and see the real error.
- A fenced block marked `text` is shown as-is (output, transcripts). Never write expected output
  from memory: only show output you can justify, and prefer "run it and look at…".
- `<QuickCheck id="m01-qc-05-1" />` places a quick check (2 to 4 per lesson, after the idea they test).
- `<Note term="Window">One or two sentences.</Note>` is a margin note on wide screens and a
  callout on phones. Use for definitions and asides; 0 to 3 per lesson.
- MDX treats `{`, `}` and `<` in prose as code. In prose, put SQL fragments in backticks
  (`` `a < b` ``), or write "less than". Do not use raw `<` or `{` outside code.
- Links: only real, free pages. PostgreSQL docs as `https://www.postgresql.org/docs/current/<page>.html`.
  CI checks every link; a dead link fails the build.

## Shape of a lesson

1. One short paragraph: the clinic problem this solves and what the learner will be able to do.
2. The idea, built up in 2 to 4 sections, each with a runnable example on the clinic data.
3. A common mistake, shown and explained: a runnable block marked `-- Expect error XXXXX` or with
   its row count, so the test proves what the prose says.
4. Where behaviour depends on version or settings, say so, including any PGlite difference
   (PGlite is PostgreSQL 18 in WebAssembly, single connection).
5. `## Free sources`: 1 to 3 links.

## Quick checks

- `kind: 'choice'` for concepts, `kind: 'predict'` with `sql` for "what does this return?".
- Every explanation says why the right answer is right and why the tempting wrong one is wrong.
- Facts about PostgreSQL behaviour get a `verify: { sql, expect }`. `expect` is the output with rows
  joined by "; ", values by ", " and NULL written as NULL (for example `'t; NULL'`).

## Checklist

- [ ] Original wording, British English, terms defined on first use, 10 to 15 minutes.
- [ ] `npx vitest run content/modules.test.ts` passes (MDX compiles, every SQL block runs, checks verified).
- [ ] Two-session behaviour is a transcript recorded from real PostgreSQL 18 in the devcontainer.
- [ ] Synthetic clinic data only.
- [ ] `fact-checker` has reviewed the module; findings fixed or listed in docs/PROGRESS.md.
