# Photographic Skin Graft Monitoring Module

## Phase 1 — what is already here

This module is an **integration**, not a new application. The repository already
contains most of the photographic measurement pipeline the brief describes,
built for generic wounds. The work is to give it a graft-shaped domain model and
the analyses that are specific to grafts.

### Already built and reused unchanged

| Brief section | Existing implementation |
|---|---|
| §4 standardized photography | `woundMarkerPdfService.ts` — printable 5 cm / 10 cm fiducial markers, generated in mm-unit PDF so the length survives printing |
| §5 image quality assessment | `woundImageQuality.ts` — Laplacian-variance focus, exposure, glare, contrast, resolution; `blocking` vs `warning` severity |
| §6–§7 calibration + confidence | `aiWoundMeasurement.detectCalibration()` — green-marker detection by hue/aspect, grid and ruler-tick Hough fallback; emits `CalibrationEvidence` |
| §8 segmentation | HSV thresholding → morphology → connected components → Moore boundary trace |
| §9 area from segmentation | `woundContourGeometry.ts` — shoelace area, perimeter, rotating-caliper length/width |
| §12 §16 §60 overlays | `woundOverlayRenderer.ts` — margin, axes, scale bar, caption burned onto the stored image |
| §33 capture UI | `WoundProgressMonitorPage.tsx` capture → analyse → review → save |
| §34 image quality gate | `noWoundDetected` + blocking flags already refuse to produce a number |
| §37 clinician review | `ai_contour_cm` / `clinician_contour_cm` / `correction_reason` kept side by side |
| §44 image database | `wound_images` + `_lib/imageStorage.js` (postgres or Supabase driver), Dexie offline queue |
| §45–§46 reproducibility, versioning | `model_name`, `model_version`, `model_checksum`, `preprocessing_version`, `image_quality_score`, `image_quality_flags` on every assessment |
| §53 clinical safety | `TISSUE_MODEL_VALIDATED = false` — the colour classifier is forbidden from writing numbers into the record |

### Integration points

- **Patients** — `patients`; do not create another.
- **Surgery** — `surgeries` (has `patient_id`, `procedure_name`, `surgeon_id`, dates). A graft episode hangs off a surgery.
- **Wounds** — `wounds` + `wound_assessments`. A recipient site and a donor site are each *a wound*, so every existing measurement, overlay, quality gate and review flow applies to them for free.
- **Auth** — `_lib/auth.js` `authenticateRequest`; roles in `_lib/roles.js`.
- **Alerts** — `_lib/notify.js` `notifyUsers`.
- **Audit** — `audit_logs`.

## Phase 2 — the graft domain model

Three new tables. Everything else reuses `wounds` / `wound_assessments`.

```
surgeries
    └── skin_graft_episodes            one operation's grafting
            ├── graft_sites            recipient | donor, each -> wounds.id
            │       └── (assessments live in wound_assessments)
            ├── graft_site_analyses    the graft-specific numbers per assessment
            └── graft_alerts
```

`graft_sites.baseline_area_cm2` is written **once**, at the baseline assessment,
and is the permanent denominator for graft take (§15). A later photograph can
never redefine it.

## The honest position on automated viability and epithelialization

The brief asks for automated **graft viability %** (§14) and **donor-site
re-epithelialization %** (§19). Both require separating tissue *types* by
appearance, not measuring *extent*.

This repository already has that capability and deliberately refuses to use it:

> `TISSUE_MODEL_VALIDATED = false` — "`classifyTissue` assigns every wound pixel
> to one of four tissue types using six fixed hue/saturation/value cutoffs. That
> is not a trained classifier and it has never been validated against clinician
> ground truth."

Wiring graft take and epithelialization onto those cutoffs would produce
confident-looking percentages with nothing behind them, which §51 and §52
forbid. So the module splits the two kinds of number:

**Measured automatically, no manual entry** — these rest on calibration and
segmentation, whose correctness is geometric and testable:

- defect area, perimeter, length, width
- graft area, donor-site area
- **areal** graft take: current graft area ÷ preserved baseline graft area
- donor-site open area and its rate of change
- healing trajectory and predicted completion

**Routed through `ComputerVisionProvider`, and withheld until a validated model
is registered** — these need tissue classification:

- viable vs non-viable graft fraction
- epithelialized vs raw donor fraction

Until a real model is plugged in, the provider returns
`{ status: 'unavailable', reason: 'no validated tissue model registered' }`, the
UI shows §36's "Automated assessment uncertain" with the reason, and the
clinician adjudicates. The interface, storage, versioning, confidence plumbing,
review loop and training-pair capture are all built, so registering a model is
a configuration change rather than a rewrite.

This is the §38 distinction applied honestly: areal measurement is automatic and
manual entry is the exception; tissue proportion is *not yet* automatable here
and says so, rather than guessing.
