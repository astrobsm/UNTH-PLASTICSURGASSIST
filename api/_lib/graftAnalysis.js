// ============================================================================
// The arithmetic of graft monitoring.
//
// Every function here is pure: areas and dates in, numbers out. No database, no
// image, no clock. That is deliberate — these are the numbers a clinical
// decision rests on, so they have to be testable against cases whose answer is
// known independently of the code.
//
// WHY THE MEASUREMENTS ARE AREAL
//
// Graft take and donor re-epithelialization look like tissue-classification
// problems — "which part of this graft is viable", "which part of this donor
// site has epithelialized" — and if they were, this module could not honestly
// compute them: the repository's tissue classifier is six fixed HSV cutoffs
// with TISSUE_MODEL_VALIDATED = false, and is forbidden from writing numbers
// into the record.
//
// They are not. The existing segmenter finds *wound* — raw, open, unhealed
// surface. On a grafted recipient site, graft that has taken reads as skin and
// drops out of the segmentation; what remains segmented is the area that
// failed. On a donor site, epithelialized surface likewise drops out and what
// remains is the open area. So both quantities follow from two areas that the
// existing pipeline already measures geometrically:
//
//     take %          = (baseline − current open) / baseline × 100
//     epithelialized % = (baseline − current open) / baseline × 100
//
// Same formula, different clinical meaning. Both rest on calibration and
// segmentation, whose correctness is geometric and testable, and on a baseline
// that is written once and never recomputed.
//
// What genuinely is not automatable here is the sub-classification of failed
// area — necrotic versus infected versus merely delayed. That goes through the
// ComputerVisionProvider and is withheld until a validated model exists.
// ============================================================================

/** Ratio of a percentage that must not be exceeded by rounding noise. */
const clampPct = (v) => Math.max(0, Math.min(100, v));

const isNum = (v) => typeof v === 'number' && Number.isFinite(v);

// ---------------------------------------------------------------------------
// §11 Graft planning
// ---------------------------------------------------------------------------

/**
 * Parses '1:1.5' into the expansion factor 1.5.
 *
 * Returns 1 for anything unparseable, because an unreadable mesh ratio means
 * "not meshed" far more often than it means "expanded by an unknown amount",
 * and planning a harvest on a guessed expansion is how a patient ends up with
 * too little graft on the table.
 */
export function meshExpansionFactor(meshRatio) {
  if (typeof meshRatio === 'number' && Number.isFinite(meshRatio) && meshRatio > 0) {
    return meshRatio;
  }
  const m = String(meshRatio || '').match(/^\s*1\s*:\s*([0-9]*\.?[0-9]+)\s*$/);
  if (!m) return 1;
  const factor = Number(m[1]);
  return Number.isFinite(factor) && factor > 0 ? factor : 1;
}

/**
 * How much graft to harvest for a defect.
 *
 * The margin is applied to the defect to get the area that must be covered;
 * meshing then divides the harvest by the expansion factor, because a 1:1.5
 * mesh covers one and a half times the skin taken.
 *
 * Labelled an estimate everywhere it is shown. It is arithmetic on a
 * photographic area, not a surgical judgement.
 */
export function planGraft({ defectAreaCm2, coverageMarginPct = 5, meshRatio = '1:1' }) {
  if (!isNum(defectAreaCm2) || defectAreaCm2 <= 0) {
    return { ok: false, reason: 'No measured defect area to plan from.' };
  }
  const margin = isNum(coverageMarginPct) ? Math.max(0, coverageMarginPct) : 0;
  const expansion = meshExpansionFactor(meshRatio);

  const plannedCoverageCm2 = defectAreaCm2 * (1 + margin / 100);
  const plannedHarvestCm2 = plannedCoverageCm2 / expansion;

  return {
    ok: true,
    defectAreaCm2: round2(defectAreaCm2),
    coverageMarginPct: margin,
    meshRatio: typeof meshRatio === 'string' ? meshRatio : `1:${expansion}`,
    expansionFactor: expansion,
    plannedCoverageCm2: round2(plannedCoverageCm2),
    plannedHarvestCm2: round2(plannedHarvestCm2),
    isEstimate: true,
  };
}

// ---------------------------------------------------------------------------
// §15 / §19 Take and re-epithelialization, both from preserved baseline
// ---------------------------------------------------------------------------

/**
 * The proportion of a site that has closed, against its locked baseline.
 *
 * `openAreaCm2` is what the segmenter still finds as raw surface. On a
 * recipient site that is graft loss; on a donor site it is not-yet-healed
 * skin. The baseline is the area at the moment the site was established and
 * must never be recomputed from a later photograph — see graft_sites.
 */
export function closureFromBaseline(baselineAreaCm2, openAreaCm2) {
  if (!isNum(baselineAreaCm2) || baselineAreaCm2 <= 0) {
    return { ok: false, reason: 'No locked baseline area for this site.' };
  }
  if (!isNum(openAreaCm2) || openAreaCm2 < 0) {
    return { ok: false, reason: 'No measured open area for this photograph.' };
  }

  // An open area larger than baseline is real and must not be clamped away at
  // this level — a donor site can extend, a recipient bed can break down
  // beyond its original margin. It is reported, and the percentage floors at 0.
  const exceededBaseline = openAreaCm2 > baselineAreaCm2;
  const closedCm2 = baselineAreaCm2 - openAreaCm2;

  return {
    ok: true,
    baselineAreaCm2: round2(baselineAreaCm2),
    openAreaCm2: round2(openAreaCm2),
    closedAreaCm2: round2(Math.max(0, closedCm2)),
    closurePct: round2(clampPct((closedCm2 / baselineAreaCm2) * 100)),
    exceededBaseline,
  };
}

/** Whole days between two dates, floored; null if either is unusable. */
export function postoperativeDay(operationDate, captureDate) {
  const a = new Date(operationDate);
  const b = new Date(captureDate);
  if (isNaN(a.getTime()) || isNaN(b.getTime())) return null;
  const days = Math.floor((startOfDay(b) - startOfDay(a)) / 86400000);
  return days >= 0 ? days : null;
}

// ---------------------------------------------------------------------------
// §21 Healing rate and §41 trend
// ---------------------------------------------------------------------------

/**
 * Least-squares fit of closure percentage against postoperative day.
 *
 * Returns the slope in percentage points per day, the intercept, and the
 * residual standard error — which is what makes an honest prediction interval
 * possible further down. Needs two distinct days; with one point there is no
 * trajectory, only a position.
 */
export function fitTrajectory(points) {
  const clean = (points || [])
    .filter((p) => isNum(p.day) && isNum(p.pct))
    .sort((a, b) => a.day - b.day);

  const days = new Set(clean.map((p) => p.day));
  if (clean.length < 2 || days.size < 2) {
    return { ok: false, reason: 'At least two photographs on different days are needed.', n: clean.length };
  }

  const n = clean.length;
  const meanX = clean.reduce((s, p) => s + p.day, 0) / n;
  const meanY = clean.reduce((s, p) => s + p.pct, 0) / n;

  let sxx = 0;
  let sxy = 0;
  for (const p of clean) {
    sxx += (p.day - meanX) ** 2;
    sxy += (p.day - meanX) * (p.pct - meanY);
  }
  if (sxx === 0) return { ok: false, reason: 'All photographs fall on one day.', n };

  const slope = sxy / sxx;
  const intercept = meanY - slope * meanX;

  // Residual standard error. With n = 2 the fit is exact and df = 0, so there
  // is no spread to estimate; that is reported rather than papered over with a
  // zero, because a zero here would read as a perfectly certain prediction.
  const df = n - 2;
  let sse = 0;
  for (const p of clean) sse += (p.pct - (intercept + slope * p.day)) ** 2;
  const residualSe = df > 0 ? Math.sqrt(sse / df) : null;

  // R², for saying how well the line actually describes the points.
  let sst = 0;
  for (const p of clean) sst += (p.pct - meanY) ** 2;
  const r2 = sst > 0 ? 1 - sse / sst : null;

  return {
    ok: true,
    n, df, slope, intercept, residualSe, r2,
    meanX, sxx,
    first: clean[0],
    last: clean[clean.length - 1],
    points: clean,
  };
}

/** Percentage points per day, and the absolute area closing per day. */
export function healingRate(points, baselineAreaCm2) {
  const fit = fitTrajectory(points);
  if (!fit.ok) return { ok: false, reason: fit.reason };
  return {
    ok: true,
    pctPerDay: round2(fit.slope),
    cm2PerDay: isNum(baselineAreaCm2)
      ? round2((fit.slope / 100) * baselineAreaCm2)
      : null,
    r2: fit.r2 == null ? null : round2(fit.r2),
    basis: `${fit.n} photographs, POD ${fit.first.day}–${fit.last.day}`,
  };
}

/**
 * What the series is doing, in one word.
 *
 * Deliberately conservative: anything with too few points, or a fit the line
 * does not describe, is 'uncertain' rather than a guess dressed as a finding.
 */
export function classifyTrend(points, { kind = 'donor' } = {}) {
  const fit = fitTrajectory(points);
  if (!fit.ok) return { trend: 'uncertain', reason: fit.reason };

  // A line that explains little of the variation is not a trend.
  if (fit.r2 != null && fit.r2 < 0.3 && fit.n >= 4) {
    return { trend: 'uncertain', reason: 'The measurements do not follow a consistent trajectory.' };
  }

  const perDay = fit.slope;
  if (kind === 'recipient') {
    // A graft is expected to hold, not to climb. Loss is the signal.
    if (perDay <= -1.5) return { trend: 'deteriorating', reason: `Losing about ${Math.abs(round2(perDay))}% of take a day.` };
    if (perDay >= 1.5) return { trend: 'improving', reason: `Gaining about ${round2(perDay)}% a day.` };
    return { trend: 'stable', reason: 'Take is holding.' };
  }

  // Donor sites are expected to close. Flat is the signal.
  if (perDay >= 4) return { trend: 'accelerated', reason: `Closing about ${round2(perDay)}% a day.` };
  if (perDay >= 1.5) return { trend: 'expected', reason: `Closing about ${round2(perDay)}% a day.` };
  if (perDay > -0.5) return { trend: 'delayed', reason: `Closing only about ${round2(perDay)}% a day.` };
  return { trend: 'deteriorating', reason: `Open area is increasing by about ${Math.abs(round2(perDay))}% a day.` };
}

// ---------------------------------------------------------------------------
// §23–§24 Prediction
// ---------------------------------------------------------------------------

/**
 * Two-tailed t at 95%, by degrees of freedom.
 *
 * A table rather than a computed quantile because only a handful of df matter
 * here — a donor site is photographed a few times, not a hundred — and a table
 * of real values is more trustworthy than an approximation nobody will check.
 */
const T95 = { 1: 12.71, 2: 4.303, 3: 3.182, 4: 2.776, 5: 2.571, 6: 2.447,
              7: 2.365, 8: 2.306, 9: 2.262, 10: 2.228, 12: 2.179, 15: 2.131,
              20: 2.086, 30: 2.042 };
function t95(df) {
  if (df <= 0) return null;
  if (T95[df]) return T95[df];
  const keys = Object.keys(T95).map(Number).filter((k) => k <= df);
  return keys.length ? T95[Math.max(...keys)] : 1.96;
}

/**
 * When the site is predicted to close.
 *
 * A transparent least-squares extrapolation of the observed photographic
 * trajectory to 100% closure, with an interval derived from the residual
 * spread. It is NOT a trained or validated predictive model and is labelled
 * `method: 'linear-extrapolation'` so no caller can mistake it for one.
 *
 * Refuses rather than guesses when: the trajectory is flat or negative (no
 * finite crossing), there are too few points, or the interval is so wide as to
 * be useless.
 */
export function predictCompletion(points, { targetPct = 100, maxHorizonDays = 120 } = {}) {
  const fit = fitTrajectory(points);
  if (!fit.ok) {
    return { ok: false, method: 'linear-extrapolation', reason: fit.reason };
  }

  const current = fit.last;
  if (current.pct >= targetPct) {
    return {
      ok: true, method: 'linear-extrapolation', alreadyComplete: true,
      currentPct: round2(current.pct), currentDay: current.day,
      reason: 'Already closed on the most recent photograph.',
    };
  }

  if (fit.slope <= 0.05) {
    return {
      ok: false, method: 'linear-extrapolation',
      reason: 'The site is not currently closing, so no completion date can be projected.',
      currentPct: round2(current.pct), currentDay: current.day,
    };
  }

  const predictedDay = (targetPct - fit.intercept) / fit.slope;
  if (!Number.isFinite(predictedDay) || predictedDay - current.day > maxHorizonDays) {
    return {
      ok: false, method: 'linear-extrapolation',
      reason: 'Projected closure lies beyond the useful horizon.',
      currentPct: round2(current.pct), currentDay: current.day,
    };
  }

  // The interval. Propagated from the spread of the residuals about the fitted
  // line, converted from percentage points into days by the slope. With df = 0
  // there is no spread to propagate, and the honest answer is a point estimate
  // flagged as having no interval at all.
  let lowDay = null;
  let highDay = null;
  const t = t95(fit.df);
  if (fit.residualSe != null && t != null) {
    const sePred = fit.residualSe * Math.sqrt(
      1 + 1 / fit.n + (predictedDay - fit.meanX) ** 2 / fit.sxx,
    );
    const marginDays = (t * sePred) / fit.slope;
    lowDay = Math.max(current.day, Math.floor(predictedDay - marginDays));
    highDay = Math.ceil(predictedDay + marginDays);
  }

  return {
    ok: true,
    method: 'linear-extrapolation',
    isValidatedModel: false,
    currentDay: current.day,
    currentPct: round2(current.pct),
    predictedDay: Math.round(predictedDay),
    predictedRange: lowDay != null ? [lowDay, highDay] : null,
    intervalBasis: lowDay != null ? '95% prediction interval' : 'too few photographs for an interval',
    ratePctPerDay: round2(fit.slope),
    r2: fit.r2 == null ? null : round2(fit.r2),
    basis: `${fit.n} photographs, POD ${fit.first.day}–${fit.last.day}`,
  };
}

// ---------------------------------------------------------------------------
// §28 Photographic comparability
// ---------------------------------------------------------------------------

/**
 * Whether two photographs can be compared as measurements.
 *
 * Longitudinal comparison assumes the two images were taken the same way. The
 * strongest available evidence of that is the calibration: if both photographs
 * resolved a marker, the areas are in real units and the camera distance no
 * longer matters. Without calibration on both sides, a wound can appear to
 * halve because the photographer stepped back.
 */
export function assessComparability(current, previous) {
  if (!previous) {
    return { comparable: true, reason: 'First photograph for this site; nothing to compare against yet.' };
  }

  const reasons = [];
  if (!current.scaleReliable) reasons.push('the current photograph has no reliable scale');
  if (!previous.scaleReliable) reasons.push('the previous photograph had no reliable scale');

  if (reasons.length) {
    return {
      comparable: false,
      reason: `Quantitative comparison is unreliable because ${reasons.join(' and ')}. `
            + 'Recapture with the calibration marker in the plane of the wound.',
    };
  }

  // Both calibrated. A large disagreement in pixels-per-cm means the two were
  // shot from very different distances; the areas are still correct, but the
  // resolution differs enough that small changes are not meaningful.
  if (isNum(current.pixelsPerCm) && isNum(previous.pixelsPerCm)
      && current.pixelsPerCm > 0 && previous.pixelsPerCm > 0) {
    const ratio = current.pixelsPerCm / previous.pixelsPerCm;
    if (ratio < 0.5 || ratio > 2) {
      return {
        comparable: false,
        reason: 'The two photographs were taken at very different distances '
              + `(${round2(previous.pixelsPerCm)} vs ${round2(current.pixelsPerCm)} px/cm). `
              + 'Recapture at a similar distance for a reliable comparison.',
      };
    }
  }

  const q = current.imageQualityScore;
  if (isNum(q) && q < 0.5) {
    return {
      comparable: false,
      reason: 'The current photograph is of too low a quality for longitudinal comparison.',
    };
  }

  return { comparable: true, reason: 'Both photographs are calibrated and comparably framed.' };
}

// ---------------------------------------------------------------------------
// §27 / §42 Alerts
// ---------------------------------------------------------------------------

/**
 * What this photograph should raise, given what came before.
 *
 * Every message is phrased as an observation about the photographs, never as a
 * diagnosis — §53. The clinician is told what changed and asked to look.
 */
export function deriveAlerts({ siteRole, analysis, previousAnalysis, trend, prediction, quality }) {
  const alerts = [];
  const site = siteRole === 'recipient' ? 'graft' : 'donor site';

  if (quality && quality.blocking) {
    alerts.push({
      severity: 'warning', code: 'image_quality',
      message: 'Photograph was not of sufficient quality for automated measurement. Recapture using the standardized protocol.',
    });
  }

  if (analysis && analysis.comparable === false) {
    alerts.push({
      severity: 'info', code: 'not_comparable',
      message: `Longitudinal comparison could not be performed reliably: ${analysis.comparabilityReason}`,
    });
  }

  if (analysis && previousAnalysis
      && isNum(analysis.closurePct) && isNum(previousAnalysis.closurePct)) {
    const drop = previousAnalysis.closurePct - analysis.closurePct;
    if (drop >= 10) {
      alerts.push({
        severity: 'urgent', code: 'closure_regression',
        message: `Automated image analysis shows the ${site} has lost ${round2(drop)}% of closed area `
               + `since the previous photograph (POD ${previousAnalysis.day} to POD ${analysis.day}). `
               + 'Clinical assessment recommended.',
      });
    } else if (drop >= 4) {
      alerts.push({
        severity: 'warning', code: 'closure_regression_minor',
        message: `The ${site} has lost ${round2(drop)}% of closed area since the previous photograph.`,
      });
    }
  }

  if (analysis && analysis.exceededBaseline) {
    alerts.push({
      severity: 'urgent', code: 'exceeds_baseline',
      message: `The open area of the ${site} now exceeds its baseline area. `
             + 'Photographic features are concerning for breakdown beyond the original margin; clinical assessment recommended.',
    });
  }

  if (trend && (trend.trend === 'deteriorating')) {
    alerts.push({
      severity: 'urgent', code: 'trend_deteriorating',
      message: `Automated trend analysis for the ${site}: ${trend.reason} Clinical review recommended.`,
    });
  } else if (trend && trend.trend === 'delayed') {
    alerts.push({
      severity: 'warning', code: 'trend_delayed',
      message: `${site.charAt(0).toUpperCase() + site.slice(1)} epithelialization has progressed more slowly `
             + `than expected: ${trend.reason}`,
    });
  }

  if (prediction && prediction.ok === false && prediction.reason
      && siteRole === 'donor' && prediction.currentPct != null && prediction.currentPct < 90) {
    alerts.push({
      severity: 'info', code: 'no_prediction',
      message: `No healing completion could be projected: ${prediction.reason}`,
    });
  }

  return alerts;
}

/** Days since the last photograph, for the overdue-follow-up alert (§42). */
export function overdueFollowUp(lastCaptureDate, now, expectedIntervalDays = 7) {
  const last = new Date(lastCaptureDate);
  const at = new Date(now);
  if (isNaN(last.getTime()) || isNaN(at.getTime())) return null;
  const days = Math.floor((startOfDay(at) - startOfDay(last)) / 86400000);
  if (days <= expectedIntervalDays) return null;
  return {
    severity: days > expectedIntervalDays * 2 ? 'warning' : 'info',
    code: 'overdue_photograph',
    message: `No photograph for ${days} days; a photographic assessment was expected every ${expectedIntervalDays}.`,
    days,
  };
}

// ---------------------------------------------------------------------------

function startOfDay(d) {
  return Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate());
}

function round2(v) {
  return Math.round(v * 100) / 100;
}

export default {
  meshExpansionFactor, planGraft, closureFromBaseline, postoperativeDay,
  fitTrajectory, healingRate, classifyTrend, predictCompletion,
  assessComparability, deriveAlerts, overdueFollowUp,
};
