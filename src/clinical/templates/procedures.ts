/**
 * Procedure modules — what is specific to each plastic surgery operation:
 * the pre-operative assessment, the post-operative monitoring, the follow-up
 * outcome measures, the material risks for consent, and the plan lines and
 * red flags the procedure adds on top of the shared sections.
 *
 * Section ids: pre-op questions live in 'procedure', post-op monitoring in
 * 'monitor', follow-up measures in 'proc_fu'.
 */
import { ans, has, multi, n, num, sel, text } from './common';
import type { Answers, FlagRule, PlanRule, ReviewKind, TemplateQuestion } from './types';

export interface ProcedureSpec {
  id: string;
  label: string;
  group: string;
  keywords?: string[];
  preop: TemplateQuestion[];
  workup?: string[];
  risks: string[];
  alternatives?: string[];
  dayChecks?: string[];
  postop: TemplateQuestion[];
  followUp: TemplateQuestion[];
  flags?: Partial<Record<ReviewKind, FlagRule[]>>;
  plan?: Partial<Record<ReviewKind, PlanRule[]>>;
  counselling?: string[];
  /** Ward / clinic review timings to quote in the note. */
  schedule?: string;
  references: string[];
}

const P = 'procedure', M = 'monitor', F = 'proc_fu';
const SIDE = ['Left', 'Right', 'Bilateral', 'Midline / not applicable'];

// ── Recurring monitoring blocks ───────────────────────────────────────────

const graftTake = (s: string): TemplateQuestion[] => [
  num('take', 'Graft take', '%', { required: true, hint: 'Estimated percentage of the grafted area adherent and vascularised' }),
  multi('graft_issues', 'Graft findings', ['None', 'Haematoma under graft', 'Seroma', 'Shear / displacement', 'Infection (slough / pus / odour)', 'Pseudomonas (green / sweet odour)', 'Loss over a joint', 'Exposed tendon / bone'], { required: true, redFlags: ['Haematoma under graft', 'Infection (slough / pus / odour)', 'Pseudomonas (green / sweet odour)', 'Exposed tendon / bone'] }),
  ...(s === 'postop' ? [sel('first_dressing', 'First dressing', ['Not yet due (day 5)', 'Taken down today', 'Taken down early — concern'])] : []),
];

const flapMonitor = (): TemplateQuestion[] => [
  sel('colour', 'Flap colour', ['Pink — normal', 'Pale / white', 'Dusky / blue', 'Mottled', 'Black'], { required: true, redFlags: ['Pale / white', 'Dusky / blue', 'Mottled', 'Black'] }),
  sel('cap_refill', 'Capillary refill', ['2–3 s — normal', '< 1 s (brisk — congestion)', '> 3 s (sluggish — arterial)', 'Absent'], { required: true, redFlags: ['< 1 s (brisk — congestion)', '> 3 s (sluggish — arterial)', 'Absent'] }),
  sel('temp_flap', 'Temperature', ['Warm', 'Cool'], { required: true, redFlags: ['Cool'] }),
  sel('turgor', 'Turgor', ['Normal / soft', 'Tense / swollen', 'Flat / prune-like'], { redFlags: ['Tense / swollen', 'Flat / prune-like'] }),
  sel('pinprick', 'Pinprick bleed', ['Bright red after 1–2 s', 'Dark blood, immediate', 'Slow / none', 'Not done'], { redFlags: ['Dark blood, immediate', 'Slow / none'] }),
  sel('doppler', 'Hand-held Doppler signal', ['Present, pulsatile', 'Present, weak / venous only', 'Absent', 'Not applicable'], { redFlags: ['Present, weak / venous only', 'Absent'] }),
  sel('flap_freq', 'Monitoring frequency', ['Hourly (first 24 h)', '2-hourly (24–48 h)', '4-hourly (48–72 h)', '6-hourly / per shift']),
  multi('flap_issues', 'Other findings', ['None', 'Wound edge necrosis (tip)', 'Partial flap loss', 'Haematoma', 'Pedicle kinking / compression', 'Tight dressing / suture line', 'Donor site problem'], { redFlags: ['Partial flap loss', 'Haematoma', 'Pedicle kinking / compression'] }),
];

const flapCompromised = (a: Answers) =>
  ['Pale / white', 'Dusky / blue', 'Mottled', 'Black'].includes(ans(a, M, 'colour'))
  || ['< 1 s (brisk — congestion)', '> 3 s (sluggish — arterial)', 'Absent'].includes(ans(a, M, 'cap_refill'))
  || ans(a, M, 'doppler') === 'Absent';

const flapFlags: FlagRule[] = [
  { severity: 'urgent', text: 'Flap compromise — inform the operating surgeon now; release dressings / sutures, position, and prepare for re-exploration', when: flapCompromised },
  { severity: 'urgent', text: 'Haematoma beneath the flap — evacuate', when: (a) => has(a, M, 'flap_issues', 'Haematoma') },
];

const flapPostopPlan: PlanRule[] = [
  { domain: 'Surgical / wound management', text: 'Flap observations (colour, capillary refill, temperature, turgor, Doppler) hourly for 24 h, 2-hourly to 48 h, then 4-hourly', why: 'Most failures declare in the first 72 h; salvage depends on early detection' },
  { domain: 'Surgical / wound management', text: 'Keep the patient warm, well hydrated (urine > 0.5 mL/kg/h) and normotensive; avoid vasoconstrictors and pressure on the pedicle', why: 'Flap perfusion follows systemic perfusion' },
  { domain: 'Surgical / wound management', text: 'Urgent re-exploration for flap compromise', priority: 'urgent', when: flapCompromised },
];

const handFunction = (): TemplateQuestion[] => [
  sel('hand_dom', 'Hand dominance', ['Right', 'Left', 'Ambidextrous']),
  num('quickdash', 'QuickDASH', '/100', { hint: '0 = no disability' }),
  num('grip', 'Grip strength (affected / unaffected)', '%'),
];

// ── Procedures ────────────────────────────────────────────────────────────

export const PROCEDURES: ProcedureSpec[] = [
  // Skin cover
  {
    id: 'stsg', label: 'Split-thickness skin graft (STSG)', group: 'Skin cover', keywords: ['graft', 'ssg', 'skin graft'],
    preop: [
      text('recipient', 'Recipient site and size', { required: true, placeholder: 'e.g. left leg, 12 × 8 cm' }),
      sel('bed', 'Recipient bed', ['Healthy granulation, ready', 'Granulation with slough — needs debridement', 'Exposed bone / tendon without paratenon / periosteum', 'Infected'], { required: true, redFlags: ['Exposed bone / tendon without paratenon / periosteum', 'Infected'] }),
      sel('bed_swab', 'Bed swab / bacterial load', ['No β-haemolytic Streptococcus, < 10⁵ CFU/g', 'β-haemolytic Streptococcus grown', 'Pseudomonas grown', 'Not done'], { redFlags: ['β-haemolytic Streptococcus grown'] }),
      sel('donor', 'Planned donor site', ['Thigh (anterolateral)', 'Buttock', 'Scalp', 'Upper arm', 'Back', 'Other']),
      sel('mesh', 'Mesh / sheet', ['Sheet graft', 'Meshed 1:1.5', 'Meshed 1:3', 'Undecided']),
      sel('npwt_plan', 'NPWT bolster planned', ['Yes', 'No']),
    ],
    risks: ['Partial or total graft loss', 'Donor-site pain, delayed healing, itching', 'Colour and texture mismatch', 'Contracture of the graft', 'Hypertrophic donor-site scarring'],
    alternatives: ['Healing by secondary intention / dressings', 'Flap cover', 'Dermal substitute then graft'],
    postop: [...graftTake('postop'), sel('donor_site', 'Donor site', ['Dressing intact', 'Soaked — re-padded', 'Infected', 'Healed'], { redFlags: ['Infected'] }), sel('immob', 'Recipient site immobilised / elevated', ['Yes', 'No'], { redFlags: ['No'] })],
    followUp: [...graftTake('fu'), sel('donor_fu', 'Donor site', ['Healed', 'Healing', 'Delayed / infected', 'Hypertrophic']), sel('contracture', 'Graft contracture', ['None', 'Mild', 'Functional limitation'], { redFlags: ['Functional limitation'] })],
    flags: {
      preop_review: [{ severity: 'warning', text: 'β-haemolytic Streptococcus in the bed — treat before grafting (graft loss is near-certain)', when: (a) => has(a, P, 'bed_swab', 'β-haemolytic Streptococcus grown') }],
      postop_review: [{ severity: 'urgent', text: 'Haematoma under the graft — evacuate and re-dress today', when: (a) => has(a, M, 'graft_issues', 'Haematoma under graft') }],
    },
    plan: {
      preop_review: [{ domain: 'Investigations', kind: 'investigation', text: 'Quantitative / semi-quantitative swab of the recipient bed', when: (a) => !ans(a, P, 'bed_swab') || ans(a, P, 'bed_swab') === 'Not done', why: 'Streptococcus pyogenes or > 10⁵ CFU/g predicts graft failure' }],
      postop_review: [
        { domain: 'Surgical / wound management', text: 'Leave the graft dressing undisturbed until day 5 unless pain, odour, fever or strike-through' },
        { domain: 'Rehabilitation and function', text: 'Elevate and immobilise the recipient site; lower-limb grafts — bed rest with leg elevation, then graduated dangling with compression' },
      ],
      procedure_follow_up: [{ domain: 'Rehabilitation and function', text: 'Emollient massage and pressure garment / silicone for the grafted area for 6–12 months' }],
    },
    schedule: 'First dressing day 5; donor site day 10–14.',
    references: ['BAPRAS / ISBI practice guidance on skin grafting', 'Andreassi et al. 2005 — Classification and pathophysiology of skin grafts'],
  },
  {
    id: 'ftsg', label: 'Full-thickness skin graft (FTSG)', group: 'Skin cover', keywords: ['wolfe graft'],
    preop: [
      text('recipient', 'Recipient site and defect size', { required: true }),
      sel('donor', 'Planned donor site', ['Post-auricular', 'Supraclavicular', 'Groin', 'Inner arm', 'Upper eyelid', 'Other']),
      sel('bed', 'Recipient bed', ['Well vascularised', 'Marginal vascularity', 'Previously irradiated'], { redFlags: ['Previously irradiated'] }),
    ],
    risks: ['Graft loss (higher metabolic demand than STSG)', 'Colour / contour mismatch', 'Donor-site scar'],
    alternatives: ['Local flap', 'Healing by secondary intention'],
    postop: [...graftTake('postop'), sel('tie_over', 'Tie-over bolster', ['Intact', 'Loose', 'Removed'])],
    followUp: [...graftTake('fu'), sel('colour_match', 'Colour match', ['Good', 'Acceptable', 'Poor'])],
    plan: { postop_review: [{ domain: 'Surgical / wound management', text: 'Tie-over bolster for 5–7 days; avoid smoking (FTSG is especially vulnerable to nicotine)' }] },
    schedule: 'Bolster off day 5–7; sutures day 7–10.',
    references: ['BAPRAS skin grafting guidance'],
  },
  {
    id: 'local_flap', label: 'Local / regional flap', group: 'Skin cover', keywords: ['rhomboid', 'advancement', 'rotation', 'transposition', 'limberg', 'v-y'],
    preop: [
      text('defect', 'Defect site, size and depth', { required: true }),
      sel('flap_type', 'Planned flap', ['Advancement (incl. V–Y)', 'Rotation', 'Transposition (rhomboid / bilobed)', 'Interpolation', 'Propeller / perforator', 'Other']),
      sel('laxity', 'Tissue laxity and donor availability', ['Good', 'Limited', 'Scarred / irradiated'], { redFlags: ['Scarred / irradiated'] }),
      multi('structures', 'Nearby structures to protect', ['None', 'Facial nerve branches', 'Eyelid margin', 'Lip / commissure', 'Nasal alar rim', 'Joint crease']),
    ],
    risks: ['Tip necrosis / partial flap loss', 'Distortion of nearby structures', 'Dog-ear needing revision', 'Visible scars beyond the defect'],
    alternatives: ['Skin graft', 'Secondary intention', 'Distant flap'],
    postop: flapMonitor(),
    followUp: [sel('flap_outcome', 'Flap outcome', ['Healed fully', 'Healed after tip necrosis', 'Partial loss — further surgery', 'Failed'], { required: true, redFlags: ['Partial loss — further surgery', 'Failed'] }), sel('distortion', 'Distortion / dog-ear', ['None', 'Minor', 'Needs revision'])],
    flags: { postop_review: flapFlags },
    plan: { postop_review: flapPostopPlan },
    references: ['Baker — Local Flaps in Facial Reconstruction (3rd ed.)'],
  },
  {
    id: 'pedicled_flap', label: 'Pedicled flap (muscle / fasciocutaneous)', group: 'Skin cover', keywords: ['latissimus', 'gastrocnemius', 'soleus', 'reverse sural', 'pectoralis', 'groin flap', 'cross leg'],
    preop: [
      text('defect', 'Defect and what it exposes', { required: true, placeholder: 'e.g. 6 × 4 cm, exposed tibia, middle third' }),
      text('flap_name', 'Planned flap', { required: true, placeholder: 'e.g. reverse sural, medial gastrocnemius' }),
      sel('pedicle_ok', 'Pedicle / perforators assessed', ['Doppler-marked', 'CT angiogram', 'Clinical only'], { required: true }),
      sel('zone_injury', 'Pedicle within the zone of injury', ['No', 'Yes', 'Uncertain'], { redFlags: ['Yes'] }),
      sel('fracture_fix', 'Underlying fracture fixation', ['Not applicable', 'Definitive fixation done', 'External fixator in situ', 'Awaiting orthopaedics']),
    ],
    workup: ['Doppler / CT angiography'],
    risks: ['Partial or total flap loss', 'Venous congestion (reverse-flow flaps)', 'Donor-site morbidity and graft', 'Loss of muscle function', 'Bulky contour needing debulking'],
    alternatives: ['Free flap', 'NPWT and grafting', 'Amputation (lower-limb salvage)'],
    postop: [...flapMonitor(), sel('position', 'Pedicle-safe positioning', ['Maintained', 'Not maintained'], { redFlags: ['Not maintained'] })],
    followUp: [sel('flap_outcome', 'Flap outcome', ['Healed fully', 'Healed after minor loss', 'Partial loss — further surgery', 'Failed'], { required: true, redFlags: ['Partial loss — further surgery', 'Failed'] }), sel('donor_fu', 'Donor-site function', ['Normal', 'Mild weakness', 'Significant deficit']), sel('debulk', 'Debulking needed', ['No', 'Yes'])],
    flags: { postop_review: flapFlags },
    plan: { postop_review: flapPostopPlan },
    references: ['BOA/BAPRAS Standards for the management of open fractures (2017)', 'Mathes & Nahai classification of muscle flaps'],
  },
  {
    id: 'free_flap', label: 'Free tissue transfer (free flap)', group: 'Skin cover', keywords: ['alt', 'diep', 'radial forearm', 'fibula', 'microvascular'],
    preop: [
      text('defect', 'Defect and reconstructive goal', { required: true }),
      text('flap_name', 'Planned flap and recipient vessels', { required: true, placeholder: 'e.g. ALT to anterior tibial artery / venae comitantes' }),
      sel('recipient_vessels', 'Recipient vessels', ['Imaged and patent', 'Clinically assessed only', 'Uncertain — vein grafts may be needed'], { required: true, redFlags: ['Uncertain — vein grafts may be needed'] }),
      sel('thrombophilia', 'Personal / family history of thrombosis', ['No', 'Yes — haematology review'], { redFlags: ['Yes — haematology review'] }),
      sel('icu_bed', 'Post-op bed with hourly flap obs', ['Booked (HDU / flap ward)', 'Not yet arranged'], { required: true, redFlags: ['Not yet arranged'] }),
    ],
    workup: ['CT angiography', 'Thrombophilia screen (if indicated)'],
    dayChecks: ['Microscope and microsurgical set checked', 'Hand-held Doppler on the ward'],
    risks: ['Total flap failure (≈ 3–5%)', 'Return to theatre for anastomotic thrombosis', 'Long anaesthetic', 'Donor-site morbidity', 'Need for blood transfusion'],
    alternatives: ['Pedicled flap', 'Staged NPWT and graft', 'Amputation / prosthesis where relevant'],
    postop: [...flapMonitor(), num('hct', 'Haematocrit', '%'), sel('anticoag', 'Anticoagulation / antiplatelet per protocol', ['Given', 'Not prescribed'])],
    followUp: [sel('flap_outcome', 'Flap outcome', ['Healed fully', 'Healed after minor loss', 'Partial loss — further surgery', 'Failed'], { required: true, redFlags: ['Partial loss — further surgery', 'Failed'] }), sel('donor_fu', 'Donor-site function', ['Normal', 'Mild deficit', 'Significant deficit']), sel('weight_bear', 'Weight bearing / dangling programme (lower limb)', ['Not applicable', 'Dangling started', 'Full weight bearing'])],
    flags: { postop_review: flapFlags },
    plan: {
      preop_review: [{ domain: 'Investigations', kind: 'investigation', text: 'CT angiography of donor and recipient vessels', when: (a) => ans(a, P, 'recipient_vessels') !== 'Imaged and patent' }],
      postop_review: [...flapPostopPlan, { domain: 'Comorbidity and metabolic optimisation', text: 'Target haematocrit 30–35%, systolic BP > 100 mmHg, core temperature > 36.5 °C', why: 'Microvascular flow' }],
    },
    references: ['Chen et al. — Free flap monitoring (BAPRAS / British Microsurgical Society)', 'Kroll et al. 1996 — Timing of pedicle thrombosis and salvage'],
  },

  // Skin oncology
  {
    id: 'skin_cancer', label: 'Excision of BCC / cutaneous SCC', group: 'Skin oncology', keywords: ['bcc', 'scc', 'carcinoma', 'rodent ulcer', 'marjolin', 'tumour excision'],
    preop: [
      sel('histology', 'Pre-operative diagnosis', ['BCC — biopsy proven', 'cSCC — biopsy proven', 'Marjolin ulcer (SCC in scar / chronic wound)', 'Clinical diagnosis only'], { required: true, redFlags: ['Clinical diagnosis only'] }),
      text('site_size', 'Site and clinical size', { required: true }),
      sel('risk', 'Risk category', ['Low risk', 'High risk (site / size > 2 cm / poorly defined / recurrent / perineural / immunosuppressed)'], { required: true }),
      num('margin', 'Planned peripheral margin', 'mm', { hint: 'BCC low-risk 4 mm; cSCC low-risk ≥ 4 mm, high-risk ≥ 6 mm (BAD 2021 / 2020)' }),
      sel('nodes', 'Regional lymph nodes', ['Not palpable', 'Palpable — FNA / US planned'], { required: true, redFlags: ['Palpable — FNA / US planned'] }),
      sel('perineural', 'Perineural symptoms (pain, numbness, facial weakness)', ['No', 'Yes'], { redFlags: ['Yes'] }),
      sel('recon_plan', 'Reconstruction', ['Direct closure', 'Local flap', 'Skin graft', 'Delayed until margins clear']),
      sel('mdt', 'Discussed at skin cancer MDT', ['Yes', 'Not required (low risk)', 'Pending']),
    ],
    workup: ['Ultrasound / FNA of nodes', 'CT / MRI for deep invasion'],
    risks: ['Incomplete excision needing re-excision', 'Recurrence', 'Nerve injury (site-specific)', 'Distortion of nearby structures'],
    alternatives: ['Mohs micrographic surgery', 'Radiotherapy', 'Topical therapy / curettage (low-risk superficial BCC)'],
    postop: [sel('specimen', 'Specimen orientation and histology request', ['Sent, oriented', 'Sent, not oriented'], { redFlags: ['Sent, not oriented'] })],
    followUp: [
      sel('histo_result', 'Histology', ['Completely excised, clear margins', 'Close margin (< 1 mm)', 'Incomplete — margin involved', 'Awaited'], { required: true, redFlags: ['Incomplete — margin involved'] }),
      text('histo_detail', 'Subtype, depth, perineural / lymphovascular invasion'),
      sel('recurrence', 'Local recurrence / new lesions', ['None', 'Suspected — biopsy'], { redFlags: ['Suspected — biopsy'] }),
      sel('nodes_fu', 'Regional nodes', ['Not palpable', 'Palpable'], { redFlags: ['Palpable'] }),
    ],
    flags: { procedure_follow_up: [{ severity: 'warning', text: 'Incomplete excision — re-excise, Mohs, or adjuvant radiotherapy via MDT', when: (a) => has(a, F, 'histo_result', 'Incomplete — margin involved') }] },
    plan: {
      preop_review: [{ domain: 'Investigations', kind: 'investigation', text: 'Incisional / punch biopsy to confirm histology before definitive excision', when: (a) => has(a, P, 'histology', 'Clinical diagnosis only') }],
      procedure_follow_up: [
        { domain: 'Follow-up and safety-netting', text: 'cSCC: review 3–6-monthly for 2 years (high risk), teach self-examination of skin and nodes', when: (a) => /SCC|Marjolin/.test(ans(a, 'indication', 'diagnosis') || '') },
        { domain: 'Counselling, education and consent', text: 'Sun protection (shade, clothing, SPF 30+), and early review of any new or changing lesion' },
        { domain: 'Surgical / wound management', text: 'Re-excision or MDT discussion for the involved margin', priority: 'urgent', when: (a) => has(a, F, 'histo_result', 'Incomplete — margin involved') },
      ],
    },
    references: ['British Association of Dermatologists — BCC guideline (2021)', 'BAD — Cutaneous SCC guideline (2020)', 'NICE NG12 — Suspected cancer'],
  },
  {
    id: 'melanoma', label: 'Melanoma wide local excision ± sentinel node biopsy', group: 'Skin oncology', keywords: ['melanoma', 'wle', 'slnb', 'acral'],
    preop: [
      sel('breslow', 'Breslow thickness (from excision biopsy)', ['In situ', '≤ 1.0 mm', '1.01–2.0 mm', '2.01–4.0 mm', '> 4.0 mm', 'Not yet known'], { required: true, redFlags: ['Not yet known'] }),
      sel('ulceration', 'Ulceration', ['Absent', 'Present']),
      sel('subtype', 'Subtype', ['Acral lentiginous', 'Nodular', 'Superficial spreading', 'Lentigo maligna', 'Mucosal', 'Other']),
      text('site_mel', 'Site', { required: true }),
      sel('planned_margin', 'Planned clinical margin', ['5 mm–1 cm (in situ)', '1 cm (≤ 1 mm)', '1–2 cm (1–2 mm)', '2 cm (> 2 mm)'], { required: true, hint: 'NCCN / BAD margins by Breslow thickness' }),
      sel('slnb', 'Sentinel lymph node biopsy', ['Offered and accepted (pT1b and above)', 'Offered and declined', 'Not indicated', 'Not available — discussed'], { required: true }),
      sel('nodes', 'Regional nodes / in-transit lesions', ['None palpable', 'Palpable nodes', 'In-transit / satellite lesions'], { required: true, redFlags: ['Palpable nodes', 'In-transit / satellite lesions'] }),
      sel('staging', 'Staging imaging', ['Not indicated (stage I–IIA)', 'CT chest / abdomen / pelvis done', 'PET-CT done', 'Requested'], { required: true }),
      sel('ldh', 'LDH', ['Normal', 'Raised', 'Not done']),
      sel('mdt', 'Discussed at skin cancer MDT', ['Yes', 'Pending'], { required: true, redFlags: ['Pending'] }),
    ],
    workup: ['LDH', 'CT chest / abdomen / pelvis', 'Lymphoscintigraphy'],
    risks: ['Lymphoedema (after node surgery)', 'Seroma at the node basin', 'Wound breakdown', 'Recurrence and metastasis despite clear margins', 'Graft or flap needed for closure', 'False-negative sentinel node'],
    alternatives: ['Narrower margin where function demands (MDT)', 'Amputation of digit (subungual / acral)', 'Systemic therapy / clinical trial'],
    dayChecks: ['Lymphoscintigraphy / blue dye available'],
    postop: [sel('specimen', 'Specimens sent (WLE, sentinel nodes labelled by basin)', ['Yes', 'No'], { required: true, redFlags: ['No'] }), sel('seroma_basin', 'Node basin', ['Not applicable', 'Satisfactory', 'Seroma', 'Infection'], { redFlags: ['Seroma', 'Infection'] })],
    followUp: [
      sel('slnb_result', 'Sentinel node result', ['Negative', 'Positive — MDT for surveillance vs therapy', 'Not done', 'Awaited'], { redFlags: ['Positive — MDT for surveillance vs therapy'] }),
      sel('wle_margins', 'WLE margins', ['Clear', 'Involved', 'Awaited'], { redFlags: ['Involved'] }),
      text('stage', 'AJCC 8th pathological stage', { required: true }),
      sel('recurrence', 'Local, in-transit or nodal recurrence', ['None', 'Suspected'], { required: true, redFlags: ['Suspected'] }),
      sel('lymphoedema', 'Limb lymphoedema', ['None', 'Mild', 'Moderate / severe'], { redFlags: ['Moderate / severe'] }),
      sel('oncology_ref', 'Medical oncology referral (stage IIB+)', ['Not needed', 'Referred', 'Under oncology']),
    ],
    flags: {
      preop_review: [{ severity: 'warning', text: 'Breslow thickness unknown — definitive margins cannot be planned until excision-biopsy histology is available', when: (a) => has(a, P, 'breslow', 'Not yet known') }],
      procedure_follow_up: [{ severity: 'urgent', text: 'Suspected melanoma recurrence — biopsy / imaging and urgent MDT', when: (a) => has(a, F, 'recurrence', 'Suspected') }],
    },
    plan: {
      preop_review: [
        { domain: 'Investigations', kind: 'investigation', text: 'Staging CT chest / abdomen / pelvis (or PET-CT) and LDH', when: (a) => ['2.01–4.0 mm', '> 4.0 mm'].includes(ans(a, P, 'breslow')) || ['Palpable nodes', 'In-transit / satellite lesions'].includes(ans(a, P, 'nodes')), why: 'Stage IIC and above, or clinical nodal disease (NICE NG14)' },
        { domain: 'Investigations', kind: 'investigation', text: 'Ultrasound-guided FNA of the palpable node', priority: 'urgent', when: (a) => has(a, P, 'nodes', 'Palpable nodes') },
      ],
      procedure_follow_up: [
        { domain: 'Follow-up and safety-netting', text: 'Melanoma surveillance per AJCC stage (NICE NG14): stage IA 1 year of reviews; IB–IIB 3-monthly for 3 years then 6-monthly to 5 years; IIC+ with imaging' },
        { domain: 'Counselling, education and consent', text: 'Teach monthly skin and node self-examination; sun protection; first-degree relatives skin check' },
      ],
    },
    references: ['AJCC Cancer Staging Manual, 8th ed. — Melanoma', 'NICE NG14 — Melanoma: assessment and management (2015, updated 2022)', 'NCCN Guidelines — Cutaneous melanoma', 'MSLT-I / MSLT-II trials'],
  },
  {
    id: 'scalp_tumour', label: 'Scalp tumour excision and scalp flap / reconstruction', group: 'Skin oncology', keywords: ['scalp', 'rotation flap', 'orticochea', 'dfsp', 'cylindroma'],
    preop: [
      text('lesion', 'Lesion, histology and size', { required: true }),
      sel('depth', 'Depth of involvement', ['Skin / subcutis only', 'Galea', 'Periosteum / pericranium', 'Outer table of skull', 'Full-thickness skull / dura'], { required: true, redFlags: ['Outer table of skull', 'Full-thickness skull / dura'] }),
      sel('imaging', 'CT / MRI of skull and brain', ['Done — no bony invasion', 'Done — bony invasion', 'Not done'], { required: true, redFlags: ['Done — bony invasion'] }),
      sel('recon', 'Planned reconstruction', ['Primary closure', 'Rotation flap(s)', 'Orticochea / multiple flaps', 'Skin graft on pericranium', 'Burr / outer table and graft', 'Free flap (e.g. latissimus / ALT)', 'Tissue expansion (staged)']),
      sel('hair', 'Hair-bearing restoration important to the patient', ['Yes', 'No']),
      sel('prior_rt', 'Previous radiotherapy to the scalp', ['No', 'Yes'], { redFlags: ['Yes'] }),
      sel('neurosurgery', 'Neurosurgery involvement', ['Not needed', 'Planned (combined case)']),
    ],
    workup: ['CT head / skull', 'MRI (perineural / intracranial extension)'],
    risks: ['Alopecia / scar visible in the hairline', 'Flap tip necrosis', 'Exposed bone needing further cover', 'Haematoma under the flap', 'CSF leak / intracranial complication (if skull resected)', 'Recurrence'],
    alternatives: ['Radiotherapy', 'Mohs surgery', 'Staged reconstruction after histological clearance'],
    postop: [...flapMonitor(), sel('head_dress', 'Head dressing', ['Satisfactory', 'Too tight', 'Slipped'], { redFlags: ['Too tight'] }), sel('neuro', 'GCS / neurological state', ['GCS 15, no deficit', 'Altered — urgent CT'], { redFlags: ['Altered — urgent CT'] })],
    followUp: [
      sel('histo_result', 'Histology / margins', ['Clear', 'Close', 'Involved', 'Awaited'], { required: true, redFlags: ['Involved'] }),
      sel('flap_outcome', 'Reconstruction outcome', ['Healed', 'Partial loss — further cover', 'Exposed bone'], { redFlags: ['Partial loss — further cover', 'Exposed bone'] }),
      sel('alopecia', 'Alopecia', ['None', 'Acceptable', 'Distressing — consider expansion / hair transplant']),
    ],
    flags: { postop_review: flapFlags },
    plan: {
      preop_review: [{ domain: 'Investigations', kind: 'investigation', text: 'CT skull (bone windows) ± MRI brain to define depth before excision', when: (a) => has(a, P, 'imaging', 'Not done') || ['Periosteum / pericranium', 'Outer table of skull', 'Full-thickness skull / dura'].includes(ans(a, P, 'depth')) }],
      postop_review: [...flapPostopPlan, { domain: 'Surgical / wound management', text: 'Head elevated 30°; firm but not tight head dressing; check for haematoma under the scalp flap' }],
    },
    references: ['Leedy et al. 2005 — Reconstruction of acquired scalp defects: an algorithmic approach', 'BAD BCC / SCC guidelines'],
  },
  {
    id: 'sarcoma', label: 'Soft-tissue tumour / sarcoma excision', group: 'Skin oncology', keywords: ['lipoma', 'sarcoma', 'dfsp', 'soft tissue mass'],
    preop: [
      text('mass', 'Mass — site, size, depth relative to fascia', { required: true }),
      multi('red_mass', 'Features suggesting sarcoma', ['None', '> 5 cm', 'Deep to fascia', 'Rapidly growing', 'Painful', 'Recurrent after excision'], { redFlags: ['> 5 cm', 'Deep to fascia', 'Rapidly growing', 'Recurrent after excision'] }),
      sel('imaging', 'MRI', ['Done', 'Not done']),
      sel('biopsy', 'Core biopsy (planned along the excision track)', ['Done — benign', 'Done — malignant', 'Not done']),
      sel('mdt', 'Sarcoma MDT', ['Not needed (benign)', 'Discussed', 'Pending']),
    ],
    workup: ['MRI of the mass', 'CT chest (sarcoma staging)'],
    risks: ['Nerve / vessel injury', 'Seroma', 'Recurrence', 'Need for adjuvant radiotherapy'],
    alternatives: ['Observation (small benign superficial lesions)', 'Neo-adjuvant radiotherapy (sarcoma)'],
    postop: [],
    followUp: [sel('histo_result', 'Histology / margins', ['Benign', 'Malignant — clear margins', 'Malignant — margins involved', 'Awaited'], { required: true, redFlags: ['Malignant — margins involved'] })],
    flags: { preop_review: [{ severity: 'warning', text: 'Features of possible sarcoma — MRI and core biopsy before excision, refer to sarcoma MDT; avoid "shelling out"', when: (a) => (ans(a, P, 'red_mass') || []).some((x: string) => x !== 'None') && !has(a, P, 'biopsy', 'Done — benign') }] },
    plan: { preop_review: [{ domain: 'Investigations', kind: 'investigation', text: 'MRI of the mass and image-guided core biopsy', when: (a) => (ans(a, P, 'red_mass') || []).some((x: string) => x !== 'None') }] },
    references: ['British Sarcoma Group guidelines (2016)', 'NICE NG12 — Suspected cancer: soft-tissue sarcoma'],
  },

  // Wounds and limb
  {
    id: 'diabetic_foot', label: 'Diabetic foot debridement / ray or minor amputation', group: 'Wounds and limb salvage', keywords: ['dfu', 'diabetic foot', 'ray amputation', 'toe amputation', 'wagner'],
    preop: [
      sel('wagner', 'Wagner grade', ['0 — intact skin', '1 — superficial ulcer', '2 — deep to tendon / capsule', '3 — abscess / osteomyelitis', '4 — forefoot gangrene', '5 — whole-foot gangrene'], { required: true, redFlags: ['4 — forefoot gangrene', '5 — whole-foot gangrene'] }),
      sel('ut', 'University of Texas grade / stage', ['Grade 0', 'Grade 1', 'Grade 2', 'Grade 3', 'Stage A (clean)', 'Stage B (infected)', 'Stage C (ischaemic)', 'Stage D (infected + ischaemic)']),
      sel('iwgdf_infection', 'IWGDF / IDSA infection grade', ['1 — uninfected', '2 — mild', '3 — moderate', '4 — severe (SIRS)', '3(O) / 4(O) — with osteomyelitis'], { required: true, redFlags: ['4 — severe (SIRS)'] }),
      sel('pulses', 'Foot pulses (DP / PT)', ['Both palpable', 'One palpable', 'None palpable'], { required: true, redFlags: ['None palpable'] }),
      num('abpi_foot', 'ABPI / toe pressure', '', { hint: 'ABPI may be falsely high with calcified vessels; toe pressure < 30 mmHg = poor healing' }),
      sel('probe_bone', 'Probe-to-bone', ['Negative', 'Positive'], { redFlags: ['Positive'] }),
      sel('xray', 'Foot X-ray', ['No osteomyelitis', 'Osteomyelitis / gas / foreign body', 'Not done']),
      sel('neuro', 'Loss of protective sensation (10 g monofilament)', ['Absent', 'Present']),
      sel('charcot', 'Active Charcot foot', ['No', 'Suspected (warm, swollen)'], { redFlags: ['Suspected (warm, swollen)'] }),
      sel('level', 'Planned procedure', ['Debridement only', 'Toe amputation', 'Ray amputation', 'Transmetatarsal amputation', 'Incision and drainage of abscess', 'Major amputation (BKA / AKA)']),
      sel('vascular', 'Vascular surgery opinion', ['Not needed (perfused)', 'Requested', 'Revascularised']),
    ],
    workup: ['Foot X-ray', 'Arterial duplex', 'Deep tissue / bone culture', 'ESR / CRP'],
    risks: ['Further amputation / higher-level amputation', 'Non-healing wound', 'Recurrent ulceration', 'Loss of foot function / gait change', 'Sepsis', 'Mortality (high 5-year mortality in diabetic foot disease)'],
    alternatives: ['Conservative management with antibiotics and offloading', 'Revascularisation first', 'Major amputation'],
    postop: [
      sel('wound_bed', 'Wound bed', ['Bleeding, healthy tissue', 'Residual necrosis / slough', 'Spreading infection'], { required: true, redFlags: ['Residual necrosis / slough', 'Spreading infection'] }),
      sel('culture_sent', 'Deep tissue / bone sent for culture and histology', ['Yes', 'No'], { required: true, redFlags: ['No'] }),
      sel('offload', 'Offloading in place', ['Yes', 'No'], { required: true, redFlags: ['No'] }),
      num('glucose', 'Capillary glucose (range today)', 'mmol/L'),
      sel('relook', 'Relook / further debridement planned', ['No', 'Yes — within 48 h']),
    ],
    followUp: [
      num('area', 'Wound area', 'cm²', { required: true }),
      sel('area_trend', 'Area reduction since baseline', ['≥ 50% at 4 weeks (on track)', '< 50% at 4 weeks — reassess', 'Increasing'], { required: true, redFlags: ['< 50% at 4 weeks — reassess', 'Increasing'] }),
      sel('footwear', 'Therapeutic footwear / orthotics', ['Provided', 'Measured', 'Not yet']),
      sel('contralateral', 'Contralateral foot', ['Intact', 'Pre-ulcerative lesion', 'Ulcer'], { redFlags: ['Pre-ulcerative lesion', 'Ulcer'] }),
      sel('podiatry', 'Podiatry / foot protection service', ['Enrolled', 'Referred', 'Not available']),
    ],
    flags: {
      preop_review: [
        { severity: 'urgent', text: 'Severe diabetic foot infection — IV antibiotics and source control within 24 h (IWGDF 2023)', when: (a) => has(a, P, 'iwgdf_infection', '4 — severe (SIRS)') },
        { severity: 'warning', text: 'No palpable pulses — vascular assessment before definitive surgery; healing is unlikely without revascularisation', when: (a) => has(a, P, 'pulses', 'None palpable') || ((n(a, P, 'abpi_foot') ?? 1) < 0.5) },
      ],
    },
    plan: {
      preop_review: [
        { domain: 'Investigations', kind: 'investigation', text: 'Foot X-ray, ESR / CRP, FBC, U&E, HbA1c', why: 'Osteomyelitis and baseline metabolic state' },
        { domain: 'Investigations', kind: 'investigation', text: 'Arterial duplex / angiography and vascular surgery opinion', when: (a) => !has(a, P, 'pulses', 'Both palpable') },
        { domain: 'Infection control and antimicrobials', text: 'Empirical antibiotics per IWGDF severity, narrowed to deep tissue / bone culture', when: (a) => !has(a, P, 'iwgdf_infection', '1 — uninfected') },
      ],
      postop_review: [
        { domain: 'Surgical / wound management', text: 'Daily wound inspection; relook debridement within 48 h if residual necrosis' },
        { domain: 'Rehabilitation and function', text: 'Strict offloading (non-weight-bearing / total-contact cast / removable walker) — no weight on the wound' },
        { domain: 'Comorbidity and metabolic optimisation', text: 'Capillary glucose 4–6 times daily; target 6–10 mmol/L; diabetes team review' },
      ],
      procedure_follow_up: [
        { domain: 'Follow-up and safety-netting', text: 'Weekly wound measurement; if < 50% area reduction at 4 weeks, re-evaluate perfusion, infection and offloading' },
        { domain: 'Counselling, education and consent', text: 'Daily foot inspection, never walk barefoot, footwear checked before wearing; urgent review for redness, swelling or new wound' },
        { domain: 'Rehabilitation and function', text: 'Foot protection service, podiatry and therapeutic footwear to prevent recurrence' },
      ],
    },
    references: ['IWGDF Guidelines on the prevention and management of diabetes-related foot disease (2023)', 'IWGDF/IDSA infection guideline (2023)', 'NICE NG19 — Diabetic foot problems (2015, updated 2019)'],
  },
  {
    id: 'pressure_sore', label: 'Pressure injury debridement and flap closure', group: 'Wounds and limb salvage', keywords: ['pressure sore', 'pressure ulcer', 'sacral', 'ischial', 'trochanteric', 'bedsore', 'gluteal flap'],
    preop: [
      sel('site_ps', 'Site', ['Sacral', 'Ischial', 'Trochanteric', 'Heel', 'Occiput', 'Other'], { required: true }),
      sel('npiap', 'NPIAP stage', ['Stage 1', 'Stage 2', 'Stage 3', 'Stage 4', 'Unstageable', 'Deep tissue injury'], { required: true }),
      sel('cause', 'Underlying condition', ['Spinal cord injury — paraplegia', 'Spinal cord injury — tetraplegia', 'Stroke / neurological', 'Frailty / immobility', 'Other']),
      sel('osteo', 'Osteomyelitis', ['Excluded (bone biopsy / MRI)', 'Suspected', 'Confirmed'], { redFlags: ['Suspected', 'Confirmed'] }),
      sel('spasm', 'Spasticity / contractures', ['None', 'Present — controlled', 'Severe — uncontrolled'], { redFlags: ['Severe — uncontrolled'] }),
      sel('continence', 'Bowel / bladder management', ['Continent', 'Catheter / bowel programme in place', 'Uncontrolled faecal soiling — consider diversion'], { required: true, redFlags: ['Uncontrolled faecal soiling — consider diversion'] }),
      sel('surface', 'Pressure-redistributing mattress / cushion available after surgery', ['Air-fluidised / alternating air', 'Foam only', 'None'], { required: true, redFlags: ['None'] }),
      sel('flap_plan', 'Planned flap', ['Gluteal rotation', 'Gluteal V–Y advancement', 'Superior / inferior gluteal artery perforator', 'Posterior thigh (hamstring)', 'TFL (trochanteric)', 'Debridement only']),
      sel('previous', 'Previous flap at this site', ['No', 'Yes — recurrence'], { redFlags: ['Yes — recurrence'] }),
    ],
    workup: ['Bone biopsy / MRI pelvis', 'Albumin / prealbumin'],
    risks: ['Wound dehiscence (≈ 30%)', 'Recurrence (up to 60% in spinal cord injury)', 'Flap necrosis', 'Seroma / haematoma', 'Prolonged bed rest and its complications'],
    alternatives: ['Conservative management with offloading, nutrition and NPWT', 'Diverting colostomy'],
    postop: [
      ...flapMonitor(),
      sel('position_ps', 'Pressure off the flap (positioning schedule)', ['Strictly maintained', 'Lapses noted'], { required: true, redFlags: ['Lapses noted'] }),
      sel('soiling', 'Faecal / urinary contamination of the wound', ['None', 'Yes'], { redFlags: ['Yes'] }),
      sel('spasm_po', 'Spasms', ['None', 'Controlled', 'Uncontrolled'], { redFlags: ['Uncontrolled'] }),
    ],
    followUp: [
      sel('flap_outcome', 'Flap outcome', ['Healed', 'Minor dehiscence — healing', 'Major dehiscence', 'Recurrence'], { required: true, redFlags: ['Major dehiscence', 'Recurrence'] }),
      sel('sitting', 'Graduated sitting programme', ['Not started', 'Up to 30 min', 'Up to 2 h', 'Unrestricted with pressure relief']),
      sel('pressure_map', 'Seating assessment / pressure mapping', ['Done', 'Referred', 'Not available']),
      sel('carer_trained', 'Patient / carer trained in pressure relief (every 15–30 min lifts)', ['Yes', 'No'], { redFlags: ['No'] }),
    ],
    flags: {
      preop_review: [{ severity: 'warning', text: 'Correct the cause before flap closure: offloading surface, continence / diversion, spasticity and nutrition (high recurrence otherwise)', when: (a) => has(a, P, 'surface', 'None') || has(a, P, 'continence', 'Uncontrolled faecal soiling — consider diversion') || has(a, P, 'spasm', 'Severe — uncontrolled') }],
      postop_review: flapFlags,
    },
    plan: {
      preop_review: [
        { domain: 'Investigations', kind: 'investigation', text: 'Bone biopsy for histology and culture ± MRI pelvis', when: (a) => !has(a, P, 'osteo', 'Excluded (bone biopsy / MRI)') },
        { domain: 'Rehabilitation and function', text: 'Pressure-redistributing mattress, 2-hourly repositioning, spasticity control and continence plan before surgery' },
      ],
      postop_review: [...flapPostopPlan, { domain: 'Rehabilitation and function', text: 'Air-fluidised / alternating-pressure mattress; no pressure on the flap for 2–3 weeks; turn 2-hourly avoiding the operated side' }],
      procedure_follow_up: [{ domain: 'Rehabilitation and function', text: 'Graduated sitting: 15 min twice daily from week 3, increasing by 15 min daily with skin checks; pressure relief lifts every 15–30 min' }],
    },
    references: ['NPIAP/EPUAP/PPPIA International Guideline — Prevention and treatment of pressure ulcers/injuries (2019)', 'NICE CG179 — Pressure ulcers (2014)', 'Keys et al. 2010 — Pressure sore flap closure and recurrence'],
  },
  {
    id: 'debridement', label: 'Surgical debridement (necrotising / traumatic / chronic wound)', group: 'Wounds and limb salvage', keywords: ['nsti', 'necrotising fasciitis', 'fournier', 'debridement', 'degloving', 'npwt'],
    preop: [
      text('wound', 'Wound — site, size, mechanism', { required: true }),
      sel('nsti', 'Suspected necrotising soft-tissue infection', ['No', 'Yes — LRINEC / clinical'], { redFlags: ['Yes — LRINEC / clinical'] }),
      num('lrinec', 'LRINEC score', '/13', { showIf: { q: 'nsti', in: ['Yes — LRINEC / clinical'] }, hint: '≥ 6 suggests NSTI; a low score does not exclude it' }),
      sel('tetanus', 'Tetanus status', ['Up to date', 'Booster given', 'Immunoglobulin + vaccine given', 'Unknown'], { required: true, redFlags: ['Unknown'] }),
      sel('sepsis', 'Sepsis', ['No', 'Yes — sepsis six started'], { redFlags: ['Yes — sepsis six started'] }),
      sel('npwt_plan', 'NPWT planned after debridement', ['Yes', 'No']),
    ],
    workup: ['Blood cultures', 'Lactate', 'CK'],
    risks: ['Multiple returns to theatre', 'Loss of tissue / limb', 'Sepsis and death (NSTI)', 'Large defect needing grafts / flaps'],
    alternatives: ['Dressings / conservative care (not appropriate for NSTI)'],
    postop: [
      sel('wound_bed', 'Wound bed', ['Clean, bleeding', 'Residual necrosis', 'Spreading'], { required: true, redFlags: ['Residual necrosis', 'Spreading'] }),
      sel('relook', 'Relook in theatre', ['Booked within 24–48 h', 'Not needed']),
      num('lactate', 'Lactate', 'mmol/L'),
    ],
    followUp: [num('area', 'Wound area', 'cm²'), sel('cover', 'Definitive cover', ['Healed', 'Grafted', 'Flap', 'Awaiting cover'])],
    flags: { preop_review: [{ severity: 'urgent', text: 'Suspected NSTI — surgical emergency: theatre within hours, broad-spectrum antibiotics including clindamycin', when: (a) => has(a, P, 'nsti', 'Yes — LRINEC / clinical') }] },
    plan: {
      preop_review: [{ domain: 'Infection control and antimicrobials', text: 'Broad-spectrum IV antibiotics (e.g. piperacillin–tazobactam + clindamycin ± MRSA cover) after blood cultures', priority: 'urgent', when: (a) => has(a, P, 'nsti', 'Yes — LRINEC / clinical') }],
      postop_review: [{ domain: 'Surgical / wound management', text: 'Planned relook debridement every 24–48 h until no further necrosis' }],
    },
    references: ['IDSA 2014 — Skin and soft-tissue infections', 'WSES / SIS-E 2018 — Necrotising soft-tissue infections', 'IWII 2022 — Wound infection in clinical practice'],
  },

  // Hand
  {
    id: 'tendon_repair', label: 'Flexor / extensor tendon repair', group: 'Hand surgery', keywords: ['tendon', 'flexor', 'extensor', 'fdp', 'fds', 'zone ii', 'mallet'],
    preop: [
      sel('tendon_type', 'Tendon', ['Flexor', 'Extensor'], { required: true }),
      text('digits', 'Digits / tendons injured', { required: true, placeholder: 'e.g. FDP + FDS, right index, zone II' }),
      sel('zone', 'Zone', ['I', 'II (no man\'s land)', 'III', 'IV', 'V', 'VI', 'VII', 'VIII']),
      num('hours', 'Time since injury', 'hours', { required: true }),
      sel('nv', 'Associated digital nerve / artery injury', ['None', 'Digital nerve', 'Digital artery', 'Both'], { redFlags: ['Digital artery', 'Both'] }),
      sel('perfusion', 'Digit perfusion', ['Pink, CRT < 2 s', 'Pale / cold'], { required: true, redFlags: ['Pale / cold'] }),
      sel('fracture', 'Associated fracture (X-ray)', ['None', 'Yes']),
      sel('contam', 'Wound contamination', ['Clean', 'Contaminated', 'Bite'], { redFlags: ['Bite'] }),
      sel('therapist', 'Hand therapist available for early active motion', ['Yes', 'No'], { required: true, redFlags: ['No'] }),
    ],
    workup: ['X-ray hand'],
    risks: ['Tendon rupture (≈ 5%)', 'Adhesions and stiffness needing tenolysis', 'Need for prolonged therapy', 'Numbness (nerve injury)', 'Complex regional pain syndrome'],
    alternatives: ['Delayed / staged reconstruction', 'Tenodesis or arthrodesis (zone I)'],
    dayChecks: ['Splint material and hand therapist informed'],
    postop: [
      sel('splint', 'Splint', ['Dorsal blocking splint correct (wrist 20° flex, MCPJ 70°, IPJs straight)', 'Extension splint correct', 'Needs adjustment'], { required: true, redFlags: ['Needs adjustment'] }),
      sel('circulation', 'Digit circulation', ['Normal', 'Compromised'], { required: true, redFlags: ['Compromised'] }),
      sel('elevation', 'Hand elevated', ['Yes', 'No']),
      sel('hand_tx', 'Hand therapy started (day 3–5)', ['Yes', 'Booked', 'Not arranged'], { redFlags: ['Not arranged'] }),
    ],
    followUp: [
      num('tam', 'Total active motion (affected digit)', '°'),
      sel('strickland', 'Strickland (flexor) / Miller (extensor) grade', ['Excellent', 'Good', 'Fair', 'Poor']),
      sel('rupture', 'Rupture / loss of active flexion', ['No', 'Yes — re-explore'], { required: true, redFlags: ['Yes — re-explore'] }),
      sel('adhesion', 'Adhesions / stiffness', ['None', 'Mild', 'Significant — tenolysis'], { redFlags: ['Significant — tenolysis'] }),
      ...handFunction(),
      sel('week_stage', 'Protocol stage', ['0–6 weeks: protected active', '6–8 weeks: wean splint, light use', '8–12 weeks: strengthening', '> 12 weeks: full use']),
    ],
    flags: { procedure_follow_up: [{ severity: 'urgent', text: 'Tendon rupture — early re-repair gives the best result (within 1–2 weeks)', when: (a) => has(a, F, 'rupture', 'Yes — re-explore') }] },
    plan: {
      postop_review: [
        { domain: 'Rehabilitation and function', text: 'Early active motion protocol under the hand therapist (e.g. Manchester short splint / Saint John), splint 6 weeks' },
        { domain: 'Counselling, education and consent', text: 'Never remove the splint or grip / lift with the hand for 6 weeks; rupture risk is highest at 10–14 days' },
      ],
      procedure_follow_up: [{ domain: 'Follow-up and safety-netting', text: 'Review at 2, 6 and 12 weeks; record TAM and grip strength each visit' }],
    },
    references: ['BSSH — Flexor tendon repair standards of care (BSSH evidence for surgical treatment)', 'Tang 2018 — Flexor tendon repair: principles', 'Strickland 1980 grading'],
  },
  {
    id: 'nerve_repair', label: 'Peripheral nerve repair', group: 'Hand surgery', keywords: ['digital nerve', 'median', 'ulnar', 'radial nerve', 'neurorrhaphy', 'nerve graft'],
    preop: [
      text('nerve', 'Nerve(s) injured and level', { required: true }),
      sel('sensory', 'Sensation in the territory', ['Absent', 'Reduced', 'Normal']),
      sel('motor', 'Motor function (MRC)', ['M0', 'M1–2', 'M3', 'M4–5', 'Purely sensory nerve']),
      sel('gap', 'Expected gap', ['None (primary repair)', 'Gap — graft / conduit']),
    ],
    risks: ['Incomplete recovery of sensation / power', 'Neuroma', 'Cold intolerance', 'Need for nerve graft / tendon transfer'],
    postop: [sel('splint', 'Splint protecting the repair', ['Correct', 'Needs adjustment'], { redFlags: ['Needs adjustment'] })],
    followUp: [
      sel('tinel', 'Advancing Tinel sign', ['Advancing', 'Static', 'Not done'], { redFlags: ['Static'] }),
      sel('s_grade', 'Sensory recovery (MRC)', ['S0', 'S1', 'S2', 'S3', 'S3+', 'S4']),
      sel('m_grade', 'Motor recovery (MRC)', ['M0', 'M1', 'M2', 'M3', 'M4', 'M5', 'Not applicable']),
      num('2pd', 'Static two-point discrimination', 'mm'),
      ...handFunction(),
    ],
    plan: { procedure_follow_up: [{ domain: 'Rehabilitation and function', text: 'Sensory re-education; protect insensate skin from burns and cuts; expect ≈ 1 mm/day regeneration' }] },
    references: ['BSSH — Peripheral nerve injury guidance', 'MRC grading of motor and sensory recovery'],
  },

  // Burns
  {
    id: 'burn_excision', label: 'Burn excision and skin grafting', group: 'Burns', keywords: ['burn', 'tangential excision', 'escharotomy'],
    preop: [
      num('tbsa', 'TBSA burned', '%', { required: true }),
      num('ftbsa', 'Full-thickness / deep dermal TBSA', '%'),
      num('days', 'Days since injury', 'days'),
      sel('mechanism', 'Mechanism', ['Flame', 'Scald', 'Contact', 'Electrical', 'Chemical']),
      sel('inhalation', 'Inhalation injury', ['No', 'Suspected', 'Confirmed'], { redFlags: ['Suspected', 'Confirmed'] }),
      num('hb_burn', 'Haemoglobin', 'g/dL'),
      sel('blood', 'Blood cross-matched (≈ 1 unit per 1–2% excised)', ['Yes', 'No'], { required: true, redFlags: ['No'] }),
      sel('donor_avail', 'Donor site availability', ['Adequate', 'Limited — meshing / staged / substitutes']),
      sel('sepsis_burn', 'Signs of burn wound infection / sepsis', ['No', 'Yes'], { redFlags: ['Yes'] }),
    ],
    workup: ['Wound swabs', 'Cross-match'],
    risks: ['Major blood loss and transfusion', 'Hypothermia', 'Graft loss', 'Hypertrophic scarring and contractures', 'Multiple operations', 'Donor-site pain'],
    alternatives: ['Conservative dressings until healing / separation (smaller burns)'],
    dayChecks: ['Theatre warmed to 28–32 °C', 'Blood in theatre'],
    postop: [...graftTake('postop'), num('temp_core', 'Lowest core temperature', '°C'), num('hb_post', 'Post-op haemoglobin', 'g/dL')],
    followUp: [...graftTake('fu'), sel('scar_burn', 'Hypertrophic scarring', ['None', 'Mild', 'Moderate', 'Severe']), sel('pressure_garment', 'Pressure garment', ['Measured', 'Wearing 23 h/day', 'Not wearing'], { redFlags: ['Not wearing'] }), sel('rom', 'Range of motion of affected joints', ['Full', 'Reduced', 'Contracture'], { redFlags: ['Contracture'] })],
    plan: {
      preop_review: [{ domain: 'Nutrition', text: 'High-protein, high-energy feeding (e.g. 1.5–2 g/kg protein); start enteral feeding early if TBSA > 20%', when: (a) => (n(a, P, 'tbsa') ?? 0) >= 15 }],
      procedure_follow_up: [{ domain: 'Rehabilitation and function', text: 'Pressure garments 23 h/day for 12–18 months, silicone, splinting and range-of-motion exercises' }],
    },
    references: ['ISBI Practice Guidelines for Burn Care (2016, 2018)', 'British Burn Association — National standards for provision and outcomes in adult and paediatric burn care'],
  },
  {
    id: 'contracture_release', label: 'Burn / scar contracture release', group: 'Burns', keywords: ['contracture', 'z-plasty', 'release'],
    preop: [
      text('contracture', 'Site and type of contracture', { required: true, placeholder: 'e.g. neck, band; right axilla, sheet' }),
      num('rom_pre', 'Range of motion before surgery', '°'),
      sel('function', 'Functional limitation', ['Mild', 'Moderate', 'Severe']),
      sel('release_plan', 'Planned release', ['Z-plasty / multiple Z', 'Release + FTSG', 'Release + STSG', 'Local / perforator flap', 'Dermal substitute']),
    ],
    risks: ['Recurrence of contracture', 'Graft / flap loss', 'Neurovascular stretch injury after release'],
    postop: [...graftTake('postop'), sel('splint', 'Extension splint / positioning', ['Correct', 'Needs adjustment'], { redFlags: ['Needs adjustment'] })],
    followUp: [num('rom_post', 'Range of motion now', '°', { required: true }), sel('recur', 'Recurrence', ['None', 'Early tightening', 'Recurred'], { redFlags: ['Recurred'] })],
    plan: { procedure_follow_up: [{ domain: 'Rehabilitation and function', text: 'Night splints in the released position for 3–6 months with daily stretching' }] },
    references: ['ISBI Practice Guidelines (2018) — Reconstruction'],
  },

  // Scar
  {
    id: 'keloid_excision', label: 'Keloid excision with adjuvant therapy', group: 'Scar surgery', keywords: ['keloid', 'hypertrophic scar'],
    preop: [
      text('keloid_site', 'Site(s) and size', { required: true }),
      sel('previous_tx', 'Previous treatment', ['None', 'Intralesional steroid', 'Excision (recurred)', 'Radiotherapy']),
      sel('adjuvant', 'Planned adjuvant', ['Intralesional triamcinolone', 'Post-op radiotherapy (within 24–72 h)', 'Pressure (earring / garment)', 'Silicone', 'Combination'], { required: true }),
      sel('excision_type', 'Excision', ['Intramarginal (core) excision', 'Extramarginal excision', 'Shave + adjuvant']),
    ],
    risks: ['Recurrence (50–80% with surgery alone)', 'Steroid atrophy / hypopigmentation', 'Radiotherapy skin effects'],
    alternatives: ['Intralesional steroid ± 5-FU alone', 'Cryotherapy', 'Pressure and silicone therapy'],
    postop: [],
    followUp: [sel('recur', 'Recurrence', ['None', 'Early thickening — inject', 'Recurred'], { required: true, redFlags: ['Recurred'] }), num('injections', 'Steroid injections given so far', '')],
    plan: { procedure_follow_up: [{ domain: 'Surgical / wound management', text: 'Intralesional triamcinolone 10–40 mg/mL every 4–6 weeks at any thickening; pressure / silicone for 6–12 months' }] },
    references: ['Ogawa 2017 — Keloid and hypertrophic scars (Int J Mol Sci)', 'International clinical recommendations on scar management (Gold et al. 2014)'],
  },

  // Congenital
  {
    id: 'cleft_lip', label: 'Cleft lip repair', group: 'Cleft and craniofacial', keywords: ['cleft', 'cheiloplasty', 'harelip'],
    preop: [
      sel('cleft_type', 'Cleft', ['Unilateral incomplete', 'Unilateral complete', 'Bilateral', 'With cleft palate'], { required: true }),
      num('age_wk', 'Age', 'weeks', { required: true, hint: 'Rule of 10s: ≥ 10 weeks, ≥ 10 lb (4.5 kg), Hb ≥ 10 g/dL' }),
      num('weight_kg', 'Weight', 'kg', { required: true }),
      sel('feeding', 'Feeding', ['Feeding well, gaining weight', 'Poor weight gain'], { redFlags: ['Poor weight gain'] }),
      multi('syndrome', 'Associated anomalies', ['None', 'Cardiac', 'Pierre Robin sequence', 'Syndromic features']),
      sel('nam', 'Pre-surgical orthopaedics (NAM / taping)', ['Done', 'Not done']),
      sel('urti', 'URTI in the last 2 weeks', ['No', 'Yes — postpone'], { redFlags: ['Yes — postpone'] }),
    ],
    risks: ['Wound dehiscence', 'Lip asymmetry / notching needing revision', 'Nasal deformity', 'Airway issues after surgery'],
    postop: [sel('airway', 'Airway / breathing', ['Normal', 'Noisy / desaturating'], { required: true, redFlags: ['Noisy / desaturating'] }), sel('arm_splints', 'Arm splints in place', ['Yes', 'No']), sel('feeding_po', 'Feeding', ['Feeding (cup / spoon / bottle)', 'Poor intake'], { redFlags: ['Poor intake'] })],
    followUp: [sel('lip_outcome', 'Lip outcome', ['Good', 'Minor asymmetry', 'Revision needed']), sel('palate_plan', 'Palate repair planned (9–12 months)', ['Not applicable', 'Booked', 'Done']), sel('hearing', 'Audiology', ['Done', 'Referred', 'Not yet'])],
    plan: { procedure_follow_up: [{ domain: 'Follow-up and safety-netting', text: 'Cleft MDT pathway: palate repair 9–12 months, speech and language therapy, audiology, orthodontics and alveolar bone graft at 8–11 years' }] },
    references: ['CRANE / Craniofacial Society of GB & I standards', 'ACPA Parameters for evaluation and treatment of cleft lip/palate (2018)', 'Smile Train safety and quality protocols'],
  },
  {
    id: 'cleft_palate', label: 'Cleft palate repair', group: 'Cleft and craniofacial', keywords: ['palatoplasty', 'cleft palate'],
    preop: [
      sel('cleft_type', 'Cleft', ['Soft palate only', 'Hard and soft palate', 'With cleft lip (repaired)'], { required: true }),
      num('age_mo', 'Age', 'months', { required: true }),
      num('weight_kg', 'Weight', 'kg', { required: true }),
      multi('syndrome', 'Associated anomalies', ['None', 'Pierre Robin sequence', 'Cardiac', 'Syndromic features'], { redFlags: ['Pierre Robin sequence'] }),
      sel('urti', 'URTI in the last 2 weeks', ['No', 'Yes — postpone'], { redFlags: ['Yes — postpone'] }),
    ],
    risks: ['Palatal fistula', 'Velopharyngeal insufficiency needing further surgery', 'Bleeding', 'Airway obstruction after surgery'],
    postop: [sel('airway', 'Airway / breathing', ['Normal', 'Obstructed / desaturating'], { required: true, redFlags: ['Obstructed / desaturating'] }), sel('bleeding', 'Oral bleeding', ['None', 'Oozing', 'Active'], { redFlags: ['Active'] }), sel('feeding_po', 'Feeding', ['Fluids taken', 'Poor intake — IV fluids'], { redFlags: ['Poor intake — IV fluids'] })],
    followUp: [sel('fistula', 'Palatal fistula', ['None', 'Present'], { required: true, redFlags: ['Present'] }), sel('speech', 'Speech assessment', ['Normal for age', 'Hypernasal / VPI', 'Not yet assessed'], { redFlags: ['Hypernasal / VPI'] }), sel('hearing', 'Hearing / grommets', ['Normal', 'Glue ear — ENT', 'Not yet assessed'])],
    plan: { procedure_follow_up: [{ domain: 'Rehabilitation and function', text: 'Speech and language therapy assessment at 18 months and 3 years; ENT / audiology for glue ear' }] },
    references: ['ACPA Parameters (2018)', 'Craniofacial Society of GB & I standards'],
  },
  {
    id: 'hypospadias', label: 'Hypospadias repair', group: 'Cleft and craniofacial', keywords: ['hypospadias', 'tip', 'urethroplasty'],
    preop: [
      sel('meatus', 'Meatal position', ['Glanular / coronal', 'Distal penile', 'Mid-shaft', 'Proximal / penoscrotal / perineal'], { required: true }),
      sel('chordee', 'Chordee', ['None', '< 30°', '> 30°']),
      num('age_mo', 'Age', 'months'),
      sel('testes', 'Both testes descended', ['Yes', 'No — DSD evaluation'], { redFlags: ['No — DSD evaluation'] }),
    ],
    risks: ['Urethrocutaneous fistula', 'Meatal stenosis', 'Glans dehiscence', 'Need for further surgery'],
    postop: [sel('catheter', 'Stent / catheter draining', ['Yes', 'Blocked / dislodged'], { redFlags: ['Blocked / dislodged'] }), sel('penile_dressing', 'Penile dressing / glans colour', ['Satisfactory', 'Dusky glans'], { redFlags: ['Dusky glans'] })],
    followUp: [sel('stream', 'Urinary stream', ['Single, good', 'Spraying / weak', 'Fistula leak'], { required: true, redFlags: ['Fistula leak'] }), sel('cosmesis', 'Cosmesis (HOSE)', ['Good', 'Acceptable', 'Poor'])],
    references: ['EAU / ESPU Paediatric urology guidelines — Hypospadias', 'HOSE score (Holland 2001)'],
  },
  {
    id: 'facial_fracture', label: 'Facial fracture fixation (mandible / zygoma / orbit)', group: 'Cleft and craniofacial', keywords: ['mandible', 'zygoma', 'orbital', 'orif', 'maxillofacial', 'imf'],
    preop: [
      text('fracture', 'Fractures (CT)', { required: true }),
      sel('occlusion', 'Occlusion', ['Normal', 'Deranged']),
      sel('eye', 'Visual acuity / diplopia / entrapment', ['Normal', 'Diplopia', 'Reduced acuity — ophthalmology now', 'Entrapment (child) — urgent'], { required: true, redFlags: ['Reduced acuity — ophthalmology now', 'Entrapment (child) — urgent'] }),
      sel('c_spine', 'C-spine cleared', ['Yes', 'No'], { required: true, redFlags: ['No'] }),
      sel('io_nerve', 'Infraorbital / inferior alveolar nerve sensation', ['Normal', 'Reduced']),
    ],
    workup: ['CT face (fine cut)', 'OPG'],
    risks: ['Malocclusion', 'Nerve numbness', 'Plate infection / exposure', 'Diplopia / enophthalmos (orbit)', 'Need for further surgery'],
    postop: [sel('occlusion_po', 'Occlusion', ['Restored', 'Deranged'], { required: true, redFlags: ['Deranged'] }), sel('vision_po', 'Vision', ['Normal', 'Reduced — urgent'], { required: true, redFlags: ['Reduced — urgent'] }), sel('imf_cutters', 'Wire cutters at bedside (if IMF)', ['Not applicable', 'Yes', 'No'], { redFlags: ['No'] })],
    followUp: [sel('occlusion_fu', 'Occlusion', ['Normal', 'Malocclusion'], { redFlags: ['Malocclusion'] }), num('mouth_opening', 'Mouth opening (interincisal)', 'mm'), sel('diplopia_fu', 'Diplopia / enophthalmos', ['None', 'Present'], { redFlags: ['Present'] })],
    plan: { postop_review: [{ domain: 'Nutrition', text: 'Soft / liquidised diet for 6 weeks; chlorhexidine mouthwash after meals' }] },
    references: ['AO CMF principles of craniomaxillofacial fracture management'],
  },

  // Breast and body
  {
    id: 'breast_reduction', label: 'Reduction mammaplasty', group: 'Breast and body contouring', keywords: ['breast reduction', 'macromastia'],
    preop: [
      num('notch_nipple', 'Sternal notch–nipple distance (R / L)', 'cm'),
      num('resection_est', 'Estimated resection per side', 'g'),
      sel('pattern', 'Planned pattern / pedicle', ['Wise pattern, inferior pedicle', 'Wise pattern, superomedial pedicle', 'Vertical', 'Free nipple graft']),
      sel('screening', 'Breast imaging (age-appropriate)', ['Done — normal', 'Not indicated', 'Abnormal — investigate'], { redFlags: ['Abnormal — investigate'] }),
      sel('smoker_br', 'Smoking (high risk of T-junction breakdown and nipple loss)', ['Non-smoker', 'Stopped ≥ 4 weeks', 'Current smoker'], { redFlags: ['Current smoker'] }),
    ],
    risks: ['Nipple–areola necrosis', 'Altered nipple sensation', 'Inability to breast-feed', 'Asymmetry', 'T-junction wound breakdown', 'Fat necrosis'],
    postop: [sel('nac', 'Nipple–areola complex', ['Pink, refill normal', 'Congested / dusky', 'Pale'], { required: true, redFlags: ['Congested / dusky', 'Pale'] }), sel('haematoma_br', 'Breast haematoma', ['No', 'Yes — return to theatre'], { redFlags: ['Yes — return to theatre'] })],
    followUp: [sel('symmetry', 'Symmetry', ['Good', 'Acceptable', 'Asymmetry']), sel('symptom_relief', 'Relief of back / neck / shoulder symptoms', ['Complete', 'Partial', 'None']), sel('breast_q', 'BREAST-Q completed', ['Yes', 'No'])],
    flags: { postop_review: [{ severity: 'urgent', text: 'Nipple–areola compromise — release sutures, check for haematoma, consider free nipple graft', when: (a) => ['Congested / dusky', 'Pale'].includes(ans(a, M, 'nac')) }] },
    references: ['BAPRAS / NHS commissioning criteria for breast reduction', 'BREAST-Q (Pusic 2009)'],
  },
  {
    id: 'breast_recon', label: 'Breast reconstruction (implant / autologous)', group: 'Breast and body contouring', keywords: ['breast reconstruction', 'tram', 'latissimus dorsi', 'expander', 'mastectomy'],
    preop: [
      sel('timing', 'Timing', ['Immediate', 'Delayed']),
      sel('method', 'Method', ['Tissue expander / implant', 'Latissimus dorsi ± implant', 'Pedicled TRAM', 'Free DIEP / TRAM']),
      sel('rt', 'Radiotherapy (past / planned)', ['None', 'Past', 'Planned'], { redFlags: ['Past', 'Planned'] }),
      sel('onc_clear', 'Oncology / breast MDT agreement', ['Yes', 'Pending'], { required: true, redFlags: ['Pending'] }),
    ],
    risks: ['Flap failure (autologous)', 'Implant infection / extrusion / capsular contracture', 'Abdominal bulge / hernia (TRAM / DIEP)', 'Asymmetry needing further surgery', 'Delay to adjuvant therapy if complications'],
    postop: [...flapMonitor(), sel('drain_br', 'Drains', ['Draining', 'Blocked'], { redFlags: ['Blocked'] })],
    followUp: [sel('recon_outcome', 'Reconstruction outcome', ['Satisfactory', 'Complication (note)']), sel('nipple_plan', 'Nipple reconstruction / symmetrisation planned', ['Yes', 'No']), sel('breast_q', 'BREAST-Q completed', ['Yes', 'No'])],
    flags: { postop_review: flapFlags },
    plan: { postop_review: flapPostopPlan },
    references: ['ABS / BAPRAS — Oncoplastic breast reconstruction guidelines (2021)', 'NICE NG101 — Early and locally advanced breast cancer'],
  },
  {
    id: 'body_contouring', label: 'Abdominoplasty / body contouring', group: 'Breast and body contouring', keywords: ['abdominoplasty', 'tummy tuck', 'liposuction', 'panniculectomy'],
    preop: [
      sel('weight_stable', 'Weight stable ≥ 6–12 months', ['Yes', 'No'], { required: true, redFlags: ['No'] }),
      sel('bariatric', 'Previous bariatric surgery', ['No', 'Yes — nutritional screen']),
      sel('hernia', 'Ventral hernia / diastasis', ['None', 'Diastasis', 'Hernia — general surgery input']),
      sel('bdd', 'Body dysmorphic disorder screen', ['Negative', 'Positive — psychology review before surgery'], { required: true, redFlags: ['Positive — psychology review before surgery'] }),
    ],
    risks: ['Seroma', 'Wound breakdown at the T-junction', 'Umbilical necrosis', 'DVT / PE (high risk)', 'Contour irregularity', 'Scar position'],
    postop: [sel('flexed', 'Hip-flexed position maintained', ['Yes', 'No']), sel('binder', 'Abdominal binder', ['In place', 'Not in place']), sel('umbilicus', 'Umbilicus', ['Healthy', 'Dusky'], { redFlags: ['Dusky'] })],
    followUp: [sel('seroma_fu', 'Seroma', ['None', 'Aspirated', 'Recurrent'], { redFlags: ['Recurrent'] }), sel('satisfaction_contour', 'Contour outcome', ['Good', 'Revision considered'])],
    flags: { preop_review: [{ severity: 'warning', text: 'Positive body dysmorphic disorder screen — psychology assessment before elective aesthetic surgery', when: (a) => has(a, P, 'bdd', 'Positive — psychology review before surgery') }] },
    references: ['ASPS evidence-based clinical practice guideline — Abdominoplasty / VTE (Caprini) in plastic surgery', 'Hurwitz BDD screening (DCQ / BDDQ)'],
  },
];

export const PROCEDURE_BY_ID: Record<string, ProcedureSpec> = Object.fromEntries(PROCEDURES.map(p => [p.id, p]));
export const PROCEDURE_GROUPS = [...new Set(PROCEDURES.map(p => p.group))];

export function searchProcedures(term: string): ProcedureSpec[] {
  const t = term.trim().toLowerCase();
  if (!t) return PROCEDURES;
  return PROCEDURES.filter(p => [p.label, p.group, ...(p.keywords || [])].some(s => s.toLowerCase().includes(t)));
}
