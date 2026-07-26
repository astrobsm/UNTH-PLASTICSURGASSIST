// Clinic Day Log — every user records the duties they actually did on a given
// day (clerking, wound debridement, wound inspection, …) picked from a fixed
// catalogue, so the unit has a defensible record of who did what.
//
//   GET    /api/clinic-day-logs?date=YYYY-MM-DD[&user_id=][&start=&end=]
//   GET    /api/clinic-day-logs?action=summary&start=&end=   -> counts per user/duty
//   POST   /api/clinic-day-logs        { log_date, duty_type, ... }
//   PUT    /api/clinic-day-logs        { id, ... }
//   DELETE /api/clinic-day-logs?id=
//
// Anyone signed in may log their OWN duties and read the day's log (the point is
// a shared picture of the day). Editing or deleting someone else's entry is
// restricted to admins/consultants — a log nobody can quietly rewrite is worth
// more than a tidy one.
import { query } from './_lib/db.js';
import { cors, authenticateRequest } from './_lib/auth.js';

const SUPERVISOR_ROLES = ['admin', 'super_admin', 'consultant', 'senior_registrar'];

let tableReady = false;
async function ensureTable() {
  if (tableReady) return;
  await query(`
    CREATE TABLE IF NOT EXISTS clinic_day_logs (
      id SERIAL PRIMARY KEY,
      log_date DATE NOT NULL,
      user_id VARCHAR(100) NOT NULL,
      user_name VARCHAR(255),
      user_role VARCHAR(60),
      duty_type VARCHAR(80) NOT NULL,
      duty_label VARCHAR(160),
      quantity INTEGER DEFAULT 1,
      patient_id VARCHAR(100),
      hospital_number VARCHAR(100),
      patient_name VARCHAR(255),
      location VARCHAR(160),
      notes TEXT,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `);
  for (const stmt of [
    `CREATE INDEX IF NOT EXISTS idx_clinic_day_logs_date ON clinic_day_logs (log_date)`,
    `CREATE INDEX IF NOT EXISTS idx_clinic_day_logs_user ON clinic_day_logs (user_id, log_date)`,
  ]) {
    try { await query(stmt); } catch (e) { console.warn('clinic_day_logs index skipped:', e.message); }
  }
  tableReady = true;
}

export default async function handler(req, res) {
  if (cors(req, res)) return;

  const auth = authenticateRequest(req);
  if (!auth.authenticated) return res.status(auth.status || 401).json({ error: auth.error });

  const url = new URL(req.url, `http://${req.headers.host}`);
  const params = url.searchParams;

  try {
    await ensureTable();
    switch (req.method) {
      case 'GET':
        if (params.get('action') === 'summary') return await getSummary(params, res);
        return await getLogs(params, res);
      case 'POST':
        return await createLog(req.body, auth.user, res);
      case 'PUT':
      case 'PATCH':
        return await updateLog(req.body, auth.user, res);
      case 'DELETE':
        return await deleteLog(params, auth.user, res);
      default:
        return res.status(405).json({ error: 'Method not allowed' });
    }
  } catch (e) {
    console.error('clinic-day-logs error:', e);
    return res.status(500).json({ error: 'Internal server error', message: e.message });
  }
}

const parseBody = (b) => (typeof b === 'string' ? JSON.parse(b || '{}') : (b || {}));
const today = () => new Date().toISOString().slice(0, 10);

async function getLogs(params, res) {
  const where = [];
  const vals = [];
  const add = (sql, v) => { vals.push(v); where.push(sql.replace('?', `$${vals.length}`)); };

  const start = params.get('start');
  const end = params.get('end');
  if (start && end) {
    add('log_date >= ?', start.slice(0, 10));
    add('log_date <= ?', end.slice(0, 10));
  } else {
    add('log_date = ?', (params.get('date') || today()).slice(0, 10));
  }
  if (params.get('user_id')) add('user_id = ?', String(params.get('user_id')));
  if (params.get('duty_type')) add('duty_type = ?', String(params.get('duty_type')));

  const r = await query(
    `SELECT * FROM clinic_day_logs
      WHERE ${where.join(' AND ')}
      ORDER BY log_date DESC, user_name NULLS LAST, created_at`,
    vals
  );
  return res.status(200).json({ logs: r.rows });
}

async function getSummary(params, res) {
  const start = (params.get('start') || today()).slice(0, 10);
  const end = (params.get('end') || start).slice(0, 10);
  const byUser = await query(
    `SELECT user_id, user_name, user_role,
            SUM(quantity) AS total,
            COUNT(DISTINCT log_date) AS days_logged
       FROM clinic_day_logs
      WHERE log_date BETWEEN $1 AND $2
      GROUP BY user_id, user_name, user_role
      ORDER BY total DESC`,
    [start, end]
  );
  const byDuty = await query(
    `SELECT duty_type, duty_label, SUM(quantity) AS total
       FROM clinic_day_logs
      WHERE log_date BETWEEN $1 AND $2
      GROUP BY duty_type, duty_label
      ORDER BY total DESC`,
    [start, end]
  );
  const byUserDuty = await query(
    `SELECT user_id, user_name, duty_type, duty_label, SUM(quantity) AS total
       FROM clinic_day_logs
      WHERE log_date BETWEEN $1 AND $2
      GROUP BY user_id, user_name, duty_type, duty_label
      ORDER BY user_name NULLS LAST, total DESC`,
    [start, end]
  );
  const num = (rows, key = 'total') => rows.map(r => ({ ...r, [key]: Number(r[key]) }));
  return res.status(200).json({
    start, end,
    byUser: num(byUser.rows).map(r => ({ ...r, days_logged: Number(r.days_logged) })),
    byDuty: num(byDuty.rows),
    byUserDuty: num(byUserDuty.rows),
  });
}

async function createLog(body, user, res) {
  const b = parseBody(body);
  const dutyType = String(b.duty_type || '').trim();
  if (!dutyType) return res.status(400).json({ error: 'duty_type is required' });

  const logDate = String(b.log_date || today()).slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(logDate)) return res.status(400).json({ error: 'log_date must be YYYY-MM-DD' });

  // A log entry is always attributed to the signed-in user. Supervisors may file
  // on someone else's behalf (e.g. a paper list handed in), which is recorded.
  let userId = String(user.id);
  let userName = user.fullName || user.full_name || user.email || 'Unknown';
  let userRole = user.role;
  let notes = b.notes || null;
  if (b.user_id && String(b.user_id) !== String(user.id)) {
    if (!SUPERVISOR_ROLES.includes(user.role)) {
      return res.status(403).json({ error: 'You can only log your own duties' });
    }
    const target = await query(`SELECT id::text AS id, full_name, role FROM users WHERE id::text = $1`, [String(b.user_id)]);
    if (target.rows.length === 0) return res.status(404).json({ error: 'That staff member was not found' });
    userId = target.rows[0].id;
    userName = target.rows[0].full_name;
    userRole = target.rows[0].role;
    notes = `${notes ? notes + ' — ' : ''}filed by ${user.fullName || user.email || 'supervisor'}`;
  }

  const quantity = Number.isFinite(+b.quantity) && +b.quantity > 0 ? Math.min(200, Math.trunc(+b.quantity)) : 1;
  const r = await query(
    `INSERT INTO clinic_day_logs
       (log_date, user_id, user_name, user_role, duty_type, duty_label, quantity,
        patient_id, hospital_number, patient_name, location, notes)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12) RETURNING *`,
    [logDate, userId, userName, userRole, dutyType, b.duty_label || dutyType, quantity,
     b.patient_id || null, b.hospital_number || null, b.patient_name || null, b.location || null, notes]
  );
  return res.status(201).json({ log: r.rows[0] });
}

async function updateLog(body, user, res) {
  const b = parseBody(body);
  if (!b.id) return res.status(400).json({ error: 'id is required' });

  const found = await query(`SELECT * FROM clinic_day_logs WHERE id = $1`, [b.id]);
  if (found.rows.length === 0) return res.status(404).json({ error: 'Log entry not found' });
  const row = found.rows[0];
  if (String(row.user_id) !== String(user.id) && !SUPERVISOR_ROLES.includes(user.role)) {
    return res.status(403).json({ error: "You can only change your own log entries" });
  }

  const editable = ['duty_type', 'duty_label', 'quantity', 'patient_id', 'hospital_number', 'patient_name', 'location', 'notes', 'log_date'];
  const sets = [], vals = [];
  for (const col of editable) {
    if (b[col] === undefined) continue;
    let v = b[col];
    if (col === 'quantity') v = Number.isFinite(+v) && +v > 0 ? Math.min(200, Math.trunc(+v)) : 1;
    if (col === 'log_date') v = String(v).slice(0, 10);
    vals.push(v);
    sets.push(`${col} = $${vals.length}`);
  }
  if (sets.length === 0) return res.status(400).json({ error: 'No changes provided' });
  vals.push(b.id);
  const r = await query(
    `UPDATE clinic_day_logs SET ${sets.join(', ')}, updated_at = CURRENT_TIMESTAMP
      WHERE id = $${vals.length} RETURNING *`,
    vals
  );
  return res.status(200).json({ log: r.rows[0] });
}

async function deleteLog(params, user, res) {
  const id = params.get('id');
  if (!id) return res.status(400).json({ error: 'id is required' });
  const found = await query(`SELECT user_id FROM clinic_day_logs WHERE id = $1`, [id]);
  if (found.rows.length === 0) return res.status(404).json({ error: 'Log entry not found' });
  if (String(found.rows[0].user_id) !== String(user.id) && !SUPERVISOR_ROLES.includes(user.role)) {
    return res.status(403).json({ error: 'You can only delete your own log entries' });
  }
  await query(`DELETE FROM clinic_day_logs WHERE id = $1`, [id]);
  return res.status(200).json({ success: true });
}
