-- 022: unit governance decisions (D1-D7) and versioned clinical content
-- (postoperative monitoring protocols). api/_lib/governance.js and
-- api/_lib/clinicalRulesets.js apply the same statements on first use.

CREATE TABLE IF NOT EXISTS clinical_governance_settings (
  id SERIAL PRIMARY KEY,
  settings JSONB NOT NULL,
  updated_by INTEGER,
  updated_by_name TEXT,
  note TEXT,
  created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS clinical_rulesets (
  id TEXT NOT NULL,
  version INTEGER NOT NULL,
  kind TEXT NOT NULL,
  title TEXT NOT NULL,
  definition JSONB NOT NULL,
  sources JSONB NOT NULL DEFAULT '[]',
  approval_status TEXT NOT NULL DEFAULT 'draft',
  change_note TEXT,
  content_hash TEXT NOT NULL,
  created_by INTEGER, created_by_name TEXT,
  created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
  approved_by INTEGER, approved_by_name TEXT, approved_at TIMESTAMPTZ,
  PRIMARY KEY (id, version)
);
