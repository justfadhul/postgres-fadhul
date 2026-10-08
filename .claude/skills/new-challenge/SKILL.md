---
name: new-challenge
description: Format for a new auto-graded challenge, how to choose the grader, and the tests every challenge needs. Use when adding a challenge, assignment task or practical exam question.
---

# New challenge

## Pick the grader

| Task asks the learner to… | Grader | Passes when |
| --- | --- | --- |
| write a query | `result` (built, `app/src/grading/result.ts`) | learner rows equal reference rows (order-sensitive only if the task demands an order) |
| design a schema or constraint | `constraint` (Milestone 2) | every "attack" statement fails with the expected SQLSTATE class (23xxx) and every valid statement succeeds |
| speed up a query | `plan` (Milestone 2) | plan shape matches: node types, index used, buffers read under a bound. Never milliseconds |
| restrict access | `policy` (Milestone 4) | as each role, the visible rows and refused actions match the specification |

## Format

Challenges are `Challenge` objects (`content/types.ts`) in `content/modules/<mNN>/challenges.ts`:

```ts
{
  id: 'm01-a07',
  tier: 'B',
  title: 'Visits per facility this year',
  prompt: 'Plain-language task, as a clinic manager would ask it. Name the columns wanted, in order. Say whether order matters.',
  hints: ['A nudge, not the answer.', 'A stronger nudge.'],
  explanation: 'Shown after a pass or after giving up: the idea, and the trap.',
  grader: {
    kind: 'result',
    reference: `SELECT ...`,
    ordered: false,                 // true only if the prompt asks for an order
    requires: [{ pattern: '\\bdistinct\\s+on\\b', message: 'Use DISTINCT ON for this one.' }], // optional
  },
  tests: {
    mustPass: ['SELECT ... correct, written differently'],
    mustFail: ['SELECT ... a plausible mistake'],
  },
}
```

How the result grader compares: values as PostgreSQL text, except numeric types (integers,
`numeric`, floats), which compare by value to 6 decimal places, so `1.50` equals `1.5` only when the
column is numeric. Column count must match; column names are not compared. Timestamps print in
Kampala time. Patterns (`requires`, `forbids`) are case-insensitive regular expressions matched
against the SQL with comments and string literals removed. The grader runs the reference first,
then the learner's SQL, inside a transaction it always rolls back.

## Writing prompts the grader can judge fairly

- Pin down everything that changes the rows: which columns, in what order; how to treat NULL;
  ties; time zone and date boundaries (say "visits in 2025, Kampala time"); rounding (say
  "rounded to 1 decimal place" and use `round(x::numeric, 1)` in the reference).
- Avoid prompts where several readings are reasonable. If unavoidable, accept each reading.
- Do not depend on the dataset's random details in the prompt (no "Grace Nakato"); the data is
  synthetic and regenerated.

## Required tests

- The reference solution passes its own grader (content tests run this automatically).
- At least 2 `mustPass` alternatives written differently from the reference.
- At least 3 `mustFail` plausible wrong answers: the mistakes a learner really makes.
- If a mistake the task warns about cannot show on the generated data (a tie, a patient with no
  visits, a visit just after midnight Kampala time on a boundary day, a visit away from the patient's
  home facility, a longer referral chain), add the case with `grader.setup`, built with the helpers in
  `content/datasets/testRows.ts`. The grader runs it inside its rolled-back transaction before both
  queries, and the learner sees it under the challenge. Then add the mistake as a `mustFail`.
- Run `npx vitest run content/modules.test.ts`, and again with `CONTENT_SIZE=standard` (CI runs
  both: learners use standard). Then ask the `grader-breaker` agent to attack it.
- Never weaken or delete a test to make it pass; fix the grader or the task wording.
