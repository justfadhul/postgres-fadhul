// Extra rows a grader adds (inside its rolled-back transaction) for cases the
// generated clinic data lacks: visits just after midnight Kampala time on a
// boundary day, visits away from the patient's home facility, tied visit times,
// patients with no visits, a longer referral chain. Each helper returns plain
// SQL that the learner can read under the challenge.

type Level = 'HC III' | 'HC IV' | 'General Hospital'

export interface TestVisit {
  /** Test patients are numbered from 1 within one setup; visits with the same number share a patient. */
  patient: number
  /** Kampala local time, 'YYYY-MM-DD HH:MM'. */
  at: string
  /** Level of the facility visited. Default: the patient's home facility, an HC III. */
  level?: Level
  type?: 'outpatient' | 'antenatal' | 'follow-up' | 'emergency'
  /** Default 'I10'. */
  diagnosis?: string | null
  /** Adds one prescription of this drug to the visit. */
  drug?: string
  quantity?: number
  /** A negative id: lower than every real visit id, although the row is stored last. Tests tie-breaks on id. */
  lowId?: boolean
}

const quote = (s: string) => `'${s.replaceAll("'", "''")}'`

/** New test patients (home facility: the first HC III) and their visits. */
export function testVisits(visits: TestVisit[], extra: { patientsWithoutVisits?: number } = {}): string {
  const visiting = Math.max(0, ...visits.map((v) => v.patient))
  const total = visiting + (extra.patientsWithoutVisits ?? 0)
  const lines: string[] = [`-- ${total} test patient${total === 1 ? '' : 's'}, numbered after the real ones`]
  for (let n = 1; n <= total; n++) {
    lines.push(
      `INSERT INTO patients (id, facility_id, full_name, sex, date_of_birth, phone, registered_at)
SELECT max(id) + 1, (SELECT min(id) FROM facilities WHERE level = 'HC III'), 'Test patient ${n}', 'F', date '1990-05-01', NULL, timestamptz '2024-01-01 09:00+03'
FROM patients;`,
    )
  }
  for (const v of visits) {
    const pid = `(SELECT max(id) FROM patients) - ${total - v.patient}`
    const vid = v.lowId ? '(SELECT least(min(id), 0) - 1 FROM visits)' : '(SELECT max(id) + 1 FROM visits)'
    const facility = v.level ? `(SELECT min(id) FROM facilities WHERE level = ${quote(v.level)})` : 'p.facility_id'
    const diagnosis = v.diagnosis === null ? 'NULL' : quote(v.diagnosis ?? 'I10')
    lines.push(
      `-- test patient ${v.patient}: ${v.type ?? 'outpatient'} visit at ${v.at} Kampala time${v.level ? `, at a ${v.level}` : ''}${v.lowId ? ', low id' : ''}
INSERT INTO visits (id, patient_id, facility_id, clinician_id, visit_at, visit_type, diagnosis_code)
SELECT ${vid}, p.id, f.id, (SELECT min(c.id) FROM clinicians c WHERE c.facility_id = f.id),
       timestamptz '${v.at}+03', ${quote(v.type ?? 'outpatient')}, ${diagnosis}
FROM patients p JOIN facilities f ON f.id = ${facility}
WHERE p.id = ${pid};`,
    )
    if (v.drug) {
      lines.push(
        `INSERT INTO prescriptions (id, visit_id, drug_id, quantity, dispensed)
SELECT (SELECT coalesce(max(id), 0) + 1 FROM prescriptions), (SELECT ${v.lowId ? 'min' : 'max'}(id) FROM visits), d.id, ${v.quantity ?? 6}, false
FROM drugs d WHERE d.name = ${quote(v.drug)};`,
      )
    }
  }
  return lines.join('\n')
}

/**
 * Ties at the latest visit: for the first `count` patients, a copy of their latest visit at the same
 * time with a different diagnosis. Half the copies get a higher id (the copy is "the latest"), half a
 * negative id (the original stays "the latest"), so no physical row order settles the tie by luck.
 */
export function latestVisitTies(count = 20): string {
  return `-- ${count} patients get a second visit at exactly the time of their latest one
INSERT INTO visits (id, patient_id, facility_id, clinician_id, visit_at, visit_type, diagnosis_code)
SELECT CASE WHEN k % 2 = 0 THEN top + k ELSE -k END,
       patient_id, facility_id, clinician_id, visit_at, visit_type,
       CASE WHEN diagnosis_code IS DISTINCT FROM 'B54' THEN 'B54' ELSE 'I10' END
FROM (
  SELECT l.*, row_number() OVER (ORDER BY l.patient_id) AS k, (SELECT max(id) FROM visits) AS top
  FROM (SELECT DISTINCT ON (patient_id) * FROM visits ORDER BY patient_id, visit_at DESC, id DESC) l
  ORDER BY l.patient_id
  LIMIT ${count}
) t;`
}

/** A facility three referral steps from the top: an HC III that refers to another HC III. */
export const LONGER_REFERRAL_CHAIN = `-- a new HC III that refers to an HC III, which refers on to an HC IV and then a hospital
INSERT INTO facilities (id, name, district, level, referral_facility_id)
SELECT max(id) + 1, 'Test HC III (outreach)', 'Test district', 'HC III',
       (SELECT min(id) FROM facilities WHERE level = 'HC III' AND referral_facility_id IS NOT NULL)
FROM facilities;`
