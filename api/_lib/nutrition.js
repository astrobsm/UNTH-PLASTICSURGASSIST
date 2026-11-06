// ============================================================================
// Clinical nutrition — storage, roles and the patient nutrition record.
//
// Calculations live in src/clinical/nutrition (pure, versioned, tested). This
// layer stores inputs, results and approvals, and assembles one patient's
// nutrition record from three places without copying any value:
//   nutrition_measurements  — anthropometry and manually entered labs
//   vital_signs.weight      — weights recorded on the vitals chart / ward round
//   lab_orders.results      — analytes from completed lab orders
// ============================================================================
import { query } from './db.js';
import { ensureRecordStatus, notInError } from './clinicalRecords.js';

// Same statements as database/migrations/024_clinical_nutrition.up.sql
// (src/test/nutritionApi.test.ts keeps the two in step).
export const NUTRITION_DDL = [
  `CREATE TABLE IF NOT EXISTS nutrition_measurements (
  id SERIAL PRIMARY KEY,
  patient_id TEXT NOT NULL,
  kind TEXT NOT NULL,
  value NUMERIC NOT NULL,
  unit TEXT NOT NULL,
  method TEXT,
  measured_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  note TEXT,
  status TEXT NOT NULL DEFAULT 'active',
  error_reason TEXT,
  entered_by INTEGER, entered_by_name TEXT, entered_by_role TEXT,
  created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
)`,
  `CREATE INDEX IF NOT EXISTS idx_nutrition_measurements_patient ON nutrition_measurements (patient_id, kind, measured_at)`,
  `CREATE TABLE IF NOT EXISTS nutrition_assessments (
  id SERIAL PRIMARY KEY,
  patient_id TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'draft',
  inputs JSONB NOT NULL DEFAULT '{}',
  result JSONB NOT NULL DEFAULT '{}',
  summary JSONB NOT NULL DEFAULT '{}',
  config_version TEXT NOT NULL,
  version INTEGER NOT NULL DEFAULT 1,
  created_by INTEGER, created_by_name TEXT, created_by_role TEXT,
  created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
  approved_by INTEGER, approved_by_name TEXT, approved_by_role TEXT, approved_at TIMESTAMPTZ,
  error_reason TEXT
)`,
  `CREATE INDEX IF NOT EXISTS idx_nutrition_assessments_patient ON nutrition_assessments (patient_id, created_at DESC)`,
  `CREATE TABLE IF NOT EXISTS nutrition_meal_plans (
  id SERIAL PRIMARY KEY,
  patient_id TEXT NOT NULL,
  assessment_id INTEGER,
  status TEXT NOT NULL DEFAULT 'draft',
  targets JSONB NOT NULL DEFAULT '{}',
  plan JSONB NOT NULL DEFAULT '{}',
  solver JSONB NOT NULL DEFAULT '{}',
  config_version TEXT NOT NULL,
  food_data_version TEXT,
  version INTEGER NOT NULL DEFAULT 1,
  created_by INTEGER, created_by_name TEXT, created_by_role TEXT,
  created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
  approved_by INTEGER, approved_by_name TEXT, approved_by_role TEXT, approved_at TIMESTAMPTZ,
  superseded_by INTEGER,
  error_reason TEXT
)`,
  `CREATE INDEX IF NOT EXISTS idx_nutrition_meal_plans_patient ON nutrition_meal_plans (patient_id, created_at DESC)`,
  `CREATE TABLE IF NOT EXISTS nutrition_intake (
  id SERIAL PRIMARY KEY,
  patient_id TEXT NOT NULL,
  intake_date DATE NOT NULL,
  meal TEXT NOT NULL,
  plan_id INTEGER,
  items JSONB NOT NULL DEFAULT '[]',
  kcal NUMERIC NOT NULL DEFAULT 0,
  protein_g NUMERIC NOT NULL DEFAULT 0,
  target_kcal NUMERIC,
  target_protein_g NUMERIC,
  note TEXT,
  recorded_by INTEGER, recorded_by_name TEXT, recorded_by_role TEXT,
  created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
  UNIQUE (patient_id, intake_date, meal)
)`,
  `CREATE TABLE IF NOT EXISTS nutrition_food_sources (
  id SERIAL PRIMARY KEY,
  code TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  version TEXT,
  licence TEXT,
  url TEXT,
  row_count INTEGER DEFAULT 0,
  imported_at TIMESTAMPTZ,
  imported_by_name TEXT
)`,
  `CREATE TABLE IF NOT EXISTS nutrition_foods (
  id SERIAL PRIMARY KEY,
  source_code TEXT NOT NULL,
  food_code TEXT NOT NULL,
  name TEXT NOT NULL,
  local_names JSONB NOT NULL DEFAULT '{}',
  food_group TEXT,
  per100g JSONB NOT NULL DEFAULT '{}',
  edible_portion NUMERIC,
  yield_factor NUMERIC,
  state TEXT,
  min_portion_g NUMERIC,
  max_portion_g NUMERIC,
  unit_g NUMERIC,
  unit_label TEXT,
  cost_tier TEXT,
  seasonality TEXT,
  availability JSONB NOT NULL DEFAULT '{}',
  tags JSONB NOT NULL DEFAULT '[]',
  active BOOLEAN NOT NULL DEFAULT TRUE,
  updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
  UNIQUE (source_code, food_code)
)`,
  `CREATE TABLE IF NOT EXISTS nutrition_recipes (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  local_name TEXT,
  category TEXT,
  meal_slots JSONB NOT NULL DEFAULT '[]',
  portion_g NUMERIC,
  yield_factor NUMERIC,
  texture TEXT,
  tags JSONB NOT NULL DEFAULT '[]',
  status TEXT NOT NULL DEFAULT 'draft',
  notes TEXT,
  verified_by_name TEXT, verified_at TIMESTAMPTZ,
  created_by_name TEXT,
  created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
  UNIQUE (name)
)`,
  `CREATE TABLE IF NOT EXISTS nutrition_recipe_ingredients (
  id SERIAL PRIMARY KEY,
  recipe_id INTEGER NOT NULL,
  food_id INTEGER NOT NULL,
  raw_g NUMERIC NOT NULL,
  note TEXT
)`,
  `CREATE INDEX IF NOT EXISTS idx_nutrition_recipe_ingredients ON nutrition_recipe_ingredients (recipe_id)`,
  `CREATE TABLE IF NOT EXISTS nutrition_household_measures (
  id SERIAL PRIMARY KEY,
  food_id INTEGER,
  recipe_id INTEGER,
  measure TEXT NOT NULL,
  grams NUMERIC NOT NULL,
  verified BOOLEAN NOT NULL DEFAULT FALSE,
  verified_by_name TEXT, verified_at TIMESTAMPTZ,
  note TEXT,
  created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
)`,
  `CREATE TABLE IF NOT EXISTS nutrition_config_signoffs (
  id SERIAL PRIMARY KEY,
  config_version TEXT NOT NULL,
  signed_by INTEGER, signed_by_name TEXT, signed_by_role TEXT,
  signed_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
  note TEXT
)`,
];

let ensured = false;
export async function ensureNutritionTables() {
  if (ensured) return;
  for (const s of NUTRITION_DDL) await query(s);
  ensured = true;
}

// ── Roles ───────────────────────────────────────────────────────────────────
/** Approve assessments and meal plans (user decision: SR, consultant or dietitian). */
export const APPROVER_ROLES = ['dietitian', 'consultant', 'senior_registrar'];
/** Record intake and measurements only. */
export const RECORD_ONLY_ROLES = ['nurse', 'nursing'];
/** Cannot touch nutrition records at all (students are blocked at auth). */
export const NO_ACCESS_ROLES = ['lab', 'pharmacy'];
/** Maintain the food table, recipes and household measures. */
export const FOOD_ADMIN_ROLES = ['dietitian', 'consultant', 'admin', 'super_admin'];

export const canApprove = (u) => APPROVER_ROLES.includes(u?.role);
export const canRecord = (u) => !!u?.role && !NO_ACCESS_ROLES.includes(u.role);
export const canDraft = (u) => canRecord(u) && !RECORD_ONLY_ROLES.includes(u.role);
export const canAdminFoods = (u) => FOOD_ADMIN_ROLES.includes(u?.role);

const nameOf = (u) => u?.full_name || u?.name || u?.username || null;

// ── Measurements ────────────────────────────────────────────────────────────
/** Every measurement kind, its SI unit and a plausibility range. */
export const MEASUREMENT_KINDS = {
  weight: { unit: 'kg', min: 10, max: 400 },
  dressing_weight: { unit: 'kg', min: 0, max: 30 },
  height: { unit: 'cm', min: 90, max: 230 },
  knee_height: { unit: 'cm', min: 30, max: 75 },
  ulna: { unit: 'cm', min: 15, max: 40 },
  muac: { unit: 'cm', min: 10, max: 70 },
  tsf: { unit: 'mm', min: 1, max: 80 },
  calf: { unit: 'cm', min: 15, max: 70 },
  grip: { unit: 'kg', min: 0, max: 100 },
  phase_angle: { unit: '°', min: 1, max: 15 },
  quadriceps: { unit: 'mm', min: 2, max: 80 },
  indirect_calorimetry: { unit: 'kcal/day', min: 300, max: 6000 },
  albumin: { unit: 'g/L', min: 5, max: 70 },
  prealbumin: { unit: 'g/L', min: 0.01, max: 1 },
  crp: { unit: 'mg/L', min: 0, max: 600 },
  hb: { unit: 'g/L', min: 20, max: 250 },
  lymphocytes: { unit: '×10⁹/L', min: 0, max: 100 },
  glucose: { unit: 'mmol/L', min: 0.5, max: 60 },
  hba1c: { unit: '%', min: 3, max: 20 },
  urea: { unit: 'mmol/L', min: 0.5, max: 100 },
  creatinine: { unit: 'µmol/L', min: 10, max: 3000 },
  na: { unit: 'mmol/L', min: 90, max: 200 },
  k: { unit: 'mmol/L', min: 1, max: 10 },
  po4: { unit: 'mmol/L', min: 0.05, max: 6 },
  mg: { unit: 'mmol/L', min: 0.1, max: 5 },
  uun: { unit: 'g/day', min: 0, max: 60 },
};

export function validateMeasurement(m) {
  const k = MEASUREMENT_KINDS[m?.kind];
  if (!k) return 'Unknown measurement kind';
  const v = Number(m.value);
  if (!Number.isFinite(v)) return 'Value must be a number';
  if (v < k.min || v > k.max) return `${m.kind} ${v} ${k.unit} is outside the plausible range ${k.min}–${k.max}`;
  if (m.measured_at && Number.isNaN(Date.parse(m.measured_at))) return 'Invalid measurement date';
  if (m.measured_at && Date.parse(m.measured_at) > Date.now() + 5 * 60_000) return 'Measurement date is in the future';
  return null;
}

// ── Lab analytes from lab_orders.results (free-form JSON) ──────────────────
const ANALYTES = [
  ['prealbumin', /pre-?albumin|transthyretin/i],
  ['albumin', /^(serum\s+)?albumin\b|^alb$/i],
  ['crp', /\bcrp\b|c-?reactive/i],
  ['hba1c', /hba1c|glycated|glycosylated/i],
  ['glucose', /glucose|\bfbs\b|\brbs\b|\bfbg\b|\brbg\b/i],
  ['hb', /^(hb|hgb)$|ha?emoglobin/i],
  ['lymphocytes', /lymphocyte/i],
  ['urea', /^(serum\s+)?urea\b|\bbun\b/i],
  ['creatinine', /creatinine/i],
  ['na', /^(na\+?|sodium)\b/i],
  ['k', /^(k\+?|potassium)\b/i],
  ['po4', /phosph|^po4/i],
  ['mg', /^(mg2?\+?|magnesium)\b/i],
];
const kindOfName = (name) => { const s = String(name || '').trim(); for (const [k, re] of ANALYTES) if (re.test(s)) return k; return null; };

/** Convert common non-SI reports to the units MEASUREMENT_KINDS uses. */
export function toSI(kind, value, unit = '') {
  const u = String(unit).toLowerCase().replace(/\s/g, '');
  let v = Number(value);
  if (!Number.isFinite(v)) return null;
  if (kind === 'albumin' && (u === 'g/dl' || (!u && v < 10))) v *= 10;
  if (kind === 'hb' && (u === 'g/dl' || (!u && v < 25))) v *= 10;
  if (kind === 'prealbumin' && (u === 'mg/dl' || (!u && v > 1 && v < 100))) v /= 100;
  if (kind === 'prealbumin' && u === 'mg/l') v /= 1000;
  if (kind === 'glucose' && (u === 'mg/dl' || (!u && v > 40))) v /= 18;
  if (kind === 'creatinine' && (u === 'mg/dl' || (!u && v < 20))) v *= 88.4;
  if (kind === 'urea' && u === 'mg/dl') v /= 6;
  if (kind === 'po4' && u === 'mg/dl') v *= 0.3229;
  if (kind === 'mg' && u === 'mg/dl') v *= 0.4114;
  return Math.round(v * 1000) / 1000;
}

/** Pull nutrition analytes out of a lab order's results JSON, whatever its shape. */
export function parseLabAnalytes(results) {
  let r = results;
  if (typeof r === 'string') { try { r = JSON.parse(r); } catch { return []; } }
  const out = [];
  const push = (name, value, unit) => {
    const kind = kindOfName(name);
    if (!kind) return;
    const num = typeof value === 'number' ? value : parseFloat(String(value ?? '').replace(/[^\d.\-]/g, ''));
    if (!Number.isFinite(num)) return;
    const si = toSI(kind, num, unit);
    if (si === null) return;
    const k = MEASUREMENT_KINDS[kind];
    if (si < k.min || si > k.max) return;
    if (!out.some(o => o.kind === kind)) out.push({ kind, value: si, unit: k.unit });
  };
  const walk = (node, depth = 0) => {
    if (!node || depth > 4) return;
    if (Array.isArray(node)) { node.forEach(n => walk(n, depth + 1)); return; }
    if (typeof node !== 'object') return;
    const name = node.name ?? node.parameter ?? node.test ?? node.analyte ?? node.test_name;
    if (name != null && (node.value !== undefined || node.result !== undefined)) { push(name, node.value ?? node.result, node.unit ?? node.units); return; }
    for (const [key, val] of Object.entries(node)) {
      if (val && typeof val === 'object' && !Array.isArray(val) && (val.value !== undefined || val.result !== undefined) && !(val.name ?? val.parameter)) push(key, val.value ?? val.result, val.unit ?? val.units);
      else if (val !== null && typeof val !== 'object') push(key, val, '');
      else walk(val, depth + 1);
    }
  };
  walk(r);
  return out;
}

// ── Patient record ──────────────────────────────────────────────────────────
export async function patientRecord(patientId) {
  await ensureNutritionTables();
  const pid = String(patientId);
  await ensureRecordStatus('vital_signs').catch(() => {});
  const [meas, vit, labs, assessments, plans, intake] = await Promise.all([
    query(`SELECT * FROM nutrition_measurements WHERE patient_id = $1 AND status = 'active' ORDER BY measured_at`, [pid]),
    query(`SELECT id, weight, COALESCE(date, created_at) AS measured_at, recorded_by FROM vital_signs
            WHERE patient_id = $1 AND weight IS NOT NULL AND ${notInError()} ORDER BY 3`, [pid]).catch(() => ({ rows: [] })),
    query(`SELECT id, test_name, test_type, results, COALESCE(completed_at, updated_at, created_at) AS measured_at FROM lab_orders
            WHERE patient_id::text = $1 AND results IS NOT NULL ORDER BY 5`, [pid]).catch(() => ({ rows: [] })),
    query(`SELECT * FROM nutrition_assessments WHERE patient_id = $1 ORDER BY created_at DESC LIMIT 50`, [pid]),
    query(`SELECT * FROM nutrition_meal_plans WHERE patient_id = $1 ORDER BY created_at DESC LIMIT 20`, [pid]),
    query(`SELECT * FROM nutrition_intake WHERE patient_id = $1 AND intake_date >= CURRENT_DATE - 60 ORDER BY intake_date, meal`, [pid]),
  ]);
  const measurements = meas.rows.map(m => ({ ...m, value: Number(m.value), source: 'nutrition' }));
  for (const v of vit.rows) {
    measurements.push({ id: `vs-${v.id}`, kind: 'weight', value: Number(v.weight), unit: 'kg', method: 'measured', measured_at: v.measured_at, source: 'vital_signs', entered_by_name: v.recorded_by });
  }
  for (const o of labs.rows) {
    for (const a of parseLabAnalytes(o.results)) {
      measurements.push({ id: `lab-${o.id}-${a.kind}`, kind: a.kind, value: a.value, unit: a.unit, method: o.test_name || o.test_type, measured_at: o.measured_at, source: 'lab_orders' });
    }
  }
  measurements.sort((a, b) => Date.parse(a.measured_at) - Date.parse(b.measured_at));
  return { measurements, assessments: assessments.rows, meal_plans: plans.rows, intake: intake.rows };
}

export async function addMeasurement(body, user) {
  await ensureNutritionTables();
  if (!body.patient_id) return { status: 400, error: 'patient_id is required' };
  const err = validateMeasurement(body);
  if (err) return { status: 400, error: err };
  const k = MEASUREMENT_KINDS[body.kind];
  const r = await query(
    `INSERT INTO nutrition_measurements (patient_id, kind, value, unit, method, measured_at, note, entered_by, entered_by_name, entered_by_role)
     VALUES ($1,$2,$3,$4,$5,COALESCE($6::timestamptz, CURRENT_TIMESTAMP),$7,$8,$9,$10) RETURNING *`,
    [String(body.patient_id), body.kind, Number(body.value), k.unit, body.method ? String(body.method).slice(0, 60) : null,
      body.measured_at || null, body.note ? String(body.note).slice(0, 500) : null, user?.id ?? null, nameOf(user), user?.role ?? null]);
  return { status: 201, measurement: r.rows[0] };
}

export async function measurementInError(id, user, reason) {
  await ensureNutritionTables();
  if (!reason || !String(reason).trim()) return { status: 400, error: 'A reason is required' };
  const r = await query(`UPDATE nutrition_measurements SET status = 'entered_in_error', error_reason = $2 WHERE id = $1 AND status = 'active' RETURNING *`,
    [Number(id), String(reason).slice(0, 300)]);
  return r.rows[0] ? { status: 200, measurement: r.rows[0] } : { status: 404, error: 'Measurement not found' };
}

// ── Versioned records: assessments and meal plans ───────────────────────────
const VERSIONED = {
  assessment: { table: 'nutrition_assessments', fields: ['inputs', 'result', 'summary'], extra: [] },
  plan: { table: 'nutrition_meal_plans', fields: ['targets', 'plan', 'solver'], extra: ['assessment_id', 'food_data_version'] },
};
const MAX_BYTES = 768 * 1024;

export async function saveVersioned(kind, body, user) {
  await ensureNutritionTables();
  const V = VERSIONED[kind];
  if (!V) return { status: 400, error: 'Unknown record kind' };
  if (!body.config_version) return { status: 400, error: 'config_version is required' };
  const vals = V.fields.map(f => (body[f] && typeof body[f] === 'object' ? body[f] : {}));
  if (JSON.stringify(vals).length > MAX_BYTES) return { status: 400, error: 'Record is too large to save' };
  if (!body.id) {
    if (!body.patient_id) return { status: 400, error: 'patient_id is required' };
    const cols = ['patient_id', ...V.fields, 'config_version', ...V.extra, 'created_by', 'created_by_name', 'created_by_role'];
    const params = [String(body.patient_id), ...vals.map(v => JSON.stringify(v)), String(body.config_version),
      ...V.extra.map(e => body[e] ?? null), user?.id ?? null, nameOf(user), user?.role ?? null];
    const r = await query(`INSERT INTO ${V.table} (${cols.join(',')}) VALUES (${cols.map((_, i) => `$${i + 1}`).join(',')}) RETURNING *`, params);
    return { status: 201, record: r.rows[0] };
  }
  const cur = (await query(`SELECT * FROM ${V.table} WHERE id = $1`, [Number(body.id)])).rows[0];
  if (!cur) return { status: 404, error: 'Record not found' };
  if (!['draft', 'pending_review'].includes(cur.status)) return { status: 409, error: `An ${cur.status.replace('_', ' ')} record cannot be edited — start a new one`, current: cur };
  if (Number(body.version) !== cur.version) return { status: 409, error: 'Someone else changed this record — reload to see their version', current: cur };
  const sets = [...V.fields.map((f, i) => `${f} = $${i + 3}`), `config_version = $${V.fields.length + 3}`,
    ...V.extra.map((e, i) => `${e} = $${V.fields.length + 4 + i}`), 'version = version + 1', 'updated_at = CURRENT_TIMESTAMP'];
  const r = await query(`UPDATE ${V.table} SET ${sets.join(', ')} WHERE id = $1 AND version = $2 RETURNING *`,
    [cur.id, cur.version, ...vals.map(v => JSON.stringify(v)), String(body.config_version), ...V.extra.map(e => body[e] ?? cur[e] ?? null)]);
  if (!r.rows[0]) return { status: 409, error: 'Someone else changed this record — reload to see their version' };
  return { status: 200, record: r.rows[0] };
}

/** draft → pending_review (anyone who may draft) or → approved (approver). */
export async function transition(kind, id, version, user, to) {
  await ensureNutritionTables();
  const V = VERSIONED[kind];
  if (!V) return { status: 400, error: 'Unknown record kind' };
  const cur = (await query(`SELECT * FROM ${V.table} WHERE id = $1`, [Number(id)])).rows[0];
  if (!cur) return { status: 404, error: 'Record not found' };
  if (Number(version) !== cur.version) return { status: 409, error: 'Someone else changed this record — reload first' };
  if (to === 'approved') {
    if (!canApprove(user)) return { status: 403, error: 'Only a dietitian, consultant or senior registrar can approve' };
    if (!['draft', 'pending_review'].includes(cur.status)) return { status: 409, error: `Already ${cur.status.replace('_', ' ')}` };
    const r = await query(`UPDATE ${V.table} SET status = 'approved', approved_by = $2, approved_by_name = $3, approved_by_role = $4, approved_at = CURRENT_TIMESTAMP,
      version = version + 1, updated_at = CURRENT_TIMESTAMP WHERE id = $1 RETURNING *`, [cur.id, user?.id ?? null, nameOf(user), user?.role ?? null]);
    if (kind === 'plan') {
      await query(`UPDATE nutrition_meal_plans SET status = 'superseded', superseded_by = $1, updated_at = CURRENT_TIMESTAMP
        WHERE patient_id = $2 AND id <> $1 AND status = 'approved'`, [cur.id, cur.patient_id]);
    }
    return { status: 200, record: r.rows[0] };
  }
  if (to === 'pending_review') {
    if (cur.status !== 'draft') return { status: 409, error: `Already ${cur.status.replace('_', ' ')}` };
    const r = await query(`UPDATE ${V.table} SET status = 'pending_review', version = version + 1, updated_at = CURRENT_TIMESTAMP WHERE id = $1 RETURNING *`, [cur.id]);
    return { status: 200, record: r.rows[0] };
  }
  return { status: 400, error: 'Unknown transition' };
}

export async function versionedInError(kind, id, user, reason) {
  await ensureNutritionTables();
  const V = VERSIONED[kind];
  if (!V) return { status: 400, error: 'Unknown record kind' };
  if (!reason || !String(reason).trim()) return { status: 400, error: 'A reason is required' };
  const cur = (await query(`SELECT * FROM ${V.table} WHERE id = $1`, [Number(id)])).rows[0];
  if (!cur) return { status: 404, error: 'Record not found' };
  if (cur.status === 'approved' && !canApprove(user)) return { status: 403, error: 'Only an approver can withdraw an approved record' };
  const r = await query(`UPDATE ${V.table} SET status = 'entered_in_error', error_reason = $2, version = version + 1, updated_at = CURRENT_TIMESTAMP WHERE id = $1 RETURNING *`,
    [cur.id, String(reason).slice(0, 300)]);
  return { status: 200, record: r.rows[0] };
}

// ── Intake ──────────────────────────────────────────────────────────────────
export const MEALS = ['breakfast', 'mid_morning', 'lunch', 'afternoon', 'dinner', 'evening', 'supplements', 'enteral'];

export async function saveIntake(body, user) {
  await ensureNutritionTables();
  if (!body.patient_id) return { status: 400, error: 'patient_id is required' };
  if (!MEALS.includes(body.meal)) return { status: 400, error: 'Unknown meal' };
  if (!body.intake_date || Number.isNaN(Date.parse(body.intake_date))) return { status: 400, error: 'intake_date is required' };
  const kcal = Number(body.kcal), protein = Number(body.protein_g);
  if (!Number.isFinite(kcal) || kcal < 0 || kcal > 8000 || !Number.isFinite(protein) || protein < 0 || protein > 400) return { status: 400, error: 'Implausible intake totals' };
  const items = Array.isArray(body.items) ? body.items.slice(0, 60) : [];
  const r = await query(
    `INSERT INTO nutrition_intake (patient_id, intake_date, meal, plan_id, items, kcal, protein_g, target_kcal, target_protein_g, note, recorded_by, recorded_by_name, recorded_by_role)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)
     ON CONFLICT (patient_id, intake_date, meal) DO UPDATE SET plan_id = EXCLUDED.plan_id, items = EXCLUDED.items, kcal = EXCLUDED.kcal, protein_g = EXCLUDED.protein_g,
       target_kcal = EXCLUDED.target_kcal, target_protein_g = EXCLUDED.target_protein_g, note = EXCLUDED.note,
       recorded_by = EXCLUDED.recorded_by, recorded_by_name = EXCLUDED.recorded_by_name, recorded_by_role = EXCLUDED.recorded_by_role, updated_at = CURRENT_TIMESTAMP
     RETURNING *`,
    [String(body.patient_id), body.intake_date, body.meal, body.plan_id ?? null, JSON.stringify(items), kcal, protein,
      body.target_kcal ?? null, body.target_protein_g ?? null, body.note ? String(body.note).slice(0, 500) : null, user?.id ?? null, nameOf(user), user?.role ?? null]);
  return { status: 200, intake: r.rows[0] };
}

// ── Food composition, recipes, household measures ──────────────────────────
export const NUTRIENT_KEYS = ['energy_kcal', 'energy_kj', 'protein_g', 'fat_g', 'carb_g', 'fibre_g', 'water_g', 'na_mg', 'k_mg', 'ca_mg', 'fe_mg', 'zn_mg', 'p_mg', 'mg_mg', 'vit_a_ug', 'vit_c_mg', 'folate_ug'];

const cleanPer100 = (p = {}) => {
  const out = Object.fromEntries(NUTRIENT_KEYS.filter(k => p[k] !== undefined && p[k] !== null && p[k] !== '' && Number.isFinite(Number(p[k]))).map(k => [k, Number(p[k])]));
  // FAO marks imputed / low-quality values in [brackets]; keep which ones they were.
  if (Array.isArray(p.imputed)) { const imp = p.imputed.filter(k => k in out); if (imp.length) out.imputed = imp; }
  return out;
};

export async function searchFoods(q = '', limit = 50) {
  await ensureNutritionTables();
  const like = `%${String(q).trim()}%`;
  const r = await query(`SELECT * FROM nutrition_foods WHERE active AND (name ILIKE $1 OR local_names::text ILIKE $1 OR food_code ILIKE $1) ORDER BY name LIMIT $2`, [like, Math.min(Number(limit) || 50, 500)]);
  return r.rows;
}

export async function upsertFoods(rows, source, user) {
  await ensureNutritionTables();
  if (!source?.code || !source?.name) return { status: 400, error: 'source.code and source.name are required' };
  if (!Array.isArray(rows) || rows.length === 0) return { status: 400, error: 'No rows' };
  if (rows.length > 2000) return { status: 400, error: 'At most 2000 rows per batch' };
  const rejected = [];
  const ok = [];
  for (const f of rows) {
    if (!f.food_code || !f.name) { rejected.push({ code: f.food_code ?? null, reason: 'food_code and name are required' }); continue; }
    const per = cleanPer100(f.per100g);
    if (per.energy_kcal === undefined || per.protein_g === undefined) { rejected.push({ code: f.food_code, reason: 'energy_kcal and protein_g are required' }); continue; }
    ok.push({
      food_code: String(f.food_code), name: String(f.name).slice(0, 300), food_group: f.food_group || null, per100g: per,
      local_names: f.scientific_name ? { sci: String(f.scientific_name) } : {}, edible_portion: f.edible_portion ?? null,
      yield_factor: f.yield_factor ?? null, state: f.state || null,
    });
  }
  // One statement per 250 rows: a full table import fits well inside the function time limit.
  for (let i = 0; i < ok.length; i += 250) {
    await query(
      `INSERT INTO nutrition_foods (source_code, food_code, name, local_names, food_group, per100g, edible_portion, yield_factor, state)
       SELECT $1, r.food_code, r.name, COALESCE(r.local_names, '{}'::jsonb), r.food_group, r.per100g, r.edible_portion, r.yield_factor, r.state
         FROM jsonb_to_recordset($2::jsonb) AS r(food_code text, name text, local_names jsonb, food_group text, per100g jsonb, edible_portion numeric, yield_factor numeric, state text)
       ON CONFLICT (source_code, food_code) DO UPDATE SET name = EXCLUDED.name, food_group = EXCLUDED.food_group, per100g = EXCLUDED.per100g,
         local_names = nutrition_foods.local_names || EXCLUDED.local_names, edible_portion = EXCLUDED.edible_portion,
         yield_factor = COALESCE(EXCLUDED.yield_factor, nutrition_foods.yield_factor), state = EXCLUDED.state, updated_at = CURRENT_TIMESTAMP`,
      [source.code, JSON.stringify(ok.slice(i, i + 250))]);
  }
  await query(`INSERT INTO nutrition_food_sources (code, name, version, licence, url, row_count, imported_at, imported_by_name)
    VALUES ($1,$2,$3,$4,$5,(SELECT COUNT(*) FROM nutrition_foods WHERE source_code = $1),CURRENT_TIMESTAMP,$6)
    ON CONFLICT (code) DO UPDATE SET name = EXCLUDED.name, version = EXCLUDED.version, licence = EXCLUDED.licence, url = EXCLUDED.url,
      row_count = (SELECT COUNT(*) FROM nutrition_foods WHERE source_code = $1), imported_at = CURRENT_TIMESTAMP, imported_by_name = EXCLUDED.imported_by_name`,
  [source.code, source.name, source.version || null, source.licence || null, source.url || null, nameOf(user)]);
  return { status: 200, imported: ok.length, rejected };
}

/** Import the bundled WAFCT 2019 table (generated by scripts/nutrition/import-wafct.mjs). */
export async function seedWafct(user) {
  const { WAFCT_2019_SOURCE, WAFCT_2019_FOODS } = await import('./data/wafct2019.js');
  return upsertFoods(WAFCT_2019_FOODS, WAFCT_2019_SOURCE, user);
}

/**
 * Apply the Enugu layer: local names, planner portions, cost/availability on
 * WAFCT foods; insert draft recipes and unverified household measures. Never
 * overwrites a recipe or measure the dietitian has already created or edited.
 */
export async function seedEnugu(user) {
  await ensureNutritionTables();
  const { LOCAL_FOODS, INGREDIENT_LABELS, RECIPES, MEASURES } = await import('./data/enuguFoods.js');
  const ids = new Map((await query(`SELECT id, food_code FROM nutrition_foods WHERE source_code = 'WAFCT2019'`)).rows.map(r => [r.food_code, r.id]));
  if (!ids.size) return { status: 409, error: 'Import the WAFCT 2019 table first' };
  const missing = new Set();
  for (const f of LOCAL_FOODS) {
    if (!ids.has(f.code)) { missing.add(f.code); continue; }
    await query(
      `UPDATE nutrition_foods SET local_names = local_names || $2::jsonb,
         min_portion_g = COALESCE(min_portion_g, $3), max_portion_g = COALESCE(max_portion_g, $4), unit_g = COALESCE(unit_g, $5), unit_label = COALESCE(unit_label, $6),
         cost_tier = COALESCE(cost_tier, $7), seasonality = COALESCE(seasonality, $8),
         availability = CASE WHEN availability = '{}'::jsonb THEN $9::jsonb ELSE availability END,
         tags = CASE WHEN tags = '[]'::jsonb THEN $10::jsonb ELSE tags END, updated_at = CURRENT_TIMESTAMP
       WHERE id = $1`,
      [ids.get(f.code), JSON.stringify({ en: f.en, ...(f.ig ? { ig: f.ig } : {}) }), f.min_g ?? null, f.max_g ?? null, f.unit_g ?? null, f.unit_label ?? null,
        f.cost ?? null, f.season ?? null, JSON.stringify(f.avail || {}), JSON.stringify(['local', f.role, ...(f.energy_dense ? ['energy_dense'] : [])])]);
  }
  for (const [code, l] of Object.entries(INGREDIENT_LABELS)) {
    if (ids.has(code)) await query(`UPDATE nutrition_foods SET local_names = local_names || $2::jsonb WHERE id = $1`, [ids.get(code), JSON.stringify(l)]);
    else missing.add(code);
  }
  let recipes = 0;
  const recipeIds = new Map((await query(`SELECT id, name FROM nutrition_recipes`)).rows.map(r => [r.name, r.id]));
  for (const r of RECIPES) {
    if (recipeIds.has(r.name)) continue;
    const ing = r.ingredients.filter(([code]) => { if (!ids.has(code)) { missing.add(code); return false; } return true; });
    if (ing.length !== r.ingredients.length) continue;
    const row = (await query(
      `INSERT INTO nutrition_recipes (name, local_name, category, meal_slots, portion_g, texture, tags, status, notes, created_by_name)
       VALUES ($1,$2,$3,$4,$5,$6,$7,'draft',$8,$9) ON CONFLICT (name) DO NOTHING RETURNING id`,
      [r.name, r.local_name || null, r.category, JSON.stringify(r.slots), r.portion_g, r.texture || null, JSON.stringify(r.tags || []), r.notes, `Seed ${nameOf(user) || ''}`.trim()])).rows[0];
    if (!row) continue;
    recipeIds.set(r.name, row.id);
    for (const [code, g] of ing) await query(`INSERT INTO nutrition_recipe_ingredients (recipe_id, food_id, raw_g) VALUES ($1,$2,$3)`, [row.id, ids.get(code), g]);
    recipes++;
  }
  let measures = 0;
  const existing = new Set((await query(`SELECT COALESCE(food_id::text, '') || '|' || COALESCE(recipe_id::text, '') || '|' || measure AS k FROM nutrition_household_measures`)).rows.map(r => r.k));
  for (const m of MEASURES) {
    const foodId = m.food ? ids.get(m.food) : null, recipeId = m.recipe ? recipeIds.get(m.recipe) : null;
    if (!foodId && !recipeId) continue;
    const k = `${foodId ?? ''}|${recipeId ?? ''}|${m.measure}`;
    if (existing.has(k)) continue;
    await query(`INSERT INTO nutrition_household_measures (food_id, recipe_id, measure, grams, verified, note) VALUES ($1,$2,$3,$4,FALSE,$5)`,
      [foodId ?? null, recipeId ?? null, m.measure, m.grams, 'To be verified by local weighing']);
    measures++;
  }
  return { status: 200, recipes, measures, missing: [...missing] };
}

/** Planner and cost fields a dietitian maintains per food (never nutrient values). */
export async function updateFoodPlanning(id, f) {
  await ensureNutritionTables();
  const r = await query(
    `UPDATE nutrition_foods SET local_names = COALESCE($2, local_names), min_portion_g = $3, max_portion_g = $4, unit_g = $5, unit_label = $6,
       cost_tier = $7, seasonality = $8, availability = COALESCE($9, availability), tags = COALESCE($10, tags), active = COALESCE($11, active), updated_at = CURRENT_TIMESTAMP
     WHERE id = $1 RETURNING *`,
    [Number(id), f.local_names ? JSON.stringify(f.local_names) : null, f.min_portion_g ?? null, f.max_portion_g ?? null, f.unit_g ?? null, f.unit_label ?? null,
      f.cost_tier ?? null, f.seasonality ?? null, f.availability ? JSON.stringify(f.availability) : null, Array.isArray(f.tags) ? JSON.stringify(f.tags) : null,
      typeof f.active === 'boolean' ? f.active : null]);
  return r.rows[0] ? { status: 200, food: r.rows[0] } : { status: 404, error: 'Food not found' };
}

export async function listRecipes() {
  await ensureNutritionTables();
  const [rec, ing] = await Promise.all([
    query(`SELECT * FROM nutrition_recipes ORDER BY name`),
    query(`SELECT i.*, f.name AS food_name, f.per100g, f.edible_portion, f.yield_factor, f.source_code, f.food_code
             FROM nutrition_recipe_ingredients i JOIN nutrition_foods f ON f.id = i.food_id ORDER BY i.id`),
  ]);
  return rec.rows.map(r => ({ ...r, ingredients: ing.rows.filter(i => i.recipe_id === r.id) }));
}

export async function upsertRecipe(body, user) {
  await ensureNutritionTables();
  if (!body.name) return { status: 400, error: 'name is required' };
  const ings = Array.isArray(body.ingredients) ? body.ingredients : [];
  if (!ings.length) return { status: 400, error: 'A recipe needs at least one ingredient' };
  if (ings.some(i => !Number.isFinite(Number(i.food_id)) || !(Number(i.raw_g) > 0))) return { status: 400, error: 'Every ingredient needs a food and a raw weight in grams' };
  const params = [String(body.name).slice(0, 120), body.local_name || null, body.category || null, JSON.stringify(body.meal_slots || []),
    body.portion_g ?? null, body.yield_factor ?? null, body.texture || null, JSON.stringify(body.tags || []), body.notes || null, nameOf(user)];
  const r = body.id
    ? await query(`UPDATE nutrition_recipes SET name=$2, local_name=$3, category=$4, meal_slots=$5, portion_g=$6, yield_factor=$7, texture=$8, tags=$9, notes=$10,
        status='draft', verified_by_name=NULL, verified_at=NULL, updated_at=CURRENT_TIMESTAMP WHERE id=$1 RETURNING *`, [Number(body.id), ...params.slice(0, 9)])
    : await query(`INSERT INTO nutrition_recipes (name, local_name, category, meal_slots, portion_g, yield_factor, texture, tags, notes, created_by_name)
        VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
        ON CONFLICT (name) DO UPDATE SET local_name=EXCLUDED.local_name, category=EXCLUDED.category, meal_slots=EXCLUDED.meal_slots, portion_g=EXCLUDED.portion_g,
          yield_factor=EXCLUDED.yield_factor, texture=EXCLUDED.texture, tags=EXCLUDED.tags, notes=EXCLUDED.notes, status='draft', verified_by_name=NULL, verified_at=NULL, updated_at=CURRENT_TIMESTAMP
        RETURNING *`, params);
  const rec = r.rows[0];
  if (!rec) return { status: 404, error: 'Recipe not found' };
  await query(`DELETE FROM nutrition_recipe_ingredients WHERE recipe_id = $1`, [rec.id]);
  for (const i of ings) await query(`INSERT INTO nutrition_recipe_ingredients (recipe_id, food_id, raw_g, note) VALUES ($1,$2,$3,$4)`, [rec.id, Number(i.food_id), Number(i.raw_g), i.note || null]);
  return { status: 200, recipe: rec };
}

export async function verifyRecipe(id, user) {
  await ensureNutritionTables();
  const r = await query(`UPDATE nutrition_recipes SET status='verified', verified_by_name=$2, verified_at=CURRENT_TIMESTAMP, updated_at=CURRENT_TIMESTAMP WHERE id=$1 RETURNING *`, [Number(id), nameOf(user)]);
  return r.rows[0] ? { status: 200, recipe: r.rows[0] } : { status: 404, error: 'Recipe not found' };
}

export async function listMeasures() {
  await ensureNutritionTables();
  return (await query(`SELECT * FROM nutrition_household_measures ORDER BY measure`)).rows;
}

export async function upsertMeasure(body, user) {
  await ensureNutritionTables();
  if (!body.measure || !(Number(body.grams) > 0)) return { status: 400, error: 'measure and grams are required' };
  if (!body.food_id && !body.recipe_id) return { status: 400, error: 'A measure belongs to a food or a recipe' };
  const verified = body.verified === true;
  const params = [body.food_id ?? null, body.recipe_id ?? null, String(body.measure).slice(0, 80), Number(body.grams), verified, verified ? nameOf(user) : null, body.note || null];
  const r = body.id
    ? await query(`UPDATE nutrition_household_measures SET food_id=$2, recipe_id=$3, measure=$4, grams=$5, verified=$6, verified_by_name=$7,
        verified_at=CASE WHEN $6 THEN CURRENT_TIMESTAMP ELSE NULL END, note=$8 WHERE id=$1 RETURNING *`, [Number(body.id), ...params])
    : await query(`INSERT INTO nutrition_household_measures (food_id, recipe_id, measure, grams, verified, verified_by_name, verified_at, note)
        VALUES ($1,$2,$3,$4,$5,$6,CASE WHEN $5 THEN CURRENT_TIMESTAMP ELSE NULL END,$7) RETURNING *`, params);
  return r.rows[0] ? { status: 200, measure: r.rows[0] } : { status: 404, error: 'Measure not found' };
}

/** Everything the meal planner needs: local foods, recipes with ingredient values, measures, source versions. */
export async function plannerCatalog() {
  await ensureNutritionTables();
  const [foods, recipes, measures, sources] = await Promise.all([
    query(`SELECT * FROM nutrition_foods WHERE active AND tags @> '["local"]'::jsonb ORDER BY name`),
    listRecipes(), listMeasures(), foodSources(),
  ]);
  return { foods: foods.rows, recipes, measures, food_data_version: sources.map(s => `${s.code}@${s.version || '?'}`).join(',') || null };
}

export async function foodSources() {
  await ensureNutritionTables();
  return (await query(`SELECT * FROM nutrition_food_sources ORDER BY code`)).rows;
}

// ── Coefficient sign-off ────────────────────────────────────────────────────
export async function configSignoffs() {
  await ensureNutritionTables();
  return (await query(`SELECT * FROM nutrition_config_signoffs ORDER BY signed_at DESC`)).rows;
}
export async function signConfig(version, note, user) {
  await ensureNutritionTables();
  if (!version) return { status: 400, error: 'version is required' };
  const r = await query(`INSERT INTO nutrition_config_signoffs (config_version, signed_by, signed_by_name, signed_by_role, note) VALUES ($1,$2,$3,$4,$5) RETURNING *`,
    [String(version), user?.id ?? null, nameOf(user), user?.role ?? null, note ? String(note).slice(0, 1000) : null]);
  return { status: 201, signoff: r.rows[0] };
}

// ── Worklist ────────────────────────────────────────────────────────────────
/** Latest live assessment per patient, plus everything awaiting approval. */
export async function worklist() {
  await ensureNutritionTables();
  const r = await query(`
    SELECT DISTINCT ON (a.patient_id) a.id, a.patient_id, a.status, a.summary, a.created_at, a.created_by_name, a.approved_at,
           p.first_name, p.last_name, p.hospital_number
      FROM nutrition_assessments a
      LEFT JOIN patients p ON p.id::text = a.patient_id
     WHERE a.status <> 'entered_in_error'
     ORDER BY a.patient_id, a.created_at DESC`).catch(async () => query(`
    SELECT DISTINCT ON (a.patient_id) a.id, a.patient_id, a.status, a.summary, a.created_at, a.created_by_name, a.approved_at
      FROM nutrition_assessments a WHERE a.status <> 'entered_in_error' ORDER BY a.patient_id, a.created_at DESC`));
  const plans = await query(`SELECT id, patient_id, status, targets, created_at, created_by_name FROM nutrition_meal_plans WHERE status IN ('draft','pending_review') ORDER BY created_at DESC LIMIT 200`);
  return { assessments: r.rows, pending_plans: plans.rows };
}
