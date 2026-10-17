// ============================================================================
// Posting onboarding: the first thing a house officer or resident does.
//
// They state when their posting started and ends and which unit they are
// posted to, read the expectations and the rules for signing out of the unit,
// and accept them. Submitting officially starts (or corrects) their rotation,
// places them in their unit on the call roster when they are not yet listed,
// and — when they registered days after the posting began — sets catch-up
// reading and missed CBTs with a deadline.
//
// Required once per posting: when the trainee has no onboarding record for
// their open rotation (or, with no rotation open, none covering today).
// ============================================================================

import { query } from './db.js';
import { gradeRoleMap } from './roles.js';
import { startRotation, DEFAULT_ROTATION_DAYS } from './rotationLifecycle.js';
import { getRequirements, normalizeLevel, PASS_THRESHOLD, MIN_SECTION_SCORE } from './traineeScoring.js';
import { getUnitConfig, saveUnitConfig } from './callRoster.js';
import { GRADE_LIST_KEY } from './unitCallPattern.js';
import { categoriesFor, countsFor } from '../learning-content.js';

export const ONBOARDING_GRADES = ['house_officer', 'registrar', 'senior_registrar'];
const OPEN_STATUSES = ['active', 'extended', 'pending_signout'];
const DEFAULT_UNITS = [{ key: 'unit1', name: 'PS Unit 1' }, { key: 'unit2', name: 'PS Unit 2' }];
const DAY = 86400000;

let ensured = false;
export async function ensureOnboardingTable() {
  if (ensured) return;
  await query(`CREATE TABLE IF NOT EXISTS posting_onboarding (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL,
    rotation_id INTEGER,
    role TEXT, grade TEXT, level TEXT,
    unit_key TEXT, unit_name TEXT,
    posting_start DATE NOT NULL,
    posting_end DATE NOT NULL,
    rules_version TEXT NOT NULL,
    accepted_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    days_late INTEGER NOT NULL DEFAULT 0,
    catch_up_articles INTEGER NOT NULL DEFAULT 0,
    catch_up_cbt INTEGER NOT NULL DEFAULT 0,
    catch_up_due DATE,
    unit_note TEXT,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
  )`);
  await query(`CREATE INDEX IF NOT EXISTS idx_posting_onboarding_user ON posting_onboarding (user_id, created_at DESC)`);
  ensured = true;
}

/** Today in West Africa Time as YYYY-MM-DD. */
export function todayWat(now = new Date()) {
  return new Date(now.getTime() + 3600000).toISOString().slice(0, 10);
}
const ymd = (d) => (d instanceof Date ? d.toISOString().slice(0, 10) : String(d || '').slice(0, 10));
const daysBetween = (a, b) => Math.round((Date.parse(`${b}T00:00:00Z`) - Date.parse(`${a}T00:00:00Z`)) / DAY);
const addDays = (a, n) => new Date(Date.parse(`${a}T00:00:00Z`) + n * DAY).toISOString().slice(0, 10);

/** The rostering grade of a role (house_officer / registrar / senior_registrar / consultant), or null. */
export async function gradeOf(role) {
  const map = await gradeRoleMap();
  for (const [grade, roles] of Object.entries(map)) if (roles.includes(role)) return grade;
  return ONBOARDING_GRADES.includes(role) ? role : role === 'junior_registrar' ? 'registrar' : null;
}

/**
 * Catch-up owed for registering late: the share of the posting's reading and
 * CBTs that falls in the days already gone. Deadline: as many days as were
 * missed, at least 7 and at most 14 from today.
 */
export function computeCatchUp({ start, end, today, level }) {
  const total = Math.max(daysBetween(start, end), 1);
  const late = Math.max(0, Math.min(daysBetween(start, today), total));
  if (late < 1) return { daysLate: 0, articles: 0, cbt: 0, due: null };
  const req = getRequirements(level);
  return {
    daysLate: late,
    articles: Math.max(1, Math.ceil((req.cmeArticles * late) / total)),
    cbt: Math.floor((req.cbtTests * late) / total),
    due: addDays(today, Math.min(14, Math.max(7, late))),
  };
}

export function validatePosting({ start, end, today }) {
  const iso = /^\d{4}-\d{2}-\d{2}$/;
  if (!iso.test(start || '') || !iso.test(end || '')) return 'Posting start and end dates are required';
  const len = daysBetween(start, end);
  if (len < 7) return 'The posting must end at least a week after it starts';
  if (len > 366 * 3) return 'The posting cannot be longer than three years';
  if (daysBetween(today, start) > 60) return 'The start date is more than 60 days away — onboard closer to the posting';
  if (daysBetween(start, today) > 366) return 'The start date is more than a year ago — check the year';
  if (daysBetween(today, end) < 0) return 'That posting has already ended — check the end date';
  return null;
}

async function openRotation(userId) {
  const r = await query(
    `SELECT id, level, start_date, expected_end_date, status FROM trainee_rotations
      WHERE user_id = $1 AND status = ANY($2) ORDER BY start_date DESC LIMIT 1`,
    [userId, OPEN_STATUSES]
  ).catch(() => ({ rows: [] }));
  return r.rows[0] || null;
}

async function latestRecord(userId) {
  const r = await query(`SELECT * FROM posting_onboarding WHERE user_id = $1 ORDER BY created_at DESC LIMIT 1`, [userId]);
  return r.rows[0] || null;
}

async function cohortDates(level) {
  try {
    const r = await query(
      `SELECT commencement_date, end_date FROM rotation_configs WHERE level = $1 AND is_active = true ORDER BY updated_at DESC NULLS LAST LIMIT 1`,
      [level]
    );
    return r.rows[0] || null;
  } catch { return null; }
}

/** Count with a timestamp column that may be named differently across deployments. */
async function countSince(sql, params) {
  try { return Number((await query(sql, params)).rows[0]?.n) || 0; } catch { return 0; }
}

async function catchUpProgress(userId, since) {
  const [articles, cbtPapers, cbtBank] = await Promise.all([
    countSince(`SELECT COUNT(*) AS n FROM learner_article_progress
                 WHERE learner_kind = 'user' AND learner_id = $1 AND reading_completed AND reading_completed_at >= $2::date`, [userId, since]),
    countSince(`SELECT COUNT(*) AS n FROM cbt_attempts
                 WHERE user_id = $1 AND completed = true
                   AND COALESCE(to_jsonb(cbt_attempts) ->> 'completed_at', to_jsonb(cbt_attempts) ->> 'submitted_at', to_jsonb(cbt_attempts) ->> 'created_at')::timestamptz >= $2::date`, [userId, since]),
    countSince(`SELECT COUNT(*) AS n FROM learner_test_attempts
                 WHERE learner_kind = 'user' AND learner_id = $1
                   AND COALESCE(to_jsonb(learner_test_attempts) ->> 'submitted_at', to_jsonb(learner_test_attempts) ->> 'created_at')::timestamptz >= $2::date`, [userId, since]),
  ]);
  return { articles, cbt: cbtPapers + cbtBank };
}

async function units() {
  const cfg = await getUnitConfig().catch(() => null);
  const list = cfg?.units?.length === 2 ? cfg.units.map(u => ({ key: u.key, name: u.name })) : DEFAULT_UNITS;
  return { cfg, list };
}

/** What the app needs to decide whether to show onboarding, and to fill it in. */
export async function onboardingStatus(user) {
  await ensureOnboardingTable();
  const grade = await gradeOf(user.role);
  if (!ONBOARDING_GRADES.includes(grade)) return { required: false, applicable: false };

  const today = todayWat();
  const [rotation, record, { list }] = await Promise.all([openRotation(user.id), latestRecord(user.id), units()]);
  const level = normalizeLevel(user.role);
  const covered = record && (rotation ? record.rotation_id === rotation.id : ymd(record.posting_end) >= today);

  // Pre-fill: the rotation already open, else the unit's cohort dates, else today + the usual length.
  const cohort = rotation ? null : await cohortDates(level);
  const roleKey = grade === 'registrar' ? 'registrar' : grade;
  const defaultStart = rotation ? ymd(rotation.start_date) : cohort?.commencement_date ? ymd(cohort.commencement_date) : today;
  const defaultEnd = rotation ? ymd(rotation.expected_end_date)
    : cohort?.end_date ? ymd(cohort.end_date) : addDays(defaultStart, DEFAULT_ROTATION_DAYS[roleKey] || 90);

  const req = getRequirements(level);
  // How many CME articles exist for this role (all of them are to be read).
  let cmeAvailable = null;
  try { cmeAvailable = (await countsFor(await categoriesFor(level))).articles; } catch { /* catalogue not installed */ }
  let catchUp = null;
  if (record && covered && record.catch_up_articles + record.catch_up_cbt > 0) {
    const done = await catchUpProgress(user.id, ymd(record.posting_start));
    catchUp = {
      articles: { required: record.catch_up_articles, done: Math.min(done.articles, record.catch_up_articles) },
      cbt: { required: record.catch_up_cbt, done: Math.min(done.cbt, record.catch_up_cbt) },
      due: ymd(record.catch_up_due),
      daysLate: record.days_late,
    };
    catchUp.complete = catchUp.articles.done >= catchUp.articles.required && catchUp.cbt.done >= catchUp.cbt.required;
  }

  return {
    applicable: true,
    required: !covered,
    grade, level,
    units: list,
    defaults: { start: defaultStart, end: defaultEnd },
    requirements: req,
    cmeAvailable,
    signOut: { passThreshold: PASS_THRESHOLD, minSectionScore: MIN_SECTION_SCORE },
    record: covered ? record : null,
    catchUp,
    today,
  };
}

/** Add the trainee to their chosen unit on the call roster, unless already listed. */
async function placeInUnit(cfg, unitKey, grade, userId, byUserId) {
  if (!cfg) return { note: null };
  const listKey = GRADE_LIST_KEY[grade];
  const current = (cfg.current_units || cfg.units).map(u => ({ ...u }));
  const id = String(userId);
  const already = current.find(u => (u[listKey] || []).map(String).includes(id));
  if (already) {
    return already.key === unitKey ? { note: null }
      : { note: `Chose ${current.find(u => u.key === unitKey)?.name || unitKey} but the call roster lists them in ${already.name} — roster admin to confirm` };
  }
  const target = current.find(u => u.key === unitKey);
  if (!target) return { note: `Unit ${unitKey} not found on the call roster` };
  target[listKey] = [...(target[listKey] || []), id];
  const r = await saveUnitConfig({ anchor_date: cfg.anchor_date, rotation: cfg.rotation, units: current }, byUserId);
  return r.error ? { note: `Could not add to the call roster: ${r.error}` } : { note: null };
}

export async function submitOnboarding(user, body) {
  await ensureOnboardingTable();
  const status = await onboardingStatus(user);
  if (!status.applicable) return { status: 400, error: 'Posting onboarding is for house officers and residents' };
  if (!status.required) return { status: 409, error: 'You have already completed onboarding for this posting' };

  const start = String(body.posting_start || '');
  const end = String(body.posting_end || '');
  const today = todayWat();
  const invalid = validatePosting({ start, end, today });
  if (invalid) return { status: 400, error: invalid };
  if (body.accepted !== true || !body.rules_version) return { status: 400, error: 'You must accept the expectations and sign-out rules' };
  const { cfg, list } = await units();
  const unit = list.find(u => u.key === body.unit_key);
  if (!unit) return { status: 400, error: 'Select the unit you are posted to' };

  // Rotation: correct the open one to the stated dates, or start one.
  let rotation = await openRotation(user.id);
  const roleKey = status.grade === 'registrar' ? (user.role === 'junior_registrar' ? 'junior_registrar' : 'registrar') : status.grade;
  if (rotation) {
    const r = await query(
      `UPDATE trainee_rotations SET start_date = $1::date, expected_end_date = $2::date, updated_at = NOW() WHERE id = $3 RETURNING id`,
      [start, end, rotation.id]
    );
    rotation = r.rows[0] || rotation;
  } else {
    const r = await startRotation({ userId: user.id, level: roleKey, days: daysBetween(start, end), startDate: start });
    rotation = r.rotation || { id: r.rotationId };
    if (rotation?.id) await query(`UPDATE trainee_rotations SET expected_end_date = $1::date WHERE id = $2`, [end, rotation.id]);
  }

  const catchUp = computeCatchUp({ start, end, today, level: status.level });
  let unitNote = null;
  try { unitNote = (await placeInUnit(cfg, unit.key, status.grade, user.id, user.id)).note; }
  catch (e) { unitNote = `Could not update the call roster: ${e.message}`; }

  const ins = await query(
    `INSERT INTO posting_onboarding (user_id, rotation_id, role, grade, level, unit_key, unit_name, posting_start, posting_end,
       rules_version, days_late, catch_up_articles, catch_up_cbt, catch_up_due, unit_note)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15) RETURNING *`,
    [user.id, rotation?.id ?? null, user.role, status.grade, status.level, unit.key, unit.name, start, end,
     String(body.rules_version).slice(0, 40), catchUp.daysLate, catchUp.articles, catchUp.cbt, catchUp.due, unitNote]
  );

  // The house-officer responsibilities were part of what was accepted.
  if (status.grade === 'house_officer') {
    try {
      await query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS ho_responsibilities_acknowledged_at TIMESTAMP`);
      await query(`UPDATE users SET ho_responsibilities_acknowledged_at = COALESCE(ho_responsibilities_acknowledged_at, NOW()) WHERE id = $1`, [user.id]);
    } catch (e) { console.warn('ho acknowledgment on onboarding:', e.message); }
  }
  try {
    await query(
      `INSERT INTO activity_logs (user_id, activity_type, description, metadata) VALUES ($1, 'posting_onboarding', $2, $3)`,
      [user.id, `Posting ${start} to ${end} in ${unit.name}${catchUp.daysLate ? `, ${catchUp.daysLate} days late` : ''}`,
       JSON.stringify({ rotation_id: rotation?.id, unit: unit.key, catch_up: catchUp })]
    );
  } catch { /* activity log is best-effort */ }

  return { status: 201, record: ins.rows[0], catchUp, unitNote };
}

/** Admin view: every onboarding, newest first, with any roster notes. */
export async function listOnboarding() {
  await ensureOnboardingTable();
  const r = await query(
    `SELECT o.*, u.full_name, u.email FROM posting_onboarding o LEFT JOIN users u ON u.id = o.user_id
      ORDER BY o.created_at DESC LIMIT 300`
  );
  return r.rows;
}
