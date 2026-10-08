---
name: new-challenge
description: Format for a new auto-graded challenge, how to choose the grader, and the tests every challenge needs. Use when adding a challenge, assignment task or practical exam question.
---

# New challenge

## Pick the grader

| Task asks the learner to… | Grader | Passes when |
| --- | --- | --- |
| write a query | result | learner rows equal reference rows (order-sensitive only if the task demands an order) |
| design a schema or constraint | constraint | every "attack" statement fails with the expected SQLSTATE class (23xxx) and every valid statement succeeds |
| speed up a query | plan | plan shape matches: node types, index used, buffers read under a bound. Never milliseconds |
| restrict access | policy | as each role, the visible rows and refused actions match the specification |

## Format

Challenges are typed data validated at build time (Milestone 1 creates the type in `content/types.ts`):

```ts
{
  id: 'm01-c07-latest-visit',
  tier: 'B',
  title: 'Latest visit per patient',
  prompt: 'Plain-language task. Say whether order matters.',
  dataset: 'standard',          // or a setup SQL string
  grader: { kind: 'result', reference: 'SELECT ...', ordered: false },
  hints: ['...'],
  explanation: 'Shown after a pass or after giving up.',
  tests: {
    mustPass: ['SELECT ... alternative correct answer'],
    mustFail: ['SELECT ... plausible mistake'],
  },
}
```

## Required tests

- The reference solution passes its own grader (content tests run this automatically).
- At least 2 `mustPass` alternatives written differently from the reference.
- At least 3 `mustFail` plausible wrong answers.
- Run `npx vitest run content`, then ask the `grader-breaker` agent to attack it.
- Never weaken or delete a test to make it pass; fix the grader or the task wording.
