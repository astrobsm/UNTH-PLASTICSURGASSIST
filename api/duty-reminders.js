// Duty reminders — scheduled and on demand.
//
//   GET  ?action=preview&user_id=&kind=       -> one person's message (no send)
//   GET  ?action=queue[&date=][&status=]      -> what a run produced
//   GET  ?action=status                       -> can this deployment deliver?
//   POST ?action=run   { kind: weekly|daily } -> build, record, attempt delivery
//   POST ?action=mark-sent { id }             -> record a hand-sent message
//
// The run route is what Vercel Cron hits (see vercel.json). It authorises EITHER
// an admin token OR the CRON_SECRET bearer Vercel attaches to scheduled calls.
//
// Delivery is best-effort by design: with no messaging provider configured the
// reminders are still built and stored with status 'pending' and a wa.me link,
// so an admin can send them in one tap from the Notice Board. Nothing here ever
// reports a message as sent when it was not.
import { query } from './_lib/db.js';
import { cors, authenticateRequest } from './_lib/auth.js';
import { buildRun, buildMessage, patientsFor, loadAdmittedAssignments, loadCareStaff, unitToday, unitWeekday }
  from './_lib/dutyReminder.js';
import { sendWhatsApp, whatsAppLink, canDeliver, activeProvider } from './_lib/messaging.js';

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
    // One reminder per person per kind per day: a cron that fires twice (retry,
    // redeploy) must not message the same house officer twice.
    `CREATE UNIQUE INDEX IF NOT EXISTS uq_duty_reminders_day
       ON duty_reminders (reminder_date, kind, user_id)`,
  ]) {
    try { await query(s); } catch (e) { console.warn('duty_reminders index skipped:', e.message); }
  }
  tableReady = true;
}

/** Vercel Cron sends `Authorization: Bearer $CRON_SECRET` when that env is set. */
function isCronCall(req) {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  const header = req.headers.authorization || '';
  return header === `Bearer ${secret}`;
}

export default async function handler(req, res) {
  if (cors(req, res)) return;

  const url = new URL(req.url, `http://${req.headers.host}`);
  const params = url.searchParams;
  const action = params.get('action') || (req.body && req.body.action) || 'queue';

  const cron = isCronCall(req);
  const auth = cron ? { authenticated: true, user: { id: 'cron', role: 'admin', fullName: 'Scheduled run' } }
                    : authenticateRequest(req);
  if (!auth.authenticated) return res.status(auth.status || 401).json({ error: auth.error });
  const isAdmin = cron || ADMIN_ROLES.includes(auth.user.role);

  try {
    await ensureTable();
    if (req.method === 'GET') {
      // Vercel Cron invokes scheduled paths with GET, so the run action has to
      // be reachable that way. Gated on the cron secret or a senior-staff token
      // — never open, precisely because it has side effects.
      if (action === 'run') {
        if (!isAdmin) return res.status(403).json({ error: 'Only senior staff can run duty reminders' });
        return await run({ kind: params.get('kind') }, auth.user, cron, res);
      }
      if (action === 'status') {
        return res.status(200).json({
          provider: activeProvider(),
          canDeliver: canDeliver(),
          cronConfigured: !!process.env.CRON_SECRET,
          unitDate: unitToday(),
          unitWeekday: unitWeekday(),
        });
      }
      if (action === 'preview') return await preview(params, res);
      return await listQueue(params, res);
    }
    if (req.method === 'POST') {
      if (!isAdmin) return res.status(403).json({ error: 'Only senior staff can run duty reminders' });
      if (action === 'run') return await run(req.body, auth.user, cron, res);
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
    canDeliver: canDeliver(),
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
    canDeliver: canDeliver(),
    provider: activeProvider(),
  });
}

async function run(body, user, isCron, res) {
  const b = parseBody(body);
  const kind = KINDS.includes(b.kind) ? b.kind : 'weekly';
  const today = unitToday();
  const weekday = unitWeekday();

  // The cron fires daily; the weekly reminder only belongs on Monday and Friday.
  // A human pressing "Run now" is trusted to mean it.
  if (isCron && kind === 'weekly' && ![1, 5].includes(weekday)) {
    return res.status(200).json({
      skipped: true, reason: 'Weekly reminders go out on Monday and Friday only', weekday, date: today,
    });
  }

  const built = await buildRun({ kind });
  const results = { date: today, kind, built: built.length, created: 0, delivered: 0, pending: 0, failed: 0, duplicate: 0 };

  for (const item of built) {
    const send = await sendWhatsApp({ toPhone: item.staff.phone, message: item.message });
    const status = send.delivered ? 'sent' : (send.error ? 'failed' : 'pending');

    const inserted = await query(
      `INSERT INTO duty_reminders
         (reminder_date, kind, user_id, user_name, user_role, phone, patient_count,
          message, status, provider, provider_id, error_message, whatsapp_link, sent_at, sent_by)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15)
       ON CONFLICT (reminder_date, kind, user_id) DO NOTHING
       RETURNING id`,
      [today, kind, String(item.staff.id), item.staff.full_name, item.staff.role, item.staff.phone || null,
       item.patientCount, item.message, status, send.provider || null, send.providerId || null,
       send.error || null, send.link || null,
       send.delivered ? new Date() : null, send.delivered ? (isCron ? 'cron' : String(user.id)) : null]
    );

    if (inserted.rows.length === 0) { results.duplicate++; continue; }
    results.created++;
    if (status === 'sent') results.delivered++;
    else if (status === 'failed') results.failed++;
    else results.pending++;
  }

  return res.status(200).json({
    ...results,
    canDeliver: canDeliver(),
    provider: activeProvider(),
    note: canDeliver()
      ? undefined
      : 'No messaging provider is configured, so nothing was delivered. The reminders are queued with WhatsApp links for sending by hand.',
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
