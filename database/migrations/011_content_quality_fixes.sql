-- ============================================================================
-- 011: question bank quality fixes
--
-- Runs after the CHAMBER seeds are imported. Every change here traces to a
-- specific finding in audit/question-bank-report.md that was then read and
-- confirmed by hand -- nothing is applied on a heuristic alone.
--
-- Safe to re-run.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- 1. Exact duplicate rows
--
-- Removes only rows that are identical in every content column -- the residue
-- of a seed file replayed against a table with no ON CONFLICT clause. Against
-- the live CHAMBER database that is 30,997 of 39,960 question rows: the whole
-- bank imported five times over.
--
-- It deliberately does NOT key on the stem. Measured against the live CHAMBER
-- data, keying on (category_id, question_text) would leave 7,768 rows where
-- this leaves 8,963 -- 1,195 rows it would have destroyed. Those break down as:
--
--   * the great majority: one question filed under several topics, which is
--     how the seeds place foundational material in more than one rotation;
--   * 26 rows (13 stems): genuinely different questions that share a stem.
--     "A hematoma in a surgical wound:" exists under one topic with two
--     entirely different distractor sets, from two seed batches.
--
-- Neither is a duplicate. The second group is an editorial problem and step 7
-- records it for review rather than resolving it by deletion.
--
-- Repeats ACROSS categories are also left alone. 251 stems recur between
-- rotations -- the lethal triad is asked in Surgery 1 and again in Surgery 4 --
-- each with distractors pitched at that level, and no student sees both.
-- ---------------------------------------------------------------------------

-- An answer already sat by a candidate must not be orphaned when its question
-- is deduped, so it is repointed at the surviving twin first. The two rows are
-- byte-identical, so the answer means exactly what it did before.
--
-- Guarded: test_answers belongs to CHAMBER's own test engine and is not part
-- of 010_chamber_content.sql, so it is absent when this runs against a target
-- that only holds the content tables.
DO $$
BEGIN
  IF to_regclass('test_answers') IS NOT NULL THEN
    WITH ranked AS (
      SELECT id,
             md5(topic_id::text || '|' || category_id::text || '|' || question_text || '|' ||
                 option_a || '|' || option_b || '|' || option_c || '|' || option_d || '|' ||
                 COALESCE(option_e, '') || '|' || correct_option || '|' || explanation) AS sig,
             ROW_NUMBER() OVER (
               PARTITION BY md5(topic_id::text || '|' || category_id::text || '|' || question_text || '|' ||
                                option_a || '|' || option_b || '|' || option_c || '|' || option_d || '|' ||
                                COALESCE(option_e, '') || '|' || correct_option || '|' || explanation)
               ORDER BY created_at, id
             ) AS rn
      FROM questions
    ),
    keepers AS (SELECT sig, id FROM ranked WHERE rn = 1)
    UPDATE test_answers ta
    SET question_id = k.id
    FROM ranked r
    JOIN keepers k ON k.sig = r.sig
    WHERE ta.question_id = r.id AND r.rn > 1;
  END IF;
END $$;

WITH ranked AS (
  SELECT id,
         ROW_NUMBER() OVER (
           PARTITION BY md5(topic_id::text || '|' || category_id::text || '|' || question_text || '|' ||
                            option_a || '|' || option_b || '|' || option_c || '|' || option_d || '|' ||
                            COALESCE(option_e, '') || '|' || correct_option || '|' || explanation)
           ORDER BY created_at, id
         ) AS rn
  FROM questions
)
DELETE FROM questions q USING ranked r WHERE q.id = r.id AND r.rn > 1;

-- Same rule for an article's self-assessment set (6,725 -> 2,940 live).
WITH ranked AS (
  SELECT id,
         ROW_NUMBER() OVER (
           PARTITION BY md5(article_id::text || '|' || question_text || '|' || option_a || '|' ||
                            option_b || '|' || option_c || '|' || option_d || '|' ||
                            COALESCE(option_e, '') || '|' || correct_option)
           ORDER BY question_number, id
         ) AS rn
  FROM article_self_assessments
)
DELETE FROM article_self_assessments a USING ranked r WHERE a.id = r.id AND r.rn > 1;

-- And for article sections (2,824 -> 873 live).
WITH ranked AS (
  SELECT id,
         ROW_NUMBER() OVER (
           PARTITION BY md5(article_id::text || '|' || section_type::text || '|' ||
                            section_order::text || '|' || content)
           ORDER BY id
         ) AS rn
  FROM article_sections
)
DELETE FROM article_sections s USING ranked r WHERE s.id = r.id AND r.rn > 1;

-- ---------------------------------------------------------------------------
-- 2. Broken distractor set
--
-- "Duration of anticoagulation for unprovoked DVT" offered "2 weeks" as both
-- option A and option E. The key is D, so the paper was still markable, but
-- two identical choices is indefensible in an exam.
-- ---------------------------------------------------------------------------
UPDATE article_self_assessments
SET option_e = 'Lifelong, in every case'
WHERE lower(question_text) LIKE 'duration of anticoagulation for unprovoked dvt%'
  AND trim(option_a) = trim(option_e);

-- ---------------------------------------------------------------------------
-- 3. Stub stems
--
-- Seven questions ask nothing at all -- "Melanoma:" followed by five
-- statements. The options make the intent recoverable, but a candidate has to
-- guess what is being asked. Each becomes an explicit question; options,
-- key and explanation are untouched.
-- ---------------------------------------------------------------------------
UPDATE questions SET question_text = 'Which of the following best defines a fistula?'
  WHERE question_text = 'Fistula is:';
UPDATE questions SET question_text = 'Which of the following statements about haemangioma is correct?'
  WHERE question_text = 'Hemangioma:';
UPDATE questions SET question_text = 'Which of the following statements about melanoma is correct?'
  WHERE question_text = 'Melanoma:';
UPDATE questions SET question_text = 'Which of the following best describes a ranula?'
  WHERE question_text = 'Ranula is:';
UPDATE questions SET question_text = 'Which of the following statements about ependymoma is correct?'
  WHERE question_text = 'Ependymoma:';

UPDATE article_self_assessments SET question_text = 'Vicryl is best described as which type of suture?'
  WHERE question_text = 'Vicryl is:';
UPDATE article_self_assessments SET question_text = 'Prostate-specific antigen (PSA) is best described as:'
  WHERE question_text = 'PSA is:';

-- ---------------------------------------------------------------------------
-- 4. Unmarked negative stems
--
-- "Which of the following is not a feature of..." reads as its opposite when
-- skimmed under time pressure. Convention is to shout the negation; 43
-- questions did not. Only whole words are touched, and only in stems that
-- actually pose a question.
-- ---------------------------------------------------------------------------
UPDATE questions
SET question_text = regexp_replace(question_text, '\ynot\y', 'NOT', 'g')
WHERE question_text ~ '\ynot\y' AND question_text ~* '\y(which|what)\y';

UPDATE questions
SET question_text = regexp_replace(question_text, '\yexcept\y', 'EXCEPT', 'g')
WHERE question_text ~ '\yexcept\y';

UPDATE questions
SET question_text = regexp_replace(question_text, '\yleast\y', 'LEAST', 'g')
WHERE question_text ~ '\yleast\y' AND question_text ~* '\y(which|what)\y';

UPDATE article_self_assessments
SET question_text = regexp_replace(question_text, '\ynot\y', 'NOT', 'g')
WHERE question_text ~ '\ynot\y' AND question_text ~* '\y(which|what)\y';

UPDATE article_self_assessments
SET question_text = regexp_replace(question_text, '\yexcept\y', 'EXCEPT', 'g')
WHERE question_text ~ '\yexcept\y';

-- ---------------------------------------------------------------------------
-- 5. Deactivate anything still unanswerable
--
-- A safety net rather than a fix: any row that reaches this point without a
-- usable stem, a full set of options, or a key that names a real option is
-- hidden from test generation instead of being served to a candidate.
-- ---------------------------------------------------------------------------
UPDATE questions
SET is_active = FALSE
WHERE is_active
  AND (
    question_text IS NULL OR length(trim(question_text)) < 12
    OR option_a IS NULL OR length(trim(option_a)) = 0
    OR option_b IS NULL OR length(trim(option_b)) = 0
    OR option_c IS NULL OR length(trim(option_c)) = 0
    OR option_d IS NULL OR length(trim(option_d)) = 0
    OR correct_option IS NULL
    OR CASE correct_option
         WHEN 'A' THEN option_a WHEN 'B' THEN option_b WHEN 'C' THEN option_c
         WHEN 'D' THEN option_d WHEN 'E' THEN option_e
       END IS NULL
  );

-- ---------------------------------------------------------------------------
-- 6. Dead topic declarations
--
-- 301_surgery2_topics.sql claims the same 68 UUIDs as 200_surgery3_setup.sql.
-- The seeds insert ON CONFLICT DO NOTHING, so Surgery 3 wins the race and the
-- Surgery 2 rows never land; no question references them, because the Surgery 2
-- bank uses its own c2NNNNNN namespace. Nothing to repair -- but a topic that
-- ended up with no questions and no articles is a sign the race changed, so
-- record them for review rather than leaving them silently empty.
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS content_review_flags (
  id         SERIAL PRIMARY KEY,
  kind       VARCHAR(40) NOT NULL,
  ref_id     UUID,
  detail     TEXT,
  noticed_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
  UNIQUE (kind, ref_id)
);

INSERT INTO content_review_flags (kind, ref_id, detail)
SELECT 'empty_topic', t.id,
       'topic "' || t.name || '" has no questions and no articles'
FROM topics t
WHERE NOT EXISTS (SELECT 1 FROM questions q WHERE q.topic_id = t.id)
  AND NOT EXISTS (SELECT 1 FROM cme_articles a WHERE a.topic_id = t.id)
ON CONFLICT (kind, ref_id) DO NOTHING;

-- ---------------------------------------------------------------------------
-- 7. Different questions that share a stem
--
-- Step 1 removes exact copies only, so these survive: two or more questions
-- with the same stem under the same topic but different options, key or
-- explanation. A candidate could meet "A hematoma in a surgical wound:" twice
-- in one paper with different choices, which is confusing — but which variant
-- is the right one is an editorial judgement, not something to settle by
-- deleting whichever happens to be older.
--
-- One row per surviving variant, so an editor can see them side by side.
-- ---------------------------------------------------------------------------
INSERT INTO content_review_flags (kind, ref_id, detail)
SELECT 'stem_with_variants', q.id,
       'stem shared with ' || (g.variants - 1) || ' other question(s) under the same topic: '
         || left(q.question_text, 160)
FROM questions q
JOIN (
  SELECT topic_id, md5(question_text) AS h, COUNT(*) AS variants
  FROM questions
  GROUP BY topic_id, md5(question_text)
  HAVING COUNT(*) > 1
) g ON g.topic_id = q.topic_id AND g.h = md5(q.question_text)
ON CONFLICT (kind, ref_id) DO NOTHING;
