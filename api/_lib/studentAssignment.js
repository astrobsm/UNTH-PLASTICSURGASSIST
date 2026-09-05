/**
 * Put a newly admitted patient in front of a student group.
 *
 * WHAT WAS MISSING
 * Patients only reached students when an administrator pressed "Assign Patients
 * to Groups", which re-runs a round-robin over every active admission. Between
 * one press and the next, a patient admitted on Monday was invisible to the
 * students on the ward all week — and clinical posting is time-boxed, so a
 * missed week is a missed week.
 *
 * LEAST-LOADED, NOT ROUND-ROBIN
 * The bulk assign walks the whole list and hands out patients by position, which
 * is even because it starts from nothing every time. Assigning one patient at a
 * time cannot do that: it has to look at what each group already carries.
 * Otherwise a group that happened to be created first collects every new
 * admission. Ties go to the lowest group number so the behaviour is stable.
 *
 * Groups with no students are skipped. A patient assigned to an empty group is
 * assigned to nobody, and would sit there looking allocated.
 *
 * NEVER THROWS. An admission is the clinical record; teaching allocation is a
 * convenience on top of it. If this fails, the admission still stands and the
 * administrator's bulk assign remains the backstop.
 */

import { query } from './db.js';

/** Must match NUM_GROUPS in api/students.js — clinical posting runs five groups. */
const NUM_GROUPS = 5;

let tablesReady = false;

async function ensureTables() {
  if (tablesReady) return;
  await query(`
    CREATE TABLE IF NOT EXISTS student_group_patients (
      id SERIAL PRIMARY KEY,
      group_number INTEGER NOT NULL,
      patient_id VARCHAR(255) NOT NULL,
      hospital_number VARCHAR(100),
      patient_name VARCHAR(255),
      assigned_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
      is_active BOOLEAN DEFAULT TRUE,
      UNIQUE(group_number, patient_id)
    );
  `);
  tablesReady = true;
}

/**
 * Assign one patient to the group carrying the fewest patients.
 *
 * @param {{patientId: string|number, hospitalNumber?: string, patientName?: string}} patient
 * @returns {Promise<{assigned: boolean, group?: number, students?: number, reason?: string}>}
 */
export async function assignPatientToStudentGroup(patient) {
  const patientId = patient?.patientId;
  if (patientId === undefined || patientId === null || patientId === '') {
    return { assigned: false, reason: 'no patient id' };
  }

  try {
    await ensureTables();

    // Only groups that actually have approved, active students in them.
    const staffed = await query(
      `SELECT group_number, COUNT(*)::int AS students
         FROM students
        WHERE is_approved = TRUE AND is_active = TRUE
          AND group_number IS NOT NULL
          AND group_number BETWEEN 1 AND $1
        GROUP BY group_number`,
      [NUM_GROUPS]
    );
    if (!staffed.rows.length) {
      return { assigned: false, reason: 'no staffed student groups' };
    }

    // Already allocated — a re-admission must not create a second row, and the
    // student who has been following this patient should keep them.
    const existing = await query(
      `SELECT group_number FROM student_group_patients
        WHERE patient_id = $1::varchar AND is_active
        LIMIT 1`,
      [String(patientId)]
    );
    if (existing.rows.length) {
      return { assigned: false, group: existing.rows[0].group_number, reason: 'already assigned' };
    }

    const loads = await query(
      `SELECT group_number, COUNT(*)::int AS patients
         FROM student_group_patients
        WHERE is_active
        GROUP BY group_number`
    );
    const loadByGroup = new Map(loads.rows.map(r => [r.group_number, r.patients]));

    // Fewest patients wins; lowest group number breaks the tie.
    const target = staffed.rows
      .map(r => ({ group: r.group_number, students: r.students, load: loadByGroup.get(r.group_number) || 0 }))
      .sort((a, b) => a.load - b.load || a.group - b.group)[0];

    await query(
      `INSERT INTO student_group_patients (group_number, patient_id, hospital_number, patient_name)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (group_number, patient_id) DO UPDATE
         SET is_active = TRUE,
             hospital_number = EXCLUDED.hospital_number,
             patient_name = EXCLUDED.patient_name`,
      [target.group, String(patientId), patient.hospitalNumber || null, patient.patientName || null]
    );

    // Mirror onto each student's own list, the same way the bulk assign does.
    // Failing here leaves the group allocation standing rather than losing both.
    const members = await query(
      `SELECT id FROM students
        WHERE is_approved = TRUE AND is_active = TRUE AND group_number = $1`,
      [target.group]
    );
    for (const s of members.rows) {
      try {
        await query(
          `INSERT INTO student_patient_assignments (student_id, patient_id, hospital_number, is_active)
           VALUES ($1, $2, $3, TRUE)
           ON CONFLICT (student_id, patient_id) DO UPDATE
             SET is_active = TRUE, assigned_at = NOW()`,
          [s.id, String(patientId), patient.hospitalNumber || null]
        );
      } catch (err) {
        console.warn('[students] could not link patient to student:', err.message);
      }
    }

    return { assigned: true, group: target.group, students: members.rows.length };
  } catch (err) {
    // The admission has already been written. Teaching allocation must not
    // decide whether a patient is admitted.
    console.warn('[students] auto-assign on admission skipped:', err.message);
    return { assigned: false, reason: err.message };
  }
}

export default { assignPatientToStudentGroup };
