// AI unit summary (Claude) — a handover analysis of one unit's admitted patients.
//
//   POST /api/ai/unit-summary
//        { unit_name, patients: [{ id, name, hospital_number, ward, bed, care_start_date? }] }
//     -> { summary, model, prompt_version, deidentified: true, patient_count, generated_at }
//
// The browser sends the list it is showing (already in ward order). The server
// reads each patient's current admission, removes identifiers, and asks Claude.
// Governed by the unit's external-AI decision (D5) and written to the clinical
// audit log (purpose and model, not content).
import { query } from '../_lib/db.js';
import { cors, authenticateRequest } from '../_lib/auth.js';
import { externalAiAllowed } from '../_lib/governance.js';
import { auditClinical } from '../_lib/clinicalRecords.js';
import { chatJSON, getAIKey, AIError, AI_MODEL } from '../_lib/claude.js';
import { buildUnitRows, normaliseUnitSummary, UNIT_SUMMARY_SYSTEM_PROMPT, UNIT_SUMMARY_PROMPT_VERSION, MAX_PATIENTS } from '../_lib/unitSummary.js';

const NO_ACCESS = ['student', 'lab'];

async function loadAdmissions(ids) {
  if (!ids.length) return new Map();
  const r = await query(
    `SELECT DISTINCT ON (a.patient_id::text) a.*, p.first_name, p.last_name, p.other_names,
            p.hospital_number AS p_hospital_number, p.phone, p.date_of_birth, p.gender
       FROM admissions a
       LEFT JOIN patients p ON p.id::text = a.patient_id::text
      WHERE a.patient_id::text = ANY($1::text[])
      ORDER BY a.patient_id::text,
               (LOWER(COALESCE(a.status, '')) IN ('active', 'admitted')) DESC,
               a.admission_date DESC NULLS LAST`,
    [ids]
  );
  const m = new Map();
  for (const row of r.rows) m.set(String(row.patient_id), { ...row, hospital_number: row.hospital_number || row.p_hospital_number });
  return m;
}

export default async function handler(req, res) {
  if (cors(req, res)) return;
  const auth = authenticateRequest(req);
  if (!auth.authenticated) return res.status(401).json({ error: auth.error });
  const user = auth.user;
  if (NO_ACCESS.includes(user?.role)) return res.status(403).json({ error: 'Your role has no access to the AI unit summary' });
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  let body = req.body;
  if (typeof body === 'string') { try { body = JSON.parse(body); } catch { body = {}; } }
  body = body || {};
  const patients = (Array.isArray(body.patients) ? body.patients : []).filter(p => p && p.id !== undefined && p.id !== null);
  if (!patients.length) return res.status(400).json({ error: 'No patients to summarise' });
  if (patients.length > MAX_PATIENTS) return res.status(413).json({ error: `At most ${MAX_PATIENTS} patients can be summarised at once — filter by ward first` });

  if (!(await externalAiAllowed())) return res.status(403).json({ error: 'External AI is switched off by the unit (Clinical Governance, D5).', code: 'AI_DISABLED' });
  if (!getAIKey()) return res.status(503).json({ error: 'Claude AI is not configured on the server (ANTHROPIC_API_KEY).', code: 'AI_NOT_CONFIGURED' });

  const unitName = String(body.unit_name || 'the unit').slice(0, 80);
  const purpose = 'unit_summary';
  try {
    const admissions = await loadAdmissions(patients.map(p => String(p.id)));
    const { rows, refs } = buildUnitRows(patients, admissions);
    const raw = await chatJSON({
      max_tokens: 3000,
      messages: [
        { role: 'system', content: UNIT_SUMMARY_SYSTEM_PROMPT },
        { role: 'user', content: `Unit: ${unitName.replace(/[^\w\s-]/g, '')}\nDate: ${new Date().toISOString().slice(0, 10)}\nPatients (${rows.length}):\n${JSON.stringify(rows)}` },
      ],
    }, { timeoutMs: 27000, retries: 0 });
    const summary = normaliseUnitSummary(raw, refs);
    await auditClinical(user, { action: 'ai_request', entity: 'unit_summary', patientId: null, detail: { purpose, model: AI_MODEL, prompt: UNIT_SUMMARY_PROMPT_VERSION, deidentified: true, ok: true, patients: rows.length } });
    return res.status(200).json({ summary, model: AI_MODEL, prompt_version: UNIT_SUMMARY_PROMPT_VERSION, deidentified: true, patient_count: rows.length, generated_at: new Date().toISOString() });
  } catch (e) {
    console.error('unit-summary error:', e?.status || '', e?.message);
    await auditClinical(user, { action: 'ai_request', entity: 'unit_summary', patientId: null, detail: { purpose, model: AI_MODEL, ok: false, status: e?.status || null } }).catch(() => {});
    if (e instanceof AIError && e.status === 429) return res.status(429).json({ error: 'Claude is busy — try again in a minute.' });
    if (e instanceof AIError) return res.status(502).json({ error: e.status === 504 ? 'The summary took too long — try again, or filter to one ward.' : 'Claude did not return a summary. Try again shortly.' });
    return res.status(500).json({ error: 'Internal server error', message: e?.message });
  }
}
