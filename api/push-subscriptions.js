// Push Subscriptions API endpoint for Vercel serverless
import { query } from './_lib/db.js';
import { cors, authenticateRequest } from './_lib/auth.js';

export default async function handler(req, res) {
  if (cors(req, res)) return;

  const auth = authenticateRequest(req);
  if (!auth.authenticated) {
    return res.status(401).json({ error: auth.error });
  }

  const { method } = req;

  try {
    switch (method) {
      case 'POST':
        return await saveSubscription(req.body, auth.user, res);
      case 'GET':
        return await getAllSubscriptions(res);
      default:
        res.status(405).json({ error: 'Method not allowed' });
    }
  } catch (error) {
    console.error('Push Subscriptions API error:', error);
    res.status(500).json({ error: 'Internal server error', message: error.message });
  }
}

async function saveSubscription(data, user, res) {
  const { endpoint, keys } = data;

  if (!endpoint || !keys) {
    return res.status(400).json({ error: 'Endpoint and keys are required' });
  }

  // Check if subscription already exists
  const existingResult = await query(
    'SELECT id FROM push_subscriptions WHERE user_id = $1 AND endpoint = $2',
    [user.id, endpoint]
  );

  if (existingResult.rows.length > 0) {
    // Update existing subscription
    const result = await query(
      `UPDATE push_subscriptions 
       SET keys = $1, updated_at = NOW()
       WHERE user_id = $2 AND endpoint = $3
       RETURNING *`,
      [JSON.stringify(keys), user.id, endpoint]
    );
    return res.status(200).json({ subscription: result.rows[0] });
  } else {
    // Create new subscription
    const result = await query(
      `INSERT INTO push_subscriptions (user_id, endpoint, keys, created_at, updated_at)
       VALUES ($1, $2, $3, NOW(), NOW())
       RETURNING *`,
      [user.id, endpoint, JSON.stringify(keys)]
    );
    return res.status(201).json({ subscription: result.rows[0] });
  }
}

async function getAllSubscriptions(res) {
  const result = await query(
    'SELECT * FROM push_subscriptions WHERE is_active = true ORDER BY created_at DESC'
  );
  res.status(200).json({ subscriptions: result.rows });
}
