// Duty reminders.
//
//   GET  ?action=preview&user_id=&kind=       -> one person's message
//   GET  ?action=queue[&date=][&status=]      -> what a run produced
//   GET  ?action=status                       -> unit date/weekday, delivery mode
//   POST ?action=run   { kind: weekly|daily } -> build and queue the day's messages
//   POST ?action=mark-sent { id }             -> record that one was sent
//
// Building is one press; SENDING IS MANUAL. A run prepares one message per
// person holding admitted patients and queues it with a wa.me link — nothing is
// transmitted from the server. Each message is then read and sent by a person
// from the Notice Board, and marked done. A reminder shown as "sent" always was.
import { query } from './_lib/db.js';
import { cors, authenticateRequest } from './_lib/auth.js';
import { buildRun, buildMessage, patientsFor, loadAdmittedAssignments, loadCareStaff, unitToday, unitWeekday }
  from './_lib/dutyReminder.js';
import { whatsAppLink } from './_lib/messaging.js';

const ADMIN_ROLES = ['admin', 'super_admin', 'consultant', 'senior_registrar'];
const KINDS = ['weekly', 'daily'];

let tableReady = false;
async function ensureTable() {
  if (tableReady) return;
  await query(`
    CREATE TABLE IF NOT EXISTS duty_reminders (
      id SERIAL PRIMARY KEY,
      reminder_date DATE NOT NULL,
      kind VARCHAR(20) NOT NULL,
      user_id VARCHAR(100) NOT NULL,
      user_name VARCHAR(255),
      user_role VARCHAR(60),
      phone VARCHAR(60),
      patient_count INTEGER DEFAULT 0,
      message TEXT NOT NULL,
      status VARCHAR(20) DEFAULT 'pending',
      provider VARCHAR(40),
      provider_id VARCHAR(120),
      error_message TEXT,
      whatsapp_link TEXT,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      sent_at TIMESTAMP,
      sent_by VARCHAR(100)
    )
  `);
  for (const s of [
    `CREATE INDEX IF NOT EXISTS idx_duty_reminders_date ON duty_reminders (reminder_date DESC)`,
    // One reminder per person per kind per day, so pressing Run twice cannot
    // produce two messages for the same house officer.
    `CREATE UNIQUE INDEX IF NOT EXISTS uq_duty_reminders_day
       ON duty_reminders (reminder_date, kind, user_id)`,
  ]) {
    try { await query(s); } catch (e) { console.warn('duty_reminders index skipped:', e.message); }
  }
  tableReady = true;
}

export default async function handler(req, res) {
  if (cors(req, res)) return;

  const url = new URL(req.url, `http://${req.headers.host}`);
  const params = url.searchParams;
  const action = params.get('action') || (req.body && req.body.action) || 'queue';

  const auth = authenticateRequest(req);
  if (!auth.authenticated) return res.status(auth.status || 401).json({ error: auth.error });
  const isAdmin = ADMIN_ROLES.includes(auth.user.role);

  try {
    await ensureTable();
    if (req.method === 'GET') {
      if (action === 'status') {
        return res.status(200).json({
          delivery: 'manual',
          unitDate: unitToday(),
          unitWeekday: unitWeekday(),
        });
      }
      if (action === 'preview') return await preview(params, res);
      return await listQueue(params, res);
    }
    if (req.method === 'POST') {
      if (!isAdmin) return res.status(403).json({ error: 'Only senior staff can run duty reminders' });
      if (action === 'run') return await run(req.body, auth.user, res);
      if (action === 'mark-sent') return await markSent(req.body, auth.user, res);
      return res.status(400).json({ error: 'Unknown action' });
    }
    return res.status(405).json({ error: 'Method not allowed' });
  } catch (e) {
    console.error('duty-reminders error:', e);
    return res.status(500).json({ error: 'Internal server error', message: e.message });
  }
}

const parseBody = (b) => (typeof b === 'string' ? JSON.parse(b || '{}') : (b || {}));

async function preview(params, res) {
  const userId = params.get('user_id');
  if (!userId) return res.status(400).json({ error: 'user_id is required' });
  const kind = KINDS.includes(params.get('kind')) ? params.get('kind') : 'weekly';

  const [assignments, staff] = await Promise.all([loadAdmittedAssignments(), loadCareStaff()]);
  const person = staff.find(s => String(s.id) === String(userId));
  if (!person) {
    return res.status(404).json({ error: 'That staff member is not an active member of the care team' });
  }
  const patients = patientsFor(person.id, assignments);
  return res.status(200).json({
    staff: { id: person.id, full_name: person.full_name, role: person.role, grade: person.grade, phone: person.phone },
    patientCount: patients.length,
    patients,
    message: buildMessage({ staff: person, patients, kind }),
    whatsappLink: whatsAppLink(person.phone, buildMessage({ staff: person, patients, kind })),
  });
}

async function listQueue(params, res) {
  const where = [];
  const vals = [];
  const add = (sql, v) => { vals.push(v); where.push(sql.replace('?', `$${vals.length}`)); };
  add('reminder_date = ?', (params.get('date') || unitToday()).slice(0, 10));
  if (params.get('status')) add('status = ?', params.get('status'));
  if (params.get('kind')) add('kind = ?', params.get('kind'));
  const r = await query(
    `SELECT * FROM duty_reminders WHERE ${where.join(' AND ')} ORDER BY status, user_name`, vals
  );
  return res.status(200).json({
    date: (params.get('date') || unitToday()).slice(0, 10),
    reminders: r.rows,
  });
}

async function run(body, user, res) {
  const b = parseBody(body);
  const kind = KINDS.includes(b.kind) ? b.kind : 'weekly';
  const today = unitToday();

  const built = await buildRun({ kind });
  const results = { date: today, kind, built: built.length, created: 0, pending: 0, noPhone: 0, duplicate: 0 };

  for (const item of built) {
    // Prepared, never transmitted. The link is what a person taps to send.
    const link = whatsAppLink(item.staff.phone, item.message);
    if (!link) results.noPhone++;

    const inserted = await query(
      `INSERT INTO duty_reminders
         (reminder_date, kind, user_id, user_name, user_role, phone, patient_count,
          message, status, error_message, whatsapp_link)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,'pending',$9,$10)
       ON CONFLICT (reminder_date, kind, user_id) DO NOTHING
       RETURNING id`,
      [today, kind, String(item.staff.id), item.staff.full_name, item.staff.role, item.staff.phone || null,
       item.patientCount, item.message, link ? null : 'No phone number on file', link]
    );

    if (inserted.rows.length === 0) { results.duplicate++; continue; }
    results.created++;
    results.pending++;
  }

  return res.status(200).json({
    ...results,
    delivery: 'manual',
    note: 'Reminders are queued with WhatsApp links. Nothing has been sent — press Send on each one.',
  });
}

async function markSent(body, user, res) {
  const b = parseBody(body);
  if (!b.id) return res.status(400).json({ error: 'id is required' });
  const r = await query(
    `UPDATE duty_reminders
        SET status = 'sent', sent_at = CURRENT_TIMESTAMP, sent_by = $1, provider = COALESCE(provider, 'manual')
      WHERE id = $2 RETURNING *`,
    [String(user.id), b.id]
  );
  if (r.rows.length === 0) return res.status(404).json({ error: 'Reminder not found' });
  return res.status(200).json({ reminder: r.rows[0] });
}
