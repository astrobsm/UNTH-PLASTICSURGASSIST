// ============================================================================
// The validated scar scales, kept apart.
//
// VSS, POSAS and the Detroit Keloid Scale measure overlapping things on
// different scales with different anchors. Merging them into one number would
// destroy the only property that makes them worth using — that each has been
// studied as itself — so they are scored independently here and displayed
// independently. §27.
//
// PROVENANCE PER ITEM
//
// Every item declares where its value has to come from:
//
//   image     — derivable from a calibrated photograph
//   exam      — requires hands on the patient
//   patient   — the patient's own report
//
// This matters because the brief's §27 warns against representing POSAS as
// wholly photographic, and because pliability cannot be palpated through a
// camera. The UI uses these flags to route each item to the right person, and
// the scoring functions refuse to invent a value for an item nobody supplied.
//
// Pure: answers in, scores out. No database, no clock, no image.
// ============================================================================

/** An item a scale is made of. */
// eslint-disable-next-line no-unused-vars
const ITEM = (key, label, min, max, source, anchors) =>
  ({ key, label, min, max, source, anchors });

// ---------------------------------------------------------------------------
// Vancouver Scar Scale
// ---------------------------------------------------------------------------

/**
 * VSS: vascularity, pigmentation, pliability, height. Total 0–13.
 *
 * Pliability is an examination item and stays one — §27 is explicit that it
 * remains physical examination unless independently validated technology is
 * used, and no such technology is wired here.
 */
export const VSS_ITEMS = [
  ITEM('vascularity', 'Vascularity', 0, 3, 'image', [
    'Normal — colour resembling the rest of the body',
    'Pink',
    'Red',
    'Purple',
  ]),
  ITEM('pigmentation', 'Pigmentation', 0, 3, 'image', [
    'Normal — colour resembling the rest of the body',
    'Hypopigmentation',
    'Mixed pigmentation',
    'Hyperpigmentation',
  ]),
  ITEM('pliability', 'Pliability', 0, 5, 'exam', [
    'Normal',
    'Supple — flexible with minimal resistance',
    'Yielding — giving way to pressure',
    'Firm — inflexible, not easily moved, resistant to manual pressure',
    'Banding — rope-like tissue that blanches with extension',
    'Contracture — permanent shortening producing deformity or distortion',
  ]),
  ITEM('height', 'Height / thickness', 0, 3, 'image', [
    'Flat / normal',
    'Less than 2 mm',
    '2 to 5 mm',
    'More than 5 mm',
  ]),
];

export const VSS_MAX = VSS_ITEMS.reduce((s, i) => s + i.max, 0); // 14

// ---------------------------------------------------------------------------
// POSAS v2.0
// ---------------------------------------------------------------------------

/**
 * POSAS observer scale: six items, each 1–10. Total 6–60.
 *
 * 1 is "as normal skin" and 10 is "worst imaginable scar" throughout, which is
 * why the anchors are given as a pair rather than per point.
 */
export const POSAS_OBSERVER_ITEMS = [
  ITEM('vascularity', 'Vascularity', 1, 10, 'image', ['normal skin', 'worst imaginable']),
  ITEM('pigmentation', 'Pigmentation', 1, 10, 'image', ['normal skin', 'worst imaginable']),
  ITEM('thickness', 'Thickness', 1, 10, 'exam', ['normal skin', 'worst imaginable']),
  ITEM('relief', 'Relief (surface irregularity)', 1, 10, 'image', ['normal skin', 'worst imaginable']),
  ITEM('pliability', 'Pliability', 1, 10, 'exam', ['normal skin', 'worst imaginable']),
  ITEM('surfaceArea', 'Surface area', 1, 10, 'image', ['normal skin', 'worst imaginable']),
];

/** POSAS patient scale: six items, each 1–10. Total 6–60. */
export const POSAS_PATIENT_ITEMS = [
  ITEM('pain', 'Is the scar painful?', 1, 10, 'patient', ['no, not at all', 'yes, very much']),
  ITEM('itch', 'Is the scar itching?', 1, 10, 'patient', ['no, not at all', 'yes, very much']),
  ITEM('colour', 'Is the scar colour different?', 1, 10, 'patient', ['no, as normal skin', 'yes, very different']),
  ITEM('stiffness', 'Is the scar stiffer?', 1, 10, 'patient', ['no, as normal skin', 'yes, very much']),
  ITEM('thickness', 'Is the scar thicker?', 1, 10, 'patient', ['no, as normal skin', 'yes, very much']),
  ITEM('irregularity', 'Is the scar more irregular?', 1, 10, 'patient', ['no, as normal skin', 'yes, very much']),
];

/**
 * The single overall-opinion item each POSAS half carries.
 *
 * Scored and reported separately: it is NOT part of the six-item total, and
 * adding it in is a common way of producing a number that cannot be compared
 * with anybody else's POSAS.
 */
export const POSAS_OVERALL = {
  observer: ITEM('overall', 'Overall opinion (observer)', 1, 10, 'exam', ['normal skin', 'worst imaginable']),
  patient: ITEM('overall', 'Overall opinion (patient)', 1, 10, 'patient', ['as normal skin', 'very different']),
};

// ---------------------------------------------------------------------------
// Detroit Keloid Scale
// ---------------------------------------------------------------------------

/**
 * DKS: a keloid-specific instrument covering appearance, symptoms and the
 * functional and psychosocial burden that the older scales omit.
 *
 * Four domains, each 0–3, total 0–12, higher being worse.
 */
export const DKS_ITEMS = [
  ITEM('appearance', 'Appearance / disfigurement', 0, 3, 'image', [
    'Not disfiguring',
    'Mildly disfiguring',
    'Moderately disfiguring',
    'Severely disfiguring',
  ]),
  ITEM('symptoms', 'Symptoms (pain, itch, tenderness)', 0, 3, 'patient', [
    'None',
    'Mild — occasional, not troubling',
    'Moderate — frequent, troubling',
    'Severe — constant, distressing',
  ]),
  ITEM('function', 'Functional impairment', 0, 3, 'exam', [
    'None',
    'Mild — noticeable, no limitation of activity',
    'Moderate — limits some activity',
    'Severe — limits daily activity',
  ]),
  ITEM('psychosocial', 'Psychosocial impact', 0, 3, 'patient', [
    'None',
    'Mild — occasional self-consciousness',
    'Moderate — avoids some situations',
    'Severe — marked distress or avoidance',
  ]),
];

export const DKS_MAX = DKS_ITEMS.reduce((s, i) => s + i.max, 0); // 12

// ---------------------------------------------------------------------------
// Scoring
// ---------------------------------------------------------------------------

export const SCALES = {
  vss: { key: 'vss', name: 'Vancouver Scar Scale', items: VSS_ITEMS, min: 0, max: VSS_MAX, worseIsHigher: true },
  posas_observer: {
    key: 'posas_observer', name: 'POSAS observer', items: POSAS_OBSERVER_ITEMS,
    min: 6, max: 60, worseIsHigher: true, overall: POSAS_OVERALL.observer,
  },
  posas_patient: {
    key: 'posas_patient', name: 'POSAS patient', items: POSAS_PATIENT_ITEMS,
    min: 6, max: 60, worseIsHigher: true, overall: POSAS_OVERALL.patient,
  },
  dks: { key: 'dks', name: 'Detroit Keloid Scale', items: DKS_ITEMS, min: 0, max: DKS_MAX, worseIsHigher: true },
};

/**
 * Scores one scale from the answers supplied.
 *
 * Refuses to total a partly-answered scale. A VSS of 6 built from three items
 * is not a VSS of 6 — it is a VSS of 6-out-of-11-possible, which nobody else's
 * VSS can be compared with. `complete` says which it is, and `total` is null
 * unless every item was answered.
 */
export function scoreScale(scaleKey, answers) {
  const scale = SCALES[scaleKey];
  if (!scale) return { ok: false, reason: `Unknown scale: ${scaleKey}` };

  const given = answers || {};
  const items = [];
  const missing = [];
  let total = 0;

  for (const item of scale.items) {
    const raw = given[item.key];
    if (raw === null || raw === undefined || raw === '') {
      missing.push(item.key);
      items.push({ ...item, value: null });
      continue;
    }
    const v = Number(raw);
    if (!Number.isFinite(v) || v < item.min || v > item.max) {
      return {
        ok: false,
        reason: `${scale.name}: "${item.label}" must be between ${item.min} and ${item.max}.`,
      };
    }
    total += v;
    items.push({ ...item, value: v });
  }

  const complete = missing.length === 0;

  // The overall-opinion item, where the scale has one, reported apart from the
  // total because it is not part of it.
  let overall = null;
  if (scale.overall) {
    const raw = given.overall;
    if (raw !== null && raw !== undefined && raw !== '') {
      const v = Number(raw);
      if (!Number.isFinite(v) || v < scale.overall.min || v > scale.overall.max) {
        return { ok: false, reason: `${scale.name}: overall opinion must be ${scale.overall.min}–${scale.overall.max}.` };
      }
      overall = v;
    }
  }

  return {
    ok: true,
    scale: scale.key,
    name: scale.name,
    items,
    total: complete ? total : null,
    partialTotal: total,
    min: scale.min,
    max: scale.max,
    complete,
    missing,
    overall,
    // Worse-is-higher on all of these, said explicitly so a trend engine does
    // not have to know each scale's direction.
    worseIsHigher: scale.worseIsHigher,
  };
}

/** What each scale needs, and from whom — for the completeness indicator (§56). */
export function scaleRequirements(scaleKey) {
  const scale = SCALES[scaleKey];
  if (!scale) return null;
  const by = { image: [], exam: [], patient: [] };
  for (const i of scale.items) by[i.source].push(i.label);
  return { scale: scale.key, name: scale.name, bySource: by };
}

/**
 * The change in a score between two assessments.
 *
 * Direction is reported in clinical terms rather than arithmetic ones: on
 * every scale here a falling number is improvement, and a reader should not
 * have to remember that.
 */
export function scoreChange(scaleKey, previousTotal, currentTotal) {
  const scale = SCALES[scaleKey];
  if (!scale) return null;
  if (!Number.isFinite(previousTotal) || !Number.isFinite(currentTotal)) {
    return { ok: false, reason: 'Both assessments must have a complete score to be compared.' };
  }
  const delta = currentTotal - previousTotal;
  const improving = scale.worseIsHigher ? delta < 0 : delta > 0;
  return {
    ok: true,
    scale: scale.key,
    previousTotal,
    currentTotal,
    delta,
    direction: delta === 0 ? 'unchanged' : (improving ? 'improved' : 'worsened'),
    // As a proportion of the usable range, so a 3-point DKS move and a 3-point
    // POSAS move are not read as the same size of change.
    proportionOfRange: Math.round((Math.abs(delta) / (scale.max - scale.min)) * 1000) / 10,
  };
}

export default {
  SCALES, VSS_ITEMS, POSAS_OBSERVER_ITEMS, POSAS_PATIENT_ITEMS, DKS_ITEMS,
  POSAS_OVERALL, VSS_MAX, DKS_MAX, scoreScale, scaleRequirements, scoreChange,
};
