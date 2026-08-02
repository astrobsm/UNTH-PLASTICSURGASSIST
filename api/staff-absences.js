// Staff absence API — leave, outside posting and the cover arrangements.
//
// Routes (single file, query-dispatched like api/wounds.js):
//   GET    /api/staff-absences                    → all absences (newest first)
//   GET    /api/staff-absences?userId=            → one user's absences
//   GET    /api/staff-absences?action=active      → who is away right now
//   GET    /api/staff-absences?action=detail&id=  → absence + its move ledger
//   POST   /api/staff-absences                    → schedule an absence
//   PATCH  /api/staff-absences?id=                → edit dates/type/reason
//   PATCH  /api/staff-absences?action=start&id=   → start early (manual)
//   PATCH  /api/staff-absences?action=end&id=     → end early (manual return)
//   DELETE /api/staff-absences?id=                → cancel a scheduled absence
//
// Every request first calls processDueAbsences(), which activates absences that
// have reached their start date and completes those past their end date. That
// is deliberate — see the "NO CRON" note in api/_lib/staffAbsence.js. It is
// throttled per warm instance and never throws.
import { query } from './_lib/db.js';
import { cors, authenticateRequest } from './_lib/auth.js';
import {
  ensureAbsenceTables, processDueAbsences, activateAbsence, completeAbsence,
  getAbsentUserIds, getAbsentUserIdsOn, ABSENCE_TYPES,
} from './_lib/staffAbsence.js';

// Recording someone as away moves live patients between clinicians, so it sits
// with the roles that already manage staff.
const MANAGE_ROLES = ['admin', 'super_admin', 'consultant', 'senior_registrar'];

export default async function handler(req, res) {
  if (cors(req, res)) return;

  const auth = authenticateRequest(req);
  if (!auth.authenticated) return res.status(auth.status || 401).json({ error: auth.error });

  try {
    await ensureAbsenceTables();
    await processDueAbsences();
  } catch (e) {
    console.error('absence pre-processing failed:', e.message);
  }

  const url = new URL(req.url, `http://${req.headers.host}`);
  const action = url.searchParams.get('action');
  const id = url.searchParams.get('id');

  try {
    switch (req.method) {
      case 'GET':
        if (action === 'active') return await listActive(res);
        if (action === 'absent-on') return await listAbsentOn(url.searchParams, res);
        if (action === 'detail') return await getDetail(id, res);
        return await listAbsences(url.searchParams, res);

      case 'POST':
        if (!MANAGE_ROLES.includes(auth.user.role)) {
          return res.status(403).json({ error: 'Insufficient permissions' });
        }
        return await createAbsence(req.body, auth.user, res);

      case 'PUT':
      case 'PATCH': {
        if (!MANAGE_ROLES.includes(auth.user.role)) {
          return res.status(403).json({ error: 'Insufficient permissions' });
        }
        if (action === 'start') return await startNow(id, res);
        if (action === 'end') return await endNow(id, res);
        return await updateAbsence(id, req.body, res);
      }

      case 'DELETE':
        if (!MANAGE_ROLES.includes(auth.user.role)) {
          return res.status(403).json({ error: 'Insufficient permissions' });
        }
        return await cancelAbsence(id, res);

      default:
        return res.status(405).json({ error: 'Method not allowed' });
    }
  } catch (error) {
    console.error('staff-absences API error:', error);
    return res.status(500).json({ error: 'Internal server error', message: error.message });
  }
}

async function listAbsences(searchParams, res) {
  const userId = searchParams.get('userId');
  const params = [];
  let where = '';
  if (userId) { params.push(String(userId)); where = 'WHERE a.user_id = $1'; }

  const r = await query(
    `SELECT a.*, u.full_name AS current_name, u.role AS current_role
     FROM staff_absences a
     LEFT JOIN users u ON u.id::text = a.user_id
     ${where}
     ORDER BY CASE a.status WHEN 'active' THEN 0 WHEN 'scheduled' THEN 1 ELSE 2 END,
              a.start_date DESC
     LIMIT 500`,
    params
  );
  return res.status(200).json({ absences: r.rows });
}

async function listActive(res) {
  const ids = await getAbsentUserIds();
  const r = await query(
    `SELECT a.*, u.full_name AS current_name FROM staff_absences a
     LEFT JOIN users u ON u.id::text = a.user_id
     WHERE a.status = 'active' AND CURRENT_DATE BETWEEN a.start_date AND a.end_date
     ORDER BY a.end_date ASC`
  );
  return res.status(200).json({ absences: r.rows, absentUserIds: ids });
}

/**
 * Who will be away on a given date. Used by roster screens, which are built
 * ahead of time and therefore need scheduled absences counted, not just active
 * ones.
 */
async function listAbsentOn(searchParams, res) {
  const date = searchParams.get('date');
  if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    return res.status(400).json({ error: 'date=YYYY-MM-DD is required' });
  }
  const ids = await getAbsentUserIdsOn(date);
  const rows = ids.length
    ? (await query(
        `SELECT a.user_id, a.user_name, a.absence_type, a.start_date, a.end_date, a.status
         FROM staff_absences a
         WHERE a.status IN ('scheduled','active') AND $1::date BETWEEN a.start_date AND a.end_date`,
        [date]
      )).rows
    : [];
  return res.status(200).json({ date, absentUserIds: ids, absences: rows });
}

async function getDetail(id, res) {
  const absenceId = parseInt(id, 10);
  if (Number.isNaN(absenceId)) return res.status(400).json({ error: 'Valid id is required' });

  const a = await query(`SELECT * FROM staff_absences WHERE id = $1`, [absenceId]);
  if (!a.rows.length) return res.status(404).json({ error: 'Absence not found' });

  // The ledger, joined to names so the UI can show "3 patients -> Dr X".
  const moves = await query(
    `SELECT r.*, uf.full_name AS from_name, ut.full_name AS to_name
     FROM absence_reassignments r
     LEFT JOIN users uf ON uf.id::text = r.from_user_id
     LEFT JOIN users ut ON ut.id::text = r.to_user_id
     WHERE r.absence_id = $1 ORDER BY r.entity_type, r.id`,
    [absenceId]
  );
  return res.status(200).json({ absence: a.rows[0], reassignments: moves.rows });
}

async function createAbsence(body, user, res) {
  const b = body || {};
  if (!b.user_id) return res.status(400).json({ error: 'user_id is required' });
  if (!b.start_date || !b.end_date) return res.status(400).json({ error: 'start_date and end_date are required' });
  if (new Date(b.end_date) < new Date(b.start_date)) {
    return res.status(400).json({ error: 'end_date must be on or after start_date' });
  }
  const type = ABSENCE_TYPES.includes(b.absence_type) ? b.absence_type : 'annual_leave';

  // Overlapping absences for one person would double-move their patients and
  // make the restore ledger ambiguous.
  const clash = await query(
    `SELECT id FROM staff_absences
     WHERE user_id = $1 AND status IN ('scheduled','active')
       AND start_date <= $3 AND end_date >= $2 LIMIT 1`,
    [String(b.user_id), b.start_date, b.end_date]
  );
  if (clash.rows.length) {
    return res.status(409).json({ error: 'This staff member already has an absence covering those dates' });
  }

  const target = (await query(
    `SELECT full_name, role FROM users WHERE id::text = $1 LIMIT 1`, [String(b.user_id)]
  )).rows[0] || {};

  const r = await query(
    `INSERT INTO staff_absences
      (user_id, user_name, user_role, absence_type, start_date, end_date, status, reason, notes, created_by)
     VALUES ($1,$2,$3,$4,$5,$6,'scheduled',$7,$8,$9) RETURNING *`,
    [
      String(b.user_id), target.full_name || b.user_name || null, target.role || b.user_role || null,
      type, b.start_date, b.end_date, b.reason || null, b.notes || null, user.id || null,
    ]
  );
  const absence = r.rows[0];

  // Starting today: activate immediately rather than waiting for the next
  // request, so the person recording it sees the cover take effect.
  let effect = null;
  const startsToday = new Date(absence.start_date) <= new Date(new Date().toISOString().slice(0, 10));
  if (startsToday) {
    try { effect = await activateAbsence(absence.id); }
    catch (e) { console.error('immediate activation failed:', e.message); }
  }

  const fresh = (await query(`SELECT * FROM staff_absences WHERE id = $1`, [absence.id])).rows[0];
  return res.status(201).json({ absence: fresh, effect });
}

async function updateAbsence(id, body, res) {
  const absenceId = parseInt(id, 10);
  if (Number.isNaN(absenceId)) return res.status(400).json({ error: 'Valid id is required' });
  const b = body || {};

  const allowed = ['absence_type', 'start_date', 'end_date', 'reason', 'notes'];
  const sets = [];
  const values = [];
  let n = 1;
  for (const key of allowed) {
    if (b[key] !== undefined) { sets.push(`${key} = $${n++}`); values.push(b[key]); }
  }
  if (!sets.length) return res.status(400).json({ error: 'No updatable fields supplied' });

  values.push(absenceId);
  const r = await query(
    `UPDATE staff_absences SET ${sets.join(', ')}, updated_at = NOW() WHERE id = $${n} RETURNING *`,
    values
  );
  if (!r.rows.length) return res.status(404).json({ error: 'Absence not found' });
  return res.status(200).json({ absence: r.rows[0] });
}

async function startNow(id, res) {
  const absenceId = parseInt(id, 10);
  if (Number.isNaN(absenceId)) return res.status(400).json({ error: 'Valid id is required' });
  const effect = await activateAbsence(absenceId);
  const fresh = (await query(`SELECT * FROM staff_absences WHERE id = $1`, [absenceId])).rows[0];
  return res.status(200).json({ absence: fresh, effect });
}

async function endNow(id, res) {
  const absenceId = parseInt(id, 10);
  if (Number.isNaN(absenceId)) return res.status(400).json({ error: 'Valid id is required' });
  const effect = await completeAbsence(absenceId);
  const fresh = (await query(`SELECT * FROM staff_absences WHERE id = $1`, [absenceId])).rows[0];
  return res.status(200).json({ absence: fresh, effect });
}

async function cancelAbsence(id, res) {
  const absenceId = parseInt(id, 10);
  if (Number.isNaN(absenceId)) return res.status(400).json({ error: 'Valid id is required' });

  const a = (await query(`SELECT status FROM staff_absences WHERE id = $1`, [absenceId])).rows[0];
  if (!a) return res.status(404).json({ error: 'Absence not found' });

  // An active absence has already moved work; cancelling it must give the work
  // back rather than just flipping a flag and leaving the cover in place.
  if (a.status === 'active') {
    const effect = await completeAbsence(absenceId);
    await query(`UPDATE staff_absences SET status = 'cancelled', updated_at = NOW() WHERE id = $1`, [absenceId]);
    return res.status(200).json({ cancelled: true, restored: effect });
  }

  const r = await query(
    `UPDATE staff_absences SET status = 'cancelled', updated_at = NOW() WHERE id = $1 RETURNING *`,
    [absenceId]
  );
  return res.status(200).json({ absence: r.rows[0] });
}
