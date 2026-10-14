// ============================================================================
// Starting drafts for postoperative monitoring profiles (decision D3).
//
// These are DRAFTS for the unit to edit and approve on the Monitoring
// Protocols page. They were assembled from widely used published guidance and
// common surgical/nursing practice; they are not the unit's protocol until a
// named approver (D1) approves them. Sources are listed per profile with
// `verified: false` — each citation must be checked by the approver before
// approval. Free-flap monitoring in particular has no single universal
// standard: frequencies here are the commonly reported pattern and the unit's
// own practice should replace them where it differs.
//
// Triggers are descriptive text in this version. They are shown to staff and
// are NOT executed as automatic alerts; executable rules come in Phase 6 and
// will also require approval.
// ============================================================================

const NEWS2 = { citation: 'Royal College of Physicians. National Early Warning Score (NEWS) 2: Standardising the assessment of acute-illness severity in the NHS. London: RCP; 2017.', note: 'Observation frequency by aggregate score; escalation thresholds.', verified: false };
const NICE_CG50 = { citation: 'NICE CG50. Acutely ill adults in hospital: recognising and responding to deterioration. 2007.', note: 'Minimum observations, track-and-trigger.', verified: false };
const NICE_NG89 = { citation: 'NICE NG89. Venous thromboembolism in over 16s: reducing the risk of hospital-acquired DVT or PE. 2018 (updated 2019).', note: 'VTE risk assessment on admission and review.', verified: false };
const PRACTICE = (what) => ({ citation: `Common surgical / nursing practice: ${what}.`, note: 'No single published standard — replace with the unit\'s practice.', verified: false });

const VITALS_PHASES = [
  { label: 'Arrival on ward – 1 h', from_hours: 0, to_hours: 1 },
  { label: '1 – 4 h', from_hours: 1, to_hours: 4 },
  { label: '4 – 24 h', from_hours: 4, to_hours: 24 },
  { label: 'After 24 h', from_hours: 24, to_hours: null },
];
const vitalsRows = [
  { key: 'news2_vitals', label: 'Full observations (RR, SpO₂, O₂, BP, HR, consciousness, temperature) with NEWS2', method: 'Observation chart', frequency: ['Every 15 min', 'Every 30 min', 'Hourly', '4-hourly (or per NEWS2 score)'], notes: 'Increase frequency by NEWS2: 1–4 → at least 4–6-hourly; 3 in one parameter or 5–6 → at least hourly; ≥7 → continuous.' },
  { key: 'pain', label: 'Pain score (0–10) and sedation', method: 'Numeric rating scale', frequency: ['Every 15 min', 'Every 30 min', '2-hourly', '4-hourly'], notes: '' },
  { key: 'wound_dressing', label: 'Wound / dressing (bleeding, strike-through, swelling)', method: 'Inspection', frequency: ['Every 15 min', 'Every 30 min', '2-hourly', '4-hourly'], notes: '' },
  { key: 'drains', label: 'Each drain: volume and character (record per drain)', method: 'Drain chart', frequency: ['Every 15 min', 'Hourly', '4-hourly', '8-hourly'], notes: 'Record each drain separately (D1, D2…).' },
  { key: 'fluid_balance', label: 'Fluid balance and urine output', method: 'Fluid chart', frequency: ['Hourly', 'Hourly', '4-hourly', '8-hourly'], notes: 'Target urine output ≥ 0.5 mL/kg/h unless the profile states otherwise.' },
  { key: 'ponv', label: 'Nausea / vomiting', method: 'Ask', frequency: ['With observations', 'With observations', '4-hourly', '8-hourly'], notes: '' },
];
const GENERAL_RED = [
  'NEWS2 aggregate ≥ 7, or as defined by the unit\'s approved early-warning rule',
  'Airway compromise, SpO₂ falling despite oxygen, or reduced consciousness (new confusion, V/P/U)',
  'Systolic BP ≤ 90 mmHg or HR ≥ 131/min (NEWS2 3-point bands)',
  'Active bleeding: rapidly filling drain, expanding swelling, soaked dressing',
];
const GENERAL_AMBER = [
  'NEWS2 aggregate 5–6, or 3 in any single parameter',
  'Urine output below target for 2 consecutive hours',
  'Temperature ≥ 38.0 °C, or pain not controlled by the prescribed analgesia',
  'Required observation overdue',
];
const GENERAL_ESCALATION = [
  'Red: call the on-call registrar immediately and the responsible senior; consider rapid-response team; record time of call and response.',
  'Amber: inform the house officer / registrar on call within 30 minutes; increase observation frequency; reassess within 1 hour.',
  'Document every escalation (who, when, response) on the patient\'s record.',
];

const base = (overrides) => ({
  phases: VITALS_PHASES,
  parameters: vitalsRows,
  expected_progress: [],
  amber_triggers: GENERAL_AMBER,
  red_triggers: GENERAL_RED,
  escalation: GENERAL_ESCALATION,
  ...overrides,
});

export const MONITORING_PROFILE_DRAFTS = [
  {
    id: 'postop.general',
    title: 'General postoperative care',
    definition: base({
      summary: 'Default observations after any operation, until a procedure-specific profile is applied.',
      applies_to: 'All operations',
      expected_progress: [
        'Observations return to the patient\'s baseline within 24 h',
        'Pain controlled (score ≤ 3 at rest) on oral analgesia by day 1–2',
        'Eating and drinking, passing urine, mobilising as planned',
        'VTE risk assessed on admission and re-assessed after surgery',
      ],
    }),
    sources: [NEWS2, NICE_CG50, NICE_NG89, PRACTICE('15-min / 30-min / hourly / 4-hourly step-down after return from theatre')],
  },
  {
    id: 'postop.skin_graft',
    title: 'Split- / full-thickness skin graft',
    definition: base({
      summary: 'Graft and donor-site care after skin grafting. Graft take depends on immobility and freedom from haematoma, seroma and infection.',
      applies_to: 'STSG, FTSG (non-burn)',
      parameters: [
        ...vitalsRows.slice(0, 2),
        { key: 'graft_dressing', label: 'Graft dressing: bleeding, strike-through, odour, displacement', method: 'Inspection without removing the dressing', frequency: ['Every 30 min', 'Hourly', '4-hourly', 'Daily'], notes: 'Do not take down the dressing before the planned first inspection unless there are warning signs.' },
        { key: 'graft_inspection', label: 'Graft inspection: adherence/take %, haematoma, seroma, infection, loss', method: 'First dressing take-down', frequency: ['—', '—', '—', 'Day 3–5 (day 5–7 if bolster/tie-over), then per plan'], notes: 'Record take as % of grafted area (links to the Skin Graft module).' },
        { key: 'donor_site', label: 'Donor site: pain, exudate/soakage, dressing condition, epithelialisation', method: 'Inspection', frequency: ['Hourly', '2-hourly', '4-hourly', 'Daily; leave dressing ~10–14 days unless soaked or infected'], notes: '' },
        { key: 'immobilisation', label: 'Immobilisation / splint / elevation in place', method: 'Check', frequency: ['With observations', 'With observations', '4-hourly', 'Each shift'], notes: '' },
      ],
      expected_progress: [
        'Graft adherent and pink at first inspection; take ≥ 90% expected for a well-prepared bed',
        'Donor site epithelialised by ~10–14 days (split-thickness)',
      ],
      amber_triggers: [...GENERAL_AMBER, 'Offensive odour or purulent strike-through from graft dressing', 'Dressing displaced or immobilisation lost', 'Donor dressing soaked through'],
      red_triggers: [...GENERAL_RED, 'Expanding haematoma under the graft'],
    }),
    sources: [NEWS2, PRACTICE('first graft inspection at day 3–5; donor dressing left 10–14 days')],
  },
  {
    id: 'postop.local_flap',
    title: 'Local or regional (pedicled) flap',
    definition: base({
      summary: 'Flap perfusion checks for local and pedicled flaps.',
      applies_to: 'Local, regional and pedicled flaps',
      parameters: [
        ...vitalsRows,
        { key: 'flap_check', label: 'Flap: colour, capillary refill, temperature, turgor, bleeding', method: 'Bedside clinical check (compare with documented baseline)', frequency: ['Every 30 min', 'Hourly', '2-hourly', '4-hourly to day 3, then daily'], notes: 'Avoid pressure or tight dressings over the pedicle.' },
      ],
      expected_progress: ['Flap pink, warm, soft with capillary refill about 2 seconds throughout', 'No pedicle compression'],
      red_triggers: [...GENERAL_RED, 'Flap pale/white, cool, refill absent (arterial) — or dusky/blue, tense, brisk refill (venous)'],
      amber_triggers: [...GENERAL_AMBER, 'Flap colour or refill different from baseline but not clearly compromised', 'Tension, swelling or haematoma near the pedicle'],
    }),
    sources: [NEWS2, PRACTICE('clinical flap checks hourly for 24 h, then 2–4-hourly')],
  },
  {
    id: 'postop.free_flap',
    title: 'Free tissue transfer (free flap)',
    definition: base({
      summary: 'Intensive flap monitoring after microvascular free tissue transfer. Most compromise occurs in the first 24–48 h, and salvage depends on early recognition and return to theatre.',
      applies_to: 'All free flaps',
      phases: [
        { label: '0 – 24 h', from_hours: 0, to_hours: 24 },
        { label: '24 – 48 h', from_hours: 24, to_hours: 48 },
        { label: '48 – 72 h', from_hours: 48, to_hours: 72 },
        { label: 'Day 4 – 5', from_hours: 72, to_hours: 120 },
      ],
      parameters: [
        { key: 'news2_vitals', label: 'Full observations with NEWS2; keep systolic BP and core temperature within the targets set by the surgeon', method: 'Observation chart', frequency: ['Hourly', '2-hourly', '4-hourly', '4-hourly'], notes: 'Avoid hypotension, hypothermia and vasoconstrictors unless agreed with the surgeon.' },
        { key: 'flap_colour', label: 'Flap colour (compared with baseline photograph)', method: 'Inspection in good light', frequency: ['Hourly', 'Hourly', '2-hourly', '4-hourly'], notes: '' },
        { key: 'flap_cap_refill', label: 'Capillary refill (seconds)', method: 'Blanch with gloved finger or instrument', frequency: ['Hourly', 'Hourly', '2-hourly', '4-hourly'], notes: 'About 1–3 s expected; brisk (<1 s) suggests venous congestion; slow or absent suggests arterial insufficiency.' },
        { key: 'flap_temperature', label: 'Flap temperature (touch or surface probe vs control site)', method: 'Touch / probe', frequency: ['Hourly', 'Hourly', '2-hourly', '4-hourly'], notes: 'A falling temperature or a difference from control greater than the unit\'s threshold is a warning.' },
        { key: 'flap_turgor', label: 'Turgor (soft / tense / flaccid)', method: 'Gentle palpation', frequency: ['Hourly', 'Hourly', '2-hourly', '4-hourly'], notes: '' },
        { key: 'flap_doppler', label: 'Hand-held Doppler signal at the marked point (arterial / venous)', method: 'Hand-held Doppler', frequency: ['Hourly', 'Hourly', '2-hourly', '4-hourly'], notes: 'Record signal present / changed / absent.' },
        { key: 'drains', label: 'Each drain: volume and character', method: 'Drain chart', frequency: ['Hourly', '4-hourly', '8-hourly', '8-hourly'], notes: '' },
        { key: 'fluid_balance', label: 'Fluid balance and urine output', method: 'Fluid chart', frequency: ['Hourly', 'Hourly', '4-hourly', '8-hourly'], notes: '' },
        { key: 'pain', label: 'Pain and sedation', method: 'Numeric rating scale', frequency: ['Hourly', '2-hourly', '4-hourly', '4-hourly'], notes: '' },
      ],
      expected_progress: ['Flap pink, warm, soft, capillary refill ~2 s and Doppler signal unchanged at every check', 'Haemodynamically stable, warm, adequately filled'],
      red_triggers: [
        'Any sign of flap compromise: pale/white, mottled, dusky/blue/purple, cool, tense or flaccid, refill brisk or absent, Doppler signal lost or changed, dark or no bleeding on pinprick (if used)',
        'Expanding haematoma at the flap or pedicle',
        ...GENERAL_RED,
      ],
      amber_triggers: ['A single flap parameter different from baseline with the others normal — recheck within 15–30 min', 'Systolic BP below the surgeon\'s target, core temperature falling, urine output below target', 'Required flap check overdue'],
      escalation: [
        'Red: inform the operating surgeon / on-call microvascular surgeon immediately; prepare for return to theatre — salvage rates fall with every hour of delay.',
        'Amber: registrar to review the flap within 30 minutes; increase checks to every 15–30 min until resolved.',
        'Document each check, every escalation and the response time.',
      ],
    }),
    sources: [
      { citation: 'Chae MP, Rozen WM, Whitaker IS, et al. Current evidence for postoperative monitoring of microvascular free flaps: a systematic review. Ann Plast Surg. 2015;74(5):621–632.', note: 'Review of clinical and adjunct monitoring methods.', verified: false },
      NEWS2,
      PRACTICE('hourly flap checks for 24–48 h, then 2-hourly to 72 h, then 4-hourly'),
    ],
  },
  {
    id: 'postop.burns_surgery',
    title: 'Burns surgery (excision and grafting)',
    definition: base({
      summary: 'After burn excision and grafting: blood loss, temperature, fluid balance, graft and donor sites, infection and nutrition.',
      applies_to: 'Burn excision and grafting',
      parameters: [
        ...vitalsRows.slice(0, 2),
        { key: 'core_temperature', label: 'Core temperature (hypothermia risk after large excisions)', method: 'Thermometer', frequency: ['Every 15 min', 'Every 30 min', 'Hourly', '4-hourly'], notes: '' },
        { key: 'urine_output', label: 'Urine output (mL/kg/h)', method: 'Catheter / fluid chart', frequency: ['Hourly', 'Hourly', 'Hourly', '4-hourly'], notes: 'Commonly used targets: ~0.5 mL/kg/h adults, ~1 mL/kg/h children under 30 kg — confirm the unit\'s targets.' },
        { key: 'haemoglobin', label: 'Haemoglobin after excision', method: 'Laboratory', frequency: ['—', 'Once (post-op)', 'Next morning', 'As indicated'], notes: '' },
        { key: 'graft_dressing', label: 'Graft dressing: bleeding, strike-through, odour', method: 'Inspection', frequency: ['Every 30 min', 'Hourly', '4-hourly', 'Daily'], notes: 'First inspection per surgeon (often day 3–5).' },
        { key: 'donor_site', label: 'Donor sites', method: 'Inspection', frequency: ['Hourly', '2-hourly', '4-hourly', 'Daily'], notes: '' },
        { key: 'infection', label: 'Infection / sepsis indicators', method: 'Clinical + NEWS2', frequency: ['With observations', 'With observations', '4-hourly', '4-hourly'], notes: 'Burn sepsis criteria differ from general sepsis criteria — use the unit\'s approved criteria.' },
        { key: 'nutrition', label: 'Nutrition intake vs target', method: 'Food/feed chart', frequency: ['—', '—', 'Daily', 'Daily'], notes: '' },
      ],
      expected_progress: ['Haemodynamically stable, normothermic, urine output at target', 'Graft adherent at first inspection'],
      red_triggers: [...GENERAL_RED, 'Core temperature < 35 °C', 'Urine output below target for 2 hours despite fluid adjustment'],
      amber_triggers: [...GENERAL_AMBER, 'Haemoglobin fall requiring review', 'Signs of graft or wound infection'],
    }),
    sources: [
      { citation: 'ISBI Practice Guidelines Committee. ISBI Practice Guidelines for Burn Care. Burns. 2016;42(5):953–1021.', note: 'Burn care including resuscitation, wound care, infection, nutrition.', verified: false },
      { citation: 'American Burn Association. Advanced Burn Life Support (ABLS) Provider Manual.', note: 'Urine output targets during resuscitation.', verified: false },
      NEWS2,
    ],
  },
  {
    id: 'postop.hand_surgery',
    title: 'Hand surgery',
    definition: base({
      summary: 'Neurovascular observations, elevation, and watch for compartment syndrome after hand and upper-limb surgery.',
      applies_to: 'Hand and upper-limb surgery',
      parameters: [
        ...vitalsRows.slice(0, 2),
        { key: 'neurovascular', label: 'Neurovascular check of each digit: colour, capillary refill, temperature, sensation, movement', method: 'Bedside check', frequency: ['Every 15 min', 'Hourly', '2-hourly', '4-hourly to 48 h'], notes: '' },
        { key: 'compartment', label: 'Pain out of proportion / pain on passive stretch / tense forearm or hand', method: 'Assessment', frequency: ['Every 15 min', 'Hourly', '2-hourly', '4-hourly to 48 h'], notes: '' },
        { key: 'elevation', label: 'Elevation and splint position', method: 'Check', frequency: ['With observations', 'With observations', '4-hourly', 'Each shift'], notes: '' },
      ],
      expected_progress: ['Digits pink, warm, refill < 2 s, sensation as before surgery (unless nerve repaired)'],
      red_triggers: [...GENERAL_RED, 'Suspected compartment syndrome: pain out of proportion or on passive stretch, tense compartments', 'White or blue digit, absent refill'],
      amber_triggers: [...GENERAL_AMBER, 'Swelling increasing, tight dressing or cast — loosen and reassess'],
      escalation: [
        'Red: split dressings to skin, elevate to heart level, call the on-call registrar immediately — compartment syndrome is a surgical emergency.',
        ...GENERAL_ESCALATION.slice(1),
      ],
    }),
    sources: [
      { citation: 'British Orthopaedic Association. BOAST: Diagnosis and management of compartment syndrome of the limbs. 2016.', note: 'Recognition and urgent management of compartment syndrome.', verified: false },
      PRACTICE('hourly neurovascular checks for the first 24 h after hand surgery'),
    ],
  },
  {
    id: 'postop.breast_reconstruction',
    title: 'Breast reconstruction',
    definition: base({
      summary: 'Implant-based or pedicled reconstruction. For free-flap (e.g. DIEP) reconstruction use the free-flap profile.',
      applies_to: 'Implant / expander and pedicled flap breast reconstruction',
      parameters: [
        ...vitalsRows,
        { key: 'breast_check', label: 'Breast: swelling, tension, skin colour, mastectomy-flap viability', method: 'Inspection', frequency: ['Every 30 min', 'Hourly', '4-hourly', 'Daily'], notes: 'Unilateral, painful swelling suggests haematoma.' },
      ],
      expected_progress: ['Drain output falling day by day', 'Mastectomy skin flaps pink and viable'],
      red_triggers: [...GENERAL_RED, 'Rapid unilateral swelling, tension and pain (haematoma)'],
      amber_triggers: [...GENERAL_AMBER, 'Mastectomy skin flap duskiness', 'Redness, warmth or fever suggesting infection'],
    }),
    sources: [
      { citation: 'Temple-Oberle C, Shea-Budgell MA, Tan M, et al. Consensus Review of Optimal Perioperative Care in Breast Reconstruction: Enhanced Recovery after Surgery (ERAS) Society Recommendations. Plast Reconstr Surg. 2017;139(5):1056e–1071e.', note: 'Perioperative care in breast reconstruction.', verified: false },
      NEWS2,
    ],
  },
  {
    id: 'postop.oncological_reconstruction',
    title: 'Oncological reconstruction',
    definition: base({
      summary: 'Reconstruction after tumour excision. Add the flap profile that matches the reconstruction (local, pedicled or free).',
      applies_to: 'Reconstruction after oncological resection',
      parameters: [
        ...vitalsRows,
        { key: 'airway', label: 'Airway (head and neck cases): stridor, swelling, secretions, tracheostomy care', method: 'Assessment', frequency: ['Continuous / every 15 min', 'Every 30 min', 'Hourly', '4-hourly'], notes: 'Only for head and neck procedures.' },
      ],
      expected_progress: ['Reconstruction viable; drains settling; histology result followed up and discussed at MDT'],
      red_triggers: [...GENERAL_RED, 'Stridor or airway swelling (head and neck)'],
    }),
    sources: [NEWS2, PRACTICE('combine with the flap-specific profile')],
  },
  {
    id: 'postop.pressure_sore_reconstruction',
    title: 'Pressure-sore reconstruction',
    definition: base({
      summary: 'Flap reconstruction of a pressure ulcer: offloading the flap, flap checks, bowel/bladder care to keep the wound clean, nutrition, and a graduated sitting programme.',
      applies_to: 'Sacral, ischial and trochanteric pressure-sore flaps',
      parameters: [
        ...vitalsRows.slice(0, 2),
        { key: 'flap_check', label: 'Flap: colour, refill, temperature, wound edges, dehiscence', method: 'Inspection', frequency: ['Hourly', '2-hourly', '4-hourly', 'Daily'], notes: '' },
        { key: 'positioning', label: 'Position off the flap; pressure-relieving mattress; repositioning schedule', method: 'Check and record', frequency: ['With observations', '2-hourly', '2-hourly', '2–4-hourly'], notes: 'Repositioning interval per the patient\'s risk and mattress.' },
        { key: 'skin', label: 'Skin inspection of all other pressure areas', method: 'Inspection', frequency: ['—', '—', 'Each shift', 'Each shift'], notes: '' },
        { key: 'continence', label: 'Bowel and bladder management (keep wound clean)', method: 'Chart', frequency: ['—', '—', 'Daily', 'Daily'], notes: '' },
        { key: 'drains', label: 'Each drain: volume and character', method: 'Drain chart', frequency: ['Hourly', '4-hourly', '8-hourly', 'Daily'], notes: '' },
        { key: 'nutrition', label: 'Nutrition (MUST) and albumin as indicated', method: 'Screening + chart', frequency: ['—', '—', 'Daily', 'Weekly MUST'], notes: '' },
      ],
      expected_progress: ['Flap healed without dehiscence before a graduated sitting programme begins (commonly from ~2–3 weeks, per surgeon)'],
      amber_triggers: [...GENERAL_AMBER, 'Wound edge separation, collection or soiling of the wound', 'New pressure damage elsewhere'],
    }),
    sources: [
      { citation: 'NICE CG179. Pressure ulcers: prevention and management. 2014.', note: 'Risk assessment, repositioning, pressure-redistributing surfaces.', verified: false },
      { citation: 'EPUAP/NPIAP/PPPIA. Prevention and Treatment of Pressure Ulcers/Injuries: Clinical Practice Guideline. The International Guideline. 3rd ed. 2019.', note: '', verified: false },
    ],
  },
  {
    id: 'postop.major_soft_tissue_excision',
    title: 'Major soft-tissue excision',
    definition: base({
      summary: 'Large excisions (e.g. soft-tissue tumours, debridement): bleeding, haematoma/seroma, wound and drains.',
      applies_to: 'Major soft-tissue excision without flap reconstruction',
      expected_progress: ['Drain output falling; wound intact; mobilising per plan'],
      amber_triggers: [...GENERAL_AMBER, 'Seroma or wound discharge', 'Signs of wound infection'],
    }),
    sources: [NEWS2, NICE_NG89],
  },
];
