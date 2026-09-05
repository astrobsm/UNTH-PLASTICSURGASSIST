// ============================================================================
// Profile creation from a shared link.
//
// One public endpoint for everyone who joins the unit: clinical students,
// house officers, registrars, senior registrars and consultants. Whoever holds
// the link creates their own profile and says how long their rotation runs,
// instead of an administrator keying in every arrival.
//
// Two things follow from the role chosen:
//
//   access    the role decides what the app opens up, exactly as it does for
//             an account made by an administrator. Nothing here grants more
//             than the role would otherwise carry.
//
//   rotation  every role except consultant is on a rotation, so a rotation is
//             opened with the dates given. A consultant supervises rather than
//             rotates and gets none.
//
// A profile still needs approving before it can sign in. The link lets somebody
// enrol themselves; it does not let them admit themselves.
// ============================================================================

import bcrypt from 'bcryptjs';
import { query } from '../_lib/db.js';
import { cors } from '../_lib/auth.js';
import { startRotation, DEFAULT_ROTATION_DAYS } from '../_lib/rotationLifecycle.js';

/** The roles this link can create, and how each behaves. */
export const JOINABLE_ROLES = {
  student:          { label: 'Medical Student',  rotates: true,  table: 'students', defaultDays: 56 },
  house_officer:    { label: 'House Officer',    rotates: true,  table: 'users',    defaultDays: DEFAULT_ROTATION_DAYS.house_officer },
  junior_registrar: { label: 'Junior Registrar', rotates: true,  table: 'users',    defaultDays: DEFAULT_ROTATION_DAYS.junior_registrar },
  registrar:        { label: 'Registrar',        rotates: true,  table: 'users',    defaultDays: DEFAULT_ROTATION_DAYS.registrar },
  senior_registrar: { label: 'Senior Registrar', rotates: true,  table: 'users',    defaultDays: DEFAULT_ROTATION_DAYS.senior_registrar },
  consultant:       { label: 'Consultant',       rotates: false, table: 'users',    defaultDays: null },
};

const MIN_PASSWORD = 8;

export default async function handler(req, res) {
  if (cors(req, res)) return;

  if (req.method === 'GET') {
    // The form asks what it may offer, rather than hard-coding the list.
    return res.status(200).json({
      roles: Object.entries(JOINABLE_ROLES).map(([value, r]) => ({
        value, label: r.label, rotates: r.rotates, defaultDays: r.defaultDays,
      })),
      minPasswordLength: MIN_PASSWORD,
    });
  }

  if (req.method !== 'POST') {
    res.setHeader('Allow', ['GET', 'POST']);
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    return await createProfile(req, res);
  } catch (error) {
    console.error('join error:', error);
    return res.status(500).json({ error: 'Internal server error', message: error.message });
  }
}

// ---------------------------------------------------------------------------

async function createProfile(req, res) {
  const {
    role, fullName, email, password, phone,
    university, matricNumber,
    rotationStart, rotationDays,
  } = req.body || {};

  const spec = JOINABLE_ROLES[role];
  if (!spec) {
    return res.status(400).json({ error: 'Choose one of the listed roles' });
  }

  const name = String(fullName || '').trim();
  const mail = String(email || '').trim().toLowerCase();
  if (!name || !mail || !password) {
    return res.status(400).json({ error: 'Name, email and password are all required' });
  }
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(mail)) {
    return res.status(400).json({ error: 'That email address does not look right' });
  }
  if (String(password).length < MIN_PASSWORD) {
    return res.status(400).json({ error: `Password must be at least ${MIN_PASSWORD} characters` });
  }

  // Rotation dates, for everyone who rotates.
  let start = null;
  let days = null;
  if (spec.rotates) {
    start = String(rotationStart || '').trim() || new Date().toISOString().slice(0, 10);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(start)) {
      return res.status(400).json({ error: 'Give the rotation start as a date' });
    }
    days = Number(rotationDays) > 0 ? Math.round(Number(rotationDays)) : spec.defaultDays;
    if (!days || days < 7 || days > 366 * 3) {
      return res.status(400).json({ error: 'Rotation length must be between 7 days and 3 years' });
    }
  }

  const passwordHash = await bcrypt.hash(String(password), 10);

  return spec.table === 'students'
    ? await createStudent(res, { name, mail, passwordHash, university, matricNumber, start, days })
    : await createStaff(res, { role, name, mail, passwordHash, phone, start, days, rotates: spec.rotates });
}

/** A clinical student, with their posting dates. */
async function createStudent(res, { name, mail, passwordHash, university, matricNumber, start, days }) {
  const existing = await query('SELECT id FROM students WHERE email = $1', [mail]);
  if (existing.rows.length) {
    return res.status(409).json({ error: 'That email is already registered' });
  }

  const end = new Date(new Date(start).getTime() + days * 86400000).toISOString().slice(0, 10);

  const r = await query(
    `INSERT INTO students (full_name, email, password_hash, university, matric_number,
                           posting_start, posting_end, is_approved, is_active)
     VALUES ($1, $2, $3, $4, $5, $6, $7, FALSE, TRUE)
     RETURNING id, full_name, email, posting_start, posting_end`,
    [name, mail, passwordHash, university || null, matricNumber || null, start, end],
  );

  return res.status(201).json({
    created: true,
    kind: 'student',
    profile: r.rows[0],
    approved: false,
    message: 'Profile created. An administrator will approve it before you can sign in.',
  });
}

/** A doctor, with a rotation unless they are a consultant. */
async function createStaff(res, { role, name, mail, passwordHash, phone, start, days, rotates }) {
  // app_id separates this app's accounts from others sharing the database; it
  // is not present on every deployment, hence the fallback.
  let existing;
  try {
    existing = await query(
      "SELECT id FROM users WHERE email = $1 AND (app_id = 'psa' OR app_id IS NULL)", [mail]);
  } catch {
    existing = await query('SELECT id FROM users WHERE email = $1', [mail]);
  }
  if (existing.rows.length) {
    return res.status(409).json({ error: 'That email is already registered' });
  }

  // Built against the columns this deployment actually has: the production
  // users table uses password_hash and carries username, training_level and
  // app_id, while older schemas have none of them.
  const present = new Set((await query(
    `SELECT column_name FROM information_schema.columns
     WHERE table_schema = 'public' AND table_name = 'users'`)).rows.map((r) => r.column_name));

  const values = { full_name: name, email: mail, role, is_approved: false, is_active: true };
  if (present.has('password_hash')) values.password_hash = passwordHash;
  else values.password = passwordHash;
  if (present.has('username')) values.username = mail.split('@')[0];
  if (present.has('phone') && phone) values.phone = String(phone).trim();
  if (present.has('app_id')) values.app_id = 'psa';
  // training_level mirrors the role rather than defaulting to house_officer,
  // which is what every existing account carries and why a senior registrar
  // was being shown the house officer curriculum.
  if (present.has('training_level')) values.training_level = role;
  if (present.has('must_change_password')) values.must_change_password = false;

  const cols = Object.keys(values).filter((c) => present.has(c) || c === 'password_hash' || c === 'password');
  const r = await query(
    `INSERT INTO users (${cols.map((c) => `"${c}"`).join(', ')})
     VALUES (${cols.map((_, i) => `$${i + 1}`).join(', ')})
     RETURNING id, full_name, email, role`,
    cols.map((c) => values[c]),
  );
  const user = r.rows[0];

  let rotation = null;
  if (rotates) {
    const started = await startRotation({ userId: user.id, level: role, days, startDate: start });
    rotation = started.rotation || null;
  }

  return res.status(201).json({
    created: true,
    kind: 'staff',
    profile: user,
    rotation: rotation && {
      start_date: rotation.start_date,
      expected_end_date: rotation.expected_end_date,
      level: rotation.level,
    },
    approved: false,
    message: rotates
      ? 'Profile and rotation created. An administrator will approve it before you can sign in.'
      : 'Profile created. An administrator will approve it before you can sign in.',
  });
}
