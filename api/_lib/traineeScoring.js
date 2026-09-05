// ============================================================================
// Scoring — the SINGLE SOURCE OF TRUTH for how CME reading, CBT,
// self-assessment, clinical work, duties and attendance combine into one
// overall score and a sign-out decision.
//
// Imported by every surface that shows a score, backend and frontend alike:
//
//   api/ho-tracking.js        HO Tracking
//   api/admin-training.js     Training Admin
//   api/rotation-config.js    a trainee's own participation tracker
//   api/performance.js        the performance dashboard
//   api/students.js           clinical students
//   src/services/performanceService.ts   (typed by traineeScoring.d.ts)
//
// It exists because those surfaces used to disagree. Three separate formulas
// were in play — 30/35/25/10 in api/performance.js, 10/70/10/10 in the
// frontend, and this one in the middle — so the same trainee scored
// differently depending on which page you opened, and a tracker could read
// "CBT 0%" beside "3/4 completed". Add a component here, not in a caller.
//
// Components are each 0–100. Weights sum to 1.0.
// ============================================================================

export const SCORE_WEIGHTS = {
  cme: 0.15,            // CME reading (articles completed vs required)
  cbt: 0.20,            // CBT average %
  selfAssessment: 0.15, // Article self-assessment average %
  clinical: 0.30,       // Patient care / encounter documentation
  duties: 0.10,         // Duties completed
  attendance: 0.10,     // Login-day attendance
};

export const PASS_THRESHOLD = 70;      // overall % needed to be sign-out eligible
export const MIN_SECTION_SCORE = 40;   // each graded knowledge section must reach this

/**
 * Per-level requirements.
 *
 * Doctors on rotation (house officer through senior registrar) and clinical
 * students on a posting are scored by the same formula against different
 * counts — a student clerks patients rather than running a list, so their
 * clinical and duty targets are lower while the reading is comparable.
 */
const REQUIREMENTS = {
  house_officer:   { cmeArticles: 50, cbtTests: 4,  selfAssessments: 20, patients: 30,  duties: 20,  loginDays: 25 },
  junior_resident: { cmeArticles: 50, cbtTests: 12, selfAssessments: 30, patients: 100, duties: 60,  loginDays: 75 },
  senior_resident: { cmeArticles: 50, cbtTests: 24, selfAssessments: 40, patients: 200, duties: 120, loginDays: 150 },

  student_surgery_1: { cmeArticles: 16, cbtTests: 3, selfAssessments: 10, patients: 5, duties: 8,  loginDays: 20 },
  student_surgery_2: { cmeArticles: 20, cbtTests: 3, selfAssessments: 12, patients: 6, duties: 10, loginDays: 25 },
  student_surgery_3: { cmeArticles: 24, cbtTests: 4, selfAssessments: 14, patients: 8, duties: 12, loginDays: 30 },
  student_surgery_4: { cmeArticles: 24, cbtTests: 4, selfAssessments: 14, patients: 8, duties: 12, loginDays: 30 },
};

/** Levels a clinical student can be on, in curriculum order. */
export const STUDENT_LEVELS = [
  'student_surgery_1', 'student_surgery_2', 'student_surgery_3', 'student_surgery_4',
];

/** Levels a doctor on rotation can be on, in seniority order. */
export const TRAINEE_LEVELS = ['house_officer', 'junior_resident', 'senior_resident'];

/**
 * Maps whatever a caller has — a `users.role`, a `users.training_level`, a
 * student's posting level — onto one requirement set.
 *
 * The role vocabulary in this database is house_officer, junior_registrar,
 * registrar, senior_registrar (plus consultant and admin above them), while
 * the requirement sets are named after training stages. Order matters below:
 * "senior_registrar" contains "registrar", so senior is tested first.
 */
export function normalizeLevel(level) {
  const l = String(level || '').toLowerCase().trim();
  if (!l) return 'house_officer';

  // Clinical students, by posting.
  if (l.startsWith('student') || l.startsWith('surgery_')) {
    const n = l.match(/[1-4]/);
    return n ? `student_surgery_${n[0]}` : 'student_surgery_1';
  }

  if (l.includes('senior')) return 'senior_resident';
  if (l.includes('junior') || l === 'jr' || l.includes('registrar') || l.includes('resident')) {
    return 'junior_resident';
  }
  if (l.includes('house') || l.includes('intern') || l === 'ho') return 'house_officer';
  return 'house_officer';
}

export function isStudentLevel(level) {
  return normalizeLevel(level).startsWith('student_');
}

export function getRequirements(level) {
  return REQUIREMENTS[normalizeLevel(level)] || REQUIREMENTS.house_officer;
}

/** Every level and its requirements, for admin screens that list them. */
export function allRequirements() {
  return { ...REQUIREMENTS };
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
 * Turns raw counts into the six component scores.
 *
 * Callers used to do this themselves and drifted — one divided CME by a
 * hard-coded 50 while the tracker divided by the level's requirement, which is
 * how a tracker came to show "CME 0%" over "0/50 topics" for a level whose
 * real target was different. Give it counts; take back components.
 */
export function componentsFrom(counts, level) {
  const reqs = getRequirements(level);
  const clamp = (x) => Math.max(0, Math.min(100, Number(x) || 0));
  return {
    cme: pctOf(counts.cmeArticles, reqs.cmeArticles),
    cbt: clamp(counts.cbtAverage),
    selfAssessment: clamp(counts.selfAssessmentAverage),
    clinical: pctOf(counts.patients, reqs.patients),
    duties: pctOf(counts.duties, reqs.duties),
    attendance: pctOf(counts.loginDays, reqs.loginDays),
  };
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
  chk('CME articles', counts.cmeArticles, reqs.cmeArticles);
  chk('CBT tests', counts.cbtTests, reqs.cbtTests);
  chk('Self-assessments', counts.selfAssessments, reqs.selfAssessments);
  chk('Patients', counts.patients, reqs.patients);
  chk('Duties', counts.duties, reqs.duties);
  chk('Attendance (days)', counts.loginDays, reqs.loginDays);

  const sec = (label, score) => {
    const s = Math.round(Number(score) || 0);
    (s >= MIN_SECTION_SCORE ? met : notMet).push(
      `${label}: ${s}%${s >= MIN_SECTION_SCORE ? '' : ` (need ${MIN_SECTION_SCORE}%)`}`,
    );
  };
  sec('CBT score', components.cbt);
  sec('Self-assessment score', components.selfAssessment);

  const o = Math.round(Number(overall) || 0);
  (o >= PASS_THRESHOLD ? met : notMet).push(
    `Overall: ${o}%${o >= PASS_THRESHOLD ? '' : ` (need ${PASS_THRESHOLD}%)`}`,
  );

  return { eligible: notMet.length === 0, met, notMet };
}

/**
 * The whole calculation in one call. Callers gather raw counts; this returns
 * the components, the overall, the eligibility and the requirements used, so a
 * screen can show every number it needs without recomputing any of them.
 */
export function scoreTrainee({ level, counts }) {
  const normalized = normalizeLevel(level);
  const reqs = getRequirements(normalized);
  const components = componentsFrom(counts, normalized);
  const overall = computeOverall(components);
  const eligibility = computeEligibility(counts, components, reqs, overall);
  return {
    level: normalized,
    isStudent: normalized.startsWith('student_'),
    counts,
    components,
    overall,
    eligibility,
    requirements: reqs,
    weights: SCORE_WEIGHTS,
    passThreshold: PASS_THRESHOLD,
    minSectionScore: MIN_SECTION_SCORE,
  };
}
