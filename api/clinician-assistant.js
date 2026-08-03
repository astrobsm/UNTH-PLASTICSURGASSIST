// Clinician Assistant API — saved diagnostic analyses.
//
// Routes (single file, query-dispatched like api/wounds.js):
//   GET    /api/clinician-assistant?patientId=      → a patient's analyses
//   GET    /api/clinician-assistant?action=recent   → recent across all patients
//   GET    /api/clinician-assistant?action=detail&id= → one analysis in full
//   POST   /api/clinician-assistant                 → save an analysis
//   PATCH  /api/clinician-assistant?id=             → annotate
//   DELETE /api/clinician-assistant?id=             → remove a draft
//
// The interpretation itself is computed CLIENT-side by
// src/services/clinicianAssistant/engine — pure functions that run offline on
// a ward and are unit-tested without a database. This endpoint stores what the
// engine produced and the inputs it produced it from; it contains no clinical
// logic of its own and must not acquire any, or the two would diverge.
import { query } from './_lib/db.js';
import { cors, authenticateRequest } from './_lib/auth.js';

const CLINICAL_WRITE_ROLES = [
  'admin', 'super_admin', 'consultant', 'senior_registrar',
  'registrar', 'junior_registrar', 'house_officer',
  'intern', 'junior_resident', 'senior_resident',
];

let schemaReady = false;
async function ensureTables() {
  if (schemaReady) return;
  await query(`
    CREATE TABLE IF NOT EXISTS clinician_analyses (
      id SERIAL PRIMARY KEY,
      patient_id INTEGER,
      hospital_number VARCHAR(100),
      source VARCHAR(20) NOT NULL DEFAULT 'record',
      overall_severity VARCHAR(30),
      impression JSONB DEFAULT '[]',
      next_steps JSONB DEFAULT '[]',
      modules JSONB DEFAULT '[]',
      correlations JSONB DEFAULT '[]',
      patient_context JSONB DEFAULT '{}',
      extraction JSONB DEFAULT '{}',
      unmapped JSONB DEFAULT '[]',
      engine_version VARCHAR(40),
      analysed_by INTEGER,
      analysed_at TIMESTAMPTZ DEFAULT NOW(),
      notes TEXT,
      sync_key VARCHAR(120),
      created_at TIMESTAMPTZ DEFAULT NOW(),
      updated_at TIMESTAMPTZ DEFAULT NOW()
    );
    CREATE INDEX IF NOT EXISTS idx_clin_analyses_patient ON clinician_analyses(patient_id);
    CREATE INDEX IF NOT EXISTS idx_clin_analyses_date ON clinician_analyses(analysed_at);
    CREATE INDEX IF NOT EXISTS idx_clin_analyses_severity ON clinician_analyses(overall_severity);
    CREATE UNIQUE INDEX IF NOT EXISTS ux_clinician_analyses_sync_key
      ON clinician_analyses(sync_key) WHERE sync_key IS NOT NULL;
  `);
  schemaReady = true;
}

export default async function handler(req, res) {
  if (cors(req, res)) return;

  const auth = authenticateRequest(req);
  if (!auth.authenticated) return res.status(auth.status || 401).json({ error: auth.error });

  try {
    await ensureTables();
  } catch (e) {
    console.error('ensureTables (clinician_analyses) failed:', e.message);
  }

  const url = new URL(req.url, `http://${req.headers.host}`);
  const action = url.searchParams.get('action');
  const id = url.searchParams.get('id');

  try {
    switch (req.method) {
      case 'GET':
        if (action === 'recent') return await listRecent(url.searchParams, res);
        if (action === 'detail') return await getDetail(id, res);
        return await listForPatient(url.searchParams, res);

      case 'POST':
        if (!CLINICAL_WRITE_ROLES.includes(auth.user.role)) {
          return res.status(403).json({ error: 'Insufficient permissions' });
        }
        return await saveAnalysis(req.body, auth.user, res);

      case 'PUT':
      case 'PATCH':
        if (!CLINICAL_WRITE_ROLES.includes(auth.user.role)) {
          return res.status(403).json({ error: 'Insufficient permissions' });
        }
        return await annotate(id, req.body, res);

      case 'DELETE':
        if (!['admin', 'super_admin', 'consultant'].includes(auth.user.role)) {
          return res.status(403).json({ error: 'Insufficient permissions' });
        }
        return await remove(id, res);

      default:
        return res.status(405).json({ error: 'Method not allowed' });
    }
  } catch (error) {
    console.error('clinician-assistant API error:', error);
    return res.status(500).json({ error: 'Internal server error', message: error.message });
  }
}

// ── Reads ────────────────────────────────────────────────────────────────

async function listForPatient(searchParams, res) {
  const patientId = searchParams.get('patientId');
  if (!patientId) return res.status(400).json({ error: 'patientId is required' });
  const pid = parseInt(patientId, 10);
  if (Number.isNaN(pid)) return res.status(400).json({ error: 'Invalid patientId' });

  // The heavy JSONB columns are omitted from the list: a timeline of twenty
  // analyses would otherwise ship several megabytes to render a summary row.
  const r = await query(
    `SELECT id, patient_id, hospital_number, source, overall_severity, impression,
            engine_version, analysed_by, analysed_at, notes, created_at
     FROM clinician_analyses
     WHERE patient_id = $1
     ORDER BY analysed_at DESC
     LIMIT 200`,
    [pid]
  );
  return res.status(200).json({ analyses: r.rows });
}

async function listRecent(searchParams, res) {
  const limit = Math.min(parseInt(searchParams.get('limit') || '50', 10) || 50, 200);
  const r = await query(
    `SELECT a.id, a.patient_id, a.hospital_number, a.source, a.overall_severity,
            a.impression, a.analysed_at,
            p.first_name, p.last_name
     FROM clinician_analyses a
     LEFT JOIN patients p ON p.id = a.patient_id
     ORDER BY a.analysed_at DESC
     LIMIT $1`,
    [limit]
  );
  return res.status(200).json({ analyses: r.rows });
}

async function getDetail(id, res) {
  const analysisId = parseInt(id, 10);
  if (Number.isNaN(analysisId)) return res.status(400).json({ error: 'Valid id is required' });

  const r = await query(`SELECT * FROM clinician_analyses WHERE id = $1`, [analysisId]);
  if (!r.rows.length) return res.status(404).json({ error: 'Analysis not found' });
  return res.status(200).json({ analysis: r.rows[0] });
}

// ── Writes ───────────────────────────────────────────────────────────────

async function saveAnalysis(body, user, res) {
  const b = body || {};

  const r = await query(
    `INSERT INTO clinician_analyses
      (patient_id, hospital_number, source, overall_severity, impression, next_steps,
       modules, correlations, patient_context, extraction, unmapped,
       engine_version, analysed_by, notes, sync_key)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15)
     ON CONFLICT (sync_key) WHERE sync_key IS NOT NULL
     DO UPDATE SET
       overall_severity = EXCLUDED.overall_severity,
       impression = EXCLUDED.impression,
       next_steps = EXCLUDED.next_steps,
       modules = EXCLUDED.modules,
       correlations = EXCLUDED.correlations,
       notes = EXCLUDED.notes,
       updated_at = NOW()
     RETURNING *`,
    [
      b.patient_id ? parseInt(b.patient_id, 10) : null,
      b.hospital_number || null,
      b.source || 'record',
      b.overall_severity || null,
      JSON.stringify(b.impression || []),
      JSON.stringify(b.next_steps || []),
      JSON.stringify(b.modules || []),
      JSON.stringify(b.correlations || []),
      JSON.stringify(b.patient_context || {}),
      JSON.stringify(b.extraction || {}),
      JSON.stringify(b.unmapped || []),
      b.engine_version || null,
      user.id || null,
      b.notes || null,
      b.sync_key || null,
    ]
  );
  return res.status(201).json({ analysis: r.rows[0] });
}

async function annotate(id, body, res) {
  const analysisId = parseInt(id, 10);
  if (Number.isNaN(analysisId)) return res.status(400).json({ error: 'Valid id is required' });
  const b = body || {};

  // Only the clinician's note is editable. The engine's output is a record of
  // what it said at the time and must not be rewritten after the fact.
  if (b.notes === undefined) {
    return res.status(400).json({ error: 'Only notes may be updated on a saved analysis' });
  }

  const r = await query(
    `UPDATE clinician_analyses SET notes = $1, updated_at = NOW() WHERE id = $2 RETURNING *`,
    [b.notes, analysisId]
  );
  if (!r.rows.length) return res.status(404).json({ error: 'Analysis not found' });
  return res.status(200).json({ analysis: r.rows[0] });
}

async function remove(id, res) {
  const analysisId = parseInt(id, 10);
  if (Number.isNaN(analysisId)) return res.status(400).json({ error: 'Valid id is required' });

  const r = await query(`DELETE FROM clinician_analyses WHERE id = $1 RETURNING id`, [analysisId]);
  if (!r.rows.length) return res.status(404).json({ error: 'Analysis not found' });
  return res.status(200).json({ deleted: true, id: analysisId });
}
