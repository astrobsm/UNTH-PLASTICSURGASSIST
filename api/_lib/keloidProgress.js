// ============================================================================
// Keloid progress. Deliberately NOT wound healing.
//
// WHY THIS FILE EXISTS SEPARATELY
//
// A wound closes. Its useful questions are "how much smaller is it", "how fast
// is it closing" and "when will it be shut", and the wound monitor answers them
// with area reduction, healing velocity in cm²/week and a projected closure
// date.
//
// A keloid does none of that. It is not an open wound and it does not
// epithelialize; it is scar tissue that grows beyond the original injury, may
// stay active for years, may regress with treatment, and may recur after
// excision. Asking a keloid for its "projected closure" is a category error —
// the number would be meaningless if it could be computed at all, and reading
// "0% area reduction" against a keloid tells a clinician nothing about whether
// it is quiescent or accelerating.
//
// So the questions here are the keloid ones:
//
//   Is it growing, holding, or regressing?
//   Is it still ACTIVE — red, itchy, painful, firm — or has it matured?
//   Did it respond to the injections, and by how much?
//   After excision, is this recurrence?
//
// Growth is reported per MONTH, because keloids are followed over months and
// years and a figure in cm²/week is noise at that timescale.
//
// Pure: measurements in, findings out.
// ============================================================================

import { fitTrajectory } from './graftAnalysis.js';

const isNum = (v) => typeof v === 'number' && Number.isFinite(v);
const round2 = (v) => (isNum(v) ? Math.round(v * 100) / 100 : null);
const DAYS_PER_MONTH = 30.44;

/**
 * Thresholds, gathered so they can be reviewed and later fitted to this unit's
 * own outcome data. They are clinical rules of thumb, not derived values.
 */
export const KELOID_THRESHOLDS = {
  /** Area change per month, as a fraction of current area, that counts as growth. */
  growthFractionPerMonth: 0.05,
  /** Erythema index above which the lesion reads as vascularly active. */
  activeErythema: 4,
  /** Symptom score (0-10) at or above which the lesion is symptomatically active. */
  activeSymptom: 3,
  /** Months after excision within which new growth is treated as recurrence. */
  recurrenceWindowMonths: 24,
  /** Area regrowth fraction after excision that signals recurrence. */
  recurrenceGrowthFraction: 0.2,
};

// ---------------------------------------------------------------------------
// Growth, not healing
// ---------------------------------------------------------------------------

/**
 * How the bulk of the lesion is changing.
 *
 * Expressed as a fraction of the current size per month as well as in absolute
 * cm²/month, because a 0.4 cm²/month gain means something very different on a
 * 2 cm² earlobe keloid than on a 40 cm² chest plaque.
 */
export function growthProfile(areaSeries) {
  const pts = (areaSeries || [])
    .filter((p) => p && isNum(p.day) && isNum(p.value) && p.value > 0)
    .sort((a, b) => a.day - b.day);

  if (pts.length < 2) {
    return { ok: false, reason: 'At least two dated measurements are needed to judge growth.' };
  }

  const fit = fitTrajectory(pts.map((p) => ({ day: p.day, pct: p.value })));
  if (!fit.ok) return { ok: false, reason: fit.reason };

  const perMonth = fit.slope * DAYS_PER_MONTH;
  const current = pts[pts.length - 1].value;
  const first = pts[0].value;
  const fractionPerMonth = current > 0 ? perMonth / current : 0;

  let direction;
  if (fractionPerMonth >= KELOID_THRESHOLDS.growthFractionPerMonth) direction = 'growing';
  else if (fractionPerMonth <= -KELOID_THRESHOLDS.growthFractionPerMonth) direction = 'regressing';
  else direction = 'static';

  return {
    ok: true,
    direction,
    perMonthCm2: round2(perMonth),
    fractionPerMonth: round2(fractionPerMonth * 100),   // as a percentage
    currentAreaCm2: round2(current),
    baselineAreaCm2: round2(first),
    totalChangeCm2: round2(current - first),
    totalChangePct: first > 0 ? round2(((current - first) / first) * 100) : null,
    spanDays: pts[pts.length - 1].day - pts[0].day,
    n: pts.length,
    r2: fit.r2 == null ? null : round2(fit.r2),
  };
}

/**
 * Whether growth is speeding up.
 *
 * A keloid that doubled its rate between two halves of its follow-up is the
 * one to act on, and that is invisible in a single overall slope.
 */
export function growthAcceleration(areaSeries) {
  const pts = (areaSeries || [])
    .filter((p) => p && isNum(p.day) && isNum(p.value))
    .sort((a, b) => a.day - b.day);
  if (pts.length < 4) {
    return { ok: false, reason: `Needs four dated measurements; ${pts.length} available.` };
  }
  const mid = Math.floor(pts.length / 2);
  const early = growthProfile(pts.slice(0, mid + 1));
  const late = growthProfile(pts.slice(mid));
  if (!early.ok || !late.ok) return { ok: false, reason: 'Could not fit each half of the series.' };

  const delta = late.perMonthCm2 - early.perMonthCm2;
  return {
    ok: true,
    earlyPerMonthCm2: early.perMonthCm2,
    latePerMonthCm2: late.perMonthCm2,
    deltaPerMonthCm2: round2(delta),
    accelerating: delta > 0,
    meaningful: Math.abs(delta) > Math.max(0.05, Math.abs(early.perMonthCm2) * 0.25),
  };
}

// ---------------------------------------------------------------------------
// Activity — is this lesion still doing something?
// ---------------------------------------------------------------------------

/**
 * Whether the keloid is clinically active.
 *
 * Activity is what decides treatment: an active keloid is red, itchy, painful
 * and firm and will respond to intralesional steroid; a mature, pale,
 * asymptomatic one largely will not. None of that is visible in area alone,
 * which is precisely why the wound monitor's metrics cannot answer it.
 *
 * Each signal is optional. The answer says which were available, so "not
 * active" is never confused with "not assessed".
 */
export function activityAssessment({ erythemaIndex, pain, itch, pliability, tenderness } = {}) {
  const T = KELOID_THRESHOLDS;
  const signals = [];
  const absent = [];

  const consider = (name, present, value, active) => {
    if (!present) { absent.push(name); return; }
    signals.push({ name, value, active });
  };

  consider('erythema', isNum(erythemaIndex), erythemaIndex,
    isNum(erythemaIndex) && erythemaIndex >= T.activeErythema);
  consider('pain', isNum(pain), pain, isNum(pain) && pain >= T.activeSymptom);
  consider('itch', isNum(itch), itch, isNum(itch) && itch >= T.activeSymptom);
  consider('tenderness', isNum(tenderness), tenderness,
    isNum(tenderness) && tenderness >= T.activeSymptom);
  consider('firmness', !!pliability, pliability,
    ['firm', 'banding', 'contracture'].includes(String(pliability).toLowerCase()));

  if (!signals.length) {
    return {
      status: 'not_assessed',
      summary: 'Activity has not been assessed. Erythema, symptoms and pliability are what '
             + 'distinguish an active keloid from a mature one, and none was recorded.',
      signals: [], absent, activeCount: 0,
    };
  }

  const active = signals.filter((s) => s.active);
  const ratio = active.length / signals.length;

  let status;
  if (ratio >= 0.6) status = 'active';
  else if (ratio > 0) status = 'partially_active';
  else status = 'quiescent';

  return {
    status,
    summary: status === 'active'
      ? `Active: ${active.map((s) => s.name).join(', ')} above threshold.`
      : status === 'partially_active'
        ? `Partially active: ${active.map((s) => s.name).join(', ')}.`
        : 'Quiescent — no activity signal above threshold.',
    signals,
    absent,
    activeCount: active.length,
  };
}

// ---------------------------------------------------------------------------
// Overall status — the one word a ward round wants
// ---------------------------------------------------------------------------

/**
 * The lesion's state, from growth and activity together.
 *
 * Never "healing", never a projected closure date. A keloid's states are
 * whether it is enlarging, holding, settling, or coming back.
 */
export function keloidStatus({ growth, activity, excisionDayOffset = null, currentDay = null }) {
  // Recurrence first: growth after excision is a different finding from growth
  // in an untreated lesion, and is the one that changes management.
  if (growth?.ok && isNum(excisionDayOffset) && isNum(currentDay)) {
    const monthsSince = (currentDay - excisionDayOffset) / DAYS_PER_MONTH;
    if (monthsSince >= 0 && monthsSince <= KELOID_THRESHOLDS.recurrenceWindowMonths
        && growth.direction === 'growing') {
      return {
        status: 'possible_recurrence',
        label: 'Possible recurrence',
        summary: `Growth of ${growth.perMonthCm2} cm²/month detected `
               + `${Math.round(monthsSince)} months after excision. Post-excision growth in `
               + 'this window is compatible with recurrence; clinical assessment recommended.',
      };
    }
  }

  if (!growth?.ok) {
    return {
      status: 'insufficient',
      label: 'Not enough data',
      summary: growth?.reason || 'Two dated measurements are needed before progress can be judged.',
    };
  }

  if (growth.direction === 'growing') {
    return {
      status: 'progressive',
      label: 'Progressive',
      summary: `Enlarging by about ${growth.perMonthCm2} cm² a month `
             + `(${growth.fractionPerMonth}% of current size).`,
    };
  }

  if (growth.direction === 'regressing') {
    return {
      status: 'regressing',
      label: 'Regressing',
      summary: `Reducing by about ${Math.abs(growth.perMonthCm2)} cm² a month `
             + `(${Math.abs(growth.fractionPerMonth)}% of current size).`,
    };
  }

  // Static. Whether that is good news depends entirely on activity.
  if (activity?.status === 'active') {
    return {
      status: 'stable_active',
      label: 'Stable but active',
      summary: `Not enlarging, but still active: ${activity.summary.toLowerCase()} `
             + 'An active keloid is the one that responds to intralesional treatment.',
    };
  }
  if (activity?.status === 'quiescent') {
    return {
      status: 'quiescent',
      label: 'Quiescent',
      summary: 'Not enlarging and showing no activity signal — the picture of a maturing scar.',
    };
  }
  return {
    status: 'stable',
    label: 'Stable',
    summary: 'Not enlarging. Activity not fully assessed, so maturity cannot be confirmed.',
  };
}

// ---------------------------------------------------------------------------
// Response to treatment
// ---------------------------------------------------------------------------

/**
 * What happened to the lesion after the injections.
 *
 * Compares the measurement nearest before the first injection with the latest
 * one, and reports the interval and how many injections fell inside it. This
 * is a before-and-after description, not a causal claim: keloids also change
 * on their own, and the text says so.
 */
export function treatmentResponse(areaSeries, treatmentDays) {
  const pts = (areaSeries || [])
    .filter((p) => p && isNum(p.day) && isNum(p.value))
    .sort((a, b) => a.day - b.day);
  const tx = (treatmentDays || []).filter(isNum).sort((a, b) => a - b);

  if (!tx.length) return { ok: false, reason: 'No treatment has been recorded against this lesion.' };
  if (pts.length < 2) return { ok: false, reason: 'At least two measurements are needed.' };

  const firstTx = tx[0];
  const before = [...pts].reverse().find((p) => p.day <= firstTx) || pts[0];
  const after = pts[pts.length - 1];

  if (after.day <= before.day) {
    return { ok: false, reason: 'No measurement has been taken since treatment began.' };
  }

  const delta = after.value - before.value;
  const pctChange = before.value > 0 ? (delta / before.value) * 100 : null;
  const given = tx.filter((d) => d >= before.day && d <= after.day).length;

  let response;
  if (pctChange == null) response = 'indeterminate';
  else if (pctChange <= -30) response = 'marked_reduction';
  else if (pctChange <= -10) response = 'partial_reduction';
  else if (pctChange < 10) response = 'no_significant_change';
  else response = 'enlargement_despite_treatment';

  return {
    ok: true,
    response,
    beforeAreaCm2: round2(before.value),
    afterAreaCm2: round2(after.value),
    changeCm2: round2(delta),
    changePct: round2(pctChange),
    injectionsInInterval: given,
    intervalDays: after.day - before.day,
    caveat: 'A before-and-after comparison over the treatment interval. Keloids also change '
          + 'without treatment, so this describes what happened rather than what caused it.',
  };
}

export default {
  growthProfile, growthAcceleration, activityAssessment, keloidStatus,
  treatmentResponse, KELOID_THRESHOLDS,
};
