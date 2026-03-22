// Clinic Appointment Booking API
// Public endpoint for patients + authenticated admin endpoints

import { query } from './_lib/db.js';
import { authenticateRequest, cors } from './_lib/auth.js';

let tableEnsured = false;

async function ensureTable() {
  if (tableEnsured) return;
  await query(`
    CREATE TABLE IF NOT EXISTS clinic_appointments (
      id SERIAL PRIMARY KEY,
      patient_number VARCHAR(100) NOT NULL,
      date DATE NOT NULL,
      time_slot VARCHAR(20) NOT NULL,
      doctor_assigned VARCHAR(255) NOT NULL,
      status VARCHAR(50) DEFAULT 'booked',
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(date, time_slot)
    );
    CREATE INDEX IF NOT EXISTS idx_appointments_date ON clinic_appointments(date);
    CREATE INDEX IF NOT EXISTS idx_appointments_doctor ON clinic_appointments(doctor_assigned);
    CREATE INDEX IF NOT EXISTS idx_appointments_patient ON clinic_appointments(patient_number);
  `);
  tableEnsured = true;
}

// Clinic schedule configuration
const TUESDAY_DOCTORS = ['Dr. Nnadi', 'Dr. Onyia'];
const WEDNESDAY_DOCTORS = ['Dr. Eze'];

function generateTimeSlots() {
  const slots = [];
  // Morning session: 9:00 AM – 1:30 PM
  let hour = 9, minute = 0;
  while (hour < 13 || (hour === 13 && minute < 30)) {
    const startH = String(hour).padStart(2, '0');
    const startM = String(minute).padStart(2, '0');
    let endMinute = minute + 20;
    let endHour = hour;
    if (endMinute >= 60) { endHour++; endMinute -= 60; }
    const endH = String(endHour).padStart(2, '0');
    const endM = String(endMinute).padStart(2, '0');
    // Don't generate slots that bleed into break (13:30)
    if (endHour < 13 || (endHour === 13 && endMinute <= 30)) {
      slots.push(`${startH}:${startM}-${endH}:${endM}`);
    }
    minute += 20;
    if (minute >= 60) { hour++; minute -= 60; }
  }
  // Afternoon session: 2:00 PM – 4:00 PM
  hour = 14; minute = 0;
  while (hour < 16) {
    const startH = String(hour).padStart(2, '0');
    const startM = String(minute).padStart(2, '0');
    let endMinute = minute + 20;
    let endHour = hour;
    if (endMinute >= 60) { endHour++; endMinute -= 60; }
    const endH = String(endHour).padStart(2, '0');
    const endM = String(endMinute).padStart(2, '0');
    if (endHour <= 16) {
      slots.push(`${startH}:${startM}-${endH}:${endM}`);
    }
    minute += 20;
    if (minute >= 60) { hour++; minute -= 60; }
  }
  return slots;
}

function getNextClinicDates(weeksAhead = 4) {
  const dates = [];
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  
  for (let i = 0; i < weeksAhead * 7; i++) {
    const d = new Date(today);
    d.setDate(today.getDate() + i);
    const dayOfWeek = d.getDay();
    // 2 = Tuesday, 3 = Wednesday
    if (dayOfWeek === 2 || dayOfWeek === 3) {
      // Skip past dates (if today is a clinic day, only include if before clinic end time)
      if (i === 0) {
        const now = new Date();
        if (now.getHours() >= 16) continue; // clinic is over for today
      }
      dates.push({
        date: d.toISOString().split('T')[0],
        dayName: dayOfWeek === 2 ? 'Tuesday' : 'Wednesday',
        dayOfWeek,
        doctors: dayOfWeek === 2 ? TUESDAY_DOCTORS : WEDNESDAY_DOCTORS
      });
    }
  }
  return dates;
}

function assignDoctor(dayOfWeek) {
  if (dayOfWeek === 3) return 'Dr. Eze'; // Wednesday
  // Tuesday: random assignment
  return TUESDAY_DOCTORS[Math.floor(Math.random() * TUESDAY_DOCTORS.length)];
}

export default async function handler(req, res) {
  if (cors(req, res)) return;
  await ensureTable();

  try {
    // PUBLIC ENDPOINTS (no auth required)
    
    // GET /api/appointments?action=slots&date=YYYY-MM-DD — get available slots
    if (req.method === 'GET' && req.query.action === 'slots') {
      const { date } = req.query;
      if (!date) return res.status(400).json({ error: 'date is required' });
      
      const d = new Date(date + 'T00:00:00');
      const dayOfWeek = d.getDay();
      if (dayOfWeek !== 2 && dayOfWeek !== 3) {
        return res.status(400).json({ error: 'Clinic is only available on Tuesdays and Wednesdays' });
      }
      
      const allSlots = generateTimeSlots();
      const booked = await query(
        'SELECT time_slot FROM clinic_appointments WHERE date = $1 AND status != $2',
        [date, 'cancelled']
      );
      const bookedSlots = new Set(booked.rows.map(r => r.time_slot));
      
      const slots = allSlots.map(slot => ({
        time: slot,
        available: !bookedSlots.has(slot)
      }));
      
      return res.status(200).json({
        date,
        dayName: dayOfWeek === 2 ? 'Tuesday' : 'Wednesday',
        doctors: dayOfWeek === 2 ? TUESDAY_DOCTORS : WEDNESDAY_DOCTORS,
        slots
      });
    }
    
    // GET /api/appointments?action=dates — get upcoming clinic dates
    if (req.method === 'GET' && req.query.action === 'dates') {
      const dates = getNextClinicDates();
      return res.status(200).json({ dates });
    }
    
    // POST /api/appointments — book an appointment (public, no auth)
    if (req.method === 'POST') {
      const { patient_number, date, time_slot } = req.body;
      
      if (!patient_number || !date || !time_slot) {
        return res.status(400).json({ error: 'patient_number, date, and time_slot are required' });
      }
      
      // Validate patient_number format
      const sanitizedPatientNumber = String(patient_number).trim();
      if (!sanitizedPatientNumber || sanitizedPatientNumber.length > 100) {
        return res.status(400).json({ error: 'Invalid patient number' });
      }

      // Validate date is a clinic day
      const d = new Date(date + 'T00:00:00');
      const dayOfWeek = d.getDay();
      if (dayOfWeek !== 2 && dayOfWeek !== 3) {
        return res.status(400).json({ error: 'Clinic is only available on Tuesdays and Wednesdays' });
      }
      
      // Validate time slot format
      const allSlots = generateTimeSlots();
      if (!allSlots.includes(time_slot)) {
        return res.status(400).json({ error: 'Invalid time slot' });
      }
      
      // Validate date is not in the past
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      if (d < today) {
        return res.status(400).json({ error: 'Cannot book appointments in the past' });
      }
      
      // Check if patient already has a booking on this date
      const existingPatient = await query(
        'SELECT id FROM clinic_appointments WHERE date = $1 AND patient_number = $2 AND status != $3',
        [date, sanitizedPatientNumber, 'cancelled']
      );
      if (existingPatient.rows.length > 0) {
        return res.status(409).json({ error: 'You already have an appointment booked for this date' });
      }
      
      // Assign doctor
      const doctor = assignDoctor(dayOfWeek);
      
      // Insert with unique constraint — prevents double booking of same slot
      try {
        const result = await query(
          `INSERT INTO clinic_appointments (patient_number, date, time_slot, doctor_assigned)
           VALUES ($1, $2, $3, $4)
           RETURNING *`,
          [sanitizedPatientNumber, date, time_slot, doctor]
        );
        
        return res.status(201).json({
          success: true,
          appointment: result.rows[0]
        });
      } catch (err) {
        if (err.code === '23505') { // unique_violation
          return res.status(409).json({ error: 'This time slot has already been booked. Please select another slot.' });
        }
        throw err;
      }
    }
    
    // ADMIN ENDPOINTS (require auth)
    
    // GET /api/appointments — list appointments (admin, requires auth)
    if (req.method === 'GET' && !req.query.action) {
      const auth = authenticateRequest(req);
      if (!auth.authenticated) {
        return res.status(401).json({ error: auth.error });
      }
      
      const { date, doctor, status } = req.query;
      let sql = 'SELECT * FROM clinic_appointments WHERE 1=1';
      const params = [];
      let paramIdx = 1;
      
      if (date) {
        sql += ` AND date = $${paramIdx++}`;
        params.push(date);
      }
      if (doctor) {
        sql += ` AND doctor_assigned = $${paramIdx++}`;
        params.push(doctor);
      }
      if (status) {
        sql += ` AND status = $${paramIdx++}`;
        params.push(status);
      }
      
      sql += ' ORDER BY date ASC, time_slot ASC';
      
      const result = await query(sql, params);
      return res.status(200).json({ appointments: result.rows });
    }
    
    // PUT /api/appointments — cancel/reschedule (admin, requires auth)
    if (req.method === 'PUT') {
      const auth = authenticateRequest(req);
      if (!auth.authenticated) {
        return res.status(401).json({ error: auth.error });
      }
      
      const { id, status } = req.body;
      if (!id || !status) {
        return res.status(400).json({ error: 'id and status are required' });
      }
      
      const validStatuses = ['booked', 'cancelled', 'completed', 'no-show'];
      if (!validStatuses.includes(status)) {
        return res.status(400).json({ error: 'Invalid status. Must be: ' + validStatuses.join(', ') });
      }
      
      const result = await query(
        'UPDATE clinic_appointments SET status = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2 RETURNING *',
        [status, id]
      );
      
      if (result.rows.length === 0) {
        return res.status(404).json({ error: 'Appointment not found' });
      }
      
      return res.status(200).json({ appointment: result.rows[0] });
    }
    
    // DELETE /api/appointments — delete appointment (admin, requires auth)
    if (req.method === 'DELETE') {
      const auth = authenticateRequest(req);
      if (!auth.authenticated) {
        return res.status(401).json({ error: auth.error });
      }
      
      const { id } = req.query;
      if (!id) return res.status(400).json({ error: 'id query parameter is required' });
      
      await query('DELETE FROM clinic_appointments WHERE id = $1', [id]);
      return res.status(200).json({ success: true });
    }
    
    return res.status(405).json({ error: 'Method not allowed' });
  } catch (error) {
    console.error('Appointments API error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}
