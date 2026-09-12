# Scar & Keloid Longitudinal Monitoring — architecture and integration

## Phase 1 — what already exists

| Brief asks for | Already in this repository |
|---|---|
| §6 standardized photography | `GraftCaptureFlow` — live camera, alignment guide, live quality meter, native-camera fallback |
| §7 image-quality gate | `woundImageQuality.ts` — focus, exposure, glare, contrast, resolution; `blocking` vs `warning` |
| §8 **reference marker + calibration** | `aiWoundMeasurement.detectCalibration()` (green marker, grid, ruler ticks) **and** `RegionTracer`'s guided manual calibration — drag along the marker, give its length. §3 says reuse this, and this module does. |
| §10–12 segmentation + correction | `aiWoundMeasurement` segmentation; `RegionTracer` for tracing; `ai_contour_cm` / `clinician_contour_cm` / `correction_reason` kept side by side |
| §11 manual trace fallback | `RegionTracer` — layered tracing, pinch-zoom, undo, per-patch delete |
| §13 2D morphometry | `woundContourGeometry.ts` — shoelace area, perimeter, rotating-caliper length/width |
| §30 **treatment tracking** | `keloid_care_plans` + `keloid_injections` + `keloid_pretreatment_tests` — triamcinolone series, surgery, silicone, compression, radiotherapy |
| §48 model versioning | `model_name`, `model_version`, `preprocessing_version`, `image_quality_score` on every assessment |
| §63 source immutability | `wound_images` keeps the original; overlays are separate derivatives |
| §64–66 security, roles, audit | `_lib/auth.js`, `_lib/roles.js`, `audit_logs` |

## The integration decision

**A scar is a `wounds` row**, exactly as a graft site is. That single decision
inherits photography, the quality gate, calibration, segmentation, tracing,
overlay rendering, clinician correction, provenance columns and cross-device
image storage — none of it rebuilt, none of it duplicated.

```
patients
  └── keloid_care_plans            (existing: treatment plan, injections)
  └── scar_cases                   (new: one lesion, its own trajectory)
        ├── wound_id ───────────→  wounds / wound_assessments
        │                          photographs, calibration, traced areas
        ├── scar_assessments       one per visit, links a wound_assessment
        │     ├── scar_validated_scores   VSS · POSAS · DKS, kept independent
        │     ├── scar_physical_exams     pliability, mobility, contracture
        │     ├── scar_patient_reported   pain, itch, tightness, QoL
        │     └── scar_colour_analysis    CIELAB vs adjacent normal skin
        ├── scar_predictions
        └── scar_alerts
```

`scar_cases.keloid_plan_id` links to the existing plan, so treatment history
comes from `keloid_injections` rather than a second treatment table (§30, and
the no-duplicate-infrastructure rule).

## What is honestly deliverable, and what is not

### Delivered, and genuinely computed

- **Calibrated 2D morphometry** (§13) — area, perimeter, length, width, and the
  shape metrics, from the traced boundary. Correctness is geometric.
- **Original wound vs current scar** (§14) — extension area and percentage,
  from two stored boundaries. Never invented; requires both to exist.
- **CIELAB colour analysis** (§15–17) — erythema and pigmentation indices and
  ΔE, each computed **against adjacent normal skin traced on the same
  photograph**, which is what makes it meaningful across skin tones (§61).
- **Validated scales** (§27) — VSS, POSAS observer and patient, DKS, each with
  its real items, ranges and scoring, kept independent and never merged. Each
  item declares whether it is image-derived, examination or patient-reported.
- **Longitudinal engine** (§31–34) — change, % change, rate, acceleration,
  per-domain trend classification.
- **Multimodal consistency and discordance** (§35–36).
- **Prediction** (§39–45) — transparent trajectory extrapolation with
  eligibility gates, refusing rather than guessing.

### Deliberately NOT delivered as measurements

**AI scar classification (§5) and AI segmentation of scar subtypes (§10).**
No validated model exists — see `docs/TISSUE_MODEL_EVIDENCE.md`, which records
the September 2026 search. The `ComputerVisionProvider` seam is already built;
until a model is registered, classification is the clinician's and the tracer
is the measurement path. §58 calls this a legitimate quantitative method, not
an error state, and §59 is explicit: the human identifies the region, the
software does the mathematics.

**3D reconstruction (§19–24).** Multi-view photogrammetry needs structure-from-
motion and dense stereo. There is no client-side library that does this
reliably, and the serverless functions here are capped at 30 s and 1 GB — far
below what COLMAP-class reconstruction needs. Sending clinical photographs to
an external reconstruction service is a governance decision, not an engineering
one (§64).

So the 3D **data model, capture-sequence guidance, quality gate and provider
seam** are built, and every 3D measurement reports `not reliably measurable`
until a reconstruction backend is configured. §23 requires exactly this: *"If
3D reconstruction fails: DO NOT fabricate 3D measurements… Never substitute
zero."*

This is the §88 principle applied honestly: automate what can be reliably
automated, assist where AI is uncertain, fabricate nothing.
