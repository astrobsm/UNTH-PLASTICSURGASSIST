// Structured clinical encounters API — initial clerking, follow-up encounters
// and the problem list / plan they feed.
//
//   GET  ?patient_id=                 -> encounters, problems, plan items, can_sign
//   GET  ?id=                         -> one encounter
//   POST ?action=save                 {id?, version?, patient_id, encounter_type, data, suggestions, summary, narrative}
//   POST ?action=submit&id=           {version}  -> signed (signer) or pending_review (house officer)
//   POST ?action=sign&id=             {version}  -> sign a pending encounter (D6 sign roles)
//   POST ?action=error&id=            {reason}   -> entered in error
//   POST ?action=problem&id=          {status, note}
//   POST ?action=plan_item&id=        {status, note}
//   POST ?action=suggest              {patient_id, payload}  -> de-identified AI suggestions (D5)
import { cors, authenticateRequest } from './_lib/auth.js';
import { auditClinical } from './_lib/clinicalRecords.js';
import { externalAiAllowed } from './_lib/governance.js';
import { chatJSON, getOpenAIKey, OpenAIError } from './_lib/openai.js';
import { deidentifyText, identifiersForPatient } from './_lib/deidentify.js';
import {
  ensureEncounterTables, listForPatient, getEncounter, saveEncounter, submitEncounter, markEncounterInError,
  updateTracked, canSign, AI_SYSTEM_PROMPT, normaliseAiSuggestions,
} from './_lib/clinicalEncounters.js';

export default async function handler(req, res) {
  if (cors(req, res)) return;
  const auth = authenticateRequest(req);
  if (!auth.authenticated) return res.status(401).json({ error: auth.error });
  const user = auth.user;
  const url = new URL(req.url, `http://${req.headers.host}`);
  const action = url.searchParams.get('action') || '';
  const id = url.searchParams.get('id');
  let body = req.body;
  if (typeof body === 'string') { try { body = JSON.parse(body); } catch { body = {}; } }
  body = body || {};

  try {
    await ensureEncounterTables();

    if (req.method === 'GET') {
      if (id) {
        const enc = await getEncounter(id);
        return enc ? res.status(200).json({ encounter: enc }) : res.status(404).json({ error: 'Encounter not found' });
      }
      const patientId = url.searchParams.get('patient_id');
      if (!patientId) return res.status(400).json({ error: 'patient_id is required' });
      return res.status(200).json({ ...(await listForPatient(patientId)), can_sign: await canSign(user) });
    }

    if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

    if (action === 'save') {
      const r = await saveEncounter(body, user);
      if (r.error) return res.status(r.status).json({ error: r.error, current: r.current });
      if (r.status === 201) {
        await auditClinical(user, { action: 'create', entity: 'clinical_encounters', entityId: r.encounter.id, patientId: r.encounter.patient_id, detail: { type: r.encounter.encounter_type } });
      }
      return res.status(r.status).json({ encounter: r.encounter });
    }

    if (action === 'submit' || action === 'sign') {
      if (!id) return res.status(400).json({ error: 'id is required' });
      const r = await submitEncounter(id, body.version, user, { sign: action === 'sign' });
      if (r.error) return res.status(r.status).json({ error: r.error });
      await auditClinical(user, { action: r.encounter.status === 'signed' ? 'sign' : 'submit', entity: 'clinical_encounters', entityId: r.encounter.id, patientId: r.encounter.patient_id });
      return res.status(200).json({ encounter: r.encounter, ...(await listForPatient(r.encounter.patient_id)) });
    }

    if (action === 'error') {
      if (!id) return res.status(400).json({ error: 'id is required' });
      const r = await markEncounterInError(id, user, body.reason);
      if (r.error) return res.status(r.status).json({ error: r.error });
      await auditClinical(user, { action: 'entered_in_error', entity: 'clinical_encounters', entityId: id, patientId: r.encounter.patient_id, detail: { reason: String(body.reason).slice(0, 200) } });
      return res.status(200).json({ encounter: r.encounter });
    }

    if (action === 'problem' || action === 'plan_item') {
      if (!id) return res.status(400).json({ error: 'id is required' });
      const r = await updateTracked(action === 'problem' ? 'problem' : 'plan', id, body.status, body.note, user);
      if (r.error) return res.status(r.status).json({ error: r.error });
      await auditClinical(user, { action: 'status_change', entity: action === 'problem' ? 'clinical_problems' : 'clinical_plan_items', entityId: id, patientId: r.item.patient_id, detail: { status: body.status } });
      return res.status(200).json({ item: r.item });
    }

    if (action === 'suggest') {
      if (!(await externalAiAllowed())) {
        return res.status(403).json({ error: 'External AI is switched off by the unit (Clinical Governance, D5). Rule-based suggestions are still shown.', code: 'AI_DISABLED' });
      }
      if (!getOpenAIKey()) return res.status(503).json({ error: 'AI is not configured on the server.', code: 'AI_NOT_CONFIGURED' });
      if (!body.payload || typeof body.payload !== 'object') return res.status(400).json({ error: 'payload is required' });
      const text = JSON.stringify(body.payload).slice(0, 40000);
      const clean = deidentifyText(text, await identifiersForPatient(body.patient_id));
      try {
        const raw = await chatJSON({
          model: 'gpt-4o', temperature: 0.2, max_tokens: 2500,
          messages: [{ role: 'system', content: AI_SYSTEM_PROMPT }, { role: 'user', content: clean }],
        });
        const out = normaliseAiSuggestions(raw);
        await auditClinical(user, { action: 'ai_request', entity: 'clinical_encounters', patientId: body.patient_id || null, detail: { purpose: 'clerking_suggestions', model: 'gpt-4o', deidentified: true, ok: true, count: out.suggestions.length } });
        return res.status(200).json({ ...out, model: 'gpt-4o', deidentified: true });
      } catch (e) {
        await auditClinical(user, { action: 'ai_request', entity: 'clinical_encounters', patientId: body.patient_id || null, detail: { purpose: 'clerking_suggestions', ok: false, status: e?.status || null } });
        const status = e instanceof OpenAIError && e.status === 429 ? 429 : 502;
        return res.status(status).json({ error: 'The AI service did not respond. Rule-based suggestions are still available.' });
      }
    }

    return res.status(400).json({ error: 'Unknown action' });
  } catch (e) {
    console.error('clinical-encounters error:', e);
    return res.status(500).json({ error: 'Internal server error' });
  }
}
