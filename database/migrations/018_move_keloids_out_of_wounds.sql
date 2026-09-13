-- ============================================================================
-- 018 — Move keloids and scars out of the wound monitor.
--
-- Keloids were being registered as wounds, because "Keloid" was offered in the
-- wound-type list. The wound monitor then applied wound semantics to them:
-- a serial healing map, area reduction, healing velocity in cm²/week and a
-- projected closure date.
--
-- None of that is meaningful for a keloid. A keloid is not an open wound, does
-- not epithelialize and does not close; it grows, stays active, responds to
-- intralesional treatment, and recurs after excision. "0% area reduction"
-- against a keloid tells a clinician nothing about whether it is quiescent or
-- accelerating, and a projected closure date is a category error.
--
-- This adopts every existing keloid/scar wound into scar_cases so it is
-- followed by the keloid monitor instead. The wound row is KEPT — it is what
-- carries the photographs, calibration and traced outlines — but the listing
-- queries now exclude any wound that backs a scar_case, so it disappears from
-- the wound monitor and appears in the scar monitor with the right questions.
--
-- Nothing is deleted and no measurement is lost.
-- ============================================================================

BEGIN;

INSERT INTO scar_cases (
  patient_id, wound_id, label, anatomical_site, body_side, scar_type,
  onset_date, status, created_at
)
SELECT
  w.patient_id,
  w.id,
  COALESCE(NULLIF(w.label, ''), 'Keloid'),
  w.anatomical_location,
  w.body_side,
  -- The wound type is the best evidence of which it is. Anything that merely
  -- mentions scar becomes 'uncertain' rather than being called a keloid.
  CASE
    WHEN w.wound_type ILIKE '%keloid%'        THEN 'keloid'
    WHEN w.wound_type ILIKE '%hypertrophic%'  THEN 'hypertrophic'
    WHEN w.wound_type ILIKE '%contracture%'   THEN 'contracture'
    ELSE 'uncertain'
  END,
  COALESCE(w.date_of_injury, w.date_first_seen),
  CASE WHEN w.status = 'healed' THEN 'resolved' ELSE 'active' END,
  COALESCE(w.created_at, NOW())
FROM wounds w
WHERE (
    w.wound_type ILIKE '%keloid%'
 OR w.wound_type ILIKE '%hypertrophic%'
 OR w.wound_type ILIKE '%contracture%'
 OR w.wound_type ILIKE '%scar%'
)
-- Idempotent, and never adopts a wound that is already a scar.
AND NOT EXISTS (SELECT 1 FROM scar_cases s WHERE s.wound_id = w.id)
ON CONFLICT (patient_id, wound_id) DO NOTHING;

-- Each adopted lesion gets its existing wound assessments as scar assessments,
-- so the photographs and areas already recorded become the first points of its
-- growth curve rather than being stranded in a monitor that no longer shows it.
INSERT INTO scar_assessments (
  scar_id, wound_assessment_id, assessed_at, is_baseline,
  measurement_method, quality_flag, created_at
)
SELECT
  s.id,
  wa.id,
  wa.assessed_at,
  -- The earliest assessment for each lesion is its baseline.
  wa.assessed_at = MIN(wa.assessed_at) OVER (PARTITION BY s.id),
  CASE
    WHEN wa.clinician_contour_cm IS NOT NULL THEN 'ai_corrected'
    WHEN wa.ai_contour_cm IS NOT NULL        THEN 'ai_segmentation'
    ELSE 'clinician_traced'
  END,
  CASE
    WHEN wa.image_quality_score >= 0.75 THEN 'high'
    WHEN wa.image_quality_score >= 0.5  THEN 'acceptable'
    WHEN wa.image_quality_score IS NULL THEN 'acceptable'
    ELSE 'limited'
  END,
  COALESCE(wa.created_at, wa.assessed_at)
FROM scar_cases s
JOIN wound_assessments wa ON wa.wound_id = s.wound_id
WHERE NOT EXISTS (
  SELECT 1 FROM scar_assessments a WHERE a.wound_assessment_id = wa.id
);

COMMIT;
