// ============================================================================
// Drawing MCQs from the question bank so a candidate never meets the same
// question twice.
//
//   One copy per question   The bank holds the same stem several times (one
//                           question filed under several topics, and stems
//                           shared between rotations). Rows are collapsed on a
//                           normalised stem before drawing.
//   Never seen before       Questions this learner has answered in a bank test
//                           or been given on a weekly CBT paper are left out;
//                           only when the whole level is exhausted are the
//                           least-recently seen used again.
//   Options shuffled        The imported key is "B" for most rows. Each draw
//                           shuffles A–E with a permutation derived from the
//                           draw's seed and the question id, so it is stateless
//                           and the server can map answers back when marking.
// ============================================================================

import crypto from 'crypto';
import { query } from './db.js';

export const LETTERS = ['A', 'B', 'C', 'D', 'E'];

/** SQL for a normalised stem: lower case, letters and digits only. */
export const STEM_SQL = (col) => `regexp_replace(lower(${col}), '[^a-z0-9]+', '', 'g')`;

/**
 * Item-writing flaws the NBME / Royal College guidance rules out for
 * single-best-answer papers: "all / none of the above" and "both A and B"
 * options. Such questions are never drawn.
 */
export const FLAWED_OPTIONS_SQL = `NOT (concat_ws(' | ', q.option_a, q.option_b, q.option_c, q.option_d, q.option_e) ~* '(all|none) of the above|both [a-e] and [a-e]')`;

export function normaliseStem(text) {
  return String(text || '').toLowerCase().replace(/[^a-z0-9]+/g, '');
}

export function newDrawSeed() {
  return crypto.randomBytes(9).toString('base64url');
}

/**
 * Displayed position → original letter, for one question in one draw.
 * perm[i] is the original option shown at letter LETTERS[i].
 */
export function permutation(seed, questionId) {
  const bytes = crypto.createHash('sha256').update(`${seed}:${questionId}`).digest();
  const perm = [...LETTERS];
  for (let i = perm.length - 1; i > 0; i--) {
    const j = bytes[i] % (i + 1);
    [perm[i], perm[j]] = [perm[j], perm[i]];
  }
  return perm;
}

/** Options in displayed order, and where the correct one now sits. */
export function shuffleRow(row, seed) {
  const perm = permutation(seed, row.id);
  const original = { A: row.option_a, B: row.option_b, C: row.option_c, D: row.option_d, E: row.option_e };
  const options = {};
  perm.forEach((orig, i) => { options[LETTERS[i]] = original[orig]; });
  const correct = row.correct_option ? LETTERS[perm.indexOf(String(row.correct_option).toUpperCase())] : undefined;
  return { options, correct, perm };
}

/** The original letter for an answer given against a shuffled display. */
export function toOriginalLetter(given, seed, questionId) {
  const i = LETTERS.indexOf(String(given || '').toUpperCase());
  return i < 0 ? '' : permutation(seed, questionId)[i];
}

/** The displayed letter for an original letter. */
export function toDisplayedLetter(original, seed, questionId) {
  const i = permutation(seed, questionId).indexOf(String(original || '').toUpperCase());
  return i < 0 ? '' : LETTERS[i];
}

let papersEnsured = false;
export async function ensureCbtPapers() {
  if (papersEnsured) return;
  await query(`CREATE TABLE IF NOT EXISTS cbt_papers (
    id SERIAL PRIMARY KEY,
    learner_kind TEXT NOT NULL,
    learner_id INTEGER NOT NULL,
    level TEXT NOT NULL,
    cycle INTEGER NOT NULL DEFAULT 1,
    test_number INTEGER NOT NULL,
    seed TEXT NOT NULL,
    question_ids UUID[] NOT NULL,
    stems TEXT[] NOT NULL,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    UNIQUE (learner_kind, learner_id, level, cycle, test_number)
  )`);
  papersEnsured = true;
}

/**
 * Draw `limit` questions for a learner from their categories: unseen first (in
 * random order), then the least recently seen, one row per stem, never a stem
 * in `excludeStems`.
 */
export async function drawQuestions({ categoryIds, learnerKind, learnerId, limit = 25, topicId = null, excludeStems = [], withKey = false }) {
  if (!categoryIds?.length) return [];
  let paperStems = [];
  try {
    await ensureCbtPapers();
    paperStems = (await query(
      `SELECT DISTINCT unnest(stems) AS s FROM cbt_papers WHERE learner_kind = $1 AND learner_id = $2`,
      [learnerKind, Number(learnerId)],
    )).rows.map(r => r.s);
  } catch { /* papers table unavailable — bank answers still exclude */ }

  const rows = (await query(
    `WITH seen AS (
       SELECT ${STEM_SQL('sq.question_text')} AS stem, MAX(at.submitted_at) AS last_seen
         FROM learner_test_answers a
         JOIN learner_test_attempts at ON at.id = a.attempt_id
         JOIN questions sq ON sq.id = a.question_id
        WHERE at.learner_kind = $4 AND at.learner_id = $5
        GROUP BY 1
     ), pool AS (
       SELECT DISTINCT ON (x.stem) x.*
         FROM (
           SELECT q.id, q.question_text, q.option_a, q.option_b, q.option_c, q.option_d, q.option_e,
                  ${withKey ? 'q.correct_option, q.explanation,' : ''}
                  q.difficulty::text AS difficulty, t.name AS topic,
                  ${STEM_SQL('q.question_text')} AS stem, random() AS r
             FROM questions q
             LEFT JOIN topics t ON t.id = q.topic_id
            WHERE q.category_id = ANY($1) AND q.is_active AND ${FLAWED_OPTIONS_SQL}
              AND ($2::uuid IS NULL OR q.topic_id = $2::uuid)
         ) x
        ORDER BY x.stem, x.r
     )
     SELECT p.*, s.last_seen
       FROM pool p
       LEFT JOIN seen s ON s.stem = p.stem
      WHERE NOT (p.stem = ANY($6::text[]))
      ORDER BY (s.last_seen IS NOT NULL), s.last_seen NULLS FIRST, p.r
      LIMIT $3`,
    [categoryIds, topicId, limit, learnerKind, Number(learnerId), [...new Set([...paperStems, ...excludeStems])]],
  )).rows;

  if (rows.length >= limit) return rows;
  // The level is exhausted even counting old papers: allow the oldest papers' questions again.
  const have = new Set(rows.map(r => r.stem));
  const more = (await query(
    `SELECT DISTINCT ON (x.stem) x.* FROM (
       SELECT q.id, q.question_text, q.option_a, q.option_b, q.option_c, q.option_d, q.option_e,
              ${withKey ? 'q.correct_option, q.explanation,' : ''}
              q.difficulty::text AS difficulty, t.name AS topic, ${STEM_SQL('q.question_text')} AS stem, random() AS r
         FROM questions q LEFT JOIN topics t ON t.id = q.topic_id
        WHERE q.category_id = ANY($1) AND q.is_active AND ${FLAWED_OPTIONS_SQL} AND ($2::uuid IS NULL OR q.topic_id = $2::uuid)
     ) x WHERE NOT (x.stem = ANY($3::text[])) ORDER BY x.stem, x.r`,
    [categoryIds, topicId, [...have, ...excludeStems]],
  )).rows;
  for (const r of more.sort(() => Math.random() - 0.5)) {
    if (rows.length >= limit) break;
    if (!have.has(r.stem)) { rows.push(r); have.add(r.stem); }
  }
  return rows;
}
