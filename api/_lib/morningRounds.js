// ============================================================================
// House officers' morning round — 07:00 to 09:00 WAT, every day.
//
// Each house officer rounds on every patient they are assigned, documents the
// round in the app (a ward round of type 'house_officers_round') and in the
// patient's paper folder, and confirms the folder entry on the app record.
// That is what is tracked:
//
//   done     documented in the app inside 07:00–09:00, folder confirmed
//   no folder documented on time, folder not confirmed
//   late     documented that day, but outside the window
//   missed   no house officer's round from this HO that day
//
// WHO WAS EXPECTED. Assignments change during the day (admissions, discharges,
// rotation), and the app keeps no history of them, so each day's list is
// frozen once: the first time anything touches the morning round that day,
// every house officer's assigned patients are written to
// ho_morning_round_days. There is no scheduler; the on-call card that every
// open dashboard polls is the heartbeat that takes the snapshot early. A day on
// which nobody opened the app has no snapshot and counts neither way.
//
// WHEN IT WAS WRITTEN. ward_rounds.created_at is when the server received the
// round — for a round written offline on the ward and synced at noon, that is
// noon. So the app stamps documented_at when the round is saved and that is
// what is judged; created_at is the fallback for rounds from older clients.
// ============================================================================

import { query } from './db.js';
import { watDayNumber, ymdFromDayNumber, dayNumberFromYmd, WAT_OFFSET_MS } from './unitCallPattern.js';

export const HO_ROUND_START_HOUR = 7;
export const HO_ROUND_END_HOUR = 9;
export const HO_ROUND_TYPE = 'house_officers_round';

const HOUR_MS = 3600000;
const DAY_MS = 86400000;

/** UTC instants bounding the round window on a WAT calendar day. */
export function roundWindow(dayNum) {
  const midnightUtc = dayNum * DAY_MS - WAT_OFFSET_MS;
  return {
    start: new Date(midnightUtc + HO_ROUND_START_HOUR * HOUR_MS),
    end: new Date(midnightUtc + HO_ROUND_END_HOUR * HOUR_MS),
    dayStart: new Date(midnightUtc),
    dayEnd: new Date(midnightUtc + DAY_MS),
  };
}

/** 'before' | 'open' | 'closed' for a day's window at `now`. */
export function windowState(dayNum, now = new Date()) {
  const w = roundWindow(dayNum);
  if (now < w.start) return 'before';
  if (now < w.end) return 'open';
  return 'closed';
}

/**
 * Status of one expected patient from the HO's rounds that day.
 * `rounds` = [{ at: Date, folder: boolean }] for this patient on this day.
 */
export function patientRoundStatus(rounds, dayNum, now = new Date()) {
  const w = roundWindow(dayNum);
  const inWindow = rounds.filter(r => r.at >= w.start && r.at < w.end);
  if (inWindow.some(r => r.folder)) return 'done';
  if (inWindow.length) return 'no_folder';
  if (rounds.some(r => r.at >= w.dayStart && r.at < w.dayEnd)) return 'late';
  return now < w.end ? 'pending' : 'missed';
}

let ensured = false;
async function ensureTables() {
  if (ensured) return;
  await query(`CREATE TABLE IF NOT EXISTS ho_morning_round_days (
    ho_id TEXT NOT NULL,
    day DATE NOT NULL,
    expected_patient_ids JSONB NOT NULL DEFAULT '[]',
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (ho_id, day)
  )`);
  for (const s of [
    `ALTER TABLE ward_rounds ADD COLUMN IF NOT EXISTS documented_at TIMESTAMPTZ`,
    `ALTER TABLE ward_rounds ADD COLUMN IF NOT EXISTS folder_updated BOOLEAN DEFAULT FALSE`,
  ]) {
    try { await query(s); } catch (e) { console.warn('morningRounds ensure:', e.message); }
  }
  ensured = true;
}

/** Freeze today's expected patients for every house officer, once per day. */
let lastSnapshotDay = null;
export async function ensureMorningSnapshot(now = new Date()) {
  const dayNum = watDayNumber(now);
  if (lastSnapshotDay === dayNum) return;
  await ensureTables();
  const day = ymdFromDayNumber(dayNum);
  const marker = await query(`SELECT 1 FROM ho_morning_round_days WHERE ho_id = '*' AND day = $1`, [day]);
  if (marker.rows.length) { lastSnapshotDay = dayNum; return; }
  const rows = (await query(
    // Only house officers whose accounts are active: someone signed out is not
    // expected on the round, and their patients belong to whoever took them.
    `SELECT pa.house_officer_id::text AS ho, pa.patient_id::text AS pid
       FROM patient_assignments pa
       JOIN users u ON u.id::text = pa.house_officer_id::text AND u.is_active = TRUE
      WHERE pa.is_active = TRUE AND pa.house_officer_id IS NOT NULL AND pa.house_officer_id::text <> ''`
  )).rows;
  const byHo = new Map();
  for (const r of rows) {
    if (!byHo.has(r.ho)) byHo.set(r.ho, []);
    byHo.get(r.ho).push(r.pid);
  }
  for (const [ho, pids] of byHo) {
    await query(
      `INSERT INTO ho_morning_round_days (ho_id, day, expected_patient_ids) VALUES ($1, $2, $3)
       ON CONFLICT (ho_id, day) DO NOTHING`,
      [ho, day, JSON.stringify([...new Set(pids)])]
    );
  }
  // A marker row ('*') records that the day has been snapshotted, so the day
  // is not re-snapshotted later with a different set of patients.
  await query(
    `INSERT INTO ho_morning_round_days (ho_id, day, expected_patient_ids) VALUES ('*', $1, '[]')
     ON CONFLICT (ho_id, day) DO NOTHING`, [day]
  );
  lastSnapshotDay = dayNum;
}

/** This HO's house officers' rounds in a period, as Map<`${pid}`, [{at, folder, id}]>. */
async function roundsFor(hoId, from, to) {
  const r = await query(
    `SELECT id, patient_id::text AS pid, COALESCE(documented_at, created_at) AS at, COALESCE(folder_updated, FALSE) AS folder
       FROM ward_rounds
      WHERE user_id::text = $1 AND round_type = $2
        AND COALESCE(documented_at, created_at) >= $3 AND COALESCE(documented_at, created_at) < $4`,
    [String(hoId), HO_ROUND_TYPE, from.toISOString(), to.toISOString()]
  );
  const map = new Map();
  for (const row of r.rows) {
    if (!map.has(row.pid)) map.set(row.pid, []);
    map.get(row.pid).push({ id: row.id, at: new Date(row.at), folder: !!row.folder });
  }
  return map;
}

/**
 * One HO's checklist for a day: each expected patient and their status.
 * Today's list is the snapshot (taken now if needed); a day with no snapshot
 * falls back to the HO's current patients.
 */
export async function morningChecklist(hoId, dayYmd = null, now = new Date()) {
  await ensureTables();
  const dayNum = dayYmd ? dayNumberFromYmd(dayYmd) : watDayNumber(now);
  if (dayNum === watDayNumber(now)) await ensureMorningSnapshot(now);
  const day = ymdFromDayNumber(dayNum);
  const snap = await query(`SELECT expected_patient_ids FROM ho_morning_round_days WHERE ho_id = $1 AND day = $2`, [String(hoId), day]);
  let expected = snap.rows[0]?.expected_patient_ids || null;
  if (typeof expected === 'string') expected = JSON.parse(expected);
  if (!expected) {
    expected = (await query(
      `SELECT patient_id::text AS pid FROM patient_assignments WHERE is_active = TRUE AND house_officer_id::text = $1`,
      [String(hoId)]
    )).rows.map(r => r.pid);
  }
  const w = roundWindow(dayNum);
  const rounds = await roundsFor(hoId, w.dayStart, w.dayEnd);

  const details = new Map();
  if (expected.length) {
    try {
      const pr = await query(
        `SELECT p.id::text AS pid, TRIM(COALESCE(p.first_name,'') || ' ' || COALESCE(p.last_name,'')) AS name, p.hospital_number,
                a.ward_location AS ward, a.bed_number AS bed
           FROM patients p
           LEFT JOIN LATERAL (
             SELECT ward_location, bed_number FROM admissions
              WHERE patient_id::text = p.id::text AND status IN ('active','admitted')
              ORDER BY admission_date DESC NULLS LAST LIMIT 1
           ) a ON TRUE
          WHERE p.id::text = ANY($1::text[])`,
        [expected]
      );
      for (const r of pr.rows) details.set(r.pid, r);
    } catch (e) {
      console.warn('morningChecklist patient details:', e.message);
    }
  }

  const items = expected.map(pid => {
    const list = rounds.get(pid) || [];
    const status = patientRoundStatus(list, dayNum, now);
    const first = list.slice().sort((a, b) => a.at - b.at)[0];
    const d = details.get(pid) || {};
    return {
      patient_id: pid,
      name: d.name || `Patient ${pid}`,
      hospital_number: d.hospital_number || null,
      ward: d.ward || null,
      bed: d.bed || null,
      status,
      documented_at: first ? first.at.toISOString() : null,
      round_id: first ? first.id : null,
    };
  });
  const count = (s) => items.filter(i => i.status === s).length;
  return {
    ho_id: String(hoId),
    day,
    window: { start: w.start.toISOString(), end: w.end.toISOString(), state: windowState(dayNum, now) },
    items,
    summary: { expected: items.length, done: count('done'), no_folder: count('no_folder'), late: count('late'), missed: count('missed'), pending: count('pending') },
  };
}

/**
 * Compliance over a period: share of expected patient-mornings that were
 * documented on time with the folder confirmed. Days the HO was on leave, and
 * today until its window closes, are left out.
 */
export async function morningCompliance(hoId, { since = null, now = new Date() } = {}) {
  await ensureTables();
  const params = [String(hoId)];
  let where = `ho_id = $1`;
  if (since) { params.push(since); where += ` AND day >= $2`; }
  const snaps = (await query(
    `SELECT TO_CHAR(day, 'YYYY-MM-DD') AS day, expected_patient_ids FROM ho_morning_round_days WHERE ${where} ORDER BY day`,
    params
  )).rows;

  let absences = [];
  try {
    absences = (await query(
      `SELECT start_date, end_date FROM staff_absences WHERE user_id::text = $1 AND status IN ('scheduled','active','completed')`,
      [String(hoId)]
    )).rows.map(a => ({ from: watDayNumber(new Date(a.start_date)), to: watDayNumber(new Date(a.end_date)) }));
  } catch { /* no absence table */ }

  const today = watDayNumber(now);
  const days = [];
  let expected = 0;
  let done = 0;
  if (snaps.length) {
    const first = dayNumberFromYmd(snaps[0].day);
    const rounds = await roundsFor(hoId, roundWindow(first).dayStart, roundWindow(today).dayEnd);
    for (const s of snaps) {
      const dayNum = dayNumberFromYmd(s.day);
      if (dayNum > today || (dayNum === today && windowState(dayNum, now) !== 'closed')) continue;
      if (absences.some(a => dayNum >= a.from && dayNum <= a.to)) continue;
      let ids = s.expected_patient_ids;
      if (typeof ids === 'string') ids = JSON.parse(ids);
      if (!ids || !ids.length) continue;
      const tally = { day: s.day, expected: ids.length, done: 0, no_folder: 0, late: 0, missed: 0 };
      for (const pid of ids) {
        const st = patientRoundStatus(rounds.get(pid) || [], dayNum, now);
        if (st in tally) tally[st]++;
      }
      expected += tally.expected;
      done += tally.done;
      days.push(tally);
    }
  }
  return {
    expected,
    done,
    pct: expected ? Math.round((done / expected) * 1000) / 10 : null,
    days,
  };
}
