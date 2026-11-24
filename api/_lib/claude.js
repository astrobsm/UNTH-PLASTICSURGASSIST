// ============================================================================
// Shared Claude (Anthropic) helper — every AI feature in the app goes through
// here. It replaced the OpenAI helper; the call shape the endpoints use
// (`{ messages, max_tokens, response_format }` with system/user roles and
// image_url parts) is accepted unchanged and translated to the Messages API:
//   - system messages become the top-level `system` prompt;
//   - image_url parts (data: URIs or https URLs) become image blocks;
//   - response_format json_object becomes a JSON-only instruction, and the
//     reply is cleaned to the bare object so callers can JSON.parse it;
//   - temperature / model / detail are ignored (one model, set here).
// Timeouts and retries are the SDK's (429 / 5xx / connection errors).
// ============================================================================
import Anthropic from '@anthropic-ai/sdk';

export const AI_MODEL = 'claude-opus-5-5';
export const AI_PROVIDER = 'anthropic';

export class AIError extends Error {
  constructor(message, status = 0, body = null) {
    super(message);
    this.name = 'AIError';
    this.status = status;   // HTTP status from Anthropic, 504 for timeout, 0 for local/config
    this.body = body;
  }
}

export function getAIKey() {
  return process.env.ANTHROPIC_API_KEY || null;
}

const JSON_ONLY = 'Respond with one JSON object only: no prose before or after it, no markdown code fences.';

function imageBlock(url) {
  const m = /^data:([^;]+);base64,(.*)$/s.exec(String(url || ''));
  if (m) return { type: 'image', source: { type: 'base64', media_type: m[1], data: m[2] } };
  if (/^https?:\/\//i.test(url)) return { type: 'image', source: { type: 'url', url } };
  return null;
}

function toContent(content) {
  if (typeof content === 'string') return content;
  if (!Array.isArray(content)) return String(content ?? '');
  const out = [];
  for (const part of content) {
    if (!part) continue;
    if (part.type === 'text') out.push({ type: 'text', text: String(part.text ?? '') });
    else if (part.type === 'image_url') { const b = imageBlock(part.image_url?.url ?? part.image_url); if (b) out.push(b); }
    else if (part.type === 'image' || part.type === 'document') out.push(part);
  }
  return out;
}

/** OpenAI-style messages → { system, messages } for the Messages API. Exported for tests. */
export function toClaudeRequest(messages, { json = false } = {}) {
  const system = [];
  const turns = [];
  for (const m of messages || []) {
    if (!m) continue;
    if (m.role === 'system') {
      const c = toContent(m.content);
      system.push(typeof c === 'string' ? c : c.filter(b => b.type === 'text').map(b => b.text).join('\n'));
      continue;
    }
    const role = m.role === 'assistant' ? 'assistant' : 'user';
    turns.push({ role, content: toContent(m.content) });
  }
  // The conversation must start with the user and must not end on an
  // assistant turn (prefill is rejected by current models).
  while (turns.length && turns[0].role !== 'user') turns.shift();
  while (turns.length && turns[turns.length - 1].role === 'assistant') turns.pop();
  if (!turns.length) turns.push({ role: 'user', content: 'Continue.' });
  if (json) system.push(JSON_ONLY);
  return { system: system.filter(Boolean).join('\n\n'), messages: turns };
}

/** The first balanced {...} (or [...]) in a reply, with code fences removed. */
export function extractJSONText(text) {
  const s = String(text || '').replace(/^\s*```(?:json)?\s*/i, '').replace(/\s*```\s*$/, '').trim();
  try { JSON.parse(s); return s; } catch { /* look for the object inside */ }
  const start = s.search(/[[{]/);
  if (start < 0) return s;
  const open = s[start], close = open === '{' ? '}' : ']';
  let depth = 0, inStr = false, esc = false;
  for (let i = start; i < s.length; i++) {
    const c = s[i];
    if (inStr) { if (esc) esc = false; else if (c === '\\') esc = true; else if (c === '"') inStr = false; continue; }
    if (c === '"') inStr = true;
    else if (c === open) depth++;
    else if (c === close && --depth === 0) return s.slice(start, i + 1);
  }
  return s.slice(start);
}

let cached = null;
function clientFor(apiKey, timeoutMs, retries) {
  if (!cached || cached.key !== apiKey || cached.timeoutMs !== timeoutMs || cached.retries !== retries) {
    cached = { key: apiKey, timeoutMs, retries, client: new Anthropic({ apiKey, timeout: timeoutMs, maxRetries: retries }) };
  }
  return cached.client;
}

/**
 * Ask Claude. Same call shape the endpoints used with OpenAI.
 * @param {object} params  { messages, max_tokens?, response_format?, effort? }
 * @param {object} [opts]  { timeoutMs?, retries?, apiKey? }
 * @returns {Promise<string>} the reply text (bare JSON text in json mode)
 * @throws {AIError}
 */
export async function chatCompletion(params = {}, opts = {}) {
  const { messages, max_tokens = 2048, response_format, effort = 'low' } = params;
  const { timeoutMs = 45000, retries = 2, apiKey } = opts;
  const key = apiKey || getAIKey();
  if (!key) throw new AIError('Claude API key not configured (ANTHROPIC_API_KEY)', 0);
  if (!Array.isArray(messages)) throw new AIError('chatCompletion requires { messages }', 0);

  const json = response_format?.type === 'json_object' || response_format?.type === 'json_schema';
  const req = toClaudeRequest(messages, { json });
  // Thinking is always on for this model and counts against max_tokens, so
  // leave room for it on top of the answer the caller sized.
  const budget = Math.min(16000, Math.max(1024, Number(max_tokens) || 2048) + 4096);

  let msg;
  try {
    msg = await clientFor(key, timeoutMs, retries).beta.messages.create({
      model: AI_MODEL,
      max_tokens: budget,
      ...(req.system ? { system: req.system } : {}),
      messages: req.messages,
      output_config: { effort },
      // If a safety classifier declines, the API re-runs on a fallback model.
      betas: ['server-side-fallback-2026-07-01'],
      fallbacks: 'default',
    });
  } catch (e) {
    if (e instanceof Anthropic.APIConnectionTimeoutError) throw new AIError('Claude request timed out', 504);
    if (e instanceof Anthropic.APIError && e.status) throw new AIError(`Claude API error ${e.status}`, e.status, e.message);
    throw new AIError(e?.message || 'Claude request failed', 0);
  }
  if (msg.stop_reason === 'refusal') throw new AIError('Claude declined this request', 422, msg.stop_details || null);
  const text = (msg.content || []).filter(b => b.type === 'text').map(b => b.text).join('');
  return json ? extractJSONText(text) : text;
}

/** chatCompletion in JSON mode, parsed. */
export async function chatJSON(params = {}, opts = {}) {
  const content = await chatCompletion({ ...params, response_format: { type: 'json_object' } }, opts);
  try {
    return JSON.parse(content);
  } catch {
    throw new AIError('Failed to parse JSON from Claude response', 502, content);
  }
}
