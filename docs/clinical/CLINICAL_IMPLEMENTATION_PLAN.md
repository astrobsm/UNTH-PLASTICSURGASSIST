# Clinical Implementation Plan

Based on `CLINICAL_DOCUMENTATION_AUDIT.md` (findings S1–S10 and §1–21) and `CLINICAL_DATA_MODEL_PROPOSAL.md`.
Safety requirements are in `CLINICAL_SAFETY_AND_VALIDATION_PLAN.md`.

## Status (2026-10-14)

| Item | State |
|---|---|
| Phase 0 — S1–S10 safety fixes | **Done** on branch `feature/clinical-phase0` (commits 4db031b … f1bf007); full suite 1,121 tests passing |
| D1–D7 decisions | **Selectable** on Clinical Governance → Decisions; every change kept with who/when/why |
| D5 external AI | **Decided by the unit:** OpenAI permitted. Default `enabled_deidentified`; identifiers removed server-side; every call audited |
| D3 monitoring protocols | Ten **draft** protocols from published guidance, editable and versioned on Clinical Governance → Monitoring protocols; approval by D1 approvers; guidance only (no alerts yet) |
| Phase 1 onwards | Not started |

Implementation notes for Phase 0 beyond the audit:
- **Patient creation used the wrong endpoint.** `POST /sync/patients` was the full-sync handler: it created nothing and returned every table. Offline registrations therefore never reached the server, and the push path overwrote an existing patient's identity when a hospital number was reused. Both are fixed (S10).
- **Clinical deletes are now "entered in error".** They are kept, with who, when and why. New server table `clinical_audit_events` (migration 021).

## Principles

1. **Fix what is unsafe before adding features.** Phase 0 ships before any new clinical module.
2. **Build foundations once.** The searchable concept picker, tri-state findings, signing, server audit and versioned migrations are used by every later phase.
3. **Small, reviewable releases.** Each phase ships as several commits and deploys. Every release is behind a feature flag until clinically accepted, and leaves existing screens working.
4. **No clinical rule goes live without approval.** Thresholds, monitoring profiles and risk tools are data (`clinical_rulesets`) with a cited source and version. They run in "shadow" (computed, logged, not shown as alerts) until a named consultant approves them.
5. **AI is optional and labelled.** Every feature must work with AI switched off. AI output is a suggestion, stored as a recommendation record, and requires a clinician decision.

## Decisions needed from the unit before the phases that depend on them

| # | Decision | Needed by |
|---|---|---|
| D1 | A named consultant (or committee) to approve clinical content: templates, rules, monitoring profiles. | Phase 2 |
| D2 | Early-warning score: adopt NEWS2 (RCP 2017) unchanged, or a locally modified version? Who may change thresholds? | Phase 5 |
| D3 | Postoperative monitoring protocols (free flap, graft, burns, etc.): the unit's own approved frequencies and escalation pathways. The system will hold them; it must not invent them. | Phase 6 |
| D4 | Terminology licensing: confirm whether a SNOMED CT licence is obtainable. Until then: local concepts plus ICD-10 and LOINC mappings. | Phase 2 |
| D5 | External AI: is sending clinical content to OpenAI or Google permitted under the hospital's NDPA 2023 obligations? If yes, on what de-identification terms; if no, AI features stay off. | Phase 4 |
| D6 | Who may sign, countersign and amend each encounter type (e.g. HO drafts, registrar or above signs). | Phase 3 |
| D7 | Research data access: who approves de-identified exports (an ethics committee reference). | Phase 7 |

---

## Phase 0 — Safety fixes in the existing app (no new architecture)

| Fix | Files | Notes |
|---|---|---|
| S1 Stop discarding allergies at registration | `PatientRegistrationForm.tsx:2336-2342` | Use the form's own allergies when the risk flow is off. Never send `[]` to mean "none". |
| S2 Stop rendering missing allergies as "None known" | `unthPatientService.ts:626` and any similar prompt or summary text | Say "Allergy status not documented". |
| S3 Persist all ward-round fields | `WardRoundForm.tsx`, `wardRoundPayload.ts`, `wardRoundsService.ts` | Carry pain, sleep, appetite, bowels, drains, mobility, medication lists, orders and consultant-notified through the payload (inside `findings` for now). Add a round-trip test. |
| S4 Remove placeholder negatives | `WardRoundForm.tsx:338-360` | Empty stays empty and displays "Not documented". |
| S5 Stop hard deletes of clinical notes | `api/ward-rounds.js`, `progress-notes.js`, `vital-signs.js`, `prescriptions.js` | Replace with soft delete (`status='entered_in_error'`, reason, who, when). Add an owner/role check to progress-notes DELETE. |
| S6 Server-attributed audit | `api/audit-logs.js` | Take actor from the verified session and ignore body `user_id`/`user_name`. Write a server audit row on clinical create/update/delete in the handlers above. |
| S7 Remove the demo VSS | `burnCare/BurnFollowUpAssessment.tsx:308` | Score only from entered items; show "incomplete" otherwise. |
| S8 Risk scores: no defaults, no overwrite | `PressureSorePage.tsx`, `api/risk-assessments.js` | Items start unscored. Insert a new row per assessment instead of upserting. |
| S9 Remove browser-side AI keys | `clinicalNotesExtraction.ts`, `AISettingsPanel.tsx`, `aiService.ts` | Route through the server or disable. Add a server-wide `AI_EXTERNAL_PROCESSING` flag (default **off** until D5). Strip names and hospital numbers from OCR `patientContext`. |
| S10 Registration duplicates | `unthPatientService.ts` | Surface 409s to the user (do not save locally as unsynced). Server-generated hospital numbers only. Add normalised-number matching and a "possible duplicate" check by name, DOB and sex. |
| Misc | `api/ai/scribe-process.js:182` | Record the model actually used. |

**Exit:** a unit test for each fix; full suite green; deployed; spot-check in production.

## Phase 1 — Foundations

1. **Migration runner** (data model §9): `database/migrations/*.up/down.sql`, discovered by `scripts/apply-migration.mjs`. Dry-run against a restored backup. A CI workflow runs tests, `tsc` and `clinical:check` on every push.
2. **Server helpers:**
   - `api/_lib/validate.js` (zod-style schema validation for new endpoints),
   - `api/_lib/audit.js` (`clinical_audit_events` writer),
   - `api/_lib/concurrency.js` (version check → 409 with both versions),
   - `requireRole` actually used for new routes.
3. **Terminology service:**
   - tables (data model §3), `GET /api/terminology/search?q=&domain=` (prefix, synonym, trigram),
   - `POST /api/terminology/requests`, Dexie cache, a seed loader.
   - **Seed content:** a first curated set of symptoms, findings, body sites, plastic-surgery conditions and procedures, with synonyms and common abbreviations. Clinician review is required; it ships as `review_status='unreviewed'` until D1 approves.
4. **UI building blocks** (`src/components/clinical/`):
   - `ConceptPicker`: searchable, keyboard navigable, multi-select, shows the preferred term, "Other" plus a flag for review, ambiguous terms are never auto-picked.
   - `FindingRow`: present / absent / not assessed / unable / unknown, plus site, laterality, qualifiers.
   - `ObservationInput`: units, plausibility check, confirm-out-of-range, original value kept.
   - `SectionShell`: completion status, autosave to Dexie, sync status.

**Exit:** components covered by tests (keyboard navigation, synonym match, tri-state rendering, no auto-normal), plus a Storybook-style demo page behind a flag.

## Phase 2 — Encounter model and signing

- Migrations for `clinical_encounters`, `encounter_sections`, `encounter_versions`, `document_signatures`, `clinical_observations`, `clinical_problems`, `allergy_intolerances`, `patient_allergy_status`.
- `api/encounters.js`: create/update draft (versioned), sign, amend (reason required), mark in error, list by patient.
- **Signing permissions** from D6, enforced server-side.
- Patient context loader: demographics, allergy status, active problems, current medications, previous operations and recent results, each with its age and source.
- **Offline:** encounters are created with `client_uuid` and sync idempotently. A version conflict produces a side-by-side resolution screen; no silent overwrite.

**Exit:** sign/amend/audit tests; conflict test (two devices edit the same draft); legacy notes still display.

## Phase 3 — Structured clerking and examination

- **Templates** (versioned JSON in `src/clinical/templates/`, approved under D1):
  - new surgical patient (full Hamilton Bailey–order clerking: identification → PC → HPC → systems review → PMH → PSH → drugs → allergies → family → social → obstetric/gynaecological where applicable → general exam → vitals → systemic exam → local/plastic exam),
  - burns, wound, hand injury, skin lesion/tumour, scar/keloid modules that attach to the core.
- **Conditional logic:** questions are shown only when relevant (e.g. the pain dimensions only if pain is present; mechanism and inhalation questions only for burns).
- **Plastic-surgery examination:** links to the existing wound, scar and graft modules rather than duplicating them. Burns TBSA reuses `burnCareService` Lund–Browder with the source shown.
- **Completeness review screen:** sections done, missing essentials, key positives and negatives, unverified information, possible urgent findings.
- **Narrative generator (deterministic, not AI):** structured data → readable text. Absent, not-assessed and unknown are rendered distinctly. The narrative is editable, and edits are tracked.
- **Entry points:** the `EncountersTab` in `PatientProfile` gains "New structured encounter"; the free-text note remains available.

**Exit:** template unit tests; a narrative test suite (no unassessed item rendered as normal); clinician walkthrough of three synthetic patients.

## Phase 4 — Decision support (rules first, AI optional)

- **Clinical summary:** deterministic assembly from documented data, labelled by source (patient-reported, observed, calculated, historical). Optional AI polishing only if D5 allows, with de-identified input.
- **Differentials, investigations and plan suggestions** are stored as `ai_recommendations` (engine `rules` or `llm`). The UI shows supporting and contradicting evidence and missing data. Nothing enters the problem list, orders or plan without a clinician accept or edit.
- **Rule content** (e.g. "suggest FBC/U&E/group & save before major surgery") is data in `clinical_rulesets`, cited, and approved under D1.
- **Medication suggestions** never include patient-specific doses unless a validated dosing method and the required inputs (weight, renal function) exist; otherwise a "dose to be determined by prescriber" placeholder is shown.

**Exit:** tests that suggestions never write to confirmed records; offline shows "AI unavailable"; audit of every AI call.

## Phase 5 — Ward rounds and early warning

- A ward round becomes a `ward_round` encounter pre-loaded with:
  - active problems, the previous review, vitals trends (table + sparkline with timestamps),
  - fluid balance, outstanding investigations, medication administration status.
- **Per-problem review:** baseline → previous → current, direction, response, next action (`problem_reviews`). New complaints are added as new problems, without overwriting the presenting complaint.
- **Vitals:** move to `clinical_observations` (adding consciousness, O₂ device and flow, pain, urine output). Existing `vital_signs` rows are back-filled.
- **Early-warning ruleset** per D2, implemented exactly per its source (e.g. NEWS2 including the single-parameter-3 trigger and the SpO₂ scale 2 option).
  - Missing parameters → status `insufficient_data`, never a score of 0.
  - Shadow mode first.
- **Status display:**
  - **red/amber** only from approved rules or a clinician assessment;
  - **green** only when all required parameters are present and recent;
  - otherwise **insufficient data**.
- **Daily summary** generator (deterministic) with the 15-item structure from the brief.
- **Morning-round integration:** the existing 07:00–09:00 HO checklist links to the new ward-round encounter.

## Phase 6 — Postoperative monitoring

- `operative_notes` (structured) linked to `surgeries`, with drains identified individually.
- **Monitoring profiles** (`clinical_rulesets`, kind `monitoring_profile`) for: skin graft, local/regional flap, free flap, burns surgery, hand surgery, breast reconstruction, oncological reconstruction, pressure-sore reconstruction, major soft-tissue excision, general.
  - **Content comes from D3**; the engineering ships the structure plus empty or draft profiles marked `pending_local_review`.
- A per-patient monitoring plan is generated from the profile; the clinician edits and approves it.
- **Observation charting:** due/overdue indicators. Overdue essential observations raise **amber** "monitoring incomplete", not green.
- **Flap chart:** colour, temperature, capillary refill, turgor, Doppler, bleeding, with time stamps. Graft and donor-site checks extend the existing skin-graft module.
- **Medication administration record** (`medication_administrations`): administration states, omission reasons, overdue critical doses (critical-medicine list per D1), and allergy conflict checks against coded allergies.
- **Alerts:** dedupe keys, reassessment intervals, acknowledgement and escalation records, push notification to the responsible team.
  - An acknowledged alert never suppresses a new red trigger.
- **Risk tools** (Caprini, Braden, MUST, plus falls if approved): one implementation each (the duplicates are retired), append-only results, missing items listed, score withheld if incomplete.

## Phase 7 — Research, audit and reporting

- **Query layer:** diagnoses, wound types, procedure outcomes, complications, length of stay, reoperation, graft take, flap complications, burns outcomes, medication implementation, time to review, deterioration patterns, risk-assessment completion and protocol adherence.
- **Exports:**
  - role-restricted and audited,
  - de-identified by default (pseudonymous IDs, dates shifted or reduced to intervals, free text excluded unless approved),
  - CSV cells escaped.
- **Fix the broken Analytics route**, or remove the page.

## Phase 8 — Validation

See `CLINICAL_SAFETY_AND_VALIDATION_PLAN.md`: automated suites, synthetic scenarios, false-positive and false-negative alert tests, offline/conflict tests, permission tests, migration rehearsal, regression and clinician UAT.

## Phase 9 — Deployment preparation

- **Runbook:** backup, migration order, feature-flag rollout per unit, rollback (down migrations plus flag off), monitoring.
- **Training:** a short guide per role (HO, registrar, SR, consultant, nurse).

---

## Clean-up done alongside (no behaviour change)

- Retire unused components after confirming 0 importers:
  - `PatientEncounters`, `VitalSignsRecords`, `ProgressNoteModal`, the unused risk-assessment and procedure forms,
  - `trendAnalytics` (replaced by the governed EWS).
- Consolidate:
  - one admission page (keep `AdmissionDischargePage`; route `/admissions` to it after a field comparison),
  - one Caprini, one Braden, one drug catalogue (keep `bnfDrugDatabase` and record its edition),
  - one audit service.
- Move the root `*_SUMMARY.md` files into `docs/archive/`.

## Effort guide (indicative, one developer with clinician input)

| Phase | Rough size |
|---|---|
| 0 Safety fixes | 1–2 weeks |
| 1 Foundations | 3–4 weeks |
| 2 Encounters and signing | 3 weeks |
| 3 Clerking and examination | 5–7 weeks (template content review is the long pole) |
| 4 Decision support | 3–4 weeks |
| 5 Ward rounds and EWS | 4 weeks |
| 6 Postoperative monitoring | 5–6 weeks (protocol content from D3) |
| 7 Research and reporting | 2–3 weeks |
| 8–9 Validation and deployment | 2–3 weeks plus UAT time |

These estimates assume the decisions D1–D7 arrive when needed; clinical content review typically takes longer than the coding.
