// CBT (Computer-Based Test) API endpoints
import { query } from './_lib/db.js';
import { cors, verifyToken, requireAuth } from './_lib/auth.js';

export default async function handler(req, res) {
  if (cors(req, res)) return;

  // Verify authentication
  const authResult = await verifyToken(req);
  if (!authResult.authenticated) {
    return res.status(401).json({ error: 'Unauthorized', message: authResult.error });
  }

  const { method } = req;
  const userId = authResult.user.id;

  try {
    switch (method) {
      case 'GET':
        return await handleGet(req, res, userId);
      case 'POST':
        return await handlePost(req, res, userId);
      case 'PUT':
        return await handlePut(req, res, userId);
      default:
        res.setHeader('Allow', ['GET', 'POST', 'PUT']);
        return res.status(405).json({ error: `Method ${method} not allowed` });
    }
  } catch (error) {
    console.error('CBT API error:', error);
    return res.status(500).json({ error: 'Internal server error', message: error.message });
  }
}

async function handleGet(req, res, userId) {
  const { action, level, testNumber, attemptId } = req.query;

  switch (action) {
    case 'tests':
      // Get all tests for a level
      const testsResult = await query(
        `SELECT * FROM cbt_tests WHERE level = $1 AND is_active = true ORDER BY test_number`,
        [level || 'house_officer']
      );
      return res.status(200).json({ tests: testsResult.rows });

    case 'attempts':
      // Get user's attempts
      const attemptsResult = await query(
        `SELECT * FROM cbt_attempts WHERE user_id = $1 ${level ? 'AND level = $2' : ''} ORDER BY created_at DESC`,
        level ? [userId, level] : [userId]
      );
      return res.status(200).json({ attempts: attemptsResult.rows });

    case 'attempt':
      // Get specific attempt
      const attemptResult = await query(
        `SELECT ca.*, ct.questions FROM cbt_attempts ca 
         LEFT JOIN cbt_tests ct ON ca.test_id = ct.id 
         WHERE ca.id = $1 AND ca.user_id = $2`,
        [attemptId, userId]
      );
      if (attemptResult.rows.length === 0) {
        return res.status(404).json({ error: 'Attempt not found' });
      }
      return res.status(200).json({ attempt: attemptResult.rows[0] });

    case 'progress':
      // Get user's CBT progress
      const progressResult = await query(
        `SELECT 
          level,
          COUNT(*) FILTER (WHERE completed = true) as completed_tests,
          AVG(percentage) FILTER (WHERE completed = true) as average_score,
          MAX(percentage) as best_score
         FROM cbt_attempts 
         WHERE user_id = $1 
         GROUP BY level`,
        [userId]
      );
      return res.status(200).json({ progress: progressResult.rows });

    default:
      // Get current user's CBT summary
      const summaryResult = await query(
        `SELECT 
          (SELECT COUNT(*) FROM cbt_attempts WHERE user_id = $1 AND completed = true) as total_completed,
          (SELECT AVG(percentage) FROM cbt_attempts WHERE user_id = $1 AND completed = true) as average_score,
          (SELECT COUNT(*) FROM cbt_attempts WHERE user_id = $1 AND passed = true) as tests_passed
        `,
        [userId]
      );
      return res.status(200).json({ summary: summaryResult.rows[0] });
  }
}

async function handlePost(req, res, userId) {
  const { action } = req.query;
  const body = req.body;

  switch (action) {
    case 'start':
      // Start a new test attempt
      const { testId, level, testNumber } = body;
      
      // Check if test exists
      let test;
      if (testId) {
        const testResult = await query('SELECT * FROM cbt_tests WHERE id = $1', [testId]);
        test = testResult.rows[0];
      }
      
      // Create new attempt
      const attemptResult = await query(
        `INSERT INTO cbt_attempts 
         (test_id, user_id, level, test_number, start_time, answers, score, total_marks, percentage, passed, completed)
         VALUES ($1, $2, $3, $4, CURRENT_TIMESTAMP, '{}', 0, 100, 0, false, false)
         RETURNING *`,
        [test?.id || null, userId, level, testNumber]
      );
      
      // Log activity
      await logActivity(userId, 'cbt_started', `Started CBT test ${testNumber} for ${level}`);
      
      return res.status(201).json({ attempt: attemptResult.rows[0] });

    case 'answer':
      // Update answer for a question
      const { attemptId, questionId, answer } = body;
      
      await query(
        `UPDATE cbt_attempts 
         SET answers = answers || $1::jsonb, updated_at = CURRENT_TIMESTAMP
         WHERE id = $2 AND user_id = $3`,
        [JSON.stringify({ [questionId]: answer }), attemptId, userId]
      );
      
      return res.status(200).json({ success: true });

    case 'submit':
      // Submit test and calculate score
      const { attemptId: submitAttemptId, answers, tabSwitchCount } = body;
      
      // Get the attempt and test questions
      const attemptData = await query(
        `SELECT ca.*, ct.questions FROM cbt_attempts ca
         LEFT JOIN cbt_tests ct ON ca.test_id = ct.id
         WHERE ca.id = $1 AND ca.user_id = $2`,
        [submitAttemptId, userId]
      );
      
      if (attemptData.rows.length === 0) {
        return res.status(404).json({ error: 'Attempt not found' });
      }
      
      const attempt = attemptData.rows[0];
      const questions = attempt.questions || [];
      
      // Calculate score
      let score = 0;
      questions.forEach(q => {
        if (answers[q.id] === q.correctAnswer) {
          score += q.marks || 4;
        }
      });
      
      const percentage = (score / 100) * 100;
      const passed = percentage >= 50;
      
      // Update attempt
      await query(
        `UPDATE cbt_attempts 
         SET end_time = CURRENT_TIMESTAMP, 
             answers = $1, 
             score = $2, 
             percentage = $3, 
             passed = $4, 
             completed = true,
             tab_switch_count = $5,
             suspicious_activity = $6,
             updated_at = CURRENT_TIMESTAMP
         WHERE id = $7 AND user_id = $8`,
        [
          JSON.stringify(answers), 
          score, 
          percentage, 
          passed, 
          tabSwitchCount || 0,
          (tabSwitchCount || 0) >= 3,
          submitAttemptId, 
          userId
        ]
      );
      
      // Log activity
      await logActivity(userId, 'cbt_completed', `Completed CBT test with ${percentage}% score`, { score, percentage, passed });
      
      // Get updated attempt
      const updatedAttempt = await query(
        'SELECT * FROM cbt_attempts WHERE id = $1',
        [submitAttemptId]
      );
      
      return res.status(200).json({ 
        attempt: updatedAttempt.rows[0],
        score,
        percentage,
        passed
      });

    case 'tab-switch':
      // Record tab switch
      const { attemptId: switchAttemptId } = body;
      
      await query(
        `UPDATE cbt_attempts 
         SET tab_switch_count = tab_switch_count + 1,
             suspicious_activity = CASE WHEN tab_switch_count >= 2 THEN true ELSE suspicious_activity END,
             updated_at = CURRENT_TIMESTAMP
         WHERE id = $1 AND user_id = $2`,
        [switchAttemptId, userId]
      );
      
      return res.status(200).json({ success: true });

    default:
      return res.status(400).json({ error: 'Invalid action' });
  }
}

async function handlePut(req, res, userId) {
  const { attemptId } = req.query;
  const { flaggedForReview } = req.body;
  
  await query(
    `UPDATE cbt_attempts 
     SET flagged_for_review = $1, updated_at = CURRENT_TIMESTAMP
     WHERE id = $2 AND user_id = $3`,
    [JSON.stringify(flaggedForReview), attemptId, userId]
  );
  
  return res.status(200).json({ success: true });
}

async function logActivity(userId, activityType, description, metadata = {}) {
  const points = {
    'cbt_started': 0,
    'cbt_completed': 25
  };
  
  await query(
    `INSERT INTO activity_logs (user_id, activity_type, description, points, metadata)
     VALUES ($1, $2, $3, $4, $5)`,
    [userId, activityType, description, points[activityType] || 0, JSON.stringify(metadata)]
  );
}
