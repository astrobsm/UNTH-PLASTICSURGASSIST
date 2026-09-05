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
-- 1. Duplicate questions within a rotation
--
-- A student must never meet the same question twice in one posting. The unique
-- index on (topic_id, md5(question_text)) already stops a repeat within a
-- topic at import time; this catches the rest -- the same stem under two
-- different topics of the *same* category (32 stems, 46 rows).
--
-- Repeats ACROSS categories are deliberately left alone. 251 stems recur
-- between rotations -- "the lethal triad in trauma refers to" is asked in
-- Surgery 1 and again in Surgery 4 -- each with its own distractor set pitched
-- at that level. Removing them would empty holes in the senior rotations'
-- question pools, and no single student sees both.
-- ---------------------------------------------------------------------------
WITH ranked AS (
  SELECT id,
         ROW_NUMBER() OVER (
           PARTITION BY category_id, md5(lower(regexp_replace(question_text, '[^a-zA-Z0-9]+', ' ', 'g')))
           ORDER BY created_at, id
         ) AS rn
  FROM questions
)
DELETE FROM questions q
USING ranked r
WHERE q.id = r.id AND r.rn > 1;

-- Same rule for an article's own self-assessment set.
WITH ranked AS (
  SELECT id,
         ROW_NUMBER() OVER (
           PARTITION BY article_id, md5(lower(regexp_replace(question_text, '[^a-zA-Z0-9]+', ' ', 'g')))
           ORDER BY question_number, id
         ) AS rn
  FROM article_self_assessments
)
DELETE FROM article_self_assessments a
USING ranked r
WHERE a.id = r.id AND r.rn > 1;

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
