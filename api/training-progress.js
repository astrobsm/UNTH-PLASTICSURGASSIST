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
        if (req.body && req.body.action === 'self-assessment') {
          return await saveSelfAssessment(req, res, userId);
        }
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
  
  // Self-assessment aggregate (best score per topic).
  let selfAssessment = { count: 0, average: 0, topics: [] };
  try {
    const sa = await query(
      `SELECT COUNT(*)::int AS count, COALESCE(AVG(percentage), 0)::float AS average
         FROM self_assessment_attempts WHERE user_id = $1`, [userId]
    );
    const topics = await query(
      `SELECT topic_id, percentage, passed, attempts, completed_at
         FROM self_assessment_attempts WHERE user_id = $1 ORDER BY completed_at DESC`, [userId]
    );
    selfAssessment = { count: sa.rows[0].count, average: Math.round(sa.rows[0].average * 10) / 10, topics: topics.rows };
  } catch (e) {
    console.warn('training-progress: self_assessment aggregate skipped:', e.message);
  }

  return res.status(200).json({
    completedTopics,
    progress: result.rows,
    cbtProgress: cbtRows,
    selfAssessment
  });
}

async function saveSelfAssessment(req, res, userId) {
  const { topicId, level, correct, total } = req.body;
  if (!topicId || !total) {
    return res.status(400).json({ error: 'topicId and total are required' });
  }
  await ensureTableExists();
  const pct = Math.round((Number(correct || 0) / Number(total)) * 10000) / 100; // 2dp
  const passed = pct >= 70;
  const result = await query(
    `INSERT INTO self_assessment_attempts (user_id, topic_id, level, correct, total, percentage, passed, attempts, completed_at)
     VALUES ($1, $2, $3, $4, $5, $6, $7, 1, CURRENT_TIMESTAMP)
     ON CONFLICT (user_id, topic_id) DO UPDATE SET
       attempts = self_assessment_attempts.attempts + 1,
       correct = CASE WHEN EXCLUDED.percentage > self_assessment_attempts.percentage THEN EXCLUDED.correct ELSE self_assessment_attempts.correct END,
       total = EXCLUDED.total,
       percentage = GREATEST(self_assessment_attempts.percentage, EXCLUDED.percentage),
       passed = (GREATEST(self_assessment_attempts.percentage, EXCLUDED.percentage) >= 70),
       completed_at = CURRENT_TIMESTAMP
     RETURNING *`,
    [userId, topicId, level || 'house_officer', Number(correct || 0), Number(total), pct, passed]
  );
  await query(
    `INSERT INTO activity_logs (user_id, activity_type, description, points, metadata, created_at)
     VALUES ($1, 'self_assessment', $2, $3, $4, CURRENT_TIMESTAMP)`,
    [userId, `Self-assessment: ${topicId} (${pct}%)`, Math.round(pct / 10), JSON.stringify({ topicId, level, correct, total, percentage: pct })]
  ).catch(() => {});
  return res.status(201).json({ success: true, record: result.rows[0] });
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

  // Self-assessment attempts (best score kept per topic).
  await query(`
    CREATE TABLE IF NOT EXISTS self_assessment_attempts (
      id SERIAL PRIMARY KEY,
      user_id INTEGER,
      topic_id VARCHAR(255) NOT NULL,
      level VARCHAR(50) DEFAULT 'house_officer',
      correct INTEGER DEFAULT 0,
      total INTEGER DEFAULT 0,
      percentage NUMERIC(5,2) DEFAULT 0,
      passed BOOLEAN DEFAULT false,
      attempts INTEGER DEFAULT 1,
      completed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(user_id, topic_id)
    )
  `).catch(() => {});
  await query(`CREATE INDEX IF NOT EXISTS idx_self_assessment_user ON self_assessment_attempts(user_id)`).catch(() => {});
}
