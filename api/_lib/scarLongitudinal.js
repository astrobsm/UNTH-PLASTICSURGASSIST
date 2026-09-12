// ============================================================================
// What changed, by how much, and whether the modalities agree.
//
// A scar is followed on several independent axes at once — area, volume,
// colour, validated scores, symptoms, function — and the clinically useful
// question is rarely "what does one of them say" but "do they say the same
// thing". So this computes each domain separately and then asks whether they
// agree (§35) or disagree (§36), and refuses to resolve a disagreement by
// picking a favourite.
//
// The least-squares fit is imported from graftAnalysis rather than written
// again: one implementation of a regression, tested once.
//
// Pure: series in, findings out.
// ============================================================================

import { fitTrajectory } from './graftAnalysis.js';

const isNum = (v) => typeof v === 'number' && Number.isFinite(v);
const round2 = (v) => (isNum(v) ? Math.round(v * 100) / 100 : null);

/** Days in the month used for per-month rates. */
const DAYS_PER_MONTH = 30.44;

// ---------------------------------------------------------------------------
// §31 Change
// ---------------------------------------------------------------------------

/**
 * Absolute and percentage change between two values.
 *
 * Percentage change is undefined when the baseline is zero, and unstable when
 * it is merely near zero — a scar going from 0.05 cm² to 0.15 cm² is a 200%
 * increase and a tenth of a square centimetre. So the percentage is withheld
 * below a floor and the absolute change is reported alone, which is the honest
 * answer rather than a dramatic one.
 */
export function changeBetween(previous, current, { percentFloor = 0.1 } = {}) {
  if (!isNum(previous) || !isNum(current)) {
    return { ok: false, reason: 'Both values are needed to compute a change.' };
  }
  const absolute = current - previous;
  const usable = Math.abs(previous) >= percentFloor;
  return {
    ok: true,
    previous,
    current,
    absolute: round2(absolute),
    percent: usable ? round2((absolute / Math.abs(previous)) * 100) : null,
    percentWithheld: !usable,
    percentWithheldReason: usable
      ? null
      : `Baseline value ${previous} is too close to zero for a percentage to be meaningful.`,
  };
}

// ---------------------------------------------------------------------------
// §32 Rate, §33 acceleration
// ---------------------------------------------------------------------------

/**
 * Rate of change per month, by least squares over the whole series.
 *
 * Per month rather than per day because scar follow-up is measured in weeks
 * and months, and a figure like 0.013 cm²/day communicates nothing.
 */
export function rateOfChange(series, { unit = '' } = {}) {
  const pts = usable(series);
  if (pts.length < 2) {
    return { ok: false, reason: 'At least two dated observations are needed for a rate.' };
  }
  const fit = fitTrajectory(pts.map((p) => ({ day: p.day, pct: p.value })));
  if (!fit.ok) return { ok: false, reason: fit.reason };

  return {
    ok: true,
    perDay: round2(fit.slope),
    perMonth: round2(fit.slope * DAYS_PER_MONTH),
    unit: unit ? `${unit}/month` : 'per month',
    r2: fit.r2 == null ? null : round2(fit.r2),
    n: fit.n,
    spanDays: pts[pts.length - 1].day - pts[0].day,
  };
}

/**
 * Whether the rate itself is changing.
 *
 * Computed as the difference between the rate over the later half of the
 * series and the earlier half, which needs at least four observations. With
 * three or fewer it is not computed at all — §33 says not to calculate
 * acceleration on insufficient data, and two segments of one point each would
 * be noise presented as a trend.
 */
export function growthAcceleration(series) {
  const pts = usable(series);
  if (pts.length < 4) {
    return {
      ok: false,
      reason: `Acceleration needs at least four dated observations; ${pts.length} available.`,
    };
  }
  const mid = Math.floor(pts.length / 2);
  const early = rateOfChange(pts.slice(0, mid + 1));
  const late = rateOfChange(pts.slice(mid));
  if (!early.ok || !late.ok) {
    return { ok: false, reason: 'Could not fit a rate to each half of the series.' };
  }

  const delta = late.perMonth - early.perMonth;
  return {
    ok: true,
    earlyPerMonth: early.perMonth,
    latePerMonth: late.perMonth,
    deltaPerMonth: round2(delta),
    accelerating: delta > 0,
    // Only worth saying when both the direction and the size mean something.
    meaningful: Math.abs(delta) > Math.max(0.05, Math.abs(early.perMonth) * 0.25),
  };
}

// ---------------------------------------------------------------------------
// §34 Trend, per domain
// ---------------------------------------------------------------------------

/**
 * Classifies one domain's trajectory.
 *
 * `worseIsHigher` is required rather than guessed: area rising is worsening,
 * and a POSAS falling is improving, and a function that has to infer that from
 * the name of the series will eventually get it wrong on a domain nobody
 * thought about.
 */
export function classifyDomainTrend(series, { worseIsHigher = true, noiseFraction = 0.1 } = {}) {
  const pts = usable(series);
  if (pts.length < 2) {
    return { trend: 'indeterminate', reason: 'Fewer than two dated observations.' };
  }

  const fit = fitTrajectory(pts.map((p) => ({ day: p.day, pct: p.value })));
  if (!fit.ok) return { trend: 'indeterminate', reason: fit.reason };

  const first = pts[0].value;
  const last = pts[pts.length - 1].value;
  const net = last - first;

  // A series that wanders is fluctuating, not stable and not a trend — and
  // calling it either would hide exactly the instability a clinician wants to
  // see.
  //
  // The discriminator is path length against displacement: how far the value
  // actually travelled, versus how far it ended up from where it started. A
  // steady climb travels exactly its net change; a scar that swings up, down
  // and up again travels several times it. Comparing the two is independent of
  // the size of the net change, which a spread-based test is not.
  const totalVariation = pts.slice(1).reduce(
    (sum, p, i) => sum + Math.abs(p.value - pts[i].value), 0);
  const wandering = totalVariation > Math.abs(net) * 2;
  const excursionsMatter = totalVariation > Math.max(Math.abs(first) * noiseFraction, 1e-9);

  if (pts.length >= 3 && wandering && excursionsMatter) {
    return {
      trend: 'fluctuating',
      reason: `Values travelled ${round2(totalVariation)} in total to end ${round2(net)} from where `
            + 'they started — movement without a consistent direction.',
    };
  }

  const threshold = Math.max(Math.abs(first) * noiseFraction, 1e-9);
  if (Math.abs(net) <= threshold) {
    return { trend: 'stable', reason: `Net change ${round2(net)} is within measurement noise.` };
  }

  const worse = worseIsHigher ? net > 0 : net < 0;
  return {
    trend: worse ? 'worsening' : 'improving',
    reason: `Net change ${round2(net)} over ${pts[pts.length - 1].day - pts[0].day} days.`,
    net: round2(net),
  };
}

// ---------------------------------------------------------------------------
// §35 Consistency, §36 discordance
// ---------------------------------------------------------------------------

const WORSENING = new Set(['worsening']);
const IMPROVING = new Set(['improving']);

/**
 * Do the modalities tell the same story?
 *
 * Takes the per-domain trends and reports agreement or the lack of it. It
 * never resolves a disagreement: §36 is explicit that discordance is a finding
 * to be handed to a clinician, not a tie to be broken by the software.
 *
 * @param {Array<{domain: string, label: string, modality: string, trend: string}>} domains
 */
export function multimodalAssessment(domains) {
  const known = (domains || []).filter(
    (d) => d && d.trend && !['indeterminate'].includes(d.trend));

  if (known.length < 2) {
    return {
      verdict: 'insufficient',
      summary: 'Too few measured domains to compare modalities.',
      agreeing: [], disagreeing: [], domains: known,
    };
  }

  const worse = known.filter((d) => WORSENING.has(d.trend));
  const better = known.filter((d) => IMPROVING.has(d.trend));
  const flat = known.filter((d) => d.trend === 'stable');
  const noisy = known.filter((d) => d.trend === 'fluctuating');

  // Distinct modalities matter more than distinct domains: three photographic
  // measures agreeing is one kind of evidence, and photography plus
  // examination plus the patient agreeing is a much stronger one.
  const modalitiesOf = (set) => [...new Set(set.map((d) => d.modality))];

  if (worse.length >= 2 && better.length === 0) {
    return {
      verdict: 'consistent_progression',
      summary: `Multimodal evidence of possible progression: ${worse.length} domains worsening `
             + `across ${modalitiesOf(worse).length} modalities, none improving.`,
      agreeing: worse, disagreeing: [], stable: flat, fluctuating: noisy, domains: known,
      modalities: modalitiesOf(worse),
    };
  }

  if (better.length >= 2 && worse.length === 0) {
    return {
      verdict: 'consistent_response',
      summary: `Multimodal evidence of treatment response: ${better.length} domains improving `
             + `across ${modalitiesOf(better).length} modalities, none worsening.`,
      agreeing: better, disagreeing: [], stable: flat, fluctuating: noisy, domains: known,
      modalities: modalitiesOf(better),
    };
  }

  if (worse.length > 0 && better.length > 0) {
    return {
      verdict: 'discordant',
      summary: 'Assessment discordance detected. Clinical interpretation required: '
             + `${better.map((d) => d.label).join(', ')} improved while `
             + `${worse.map((d) => d.label).join(', ')} worsened.`,
      agreeing: [], disagreeing: [...worse, ...better], stable: flat, fluctuating: noisy,
      domains: known,
    };
  }

  if (noisy.length && !worse.length && !better.length) {
    return {
      verdict: 'fluctuating',
      summary: `${noisy.map((d) => d.label).join(', ')} are moving without a consistent direction.`,
      agreeing: [], disagreeing: [], stable: flat, fluctuating: noisy, domains: known,
    };
  }

  return {
    verdict: 'stable',
    summary: 'No domain shows a consistent direction of change.',
    agreeing: flat, disagreeing: [], stable: flat, fluctuating: noisy, domains: known,
  };
}

// ---------------------------------------------------------------------------
// §42 Prediction eligibility, §70 method-change warning
// ---------------------------------------------------------------------------

export const DEFAULT_ELIGIBILITY = {
  minObservations: 3,
  minSpanDays: 28,
  minImageQuality: 0.5,
  requireCalibration: true,
};

/**
 * Whether a prediction may be attempted at all.
 *
 * Returns the reasons it may not, so the interface can say what is missing
 * instead of showing an empty panel. §42 forbids producing a probability when
 * the data cannot support one, and the honest handling of that is to explain
 * what would make it possible.
 */
export function predictionEligibility(observations, rules = {}) {
  const R = { ...DEFAULT_ELIGIBILITY, ...rules };
  const obs = (observations || []).filter((o) => o && isNum(o.day));
  const blockers = [];

  if (obs.length < R.minObservations) {
    blockers.push(`${obs.length} of ${R.minObservations} required assessments recorded.`);
  }

  const span = obs.length >= 2 ? obs[obs.length - 1].day - obs[0].day : 0;
  if (span < R.minSpanDays) {
    blockers.push(`Follow-up spans ${span} days; at least ${R.minSpanDays} are needed.`);
  }

  const poor = obs.filter((o) => isNum(o.imageQualityScore) && o.imageQualityScore < R.minImageQuality);
  if (poor.length && poor.length > obs.length / 2) {
    blockers.push(`${poor.length} of ${obs.length} photographs fall below the quality floor.`);
  }

  if (R.requireCalibration) {
    const uncalibrated = obs.filter((o) => o.scaleReliable === false);
    if (uncalibrated.length) {
      blockers.push(`${uncalibrated.length} assessment(s) have no reliable scale, so their measurements are not comparable.`);
    }
  }

  return {
    eligible: blockers.length === 0,
    blockers,
    message: blockers.length
      ? `Prediction unavailable due to insufficient reliable longitudinal data. ${blockers.join(' ')}`
      : null,
    observations: obs.length,
    spanDays: span,
  };
}

/**
 * Warns when a series mixes measurement methods.
 *
 * An area traced by a clinician and an area produced by a segmenter are not
 * interchangeable, and a step in the series at the point the method changed is
 * an artefact rather than a clinical event. §70.
 */
export function methodConsistency(observations) {
  const methods = [...new Set((observations || [])
    .map((o) => o && o.method).filter(Boolean))];
  if (methods.length <= 1) {
    return { consistent: true, methods, warning: null };
  }
  return {
    consistent: false,
    methods,
    warning: 'Measurement methods differ between assessments '
           + `(${methods.join(', ')}); interpret longitudinal change with caution.`,
  };
}

// ---------------------------------------------------------------------------

/** Dated, numeric observations, in order. Everything else is dropped. */
function usable(series) {
  return (series || [])
    .filter((p) => p && isNum(p.day) && isNum(p.value))
    .sort((a, b) => a.day - b.day);
}

export default {
  changeBetween, rateOfChange, growthAcceleration, classifyDomainTrend,
  multimodalAssessment, predictionEligibility, methodConsistency,
  DEFAULT_ELIGIBILITY,
};
