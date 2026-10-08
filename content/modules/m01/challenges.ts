import type { Challenge, SqlPattern } from '../../types'

// Module 1 challenges: the 30-query assignment and "latest visit, three ways".
//
// Every prompt pins down the columns (in order), NULL handling, ties, Kampala
// date boundaries and rounding, so the reference answer is the only right
// answer on any dataset size. Sessions run with TIME ZONE 'Africa/Kampala', so
// a literal like '2025-01-01' compared with a timestamptz means Kampala
// midnight, and visit_at::date is the Kampala date.

const IN_2025 = `v.visit_at >= '2025-01-01' AND v.visit_at < '2026-01-01'`

// Shapes for "latest visit, three ways".
const DISTINCT_ON: SqlPattern = { pattern: '\\bdistinct\\s+on\\b', message: 'Use DISTINCT ON for this one.' }
const WINDOW: SqlPattern = { pattern: '\\bover\\b', message: 'Use a window function with OVER for this one.' }
const LATERAL: SqlPattern = { pattern: '\\blateral\\b', message: 'Use a LATERAL join for this one.' }
const NO_DISTINCT_ON: SqlPattern = { pattern: '\\bdistinct\\s+on\\b', message: 'Leave out DISTINCT ON here: this version practises another technique.' }
const NO_WINDOW: SqlPattern = { pattern: '\\bover\\b', message: 'Leave out window functions here: this version practises another technique.' }
const NO_LATERAL: SqlPattern = { pattern: '\\blateral\\b', message: 'Leave out LATERAL here: this version practises another technique.' }

const LATEST_PROMPT =
  'For every patient who has at least one visit, show their latest visit. Columns: patient id, visit time (visit_at), ' +
  'diagnosis code (NULL if none was recorded). If two of a patient’s visits share the latest time, choose the one with ' +
  'the higher visit id. One row per patient. Any order.'

const ASSIGNMENT: Challenge[] = [
  // ---------------------------------------------------------------- 1.1 Joins
  {
    id: 'm01-a01',
    tier: 'B',
    title: 'Doctors at general hospitals',
    prompt:
      'List every doctor (role \'doctor\') who works at a general hospital (level \'General Hospital\'). ' +
      'Columns: clinician id, clinician full name, facility name. Any order.',
    hints: [
      'The role is on clinicians; the level is on facilities. Join them.',
      'Join on clinicians.facility_id = facilities.id, then filter on both role and level.',
    ],
    explanation:
      'An inner join pairs each clinician with the one facility whose id matches clinicians.facility_id; the WHERE clause then ' +
      'keeps doctors at general hospitals. The trap is the join key: clinicians.id = facilities.id compares two unrelated ' +
      'numbers and still runs, so PostgreSQL cannot warn you. Always join a foreign key to the key it points at.',
    grader: {
      kind: 'result',
      reference: `SELECT c.id, c.full_name, f.name
FROM clinicians c
JOIN facilities f ON f.id = c.facility_id
WHERE c.role = 'doctor' AND f.level = 'General Hospital'`,
      ordered: false,
    },
    tests: {
      mustPass: [
        `SELECT c.id, c.full_name, f.name FROM clinicians c, facilities f
WHERE f.id = c.facility_id AND c.role = 'doctor' AND f.level = 'General Hospital'`,
        `SELECT c.id, c.full_name, (SELECT f.name FROM facilities f WHERE f.id = c.facility_id)
FROM clinicians c
WHERE c.role = 'doctor'
  AND c.facility_id IN (SELECT id FROM facilities WHERE level = 'General Hospital')`,
      ],
      mustFail: [
        `SELECT c.id, c.full_name, f.name FROM clinicians c JOIN facilities f ON f.id = c.id
WHERE c.role = 'doctor' AND f.level = 'General Hospital'`,
        `SELECT c.id, c.full_name, f.name FROM clinicians c JOIN facilities f ON f.id = c.facility_id
WHERE f.level = 'General Hospital'`,
        `SELECT c.id, c.full_name, f.name FROM clinicians c JOIN facilities f ON f.id = c.facility_id
WHERE c.role = 'doctor' AND f.level <> 'HC III'`,
      ],
    },
  },
  {
    id: 'm01-a02',
    tier: 'B',
    title: 'Where each facility refers',
    prompt:
      'For every facility, show where it refers patients. Columns: facility name, its level, the name of the facility it ' +
      'refers to (NULL if it refers to none). Every facility must appear. Any order.',
    hints: [
      'You need the facilities table twice: once for the facility, once for its referral facility. Give each copy an alias.',
      'Some facilities have no referral_facility_id. Which join keeps rows that find no match?',
    ],
    explanation:
      'This is a self-join: facilities joined to itself, with f.referral_facility_id pointing at r.id. A LEFT JOIN keeps ' +
      'facilities that refer to nobody, with NULL in the referral columns. An inner join silently drops them, and swapping ' +
      'the join condition answers a different question ("who refers to me?").',
    grader: {
      kind: 'result',
      reference: `SELECT f.name, f.level, r.name
FROM facilities f
LEFT JOIN facilities r ON r.id = f.referral_facility_id`,
      ordered: false,
    },
    tests: {
      mustPass: [
        `SELECT f.name, f.level, (SELECT r.name FROM facilities r WHERE r.id = f.referral_facility_id) FROM facilities f`,
        `SELECT f.name, f.level, r.name FROM facilities r RIGHT JOIN facilities f ON f.referral_facility_id = r.id`,
      ],
      mustFail: [
        `SELECT f.name, f.level, r.name FROM facilities f JOIN facilities r ON r.id = f.referral_facility_id`,
        `SELECT f.name, f.level, r.name FROM facilities f LEFT JOIN facilities r ON f.id = r.referral_facility_id`,
        `SELECT f.name, f.level, coalesce(r.name, 'None') FROM facilities f LEFT JOIN facilities r ON r.id = f.referral_facility_id`,
      ],
    },
  },
  {
    id: 'm01-a03',
    tier: 'B',
    title: 'Antimalarials at the hospitals',
    prompt:
      'Which patients were prescribed Artemether-lumefantrine at a general hospital (level \'General Hospital\') in ' +
      'June 2025 (Kampala time)? Count a prescription whether or not it was dispensed. Columns: patient id, full name. ' +
      'Each patient once. Any order.',
    hints: [
      'Walk the chain patients → visits → prescriptions → drugs, and join facilities for the level.',
      'Use a half-open range: visit_at >= \'2025-06-01\' AND visit_at < \'2025-07-01\'. A patient with two such prescriptions must still appear once.',
    ],
    explanation:
      'Joining through visits and prescriptions gives one row per matching prescription, so a patient with two qualifying ' +
      'prescriptions appears twice: DISTINCT (or EXISTS) fixes that. Join each foreign key to the key it points at: the ' +
      'facility of a prescription is the facility of its visit (visits.facility_id), and joining facilities on the patient ' +
      'id still runs but means nothing. For dates, the half-open range [1 June, 1 July) is exact; the session runs in ' +
      'Kampala time, so the plain literals mean Kampala midnight.',
    grader: {
      kind: 'result',
      reference: `SELECT DISTINCT p.id, p.full_name
FROM patients p
JOIN visits v ON v.patient_id = p.id
JOIN facilities f ON f.id = v.facility_id
JOIN prescriptions rx ON rx.visit_id = v.id
JOIN drugs d ON d.id = rx.drug_id
WHERE d.name = 'Artemether-lumefantrine'
  AND f.level = 'General Hospital'
  AND v.visit_at >= '2025-06-01' AND v.visit_at < '2025-07-01'`,
      ordered: false,
    },
    tests: {
      mustPass: [
        `SELECT p.id, p.full_name FROM patients p
WHERE EXISTS (
  SELECT 1 FROM visits v
  JOIN facilities f ON f.id = v.facility_id
  JOIN prescriptions rx ON rx.visit_id = v.id
  JOIN drugs d ON d.id = rx.drug_id
  WHERE v.patient_id = p.id AND d.name = 'Artemether-lumefantrine' AND f.level = 'General Hospital'
    AND v.visit_at::date BETWEEN '2025-06-01' AND '2025-06-30')`,
        `SELECT p.id, p.full_name
FROM patients p JOIN visits v ON v.patient_id = p.id JOIN prescriptions rx ON rx.visit_id = v.id
WHERE rx.drug_id = (SELECT id FROM drugs WHERE name = 'Artemether-lumefantrine')
  AND v.facility_id IN (SELECT id FROM facilities WHERE level = 'General Hospital')
  AND date_trunc('month', v.visit_at) = '2025-06-01'
GROUP BY p.id, p.full_name`,
      ],
      mustFail: [
        `SELECT p.id, p.full_name
FROM patients p JOIN visits v ON v.patient_id = p.id JOIN facilities f ON f.id = v.facility_id
JOIN prescriptions rx ON rx.visit_id = v.id JOIN drugs d ON d.id = rx.drug_id
WHERE d.name = 'Artemether-lumefantrine' AND f.level = 'General Hospital'
  AND v.visit_at >= '2025-06-01' AND v.visit_at < '2025-07-01'`,
        `SELECT DISTINCT p.id, p.full_name
FROM patients p JOIN visits v ON v.patient_id = p.id JOIN facilities f ON f.id = v.facility_id
JOIN prescriptions rx ON rx.visit_id = v.id JOIN drugs d ON d.id = rx.drug_id
WHERE d.name = 'Artemether-lumefantrine' AND f.level = 'General Hospital' AND rx.dispensed
  AND v.visit_at >= '2025-06-01' AND v.visit_at < '2025-07-01'`,
        `SELECT DISTINCT p.id, p.full_name
FROM patients p JOIN facilities f ON f.id = p.id JOIN visits v ON v.patient_id = p.id
JOIN prescriptions rx ON rx.visit_id = v.id JOIN drugs d ON d.id = rx.drug_id
WHERE d.name = 'Artemether-lumefantrine' AND f.level = 'General Hospital'
  AND v.visit_at >= '2025-06-01' AND v.visit_at < '2025-07-01'`,
        `SELECT DISTINCT p.id, p.full_name
FROM patients p JOIN visits v ON v.patient_id = p.id JOIN facilities f ON f.id = v.facility_id
JOIN prescriptions rx ON rx.visit_id = v.id JOIN drugs d ON d.id = rx.drug_id
WHERE d.name = 'Artemether-lumefantrine' AND f.level <> 'HC III'
  AND v.visit_at >= '2025-06-01' AND v.visit_at < '2025-07-01'`,
      ],
    },
  },
  {
    id: 'm01-a04',
    tier: 'B',
    title: 'Christmas emergencies and their prescriptions',
    prompt:
      'List the emergency visits on 24, 25 and 26 December 2025 (Kampala time) with what was prescribed. Columns: visit id, ' +
      'drug name. One row per prescription; a visit with no prescription appears once, with NULL as the drug name. Any order.',
    hints: [
      'A visit with no prescriptions has no row in prescriptions. Which join keeps it?',
      'Once you LEFT JOIN prescriptions, the join to drugs must be a LEFT JOIN too, or it throws those visits away again.',
    ],
    explanation:
      'A chain of LEFT JOINs keeps the visits with no prescription. The classic trap is a LEFT JOIN followed by an inner ' +
      'JOIN: the second join needs a matching drug, the NULL drug_id never matches, and the visits you kept disappear. ' +
      'For the days, visit_at < \'2025-12-27\' (or visit_at::date BETWEEN the 24th and the 26th) is right; ' +
      'visit_at BETWEEN \'2025-12-24\' AND \'2025-12-26\' stops at midnight at the start of the 26th. The visit type ' +
      'is a condition on the left-hand table, so it belongs in WHERE: in the ON clause of a LEFT JOIN it cannot remove ' +
      'any visit, it only decides which prescriptions attach.',
    grader: {
      kind: 'result',
      reference: `SELECT v.id, d.name
FROM visits v
LEFT JOIN prescriptions rx ON rx.visit_id = v.id
LEFT JOIN drugs d ON d.id = rx.drug_id
WHERE v.visit_type = 'emergency'
  AND v.visit_at >= '2025-12-24' AND v.visit_at < '2025-12-27'`,
      ordered: false,
    },
    tests: {
      mustPass: [
        `SELECT v.id, x.name
FROM visits v
LEFT JOIN (SELECT rx.visit_id, d.name FROM prescriptions rx JOIN drugs d ON d.id = rx.drug_id) x ON x.visit_id = v.id
WHERE v.visit_type = 'emergency' AND v.visit_at::date BETWEEN '2025-12-24' AND '2025-12-26'`,
        `SELECT v.id, d.name
FROM visits v
LEFT JOIN (prescriptions rx JOIN drugs d ON d.id = rx.drug_id) ON rx.visit_id = v.id
WHERE v.visit_type = 'emergency' AND v.visit_at::date IN ('2025-12-24', '2025-12-25', '2025-12-26')`,
      ],
      mustFail: [
        `SELECT v.id, d.name
FROM visits v LEFT JOIN prescriptions rx ON rx.visit_id = v.id JOIN drugs d ON d.id = rx.drug_id
WHERE v.visit_type = 'emergency' AND v.visit_at >= '2025-12-24' AND v.visit_at < '2025-12-27'`,
        `SELECT v.id, d.name
FROM visits v LEFT JOIN prescriptions rx ON rx.visit_id = v.id LEFT JOIN drugs d ON d.id = rx.drug_id
WHERE v.visit_type = 'emergency' AND v.visit_at BETWEEN '2025-12-24' AND '2025-12-26'`,
        `SELECT v.id, d.name
FROM visits v
LEFT JOIN prescriptions rx ON rx.visit_id = v.id AND v.visit_type = 'emergency'
LEFT JOIN drugs d ON d.id = rx.drug_id
WHERE v.visit_at >= '2025-12-24' AND v.visit_at < '2025-12-27'`,
      ],
    },
  },
  {
    id: 'm01-a05',
    tier: 'B',
    title: 'Emergencies on New Year’s Day',
    prompt:
      'For every facility, how many emergency visits did it have on 1 January 2025 (Kampala time)? Show 0 for facilities ' +
      'with none. Columns: facility name, number of emergency visits. Any order.',
    hints: [
      'Start from facilities and LEFT JOIN visits, so facilities with no matching visit stay.',
      'Put the visit conditions in the ON clause, not in WHERE, and count a visit column rather than *.',
    ],
    explanation:
      'With a LEFT JOIN, conditions on the right-hand table belong in ON. In WHERE they reject the NULL-extended rows and ' +
      'turn the join back into an inner join, so facilities with no emergencies vanish. count(*) counts the NULL-extended ' +
      'row as 1; count(v.id) counts only real visits and gives 0.',
    grader: {
      kind: 'result',
      reference: `SELECT f.name, count(v.id)
FROM facilities f
LEFT JOIN visits v
  ON v.facility_id = f.id
 AND v.visit_type = 'emergency'
 AND v.visit_at >= '2025-01-01' AND v.visit_at < '2025-01-02'
GROUP BY f.id, f.name`,
      ordered: false,
    },
    tests: {
      mustPass: [
        `SELECT f.name,
       (SELECT count(*) FROM visits v WHERE v.facility_id = f.id AND v.visit_type = 'emergency'
          AND v.visit_at::date = '2025-01-01')
FROM facilities f`,
        `SELECT f.name, count(*) FILTER (WHERE v.visit_type = 'emergency' AND v.visit_at::date = date '2025-01-01')
FROM facilities f LEFT JOIN visits v ON v.facility_id = f.id
GROUP BY f.name`,
      ],
      mustFail: [
        `SELECT f.name, count(v.id)
FROM facilities f LEFT JOIN visits v ON v.facility_id = f.id
WHERE v.visit_type = 'emergency' AND v.visit_at >= '2025-01-01' AND v.visit_at < '2025-01-02'
GROUP BY f.name`,
        `SELECT f.name, count(*)
FROM facilities f LEFT JOIN visits v ON v.facility_id = f.id AND v.visit_type = 'emergency'
 AND v.visit_at >= '2025-01-01' AND v.visit_at < '2025-01-02'
GROUP BY f.name`,
        `SELECT f.name, count(v.id)
FROM facilities f LEFT JOIN visits v ON v.facility_id = f.id AND v.visit_type = 'emergency'
 AND v.visit_at >= '2025-01-01 00:00+00' AND v.visit_at < '2025-01-02 00:00+00'
GROUP BY f.name`,
      ],
    },
  },

  // ------------------------------------------------------- 1.2 Grouping and aggregates
  {
    id: 'm01-a06',
    tier: 'B',
    title: 'Visits by type in 2025',
    prompt: 'How many visits of each type were there in 2025 (Kampala time)? Columns: visit type, number of visits. Any order.',
    hints: [
      'GROUP BY visit_type and count.',
      'Filter with visit_at >= \'2025-01-01\' AND visit_at < \'2026-01-01\'.',
    ],
    explanation:
      'GROUP BY makes one row per visit type and count(*) counts the rows in each group. The trap is the year boundary: ' +
      'visit_at BETWEEN \'2025-01-01\' AND \'2025-12-31\' compares a timestamp with midnight at the start of ' +
      '31 December, so the whole of New Year’s Eve is lost. A half-open range, or comparing visit_at::date, avoids it.',
    grader: {
      kind: 'result',
      reference: `SELECT v.visit_type, count(*)
FROM visits v
WHERE ${IN_2025}
GROUP BY v.visit_type`,
      ordered: false,
    },
    tests: {
      mustPass: [
        `SELECT visit_type, count(*) FROM visits WHERE extract(year FROM visit_at) = 2025 GROUP BY 1`,
        `SELECT visit_type, count(id) FROM visits WHERE visit_at::date BETWEEN '2025-01-01' AND '2025-12-31' GROUP BY visit_type`,
      ],
      mustFail: [
        `SELECT visit_type, count(*) FROM visits GROUP BY visit_type`,
        `SELECT visit_type, count(*) FROM visits WHERE visit_at BETWEEN '2025-01-01' AND '2025-12-31' GROUP BY visit_type`,
        `SELECT visit_type, count(*) FROM visits WHERE extract(year FROM visit_at AT TIME ZONE 'UTC') = 2025 GROUP BY visit_type`,
      ],
    },
  },
  {
    id: 'm01-a07',
    tier: 'B',
    title: 'Frequent emergency patients',
    prompt:
      'Which patients had 4 or more emergency visits in 2025 (Kampala time)? Columns: patient id, number of emergency ' +
      'visits in 2025. Any order.',
    hints: [
      'Filter rows with WHERE, group by patient, then filter groups with HAVING.',
      'HAVING count(*) >= 4. Check that both the year and the visit type are in WHERE.',
    ],
    explanation:
      'WHERE filters rows before grouping; HAVING filters groups after counting. "4 or more" is >= 4, and > 4 is the ' +
      'off-by-one that drops everyone with exactly four. If the emergency condition is only in HAVING (as a FILTER) while ' +
      'the shown count is count(*), the number shown counts every visit, not only emergencies.',
    grader: {
      kind: 'result',
      reference: `SELECT v.patient_id, count(*)
FROM visits v
WHERE v.visit_type = 'emergency' AND ${IN_2025}
GROUP BY v.patient_id
HAVING count(*) >= 4`,
      ordered: false,
    },
    tests: {
      mustPass: [
        `SELECT patient_id, n FROM (
  SELECT patient_id, count(*) AS n FROM visits
  WHERE visit_type = 'emergency' AND visit_at::date BETWEEN '2025-01-01' AND '2025-12-31'
  GROUP BY patient_id) t
WHERE n > 3`,
        `SELECT patient_id, count(*) FILTER (WHERE visit_type = 'emergency')
FROM visits WHERE extract(year FROM visit_at) = 2025
GROUP BY patient_id
HAVING count(*) FILTER (WHERE visit_type = 'emergency') >= 4`,
      ],
      mustFail: [
        `SELECT patient_id, count(*) FROM visits
WHERE visit_type = 'emergency' AND visit_at >= '2025-01-01' AND visit_at < '2026-01-01'
GROUP BY patient_id HAVING count(*) > 4`,
        `SELECT patient_id, count(*) FROM visits
WHERE visit_at >= '2025-01-01' AND visit_at < '2026-01-01'
GROUP BY patient_id HAVING count(*) FILTER (WHERE visit_type = 'emergency') >= 4`,
        `SELECT patient_id, count(*) FROM visits WHERE visit_type = 'emergency'
GROUP BY patient_id HAVING count(*) >= 4`,
      ],
    },
  },
  {
    id: 'm01-a08',
    tier: 'B',
    title: 'Prescriptions not yet dispensed',
    prompt:
      'For every drug, how many prescriptions have not been dispensed yet, and how many units do they add up to? Columns: ' +
      'drug name, undispensed prescriptions, undispensed units. Show 0, not NULL, for drugs with none. Any order.',
    hints: [
      'Every drug must appear, including those with nothing waiting. Start from drugs.',
      'LEFT JOIN prescriptions with NOT dispensed in the ON clause; count(rx.id), and coalesce the sum to 0.',
    ],
    explanation:
      'Starting from drugs with a LEFT JOIN keeps drugs that have no undispensed prescriptions. sum() over no rows is NULL, ' +
      'not 0, so coalesce(sum(...), 0) is needed; count(rx.id) already gives 0. Filtering NOT dispensed in WHERE removes the ' +
      'drugs with nothing waiting, which a stock manager most needs to see as 0.',
    grader: {
      kind: 'result',
      reference: `SELECT d.name, count(rx.id), coalesce(sum(rx.quantity), 0)
FROM drugs d
LEFT JOIN prescriptions rx ON rx.drug_id = d.id AND NOT rx.dispensed
GROUP BY d.id, d.name`,
      ordered: false,
    },
    tests: {
      mustPass: [
        `SELECT d.name,
       count(*) FILTER (WHERE rx.dispensed = false),
       coalesce(sum(rx.quantity) FILTER (WHERE rx.dispensed = false), 0)
FROM drugs d LEFT JOIN prescriptions rx ON rx.drug_id = d.id
GROUP BY d.name`,
        `SELECT d.name,
       (SELECT count(*) FROM prescriptions rx WHERE rx.drug_id = d.id AND NOT rx.dispensed),
       (SELECT coalesce(sum(quantity), 0) FROM prescriptions rx WHERE rx.drug_id = d.id AND NOT rx.dispensed)
FROM drugs d`,
      ],
      mustFail: [
        `SELECT d.name, count(rx.id), sum(rx.quantity)
FROM drugs d JOIN prescriptions rx ON rx.drug_id = d.id
WHERE NOT rx.dispensed GROUP BY d.name`,
        `SELECT d.name, count(rx.id), sum(rx.quantity)
FROM drugs d LEFT JOIN prescriptions rx ON rx.drug_id = d.id AND NOT rx.dispensed
GROUP BY d.name`,
        `SELECT d.name, count(*), coalesce(sum(rx.quantity), 0)
FROM drugs d LEFT JOIN prescriptions rx ON rx.drug_id = d.id AND NOT rx.dispensed
GROUP BY d.name`,
      ],
    },
  },
  {
    id: 'm01-a09',
    tier: 'B',
    title: 'Visits and prescriptions by level',
    prompt:
      'For each facility level, how many visits were there in 2025 (Kampala time), and how many prescriptions were written ' +
      'at those visits? Columns: level, visits, prescriptions. Any order.',
    hints: [
      'Joining prescriptions to visits gives one row per prescription, so count(*) no longer counts visits.',
      'Count visits with count(DISTINCT v.id), and LEFT JOIN prescriptions so visits without one are still counted.',
    ],
    explanation:
      'A join multiplies rows: a visit with two prescriptions becomes two rows. After that, count(*) counts prescriptions ' +
      '(plus one for each visit with none), not visits. Use count(DISTINCT v.id) for visits and count(rx.id) for ' +
      'prescriptions, or aggregate each table separately before joining. An inner join to prescriptions would drop visits ' +
      'with no prescription from the visit count.',
    grader: {
      kind: 'result',
      reference: `SELECT f.level, count(DISTINCT v.id), count(rx.id)
FROM facilities f
JOIN visits v ON v.facility_id = f.id
LEFT JOIN prescriptions rx ON rx.visit_id = v.id
WHERE ${IN_2025}
GROUP BY f.level`,
      ordered: false,
    },
    tests: {
      mustPass: [
        `SELECT f.level, count(*), coalesce(sum(rc.n), 0)
FROM visits v
JOIN facilities f ON f.id = v.facility_id
LEFT JOIN (SELECT visit_id, count(*) AS n FROM prescriptions GROUP BY visit_id) rc ON rc.visit_id = v.id
WHERE v.visit_at >= '2025-01-01' AND v.visit_at < '2026-01-01'
GROUP BY f.level`,
        `WITH a AS (
  SELECT f.level, count(*) AS visits FROM visits v JOIN facilities f ON f.id = v.facility_id
  WHERE extract(year FROM v.visit_at) = 2025 GROUP BY f.level),
b AS (
  SELECT f.level, count(*) AS rx FROM prescriptions rx JOIN visits v ON v.id = rx.visit_id JOIN facilities f ON f.id = v.facility_id
  WHERE extract(year FROM v.visit_at) = 2025 GROUP BY f.level)
SELECT a.level, a.visits, coalesce(b.rx, 0) FROM a LEFT JOIN b USING (level)`,
      ],
      mustFail: [
        `SELECT f.level, count(*), count(rx.id)
FROM facilities f JOIN visits v ON v.facility_id = f.id LEFT JOIN prescriptions rx ON rx.visit_id = v.id
WHERE v.visit_at >= '2025-01-01' AND v.visit_at < '2026-01-01'
GROUP BY f.level`,
        `SELECT f.level, count(DISTINCT v.id), count(rx.id)
FROM facilities f JOIN visits v ON v.facility_id = f.id JOIN prescriptions rx ON rx.visit_id = v.id
WHERE v.visit_at >= '2025-01-01' AND v.visit_at < '2026-01-01'
GROUP BY f.level`,
        `SELECT f.level, count(DISTINCT v.id), count(*)
FROM facilities f JOIN visits v ON v.facility_id = f.id LEFT JOIN prescriptions rx ON rx.visit_id = v.id
WHERE v.visit_at >= '2025-01-01' AND v.visit_at < '2026-01-01'
GROUP BY f.level`,
      ],
    },
  },
  {
    id: 'm01-a10',
    tier: 'B',
    title: 'Emergency share by district',
    prompt:
      'For each district, what percentage of its visits were emergencies? Use every visit in the data. Columns: district, ' +
      'percentage rounded to 1 decimal place (for example 16.7). Any order.',
    hints: [
      'count(*) FILTER (WHERE visit_type = \'emergency\') counts only the emergencies in each group.',
      'Multiply by 100.0, not 100, so the division is not integer division; then round(..., 1).',
    ],
    explanation:
      'A share is a filtered count over a total count in the same group. Dividing two integers in PostgreSQL gives an ' +
      'integer, so 100 * 167 / 1000 is 16, not 16.7. Writing 100.0 makes the arithmetic numeric. The district is on ' +
      'facilities, so join visits to facilities and group by district (a district can have more than one facility).',
    grader: {
      kind: 'result',
      reference: `SELECT f.district,
       round((100.0 * count(*) FILTER (WHERE v.visit_type = 'emergency') / count(*))::numeric, 1)
FROM facilities f
JOIN visits v ON v.facility_id = f.id
GROUP BY f.district`,
      ordered: false,
    },
    tests: {
      mustPass: [
        `SELECT f.district, round(100 * avg((v.visit_type = 'emergency')::int), 1)
FROM visits v JOIN facilities f ON f.id = v.facility_id GROUP BY 1`,
        `SELECT f.district,
       round(sum(CASE WHEN v.visit_type = 'emergency' THEN 1 ELSE 0 END) * 100.0 / count(v.id), 1)
FROM facilities f JOIN visits v ON v.facility_id = f.id GROUP BY f.district`,
      ],
      mustFail: [
        `SELECT f.district, 100 * count(*) FILTER (WHERE v.visit_type = 'emergency') / count(*)
FROM facilities f JOIN visits v ON v.facility_id = f.id GROUP BY f.district`,
        `SELECT f.district, round(100.0 * count(*) FILTER (WHERE v.visit_type = 'emergency') / count(*), 2)
FROM facilities f JOIN visits v ON v.facility_id = f.id GROUP BY f.district`,
        `SELECT f.district, round(100.0 * count(*) FILTER (WHERE v.visit_type = 'emergency') / (SELECT count(*) FROM visits), 1)
FROM facilities f JOIN visits v ON v.facility_id = f.id GROUP BY f.district`,
      ],
    },
  },
  {
    id: 'm01-a11',
    tier: 'B',
    title: 'Diagnoses by sex',
    prompt:
      'For each diagnosis recorded in 2025 (Kampala time), how many visits were by female patients and how many by male ' +
      'patients? Leave out visits with no diagnosis. Columns: diagnosis code, label, female visits, male visits. Any order.',
    hints: [
      'Join visits to patients (for sex) and to diagnoses (for the label), then group by diagnosis.',
      'Two columns from one group: count(*) FILTER (WHERE p.sex = \'F\') and the same for \'M\'.',
    ],
    explanation:
      'FILTER turns one grouped query into a small cross-table: each aggregate counts only the rows its condition accepts. ' +
      'The question counts visits, not people, so count(DISTINCT p.id) answers a different question. An inner join to ' +
      'diagnoses drops visits with no diagnosis; a LEFT JOIN would add a group for NULL.',
    grader: {
      kind: 'result',
      reference: `SELECT d.code, d.label,
       count(*) FILTER (WHERE p.sex = 'F'),
       count(*) FILTER (WHERE p.sex = 'M')
FROM visits v
JOIN patients p ON p.id = v.patient_id
JOIN diagnoses d ON d.code = v.diagnosis_code
WHERE ${IN_2025}
GROUP BY d.code, d.label`,
      ordered: false,
    },
    tests: {
      mustPass: [
        `SELECT v.diagnosis_code, (SELECT label FROM diagnoses WHERE code = v.diagnosis_code),
       sum(CASE WHEN p.sex = 'F' THEN 1 ELSE 0 END), sum(CASE WHEN p.sex = 'M' THEN 1 ELSE 0 END)
FROM visits v JOIN patients p ON p.id = v.patient_id
WHERE v.diagnosis_code IS NOT NULL AND v.visit_at::date BETWEEN '2025-01-01' AND '2025-12-31'
GROUP BY v.diagnosis_code`,
        `SELECT d.code, d.label, count(v.id) FILTER (WHERE p.sex = 'F'), count(v.id) FILTER (WHERE p.sex = 'M')
FROM diagnoses d JOIN visits v ON v.diagnosis_code = d.code JOIN patients p ON v.patient_id = p.id
WHERE extract(year FROM v.visit_at) = 2025
GROUP BY 1, 2`,
      ],
      mustFail: [
        `SELECT d.code, d.label, count(DISTINCT p.id) FILTER (WHERE p.sex = 'F'), count(DISTINCT p.id) FILTER (WHERE p.sex = 'M')
FROM visits v JOIN patients p ON p.id = v.patient_id JOIN diagnoses d ON d.code = v.diagnosis_code
WHERE v.visit_at >= '2025-01-01' AND v.visit_at < '2026-01-01'
GROUP BY d.code, d.label`,
        `SELECT d.code, d.label, count(*) FILTER (WHERE p.sex = 'F'), count(*) FILTER (WHERE p.sex = 'M')
FROM visits v JOIN patients p ON p.id = v.patient_id LEFT JOIN diagnoses d ON d.code = v.diagnosis_code
WHERE v.visit_at >= '2025-01-01' AND v.visit_at < '2026-01-01'
GROUP BY d.code, d.label`,
        `SELECT d.code, d.label, count(*) FILTER (WHERE p.sex = 'F'), count(*) FILTER (WHERE p.sex = 'M')
FROM visits v JOIN patients p ON p.id = v.patient_id JOIN diagnoses d ON d.code = v.diagnosis_code
GROUP BY d.code, d.label`,
      ],
    },
  },

  // ------------------------------------------------------- 1.3 Subqueries and CTEs
  {
    id: 'm01-a12',
    tier: 'B',
    title: 'Patients with no visit in 2025',
    prompt: 'Which patients had no visit at all in 2025 (Kampala time)? Columns: patient id, full name. Any order.',
    hints: [
      'You want patients for whom a matching visit does NOT exist.',
      'WHERE NOT EXISTS (SELECT 1 FROM visits v WHERE v.patient_id = p.id AND v.visit_at >= … AND v.visit_at < …).',
    ],
    explanation:
      'NOT EXISTS asks "is there no such row?" for each patient: an anti-join. A LEFT JOIN works only if the 2025 ' +
      'condition sits in the ON clause; in WHERE it removes the NULL rows you were looking for and returns nothing. ' +
      'Forgetting v.patient_id = p.id makes the subquery the same for every patient, so it answers a different question.',
    grader: {
      kind: 'result',
      reference: `SELECT p.id, p.full_name
FROM patients p
WHERE NOT EXISTS (
  SELECT 1 FROM visits v
  WHERE v.patient_id = p.id AND ${IN_2025})`,
      ordered: false,
    },
    tests: {
      mustPass: [
        `SELECT p.id, p.full_name FROM patients p
LEFT JOIN visits v ON v.patient_id = p.id AND v.visit_at >= '2025-01-01' AND v.visit_at < '2026-01-01'
WHERE v.id IS NULL`,
        `SELECT id, full_name FROM patients
WHERE id NOT IN (SELECT patient_id FROM visits WHERE extract(year FROM visit_at) = 2025)`,
        `SELECT id, full_name FROM patients
EXCEPT
SELECT p.id, p.full_name FROM patients p JOIN visits v ON v.patient_id = p.id WHERE v.visit_at::date BETWEEN '2025-01-01' AND '2025-12-31'`,
      ],
      mustFail: [
        `SELECT p.id, p.full_name FROM patients p LEFT JOIN visits v ON v.patient_id = p.id
WHERE v.visit_at >= '2025-01-01' AND v.visit_at < '2026-01-01' AND v.id IS NULL`,
        `SELECT DISTINCT p.id, p.full_name FROM patients p JOIN visits v ON v.patient_id = p.id
WHERE NOT (v.visit_at >= '2025-01-01' AND v.visit_at < '2026-01-01')`,
        `SELECT id, full_name FROM patients
WHERE id NOT IN (SELECT patient_id FROM visits WHERE visit_at < '2025-01-01')`,
      ],
    },
  },
  {
    id: 'm01-a13',
    tier: 'B',
    title: 'Antenatal visits without iron and folic acid',
    prompt:
      'List antenatal visits from 1 to 7 December 2025 inclusive (Kampala time) at which \'Ferrous sulphate + folic acid\' ' +
      'was not prescribed. Visits with no prescriptions at all count. Columns: visit id, patient id. Any order.',
    hints: [
      'A visit can have several prescriptions. "Not prescribed" is about all of them, not one row.',
      'Use NOT EXISTS with a subquery that looks for that drug on that visit.',
    ],
    explanation:
      'Joining prescriptions and filtering drug <> iron keeps any visit with some other drug, even if iron was also given, ' +
      'and drops visits with no prescriptions at all. "No prescription of X" is an anti-join: NOT EXISTS (or NOT IN over a ' +
      'column with no NULLs). The week is 1 to 7 December inclusive, so the upper bound is visit_at < \'2025-12-08\'.',
    grader: {
      kind: 'result',
      reference: `SELECT v.id, v.patient_id
FROM visits v
WHERE v.visit_type = 'antenatal'
  AND v.visit_at >= '2025-12-01' AND v.visit_at < '2025-12-08'
  AND NOT EXISTS (
    SELECT 1 FROM prescriptions rx JOIN drugs d ON d.id = rx.drug_id
    WHERE rx.visit_id = v.id AND d.name = 'Ferrous sulphate + folic acid')`,
      ordered: false,
    },
    tests: {
      mustPass: [
        `SELECT id, patient_id FROM visits
WHERE visit_type = 'antenatal' AND visit_at::date BETWEEN '2025-12-01' AND '2025-12-07'
  AND id NOT IN (SELECT rx.visit_id FROM prescriptions rx
                 WHERE rx.drug_id = (SELECT id FROM drugs WHERE name = 'Ferrous sulphate + folic acid'))`,
        `SELECT v.id, v.patient_id FROM visits v
LEFT JOIN (prescriptions rx JOIN drugs d ON d.id = rx.drug_id AND d.name = 'Ferrous sulphate + folic acid')
  ON rx.visit_id = v.id
WHERE v.visit_type = 'antenatal' AND v.visit_at >= '2025-12-01' AND v.visit_at < '2025-12-08' AND rx.id IS NULL`,
      ],
      mustFail: [
        `SELECT DISTINCT v.id, v.patient_id FROM visits v
JOIN prescriptions rx ON rx.visit_id = v.id JOIN drugs d ON d.id = rx.drug_id
WHERE v.visit_type = 'antenatal' AND v.visit_at >= '2025-12-01' AND v.visit_at < '2025-12-08'
  AND d.name <> 'Ferrous sulphate + folic acid'`,
        `SELECT v.id, v.patient_id FROM visits v
WHERE v.visit_type = 'antenatal' AND v.visit_at BETWEEN '2025-12-01' AND '2025-12-07'
  AND NOT EXISTS (SELECT 1 FROM prescriptions rx JOIN drugs d ON d.id = rx.drug_id
                  WHERE rx.visit_id = v.id AND d.name = 'Ferrous sulphate + folic acid')`,
        `SELECT v.id, v.patient_id FROM visits v
WHERE v.visit_type = 'antenatal' AND v.visit_at >= '2025-12-01' AND v.visit_at < '2025-12-08'
  AND NOT EXISTS (SELECT 1 FROM prescriptions rx WHERE rx.visit_id = v.id)`,
      ],
    },
  },
  {
    id: 'm01-a14',
    tier: 'B',
    title: 'Back within a week of an emergency',
    prompt:
      'Find emergency visits in November 2025 (Kampala time) after which the same patient came back: any later visit, of ' +
      'any type, no more than 7 days (168 hours) after the emergency visit’s time. The return may fall in December. ' +
      'Columns: emergency visit id, patient id. Each emergency visit once. Any order.',
    hints: [
      'For each emergency visit, ask whether another visit by the same patient exists in the next 7 days.',
      'EXISTS (SELECT 1 FROM visits r WHERE r.patient_id = e.patient_id AND r.visit_at > e.visit_at AND r.visit_at <= e.visit_at + interval \'7 days\').',
    ],
    explanation:
      'EXISTS answers yes or no for each emergency visit, so it never duplicates rows the way a join can when a patient ' +
      'returns twice. The comparison must be strictly later (>), or the emergency visit matches itself. Only the emergency ' +
      'visit is restricted to November; the return visit can be in early December.',
    grader: {
      kind: 'result',
      reference: `SELECT e.id, e.patient_id
FROM visits e
WHERE e.visit_type = 'emergency'
  AND e.visit_at >= '2025-11-01' AND e.visit_at < '2025-12-01'
  AND EXISTS (
    SELECT 1 FROM visits r
    WHERE r.patient_id = e.patient_id
      AND r.visit_at > e.visit_at
      AND r.visit_at <= e.visit_at + interval '7 days')`,
      ordered: false,
    },
    tests: {
      mustPass: [
        `SELECT DISTINCT e.id, e.patient_id FROM visits e
JOIN visits r ON r.patient_id = e.patient_id AND r.visit_at > e.visit_at AND r.visit_at - e.visit_at <= interval '168 hours'
WHERE e.visit_type = 'emergency' AND e.visit_at::date BETWEEN '2025-11-01' AND '2025-11-30'`,
        `WITH nxt AS (
  SELECT id, patient_id, visit_type, visit_at,
         (SELECT min(r.visit_at) FROM visits r WHERE r.patient_id = v.patient_id AND r.visit_at > v.visit_at) AS next_at
  FROM visits v)
SELECT id, patient_id FROM nxt
WHERE visit_type = 'emergency' AND date_trunc('month', visit_at) = '2025-11-01' AND next_at <= visit_at + interval '7 days'`,
      ],
      mustFail: [
        `SELECT e.id, e.patient_id FROM visits e
WHERE e.visit_type = 'emergency' AND e.visit_at >= '2025-11-01' AND e.visit_at < '2025-12-01'
  AND EXISTS (SELECT 1 FROM visits r WHERE r.patient_id = e.patient_id
              AND r.visit_at >= e.visit_at AND r.visit_at <= e.visit_at + interval '7 days')`,
        `SELECT e.id, e.patient_id FROM visits e
WHERE e.visit_type = 'emergency' AND e.visit_at >= '2025-11-01' AND e.visit_at < '2025-12-01'
  AND EXISTS (SELECT 1 FROM visits r WHERE r.patient_id = e.patient_id
              AND r.visit_at > e.visit_at AND r.visit_at <= e.visit_at + interval '7 days'
              AND r.visit_at < '2025-12-01')`,
        `SELECT e.id, e.patient_id FROM visits e
WHERE e.visit_type = 'emergency' AND e.visit_at >= '2025-11-01' AND e.visit_at < '2025-12-01'
  AND EXISTS (SELECT 1 FROM visits r WHERE r.patient_id = e.patient_id AND r.visit_type = 'follow-up'
              AND r.visit_at > e.visit_at AND r.visit_at <= e.visit_at + interval '7 days')`,
      ],
    },
  },
  {
    id: 'm01-a15',
    tier: 'B',
    title: 'Stock below November’s prescriptions',
    prompt:
      'Where is current stock lower than what was prescribed in November 2025? For each facility and drug, add up the ' +
      'quantity of all prescriptions (dispensed or not) written at that facility’s visits in November 2025 (Kampala time), ' +
      'and compare it with stock.quantity_on_hand. Show only pairs where stock is lower. Columns: facility name, drug name, ' +
      'quantity prescribed, quantity on hand. Any order.',
    hints: [
      'First total the prescriptions per facility and drug in a CTE (WITH prescribed AS (…)). Then join that to stock.',
      'stock has one row per facility and drug: join on both facility_id and drug_id.',
    ],
    explanation:
      'A CTE names an intermediate result, here the November totals per facility and drug, so the main query reads like ' +
      'the question. stock’s key is (facility_id, drug_id): joining on drug_id alone pairs each total with every ' +
      'facility’s stock. The prescriptions belong to a facility through their visit.',
    grader: {
      kind: 'result',
      reference: `WITH prescribed AS (
  SELECT v.facility_id, rx.drug_id, sum(rx.quantity) AS qty
  FROM visits v
  JOIN prescriptions rx ON rx.visit_id = v.id
  WHERE v.visit_at >= '2025-11-01' AND v.visit_at < '2025-12-01'
  GROUP BY v.facility_id, rx.drug_id
)
SELECT f.name, d.name, p.qty, s.quantity_on_hand
FROM prescribed p
JOIN stock s ON s.facility_id = p.facility_id AND s.drug_id = p.drug_id
JOIN facilities f ON f.id = p.facility_id
JOIN drugs d ON d.id = p.drug_id
WHERE s.quantity_on_hand < p.qty`,
      ordered: false,
    },
    tests: {
      mustPass: [
        `SELECT f.name, d.name, sum(rx.quantity), s.quantity_on_hand
FROM visits v
JOIN prescriptions rx ON rx.visit_id = v.id
JOIN stock s ON s.facility_id = v.facility_id AND s.drug_id = rx.drug_id
JOIN facilities f ON f.id = v.facility_id
JOIN drugs d ON d.id = rx.drug_id
WHERE v.visit_at::date BETWEEN '2025-11-01' AND '2025-11-30'
GROUP BY f.name, d.name, s.quantity_on_hand
HAVING s.quantity_on_hand < sum(rx.quantity)`,
        `SELECT f.name, d.name, t.qty, s.quantity_on_hand
FROM stock s
JOIN facilities f ON f.id = s.facility_id
JOIN drugs d ON d.id = s.drug_id
CROSS JOIN LATERAL (
  SELECT sum(rx.quantity) AS qty FROM prescriptions rx JOIN visits v ON v.id = rx.visit_id
  WHERE v.facility_id = s.facility_id AND rx.drug_id = s.drug_id
    AND date_trunc('month', v.visit_at) = '2025-11-01') t
WHERE s.quantity_on_hand < t.qty`,
      ],
      mustFail: [
        `SELECT f.name, d.name, sum(rx.quantity), s.quantity_on_hand
FROM visits v
JOIN prescriptions rx ON rx.visit_id = v.id
JOIN stock s ON s.drug_id = rx.drug_id
JOIN facilities f ON f.id = s.facility_id
JOIN drugs d ON d.id = rx.drug_id
WHERE v.visit_at >= '2025-11-01' AND v.visit_at < '2025-12-01'
GROUP BY f.name, d.name, s.quantity_on_hand
HAVING s.quantity_on_hand < sum(rx.quantity)`,
        `WITH prescribed AS (
  SELECT v.facility_id, rx.drug_id, sum(rx.quantity) AS qty FROM visits v JOIN prescriptions rx ON rx.visit_id = v.id
  WHERE v.visit_at >= '2025-11-01' AND v.visit_at < '2025-12-01' AND rx.dispensed
  GROUP BY 1, 2)
SELECT f.name, d.name, p.qty, s.quantity_on_hand FROM prescribed p
JOIN stock s USING (facility_id, drug_id) JOIN facilities f ON f.id = p.facility_id JOIN drugs d ON d.id = p.drug_id
WHERE s.quantity_on_hand < p.qty`,
        `WITH prescribed AS (
  SELECT v.facility_id, rx.drug_id, sum(rx.quantity) AS qty FROM visits v JOIN prescriptions rx ON rx.visit_id = v.id
  WHERE v.visit_at::date BETWEEN '2025-11-01' AND '2025-12-01'
  GROUP BY 1, 2)
SELECT f.name, d.name, p.qty, s.quantity_on_hand FROM prescribed p
JOIN stock s USING (facility_id, drug_id) JOIN facilities f ON f.id = p.facility_id JOIN drugs d ON d.id = p.drug_id
WHERE s.quantity_on_hand < p.qty`,
      ],
    },
  },
  {
    id: 'm01-a16',
    tier: 'B',
    title: 'Visits per patient seen',
    prompt:
      'For each facility, take the patients who had at least one visit there in 2025 (Kampala time). How many such patients ' +
      'were there, and how many 2025 visits did each have on average? Columns: facility name, patients seen, average visits ' +
      'per patient rounded to 2 decimal places. Any order.',
    hints: [
      'This is an average of counts: first count visits per patient, then average those counts per facility.',
      'A CTE grouped by facility and patient gives the counts; group that again by facility.',
    ],
    explanation:
      'Aggregating an aggregate needs two levels: a CTE or subquery counts visits per patient, and the outer query averages ' +
      'them. Dividing by everyone registered at the facility answers a different question, because some registered ' +
      'patients were not seen in 2025. Watch integer division: count(*) / count(DISTINCT patient_id) drops the decimals.',
    grader: {
      kind: 'result',
      reference: `WITH per_patient AS (
  SELECT v.facility_id, v.patient_id, count(*) AS n
  FROM visits v
  WHERE ${IN_2025}
  GROUP BY v.facility_id, v.patient_id
)
SELECT f.name, count(*), round(avg(pp.n)::numeric, 2)
FROM per_patient pp
JOIN facilities f ON f.id = pp.facility_id
GROUP BY f.id, f.name`,
      ordered: false,
    },
    tests: {
      mustPass: [
        `SELECT f.name, count(DISTINCT v.patient_id), round(count(*)::numeric / count(DISTINCT v.patient_id), 2)
FROM visits v JOIN facilities f ON f.id = v.facility_id
WHERE extract(year FROM v.visit_at) = 2025
GROUP BY f.name`,
        `SELECT f.name, x.patients, round(x.visits * 1.0 / x.patients, 2)
FROM facilities f
JOIN (SELECT facility_id, count(*) AS visits, count(DISTINCT patient_id) AS patients
      FROM visits WHERE visit_at::date BETWEEN '2025-01-01' AND '2025-12-31' GROUP BY facility_id) x
  ON x.facility_id = f.id`,
      ],
      mustFail: [
        `SELECT f.name, (SELECT count(*) FROM patients p WHERE p.facility_id = f.id),
       round((SELECT count(*) FROM visits v WHERE v.facility_id = f.id AND v.visit_at >= '2025-01-01' AND v.visit_at < '2026-01-01')::numeric
             / (SELECT count(*) FROM patients p WHERE p.facility_id = f.id), 2)
FROM facilities f`,
        `SELECT f.name, count(DISTINCT v.patient_id), count(*) / count(DISTINCT v.patient_id)
FROM visits v JOIN facilities f ON f.id = v.facility_id
WHERE v.visit_at >= '2025-01-01' AND v.visit_at < '2026-01-01'
GROUP BY f.name`,
        `SELECT f.name, count(DISTINCT v.patient_id), round(count(*)::numeric / count(DISTINCT v.patient_id), 1)
FROM visits v JOIN facilities f ON f.id = v.facility_id
WHERE v.visit_at >= '2025-01-01' AND v.visit_at < '2026-01-01'
GROUP BY f.name`,
      ],
    },
  },

  // ------------------------------------------------------- 1.4 Recursive CTEs
  {
    id: 'm01-a17',
    tier: 'B',
    title: 'Each facility’s referral chain',
    prompt:
      'Follow each facility’s referrals until you reach a facility that refers to no one: its top facility. For every ' +
      'facility, show its name, the name of its top facility, and the number of referral steps to get there (0 if it ' +
      'refers to no one, so it is its own top facility). Any order. Use WITH RECURSIVE: chains can be any length.',
    hints: [
      'Anchor: every facility as a starting point, at step 0. Recursive step: move one hop along referral_facility_id and add 1.',
      'Carry the starting facility’s id through every row, and keep only the rows where the current facility refers to no one.',
    ],
    explanation:
      'A recursive CTE has an anchor (each facility, step 0) and a recursive term that follows one referral at a time. ' +
      'Carrying the starting id along lets you report each chain’s end. Keep only rows whose current facility has no ' +
      'referral, or every intermediate hop appears too. Starting the count at 1 is the usual off-by-one. Joining the table ' +
      'to itself a fixed number of times works only while chains stay short; recursion works for any length.',
    grader: {
      kind: 'result',
      reference: `WITH RECURSIVE chain AS (
  SELECT id AS start_id, id AS current_id, referral_facility_id AS next_id, 0 AS steps
  FROM facilities
  UNION ALL
  SELECT c.start_id, f.id, f.referral_facility_id, c.steps + 1
  FROM chain c
  JOIN facilities f ON f.id = c.next_id
)
SELECT s.name, t.name, c.steps
FROM chain c
JOIN facilities s ON s.id = c.start_id
JOIN facilities t ON t.id = c.current_id
WHERE c.next_id IS NULL`,
      ordered: false,
      requires: [{ pattern: '\\bwith\\s+recursive\\b', message: 'Use WITH RECURSIVE: a referral chain can be any length.' }],
    },
    tests: {
      mustPass: [
        `WITH RECURSIVE tree AS (
  SELECT id, id AS top_id, 0 AS depth FROM facilities WHERE referral_facility_id IS NULL
  UNION ALL
  SELECT f.id, t.top_id, t.depth + 1 FROM facilities f JOIN tree t ON f.referral_facility_id = t.id
)
SELECT f.name, top.name, tree.depth FROM tree JOIN facilities f ON f.id = tree.id JOIN facilities top ON top.id = tree.top_id`,
        `WITH RECURSIVE up(start_id, fid, steps) AS (
  SELECT id, id, 0 FROM facilities
  UNION ALL
  SELECT up.start_id, f.referral_facility_id, up.steps + 1
  FROM up JOIN facilities f ON f.id = up.fid
  WHERE f.referral_facility_id IS NOT NULL
)
SELECT DISTINCT ON (up.start_id) s.name, t.name, up.steps
FROM up JOIN facilities s ON s.id = up.start_id JOIN facilities t ON t.id = up.fid
ORDER BY up.start_id, up.steps DESC`,
      ],
      mustFail: [
        `WITH RECURSIVE chain AS (
  SELECT id AS start_id, id AS current_id, referral_facility_id AS next_id, 1 AS steps FROM facilities
  UNION ALL
  SELECT c.start_id, f.id, f.referral_facility_id, c.steps + 1 FROM chain c JOIN facilities f ON f.id = c.next_id
)
SELECT s.name, t.name, c.steps FROM chain c JOIN facilities s ON s.id = c.start_id JOIN facilities t ON t.id = c.current_id
WHERE c.next_id IS NULL`,
        `WITH RECURSIVE chain AS (
  SELECT id AS start_id, id AS current_id, referral_facility_id AS next_id, 0 AS steps FROM facilities
  UNION ALL
  SELECT c.start_id, f.id, f.referral_facility_id, c.steps + 1 FROM chain c JOIN facilities f ON f.id = c.next_id
)
SELECT s.name, t.name, c.steps FROM chain c JOIN facilities s ON s.id = c.start_id JOIN facilities t ON t.id = c.current_id`,
        `WITH RECURSIVE chain AS (
  SELECT id AS start_id, id AS current_id, referral_facility_id AS next_id, 0 AS steps FROM facilities
  WHERE referral_facility_id IS NOT NULL
  UNION ALL
  SELECT c.start_id, f.id, f.referral_facility_id, c.steps + 1 FROM chain c JOIN facilities f ON f.id = c.next_id
)
SELECT s.name, t.name, c.steps FROM chain c JOIN facilities s ON s.id = c.start_id JOIN facilities t ON t.id = c.current_id
WHERE c.next_id IS NULL`,
        `SELECT f.name, coalesce(r2.name, r1.name, f.name),
       CASE WHEN r2.id IS NOT NULL THEN 2 WHEN r1.id IS NOT NULL THEN 1 ELSE 0 END
FROM facilities f
LEFT JOIN facilities r1 ON r1.id = f.referral_facility_id
LEFT JOIN facilities r2 ON r2.id = r1.referral_facility_id`,
      ],
    },
  },
  {
    id: 'm01-a18',
    tier: 'B',
    title: 'A December calendar of malaria emergencies',
    prompt:
      'For every day of December 2025 (Kampala time), how many emergency visits diagnosed as malaria (code B54) were ' +
      'there at general hospitals (level \'General Hospital\')? Include days with none, as 0. Columns: day (a date, ' +
      'not a timestamp), number of visits. Order by day.',
    hints: [
      'Build the 31 days first, with WITH RECURSIVE (or generate_series), then LEFT JOIN the visits to them.',
      'Match visits on visit_at::date = day, put the type, diagnosis and level conditions in the ON clause, and count a visit column.',
    ],
    explanation:
      'Grouping the visits alone can only produce days that had visits; a quiet day is simply missing. A calendar, built ' +
      'by a recursive CTE (start at 1 December, add a day until 31 December) or generate_series, supplies every day, and a ' +
      'LEFT JOIN with count(v.id) turns the empty ones into 0. Match on visit_at::date = day, which uses the session ' +
      'time zone, Kampala; visit_at = day compares with midnight and matches almost nothing.',
    grader: {
      kind: 'result',
      reference: `WITH RECURSIVE days AS (
  SELECT date '2025-12-01' AS day
  UNION ALL
  SELECT day + 1 FROM days WHERE day < date '2025-12-31'
)
SELECT d.day, count(v.id)
FROM days d
LEFT JOIN visits v
  ON v.visit_at::date = d.day
 AND v.visit_type = 'emergency' AND v.diagnosis_code = 'B54'
 AND v.facility_id IN (SELECT id FROM facilities WHERE level = 'General Hospital')
GROUP BY d.day
ORDER BY d.day`,
      ordered: true,
    },
    tests: {
      mustPass: [
        `SELECT g::date AS day,
       (SELECT count(*) FROM visits v JOIN facilities f ON f.id = v.facility_id
        WHERE f.level = 'General Hospital' AND v.visit_type = 'emergency' AND v.diagnosis_code = 'B54' AND v.visit_at::date = g::date)
FROM generate_series(date '2025-12-01', date '2025-12-31', interval '1 day') AS g
ORDER BY 1`,
        `WITH counts AS (
  SELECT v.visit_at::date AS day, count(*) AS n FROM visits v JOIN facilities f ON f.id = v.facility_id
  WHERE f.level = 'General Hospital' AND v.visit_type = 'emergency' AND v.diagnosis_code = 'B54'
    AND v.visit_at >= '2025-12-01' AND v.visit_at < '2026-01-01'
  GROUP BY 1)
SELECT g::date, coalesce(c.n, 0)
FROM generate_series(timestamp '2025-12-01', timestamp '2025-12-31', interval '1 day') g
LEFT JOIN counts c ON c.day = g::date
ORDER BY g`,
      ],
      mustFail: [
        `SELECT v.visit_at::date, count(*) FROM visits v JOIN facilities f ON f.id = v.facility_id
WHERE f.level = 'General Hospital' AND v.visit_type = 'emergency' AND v.diagnosis_code = 'B54'
  AND v.visit_at >= '2025-12-01' AND v.visit_at < '2026-01-01'
GROUP BY 1 ORDER BY 1`,
        `WITH RECURSIVE days AS (SELECT date '2025-12-01' AS day UNION ALL SELECT day + 1 FROM days WHERE day < date '2025-12-31')
SELECT d.day, count(*) FROM days d
LEFT JOIN visits v ON v.visit_at::date = d.day AND v.visit_type = 'emergency' AND v.diagnosis_code = 'B54'
 AND v.facility_id IN (SELECT id FROM facilities WHERE level = 'General Hospital')
GROUP BY d.day ORDER BY d.day`,
        `WITH RECURSIVE days AS (SELECT date '2025-12-01' AS day UNION ALL SELECT day + 1 FROM days WHERE day <= date '2025-12-31')
SELECT d.day, count(v.id) FROM days d
LEFT JOIN visits v ON v.visit_at::date = d.day AND v.visit_type = 'emergency' AND v.diagnosis_code = 'B54'
 AND v.facility_id IN (SELECT id FROM facilities WHERE level = 'General Hospital')
GROUP BY d.day ORDER BY d.day`,
        `WITH RECURSIVE days AS (SELECT date '2025-12-01' AS day UNION ALL SELECT day + 1 FROM days WHERE day < date '2025-12-31')
SELECT d.day, count(v.id) FROM days d
LEFT JOIN visits v ON v.visit_at = d.day AND v.visit_type = 'emergency' AND v.diagnosis_code = 'B54'
 AND v.facility_id IN (SELECT id FROM facilities WHERE level = 'General Hospital')
GROUP BY d.day ORDER BY d.day`,
      ],
    },
  },

  // ------------------------------------------------------- 1.5 Window functions
  {
    id: 'm01-a19',
    tier: 'B',
    title: 'Running total of visits in 2025',
    prompt:
      'For each month of 2025 (Kampala time), show the number of visits and the running total from January up to and ' +
      'including that month. Columns: month as a date, its first day (for example 2025-03-01, not a timestamp), visits, running total. ' +
      'Order by month.',
    hints: [
      'Count per month first (date_trunc(\'month\', visit_at)::date), then add a window over those rows.',
      'sum(n) OVER (ORDER BY month) adds up every month up to the current one.',
    ],
    explanation:
      'A window function sees the rows of the result without collapsing them. With ORDER BY in the OVER clause, sum() ' +
      'adds the current row and every row before it: a running total. Without ORDER BY, every row gets the grand total. ' +
      'Filter to 2025 before the window: computing over both years and filtering afterwards starts the total in 2024.',
    grader: {
      kind: 'result',
      reference: `SELECT month, n, sum(n) OVER (ORDER BY month)
FROM (
  SELECT date_trunc('month', v.visit_at)::date AS month, count(*) AS n
  FROM visits v
  WHERE ${IN_2025}
  GROUP BY 1
) m
ORDER BY month`,
      ordered: true,
    },
    tests: {
      mustPass: [
        `SELECT date_trunc('month', visit_at)::date, count(*), sum(count(*)) OVER (ORDER BY date_trunc('month', visit_at))
FROM visits WHERE extract(year FROM visit_at) = 2025
GROUP BY date_trunc('month', visit_at)
ORDER BY 1`,
        `WITH m AS (
  SELECT date_trunc('month', visit_at)::date AS month, count(*) AS n FROM visits
  WHERE visit_at::date BETWEEN '2025-01-01' AND '2025-12-31' GROUP BY 1)
SELECT a.month, a.n, (SELECT sum(b.n) FROM m b WHERE b.month <= a.month) FROM m a ORDER BY a.month`,
      ],
      mustFail: [
        `SELECT month, n, sum(n) OVER ()
FROM (SELECT date_trunc('month', visit_at)::date AS month, count(*) AS n FROM visits
      WHERE visit_at >= '2025-01-01' AND visit_at < '2026-01-01' GROUP BY 1) m
ORDER BY month`,
        `SELECT * FROM (
  SELECT month, n, sum(n) OVER (ORDER BY month) AS total
  FROM (SELECT date_trunc('month', visit_at)::date AS month, count(*) AS n FROM visits GROUP BY 1) m) t
WHERE month >= '2025-01-01'
ORDER BY month`,
        `SELECT month, n, sum(n) OVER (ORDER BY month DESC)
FROM (SELECT date_trunc('month', visit_at)::date AS month, count(*) AS n FROM visits
      WHERE visit_at >= '2025-01-01' AND visit_at < '2026-01-01' GROUP BY 1) m
ORDER BY month`,
      ],
    },
  },
  {
    id: 'm01-a20',
    tier: 'B',
    title: 'Diagnosis share within each level',
    prompt:
      'For each facility level, what share of its diagnosed visits had each diagnosis? Use every visit in the data and ' +
      'leave out visits with no diagnosis. Columns: level, diagnosis code, visits, percentage of that level’s ' +
      'diagnosed visits rounded to 1 decimal place. Any order.',
    hints: [
      'Group by level and diagnosis for the visit counts. The level’s total is a sum over several of those groups.',
      'sum(count(*)) OVER (PARTITION BY f.level) gives each row its level’s total.',
    ],
    explanation:
      'A window function can run over grouped rows: sum(count(*)) OVER (PARTITION BY level) adds up the counts of every ' +
      'diagnosis in the same level, without collapsing the rows. Without PARTITION BY, the denominator is every diagnosed ' +
      'visit in the clinic. Remove the undiagnosed visits before counting, so they are not in the denominator either.',
    grader: {
      kind: 'result',
      reference: `SELECT f.level, v.diagnosis_code, count(*),
       round((100.0 * count(*) / sum(count(*)) OVER (PARTITION BY f.level))::numeric, 1)
FROM visits v
JOIN facilities f ON f.id = v.facility_id
WHERE v.diagnosis_code IS NOT NULL
GROUP BY f.level, v.diagnosis_code`,
      ordered: false,
    },
    tests: {
      mustPass: [
        `WITH c AS (
  SELECT f.level, v.diagnosis_code AS code, count(*) AS n FROM visits v JOIN facilities f ON f.id = v.facility_id
  WHERE v.diagnosis_code IS NOT NULL GROUP BY 1, 2),
t AS (SELECT level, sum(n) AS total FROM c GROUP BY level)
SELECT c.level, c.code, c.n, round(100.0 * c.n / t.total, 1) FROM c JOIN t USING (level)`,
        `SELECT level, code, n, round(100 * n::numeric / sum(n) OVER w, 1)
FROM (SELECT f.level, d.code, count(*) AS n FROM visits v JOIN facilities f ON f.id = v.facility_id
      JOIN diagnoses d ON d.code = v.diagnosis_code GROUP BY 1, 2) x
WINDOW w AS (PARTITION BY level)`,
      ],
      mustFail: [
        `SELECT f.level, v.diagnosis_code, count(*), round(100.0 * count(*) / sum(count(*)) OVER (), 1)
FROM visits v JOIN facilities f ON f.id = v.facility_id
WHERE v.diagnosis_code IS NOT NULL GROUP BY f.level, v.diagnosis_code`,
        `SELECT * FROM (
  SELECT f.level, v.diagnosis_code, count(*) AS n, round(100.0 * count(*) / sum(count(*)) OVER (PARTITION BY f.level), 1) AS pct
  FROM visits v JOIN facilities f ON f.id = v.facility_id GROUP BY f.level, v.diagnosis_code) x
WHERE diagnosis_code IS NOT NULL`,
        `SELECT f.level, v.diagnosis_code, count(*), 100 * count(*) / sum(count(*)) OVER (PARTITION BY f.level)::int
FROM visits v JOIN facilities f ON f.id = v.facility_id
WHERE v.diagnosis_code IS NOT NULL GROUP BY f.level, v.diagnosis_code`,
      ],
    },
  },
  {
    id: 'm01-a21',
    tier: 'B',
    title: 'Each facility’s busiest month',
    prompt:
      'For each facility, which month had the most visits, across all the data? A month means a month of a particular ' +
      'year, in Kampala time (December 2024 and December 2025 are different months). If months tie, show all of them. ' +
      'Columns: facility name, month as a date, its first day (for example 2025-03-01, not a timestamp), visits. Any order.',
    hints: [
      'Count visits per facility and month first, then rank the months within each facility.',
      'rank() OVER (PARTITION BY facility_id ORDER BY n DESC), and keep rank 1. rank() gives tied rows the same rank.',
    ],
    explanation:
      'Rank inside each facility with PARTITION BY, then keep rank 1. rank() keeps ties; row_number() would pick one ' +
      'tied month arbitrarily. extract(month …) merges December 2024 with December 2025, which is a different ' +
      'question; date_trunc(\'month\', visit_at) keeps the year and works in the session time zone.',
    grader: {
      kind: 'result',
      reference: `WITH monthly AS (
  SELECT v.facility_id, date_trunc('month', v.visit_at)::date AS month, count(*) AS n
  FROM visits v
  GROUP BY 1, 2
), ranked AS (
  SELECT m.*, rank() OVER (PARTITION BY m.facility_id ORDER BY m.n DESC) AS r
  FROM monthly m
)
SELECT f.name, r.month, r.n
FROM ranked r
JOIN facilities f ON f.id = r.facility_id
WHERE r.r = 1`,
      ordered: false,
    },
    tests: {
      mustPass: [
        `WITH monthly AS (
  SELECT facility_id, date_trunc('month', visit_at)::date AS month, count(*) AS n FROM visits GROUP BY 1, 2)
SELECT f.name, m.month, m.n FROM monthly m JOIN facilities f ON f.id = m.facility_id
WHERE m.n = (SELECT max(n) FROM monthly m2 WHERE m2.facility_id = m.facility_id)`,
        `SELECT name, month, n FROM (
  SELECT f.name, date_trunc('month', v.visit_at)::date AS month, count(*) AS n,
         max(count(*)) OVER (PARTITION BY f.id) AS best
  FROM visits v JOIN facilities f ON f.id = v.facility_id GROUP BY f.id, f.name, 2) x
WHERE n = best`,
      ],
      mustFail: [
        `WITH monthly AS (
  SELECT facility_id, date_trunc('month', visit_at)::date AS month, count(*) AS n FROM visits GROUP BY 1, 2),
ranked AS (SELECT *, rank() OVER (ORDER BY n DESC) AS r FROM monthly)
SELECT f.name, month, n FROM ranked JOIN facilities f ON f.id = facility_id WHERE r = 1`,
        `WITH monthly AS (
  SELECT facility_id, date_trunc('month', visit_at AT TIME ZONE 'UTC')::date AS month, count(*) AS n FROM visits GROUP BY 1, 2),
ranked AS (SELECT *, rank() OVER (PARTITION BY facility_id ORDER BY n DESC) AS r FROM monthly)
SELECT f.name, month, n FROM ranked JOIN facilities f ON f.id = facility_id WHERE r = 1`,
        `WITH monthly AS (
  SELECT facility_id, date_trunc('month', visit_at)::date AS month, count(*) AS n FROM visits GROUP BY 1, 2),
ranked AS (SELECT *, rank() OVER (PARTITION BY facility_id ORDER BY n) AS r FROM monthly)
SELECT f.name, month, n FROM ranked JOIN facilities f ON f.id = facility_id WHERE r = 1`,
        `WITH monthly AS (
  SELECT facility_id, date_trunc('month', visit_at)::date AS month, count(*) AS n FROM visits GROUP BY 1, 2),
ranked AS (SELECT *, row_number() OVER (PARTITION BY facility_id ORDER BY n DESC) AS r FROM monthly)
SELECT f.name, month, n FROM ranked JOIN facilities f ON f.id = facility_id WHERE r = 1`,
      ],
    },
  },
  {
    id: 'm01-a22',
    tier: 'B',
    title: 'Days since the previous visit',
    prompt:
      'For each emergency visit from 1 to 7 December 2025 inclusive (Kampala time), how many days had passed since the ' +
      'same patient’s previous visit of any type? Count calendar days in Kampala time: this visit’s date minus the ' +
      'previous visit’s date. The previous visit may be before December. Show NULL if there is no earlier visit. If two ' +
      'visits share a time, the lower id counts as earlier. Columns: visit id, patient id, days since previous visit. ' +
      'Any order.',
    hints: [
      'lag(visit_at) OVER (PARTITION BY patient_id ORDER BY visit_at, id) gives the previous visit’s time.',
      'Compute lag over all visits in a subquery or CTE, then keep the emergency visits of that week in the outer query. Subtract dates: visit_at::date - previous::date.',
    ],
    explanation:
      'lag() looks at the previous row in the window. Window functions run after WHERE, so any filter in the same query ' +
      'changes what counts as "previous": filter to the week and earlier visits vanish (most answers become NULL); filter ' +
      'to emergencies and you measure from the previous emergency instead. Compute first, filter afterwards. Subtracting ' +
      'two dates gives calendar days; extract(day FROM a - b) on timestamps counts full 24-hour periods, which is not the same.',
    grader: {
      kind: 'result',
      reference: `WITH x AS (
  SELECT v.id, v.patient_id, v.visit_at, v.visit_type,
         v.visit_at::date - lag(v.visit_at::date) OVER (PARTITION BY v.patient_id ORDER BY v.visit_at, v.id) AS gap
  FROM visits v
)
SELECT id, patient_id, gap
FROM x
WHERE visit_type = 'emergency'
  AND visit_at >= '2025-12-01' AND visit_at < '2025-12-08'`,
      ordered: false,
    },
    tests: {
      mustPass: [
        `SELECT v.id, v.patient_id,
       v.visit_at::date - (SELECT p.visit_at::date FROM visits p
                           WHERE p.patient_id = v.patient_id
                             AND (p.visit_at < v.visit_at OR (p.visit_at = v.visit_at AND p.id < v.id))
                           ORDER BY p.visit_at DESC, p.id DESC LIMIT 1)
FROM visits v
WHERE v.visit_type = 'emergency' AND v.visit_at::date BETWEEN '2025-12-01' AND '2025-12-07'`,
        `SELECT id, patient_id, d - prev FROM (
  SELECT id, patient_id, visit_type, visit_at::date AS d, lag(visit_at::date) OVER w AS prev
  FROM visits WINDOW w AS (PARTITION BY patient_id ORDER BY visit_at, id)) t
WHERE visit_type = 'emergency' AND d BETWEEN '2025-12-01' AND '2025-12-07'`,
      ],
      mustFail: [
        `SELECT id, patient_id, visit_at::date - lag(visit_at::date) OVER (PARTITION BY patient_id ORDER BY visit_at, id)
FROM visits
WHERE visit_type = 'emergency' AND visit_at >= '2025-12-01' AND visit_at < '2025-12-08'`,
        `WITH x AS (
  SELECT id, patient_id, visit_at,
         visit_at::date - lag(visit_at::date) OVER (PARTITION BY patient_id ORDER BY visit_at, id) AS gap
  FROM visits WHERE visit_type = 'emergency')
SELECT id, patient_id, gap FROM x WHERE visit_at >= '2025-12-01' AND visit_at < '2025-12-08'`,
        `WITH x AS (
  SELECT id, patient_id, visit_type, visit_at,
         extract(day FROM visit_at - lag(visit_at) OVER (PARTITION BY patient_id ORDER BY visit_at, id)) AS gap
  FROM visits)
SELECT id, patient_id, gap FROM x
WHERE visit_type = 'emergency' AND visit_at >= '2025-12-01' AND visit_at < '2025-12-08'`,
        `WITH x AS (
  SELECT id, patient_id, visit_type, visit_at,
         visit_at::date - lag(visit_at::date) OVER (ORDER BY visit_at, id) AS gap
  FROM visits)
SELECT id, patient_id, gap FROM x
WHERE visit_type = 'emergency' AND visit_at >= '2025-12-01' AND visit_at < '2025-12-08'`,
      ],
    },
  },
  {
    id: 'm01-a23',
    tier: 'B',
    title: 'Top three diagnoses per facility',
    prompt:
      'For each facility, find its most common diagnoses in 2025 (Kampala time), ignoring visits with no diagnosis. Rank ' +
      'by number of visits, most first; equal counts share a rank and the next rank skips (1, 2, 2, 4). Keep every ' +
      'diagnosis ranked 3 or better, so a tie for third place shows all the tied diagnoses. Columns: facility name, ' +
      'diagnosis code, visits. Any order.',
    hints: [
      'Count per facility and diagnosis, then rank within each facility.',
      'The ranking described is rank(), not dense_rank() or row_number(). Keep rank <= 3.',
    ],
    explanation:
      'The three ranking functions differ only at ties: row_number() never ties (it breaks them arbitrarily), rank() ties ' +
      'and then skips (1, 2, 2, 4), dense_rank() ties without skipping (1, 2, 2, 3). "Top 3 with ties" is rank() <= 3. ' +
      'Remove visits with no diagnosis before ranking, or NULL can take a place in the top three.',
    grader: {
      kind: 'result',
      reference: `WITH counts AS (
  SELECT v.facility_id, v.diagnosis_code, count(*) AS n
  FROM visits v
  WHERE v.diagnosis_code IS NOT NULL AND ${IN_2025}
  GROUP BY 1, 2
), ranked AS (
  SELECT c.*, rank() OVER (PARTITION BY c.facility_id ORDER BY c.n DESC) AS r
  FROM counts c
)
SELECT f.name, r.diagnosis_code, r.n
FROM ranked r
JOIN facilities f ON f.id = r.facility_id
WHERE r.r <= 3`,
      ordered: false,
    },
    tests: {
      mustPass: [
        `SELECT name, code, n FROM (
  SELECT f.name, v.diagnosis_code AS code, count(*) AS n,
         rank() OVER (PARTITION BY f.id ORDER BY count(*) DESC) AS r
  FROM visits v JOIN facilities f ON f.id = v.facility_id
  WHERE v.diagnosis_code IS NOT NULL AND extract(year FROM v.visit_at) = 2025
  GROUP BY f.id, f.name, v.diagnosis_code) x
WHERE r <= 3`,
        `WITH c AS (
  SELECT facility_id, diagnosis_code, count(*) AS n FROM visits
  WHERE diagnosis_code IS NOT NULL AND visit_at::date BETWEEN '2025-01-01' AND '2025-12-31' GROUP BY 1, 2)
SELECT f.name, c.diagnosis_code, c.n FROM c JOIN facilities f ON f.id = c.facility_id
WHERE (SELECT count(*) FROM c c2 WHERE c2.facility_id = c.facility_id AND c2.n > c.n) < 3`,
      ],
      mustFail: [
        `WITH c AS (
  SELECT facility_id, diagnosis_code, count(*) AS n FROM visits
  WHERE diagnosis_code IS NOT NULL AND visit_at >= '2025-01-01' AND visit_at < '2026-01-01' GROUP BY 1, 2),
r AS (SELECT *, rank() OVER (ORDER BY n DESC) AS r FROM c)
SELECT f.name, diagnosis_code, n FROM r JOIN facilities f ON f.id = facility_id WHERE r <= 3`,
        `WITH c AS (
  SELECT facility_id, diagnosis_code, count(*) AS n FROM visits
  WHERE diagnosis_code IS NOT NULL GROUP BY 1, 2),
r AS (SELECT *, rank() OVER (PARTITION BY facility_id ORDER BY n DESC) AS r FROM c)
SELECT f.name, diagnosis_code, n FROM r JOIN facilities f ON f.id = facility_id WHERE r <= 3`,
        `WITH c AS (
  SELECT facility_id, diagnosis_code, count(*) AS n FROM visits
  WHERE diagnosis_code IS NOT NULL AND visit_at >= '2025-01-01' AND visit_at < '2026-01-01' GROUP BY 1, 2),
r AS (SELECT *, rank() OVER (PARTITION BY facility_id ORDER BY n) AS r FROM c)
SELECT f.name, diagnosis_code, n FROM r JOIN facilities f ON f.id = facility_id WHERE r <= 3`,
        `WITH c AS (
  SELECT facility_id, diagnosis_code, count(*) AS n FROM visits
  WHERE diagnosis_code IS NOT NULL AND visit_at >= '2025-01-01' AND visit_at < '2026-01-01' GROUP BY 1, 2),
r AS (SELECT *, row_number() OVER (PARTITION BY facility_id ORDER BY n DESC) AS r FROM c)
SELECT f.name, diagnosis_code, n FROM r JOIN facilities f ON f.id = facility_id WHERE r <= 3`,
        `WITH c AS (
  SELECT facility_id, diagnosis_code, count(*) AS n FROM visits
  WHERE diagnosis_code IS NOT NULL AND visit_at >= '2025-01-01' AND visit_at < '2026-01-01' GROUP BY 1, 2),
r AS (SELECT *, dense_rank() OVER (PARTITION BY facility_id ORDER BY n DESC) AS r FROM c)
SELECT f.name, diagnosis_code, n FROM r JOIN facilities f ON f.id = facility_id WHERE r <= 3`,
        `WITH c AS (
  SELECT facility_id, diagnosis_code, count(*) AS n FROM visits
  WHERE visit_at >= '2025-01-01' AND visit_at < '2026-01-01' GROUP BY 1, 2),
r AS (SELECT *, rank() OVER (PARTITION BY facility_id ORDER BY n DESC) AS r FROM c)
SELECT f.name, diagnosis_code, n FROM r JOIN facilities f ON f.id = facility_id WHERE r <= 3`,
      ],
    },
  },
  {
    id: 'm01-a24',
    tier: 'B',
    title: 'This year against last year',
    prompt:
      'For each month of 2025 (Kampala time), compare the number of visits with the same month of 2024. Columns: month as ' +
      'a date, its first day in 2025 (for example 2025-03-01, not a timestamp), visits that month, visits in the same ' +
      'month of 2024, change (2025 minus 2024). Order by month.',
    hints: [
      'Count visits per month for both years, then look 12 rows back.',
      'lag(n, 12) OVER (ORDER BY month) over 2024 and 2025 together; filter to 2025 only after the window has run.',
    ],
    explanation:
      'lag(n, 12) looks twelve rows back, which is the same month a year earlier as long as every month is present (here ' +
      'it is; a join on month - interval \'1 year\' is safer when months can be missing). The window must see ' +
      '2024: filtering to 2025 in the same query leaves nothing to look back at. lag(n) without the offset compares with ' +
      'the previous month instead.',
    grader: {
      kind: 'result',
      reference: `WITH m AS (
  SELECT date_trunc('month', v.visit_at)::date AS month, count(*) AS n
  FROM visits v
  WHERE v.visit_at >= '2024-01-01' AND v.visit_at < '2026-01-01'
  GROUP BY 1
), y AS (
  SELECT month, n, lag(n, 12) OVER (ORDER BY month) AS prev
  FROM m
)
SELECT month, n, prev, n - prev
FROM y
WHERE month >= '2025-01-01'
ORDER BY month`,
      ordered: true,
    },
    tests: {
      mustPass: [
        `WITH m AS (SELECT date_trunc('month', visit_at)::date AS month, count(*) AS n FROM visits GROUP BY 1)
SELECT a.month, a.n, b.n, a.n - b.n
FROM m a LEFT JOIN m b ON b.month = a.month - interval '1 year'
WHERE extract(year FROM a.month) = 2025
ORDER BY a.month`,
        `SELECT make_date(2025, mon, 1),
       count(*) FILTER (WHERE yr = 2025), count(*) FILTER (WHERE yr = 2024),
       count(*) FILTER (WHERE yr = 2025) - count(*) FILTER (WHERE yr = 2024)
FROM (SELECT extract(year FROM visit_at)::int AS yr, extract(month FROM visit_at)::int AS mon FROM visits) x
WHERE yr IN (2024, 2025)
GROUP BY mon ORDER BY mon`,
      ],
      mustFail: [
        `WITH m AS (SELECT date_trunc('month', visit_at)::date AS month, count(*) AS n FROM visits GROUP BY 1),
y AS (SELECT month, n, lag(n) OVER (ORDER BY month) AS prev FROM m)
SELECT month, n, prev, n - prev FROM y WHERE month >= '2025-01-01' ORDER BY month`,
        `SELECT date_trunc('month', visit_at)::date AS month, count(*),
       lag(count(*), 12) OVER (ORDER BY date_trunc('month', visit_at)),
       count(*) - lag(count(*), 12) OVER (ORDER BY date_trunc('month', visit_at))
FROM visits WHERE visit_at >= '2025-01-01' AND visit_at < '2026-01-01'
GROUP BY 1 ORDER BY 1`,
        `WITH m AS (SELECT date_trunc('month', visit_at)::date AS month, count(*) AS n FROM visits GROUP BY 1),
y AS (SELECT month, n, lag(n, 12) OVER (ORDER BY month) AS prev FROM m)
SELECT month, n, prev, prev - n FROM y WHERE month >= '2025-01-01' ORDER BY month`,
      ],
    },
  },

  // ------------------------------------------------------- 1.6 NULL and three-valued logic
  {
    id: 'm01-a25',
    tier: 'B',
    title: 'Facilities nobody refers to',
    prompt: 'Which facilities does no other facility refer patients to? Columns: facility id, facility name. Any order.',
    hints: [
      'You want facilities whose id never appears in referral_facility_id. Some referral_facility_id values are NULL.',
      'Try NOT EXISTS, or NOT IN with the NULLs removed from the subquery. Compare with plain NOT IN and see what happens.',
    ],
    explanation:
      'x NOT IN (list) means x <> every item. If the list contains NULL, x <> NULL is unknown, so the whole test is never ' +
      'true and the query returns no rows. referral_facility_id is NULL for facilities that refer to no one, so plain ' +
      'NOT IN finds nothing. NOT EXISTS has no such trap, which is why it is the safer habit.',
    grader: {
      kind: 'result',
      reference: `SELECT f.id, f.name
FROM facilities f
WHERE NOT EXISTS (SELECT 1 FROM facilities o WHERE o.referral_facility_id = f.id)`,
      ordered: false,
    },
    tests: {
      mustPass: [
        `SELECT id, name FROM facilities
WHERE id NOT IN (SELECT referral_facility_id FROM facilities WHERE referral_facility_id IS NOT NULL)`,
        `SELECT f.id, f.name FROM facilities f LEFT JOIN facilities o ON o.referral_facility_id = f.id WHERE o.id IS NULL`,
      ],
      mustFail: [
        `SELECT id, name FROM facilities WHERE id NOT IN (SELECT referral_facility_id FROM facilities)`,
        `SELECT id, name FROM facilities WHERE referral_facility_id IS NULL`,
        `SELECT DISTINCT f.id, f.name FROM facilities f JOIN facilities o ON o.referral_facility_id <> f.id`,
      ],
    },
  },
  {
    id: 'm01-a26',
    tier: 'B',
    title: 'Patients we cannot phone',
    prompt:
      'For each facility, how many registered patients have no phone number recorded (phone is NULL), and what percentage ' +
      'of its registered patients is that? Columns: facility name, patients, patients without a phone, percentage without ' +
      'a phone rounded to 1 decimal place. Any order.',
    hints: [
      'count(*) counts rows; count(phone) counts only rows where phone is not NULL.',
      'phone = NULL is never true. Use phone IS NULL, or count(*) - count(phone).',
    ],
    explanation:
      'NULL means "unknown", so phone = NULL is unknown, not true, and a filter on it keeps nothing. Test with IS NULL. ' +
      'count(column) skips NULLs, which makes count(*) - count(phone) the number of missing phones. Multiply by 100.0 to ' +
      'avoid integer division.',
    grader: {
      kind: 'result',
      reference: `SELECT f.name, count(*), count(*) - count(p.phone),
       round((100.0 * (count(*) - count(p.phone)) / count(*))::numeric, 1)
FROM facilities f
JOIN patients p ON p.facility_id = f.id
GROUP BY f.id, f.name`,
      ordered: false,
    },
    tests: {
      mustPass: [
        `SELECT f.name, count(p.id), count(*) FILTER (WHERE p.phone IS NULL),
       round(100.0 * count(*) FILTER (WHERE p.phone IS NULL) / count(p.id), 1)
FROM facilities f JOIN patients p ON p.facility_id = f.id GROUP BY f.name`,
        `SELECT f.name, count(*), sum((p.phone IS NULL)::int), round(100 * avg((p.phone IS NULL)::int), 1)
FROM patients p JOIN facilities f ON f.id = p.facility_id GROUP BY f.name`,
      ],
      mustFail: [
        `SELECT f.name, count(*), count(*) FILTER (WHERE p.phone = NULL),
       round(100.0 * count(*) FILTER (WHERE p.phone = NULL) / count(*), 1)
FROM facilities f JOIN patients p ON p.facility_id = f.id GROUP BY f.name`,
        `SELECT f.name, count(*), count(p.phone), round(100.0 * count(p.phone) / count(*), 1)
FROM facilities f JOIN patients p ON p.facility_id = f.id GROUP BY f.name`,
        `SELECT f.name, count(*), count(*) - count(p.phone), 100 * (count(*) - count(p.phone)) / count(*)
FROM facilities f JOIN patients p ON p.facility_id = f.id GROUP BY f.name`,
      ],
    },
  },
  {
    id: 'm01-a27',
    tier: 'B',
    title: 'Visits that were not malaria',
    prompt:
      'How many visits in 2025 (Kampala time) were not diagnosed as malaria (code B54)? Visits with no diagnosis recorded ' +
      'count as not malaria. Group by visit type. Columns: visit type, visits. Any order.',
    hints: [
      'What does diagnosis_code <> \'B54\' give when diagnosis_code is NULL?',
      'Use diagnosis_code IS DISTINCT FROM \'B54\', or add OR diagnosis_code IS NULL.',
    ],
    explanation:
      'Comparing NULL with anything gives unknown, and WHERE keeps only rows where the condition is true. So ' +
      'diagnosis_code <> \'B54\' silently drops every visit with no diagnosis. IS DISTINCT FROM treats NULL as a ' +
      'value: NULL IS DISTINCT FROM \'B54\' is true. NOT IN (\'B54\') has the same trap as <>.',
    grader: {
      kind: 'result',
      reference: `SELECT v.visit_type, count(*)
FROM visits v
WHERE ${IN_2025}
  AND v.diagnosis_code IS DISTINCT FROM 'B54'
GROUP BY v.visit_type`,
      ordered: false,
    },
    tests: {
      mustPass: [
        `SELECT visit_type, count(*) FROM visits
WHERE extract(year FROM visit_at) = 2025 AND (diagnosis_code <> 'B54' OR diagnosis_code IS NULL)
GROUP BY visit_type`,
        `SELECT visit_type, count(*) FILTER (WHERE coalesce(diagnosis_code, '') <> 'B54') FROM visits
WHERE visit_at::date BETWEEN '2025-01-01' AND '2025-12-31'
GROUP BY visit_type`,
      ],
      mustFail: [
        `SELECT visit_type, count(*) FROM visits
WHERE visit_at >= '2025-01-01' AND visit_at < '2026-01-01' AND diagnosis_code <> 'B54'
GROUP BY visit_type`,
        `SELECT visit_type, count(*) FROM visits
WHERE visit_at >= '2025-01-01' AND visit_at < '2026-01-01' AND diagnosis_code NOT IN ('B54')
GROUP BY visit_type`,
        `SELECT visit_type, count(diagnosis_code) FROM visits
WHERE visit_at >= '2025-01-01' AND visit_at < '2026-01-01' AND diagnosis_code IS DISTINCT FROM 'B54'
GROUP BY visit_type`,
      ],
    },
  },

  // ------------------------------------------------------- 1.7 Dates and time zones
  {
    id: 'm01-a28',
    tier: 'B',
    title: 'When emergencies arrive',
    prompt:
      'Count emergency visits in 2025 by hour of the day, in Kampala time (0 to 23). Columns: hour as a whole number, ' +
      'visits. Order by hour.',
    hints: [
      'extract(hour FROM visit_at) gives the hour in the session’s time zone, which here is Africa/Kampala.',
      'Be careful with to_char: \'HH\' is a 12-hour clock; \'HH24\' is the 24-hour one.',
    ],
    explanation:
      'A timestamptz is an instant; its hour depends on the time zone you view it in. extract(hour …) uses the ' +
      'session time zone, Africa/Kampala (UTC+3, no daylight saving). AT TIME ZONE \'UTC\' shifts every hour by ' +
      'three, and to_char(…, \'HH\') folds the afternoon onto the morning.',
    grader: {
      kind: 'result',
      reference: `SELECT extract(hour FROM v.visit_at)::int AS hour, count(*)
FROM visits v
WHERE v.visit_type = 'emergency' AND ${IN_2025}
GROUP BY 1
ORDER BY 1`,
      ordered: true,
    },
    tests: {
      mustPass: [
        `SELECT to_char(visit_at, 'HH24')::int AS h, count(*) FROM visits
WHERE visit_type = 'emergency' AND visit_at::date BETWEEN '2025-01-01' AND '2025-12-31'
GROUP BY h ORDER BY h`,
        `SELECT date_part('hour', visit_at AT TIME ZONE 'Africa/Kampala'), count(*) FROM visits
WHERE visit_type = 'emergency' AND extract(year FROM visit_at) = 2025
GROUP BY 1 ORDER BY 1`,
      ],
      mustFail: [
        `SELECT extract(hour FROM visit_at AT TIME ZONE 'UTC')::int, count(*) FROM visits
WHERE visit_type = 'emergency' AND visit_at >= '2025-01-01' AND visit_at < '2026-01-01'
GROUP BY 1 ORDER BY 1`,
        `SELECT to_char(visit_at, 'HH')::int AS h, count(*) FROM visits
WHERE visit_type = 'emergency' AND visit_at >= '2025-01-01' AND visit_at < '2026-01-01'
GROUP BY h ORDER BY h`,
        `SELECT extract(hour FROM visit_at)::int, count(*) FROM visits
WHERE visit_type = 'emergency' AND visit_at >= '2025-01-01' AND visit_at < '2026-01-01'
GROUP BY 1 ORDER BY 2 DESC`,
      ],
    },
  },
  {
    id: 'm01-a29',
    tier: 'B',
    title: 'Weekend visits in the last quarter',
    prompt:
      'How many visits did each facility have on Saturdays and Sundays (Kampala time) from 1 October to 31 December 2025? ' +
      'Columns: facility name, weekend visits. Any order.',
    hints: [
      'extract(isodow …) numbers Monday 1 to Sunday 7; extract(dow …) numbers Sunday 0 to Saturday 6.',
      'Weekend is isodow IN (6, 7), or dow IN (0, 6). Use a half-open range for the quarter.',
    ],
    explanation:
      'PostgreSQL has two day-of-week numberings: dow (Sunday 0 … Saturday 6) and isodow (Monday 1 … Sunday 7). ' +
      'Mixing them, as in dow IN (6, 7), quietly counts Saturdays only. Filtering on the month alone (October to December) ' +
      'mixes in the last quarter of 2024.',
    grader: {
      kind: 'result',
      reference: `SELECT f.name, count(*)
FROM visits v
JOIN facilities f ON f.id = v.facility_id
WHERE v.visit_at >= '2025-10-01' AND v.visit_at < '2026-01-01'
  AND extract(isodow FROM v.visit_at) IN (6, 7)
GROUP BY f.id, f.name`,
      ordered: false,
    },
    tests: {
      mustPass: [
        `SELECT f.name, count(*) FROM visits v JOIN facilities f ON f.id = v.facility_id
WHERE v.visit_at::date BETWEEN '2025-10-01' AND '2025-12-31' AND extract(dow FROM v.visit_at) IN (0, 6)
GROUP BY f.name`,
        `SELECT f.name, count(*) FILTER (WHERE to_char(v.visit_at, 'Dy') IN ('Sat', 'Sun'))
FROM facilities f JOIN visits v ON v.facility_id = f.id
WHERE date_trunc('quarter', v.visit_at) = '2025-10-01'
GROUP BY f.name`,
      ],
      mustFail: [
        `SELECT f.name, count(*) FROM visits v JOIN facilities f ON f.id = v.facility_id
WHERE v.visit_at >= '2025-10-01' AND v.visit_at < '2026-01-01' AND extract(dow FROM v.visit_at) IN (6, 7)
GROUP BY f.name`,
        `SELECT f.name, count(*) FROM visits v JOIN facilities f ON f.id = v.facility_id
WHERE extract(month FROM v.visit_at) BETWEEN 10 AND 12 AND extract(isodow FROM v.visit_at) IN (6, 7)
GROUP BY f.name`,
        `SELECT f.name, count(*) FROM visits v JOIN facilities f ON f.id = v.facility_id
WHERE v.visit_at >= '2025-10-01' AND v.visit_at < '2026-01-01'
  AND extract(isodow FROM v.visit_at AT TIME ZONE 'UTC') IN (6, 7)
GROUP BY f.name`,
      ],
    },
  },
  {
    id: 'm01-a30',
    tier: 'B',
    title: 'December visits by age band',
    prompt:
      'Break down visits in December 2025 (Kampala time) by the patient’s age in whole years on the date of the ' +
      'visit (Kampala date), as age() counts it. Bands: \'0-4\', \'5-17\', \'18-49\', ' +
      '\'50+\' (text exactly as written). Columns: band, visits. Leave out bands with no visits. Any order.',
    hints: [
      'age(visit_at::date, date_of_birth) gives an interval such as 4 years 11 mons 30 days; extract(year FROM …) takes the whole years.',
      'Age on the visit date, not today: age(date_of_birth) alone measures to the current date. Then a CASE puts each age in its band.',
    ],
    explanation:
      'A patient’s age changes, so a report about December 2025 must measure age on the visit date: age(date_of_birth) ' +
      'with one argument measures to today and drifts every time you run it. Subtracting birth years ignores whether the ' +
      'birthday has come yet that year. In the CASE, check the bands from youngest up so each age lands in exactly one.',
    grader: {
      kind: 'result',
      reference: `SELECT CASE WHEN a < 5 THEN '0-4' WHEN a < 18 THEN '5-17' WHEN a < 50 THEN '18-49' ELSE '50+' END AS band,
       count(*)
FROM (
  SELECT extract(year FROM age(v.visit_at::date, p.date_of_birth)) AS a
  FROM visits v
  JOIN patients p ON p.id = v.patient_id
  WHERE v.visit_at >= '2025-12-01' AND v.visit_at < '2026-01-01'
) x
GROUP BY 1`,
      ordered: false,
    },
    tests: {
      mustPass: [
        `SELECT CASE WHEN a BETWEEN 0 AND 4 THEN '0-4' WHEN a BETWEEN 5 AND 17 THEN '5-17'
            WHEN a BETWEEN 18 AND 49 THEN '18-49' ELSE '50+' END, count(*)
FROM (SELECT date_part('year', age(v.visit_at::date, p.date_of_birth)) AS a
      FROM visits v JOIN patients p ON p.id = v.patient_id
      WHERE date_trunc('month', v.visit_at) = '2025-12-01') x
GROUP BY 1`,
        `WITH ages AS (
  SELECT extract(year FROM v.visit_at::date) - extract(year FROM p.date_of_birth)
         - CASE WHEN to_char(v.visit_at::date, 'MMDD') < to_char(p.date_of_birth, 'MMDD') THEN 1 ELSE 0 END AS a
  FROM visits v JOIN patients p ON p.id = v.patient_id
  WHERE v.visit_at::date BETWEEN '2025-12-01' AND '2025-12-31')
SELECT CASE WHEN a >= 50 THEN '50+' WHEN a >= 18 THEN '18-49' WHEN a >= 5 THEN '5-17' ELSE '0-4' END, count(*)
FROM ages GROUP BY 1`,
      ],
      mustFail: [
        `SELECT CASE WHEN a < 5 THEN '0-4' WHEN a < 18 THEN '5-17' WHEN a < 50 THEN '18-49' ELSE '50+' END, count(*)
FROM (SELECT extract(year FROM age(p.date_of_birth)) AS a FROM visits v JOIN patients p ON p.id = v.patient_id
      WHERE v.visit_at >= '2025-12-01' AND v.visit_at < '2026-01-01') x
GROUP BY 1`,
        `SELECT CASE WHEN a < 50 THEN '18-49' WHEN a < 18 THEN '5-17' WHEN a < 5 THEN '0-4' ELSE '50+' END, count(*)
FROM (SELECT extract(year FROM age(v.visit_at::date, p.date_of_birth)) AS a
      FROM visits v JOIN patients p ON p.id = v.patient_id
      WHERE v.visit_at >= '2025-12-01' AND v.visit_at < '2026-01-01') x
GROUP BY 1`,
        `SELECT CASE WHEN a <= 5 THEN '0-4' WHEN a <= 18 THEN '5-17' WHEN a <= 50 THEN '18-49' ELSE '50+' END, count(*)
FROM (SELECT extract(year FROM age(v.visit_at::date, p.date_of_birth)) AS a FROM visits v JOIN patients p ON p.id = v.patient_id
      WHERE v.visit_at >= '2025-12-01' AND v.visit_at < '2026-01-01') x
GROUP BY 1`,
      ],
    },
  },
]

const THREE_WAYS: Challenge[] = [
  {
    id: 'm01-latest-distinct-on',
    tier: 'B',
    title: 'Latest visit per patient: DISTINCT ON',
    prompt: `${LATEST_PROMPT} Write it with DISTINCT ON.`,
    hints: [
      'DISTINCT ON (patient_id) keeps the first row of each patient in the ORDER BY order.',
      'ORDER BY must start with the DISTINCT ON column, then put the latest visit first: ORDER BY patient_id, visit_at DESC, id DESC.',
    ],
    explanation:
      'DISTINCT ON (expr) is a PostgreSQL extension: it keeps the first row for each distinct value of expr, where "first" ' +
      'is decided by ORDER BY. The ORDER BY must begin with the same expression; what follows chooses which row wins. ' +
      'visit_at DESC puts the latest first and id DESC breaks a tie. Ordering by id alone is a common slip: ids do not ' +
      'follow visit time.',
    grader: {
      kind: 'result',
      reference: `SELECT DISTINCT ON (v.patient_id) v.patient_id, v.visit_at, v.diagnosis_code
FROM visits v
ORDER BY v.patient_id, v.visit_at DESC, v.id DESC`,
      ordered: false,
      requires: [DISTINCT_ON],
      forbids: [NO_WINDOW, NO_LATERAL],
    },
    tests: {
      mustPass: [
        `SELECT DISTINCT ON (p.id) p.id, v.visit_at, v.diagnosis_code
FROM patients p JOIN visits v ON v.patient_id = p.id
ORDER BY p.id, v.visit_at DESC, v.id DESC`,
        `SELECT patient_id, visit_at, diagnosis_code FROM (
  SELECT DISTINCT ON (patient_id) patient_id, visit_at, diagnosis_code, id FROM visits
  ORDER BY patient_id ASC, visit_at DESC, id DESC) latest`,
      ],
      mustFail: [
        `SELECT DISTINCT ON (patient_id) patient_id, visit_at, diagnosis_code FROM visits ORDER BY patient_id, visit_at`,
        `SELECT DISTINCT ON (patient_id) patient_id, visit_at, diagnosis_code FROM visits ORDER BY patient_id, id DESC`,
        `SELECT patient_id, visit_at, diagnosis_code FROM (
  SELECT v.*, row_number() OVER (PARTITION BY patient_id ORDER BY visit_at DESC, id DESC) AS rn FROM visits v) x
WHERE rn = 1`,
      ],
    },
  },
  {
    id: 'm01-latest-window',
    tier: 'B',
    title: 'Latest visit per patient: window function',
    prompt: `${LATEST_PROMPT} Write it with a window function (OVER), without DISTINCT ON or LATERAL.`,
    hints: [
      'Number each patient’s visits from latest to earliest, then keep number 1.',
      'row_number() OVER (PARTITION BY patient_id ORDER BY visit_at DESC, id DESC) in a subquery; filter rn = 1 outside it.',
    ],
    explanation:
      'row_number() numbers the rows of each partition in the window’s order, so rn = 1 is the latest visit per ' +
      'patient. The filter must go in an outer query because window functions run after WHERE. PARTITION BY patient_id ' +
      'restarts the numbering for each patient; without it you get one row for the whole clinic. rank() would return ' +
      'two rows for a patient with two visits at the same latest time, which the tie-breaker rules out.',
    grader: {
      kind: 'result',
      reference: `SELECT patient_id, visit_at, diagnosis_code
FROM (
  SELECT v.patient_id, v.visit_at, v.diagnosis_code,
         row_number() OVER (PARTITION BY v.patient_id ORDER BY v.visit_at DESC, v.id DESC) AS rn
  FROM visits v
) ranked
WHERE rn = 1`,
      ordered: false,
      requires: [WINDOW],
      forbids: [NO_DISTINCT_ON, NO_LATERAL],
    },
    tests: {
      mustPass: [
        `WITH ranked AS (
  SELECT patient_id, visit_at, diagnosis_code, row_number() OVER w AS rn FROM visits
  WINDOW w AS (PARTITION BY patient_id ORDER BY visit_at DESC, id DESC))
SELECT patient_id, visit_at, diagnosis_code FROM ranked WHERE rn = 1`,
        `SELECT patient_id, visit_at, diagnosis_code FROM (
  SELECT id, patient_id, visit_at, diagnosis_code,
         first_value(id) OVER (PARTITION BY patient_id ORDER BY visit_at DESC, id DESC) AS latest_id
  FROM visits) x
WHERE id = latest_id`,
      ],
      mustFail: [
        `SELECT patient_id, visit_at, diagnosis_code FROM (
  SELECT v.*, row_number() OVER (PARTITION BY patient_id ORDER BY visit_at) AS rn FROM visits v) x
WHERE rn = 1`,
        `SELECT patient_id, visit_at, diagnosis_code FROM (
  SELECT v.*, row_number() OVER (ORDER BY visit_at DESC, id DESC) AS rn FROM visits v) x
WHERE rn = 1`,
        `SELECT DISTINCT ON (patient_id) patient_id, visit_at, diagnosis_code FROM visits
ORDER BY patient_id, visit_at DESC, id DESC`,
      ],
    },
  },
  {
    id: 'm01-latest-lateral',
    tier: 'B',
    title: 'Latest visit per patient: LATERAL join',
    prompt:
      `${LATEST_PROMPT} Write it with a LATERAL join, without DISTINCT ON or window functions. ` +
      'visits has no index on patient_id, so first run CREATE INDEX ON visits (patient_id, visit_at DESC, id DESC); ' +
      'without it this version reads every visit once per patient, which takes minutes on the standard dataset. ' +
      '(The grader builds the same index, inside its rolled-back transaction, while it checks your answer.)',
    hints: [
      'For each patient, a small subquery can fetch that patient’s single latest visit. LATERAL lets it refer to the patient row.',
      'FROM patients p CROSS JOIN LATERAL (SELECT … FROM visits v WHERE v.patient_id = p.id ORDER BY visit_at DESC, id DESC LIMIT 1) l.',
    ],
    explanation:
      'A LATERAL subquery runs once per row on its left and may use that row’s columns, so "the latest visit of this ' +
      'patient" becomes ORDER BY … LIMIT 1. CROSS JOIN LATERAL drops patients with no visits, as the task asks; ' +
      'LEFT JOIN LATERAL … ON true would keep them with NULLs. Speed depends on indexes: without one, each of those ' +
      'subqueries reads the whole visits table, so the standard dataset means 10,000 full scans of 100,000 rows. With ' +
      'an index on (patient_id, visit_at DESC, id DESC) each lookup is a short index probe, and all three versions ' +
      'take a similar, short time. DISTINCT ON and the window version need no index because they sort visits once. ' +
      'Time all three yourself, with and without the index; Module 3 explains the plans behind the numbers.',
    grader: {
      kind: 'result',
      // The index makes the per-patient lookups fast on the standard dataset; the
      // grader rolls back after checking, so the learner's database is unchanged.
      reference: `CREATE INDEX IF NOT EXISTS visits_patient_latest_idx ON visits (patient_id, visit_at DESC, id DESC);
SELECT p.id, l.visit_at, l.diagnosis_code
FROM patients p
CROSS JOIN LATERAL (
  SELECT v.visit_at, v.diagnosis_code
  FROM visits v
  WHERE v.patient_id = p.id
  ORDER BY v.visit_at DESC, v.id DESC
  LIMIT 1
) l`,
      ordered: false,
      requires: [LATERAL],
      forbids: [NO_DISTINCT_ON, NO_WINDOW],
    },
    tests: {
      mustPass: [
        `SELECT p.id, l.visit_at, l.diagnosis_code
FROM patients p
JOIN LATERAL (SELECT visit_at, diagnosis_code FROM visits WHERE patient_id = p.id
              ORDER BY visit_at DESC, id DESC LIMIT 1) l ON true`,
        `SELECT ids.patient_id, l.visit_at, l.diagnosis_code
FROM (SELECT DISTINCT patient_id FROM visits) ids,
LATERAL (SELECT visit_at, diagnosis_code FROM visits v WHERE v.patient_id = ids.patient_id
         ORDER BY v.visit_at DESC, v.id DESC FETCH FIRST 1 ROW ONLY) l`,
      ],
      mustFail: [
        `SELECT p.id, l.visit_at, l.diagnosis_code FROM patients p
CROSS JOIN LATERAL (SELECT visit_at, diagnosis_code FROM visits v WHERE v.patient_id = p.id ORDER BY visit_at LIMIT 1) l`,
        `SELECT p.id, l.visit_at, l.diagnosis_code FROM patients p
CROSS JOIN LATERAL (SELECT visit_at, diagnosis_code FROM visits v ORDER BY visit_at DESC, id DESC LIMIT 1) l`,
        `SELECT p.id, l.visit_at, l.diagnosis_code FROM patients p
CROSS JOIN LATERAL (SELECT visit_at, diagnosis_code FROM visits v WHERE v.patient_id = p.id ORDER BY id DESC LIMIT 1) l`,
        `SELECT DISTINCT ON (patient_id) patient_id, visit_at, diagnosis_code FROM visits
ORDER BY patient_id, visit_at DESC, id DESC`,
      ],
    },
  },
]

export const CHALLENGES: Challenge[] = [...ASSIGNMENT, ...THREE_WAYS]

/** The assignment, in the order the learner sees it. */
export const ASSIGNMENT_IDS: string[] = ASSIGNMENT.map((c) => c.id)

/** "Latest visit per patient", written three ways. */
export const THREE_WAYS_IDS: string[] = THREE_WAYS.map((c) => c.id)
