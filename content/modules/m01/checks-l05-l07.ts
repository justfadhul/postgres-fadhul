import type { QuickCheck } from '../../types'

// Quick checks for lessons 1.5 to 1.7.
export const CHECKS_L05_L07: QuickCheck[] = [
  // 1.5 Window functions
  {
    id: 'm01-qc-05-1',
    kind: 'predict',
    prompt: 'Four values, two of them tied. What do rank() and dense_rank() give, in order of x?',
    sql: `SELECT x,
       rank()       OVER (ORDER BY x) AS rnk,
       dense_rank() OVER (ORDER BY x) AS dense_rnk
FROM (VALUES (10), (20), (20), (30)) AS t(x)
ORDER BY x;`,
    options: [
      'rnk 1, 2, 2, 4 and dense_rnk 1, 2, 2, 3',
      'rnk 1, 2, 2, 3 and dense_rnk 1, 2, 2, 4',
      'rnk 1, 2, 3, 4 and dense_rnk 1, 2, 2, 3',
      'Both columns give 1, 2, 2, 3',
    ],
    answer: 0,
    explanation:
      'Both functions give the two 20s the same position, 2. rank() then skips to 4, because three rows come before 30; dense_rank() carries on to 3, because 30 is only the third distinct value. Swapping the two is the usual slip. 1, 2, 3, 4 is what row_number() would give, since it never lets rows share a number.',
    verify: {
      sql: 'SELECT x, rank() OVER (ORDER BY x), dense_rank() OVER (ORDER BY x) FROM (VALUES (10), (20), (20), (30)) AS t(x) ORDER BY x',
      expect: '10, 1, 1; 20, 2, 2; 20, 2, 2; 30, 4, 3',
    },
  },
  {
    id: 'm01-qc-05-2',
    kind: 'predict',
    prompt: 'A running total with no frame written, over values that include a tie. What does the sum column show?',
    sql: `SELECT x, sum(x) OVER (ORDER BY x) AS running
FROM (VALUES (1), (2), (2), (3)) AS t(x)
ORDER BY x;`,
    options: ['1, 3, 5, 8', '1, 5, 5, 8', '8, 8, 8, 8', '1, 2, 2, 3'],
    answer: 1,
    explanation:
      'With ORDER BY and no frame, the default frame runs from the first row up to the current row and all its peers: rows with the same ORDER BY value. Both 2s are peers, so each sees 1 + 2 + 2 = 5. The tempting answer 1, 3, 5, 8 is what you get with ROWS BETWEEN UNBOUNDED PRECEDING AND CURRENT ROW, or with a tie-breaker that makes every row unique. 8, 8, 8, 8 would need an empty OVER (), with no ORDER BY.',
    verify: {
      sql: 'SELECT x, sum(x) OVER (ORDER BY x) FROM (VALUES (1), (2), (2), (3)) AS t(x) ORDER BY x',
      expect: '1, 1; 2, 5; 2, 5; 3, 8',
    },
  },
  {
    id: 'm01-qc-05-3',
    kind: 'choice',
    prompt:
      'You want only each patient\'s latest visit, using row_number() OVER (PARTITION BY patient_id ORDER BY visit_at DESC). Where does the "= 1" test go?',
    options: [
      'In WHERE, on the row_number() expression itself',
      'In WHERE, on the alias given to the row_number() column',
      'In HAVING, because row_number() is a kind of aggregate',
      'In an outer query: compute row_number() in a CTE or subquery, then filter on it',
    ],
    answer: 3,
    explanation:
      'Window functions are calculated after WHERE, GROUP BY and HAVING have decided which rows exist, so none of those clauses can see the result. Putting the window function in WHERE fails with "window functions are not allowed in WHERE" (SQLSTATE 42P20); using its alias fails because SELECT-list aliases are not visible in WHERE. HAVING is also evaluated before window functions, so it is refused too. Computing the number in a CTE or subquery turns it into an ordinary column that the outer query can filter.',
  },

  // 1.6 NULL and three-valued logic
  {
    id: 'm01-qc-06-1',
    kind: 'predict',
    prompt: 'What does this return?',
    sql: 'SELECT NULL = NULL;',
    options: ['true', 'false', 'NULL', 'An error'],
    answer: 2,
    explanation:
      'NULL means "unknown", and whether one unknown value equals another is itself unknown, so the result is NULL (with the default setting transform_null_equals = off). It is tempting to answer true because the two look identical, but SQL does not compare markers, it compares values, and there are none here. To test for a missing value, use IS NULL; to compare two values treating NULLs as equal, use IS NOT DISTINCT FROM.',
    verify: { sql: 'SELECT NULL = NULL', expect: 'NULL' },
  },
  {
    id: 'm01-qc-06-2',
    kind: 'predict',
    prompt: 'Two combinations with an unknown side. What do they return?',
    sql: 'SELECT NULL AND false AS a, NULL OR true AS b;',
    options: ['NULL, NULL', 'false, true', 'false, NULL', 'NULL, true'],
    answer: 1,
    explanation:
      'AND is false as soon as one side is false, whatever the other side is, so NULL AND false is false. OR is true as soon as one side is true, so NULL OR true is true. Answering NULL for both assumes any NULL makes the whole expression unknown; that only happens when the known side does not settle the answer, as in NULL AND true or NULL OR false.',
    verify: { sql: 'SELECT NULL AND false, NULL OR true', expect: 'f, t' },
  },
  {
    id: 'm01-qc-06-3',
    kind: 'predict',
    prompt: '1 is clearly not 2. What does this return?',
    sql: 'SELECT 1 NOT IN (2, NULL);',
    options: ['true', 'false', 'NULL'],
    answer: 2,
    explanation:
      '1 NOT IN (2, NULL) means 1 <> 2 AND 1 <> NULL. The first part is true, the second is unknown, and true AND unknown is unknown, so the result is NULL. In a WHERE clause that row is dropped, which is why a NOT IN subquery that returns any NULL can return no rows at all. It is tempting to say true because 1 is plainly not 2, but the NULL might stand for 1. NOT EXISTS avoids the problem.',
    verify: { sql: 'SELECT 1 NOT IN (2, NULL)', expect: 'NULL' },
  },
  {
    id: 'm01-qc-06-4',
    kind: 'predict',
    prompt: 'A column holding only NULLs. What do count(x) and sum(x) return?',
    sql: `SELECT count(x), sum(x)
FROM (VALUES (NULL::int), (NULL::int)) AS t(x);`,
    options: ['2, 0', '0, 0', '0, NULL', '2, NULL'],
    answer: 2,
    explanation:
      'count(x) counts only non-NULL values, and there are none, so it is 0; count(*) would have counted the two rows. sum ignores NULLs too, and with no values left to add it returns NULL, not 0. The tempting 0, 0 assumes an empty sum is zero, which is why reports wrap totals in COALESCE(sum(x), 0).',
    verify: {
      sql: 'SELECT count(x), sum(x) FROM (VALUES (NULL::int), (NULL::int)) AS t(x)',
      expect: '0, NULL',
    },
  },

  // 1.7 Dates and time zones
  {
    id: 'm01-qc-07-1',
    kind: 'predict',
    prompt: 'The session time zone is Africa/Kampala. How is this instant, typed in UTC, displayed?',
    sql: "SELECT timestamptz '2025-03-01 00:00+00';",
    options: [
      '2025-03-01 00:00:00+00',
      '2025-03-01 03:00:00+03',
      '2025-02-28 21:00:00+03',
      '2025-03-01 00:00:00+03',
    ],
    answer: 1,
    explanation:
      'A timestamptz stores the instant, not the zone it was typed in, and displays it in the session zone. Midnight UTC is 03:00 in Kampala, which is three hours ahead. 21:00 the evening before is the right size of shift in the wrong direction. Keeping +00 would mean PostgreSQL remembered the typed offset, which it does not, and 00:00+03 would be a different instant altogether.',
    verify: { sql: "SELECT timestamptz '2025-03-01 00:00+00'", expect: '2025-03-01 03:00:00+03' },
  },
  {
    id: 'm01-qc-07-2',
    kind: 'predict',
    prompt: 'Noon in Kampala, converted with AT TIME ZONE. What comes back?',
    sql: "SELECT timestamptz '2025-03-01 12:00+03' AT TIME ZONE 'UTC';",
    options: [
      '2025-03-01 09:00:00 (a timestamp with no zone)',
      '2025-03-01 15:00:00 (a timestamp with no zone)',
      '2025-03-01 12:00:00+03 (unchanged)',
      '2025-03-01 09:00:00+00 (a timestamptz in UTC)',
    ],
    answer: 0,
    explanation:
      'Applied to a timestamptz, AT TIME ZONE answers "what did the clock read in that zone at this instant?" and returns a plain timestamp. Noon in Kampala is 09:00 in UTC. 15:00 is the other direction: that is what you get when a plain timestamp of 12:00 is read as UTC and shown in Kampala. The result is not a timestamptz, so it carries no offset at all.',
    verify: {
      sql: "SELECT timestamptz '2025-03-01 12:00+03' AT TIME ZONE 'UTC'",
      expect: '2025-03-01 09:00:00',
    },
  },
  {
    id: 'm01-qc-07-3',
    kind: 'predict',
    prompt: 'A visit at 2 p.m. on 31 March, Kampala time. Is it BETWEEN 1 and 31 March?',
    sql: "SELECT timestamptz '2025-03-31 14:00+03' BETWEEN '2025-03-01' AND '2025-03-31';",
    options: ['true', 'false', 'NULL'],
    answer: 1,
    explanation:
      "Compared with a timestamptz, '2025-03-31' means midnight at the start of 31 March in the session zone, so 14:00 that day is after the upper bound and the answer is false. It feels true because the visit is plainly in March. Write months as half-open ranges instead: visit_at >= '2025-03-01' AND visit_at < '2025-04-01'.",
    verify: {
      sql: "SELECT timestamptz '2025-03-31 14:00+03' BETWEEN '2025-03-01' AND '2025-03-31'",
      expect: 'f',
    },
  },
  {
    id: 'm01-qc-07-4',
    kind: 'predict',
    prompt:
      'A visit at 01:30 on 1 April, Kampala time. Which month does each date_trunc put it in? (The session zone is Africa/Kampala.)',
    sql: `SELECT date_trunc('month', timestamptz '2025-04-01 01:30+03')        AS kampala_month,
       date_trunc('month', timestamptz '2025-04-01 01:30+03', 'UTC') AS utc_month;`,
    options: [
      'Both April: 2025-04-01 00:00:00+03 twice',
      'kampala_month is April (2025-04-01 00:00:00+03); utc_month is March (2025-03-01 03:00:00+03)',
      'kampala_month is March; utc_month is April',
      'Both March, because PostgreSQL works in UTC internally',
    ],
    answer: 1,
    explanation:
      'The two-argument form truncates in the session zone, where 01:30 on 1 April is in April. In UTC the same instant is 22:30 on 31 March, so the three-argument form with UTC gives the start of March in UTC, which displays in Kampala as 2025-03-01 03:00:00+03. Thinking that storage in UTC decides the month is the trap: only the zone used for truncation matters, so name it explicitly in reports.',
    verify: {
      sql: "SELECT date_trunc('month', timestamptz '2025-04-01 01:30+03'), date_trunc('month', timestamptz '2025-04-01 01:30+03', 'UTC')",
      expect: '2025-04-01 00:00:00+03, 2025-03-01 03:00:00+03',
    },
  },
]
