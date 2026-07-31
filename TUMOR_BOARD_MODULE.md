# Tumour Board Module

Multidisciplinary oncology assessment, staging, multimodality planning, referral
generation, surveillance and patient counselling for **soft tissue malignancy**
and **all skin cancers** (melanoma and non-melanoma).

Route: `/tumor-board` · API: `api/tumor-board.js` · Schema: `add-tumor-board-tables.sql`

## Clinical scope

| Tumour family | Staging | Notes |
|---|---|---|
| Cutaneous melanoma | AJCC 8th, Ch. 47 | Breslow + ulceration; full N sub-categories incl. in-transit |
| Cutaneous SCC | AJCC 8th, Ch. 15 | Validated for head & neck; flagged as such |
| Basal cell carcinoma | AJCC 8th, Ch. 15 | Flagged — managed primarily by NCCN risk stratification |
| Merkel cell carcinoma | AJCC 8th, Ch. 46 | IIIA/IIIB split on occult vs clinically detected nodes |
| Soft tissue sarcoma | AJCC 8th, Ch. 39-41 | Trunk/extremity, retroperitoneal, head & neck, visceral |

### Guideline currency

Checked **July 2026**. AJCC Version 9 has rolled out for brain/spinal cord,
cervix, neuroendocrine tumours, lung, thymus and several head & neck sites.
**All five families above remain 8th edition.** Each assessment stores its own
`staging_system`, so a future edition can be adopted site-by-site without
invalidating historical staging or requiring a migration.

Treatment logic encodes NCCN and ESMO guidance plus the practice-changing
trials, notably:

- **NADINA / SWOG S1801** — neoadjuvant ipilimumab + nivolumab now *precedes*
  dissection for macroscopic stage III melanoma, reversing surgery-first.
- **MSLT-II / DeCOG-SLT** — nodal ultrasound surveillance replaces completion
  dissection after a positive sentinel node.
- **KEYNOTE-716 / CheckMate 76K** — adjuvant anti-PD-1 in resected IIB/IIC.
- **STRASS** — preoperative radiotherapy is *not* routine in retroperitoneal sarcoma.

## Architecture

Clinical logic is **pure and client-side**, in `src/services/oncology/`:

| File | Responsibility |
|---|---|
| `stagingEngine.ts` | AJCC TNM + stage groups, with caveats |
| `managementPlan.ts` | Sequenced multimodality plan, graded required/recommend/consider |
| `referralLetters.ts` | One letter per involved specialty, generated from the ratified plan |
| `surveillance.ts` | Dated follow-up schedule per site and stage |
| `counselling.ts` | Patient- and family-facing document in plain language |

This placement is deliberate: it is unit-testable without a database, and it
**runs unchanged offline**, which is the point on a ward. `api/tumor-board.js`
persists the output and serves aggregates; it computes no clinical logic.

**71 unit tests** cover the clinical logic (`src/test/oncologyStaging.test.ts`,
`src/test/oncologyPlan.test.ts`) — boundary thresholds, guideline-reversal
ordering, and the plain-language constraints on patient documents.

## Versioned assessments

`tumor_board_assessments` is **append-only**. A case is typically staged
clinically, re-staged when histology lands, and re-staged again after
neoadjuvant therapy. Overwriting would destroy the record of what was known when
a decision was taken — which is precisely what a tumour board record exists to
preserve. Version numbers are assigned **server-side**, so two clinicians
assessing offline cannot collide.

Add a new assessment via the case view; the previous versions stay visible in
the timeline and in the exported board summary.

## Outputs (all exportable as PDF)

1. **Board summary** — staging timeline, plan with provenance, caveats
2. **Referral letters** — per specialty, urgency-flagged, with the full plan for context
3. **Surveillance schedule** — dated, phased, tracked to completion
4. **Patient information** — plain language, larger type, red-flag box

## Safety design

- Every plan is a **draft for the board to ratify**, stated on the plan and in
  every export. Only a consultant role can mark a plan ratified.
- Every recommendation carries its **guideline provenance** so the board checks
  reasoning rather than trusting output.
- Missing data produces **caveats, not guesses** — absent Breslow gives `TX`, not
  an assumed thickness; absent FNCLCC grade says the stage assumes low grade.
- Where AJCC publishes **no stage grouping** (head & neck and visceral sarcoma),
  the module says so rather than inventing one.
- The counselling document avoids TNM notation entirely and is enforced by test.

## Offline support

Fully offline-capable, consistent with the rest of the app:

- Dexie v38 adds `tumor_board_cases` and `tumor_board_assessments`
- `apiClient` maps `tumor-board` → `tumor_board_cases`
- The cache warmer fetches the board aggregate, 90 days of surveillance, and
  per-patient cases
- The board list rebuilds its aggregate from local data when the network is down

## Setup

```bash
psql "$DATABASE_URL" -f add-tumor-board-tables.sql
```

The API also creates its tables lazily on first use, so this is optional —
it just avoids a cold-start penalty on the first request.
