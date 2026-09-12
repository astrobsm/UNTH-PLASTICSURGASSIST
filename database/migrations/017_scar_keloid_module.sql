-- ============================================================================
-- 017 — Scar and keloid longitudinal monitoring.
--
-- A scar IS a `wounds` row, exactly as a graft site is. That inherits
-- photography, the image-quality gate, marker calibration, segmentation,
-- tracing, overlay rendering, clinician correction, provenance columns and
-- cross-device image storage — none of it rebuilt.
--
-- Treatment is NOT modelled here. keloid_care_plans and keloid_injections
-- already record the triamcinolone series, surgery, silicone, compression and
-- radiotherapy; scar_cases points at the plan instead of duplicating it.
-- ============================================================================

BEGIN;

-- -- One lesion, with its own trajectory ------------------------------------
CREATE TABLE IF NOT EXISTS scar_cases (
  id                 SERIAL PRIMARY KEY,
  patient_id         INTEGER NOT NULL,
  -- The wound row that carries this lesion's photographs and measurements.
  wound_id           INTEGER NOT NULL,
  -- The existing treatment plan, where one has been made. Nullable: a scar is
  -- often followed before anyone commits to a plan.
  keloid_plan_id     INTEGER,

  label              VARCHAR(200),
  anatomical_site    VARCHAR(160),
  body_side          VARCHAR(20),

  -- Clinician classification. The AI column exists so a future model's opinion
  -- can be stored beside it and compared — never on top of it (§5, §12).
  scar_type          VARCHAR(40),
                     -- normal | immature | mature | hypertrophic | keloid
                     -- contracture | atrophic | depressed | mixed | uncertain
  ai_scar_type       VARCHAR(40),
  ai_type_confidence DECIMAL(4,3),
  type_confirmed_by  INTEGER,
  type_confirmed_at  TIMESTAMPTZ,

  onset_date         DATE,
  causative_event    TEXT,

  -- The original wound, where it is known. NEVER inferred — §14.
  original_wound_area_cm2 DECIMAL(8,2),
  original_wound_source   VARCHAR(40),
                     -- preoperative_photo | surgical_record | prior_tracing | clinician

  crosses_joint      BOOLEAN NOT NULL DEFAULT FALSE,
  joint_involved     VARCHAR(80),

  status             VARCHAR(30) NOT NULL DEFAULT 'active',
  created_by         INTEGER,
  created_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (patient_id, wound_id)
);

-- -- One visit ---------------------------------------------------------------
CREATE TABLE IF NOT EXISTS scar_assessments (
  id                  SERIAL PRIMARY KEY,
  scar_id             INTEGER NOT NULL REFERENCES scar_cases(id) ON DELETE CASCADE,
  -- The photograph and its calibrated measurements live here.
  wound_assessment_id INTEGER,
  assessed_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  days_from_onset     INTEGER,

  is_baseline         BOOLEAN NOT NULL DEFAULT FALSE,
  previous_assessment_id INTEGER,
  baseline_assessment_id INTEGER,

  -- §57. Explains itself rather than being a bare label.
  quality_flag        VARCHAR(20) DEFAULT 'acceptable',
                      -- high | acceptable | limited | unreliable
  quality_reason      TEXT,
  -- §70: comparing a traced area with a segmented one is not like for like.
  measurement_method  VARCHAR(40),
                      -- clinician_traced | ai_segmentation | ai_corrected

  -- §67. A finalized assessment is not edited in place.
  finalized_by        INTEGER,
  finalized_at        TIMESTAMPTZ,
  superseded_by       INTEGER,
  supersede_reason    TEXT,

  notes               TEXT,
  created_by          INTEGER,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- -- Colour, against adjacent normal skin on the same photograph -------------
CREATE TABLE IF NOT EXISTS scar_colour_analysis (
  id                 SERIAL PRIMARY KEY,
  assessment_id      INTEGER NOT NULL REFERENCES scar_assessments(id) ON DELETE CASCADE,
  delta_e            DECIMAL(6,2),
  erythema_index     DECIMAL(6,2),
  lightness_delta    DECIMAL(6,2),
  yellowness_delta   DECIMAL(6,2),
  pigmentation       VARCHAR(20),   -- hyperpigmented | hypopigmented | comparable
  heterogeneity_ratio DECIMAL(6,2),
  scar_pixels        INTEGER,
  reference_pixels   INTEGER,
  reliability        VARCHAR(20),
  reliability_reason TEXT,
  method_version     VARCHAR(40),
  created_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (assessment_id)
);

-- -- Validated scales, one row per scale per visit, never merged -------------
CREATE TABLE IF NOT EXISTS scar_validated_scores (
  id             SERIAL PRIMARY KEY,
  assessment_id  INTEGER NOT NULL REFERENCES scar_assessments(id) ON DELETE CASCADE,
  scale          VARCHAR(30) NOT NULL,   -- vss | posas_observer | posas_patient | dks
  -- The per-item answers as given, so a total can always be recomputed and
  -- audited rather than trusted.
  items          JSONB NOT NULL DEFAULT '{}',
  total          INTEGER,                -- NULL when the scale is incomplete
  overall_item   INTEGER,                -- POSAS overall opinion, kept out of the total
  complete       BOOLEAN NOT NULL DEFAULT FALSE,
  scored_by      INTEGER,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (assessment_id, scale)
);

-- -- What only hands can establish ------------------------------------------
CREATE TABLE IF NOT EXISTS scar_physical_exams (
  id                 SERIAL PRIMARY KEY,
  assessment_id      INTEGER NOT NULL REFERENCES scar_assessments(id) ON DELETE CASCADE,
  pliability         VARCHAR(30),
  consistency        VARCHAR(30),
  mobility           VARCHAR(30),
  tenderness         VARCHAR(30),
  compressibility    VARCHAR(30),
  adherence          VARCHAR(30),
  contracture_present BOOLEAN,
  joint_involved     VARCHAR(80),
  contracture_direction VARCHAR(80),
  rom_degrees        DECIMAL(5,1),
  rom_deficit_degrees DECIMAL(5,1),
  functional_limitation TEXT,
  examiner_notes     TEXT,
  examined_by        INTEGER,
  created_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (assessment_id)
);

-- -- What only the patient can report ---------------------------------------
CREATE TABLE IF NOT EXISTS scar_patient_reported (
  id                  SERIAL PRIMARY KEY,
  assessment_id       INTEGER NOT NULL REFERENCES scar_assessments(id) ON DELETE CASCADE,
  pain_0_10           INTEGER CHECK (pain_0_10 BETWEEN 0 AND 10),
  itch_0_10           INTEGER CHECK (itch_0_10 BETWEEN 0 AND 10),
  tightness_0_10      INTEGER CHECK (tightness_0_10 BETWEEN 0 AND 10),
  tenderness_0_10     INTEGER CHECK (tenderness_0_10 BETWEEN 0 AND 10),
  functional_limitation_0_10 INTEGER CHECK (functional_limitation_0_10 BETWEEN 0 AND 10),
  cosmetic_concern_0_10 INTEGER CHECK (cosmetic_concern_0_10 BETWEEN 0 AND 10),
  treatment_satisfaction_0_10 INTEGER CHECK (treatment_satisfaction_0_10 BETWEEN 0 AND 10),
  free_text           TEXT,
  recorded_by         INTEGER,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (assessment_id)
);

-- -- 3D, and the reason there is none yet ------------------------------------
--
-- The columns exist so that registering a reconstruction backend needs no
-- migration. Nothing writes measurements into them today: multi-view
-- photogrammetry needs structure-from-motion and dense stereo, which no
-- client-side library does reliably and which will not fit in a 30-second,
-- 1 GB serverless function. `status` records why, and a NULL measurement means
-- not reliably measurable — never zero (§23).
CREATE TABLE IF NOT EXISTS scar_3d_models (
  id                 SERIAL PRIMARY KEY,
  assessment_id      INTEGER NOT NULL REFERENCES scar_assessments(id) ON DELETE CASCADE,
  status             VARCHAR(24) NOT NULL DEFAULT 'unavailable',
                     -- unavailable | queued | failed | high | moderate | low
  status_reason      TEXT,
  image_count        INTEGER,
  overlap_score      DECIMAL(4,3),
  reconstruction_backend VARCHAR(60),
  backend_version    VARCHAR(40),
  max_elevation_mm   DECIMAL(6,2),
  mean_elevation_mm  DECIMAL(6,2),
  volume_cm3         DECIMAL(8,3),
  surface_area_cm2   DECIMAL(8,2),
  reference_plane_method VARCHAR(60),
  registration_confidence DECIMAL(4,3),
  created_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (assessment_id)
);

-- -- Predictions, always versioned and time-horizoned ------------------------
CREATE TABLE IF NOT EXISTS scar_predictions (
  id                 SERIAL PRIMARY KEY,
  scar_id            INTEGER NOT NULL REFERENCES scar_cases(id) ON DELETE CASCADE,
  assessment_id      INTEGER REFERENCES scar_assessments(id) ON DELETE SET NULL,
  kind               VARCHAR(40) NOT NULL,
                     -- progression | recurrence | treatment_response | future_morphology
  eligible           BOOLEAN NOT NULL DEFAULT FALSE,
  ineligible_reason  TEXT,
  horizon_days       INTEGER,
  probability        DECIMAL(5,4),
  predicted_value    DECIMAL(10,3),
  interval_low       DECIMAL(10,3),
  interval_high      DECIMAL(10,3),
  confidence         VARCHAR(20),   -- high | moderate | low | not_reliable
  method             VARCHAR(60) NOT NULL,
  -- §79. Never 'clinically_deployed' without formal demonstration.
  validation_status  VARCHAR(30) NOT NULL DEFAULT 'experimental',
  model_version      VARCHAR(40),
  supporting         JSONB DEFAULT '[]',
  limitations        JSONB DEFAULT '[]',
  generated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS scar_alerts (
  id              SERIAL PRIMARY KEY,
  scar_id         INTEGER NOT NULL REFERENCES scar_cases(id) ON DELETE CASCADE,
  assessment_id   INTEGER REFERENCES scar_assessments(id) ON DELETE SET NULL,
  severity        VARCHAR(20) NOT NULL DEFAULT 'info',
  code            VARCHAR(60) NOT NULL,
  message         TEXT NOT NULL,
  evidence        JSONB DEFAULT '[]',
  acknowledged_by INTEGER,
  acknowledged_at TIMESTAMPTZ,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_scar_cases_patient  ON scar_cases(patient_id, status);
CREATE INDEX IF NOT EXISTS idx_scar_cases_wound    ON scar_cases(wound_id);
CREATE INDEX IF NOT EXISTS idx_scar_cases_plan     ON scar_cases(keloid_plan_id);
CREATE INDEX IF NOT EXISTS idx_scar_assess_scar    ON scar_assessments(scar_id, assessed_at);
CREATE INDEX IF NOT EXISTS idx_scar_assess_wa      ON scar_assessments(wound_assessment_id);
CREATE INDEX IF NOT EXISTS idx_scar_scores_assess  ON scar_validated_scores(assessment_id);
CREATE INDEX IF NOT EXISTS idx_scar_pred_scar      ON scar_predictions(scar_id, generated_at DESC);
CREATE INDEX IF NOT EXISTS idx_scar_alerts_open    ON scar_alerts(scar_id) WHERE acknowledged_at IS NULL;

COMMIT;
