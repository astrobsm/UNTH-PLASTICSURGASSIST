-- ============================================================================
-- 016 — Photographic skin graft monitoring.
--
-- Three tables. A recipient site and a donor site are each a row in `wounds`,
-- so every photograph, quality gate, calibration, segmentation, overlay and
-- clinician correction the wound pipeline already performs applies to them
-- unchanged. What is added here is only what is specific to grafting: the
-- episode that ties the sites to an operation, the preserved baseline that
-- graft take is measured against, and the derived per-assessment numbers.
-- ============================================================================

BEGIN;

-- -- The operation's grafting, as one episode -------------------------------
CREATE TABLE IF NOT EXISTS skin_graft_episodes (
  id                 SERIAL PRIMARY KEY,
  patient_id         INTEGER NOT NULL,
  -- Nullable: a graft may be documented before the theatre record catches up,
  -- and refusing the episode until then would push clinicians back to paper.
  surgery_id         INTEGER,
  episode_label      VARCHAR(160),
  graft_type         VARCHAR(40),    -- split_thickness | full_thickness | composite
  graft_thickness_mm DECIMAL(4,2),
  mesh_ratio         VARCHAR(16),    -- '1:1', '1:1.5', '1:3' — text, it is a ratio
  operation_date     DATE,
  surgeon_id         INTEGER,
  status             VARCHAR(30) NOT NULL DEFAULT 'active',
                                     -- active | healed | failed | abandoned
  notes              TEXT,
  created_by         INTEGER,
  created_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at         TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- -- Each recipient and donor site -------------------------------------------
CREATE TABLE IF NOT EXISTS graft_sites (
  id                  SERIAL PRIMARY KEY,
  episode_id          INTEGER NOT NULL REFERENCES skin_graft_episodes(id) ON DELETE CASCADE,
  -- The wound row this site is. Every photograph and assessment for the site
  -- lives in wound_assessments against this id; nothing is duplicated here.
  wound_id            INTEGER NOT NULL,
  site_role           VARCHAR(20) NOT NULL CHECK (site_role IN ('recipient', 'donor')),
  site_label          VARCHAR(160),
  anatomical_location VARCHAR(160),
  body_side           VARCHAR(20),

  -- The defect measured before grafting, which drives graft planning (§11).
  defect_area_cm2     DECIMAL(8,2),

  -- THE PRESERVED DENOMINATOR (§15).
  --
  -- Written once, from the assessment named by baseline_assessment_id, and
  -- never recomputed. Graft take is current viable area over this. If a later
  -- photograph were allowed to redefine it, a graft that had lost half its area
  -- would measure 100% take against its own shrunken self — the failure would
  -- erase the evidence of itself.
  baseline_area_cm2     DECIMAL(8,2),
  baseline_assessment_id INTEGER,
  baseline_captured_at  TIMESTAMPTZ,
  baseline_locked       BOOLEAN NOT NULL DEFAULT FALSE,

  -- Planning outputs, all clearly estimates.
  planned_coverage_cm2  DECIMAL(8,2),
  planned_harvest_cm2   DECIMAL(8,2),

  status              VARCHAR(30) NOT NULL DEFAULT 'active',
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  -- One baseline per site per role; a site is one wound.
  UNIQUE (episode_id, wound_id)
);

-- -- The graft-specific numbers for one photograph ---------------------------
--
-- One row per wound_assessment that belongs to a graft site. The assessment
-- holds the photograph, the area, the calibration and the quality; this holds
-- what those mean for a graft.
CREATE TABLE IF NOT EXISTS graft_site_analyses (
  id                   SERIAL PRIMARY KEY,
  site_id              INTEGER NOT NULL REFERENCES graft_sites(id) ON DELETE CASCADE,
  assessment_id        INTEGER NOT NULL,
  postoperative_day    INTEGER,

  -- Areal, from segmentation and calibration. These are honest automated
  -- measurements: their correctness is geometric.
  measured_area_cm2    DECIMAL(8,2),
  areal_take_pct       DECIMAL(5,2),   -- measured area / preserved baseline
  open_area_cm2        DECIMAL(8,2),   -- donor sites: area not yet closed

  -- Tissue-proportion estimates. NULL until a validated classifier exists —
  -- see TISSUE_MODEL_VALIDATED in aiWoundMeasurement.ts. The columns are here
  -- so that registering a model needs no migration, not because anything
  -- currently writes them.
  viable_area_cm2      DECIMAL(8,2),
  nonviable_area_cm2   DECIMAL(8,2),
  viability_pct        DECIMAL(5,2),
  epithelialized_pct   DECIMAL(5,2),

  -- Which of the two kinds of number this row carries, so a reader never has
  -- to infer it from NULLs.
  tissue_status        VARCHAR(24) NOT NULL DEFAULT 'unavailable',
                       -- unavailable | model | clinician
  tissue_reason        TEXT,

  -- Whether this photograph could be compared with the previous one (§28).
  comparable           BOOLEAN,
  comparability_reason TEXT,

  -- Provenance, mirroring wound_assessments.
  model_name           VARCHAR(80),
  model_version        VARCHAR(40),
  confidence           DECIMAL(4,3),

  created_at           TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (site_id, assessment_id)
);

-- -- Alerts raised by the trend engine ---------------------------------------
CREATE TABLE IF NOT EXISTS graft_alerts (
  id            SERIAL PRIMARY KEY,
  episode_id    INTEGER NOT NULL REFERENCES skin_graft_episodes(id) ON DELETE CASCADE,
  site_id       INTEGER REFERENCES graft_sites(id) ON DELETE CASCADE,
  analysis_id   INTEGER REFERENCES graft_site_analyses(id) ON DELETE SET NULL,
  severity      VARCHAR(20) NOT NULL DEFAULT 'info',  -- info | warning | urgent
  code          VARCHAR(60) NOT NULL,
  message       TEXT NOT NULL,
  acknowledged_by INTEGER,
  acknowledged_at TIMESTAMPTZ,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_sge_patient   ON skin_graft_episodes(patient_id, status);
CREATE INDEX IF NOT EXISTS idx_sge_surgery   ON skin_graft_episodes(surgery_id);
CREATE INDEX IF NOT EXISTS idx_gs_episode    ON graft_sites(episode_id, site_role);
CREATE INDEX IF NOT EXISTS idx_gs_wound      ON graft_sites(wound_id);
CREATE INDEX IF NOT EXISTS idx_gsa_site      ON graft_site_analyses(site_id, postoperative_day);
CREATE INDEX IF NOT EXISTS idx_gsa_assess    ON graft_site_analyses(assessment_id);
CREATE INDEX IF NOT EXISTS idx_ga_episode    ON graft_alerts(episode_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_ga_open       ON graft_alerts(episode_id) WHERE acknowledged_at IS NULL;

COMMIT;
