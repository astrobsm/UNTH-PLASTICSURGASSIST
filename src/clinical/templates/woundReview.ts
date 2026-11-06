/**
 * Wound care review — any acute or chronic wound, whatever its cause.
 * Structured on the TIME / TIMERS framework (Tissue, Infection/Inflammation,
 * Moisture, Edge, Repair/Regeneration, Social factors), the IWII 2022 wound
 * infection continuum, and the PUSH healing score.
 */
import { ans, bradenQuestions, bradenScore, has, multi, n, num, sel, text } from './common';
import type { Answers, FlagRule, PlanRule, ScoreDef, TemplateSection } from './types';

const W = 'wound_hx', MSR = 'measure', BED = 'bed', INF = 'infection', MX = 'manage';

export const woundSections = (): TemplateSection[] => [
  {
    id: W, title: 'Wound history',
    questions: [
      sel('aetiology', 'Aetiology', ['Diabetic foot ulcer', 'Pressure injury', 'Venous leg ulcer', 'Arterial ulcer', 'Mixed arterial / venous', 'Traumatic / laceration', 'Burn', 'Surgical wound / dehiscence', 'Post-debridement wound', 'Necrotising infection wound', 'Malignant / fungating wound', 'Marjolin ulcer (suspected)', 'Pyoderma / inflammatory', 'Sickle cell ulcer', 'Snake / animal bite', 'Buruli ulcer', 'Other'], { required: true, redFlags: ['Marjolin ulcer (suspected)'] }),
      text('site', 'Anatomical site', { required: true }),
      num('duration_wk', 'Duration', 'weeks', { required: true }),
      sel('trajectory', 'Trajectory since last review', ['First review', 'Improving', 'Static', 'Deteriorating'], { required: true, redFlags: ['Deteriorating'] }),
      multi('prev_tx', 'Treatment so far', ['None', 'Saline / gauze', 'Honey', 'Silver', 'Iodine (povidone / cadexomer)', 'Hydrocolloid', 'Foam', 'Alginate / hydrofibre', 'NPWT', 'Compression', 'Surgical debridement', 'Skin graft', 'Traditional / herbal applications']),
      sel('chronic_flag', 'Non-healing > 3 months or atypical appearance', ['No', 'Yes — biopsy edge to exclude malignancy'], { redFlags: ['Yes — biopsy edge to exclude malignancy'] }),
    ],
  },
  {
    id: MSR, title: 'Measurements',
    subtitle: 'Length (head–toe) × width at right angles × depth; photograph with a scale. Use the Wound Monitor for planimetry.',
    questions: [
      num('length', 'Length', 'cm', { required: true }),
      num('width', 'Width', 'cm', { required: true }),
      num('depth', 'Depth', 'cm'),
      num('prev_area', 'Area at previous review', 'cm²', { hint: 'For the healing trajectory' }),
      num('baseline_area', 'Area at first review', 'cm²'),
      text('undermining', 'Undermining (clock position and depth)'),
      text('tunnelling', 'Tunnelling / sinus (clock position and depth)'),
      sel('photo', 'Photograph taken', ['Yes', 'No']),
    ],
  },
  {
    id: BED, title: 'Tissue, moisture and edge (TIME)',
    questions: [
      num('granulation', 'Granulation', '%', { required: true }),
      num('slough', 'Slough', '%', { required: true }),
      num('necrosis', 'Necrosis / eschar', '%', { required: true }),
      num('epithelial', 'Epithelialisation', '%'),
      multi('exposed', 'Exposed structures', ['None', 'Tendon', 'Bone', 'Joint', 'Hardware', 'Vessel', 'Fascia'], { redFlags: ['Bone', 'Joint', 'Hardware', 'Vessel'] }),
      sel('exudate_amt', 'Exudate amount', ['None', 'Light', 'Moderate', 'Heavy'], { required: true }),
      sel('exudate_type', 'Exudate type', ['Serous', 'Serosanguineous', 'Haemoserous', 'Purulent', 'Green (Pseudomonas)'], { redFlags: ['Purulent', 'Green (Pseudomonas)'] }),
      sel('odour', 'Odour after cleansing', ['None', 'Faint', 'Offensive'], { redFlags: ['Offensive'] }),
      sel('edge', 'Wound edge', ['Advancing / attached', 'Rolled (epibole)', 'Undermined', 'Macerated', 'Callused', 'Raised / everted (? malignancy)'], { required: true, redFlags: ['Raised / everted (? malignancy)'] }),
      multi('periwound', 'Periwound skin', ['Healthy', 'Erythema', 'Maceration', 'Excoriation', 'Dry / scaly', 'Oedema', 'Induration', 'Callus', 'Lipodermatosclerosis', 'Varicose eczema'], { required: true }),
    ],
  },
  {
    id: INF, title: 'Infection (IWII 2022 continuum)',
    questions: [
      multi('local_covert', 'Local — covert (subtle) signs', ['None', 'Hypergranulation', 'Friable bleeding granulation', 'Epithelial bridging / pocketing', 'Increasing exudate', 'Increasing malodour', 'New / increasing pain', 'Delayed healing beyond expectation']),
      multi('local_overt', 'Local — overt (classic) signs', ['None', 'Erythema', 'Warmth', 'Swelling', 'Purulent discharge', 'Wound breakdown / enlargement', 'New ulceration / satellite areas'], { redFlags: ['Purulent discharge', 'Wound breakdown / enlargement'] }),
      multi('spreading', 'Spreading infection', ['None', 'Erythema > 2 cm from the edge', 'Lymphangitis', 'Crepitus', 'Wound breakdown with satellite lesions'], { redFlags: ['Erythema > 2 cm from the edge', 'Lymphangitis', 'Crepitus'] }),
      multi('systemic', 'Systemic infection', ['None', 'Fever > 38 °C', 'Rigors', 'Tachycardia', 'Hypotension', 'Confusion', 'Raised WCC / CRP'], { redFlags: ['Fever > 38 °C', 'Rigors', 'Tachycardia', 'Hypotension', 'Confusion'] }),
      sel('swab', 'Swab / tissue culture', ['Not indicated', 'Taken today (Levine technique)', 'Result available (note)']),
      text('swab_result', 'Culture result', { showIf: { q: 'swab', in: ['Result available (note)'] } }),
    ],
  },
  {
    id: 'perfusion', title: 'Perfusion and pain',
    questions: [
      sel('pulses', 'Distal pulses (limb wounds)', ['Palpable', 'Reduced', 'Absent', 'Not applicable'], { redFlags: ['Absent'] }),
      num('abpi', 'ABPI', '', { hint: '< 0.8 — avoid full compression; < 0.5 — urgent vascular referral' }),
      sel('oedema', 'Limb oedema', ['None', 'Pitting', 'Non-pitting / lymphoedema']),
      num('pain_wound', 'Pain at rest', '/10', { required: true }),
      num('pain_dressing', 'Pain at dressing change', '/10'),
      sel('pain_type', 'Pain character', ['Nociceptive', 'Neuropathic (burning / shooting)', 'Ischaemic (rest pain, worse on elevation)', 'Procedural only'], { redFlags: ['Ischaemic (rest pain, worse on elevation)'] }),
      ...bradenQuestions(),
    ],
  },
  {
    id: MX, title: 'Management today',
    questions: [
      multi('cleansing', 'Cleansing', ['Normal saline', 'Potable water', 'Antiseptic solution (PHMB / hypochlorous / octenidine)', 'Povidone-iodine soak']),
      multi('debridement', 'Debridement today', ['None', 'Mechanical (monofilament pad)', 'Sharp (conservative)', 'Autolytic', 'Larval', 'Refer for surgical debridement']),
      multi('primary', 'Primary dressing', ['Non-adherent contact layer', 'Hydrogel', 'Hydrocolloid', 'Alginate', 'Hydrofibre', 'Foam', 'Silver', 'Iodine', 'Medical honey', 'PHMB', 'Paraffin gauze', 'Collagen / matrix']),
      multi('secondary', 'Secondary / adjuncts', ['Absorbent pad', 'Retention bandage', 'Compression (multilayer)', 'NPWT', 'Offloading device', 'Barrier film on periwound']),
      num('npwt_pressure', 'NPWT pressure', 'mmHg', { showIf: { q: 'secondary', in: ['NPWT'] } }),
      sel('frequency', 'Change frequency', ['Daily', 'Alternate days', 'Twice weekly', 'Weekly', 'NPWT: every 48–72 h'], { required: true }),
      sel('who_dresses', 'Who will dress it', ['Ward nurse', 'Outpatient dressing clinic', 'Patient / family at home', 'Primary health centre']),
      sel('goal', 'Goal of care', ['Healing', 'Prepare the bed for graft / flap', 'Maintenance (non-healable)', 'Palliative / symptom control'], { required: true }),
    ],
  },
];

export const woundArea = (a: Answers): number | null => {
  const l = n(a, MSR, 'length'), w = n(a, MSR, 'width');
  return l && w ? Math.round(l * w * 0.785 * 10) / 10 : null; // ellipse approximation
};

/** PUSH Tool 3.0 (NPUAP 1998): area 0–10, exudate 0–3, tissue type 0–4. */
export const pushScore: ScoreDef = {
  id: 'push', label: 'PUSH', reference: 'NPUAP Pressure Ulcer Scale for Healing 3.0',
  compute: (a) => {
    const l = n(a, MSR, 'length'), w = n(a, MSR, 'width');
    const ex = ans(a, BED, 'exudate_amt');
    if (!l || !w || !ex) return null;
    const area = l * w;
    const cuts = [0, 0.3, 0.6, 1.0, 2.0, 3.0, 4.0, 8.0, 12.0, 24.0];
    let aScore = 0;
    if (area > 0) aScore = 1 + cuts.slice(1).filter(c => area > c).length;
    aScore = Math.min(aScore, 10);
    const eScore = ({ None: 0, Light: 1, Moderate: 2, Heavy: 3 } as Record<string, number>)[ex] ?? 0;
    const nec = n(a, BED, 'necrosis') ?? 0, sl = n(a, BED, 'slough') ?? 0, gr = n(a, BED, 'granulation') ?? 0, ep = n(a, BED, 'epithelial') ?? 0;
    const tScore = nec > 0 ? 4 : sl > 0 ? 3 : gr > 0 ? 2 : ep > 0 ? 1 : 0;
    const s = aScore + eScore + tScore;
    return { value: `${s}/17`, band: 'Lower is better — track the trend', tone: s >= 12 ? 'danger' : s >= 7 ? 'warn' : 'ok', detail: `area ${aScore}, exudate ${eScore}, tissue ${tScore}` };
  },
};

export const areaScore: ScoreDef = {
  id: 'area', label: 'Area', reference: 'Ellipse method (L × W × 0.785); ≥ 40–50% reduction at 4 weeks predicts healing (Sheehan 2003)',
  compute: (a) => {
    const area = woundArea(a);
    if (area === null) return null;
    const prev = n(a, MSR, 'baseline_area') ?? n(a, MSR, 'prev_area');
    if (!prev) return { value: `${area} cm²`, band: 'Baseline', tone: 'info' };
    const change = Math.round(((prev - area) / prev) * 100);
    return { value: `${area} cm²`, band: change >= 0 ? `${change}% smaller than baseline` : `${-change}% larger than baseline`, tone: change >= 40 ? 'ok' : change >= 0 ? 'warn' : 'danger' };
  },
};

const any = (a: Answers, s: string, id: string) => ((ans(a, s, id) || []) as string[]).some(x => x !== 'None');
export const infectionLevel = (a: Answers): 'none' | 'local' | 'spreading' | 'systemic' | null => {
  const answered = ['local_covert', 'local_overt', 'spreading', 'systemic'].some(k => ans(a, INF, k) !== undefined);
  if (!answered) return null;
  if (any(a, INF, 'systemic')) return 'systemic';
  if (any(a, INF, 'spreading')) return 'spreading';
  if (any(a, INF, 'local_overt') || any(a, INF, 'local_covert')) return 'local';
  return 'none';
};

export const infectionScore: ScoreDef = {
  id: 'iwii', label: 'Infection (IWII)', reference: 'International Wound Infection Institute 2022',
  compute: (a) => {
    const l = infectionLevel(a);
    if (!l) return null;
    return {
      none: { value: 'None', band: 'Contamination / colonisation only', tone: 'ok' as const },
      local: { value: 'Local', band: 'Topical antimicrobial, cleanse, debride', tone: 'warn' as const },
      spreading: { value: 'Spreading', band: 'Systemic antibiotics + topical', tone: 'danger' as const },
      systemic: { value: 'Systemic', band: 'Sepsis pathway — IV antibiotics, surgical review', tone: 'danger' as const },
    }[l];
  },
};

export const woundScores: ScoreDef[] = [areaScore, pushScore, infectionScore, bradenScore('perfusion')];

export const woundFlags: FlagRule[] = [
  { severity: 'urgent', text: 'Systemic infection — start the sepsis pathway, blood cultures, IV antibiotics and urgent surgical review', when: (a) => infectionLevel(a) === 'systemic' },
  { severity: 'urgent', text: 'Crepitus — exclude necrotising soft-tissue infection (surgical emergency)', when: (a) => has(a, INF, 'spreading', 'Crepitus') },
  { severity: 'urgent', text: 'Absent pulses / ABPI < 0.5 — urgent vascular referral; no compression', when: (a) => has(a, 'perfusion', 'pulses', 'Absent') || ((n(a, 'perfusion', 'abpi') ?? 1) < 0.5) },
  { severity: 'warning', text: 'Chronic or atypical wound — biopsy the edge to exclude malignancy (Marjolin ulcer)', when: (a) => has(a, W, 'chronic_flag', 'Yes — biopsy edge to exclude malignancy') || has(a, BED, 'edge', 'Raised / everted (? malignancy)') || has(a, W, 'aetiology', 'Marjolin ulcer (suspected)') },
  { severity: 'warning', text: 'Wound larger than at baseline — reassess the cause, perfusion, infection and adherence', when: (a) => { const ar = woundArea(a), b = n(a, MSR, 'baseline_area') ?? n(a, MSR, 'prev_area'); return !!ar && !!b && ar > b; } },
];

export const woundPlan: PlanRule[] = [
  { domain: 'Surgical / wound management', text: (a) => `Dressing: ${[...(ans(a, MX, 'primary') || []), ...(ans(a, MX, 'secondary') || [])].join(' + ') || 'as documented'}, changed ${String(ans(a, MX, 'frequency') || 'as documented').toLowerCase()} by ${String(ans(a, MX, 'who_dresses') || 'the ward team').toLowerCase()}`, when: (a) => !!ans(a, MX, 'frequency') },
  { domain: 'Surgical / wound management', text: 'Debride non-viable tissue (slough / necrosis) to a bleeding, healthy bed', why: 'TIME — Tissue', when: (a) => ((n(a, BED, 'slough') ?? 0) + (n(a, BED, 'necrosis') ?? 0)) >= 25 },
  { domain: 'Surgical / wound management', text: 'Plan definitive cover (graft or flap) — refer to the theatre list', when: (a) => has(a, MX, 'goal', 'Prepare the bed for graft / flap') || ((n(a, BED, 'granulation') ?? 0) >= 80 && (n(a, BED, 'slough') ?? 0) <= 10) },
  { domain: 'Surgical / wound management', text: 'Exposed bone / joint / hardware — plan flap cover; NPWT as a bridge', priority: 'urgent', when: (a) => ['Bone', 'Joint', 'Hardware', 'Vessel'].some(x => has(a, BED, 'exposed', x)) },
  { domain: 'Surgical / wound management', text: 'Moisture balance: superabsorbent / alginate and barrier film to protect the periwound', why: 'TIME — Moisture', when: (a) => has(a, BED, 'exudate_amt', 'Heavy') || has(a, BED, 'periwound', 'Maceration') },
  { domain: 'Surgical / wound management', text: 'Edge: refresh rolled / callused edges (sharp debridement)', why: 'TIME — Edge', when: (a) => ['Rolled (epibole)', 'Callused'].includes(ans(a, BED, 'edge')) },
  { domain: 'Infection control and antimicrobials', text: 'Topical antimicrobial dressing (silver / iodine / PHMB / honey) for 2 weeks, then reassess ("2-week challenge")', when: (a) => infectionLevel(a) === 'local' },
  { domain: 'Infection control and antimicrobials', text: 'Systemic antibiotics guided by tissue culture plus topical antimicrobial', priority: 'urgent', when: (a) => ['spreading', 'systemic'].includes(infectionLevel(a) || '') },
  { domain: 'Investigations', kind: 'investigation', text: 'Wound tissue culture / Levine swab after cleansing', when: (a) => ['local', 'spreading', 'systemic'].includes(infectionLevel(a) || '') && !has(a, INF, 'swab', 'Taken today (Levine technique)') },
  { domain: 'Investigations', kind: 'investigation', text: 'FBC, CRP, blood cultures, lactate', priority: 'urgent', when: (a) => infectionLevel(a) === 'systemic' },
  { domain: 'Investigations', kind: 'investigation', text: 'X-ray / MRI for osteomyelitis', when: (a) => has(a, BED, 'exposed', 'Bone') },
  { domain: 'Investigations', kind: 'investigation', text: 'Wound-edge biopsy for histology', when: (a) => has(a, W, 'chronic_flag', 'Yes — biopsy edge to exclude malignancy') || has(a, BED, 'edge', 'Raised / everted (? malignancy)') },
  { domain: 'Investigations', kind: 'investigation', text: 'ABPI / arterial duplex', when: (a) => ['Reduced', 'Absent'].includes(ans(a, 'perfusion', 'pulses')) && n(a, 'perfusion', 'abpi') === null },
  { domain: 'Rehabilitation and function', text: 'Multilayer compression (40 mmHg) with leg elevation', when: (a) => has(a, W, 'aetiology', 'Venous leg ulcer') && (n(a, 'perfusion', 'abpi') ?? 0) >= 0.8 },
  { domain: 'Rehabilitation and function', text: 'Offload the wound completely (positioning schedule / total-contact cast / walker)', when: (a) => ['Diabetic foot ulcer', 'Pressure injury'].includes(ans(a, W, 'aetiology')) },
  { domain: 'Analgesia and comfort', text: 'Pre-dressing analgesia 30–60 min before changes; atraumatic silicone contact layers', when: (a) => (n(a, 'perfusion', 'pain_dressing') ?? 0) >= 4 },
  { domain: 'Analgesia and comfort', text: 'Neuropathic pain agent (amitriptyline / gabapentinoid)', when: (a) => has(a, 'perfusion', 'pain_type', 'Neuropathic (burning / shooting)') },
  { domain: 'Follow-up and safety-netting', text: 'Re-measure and photograph every 2 weeks; if < 40% smaller at 4 weeks, re-evaluate the diagnosis and plan' },
];

export const WOUND_REFS = [
  'Schultz et al. 2003; Atkin et al. 2019 — TIME / TIMERS wound bed preparation',
  'International Wound Infection Institute (IWII) — Wound infection in clinical practice (2022)',
  'NPUAP PUSH Tool 3.0; NPIAP/EPUAP 2019 pressure injury guideline',
  'SIGN 120 — Management of chronic venous leg ulcers',
  'Wounds UK — Best practice statement: wound debridement (2019)',
];
