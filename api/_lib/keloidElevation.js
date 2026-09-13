// ============================================================================
// Height and volume, from a calibrated profile view.
//
// WHAT THIS IS, AND WHAT IT IS NOT
//
// It is NOT photogrammetric 3D reconstruction. Structure-from-motion and dense
// stereo cannot run in this deployment, and a surface mesh is not what this
// produces.
//
// It IS the third dimension, obtained the way a surgeon already obtains it: a
// lateral photograph with the calibration marker in the plane of the lesion,
// on which the skin baseline and the lesion's profile are traced. Height in
// centimetres then falls out of the same calibration that gives area in the
// en-face view — no new assumption, no new instrument.
//
// VOLUME IS AN ESTIMATE, AND THE ESTIMATE DEPENDS ON SHAPE
//
// Two lesions with identical area and identical peak height hold different
// volumes depending on whether they are domed or plateaued. Rather than pick
// one model and report a single confident number, this computes both and
// reports the RANGE between them:
//
//   plateau       V ≈ area × mean elevation          (upper, for a flat-topped plaque)
//   hemi-ellipsoid V ≈ (2/3) × area × max elevation  (for a domed nodule)
//
// The width of that range is the model uncertainty, made visible instead of
// hidden. A point estimate is also given — the mean-elevation one, which makes
// the fewest assumptions about shape — and is labelled as such.
//
// Pure: traced points and a scale in, measurements out.
// ============================================================================

const isNum = (v) => typeof v === 'number' && Number.isFinite(v);
const round2 = (v) => (isNum(v) ? Math.round(v * 100) / 100 : null);
const round3 = (v) => (isNum(v) ? Math.round(v * 1000) / 1000 : null);

/** Below this many profile points the outline is a gesture, not a trace. */
export const MIN_PROFILE_POINTS = 4;

/**
 * Perpendicular distance from a point to the baseline, signed so that "above
 * the skin" is positive whichever way the baseline was drawn.
 *
 * The baseline is the line of the surrounding normal skin, which is rarely
 * horizontal in a real photograph — an earlobe is held at whatever angle the
 * patient's head happens to be. Measuring perpendicular to the traced skin
 * line rather than vertically in the image is what makes the height
 * independent of how the camera was tilted.
 */
export function elevationAbove(point, baselineA, baselineB) {
  const dx = baselineB.x - baselineA.x;
  const dy = baselineB.y - baselineA.y;
  const len = Math.hypot(dx, dy);
  if (len === 0) return null;
  // Cross product gives a signed perpendicular distance.
  return ((point.x - baselineA.x) * dy - (point.y - baselineA.y) * dx) / len;
}

/**
 * The elevation profile of a lesion above the skin line.
 *
 * @param profilePx  traced outline of the lesion in the lateral view, image px
 * @param baselinePx two points defining the surrounding skin surface
 * @param pixelsPerCm from the calibration marker in the SAME photograph
 */
export function measureProfile(profilePx, baselinePx, pixelsPerCm) {
  if (!Array.isArray(profilePx) || profilePx.length < MIN_PROFILE_POINTS) {
    return {
      ok: false,
      reason: `Trace at least ${MIN_PROFILE_POINTS} points along the lesion profile.`,
    };
  }
  if (!Array.isArray(baselinePx) || baselinePx.length < 2) {
    return { ok: false, reason: 'Draw the skin baseline: two points on the normal skin either side.' };
  }
  if (!(pixelsPerCm > 0)) {
    return { ok: false, reason: 'No scale. Calibrate against the marker in this photograph first.' };
  }

  const [a, b] = baselinePx;
  const heights = [];
  for (const p of profilePx) {
    const h = elevationAbove(p, a, b);
    if (h === null) {
      return { ok: false, reason: 'The two baseline points are the same; the skin line has no direction.' };
    }
    heights.push(h);
  }

  // Whichever sign the majority of the lesion falls on is "above the skin";
  // the clinician should not have to draw the baseline in a particular
  // direction for the number to come out positive.
  const positives = heights.filter((h) => h > 0).length;
  const flip = positives < heights.length / 2 ? -1 : 1;
  const above = heights.map((h) => Math.max(0, h * flip));

  const maxPx = Math.max(...above);
  if (maxPx <= 0) {
    return {
      ok: false,
      reason: 'The traced profile does not rise above the baseline. Check that the baseline '
            + 'follows the surrounding skin and the profile follows the lesion.',
    };
  }

  // Mean height across the lesion's footprint, by the trapezium rule along the
  // baseline direction — not the mean of the traced points, which would be
  // biased by tracing one part of the profile more densely than another.
  const dxb = b.x - a.x;
  const dyb = b.y - a.y;
  const lenb = Math.hypot(dxb, dyb);
  const along = profilePx.map((p) => ((p.x - a.x) * dxb + (p.y - a.y) * dyb) / lenb);

  const order = along.map((t, i) => ({ t, h: above[i] })).sort((p, q) => p.t - q.t);
  let areaPx2 = 0;
  for (let i = 1; i < order.length; i++) {
    areaPx2 += ((order[i].h + order[i - 1].h) / 2) * (order[i].t - order[i - 1].t);
  }
  const footprintPx = order[order.length - 1].t - order[0].t;
  const meanPx = footprintPx > 0 ? areaPx2 / footprintPx : maxPx / 2;

  return {
    ok: true,
    maxElevationCm: round3(maxPx / pixelsPerCm),
    meanElevationCm: round3(meanPx / pixelsPerCm),
    profileWidthCm: round2(footprintPx / pixelsPerCm),
    /** Cross-sectional area of the lesion above the skin line. */
    crossSectionCm2: round3(areaPx2 / (pixelsPerCm * pixelsPerCm)),
    points: profilePx.length,
    pixelsPerCm: round2(pixelsPerCm),
  };
}

/**
 * Volume, as a range between two shape models.
 *
 * `areaCm2` is the en-face (top-down) area, which the existing tracer already
 * measures. The profile supplies the height. Neither number is new; the
 * assumption is only in how they are combined, and that assumption is named.
 */
export function estimateVolume(areaCm2, profile, { shape = 'unknown' } = {}) {
  if (!isNum(areaCm2) || areaCm2 <= 0) {
    return { ok: false, reason: 'The en-face area is needed. Trace the lesion in the top-down view first.' };
  }
  if (!profile || !profile.ok) {
    return { ok: false, reason: profile?.reason || 'A calibrated profile view is needed for height.' };
  }

  const plateau = areaCm2 * profile.meanElevationCm;
  const dome = (2 / 3) * areaCm2 * profile.maxElevationCm;

  const low = Math.min(plateau, dome);
  const high = Math.max(plateau, dome);

  // The point estimate makes the fewest assumptions: mean height over the
  // measured footprint, rather than a shape imposed on it.
  const point = plateau;

  const chosen = shape === 'dome' ? dome : shape === 'plateau' ? plateau : point;

  return {
    ok: true,
    volumeCm3: round3(chosen),
    rangeCm3: [round3(low), round3(high)],
    model: shape === 'dome'
      ? 'hemi-ellipsoid (domed nodule): two-thirds of area times peak height'
      : shape === 'plateau'
        ? 'plateau: area times mean height'
        : 'area times mean height, which assumes least about shape',
    // The spread between the two models IS the uncertainty; stating it stops
    // a single figure being read as precise.
    uncertaintyNote:
      `Shape models bracket this between ${round3(low)} and ${round3(high)} cm³. `
      + 'Volume from two calibrated views is an estimate, not a reconstruction.',
    areaCm2: round2(areaCm2),
    maxElevationCm: profile.maxElevationCm,
    meanElevationCm: profile.meanElevationCm,
  };
}

/**
 * How far the elevation measurement can be trusted.
 *
 * Small heights are where this method is weakest: a 1 mm keloid on a
 * photograph at 30 px/cm spans three pixels, and a two-pixel tracing error is
 * most of the answer. So the quality depends on how many pixels the height
 * actually occupies, not on how confident the tracing felt.
 */
export function profileQuality(profile) {
  if (!profile?.ok) return { grade: 'failed', reason: profile?.reason || 'No profile traced.' };

  const heightPx = profile.maxElevationCm * profile.pixelsPerCm;

  if (heightPx < 10) {
    return {
      grade: 'low',
      reason: `The lesion stands only ${Math.round(heightPx)} pixels above the baseline. `
            + 'A tracing error of two or three pixels would be a large part of that. '
            + 'Photograph the profile closer, with the marker in the same plane.',
    };
  }
  if (heightPx < 30 || profile.points < 8) {
    return {
      grade: 'moderate',
      reason: `${Math.round(heightPx)} pixels of height across ${profile.points} traced points.`,
    };
  }
  return {
    grade: 'high',
    reason: `${Math.round(heightPx)} pixels of height across ${profile.points} traced points.`,
  };
}

export default {
  elevationAbove, measureProfile, estimateVolume, profileQuality,
  MIN_PROFILE_POINTS,
};
