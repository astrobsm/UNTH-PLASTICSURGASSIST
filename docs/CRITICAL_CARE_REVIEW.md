# Critical care review

This is consultant-level decision support for ICU and ward patients. It produces critical alerts, calculations, an organ-system assessment, a medication review, a ranked differential and a prioritised plan. All of it is advice that a qualified clinician must verify before acting.

## Where it appears

| Place | What it does |
|---|---|
| **Patient profile → Encounters → 🫀 Critical care review** | Prefills from the record (patient, investigations, lab orders, vitals, active prescriptions). Saves as a `critical_care_review` encounter that is signed like any other encounter. |
| **Clinician Assistant → Critical care review tab** | Uses the selected patient, or a standalone case if none is selected. |
| **`/critical-care`** (sidebar: Critical Care Review) | A standalone case, for referral calls and consults. |

## Two layers

1. **Rule-based analysis** (`src/clinical/critical`). It runs on the device and updates live as the case is entered. It is always shown, and it is the reference for the calculations. It builds on the existing engines instead of duplicating them:
   - lab mapping and plausibility checks: `toAnalyte`;
   - findings and electrolyte replacement plans: `engine.analyse()`;
   - CKD-EPI 2021, Cockcroft–Gault, KDIGO creatinine staging, acid–base compensation, total body water: the engine modules;
   - anion gap, osmolality, P/F and A–a gradient: the engine's derived values;
   - qSOFA and MAP: `calculators.ts`; NEWS2: the templates; Parkland: `burnCareService`.

   New in this module:
   - the critical alerts, on the specification's thresholds;
   - dosing weight, Schwartz, and KDIGO urine-output staging with duration;
   - FENa/FEUrea, delta ratio, bicarbonate deficit, and Adrogué–Madias with infusion rates;
   - DKA/HHS criteria, shock index and S/F ratio;
   - SOFA (missing organs are listed, never assumed normal), CURB-65, Child–Pugh, MELD-Na, Holliday–Segar;
   - trends across serial values;
   - the medication review: class rules plus the app's BNF interaction data. It never states a dose from memory;
   - the differential, including Nigerian can't-miss diagnoses;
   - the plan, monitoring, escalation and resource-limited alternatives.
2. **Consultant AI review** (`api/critical-care.js`). It runs only on request. It uses the specification's Parts 1–4 verbatim as the system prompt (`api/_lib/criticalCarePrompt.js`, version `cc-1.0.0`):
   - the rule-based eGFR, CrCl, anion gap and delta ratio are sent as `app_calculations`, so the model recomputes them, and any disagreement is shown;
   - the output is coerced to the exact schema by `criticalCareNormalise.js`;
   - it is governed by the unit's external-AI switch (Clinical Governance D5), de-identified and audited;
   - the review is sized for the project's 30 s function limit (26 s timeout, 3,000-token answer). If the AI fails or times out, the rule-based report stands.

## Updating

- **Prompt.** Edit `criticalCarePrompt.js` and bump `CRITICAL_CARE_PROMPT_VERSION`. Saved reviews record the version they used.
- **Rules and thresholds.** Edit `src/clinical/critical/analyse.ts`, `calculations.ts` or `medications.ts`, and run `npx vitest run src/test/criticalCare*`. The worked cases are calculated by hand.
- **Drop-down catalogues.** Edit `src/clinical/critical/catalogue.ts`. Every category accepts "Other (specify)".
