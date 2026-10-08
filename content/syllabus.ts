// The course outline. Lessons, challenges and exams hang off these module ids.

export type Tier = 'B' | 'C' | 'B+C'

export interface ModuleOutline {
  id: string
  number: number
  phase: 1 | 2 | 3 | 4
  title: string
  hours: number
  tier: Tier
  topics: string[]
  lab: string
  doneWhen: string[]
}

export const PHASES = {
  1: 'Use the database well',
  2: 'Understand and run it',
  3: 'Build it yourself',
  4: 'Distribute it',
} as const

export const TIER_LABEL: Record<Tier, string> = {
  B: 'Browser',
  C: 'Codespace',
  'B+C': 'Browser and Codespace',
}

export const MODULES: ModuleOutline[] = [
  {
    id: 'm01-sql-fluency',
    number: 1,
    phase: 1,
    title: 'SQL fluency',
    hours: 15,
    tier: 'B',
    topics: ['Joins', 'Aggregation', 'Subqueries and CTEs, including recursive', 'Window functions', 'NULL and three-valued logic', 'Dates and time zones'],
    lab: '30 reporting queries over the seeded clinic dataset.',
    doneWhen: [
      'All 30 reporting queries pass.',
      '"Latest visit per patient" written three ways (DISTINCT ON, window function, lateral join), with the fastest identified.',
    ],
  },
  {
    id: 'm02-modelling-integrity',
    number: 2,
    phase: 1,
    title: 'Data modelling and integrity',
    hours: 15,
    tier: 'B',
    topics: ['Keys, including UUIDv7', 'Normalisation and when to denormalise', 'Constraints, including exclusion constraints', 'Type choices: timestamptz, numeric', 'Append-only history', 'Migrations'],
    lab: 'An outpatient schema: no double-booked clinician, no negative stock, every dispensed item tied to a prescription, no hard deletes of clinical records.',
    doneWhen: ['12 attack statements are all rejected by constraints.'],
  },
  {
    id: 'm03-indexes-performance',
    number: 3,
    phase: 1,
    title: 'Indexes and query performance',
    hours: 20,
    tier: 'B',
    topics: ['B-trees and composite column order', 'Covering, partial and expression indexes', 'GIN', 'EXPLAIN (ANALYZE, BUFFERS)', 'Join algorithms', 'Keyset pagination', 'The write cost of indexes'],
    lab: 'Fix 10 slow queries; measure insert cost with 0, 3 and 8 indexes.',
    doneWhen: ['Each query plan improves as specified.', 'Scan type predicted correctly for 8 of 10 new queries.'],
  },
  {
    id: 'm04-transactions-concurrency',
    number: 4,
    phase: 1,
    title: 'Transactions and concurrency',
    hours: 20,
    tier: 'B+C',
    topics: ['ACID', 'MVCC', 'Isolation levels', 'Lost update, non-repeatable read, phantom, write skew', 'Row locks and SKIP LOCKED', 'Deadlocks', 'Optimistic concurrency, retries, idempotency keys'],
    lab: 'Reproduce each anomaly in two sessions; solve "two pharmacists dispense the last unit" three ways; fire 50 concurrent dispenses at 10 units.',
    doneWhen: ['Exactly 10 dispenses succeed for each solution.', 'A deliberate deadlock is found in the server log.'],
  },
  {
    id: 'm05-internals-operations',
    number: 5,
    phase: 2,
    title: 'PostgreSQL internals and operations',
    hours: 15,
    tier: 'C',
    topics: ['Heap pages and row versions', 'VACUUM and bloat', 'Write-ahead log and checkpoints', 'Backups and point-in-time recovery', 'Connection pooling', 'Monitoring'],
    lab: 'Inspect pages with pageinspect; create and clear bloat; archive the WAL, take a base backup, drop a table, restore to one minute before.',
    doneWhen: ['Restore drill done twice, the second time in under 30 minutes.', 'A one-page runbook exists.'],
  },
  {
    id: 'm06-security-access',
    number: 6,
    phase: 2,
    title: 'Security and access control',
    hours: 12,
    tier: 'B',
    topics: ['Roles and least privilege', 'Row-level security', 'SQL injection', 'Encryption trade-offs', 'Append-only audit logging', 'Secrets', "Uganda's Data Protection and Privacy Act, 2019"],
    lab: "Clinicians see only their facility's patients; pharmacists see prescriptions but not notes; nobody can change the audit table.",
    doneWhen: ['15 forbidden actions all fail.'],
  },
  {
    id: 'm07-backend-architecture',
    number: 7,
    phase: 2,
    title: 'Backend architecture',
    hours: 15,
    tier: 'C',
    topics: ['Transaction boundaries', 'Idempotent endpoints', 'Keyset pagination in an API', 'Zero-downtime migrations', 'Transactional outbox', 'Caching', 'Integration tests and logging'],
    lab: 'A small TypeScript API: idempotent dispense endpoint, paginated visit list, outbox worker for reminders, no-downtime column rename.',
    doneWhen: ['Retries never dispense twice.', 'Killing the worker loses and duplicates nothing.'],
  },
  {
    id: 'm08-storage-engine',
    number: 8,
    phase: 3,
    title: 'Build your own storage engine',
    hours: 45,
    tier: 'C',
    topics: ['Go basics', 'Append-only log with an in-memory hash index', 'Durability: fsync, checksums, torn records', 'Compaction', 'On-disk B+tree with range scans', 'Benchmarks and write-up'],
    lab: 'A Go key-value store driven through put, get, delete and scan commands.',
    doneWhen: ['200 kill -9 crash runs lose no acknowledged write.', 'Range scans are ordered after restart.'],
  },
  {
    id: 'm09-replication',
    number: 9,
    phase: 4,
    title: 'Replication and distributed data',
    hours: 20,
    tier: 'C',
    topics: ['Leader and follower replication', 'Lag and stale reads', 'Failover and split brain', 'Sharding overview', 'Clocks and consistency models', 'Raft, conceptually'],
    lab: 'Two PostgreSQL containers with streaming replication; measure lag; pause the replica; promote it and find a lost acknowledged write.',
    doneWhen: ['The lost write is demonstrated and the synchronous-commit fix explained.'],
  },
  {
    id: 'm10-offline-sync',
    number: 10,
    phase: 4,
    title: 'Offline-first sync',
    hours: 15,
    tier: 'C',
    topics: ['Local store with an operation log', 'Pull by cursor, push by operation', 'Why last-write-wins loses data', 'Per-field merge rules and CRDTs', 'Tombstones and idempotent replay', 'Schema versions'],
    lab: 'Two SQLite "devices" and one PostgreSQL server, with a conflict policy per table.',
    doneWhen: ['Both sync orders converge.', 'Replaying a batch changes nothing.'],
  },
  {
    id: 'm11-capstone',
    number: 11,
    phase: 4,
    title: 'Capstone',
    hours: 25,
    tier: 'C',
    topics: ['Data-layer design document', 'Prescription to dispensing to stock slice', 'Concurrency, access-control and sync tests', 'Failure review'],
    lab: 'An 8 to 10 page data-layer design for a hospital platform, a working slice with tests, and a review of 10 ways it could lose or corrupt data.',
    doneWhen: ['Design document, working slice and failure review complete.'],
  },
]
