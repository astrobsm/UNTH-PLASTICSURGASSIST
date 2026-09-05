// Bulk patient register + admit endpoint — Vercel serverless.
// Accepts an array of rows; for each row it registers the patient and (unless
// disabled) immediately admits them, in a single submit. Per-row error isolation
// so one bad row never fails the whole batch.
import { query } from './_lib/db.js';
import { cors, authenticateRequest } from './_lib/auth.js';
import { assignPatientToStudentGroup } from './_lib/studentAssignment.js';

const STAFF_ROLES = ['admin', 'super_admin', 'consultant', 'senior_registrar', 'junior_registrar', 'registrar', 'house_officer'];

function genHospitalNumber() {
  return `PS${Date.now().toString().slice(-8)}${Math.floor(Math.random() * 90 + 10)}`;
}

export default async function handler(req, res) {
  if (cors(req, res)) return;

  const auth = authenticateRequest(req);
  if (!auth.authenticated) {
    return res.status(401).json({ error: auth.error });
  }
  if (!STAFF_ROLES.includes(auth.user.role)) {
    return res.status(403).json({ error: 'You do not have permission to register/admit patients.' });
  }
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { rows } = req.body || {};
  if (!Array.isArray(rows) || rows.length === 0) {
    return res.status(400).json({ error: 'A non-empty "rows" array is required.' });
  }

  const results = { registered: 0, admitted: 0, success: [], failed: [] };

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i] || {};
    const first_name = (row.first_name || row.firstName || '').trim();
    const last_name = (row.last_name || row.lastName || '').trim();

    if (!first_name || !last_name) {
      results.failed.push({ index: i, name: `${first_name} ${last_name}`.trim() || 'N/A', error: 'First and last name are required' });
      continue;
    }

    const hospital_number = (row.hospital_number || row.hospitalNumber || '').trim() || genHospitalNumber();

    try {
      // 1) Register the patient
      const patientInsert = await query(
        `INSERT INTO patients (
           hospital_number, first_name, last_name, date_of_birth, gender,
           phone, email, address, blood_group, allergies, medical_history,
           primary_diagnosis, secondary_diagnoses,
           emergency_contact_name, emergency_contact_phone, created_by
         ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16)
         RETURNING id, hospital_number, first_name, last_name`,
        [
          hospital_number, first_name, last_name,
          row.date_of_birth || row.dateOfBirth || null,
          row.gender || row.sex || null,
          row.phone || null, row.email || null, row.address || null,
          row.blood_group || row.bloodGroup || null,
          Array.isArray(row.allergies) ? row.allergies.join(', ') : (row.allergies || null),
          row.medical_history || row.medicalHistory || null,
          row.primary_diagnosis || row.diagnosis || row.admitting_diagnosis || null,
          JSON.stringify(row.secondary_diagnoses || []),
          row.emergency_contact_name || row.emergencyContactName || null,
          row.emergency_contact_phone || row.emergencyContactPhone || null,
          auth.user.id || null,
        ]
      );

      const patient = patientInsert.rows[0];
      results.registered++;

      const rowResult = { index: i, patientId: patient.id, hospitalNumber: patient.hospital_number, name: `${first_name} ${last_name}`, admitted: false };

      // 2) Admit (unless explicitly disabled with admit === false)
      if (row.admit !== false) {
        const admissionDate = row.admission_date || row.admissionDate || new Date().toISOString();
        try {
          await query(
            `INSERT INTO admissions (
               patient_id, admission_date, ward, bed_number,
               admitting_diagnosis, reasons_for_admission, provisional_diagnosis,
               presenting_complaint, notes, status, created_by,
               patient_name, hospital_number, gender, admitting_consultant, admitting_doctor
             ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,'active',$10,$11,$12,$13,$14,$15)`,
            [
              patient.id, admissionDate,
              row.ward || row.ward_location || null,
              row.bed_number || row.bedNumber || null,
              row.admitting_diagnosis || row.admittingDiagnosis || row.diagnosis || null,
              row.admitting_diagnosis || row.reasons_for_admission || row.diagnosis || null,
              row.provisional_diagnosis || row.admitting_diagnosis || row.diagnosis || null,
              row.presenting_complaint || row.presentingComplaint || null,
              row.notes || null,
              auth.user.id || null,
              `${first_name} ${last_name}`,
              hospital_number,
              row.gender || row.sex || null,
              row.consultant || row.admitting_consultant || row.admittingConsultant || null,
              row.admitting_doctor || row.admittingDoctor || (auth.user.fullName || null),
            ]
          );
          results.admitted++;
          rowResult.admitted = true;

          // Same allocation as a single admission. A bulk intake is exactly
          // when the ward most needs splitting between student groups, and
          // waiting for someone to press the bulk assign afterwards is what
          // this removes. Never throws.
          const alloc = await assignPatientToStudentGroup({
            patientId: patient.id,
            hospitalNumber: hospital_number,
            patientName: `${first_name} ${last_name}`.trim(),
          });
          if (alloc.assigned) rowResult.studentGroup = alloc.group;
        } catch (admErr) {
          rowResult.admitError = admErr.message;
        }
      }

      results.success.push(rowResult);
    } catch (err) {
      // Unique hospital_number clash or other insert error
      results.failed.push({ index: i, name: `${first_name} ${last_name}`, hospital_number, error: err.message });
    }
  }

  return res.status(200).json({
    message: `Registered ${results.registered}, admitted ${results.admitted}, failed ${results.failed.length}.`,
    ...results,
  });
}
