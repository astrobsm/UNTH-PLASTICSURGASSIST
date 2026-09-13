-- ============================================================================
-- 019 — Reconnect photographs to the assessments they belong to.
--
-- WHAT BROKE
--
-- woundMonitorService.addAssessment returned the API's `{ assessment: … }`
-- envelope while declaring it returned the assessment. Callers read `.id`, got
-- undefined, and the guard before attachToAssessment was false every time — so
-- wound_images.assessment_id was never written. Fixed in the service; this
-- repairs the rows already stored.
--
-- WHAT THIS DOES *NOT* DO
--
-- It does not match by timestamp. Looking at the live data, that would be
-- actively wrong: one wound has a single saved assessment and three separate
-- capture attempts, so the nearest-in-time photograph to that assessment is
-- not necessarily the one it was saved from, and two of the attempts were
-- re-takes the clinician never saved at all. Attaching a discarded re-take to
-- a real assessment would put a photograph in the record that the clinician
-- rejected.
--
-- So only two links are made, and both are provable:
--
--   1. EXACT. The assessment's image_url or overlay_url names the image's ref.
--      This is the link the application itself wrote; nothing is inferred.
--
--   2. THE OVERLAY OF AN EXACTLY-MATCHED ORIGINAL. The capture flow stores the
--      original, renders the margin overlay, stores that, then saves the
--      assessment — seconds apart, same wound. An unlinked overlay falling
--      within two minutes AFTER an original that step 1 just linked is that
--      original's overlay. The window is tight and the anchor is a row we are
--      already certain about.
--
-- Anything else is left orphaned on purpose. A photograph belonging to no
-- assessment is not lost — it is still in wound_images with its wound and
-- patient — and leaving it unattached is the honest record of what happened.
--
-- Idempotent: re-running links nothing further.
-- ============================================================================

BEGIN;

-- -- 1. Exact: the assessment names the ref ---------------------------------
UPDATE wound_images wi
SET assessment_id = a.id
FROM wound_assessments a
WHERE wi.assessment_id IS NULL
  AND a.wound_id = wi.wound_id
  AND (
        a.image_url   LIKE '%ref=' || wi.ref
     OR a.overlay_url LIKE '%ref=' || wi.ref
  );

-- -- 2. The overlay that accompanied a matched original ---------------------
--
-- Anchored on the original's capture time, not the assessment's: the overlay
-- is written moments after the original, and both precede the save.
WITH anchored AS (
  SELECT wi.id            AS original_id,
         wi.assessment_id AS assessment_id,
         wi.wound_id,
         COALESCE(wi.captured_at, wi.created_at) AS at
  FROM wound_images wi
  WHERE wi.assessment_id IS NOT NULL
    AND wi.kind = 'original'
),
pairing AS (
  SELECT DISTINCT ON (o.id)
         o.id AS overlay_id,
         anchored.assessment_id
  FROM wound_images o
  JOIN anchored
    ON anchored.wound_id = o.wound_id
   AND COALESCE(o.captured_at, o.created_at) >= anchored.at
   AND COALESCE(o.captured_at, o.created_at) <= anchored.at + INTERVAL '2 minutes'
  WHERE o.assessment_id IS NULL
    AND o.kind = 'overlay'
    -- An overlay belongs to the LAST original captured before it. Without
    -- this, a re-take's overlay is swept up by the earlier saved capture
    -- whenever the two fall inside the window — which is exactly what
    -- happened on the first run of this migration: one assessment collected
    -- two overlays, the second of them from a capture the clinician discarded.
    AND NOT EXISTS (
      SELECT 1 FROM wound_images between_orig
      WHERE between_orig.wound_id = o.wound_id
        AND between_orig.kind = 'original'
        AND between_orig.id <> anchored.original_id
        AND COALESCE(between_orig.captured_at, between_orig.created_at) > anchored.at
        AND COALESCE(between_orig.captured_at, between_orig.created_at)
            < COALESCE(o.captured_at, o.created_at)
    )
  -- Nearest overlay after the original wins.
  ORDER BY o.id, COALESCE(o.captured_at, o.created_at) - anchored.at ASC
)
UPDATE wound_images wi
SET assessment_id = pairing.assessment_id
FROM pairing
WHERE wi.id = pairing.overlay_id;

-- -- 3. Backfill overlay_url on the assessment ------------------------------
--
-- The save path set image_url but never overlay_url, so the margin overlay
-- existed and nothing pointed at it. Written in the same form the application
-- uses, so every device resolves it identically.
UPDATE wound_assessments a
SET overlay_url = '/wound-images?ref=' || chosen.ref
FROM (
  -- One overlay per assessment, deterministically the earliest, so a re-run
  -- cannot pick a different one.
  SELECT DISTINCT ON (assessment_id) assessment_id, ref
  FROM wound_images
  WHERE assessment_id IS NOT NULL AND kind = 'overlay'
  ORDER BY assessment_id, COALESCE(captured_at, created_at) ASC
) chosen
WHERE chosen.assessment_id = a.id
  AND (a.overlay_url IS NULL OR a.overlay_url = '');

COMMIT;
