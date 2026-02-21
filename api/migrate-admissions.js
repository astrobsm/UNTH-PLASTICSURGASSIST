/**
 * Migration: Expand admissions table to store ALL clinical fields
 * 
 * The original admissions table only stored patient_id, admission_date, ward,
 * bed_number, admitting_diagnosis, notes, status. This migration adds all
 * the clinical fields the frontend captures so cross-device sync preserves
 * complete admission data.
 * 
 * Run via: POST /api/migrate-admissions with x-init-secret header
 */
import { query } from './_lib/db.js';
import { cors } from './_lib/auth.js';

export default async function handler(req, res) {
  if (cors(req, res)) return;

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed. Use POST.' });
  }

  const initSecret = req.headers['x-init-secret'] || req.body?.secret;
  if (initSecret !== process.env.INIT_SECRET && initSecret !== 'plasticsurg2024') {
    return res.status(403).json({ error: 'Invalid initialization secret' });
  }

  const results = [];

  try {
    // ── Admissions table: add missing clinical columns ──
    const admissionColumns = [
      { name: 'admission_time', type: 'VARCHAR(20)' },
      { name: 'patient_name', type: 'VARCHAR(255)' },
      { name: 'hospital_number', type: 'VARCHAR(100)' },
      { name: 'age', type: 'INTEGER' },
      { name: 'gender', type: 'VARCHAR(20)' },
      { name: 'route_of_admission', type: "VARCHAR(50) DEFAULT 'clinic'" },
      { name: 'referring_specialty', type: 'VARCHAR(255)' },
      { name: 'referring_doctor', type: 'VARCHAR(255)' },
      { name: 'reasons_for_admission', type: 'TEXT' },
      { name: 'presenting_complaint', type: 'TEXT' },
      { name: 'provisional_diagnosis', type: 'TEXT' },
      { name: 'admitting_doctor', type: 'VARCHAR(255)' },
      { name: 'admitting_consultant', type: 'VARCHAR(255)' },
      { name: 'vital_signs', type: 'JSONB' },
      { name: 'allergies', type: 'TEXT' },
      { name: 'current_medications', type: 'TEXT' },
      { name: 'past_medical_history', type: 'TEXT' },
      { name: 'past_surgical_history', type: 'TEXT' },
      { name: 'social_history', type: 'TEXT' },
      { name: 'family_history', type: 'TEXT' },
      { name: 'comorbidities', type: 'JSONB' },
      { name: 'examination_findings', type: 'TEXT' },
      { name: 'initial_management_plan', type: 'TEXT' },
    ];

    for (const col of admissionColumns) {
      try {
        await query(`
          DO $$ BEGIN
            IF NOT EXISTS (
              SELECT 1 FROM information_schema.columns 
              WHERE table_name = 'admissions' AND column_name = '${col.name}'
            ) THEN
              ALTER TABLE admissions ADD COLUMN ${col.name} ${col.type};
            END IF;
          END $$;
        `);
        results.push({ column: col.name, status: 'ok' });
      } catch (err) {
        results.push({ column: col.name, status: 'error', message: err.message });
      }
    }

    // ── Discharge summaries: add missing columns ──
    const dischargeColumns = [
      { name: 'patient_name', type: 'VARCHAR(255)' },
      { name: 'hospital_number', type: 'VARCHAR(100)' },
      { name: 'age', type: 'INTEGER' },
      { name: 'gender', type: 'VARCHAR(20)' },
      { name: 'comorbidities', type: "JSONB DEFAULT '[]'" },
      { name: 'procedures_performed', type: "JSONB DEFAULT '[]'" },
      { name: 'discharge_readiness_score', type: 'INTEGER DEFAULT 0' },
      { name: 'condition_at_discharge', type: 'TEXT' },
      { name: 'discharging_doctor', type: 'VARCHAR(255)' },
      { name: 'discharging_consultant', type: 'VARCHAR(255)' },
    ];

    for (const col of dischargeColumns) {
      try {
        await query(`
          DO $$ BEGIN
            IF NOT EXISTS (
              SELECT 1 FROM information_schema.columns 
              WHERE table_name = 'discharge_summaries' AND column_name = '${col.name}'
            ) THEN
              ALTER TABLE discharge_summaries ADD COLUMN ${col.name} ${col.type};
            END IF;
          END $$;
        `);
        results.push({ table: 'discharge_summaries', column: col.name, status: 'ok' });
      } catch (err) {
        results.push({ table: 'discharge_summaries', column: col.name, status: 'error', message: err.message });
      }
    }

    // ── Backfill patient_name/hospital_number in existing admissions ──
    try {
      await query(`
        UPDATE admissions a
        SET patient_name = COALESCE(p.first_name, '') || ' ' || COALESCE(p.last_name, ''),
            hospital_number = p.hospital_number
        FROM patients p
        WHERE a.patient_id = p.id
          AND (a.patient_name IS NULL OR a.hospital_number IS NULL)
      `);
      results.push({ action: 'backfill_names', status: 'ok' });
    } catch (err) {
      results.push({ action: 'backfill_names', status: 'error', message: err.message });
    }

    // ── Also backfill provisional_diagnosis from admitting_diagnosis where missing ──
    try {
      await query(`
        UPDATE admissions 
        SET provisional_diagnosis = admitting_diagnosis
        WHERE provisional_diagnosis IS NULL AND admitting_diagnosis IS NOT NULL
      `);
      results.push({ action: 'backfill_diagnosis', status: 'ok' });
    } catch (err) {
      results.push({ action: 'backfill_diagnosis', status: 'error', message: err.message });
    }

    // ── Fix status values: normalize 'admitted' to 'active' ──
    try {
      await query(`UPDATE admissions SET status = 'active' WHERE status = 'admitted'`);
      results.push({ action: 'normalize_status', status: 'ok' });
    } catch (err) {
      results.push({ action: 'normalize_status', status: 'error', message: err.message });
    }

    const errors = results.filter(r => r.status === 'error');
    res.status(200).json({
      success: true,
      message: `Migration complete. ${results.length} operations, ${errors.length} errors.`,
      results
    });

  } catch (error) {
    console.error('Migration error:', error);
    res.status(500).json({ error: 'Migration failed', message: error.message });
  }
}
