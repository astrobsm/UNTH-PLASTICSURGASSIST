// ============================================================================
// Counting what a learner has actually done.
//
// The companion to traineeScoring.js: that module decides what things are
// worth, this one decides what happened. Kept apart so a screen can show raw
// counts without a score, and together so no endpoint invents its own idea of
// "patients seen".
//
// Four endpoints used to each run their own version of these queries and
// quietly disagreed — one counted patients from activity_type='patient_entry'
// only, another summed activity points, a third counted rows rather than
// distinct patients. Same trainee, three answers.
// ============================================================================

import { query } from './db.js';

/** Runs a scalar query, returning `fallback` if the table or column is absent. */
async function scalar(sql, params, fallback = 0) {
  try {
    const r = await query(sql, params);
    if (!r.rows[0]) return fallback;
    const v = Object.values(r.rows[0])[0];
    return Number(v) || fallback;
  } catch {
    // Deployments differ in which optional tables exist. A missing table means
    // "none of those yet", not a failed request.
    return fallback;
  }
}

/**
 * Where a trainee's clinical documentation actually lives.
 *
 * `[table, patientColumn, authorColumn, authorKind]`. authorKind is 'int' when
 * the column holds users.id, 'name' when it holds a display name or username
 * as free text -- both conventions are in use.
 *
 * Counting patients from activity_logs does not work: reference_type is NULL on
 * 480 of 487 rows in production, and activity_type 'patient_entry' is never
 * written at all. The documentation itself is the record.
 */
const DOCUMENTATION_SOURCES = [
  ['prescriptions',            'patient_id', 'prescribed_by',   'int'],
  ['ward_rounds',              'patient_id', 'user_id',         'int'],
  ['lab_orders',               'patient_id', 'ordered_by',      'int'],
  ['discharge_summaries',      'patient_id', 'prepared_by',     'int'],
  ['wound_care_records',       'patient_id', 'recorded_by',     'int'],
  ['treatment_plans',          'patient_id', 'created_by',      'int'],
  ['progress_notes',           'patient_id', 'author',          'name'],
  ['vital_signs',              'patient_id', 'recorded_by',     'name'],
  ['fluid_balance',            'patient_id', 'recorded_by',     'name'],
  ['blood_transfusions',       'patient_id', 'administered_by', 'name'],
  ['preoperative_assessments', 'patient_id', 'assessed_by',     'name'],
  ['dvt_assessments',          'patient_id', 'assessed_by',     'name'],
  ['pressure_sore_assessments','patient_id', 'assessed_by',     'name'],
  ['nutritional_assessments',  'patient_id', 'assessed_by',     'name'],
  ['diabetic_foot_assessments','patient_id', 'assessed_by',     'name'],
];

/**
 * Distinct patients this trainee has documented, and how many pieces of
 * documentation they wrote.
 *
 * Each table is queried separately and a failure is ignored: which of these
 * exist varies between deployments, and one absent table must not zero the
 * whole count.
 */
async function gatherDocumentation(userId, identities) {
  const patients = new Set();
  let entries = 0;

  for (const [table, patientCol, authorCol, kind] of DOCUMENTATION_SOURCES) {
    const where = kind === 'int'
      ? { clause: `"${authorCol}" = $1`, params: [userId] }
      : { clause: `lower("${authorCol}"::text) = ANY($1)`, params: [identities] };
    try {
      const r = await query(
        `SELECT DISTINCT "${patientCol}"::text AS pid FROM ${table} WHERE ${where.clause}`,
        where.params,
      );
      r.rows.forEach((row) => { if (row.pid) patients.add(row.pid); });
      entries += r.rowCount || 0;
    } catch {
      // Table or column absent in this deployment.
    }
  }
  return { patients: patients.size, entries };
}

/** The strings a name-typed author column might hold for this user. */
async function identitiesFor(userId) {
  const out = [String(userId)];
  try {
    const r = await query('SELECT full_name, username, email FROM users WHERE id = $1', [userId]);
    const u = r.rows[0];
    if (u) [u.full_name, u.username, u.email].forEach((v) => { if (v) out.push(String(v).toLowerCase()); });
  } catch { /* users always exists, but never let this be fatal */ }
  return out;
}

/**
 * Raw counts for a doctor on rotation, keyed to `users.id`.
 *
 * Feed the result straight to scoreTrainee({ level, counts }).
 */
export async function gatherTraineeCounts(userId) {
  const identities = await identitiesFor(userId);

  const [
    cbtTests, cbtAverage, formalDuties, loginDays,
    cmeArticles, selfAssessments, selfAssessmentAverage, legacyCme,
    documentation,
  ] = await Promise.all([
    scalar(`SELECT COUNT(*) FROM cbt_attempts WHERE user_id = $1 AND completed = true`, [userId]),
    scalar(`SELECT COALESCE(AVG(percentage), 0) FROM cbt_attempts
            WHERE user_id = $1 AND completed = true`, [userId]),

    scalar(`SELECT COUNT(*) FROM duty_assignments
            WHERE user_id = $1 AND status = 'completed'`, [userId]),

    scalar(`SELECT COUNT(DISTINCT DATE(created_at)) FROM activity_logs
            WHERE user_id = $1 AND activity_type = 'login'`, [userId]),

    scalar(`SELECT COUNT(*) FROM learner_article_progress
            WHERE learner_kind = 'user' AND learner_id = $1 AND is_fully_completed`, [userId]),

    scalar(`SELECT COUNT(*) FROM learner_article_progress
            WHERE learner_kind = 'user' AND learner_id = $1 AND assessment_completed`, [userId]),

    scalar(`SELECT COALESCE(AVG(assessment_score), 0) FROM learner_article_progress
            WHERE learner_kind = 'user' AND learner_id = $1 AND assessment_completed`, [userId]),

    // Reading recorded before learner_article_progress existed. Counted so a
    // trainee's history does not reset to zero the day the new tracking lands.
    scalar(`SELECT COUNT(*) FROM training_progress WHERE user_id = $1`, [userId]),

    gatherDocumentation(userId, identities),
  ]);

  return {
    cbtTests,
    cbtAverage,
    patients: documentation.patients,
    // Documentation written is the trainee's day-to-day work; duty_assignments
    // is a rota that most deployments never populated (0 rows in production),
    // so an empty rota must not read as a trainee who did nothing.
    duties: formalDuties + documentation.entries,
    dutiesFormal: formalDuties,
    documentationEntries: documentation.entries,
    loginDays,
    cmeArticles: Math.max(cmeArticles, legacyCme),
    selfAssessments,
    selfAssessmentAverage,
  };
}

/**
 * Raw counts for a clinical student, keyed to `students.id`.
 *
 * Students are tracked through their own tables — they clerk patients and
 * write treatment plans rather than logging duties against a rota — but the
 * shape returned is identical, so the same scorer grades both.
 */
export async function gatherStudentCounts(studentId) {
  const [
    cbtTests, cbtAverage, patients, clerkings, treatmentPlans, loginDays,
    cmeArticles, selfAssessments, selfAssessmentAverage, groupActivities,
  ] = await Promise.all([
    scalar(`SELECT COUNT(*) FROM student_training_progress
            WHERE student_id = $1 AND kind = 'cbt'`, [studentId]),
    scalar(`SELECT COALESCE(AVG(score), 0) FROM student_training_progress
            WHERE student_id = $1 AND kind = 'cbt' AND score IS NOT NULL`, [studentId]),

    // Patients reach a student two ways: assigned to them individually, or to
    // the posting group they belong to. Counting only the first read as zero
    // for every student in production, where patients are handed to the five
    // groups rather than to individuals.
    scalar(
      `SELECT COUNT(*) FROM (
         SELECT patient_id FROM student_patient_assignments
         WHERE student_id = $1 AND is_active
         UNION
         SELECT sgp.patient_id FROM student_group_patients sgp
         JOIN students s ON s.group_number = sgp.group_number
         WHERE s.id = $1 AND sgp.is_active
       ) reachable`,
      [studentId],
    ),

    scalar(`SELECT COUNT(*) FROM student_clerkings
            WHERE student_id = $1 AND status <> 'draft'`, [studentId]),

    scalar(`SELECT COUNT(*) FROM student_treatment_plans
            WHERE student_id = $1 AND status <> 'draft'`, [studentId]),

    scalar(`SELECT COUNT(DISTINCT DATE(created_at)) FROM student_activity_logs
            WHERE student_id = $1 AND activity_type = 'login'`, [studentId]),

    scalar(`SELECT COUNT(*) FROM learner_article_progress
            WHERE learner_kind = 'student' AND learner_id = $1 AND is_fully_completed`, [studentId]),

    scalar(`SELECT COUNT(*) FROM learner_article_progress
            WHERE learner_kind = 'student' AND learner_id = $1 AND assessment_completed`, [studentId]),

    scalar(`SELECT COALESCE(AVG(assessment_score), 0) FROM learner_article_progress
            WHERE learner_kind = 'student' AND learner_id = $1 AND assessment_completed`, [studentId]),

    // Group work — topic presentations, wound dressings, ward inspections —
    // counted as the student's duties.
    scalar(`SELECT COUNT(*) FROM student_group_activities sga
            JOIN students s ON s.group_number = sga.group_number
            WHERE s.id = $1`, [studentId]),
  ]);

  return {
    cbtTests, cbtAverage,
    // A student's clinical work is the documentation they complete against the
    // patients assigned to them, which is what the encounter score should
    // reflect — not merely how many patients they were handed.
    patients: clerkings + treatmentPlans,
    patientsAssigned: patients,
    clerkings,
    treatmentPlans,
    duties: groupActivities,
    loginDays,
    cmeArticles, selfAssessments, selfAssessmentAverage,
  };
}
