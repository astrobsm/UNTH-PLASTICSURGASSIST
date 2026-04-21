// Surgeries/Booking API endpoint for Vercel serverless
import { query } from './_lib/db.js';
import { cors, authenticateRequest } from './_lib/auth.js';

// ─── Theatre slate capacity rules ──────────────────────────────
// Each day has 4 "case-points" of capacity:
//   Major = 2 pts, Intermediate = 1 pt, Minor = 0.5 pt
// Allowed combinations (all ≤ 4 pts):
//   • 2 majors                    (4)
//   • 1 major + 1 intermediate + 1 minor  (3.5)
//   • 2 intermediate + 2 minor    (3)
//   • 4 minor                     (2)
// Elective surgeries: Wednesdays (3) and Thursdays (4) only.
// Emergencies: any day, do not count against the slate.
const CASE_POINTS = { major: 2, intermediate: 1, minor: 0.5 };
const DAY_CAPACITY_POINTS = 4;
const ELECTIVE_DAYS = [3, 4]; // Wed, Thu
const MAX_PER_CATEGORY = { major: 2, intermediate: 2, minor: 4 };

function isElectiveDayAllowed(dateStr) {
  const d = new Date(dateStr + 'T00:00:00');
  return ELECTIVE_DAYS.includes(d.getDay());
}

async function getDayCapacity(dateStr) {
  const result = await query(
    `SELECT case_category, is_emergency
     FROM surgeries
     WHERE DATE(scheduled_date) = $1
       AND status NOT IN ('cancelled', 'rescheduled')`,
    [dateStr]
  );
  let usedPoints = 0;
  const categoryCount = { major: 0, intermediate: 0, minor: 0 };
  let emergencyCount = 0;
  for (const row of result.rows) {
    if (row.is_emergency) {
      emergencyCount++;
      continue; // Emergencies don't consume slate capacity
    }
    const cat = (row.case_category || '').toLowerCase();
    if (cat in CASE_POINTS) {
      usedPoints += CASE_POINTS[cat];
      categoryCount[cat] = (categoryCount[cat] || 0) + 1;
    }
  }
  return {
    usedPoints,
    remainingPoints: Math.max(0, DAY_CAPACITY_POINTS - usedPoints),
    categoryCount,
    emergencyCount,
    capacity: DAY_CAPACITY_POINTS,
  };
}

function validateBooking(scheduledDate, caseCategory, isEmergency, currentDayState) {
  // Emergency: only require valid category, no date restriction
  if (isEmergency) return { ok: true };

  if (!isElectiveDayAllowed(scheduledDate)) {
    return { ok: false, error: 'Elective surgeries are only allowed on Wednesdays and Thursdays. Mark as emergency to override.' };
  }
  const cat = (caseCategory || '').toLowerCase();
  if (!(cat in CASE_POINTS)) {
    return { ok: false, error: 'caseCategory must be one of: major, intermediate, minor' };
  }
  const newPoints = currentDayState.usedPoints + CASE_POINTS[cat];
  if (newPoints > DAY_CAPACITY_POINTS) {
    return {
      ok: false,
      error: `Day full (${currentDayState.usedPoints}/${DAY_CAPACITY_POINTS} pts used). Adding a ${cat} (${CASE_POINTS[cat]} pts) exceeds capacity.`,
    };
  }
  if ((currentDayState.categoryCount[cat] || 0) + 1 > MAX_PER_CATEGORY[cat]) {
    return {
      ok: false,
      error: `Maximum ${MAX_PER_CATEGORY[cat]} ${cat} cases per day already reached.`,
    };
  }
  return { ok: true };
}

export default async function handler(req, res) {
  if (cors(req, res)) return;

  const auth = authenticateRequest(req);
  if (!auth.authenticated) {
    return res.status(401).json({ error: auth.error });
  }

  const { method } = req;
  const url = new URL(req.url, `http://${req.headers.host}`);
  const pathParts = url.pathname.replace('/api/surgeries', '').split('/').filter(Boolean);
  const surgeryId = pathParts[0];
  const action = url.searchParams.get('action');

  try {
    // Capacity probe — used by the UI before showing the form
    if (method === 'GET' && action === 'day-capacity') {
      const date = url.searchParams.get('date');
      if (!date) return res.status(400).json({ error: 'date query param required (YYYY-MM-DD)' });
      const cap = await getDayCapacity(date);
      return res.status(200).json({
        date,
        ...cap,
        rules: { CASE_POINTS, DAY_CAPACITY_POINTS, ELECTIVE_DAYS, MAX_PER_CATEGORY },
        electiveAllowed: isElectiveDayAllowed(date),
      });
    }

    switch (method) {
      case 'GET':
        if (surgeryId) {
          return await getSurgery(surgeryId, res);
        }
        return await getAllSurgeries(url.searchParams, res);
      case 'POST':
        return await createSurgery(req.body, auth.user, res);
      case 'PUT':
      case 'PATCH':
        if (!surgeryId) {
          return res.status(400).json({ error: 'Surgery ID required' });
        }
        return await updateSurgery(surgeryId, req.body, res);
      case 'DELETE':
        if (!surgeryId) {
          return res.status(400).json({ error: 'Surgery ID required' });
        }
        return await deleteSurgery(surgeryId, res);
      default:
        res.status(405).json({ error: 'Method not allowed' });
    }
  } catch (error) {
    console.error('Surgeries API error:', error);
    res.status(500).json({ error: 'Internal server error', message: error.message });
  }
}

async function getAllSurgeries(searchParams, res) {
  const patientId = searchParams.get('patientId');
  const status = searchParams.get('status');
  const date = searchParams.get('date');

  let queryStr = `
    SELECT s.*, p.first_name, p.last_name, p.hospital_number,
           p.gender, p.date_of_birth, p.ward AS patient_ward,
           u.full_name AS surgeon_name
    FROM surgeries s
    LEFT JOIN patients p ON s.patient_id = p.id
    LEFT JOIN users u ON s.surgeon_id = u.id
    WHERE 1=1
  `;
  const params = [];
  let paramCount = 1;

  if (patientId) {
    queryStr += ` AND s.patient_id = $${paramCount}`;
    params.push(patientId);
    paramCount++;
  }

  if (status) {
    queryStr += ` AND s.status = $${paramCount}`;
    params.push(status);
    paramCount++;
  }

  if (date) {
    queryStr += ` AND DATE(s.scheduled_date) = $${paramCount}`;
    params.push(date);
    paramCount++;
  }

  queryStr += ` ORDER BY s.scheduled_date DESC`;

  const result = await query(queryStr, params);

  res.status(200).json({ surgeries: result.rows });
}

async function getSurgery(id, res) {
  const result = await query(
    `SELECT s.*, p.first_name, p.last_name, p.hospital_number,
            p.gender, p.date_of_birth, p.ward AS patient_ward,
            u.full_name AS surgeon_name
     FROM surgeries s
     LEFT JOIN patients p ON s.patient_id = p.id
     LEFT JOIN users u ON s.surgeon_id = u.id
     WHERE s.id = $1`,
    [id]
  );

  if (result.rows.length === 0) {
    return res.status(404).json({ error: 'Surgery not found' });
  }

  res.status(200).json({ surgery: result.rows[0] });
}

async function createSurgery(data, user, res) {
  const {
    patientId, procedureName, procedureType, scheduledDate, estimatedDuration,
    surgeonId, anesthesiaType, operatingRoom, preOpNotes, requiredEquipment,
    status = 'scheduled',
    diagnosis, primarySurgeon, startTime, caseCategory, ward,
    patientAgeAtBooking, patientGender,
    needsBloodTransfusion, bloodUnitsRequested, isEmergency, isDiabetic
  } = data;

  if (!patientId || !procedureName || !scheduledDate) {
    return res.status(400).json({ error: 'Patient ID, procedure name, and scheduled date are required' });
  }

  // Theatre slate capacity validation
  const dateOnly = String(scheduledDate).slice(0, 10);
  const dayState = await getDayCapacity(dateOnly);
  const valid = validateBooking(dateOnly, caseCategory, !!isEmergency, dayState);
  if (!valid.ok) {
    return res.status(409).json({ error: valid.error, capacity: dayState });
  }

  const result = await query(
    `INSERT INTO surgeries (
      patient_id, procedure_name, procedure_type, scheduled_date, estimated_duration,
      surgeon_id, anesthesia_type, operating_room, pre_op_notes, required_equipment,
      status, created_by,
      diagnosis, primary_surgeon, start_time, case_category, ward,
      patient_age_at_booking, patient_gender,
      needs_blood_transfusion, blood_units_requested, is_emergency, is_diabetic
    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12,
              $13, $14, $15, $16, $17, $18, $19, $20, $21, $22, $23)
    RETURNING *`,
    [
      patientId, procedureName, procedureType, scheduledDate, estimatedDuration,
      surgeonId, anesthesiaType, operatingRoom, preOpNotes,
      JSON.stringify(requiredEquipment || []),
      status, user.id,
      diagnosis || null, primarySurgeon || null, startTime || null,
      caseCategory || null, ward || null,
      patientAgeAtBooking || null, patientGender || null,
      needsBloodTransfusion || false, bloodUnitsRequested || 0,
      isEmergency || false, isDiabetic || false
    ]
  );

  res.status(201).json({ surgery: result.rows[0] });
}

async function updateSurgery(id, data, res) {
  const fields = [];
  const values = [];
  let paramCount = 1;

  const fieldMap = {
    procedureName: 'procedure_name',
    procedureType: 'procedure_type',
    scheduledDate: 'scheduled_date',
    estimatedDuration: 'estimated_duration',
    surgeonId: 'surgeon_id',
    anesthesiaType: 'anesthesia_type',
    operatingRoom: 'operating_room',
    preOpNotes: 'pre_op_notes',
    postOpNotes: 'post_op_notes',
    requiredEquipment: 'required_equipment',
    status: 'status',
    actualStartTime: 'actual_start_time',
    actualEndTime: 'actual_end_time',
    diagnosis: 'diagnosis',
    primarySurgeon: 'primary_surgeon',
    startTime: 'start_time',
    caseCategory: 'case_category',
    ward: 'ward',
    patientAgeAtBooking: 'patient_age_at_booking',
    patientGender: 'patient_gender',
    needsBloodTransfusion: 'needs_blood_transfusion',
    bloodUnitsRequested: 'blood_units_requested',
    isEmergency: 'is_emergency',
    isDiabetic: 'is_diabetic'
  };

  for (const [key, dbField] of Object.entries(fieldMap)) {
    if (data[key] !== undefined) {
      fields.push(`${dbField} = $${paramCount}`);
      values.push(key === 'requiredEquipment' ? JSON.stringify(data[key]) : data[key]);
      paramCount++;
    }
  }

  if (fields.length === 0) {
    return res.status(400).json({ error: 'No fields to update' });
  }

  fields.push(`updated_at = NOW()`);
  values.push(id);

  const result = await query(
    `UPDATE surgeries SET ${fields.join(', ')} WHERE id = $${paramCount} RETURNING *`,
    values
  );

  if (result.rows.length === 0) {
    return res.status(404).json({ error: 'Surgery not found' });
  }

  res.status(200).json({ surgery: result.rows[0] });
}

async function deleteSurgery(id, res) {
  const result = await query('DELETE FROM surgeries WHERE id = $1 RETURNING id', [id]);

  if (result.rows.length === 0) {
    return res.status(404).json({ error: 'Surgery not found' });
  }

  res.status(200).json({ message: 'Surgery deleted successfully' });
}
