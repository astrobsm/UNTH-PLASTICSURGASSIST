// ============================================================================
// Shared OpenAI Chat Completions helper.
//
// Every AI/OCR endpoint used to inline its own fetch to the OpenAI API, each with
// slightly different (and mostly absent) timeout / retry / error handling. Transient
// 429 (rate-limit) and 5xx responses are a leading cause of "the scan failed / came
// back blank" — i.e. they directly hurt effective OCR accuracy. This helper adds:
//   - a hard request timeout (AbortController)
//   - exponential-backoff retry on retryable statuses (429/500/502/503/504) and
//     network/timeout errors
//   - one consistent typed error (OpenAIError) with an HTTP-ish status
//   - a chatJSON() convenience that forces json_object mode and salvages/parses.
//
// It is deliberately dependency-free and returns the assistant message content
// (string), so it is a drop-in for the previous inline `fetch(...).choices[0]...`.
// ============================================================================

const OPENAI_URL = 'https://api.openai.com/v1/chat/completions';
const RETRYABLE = new Set([429, 500, 502, 503, 504]);

export class OpenAIError extends Error {
  constructor(message, status = 0, body = null) {
    super(message);
    this.name = 'OpenAIError';
    this.status = status;   // OpenAI HTTP status, or 504 for timeout, 0 for local/config
    this.body = body;
  }
}

export function getOpenAIKey() {
  return process.env.OPENAI_API_KEY || null;
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/**
 * Call OpenAI chat completions with timeout + retry.
 * @param {object} params - { model, messages, temperature?, max_tokens?, response_format? }
 * @param {object} [opts] - { timeoutMs?, retries?, apiKey? }
 * @returns {Promise<string>} assistant message content
 * @throws {OpenAIError}
 */
export async function chatCompletion(params = {}, opts = {}) {
  const { model, messages, temperature = 0.2, max_tokens = 2048, response_format } = params;
  const { timeoutMs = 45000, retries = 2, apiKey } = opts;

  const key = apiKey || getOpenAIKey();
  if (!key) throw new OpenAIError('OpenAI API key not configured', 0);
  if (!model || !Array.isArray(messages)) throw new OpenAIError('chatCompletion requires { model, messages }', 0);

  const body = JSON.stringify({
    model, messages, temperature, max_tokens,
    ...(response_format ? { response_format } : {}),
  });

  let lastErr = null;
  for (let attempt = 0; attempt <= retries; attempt++) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const resp = await fetch(OPENAI_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${key}` },
        body,
        signal: controller.signal,
      });
      clearTimeout(timer);

      if (resp.ok) {
        const data = await resp.json();
        return data?.choices?.[0]?.message?.content ?? '';
      }

      const errText = await resp.text().catch(() => '');
      lastErr = new OpenAIError(`OpenAI API error ${resp.status}`, resp.status, errText);
      // Non-retryable (e.g. 400 bad request, 401 auth) → fail fast.
      if (!RETRYABLE.has(resp.status) || attempt === retries) throw lastErr;
    } catch (e) {
      clearTimeout(timer);
      if (e instanceof OpenAIError) {
        if (!RETRYABLE.has(e.status) || attempt === retries) throw e;
        lastErr = e;
      } else {
        const isAbort = e?.name === 'AbortError';
        lastErr = new OpenAIError(isAbort ? 'OpenAI request timed out' : (e?.message || 'OpenAI request failed'), isAbort ? 504 : 0);
        if (attempt === retries) throw lastErr;
      }
    }
    // Exponential backoff with jitter before the next attempt.
    await sleep(400 * 2 ** attempt + Math.floor(Math.random() * 250));
  }
  throw lastErr || new OpenAIError('OpenAI request failed', 0);
}

/**
 * Like chatCompletion but forces JSON output and returns a parsed object.
 * Salvages the first {...} block if the model wraps the JSON in prose.
 */
export async function chatJSON(params = {}, opts = {}) {
  const content = await chatCompletion({ ...params, response_format: { type: 'json_object' } }, opts);
  try {
    return JSON.parse(content);
  } catch {
    const m = typeof content === 'string' && content.match(/\{[\s\S]*\}/);
    if (m) {
      try { return JSON.parse(m[0]); } catch { /* fall through */ }
    }
    throw new OpenAIError('Failed to parse JSON from OpenAI response', 502, content);
  }
}
