# Clinical Documentation Audit — Plastic Surgeon Assistant

**Repository:** `astrobsm/UNTH-PLASTICSURGASSIST` at commit `4db55de` (main)
**Audit date:** 2026-10-14
**Scope:** the 13 audit areas in the Master Implementation Prompt §2, to plan structured surgical clerking, ward rounds, postoperative monitoring and clinical decision support.

## How this audit was done

- Code was read directly, using three parallel read-only sweeps (platform, clinical documentation, decision support/terminology) followed by direct verification of the highest-impact claims.
- **[V]** = verified by reading the code. **[I]** = inferred, not proven; treat as a lead to confirm.
- **Not done:** no tests were run for this audit, the live database was not queried, and the deployed app was not exercised. The live schema may differ from `api/init-db.js`, because many handlers create or alter tables at request time (§3).
- **Last full test run:** the suite last ran green on 2026-10-01 (1,089 tests, 64 files) as part of the unit/consult work. That run covers mainly wounds, scars, grafts, sync payloads, scoring and access rules, not the clinical documentation paths audited here.

---

## Executive summary

The application has a broad, offline-capable PWA with many specialist modules. Several of them are well engineered:

- wounds, scars and keloids (`api/_lib/scarScales.js` handles missing items correctly),
- skin-graft take tracking,
- burns (Lund–Browder, Parkland, Baux, ABSI),
- a governed rule engine in `src/services/clinicianAssistant/`.

**Core clinical documentation is the weak point.** Encounters, admissions, ward rounds, vital signs, medications and risk scores are mostly free text. Missing data is routinely recorded as a normal finding, notes are unsigned and can be hard-deleted, and several workflows lose data on save. The system cannot yet tell *absent* from *not assessed* from *unknown* except in the scar module.

### Safety-relevant defects found (fix before building new features)

| # | Finding | Evidence | Status |
|---|---|---|---|
| S1 | Registration discards allergies: they are overwritten with an always-empty array, so new patients are saved with no allergy record. | `src/components/PatientRegistrationForm.tsx:2341` (overwrite); `:42`, `:124` (initialised `[]`); risk flow disabled at `:2383` | [V] |
| S2 | An empty allergy field is rendered to the AI as "None known". Undocumented is treated as "no known allergies". | `src/services/unthPatientService.ts:626` | from audit sweep |
| S3 | The ward-round form drops fields on save: pain score, sleep, appetite, bowels, drain output, mobility, medication stop/continue lists, nursing and activity orders, and "consultant notified". | `WardRoundForm.tsx` (fields present) vs `src/db/wardRoundPayload.ts`, `wardRoundsService.ts` (`pain_score` absent) | [V] for pain score; rest from sweep |
| S4 | Ward rounds save placeholder text ("No complaints", "No specific findings", "Continue current management") when fields are left empty, so missing data reads as a negative finding. | `WardRoundForm.tsx:338-360` | from sweep |
| S5 | Clinical records can be permanently deleted with no amendment trail. | `api/ward-rounds.js:456`, `api/progress-notes.js:202` (no owner/role check), `api/vital-signs.js:78`, `api/prescriptions.js:245` | [V] |
| S6 | Audit-log attribution is spoofable: POST takes `user_id` and `user_name` from the request body. Clinical write handlers do not write server-side audit rows. | `api/audit-logs.js:111-127` | [V] |
| S7 | The burn follow-up Vancouver Scar Scale is hard-coded to "defaults for demo" values. | `src/components/burnCare/BurnFollowUpAssessment.tsx:308` | [V] |
| S8 | Risk scores (Braden) default to plausible values, so an unassessed item looks scored. Risk assessments are upserted (one row per patient and type), so history is overwritten. | `PressureSorePage.tsx`, `api/risk-assessments.js:110-148` | from sweep |
| S9 | An OpenAI key can reach the browser: `VITE_OPENAI_API_KEY` is read client-side, and an `openai_api_key` is kept in localStorage. Patient identifiers (name, hospital number, ward, diagnosis) are sent to OpenAI by OCR and scribe paths, with no consent gate or data-processing flag. | `src/services/clinicalNotesExtraction.ts:388`; `api/ocr/scan.js` (patientContext); `AISettingsPanel.tsx` | [V] key path; data flows from sweep |
| S10 | Patient registration hides duplicates: an API error, including a 409 duplicate hospital number, is swallowed and the patient is saved locally as unsynced. The client generates hospital numbers as `UNTH/{year}/{4 random digits}`, which will collide. | `unthPatientService.ts:595-599`, `:865-869` | from sweep |

None of these needs new architecture. They are small, contained fixes and form **Phase 0** of the implementation plan.

---

## 1. Frontend

- **Stack** [V]: React 18.2, react-router 6.18, Vite 4.5, TypeScript 5.9, Tailwind 3.3, vite-plugin-pwa 0.17, Dexie 3.2, zustand 4.4, React Query 5, react-hook-form 7.48. No schema validation library (zod/yup/joi).
- **Routing** [V]: 86 lazy-loaded routes in three trees (signed-out, student, staff), `src/App.tsx`.
  - Only 6 routes are role-guarded (`ProtectedRoute`), and the guard runs on the client.
  - `src/config/routeAccess.ts` states that any unlisted path is open to every signed-in user, so every clinical screen is open to every staff role.
- **Design system** [V]: Tailwind with custom palettes (`tailwind.config.js`). No shared UI component library; `src/components/` has ~99 feature components.
- **Autocomplete** [V]: `MedicalAutocompleteTextarea.tsx` (word-level prefix suggestions from a ~668-term trie in `medicalDictionaryService.ts`) and `MedicalTextInput.tsx` (adds speech, OCR, AI). **There is no generic searchable select/combobox.** That is the main UI gap for structured clerking.
- **Type safety** [V]: `strict: false`, `noImplicitAny: false`, `strictNullChecks: false`. `npm run build` skips `tsc`. ESLint allows 2,740 warnings.

## 2. Backend and service layer

- **Layout** [V]: Vercel serverless, about 117 handlers in `api/`. Mostly one file per resource, with sub-paths dispatched inside the handler via `vercel.json` rewrites. Shared code lives in `api/_lib/` (35 modules).
- **Validation** [V]: hand-written per handler, no schema library. The generic sync push filters columns against `information_schema` and fails open (`api/sync/index.js:7-23`).
- **Errors** [V]: about 78 handlers return `error.message` in 500 responses, so internal details leak to clients.
- **Idempotency** [V]: `api/_lib/idempotency.js` (24h cache on user + key) is used by 9 handlers. Vital signs and wounds are among those not covered.
- **Rate limiting**: none on general handlers [V].
- **Dead code** [V]: `server/` (legacy Express) is excluded from deployment and imported nowhere, but `src/services/aiService.ts` still calls its `/api/ai/chat` route. That route does not exist in `api/` or `vercel.json`, so preoperative summary, patient summary and lab interpretation AI calls fail in production and fall back to rules [V route absence; fallback behaviour I].
- **Broken route** [V]: Analytics calls `/api/analytics/*`, which does not exist, so the Analytics page cannot load data.

## 3. Database and migrations

- **Engine** [V]: PostgreSQL (Supabase pooler).
- **Schema source** [V]: `api/init-db.js` (2,504 lines of `CREATE TABLE IF NOT EXISTS` plus ALTERs), triggered over HTTP behind a secret.
- **Competing schema sources** [V]:
  - root `add-*.sql` files (applied by `scripts/apply-migration.mjs`, with checksums in `schema_migrations`),
  - `database/migrations/010–020` (applied ad hoc; no runner found for 012–020),
  - legacy `server/db/schema.sql`,
  - `migrate-*.mjs` scripts.
  - **No down/rollback migrations exist.**
- **Runtime DDL** [V]: 54 of 117 handlers and 9 `_lib` modules create or alter tables at request time. This includes tables I added in the October 2026 unit/consult work: `call_duty_unit_config`, `unit_membership_state`, `ho_morning_round_days`, and the new `received_consults` and `ward_rounds` columns.
- **`patient_id` type drift** [V]: `patients.id` is SERIAL.
  - Child tables vary between `INTEGER` FK, `VARCHAR(100)` and `TEXT`.
  - Runtime handlers redeclare `prescriptions`, `ward_rounds` and `discharge_summaries` with `VARCHAR` where init-db uses `INTEGER`. Which type is live depends on which code ran first [I].
  - Offline-registered patients get UUIDs locally [from sweep].
- **Diagnoses are free text everywhere** [V]: `patients.primary_diagnosis TEXT`, `secondary_diagnoses JSONB`, `admitting_/discharge_diagnosis`, `surgeries.diagnosis`.

## 4. Patient registration and identification

- **Files**: `PatientRegistrationForm.tsx`, `unthPatientService.ts`, `api/patients/index.js`, `api/patients/[id].js`.
- **Step 1 only**: only step 1 of the form is rendered: identifiers, names, DOB, sex (male/female only), marital status, phone, in/outpatient, ward, bed.
  - Next of kin, genotype, social and family history exist in the interface but are not collected.
- **Allergies and comorbidities**: lost at registration (S1). Allergies are stored as a comma-joined string; there is no reaction, severity or certainty, and no NKDA flag.
- **Identification**: `hospital_number` is unique in the database, and the API returns 409 on a duplicate.
  - Client-side numbering collides, and the 409 is swallowed (S10).
  - No hospital-number normalisation [I], and no fuzzy duplicate detection (search is `ILIKE`).
  - Name history is kept (`patient_name_history`).

## 5. Encounters and clinical documentation

- **What is in use**: `EncountersTab` inside `src/pages/PatientProfile.tsx:907-1300`, a single free-text textarea saved to `progress_notes` as `{note, type}`.
  - Six encounter types, as labels only. Headings are guessed by regex at display time.
  - No draft/signed status (`status` defaults to `'active'`), no amendment trail, and DELETE has no role check (S5).
- **Unused components** [V: 0 importers]: `components/patient/PatientEncounters.tsx` (would send attachments the API has no column for), `VitalSignsRecords.tsx`, `ProgressNoteModal.tsx`, the three `riskAssessments/*` forms, and four `procedures/*` forms.
  - `procedureService.create*` methods persist nothing [sweep].
- **Structured clerking exists only for students**: `student_clerkings` holds history, ROS JSONB, examination JSONB, provisional and differential diagnoses, and draft status (`api/init-db.js:1869`, `api/students.js`). This is the nearest existing pattern to reuse.
- **Not captured anywhere**: structured history (PC/HPC dimensions, systems review, PMH/PSH, family/social), obstetric history beyond an `lmp` field, or structured examination.

## 6. Admissions and discharge

- **Two admission pages, both routed**: `AdmissionsPage.tsx` (`admissionService`) and `AdmissionDischargePage.tsx` (`admissionDischargeService`). They collect different history fields.
  - Registration also auto-admits.
  - The server does not check for an existing active admission before inserting, so duplicate admissions are possible [sweep; `api/admissions.js` has no such check on create].
- **Admitting unit**: added October 2026 (`assigned_unit`, normalised to `PS-UNIT-1` / `PS-UNIT-2`).
- **Discharge summaries** (`api/discharge-summaries.js`) have the only real sign-off workflow: draft → pending approval → approved → finalized, with reject and an amendments column.
  - **This is the template for encounter signing.**

## 7. Ward rounds, progress and follow-up

- **Files**: `WardRounds.tsx`, `WardRoundForm.tsx` (2,193 lines), `wardRoundsService.ts`, `wardRoundPayload.ts`, `api/ward-rounds.js`.
- **Captured**:
  - round type, free-text complaint/notes/examination,
  - vitals with BP as a string,
  - progress status (improved / stable / deteriorating / critical),
  - medication and investigation lists,
  - plan text,
  - folder confirmation and documented-at for the 07:00–09:00 house officers' round (October 2026).
- **Defects**:
  - data loss on save (S3), placeholder negatives (S4),
  - everything is serialised into `findings TEXT`,
  - `admission_id` is never sent,
  - ward-round vitals go into JSON, not the `vital_signs` table,
  - previous-round prefill reads fields that are never persisted [I].
- **No problem list anywhere** in the codebase [sweep].
- **There are three parallel ward-round stores**: server `ward_rounds`, the Dexie `ward_rounds` (typed as the session-level scheduling type) and an orphan `ward_rounds_clinical`.

## 8. Vital signs and early warning

- **`api/vital-signs.js`**: temperature, pulse, BP, RR, SpO₂, weight.
  - Not recorded: consciousness (AVPU/GCS), supplemental oxygen, pain, urine output, units.
  - No server validation, and `x || null` turns a real 0 into null.
- **`medicalValidation.ts`**: has ranges, but they are applied only to OCR results, not manual entry.
- **`trendAnalytics.calculateEWS`** [V: 0 importers]: "NEWS2-inspired", missing consciousness and O₂, and scores missing parameters as 0.
  - It is dead code and must not be revived as-is.
  - **There is no deterioration alerting in production.**

## 9. Medications

- **Prescriptions**: free-text dose, frequency, route and duration.
- **Drug sources**: three overlapping ones (`bnfDrugDatabase.ts`, `bnfMedications.ts`, an inline list in `MedicationOrderingModal.tsx`). None carries an edition, source date or standard code.
- **Allergy check**: a substring match against the free-text allergy string, as a warning only.
- **There is no medication administration record**: no administered / omitted / withheld / refused tracking. Prescription is treated as treatment.

## 10. Investigations

- `lab_orders` (results JSONB), `lab-results` (a view of completed orders), `investigation_uploads` (file, OCR text, results).
- No coded test catalogue on the server [I]; the client catalogues use local abbreviations.
- Imaging exists only as an upload type.

## 11. Treatment plans

- The approval workflow exists (`api/treatment-plan-modifications.js`: pending / approved / rejected, with consultants auto-approved).
- **It can be bypassed**: `PUT /treatment-plans` has no role gate.
- There are five treatment-plan UI entry points.

## 12. Surgery and postoperative care

- **Surgeries**: `post_op_notes TEXT` only. No structured operative note, complications classification (e.g. Clavien–Dindo) or postoperative observation plan.
- **Preoperative assessment** is structured (ASA, Mallampati, organ systems, Caprini, Braden via `preoperativeService`).
- **Fluid balance**: input/output events with volume; a single generic `drain` type, with no per-drain identity.
- **Skin grafts**: structured take percentage by postoperative day (good).
- **Flap monitoring: none.**
- **Burns**: Lund–Browder TBSA, Parkland, Baux, ABSI (`burnCareService`). SCORTEN for SJS.

## 13. Risk assessment tools

- **Caprini**: three implementations with differing elements; some elements are missing [sweep].
- **Braden**: three implementations with different risk bands.
- **MUST**: one implementation.
- No falls tool. None of these is versioned or sourced, except within the governed clinician-assistant engine.

## 14. AI integrations and decision support

| Area | Finding |
|---|---|
| LLM calls | OpenAI is used for scribe, text enhancement, OCR structuring, wound measurement and clinical-notes extraction (browser). Cloud Vision and Document AI are used for OCR. |
| Logging | No prompt, output or model version is logged (`api/_lib/openai.js` logs nothing). Scribe records `gpt-4o-mini` while calling `gpt-4o` (`api/ai/scribe-process.js:131,182`) [V]. |
| Approval | OCR has a review step. The scribe has review → finalised. Wound measurement writes AI output straight to `wound_measurements` with no model column. |
| Broken AI | `/api/ai/chat` is absent (§2). The scribe client/server field-name mismatch means the AI output is never used [sweep]. |
| Rule engine | `src/services/clinicianAssistant/` covers labs, ECG, qSOFA, Caprini, CKD-EPI 2021, with sources listed in `clinicalProvenance.ts`. Engine version 1.0.0 is stored per analysis. Status is `pending_local_review`, and a banner says so. **This is the governance model to extend.** |
| Ungoverned rules | qSOFA, eGFR, Parkland, Caprini and Braden are duplicated in UI files with hard-coded thresholds. |
| Content governance | `scripts/clinicalContentHash.mjs` hashes the oncology and clinician-assistant modules only. It cannot fail while they are unratified, and no CI runs it. |

## 15. Terminology

- No SNOMED CT, ICD-10/11, LOINC or medication terminology. Stored records keep display text only.
- The only dictionary is the ~668-term autocomplete trie: no synonyms, no abbreviations, no typo tolerance, no concept IDs.

## 16. Alerts and escalation

- **Push notifications** (`api/_lib/notify.js`) are used for consults, pre-surgical briefs and broadcasts only, with no acknowledgement tracking.
- **Acknowledgement exists** for consults (`acknowledged_by/at`) and HO acknowledgements.
- **No clinical deterioration alerts, no red/amber/green status** outside individual calculators.

## 17. Authentication, RBAC and audit

- **Authentication**: JWT HS256, 30-day expiry, with a revocation cutoff (`api/_lib/session.js`).
- **`requireRole`** is defined but used by **0** handlers [V]. Role checks are inline in roughly half the handlers.
- **Audit logging**: written mostly by the client, with spoofable attribution (S6). The audit table is also writable through the generic sync push.
- **Signing**: discharge summaries only.

## 18. Offline and synchronisation

- **Client queue** (`src/db/syncService.ts`):
  - stable idempotency keys,
  - 5 retries, no backoff,
  - dead-letter after 5 failures or 30 days; dead-letter items are never replayed automatically.
- **Server sync** (`api/sync/index.js`):
  - deduplicates on `sync_key`,
  - falls back to a fuzzy patient + date match, which can merge two genuine same-day records [I],
  - **last write wins, with no version or conflict detection.**
- **Service worker** (`src/sw.ts`): a second, independent BackgroundSync queue that drops 4xx responses on replay with only a console warning.
- **Local data is plaintext** in IndexedDB and the API cache. `src/utils/encryption.ts` exists but is effectively unused. Logout clears caches.

## 19. Reporting, research and interoperability

- **Exports**:
  - referral analytics CSV (aggregate counts, no identifiers),
  - per-patient timeline CSV with full text and hospital number in the filename, no de-identification, no audit entry and unescaped cells (CSV formula-injection risk),
  - audit-log CSV, PDFs, PPTX.
- **No de-identification or pseudonymisation code.** No FHIR or HL7.
- **`xlsx` 0.18.5** is used for bulk import; that version line has published prototype-pollution/ReDoS advisories [I; check `npm audit`].

## 20. Tests and quality

- **Vitest**: 64 files, mostly wounds, scars, grafts, scoring and sync payloads. No tests for the admissions, prescriptions or progress-notes APIs.
- **Playwright**: one offline spec. **No CI.**
- **Type errors**: committed `tsc-output*.txt` files record 186 / 109 type errors from August. A fresh `tsc --noEmit -p tsconfig.json` (non-strict) was clean on 2026-10-01.

## 21. Duplicated or overlapping functionality

| Area | Duplicates |
|---|---|
| Admissions | `AdmissionsPage`, `AdmissionDischargePage`, `DischargesPage`; three admission services |
| Consults | `ConsultsModulePage` (native), `ConsultsPage` (external proxy) |
| Treatment plans | five UI entry points |
| Audit | `auditLoggingService`, `clinicalAuditService` |
| Offline | `offlineDataService`, `offlineManager`, `dataSyncService`, `syncService`, plus the SW queue |
| Drug catalogues | three; investigation catalogues: three |
| Risk scores | Caprini ×3, Braden ×3 |
| Ward rounds | three stores |

---

## What already works and should be preserved

- Wound, scar/keloid and skin-graft modules: structured fields, null-aware scoring, clinician approval on wound assessments.
- The governed clinician-assistant rule engine and its provenance pattern.
- Discharge summary sign-off workflow.
- Consult module with on-call routing, the review workflow and OCR attachments (October 2026).
- Unit call roster, rotation, admitting units, and the house officers' morning-round tracking (October 2026).
- Offline-first PWA with idempotent sync on the core resources.
