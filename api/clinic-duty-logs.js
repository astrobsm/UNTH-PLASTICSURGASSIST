// Clinic Duty Logs per-item API endpoint for Vercel serverless
// Mirrors the offlineManager queue replay contract:
//   POST   /api/clinic-duty-logs          -> create one row
//   PUT    /api/clinic-duty-logs/:id      -> update one row
//   DELETE /api/clinic-duty-logs/:id      -> delete one row
//   GET    /api/clinic-duty-logs[?userId=][&since=] -> list (bulk pull is /api/sync/clinic-duty-logs)
//
// NOTE: clients also bulk-sync the same data via /api/sync/clinic-duty-logs.
// To prevent retry storms when local_id (Dexie autoinc) does not match the server id,
// PUT/DELETE are tolerant: missing rows return 200 so the offline queue can drain.

import { query } from './_lib/db.js';
import { cors, authenticateRequest } from './_lib/auth.js';

let tableEnsured = false;
async function ensureTable() {
  if (tableEnsured) return;
  await query(`
    CREATE TABLE IF NOT EXISTS clinic_duty_logs (
      id SERIAL PRIMARY KEY,
      user_id TEXT NOT NULL,
      user_name TEXT,
      user_role TEXT,
      duty_type TEXT,
      duty_category TEXT,
      patient_id TEXT,
      patient_name TEXT,
      hospital_number TEXT,
      description TEXT,
      notes TEXT,
      status TEXT DEFAULT 'assigned',
      assigned_date TEXT,
      completed_date TEXT,
      duration_minutes INTEGER,
      week_number INTEGER,
      year INTEGER,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
    CREATE INDEX IF NOT EXISTS idx_clinic_duty_user ON clinic_duty_logs(user_id);
    CREATE INDEX IF NOT EXISTS idx_clinic_duty_date ON clinic_duty_logs(assigned_date);
  `);
  tableEnsured = true;
}

export default async function handler(req, res) {
  if (cors(req, res)) return;

  const auth = authenticateRequest(req);
  if (!auth.authenticated) {
    return res.status(401).json({ error: auth.error });
  }

  const { method } = req;
  const url = new URL(req.url, `http://${req.headers.host}`);
  const pathParts = url.pathname.replace('/api/clinic-duty-logs', '').split('/').filter(Boolean);
  const rawId = pathParts[0];
  const idNum = rawId ? parseInt(rawId, 10) : null;

  try {
    await ensureTable();

    switch (method) {
      case 'GET':
        if (idNum) return await getOne(idNum, res);
        return await getAll(url.searchParams, res);
      case 'POST':
        return await createLog(req.body || {}, auth.user, res);
      case 'PUT':
      case 'PATCH':
        if (!idNum) return res.status(400).json({ error: 'id required' });
        return await updateLog(idNum, req.body || {}, res);
      case 'DELETE':
        if (!idNum) return res.status(400).json({ error: 'id required' });
        return await deleteLog(idNum, res);
      default:
        return res.status(405).json({ error: 'Method not allowed' });
    }
  } catch (error) {
    console.error('Clinic Duty Logs API error:', error);
    return res.status(500).json({ error: 'Internal server error', detail: error?.message || String(error) });
  }
}

async function getAll(searchParams, res) {
  const userId = searchParams.get('userId');
  const since = searchParams.get('since');
  let sql = `SELECT * FROM clinic_duty_logs WHERE 1=1`;
  const params = [];
  let i = 1;
  if (userId) { sql += ` AND user_id = $${i++}`; params.push(String(userId)); }
  if (since)  { sql += ` AND updated_at > $${i++}`; params.push(new Date(since)); }
  sql += ` ORDER BY created_at DESC LIMIT 1000`;
  const result = await query(sql, params);
  res.status(200).json({ logs: result.rows });
}

async function getOne(id, res) {
  const result = await query('SELECT * FROM clinic_duty_logs WHERE id = $1', [id]);
  if (result.rows.length === 0) return res.status(404).json({ error: 'Not found' });
  res.status(200).json({ log: result.rows[0] });
}

async function createLog(body, user, res) {
  const {
    user_id, user_name, user_role,
    duty_type, duty_category,
    patient_id, patient_name, hospital_number,
    description, notes, status,
    assigned_date, completed_date,
    duration_minutes, week_number, year,
  } = body;

  const resolvedUserId = user_id || (user && (user.id || user.user_id)) || null;
  if (!resolvedUserId) {
    return res.status(400).json({ error: 'user_id is required' });
  }

  const result = await query(
    `INSERT INTO clinic_duty_logs
       (user_id, user_name, user_role, duty_type, duty_category,
        patient_id, patient_name, hospital_number,
        description, notes, status,
        assigned_date, completed_date,
        duration_minutes, week_number, year)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16)
     RETURNING *`,
    [
      String(resolvedUserId),
      user_name || (user && user.full_name) || null,
      user_role || (user && user.role) || null,
      duty_type || null,
      duty_category || null,
      patient_id != null ? String(patient_id) : null,
      patient_name || null,
      hospital_number || null,
      description || null,
      notes || null,
      status || 'assigned',
      assigned_date || null,
      completed_date || null,
      duration_minutes != null ? parseInt(duration_minutes, 10) : null,
      week_number != null ? parseInt(week_number, 10) : null,
      year != null ? parseInt(year, 10) : null,
    ]
  );
  res.status(201).json({ log: result.rows[0] });
}

async function updateLog(id, body, res) {
  const {
    user_name, user_role,
    duty_type, duty_category,
    patient_id, patient_name, hospital_number,
    description, notes, status,
    assigned_date, completed_date,
    duration_minutes, week_number, year,
  } = body;

  const result = await query(
    `UPDATE clinic_duty_logs SET
        user_name        = COALESCE($1, user_name),
        user_role        = COALESCE($2, user_role),
        duty_type        = COALESCE($3, duty_type),
        duty_category    = COALESCE($4, duty_category),
        patient_id       = COALESCE($5, patient_id),
        patient_name     = COALESCE($6, patient_name),
        hospital_number  = COALESCE($7, hospital_number),
        description      = COALESCE($8, description),
        notes            = COALESCE($9, notes),
        status           = COALESCE($10, status),
        assigned_date    = COALESCE($11, assigned_date),
        completed_date   = COALESCE($12, completed_date),
        duration_minutes = COALESCE($13, duration_minutes),
        week_number      = COALESCE($14, week_number),
        year             = COALESCE($15, year),
        updated_at       = CURRENT_TIMESTAMP
      WHERE id = $16
      RETURNING *`,
    [
      user_name || null,
      user_role || null,
      duty_type || null,
      duty_category || null,
      patient_id != null ? String(patient_id) : null,
      patient_name || null,
      hospital_number || null,
      description || null,
      notes || null,
      status || null,
      assigned_date || null,
      completed_date || null,
      duration_minutes != null ? parseInt(duration_minutes, 10) : null,
      week_number != null ? parseInt(week_number, 10) : null,
      year != null ? parseInt(year, 10) : null,
      id,
    ]
  );

  // Tolerant: if local_id doesn't match a server row (common because Dexie
  // autoinc != server SERIAL), return success so the offline queue drains.
  // The bulk /sync/clinic-duty-logs path is the canonical reconciliation.
  if (result.rows.length === 0) {
    return res.status(200).json({ log: null, skipped: true, reason: 'no matching row' });
  }
  res.status(200).json({ log: result.rows[0] });
}

async function deleteLog(id, res) {
  const result = await query('DELETE FROM clinic_duty_logs WHERE id = $1 RETURNING id', [id]);
  if (result.rows.length === 0) {
    return res.status(200).json({ success: true, skipped: true, reason: 'no matching row' });
  }
  res.status(200).json({ success: true, id: result.rows[0].id });
}
