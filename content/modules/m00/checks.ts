import type { QuickCheck } from '../../types'

// Quick checks for Module 0, in lesson order. Each is placed in its lesson with <QuickCheck id="…" />.
// Checks that state PostgreSQL behaviour carry a `verify` that the content tests run.
export const CHECKS: QuickCheck[] = [
  // 0.1 The big picture
  {
    id: 'm00-qc-01-1',
    kind: 'choice',
    prompt: 'In this course, which of these is the database management system (DBMS)?',
    options: ['The clinic tables', 'SQL', 'PostgreSQL', 'Your web browser'],
    answer: 2,
    explanation:
      'PostgreSQL is the software that stores the data, answers queries, applies the rules and recovers from failures: that is a DBMS. The clinic tables are the database it manages, and SQL is the language you use to talk to it. The browser only hosts PGlite here; it is not the DBMS. The tempting answer is "the clinic tables", because everyday speech calls both the data and the software "the database".',
  },
  {
    id: 'm00-qc-01-2',
    kind: 'choice',
    prompt: 'You create a table in the workbench on this site. Where is it stored?',
    options: [
      'On a PostgreSQL server in the cloud, shared with other learners',
      'In this browser on this device, until you remove it or press Reset',
      'In the lesson page, until you leave it',
      'Nowhere: the workbench cannot create tables',
    ],
    answer: 1,
    explanation:
      'PGlite runs PostgreSQL inside your browser and saves its data in the browser\'s own storage, on this device only. There is no server, so nothing is shared or sent anywhere. That is also why the data stays on this device unless you send a progress file to another one (Settings). The third option is closest to lesson examples, but those are undone as soon as each one finishes; the workbench keeps your changes.',
  },
  {
    id: 'm00-qc-01-3',
    kind: 'choice',
    prompt: 'SQL is called declarative. What does a SQL query describe?',
    options: [
      'The steps PostgreSQL must follow, in order, to find the rows',
      'The result you want; PostgreSQL decides how to produce it',
      'Which files on disk to read',
      'How the result should be laid out on the screen',
    ],
    answer: 1,
    explanation:
      'A query states what you want: these columns, from this table, these rows, in this order. PostgreSQL\'s planner (the part that decides how to run a query) chooses how to get it, for example whether to read the whole table or use an index, a lookup structure like the index of a book (Module 3). The tempting first option describes a procedural language, where you write the steps yourself. Files and screen layout are not part of SQL at all.',
  },

  // 0.2 Tables, rows and keys
  {
    id: 'm00-qc-02-1',
    kind: 'choice',
    prompt: 'You type plain patients in a query, yet the table\'s full name is clinic.patients. Why does it work?',
    options: [
      'PostgreSQL ignores schema names',
      'The session\'s search path lists the clinic schema, so PostgreSQL looks there for unprefixed names',
      'There is a second copy of the table with no schema',
      'Table names are not case-sensitive',
    ],
    answer: 1,
    explanation:
      'The search path is the list of schemas PostgreSQL searches for a table name with no prefix, and every session here puts clinic first. Schema names are not ignored: with a different search path, plain patients would not be found. There is only one patients table. Case-insensitivity of unquoted names is true, but it has nothing to do with the missing prefix.',
    verify: { sql: `SELECT current_schema()`, expect: 'clinic' },
  },
  {
    id: 'm00-qc-02-2',
    kind: 'choice',
    prompt: 'One patient has many visits; each visit belongs to one patient. Where does the foreign key go?',
    options: [
      'On patients: a column listing the ids of all their visits',
      'On visits: a patient_id column pointing at patients.id',
      'On both tables',
      'Nowhere: one-to-many relationships do not need keys',
    ],
    answer: 1,
    explanation:
      'The foreign key sits on the "many" side. Each visit holds exactly one patient id, which fits in one column. A column on patients would have to hold a list of visit ids that grows with every visit, which is exactly what tables are designed to avoid. The clinic schema has visits.patient_id with a foreign key to patients.id, and PostgreSQL rejects a visit whose patient does not exist (error 23503).',
    verify: {
      sql: `SELECT pg_get_constraintdef(oid) FROM pg_constraint WHERE conname = 'visits_patient_id_fkey'`,
      expect: 'FOREIGN KEY (patient_id) REFERENCES patients(id)',
    },
  },
  {
    id: 'm00-qc-02-3',
    kind: 'choice',
    prompt: 'The stock table\'s primary key is (facility_id, drug_id). What does that guarantee?',
    options: [
      'Each facility appears in only one stock row',
      'Each drug appears in only one stock row',
      'Each combination of facility and drug appears at most once, and neither column is ever NULL',
      'Stock can never go negative',
    ],
    answer: 2,
    explanation:
      'A composite primary key makes the pair unique, not each column on its own: facility 1 has a row for every drug, and drug 2 has a row at every facility, but "facility 1, drug 2" occurs once. Primary key columns can never be NULL. Stock not going negative is a different rule, a CHECK constraint, which lesson 0.7 shows in action.',
    verify: {
      sql: `SELECT count(*) = count(DISTINCT (facility_id, drug_id)), count(DISTINCT facility_id) < count(*) FROM stock`,
      expect: 't, t',
    },
  },

  // 0.3 Asking questions with SELECT
  {
    id: 'm00-qc-03-1',
    kind: 'predict',
    prompt: 'What does this return?',
    sql: `SELECT x
FROM (VALUES (3), (1), (2), (5)) AS t(x)
ORDER BY x DESC
LIMIT 2;`,
    options: ['3; 1', '1; 2', '5; 3', '5; 3; 2; 1'],
    answer: 2,
    explanation:
      'ORDER BY x DESC sorts largest first (5, 3, 2, 1), then LIMIT 2 keeps the first two rows: 5 and 3. "3; 1" is the first two rows in the order they were written, which is what LIMIT without ORDER BY might give, with no guarantee. "1; 2" would be ascending order. The last option ignores the LIMIT. (VALUES builds a small table on the spot: a handy way to test an idea.)',
    verify: { sql: `SELECT x FROM (VALUES (3), (1), (2), (5)) AS t(x) ORDER BY x DESC LIMIT 2`, expect: '5; 3' },
  },
  {
    id: 'm00-qc-03-2',
    kind: 'predict',
    prompt: 'Four visits were recorded with these types. How many rows does this return?',
    sql: `SELECT DISTINCT visit_type
FROM (VALUES ('outpatient'), ('emergency'), ('outpatient'), ('outpatient')) AS v(visit_type);`,
    options: ['1', '2', '3', '4'],
    answer: 1,
    explanation:
      'DISTINCT keeps each different value once: outpatient and emergency, so 2 rows. 4 is the number of rows before DISTINCT, and 3 is the number of outpatient visits, which DISTINCT does not report: counting is lesson 0.6.',
    verify: {
      sql: `SELECT count(*) FROM (SELECT DISTINCT visit_type FROM (VALUES ('outpatient'), ('emergency'), ('outpatient'), ('outpatient')) AS v(visit_type)) AS d`,
      expect: '2',
    },
  },
  {
    id: 'm00-qc-03-3',
    kind: 'predict',
    prompt: 'The comma after full_name is missing. What does this return?',
    sql: `SELECT full_name sex
FROM (VALUES ('Ruth Atim', 'F')) AS p(full_name, sex);`,
    options: [
      'A syntax error',
      'Two columns: full_name and sex',
      'One column headed sex, holding Ruth Atim',
      'One column headed full_name, holding F',
    ],
    answer: 2,
    explanation:
      'AS is optional, so "full_name sex" means "full_name, renamed sex". You get one column, headed sex, containing the name. That is why this mistake is dangerous: there is no error, only a result with a misleading heading and a missing column. A comma too many, by contrast, is a syntax error (42601).',
    verify: { sql: `SELECT full_name sex FROM (VALUES ('Ruth Atim', 'F')) AS p(full_name, sex)`, expect: 'Ruth Atim' },
  },

  // 0.4 Filtering rows with WHERE
  {
    id: 'm00-qc-04-1',
    kind: 'predict',
    prompt:
      'The aim is "antenatal or emergency visits, at facility 1", but the brackets are missing. How many of these three visits does it return?',
    sql: `SELECT count(*)
FROM (VALUES ('antenatal', 2), ('emergency', 1), ('emergency', 2)) AS v(visit_type, facility_id)
WHERE visit_type = 'antenatal' OR visit_type = 'emergency' AND facility_id = 1;`,
    options: ['0', '1', '2', '3'],
    answer: 2,
    explanation:
      'AND is applied before OR, so the condition means antenatal OR (emergency AND facility 1). The antenatal visit at facility 2 passes the first part, and the emergency visit at facility 1 passes the second: 2 rows. The intended answer, 1, needs brackets: (visit_type = \'antenatal\' OR visit_type = \'emergency\') AND facility_id = 1.',
    verify: {
      sql: `SELECT count(*) FROM (VALUES ('antenatal', 2), ('emergency', 1), ('emergency', 2)) AS v(visit_type, facility_id) WHERE visit_type = 'antenatal' OR visit_type = 'emergency' AND facility_id = 1`,
      expect: '2',
    },
  },
  {
    id: 'm00-qc-04-2',
    kind: 'predict',
    prompt: 'What does this return?',
    sql: `SELECT 50 BETWEEN 10 AND 50 AS upper_end,
       20 BETWEEN 50 AND 10 AS reversed;`,
    options: ['t, t', 't, f', 'f, t', 'f, f'],
    answer: 1,
    explanation:
      'BETWEEN includes both ends, so 50 BETWEEN 10 AND 50 is true. It also expects the low end first: 20 BETWEEN 50 AND 10 means 20 >= 50 AND 20 <= 10, which is false. "f, …" is the tempting answer if you think of BETWEEN as excluding its ends.',
    verify: { sql: `SELECT 50 BETWEEN 10 AND 50, 20 BETWEEN 50 AND 10`, expect: 't, f' },
  },
  {
    id: 'm00-qc-04-3',
    kind: 'predict',
    prompt: 'What does this return?',
    sql: `SELECT 'Malaria, unspecified' LIKE 'malaria%'  AS with_like,
       'Malaria, unspecified' ILIKE 'malaria%' AS with_ilike;`,
    options: ['t, t', 't, f', 'f, t', 'f, f'],
    answer: 2,
    explanation:
      'LIKE is case-sensitive, and the pattern starts with a small m while the label starts with a capital M, so it is false. ILIKE ignores case, so it is true. The % at the end matches the rest of the label, ", unspecified".',
    verify: { sql: `SELECT 'Malaria, unspecified' LIKE 'malaria%', 'Malaria, unspecified' ILIKE 'malaria%'`, expect: 'f, t' },
  },
  {
    id: 'm00-qc-04-4',
    kind: 'predict',
    prompt: 'Two patients, one with a phone number and one without. How many rows does this count?',
    sql: `SELECT count(*)
FROM (VALUES ('+256 700000001'), (NULL)) AS p(phone)
WHERE phone = NULL;`,
    options: ['0', '1', '2', 'An error'],
    answer: 0,
    explanation:
      'Comparing anything with NULL using = gives NULL (unknown), never true, and WHERE keeps only rows where the condition is true. So no row passes and the count is 0. It is not an error, which is what makes it a trap. WHERE phone IS NULL would count 1.',
    verify: { sql: `SELECT count(*) FROM (VALUES ('+256 700000001'), (NULL)) AS p(phone) WHERE phone = NULL`, expect: '0' },
  },

  // 0.5 Types and values
  {
    id: 'm00-qc-05-1',
    kind: 'choice',
    prompt: 'You want visits whose type is emergency. Which condition is right?',
    options: [
      `visit_type = "emergency"`,
      `visit_type = 'emergency'`,
      `visit_type = emergency`,
      `"visit_type" = "emergency"`,
    ],
    answer: 1,
    explanation:
      'Single quotes make a text value. Double quotes make a name, so "emergency" (with or without the quotes) is read as a column called emergency, and PostgreSQL reports that the column does not exist (42703). Double quotes around visit_type are harmless, because the column name is all lower case, but the value still needs single quotes.',
  },
  {
    id: 'm00-qc-05-2',
    kind: 'predict',
    prompt: 'What does this return?',
    sql: `SELECT '10' < '9' AS as_text,
       10 < 9 AS as_numbers;`,
    options: ['t, t', 't, f', 'f, t', 'f, f'],
    answer: 1,
    explanation:
      'Text is compared character by character, and the character 1 comes before 9, so \'10\' < \'9\' is true. As numbers, 10 < 9 is false. This is why numbers belong in number columns: stored as text, they sort as 1, 10, 2, 20, 9.',
    verify: { sql: `SELECT '10' < '9', 10 < 9`, expect: 't, f' },
  },
  {
    id: 'm00-qc-05-3',
    kind: 'predict',
    prompt: 'What does this return?',
    sql: `SELECT 7 / 2 AS a,
       7 / 2.0 AS b;`,
    options: ['3.5, 3.5', '3, 3.5000000000000000', '4, 3.5000000000000000', '3, 3'],
    answer: 1,
    explanation:
      'Both 7 and 2 are integers, so 7 / 2 is integer division: the fraction is thrown away, giving 3 (not rounded up to 4). With 2.0 one side is numeric, so the answer keeps its decimals, shown with a long run of zeros: 3.5000000000000000. round(7 / 2.0, 1) would show 3.5.',
    verify: { sql: `SELECT 7 / 2, 7 / 2.0`, expect: '3, 3.5000000000000000' },
  },
  {
    id: 'm00-qc-05-4',
    kind: 'predict',
    prompt: 'What does this return?',
    sql: `SELECT 1 + NULL AS plus,
       NULL = NULL AS equals;`,
    options: ['1, t', '1, NULL', 'NULL, t', 'NULL, NULL'],
    answer: 3,
    explanation:
      'NULL means "no value", so adding 1 to it gives an unknown result, NULL. Comparing two unknowns is also unknown: NULL = NULL is NULL, not true. The tempting "1, t" treats NULL as zero and as equal to itself; it is neither. Use IS NULL to test for it.',
    verify: { sql: `SELECT 1 + NULL, NULL = NULL`, expect: 'NULL, NULL' },
  },

  // 0.6 Counting and summarising
  {
    id: 'm00-qc-06-1',
    kind: 'predict',
    prompt: 'Four patients: two share a phone number, one has another number, one has none. What does this return?',
    sql: `SELECT count(*), count(phone), count(DISTINCT phone)
FROM (VALUES ('+256 700000001'), ('+256 700000001'), ('+256 700000002'), (NULL)) AS p(phone);`,
    options: ['4, 4, 3', '4, 3, 2', '4, 3, 3', '3, 3, 2'],
    answer: 1,
    explanation:
      'count(*) counts rows: 4. count(phone) skips the NULL: 3. count(DISTINCT phone) counts different non-NULL values, and there are two different numbers: 2. "4, 4, 3" counts NULL as a value, which none of the column counts do.',
    verify: {
      sql: `SELECT count(*), count(phone), count(DISTINCT phone) FROM (VALUES ('+256 700000001'), ('+256 700000001'), ('+256 700000002'), (NULL)) AS p(phone)`,
      expect: '4, 3, 2',
    },
  },
  {
    id: 'm00-qc-06-2',
    kind: 'predict',
    prompt: 'No prescription passes the WHERE condition. What does this return?',
    sql: `SELECT count(*), max(quantity)
FROM (VALUES (6), (10)) AS p(quantity)
WHERE quantity > 100;`,
    options: ['No rows', '0, 0', '0, NULL', 'NULL, NULL'],
    answer: 2,
    explanation:
      'An aggregate query without GROUP BY always returns one row, even when no rows pass WHERE. count(*) of nothing is 0; max of nothing has no answer, so it is NULL. The same is true of sum, avg and min. "0, 0" is the common guess, and it is why a report can show a blank where you expected 0.',
    verify: { sql: `SELECT count(*), max(quantity) FROM (VALUES (6), (10)) AS p(quantity) WHERE quantity > 100`, expect: '0, NULL' },
  },
  {
    id: 'm00-qc-06-3',
    kind: 'choice',
    prompt: 'Why does SELECT visit_type, count(*) FROM visits; fail?',
    options: [
      'count(*) cannot be used on the visits table',
      'The count makes one row from all visits, but visit_type has several values, and PostgreSQL will not choose one: visit_type must be grouped or aggregated',
      'visit_type needs single quotes',
      'A query cannot have more than one column when it uses count',
    ],
    answer: 1,
    explanation:
      'Without GROUP BY, count(*) collapses every visit into one row, and there is no single visit_type to put beside it. PostgreSQL refuses (42803) rather than pick one. Adding GROUP BY visit_type gives one row per type, with its count. Single quotes would turn the column name into a fixed piece of text, a different query; and queries with count can have as many columns as you like, as long as each is grouped or aggregated.',
  },

  // 0.7 Changing data safely
  {
    id: 'm00-qc-07-1',
    kind: 'choice',
    prompt:
      'An UPDATE takes 100 units from the stock of one drug at every facility. One facility holds only 50 units, and the CHECK constraint says stock may not go below zero. What happens?',
    options: [
      'The UPDATE fails with an error, and no facility\'s stock changes',
      'Every facility except that one loses 100 units; that one is skipped',
      'That facility\'s stock becomes -50',
      'That facility\'s stock is set to 0 and the rest lose 100 units',
    ],
    answer: 0,
    explanation:
      'A statement succeeds completely or changes nothing. The other facilities could have given 100 units, but one row would break the CHECK constraint, so the whole UPDATE fails (23514) and every row keeps its old value. PostgreSQL never skips the bad row quietly, never stores a value that breaks a constraint, and never adjusts your value to fit.',
    verify: {
      // A DO block catches the error so the shelves can be read afterwards.
      sql: `CREATE TEMP TABLE shelf (units integer CHECK (units >= 0)); INSERT INTO shelf VALUES (500), (50); DO $$ BEGIN UPDATE shelf SET units = units - 100; EXCEPTION WHEN check_violation THEN NULL; END $$; SELECT units FROM shelf ORDER BY units DESC`,
      expect: '500; 50',
    },
  },
  {
    id: 'm00-qc-07-2',
    kind: 'choice',
    prompt: 'In the workbench, you run DELETE FROM prescriptions; with no WHERE. What happens?',
    options: [
      'PostgreSQL asks you to confirm',
      'Nothing: DELETE needs a WHERE clause',
      'Every row in prescriptions is deleted, and the change is kept',
      'Only the first row is deleted',
    ],
    answer: 2,
    explanation:
      'Without WHERE, DELETE applies to every row, and PostgreSQL does not ask first. In the workbench, outside BEGIN, the statement commits at once, so the rows stay gone until you press Reset. On a real server, only a backup would bring them back. Write the WHERE as a SELECT first, or use BEGIN so you can ROLLBACK.',
  },
  {
    id: 'm00-qc-07-3',
    kind: 'choice',
    prompt:
      'In the workbench you run BEGIN, then DELETE FROM stock WHERE facility_id = 1, then ROLLBACK. Afterwards, what does SELECT count(*) FROM stock WHERE facility_id = 1 show?',
    options: [
      '0: the rows were deleted',
      'The same number as before the BEGIN',
      'An error: the stock table is locked',
      'Half the original rows',
    ],
    answer: 1,
    explanation:
      'ROLLBACK undoes every change made since BEGIN, so the deleted rows are all back and the count is what it was before. "0" would be right after COMMIT, or without BEGIN at all, because then the DELETE commits at once. A transaction is all or nothing; it never keeps part of its changes.',
    verify: {
      sql: `BEGIN; DELETE FROM stock WHERE facility_id = 1; ROLLBACK; SELECT count(*) > 0 FROM stock WHERE facility_id = 1`,
      expect: 't',
    },
  },
]
