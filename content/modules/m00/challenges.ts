import type { Challenge } from '../../types'
import { testVisits } from '../../datasets/testRows'

// A task that asks for an order needs ORDER BY: without it, rows come back in whatever order the plan
// happens to produce, which can look right today and change tomorrow.
const ORDER_BY = { pattern: '\\border\\s+by\\b', message: 'This task asks for an order, so the query needs ORDER BY: without it the order is not guaranteed.' }

// Module 0 practice set: twelve short queries that use only Module 0 ideas (one table at a time,
// WHERE, ORDER BY, LIMIT, DISTINCT, casts, aggregates and a single-column GROUP BY).
//
// Prompts pin down the columns (in order), whether order matters, ties and rounding, so the
// reference is the only right answer on every dataset size. Where a mistake cannot show on the
// generated data (a birth date on the edge of a year, stock at exactly the threshold, a label with
// a capital letter, tied birth dates, a shared phone), `setup` adds the case inside the grader's
// rolled-back transaction. Each setup was checked on the small, standard and large datasets.

// Six patients tied on the earliest date of birth, stored highest id first: a missing or reversed
// tie-break keeps the wrong five (a top-5 sort keeps the first tied rows it reads), on every size.
const OLDEST_TIES = `-- 6 test patients born on the same day, before everyone else, added highest id first
INSERT INTO patients (id, facility_id, full_name, sex, date_of_birth, phone, registered_at)
SELECT (SELECT max(id) FROM patients) + 7 - n, 1, 'Test patient ' || n, 'F', date '1944-12-31', NULL, timestamptz '2024-01-01 09:00+03'
FROM generate_series(1, 6) AS n;`

// A patient registered at facility 1 who came to facility 2 (an HC IV) as an emergency: "patients of
// facility 2" and "patients with an emergency visit at facility 2" differ.
const EMERGENCY_AWAY = testVisits([{ patient: 1, at: '2025-03-10 10:00', level: 'HC IV', type: 'emergency' }])

// A patient at facility 2 whose phone was saved as an empty string, so AND/OR precedence shows.
const EMPTY_PHONE = `-- A test patient at facility 2 whose phone was saved as an empty string instead of NULL
INSERT INTO patients (id, facility_id, full_name, sex, date_of_birth, phone, registered_at)
SELECT max(id) + 1, 2, 'Test patient 1', 'F', date '1990-05-01', '', timestamptz '2024-01-01 09:00+03'
FROM patients;`

// The generated data has undispensed prescriptions only for drugs 1, 3, 5 and 7, so a range such as
// BETWEEN 1 AND 3 would pass without this row.
const DRUG_2_WAITING = `-- A prescription for drug 2 that is still waiting at the pharmacy
INSERT INTO prescriptions (id, visit_id, drug_id, quantity, dispensed)
SELECT max(id) + 1, (SELECT min(id) FROM visits), 2, 10, false
FROM prescriptions;`

// Households sharing a phone (count(DISTINCT phone) counts numbers, not patients), and 34 patients
// without a phone so the percentage is not a round figure on any size: 78.6 (small), 79.9
// (standard), 79.9 (large; 79.86 before rounding), so truncating, rounding to 0 or 2 places and
// leaving it unrounded all show.
const PHONE_EDGES = `-- Households: every tenth patient shares the phone number of the patient before them
UPDATE patients p SET phone = q.phone
FROM patients q
WHERE q.id = p.id - 1 AND p.id % 10 = 0 AND p.phone IS NOT NULL AND q.phone IS NOT NULL;
-- 34 test patients registered without a phone number, numbered after the real ones
INSERT INTO patients (id, facility_id, full_name, sex, date_of_birth, phone, registered_at)
SELECT (SELECT max(id) FROM patients) + n, 1, 'Test patient ' || n, 'F', date '1990-05-01', NULL, timestamptz '2024-01-01 09:00+03'
FROM generate_series(1, 34) AS n;`

// A visit with two dispensed lines for the same drug: a line count is not a visit count.
const REPEAT_LINE = `-- A visit gets a second dispensed line for the same drug
INSERT INTO prescriptions (id, visit_id, drug_id, quantity, dispensed)
SELECT (SELECT max(id) FROM prescriptions) + 1, visit_id, drug_id, 10, true
FROM prescriptions
WHERE dispensed
ORDER BY id
LIMIT 1;`

// Four patients born on the edges of 1990.
const BIRTHDAY_EDGES = `-- 4 test patients born on the edges of 1990, numbered after the real ones
INSERT INTO patients (id, facility_id, full_name, sex, date_of_birth, phone, registered_at)
SELECT (SELECT max(id) FROM patients) + n, 1, 'Test patient ' || n, 'F', born, NULL, timestamptz '2024-01-01 09:00+03'
FROM (VALUES (1, date '1989-12-31'), (2, date '1990-01-01'), (3, date '1990-12-31'), (4, date '1991-01-01')) AS t(n, born);`

// A shelf at exactly the threshold, one just under it, and five shelves tied at 3 units (four of
// them at facility 1), updated in a scrambled order. PostgreSQL's sort is not stable, so one tied
// pair would settle the right way about half the time; four rows tied on quantity and facility
// leave a missing drug_id tie-break one chance in 24 of looking right.
const STOCK_EDGES = `-- One shelf at exactly 50 units, one at 49, and five shelves tied at 3 units
UPDATE stock SET quantity_on_hand = 50 WHERE facility_id = 1 AND drug_id = 1;
UPDATE stock SET quantity_on_hand = 49 WHERE facility_id = 2 AND drug_id = 3;
UPDATE stock SET quantity_on_hand = 3 WHERE facility_id = 2 AND drug_id = 5;
UPDATE stock SET quantity_on_hand = 3 WHERE facility_id = 1 AND drug_id = 6;
UPDATE stock SET quantity_on_hand = 3 WHERE facility_id = 1 AND drug_id = 2;
UPDATE stock SET quantity_on_hand = 3 WHERE facility_id = 1 AND drug_id = 8;
UPDATE stock SET quantity_on_hand = 3 WHERE facility_id = 1 AND drug_id = 4;`

// A diagnosis whose label starts with a capital I.
const CAPITAL_INFECTION = `-- A diagnosis label that starts with a capital letter
INSERT INTO diagnoses (code, label) VALUES ('T81.4', 'Infection following a procedure');`

const PRACTICE: Challenge[] = [
  // ---------------------------------------------------------------- 0.3 SELECT
  {
    id: 'm00-a01',
    tier: 'B',
    title: 'The drug list',
    prompt:
      'Show every drug on the formulary. Columns: drug name, unit. Sorted by name from A to Z.',
    hints: ['Everything you need is in the drugs table.', 'Name the two columns in that order, then add ORDER BY name.'],
    explanation:
      'SELECT names the columns in the order you want them, FROM names the table, and ORDER BY sorts. Ascending (A to Z) is ' +
      'the default, so ASC is optional. Without ORDER BY the rows come back in whatever order PostgreSQL finds convenient, ' +
      'which here happens to be the order they were added: never rely on that.',
    grader: {
      kind: 'result',
      reference: `SELECT name, unit
FROM drugs
ORDER BY name`,
      ordered: true,
      requires: [ORDER_BY],
    },
    tests: {
      mustPass: [
        `select d.name, d.unit from drugs as d order by d.name asc`,
        `SELECT name, unit FROM drugs ORDER BY 1`,
        `SELECT name AS drug, unit AS dispensing_unit FROM drugs ORDER BY drug;`,
        `SELECT name, unit FROM drugs ORDER BY lower(name)`,
        `WITH d AS (SELECT name, unit FROM drugs) SELECT * FROM d ORDER BY name`,
        `SELECT drugs.name, drugs.unit FROM drugs ORDER BY drugs.name ASC NULLS LAST, drugs.unit`,
      ],
      mustFail: [
        `SELECT name, unit FROM drugs`,
        `SELECT name, unit FROM drugs ORDER BY name DESC`,
        `SELECT unit, name FROM drugs ORDER BY name`,
        `SELECT id, name, unit FROM drugs ORDER BY name`,
        `SELECT name, unit FROM drugs ORDER BY unit, name`,
        `SELECT name, unit FROM drugs ORDER BY id`,
        `SELECT DISTINCT name, unit FROM drugs`,
        `SELECT name, unit FROM drugs GROUP BY name, unit`,
        `SELECT * FROM drugs ORDER BY name`,
        `SELECT name FROM drugs ORDER BY name`,
        `SELECT name, unit FROM drugs ORDER BY 2`,
        `SELECT name, unit FROM drugs ORDER BY name LIMIT 5`,
        `SELECT DISTINCT unit FROM drugs ORDER BY unit`,
        `SELECT name, unit FROM drugs ORDER BY id DESC`,
      ],
    },
  },
  {
    id: 'm00-a02',
    tier: 'B',
    title: 'The five oldest patients',
    prompt:
      'Show the five oldest patients. Columns: patient id, full name, date of birth. Oldest first; if two share a date ' +
      'of birth, the lower patient id comes first.',
    hints: [
      'The oldest patients have the earliest dates of birth. Which direction of sort puts the earliest first?',
      'Sort by date_of_birth, then by id to settle ties, and keep five rows with LIMIT. The test rows add six patients born on the same day.',
    ],
    explanation:
      'Oldest means earliest date of birth, so the sort is ascending, not descending: ORDER BY date_of_birth DESC finds the ' +
      'youngest. LIMIT 5 keeps the first five rows of the sorted result. The second sort column, id, decides between ' +
      'patients born on the same day; without it, which of two tied patients makes the top five is left to chance. The test ' +
      'rows add six patients who share the earliest date of birth, so only the id tie-break picks the right five.',
    grader: {
      kind: 'result',
      reference: `SELECT id, full_name, date_of_birth
FROM patients
ORDER BY date_of_birth, id
LIMIT 5`,
      ordered: true,
      requires: [ORDER_BY],
      setup: OLDEST_TIES,
    },
    tests: {
      mustPass: [
        `SELECT id, full_name, date_of_birth FROM patients ORDER BY date_of_birth ASC, id ASC LIMIT 5`,
        `SELECT p.id, p.full_name, p.date_of_birth FROM patients p ORDER BY 3, 1 LIMIT 5`,
        `SELECT id, full_name, date_of_birth FROM patients ORDER BY current_date - date_of_birth DESC, id LIMIT 5`,
        `SELECT id, full_name, date_of_birth FROM patients ORDER BY date_of_birth, id FETCH FIRST 5 ROWS ONLY`,
        `WITH oldest AS (SELECT id, full_name, date_of_birth FROM patients ORDER BY date_of_birth, id LIMIT 5) SELECT * FROM oldest ORDER BY date_of_birth, id`,
        `SELECT p.id AS patient_id, p.full_name AS name, p.date_of_birth AS born FROM patients AS p ORDER BY born, patient_id LIMIT 5`,
      ],
      mustFail: [
        `SELECT id, full_name, date_of_birth FROM patients ORDER BY date_of_birth DESC, id LIMIT 5`,
        `SELECT id, full_name, date_of_birth FROM patients ORDER BY date_of_birth, id LIMIT 10`,
        `SELECT id, full_name, date_of_birth FROM patients ORDER BY id LIMIT 5`,
        `SELECT id, full_name, date_of_birth FROM patients ORDER BY registered_at LIMIT 5`,
        `SELECT id, full_name FROM patients ORDER BY date_of_birth, id LIMIT 5`,
        `SELECT id, full_name, date_of_birth FROM patients ORDER BY date_of_birth LIMIT 5`,
        `SELECT id, full_name, date_of_birth FROM patients ORDER BY date_of_birth, id DESC LIMIT 5`,
        `SELECT id, full_name, date_of_birth FROM patients ORDER BY date_of_birth DESC LIMIT 5`,
        `SELECT id, full_name, date_of_birth FROM patients ORDER BY date_of_birth, id LIMIT 6`,
        `SELECT id, full_name, date_of_birth FROM patients ORDER BY date_of_birth, id LIMIT 4`,
        `SELECT id, full_name, date_of_birth FROM patients ORDER BY date_of_birth, id OFFSET 1 LIMIT 5`,
        `SELECT id, date_of_birth, full_name FROM patients ORDER BY date_of_birth, id LIMIT 5`,
        `SELECT id, full_name, date_of_birth FROM patients ORDER BY full_name LIMIT 5`,
        `SELECT id, full_name, date_of_birth FROM patients ORDER BY id, date_of_birth LIMIT 5`,
        `SELECT id, full_name, date_of_birth FROM patients WHERE date_of_birth < '1946-01-01' ORDER BY date_of_birth, id`,
        `SELECT id, full_name, date_of_birth FROM patients ORDER BY date_of_birth, full_name LIMIT 5`,
      ],
    },
  },
  {
    id: 'm00-a03',
    tier: 'B',
    title: 'Who came in as an emergency',
    prompt:
      'Which patients have had at least one emergency visit (visit_type \'emergency\') at facility 2? Column: patient id. ' +
      'Each patient once, sorted by patient id from lowest to highest.',
    hints: [
      'The visits table has patient_id, facility_id and visit_type. A patient with three emergency visits has three rows.',
      'SELECT DISTINCT patient_id, with both conditions joined by AND, then ORDER BY patient_id.',
    ],
    explanation:
      'Each visit is one row, so a patient who came in as an emergency three times appears three times until DISTINCT ' +
      'removes the repeats. Both conditions must hold, so they are joined with AND. ORDER BY is needed even after DISTINCT: ' +
      'removing duplicates does not sort the rows, and without it they may come back in any order. "At facility 2" ' +
      'is where the visit happened (visits.facility_id), not where the patient is registered: the test rows add a patient ' +
      'registered at facility 1 who came to facility 2 as an emergency.',
    grader: {
      kind: 'result',
      reference: `SELECT DISTINCT patient_id
FROM visits
WHERE facility_id = 2
  AND visit_type = 'emergency'
ORDER BY patient_id`,
      ordered: true,
      requires: [ORDER_BY],
      setup: EMERGENCY_AWAY,
    },
    tests: {
      mustPass: [
        `SELECT patient_id FROM visits WHERE visit_type = 'emergency' AND facility_id = 2 GROUP BY patient_id ORDER BY patient_id`,
        `select distinct v.patient_id from visits v where v.facility_id in (2) and v.visit_type in ('emergency') order by 1 asc`,
        `SELECT id FROM patients WHERE id IN (SELECT patient_id FROM visits WHERE facility_id = 2 AND visit_type = 'emergency') ORDER BY id`,
        `SELECT DISTINCT patient_id FROM visits WHERE facility_id = 2 AND visit_type ILIKE 'emergency' ORDER BY patient_id`,
        `WITH e AS (SELECT patient_id FROM visits WHERE facility_id = 2 AND visit_type = 'emergency') SELECT DISTINCT patient_id FROM e ORDER BY 1`,
        `SELECT patient_id FROM visits WHERE facility_id = 2 AND visit_type = 'emergency' GROUP BY patient_id HAVING count(*) >= 1 ORDER BY patient_id ASC`,
        `SELECT DISTINCT v.patient_id AS patient FROM visits AS v WHERE v.visit_type LIKE 'emerg%' AND v.facility_id = 2 ORDER BY patient`,
      ],
      mustFail: [
        `SELECT patient_id FROM visits WHERE facility_id = 2 AND visit_type = 'emergency' ORDER BY patient_id`,
        `SELECT DISTINCT patient_id FROM visits WHERE facility_id = 2 AND visit_type = 'emergency'`,
        `SELECT DISTINCT patient_id FROM visits WHERE visit_type = 'emergency' ORDER BY patient_id`,
        `SELECT DISTINCT patient_id FROM visits WHERE facility_id = 2 OR visit_type = 'emergency' ORDER BY patient_id`,
        `SELECT DISTINCT patient_id FROM visits WHERE facility_id = 2 AND visit_type = 'emergency' ORDER BY patient_id DESC`,
        `SELECT patient_id FROM visits WHERE facility_id = 2 AND visit_type = 'emergency' GROUP BY patient_id`,
        `SELECT DISTINCT patient_id FROM visits WHERE facility_id = 2 AND visit_type = 'Emergency' ORDER BY patient_id`,
        `SELECT DISTINCT patient_id FROM visits WHERE facility_id = 2 ORDER BY patient_id`,
        `SELECT DISTINCT patient_id, visit_type FROM visits WHERE facility_id = 2 AND visit_type = 'emergency' ORDER BY patient_id`,
        `SELECT DISTINCT id FROM visits WHERE facility_id = 2 AND visit_type = 'emergency' ORDER BY id`,
        `SELECT patient_id FROM visits WHERE facility_id = 2 AND visit_type = 'emergency' GROUP BY patient_id HAVING count(*) > 1 ORDER BY patient_id`,
        `SELECT DISTINCT patient_id FROM visits WHERE facility_id = 2 AND visit_type <> 'emergency' ORDER BY patient_id`,
        `SELECT id FROM patients WHERE facility_id = 2 ORDER BY id`,
        `SELECT DISTINCT patient_id FROM visits WHERE facility_id = 2 AND visit_type = 'emergency' ORDER BY patient_id LIMIT 10`,
        `SELECT DISTINCT patient_id FROM visits WHERE visit_type = 'emergency' AND patient_id IN (SELECT id FROM patients WHERE facility_id = 2) ORDER BY 1`,
        `SELECT DISTINCT patient_id FROM visits WHERE clinician_id = 2 AND visit_type = 'emergency' ORDER BY patient_id`,
      ],
    },
  },

  // ---------------------------------------------------------------- 0.4 WHERE
  {
    id: 'm00-a04',
    tier: 'B',
    title: 'Infections, however they are written',
    prompt:
      'List the diagnoses whose label contains the text "infection", whatever its capitalisation ("Infection" counts too). ' +
      'Columns: code, label. Any order.',
    hints: [
      'LIKE with % on both sides finds text anywhere in the label. But LIKE cares about capital letters.',
      'ILIKE is LIKE without the case-sensitivity. The test rows add a label that starts with a capital I.',
    ],
    explanation:
      'The pattern \'%infection%\' matches the text anywhere in the label: % stands for any run of characters, including ' +
      'none. LIKE is case-sensitive, so it misses "Infection following a procedure"; ILIKE (a PostgreSQL addition) ignores ' +
      'case, and so does lowering the label first with lower(label) LIKE \'%infection%\'. A pattern without the leading % ' +
      'only finds labels that start with the word.',
    grader: {
      kind: 'result',
      reference: `SELECT code, label
FROM diagnoses
WHERE label ILIKE '%infection%'`,
      ordered: false,
      setup: CAPITAL_INFECTION,
    },
    tests: {
      mustPass: [
        `SELECT code, label FROM diagnoses WHERE lower(label) LIKE '%infection%' ORDER BY code`,
        `SELECT code, label FROM diagnoses WHERE upper(label) LIKE '%INFECTION%'`,
        `select d.code, d.label from diagnoses d where d.label ilike '%INFECTION%'`,
        `SELECT code, label FROM diagnoses WHERE label ~* 'infection'`,
        `SELECT code, label FROM diagnoses WHERE label LIKE '%infection%' OR label LIKE '%Infection%'`,
        `SELECT code, label FROM diagnoses WHERE position('infection' IN lower(label)) > 0`,
        `WITH d AS (SELECT * FROM diagnoses) SELECT code, label FROM d WHERE label ILIKE '%infection%' ORDER BY label DESC`,
        `SELECT * FROM diagnoses WHERE label ILIKE '%Infection%'`,
      ],
      mustFail: [
        `SELECT code, label FROM diagnoses WHERE label LIKE '%infection%'`,
        `SELECT code, label FROM diagnoses WHERE label ILIKE 'infection%'`,
        `SELECT code, label FROM diagnoses WHERE label = 'infection'`,
        `SELECT code, label FROM diagnoses WHERE label LIKE '%Infection%'`,
        `SELECT label FROM diagnoses WHERE label ILIKE '%infection%'`,
        `SELECT code, label FROM diagnoses WHERE label ILIKE '%infect%'`,
        `SELECT code, label FROM diagnoses WHERE label ILIKE '%infection'`,
        `SELECT code, label FROM diagnoses WHERE label ~ 'infection'`,
        `SELECT code, label FROM diagnoses WHERE label LIKE 'Infection%'`,
        `SELECT label, code FROM diagnoses WHERE label ILIKE '%infection%'`,
        `SELECT code, label FROM diagnoses WHERE lower(label) LIKE '%Infection%'`,
        `SELECT code, label FROM diagnoses WHERE label ILIKE 'infection'`,
        `SELECT code, label FROM diagnoses WHERE label ILIKE '%infections%'`,
        `SELECT code, label FROM diagnoses WHERE label ILIKE '%infection%' OR code LIKE 'A%'`,
      ],
    },
  },
  {
    id: 'm00-a05',
    tier: 'B',
    title: 'No phone number on file',
    prompt:
      'The follow-up team at facility 1 cannot phone patients whose number was never recorded. List those patients: ' +
      'registered at facility 1 (patients.facility_id = 1) with no phone number (phone is NULL). Columns: patient id, ' +
      'full name. Any order.',
    hints: [
      'Two conditions, both of which must be true.',
      'A missing value is NULL, and = NULL never matches anything. Use IS NULL.',
    ],
    explanation:
      'Comparing with NULL using = gives an unknown result, never true, so WHERE phone = NULL returns no rows and no error. ' +
      'IS NULL is the test made for missing values. An empty string is a value, not NULL, so phone = \'\' finds nothing ' +
      'here either. Both conditions must hold, so they are joined with AND; OR would list every patient at facility 1 ' +
      'plus everyone without a phone. If you also test for an empty string, use brackets: AND is applied before OR, so ' +
      'facility_id = 1 AND phone IS NULL OR phone = \'\' also lists the test patient at facility 2 whose phone was saved as \'\'.',
    grader: {
      kind: 'result',
      reference: `SELECT id, full_name
FROM patients
WHERE facility_id = 1
  AND phone IS NULL`,
      ordered: false,
      setup: EMPTY_PHONE,
    },
    tests: {
      mustPass: [
        `SELECT id, full_name FROM patients WHERE phone IS NULL AND facility_id = 1 ORDER BY id`,
        `SELECT p.id, p.full_name FROM patients AS p WHERE p.facility_id IN (1) AND NOT (p.phone IS NOT NULL)`,
        `SELECT id, full_name FROM patients WHERE facility_id = 1 AND coalesce(phone, '') = ''`,
        `WITH f1 AS (SELECT * FROM patients WHERE facility_id = 1) SELECT id, full_name FROM f1 WHERE phone IS NULL`,
        `SELECT id, full_name FROM patients WHERE facility_id = 1 AND (phone IS NULL OR phone = '')`,
        `SELECT id, full_name FROM patients WHERE facility_id = 1 EXCEPT SELECT id, full_name FROM patients WHERE phone IS NOT NULL`,
        `SELECT id, full_name FROM patients WHERE facility_id = 1 AND phone IS NOT DISTINCT FROM NULL`,
      ],
      mustFail: [
        `SELECT id, full_name FROM patients WHERE facility_id = 1 AND phone = NULL`,
        `SELECT id, full_name FROM patients WHERE facility_id = 1 AND phone IS NOT NULL`,
        `SELECT id, full_name FROM patients WHERE facility_id = 1 OR phone IS NULL`,
        `SELECT id, full_name FROM patients WHERE phone IS NULL`,
        `SELECT id, full_name FROM patients WHERE facility_id = 1 AND phone = ''`,
        `SELECT id, full_name FROM patients WHERE facility_id = 1 AND phone IS NULL OR phone = ''`,
        `SELECT id, full_name FROM patients WHERE facility_id = 1 AND phone <> ''`,
        `SELECT id, full_name FROM patients WHERE facility_id = 1 AND NOT phone IS NULL`,
        `SELECT id, full_name FROM patients WHERE facility_id = 1 AND phone = 'NULL'`,
        `SELECT id, full_name FROM patients WHERE facility_id <> 1 AND phone IS NULL`,
        `SELECT id, full_name, phone FROM patients WHERE facility_id = 1 AND phone IS NULL`,
        `SELECT count(*) FROM patients WHERE facility_id = 1 AND phone IS NULL`,
        `SELECT id, full_name FROM patients WHERE facility_id = 1 AND phone IN (NULL)`,
        `SELECT id, full_name FROM patients WHERE id = 1 AND phone IS NULL`,
        `SELECT full_name, id FROM patients WHERE facility_id = 1 AND phone IS NULL`,
      ],
    },
  },
  {
    id: 'm00-a06',
    tier: 'B',
    title: 'Still waiting at the pharmacy',
    prompt:
      'Find the prescriptions not yet dispensed (dispensed is false) for either drug 1 or drug 3. Columns: prescription ' +
      'id, visit id, drug id. Any order.',
    hints: [
      'dispensed is a boolean column: NOT dispensed, or dispensed = false, keeps the undispensed ones.',
      'Mixing AND and OR? AND is applied first. Use brackets, or IN (1, 3).',
    ],
    explanation:
      'AND is applied before OR, so NOT dispensed AND drug_id = 1 OR drug_id = 3 means "undispensed drug 1, plus every ' +
      'drug 3 prescription, dispensed or not". Brackets around the OR, or drug_id IN (1, 3), say what you mean. A ' +
      'prescription cannot be for drug 1 and drug 3 at once, so joining the two drug tests with AND finds nothing. A range ' +
      'such as drug_id BETWEEN 1 AND 3 takes in drug 2 as well; the test row adds a drug 2 prescription still waiting.',
    grader: {
      kind: 'result',
      reference: `SELECT id, visit_id, drug_id
FROM prescriptions
WHERE NOT dispensed
  AND drug_id IN (1, 3)`,
      ordered: false,
      setup: DRUG_2_WAITING,
    },
    tests: {
      mustPass: [
        `SELECT id, visit_id, drug_id FROM prescriptions WHERE dispensed = false AND (drug_id = 1 OR drug_id = 3)`,
        `select id, visit_id, drug_id from prescriptions where drug_id in (3, 1) and dispensed is false order by id`,
        `SELECT id, visit_id, drug_id FROM prescriptions WHERE NOT dispensed AND drug_id = 1 UNION ALL SELECT id, visit_id, drug_id FROM prescriptions WHERE NOT dispensed AND drug_id = 3`,
        `SELECT id, visit_id, drug_id FROM prescriptions WHERE dispensed <> true AND drug_id = ANY (ARRAY[1, 3])`,
        `WITH waiting AS (SELECT * FROM prescriptions WHERE NOT dispensed) SELECT id, visit_id, drug_id FROM waiting WHERE drug_id IN (1, 3)`,
        `SELECT id, visit_id, drug_id FROM prescriptions WHERE (NOT dispensed AND drug_id = 1) OR (NOT dispensed AND drug_id = 3)`,
        `SELECT id, visit_id, drug_id FROM prescriptions WHERE dispensed = 'f' AND drug_id IN ('1', '3')`,
      ],
      mustFail: [
        `SELECT id, visit_id, drug_id FROM prescriptions WHERE NOT dispensed AND drug_id = 1 OR drug_id = 3`,
        `SELECT id, visit_id, drug_id FROM prescriptions WHERE dispensed AND drug_id IN (1, 3)`,
        `SELECT id, visit_id, drug_id FROM prescriptions WHERE NOT dispensed AND drug_id = 1 AND drug_id = 3`,
        `SELECT id, visit_id, drug_id FROM prescriptions WHERE NOT dispensed`,
        `SELECT id, visit_id, drug_id FROM prescriptions WHERE drug_id IN (1, 3)`,
        `SELECT id, visit_id, drug_id FROM prescriptions WHERE NOT dispensed AND drug_id BETWEEN 1 AND 3`,
        `SELECT id, visit_id, drug_id FROM prescriptions WHERE NOT dispensed AND drug_id <= 3`,
        `SELECT id, visit_id, drug_id FROM prescriptions WHERE NOT dispensed AND drug_id IN (1, 2, 3)`,
        `SELECT id, visit_id, drug_id FROM prescriptions WHERE drug_id = 1 OR drug_id = 3 AND NOT dispensed`,
        `SELECT id, visit_id, drug_id FROM prescriptions WHERE dispensed = false AND drug_id = 1`,
        `SELECT id, visit_id, drug_id FROM prescriptions WHERE dispensed IS NOT NULL AND drug_id IN (1, 3)`,
        `SELECT id, drug_id, visit_id FROM prescriptions WHERE NOT dispensed AND drug_id IN (1, 3)`,
        `SELECT id, visit_id, drug_id FROM prescriptions WHERE NOT dispensed AND drug_id % 2 = 1`,
        `SELECT id, visit_id, drug_id FROM prescriptions WHERE NOT dispensed AND drug_id NOT IN (2, 4)`,
        `SELECT id, visit_id, drug_id FROM prescriptions WHERE NOT dispensed AND id IN (1, 3)`,
      ],
    },
  },
  {
    id: 'm00-a07',
    tier: 'B',
    title: 'Born in 1990',
    prompt:
      'List the patients born in 1990, from 1 January to 31 December inclusive. Columns: patient id, full name, date of ' +
      'birth. Any order.',
    hints: [
      'date_of_birth is a date, with no time of day, so BETWEEN with the first and last day of the year works.',
      'Check both ends: someone born on 31 December 1990 is in; someone born on 1 January 1991 is not. The test rows include both.',
    ],
    explanation:
      'BETWEEN includes both ends, so BETWEEN \'1990-01-01\' AND \'1990-12-31\' is exactly the year for a date column. ' +
      'Ending the range at 1991-01-01 with BETWEEN takes in New Year\'s Day 1991; strict comparisons at both ends drop ' +
      '1 January and 31 December 1990. The half-open form, >= \'1990-01-01\' AND < \'1991-01-01\', is also right, and it ' +
      'is the form you will need for timestamps in lesson 1.7.',
    grader: {
      kind: 'result',
      reference: `SELECT id, full_name, date_of_birth
FROM patients
WHERE date_of_birth BETWEEN '1990-01-01' AND '1990-12-31'`,
      ordered: false,
      setup: BIRTHDAY_EDGES,
    },
    tests: {
      mustPass: [
        `SELECT id, full_name, date_of_birth FROM patients WHERE date_of_birth >= '1990-01-01' AND date_of_birth < '1991-01-01'`,
        `SELECT id, full_name, date_of_birth FROM patients WHERE extract(year FROM date_of_birth) = 1990 ORDER BY date_of_birth`,
        `SELECT id, full_name, date_of_birth FROM patients WHERE date_of_birth::text LIKE '1990-%'`,
        `SELECT id, full_name, date_of_birth FROM patients WHERE date_part('year', date_of_birth) = 1990`,
        `SELECT id, full_name, date_of_birth FROM patients WHERE date_trunc('year', date_of_birth) = '1990-01-01'`,
        `SELECT id, full_name, date_of_birth FROM patients WHERE date_of_birth BETWEEN date '1990-01-01' AND date '1990-12-31'`,
        `SELECT id, full_name, date_of_birth FROM patients WHERE date_of_birth BETWEEN CAST('1990-01-01' AS date) AND '1990-12-31'::date`,
        `SELECT id, full_name, date_of_birth FROM patients WHERE to_char(date_of_birth, 'YYYY') = '1990'`,
        `SELECT id, full_name, date_of_birth FROM patients WHERE date_of_birth > '1989-12-31' AND date_of_birth <= '1990-12-31'`,
        `WITH b AS (SELECT id, full_name, date_of_birth, extract(year FROM date_of_birth) AS y FROM patients) SELECT id, full_name, date_of_birth FROM b WHERE y = 1990`,
      ],
      mustFail: [
        `SELECT id, full_name, date_of_birth FROM patients WHERE date_of_birth BETWEEN '1990-01-01' AND '1991-01-01'`,
        `SELECT id, full_name, date_of_birth FROM patients WHERE date_of_birth > '1990-01-01' AND date_of_birth < '1990-12-31'`,
        `SELECT id, full_name, date_of_birth FROM patients WHERE date_of_birth < '1991-01-01'`,
        `SELECT id, full_name, date_of_birth FROM patients WHERE date_of_birth >= '1990-01-01'`,
        `SELECT id, full_name FROM patients WHERE date_of_birth BETWEEN '1990-01-01' AND '1990-12-31'`,
        `SELECT id, full_name, date_of_birth FROM patients WHERE date_of_birth BETWEEN '1990-01-01' AND '1990-12-30'`,
        `SELECT id, full_name, date_of_birth FROM patients WHERE date_of_birth BETWEEN '1990-01-02' AND '1990-12-31'`,
        `SELECT id, full_name, date_of_birth FROM patients WHERE date_of_birth BETWEEN '1989-12-31' AND '1990-12-31'`,
        `SELECT id, full_name, date_of_birth FROM patients WHERE date_of_birth >= '1990-01-01' AND date_of_birth <= '1991-01-01'`,
        `SELECT id, full_name, date_of_birth FROM patients WHERE date_of_birth > '1990-01-01' AND date_of_birth <= '1990-12-31'`,
        `SELECT id, full_name, date_of_birth FROM patients WHERE date_of_birth >= '1990-01-01' AND date_of_birth < '1990-12-31'`,
        `SELECT id, full_name, date_of_birth FROM patients WHERE extract(year FROM date_of_birth) BETWEEN 1990 AND 1991`,
        `SELECT id, full_name, date_of_birth FROM patients WHERE date_of_birth BETWEEN '1990-12-31' AND '1990-01-01'`,
        `SELECT id, full_name, date_of_birth FROM patients WHERE registered_at BETWEEN '1990-01-01' AND '1990-12-31'`,
        `SELECT id, full_name, date_of_birth FROM patients WHERE date_of_birth > '1989-12-31' AND date_of_birth < '1990-12-31'`,
      ],
    },
  },
  {
    id: 'm00-a08',
    tier: 'B',
    title: 'Running low',
    prompt:
      'List the stock rows with fewer than 50 units on hand. Columns: facility id, drug id, quantity on hand. Lowest ' +
      'quantity first; where quantities are equal, lower facility id first, then lower drug id.',
    hints: [
      '"Fewer than 50" does not include 50 itself, but it does include 49. The test rows include a shelf at exactly 50 and one at 49.',
      'ORDER BY takes several columns: the second only decides between rows that tie on the first.',
    ],
    explanation:
      'Fewer than 50 is < 50; <= 50 also lists a shelf holding exactly 50. ORDER BY quantity_on_hand puts the lowest ' +
      'first, and the extra sort columns settle ties in the order the task asks for. The test rows tie five shelves at 3 ' +
      'units, four of them at facility 1, and change them in a scrambled order, so the physical order of the rows does ' +
      'not settle the tie for you. < 49 is the opposite slip: it drops the shelf holding 49.',
    grader: {
      kind: 'result',
      reference: `SELECT facility_id, drug_id, quantity_on_hand
FROM stock
WHERE quantity_on_hand < 50
ORDER BY quantity_on_hand, facility_id, drug_id`,
      ordered: true,
      requires: [ORDER_BY],
      setup: STOCK_EDGES,
    },
    tests: {
      mustPass: [
        `SELECT facility_id, drug_id, quantity_on_hand FROM stock WHERE quantity_on_hand <= 49 ORDER BY 3, 1, 2`,
        `select s.facility_id, s.drug_id, s.quantity_on_hand from stock s where not s.quantity_on_hand >= 50 order by s.quantity_on_hand asc, s.facility_id asc, s.drug_id asc`,
        `SELECT facility_id, drug_id, quantity_on_hand FROM stock WHERE quantity_on_hand BETWEEN 0 AND 49 ORDER BY quantity_on_hand, facility_id, drug_id`,
        `WITH low AS (SELECT facility_id, drug_id, quantity_on_hand FROM stock WHERE quantity_on_hand < 50) SELECT * FROM low ORDER BY quantity_on_hand, facility_id, drug_id`,
        `SELECT facility_id AS facility, drug_id AS drug, quantity_on_hand AS qty FROM stock WHERE quantity_on_hand < 50.0 ORDER BY qty, facility, drug`,
      ],
      mustFail: [
        `SELECT facility_id, drug_id, quantity_on_hand FROM stock WHERE quantity_on_hand <= 50 ORDER BY quantity_on_hand, facility_id, drug_id`,
        `SELECT facility_id, drug_id, quantity_on_hand FROM stock WHERE quantity_on_hand < 50 ORDER BY quantity_on_hand DESC, facility_id, drug_id`,
        `SELECT facility_id, drug_id, quantity_on_hand FROM stock WHERE quantity_on_hand < 50`,
        `SELECT facility_id, drug_id, quantity_on_hand FROM stock WHERE quantity_on_hand < 50 ORDER BY quantity_on_hand, drug_id, facility_id`,
        `SELECT facility_id, drug_id, quantity_on_hand FROM stock WHERE quantity_on_hand < 50 ORDER BY facility_id, drug_id`,
        `SELECT facility_id, drug_id, quantity_on_hand FROM stock WHERE quantity_on_hand < 50 ORDER BY quantity_on_hand`,
        `SELECT facility_id, drug_id, quantity_on_hand FROM stock WHERE quantity_on_hand < 50 ORDER BY quantity_on_hand, facility_id`,
        `SELECT facility_id, drug_id, quantity_on_hand FROM stock WHERE quantity_on_hand < 50 ORDER BY quantity_on_hand, drug_id`,
        `SELECT facility_id, drug_id, quantity_on_hand FROM stock WHERE quantity_on_hand < 50 ORDER BY quantity_on_hand, facility_id DESC, drug_id`,
        `SELECT facility_id, drug_id, quantity_on_hand FROM stock WHERE quantity_on_hand < 50 ORDER BY quantity_on_hand, facility_id, drug_id DESC`,
        `SELECT facility_id, drug_id, quantity_on_hand FROM stock WHERE quantity_on_hand BETWEEN 0 AND 50 ORDER BY quantity_on_hand, facility_id, drug_id`,
        `SELECT facility_id, drug_id, quantity_on_hand FROM stock WHERE quantity_on_hand < 49 ORDER BY quantity_on_hand, facility_id, drug_id`,
        `SELECT drug_id, facility_id, quantity_on_hand FROM stock WHERE quantity_on_hand < 50 ORDER BY quantity_on_hand, facility_id, drug_id`,
        `SELECT facility_id, drug_id, quantity_on_hand FROM stock WHERE quantity_on_hand > 50 ORDER BY quantity_on_hand, facility_id, drug_id`,
        `SELECT facility_id, drug_id, quantity_on_hand FROM stock WHERE quantity_on_hand < 50 ORDER BY facility_id, drug_id, quantity_on_hand`,
      ],
    },
  },

  // ---------------------------------------------------------------- 0.5 and 0.6 Types, values and summaries
  {
    id: 'm00-a09',
    tier: 'B',
    title: 'Antenatal visits at facility 2',
    prompt: 'How many antenatal visits (visit_type \'antenatal\') have been recorded at facility 2? One column, one row: the number of visits.',
    hints: ['count(*) counts the rows that pass WHERE.', 'Visit types are stored in lower case.'],
    explanation:
      'count(*) counts rows, and WHERE decides which rows are counted. Counting DISTINCT patient_id answers a different ' +
      'question (how many patients were seen, not how many visits), and count(diagnosis_code) skips visits with no ' +
      'diagnosis recorded. \'Antenatal\' with a capital A matches nothing, because text comparison is exact.',
    grader: {
      kind: 'result',
      reference: `SELECT count(*)
FROM visits
WHERE facility_id = 2
  AND visit_type = 'antenatal'`,
      ordered: false,
    },
    tests: {
      mustPass: [
        `SELECT count(id) AS antenatal_visits FROM visits WHERE visit_type = 'antenatal' AND facility_id = 2`,
        `select count(*) from visits where visit_type in ('antenatal') and facility_id in (2);`,
        `SELECT count(*) FROM visits WHERE facility_id = 2 AND visit_type ILIKE 'Antenatal'`,
        `SELECT count(*) FILTER (WHERE visit_type = 'antenatal') FROM visits WHERE facility_id = 2`,
        `WITH a AS (SELECT * FROM visits WHERE visit_type = 'antenatal' AND facility_id = 2) SELECT count(*) AS visits FROM a`,
        `SELECT count(visit_type) FROM visits WHERE facility_id = 2 AND visit_type = 'antenatal'`,
        `SELECT sum(1) FROM visits WHERE facility_id = 2 AND visit_type = 'antenatal'`,
      ],
      mustFail: [
        `SELECT count(DISTINCT patient_id) FROM visits WHERE facility_id = 2 AND visit_type = 'antenatal'`,
        `SELECT count(*) FROM visits WHERE facility_id = 2`,
        `SELECT count(*) FROM visits WHERE facility_id = 2 AND visit_type = 'Antenatal'`,
        `SELECT count(diagnosis_code) FROM visits WHERE facility_id = 2 AND visit_type = 'antenatal'`,
        `SELECT count(*) FROM visits WHERE visit_type = 'antenatal'`,
        `SELECT count(DISTINCT visit_type) FROM visits WHERE facility_id = 2 AND visit_type = 'antenatal'`,
        `SELECT count(*) FROM visits WHERE facility_id = 2 OR visit_type = 'antenatal'`,
        `SELECT count(*) FROM patients WHERE facility_id = 2`,
        `SELECT count(*) FROM visits WHERE facility_id = 2 GROUP BY visit_type`,
        `SELECT visit_type, count(*) FROM visits WHERE facility_id = 2 AND visit_type = 'antenatal' GROUP BY visit_type`,
        `SELECT count(*) FROM visits WHERE facility_id = 2 AND visit_type = 'antenatal' AND diagnosis_code = 'Z34'`,
        `SELECT count(*) FROM visits WHERE clinician_id = 2 AND visit_type = 'antenatal'`,
        `SELECT count(*) FROM visits WHERE facility_id = 2 AND visit_type <> 'antenatal'`,
        `SELECT count(*)::text FROM visits WHERE facility_id = 2 AND visit_type = 'antenatal'`,
      ],
    },
  },
  {
    id: 'm00-a10',
    tier: 'B',
    title: 'How many patients can we phone?',
    prompt:
      'What percentage of all patients have a phone number recorded? One column, one row: the percentage, rounded to ' +
      '1 decimal place (for example 12.3, not 0.123).',
    hints: [
      'count(phone) counts patients with a number; count(*) counts all patients.',
      'Both counts are whole numbers, so dividing one by the other throws the fraction away. Multiply by 100.0, not 100, then round(..., 1).',
    ],
    explanation:
      'count returns a whole number (bigint), and a whole number divided by a whole number is a whole number: ' +
      'count(phone) / count(*) is 0, and count(phone) * 100 / count(*) loses the decimals. Multiplying by 100.0 makes the ' +
      'calculation numeric before the division, and round(..., 1) keeps one decimal place. Casting a count to numeric ' +
      'first works just as well. count(DISTINCT phone) counts phone numbers, not patients: the test rows give some ' +
      'households a shared phone, and add patients without one so that truncating or rounding to another number of ' +
      'places gives a different answer.',
    grader: {
      kind: 'result',
      reference: `SELECT round(100.0 * count(phone) / count(*), 1)
FROM patients`,
      ordered: false,
      setup: PHONE_EDGES,
    },
    tests: {
      mustPass: [
        `SELECT round(count(phone) * 100.0 / count(*), 1) AS percent_with_phone FROM patients`,
        `SELECT round(count(phone)::numeric / count(*) * 100, 1) FROM patients`,
        `SELECT round(CAST(count(phone) AS numeric) * 100 / count(*), 1) FROM patients`,
        `SELECT round(avg(CASE WHEN phone IS NULL THEN 0 ELSE 100 END), 1) FROM patients`,
        `SELECT round(100.0 * count(*) FILTER (WHERE phone IS NOT NULL) / count(*), 1) FROM patients`,
        `SELECT round(100 * count(phone)::decimal / count(*), 1) FROM patients`,
        `SELECT round((count(phone)::float / count(*) * 100)::numeric, 1) FROM patients`,
        `WITH c AS (SELECT count(phone) AS with_phone, count(*) AS total FROM patients) SELECT round(with_phone * 100.0 / total, 1) AS pct FROM c`,
        `SELECT round(100.0 * count(phone) / count(id), 1) FROM patients`,
      ],
      mustFail: [
        `SELECT count(phone) * 100 / count(*) FROM patients`,
        `SELECT round(count(phone) / count(*) * 100, 1) FROM patients`,
        `SELECT round(100.0 * count(*) / count(phone), 1) FROM patients`,
        `SELECT round(100.0 * count(phone) / count(*)) FROM patients`,
        `SELECT round(count(phone)::numeric / count(*), 1) FROM patients`,
        `SELECT round(100 * count(phone) / count(*), 1) FROM patients`,
        `SELECT 100.0 * count(phone) / count(*) FROM patients`,
        `SELECT round(100.0 * count(phone) / count(*), 2) FROM patients`,
        `SELECT trunc(100.0 * count(phone) / count(*), 1) FROM patients`,
        `SELECT round(100.0 * count(DISTINCT phone) / count(*), 1) FROM patients`,
        `SELECT round(100.0 * count(*) FILTER (WHERE phone IS NULL) / count(*), 1) FROM patients`,
        `SELECT round(100.0 * count(phone) / count(*), 1) || '%' FROM patients`,
        `SELECT round(count(phone) / count(*)::numeric, 3) FROM patients`,
        `SELECT round(100.0 * count(phone) / count(*), 1) FROM patients WHERE phone IS NOT NULL`,
        `SELECT round(100.0 * count(phone) / count(*), 0) FROM patients`,
        `SELECT ceil(100.0 * count(phone) / count(*)) FROM patients`,
        `SELECT round(100.0 * count(phone) / count(*), 1) FROM patients WHERE facility_id = 1`,
      ],
    },
  },
  {
    id: 'm00-a11',
    tier: 'B',
    title: 'Visits by type at facility 1',
    prompt:
      'For facility 1, how many visits of each type have been recorded? Columns: visit type, number of visits. One row ' +
      'per visit type. Any order.',
    hints: [
      'Filter to facility 1 with WHERE, then group.',
      'GROUP BY visit_type gives one row per type, and count(*) counts the visits in each.',
    ],
    explanation:
      'WHERE keeps facility 1\'s visits first; GROUP BY visit_type then makes one group per type, and count(*) counts each ' +
      'group. Every column in the SELECT list is either grouped (visit_type) or aggregated (count). count(DISTINCT ' +
      'patient_id) would count patients, not visits, and count(diagnosis_code) would skip visits with no diagnosis.',
    grader: {
      kind: 'result',
      reference: `SELECT visit_type, count(*)
FROM visits
WHERE facility_id = 1
GROUP BY visit_type`,
      ordered: false,
    },
    tests: {
      mustPass: [
        `SELECT visit_type, count(id) AS visits FROM visits WHERE facility_id = 1 GROUP BY visit_type ORDER BY visits DESC`,
        `select v.visit_type, count(*) from visits v where v.facility_id = 1 group by 1 order by 1`,
        `SELECT visit_type, count(*) FROM visits WHERE facility_id = 1 GROUP BY visit_type HAVING count(*) > 0`,
        `WITH f1 AS (SELECT visit_type FROM visits WHERE facility_id = 1) SELECT visit_type, count(*) AS n FROM f1 GROUP BY visit_type`,
        `SELECT visit_type, sum(1) FROM visits WHERE facility_id = 1 GROUP BY visit_type`,
        `SELECT DISTINCT visit_type, count(*) OVER (PARTITION BY visit_type) FROM visits WHERE facility_id = 1`,
        `SELECT visit_type, count(DISTINCT id) FROM visits WHERE facility_id IN (1) GROUP BY visit_type ORDER BY 2`,
      ],
      mustFail: [
        `SELECT visit_type, count(*) FROM visits GROUP BY visit_type`,
        `SELECT visit_type, count(DISTINCT patient_id) FROM visits WHERE facility_id = 1 GROUP BY visit_type`,
        `SELECT visit_type, count(diagnosis_code) FROM visits WHERE facility_id = 1 GROUP BY visit_type`,
        `SELECT count(*), visit_type FROM visits WHERE facility_id = 1 GROUP BY visit_type`,
        `SELECT DISTINCT visit_type FROM visits WHERE facility_id = 1`,
        `SELECT visit_type, count(*) FROM visits WHERE facility_id = 1 GROUP BY visit_type, patient_id`,
        `SELECT visit_type, count(*) FROM visits GROUP BY visit_type, facility_id`,
        `SELECT facility_id, visit_type, count(*) FROM visits WHERE facility_id = 1 GROUP BY 1, 2`,
        `SELECT visit_type, count(*) FROM visits WHERE facility_id = 1 AND diagnosis_code IS NOT NULL GROUP BY visit_type`,
        `SELECT visit_type, count(*) FROM visits WHERE clinician_id = 1 GROUP BY visit_type`,
        `SELECT visit_type, count(*) FROM visits WHERE facility_id = 1 AND visit_type <> 'outpatient' GROUP BY visit_type`,
        `SELECT visit_type, count(*) FROM visits WHERE facility_id = 2 GROUP BY visit_type`,
        `SELECT visit_type, count(*) FROM visits WHERE facility_id = 1 GROUP BY visit_type HAVING count(*) > 1000`,
        `SELECT count(*) FROM visits WHERE facility_id = 1 GROUP BY visit_type`,
      ],
    },
  },
  {
    id: 'm00-a12',
    tier: 'B',
    title: 'What the pharmacy handed out',
    prompt:
      'For each drug, count the prescriptions that have been dispensed and add up the units dispensed. Count only ' +
      'dispensed prescriptions. Columns: drug id, number of dispensed prescriptions, total units (sum of quantity). One ' +
      'row per drug that has any. Any order.',
    hints: [
      'WHERE dispensed keeps only the dispensed prescriptions, before any counting happens.',
      'GROUP BY drug_id, then count(*) and sum(quantity) in that order.',
    ],
    explanation:
      'WHERE runs before grouping, so it decides which prescriptions are counted and summed: leave it out and you report ' +
      'what was prescribed, not what was handed out. count(*) counts prescription lines; sum(quantity) adds up their ' +
      'units. Mixing them up, or using avg instead of sum, gives numbers that look plausible and are wrong. ' +
      'count(DISTINCT visit_id) counts visits, not prescriptions: the test row gives one visit a second dispensed line ' +
      'for the same drug.',
    grader: {
      kind: 'result',
      reference: `SELECT drug_id, count(*), sum(quantity)
FROM prescriptions
WHERE dispensed
GROUP BY drug_id`,
      ordered: false,
      setup: REPEAT_LINE,
    },
    tests: {
      mustPass: [
        `SELECT drug_id, count(id) AS prescriptions, sum(quantity) AS units FROM prescriptions WHERE dispensed = true GROUP BY drug_id ORDER BY drug_id`,
        `select p.drug_id, count(*), sum(p.quantity) from prescriptions p where p.dispensed is true group by 1`,
        `SELECT drug_id, count(*), sum(quantity) FROM prescriptions WHERE dispensed GROUP BY drug_id HAVING count(*) > 0`,
        `WITH d AS (SELECT * FROM prescriptions WHERE dispensed) SELECT drug_id, count(*), sum(quantity) FROM d GROUP BY drug_id`,
        `SELECT drug_id, count(*) AS n, sum(quantity)::bigint FROM prescriptions WHERE dispensed = 't' GROUP BY drug_id`,
        `SELECT drug_id, count(DISTINCT id), sum(quantity) FROM prescriptions WHERE dispensed GROUP BY drug_id`,
        `SELECT drug_id, count(*), sum(quantity) FROM prescriptions WHERE NOT NOT dispensed GROUP BY 1 ORDER BY 3 DESC`,
      ],
      mustFail: [
        `SELECT drug_id, count(*), sum(quantity) FROM prescriptions GROUP BY drug_id`,
        `SELECT drug_id, count(*), sum(quantity) FROM prescriptions WHERE NOT dispensed GROUP BY drug_id`,
        `SELECT drug_id, sum(quantity), count(*) FROM prescriptions WHERE dispensed GROUP BY drug_id`,
        `SELECT drug_id, count(*), avg(quantity) FROM prescriptions WHERE dispensed GROUP BY drug_id`,
        `SELECT drug_id, count(*), count(quantity) FROM prescriptions WHERE dispensed GROUP BY drug_id`,
        `SELECT drug_id, count(DISTINCT visit_id), sum(quantity) FROM prescriptions WHERE dispensed GROUP BY drug_id`,
        `SELECT drug_id, count(*), sum(DISTINCT quantity) FROM prescriptions WHERE dispensed GROUP BY drug_id`,
        `SELECT drug_id, count(*), max(quantity) FROM prescriptions WHERE dispensed GROUP BY drug_id`,
        `SELECT drug_id, count(*), sum(quantity) FROM prescriptions WHERE dispensed GROUP BY drug_id, visit_id`,
        `SELECT visit_id, count(*), sum(quantity) FROM prescriptions WHERE dispensed GROUP BY visit_id`,
        `SELECT drug_id, count(*), sum(quantity) FROM prescriptions WHERE dispensed IS NOT NULL GROUP BY drug_id`,
        `SELECT drug_id, count(dispensed), sum(quantity) FROM prescriptions GROUP BY drug_id`,
        `SELECT drug_id, sum(quantity) FROM prescriptions WHERE dispensed GROUP BY drug_id`,
        `SELECT drug_id, count(*), sum(quantity) FROM prescriptions WHERE dispensed GROUP BY drug_id HAVING sum(quantity) > 1000000`,
      ],
    },
  },
]

export const CHALLENGES: Challenge[] = PRACTICE
export const ASSIGNMENT_IDS: string[] = PRACTICE.map((c) => c.id)
