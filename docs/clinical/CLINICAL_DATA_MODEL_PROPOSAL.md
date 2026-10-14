# Clinical Data Model Proposal

Companion to `CLINICAL_DOCUMENTATION_AUDIT.md` and `CLINICAL_IMPLEMENTATION_PLAN.md`.

**Aim:** one structured model for encounters, history, examination, observations, problems, decision support, alerts, monitoring and medication administration. It should:

- reuse existing tables where they are sound;
- add only what is missing;
- map cleanly onto FHIR resources for later interoperability, without adopting a second architecture.

**Status:** proposal. No tables in this document exist yet. Every new table is created by a versioned migration (§9), never by request-time DDL.

---

## 1. Design rules

1. **A finding has a status, not just a value.** Every structured finding carries `status ∈ {present, absent, not_assessed, unable_to_assess, unknown}`.
   - `absent` is recorded only when the clinician selects it.
   - Opening a section records nothing.
2. **Concept ID plus display text.** Coded fields store `concept_id` (our stable local ID), the display text the clinician saw, and the original typed text if it differed.
   - External codes (SNOMED CT, ICD-10/11, LOINC) live on the concept, not on every row, so a mapping can be corrected once.
3. **Who and when, always.** Rows carry `recorded_by` (server-set from the session, never from the request body), `recorded_at` (server), and `observed_at` (clinical time, client-supplied, clamped).
4. **No silent overwrite of clinical content.** Signed documents are immutable. A change creates a new version and an amendment record. Deletion of signed content is replaced by `entered_in_error` with a reason.
5. **Provenance on every derived value.** Each value is marked `source ∈ {clinician, patient_reported, device, calculated, ai_suggested, imported}`, with a reference to its inputs.
6. **Optimistic concurrency.** Mutable rows carry `version INTEGER`. Updates must send the version they read; a mismatch returns 409 with both versions.
7. **One `patient_id` type.** New tables use `patient_id INTEGER REFERENCES patients(id)`. Offline-created patients get a client UUID in `patients.client_uuid` and are resolved to the integer ID on sync. Existing drifted tables are migrated separately (§8).

---

## 2. Reuse map: existing tables

| Existing table | Decision | Notes |
|---|---|---|
| `patients` | **Keep, extend** | Add `client_uuid UUID UNIQUE`, `hospital_number_normalised` (generated) with a unique index, and `sex_recorded`. Allergies move to `allergy_intolerances`; the old `allergies TEXT` stays read-only for history. |
| `admissions` | **Keep** | The encounter of type `inpatient_admission` references it. Add a one-open-admission-per-patient partial unique index once duplicates are cleaned up. |
| `progress_notes` | **Keep for legacy notes** | New documentation goes into `clinical_encounters`. Existing notes stay readable and are shown in the timeline. |
| `ward_rounds` | **Keep; becomes a view of encounters** | New rounds are `clinical_encounters` of type `ward_round`. Existing `findings` JSON is shown read-only. The morning-round fields (`documented_at`, `folder_updated`) carry over. |
| `vital_signs` | **Extend, then supersede** | New vitals are `clinical_observations` with LOINC-mapped concepts. Existing rows are back-filled as observations with `source='imported'`. |
| `prescriptions` | **Keep as orders** | Add `medication_administrations`. A prescription is never treated as administered. |
| `lab_orders`, `investigation_uploads` | **Keep** | Results become observations, linked via `diagnostic_report_id`. |
| `treatment_plans`, `treatment_plan_modifications` | **Keep** | Close the open PUT; plan changes go through the modification workflow. |
| `surgeries`, `preoperative_assessments` | **Keep, extend** | Add the `operative_notes` and `postop_monitoring_plans` tables below. |
| `wounds`, `wound_assessments`, `scars`, skin-graft tables | **Keep as they are** | Already structured. Linked to encounters through `encounter_id` (new, nullable). |
| `discharge_summaries` | **Keep** | Its approval workflow is the model for `document_signatures`. |
| `risk_assessments` (upsert) | **Replace** | Becomes `risk_assessment_results` (append-only, versioned tool). The old table stays for history. |
| `audit_logs` | **Keep for client events** | Add server-written `clinical_audit_events` (§7). |
| `student_clerkings` | **Keep** | Student work stays separate; its field structure informs the clerking templates. |

---

## 3. Terminology

```sql
terminology_concepts (
  id               TEXT PRIMARY KEY,        -- stable local ID, e.g. 'sym.dyspnoea'
  domain           TEXT NOT NULL,           -- symptom | finding | condition | procedure | body_site | substance | medication | lab_test | allergen | qualifier
  preferred_term   TEXT NOT NULL,
  definition       TEXT,                    -- only where licensed/authored locally
  status           TEXT NOT NULL DEFAULT 'active',   -- active | retired | proposed
  replaced_by      TEXT REFERENCES terminology_concepts(id),
  review_status    TEXT NOT NULL DEFAULT 'unreviewed', -- unreviewed | clinician_reviewed | approved
  version_added    TEXT NOT NULL,           -- terminology release, e.g. '2026.10'
  created_at, updated_at
)
terminology_terms (                          -- synonyms, abbreviations, misspellings
  id SERIAL, concept_id TEXT REFERENCES terminology_concepts(id),
  term TEXT NOT NULL, term_normalised TEXT NOT NULL,
  kind TEXT NOT NULL,                        -- preferred | synonym | abbreviation | common_misspelling | lay_term
  locale TEXT DEFAULT 'en-GB',
  ambiguous BOOLEAN DEFAULT FALSE            -- e.g. 'MS' → must not auto-resolve
)
terminology_mappings (
  concept_id TEXT, system TEXT,              -- 'SNOMED-CT' | 'ICD-10' | 'ICD-11' | 'LOINC' | 'RxNorm' | 'local'
  code TEXT, system_version TEXT,
  equivalence TEXT,                          -- equivalent | broader | narrower | related
  mapped_by, reviewed_by, reviewed_at
)
terminology_requests (                       -- "term not found" flagged by clinicians
  id, typed_text, context_field, requested_by, requested_at, resolution, resolved_concept_id
)
```

- **Search behaviour:**
  - normalise (case, diacritics, punctuation) → prefix and token match on `term_normalised` → trigram similarity for typos (`pg_trgm`).
  - Results are grouped by concept. Ambiguous terms list every candidate and are never auto-selected.
- **Licensing:** SNOMED CT needs an Affiliate Licence. Nigeria is not an IHTSDO member country, so a licence must be confirmed before SNOMED codes are loaded. Until then concepts are local, with ICD-10 (WHO-licensed for use) and LOINC (free licence) mappings where they are unambiguous.
- **Offline:** the approved concept set is versioned and cached in Dexie (`terminology_concepts`, `terminology_terms`) so search works without a network. Free-text "Other" entries made offline sync as `terminology_requests`.

---

## 4. Encounters and documentation

```sql
clinical_encounters (
  id               SERIAL PRIMARY KEY,
  client_uuid      UUID UNIQUE,              -- offline creation + idempotent sync
  patient_id       INTEGER NOT NULL REFERENCES patients(id),
  admission_id     INTEGER REFERENCES admissions(id),
  surgery_id       INTEGER REFERENCES surgeries(id),       -- postoperative reviews
  encounter_type   TEXT NOT NULL,   -- outpatient_new | inpatient_admission | emergency | surgical_review | preop | postop_review | ward_round | follow_up | critical_care | oncology_review | burns_assessment | wound_clinic
  unit_id          TEXT,            -- 'PS-UNIT-1' | 'PS-UNIT-2'
  location         TEXT,
  responsible_clinician_id INTEGER REFERENCES users(id),
  started_at       TIMESTAMPTZ NOT NULL,
  status           TEXT NOT NULL DEFAULT 'draft',  -- draft | pending_review | signed | amended | closed | entered_in_error
  template_id      TEXT NOT NULL,   -- which clerking template
  template_version TEXT NOT NULL,
  version          INTEGER NOT NULL DEFAULT 1,
  created_by, created_at, updated_at
)

encounter_sections (                -- one row per section per encounter
  encounter_id     INTEGER REFERENCES clinical_encounters(id),
  section_key      TEXT,            -- 'presenting_complaints' | 'hpc' | 'ros.cardiovascular' | 'exam.general' | 'exam.wound' ...
  status           TEXT NOT NULL,   -- not_started | in_progress | complete | not_applicable
  data             JSONB NOT NULL,  -- section payload, validated against section schema version
  schema_version   TEXT NOT NULL,
  narrative        TEXT,            -- generated, editable
  narrative_edited BOOLEAN DEFAULT FALSE,
  updated_by, updated_at,
  PRIMARY KEY (encounter_id, section_key)
)
```

- **Why sections are JSONB and findings are rows:** sections keep the form flexible (templates evolve without a migration). Findings worth querying across patients are also written out as `clinical_observations` rows (§5) on save, so research queries never parse JSON.
- **Section payload shape** (a validated schema, versioned per section):

```json
{ "items": [ {
    "concept_id": "sym.dyspnoea", "display": "Shortness of breath", "typed": "SOB",
    "status": "present", "body_site": "...", "laterality": "left|right|bilateral|na",
    "onset": "sudden|gradual|uncertain", "duration": {"value": 3, "unit": "d"},
    "severity": "...", "qualifiers": {...}, "note": "free text"
  } ],
  "free_text": "…" }
```

### 4.1 Signing and amendments

```sql
document_signatures (
  id, encounter_id, version INTEGER, action TEXT,   -- sign | countersign | amend | reject | mark_in_error
  signed_by INTEGER REFERENCES users(id), signed_at TIMESTAMPTZ,
  reason TEXT, content_hash TEXT                     -- SHA-256 of the signed snapshot
)
encounter_versions (                                 -- immutable snapshot at each sign/amend
  encounter_id, version, snapshot JSONB, created_by, created_at
)
```

- Only `draft` and `pending_review` are editable.
- `signed` → `amended` creates a new version, requiring a reason and an authorised role.
- Deletion is replaced by `entered_in_error`.

---

## 5. Observations and longitudinal data

```sql
clinical_observations (
  id BIGSERIAL PRIMARY KEY,
  client_uuid UUID UNIQUE,
  patient_id INTEGER NOT NULL REFERENCES patients(id),
  encounter_id INTEGER REFERENCES clinical_encounters(id),
  concept_id TEXT NOT NULL REFERENCES terminology_concepts(id),   -- e.g. 'obs.heart_rate'
  status TEXT NOT NULL,              -- present | absent | not_assessed | unable_to_assess | unknown | entered_in_error
  value_num NUMERIC, value_unit TEXT,          -- UCUM units, e.g. '/min', 'mm[Hg]', 'Cel', '%'
  value_text TEXT, value_concept TEXT,         -- coded answer
  body_site TEXT, laterality TEXT,
  observed_at TIMESTAMPTZ NOT NULL,            -- clinical time
  recorded_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  recorded_by INTEGER REFERENCES users(id),
  source TEXT NOT NULL,              -- clinician | patient_reported | device | calculated | ai_suggested | imported
  method TEXT,                       -- e.g. 'manual', 'monitor', 'photo_calibrated'
  context JSONB,                     -- e.g. {"o2_device":"nasal_cannula","o2_flow_lpm":2}
  derived_from BIGINT[],             -- observation ids for calculated values
  out_of_range BOOLEAN,              -- flagged, NEVER altered
  version INTEGER NOT NULL DEFAULT 1
)
CREATE INDEX ON clinical_observations (patient_id, concept_id, observed_at DESC);
```

- **Values entered outside plausibility limits** are accepted with a confirmation step and flagged; they are never clamped.
- **Values outside physiological possibility** (e.g. SpO₂ 140%) are rejected with a message; the typed value is kept in the draft.

### 5.1 Problems and diagnoses

```sql
clinical_problems (
  id, patient_id, admission_id, concept_id, display, typed,
  verification TEXT,   -- provisional | differential | confirmed | refuted | entered_in_error
  clinical_status TEXT,-- active | improving | resolved | recurrence
  onset_date, abated_date, body_site, laterality,
  source TEXT,         -- clinician | ai_suggested_accepted | imported
  asserted_by, asserted_at, version
)
problem_reviews (      -- per ward round: baseline → previous → current
  id, problem_id, encounter_id, assessment TEXT,  -- improved | unchanged | worse | new | resolved | not_reviewed
  note, next_action, reviewed_by, reviewed_at
)
```

- AI-suggested differentials are **never** inserted here directly. A clinician's accept action creates the row, with `source='ai_suggested_accepted'` and a link to the AI record.

### 5.2 Allergies and medications

```sql
allergy_intolerances (
  id, patient_id, substance_concept_id, substance_text,
  reaction TEXT, severity TEXT, onset TEXT,
  certainty TEXT,       -- confirmed | likely | unlikely | refuted
  verification TEXT,    -- unverified | verified
  source TEXT, recorded_by, recorded_at, status   -- active | inactive | entered_in_error
)
patient_allergy_status (patient_id PRIMARY KEY,
  status TEXT,          -- not_yet_asked | no_known_allergies | has_allergies | unable_to_obtain
  updated_by, updated_at)

medication_administrations (
  id, client_uuid, prescription_id INTEGER REFERENCES prescriptions(id),
  patient_id, scheduled_for TIMESTAMPTZ,
  status TEXT,          -- given | refused | withheld | omitted | unavailable | self_reported_taken | not_documented
  given_at TIMESTAMPTZ, dose_given TEXT, route TEXT,
  reason TEXT, corrective_action TEXT, resolved_at,
  recorded_by, recorded_at
)
```

- "No known allergies" exists only as an explicit `patient_allergy_status`. A missing row means **not yet asked**.

---

## 6. Decision support, alerts and monitoring

```sql
clinical_rulesets (    -- deterministic rules: early warning, monitoring profiles, risk tools
  id TEXT, version TEXT, kind TEXT,         -- ews | monitoring_profile | risk_tool | alert_rule
  title, source_citation TEXT, source_version TEXT,
  definition JSONB,                         -- thresholds and logic as data
  approval_status TEXT,                     -- draft | pending_local_review | approved | retired
  approved_by, approved_at, content_hash,
  PRIMARY KEY (id, version)
)

clinical_alerts (
  id, patient_id, encounter_id, surgery_id,
  level TEXT,             -- red | amber | green | insufficient_data
  rule_id TEXT, rule_version TEXT,
  trigger JSONB,          -- {observation_ids:[...], values:[...], threshold:"..."}
  reason TEXT, suggested_action TEXT, escalation_pathway TEXT,
  responsible_team TEXT, raised_at, dedupe_key TEXT,
  status TEXT,            -- open | acknowledged | escalated | resolved | superseded
  resolved_at, resolution_note
)
alert_acknowledgements (id, alert_id, user_id, action, note, at)

risk_assessment_results ( -- append-only
  id, patient_id, encounter_id, tool_id, tool_version,
  inputs JSONB,           -- each item with status; missing items listed
  score NUMERIC NULL,     -- NULL when any required item is missing
  band TEXT, missing_items TEXT[], assessed_by, assessed_at
)

postop_monitoring_plans (
  id, surgery_id, profile_id, profile_version,     -- e.g. 'free_flap' v1.0 (approved)
  schedule JSONB,         -- per-parameter frequency; edited by clinician
  started_at, ended_at, created_by, approved_by
)
operative_notes (
  id, surgery_id, procedure_concept_ids TEXT[], surgeon_id, anaesthesia_type,
  findings TEXT, ebl_ml NUMERIC NULL, fluids JSONB, transfusion JSONB,
  drains JSONB,           -- [{id:'D1', site, type}] → per-drain output observations
  implants JSONB, grafts_flaps JSONB, complications TEXT,
  postop_orders TEXT, status, signed_by, signed_at
)

clinical_tasks (           -- multidisciplinary assignments
  id, patient_id, encounter_id, alert_id, assigned_team TEXT, assigned_to INTEGER,
  description, due_at, status, completed_by, completed_at
)
```

### 6.1 AI recommendation records

```sql
ai_recommendations (
  id, patient_id, encounter_id, kind TEXT,    -- summary | differential | investigations | plan | narrative
  engine TEXT,             -- 'rules' | 'llm'
  model_or_ruleset TEXT, model_version TEXT,
  input_refs JSONB,        -- observation/section ids used, NOT raw identifiers
  output JSONB,            -- suggestions with supporting/contradicting evidence refs
  missing_data TEXT[],
  generated_at, generated_by_user,
  clinician_decision TEXT, -- accepted | edited | rejected | pending
  final_content JSONB, decided_by, decided_at
)
```

---

## 7. Server-side audit

```sql
clinical_audit_events (
  id BIGSERIAL, occurred_at TIMESTAMPTZ DEFAULT now(),
  actor_id INTEGER NOT NULL,          -- from the verified session only
  actor_role TEXT NOT NULL,
  action TEXT NOT NULL,               -- create | update | sign | amend | view_sensitive | export | ai_request | alert_ack | delete_attempt
  entity TEXT NOT NULL, entity_id TEXT NOT NULL,
  patient_id INTEGER,
  before_hash TEXT, after_hash TEXT,
  detail JSONB, ip INET, user_agent TEXT
)
```

- Written by the API in the same transaction as the change.
- No API route updates or deletes rows. Retention follows the hospital's records policy.

---

## 8. Existing-data migration

| Data | Approach |
|---|---|
| `patient_id` drift | Create typed copies (`patient_id_int`) via a migration that casts where valid. Rows that fail the cast are reported, not deleted. Switch reads, then constraints, in separate releases. |
| Allergies text | Parse into `allergy_intolerances` as `verification='unverified'`, `source='imported'`, keeping the raw text. Set `patient_allergy_status='has_allergies'` only where text exists, otherwise leave **unset (not yet asked)**. |
| Vital signs | Back-fill into `clinical_observations` with `source='imported'`; keep the original table. |
| Ward rounds / progress notes | Not converted. Shown read-only in the timeline as legacy documents. |
| Risk assessments | Copy the current row per patient and type into `risk_assessment_results` with `tool_version='legacy'`. |
| Duplicate open admissions | Report for clinical resolution before adding the uniqueness index. |

---

## 9. Migrations

- **Location:** versioned SQL files in `database/migrations/NNN_name.up.sql` with a matching `NNN_name.down.sql`.
- **Runner:** extend `scripts/apply-migration.mjs` to discover `database/migrations/` as well as root `add-*.sql`. Checksums stay in `schema_migrations`.
- **Process:** every migration is tested against a restored copy of production before release.
- **New tables** in this proposal are created only by migrations. Request-time DDL is not used for them.
- **Existing request-time DDL** is frozen (no new additions) and retired gradually.

---

## 10. FHIR alignment (for later interoperability)

| Local | FHIR R4 |
|---|---|
| patients | Patient |
| clinical_encounters | Encounter (+ Composition for the signed note) |
| encounter_sections | Composition.section |
| clinical_observations | Observation |
| clinical_problems | Condition |
| allergy_intolerances | AllergyIntolerance |
| prescriptions / medication_administrations | MedicationRequest / MedicationAdministration |
| lab_orders + results | ServiceRequest / DiagnosticReport |
| surgeries / operative_notes | Procedure |
| treatment_plans | CarePlan |
| clinical_tasks | Task |
| clinical_alerts | Flag / DetectedIssue |
| risk_assessment_results | RiskAssessment |
| clinical_audit_events | AuditEvent |
| ai_recommendations | GuidanceResponse |

No FHIR server is proposed now. The mapping is to keep field semantics compatible so an export layer can be added later.
