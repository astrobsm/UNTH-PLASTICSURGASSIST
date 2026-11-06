-- 024: clinical nutrition — measurements, assessments, intake, meal plans,
-- food composition, recipes, household measures and coefficient sign-off.
-- api/_lib/nutrition.js applies the same statements on first use.
--
-- Weights already in vital_signs and analytes already in lab_orders.results
-- are READ by the nutrition API, never copied here, so each value has one home.

CREATE TABLE IF NOT EXISTS nutrition_measurements (
  id SERIAL PRIMARY KEY,
  patient_id TEXT NOT NULL,
  kind TEXT NOT NULL,
  value NUMERIC NOT NULL,
  unit TEXT NOT NULL,
  method TEXT,
  measured_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  note TEXT,
  status TEXT NOT NULL DEFAULT 'active',
  error_reason TEXT,
  entered_by INTEGER, entered_by_name TEXT, entered_by_role TEXT,
  created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_nutrition_measurements_patient ON nutrition_measurements (patient_id, kind, measured_at);

CREATE TABLE IF NOT EXISTS nutrition_assessments (
  id SERIAL PRIMARY KEY,
  patient_id TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'draft',
  inputs JSONB NOT NULL DEFAULT '{}',
  result JSONB NOT NULL DEFAULT '{}',
  summary JSONB NOT NULL DEFAULT '{}',
  config_version TEXT NOT NULL,
  version INTEGER NOT NULL DEFAULT 1,
  created_by INTEGER, created_by_name TEXT, created_by_role TEXT,
  created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
  approved_by INTEGER, approved_by_name TEXT, approved_by_role TEXT, approved_at TIMESTAMPTZ,
  error_reason TEXT
);
CREATE INDEX IF NOT EXISTS idx_nutrition_assessments_patient ON nutrition_assessments (patient_id, created_at DESC);

CREATE TABLE IF NOT EXISTS nutrition_meal_plans (
  id SERIAL PRIMARY KEY,
  patient_id TEXT NOT NULL,
  assessment_id INTEGER,
  status TEXT NOT NULL DEFAULT 'draft',
  targets JSONB NOT NULL DEFAULT '{}',
  plan JSONB NOT NULL DEFAULT '{}',
  solver JSONB NOT NULL DEFAULT '{}',
  config_version TEXT NOT NULL,
  food_data_version TEXT,
  version INTEGER NOT NULL DEFAULT 1,
  created_by INTEGER, created_by_name TEXT, created_by_role TEXT,
  created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
  approved_by INTEGER, approved_by_name TEXT, approved_by_role TEXT, approved_at TIMESTAMPTZ,
  superseded_by INTEGER,
  error_reason TEXT
);
CREATE INDEX IF NOT EXISTS idx_nutrition_meal_plans_patient ON nutrition_meal_plans (patient_id, created_at DESC);

CREATE TABLE IF NOT EXISTS nutrition_intake (
  id SERIAL PRIMARY KEY,
  patient_id TEXT NOT NULL,
  intake_date DATE NOT NULL,
  meal TEXT NOT NULL,
  plan_id INTEGER,
  items JSONB NOT NULL DEFAULT '[]',
  kcal NUMERIC NOT NULL DEFAULT 0,
  protein_g NUMERIC NOT NULL DEFAULT 0,
  target_kcal NUMERIC,
  target_protein_g NUMERIC,
  note TEXT,
  recorded_by INTEGER, recorded_by_name TEXT, recorded_by_role TEXT,
  created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
  UNIQUE (patient_id, intake_date, meal)
);

CREATE TABLE IF NOT EXISTS nutrition_food_sources (
  id SERIAL PRIMARY KEY,
  code TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  version TEXT,
  licence TEXT,
  url TEXT,
  row_count INTEGER DEFAULT 0,
  imported_at TIMESTAMPTZ,
  imported_by_name TEXT
);

CREATE TABLE IF NOT EXISTS nutrition_foods (
  id SERIAL PRIMARY KEY,
  source_code TEXT NOT NULL,
  food_code TEXT NOT NULL,
  name TEXT NOT NULL,
  local_names JSONB NOT NULL DEFAULT '{}',
  food_group TEXT,
  per100g JSONB NOT NULL DEFAULT '{}',
  edible_portion NUMERIC,
  yield_factor NUMERIC,
  state TEXT,
  min_portion_g NUMERIC,
  max_portion_g NUMERIC,
  unit_g NUMERIC,
  unit_label TEXT,
  cost_tier TEXT,
  seasonality TEXT,
  availability JSONB NOT NULL DEFAULT '{}',
  tags JSONB NOT NULL DEFAULT '[]',
  active BOOLEAN NOT NULL DEFAULT TRUE,
  updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
  UNIQUE (source_code, food_code)
);

CREATE TABLE IF NOT EXISTS nutrition_recipes (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  local_name TEXT,
  category TEXT,
  meal_slots JSONB NOT NULL DEFAULT '[]',
  portion_g NUMERIC,
  yield_factor NUMERIC,
  texture TEXT,
  tags JSONB NOT NULL DEFAULT '[]',
  status TEXT NOT NULL DEFAULT 'draft',
  notes TEXT,
  verified_by_name TEXT, verified_at TIMESTAMPTZ,
  created_by_name TEXT,
  created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
  UNIQUE (name)
);

CREATE TABLE IF NOT EXISTS nutrition_recipe_ingredients (
  id SERIAL PRIMARY KEY,
  recipe_id INTEGER NOT NULL,
  food_id INTEGER NOT NULL,
  raw_g NUMERIC NOT NULL,
  note TEXT
);
CREATE INDEX IF NOT EXISTS idx_nutrition_recipe_ingredients ON nutrition_recipe_ingredients (recipe_id);

CREATE TABLE IF NOT EXISTS nutrition_household_measures (
  id SERIAL PRIMARY KEY,
  food_id INTEGER,
  recipe_id INTEGER,
  measure TEXT NOT NULL,
  grams NUMERIC NOT NULL,
  verified BOOLEAN NOT NULL DEFAULT FALSE,
  verified_by_name TEXT, verified_at TIMESTAMPTZ,
  note TEXT,
  created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS nutrition_config_signoffs (
  id SERIAL PRIMARY KEY,
  config_version TEXT NOT NULL,
  signed_by INTEGER, signed_by_name TEXT, signed_by_role TEXT,
  signed_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
  note TEXT
);
