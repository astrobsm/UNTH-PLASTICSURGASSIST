// ============================================================================
// What this learner is supposed to read, and be tested on.
//
// The CHAMBER import put 8,963 questions and 257 CME articles in this database,
// every one scoped to a rotation category, and level_curriculum already says
// which categories each level covers. Nothing read either. The content was
// present, mapped, and unreachable.
//
// This is the half that was missing: given whoever is asking, work out their
// level, turn that into a set of categories, and serve the articles and
// questions for it — with their own progress attached, so a learner opens the
// module and sees where they are rather than a list they have to search.
//
// One route for both kinds of learner. A student on Surgery 2 and a house
// officer read from the same library against different curricula; two endpoints
// would be two places for that mapping to drift.
// ============================================================================

import { query } from './_lib/db.js';
import { cors, authenticateRequest } from './_lib/auth.js';
import { normalizeLevel, getRequirements } from './_lib/traineeScoring.js';

export default async function handler(req, res) {
  if (cors(req, res)) return;

  if (req.method !== 'GET' && req.method !== 'POST') {
    res.setHeader('Allow', ['GET', 'POST']);
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const auth = authenticateRequest(req, { allowStudents: true });
  if (!auth.authenticated) {
    return res.status(auth.status || 401).json({ error: 'Unauthorized', message: auth.error });
  }

  const isStudent = auth.user.sub_type === 'student' || auth.user.role === 'student';
  const learnerKind = isStudent ? 'student' : 'user';
  const learnerId = auth.user.id;

  try {
    const level = await levelFor(auth.user, isStudent);

    // A student who has not said which posting they are on gets no curriculum
    // rather than a guessed one. Handing a Surgery 1 student the Surgery 4
    // reading list is worse than showing nothing, because nothing prompts and
    // a wrong list does not.
    if (!level) {
      return res.status(200).json({
        levelKnown: false,
        needsLevel: true,
        message: 'Choose your surgery posting to see the material for it.',
        options: await surgeryLevels(),
      });
    }

    const categories = await categoriesFor(level);
    const { action } = req.query;

    if (req.method === 'POST') {
      if (action !== 'submit-test') {
        return res.status(400).json({ error: 'Unknown action' });
      }
      return res.status(200).json(
        await markTest(req.body || {}, { learnerKind, learnerId, level, categories }),
      );
    }

    if (action === 'questions') {
      return res.status(200).json(await questionSet(req, res, categories));
    }

    if (action === 'article') {
      const article = await fullArticle(req.query.id, categories, learnerKind, learnerId);
      if (!article) {
        // Either it does not exist or it is not on this learner's curriculum.
        // Said the same way for both, so the endpoint cannot be used to
        // enumerate what exists at other levels.
        return res.status(404).json({ error: 'Article not found at your level' });
      }
      return res.status(200).json(article);
    }

    const [articles, counts] = await Promise.all([
      articlesFor(categories, learnerKind, learnerId),
      countsFor(categories),
    ]);

    return res.status(200).json({
      levelKnown: true,
      level,
      categories,
      requirements: getRequirements(isStudent ? `student_${level}` : level),
      totals: counts,
      articles,
    });
  } catch (error) {
    // A rejected submission is the caller's fault and says so; anything else is
    // ours and says nothing more than that it went wrong.
    if (error.status && error.status < 500) {
      return res.status(error.status).json({ error: error.message });
    }
    console.error('learning-content error:', error);
    return res.status(500).json({ error: 'Internal server error', message: error.message });
  }
}

// ---------------------------------------------------------------------------

/**
 * The level whose curriculum this learner follows.
 *
 * A student's is the posting they are on, and is null until they say. A
 * doctor's comes from their rotation or role, which is always known — nobody
 * signs in without one.
 */
async function levelFor(user, isStudent) {
  if (!isStudent) return normalizeLevel(user.training_level || user.role);

  const row = (await query(
    'SELECT surgery_level FROM students WHERE id = $1', [user.id],
  )).rows[0];
  return row?.surgery_level || null;
}

/** The surgery postings a student can be on, from the imported categories. */
async function surgeryLevels() {
  const rows = (await query(
    `SELECT level::text AS value, name, description, duration_weeks
     FROM rotation_categories WHERE is_active ORDER BY level`,
  )).rows;
  return rows.map((r) => ({
    value: r.value, label: r.name,
    description: r.description, weeks: r.duration_weeks,
  }));
}

/**
 * The categories a level covers.
 *
 * level_curriculum is the mapping an administrator edits. Where it says nothing
 * — a level nobody has configured — the category matching the level's own name
 * is used, so a new posting is not silently empty.
 */
async function categoriesFor(level) {
  const configured = (await query(
    `SELECT c.id, c.name, c.code, c.level::text AS level
     FROM level_curriculum lc
     JOIN rotation_categories c ON c.id = lc.category_id
     WHERE lc.training_level = $1 AND c.is_active
     ORDER BY c.level`,
    [level.startsWith('surgery_') ? `student_${level}` : level],
  )).rows;
  if (configured.length) return configured;

  const direct = (await query(
    `SELECT id, name, code, level::text AS level
     FROM rotation_categories WHERE level::text = $1 AND is_active`,
    [level],
  )).rows;
  return direct;
}

/** How much material exists at this level, for the progress denominators. */
async function countsFor(categories) {
  const ids = categories.map((c) => c.id);
  if (!ids.length) return { articles: 0, questions: 0, selfAssessments: 0 };

  const row = (await query(
    `SELECT
       (SELECT COUNT(*) FROM cme_articles WHERE category_id = ANY($1) AND is_published)::int AS articles,
       (SELECT COUNT(*) FROM questions WHERE category_id = ANY($1) AND is_active)::int AS questions,
       (SELECT COUNT(*) FROM article_self_assessments sa
         JOIN cme_articles a ON a.id = sa.article_id
        WHERE a.category_id = ANY($1))::int AS self_assessments`,
    [ids],
  )).rows[0];

  return {
    articles: row.articles,
    questions: row.questions,
    selfAssessments: row.self_assessments,
  };
}

/** The reading list, with this learner's own progress against each article. */
async function articlesFor(categories, learnerKind, learnerId) {
  const ids = categories.map((c) => c.id);
  if (!ids.length) return [];

  return (await query(
    `SELECT a.id, a.title, a.subtitle, a.abstract, a.estimated_reading_minutes,
            a.cme_credits, a.difficulty_level::text AS difficulty,
            c.name AS category, t.name AS topic,
            (SELECT COUNT(*) FROM article_self_assessments sa WHERE sa.article_id = a.id)::int AS question_count,
            p.reading_completed, p.assessment_completed, p.assessment_score,
            p.is_fully_completed, p.reading_progress_percent, p.last_accessed_at
     FROM cme_articles a
     JOIN rotation_categories c ON c.id = a.category_id
     LEFT JOIN topics t ON t.id = a.topic_id
     LEFT JOIN learner_article_progress p
            ON p.article_id = a.id AND p.learner_kind = $2 AND p.learner_id = $3
     WHERE a.category_id = ANY($1) AND a.is_published
     ORDER BY c.level, t.order_index NULLS LAST, a.title`,
    [ids, learnerKind, learnerId],
  )).rows;
}

/**
 * A set of questions for a test.
 *
 * Randomised per request and capped, because the pool at a given level runs to
 * thousands and a test is twenty-five. The correct answer is not sent: it is
 * checked on the server when the attempt is submitted, so a candidate reading
 * the network traffic learns nothing.
 */
async function questionSet(req, res, categories) {
  const ids = categories.map((c) => c.id);
  const limit = Math.min(Math.max(Number(req.query.limit) || 25, 1), 100);
  const topicId = req.query.topicId || null;

  if (!ids.length) return { questions: [], total: 0 };

  const rows = (await query(
    `SELECT q.id, q.question_text, q.option_a, q.option_b, q.option_c, q.option_d, q.option_e,
            q.difficulty::text AS difficulty, t.name AS topic
     FROM questions q
     LEFT JOIN topics t ON t.id = q.topic_id
     WHERE q.category_id = ANY($1) AND q.is_active
       AND ($2::uuid IS NULL OR q.topic_id = $2::uuid)
     ORDER BY random()
     LIMIT $3`,
    [ids, topicId, limit],
  )).rows;

  return {
    questions: rows.map((q) => ({
      id: q.id,
      question: q.question_text,
      topic: q.topic,
      difficulty: q.difficulty,
      options: {
        A: q.option_a, B: q.option_b, C: q.option_c, D: q.option_d, E: q.option_e,
      },
    })),
    total: rows.length,
  };
}

// ---------------------------------------------------------------------------
// One article, whole.
// ---------------------------------------------------------------------------

/** Bullet lists arrive as one text block; this is how they were written. */
function bullets(text) {
  return String(text || '')
    .split(/\r?\n/)
    .map((l) => l.replace(/^\s*(?:[-*•●]|\d+[.)])\s*/, '').trim())
    .filter(Boolean);
}

/**
 * An imported article in the shape the CME viewer already renders.
 *
 * The viewer was built for the hand-written modules in medicalTrainingService,
 * and it is a good viewer: it tracks time per section, refuses to unlock the
 * self-assessment until the sections have actually been open, and reports the
 * sitting to the server. Rebuilding it for the imported articles would have
 * meant two readers, two reading trackers and two definitions of what counts as
 * having read something. So the article is mapped onto that shape here instead,
 * and one component renders both libraries.
 *
 * Scoped to the learner's own categories: an article outside their curriculum
 * is not found, so the id in the query string cannot reach another level's
 * material.
 */
async function fullArticle(articleId, categories, learnerKind, learnerId) {
  const ids = categories.map((c) => c.id);
  if (!articleId || !ids.length) return null;
  if (!/^[0-9a-f-]{36}$/i.test(String(articleId))) return null;

  const meta = (await query(
    `SELECT a.id, a.title, a.subtitle, a.abstract, a.authors, a.cme_credits,
            a.estimated_reading_minutes, a.difficulty_level::text AS difficulty,
            a.category_id, c.name AS category, t.name AS topic
     FROM cme_articles a
     JOIN rotation_categories c ON c.id = a.category_id
     LEFT JOIN topics t ON t.id = a.topic_id
     WHERE a.id = $1 AND a.category_id = ANY($2) AND a.is_published`,
    [articleId, ids],
  )).rows[0];
  if (!meta) return null;

  const [sections, refs, questions, progress] = await Promise.all([
    query(
      `SELECT section_type::text AS type, title, content
       FROM article_sections WHERE article_id = $1 ORDER BY section_order`,
      [articleId],
    ),
    query(
      `SELECT reference_number, citation, doi, url
       FROM article_references WHERE article_id = $1 ORDER BY reference_number`,
      [articleId],
    ),
    query(
      `SELECT id, question_number, question_text, option_a, option_b, option_c,
              option_d, option_e, correct_option, explanation
       FROM article_self_assessments WHERE article_id = $1 ORDER BY question_number`,
      [articleId],
    ),
    query(
      `SELECT reading_completed, assessment_completed, assessment_score,
              is_fully_completed, reading_progress_percent
       FROM learner_article_progress
       WHERE learner_kind = $1 AND learner_id = $2 AND article_id = $3`,
      [learnerKind, learnerId, articleId],
    ),
  ]);

  const byType = (t) => sections.rows.filter((s) => s.type === t);
  const joined = (t) => byType(t).map((s) => s.content).join('\n\n').trim();

  // The body proper. An article with no 'content' sections — a short one that
  // put everything in its introduction — would otherwise render as an empty
  // reader with a locked assessment, because the viewer counts sections read.
  let body = byType('content').map((s, i) => ({
    title: s.title || `Section ${i + 1}`,
    content: s.content,
  }));
  const introduction = joined('introduction');
  if (!body.length) {
    const only = introduction || meta.abstract || '';
    body = only ? [{ title: meta.title, content: only }] : [];
  }

  return {
    article: {
      // The viewer keys its per-section reading state off these.
      id: meta.id,
      moduleId: meta.category_id,
      title: meta.title,
      article: {
        title: meta.title,
        subtitle: meta.subtitle || undefined,
        overview: introduction || meta.abstract || '',
        learningObjectives: bullets(joined('learning_objectives')),
        sections: body,
        keyPoints: bullets(joined('key_points')),
        clinicalPearls: bullets(joined('clinical_pearls')),
        // The imported articles carry neither of these; the viewer hides an
        // empty list rather than showing an empty heading.
        examTips: [],
        commonMistakes: [],
        references: refs.rows.length
          ? refs.rows.map((r) => [r.citation, r.doi ? `doi:${r.doi}` : null, r.url]
              .filter(Boolean).join(' '))
          : bullets(joined('references')),
        selfAssessment: questions.rows.map((q) => {
          const options = [q.option_a, q.option_b, q.option_c, q.option_d, q.option_e]
            .filter((o) => o !== null && o !== undefined && String(o).trim() !== '');
          return {
            id: q.id,
            question: q.question_text,
            options,
            correctAnswer: 'ABCDE'.indexOf(String(q.correct_option).toUpperCase()),
            explanation: q.explanation,
          };
        }),
      },
    },
    meta: {
      categoryId: meta.category_id,
      category: meta.category,
      topic: meta.topic,
      authors: meta.authors,
      cmeCredits: meta.cme_credits,
      estimatedReadingMinutes: meta.estimated_reading_minutes,
      difficulty: meta.difficulty,
    },
    progress: progress.rows[0] || null,
  };
}

// ---------------------------------------------------------------------------
// Marking a test drawn from the bank.
// ---------------------------------------------------------------------------

/** The mark at which a test is a pass, matching the rotation threshold. */
const PASS_MARK = 70;

/**
 * Marks an attempt against the question bank and records it.
 *
 * The key never leaves the database until the paper is submitted: the question
 * set went out without it, and it is looked up here by id. A candidate reading
 * the network traffic sees their own questions and nothing else.
 *
 * Only questions on this learner's own curriculum are marked. Ids are taken
 * from the body, so without that filter a candidate could submit questions from
 * an easier level and have them counted.
 */
async function markTest(body, { learnerKind, learnerId, level, categories }) {
  const answers = body.answers && typeof body.answers === 'object' ? body.answers : null;
  if (!answers) throw Object.assign(new Error('answers is required'), { status: 400 });

  const ids = Object.keys(answers).filter((id) => /^[0-9a-f-]{36}$/i.test(id));
  if (!ids.length) throw Object.assign(new Error('no answers supplied'), { status: 400 });

  const categoryIds = categories.map((c) => c.id);
  const key = (await query(
    `SELECT q.id, q.correct_option, q.explanation, q.question_text,
            q.option_a, q.option_b, q.option_c, q.option_d, q.option_e,
            t.name AS topic
     FROM questions q
     LEFT JOIN topics t ON t.id = q.topic_id
     WHERE q.id = ANY($1::uuid[]) AND q.category_id = ANY($2) AND q.is_active`,
    [ids, categoryIds],
  )).rows;

  if (!key.length) {
    throw Object.assign(
      new Error('none of those questions are on your curriculum'), { status: 400 });
  }

  let correct = 0;
  const marked = key.map((q) => {
    const given = String(answers[q.id] ?? '').trim().toUpperCase();
    const isCorrect = given !== '' && given === String(q.correct_option).toUpperCase();
    if (isCorrect) correct += 1;
    return {
      id: q.id,
      question: q.question_text,
      topic: q.topic,
      options: { A: q.option_a, B: q.option_b, C: q.option_c, D: q.option_d, E: q.option_e },
      given: given || null,
      correctOption: String(q.correct_option).toUpperCase(),
      isCorrect,
      explanation: q.explanation,
    };
  });

  const total = marked.length;
  const score = Math.round((correct / total) * 10000) / 100;
  const passed = score >= PASS_MARK;
  const durationSeconds = Number.isFinite(Number(body.durationSeconds))
    ? Math.max(0, Math.round(Number(body.durationSeconds))) : null;
  const started = body.startedAt ? new Date(body.startedAt) : null;

  const attempt = (await query(
    `INSERT INTO learner_test_attempts
       (learner_kind, learner_id, level, question_count, correct_count, score,
        passed, duration_seconds, started_at)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING id, submitted_at`,
    [learnerKind, learnerId, level, total, correct, score, passed,
     durationSeconds, started && !isNaN(started.getTime()) ? started : null],
  )).rows[0];

  for (const m of marked) {
    await query(
      `INSERT INTO learner_test_answers (attempt_id, question_id, selected_option, is_correct)
       VALUES ($1,$2,$3,$4) ON CONFLICT (attempt_id, question_id) DO NOTHING`,
      [attempt.id, m.id, m.given, m.isCorrect],
    );
  }

  // Per-question statistics, which is what makes a bad question findable later.
  await query(
    `UPDATE questions SET times_used = COALESCE(times_used, 0) + 1 WHERE id = ANY($1::uuid[])`,
    [marked.map((m) => m.id)],
  );
  const rightOnes = marked.filter((m) => m.isCorrect).map((m) => m.id);
  if (rightOnes.length) {
    await query(
      `UPDATE questions SET times_correct = COALESCE(times_correct, 0) + 1
       WHERE id = ANY($1::uuid[])`,
      [rightOnes],
    );
  }

  return {
    attemptId: attempt.id,
    submittedAt: attempt.submitted_at,
    score, correct, total, passed, passMark: PASS_MARK,
    level,
    marked,
  };
}
