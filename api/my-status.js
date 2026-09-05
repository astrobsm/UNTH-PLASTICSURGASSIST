// ============================================================================
// Where do I stand?
//
// The one call a learner's own screens make when they sign in: their level,
// their score, what each component contributed, what is still outstanding, and
// how long is left in the rotation.
//
// Doctors and clinical students both come here. They are counted from
// different tables — a student clerks patients where a registrar runs a list —
// but scored by the same engine against their own level's requirements, so
// the two can be shown side by side and mean the same thing.
//
// The rotation sweep runs first, for this learner only. Somebody who finished
// their rotation and met the requirements is therefore signed out the next
// time they open the app, rather than waiting for an administrator to notice.
// ============================================================================

import { query } from './_lib/db.js';
import { cors, authenticateRequest } from './_lib/auth.js';
import { scoreTrainee, SCORE_WEIGHTS, PASS_THRESHOLD, MIN_SECTION_SCORE } from './_lib/traineeScoring.js';
import { gatherTraineeCounts, gatherStudentCounts } from './_lib/traineeCounts.js';
import { evaluateDueRotations } from './_lib/rotationLifecycle.js';

export default async function handler(req, res) {
  if (cors(req, res)) return;

  if (req.method !== 'GET') {
    res.setHeader('Allow', ['GET']);
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const auth = authenticateRequest(req, { allowStudents: true });
  if (!auth.authenticated) {
    return res.status(auth.status || 401).json({ error: 'Unauthorized', message: auth.error });
  }

  const isStudent = auth.user.sub_type === 'student' || auth.user.role === 'student';
  const id = auth.user.id;

  try {
    return isStudent
      ? res.status(200).json(await studentStatus(id))
      : res.status(200).json(await traineeStatus(id, auth.user.role));
  } catch (error) {
    console.error('my-status error:', error);
    return res.status(500).json({ error: 'Internal server error', message: error.message });
  }
}

// ---------------------------------------------------------------------------

/** The shape both branches return, so one component can render either. */
function present({ kind, level, scored, rotation, extras = {} }) {
  const pct = (n) => Math.round((Number(n) || 0) * 10) / 10;

  // Each component's actual contribution to the total, which is the number
  // that answers "where would effort help most?".
  const contributions = Object.entries(scored.components).map(([key, value]) => ({
    key,
    score: pct(value),
    weight: SCORE_WEIGHTS[key],
    contribution: pct(value * SCORE_WEIGHTS[key]),
    available: pct(SCORE_WEIGHTS[key] * 100),
  })).sort((a, b) => (b.available - b.contribution) - (a.available - a.contribution));

  return {
    kind,
    level,
    overall: scored.overall,
    passThreshold: PASS_THRESHOLD,
    minSectionScore: MIN_SECTION_SCORE,
    eligible: scored.eligibility.eligible,
    met: scored.eligibility.met,
    notMet: scored.eligibility.notMet,
    counts: scored.counts,
    requirements: scored.requirements,
    components: scored.components,
    contributions,
    // Biggest gap first: the component leaving the most marks on the table.
    focusOn: contributions[0]?.key ?? null,
    rotation,
    ...extras,
  };
}

function rotationView(row) {
  if (!row) return null;
  const end = row.expected_end_date ? new Date(row.expected_end_date) : null;
  const start = row.start_date ? new Date(row.start_date) : null;
  const today = new Date();
  const day = 24 * 60 * 60 * 1000;

  const daysRemaining = end ? Math.ceil((end - today) / day) : null;
  const totalDays = start && end ? Math.max(1, Math.round((end - start) / day)) : null;
  const elapsed = start ? Math.max(0, Math.round((today - start) / day)) : null;

  return {
    id: row.id,
    status: row.status,
    startDate: row.start_date,
    expectedEndDate: row.expected_end_date,
    actualEndDate: row.actual_end_date ?? null,
    extensionCount: row.extension_count ?? 0,
    finalScore: row.final_score ?? null,
    signOutComments: row.sign_out_comments ?? null,
    daysRemaining,
    totalDays,
    elapsedDays: elapsed,
    progressPercent: totalDays ? Math.min(100, Math.round(((elapsed ?? 0) / totalDays) * 100)) : null,
    // Said plainly so the banner does not have to work it out.
    overdue: daysRemaining !== null && daysRemaining < 0 && row.status !== 'signed_out',
  };
}

// ---------------------------------------------------------------------------

async function traineeStatus(userId, role) {
  // Close this trainee's rotation if it has run its course and the score
  // allows. Signing out should not depend on somebody opening an admin screen.
  let sweep = null;
  try {
    sweep = await evaluateDueRotations({ userId });
  } catch { /* the status must load even if the sweep cannot run */ }

  const [rotationRow, userRow] = await Promise.all([
    query(
      `SELECT * FROM trainee_rotations WHERE user_id = $1
       ORDER BY CASE WHEN status IN ('active','extended','pending_signout') THEN 0 ELSE 1 END,
                created_at DESC
       LIMIT 1`,
      [userId],
    ),
    query('SELECT full_name, role, training_level FROM users WHERE id = $1', [userId]),
  ]);

  const rotation = rotationRow.rows[0] || null;
  // The rotation's own level is the authority; users.training_level holds the
  // 'house_officer' default on every account and would mislabel a registrar.
  const level = rotation?.level || role || userRow.rows[0]?.role;

  const counts = await gatherTraineeCounts(userId);
  const scored = scoreTrainee({ level, counts });

  return present({
    kind: 'trainee',
    level: scored.level,
    scored,
    rotation: rotationView(rotation),
    extras: {
      name: userRow.rows[0]?.full_name ?? null,
      role: userRow.rows[0]?.role ?? role,
      // Present only when this visit closed the rotation, so the app can say so.
      justSignedOut: Boolean(sweep?.signedOut?.length),
      awaitingDecision: Boolean(sweep?.pending?.length),
    },
  });
}

async function studentStatus(studentId) {
  const row = (await query(
    `SELECT id, full_name, posting_start, posting_end, group_number, is_approved
     FROM students WHERE id = $1`,
    [studentId],
  )).rows[0];

  const counts = await gatherStudentCounts(studentId);

  // A student's level follows the posting they are on. Until postings carry an
  // explicit surgery level, the first is the sensible default and the
  // requirements differ little between them.
  const level = 'student_surgery_1';
  const scored = scoreTrainee({ level, counts });

  return present({
    kind: 'student',
    level: scored.level,
    scored,
    rotation: rotationView(row && {
      id: row.id,
      status: row.is_approved ? 'active' : 'pending_approval',
      start_date: row.posting_start,
      expected_end_date: row.posting_end,
    }),
    extras: {
      name: row?.full_name ?? null,
      groupNumber: row?.group_number ?? null,
      approved: Boolean(row?.is_approved),
      patientsAssigned: counts.patientsAssigned ?? 0,
      clerkings: counts.clerkings ?? 0,
      treatmentPlans: counts.treatmentPlans ?? 0,
    },
  });
}
