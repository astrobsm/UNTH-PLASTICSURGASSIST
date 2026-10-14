// Vital Signs API endpoint for Vercel serverless
import { query } from './_lib/db.js';
import { ensureRecordStatus, markEnteredInError, notInError, reasonFrom, auditClinical } from './_lib/clinicalRecords.js';

import { cors, authenticateRequest } from './_lib/auth.js';

async function ensureTable() {
  await query(`
    CREATE TABLE IF NOT EXISTS vital_signs (
      id SERIAL PRIMARY KEY,
      patient_id VARCHAR(100) NOT NULL,
      hospital_number VARCHAR(100),
      temperature DECIMAL(4,1),
      pulse INTEGER,
      bp_systolic INTEGER,
      bp_diastolic INTEGER,
      respiratory_rate INTEGER,
      spo2 INTEGER,
      weight DECIMAL(5,1),
      recorded_by VARCHAR(255),
      date TIMESTAMPTZ DEFAULT NOW(),
      created_at TIMESTAMPTZ DEFAULT NOW()
    )
  `);
}

export default async function handler(req, res) {
  if (cors(req, res)) return;

  const auth = authenticateRequest(req);
  if (!auth.authenticated) {
    return res.status(401).json({ error: auth.error });
  }

  try {
    await ensureTable();
    await ensureRecordStatus('vital_signs');

    if (req.method === 'GET') {
      const patientId = req.query.patientId;
      if (!patientId) return res.status(400).json({ error: 'patientId is required' });

      const result = await query(
        `SELECT * FROM vital_signs WHERE patient_id = $1 AND ${notInError()} ORDER BY date ASC`,
        [patientId]
      );
      return res.status(200).json({ vitals: result.rows });
    }

    if (req.method === 'POST') {
      const { patient_id, hospital_number, temperature, pulse, bp_systolic, bp_diastolic, respiratory_rate, spo2, weight, recorded_by, date } = req.body;

      if (!patient_id) return res.status(400).json({ error: 'patient_id is required' });

      const result = await query(
        `INSERT INTO vital_signs (patient_id, hospital_number, temperature, pulse, bp_systolic, bp_diastolic, respiratory_rate, spo2, weight, recorded_by, date)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
         RETURNING *`,
        // val(): a recorded 0 stays 0 — `x || null` turned it into "no value".
        [patient_id, hospital_number || null, val(temperature), val(pulse), val(bp_systolic), val(bp_diastolic), val(respiratory_rate), val(spo2), val(weight), recorded_by || null, date || new Date().toISOString()]
      );
      await auditClinical(auth.user, { action: 'create', entity: 'vital_signs', entityId: result.rows[0].id, patientId: patient_id });
      return res.status(201).json({ vital: result.rows[0] });
    }

    if (req.method === 'PUT') {
      const { id, temperature, pulse, bp_systolic, bp_diastolic, respiratory_rate, spo2, weight, recorded_by, date } = req.body;
      if (!id) return res.status(400).json({ error: 'id is required' });

      const result = await query(
        `UPDATE vital_signs SET temperature=$1, pulse=$2, bp_systolic=$3, bp_diastolic=$4, respiratory_rate=$5, spo2=$6, weight=$7, recorded_by=$8, date=$9
         WHERE id=$10 RETURNING *`,
        [val(temperature), val(pulse), val(bp_systolic), val(bp_diastolic), val(respiratory_rate), val(spo2), val(weight), recorded_by || null, date || new Date().toISOString(), id]
      );
      if (result.rows.length === 0) return res.status(404).json({ error: 'Vital sign record not found' });
      await auditClinical(auth.user, { action: 'update', entity: 'vital_signs', entityId: id, patientId: result.rows[0].patient_id });
      return res.status(200).json({ vital: result.rows[0] });
    }

    if (req.method === 'DELETE') {
      const id = req.query.id;
      if (!id) return res.status(400).json({ error: 'id query parameter is required' });

      // Marked entered-in-error, not deleted.
      const row = await markEnteredInError('vital_signs', id, auth.user, reasonFrom(req));
      if (!row) return res.status(404).json({ error: 'Vital sign record not found' });
      return res.status(200).json({ success: true, deleted: row.id, status: 'entered_in_error' });
    }

    return res.status(405).json({ error: 'Method not allowed' });
  } catch (error) {
    console.error('Vital signs API error:', error);
    return res.status(500).json({ error: 'Internal server error', message: error.message });
  }
}

/** A measurement as sent, or null when it was not recorded. 0 is a value. */
function val(v) {
  return v === undefined || v === null || v === '' ? null : v;
}
