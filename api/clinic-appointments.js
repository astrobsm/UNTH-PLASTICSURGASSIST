// Clinic Appointments API endpoint for Vercel serverless
import { query } from './_lib/db.js';
import { cors, authenticateRequest } from './_lib/auth.js';

let tableEnsured = false;

async function ensureTable() {
  if (tableEnsured) return;
  await query(`
    CREATE TABLE IF NOT EXISTS clinic_appointments (
      id SERIAL PRIMARY KEY,
      patient_number VARCHAR(100) NOT NULL,
      appointment_date DATE NOT NULL,
      time_slot VARCHAR(20) NOT NULL,
      doctor_assigned VARCHAR(255) NOT NULL,
      status VARCHAR(50) DEFAULT 'booked',
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(appointment_date, time_slot, doctor_assigned)
    )
  `);
  await query(`CREATE INDEX IF NOT EXISTS idx_clinic_appt_date ON clinic_appointments(appointment_date)`);
  await query(`CREATE INDEX IF NOT EXISTS idx_clinic_appt_doctor ON clinic_appointments(doctor_assigned)`);
  await query(`CREATE INDEX IF NOT EXISTS idx_clinic_appt_patient ON clinic_appointments(patient_number)`);
  tableEnsured = true;
}

// Clinic schedule configuration
const CLINIC_CONFIG = {
  // 0=Sun,1=Mon,2=Tue,3=Wed,4=Thu,5=Fri,6=Sat
  tuesday: {
    dayOfWeek: 2,
    doctors: ['Dr. Nnadi', 'Dr. Onyia'],
    assignMode: 'random'
  },
  wednesday: {
    dayOfWeek: 3,
    doctors: ['Dr. Eze'],
    assignMode: 'fixed'
  }
};

// Generate 20-minute time slots
function generateTimeSlots() {
  const slots = [];
  // Morning session: 9:00 AM – 1:30 PM
  let hour = 9, min = 0;
  while (hour < 13 || (hour === 13 && min < 30)) {
    const startH = String(hour).padStart(2, '0');
    const startM = String(min).padStart(2, '0');
    let endMin = min + 20;
    let endHour = hour;
    if (endMin >= 60) { endMin -= 60; endHour += 1; }
    const endH = String(endHour).padStart(2, '0');
    const endM = String(endMin).padStart(2, '0');
    // Don't create slot if it would end after 13:30
    if (endHour > 13 || (endHour === 13 && endMin > 30)) break;
    slots.push(`${startH}:${startM}-${endH}:${endM}`);
    min += 20;
    if (min >= 60) { min -= 60; hour += 1; }
  }
  // Afternoon session: 2:00 PM – 4:00 PM
  hour = 14; min = 0;
  while (hour < 16) {
    const startH = String(hour).padStart(2, '0');
    const startM = String(min).padStart(2, '0');
    let endMin = min + 20;
    let endHour = hour;
    if (endMin >= 60) { endMin -= 60; endHour += 1; }
    const endH = String(endHour).padStart(2, '0');
    const endM = String(endMin).padStart(2, '0');
    if (endHour > 16) break;
    slots.push(`${startH}:${startM}-${endH}:${endM}`);
    min += 20;
    if (min >= 60) { min -= 60; hour += 1; }
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
      // Only include today if there's still time for appointments
      if (i === 0) {
        const now = new Date();
        if (now.getHours() >= 16) continue; // clinic over for today
      }
      dates.push({
        date: d.toISOString().split('T')[0],
        dayName: dow === 2 ? 'Tuesday' : 'Wednesday',
        dayOfWeek: dow
      });
    }
  }
  return dates;
}

function assignDoctor(dayOfWeek) {
  if (dayOfWeek === 3) {
    return 'Dr. Eze';
  }
  // Tuesday: randomly assign
  const doctors = CLINIC_CONFIG.tuesday.doctors;
  return doctors[Math.floor(Math.random() * doctors.length)];
}

export default async function handler(req, res) {
  if (cors(req, res)) return;

  const { method } = req;
  const url = new URL(req.url, `http://${req.headers.host}`);
  const pathParts = url.pathname.replace('/api/clinic-appointments', '').split('/').filter(Boolean);
  const action = pathParts[0];

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

  const d = new Date(date + 'T00:00:00');
  const dow = d.getDay();
  if (dow !== 2 && dow !== 3) {
    return res.status(400).json({ error: 'Clinic is only available on Tuesdays and Wednesdays' });
  }

  const allSlots = generateTimeSlots();

  // Query booked slots for this date
  const result = await query(
    `SELECT time_slot, doctor_assigned FROM clinic_appointments 
     WHERE appointment_date = $1 AND status != 'cancelled'`,
    [date]
  );

  const bookedSlots = result.rows.map(r => r.time_slot);

  // Determine doctors for this day
  const doctors = dow === 2 ? CLINIC_CONFIG.tuesday.doctors : CLINIC_CONFIG.wednesday.doctors;

  // For each slot, check availability across all doctors
  const slots = allSlots.map(slot => {
    const doctorsBookedForSlot = result.rows
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
    slots
  });
}

// PUBLIC: Book an appointment
async function bookAppointment(body, res) {
  const { patient_number, date, time_slot, agreed_terms } = body;

  if (!patient_number || !date || !time_slot) {
    return res.status(400).json({ error: 'patient_number, date, and time_slot are required' });
  }

  if (!agreed_terms) {
    return res.status(400).json({ error: 'You must agree to the Terms and Conditions' });
  }

  // Validate patient_number format (alphanumeric, 1-50 chars)
  const sanitizedPatientNumber = String(patient_number).trim();
  if (!/^[a-zA-Z0-9\-\/]{1,50}$/.test(sanitizedPatientNumber)) {
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
  const allSlots = generateTimeSlots();
  if (!allSlots.includes(time_slot)) {
    return res.status(400).json({ error: 'Invalid time slot' });
  }

  // Check if patient already has a booking on this date
  const existingPatient = await query(
    `SELECT id FROM clinic_appointments 
     WHERE patient_number = $1 AND appointment_date = $2 AND status != 'cancelled'`,
    [sanitizedPatientNumber, date]
  );
  if (existingPatient.rows.length > 0) {
    return res.status(409).json({ error: 'You already have an appointment booked for this date' });
  }

  // Assign doctor
  const doctor = assignDoctor(dow);

  // Check if this specific slot+doctor combo is taken (prevent double booking)
  const existingSlot = await query(
    `SELECT id FROM clinic_appointments 
     WHERE appointment_date = $1 AND time_slot = $2 AND doctor_assigned = $3 AND status != 'cancelled'`,
    [date, time_slot, doctor]
  );

  if (existingSlot.rows.length > 0) {
    // If random assignment hit a taken slot, try the other doctor (Tuesday only)
    if (dow === 2) {
      const otherDoctor = CLINIC_CONFIG.tuesday.doctors.find(d => d !== doctor);
      const otherSlot = await query(
        `SELECT id FROM clinic_appointments 
         WHERE appointment_date = $1 AND time_slot = $2 AND doctor_assigned = $3 AND status != 'cancelled'`,
        [date, time_slot, otherDoctor]
      );
      if (otherSlot.rows.length > 0) {
        return res.status(409).json({ error: 'This time slot is fully booked. Please select another slot.' });
      }
      // Use the other doctor
      const result = await query(
        `INSERT INTO clinic_appointments (patient_number, appointment_date, time_slot, doctor_assigned)
         VALUES ($1, $2, $3, $4)
         RETURNING *`,
        [sanitizedPatientNumber, date, time_slot, otherDoctor]
      );
      return res.status(201).json({ appointment: result.rows[0] });
    }
    return res.status(409).json({ error: 'This time slot is fully booked. Please select another slot.' });
  }

  // Insert the booking
  const result = await query(
    `INSERT INTO clinic_appointments (patient_number, appointment_date, time_slot, doctor_assigned)
     VALUES ($1, $2, $3, $4)
     RETURNING *`,
    [sanitizedPatientNumber, date, time_slot, doctor]
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
    queryStr += ` AND appointment_date = $${paramCount}`;
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
