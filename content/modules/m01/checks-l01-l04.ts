import type { QuickCheck } from '../../types'

// Quick checks for lessons 1.1 to 1.4.
export const CHECKS_L01_L04: QuickCheck[] = [
  // 1.1 Joins without fear
  {
    id: 'm01-qc-01-1',
    kind: 'predict',
    prompt:
      'Patient 1 was last seen in June 2024; patient 2 was seen in February 2025. This anti-join looks for patients with no visit since 1 January 2025, but the date condition has been moved from ON into WHERE. What does it return?',
    sql: `SELECT p.id
FROM (VALUES (1), (2)) AS p(id)
LEFT JOIN (VALUES (1, date '2024-06-01'), (2, date '2025-02-01')) AS v(patient_id, visit_on)
       ON v.patient_id = p.id
WHERE v.patient_id IS NULL
  AND v.visit_on >= date '2025-01-01';`,
    options: ['1', '2', '1 and 2', 'No rows'],
    answer: 3,
    explanation:
      'No rows. WHERE runs after the join. A patient kept by the LEFT JOIN with no partner has NULL in every v column, so v.visit_on >= date \'2025-01-01\' is not true and the row is discarded; a patient with a partner fails v.patient_id IS NULL. Every row fails one test or the other. The tempting answer is patient 1, which is what you get with the date condition inside ON, where it limits which visits count as a partner.',
    verify: {
      sql: `SELECT count(*)
FROM (VALUES (1), (2)) AS p(id)
LEFT JOIN (VALUES (1, date '2024-06-01'), (2, date '2025-02-01')) AS v(patient_id, visit_on)
       ON v.patient_id = p.id
WHERE v.patient_id IS NULL
  AND v.visit_on >= date '2025-01-01';`,
      expect: '0',
    },
  },
  {
    id: 'm01-qc-01-2',
    kind: 'choice',
    prompt: 'To show each facility beside the facility it refers to, why must the self-join give facilities two different aliases?',
    options: [
      'Because PostgreSQL forbids naming the same table twice in one query',
      'Because the table plays two roles, and each column reference must say which role it means',
      'Because aliases make the join run faster',
      'Because referral_facility_id is a foreign key',
    ],
    answer: 1,
    explanation:
      'The same table appears twice, once as the referring facility and once as the facility referred to. Writing f.name or r.name is the only way to say which copy a column comes from. Naming the same table twice is allowed, provided each copy has its own alias; that is exactly what a self-join does. Aliases change nothing about speed, and the foreign key is not why they are needed.',
  },
  {
    id: 'm01-qc-01-3',
    kind: 'predict',
    prompt: 'Visit 1 has three prescription lines and visit 2 has none. What does this inner join return?',
    sql: `SELECT count(*), count(DISTINCT v.id)
FROM (VALUES (1), (2)) AS v(id)
JOIN (VALUES (1), (1), (1)) AS p(visit_id) ON p.visit_id = v.id;`,
    options: ['2, 2', '3, 1', '3, 2', '4, 2'],
    answer: 1,
    explanation:
      'Visit 1 matches three prescription rows, giving three joined rows, so count(*) is 3. Visit 2 has no partner, so an inner join drops it, and count(DISTINCT v.id) sees only visit 1. The tempting "3, 2" forgets that an inner join removes visits with no prescriptions; a LEFT JOIN would keep visit 2 and give "4, 2".',
    verify: {
      sql: `SELECT count(*), count(DISTINCT v.id)
FROM (VALUES (1), (2)) AS v(id)
JOIN (VALUES (1), (1), (1)) AS p(visit_id) ON p.visit_id = v.id;`,
      expect: '3, 1',
    },
  },

  // 1.2 Grouping and aggregates
  {
    id: 'm01-qc-02-1',
    kind: 'predict',
    prompt: 'Three visits: two with diagnosis code 1 and one with no diagnosis. What does this return?',
    sql: `SELECT count(*), count(x), count(DISTINCT x)
FROM (VALUES (1), (NULL), (1)) AS t(x);`,
    options: ['3, 3, 2', '3, 2, 1', '3, 2, 2', '2, 2, 1'],
    answer: 1,
    explanation:
      'count(*) counts rows, NULL or not: 3. count(x) counts rows where x is not NULL: 2. count(DISTINCT x) counts different non-NULL values, and there is only one (1): 1. The tempting "3, 3, 2" treats NULL as a value; neither count(x) nor count(DISTINCT x) counts it.',
    verify: {
      sql: `SELECT count(*), count(x), count(DISTINCT x)
FROM (VALUES (1), (NULL), (1)) AS t(x);`,
      expect: '3, 2, 1',
    },
  },
  {
    id: 'm01-qc-02-2',
    kind: 'predict',
    prompt: 'No row passes the WHERE condition. What do count and sum return?',
    sql: `SELECT count(*), sum(x)
FROM (VALUES (5)) AS t(x)
WHERE x > 10;`,
    options: ['0, 0', '0, NULL', 'No rows at all', 'NULL, NULL'],
    answer: 1,
    explanation:
      'An aggregate query with no GROUP BY returns exactly one row, even over zero input rows (unless a HAVING clause rejects it). count returns 0 because there is nothing to count; sum returns NULL because there is nothing to add up, and PostgreSQL does not invent a zero. The tempting "0, 0" is what a report usually wants: write coalesce(sum(x), 0) to get it.',
    verify: {
      sql: `SELECT count(*), sum(x)
FROM (VALUES (5)) AS t(x)
WHERE x > 10;`,
      expect: '0, NULL',
    },
  },
  {
    id: 'm01-qc-02-3',
    kind: 'choice',
    prompt: 'You want patients with five or more emergency visits. Where does each condition go?',
    options: [
      "Both in WHERE: visit_type = 'emergency' AND count(*) >= 5",
      "Both in HAVING: visit_type = 'emergency' AND count(*) >= 5",
      "visit_type = 'emergency' in WHERE, count(*) >= 5 in HAVING",
      "count(*) >= 5 in WHERE, visit_type = 'emergency' in HAVING",
    ],
    answer: 2,
    explanation:
      "The visit type is a fact about each row, so it belongs in WHERE, which filters rows before grouping. The count is a fact about each group, so it belongs in HAVING, which filters after the aggregates are computed. Putting count(*) in WHERE fails with an error, because no groups exist yet. Putting the visit type in HAVING also fails, because visit_type is neither grouped nor aggregated.",
  },
  {
    id: 'm01-qc-02-4',
    kind: 'predict',
    prompt: 'What does this return?',
    sql: `SELECT count(*) FILTER (WHERE x > 1), count(*)
FROM (VALUES (1), (2), (3)) AS t(x);`,
    options: ['2, 2', '2, 3', '3, 3', '1, 3'],
    answer: 1,
    explanation:
      'FILTER applies only to the aggregate it is attached to. The first count sees the two rows where x is greater than 1; the second count has no filter and sees all three. The tempting "2, 2" assumes the filter removes rows from the whole query, which is what WHERE would do.',
    verify: {
      sql: `SELECT count(*) FILTER (WHERE x > 1), count(*)
FROM (VALUES (1), (2), (3)) AS t(x);`,
      expect: '2, 3',
    },
  },

  // 1.3 Subqueries and CTEs
  {
    id: 'm01-qc-03-1',
    kind: 'predict',
    prompt: 'The scalar subquery finds no rows. What does the query return?',
    sql: `SELECT (SELECT x FROM (VALUES (1), (2)) AS t(x) WHERE x > 5) AS answer;`,
    options: ['An error: the subquery returned no rows', 'One row containing NULL', 'No rows', 'One row containing 0'],
    answer: 1,
    explanation:
      'A scalar subquery that finds nothing has the value NULL, so the outer query returns one row with NULL in it. The tempting "error" is what happens in the opposite case: a scalar subquery that returns more than one row fails with SQLSTATE 21000. Zero would be wrong too; NULL means "no value", not zero.',
    verify: {
      sql: `SELECT (SELECT x FROM (VALUES (1), (2)) AS t(x) WHERE x > 5) AS answer;`,
      expect: 'NULL',
    },
  },
  {
    id: 'm01-qc-03-2',
    kind: 'predict',
    prompt: 'The subquery returns one row whose only value is NULL. What does EXISTS give?',
    sql: `SELECT EXISTS (SELECT NULL) AS answer;`,
    options: ['t (true)', 'f (false)', 'NULL', 'An error'],
    answer: 0,
    explanation:
      'EXISTS only asks whether the subquery returned at least one row; it never looks at the values. One row came back, so the answer is true. The tempting NULL or false comes from treating the NULL inside the row as if it were the answer. This is why SELECT 1 and SELECT NULL inside EXISTS behave identically.',
    verify: {
      sql: `SELECT EXISTS (SELECT NULL) AS answer;`,
      expect: 't',
    },
  },
  {
    id: 'm01-qc-03-3',
    kind: 'choice',
    prompt: 'In the "three most recent visits per patient" query, what does the keyword LATERAL allow?',
    options: [
      'It makes the subquery run once and be reused for every patient',
      'It lets the subquery refer to p.id, a table listed before it in FROM, so it runs per patient',
      'It sorts the result by visit_at',
      'It keeps patients who have no visits',
    ],
    answer: 1,
    explanation:
      'Without LATERAL, a subquery in FROM cannot see the other tables in the same FROM list, and the reference to p.id is an error. LATERAL lets it use columns of earlier tables, so ORDER BY … LIMIT 3 is applied to each patient separately. Running once and being reused is what a subquery without LATERAL does, and such a subquery cannot refer to p.id at all. Keeping patients with no visits needs LEFT JOIN LATERAL … ON true; LATERAL on its own does not do that.',
  },

  // 1.4 Recursive CTEs
  {
    id: 'm01-qc-04-1',
    kind: 'predict',
    prompt: 'How many rows does this recursive CTE produce?',
    sql: `WITH RECURSIVE t(n) AS (
  SELECT 1
  UNION ALL
  SELECT n + 1 FROM t WHERE n < 4
)
SELECT count(*) FROM t;`,
    options: ['3', '4', '5', 'It never stops'],
    answer: 1,
    explanation:
      'The anchor gives 1. Each round adds one to the previous round\'s row while n is less than 4, giving 2, 3 and then 4. In the next round the only row is 4, which fails n < 4, so the round is empty and recursion stops. That is four rows: 1, 2, 3, 4. The tempting 3 forgets the anchor row; 5 assumes the round that reads 4 still produces a row.',
    verify: {
      sql: `WITH RECURSIVE t(n) AS (
  SELECT 1
  UNION ALL
  SELECT n + 1 FROM t WHERE n < 4
)
SELECT count(*) FROM t;`,
      expect: '4',
    },
  },
  {
    id: 'm01-qc-04-2',
    kind: 'predict',
    prompt: 'How many rows does this calendar for February 2024 have?',
    sql: `SELECT count(*)
FROM generate_series(date '2024-02-01', date '2024-02-29', interval '1 day');`,
    options: ['28', '29', '30', '27'],
    answer: 1,
    explanation:
      'generate_series includes both the start and the stop value when the steps land on it, and 2024 is a leap year, so 1 to 29 February is 29 days. The tempting 28 either forgets the leap day or treats the stop value as excluded, the way a half-open range would.',
    verify: {
      sql: `SELECT count(*)
FROM generate_series(date '2024-02-01', date '2024-02-29', interval '1 day');`,
      expect: '29',
    },
  },
  {
    id: 'm01-qc-04-3',
    kind: 'predict',
    prompt: 'This recursive term has no stopping condition, but it uses UNION rather than UNION ALL. What happens?',
    sql: `WITH RECURSIVE t(n) AS (
  SELECT 1
  UNION
  SELECT 1 FROM t
)
SELECT count(*) FROM t;`,
    options: ['It runs for ever', 'It returns 1', 'It returns 2', 'It fails with an error'],
    answer: 1,
    explanation:
      'With UNION, any row that duplicates one already produced is discarded. The first round produces 1 again, which is a duplicate, so that round adds nothing and recursion stops, leaving one row. The tempting "runs for ever" is right for UNION ALL. But UNION only rescues you when rows repeat exactly: a row carrying a growing depth or path is never a duplicate, so it is no substitute for a real stopping condition or a cycle check.',
    verify: {
      sql: `WITH RECURSIVE t(n) AS (
  SELECT 1
  UNION
  SELECT 1 FROM t
)
SELECT count(*) FROM t;`,
      expect: '1',
    },
  },
]
