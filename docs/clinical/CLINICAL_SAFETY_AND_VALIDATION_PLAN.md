# Clinical Safety and Validation Plan

**Scope:** the structured clerking, ward-round, postoperative monitoring and decision-support work described in `CLINICAL_IMPLEMENTATION_PLAN.md`.

**Approach:** hazard-based, in the spirit of DCB0129/DCB0160, ISO 14971 and IEC 62304 practice. Adapt it to UNTH clinical governance and the Nigeria Data Protection Act 2023.

The application is **clinician-support software**. It does not diagnose, order or treat on its own.

---

## 1. Roles

| Role | Responsibility |
|---|---|
| Clinical safety lead (named consultant, decision D1) | Approves templates, rules, monitoring profiles and terminology releases; signs off each phase's hazard review. |
| Engineering lead | Maintains the hazard log, test evidence and release notes; makes sure no rule goes live unapproved. |
| Unit representatives (HO, registrar, SR, nursing) | Take part in UAT; report incidents. |
| Data protection contact | Approves external AI use (decision D5) and research exports (decision D7). |

## 2. Safety rules the software must enforce

1. **Missing is never normal.**
   - Findings are present / absent / not assessed / unable / unknown.
   - "Absent" needs an explicit selection, and opening a section records nothing.
   - Narratives say "not documented" for missing data.
   - Risk scores are withheld when items are missing, and the missing items are listed.
2. **Undocumented allergy status is not "no known allergies".** NKDA is an explicit, attributed statement.
3. **Entered values are never altered.**
   - Implausible values are flagged and must be confirmed.
   - Impossible values are rejected with the typed value kept for correction.
   - Units are explicit.
4. **Prescribed is not given.** Administration is a separate, attributed record with an explicit state.
5. **Suggestions are not decisions.**
   - AI or rule suggestions (differentials, investigations, plans, narratives) are stored as recommendations and visibly labelled.
   - They change the record only through a clinician's accept or edit.
   - Nothing is ordered automatically.
6. **Green needs evidence.**
   - Green only when every required parameter is present and within its freshness window.
   - Otherwise "insufficient data / review required".
   - An acknowledged alert never suppresses a new red trigger.
7. **Every alert is explainable:**
   - the rule and its version,
   - the triggering values with timestamps and sources,
   - the threshold,
   - the suggested action and escalation pathway,
   - the responsible team,
   - the acknowledgement and resolution trail.
8. **Rules are approved content.**
   - Thresholds, monitoring profiles and risk tools live in `clinical_rulesets` with a source citation, version, approval status and content hash.
   - Unapproved rules run in **shadow mode**: computed and logged, never shown as alerts.
   - The existing `scripts/clinicalContentHash.mjs` mechanism is extended to rulesets and templates, and CI fails if approved content changes without re-approval.
9. **Signed records are immutable.**
   - A change creates a new version, requiring a reason and an authorised role.
   - Deletion is replaced by "entered in error".
   - Attribution comes from the server session only.
10. **AI never fabricates offline.** If the service is unavailable, the UI says so; no placeholder content is generated.
11. **Patient data leaves the hospital only when authorised.**
   - External AI is off by default (`AI_EXTERNAL_PROCESSING=false`) until D5 is decided.
   - When it is enabled, inputs are de-identified (no name, hospital number, phone, address or exact dates), and every call is audited with the model and version.
   - No API keys in the browser.

## 3. Hazard log (initial)

Severity and likelihood are rated 1–5. Residual ratings are targets, to be confirmed at review.

| ID | Hazard | Cause (from audit) | Controls | Sev | L (now) | L (after) |
|---|---|---|---|---|---|---|
| H1 | Allergic drug given | Registration drops allergies (S1); missing allergies read as "none" (S2); substring-only allergy check | Phase 0 fix; coded `allergy_intolerances` + explicit status; prescribing check against coded allergens | 5 | 4 | 1 |
| H2 | Deterioration missed | No production early warning; ward-round placeholders mask missing data (S4); fields lost on save (S3) | Phase 0 fixes; governed EWS with insufficient-data state; overdue-observation amber; vitals trends | 5 | 4 | 2 |
| H3 | False reassurance from a green status | Green when no complication recorded | Rule 6; tests in §5.3 | 4 | — (new) | 1 |
| H4 | Wrong patient documentation | Duplicate patients (S10); fuzzy sync merge | Duplicate check; server-only hospital numbers; client UUIDs; remove fuzzy merge for new tables | 5 | 3 | 1 |
| H5 | Record altered or deleted without trace | Hard DELETE (S5); spoofable audit (S6); last-write-wins sync | Soft delete; server audit; versions and conflict screen | 4 | 4 | 1 |
| H6 | AI suggestion taken as fact | Unlabelled AI output; AI written directly to records (wound measurement) | Rule 5; recommendation records; visible labels; accept/edit step | 4 | 3 | 1 |
| H7 | Confidential data disclosed | Identifiers sent to OpenAI/Google; browser-side keys (S9); plaintext IndexedDB; identifiable CSV export | Rule 11; remove client keys; de-identification; audited exports; review local encryption | 4 | 4 | 2 |
| H8 | Alert fatigue causing missed red alerts | Too many low-value alerts | Severity tiers, dedupe keys, reassessment intervals, shadow-mode tuning before go-live | 4 | — | 2 |
| H9 | Wrong dose suggested | Generated doses without weight or renal data | No patient-specific dose without a validated method and inputs | 5 | 2 | 1 |
| H10 | Wrong monitoring for the procedure | One-size-fits-all frequency | Procedure-specific approved profiles; clinician-approved plan per patient | 4 | — | 2 |
| H11 | Score computed from incomplete data | Default-filled Braden (S8); EWS scoring missing items as 0 | Withhold score when items are missing; list them | 4 | 4 | 1 |
| H12 | Offline edits lost or overwritten | Second SW queue drops 4xx; dead-letter never replayed | Single queue for new endpoints; conflict detection; dead-letter review screen | 4 | 3 | 2 |

The hazard log lives in this file and is reviewed at the end of every phase.

## 4. Clinical content governance

- **Each template, ruleset or terminology release records:** ID, version, author, source citations (guideline, year, section), approval status, approver, date and content hash.
- **Approval workflow:** draft → pending local review (shadow) → approved → retired.
- **Change control:** a change to approved content creates a new version and returns to pending.
- **External standards** that may be cited once the unit adopts them (decision D2/D3):
  - NEWS2 (Royal College of Physicians, 2017),
  - Caprini (2005 version),
  - Braden,
  - MUST (BAPEN),
  - Lund–Browder,
  - Parkland formula,
  - Vancouver Scar Scale, POSAS.
- **Recorded, not used:** institution-specific free-flap and graft monitoring frequencies have no single universal standard. They come from the unit's approved protocols (D3).

## 5. Verification (automated)

### 5.1 Suites

| Area | What is tested |
|---|---|
| Encounter linkage | Encounter ↔ patient ↔ admission ↔ surgery; cannot sign without a patient; unit carried through |
| Tri-state findings | No auto-normal; narrative wording for each state; "absent" requires a selection |
| Validation | Units, plausibility (confirm), impossibility (reject), original value preserved |
| Terminology | Synonyms ("SOB", "breathlessness" → dyspnoea concept); typo tolerance; ambiguous abbreviations never auto-resolved; concept ID stored with display text |
| Narrative and summary | Generated only from documented data; source labels; missing data stated; snapshot tests |
| Decision support | Suggestions never write to problems, orders or plans; accept/edit/reject recorded; offline "unavailable" |
| EWS and alerts | Each parameter band; single-parameter trigger; missing → insufficient data; stale → review required; dedupe; acknowledgement does not suppress a new red |
| Postoperative monitoring | Profile → plan; overdue → amber; flap red triggers per approved profile |
| Medications | All administration states; overdue critical dose; allergy conflict |
| Risk tools | Each item; incomplete → no score; append-only history |
| Permissions | Server-side role checks on sign, amend, approve and export; route access tests extended |
| Audit | Server attribution; immutable; every clinical write and AI call logged |
| Offline and sync | Draft persistence across reload; idempotent replay; version conflict → resolution, not overwrite; failed sync keeps data |
| Migrations | Up/down on a production-like copy; row counts preserved; type-cast failures reported, not dropped |
| Regression | Existing 1,089 tests stay green; new e2e journeys (register → clerk → sign → ward round → post-op) |

### 5.2 Synthetic scenarios (no real patient data)

1. Stable post-split-thickness-graft patient, complete observations → green.
2. Same patient with no observations for 8 hours → insufficient data / overdue amber, **not** green.
3. Progressive tachycardia and hypotension after flap surgery → red via the approved rule, with explanation and escalation.
4. Free-flap venous congestion pattern on the flap chart → red per the approved profile.
5. Postoperative bleeding: rising drain output (per-drain), falling haemoglobin → amber, then red.
6. Wound infection concern: fever plus wound erythema and discharge → amber; investigation suggestions offered, not ordered.
7. Burns patient: fluid balance below target urine output → amber per the approved burns profile.
8. Patient with a documented penicillin allergy prescribed co-amoxiclav → hard warning.
9. Allergy status never asked → prescribing shows "allergy status not documented".
10. Two devices edit the same draft offline → conflict screen; both versions retained.
11. Out-of-range entry (SpO₂ 60%) → accepted after confirmation, flagged, unchanged.
12. Impossible entry (SpO₂ 160%) → rejected; draft keeps the typed value.

### 5.3 Alert performance

- **False negatives:** every red scenario above must alert.
- **False positives:** a replayed set of stable synthetic patients must not raise red alerts. The amber rate is reviewed in shadow mode before go-live.
- **Shadow mode:** at least 2 weeks per approved ruleset on live data before alerts are shown. Shadow alerts are compared with clinician-recorded events and reviewed by the safety lead.

## 6. Validation (clinical)

**User acceptance checklist, run per phase with at least one consultant, one registrar, one HO and one nurse:**

- [ ] Clerking follows the expected sequence and can be completed faster than or equal to the current free-text note for a typical case.
- [ ] No section records anything the clinician did not enter.
- [ ] The narrative reads correctly and never states an unassessed finding as normal.
- [ ] Synonyms and abbreviations find the intended term; ambiguous ones ask.
- [ ] Signing, countersigning and amendment behave as decided under D6; the amendment history is visible.
- [ ] Suggestions are clearly labelled, editable and never applied without a decision.
- [ ] Ward round shows the previous review, trends and per-problem progress correctly for test patients.
- [ ] Red, amber, green and insufficient-data statuses match the clinicians' judgement in all scenarios in §5.2.
- [ ] Postoperative plans match the unit's approved protocols.
- [ ] Medication administration states are correct; omissions are visible.
- [ ] Works on the ward's actual devices (phones and tablets) and on poor connectivity.
- [ ] Offline drafts survive closing the browser and sync later without loss.

## 7. Deployment and rollback

1. **Before release:**
   - back up the database (Supabase point-in-time or `pg_dump`),
   - run migrations on a restored copy,
   - run the suites,
   - record the evidence in the release notes.
2. **Release:**
   - apply migrations (up),
   - deploy with feature flags off,
   - enable per unit after UAT.
3. **Rollback:**
   - turn the feature flag off (immediate),
   - redeploy the previous build,
   - run down migrations only if a schema change is the cause. Down migrations never delete clinical rows created since release; they are preserved and reported.
4. **After release:**
   - monitor errors, sync dead-letters and alert volumes daily for two weeks,
   - incident reports go to the clinical safety lead.

## 8. Known limitations (as of the audit)

- **Live schema not inspected:** it may differ from `api/init-db.js` due to request-time DDL. A schema dump is needed before the Phase 1 migrations.
- **No CI yet:** tests run only when someone runs them.
- **Plaintext offline data:** offline clinical data in IndexedDB is not encrypted at rest. Device-level protection (screen lock, managed devices) is currently the main control.
- **No clinical content approved locally yet:** the clinician-assistant engine and oncology modules are `pending_local_review`.
- **Monitoring protocols, EWS choice and terminology licensing** (D2–D4) are not decided.
