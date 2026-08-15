# Local wound dataset and validation protocol — UNTH

Version 1 · drafted 2026-08-15 · **not yet approved by the department or by an ethics committee**

This is the protocol for collecting the wound image dataset the AI measurement
module needs, and for the validation study that must precede any clinical claim.
Nothing in this document has been carried out yet.

---

## 1. Why local data is not optional

Every public wound dataset located during the Phase 0 review — FUSeg, the AZH
chronic wound set, DFUC 2022 — was collected in North American, British or
European clinics. None was collected at scale on darkly pigmented skin.

Wound segmentation is a colour-discrimination problem. The boundary between
wound bed and periwound skin, and the detection of periwound erythema, both
depend on colour contrasts that differ substantially with skin tone. A model
trained and validated only on those corpora has **unknown** error on this
patient population — not "probably slightly worse", but unmeasured.

That is a scientific argument, not an administrative one, and it is the reason
local data comes before model selection rather than after it.

A second reason is more immediate: no public dataset with per-tissue pixel
labels (granulation, slough, eschar, epithelium) was found at usable scale. The
tissue percentages the app used to display had no evidential basis and have been
switched off. Restoring them requires labels that only local annotation can
supply.

---

## 2. How many wounds — and why the number cannot be fixed yet

The agreed clinical requirement is that measured area should fall **within 10%
of the reference method**.

The right statistic for method comparison is the Bland–Altman 95% limits of
agreement, not correlation. Correlation measures whether two methods move
together; agreement measures whether they give the same number, which is what
matters when one replaces the other.

### 2.1 The constraint the 10% figure actually imposes

The 95% limits of agreement are `mean difference ± 1.96s`, where `s` is the
standard deviation of the differences. For those limits to sit inside ±10%:

```
1.96 · s ≤ 10%   ⟹   s ≤ 5.1%
```

**This is the finding that matters most.** If the true standard deviation of the
differences exceeds about 5.1%, the method cannot meet a ±10% requirement *at
any sample size*. More data would estimate the disagreement more precisely; it
would not reduce it. Whether photograph-based measurement can achieve this at
all is currently unknown and is exactly what the pilot must establish.

### 2.2 Sample size for a given precision

The standard error of the limits of agreement is approximately `s·√(3/n)`, so
the 95% confidence interval around each limit has half-width `3.394·s/√n`.
Requiring that half-width to be no more than `k·s`:

```
n = (3.394 / k)²
```

| Precision of the LoA estimate | Wounds required |
|---|---|
| ±0.50 s | 47 |
| ±0.40 s | 72 |
| ±0.30 s | 128 |
| ±0.25 s | 185 |
| ±0.20 s | 288 |

### 2.3 What this means in practice

- **Pilot first: 30–50 wounds.** Its purpose is to estimate `s`, not to validate
  anything. If `s` comes out above 5.1%, the ±10% requirement is unachievable
  and the conversation changes from "how much data" to "is this method viable,
  and under what conditions" — most likely tightening the calibration protocol
  before collecting more.
- **Then the main study**, sized from the observed `s` using the table above.
  ±0.3 s (n ≈ 128) is a reasonable target: it gives limits of agreement precise
  enough to defend without demanding a sample the department cannot realistically
  collect.
- Counts are **wounds, measured once each for the agreement analysis** — not
  photographs. Repeated photographs of the same wound are not independent
  observations and inflate the apparent sample size.

I have deliberately not stated a single headline number. It would be arithmetic
resting on an `s` nobody has measured yet, and the brief is explicit that
invented figures are worse than none.

---

## 3. Consent

- Written, specific and separate from the general consent to treatment.
- Two distinct permissions, separately refusable:
  1. **Clinical use** — photographs form part of the medical record.
  2. **Research and model development** — de-identified images may be used to
     train and evaluate software.
- Refusing (2) must not affect care in any way, and must not prevent (1).
- Consent is recorded against the patient, not the photograph, and is
  withdrawable. Withdrawal removes images from future training sets; it cannot
  retroactively remove them from a model already trained, and the consent form
  must say so plainly rather than implying otherwise.
- Photographs that include a face, tattoo, or other identifying feature outside
  the wound field require separate explicit consent, or must be re-taken.

---

## 4. De-identification

- Crop to the wound and its immediate periwound skin. The calibration marker
  stays in frame; nothing else needs to be.
- Strip EXIF entirely on export — GPS and device identifiers in particular.
- Research exports carry a study-specific pseudonymous ID. The mapping to the
  hospital number stays inside the hospital and never travels with the images.
- Never write the patient's name, hospital number or date of birth into a
  filename.

---

## 5. Acquisition

The app already ships the parts this depends on: a printed calibration marker
(5 cm and 10 cm bars, `woundMarkerPdfService.ts`), automatic marker detection,
and a manual drag-a-line fallback when detection fails.

| Parameter | Standard |
|---|---|
| Marker | Printed marker in frame, flat, in the wound plane, not folded or curled |
| Camera angle | Perpendicular to the wound surface — the single largest avoidable error |
| Distance | Wound and marker fill the frame without cropping either |
| Lighting | Diffuse, consistent; flash off where room light suffices |
| Background | Plain, non-reflective drape |
| Dressings | Fully removed; wound cleaned of exudate and slough debris that is not part of the assessment |
| Focus | Confirm focus on the wound bed before capturing |

The app enforces the floor automatically: the quality gate refuses photographs
that are out of focus, too dark, or lost to glare, and the evidence gate refuses
images with no plausible wound. Neither replaces the protocol — they catch
failures, they do not produce good photographs.

**Angle is the weakness this protocol cannot fully control.** A flat marker
calibrates distance in the marker's plane only. A wound on a curved surface, or
photographed obliquely, carries perspective error the marker does not correct.
Record the anatomical site and note obvious curvature, so this can be examined
as a covariate rather than sitting silently in the residuals.

---

## 6. Ground truth

The reference standard for area is **manual planimetry**: acetate tracing of the
wound margin, digitised and measured. It is the accepted reference in the wound
literature and is independent of the photograph, which matters — a reference
derived from the same image would share its errors.

- **Two independent annotators**, both experienced in wound assessment.
- Blinded to each other's tracing and to the app's output. Without blinding,
  the second annotator anchors on the first and the agreement statistic becomes
  meaningless.
- **Inter-rater agreement is reported first.** Model error is only interpretable
  against how much two experts disagree with each other. If two clinicians differ
  by 8%, a model differing by 9% is performing near the ceiling of the task, not
  failing.
- Disagreements beyond a pre-set threshold are adjudicated by a third assessor.
  The adjudicated value becomes ground truth; the original two are retained.

For tissue labels, annotate on the image with a fixed palette (granulation,
slough, eschar, epithelium, periwound, uncertain). **"Uncertain" must be
available** — forcing a label onto an ambiguous pixel manufactures agreement
that does not exist.

---

## 7. Dataset splitting

**Split by patient, never by image.**

This is the single most common way a wound segmentation result is quietly
invalidated. Several photographs of the same wound, or several wounds on the
same patient, are highly correlated. If they land on both sides of the split,
the model is evaluated on data it has effectively seen, and reported performance
is inflated — sometimes dramatically.

- Train / validation / test at roughly 60 / 20 / 20, **allocated at patient
  level**.
- The test set is fixed once, then not examined until the final evaluation.
- Stratify by wound type and anatomical site so each split spans the range, and
  record the skin-tone distribution across splits — since generalisation across
  skin tone is the entire reason for collecting this data, an imbalance there
  would defeat the purpose.

---

## 8. What the app already contributes

The correction loop is the annotation pipeline, and it is already running:

- Every assessment stores the automated outline (`ai_contour_cm`) and, where a
  clinician corrected it, their outline (`clinician_contour_cm`) and the reason
  the first was wrong (`correction_reason`).
- Photographs are stored locally at capture, so the image is retained with the
  outline. **Images do not yet leave the capturing device** — object storage is
  not configured, and until it is, the dataset cannot be assembled centrally.
  This is the current blocker on Section 2 starting at all.
- `image_quality_score` and `image_quality_flags` are recorded, so poor
  photographs can be excluded from training on a recorded basis rather than by
  eye.
- `tissue_source` distinguishes clinician-entered percentages from model output.
  Every existing row is `none`.

The recorded correction reasons are worth as much as the outlines: they say
where the current approach fails, which is what determines whether the fix is a
better model or a better acquisition protocol.

---

## 9. Governance

- Departmental approval, then Health Research Ethics Committee approval, before
  any data collection begins.
- A named custodian for the dataset and the identifier mapping.
- Access to research exports is logged and restricted to named individuals.
- Any transfer outside UNTH requires a data-sharing agreement. The default is
  that images do not leave.
- Retention follows the clinical record's retention period, as agreed.

---

## 10. Sequence

1. Departmental review of this protocol.
2. Ethics submission and approval.
3. Configure object storage so photographs can be gathered centrally *(blocked:
   requires a private Supabase bucket and credentials)*.
4. Annotator training and a calibration exercise on a shared set.
5. Pilot, 30–50 wounds. Estimate `s`. **Decision point: is ±10% achievable?**
6. Size the main study from the observed `s`.
7. Collect, annotate, split by patient.
8. Benchmark candidate models; choose on measured local performance.
9. Prospective validation before clinical reliance.

---

## Open questions for the department

1. Who are the two annotators, and who adjudicates?
2. Is acetate planimetry practical as the reference at the volume in Section 2,
   or is a different reference needed?
3. What adjudication threshold — a fixed percentage difference, or a judgement?
4. Which wound types should the pilot cover? Restricting it narrows the claim
   but reaches a decision faster.
