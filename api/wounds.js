// WoundProgress Monitor API.
//
// First-class longitudinal wound tracking, layered over the app's existing
// wound suite without duplicating it: image analysis still happens client-side
// via aiWoundMeasurement + /api/ocr/wound-measure; this endpoint owns the
// wound IDENTITY (the `wounds` table) and its serial `wound_assessments`
// timeline, and computes the cross-wound monitor aggregate.
//
// Routes (single file, query-dispatched like api/call-duty-roster.js):
//   GET  /api/wounds?patientId=123            → wounds for a patient
//   GET  /api/wounds?action=monitor           → dashboard aggregate
//   GET  /api/wounds?action=timeline&woundId= → assessment timeline
//   POST /api/wounds                          → create a wound
//   POST /api/wounds?action=assess            → add an assessment
//   PATCH/DELETE /api/wounds?id=              → update / archive a wound
//
// Student tokens are rejected centrally in api/_lib/auth.js.
import { query, getPool } from './_lib/db.js';
import { cors, authenticateRequest } from './_lib/auth.js';

const CLINICAL_WRITE_ROLES = [
  'admin', 'super_admin', 'consultant', 'senior_registrar',
  'registrar', 'junior_registrar', 'house_officer',
  'intern', 'junior_resident', 'senior_resident',
];

// Below this fraction of area change between visits, a wound is "not moving".
const STAGNATION_THRESHOLD = 0.03;
const MS_PER_WEEK = 7 * 24 * 60 * 60 * 1000;

// Self-healing schema: create the tables on first use so the module works even
// before POST /api/init-db has been run. Mirrors init-db.js exactly. Guarded so
// it runs at most once per warm serverless instance.
let schemaReady = false;
async function ensureWoundTables() {
  if (schemaReady) return;
  await query(`
    CREATE TABLE IF NOT EXISTS wounds (
      id SERIAL PRIMARY KEY,
      patient_id INTEGER NOT NULL,
      hospital_number VARCHAR(100),
      label VARCHAR(160),
      wound_type VARCHAR(100),
      anatomical_location VARCHAR(160),
      body_side VARCHAR(20),
      etiology VARCHAR(160),
      stage VARCHAR(60),
      date_first_seen DATE,
      date_of_injury DATE,
      cause TEXT,
      status VARCHAR(30) NOT NULL DEFAULT 'active',
      baseline_area_cm2 DECIMAL(8,2),
      latest_area_cm2 DECIMAL(8,2),
      latest_assessment_at TIMESTAMPTZ,
      assessment_count INTEGER NOT NULL DEFAULT 0,
      healing_status VARCHAR(20) DEFAULT 'insufficient_data',
      healing_velocity_cm2_per_week DECIMAL(8,3),
      created_by INTEGER,
      created_at TIMESTAMPTZ DEFAULT NOW(),
      updated_at TIMESTAMPTZ DEFAULT NOW()
    );
    CREATE INDEX IF NOT EXISTS idx_wounds_patient ON wounds(patient_id);
    CREATE INDEX IF NOT EXISTS idx_wounds_status ON wounds(status);
    CREATE INDEX IF NOT EXISTS idx_wounds_updated ON wounds(updated_at);

    CREATE TABLE IF NOT EXISTS wound_assessments (
      id SERIAL PRIMARY KEY,
      wound_id INTEGER NOT NULL,
      patient_id INTEGER NOT NULL,
      assessed_by INTEGER,
      assessed_at TIMESTAMPTZ DEFAULT NOW(),
      length_cm DECIMAL(6,2), width_cm DECIMAL(6,2), depth_cm DECIMAL(6,2),
      area_cm2 DECIMAL(8,2), perimeter_cm DECIMAL(8,2),
      granulation_pct DECIMAL(5,2), slough_pct DECIMAL(5,2),
      necrotic_pct DECIMAL(5,2), epithelial_pct DECIMAL(5,2),
      exudate_amount VARCHAR(30), exudate_type VARCHAR(50),
      edges VARCHAR(120), periwound_skin VARCHAR(160),
      signs_of_infection JSONB DEFAULT '[]', pain_score INTEGER,
      healing_stage VARCHAR(60), push_score DECIMAL(5,2), bwat_score DECIMAL(5,2),
      clinical_description TEXT, ai_confidence DECIMAL(4,3) DEFAULT 0,
      ai_raw_response JSONB DEFAULT '{}', calibration_type VARCHAR(50) DEFAULT 'none',
      scale_reliable BOOLEAN DEFAULT FALSE, contour_cm JSONB DEFAULT '[]',
      image_url TEXT, overlay_url TEXT, approved_by INTEGER, approved_at TIMESTAMPTZ,
      notes TEXT, created_at TIMESTAMPTZ DEFAULT NOW(), updated_at TIMESTAMPTZ DEFAULT NOW()
    );
    CREATE INDEX IF NOT EXISTS idx_wound_assessments_wound ON wound_assessments(wound_id);
    CREATE INDEX IF NOT EXISTS idx_wound_assessments_patient ON wound_assessments(patient_id);
    CREATE INDEX IF NOT EXISTS idx_wound_assessments_date ON wound_assessments(assessed_at);
  `);
  schemaReady = true;
}

export default async function handler(req, res) {
  if (cors(req, res)) return;

  const auth = authenticateRequest(req);
  if (!auth.authenticated) {
    return res.status(auth.status || 401).json({ error: auth.error });
  }

  try {
    await ensureWoundTables();
  } catch (e) {
    console.error('ensureWoundTables failed:', e.message);
    // Continue — the queries below will surface a clearer error if the table
    // genuinely does not exist.
  }

  const url = new URL(req.url, `http://${req.headers.host}`);
  const action = url.searchParams.get('action');

  try {
    switch (req.method) {
      case 'GET':
        if (action === 'monitor') return await getMonitor(res);
        if (action === 'timeline') return await getTimeline(url.searchParams, res);
        return await listWounds(url.searchParams, res);

      case 'POST':
        if (!CLINICAL_WRITE_ROLES.includes(auth.user.role)) {
          return res.status(403).json({ error: 'Insufficient permissions' });
        }
        if (action === 'assess') return await addAssessment(req.body, auth.user, res);
        return await createWound(req.body, auth.user, res);

      case 'PUT':
      case 'PATCH':
        if (!CLINICAL_WRITE_ROLES.includes(auth.user.role)) {
          return res.status(403).json({ error: 'Insufficient permissions' });
        }
        return await updateWound(url.searchParams, req.body, res);

      case 'DELETE':
        if (!['admin', 'super_admin', 'consultant'].includes(auth.user.role)) {
          return res.status(403).json({ error: 'Insufficient permissions' });
        }
        return await archiveWound(url.searchParams, res);

      default:
        return res.status(405).json({ error: 'Method not allowed' });
    }
  } catch (error) {
    console.error('wounds API error:', error);
    return res.status(500).json({ error: 'Internal server error', message: error.message });
  }
}

// ── Reads ────────────────────────────────────────────────────────────────

async function listWounds(searchParams, res) {
  const patientId = searchParams.get('patientId');
  if (!patientId) {
    return res.status(400).json({ error: 'patientId is required' });
  }
  const pid = parseInt(patientId, 10);
  if (Number.isNaN(pid)) return res.status(400).json({ error: 'Invalid patientId' });

  const result = await query(
    `SELECT * FROM wounds WHERE patient_id = $1 ORDER BY status = 'active' DESC, updated_at DESC`,
    [pid]
  );
  return res.status(200).json({ wounds: result.rows });
}

async function getTimeline(searchParams, res) {
  const woundId = searchParams.get('woundId');
  if (!woundId) return res.status(400).json({ error: 'woundId is required' });
  const wid = parseInt(woundId, 10);
  if (Number.isNaN(wid)) return res.status(400).json({ error: 'Invalid woundId' });

  const result = await query(
    `SELECT * FROM wound_assessments WHERE wound_id = $1 ORDER BY assessed_at DESC LIMIT 500`,
    [wid]
  );
  return res.status(200).json({ assessments: result.rows });
}

async function getMonitor(res) {
  // Aggregate over active wounds. The denormalised columns on `wounds`
  // (updated by recomputeWound) keep this a single scan, no N+1.
  const result = await query(
    `SELECT w.*, p.first_name, p.last_name, p.hospital_number AS patient_hospital_number
     FROM wounds w
     LEFT JOIN patients p ON p.id = w.patient_id
     WHERE w.status = 'active'
     ORDER BY
       CASE w.healing_status
         WHEN 'worsening' THEN 0
         WHEN 'stagnant' THEN 1
         WHEN 'improving' THEN 2
         ELSE 3
       END,
       w.updated_at DESC
     LIMIT 500`
  );
  const wounds = result.rows;

  const oneWeekAgo = new Date(Date.now() - MS_PER_WEEK).toISOString();
  const healedThisWeek = (await query(
    `SELECT COUNT(*)::int AS n FROM wounds WHERE status = 'healed' AND updated_at > $1`,
    [oneWeekAgo]
  )).rows[0].n;

  const velocities = wounds
    .map(w => (w.healing_velocity_cm2_per_week == null ? null : Number(w.healing_velocity_cm2_per_week)))
    .filter(v => v != null && Number.isFinite(v));

  return res.status(200).json({
    totalActive: wounds.length,
    improving: wounds.filter(w => w.healing_status === 'improving').length,
    stagnant: wounds.filter(w => w.healing_status === 'stagnant').length,
    worsening: wounds.filter(w => w.healing_status === 'worsening').length,
    healedThisWeek,
    avgVelocityCm2PerWeek: velocities.length
      ? velocities.reduce((s, v) => s + v, 0) / velocities.length
      : null,
    wounds,
  });
}

// ── Writes ───────────────────────────────────────────────────────────────

async function createWound(body, user, res) {
  const patientId = parseInt(body?.patient_id, 10);
  if (Number.isNaN(patientId)) return res.status(400).json({ error: 'patient_id is required' });

  const patient = await query('SELECT id, hospital_number FROM patients WHERE id = $1', [patientId]);
  if (patient.rows.length === 0) return res.status(404).json({ error: 'Patient not found' });

  const result = await query(
    `INSERT INTO wounds
       (patient_id, hospital_number, label, wound_type, anatomical_location, body_side,
        etiology, stage, date_first_seen, date_of_injury, cause, status, created_by)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,'active',$12)
     RETURNING *`,
    [
      patientId,
      body.hospital_number || patient.rows[0].hospital_number || null,
      body.label || null,
      body.wound_type || null,
      body.anatomical_location || null,
      body.body_side || null,
      body.etiology || null,
      body.stage || null,
      body.date_first_seen || null,
      body.date_of_injury || null,
      body.cause || null,
      user.id || null,
    ]
  );
  return res.status(201).json({ wound: result.rows[0] });
}

async function addAssessment(body, user, res) {
  const woundId = parseInt(body?.wound_id, 10);
  if (Number.isNaN(woundId)) return res.status(400).json({ error: 'wound_id is required' });

  const wound = await query('SELECT id, patient_id FROM wounds WHERE id = $1', [woundId]);
  if (wound.rows.length === 0) return res.status(404).json({ error: 'Wound not found' });
  const patientId = wound.rows[0].patient_id;

  // Insert the assessment and recompute the wound's denormalised analytics in a
  // single transaction, so a reader never sees an assessment without its wound
  // summary updated (and a mid-way failure rolls both back).
  const client = await getPool().connect();
  try {
    await client.query('BEGIN');

    const inserted = await client.query(
      `INSERT INTO wound_assessments
         (wound_id, patient_id, assessed_by, assessed_at, length_cm, width_cm, depth_cm,
          area_cm2, perimeter_cm, granulation_pct, slough_pct, necrotic_pct, epithelial_pct,
          exudate_amount, exudate_type, edges, periwound_skin, signs_of_infection, pain_score,
          healing_stage, push_score, bwat_score, clinical_description, ai_confidence,
          ai_raw_response, calibration_type, scale_reliable, contour_cm, image_url, overlay_url,
          approved_by, approved_at, notes)
       VALUES ($1,$2,$3,COALESCE($4, NOW()),$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,
               $19,$20,$21,$22,$23,$24,$25,$26,$27,$28,$29,$30,$31,$32,$33)
       RETURNING *`,
      [
        woundId, patientId, user.id || null, body.assessed_at || null,
        num(body.length_cm), num(body.width_cm), num(body.depth_cm), num(body.area_cm2),
        num(body.perimeter_cm), num(body.granulation_pct), num(body.slough_pct),
        num(body.necrotic_pct), num(body.epithelial_pct),
        body.exudate_amount || null, body.exudate_type || null, body.edges || null,
        body.periwound_skin || null, JSON.stringify(body.signs_of_infection || []),
        num(body.pain_score), body.healing_stage || null, num(body.push_score), num(body.bwat_score),
        body.clinical_description || null, num(body.ai_confidence) ?? 0,
        JSON.stringify(body.ai_raw_response || {}), body.calibration_type || 'none',
        body.scale_reliable === true, JSON.stringify(body.contour_cm || []),
        body.image_url || null, body.overlay_url || null,
        body.approved_by || user.id || null, body.approved_at || null, body.notes || null,
      ]
    );

    await recomputeWound(client, woundId);
    await client.query('COMMIT');
    return res.status(201).json({ assessment: inserted.rows[0] });
  } catch (txErr) {
    await client.query('ROLLBACK').catch(() => {});
    throw txErr;
  } finally {
    client.release();
  }
}

async function updateWound(searchParams, body, res) {
  const id = parseInt(searchParams.get('id') || body?.id, 10);
  if (Number.isNaN(id)) return res.status(400).json({ error: 'id is required' });

  const allowed = ['label', 'wound_type', 'anatomical_location', 'body_side', 'etiology',
    'stage', 'date_first_seen', 'date_of_injury', 'cause', 'status'];
  const sets = [];
  const params = [];
  for (const key of allowed) {
    if (body[key] !== undefined) {
      params.push(body[key]);
      sets.push(`${key} = $${params.length}`);
    }
  }
  if (sets.length === 0) return res.status(400).json({ error: 'No fields to update' });
  params.push(id);
  const result = await query(
    `UPDATE wounds SET ${sets.join(', ')}, updated_at = NOW() WHERE id = $${params.length} RETURNING *`,
    params
  );
  if (result.rows.length === 0) return res.status(404).json({ error: 'Wound not found' });
  return res.status(200).json({ wound: result.rows[0] });
}

async function archiveWound(searchParams, res) {
  const id = parseInt(searchParams.get('id'), 10);
  if (Number.isNaN(id)) return res.status(400).json({ error: 'id is required' });
  // Soft archive, never a hard delete — the timeline is a clinical record.
  const result = await query(
    `UPDATE wounds SET status = 'archived', updated_at = NOW() WHERE id = $1 RETURNING id`,
    [id]
  );
  if (result.rows.length === 0) return res.status(404).json({ error: 'Wound not found' });
  return res.status(200).json({ message: 'Wound archived', id: result.rows[0].id });
}

// ── Analytics (mirrors src/services/woundMonitorService computeHealingAnalytics) ──

async function recomputeWound(client, woundId) {
  const rows = (await client.query(
    `SELECT assessed_at, area_cm2, scale_reliable
     FROM wound_assessments WHERE wound_id = $1 AND area_cm2 IS NOT NULL
     ORDER BY assessed_at ASC`,
    [woundId]
  )).rows;

  const series = rows
    .map(r => ({ t: new Date(r.assessed_at).getTime(), area: Number(r.area_cm2) }))
    .filter(p => Number.isFinite(p.t) && Number.isFinite(p.area));

  const count = series.length;
  let baseline = null, latest = null, latestAt = null, velocity = null, status = 'insufficient_data';

  if (count > 0) {
    baseline = series[0].area;
    latest = series[count - 1].area;
    latestAt = new Date(series[count - 1].t).toISOString();
  }

  if (count >= 2) {
    // Least-squares slope, area (cm²) vs time (weeks).
    const t0 = series[0].t;
    const xs = series.map(p => (p.t - t0) / MS_PER_WEEK);
    const ys = series.map(p => p.area);
    const n = xs.length;
    const mX = xs.reduce((s, v) => s + v, 0) / n;
    const mY = ys.reduce((s, v) => s + v, 0) / n;
    let numr = 0, den = 0;
    for (let i = 0; i < n; i++) { numr += (xs[i] - mX) * (ys[i] - mY); den += (xs[i] - mX) ** 2; }
    velocity = den === 0 ? 0 : numr / den;

    const pctReduction = baseline > 0 ? ((baseline - latest) / baseline) * 100 : 0;
    if (latest === 0) status = 'healed';
    else if (velocity > baseline * 0.01) status = 'worsening';
    else if (Math.abs(pctReduction) < STAGNATION_THRESHOLD * 100) status = 'stagnant';
    else if (velocity < 0) status = 'improving';
    else status = 'stagnant';
  } else if (count === 1 && latest === 0) {
    status = 'healed';
  }

  const woundStatus = status === 'healed' ? 'healed' : undefined;

  await client.query(
    `UPDATE wounds SET
       baseline_area_cm2 = $2,
       latest_area_cm2 = $3,
       latest_assessment_at = $4,
       assessment_count = $5,
       healing_status = $6,
       healing_velocity_cm2_per_week = $7,
       status = COALESCE($8, status),
       updated_at = NOW()
     WHERE id = $1`,
    [woundId, baseline, latest, latestAt, count, status, velocity, woundStatus]
  );
}

function num(v) {
  if (v === undefined || v === null || v === '') return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}
