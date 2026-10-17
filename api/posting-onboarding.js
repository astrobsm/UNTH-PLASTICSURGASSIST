// Posting onboarding for house officers and residents (see _lib/postingOnboarding.js).
//
//   GET  /api/posting-onboarding                -> { required, units, defaults, requirements, record, catchUp }
//   POST /api/posting-onboarding?action=submit  { posting_start, posting_end, unit_key, accepted, rules_version }
//   GET  /api/posting-onboarding?action=list    -> every onboarding (rotation administrators)
import { cors, authenticateRequest } from './_lib/auth.js';
import { onboardingStatus, submitOnboarding, listOnboarding } from './_lib/postingOnboarding.js';
import { ROTATION_ADMIN_ROLES } from './_lib/rotationLifecycle.js';

export default async function handler(req, res) {
  if (cors(req, res)) return;
  const auth = authenticateRequest(req);
  if (!auth.authenticated) return res.status(401).json({ error: auth.error });
  const user = auth.user;
  const url = new URL(req.url, `http://${req.headers.host}`);
  const action = url.searchParams.get('action') || '';
  let body = req.body;
  if (typeof body === 'string') { try { body = JSON.parse(body); } catch { body = {}; } }
  body = body || {};

  try {
    if (req.method === 'GET' && action === 'list') {
      if (!ROTATION_ADMIN_ROLES.includes(user.role)) return res.status(403).json({ error: 'Rotation administrators only' });
      return res.status(200).json({ onboarding: await listOnboarding() });
    }
    if (req.method === 'GET') {
      return res.status(200).json(await onboardingStatus(user));
    }
    if (req.method === 'POST' && action === 'submit') {
      const r = await submitOnboarding(user, body);
      if (r.error) return res.status(r.status).json({ error: r.error });
      return res.status(201).json({ record: r.record, catchUp: r.catchUp, unitNote: r.unitNote, ...(await onboardingStatus(user)) });
    }
    return res.status(400).json({ error: 'Unknown action' });
  } catch (e) {
    console.error('posting-onboarding error:', e);
    return res.status(500).json({ error: 'Internal server error' });
  }
}
