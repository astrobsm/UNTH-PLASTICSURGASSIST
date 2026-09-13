-- ============================================================================
-- 020 — Retract the centimetre figures that came from a fabricated scale.
--
-- The grid and ruler detectors look for periodic structure. Skin pores, hair,
-- fabric weave and JPEG blocking are all periodic, so on photographs with no
-- measurement marker in them they "found" a ruler or a grid and returned a
-- scale. measureWound then treated any such detection above 0.5 confidence as
-- reliable, and every length and area computed from it went into the record as
-- a trustworthy measurement in centimetres.
--
-- Two assessments in this database are affected, and both are self-evidently
-- wrong rather than merely uncertain:
--
--   #3   right foot diabetic ulcer    1,370.90 cm²   (ruler)
--   #11  sacral pressure injury       6,452.90 cm²   (grid)
--
-- 6,452 cm² is about 80 cm square. These are not imprecise measurements; they
-- are arithmetic on a constant nobody measured.
--
-- WHAT IS RETRACTED AND WHAT IS KEPT
--
-- The centimetre figures go, because they are not measurements and leaving
-- them — even flagged — puts 6,452 cm² on a healing chart. scale_reliable
-- becomes false, which was always the truth.
--
-- Everything real is kept: the photograph, the traced outline in pixels, the
-- image quality, the confidence, the timestamps and the row itself. A note
-- records what was withdrawn and why, so the retraction is visible in the
-- record rather than looking like data that was never collected.
--
-- The wound-level denormalised areas are recomputed afterwards from what
-- survives, or cleared where nothing does.
-- ============================================================================

BEGIN;

-- -- 1. Withdraw the figures --------------------------------------------------
UPDATE wound_assessments
SET
  area_cm2      = NULL,
  length_cm     = NULL,
  width_cm      = NULL,
  perimeter_cm  = NULL,
  depth_cm      = NULL,
  scale_reliable = FALSE,
  notes = TRIM(BOTH E'\n' FROM
    COALESCE(notes, '')
    || E'\n[Automated correction] The centimetre measurements recorded here were '
    || 'derived from a scale the software detected in the photograph without a '
    || 'measurement marker present. The '
    || COALESCE(calibration_type, 'automatic')
    || ' detector responds to periodic texture such as skin, hair and fabric, and '
    || 'the scale it produced was not a measurement. The figures have been '
    || 'withdrawn; the photograph and the traced outline are unchanged. Re-measure '
    || 'with a calibration marker in the frame if a figure in centimetres is needed.')
WHERE scale_reliable = TRUE
  AND (calibration_type ILIKE '%grid%' OR calibration_type ILIKE '%ruler%');

-- -- 2. Recompute what the wound rows say -------------------------------------
--
-- These columns are denormalised from the assessments, so they still carry the
-- retracted figures. Recomputed from the measurements that survive; set to
-- NULL where a wound has none left, because an absent measurement is not zero.
UPDATE wounds w
SET
  baseline_area_cm2 = sub.first_area,
  latest_area_cm2   = sub.last_area,
  -- A velocity computed from a retracted area is retracted with it. It will be
  -- recomputed by the application on the next real assessment.
  healing_velocity_cm2_per_week = NULL,
  healing_status = CASE WHEN sub.measured < 2 THEN 'insufficient_data'
                        ELSE w.healing_status END,
  updated_at = NOW()
FROM (
  SELECT
    a.wound_id,
    COUNT(*) FILTER (WHERE a.area_cm2 IS NOT NULL)::int AS measured,
    (ARRAY_AGG(a.area_cm2 ORDER BY a.assessed_at ASC)
       FILTER (WHERE a.area_cm2 IS NOT NULL))[1] AS first_area,
    (ARRAY_AGG(a.area_cm2 ORDER BY a.assessed_at DESC)
       FILTER (WHERE a.area_cm2 IS NOT NULL))[1] AS last_area
  FROM wound_assessments a
  GROUP BY a.wound_id
) sub
WHERE w.id = sub.wound_id;

COMMIT;
