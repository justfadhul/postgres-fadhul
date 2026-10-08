// Synthetic clinic dataset. Every name, date and record here is generated;
// none of it describes a real person. The generator is pure SQL so the browser
// downloads nothing extra: PostgreSQL builds the rows with generate_series.

export interface ClinicSize {
  facilities: number
  patients: number
  visits: number
}

export const SIZES = {
  tiny: { facilities: 3, patients: 200, visits: 1_000 },
  small: { facilities: 10, patients: 2_000, visits: 20_000 },
  standard: { facilities: 20, patients: 10_000, visits: 100_000 },
  large: { facilities: 40, patients: 25_000, visits: 250_000 },
} as const satisfies Record<string, ClinicSize>

export type SizeName = keyof typeof SIZES

const CLINICIANS_PER_FACILITY = 8

const GIVEN = [
  'Grace', 'Joseph', 'Sarah', 'Moses', 'Esther', 'Brian', 'Ruth', 'Isaac', 'Aisha', 'Hassan',
  'Florence', 'Peter', 'Juliet', 'Ronald', 'Agnes', 'Samuel', 'Doreen', 'Ivan', 'Harriet', 'Denis',
]
const FAMILY = [
  'Nakato', 'Babirye', 'Okello', 'Mugisha', 'Namubiru', 'Ssemakula', 'Atim', 'Akello', 'Opio',
  'Tumusiime', 'Kato', 'Wasswa', 'Nansubuga', 'Byaruhanga', 'Auma', 'Kintu', 'Achieng', 'Mukasa',
]
const DISTRICTS = ['Kampala', 'Wakiso', 'Mukono', 'Gulu', 'Mbarara', 'Jinja', 'Lira', 'Mbale', 'Arua', 'Masaka']

const sqlArray = (xs: readonly string[]) => `ARRAY[${xs.map((x) => `'${x}'`).join(',')}]`

function assertSize(size: ClinicSize) {
  for (const [k, v] of Object.entries(size)) {
    if (!Number.isInteger(v) || v < 1) throw new Error(`clinic size ${k} must be a positive integer`)
  }
}

/** SQL that drops and rebuilds the `clinic` schema with deterministic synthetic data. */
export function clinicSeedSql(size: ClinicSize): string {
  assertSize(size)
  const { facilities, patients, visits } = size
  const clinicians = facilities * CLINICIANS_PER_FACILITY
  return `
DROP SCHEMA IF EXISTS clinic CASCADE;
CREATE SCHEMA clinic;
SET search_path = clinic, public;
SELECT setseed(0.42);

CREATE TABLE facilities (
  id        integer PRIMARY KEY,
  name      text NOT NULL,
  district  text NOT NULL,
  level     text NOT NULL CHECK (level IN ('HC III', 'HC IV', 'General Hospital'))
);

CREATE TABLE clinicians (
  id           integer PRIMARY KEY,
  facility_id  integer NOT NULL,
  full_name    text NOT NULL,
  role         text NOT NULL CHECK (role IN ('doctor', 'clinical officer', 'nurse', 'pharmacist'))
);

CREATE TABLE patients (
  id             integer PRIMARY KEY,
  facility_id    integer NOT NULL,
  full_name      text NOT NULL,
  sex            text NOT NULL CHECK (sex IN ('F', 'M')),
  date_of_birth  date NOT NULL,
  phone          text,
  registered_at  timestamptz NOT NULL
);

CREATE TABLE diagnoses (
  code   text PRIMARY KEY,
  label  text NOT NULL
);

CREATE TABLE visits (
  id              bigint PRIMARY KEY,
  patient_id      integer NOT NULL,
  facility_id     integer NOT NULL,
  clinician_id    integer NOT NULL,
  visit_at        timestamptz NOT NULL,
  visit_type      text NOT NULL CHECK (visit_type IN ('outpatient', 'antenatal', 'follow-up', 'emergency')),
  diagnosis_code  text
);

CREATE TABLE drugs (
  id    integer PRIMARY KEY,
  name  text NOT NULL UNIQUE,
  unit  text NOT NULL
);

CREATE TABLE prescriptions (
  id         bigint PRIMARY KEY,
  visit_id   bigint NOT NULL,
  drug_id    integer NOT NULL,
  quantity   integer NOT NULL CHECK (quantity > 0),
  dispensed  boolean NOT NULL DEFAULT false
);

CREATE TABLE stock (
  facility_id       integer NOT NULL,
  drug_id           integer NOT NULL,
  quantity_on_hand  integer NOT NULL CHECK (quantity_on_hand >= 0),
  PRIMARY KEY (facility_id, drug_id)
);

INSERT INTO diagnoses (code, label) VALUES
  ('B54', 'Malaria, unspecified'), ('I10', 'Essential hypertension'),
  ('E11', 'Type 2 diabetes'), ('J06.9', 'Acute upper respiratory infection'),
  ('A09', 'Infectious gastroenteritis'), ('N39.0', 'Urinary tract infection'),
  ('Z34', 'Supervision of normal pregnancy'), ('K29.7', 'Gastritis, unspecified');

INSERT INTO drugs (id, name, unit) VALUES
  (1, 'Artemether-lumefantrine', 'tablet'), (2, 'Paracetamol 500 mg', 'tablet'),
  (3, 'Amoxicillin 500 mg', 'capsule'), (4, 'Metformin 500 mg', 'tablet'),
  (5, 'Amlodipine 5 mg', 'tablet'), (6, 'Oral rehydration salts', 'sachet'),
  (7, 'Ferrous sulphate + folic acid', 'tablet'), (8, 'Omeprazole 20 mg', 'capsule');

INSERT INTO facilities (id, name, district, level)
SELECT f,
       (${sqlArray(DISTRICTS)})[1 + (f - 1) % ${DISTRICTS.length}] || ' Health Centre ' || f,
       (${sqlArray(DISTRICTS)})[1 + (f - 1) % ${DISTRICTS.length}],
       (ARRAY['HC III', 'HC IV', 'General Hospital'])[1 + (f - 1) % 3]
FROM generate_series(1, ${facilities}) AS f;

INSERT INTO clinicians (id, facility_id, full_name, role)
SELECT c,
       1 + (c - 1) / ${CLINICIANS_PER_FACILITY},
       (${sqlArray(GIVEN)})[1 + floor(random() * ${GIVEN.length})::int] || ' ' ||
       (${sqlArray(FAMILY)})[1 + floor(random() * ${FAMILY.length})::int],
       (ARRAY['doctor', 'clinical officer', 'nurse', 'nurse', 'nurse', 'clinical officer', 'pharmacist', 'doctor'])[1 + (c - 1) % ${CLINICIANS_PER_FACILITY}]
FROM generate_series(1, ${clinicians}) AS c;

INSERT INTO patients (id, facility_id, full_name, sex, date_of_birth, phone, registered_at)
SELECT p,
       1 + (p - 1) % ${facilities},
       (${sqlArray(GIVEN)})[1 + floor(random() * ${GIVEN.length})::int] || ' ' ||
       (${sqlArray(FAMILY)})[1 + floor(random() * ${FAMILY.length})::int],
       CASE WHEN random() < 0.55 THEN 'F' ELSE 'M' END,
       date '1945-01-01' + floor(random() * 28000)::int,
       CASE WHEN random() < 0.8 THEN '+256 7' || lpad(floor(random() * 100000000)::int::text, 8, '0') END,
       timestamptz '2022-01-01 08:00:00+03' + random() * interval '730 days'
FROM generate_series(1, ${patients}) AS p;

INSERT INTO visits (id, patient_id, facility_id, clinician_id, visit_at, visit_type, diagnosis_code)
SELECT v, pid, fid,
       (fid - 1) * ${CLINICIANS_PER_FACILITY} + 1 + floor(random() * ${CLINICIANS_PER_FACILITY})::int,
       timestamptz '2024-01-01 07:00:00+03' + random() * interval '730 days',
       (ARRAY['outpatient', 'outpatient', 'outpatient', 'follow-up', 'antenatal', 'emergency'])[1 + floor(random() * 6)::int],
       CASE WHEN random() < 0.9
            THEN (ARRAY['B54', 'I10', 'E11', 'J06.9', 'A09', 'N39.0', 'Z34', 'K29.7'])[1 + floor(random() * 8)::int] END
FROM (
  SELECT v, pid, 1 + (pid - 1) % ${facilities} AS fid
  FROM (SELECT v, 1 + floor(random() * ${patients})::int AS pid FROM generate_series(1, ${visits}) AS v) s
) t;

INSERT INTO prescriptions (id, visit_id, drug_id, quantity, dispensed)
SELECT row_number() OVER (ORDER BY v.id, n), v.id,
       1 + (v.id * 7 + n * 3) % 8,
       (ARRAY[6, 10, 14, 20, 30])[1 + ((v.id + n) % 5)::int],
       (v.id + n) % 10 <> 0
FROM visits v
CROSS JOIN LATERAL generate_series(1, (v.id % 3)::int) AS n;

INSERT INTO stock (facility_id, drug_id, quantity_on_hand)
SELECT f.id, d.id, floor(random() * 500)::int
FROM facilities f CROSS JOIN drugs d;

ALTER TABLE clinicians ADD FOREIGN KEY (facility_id) REFERENCES facilities;
ALTER TABLE patients ADD FOREIGN KEY (facility_id) REFERENCES facilities;
ALTER TABLE visits ADD FOREIGN KEY (patient_id) REFERENCES patients;
ALTER TABLE visits ADD FOREIGN KEY (facility_id) REFERENCES facilities;
ALTER TABLE visits ADD FOREIGN KEY (clinician_id) REFERENCES clinicians;
ALTER TABLE visits ADD FOREIGN KEY (diagnosis_code) REFERENCES diagnoses;
ALTER TABLE prescriptions ADD FOREIGN KEY (visit_id) REFERENCES visits;
ALTER TABLE prescriptions ADD FOREIGN KEY (drug_id) REFERENCES drugs;
ALTER TABLE stock ADD FOREIGN KEY (facility_id) REFERENCES facilities;
ALTER TABLE stock ADD FOREIGN KEY (drug_id) REFERENCES drugs;

ANALYZE;
`
}
