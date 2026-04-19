// Clinic Appointments API endpoint for Vercel serverless
import { query } from './_lib/db.js';
import { cors, authenticateRequest } from './_lib/auth.js';

let tableEnsured = false;

async function ensureTable() {
  if (tableEnsured) return;
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
  } catch (e) {
    console.warn('ensureTable CREATE:', e.message);
  }
  try { await query(`CREATE INDEX IF NOT EXISTS idx_clinic_appt_date ON clinic_appointments(appointment_date)`); } catch {}
  try { await query(`CREATE INDEX IF NOT EXISTS idx_clinic_appt_doctor ON clinic_appointments(doctor_assigned)`); } catch {}
  try { await query(`CREATE INDEX IF NOT EXISTS idx_clinic_appt_patient ON clinic_appointments(patient_number)`); } catch {}
  try { await query(`ALTER TABLE clinic_appointments ADD COLUMN IF NOT EXISTS patient_name VARCHAR(255)`); } catch {}
  try { await query(`ALTER TABLE clinic_appointments ADD COLUMN IF NOT EXISTS phone_number VARCHAR(20)`); } catch {}
  tableEnsured = true;
}

// Clinic schedule configuration
const CLINIC_CONFIG = {
  // 0=Sun,1=Mon,2=Tue,3=Wed,4=Thu,5=Fri,6=Sat
  tuesday: {
    dayOfWeek: 2,
    doctors: ['Dr. Nnadi', 'Dr. Onyia', 'Dr. Okwesili'],
    assignMode: 'random',
    schedule: [
      { label: 'Morning Session', start: '09:00', end: '13:30' },
      { label: 'Afternoon Session', start: '14:00', end: '16:00' }
    ],
    scheduleLabel: '9:00 AM – 1:30 PM, 2:00 PM – 4:00 PM'
  },
  wednesday: {
    dayOfWeek: 3,
    doctors: ['Dr. Okwesili', 'Dr. Eze'],
    assignMode: 'random',
    schedule: [
      { label: 'Clinic Session', start: '10:00', end: '16:00' }
    ],
    scheduleLabel: '10:00 AM – 4:00 PM'
  }
};

// Generate time slots for a given day of week
// Tuesday: 25-minute slots (three doctors)
// Wednesday: 20-minute slots (two doctors)
function generateTimeSlots(dayOfWeek) {
  const config = dayOfWeek === 3 ? CLINIC_CONFIG.wednesday : CLINIC_CONFIG.tuesday;
  const slotDuration = dayOfWeek === 2 ? 25 : 20;
  const slots = [];
  for (const session of config.schedule) {
    const [startHour, startMin] = session.start.split(':').map(Number);
    const [endHour, endMin] = session.end.split(':').map(Number);
    const endTotalMin = endHour * 60 + endMin;
    let currentMin = startHour * 60 + startMin;
    while (true) {
      const slotEnd = currentMin + slotDuration;
      if (slotEnd > endTotalMin) break;
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

// Get upcoming clinic dates (next 4 weeks of Tuesdays and Wednesdays)
function getUpcomingClinicDates() {
  const dates = [];
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  for (let i = 0; i < 28; i++) {
    const d = new Date(today);
    d.setDate(today.getDate() + i);
    const dow = d.getDay();
    if (dow === 2 || dow === 3) {
      const config = dow === 2 ? CLINIC_CONFIG.tuesday : CLINIC_CONFIG.wednesday;
      // Only include today if there's still time for appointments
      if (i === 0) {
        const now = new Date();
        const lastSession = config.schedule[config.schedule.length - 1];
        const [endH] = lastSession.end.split(':').map(Number);
        if (now.getHours() >= endH) continue; // clinic over for today
      }
      dates.push({
        date: d.toISOString().split('T')[0],
        dayName: dow === 2 ? 'Tuesday' : 'Wednesday',
        dayOfWeek: dow,
        doctors: config.doctors,
        schedule: config.schedule,
        scheduleLabel: config.scheduleLabel
      });
    }
  }
  return dates;
}

function assignDoctor(dayOfWeek) {
  if (dayOfWeek === 3) {
    return 'Dr. Eze';
  }
  // Tuesday: will be assigned evenly in bookAppointment() using DB counts
  return null;
}

export default async function handler(req, res) {
  if (cors(req, res)) return;

  const { method } = req;
  // Use req.query (Vercel pre-parsed) with URL fallback
  let action, searchParams;
  try {
    const url = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
    const pathParts = url.pathname.replace('/api/clinic-appointments', '').split('/').filter(Boolean);
    action = pathParts[0] || req.query?.action;
    searchParams = url.searchParams;
  } catch {
    action = req.query?.action;
    searchParams = { get: (k) => req.query?.[k] };
  }

  try {
    // clinic-dates is pure JS date math — no DB needed
    if (method === 'GET' && action === 'clinic-dates') {
      return await getClinicDates(res);
    }

    await ensureTable();

    // PUBLIC endpoints (no auth required for patient booking)
    if (method === 'GET' && action === 'available-slots') {
      return await getAvailableSlots(url.searchParams, res);
    }
    if (method === 'POST' && action === 'book') {
      return await bookAppointment(req.body, res);
    }

    // PROTECTED endpoints (auth required for doctors/admin)
    const auth = authenticateRequest(req);
    if (!auth.authenticated) {
      return res.status(401).json({ error: auth.error });
    }

    switch (method) {
      case 'GET':
        if (action === 'all') {
          return await getAllAppointments(url.searchParams, auth.user, res);
        }
        return await getAllAppointments(url.searchParams, auth.user, res);
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

// PUBLIC: Get upcoming clinic dates
async function getClinicDates(res) {
  const dates = getUpcomingClinicDates();
  res.status(200).json({ dates });
}

// PUBLIC: Get available slots for a given date
async function getAvailableSlots(params, res) {
  const date = params.get('date');
  if (!date) {
    return res.status(400).json({ error: 'date parameter is required (YYYY-MM-DD)' });
  }

  // Validate date format
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    return res.status(400).json({ error: 'Invalid date format. Use YYYY-MM-DD' });
  }

  const d = new Date(date + 'T00:00:00');
  const dow = d.getDay();
  if (dow !== 2 && dow !== 3) {
    return res.status(400).json({ error: 'Clinic is only available on Tuesdays and Wednesdays' });
  }

  const config = dow === 2 ? CLINIC_CONFIG.tuesday : CLINIC_CONFIG.wednesday;
  const allSlots = generateTimeSlots(dow);
  const doctors = config.doctors;

  // Query booked slots for this date (graceful fallback if DB is down)
  let bookedRows = [];
  try {
    const result = await query(
      `SELECT time_slot, doctor_assigned FROM clinic_appointments 
       WHERE appointment_date = $1 AND status != 'cancelled'`,
      [date]
    );
    bookedRows = result.rows;
  } catch (e) {
    console.error('getAvailableSlots DB error:', e.message);
    // Return all slots as available if DB query fails
  }

  // For each slot, check availability across all doctors
  const slots = allSlots.map(slot => {
    const doctorsBookedForSlot = bookedRows
      .filter(r => r.time_slot === slot)
      .map(r => r.doctor_assigned);
    
    // A slot is available if at least one doctor is not booked
    const availableDoctors = doctors.filter(d => !doctorsBookedForSlot.includes(d));
    const isAvailable = availableDoctors.length > 0;

    return {
      time: slot,
      available: isAvailable,
      bookedCount: doctorsBookedForSlot.length,
      totalDoctors: doctors.length
    };
  });

  res.status(200).json({
    date,
    dayName: dow === 2 ? 'Tuesday' : 'Wednesday',
    doctors,
    schedule: config.schedule,
    scheduleLabel: config.scheduleLabel,
    slots
  });
}

// PUBLIC: Book an appointment
async function bookAppointment(body, res) {
  const { patient_number, patient_name, phone_number, date, time_slot, agreed_terms } = body;

  if (!patient_name || !phone_number || !date || !time_slot) {
    return res.status(400).json({ error: 'patient_name, phone_number, date, and time_slot are required' });
  }

  if (!agreed_terms) {
    return res.status(400).json({ error: 'You must agree to the Terms and Conditions' });
  }

  // Validate patient_name (letters, spaces, hyphens, apostrophes, 1-100 chars)
  const sanitizedName = String(patient_name).trim();
  if (!/^[a-zA-Z\s\-'.]{1,100}$/.test(sanitizedName)) {
    return res.status(400).json({ error: 'Invalid patient name. Use letters, spaces, and hyphens only.' });
  }

  // Validate and normalize phone number to +234 format
  let sanitizedPhone = String(phone_number).trim().replace(/[\s\-]/g, '');
  // Normalize: strip +234 or leading 0 to get 10-digit local number
  if (sanitizedPhone.startsWith('+234')) sanitizedPhone = sanitizedPhone.substring(4);
  else if (sanitizedPhone.startsWith('234') && sanitizedPhone.length > 10) sanitizedPhone = sanitizedPhone.substring(3);
  if (sanitizedPhone.startsWith('0')) sanitizedPhone = sanitizedPhone.substring(1);
  if (!/^[789][01]\d{8}$/.test(sanitizedPhone)) {
    return res.status(400).json({ error: 'Invalid phone number. Use Nigerian format e.g. 08012345678 or 8012345678' });
  }
  sanitizedPhone = '+234' + sanitizedPhone;

  // Validate patient_number if provided (alphanumeric, spaces, hyphens, slashes)
  const sanitizedPatientNumber = patient_number ? String(patient_number).trim() : sanitizedName;
  if (patient_number && !/^[a-zA-Z0-9\s\-\/]{1,50}$/.test(sanitizedPatientNumber)) {
    return res.status(400).json({ error: 'Invalid patient number format' });
  }

  // Validate date is a clinic day
  const d = new Date(date + 'T00:00:00');
  const dow = d.getDay();
  if (dow !== 2 && dow !== 3) {
    return res.status(400).json({ error: 'Clinic is only available on Tuesdays and Wednesdays' });
  }

  // Validate date is not in the past
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  if (d < today) {
    return res.status(400).json({ error: 'Cannot book appointments in the past' });
  }

  // Validate time slot format
  const allSlots = generateTimeSlots(dow);
  if (!allSlots.includes(time_slot)) {
    return res.status(400).json({ error: 'Invalid time slot' });
  }

  // Check if patient already has a booking on this date (by name to prevent duplicates)
  const existingPatient = await query(
    `SELECT id FROM clinic_appointments 
     WHERE LOWER(patient_name) = LOWER($1) AND appointment_date::date = $2::date AND status != 'cancelled'`,
    [sanitizedName, date]
  );
  if (existingPatient.rows.length > 0) {
    return res.status(409).json({ error: 'You already have an appointment booked for this date' });
  }

  // Assign doctor
  let doctor;
  if (dow === 3) {
    doctor = 'Dr. Eze';
  } else {
    // Tuesday: even assignment with rotation
    const doctors = CLINIC_CONFIG.tuesday.doctors;

    // Check patient's last visit to ensure they see a different doctor
    const lastVisit = await query(
      `SELECT doctor_assigned FROM clinic_appointments
       WHERE LOWER(patient_name) = LOWER($1) AND status != 'cancelled'
       ORDER BY appointment_date DESC, created_at DESC LIMIT 1`,
      [sanitizedName]
    );
    const lastDoctor = lastVisit.rows.length > 0 ? lastVisit.rows[0].doctor_assigned : null;

    // Count how many patients each doctor has for this date (for even distribution)
    const countResult = await query(
      `SELECT doctor_assigned, COUNT(*) as cnt FROM clinic_appointments
       WHERE appointment_date::date = $1::date AND status != 'cancelled'
       GROUP BY doctor_assigned`,
      [date]
    );
    const counts = {};
    doctors.forEach(d => counts[d] = 0);
    countResult.rows.forEach(r => { if (counts[r.doctor_assigned] !== undefined) counts[r.doctor_assigned] = parseInt(r.cnt); });

    // Sort doctors by least booked first
    const sorted = [...doctors].sort((a, b) => counts[a] - counts[b]);

    // Prefer a doctor the patient hasn't seen last, among the least-booked
    if (lastDoctor && sorted.length > 1) {
      // Try to pick a different doctor; if the least-booked IS the last doctor, pick the next one
      doctor = sorted.find(d => d !== lastDoctor) || sorted[0];
    } else {
      doctor = sorted[0];
    }
  }

  // Check if this specific slot+doctor combo is taken (prevent double booking)
  const existingSlot = await query(
    `SELECT id FROM clinic_appointments 
     WHERE appointment_date::date = $1::date AND time_slot = $2 AND doctor_assigned = $3 AND status != 'cancelled'`,
    [date, time_slot, doctor]
  );

  if (existingSlot.rows.length > 0) {
    // If assigned doctor's slot is taken, try the other doctor (Tuesday only)
    if (dow === 2) {
      const otherDoctor = CLINIC_CONFIG.tuesday.doctors.find(d => d !== doctor);
      const otherSlot = await query(
        `SELECT id FROM clinic_appointments 
         WHERE appointment_date::date = $1::date AND time_slot = $2 AND doctor_assigned = $3 AND status != 'cancelled'`,
        [date, time_slot, otherDoctor]
      );
      if (otherSlot.rows.length > 0) {
        return res.status(409).json({ error: 'This time slot is fully booked. Please select another slot.' });
      }
      // Use the other doctor
      const result = await query(
        `INSERT INTO clinic_appointments (patient_number, patient_name, phone_number, appointment_date, time_slot, doctor_assigned)
         VALUES ($1, $2, $3, $4, $5, $6)
         RETURNING *`,
        [sanitizedPatientNumber, sanitizedName, sanitizedPhone, date, time_slot, otherDoctor]
      );
      return res.status(201).json({ appointment: result.rows[0] });
    }
    return res.status(409).json({ error: 'This time slot is fully booked. Please select another slot.' });
  }

  // Insert the booking
  const result = await query(
    `INSERT INTO clinic_appointments (patient_number, patient_name, phone_number, appointment_date, time_slot, doctor_assigned)
     VALUES ($1, $2, $3, $4, $5, $6)
     RETURNING *`,
    [sanitizedPatientNumber, sanitizedName, sanitizedPhone, date, time_slot, doctor]
  );

  res.status(201).json({ appointment: result.rows[0] });
}

// PROTECTED: Get all appointments (admin/doctors view)
async function getAllAppointments(params, user, res) {
  const date = params.get('date');
  const doctor = params.get('doctor');
  const status = params.get('status');

  let queryStr = `SELECT * FROM clinic_appointments WHERE 1=1`;
  const queryParams = [];
  let paramCount = 1;

  if (date) {
    queryStr += ` AND appointment_date::date = $${paramCount}::date`;
    queryParams.push(date);
    paramCount++;
  }
  if (doctor) {
    queryStr += ` AND doctor_assigned = $${paramCount}`;
    queryParams.push(doctor);
    paramCount++;
  }
  if (status) {
    queryStr += ` AND status = $${paramCount}`;
    queryParams.push(status);
    paramCount++;
  }

  queryStr += ` ORDER BY appointment_date ASC, time_slot ASC`;

  const result = await query(queryStr, queryParams);
  res.status(200).json({ appointments: result.rows });
}

// PROTECTED: Update appointment status
async function updateAppointment(id, body, user, res) {
  const { status } = body;
  if (!status) {
    return res.status(400).json({ error: 'status is required' });
  }

  const validStatuses = ['booked', 'checked-in', 'in-progress', 'completed', 'cancelled', 'no-show'];
  if (!validStatuses.includes(status)) {
    return res.status(400).json({ error: `Invalid status. Must be one of: ${validStatuses.join(', ')}` });
  }

  const result = await query(
    `UPDATE clinic_appointments SET status = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2 RETURNING *`,
    [status, parseInt(id, 10)]
  );

  if (result.rows.length === 0) {
    return res.status(404).json({ error: 'Appointment not found' });
  }

  res.status(200).json({ appointment: result.rows[0] });
}

// PROTECTED: Cancel appointment
async function cancelAppointment(id, user, res) {
  const result = await query(
    `UPDATE clinic_appointments SET status = 'cancelled', updated_at = CURRENT_TIMESTAMP WHERE id = $1 RETURNING *`,
    [parseInt(id, 10)]
  );

  if (result.rows.length === 0) {
    return res.status(404).json({ error: 'Appointment not found' });
  }

  res.status(200).json({ appointment: result.rows[0], message: 'Appointment cancelled' });
}
