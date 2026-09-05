// ============================================================================
// The life of a rotation — start, extend, sign out.
//
// One module because these three were written twice, in api/rotations.js and
// api/admin-training.js, and had already drifted: one recorded an extension
// reason as a bare string and the other as an object with who and when; one
// let a consultant or admin sign somebody out and the other also allowed a
// senior registrar. A trainee's record read differently depending on which
// screen had touched it.
//
// A rotation ends one of three ways:
//
//   automatically  the end date has passed and the score clears the threshold.
//                  Nobody has to do anything; `evaluateDueRotations` finds it.
//   extended       the end date has passed and the score does not. It becomes
//                  `pending_signout` and waits for an administrator, who
//                  extends it with a reason.
//   overridden     an administrator signs the trainee out regardless, with a
//                  reason, which is recorded as an override and not as a pass.
//
// Every one of those writes a reason. A rotation that ended should always be
// able to say why.
// ============================================================================

import { query } from './db.js';
import { scoreTrainee, PASS_THRESHOLD } from './traineeScoring.js';
import { gatherTraineeCounts } from './traineeCounts.js';

/** Who may extend a rotation or sign somebody out. */
export const ROTATION_ADMIN_ROLES = ['admin', 'super_admin', 'consultant', 'senior_registrar'];

/** Default rotation length in days, when the trainee did not choose one. */
export const DEFAULT_ROTATION_DAYS = {
  house_officer: 90,
  junior_registrar: 180,
  registrar: 180,
  senior_registrar: 365,
};

/** Rotations that are still running. */
const OPEN_STATUSES = ['active', 'extended', 'pending_signout'];

/** Records an activity, never failing the operation that triggered it. */
async function log(userId, type, description, metadata = {}) {
  try {
    await query(
      `INSERT INTO activity_logs (user_id, activity_type, description, points, metadata)
       VALUES ($1, $2, $3, 0, $4)`,
      [userId, type, description, JSON.stringify(metadata)],
    );
  } catch { /* the audit trail must not break the action */ }
}

/**
 * Starts a rotation, unless one is already open.
 *
 * `days` comes from the trainee when they create their profile; the per-level
 * default covers the case where it was not given.
 */
export async function startRotation({ userId, level, days, department = 'Plastic Surgery', startDate }) {
  const open = await query(
    `SELECT id FROM trainee_rotations WHERE user_id = $1 AND status = ANY($2)`,
    [userId, OPEN_STATUSES],
  );
  if (open.rows.length) {
    return { created: false, reason: 'a rotation is already open', rotationId: open.rows[0].id };
  }

  const length = Number(days) > 0 ? Math.min(Math.round(Number(days)), 366 * 3) : (DEFAULT_ROTATION_DAYS[level] || 90);
  const start = startDate || new Date().toISOString().slice(0, 10);

  const r = await query(
    `INSERT INTO trainee_rotations
       (user_id, level, department, start_date, expected_end_date, status)
     VALUES ($1, $2, $3, $4::date, $4::date + ($5 || ' days')::interval, 'active')
     RETURNING *`,
    [userId, level, department, start, String(length)],
  );

  await log(userId, 'rotation_started', `Started ${level} rotation (${length} days)`, { days: length });
  return { created: true, rotation: r.rows[0] };
}

/**
 * Extends a rotation. A reason is required — an extension without one leaves
 * the trainee no idea what to put right.
 */
export async function extendRotation({ rotationId, days, reason, byUserId }) {
  const cleanReason = String(reason || '').trim();
  if (!cleanReason) return { ok: false, error: 'A reason is required to extend a rotation' };

  const extraDays = Number(days) > 0 ? Math.min(Math.round(Number(days)), 365) : 7;

  const r = await query(
    `UPDATE trainee_rotations
     SET expected_end_date = expected_end_date + ($1 || ' days')::interval,
         extension_count   = COALESCE(extension_count, 0) + 1,
         extension_reasons = COALESCE(extension_reasons, '[]'::jsonb) || $2::jsonb,
         status            = 'extended',
         updated_at        = CURRENT_TIMESTAMP
     WHERE id = $3 AND status = ANY($4)
     RETURNING *`,
    [
      String(extraDays),
      JSON.stringify([{ reason: cleanReason, days: extraDays, at: new Date().toISOString(), by: byUserId }]),
      rotationId,
      OPEN_STATUSES,
    ],
  );
  if (!r.rows.length) return { ok: false, error: 'Rotation not found, or already closed' };

  await log(r.rows[0].user_id, 'rotation_extended',
    `Rotation extended by ${extraDays} days: ${cleanReason}`, { days: extraDays, by: byUserId });
  return { ok: true, rotation: r.rows[0] };
}

/**
 * Closes a rotation.
 *
 * `mode` says how it ended, and is stored so the record can be read back
 * honestly later:
 *
 *   'automatic' the score cleared the threshold at the end of the rotation
 *   'approved'  an administrator approved a sign-out request
 *   'override'  an administrator signed the trainee out despite the score
 */
export async function signOutRotation({ rotationId, mode, reason, byUserId, finalScore }) {
  const cleanReason = String(reason || '').trim();
  if (mode === 'override' && !cleanReason) {
    return { ok: false, error: 'A reason is required to override the score and sign out' };
  }

  const note = {
    automatic: `Signed out automatically: score ${finalScore}% met the ${PASS_THRESHOLD}% threshold`,
    approved: `Sign-out approved${cleanReason ? `: ${cleanReason}` : ''}`,
    override: `Signed out by override despite score ${finalScore}%: ${cleanReason}`,
  }[mode] || `Signed out: ${cleanReason}`;

  const r = await query(
    `UPDATE trainee_rotations
     SET status                = 'signed_out',
         actual_end_date       = CURRENT_DATE,
         sign_out_approved     = TRUE,
         sign_out_approved_by  = $1,
         sign_out_approved_at  = CURRENT_TIMESTAMP,
         sign_out_comments     = TRIM(BOTH ' |' FROM COALESCE(sign_out_comments, '') || ' | ' || $2),
         final_score           = $3,
         updated_at            = CURRENT_TIMESTAMP
     WHERE id = $4 AND status = ANY($5)
     RETURNING *`,
    [byUserId ?? null, note, finalScore ?? null, rotationId, OPEN_STATUSES],
  );
  if (!r.rows.length) return { ok: false, error: 'Rotation not found, or already closed' };

  await log(r.rows[0].user_id, 'rotation_signed_out', note, { mode, finalScore, by: byUserId });
  return { ok: true, rotation: r.rows[0], mode };
}

/** Scores one trainee against their level. */
export async function scoreFor(userId, level) {
  const counts = await gatherTraineeCounts(userId);
  return scoreTrainee({ level, counts });
}

/**
 * Walks every open rotation whose end date has passed and closes what can be
 * closed.
 *
 * A trainee who has met the requirements is signed out without anyone being
 * asked; one who has not is moved to `pending_signout` so an administrator sees
 * them and can extend or override. Nothing is ever failed silently — the
 * pending state is the request for a human decision.
 *
 * Safe to call often; a rotation already in the right state is left alone.
 */
export async function evaluateDueRotations({ userId = null } = {}) {
  const due = await query(
    `SELECT r.id, r.user_id, r.level, r.status, r.expected_end_date, u.role, u.full_name
     FROM trainee_rotations r
     JOIN users u ON u.id = r.user_id
     WHERE r.status = ANY($1)
       AND r.expected_end_date <= CURRENT_DATE
       AND ($2::int IS NULL OR r.user_id = $2)`,
    [OPEN_STATUSES, userId],
  );

  const signedOut = [];
  const pending = [];

  for (const row of due.rows) {
    let scored;
    try {
      scored = await scoreFor(row.user_id, row.level || row.role);
    } catch {
      continue; // A trainee whose score cannot be computed is left for a human.
    }

    if (scored.eligibility.eligible) {
      const out = await signOutRotation({
        rotationId: row.id,
        mode: 'automatic',
        byUserId: null,
        finalScore: scored.overall,
      });
      if (out.ok) signedOut.push({ userId: row.user_id, name: row.full_name, score: scored.overall });
      continue;
    }

    if (row.status !== 'pending_signout') {
      await query(
        `UPDATE trainee_rotations SET status = 'pending_signout', updated_at = CURRENT_TIMESTAMP
         WHERE id = $1`,
        [row.id],
      );
      await log(row.user_id, 'rotation_pending_signout',
        `Rotation reached its end date at ${scored.overall}% — awaiting a decision`,
        { score: scored.overall, notMet: scored.eligibility.notMet });
    }
    pending.push({
      rotationId: row.id,
      userId: row.user_id,
      name: row.full_name,
      score: scored.overall,
      notMet: scored.eligibility.notMet,
    });
  }

  return { evaluated: due.rows.length, signedOut, pending };
}
