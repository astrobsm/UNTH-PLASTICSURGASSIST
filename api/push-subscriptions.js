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
  const { endpoint, keys } = data || {};

  if (!endpoint || !keys) {
    return res.status(400).json({ error: 'Endpoint and keys are required' });
  }

  // Ensure table exists (idempotent)
  await ensurePushSubscriptionsTable();

  // Coerce user.id to string so it matches the TEXT column even if the JWT
  // payload stores it as a number.
  const userId = user?.id != null ? String(user.id) : null;
  if (!userId) {
    return res.status(401).json({ error: 'Invalid auth payload: missing user id' });
  }

  try {
    // Check if subscription already exists
    const existingResult = await query(
      'SELECT id FROM push_subscriptions WHERE user_id = $1 AND endpoint = $2',
      [userId, endpoint]
    );

    if (existingResult.rows.length > 0) {
      const result = await query(
        `UPDATE push_subscriptions 
         SET keys = $1, updated_at = NOW()
         WHERE user_id = $2 AND endpoint = $3
         RETURNING *`,
        [JSON.stringify(keys), userId, endpoint]
      );
      return res.status(200).json({ subscription: result.rows[0] });
    }

    const result = await query(
      `INSERT INTO push_subscriptions (user_id, endpoint, keys, created_at, updated_at)
       VALUES ($1, $2, $3, NOW(), NOW())
       RETURNING *`,
      [userId, endpoint, JSON.stringify(keys)]
    );
    return res.status(201).json({ subscription: result.rows[0] });
  } catch (err) {
    // Most common production failure: an older push_subscriptions table whose
    // user_id column is INTEGER. Log the detail and surface a clear error
    // instead of a generic 500.
    console.error('saveSubscription failed:', err.message, err.code);
    return res.status(500).json({
      error: 'Failed to save push subscription',
      message: err.message,
      hint: err.code === '22P02' || /invalid input syntax/i.test(err.message)
        ? 'push_subscriptions.user_id column type may be incompatible (expected TEXT). Drop or migrate the table.'
        : undefined
    });
  }
}

async function ensurePushSubscriptionsTable() {
  await query(`
    CREATE TABLE IF NOT EXISTS push_subscriptions (
      id SERIAL PRIMARY KEY,
      user_id TEXT NOT NULL,
      endpoint TEXT NOT NULL,
      keys JSONB NOT NULL,
      is_active BOOLEAN DEFAULT TRUE,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(user_id, endpoint)
    )
  `);
}

async function getAllSubscriptions(res) {
  await ensurePushSubscriptionsTable();
  const result = await query(
    'SELECT * FROM push_subscriptions WHERE is_active = true ORDER BY created_at DESC'
  );
  res.status(200).json({ subscriptions: result.rows });
}
