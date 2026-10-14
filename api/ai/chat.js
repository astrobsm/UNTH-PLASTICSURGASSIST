/**
 * POST /api/ai/chat — server-side proxy for the app's general AI features
 * (pre-operative summaries, patient summaries, lab interpretation, CME).
 *
 * The client used to call this route without it existing (it lived only in the
 * retired Express server), and kept an OpenAI key in localStorage. Now:
 *   - the key stays on the server (OPENAI_API_KEY);
 *   - governance decision D5 must allow external AI;
 *   - identifiers are removed from the messages before they leave the server
 *     (pass `patientId` so the patient's own name and number are removed too);
 *   - every call is written to clinical_audit_events with the model and
 *     purpose — not the content.
 *
 * Body: { messages, model?, max_tokens?, temperature?, purpose?, patientId? }
 * Response: { response, model, deidentified: true }
 */

import { cors, authenticateRequest } from '../_lib/auth.js';
import { chatCompletion, getOpenAIKey, OpenAIError } from '../_lib/openai.js';
import { externalAiAllowed } from '../_lib/governance.js';
import { deidentifyMessages, identifiersForPatient } from '../_lib/deidentify.js';
import { auditClinical } from '../_lib/clinicalRecords.js';

// Older names the client may send map to current models.
const MODEL_MAP = { 'gpt-4': 'gpt-4o', 'gpt-4-turbo': 'gpt-4o', 'gpt-3.5-turbo': 'gpt-4o-mini' };
const ALLOWED_MODELS = new Set(['gpt-4o', 'gpt-4o-mini']);

export default async function handler(req, res) {
  if (cors(req, res)) return;
  const auth = authenticateRequest(req);
  if (!auth.authenticated) return res.status(401).json({ error: auth.error });
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  if (!(await externalAiAllowed())) {
    return res.status(403).json({ error: 'External AI is switched off by the unit (Clinical Governance, D5).', code: 'AI_DISABLED' });
  }
  if (!getOpenAIKey()) {
    return res.status(503).json({ error: 'AI is not configured on the server (OPENAI_API_KEY).', code: 'AI_NOT_CONFIGURED' });
  }

  let body = req.body;
  if (typeof body === 'string') { try { body = JSON.parse(body); } catch { body = {}; } }
  const { messages, purpose = 'general', patientId = null } = body || {};
  if (!Array.isArray(messages) || messages.length === 0 || messages.length > 30) {
    return res.status(400).json({ error: 'messages must be a non-empty array (max 30)' });
  }
  const requested = String(body.model || 'gpt-4o');
  const model = MODEL_MAP[requested] || (ALLOWED_MODELS.has(requested) ? requested : 'gpt-4o');
  const max_tokens = Math.min(Math.max(Number(body.max_tokens) || 1500, 64), 4000);
  const temperature = Math.min(Math.max(Number(body.temperature ?? 0.2), 0), 1);

  const cleanMessages = deidentifyMessages(
    messages.map(m => ({ role: ['system', 'user', 'assistant'].includes(m?.role) ? m.role : 'user', content: m?.content ?? '' })),
    await identifiersForPatient(patientId)
  );

  try {
    const content = await chatCompletion({ model, messages: cleanMessages, temperature, max_tokens });
    await auditClinical(auth.user, {
      action: 'ai_request', entity: 'ai_chat', patientId,
      detail: { purpose: String(purpose).slice(0, 60), model, deidentified: true, ok: true },
    });
    return res.status(200).json({ response: content || '', model, deidentified: true });
  } catch (e) {
    await auditClinical(auth.user, {
      action: 'ai_request', entity: 'ai_chat', patientId,
      detail: { purpose: String(purpose).slice(0, 60), model, ok: false, status: e?.status || null },
    });
    const status = e instanceof OpenAIError && e.status === 429 ? 429 : 502;
    return res.status(status).json({ error: 'The AI service did not respond. Try again shortly.' });
  }
}
