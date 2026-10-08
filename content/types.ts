// The content model. Everything here is plain data so it can be validated by
// tests (content/content.test.ts) and shipped without a server.

import type { Tier } from './syllabus'

export interface LessonMeta {
  /** Stable id; progress is stored against it. */
  id: string
  /** Display number, for example "1.3". */
  number: string
  title: string
  minutes: number
  tier: Tier
  /** One sentence for cards and the course index. */
  summary: string
  /** The MDX file name in the module's lessons/ folder. */
  file: string
}

/**
 * A quick check inside a lesson. `choice` asks a question; `predict` shows a
 * query and asks for its output. Where the answer is a fact about PostgreSQL's
 * behaviour, `verify` runs SQL in the content tests and compares the output
 * (rows joined by "; ", values by ", ", NULL as NULL) with `expect`.
 */
export interface QuickCheck {
  id: string
  kind: 'choice' | 'predict'
  prompt: string
  sql?: string
  options: string[]
  answer: number
  explanation: string
  verify?: { sql: string; expect: string }
}

export interface SqlPattern {
  /** A regular expression source, matched case-insensitively against the learner's SQL with comments and string literals removed. */
  pattern: string
  message: string
}

export interface ResultGrader {
  kind: 'result'
  /** The reference query. Run on the same data as the learner's query. */
  reference: string
  /** True only when the task asks for an order. */
  ordered: boolean
  /** Shapes the answer must use, for "write it this way" tasks. */
  requires?: SqlPattern[]
  /** Shapes the answer must not use. */
  forbids?: SqlPattern[]
}

export interface Challenge {
  id: string
  title: string
  /** The task in plain language. Say whether order matters. */
  prompt: string
  tier: Tier
  /** Optional SQL placed in the editor when the challenge opens. */
  starter?: string
  hints: string[]
  /** Shown after a pass, or when the learner gives up. */
  explanation: string
  grader: ResultGrader
  /** Run by the content tests: every mustPass answer passes, every mustFail answer fails. */
  tests: { mustPass: string[]; mustFail: string[] }
}

export interface Assignment {
  title: string
  intro: string
  challengeIds: string[]
}

export interface ModuleContent {
  id: string
  lessons: LessonMeta[]
  checks: QuickCheck[]
  challenges: Challenge[]
  assignment: Assignment
}
