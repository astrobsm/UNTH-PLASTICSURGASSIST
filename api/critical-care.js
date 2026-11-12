// Consultant-level critical-care review (AI layer over the rule-based analysis).
//
//   POST ?action=review  {patient_id?, input, rule_report?}
//        -> {review, model, prompt_version, deidentified, discrepancies[]}
//
// The rule-based report (src/clinical/critical) is computed on the device and
// is always shown; this endpoint adds the model's synthesis. Governed by the
// unit's external-AI setting (D5), de-identified, audited. Saving uses the
// clinical-encounters API (type critical_care_review).
import { cors, authenticateRequest } from './_lib/auth.js';
import { auditClinical } from './_lib/clinicalRecords.js';
import { externalAiAllowed } from './_lib/governance.js';
import { chatJSON, getOpenAIKey, OpenAIError } from './_lib/openai.js';
import { deidentifyText, identifiersForPatient } from './_lib/deidentify.js';
import { CRITICAL_CARE_SYSTEM_PROMPT, CRITICAL_CARE_PROMPT_VERSION } from './_lib/criticalCarePrompt.js';
import { normaliseCriticalReview } from './_lib/criticalCareNormalise.js';

// Time budget: the project-wide function limit (vercel.json) is 30 s — a
// per-file entry there broke the build — so the review is sized to finish
// inside it (26 s timeout, 3,000-token answer).

const NO_ACCESS = ['student', 'lab'];
const MAX_INPUT = 60000;
const MODEL = 'gpt-4o';

/** The app's own numbers, which the model must recompute (spec rule 4). */
export function appCalculations(rule) {
  const rf = rule?.renal_function || {}, ab = rule?.acid_base || {};
  const out = {};
  if (Number.isFinite(rf.egfr_ckd_epi_2021)) out.egfr_ckd_epi_2021 = rf.egfr_ckd_epi_2021;
  if (Number.isFinite(rf.crcl_cockcroft_gault)) out.crcl_cockcroft_gault = rf.crcl_cockcroft_gault;
  if (Number.isFinite(ab.anion_gap)) out.anion_gap = ab.anion_gap;
  if (Number.isFinite(ab.corrected_anion_gap)) out.corrected_anion_gap = ab.corrected_anion_gap;
  if (Number.isFinite(ab.delta_ratio)) out.delta_ratio = ab.delta_ratio;
  return out;
}

/** Where the model's numbers differ from the app's by more than rounding. */
export function discrepancies(rule, review) {
  const d = [];
  const cmp = (label, a, b, tol) => {
    if (Number.isFinite(a) && Number.isFinite(b) && Math.abs(a - b) > Math.max(1, Math.abs(a) * tol)) d.push(`${label}: app ${a}, AI ${b}`);
  };
  cmp('eGFR', rule?.renal_function?.egfr_ckd_epi_2021, review?.renal_function?.egfr_ckd_epi_2021, 0.05);
  cmp('CrCl', rule?.renal_function?.crcl_cockcroft_gault, review?.renal_function?.crcl_cockcroft_gault, 0.08);
  cmp('Anion gap', rule?.acid_base?.anion_gap, review?.acid_base?.anion_gap, 0.05);
  const ruleAlerts = (rule?.critical_alerts || []).map(a => String(a.finding).split(' ')[0].toLowerCase());
  const aiText = JSON.stringify(review?.critical_alerts || []).toLowerCase();
  for (const a of ruleAlerts) if (a && !aiText.includes(a.slice(0, 6))) d.push(`AI review did not list the app's critical alert "${a}"`);
  return d;
}

export default async function handler(req, res) {
  if (cors(req, res)) return;
  const auth = authenticateRequest(req);
  if (!auth.authenticated) return res.status(401).json({ error: auth.error });
  const user = auth.user;
  if (NO_ACCESS.includes(user?.role)) return res.status(403).json({ error: 'Your role has no access to the critical-care review' });
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  const url = new URL(req.url, `http://${req.headers.host}`);
  if ((url.searchParams.get('action') || '') !== 'review') return res.status(400).json({ error: 'Unknown action' });
  let body = req.body;
  if (typeof body === 'string') { try { body = JSON.parse(body); } catch { body = {}; } }
  body = body || {};
  if (!body.input || typeof body.input !== 'object') return res.status(400).json({ error: 'input is required' });

  if (!(await externalAiAllowed())) return res.status(403).json({ error: 'External AI is switched off by the unit (Clinical Governance, D5). The rule-based analysis is still shown.', code: 'AI_DISABLED' });
  if (!getOpenAIKey()) return res.status(503).json({ error: 'AI is not configured on the server. The rule-based analysis is still shown.', code: 'AI_NOT_CONFIGURED' });

  const payload = { ...body.input, app_calculations: { ...(body.input.app_calculations || {}), ...appCalculations(body.rule_report) } };
  let text = JSON.stringify(payload);
  if (text.length > MAX_INPUT) return res.status(413).json({ error: 'The case is too large for the AI review — remove old serial values' });
  text = deidentifyText(text, body.patient_id ? await identifiersForPatient(body.patient_id) : []);

  try {
    const raw = await chatJSON({
      model: MODEL, temperature: 0.1, max_tokens: 3000,
      messages: [
        { role: 'system', content: CRITICAL_CARE_SYSTEM_PROMPT },
        { role: 'user', content: `${text}\n\nReturn the JSON object only. Keep every key. Be concise: one short sentence per text field, at most 15 calculations, at most 6 differentials.` },
      ],
    }, { timeoutMs: 26000, retries: 0 });
    const review = normaliseCriticalReview(raw);
    const diffs = discrepancies(body.rule_report, review);
    await auditClinical(user, { action: 'ai_request', entity: 'critical_care_review', patientId: body.patient_id || null, detail: { purpose: 'critical_care_review', model: MODEL, prompt: CRITICAL_CARE_PROMPT_VERSION, deidentified: true, ok: true, alerts: review.critical_alerts.length, discrepancies: diffs.length } });
    return res.status(200).json({ review, model: MODEL, prompt_version: CRITICAL_CARE_PROMPT_VERSION, deidentified: true, discrepancies: diffs });
  } catch (e) {
    await auditClinical(user, { action: 'ai_request', entity: 'critical_care_review', patientId: body.patient_id || null, detail: { purpose: 'critical_care_review', ok: false, status: e?.status || null } });
    const status = e instanceof OpenAIError && e.status === 429 ? 429 : 502;
    return res.status(status).json({ error: status === 429 ? 'The AI service is busy — try again shortly. The rule-based analysis is still shown.' : 'The AI review did not complete in time. The rule-based analysis is still shown.' });
  }
}
