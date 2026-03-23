// Consults API – Proxy to PS Consult UNTH external system
// Authenticates with external app via code-login, then fetches consults
import { cors, authenticateRequest } from './_lib/auth.js';

const EXTERNAL_BASE = 'https://ps-consult-unth.vercel.app/api';
const DOCTOR_CODE = process.env.PS_CONSULT_CODE || 'BLACKVELVET';

// In-memory token cache (per serverless instance)
let cachedToken = null;
let tokenExpiry = 0;

async function getExternalToken() {
  // Reuse token if still valid (with 60s buffer)
  if (cachedToken && Date.now() < tokenExpiry - 60000) {
    return cachedToken;
  }
  const response = await fetch(`${EXTERNAL_BASE}/auth/code-login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ code: DOCTOR_CODE }),
  });
  if (!response.ok) {
    throw new Error(`External auth failed: ${response.status}`);
  }
  const data = await response.json();
  cachedToken = data.access_token;
  // Default to 30 min expiry if we can't decode
  tokenExpiry = Date.now() + 30 * 60 * 1000;
  try {
    const payload = JSON.parse(atob(cachedToken.split('.')[1]));
    if (payload.exp) tokenExpiry = payload.exp * 1000;
  } catch (_) {}
  return cachedToken;
}

export default async function handler(req, res) {
  if (cors(req, res)) return;

  // Require PSA authentication
  const auth = authenticateRequest(req);
  if (!auth.authenticated) {
    return res.status(401).json({ error: auth.error });
  }

  const { method, url } = req;
  const parsedUrl = new URL(url, `http://${req.headers.host}`);
  const pathParts = parsedUrl.pathname.replace('/api/consults', '').split('/').filter(Boolean);

  try {
    // Get token for external API
    const externalToken = await getExternalToken();
    const authHeaders = {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${externalToken}`,
    };

    if (method === 'GET') {
      if (pathParts.length === 0) {
        // GET /api/consults — list all consults (uses authenticated endpoint)
        const params = new URLSearchParams();
        const { page, per_page, ward, urgency, status, date_from, date_to, search } = req.query;
        if (page) params.set('page', page);
        if (per_page) params.set('per_page', per_page);
        if (ward) params.set('ward', ward);
        if (urgency) params.set('urgency', urgency);
        if (status) params.set('status', status);
        if (date_from) params.set('date_from', date_from);
        if (date_to) params.set('date_to', date_to);
        if (search) params.set('search', search);

        const response = await fetch(`${EXTERNAL_BASE}/consults/?${params.toString()}`, {
          headers: authHeaders,
        });
        if (!response.ok) {
          const text = await response.text();
          return res.status(response.status).json({ error: text });
        }
        const data = await response.json();
        return res.status(200).json(data);
      }

      if (pathParts.length === 1) {
        // GET /api/consults/:id — get single consult
        const consultId = pathParts[0];
        const response = await fetch(`${EXTERNAL_BASE}/consults/${encodeURIComponent(consultId)}`, {
          headers: authHeaders,
        });
        if (!response.ok) {
          const text = await response.text();
          return res.status(response.status).json({ error: text });
        }
        const data = await response.json();
        return res.status(200).json(data);
      }

      return res.status(404).json({ error: 'Not found' });
    }

    if (method === 'PATCH') {
      if (pathParts.length === 2 && pathParts[1] === 'status') {
        // PATCH /api/consults/:id/status — update status
        const consultId = pathParts[0];
        const response = await fetch(`${EXTERNAL_BASE}/consults/${encodeURIComponent(consultId)}/status`, {
          method: 'PATCH',
          headers: authHeaders,
          body: JSON.stringify(req.body),
        });
        if (!response.ok) {
          const text = await response.text();
          return res.status(response.status).json({ error: text });
        }
        const data = await response.json();
        return res.status(200).json(data);
      }
      return res.status(404).json({ error: 'Not found' });
    }

    return res.status(405).json({ error: 'Method not allowed' });
  } catch (error) {
    console.error('Consults proxy error:', error);
    // If auth failed, clear cache and retry once
    if (error.message?.includes('External auth failed')) {
      cachedToken = null;
      tokenExpiry = 0;
    }
    return res.status(502).json({ error: 'Failed to reach consult system' });
  }
}
