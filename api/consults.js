// Consults API – Proxy to PS Consult UNTH external system
// Fetches consult requests from https://ps-consult-unth.vercel.app
import { cors, authenticateRequest } from './_lib/auth.js';

const EXTERNAL_API = 'https://ps-consult-unth.vercel.app/api/consults';

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
    if (method === 'GET') {
      if (pathParts.length === 0) {
        // GET /api/consults — list all consults
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

        const response = await fetch(`${EXTERNAL_API}/public-list?${params.toString()}`);
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
        const response = await fetch(`${EXTERNAL_API}/public-list/${encodeURIComponent(consultId)}`);
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
        // PATCH /api/consults/:id/status — update status (forward to external)
        const consultId = pathParts[0];
        const response = await fetch(`${EXTERNAL_API}/${encodeURIComponent(consultId)}/status`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
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
    return res.status(502).json({ error: 'Failed to reach consult system' });
  }
}
