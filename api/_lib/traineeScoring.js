// ============================================================================
// Trainee scoring — the SINGLE SOURCE OF TRUTH for how CME reading, CBT,
// self-assessment, clinical work, duties and attendance combine into one
// overall performance score + sign-out eligibility.
//
// Used by api/ho-tracking.js (HO Tracking page), api/admin-training.js
// (Training Admin) and api/rotation-config.js (trainee's own view) so every
// screen shows the same number. Replaces the three previously-divergent
// formulas (CBT 30/patient 35/duty 25/attendance 10).
//
// Components are each 0–100. Weights sum to 1.0.
// ============================================================================

export const SCORE_WEIGHTS = {
  cme: 0.15,            // CME reading (topics completed vs required)
  cbt: 0.20,            // CBT average %
  selfAssessment: 0.15, // Self-assessment average %
  clinical: 0.30,       // Patient care / documentation volume
  duties: 0.10,         // Duties completed
  attendance: 0.10,     // Login-day attendance
};

export const PASS_THRESHOLD = 70;      // overall % needed to be sign-out eligible
export const MIN_SECTION_SCORE = 40;   // each graded knowledge section (CBT, self-assessment) must reach this

// Per-level count requirements. cmeTopics/selfAssessments/cbtTests are knowledge
// requirements; patients/duties/loginDays scale with seniority.
const REQUIREMENTS = {
  house_officer:   { cmeTopics: 50, cbtTests: 4,  selfAssessments: 20, patients: 30,  duties: 20,  loginDays: 25 },
  junior_resident: { cmeTopics: 50, cbtTests: 12, selfAssessments: 30, patients: 100, duties: 60,  loginDays: 75 },
  senior_resident: { cmeTopics: 50, cbtTests: 24, selfAssessments: 40, patients: 200, duties: 120, loginDays: 150 },
};

export function normalizeLevel(level) {
  const l = String(level || '').toLowerCase();
  if (l.includes('senior')) return 'senior_resident';
  if (l.includes('junior') || l === 'jr' || l.includes('registrar')) return 'junior_resident';
  return 'house_officer';
}

export function getRequirements(level) {
  return REQUIREMENTS[normalizeLevel(level)] || REQUIREMENTS.house_officer;
}

/** Weighted overall score (0–100) from component scores (each 0–100). */
export function computeOverall(components) {
  const w = SCORE_WEIGHTS;
  const v = (x) => Math.max(0, Math.min(100, Number(x) || 0));
  const overall =
    v(components.cme) * w.cme +
    v(components.cbt) * w.cbt +
    v(components.selfAssessment) * w.selfAssessment +
    v(components.clinical) * w.clinical +
    v(components.duties) * w.duties +
    v(components.attendance) * w.attendance;
  return Math.round(overall * 10) / 10;
}

/** Percentage helper: count vs required, capped at 100. */
export function pctOf(count, required) {
  if (!required || required <= 0) return 0;
  return Math.min(100, (Number(count || 0) / required) * 100);
}

/**
 * Sign-out eligibility. counts = raw counts; components = 0–100 scores;
 * reqs = getRequirements(level); overall = computeOverall(components).
 */
export function computeEligibility(counts, components, reqs, overall) {
  const met = [], notMet = [];
  const chk = (label, actual, need) => {
    const a = Number(actual) || 0;
    (a >= need ? met : notMet).push(`${label}: ${a}/${need}`);
  };
  chk('CME topics', counts.cmeTopics, reqs.cmeTopics);
  chk('CBT tests', counts.cbtTests, reqs.cbtTests);
  chk('Self-assessments', counts.selfAssessments, reqs.selfAssessments);
  chk('Patients', counts.patients, reqs.patients);
  chk('Duties', counts.duties, reqs.duties);
  chk('Attendance (days)', counts.loginDays, reqs.loginDays);

  const sec = (label, score) => {
    const s = Math.round(Number(score) || 0);
    (s >= MIN_SECTION_SCORE ? met : notMet).push(`${label}: ${s}%${s >= MIN_SECTION_SCORE ? '' : ` (need ${MIN_SECTION_SCORE}%)`}`);
  };
  sec('CBT score', components.cbt);
  sec('Self-assessment score', components.selfAssessment);

  const o = Math.round(Number(overall) || 0);
  (o >= PASS_THRESHOLD ? met : notMet).push(`Overall: ${o}%${o >= PASS_THRESHOLD ? '' : ` (need ${PASS_THRESHOLD}%)`}`);

  return { eligible: notMet.length === 0, met, notMet };
}

/**
 * One-shot: given raw counts + component scores + level, return
 * { overall, eligibility, weights }. Callers gather the data.
 */
export function scoreTrainee({ level, counts, components }) {
  const reqs = getRequirements(level);
  const overall = computeOverall(components);
  const eligibility = computeEligibility(counts, components, reqs, overall);
  return { overall, eligibility, requirements: reqs, weights: SCORE_WEIGHTS };
}
