// Training Progress API - Tracks CME topic completion and training progress
import { query } from './_lib/db.js';
import { cors, authenticateRequest } from './_lib/auth.js';

export default async function handler(req, res) {
  if (cors(req, res)) return;

  // Verify authentication
  const authResult = authenticateRequest(req);
  if (!authResult.authenticated) {
    return res.status(401).json({ error: 'Unauthorized', message: authResult.error });
  }

  const { method } = req;
  const userId = authResult.user.id;

  try {
    switch (method) {
      case 'GET':
        return await getProgress(req, res, userId);
      case 'POST':
        return await saveProgress(req, res, userId);
      default:
        res.setHeader('Allow', ['GET', 'POST']);
        return res.status(405).json({ error: `Method ${method} not allowed` });
    }
  } catch (error) {
    console.error('Training Progress API error:', error);
    return res.status(500).json({ error: 'Internal server error', message: error.message });
  }
}

async function getProgress(req, res, userId) {
  // Check if table exists, create if not
  await ensureTableExists();
  
  // Get all completed topics for this user
  const result = await query(
    `SELECT topic_id, level, completed_at FROM training_progress WHERE user_id = $1 ORDER BY completed_at DESC`,
    [userId]
  );
  
  const completedTopics = result.rows.map(r => r.topic_id);
  
  // Get CBT progress as well — tolerate schema drift (older deployments may
  // lack the `completed`/`percentage` columns); never let this 500 the GET.
  let cbtRows = [];
  try {
    const cbtResult = await query(
      `SELECT level, COUNT(*) as completed_tests, AVG(percentage) as average_score
       FROM cbt_attempts WHERE user_id = $1 AND completed = true GROUP BY level`,
      [userId]
    );
    cbtRows = cbtResult.rows;
  } catch (e) {
    console.warn('training-progress: cbt_attempts aggregate skipped:', e.message);
  }
  
  return res.status(200).json({
    completedTopics,
    progress: result.rows,
    cbtProgress: cbtRows
  });
}

async function saveProgress(req, res, userId) {
  const { topicId, level, completedAt } = req.body;
  
  if (!topicId) {
    return res.status(400).json({ error: 'topicId is required' });
  }
  
  // Check if table exists, create if not
  await ensureTableExists();
  
  // Upsert the completion record
  const result = await query(
    `INSERT INTO training_progress (user_id, topic_id, level, completed_at)
     VALUES ($1, $2, $3, $4)
     ON CONFLICT (user_id, topic_id) DO UPDATE SET completed_at = EXCLUDED.completed_at
     RETURNING *`,
    [userId, topicId, level || 'house_officer', completedAt || new Date().toISOString()]
  );
  
  // Log activity
  await query(
    `INSERT INTO activity_logs (user_id, action_type, description, metadata, created_at)
     VALUES ($1, $2, $3, $4, CURRENT_TIMESTAMP)`,
    [userId, 'training_completed', `Completed training topic: ${topicId}`, JSON.stringify({ topicId, level })]
  ).catch(() => {}); // Don't fail if activity log fails
  
  return res.status(201).json({ success: true, record: result.rows[0] });
}

async function ensureTableExists() {
  await query(`
    CREATE TABLE IF NOT EXISTS training_progress (
      id SERIAL PRIMARY KEY,
      user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
      topic_id VARCHAR(255) NOT NULL,
      level VARCHAR(50) DEFAULT 'house_officer',
      completed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(user_id, topic_id)
    )
  `);
  
  // Create index if not exists
  await query(`
    CREATE INDEX IF NOT EXISTS idx_training_progress_user ON training_progress(user_id)
  `).catch(() => {});
}
