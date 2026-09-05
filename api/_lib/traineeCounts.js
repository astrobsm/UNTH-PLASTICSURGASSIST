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
 * Raw counts for a doctor on rotation, keyed to `users.id`.
 *
 * Feed the result straight to scoreTrainee({ level, counts }).
 */
export async function gatherTraineeCounts(userId) {
  const [
    cbtTests, cbtAverage, patients, duties, loginDays,
    cmeArticles, selfAssessments, selfAssessmentAverage,
  ] = await Promise.all([
    scalar(`SELECT COUNT(*) FROM cbt_attempts WHERE user_id = $1 AND completed = true`, [userId]),
    scalar(`SELECT COALESCE(AVG(percentage), 0) FROM cbt_attempts
            WHERE user_id = $1 AND completed = true`, [userId]),

    // Distinct patients documented — not rows written, and not activity points.
    // A trainee who writes six notes on one patient has documented one patient.
    scalar(`SELECT COUNT(DISTINCT reference_id) FROM activity_logs
            WHERE user_id = $1 AND reference_type = 'patient'
              AND activity_type IN ('patient_entry','patient_update','treatment_plan',
                                    'prescription','wound_care','surgery_booking',
                                    'lab_order','discharge_summary','ward_round')`, [userId]),

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
  ]);

  return {
    cbtTests, cbtAverage, patients, duties, loginDays,
    cmeArticles, selfAssessments, selfAssessmentAverage,
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

    scalar(`SELECT COUNT(*) FROM student_patient_assignments
            WHERE student_id = $1 AND is_active`, [studentId]),

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
