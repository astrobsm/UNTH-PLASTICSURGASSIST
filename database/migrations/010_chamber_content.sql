-- ============================================================================
-- 010: CHAMBER content schema
--
-- Adopts the CHAMBER question-bank and CME-article model wholesale so the 494
-- seed files in that repo import unchanged. Two deliberate departures from
-- CHAMBER's schema.sql, both forced by this database:
--
--   1. users.id and students.id are SERIAL here, not UUID. Every column that
--      points at a person is INTEGER; every column that points at content
--      stays UUID, because the seeds hard-code content UUIDs.
--
--   2. CHAMBER tracks progress against students(id) alone. This app has two
--      kinds of learner -- trainees in `users` and clinical students in
--      `students` -- so progress carries (learner_kind, learner_id) instead.
--
-- Safe to re-run.
-- ============================================================================

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- -- Enums ------------------------------------------------------------------
DO $$ BEGIN CREATE TYPE student_level        AS ENUM ('surgery_1','surgery_2','surgery_3','surgery_4'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE cognitive_level      AS ENUM ('knowledge','comprehension','application','analysis','synthesis','evaluation'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE difficulty_level     AS ENUM ('easy','medium','hard'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE article_section_type AS ENUM ('introduction','learning_objectives','content','key_points','clinical_pearls','references','self_assessment'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- -- Content: categories, topics, question bank -------------------------------
CREATE TABLE IF NOT EXISTS rotation_categories (
  id             UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name           VARCHAR(100) NOT NULL,
  code           VARCHAR(20) UNIQUE NOT NULL,
  level          student_level NOT NULL,
  description    TEXT,
  duration_weeks INTEGER NOT NULL DEFAULT 6,
  is_active      BOOLEAN DEFAULT TRUE,
  created_at     TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
  updated_at     TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- CHAMBER's rotation periods. Distinct from this app's `trainee_rotations`,
-- which tracks one doctor's posting; a row here is a cohort-wide date window.
CREATE TABLE IF NOT EXISTS content_rotations (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  category_id UUID NOT NULL REFERENCES rotation_categories(id),
  name        VARCHAR(100) NOT NULL,
  start_date  DATE NOT NULL,
  end_date    DATE NOT NULL,
  is_active   BOOLEAN DEFAULT TRUE,
  created_at  TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
  updated_at  TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT valid_content_rotation_dates CHECK (end_date > start_date)
);

CREATE TABLE IF NOT EXISTS topics (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  category_id UUID NOT NULL REFERENCES rotation_categories(id),
  name        VARCHAR(200) NOT NULL,
  description TEXT,
  order_index INTEGER NOT NULL DEFAULT 0,
  is_active   BOOLEAN DEFAULT TRUE,
  created_at  TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
  updated_at  TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS questions (
  id                   UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  topic_id             UUID NOT NULL REFERENCES topics(id),
  category_id          UUID NOT NULL REFERENCES rotation_categories(id),
  question_text        TEXT NOT NULL,
  option_a             TEXT NOT NULL,
  option_b             TEXT NOT NULL,
  option_c             TEXT NOT NULL,
  option_d             TEXT NOT NULL,
  option_e             TEXT NOT NULL,
  correct_option       CHAR(1) NOT NULL CHECK (correct_option IN ('A','B','C','D','E')),
  explanation          TEXT NOT NULL,
  difficulty           difficulty_level NOT NULL DEFAULT 'medium',
  cognitive_level      cognitive_level NOT NULL DEFAULT 'knowledge',
  image_url            VARCHAR(500),
  is_active            BOOLEAN DEFAULT TRUE,
  times_used           INTEGER DEFAULT 0,
  times_correct        INTEGER DEFAULT 0,
  discrimination_index DECIMAL(5,4),
  created_by           INTEGER REFERENCES users(id),
  reviewed_by          INTEGER REFERENCES users(id),
  reviewed_at          TIMESTAMPTZ,
  created_at           TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
  updated_at           TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- The seeds INSERT questions without ON CONFLICT and without ids, so replaying
-- a file appends a second copy. This index makes the import idempotent.
--
-- It keys on the WHOLE question, not on (topic_id, question_text). The bank
-- legitimately contains different questions that share a stem -- "A hematoma in
-- a surgical wound:" appears under one topic with two entirely different
-- distractor sets, from two different seed batches. A stem-level key would have
-- rejected the second as a duplicate and thrown away a real question: measured
-- against the live CHAMBER data, 1,195 genuine variants across 1,176 stems.
--
-- Two questions that share a stem but differ in their options are a legitimate
-- editorial concern, and 011 records them for review. They are not something to
-- resolve by silently dropping one.
CREATE UNIQUE INDEX IF NOT EXISTS uq_questions_content
  ON questions (
    md5(
      topic_id::text || '|' || category_id::text || '|' || question_text || '|' ||
      option_a || '|' || option_b || '|' || option_c || '|' || option_d || '|' ||
      COALESCE(option_e, '') || '|' || correct_option || '|' || explanation
    )
  );

-- -- Content: CME articles ----------------------------------------------------
--
-- An earlier `cme_articles` may already be here: the flat, JSONB-shaped table
-- that cmeWACSService used to fill, with a varchar id and `topic`/`category` as
-- free text. It is empty in production and its only reader was MCQEducation,
-- which the training merge removed. CREATE TABLE IF NOT EXISTS would silently
-- do nothing and leave the imported articles with nowhere to land, so the old
-- one is moved aside first -- renamed, not dropped, in case it holds rows
-- somewhere this has not been run.
DO $$
BEGIN
  IF to_regclass('public.cme_articles') IS NOT NULL
     AND NOT EXISTS (
       SELECT 1 FROM information_schema.columns
       WHERE table_schema = 'public' AND table_name = 'cme_articles'
         AND column_name = 'estimated_reading_minutes'
     )
  THEN
    EXECUTE 'ALTER TABLE public.cme_articles RENAME TO cme_articles_legacy_wacs';
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS cme_articles (
  id                        UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  topic_id                  UUID NOT NULL REFERENCES topics(id),
  category_id               UUID NOT NULL REFERENCES rotation_categories(id),
  title                     VARCHAR(500) NOT NULL,
  subtitle                  VARCHAR(500),
  abstract                  TEXT,
  authors                   TEXT,
  cme_credits               DECIMAL(3,1) DEFAULT 1.0,
  estimated_reading_minutes INTEGER DEFAULT 30,
  difficulty_level          difficulty_level DEFAULT 'medium',
  version                   INTEGER DEFAULT 1,
  is_published              BOOLEAN DEFAULT TRUE,
  publish_date              DATE DEFAULT CURRENT_DATE,
  review_date               DATE,
  keywords                  TEXT[],
  cover_image_url           VARCHAR(500),
  created_by                INTEGER REFERENCES users(id),
  created_at                TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
  updated_at                TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS article_sections (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  article_id    UUID NOT NULL REFERENCES cme_articles(id) ON DELETE CASCADE,
  section_type  article_section_type NOT NULL,
  section_order INTEGER NOT NULL,
  title         VARCHAR(255),
  content       TEXT NOT NULL,
  is_expandable BOOLEAN DEFAULT FALSE,
  created_at    TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
  updated_at    TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);
CREATE UNIQUE INDEX IF NOT EXISTS uq_article_sections_order
  ON article_sections (article_id, section_order);

CREATE TABLE IF NOT EXISTS article_references (
  id               UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  article_id       UUID NOT NULL REFERENCES cme_articles(id) ON DELETE CASCADE,
  reference_number INTEGER NOT NULL,
  citation         TEXT NOT NULL,
  doi              VARCHAR(255),
  pubmed_id        VARCHAR(50),
  url              VARCHAR(500),
  created_at       TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);
CREATE UNIQUE INDEX IF NOT EXISTS uq_article_references_number
  ON article_references (article_id, reference_number);

CREATE TABLE IF NOT EXISTS article_self_assessments (
  id                UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  article_id        UUID NOT NULL REFERENCES cme_articles(id) ON DELETE CASCADE,
  question_number   INTEGER NOT NULL,
  question_text     TEXT NOT NULL,
  option_a          TEXT NOT NULL,
  option_b          TEXT NOT NULL,
  option_c          TEXT NOT NULL,
  option_d          TEXT NOT NULL,
  option_e          TEXT,
  correct_option    CHAR(1) NOT NULL CHECK (correct_option IN ('A','B','C','D','E')),
  explanation       TEXT NOT NULL,
  reference_numbers INTEGER[],
  difficulty        difficulty_level DEFAULT 'medium',
  created_at        TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);
CREATE UNIQUE INDEX IF NOT EXISTS uq_article_self_assessments_number
  ON article_self_assessments (article_id, question_number);

-- -- Curriculum: which categories a given level must cover --------------------
-- Seeded with a default mapping by the import script; admins edit it from
-- Training Admin.
CREATE TABLE IF NOT EXISTS level_curriculum (
  id             SERIAL PRIMARY KEY,
  training_level VARCHAR(50) NOT NULL,
  category_id    UUID NOT NULL REFERENCES rotation_categories(id) ON DELETE CASCADE,
  is_required    BOOLEAN DEFAULT TRUE,
  created_at     TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
  UNIQUE (training_level, category_id)
);

-- -- Progress: one shape for both kinds of learner ----------------------------
CREATE TABLE IF NOT EXISTS learner_article_progress (
  id                       SERIAL PRIMARY KEY,
  learner_kind             VARCHAR(10) NOT NULL CHECK (learner_kind IN ('user','student')),
  learner_id               INTEGER NOT NULL,
  article_id               UUID NOT NULL REFERENCES cme_articles(id) ON DELETE CASCADE,
  started_at               TIMESTAMPTZ,
  last_accessed_at         TIMESTAMPTZ,
  reading_completed        BOOLEAN DEFAULT FALSE,
  reading_completed_at     TIMESTAMPTZ,
  reading_progress_percent DECIMAL(5,2) DEFAULT 0,
  time_spent_seconds       INTEGER DEFAULT 0,
  current_section_id       UUID REFERENCES article_sections(id),
  assessment_started_at    TIMESTAMPTZ,
  assessment_completed     BOOLEAN DEFAULT FALSE,
  assessment_completed_at  TIMESTAMPTZ,
  assessment_score         DECIMAL(5,2),
  assessment_attempts      INTEGER DEFAULT 0,
  is_fully_completed       BOOLEAN DEFAULT FALSE,
  cme_credits_earned       DECIMAL(3,1) DEFAULT 0,
  created_at               TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
  updated_at               TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
  UNIQUE (learner_kind, learner_id, article_id)
);

CREATE TABLE IF NOT EXISTS learner_assessment_answers (
  id                 SERIAL PRIMARY KEY,
  progress_id        INTEGER NOT NULL REFERENCES learner_article_progress(id) ON DELETE CASCADE,
  question_id        UUID NOT NULL REFERENCES article_self_assessments(id) ON DELETE CASCADE,
  selected_option    CHAR(1),
  is_correct         BOOLEAN,
  time_spent_seconds INTEGER DEFAULT 0,
  attempt_number     INTEGER DEFAULT 1,
  answered_at        TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
  UNIQUE (progress_id, question_id, attempt_number)
);

-- Every open/close of an article. This is what makes reading visible in real
-- time, and what separates "opened the article" from "read the article".
CREATE TABLE IF NOT EXISTS learner_study_sessions (
  id               SERIAL PRIMARY KEY,
  learner_kind     VARCHAR(10) NOT NULL CHECK (learner_kind IN ('user','student')),
  learner_id       INTEGER NOT NULL,
  article_id       UUID NOT NULL REFERENCES cme_articles(id) ON DELETE CASCADE,
  session_start    TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
  session_end      TIMESTAMPTZ,
  duration_seconds INTEGER,
  sections_viewed  UUID[],
  device_info      JSONB,
  created_at       TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- -- Indexes -----------------------------------------------------------------
CREATE INDEX IF NOT EXISTS idx_topics_category          ON topics(category_id, order_index);
CREATE INDEX IF NOT EXISTS idx_questions_topic          ON questions(topic_id) WHERE is_active;
CREATE INDEX IF NOT EXISTS idx_questions_category       ON questions(category_id) WHERE is_active;
CREATE INDEX IF NOT EXISTS idx_cme_articles_topic       ON cme_articles(topic_id);
CREATE INDEX IF NOT EXISTS idx_cme_articles_category    ON cme_articles(category_id) WHERE is_published;
CREATE INDEX IF NOT EXISTS idx_article_sections_article ON article_sections(article_id, section_order);
CREATE INDEX IF NOT EXISTS idx_article_assess_article   ON article_self_assessments(article_id, question_number);
CREATE INDEX IF NOT EXISTS idx_lap_learner              ON learner_article_progress(learner_kind, learner_id);
CREATE INDEX IF NOT EXISTS idx_lap_completed            ON learner_article_progress(learner_kind, learner_id) WHERE is_fully_completed;
CREATE INDEX IF NOT EXISTS idx_lap_article              ON learner_article_progress(article_id);
CREATE INDEX IF NOT EXISTS idx_lss_learner              ON learner_study_sessions(learner_kind, learner_id, session_start DESC);
CREATE INDEX IF NOT EXISTS idx_level_curriculum_level   ON level_curriculum(training_level);

-- -- Import bookkeeping -------------------------------------------------------
-- The import script records each seed file it has applied, so re-running it
-- is a no-op rather than a second copy of the question bank.
CREATE TABLE IF NOT EXISTS content_migrations (
  filename    VARCHAR(255) PRIMARY KEY,
  checksum    VARCHAR(64) NOT NULL,
  applied_at  TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
  statements  INTEGER,
  duration_ms INTEGER
);
