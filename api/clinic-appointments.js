// Clinic Appointments API endpoint for Vercel serverless
// ----------------------------------------------------------------------------
// Phase 1 redesign: configurable consulting stations per weekday (from Settings),
// patient categories (duration / priority / colour), and a scheduling engine with
// conflict detection, doctor-unavailability, holidays, and waiting-time tracking.
//
// Backwards compatible: the public patient-facing endpoints (clinic-dates,
// available-slots, book) keep their original response shape. When no clinic_config
// row exists yet the API falls back to the built-in default configuration.
import { query } from './_lib/db.js';
import { cors, authenticateRequest } from './_lib/auth.js';

let tableEnsured = false;

// ── Default configuration (used until an admin saves one in Settings) ───────
const DEFAULT_CONFIG = {
  slotMinutes: 20,
  holidays: [],
  days: {
    '0': { enabled: false, stations: 0, doctors: [], sessions: [] },
    '1': { enabled: false, stations: 0, doctors: [], sessions: [] },
    '2': {
      enabled: true, stations: 3,
      doctors: ['Dr. Nnadi', 'Dr. Onyia', 'Dr. Okwesili'],
      sessions: [
        { label: 'Morning Session', start: '09:00', end: '13:30' },
        { label: 'Afternoon Session', start: '14:00', end: '16:00' },
      ],
    },
    '3': {
      enabled: true, stations: 1,
      doctors: ['Dr. Eze'],
      sessions: [{ label: 'Clinic Session', start: '10:00', end: '16:00' }],
    },
    '4': { enabled: false, stations: 0, doctors: [], sessions: [] },
    '5': { enabled: false, stations: 0, doctors: [], sessions: [] },
    '6': { enabled: false, stations: 0, doctors: [], sessions: [] },
  },
};

const DEFAULT_CATEGORIES = [
  { name: 'New Patient',              duration_minutes: 30, priority: 2, color: '#2563EB', sort_order: 1 },
  { name: 'Wound Care Follow-up',     duration_minutes: 20, priority: 1, color: '#DC2626', sort_order: 2 },
  { name: 'Non-Wound Consultation',   duration_minutes: 20, priority: 3, color: '#0E9F6E', sort_order: 3 },
  { name: 'Post-operative Follow-up', duration_minutes: 20, priority: 2, color: '#7C3AED', sort_order: 4 },
  { name: 'Surgery Scheduling',       duration_minutes: 30, priority: 1, color: '#EA580C', sort_order: 5 },
];

const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

async function ensureTable() {
  if (tableEnsured) return;
  // Base appointments table
  try {
    await query(`
      CREATE TABLE IF NOT EXISTS clinic_appointments (
        id SERIAL PRIMARY KEY,
        patient_number VARCHAR(100) NOT NULL,
        patient_name VARCHAR(255),
        phone_number VARCHAR(20),
        appointment_date DATE NOT NULL,
        time_slot VARCHAR(20) NOT NULL,
        doctor_assigned VARCHAR(255) NOT NULL,
        status VARCHAR(50) DEFAULT 'booked',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(appointment_date, time_slot, doctor_assigned)
      )
    `);
  } catch (e) { console.warn('ensureTable CREATE:', e.message); }

  // Best-effort indices + new columns (resilient to schema drift)
  const stmts = [
    `CREATE INDEX IF NOT EXISTS idx_clinic_appt_date ON clinic_appointments(appointment_date)`,
    `CREATE INDEX IF NOT EXISTS idx_clinic_appt_doctor ON clinic_appointments(doctor_assigned)`,
    `CREATE INDEX IF NOT EXISTS idx_clinic_appt_patient ON clinic_appointments(patient_number)`,
    `ALTER TABLE clinic_appointments ADD COLUMN IF NOT EXISTS patient_name VARCHAR(255)`,
    `ALTER TABLE clinic_appointments ADD COLUMN IF NOT EXISTS phone_number VARCHAR(20)`,
    `ALTER TABLE clinic_appointments ADD COLUMN IF NOT EXISTS station_number INTEGER`,
    `ALTER TABLE clinic_appointments ADD COLUMN IF NOT EXISTS category VARCHAR(80)`,
    `ALTER TABLE clinic_appointments ADD COLUMN IF NOT EXISTS priority INTEGER DEFAULT 3`,
    `ALTER TABLE clinic_appointments ADD COLUMN IF NOT EXISTS checked_in_at TIMESTAMPTZ`,
    `ALTER TABLE clinic_appointments ADD COLUMN IF NOT EXISTS started_at TIMESTAMPTZ`,
    `ALTER TABLE clinic_appointments ADD COLUMN IF NOT EXISTS completed_at TIMESTAMPTZ`,
    `CREATE INDEX IF NOT EXISTS idx_clinic_appt_station ON clinic_appointments(appointment_date, station_number)`,
    `CREATE TABLE IF NOT EXISTS clinic_config (
        id INTEGER PRIMARY KEY DEFAULT 1,
        config JSONB NOT NULL,
        updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
        updated_by VARCHAR(180),
        CONSTRAINT clinic_config_single_row CHECK (id = 1)
     )`,
    `CREATE TABLE IF NOT EXISTS clinic_categories (
        id SERIAL PRIMARY KEY,
        name VARCHAR(80) UNIQUE NOT NULL,
        duration_minutes INTEGER DEFAULT 20,
        priority INTEGER DEFAULT 3,
        color VARCHAR(20) DEFAULT '#0E9F6E',
        is_active BOOLEAN DEFAULT TRUE,
        sort_order INTEGER DEFAULT 0,
        created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
     )`,
    `CREATE TABLE IF NOT EXISTS doctor_unavailability (
        id SERIAL PRIMARY KEY,
        doctor_name VARCHAR(120) NOT NULL,
        unavailable_date DATE NOT NULL,
        reason VARCHAR(200),
        created_by VARCHAR(180),
        created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(doctor_name, unavailable_date)
     )`,
    `CREATE INDEX IF NOT EXISTS idx_doctor_unavail_date ON doctor_unavailability(unavailable_date)`,
  ];
  for (const s of stmts) { try { await query(s); } catch (e) { console.warn('ensureTable stmt skipped:', e.message); } }

  // Seed default categories if empty
  try {
    const c = await query(`SELECT COUNT(*)::int AS n FROM clinic_categories`);
    if (c.rows[0].n === 0) {
      for (const cat of DEFAULT_CATEGORIES) {
        await query(
          `INSERT INTO clinic_categories (name, duration_minutes, priority, color, sort_order)
           VALUES ($1,$2,$3,$4,$5) ON CONFLICT (name) DO NOTHING`,
          [cat.name, cat.duration_minutes, cat.priority, cat.color, cat.sort_order]
        );
      }
    }
  } catch (e) { console.warn('seed categories skipped:', e.message); }

  // Seed default config if missing
  try {
    const cfg = await query(`SELECT 1 FROM clinic_config WHERE id = 1`);
    if (cfg.rows.length === 0) {
      await query(`INSERT INTO clinic_config (id, config) VALUES (1, $1) ON CONFLICT (id) DO NOTHING`,
        [JSON.stringify(DEFAULT_CONFIG)]);
    }
  } catch (e) { console.warn('seed config skipped:', e.message); }

  tableEnsured = true;
}

// ── Config helpers ──────────────────────────────────────────────────────────
async function loadConfig() {
  try {
    const r = await query(`SELECT config FROM clinic_config WHERE id = 1`);
    if (r.rows.length && r.rows[0].config) {
      const cfg = typeof r.rows[0].config === 'string' ? JSON.parse(r.rows[0].config) : r.rows[0].config;
      return normalizeConfig(cfg);
    }
  } catch (e) { console.warn('loadConfig fallback to default:', e.message); }
  return DEFAULT_CONFIG;
}

function normalizeConfig(cfg) {
  const out = { slotMinutes: cfg.slotMinutes || 20, holidays: Array.isArray(cfg.holidays) ? cfg.holidays : [], days: {} };
  for (let dow = 0; dow <= 6; dow++) {
    const d = (cfg.days && cfg.days[String(dow)]) || DEFAULT_CONFIG.days[String(dow)];
    out.days[String(dow)] = {
      enabled: !!d.enabled,
      stations: Number(d.stations) || (d.doctors ? d.doctors.length : 0),
      doctors: Array.isArray(d.doctors) ? d.doctors : [],
      sessions: Array.isArray(d.sessions) ? d.sessions : [],
      slotMinutes: d.slotMinutes ? Number(d.slotMinutes) : undefined,
    };
  }
  return out;
}

function dayConfigFor(config, dow) { return config.days[String(dow)] || DEFAULT_CONFIG.days[String(dow)]; }

function isHoliday(config, dateStr) {
  return Array.isArray(config.holidays) && config.holidays.includes(dateStr);
}

// Generate uniform grid slots for a day from its sessions.
function generateTimeSlots(config, dow) {
  const day = dayConfigFor(config, dow);
  const slotDuration = day.slotMinutes || config.slotMinutes || 20;
  const slots = [];
  for (const session of (day.sessions || [])) {
    const [startHour, startMin] = session.start.split(':').map(Number);
    const [endHour, endMin] = session.end.split(':').map(Number);
    const endTotalMin = endHour * 60 + endMin;
    let currentMin = startHour * 60 + startMin;
    while (currentMin + slotDuration <= endTotalMin) {
      const slotEnd = currentMin + slotDuration;
      const sH = String(Math.floor(currentMin / 60)).padStart(2, '0');
      const sM = String(currentMin % 60).padStart(2, '0');
      const eH = String(Math.floor(slotEnd / 60)).padStart(2, '0');
      const eM = String(slotEnd % 60).padStart(2, '0');
      slots.push(`${sH}:${sM}-${eH}:${eM}`);
      currentMin = slotEnd;
    }
  }
  return slots;
}

function scheduleLabelFor(day) {
  return (day.sessions || [])
    .map(s => `${fmt12(s.start)} – ${fmt12(s.end)}`)
    .join(', ');
}
function fmt12(t) {
  const [h, m] = t.split(':').map(Number);
  const suffix = h >= 12 ? 'PM' : 'AM';
  const h12 = h > 12 ? h - 12 : h === 0 ? 12 : h;
  return `${h12}:${String(m).padStart(2, '0')} ${suffix}`;
}

// Upcoming clinic dates (next 4 weeks) for every enabled day.
function getUpcomingClinicDates(config) {
  const dates = [];
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  for (let i = 0; i < 28; i++) {
    const d = new Date(today);
    d.setDate(today.getDate() + i);
    const dow = d.getDay();
    const day = dayConfigFor(config, dow);
    if (!day.enabled || !(day.sessions || []).length) continue;
    const dateStr = d.toISOString().split('T')[0];
    if (isHoliday(config, dateStr)) continue;
    // Skip today if the clinic day is already over
    if (i === 0) {
      const now = new Date();
      const last = day.sessions[day.sessions.length - 1];
      const [endH] = last.end.split(':').map(Number);
      if (now.getHours() >= endH) continue;
    }
    dates.push({
      date: dateStr,
      dayName: DAY_NAMES[dow],
      dayOfWeek: dow,
      stations: day.stations,
      doctors: day.doctors,
      schedule: day.sessions,
      scheduleLabel: scheduleLabelFor(day),
    });
  }
  return dates;
}

export default async function handler(req, res) {
  if (cors(req, res)) return;

  const { method } = req;
  let action, searchParams;
  try {
    const parsedUrl = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
    const pathParts = parsedUrl.pathname.replace('/api/clinic-appointments', '').split('/').filter(Boolean);
    action = pathParts[0] || req.query?.action;
    searchParams = parsedUrl.searchParams;
  } catch {
    action = req.query?.action;
    searchParams = { get: (k) => req.query?.[k] };
  }

  try {
    await ensureTable();
    const config = await loadConfig();

    // ── PUBLIC endpoints (no auth) ──
    if (method === 'GET' && action === 'clinic-dates') {
      return res.status(200).json({ dates: getUpcomingClinicDates(config) });
    }
    if (method === 'GET' && action === 'available-slots') {
      return await getAvailableSlots(searchParams, config, res);
    }
    if (method === 'GET' && action === 'categories') {
      return await getCategories(res);
    }
    if (method === 'POST' && action === 'book') {
      return await bookAppointment(req.body, config, res);
    }

    // ── PROTECTED endpoints (auth required) ──
    const auth = authenticateRequest(req);
    if (!auth.authenticated) {
      return res.status(401).json({ error: auth.error });
    }

    // Configuration management (admin)
    if (action === 'config') {
      if (method === 'GET') return res.status(200).json({ config });
      if (method === 'POST' || method === 'PUT') return await saveConfig(req.body, auth.user, res);
    }
    if (action === 'categories') {
      if (method === 'POST') return await createCategory(req.body, res);
      if (method === 'PATCH' || method === 'PUT') return await updateCategory(req.body, res);
      if (method === 'DELETE') return await deleteCategory(searchParams.get('id'), res);
    }
    if (action === 'unavailability') {
      if (method === 'GET') return await getUnavailability(searchParams, res);
      if (method === 'POST') return await addUnavailability(req.body, auth.user, res);
      if (method === 'DELETE') return await removeUnavailability(searchParams.get('id'), res);
    }
    if (action === 'queue-stats' && method === 'GET') {
      return await getQueueStats(searchParams, config, res);
    }

    switch (method) {
      case 'GET':
        return await getAllAppointments(searchParams, auth.user, res);
      case 'PUT':
      case 'PATCH':
        if (!action) return res.status(400).json({ error: 'Appointment ID required' });
        return await updateAppointment(action, req.body, auth.user, res);
      case 'DELETE':
        if (!action) return res.status(400).json({ error: 'Appointment ID required' });
        return await cancelAppointment(action, auth.user, res);
      default:
        res.status(405).json({ error: 'Method not allowed' });
    }
  } catch (error) {
    console.error('Clinic Appointments API error:', error);
    res.status(500).json({ error: 'Internal server error', message: error.message });
  }
}

// ── Categories ──────────────────────────────────────────────────────────────
async function getCategories(res) {
  let rows = [];
  try {
    const r = await query(`SELECT id, name, duration_minutes, priority, color, is_active, sort_order
                           FROM clinic_categories WHERE is_active = TRUE ORDER BY sort_order ASC, name ASC`);
    rows = r.rows;
  } catch (e) { console.warn('getCategories:', e.message); }
  res.status(200).json({ categories: rows });
}

async function createCategory(body, res) {
  const { name, duration_minutes, priority, color, sort_order } = body || {};
  if (!name || !String(name).trim()) return res.status(400).json({ error: 'name is required' });
  try {
    const r = await query(
      `INSERT INTO clinic_categories (name, duration_minutes, priority, color, sort_order)
       VALUES ($1,$2,$3,$4,$5)
       ON CONFLICT (name) DO UPDATE SET duration_minutes = EXCLUDED.duration_minutes,
         priority = EXCLUDED.priority, color = EXCLUDED.color, sort_order = EXCLUDED.sort_order,
         is_active = TRUE, updated_at = CURRENT_TIMESTAMP
       RETURNING *`,
      [String(name).trim(), Number(duration_minutes) || 20, Number(priority) || 3, color || '#0E9F6E', Number(sort_order) || 0]
    );
    res.status(201).json({ category: r.rows[0] });
  } catch (e) { res.status(500).json({ error: e.message }); }
}

async function updateCategory(body, res) {
  const { id, name, duration_minutes, priority, color, is_active, sort_order } = body || {};
  if (!id) return res.status(400).json({ error: 'id is required' });
  try {
    const r = await query(
      `UPDATE clinic_categories SET
         name = COALESCE($2, name),
         duration_minutes = COALESCE($3, duration_minutes),
         priority = COALESCE($4, priority),
         color = COALESCE($5, color),
         is_active = COALESCE($6, is_active),
         sort_order = COALESCE($7, sort_order),
         updated_at = CURRENT_TIMESTAMP
       WHERE id = $1 RETURNING *`,
      [Number(id), name ?? null, duration_minutes ?? null, priority ?? null, color ?? null,
       typeof is_active === 'boolean' ? is_active : null, sort_order ?? null]
    );
    if (!r.rows.length) return res.status(404).json({ error: 'Category not found' });
    res.status(200).json({ category: r.rows[0] });
  } catch (e) { res.status(500).json({ error: e.message }); }
}

async function deleteCategory(id, res) {
  if (!id) return res.status(400).json({ error: 'id is required' });
  try {
    // Soft-delete to preserve historical appointment references
    const r = await query(`UPDATE clinic_categories SET is_active = FALSE, updated_at = CURRENT_TIMESTAMP WHERE id = $1 RETURNING id`, [Number(id)]);
    if (!r.rows.length) return res.status(404).json({ error: 'Category not found' });
    res.status(200).json({ success: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
}

async function categoryByName(name) {
  if (!name) return null;
  try {
    const r = await query(`SELECT * FROM clinic_categories WHERE LOWER(name) = LOWER($1) AND is_active = TRUE LIMIT 1`, [String(name)]);
    return r.rows[0] || null;
  } catch { return null; }
}

// ── Config save ─────────────────────────────────────────────────────────────
async function saveConfig(body, user, res) {
  const incoming = body?.config || body;
  if (!incoming || typeof incoming !== 'object') return res.status(400).json({ error: 'config object required' });
  const normalized = normalizeConfig(incoming);
  try {
    await query(
      `INSERT INTO clinic_config (id, config, updated_at, updated_by)
       VALUES (1, $1, CURRENT_TIMESTAMP, $2)
       ON CONFLICT (id) DO UPDATE SET config = EXCLUDED.config, updated_at = CURRENT_TIMESTAMP, updated_by = EXCLUDED.updated_by`,
      [JSON.stringify(normalized), user?.fullName || user?.email || 'admin']
    );
    res.status(200).json({ config: normalized });
  } catch (e) { res.status(500).json({ error: e.message }); }
}

// ── Doctor unavailability ───────────────────────────────────────────────────
async function getUnavailability(params, res) {
  const from = params.get('from');
  const to = params.get('to');
  let sql = `SELECT id, doctor_name, unavailable_date, reason FROM doctor_unavailability WHERE 1=1`;
  const args = [];
  if (from) { args.push(from); sql += ` AND unavailable_date >= $${args.length}`; }
  if (to) { args.push(to); sql += ` AND unavailable_date <= $${args.length}`; }
  sql += ` ORDER BY unavailable_date ASC`;
  try {
    const r = await query(sql, args);
    res.status(200).json({ unavailability: r.rows });
  } catch (e) { res.status(500).json({ error: e.message }); }
}

async function addUnavailability(body, user, res) {
  const { doctor_name, unavailable_date, reason } = body || {};
  if (!doctor_name || !unavailable_date) return res.status(400).json({ error: 'doctor_name and unavailable_date are required' });
  try {
    const r = await query(
      `INSERT INTO doctor_unavailability (doctor_name, unavailable_date, reason, created_by)
       VALUES ($1,$2,$3,$4)
       ON CONFLICT (doctor_name, unavailable_date) DO UPDATE SET reason = EXCLUDED.reason
       RETURNING *`,
      [String(doctor_name), unavailable_date, reason || null, user?.fullName || user?.email || 'admin']
    );
    res.status(201).json({ unavailability: r.rows[0] });
  } catch (e) { res.status(500).json({ error: e.message }); }
}

async function removeUnavailability(id, res) {
  if (!id) return res.status(400).json({ error: 'id is required' });
  try {
    await query(`DELETE FROM doctor_unavailability WHERE id = $1`, [Number(id)]);
    res.status(200).json({ success: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
}

async function unavailableDoctors(dateStr) {
  try {
    const r = await query(`SELECT doctor_name FROM doctor_unavailability WHERE unavailable_date = $1`, [dateStr]);
    return r.rows.map(x => x.doctor_name);
  } catch { return []; }
}

// ── PUBLIC: available slots (station-aware) ─────────────────────────────────
async function getAvailableSlots(params, config, res) {
  const date = params.get('date');
  if (!date) return res.status(400).json({ error: 'date parameter is required (YYYY-MM-DD)' });
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return res.status(400).json({ error: 'Invalid date format. Use YYYY-MM-DD' });

  const d = new Date(date + 'T00:00:00');
  const dow = d.getDay();
  const day = dayConfigFor(config, dow);
  if (!day.enabled || !(day.sessions || []).length) {
    return res.status(400).json({ error: 'Clinic is not held on this day' });
  }
  if (isHoliday(config, date)) {
    return res.status(400).json({ error: 'Clinic is closed on this date (public holiday)' });
  }

  const allSlots = generateTimeSlots(config, dow);
  const offDoctors = await unavailableDoctors(date);
  const availableStations = Math.max(0, day.stations - day.doctors.filter(doc => offDoctors.includes(doc)).length);

  let bookedRows = [];
  try {
    const result = await query(
      `SELECT time_slot, station_number FROM clinic_appointments
       WHERE appointment_date = $1 AND status != 'cancelled'`,
      [date]
    );
    bookedRows = result.rows;
  } catch (e) { console.error('getAvailableSlots DB error:', e.message); }

  const slots = allSlots.map(slot => {
    const bookedForSlot = bookedRows.filter(r => r.time_slot === slot).length;
    const remaining = Math.max(0, availableStations - bookedForSlot);
    return {
      time: slot,
      available: remaining > 0,
      bookedCount: bookedForSlot,
      totalStations: availableStations,
      remaining,
    };
  });

  res.status(200).json({
    date,
    dayName: DAY_NAMES[dow],
    stations: day.stations,
    availableStations,
    doctors: day.doctors,
    schedule: day.sessions,
    scheduleLabel: scheduleLabelFor(day),
    slots,
  });
}

// ── PUBLIC: book ────────────────────────────────────────────────────────────
async function bookAppointment(body, config, res) {
  const { patient_number, patient_name, phone_number, date, time_slot, agreed_terms, category } = body;

  if (!patient_name || !phone_number || !date || !time_slot) {
    return res.status(400).json({ error: 'patient_name, phone_number, date, and time_slot are required' });
  }
  if (!agreed_terms) return res.status(400).json({ error: 'You must agree to the Terms and Conditions' });

  const sanitizedName = String(patient_name).trim();
  if (!/^[a-zA-Z\s\-'.]{1,100}$/.test(sanitizedName)) {
    return res.status(400).json({ error: 'Invalid patient name. Use letters, spaces, and hyphens only.' });
  }

  let sanitizedPhone = String(phone_number).trim().replace(/[\s\-]/g, '');
  if (sanitizedPhone.startsWith('+234')) sanitizedPhone = sanitizedPhone.substring(4);
  else if (sanitizedPhone.startsWith('234') && sanitizedPhone.length > 10) sanitizedPhone = sanitizedPhone.substring(3);
  if (sanitizedPhone.startsWith('0')) sanitizedPhone = sanitizedPhone.substring(1);
  if (!/^[789][01]\d{8}$/.test(sanitizedPhone)) {
    return res.status(400).json({ error: 'Invalid phone number. Use Nigerian format e.g. 08012345678 or 8012345678' });
  }
  sanitizedPhone = '+234' + sanitizedPhone;

  const sanitizedPatientNumber = patient_number ? String(patient_number).trim() : sanitizedName;
  if (patient_number && !/^[a-zA-Z0-9\s\-\/]{1,50}$/.test(sanitizedPatientNumber)) {
    return res.status(400).json({ error: 'Invalid patient number format' });
  }

  const d = new Date(date + 'T00:00:00');
  const dow = d.getDay();
  const day = dayConfigFor(config, dow);
  if (!day.enabled || !(day.sessions || []).length) {
    return res.status(400).json({ error: 'Clinic is not held on this day' });
  }
  if (isHoliday(config, date)) {
    return res.status(400).json({ error: 'Clinic is closed on this date (public holiday)' });
  }

  const today = new Date(); today.setHours(0, 0, 0, 0);
  if (d < today) return res.status(400).json({ error: 'Cannot book appointments in the past' });

  const allSlots = generateTimeSlots(config, dow);
  if (!allSlots.includes(time_slot)) return res.status(400).json({ error: 'Invalid time slot' });

  // Resolve category (priority + recorded for analytics)
  const cat = await categoryByName(category);

  // Prevent the same patient double-booking the same date
  const existingPatient = await query(
    `SELECT id FROM clinic_appointments
     WHERE LOWER(patient_name) = LOWER($1) AND appointment_date::date = $2::date AND status != 'cancelled'`,
    [sanitizedName, date]
  );
  if (existingPatient.rows.length > 0) {
    return res.status(409).json({ error: 'You already have an appointment booked for this date' });
  }

  // Determine available stations after doctor unavailability
  const offDoctors = await unavailableDoctors(date);
  const activeDoctors = day.doctors.filter(doc => !offDoctors.includes(doc));
  if (activeDoctors.length === 0) {
    return res.status(409).json({ error: 'No doctors are available on this date. Please choose another clinic day.' });
  }

  // Find which stations are already taken for this slot
  const slotRows = await query(
    `SELECT station_number, doctor_assigned FROM clinic_appointments
     WHERE appointment_date::date = $1::date AND time_slot = $2 AND status != 'cancelled'`,
    [date, time_slot]
  );
  const takenStations = new Set(slotRows.rows.map(r => r.station_number).filter(n => n != null));

  // Even distribution: count per station across the whole day, pick least-busy free station
  const dayCounts = await query(
    `SELECT station_number, COUNT(*)::int AS cnt FROM clinic_appointments
     WHERE appointment_date::date = $1::date AND status != 'cancelled'
     GROUP BY station_number`,
    [date]
  );
  const counts = {};
  for (let s = 1; s <= activeDoctors.length; s++) counts[s] = 0;
  dayCounts.rows.forEach(r => { if (r.station_number != null && counts[r.station_number] !== undefined) counts[r.station_number] = r.cnt; });

  const freeStations = [];
  for (let s = 1; s <= activeDoctors.length; s++) if (!takenStations.has(s)) freeStations.push(s);
  if (freeStations.length === 0) {
    return res.status(409).json({ error: 'This time slot is fully booked. Please select another slot.' });
  }
  freeStations.sort((a, b) => counts[a] - counts[b]);
  const station = freeStations[0];
  const doctor = activeDoctors[station - 1] || activeDoctors[0];

  const priority = cat ? cat.priority : 3;
  const result = await query(
    `INSERT INTO clinic_appointments
       (patient_number, patient_name, phone_number, appointment_date, time_slot, doctor_assigned, station_number, category, priority)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
     RETURNING *`,
    [sanitizedPatientNumber, sanitizedName, sanitizedPhone, date, time_slot, doctor, station, cat ? cat.name : (category || null), priority]
  );

  res.status(201).json({ appointment: result.rows[0] });
}

// ── PROTECTED: list ─────────────────────────────────────────────────────────
async function getAllAppointments(params, user, res) {
  const date = params.get('date');
  const doctor = params.get('doctor');
  const status = params.get('status');
  const station = params.get('station');

  let queryStr = `SELECT * FROM clinic_appointments WHERE 1=1`;
  const queryParams = [];
  let p = 1;
  if (date) { queryStr += ` AND appointment_date::date = $${p}::date`; queryParams.push(date); p++; }
  if (doctor) { queryStr += ` AND doctor_assigned = $${p}`; queryParams.push(doctor); p++; }
  if (status) { queryStr += ` AND status = $${p}`; queryParams.push(status); p++; }
  if (station) { queryStr += ` AND station_number = $${p}`; queryParams.push(Number(station)); p++; }
  // Priority first (1 = highest), then by time
  queryStr += ` ORDER BY appointment_date ASC, time_slot ASC, COALESCE(priority, 3) ASC`;

  const result = await query(queryStr, queryParams);
  res.status(200).json({ appointments: result.rows });
}

// ── PROTECTED: queue analytics ──────────────────────────────────────────────
async function getQueueStats(params, config, res) {
  const date = params.get('date');
  if (!date) return res.status(400).json({ error: 'date parameter is required' });
  const d = new Date(date + 'T00:00:00');
  const dow = d.getDay();
  const day = dayConfigFor(config, dow);

  let rows = [];
  try {
    const r = await query(
      `SELECT id, station_number, doctor_assigned, status, category, priority, time_slot,
              checked_in_at, started_at, completed_at
       FROM clinic_appointments WHERE appointment_date::date = $1::date AND status != 'cancelled'`,
      [date]
    );
    rows = r.rows;
  } catch (e) { return res.status(500).json({ error: e.message }); }

  const total = rows.length;
  const byStatus = {};
  rows.forEach(r => { byStatus[r.status] = (byStatus[r.status] || 0) + 1; });

  // Waiting time: minutes between check-in and consultation start
  const waits = rows
    .filter(r => r.checked_in_at && r.started_at)
    .map(r => (new Date(r.started_at) - new Date(r.checked_in_at)) / 60000)
    .filter(m => m >= 0);
  const avgWaitMinutes = waits.length ? Math.round(waits.reduce((a, b) => a + b, 0) / waits.length) : null;

  // Per-station queue
  const stationCount = day.stations || 0;
  const stations = [];
  for (let s = 1; s <= stationCount; s++) {
    const sr = rows.filter(r => r.station_number === s);
    stations.push({
      station: s,
      doctor: (day.doctors || [])[s - 1] || `Station ${s}`,
      total: sr.length,
      waiting: sr.filter(r => r.status === 'booked' || r.status === 'checked-in').length,
      inProgress: sr.filter(r => r.status === 'in-progress').length,
      completed: sr.filter(r => r.status === 'completed').length,
      noShow: sr.filter(r => r.status === 'no-show').length,
    });
  }

  // Per-category breakdown
  const byCategory = {};
  rows.forEach(r => {
    const k = r.category || 'Uncategorized';
    byCategory[k] = (byCategory[k] || 0) + 1;
  });

  res.status(200).json({
    date,
    dayName: DAY_NAMES[dow],
    total,
    byStatus,
    byCategory,
    avgWaitMinutes,
    stations,
  });
}

// ── PROTECTED: update status (records waiting-time lifecycle timestamps) ─────
async function updateAppointment(id, body, user, res) {
  const { status, station_number, category } = body;

  // Allow station / category reassignment without a status change
  if (!status && (station_number !== undefined || category !== undefined)) {
    const r = await query(
      `UPDATE clinic_appointments SET
         station_number = COALESCE($2, station_number),
         category = COALESCE($3, category),
         updated_at = CURRENT_TIMESTAMP
       WHERE id = $1 RETURNING *`,
      [parseInt(id, 10), station_number ?? null, category ?? null]
    );
    if (!r.rows.length) return res.status(404).json({ error: 'Appointment not found' });
    return res.status(200).json({ appointment: r.rows[0] });
  }

  if (!status) return res.status(400).json({ error: 'status is required' });
  const validStatuses = ['booked', 'checked-in', 'in-progress', 'completed', 'cancelled', 'no-show'];
  if (!validStatuses.includes(status)) {
    return res.status(400).json({ error: `Invalid status. Must be one of: ${validStatuses.join(', ')}` });
  }

  // Stamp lifecycle timestamps for waiting-time analytics
  let timestampSet = '';
  if (status === 'checked-in') timestampSet = ', checked_in_at = COALESCE(checked_in_at, CURRENT_TIMESTAMP)';
  else if (status === 'in-progress') timestampSet = ', started_at = COALESCE(started_at, CURRENT_TIMESTAMP)';
  else if (status === 'completed') timestampSet = ', completed_at = COALESCE(completed_at, CURRENT_TIMESTAMP)';

  const result = await query(
    `UPDATE clinic_appointments SET status = $1, updated_at = CURRENT_TIMESTAMP${timestampSet} WHERE id = $2 RETURNING *`,
    [status, parseInt(id, 10)]
  );
  if (result.rows.length === 0) return res.status(404).json({ error: 'Appointment not found' });
  res.status(200).json({ appointment: result.rows[0] });
}

// ── PROTECTED: cancel ───────────────────────────────────────────────────────
async function cancelAppointment(id, user, res) {
  const result = await query(
    `UPDATE clinic_appointments SET status = 'cancelled', updated_at = CURRENT_TIMESTAMP WHERE id = $1 RETURNING *`,
    [parseInt(id, 10)]
  );
  if (result.rows.length === 0) return res.status(404).json({ error: 'Appointment not found' });
  res.status(200).json({ appointment: result.rows[0], message: 'Appointment cancelled' });
}
