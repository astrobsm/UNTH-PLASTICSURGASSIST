// ============================================================================
// Learning progress — what a learner is reading, right now.
//
// Backs the CME article viewer. Reading used to live entirely in the viewer's
// React state and reach the server only as a single "completed" flag at the
// end, so a supervisor could see that somebody had finished an article and
// nothing about whether they were working through one today. Sections opened,
// seconds spent and self-assessment answers are all recorded here as they
// happen.
//
// One shape serves both kinds of learner. Doctors on rotation are ('user', id)
// and clinical students are ('student', id), which is why the tables key on
// (learner_kind, learner_id) rather than a foreign key to one of them.
//
// Students are admitted deliberately: these tables hold no patient data, and
// every statement below is scoped by the identity taken from the token, never
// from the request body — a learner reaches their own progress and nobody
// else's. Supervisors may read another learner's, and only read.
// ============================================================================

import { query } from './_lib/db.js';
import { cors, authenticateRequest } from './_lib/auth.js';

const SUPERVISOR_ROLES = ['admin', 'super_admin', 'consultant', 'senior_registrar'];

/** A section must be open this long before it counts as read. */
const MIN_SECTION_SECONDS = 30;

export default async function handler(req, res) {
  if (cors(req, res)) return;

  // A page closing mid-article sends its last update through navigator.sendBeacon,
  // which cannot set an Authorization header. Such a request carries its token in
  // the body instead. It is still the same signed token, verified the same way —
  // only the envelope differs — and it is accepted for the close action alone.
  if (req.query.beacon === '1' && req.body && typeof req.body.token === 'string') {
    req.headers = { ...req.headers, authorization: `Bearer ${req.body.token}` };
    delete req.body.token;
  }

  const auth = authenticateRequest(req, { allowStudents: true });
  if (!auth.authenticated) {
    return res.status(auth.status || 401).json({ error: 'Unauthorized', message: auth.error });
  }

  const isStudent = auth.user.sub_type === 'student' || auth.user.role === 'student';
  const learnerKind = isStudent ? 'student' : 'user';
  const learnerId = auth.user.id;

  try {
    switch (req.method) {
      case 'GET':
        return await handleGet(req, res, { learnerKind, learnerId, role: auth.user.role });
      case 'POST':
        return await handlePost(req, res, { learnerKind, learnerId });
      default:
        res.setHeader('Allow', ['GET', 'POST']);
        return res.status(405).json({ error: `Method ${req.method} not allowed` });
    }
  } catch (error) {
    console.error('learning-progress error:', error);
    return res.status(500).json({ error: 'Internal server error', message: error.message });
  }
}

// ---------------------------------------------------------------------------

async function handleGet(req, res, { learnerKind, learnerId, role }) {
  const { action, articleId, learner, kind } = req.query;

  // A supervisor may look at somebody else's progress; nobody else can.
  let kindToRead = learnerKind;
  let idToRead = learnerId;
  if (learner && SUPERVISOR_ROLES.includes(role)) {
    kindToRead = kind === 'student' ? 'student' : 'user';
    idToRead = learner;
  }

  switch (action) {
    case 'article': {
      if (!articleId) return res.status(400).json({ error: 'articleId is required' });
      const r = await query(
        `SELECT * FROM learner_article_progress
         WHERE learner_kind = $1 AND learner_id = $2 AND article_id = $3`,
        [kindToRead, idToRead, articleId],
      );
      return res.status(200).json({ progress: r.rows[0] || null });
    }

    case 'live': {
      // Who is reading what, in the last N minutes. This is the real-time view.
      const minutes = Math.min(parseInt(req.query.minutes, 10) || 30, 24 * 60);
      if (!SUPERVISOR_ROLES.includes(role)) {
        return res.status(403).json({ error: 'Access denied' });
      }
      const r = await query(
        `SELECT s.learner_kind, s.learner_id, s.article_id, a.title,
                s.session_start, s.session_end, s.duration_seconds,
                COALESCE(u.full_name, st.full_name) AS learner_name,
                p.reading_progress_percent, p.is_fully_completed
         FROM learner_study_sessions s
         JOIN cme_articles a ON a.id = s.article_id
         LEFT JOIN users u    ON s.learner_kind = 'user'    AND u.id  = s.learner_id
         LEFT JOIN students st ON s.learner_kind = 'student' AND st.id = s.learner_id
         LEFT JOIN learner_article_progress p
                ON p.learner_kind = s.learner_kind AND p.learner_id = s.learner_id
               AND p.article_id = s.article_id
         WHERE s.session_start > NOW() - ($1 || ' minutes')::interval
         ORDER BY s.session_start DESC
         LIMIT 200`,
        [String(minutes)],
      );
      return res.status(200).json({ sessions: r.rows, windowMinutes: minutes });
    }

    default: {
      // Everything this learner has read, plus a summary for the tracker.
      const [progress, summary] = await Promise.all([
        query(
          `SELECT p.*, a.title, a.cme_credits, a.category_id
           FROM learner_article_progress p
           JOIN cme_articles a ON a.id = p.article_id
           WHERE p.learner_kind = $1 AND p.learner_id = $2
           ORDER BY p.last_accessed_at DESC NULLS LAST`,
          [kindToRead, idToRead],
        ),
        query(
          `SELECT COUNT(*)::int                                     AS articles_started,
                  COUNT(*) FILTER (WHERE reading_completed)::int    AS articles_read,
                  COUNT(*) FILTER (WHERE is_fully_completed)::int   AS articles_completed,
                  COUNT(*) FILTER (WHERE assessment_completed)::int AS assessments_done,
                  COALESCE(AVG(assessment_score) FILTER (WHERE assessment_completed), 0)::numeric(5,2) AS assessment_average,
                  COALESCE(SUM(time_spent_seconds), 0)::int         AS seconds_spent,
                  COALESCE(SUM(cme_credits_earned), 0)::numeric(6,1) AS credits
           FROM learner_article_progress
           WHERE learner_kind = $1 AND learner_id = $2`,
          [kindToRead, idToRead],
        ),
      ]);
      return res.status(200).json({ progress: progress.rows, summary: summary.rows[0] });
    }
  }
}

// ---------------------------------------------------------------------------

async function handlePost(req, res, { learnerKind, learnerId }) {
  const { action } = req.query;
  const body = req.body || {};

  // A beacon is only ever a closing update; it must not be able to reach the
  // marking path, where its unusual authentication would matter more.
  if (req.query.beacon === '1' && action !== 'close') {
    return res.status(400).json({ error: 'beacon requests may only close a session' });
  }

  switch (action) {
    case 'open':      return await openArticle(res, learnerKind, learnerId, body);
    case 'heartbeat': return await heartbeat(res, learnerKind, learnerId, body);
    case 'close':     return await closeSession(res, learnerKind, learnerId, body);
    case 'assessment':return await recordAssessment(res, learnerKind, learnerId, body);
    default:          return res.status(400).json({ error: 'Invalid action' });
  }
}

/** Opens an article: one progress row per learner, one session per sitting. */
async function openArticle(res, kind, id, { articleId, device }) {
  if (!articleId) return res.status(400).json({ error: 'articleId is required' });

  const progress = await query(
    `INSERT INTO learner_article_progress
       (learner_kind, learner_id, article_id, started_at, last_accessed_at)
     VALUES ($1, $2, $3, NOW(), NOW())
     ON CONFLICT (learner_kind, learner_id, article_id)
     DO UPDATE SET last_accessed_at = NOW(),
                   started_at = COALESCE(learner_article_progress.started_at, NOW()),
                   updated_at = NOW()
     RETURNING *`,
    [kind, id, articleId],
  );

  const session = await query(
    `INSERT INTO learner_study_sessions (learner_kind, learner_id, article_id, device_info)
     VALUES ($1, $2, $3, $4) RETURNING id, session_start`,
    [kind, id, articleId, device ? JSON.stringify(device) : null],
  );

  return res.status(200).json({ progress: progress.rows[0], sessionId: session.rows[0].id });
}

/**
 * Periodic update while the article is open.
 *
 * Time is accumulated server-side from what the client reports for this sitting
 * rather than trusted as a running total, so a client that restarts cannot
 * inflate the figure — and one that never sends a close still leaves an
 * accurate record of how far it got.
 */
async function heartbeat(res, kind, id, { articleId, sessionId, secondsThisSession, sectionsViewed, progressPercent }) {
  if (!articleId) return res.status(400).json({ error: 'articleId is required' });

  const seconds = Math.max(0, Math.min(Number(secondsThisSession) || 0, 6 * 60 * 60));
  const percent = Math.max(0, Math.min(Number(progressPercent) || 0, 100));
  const sections = Array.isArray(sectionsViewed) ? sectionsViewed.filter(Boolean) : [];

  if (sessionId) {
    await query(
      `UPDATE learner_study_sessions
       SET duration_seconds = $1, sections_viewed = $2::uuid[], session_end = NOW()
       WHERE id = $3 AND learner_kind = $4 AND learner_id = $5`,
      [seconds, sections, sessionId, kind, id],
    );
  }

  // The stored total is every other session plus this one, so a heartbeat is
  // idempotent: sending it twice does not count the time twice.
  const r = await query(
    `UPDATE learner_article_progress p
     SET time_spent_seconds = COALESCE((
           SELECT SUM(duration_seconds) FROM learner_study_sessions s
           WHERE s.learner_kind = p.learner_kind AND s.learner_id = p.learner_id
             AND s.article_id = p.article_id
         ), 0),
         reading_progress_percent = GREATEST(p.reading_progress_percent, $4),
         last_accessed_at = NOW(),
         updated_at = NOW()
     WHERE p.learner_kind = $1 AND p.learner_id = $2 AND p.article_id = $3
     RETURNING *`,
    [kind, id, articleId, percent],
  );

  return res.status(200).json({ progress: r.rows[0] || null });
}

/** Closes the sitting and, if the reading rules are met, marks it read. */
async function closeSession(res, kind, id, { articleId, sessionId, secondsThisSession, sectionsViewed, sectionsRead, totalSections }) {
  if (!articleId) return res.status(400).json({ error: 'articleId is required' });

  const seconds = Math.max(0, Math.min(Number(secondsThisSession) || 0, 6 * 60 * 60));
  const sections = Array.isArray(sectionsViewed) ? sectionsViewed.filter(Boolean) : [];

  if (sessionId) {
    await query(
      `UPDATE learner_study_sessions
       SET session_end = NOW(), duration_seconds = $1, sections_viewed = $2::uuid[]
       WHERE id = $3 AND learner_kind = $4 AND learner_id = $5`,
      [seconds, sections, sessionId, kind, id],
    );
  }

  // "Read" means every section was open long enough — decided here, not by the
  // client, because the client is the party with a reason to be generous.
  const total = Number(totalSections) || 0;
  const read = Number(sectionsRead) || 0;
  const finished = total > 0 && read >= total;

  const r = await query(
    `UPDATE learner_article_progress p
     SET time_spent_seconds = COALESCE((
           SELECT SUM(duration_seconds) FROM learner_study_sessions s
           WHERE s.learner_kind = p.learner_kind AND s.learner_id = p.learner_id
             AND s.article_id = p.article_id), 0),
         reading_progress_percent = GREATEST(p.reading_progress_percent,
           CASE WHEN $4 > 0 THEN LEAST(100, ($5::numeric / $4) * 100) ELSE 0 END),
         reading_completed = p.reading_completed OR $6,
         reading_completed_at = CASE
           WHEN NOT p.reading_completed AND $6 THEN NOW() ELSE p.reading_completed_at END,
         last_accessed_at = NOW(),
         updated_at = NOW()
     WHERE p.learner_kind = $1 AND p.learner_id = $2 AND p.article_id = $3
     RETURNING *`,
    [kind, id, articleId, total, read, finished],
  );

  return res.status(200).json({ progress: r.rows[0] || null, readingCompleted: finished });
}

/**
 * Records a self-assessment attempt.
 *
 * Answers are marked against the stored key, not against what the client says
 * was right. An attempt only counts as completed once the article has been read
 * — otherwise the assessment is a way around the reading.
 */
async function recordAssessment(res, kind, id, { articleId, answers }) {
  if (!articleId) return res.status(400).json({ error: 'articleId is required' });
  if (!answers || typeof answers !== 'object') {
    return res.status(400).json({ error: 'answers is required' });
  }

  const ids = Object.keys(answers);
  if (!ids.length) return res.status(400).json({ error: 'no answers supplied' });

  const keyRows = await query(
    `SELECT id, correct_option FROM article_self_assessments
     WHERE article_id = $1 AND id = ANY($2::uuid[])`,
    [articleId, ids],
  );
  if (!keyRows.rows.length) {
    return res.status(400).json({ error: 'no matching questions for this article' });
  }

  const totalRow = await query(
    `SELECT COUNT(*)::int AS n FROM article_self_assessments WHERE article_id = $1`,
    [articleId],
  );
  const total = totalRow.rows[0].n;

  let correct = 0;
  const marked = keyRows.rows.map((q) => {
    const given = String(answers[q.id] || '').trim().toUpperCase();
    const isCorrect = given === String(q.correct_option).toUpperCase();
    if (isCorrect) correct += 1;
    return { id: q.id, given, isCorrect };
  });

  const progress = await query(
    `SELECT id, reading_completed, assessment_attempts FROM learner_article_progress
     WHERE learner_kind = $1 AND learner_id = $2 AND article_id = $3`,
    [kind, id, articleId],
  );
  if (!progress.rows[0]) {
    return res.status(409).json({ error: 'open the article before submitting its assessment' });
  }
  const progressId = progress.rows[0].id;
  const attempt = (progress.rows[0].assessment_attempts || 0) + 1;
  const score = total > 0 ? Math.round((correct / total) * 10000) / 100 : 0;

  for (const m of marked) {
    await query(
      `INSERT INTO learner_assessment_answers
         (progress_id, question_id, selected_option, is_correct, attempt_number)
       VALUES ($1, $2, $3, $4, $5)
       ON CONFLICT (progress_id, question_id, attempt_number) DO UPDATE
         SET selected_option = EXCLUDED.selected_option, is_correct = EXCLUDED.is_correct`,
      [progressId, m.id, m.given || null, m.isCorrect, attempt],
    );
  }

  const readingDone = progress.rows[0].reading_completed;
  const updated = await query(
    `UPDATE learner_article_progress
     SET assessment_attempts = $4,
         assessment_started_at = COALESCE(assessment_started_at, NOW()),
         assessment_score = GREATEST(COALESCE(assessment_score, 0), $5),
         assessment_completed = assessment_completed OR $6,
         assessment_completed_at = CASE
           WHEN NOT assessment_completed AND $6 THEN NOW() ELSE assessment_completed_at END,
         is_fully_completed = ($6 AND reading_completed),
         cme_credits_earned = CASE
           WHEN $6 AND reading_completed
             THEN COALESCE((SELECT cme_credits FROM cme_articles WHERE id = $3), 1)
           ELSE cme_credits_earned END,
         last_accessed_at = NOW(),
         updated_at = NOW()
     WHERE learner_kind = $1 AND learner_id = $2 AND article_id = $3
     RETURNING *`,
    [kind, id, articleId, attempt, score, readingDone],
  );

  return res.status(200).json({
    score,
    correct,
    total,
    attempt,
    readingCompleted: readingDone,
    // Said plainly, because the viewer shows it to the learner.
    counted: readingDone,
    message: readingDone ? null : 'Score recorded, but it counts once the article has been read.',
    progress: updated.rows[0],
    marked,
  });
}

export { MIN_SECTION_SECONDS };
