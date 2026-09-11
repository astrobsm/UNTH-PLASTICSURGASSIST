// ============================================================================
// What the measurements suggest doing next.
//
// This is decision SUPPORT. Every recommendation is advisory, addressed to a
// clinician who can see the patient, and carries the measurement that produced
// it so it can be argued with. Nothing here diagnoses, prescribes a drug or a
// dose, orders a procedure, or declares a graft lost.
//
// The rules are deliberately conservative and derive only from what this app
// has actually measured — postoperative day, the traced tissue composition,
// the closure trajectory, the calibration and the photograph's quality. Where
// a recommendation depends on something the app does not know (haemoglobin,
// glycaemic control, arterial supply) it says so and asks, rather than
// assuming.
//
// Pure functions: measurements in, advice out. No database, no clock.
// ============================================================================

/** Advice ordering. 'urgent' is shown first and never collapsed. */
const PRIORITY = { urgent: 0, high: 1, routine: 2, information: 3 };

const isNum = (v) => typeof v === 'number' && Number.isFinite(v);
const pct = (v) => `${Math.round(v * 10) / 10}%`;

/**
 * Thresholds, gathered so they can be reviewed in one place.
 *
 * They are clinical rules of thumb, not derived from this unit's data. They
 * are stated openly so they can be adjusted once there is enough local
 * outcome data to fit them properly.
 */
export const RECOMMENDATION_THRESHOLDS = {
  /** Slough above this fraction of the surface is worth acting on. */
  sloughPct: 20,
  /** Any necrotic tissue matters; this is the level that makes it the priority. */
  necroticPct: 10,
  /** A donor site is usually epithelialized by about this postoperative day. */
  donorExpectedHealedByPod: 21,
  /** Below this rate a donor site is not closing usefully. */
  stalledPctPerDay: 1,
  /** Graft take below this by the first dressing warrants review. */
  poorTakePct: 70,
  /** Days after which an unphotographed site is overdue. */
  photographIntervalDays: 7,
};

/**
 * Recommendations for one site, from its latest photograph and its series.
 *
 * @param {object} input
 * @param {'recipient'|'donor'} input.siteRole
 * @param {number|null} input.postoperativeDay
 * @param {number|null} input.closurePct      take, or re-epithelialization
 * @param {object|null} input.composition     { granulation, slough, necrotic, epithelial } as percentages
 * @param {object|null} input.trend           from classifyTrend
 * @param {object|null} input.rate            from healingRate
 * @param {object|null} input.prediction      from predictCompletion
 * @param {boolean} input.exceededBaseline
 * @param {number|null} input.daysSinceLastPhotograph
 * @param {number|null} input.imageQualityScore
 * @param {boolean} input.scaleReliable
 */
export function recommendationsFor(input) {
  const {
    siteRole = 'donor', postoperativeDay = null, closurePct = null,
    composition = null, trend = null, rate = null, prediction = null,
    exceededBaseline = false, daysSinceLastPhotograph = null,
    imageQualityScore = null, scaleReliable = true,
  } = input || {};

  const T = RECOMMENDATION_THRESHOLDS;
  const out = [];
  const site = siteRole === 'recipient' ? 'graft' : 'donor site';

  /**
   * Every recommendation carries the measurement that produced it, so a
   * clinician can disagree with the reasoning rather than only the advice.
   * A caller that supplies an empty or one-word reason gets the fallback
   * rather than a basis line that explains nothing.
   */
  const add = (priority, code, text, basis, fallback) => {
    const usable = typeof basis === 'string' && basis.trim().length > 5
      ? basis.trim()
      : (fallback || 'Derived from the measurements on the latest photograph.');
    out.push({ priority, code, text, basis: usable });
  };

  // -- Things that need looking at today ------------------------------------

  if (exceededBaseline) {
    add('urgent', 'breakdown_beyond_baseline',
      `The open area of the ${site} now exceeds the area recorded at baseline. `
      + 'Photographic features are concerning for breakdown beyond the original margin. '
      + 'Clinical assessment is recommended before the next dressing.',
      'Traced open area is larger than the locked baseline area.');
  }

  if (trend && trend.trend === 'deteriorating') {
    add('urgent', 'deteriorating',
      `Automated trend analysis shows the ${site} is losing ground. Reassess for infection, `
      + 'pressure or shear on the site, and adequacy of the dressing regimen.',
      trend.reason, 'The measured closure trajectory is falling.');
  }

  if (composition && isNum(composition.necrotic) && composition.necrotic >= T.necroticPct) {
    add('urgent', 'necrotic_tissue',
      `${pct(composition.necrotic)} of the surface was traced as necrotic tissue or eschar. `
      + 'Necrotic tissue will not epithelialize and is a focus for infection. '
      + 'Consider whether debridement is appropriate, and by whom.',
      `Traced necrotic area ${pct(composition.necrotic)} of the site.`);
  }

  // -- The wound bed --------------------------------------------------------

  if (composition && isNum(composition.slough) && composition.slough >= T.sloughPct) {
    add('high', 'slough_burden',
      `${pct(composition.slough)} of the surface was traced as slough or fibrin. `
      + 'Epithelium does not advance across slough. Consider debridement — sharp, '
      + 'autolytic or enzymatic as the bed and the patient allow — and a dressing '
      + 'that supports it.',
      `Traced slough ${pct(composition.slough)} of the site.`);
  }

  if (composition && isNum(composition.granulation) && composition.granulation >= 60
      && (!isNum(composition.slough) || composition.slough < T.sloughPct)
      && (!isNum(composition.necrotic) || composition.necrotic < T.necroticPct)) {
    add('information', 'healthy_bed',
      `The bed is largely granulating (${pct(composition.granulation)}) with little slough `
      + 'or necrosis. Protect it: moist wound healing, atraumatic dressing changes, and '
      + 'nothing that disturbs the advancing edge.',
      `Traced granulation ${pct(composition.granulation)} of the site.`);
  }

  // -- Trajectory -----------------------------------------------------------

  const stalled = rate && rate.ok && isNum(rate.pctPerDay) && rate.pctPerDay < T.stalledPctPerDay;

  if (siteRole === 'donor' && stalled && isNum(closurePct) && closurePct < 90) {
    add('high', 'stalled_donor',
      'Re-epithelialization has slowed below the rate expected of a donor site. '
      + 'A stalled donor site is usually one of: infection, repeated dressing trauma, '
      + 'pressure, or a systemic factor. Review the dressing interval and technique, and '
      + 'consider whether nutrition, anaemia or glycaemic control need attention — none '
      + 'of which this app can see.',
      rate.basis ? `Closing ${pct(rate.pctPerDay)} a day over ${rate.basis}.` : null,
      `Measured closure rate ${pct(rate.pctPerDay)} a day, below the 1% expected.`);
  }

  if (siteRole === 'donor' && isNum(postoperativeDay)
      && postoperativeDay > T.donorExpectedHealedByPod
      && isNum(closurePct) && closurePct < 90) {
    add('high', 'donor_overdue',
      `This donor site is ${postoperativeDay} days old and ${pct(closurePct)} epithelialized. `
      + `Most split-thickness donor sites are closed by about day ${T.donorExpectedHealedByPod}. `
      + 'Consider swabbing if infection is suspected, and review whether the depth of harvest '
      + 'or a systemic factor explains the delay.',
      `POD ${postoperativeDay} at ${pct(closurePct)}.`);
  }

  if (siteRole === 'recipient' && isNum(closurePct) && isNum(postoperativeDay)
      && postoperativeDay >= 5 && closurePct < T.poorTakePct) {
    add('high', 'poor_take',
      `Estimated take is ${pct(closurePct)} at day ${postoperativeDay}. Review the bed for `
      + 'haematoma, seroma, shear or infection — the four things that lift a graft — and '
      + 'consider whether the unhealed area will need regrafting once the bed is ready.',
      `Traced take ${pct(closurePct)} at POD ${postoperativeDay}.`);
  }

  if (siteRole === 'recipient' && isNum(postoperativeDay) && postoperativeDay <= 5) {
    add('routine', 'early_graft_care',
      'In the first few days a graft is held by fibrin and new vessels, both of which shear '
      + 'easily. Keep the dressing undisturbed unless there is reason to look, immobilise '
      + 'the part, and avoid pressure over the graft.',
      `POD ${postoperativeDay}.`);
  }

  // -- Systemic factors the app cannot measure ------------------------------

  const slowAnywhere = stalled
    || (trend && ['delayed', 'deteriorating'].includes(trend.trend));

  if (slowAnywhere) {
    add('routine', 'systemic_review',
      'Healing that is slower than expected is often systemic rather than local. '
      + 'Worth checking: protein and calorie intake, haemoglobin, glycaemic control, '
      + 'smoking, and perfusion of the limb. This app measures none of these — they have '
      + 'to be looked for.',
      'Raised because the measured trajectory is below expectation.');
  }

  // -- Photography ----------------------------------------------------------

  if (isNum(daysSinceLastPhotograph) && daysSinceLastPhotograph > T.photographIntervalDays) {
    add('routine', 'overdue_photograph',
      `No photograph for ${daysSinceLastPhotograph} days. The trajectory and the projected `
      + 'healing date are only as current as the last photograph.',
      `Last photographed ${daysSinceLastPhotograph} days ago.`);
  }

  if (!scaleReliable) {
    add('routine', 'no_calibration',
      'The most recent photograph had no reliable scale, so its area is not in real units '
      + 'and cannot be compared with the others. Recapture with the calibration marker flat '
      + 'in the plane of the wound.',
      'No calibration marker resolved on the latest photograph.');
  } else if (isNum(imageQualityScore) && imageQualityScore < 0.6) {
    add('routine', 'image_quality',
      'The most recent photograph scored poorly for quality. Better light, a steadier hand '
      + 'and the whole wound in frame will make the next measurement more reliable.',
      `Image quality ${Math.round(imageQualityScore * 100)}%.`);
  }

  // -- What to expect -------------------------------------------------------

  if (prediction && prediction.ok && prediction.predictedDay != null && !prediction.alreadyComplete) {
    const range = prediction.predictedRange
      ? ` (${prediction.predictedRange[0]}–${prediction.predictedRange[1]})`
      : '';
    add('information', 'projection',
      `On the measured trajectory this ${site} would be closed about day `
      + `${prediction.predictedDay}${range}. That is a straight-line projection of the `
      + 'photographs, not a validated prediction — it moves with every new one.',
      prediction.basis, 'Extrapolated from the measured photographic series.');
  }

  return out.sort((a, b) => PRIORITY[a.priority] - PRIORITY[b.priority]);
}

/**
 * General measures that apply to any healing wound.
 *
 * Kept apart from the triggered advice above so a clinician can tell what the
 * app noticed from what it always says. Shown collapsed by default.
 */
export const GENERAL_HEALING_MEASURES = [
  {
    area: 'Nutrition',
    text: 'Healing is expensive. Adequate protein and calories, and correction of anaemia, '
        + 'do more for a stalled wound than most dressings.',
  },
  {
    area: 'Glycaemic control',
    text: 'Hyperglycaemia impairs neutrophil function and collagen synthesis. Worth reviewing '
        + 'in any diabetic patient whose wound is not progressing.',
  },
  {
    area: 'Perfusion',
    text: 'A wound cannot heal on a limb that is not perfused. Check pulses, and consider '
        + 'vascular assessment where an ulcer is slow and the foot is cool.',
  },
  {
    area: 'Pressure and shear',
    text: 'Offload the site. Repeated pressure or shear undoes healing faster than any '
        + 'dressing restores it, and is the commonest reason a sacral or heel wound stalls.',
  },
  {
    area: 'Moisture balance',
    text: 'A bed that is too dry will not epithelialize; one that is too wet macerates the '
        + 'margin. Match the dressing to the exudate rather than to habit.',
  },
  {
    area: 'Infection',
    text: 'Increasing pain, spreading erythema, new slough or an arrest in progress are the '
        + 'signs worth acting on. Swab when the picture changes, not routinely.',
  },
  {
    area: 'Smoking',
    text: 'Smoking measurably reduces graft take and delays donor-site healing. Cessation '
        + 'support is worth offering at every encounter.',
  },
  {
    area: 'Dressing technique',
    text: 'Atraumatic removal protects the advancing edge. A donor site left undisturbed '
        + 'usually epithelializes faster than one inspected daily.',
  },
];

export default { recommendationsFor, GENERAL_HEALING_MEASURES, RECOMMENDATION_THRESHOLDS };
