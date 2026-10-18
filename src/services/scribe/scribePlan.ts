/**
 * The scribe's draft treatment plan and its specialty findings.
 *
 * Built only from facts in the record (clinicalFacts): each problem gets its
 * goals, investigations, treatment, monitoring and referrals; each comorbidity
 * that is actually present modifies the plan; and the cross-cutting care every
 * admitted surgical patient needs (VTE prophylaxis, nutrition, analgesia,
 * pressure care, infection control, discharge criteria) is decided from the
 * patient's own risk factors. Every item says why it is there.
 *
 * It is a DRAFT. Nothing here is an order until a consultant approves it.
 */
import { type ClinicalFacts, type Problem, has } from './clinicalFacts';

export interface PlanLine { text: string; why?: string; priority?: 'urgent' | 'routine' }
export interface ProblemPlan {
  problem: string;
  code?: string;
  source: string;
  goals: PlanLine[];
  investigations: PlanLine[];
  treatment: PlanLine[];
  monitoring: PlanLine[];
  referrals: PlanLine[];
}
export interface ScribePlan {
  problems: ProblemPlan[];
  comorbidities: { condition: string; actions: PlanLine[] }[];
  general: { heading: string; items: PlanLine[] }[];
  carriedOver: PlanLine[];          // outstanding items from the clerking plan
  dischargeCriteria: string[];
  followUp: string[];
  cautions: string[];
  basis: string[];                   // the facts the plan was built from
}
export interface ScribeFinding {
  specialty: string;
  category: string;
  finding: string;
  severity: 'info' | 'warning' | 'critical';
  recommendation: string;
  evidence: string;
}

const L = (text: string, why?: string, priority?: 'urgent' | 'routine'): PlanLine => ({ text, why, priority });

// ── Problem library ────────────────────────────────────────────────────────

type Template = (pr: Problem, f: ClinicalFacts) => Omit<ProblemPlan, 'problem' | 'code' | 'source'>;

const PROBLEM_TEMPLATES: { match: RegExp; build: Template }[] = [
  {
    match: /pressure (ulcer|sore|injur)|decubitus|bed ?sore|\bL89\b/i,
    build: (pr, f) => {
      const site = /glut|sacr|ischi|troch|heel/i.exec(pr.label + ' ' + f.complaints.map(c => c.label).join(' '))?.[0];
      return {
        goals: [
          L('Clean, granulating wound bed free of necrotic tissue and infection'),
          L('No new pressure injury; offloading maintained 24 hours a day'),
          L('Definitive closure — flap reconstruction when the patient and wound are optimised', 'Most stage 3–4 pressure injuries over bony prominences need flap cover'),
        ],
        investigations: [
          L('Stage the injury (NPIAP 1–4 / unstageable) with measured length × width × depth and photograph with scale', 'Baseline for healing; drives the plan', 'urgent'),
          L('Deep tissue culture (after debridement), not a surface swab', 'Surface swabs grow colonisers', 'urgent'),
          L('FBC, CRP / ESR, U&E, creatinine, LFT, serum albumin / pre-albumin, random blood glucose', 'Infection, nutrition, renal dosing', 'urgent'),
          L(`X-ray of the underlying bone${site ? ` (${site.toLowerCase()} region)` : ''}; MRI if bone is exposed or probe-to-bone positive`, 'Exclude osteomyelitis before reconstruction'),
          L('Braden score on admission and every 48 h'),
        ],
        treatment: [
          L('Sharp surgical debridement of necrotic tissue / slough (theatre if extensive)', 'Necrotic tissue prevents healing and harbours infection', 'urgent'),
          L('Offloading: 2-hourly repositioning (30° tilt), pressure-redistributing / air mattress, heel offloading', undefined, 'urgent'),
          L('Moisture-balanced dressings; consider negative-pressure wound therapy once debrided and clean'),
          L('Systemic antibiotics only for spreading cellulitis, sepsis or osteomyelitis — guided by tissue culture', 'Avoid treating colonisation'),
          L('Continence and moisture management (barrier creams, catheter / faecal management if soiling the wound)'),
          L('Flap reconstruction (e.g. gluteal rotation / V-Y advancement) once wound clean, nutrition optimised and offloading assured', 'Plan at consultant review'),
        ],
        monitoring: [
          L('Wound measurement and photograph weekly (Wound Monitor)'),
          L('Daily skin inspection of all pressure areas'),
          L('Temperature, pulse; CRP trend'),
        ],
        referrals: [L('Dietitian'), L('Physiotherapy (positioning, mobilisation)'), L('Tissue viability nurse')],
      };
    },
  },
  {
    match: /necrotis|necrotiz|fournier|gas gangrene/i,
    build: () => ({
      goals: [L('Source control within hours; survival'), L('Reconstruction after infection controlled')],
      investigations: [L('FBC, CRP, U&E, lactate, glucose, coagulation, blood cultures, group & cross-match', undefined, 'urgent'), L('LRINEC score', undefined, 'urgent')],
      treatment: [L('Emergency radical debridement in theatre; planned relook at 24–48 h', 'Delay increases mortality', 'urgent'), L('Broad-spectrum IV antibiotics including anti-anaerobic and anti-toxin cover (e.g. clindamycin) per local protocol', undefined, 'urgent'), L('Resuscitation: IV fluids, catheter, consider HDU/ICU', undefined, 'urgent')],
      monitoring: [L('Hourly observations and urine output; repeat lactate')],
      referrals: [L('Anaesthesia / ICU', undefined, 'urgent'), L('Microbiology')],
    }),
  },
  {
    match: /burn|scald/i,
    build: () => ({
      goals: [L('Resuscitation and wound healing; prevention of infection and contracture')],
      investigations: [L('TBSA (Lund & Browder) and depth assessment', undefined, 'urgent'), L('FBC, U&E, glucose, group & save; carboxyhaemoglobin if inhalation suspected', undefined, 'urgent')],
      treatment: [L('Fluid resuscitation per Parkland formula if TBSA ≥ 15% adult (Burns module)', undefined, 'urgent'), L('Analgesia; tetanus status'), L('Wound care — cleaning, de-roofing blisters, appropriate dressings; early excision and grafting of deep burns')],
      monitoring: [L('Hourly urine output (target 0.5 mL/kg/h adult)'), L('Circumferential burns — escharotomy watch')],
      referrals: [L('Dietitian (hypermetabolism)'), L('Physiotherapy / splinting')],
    }),
  },
  {
    match: /cellulitis|abscess|wound infection|infected/i,
    build: () => ({
      goals: [L('Resolution of infection; drain any collection')],
      investigations: [L('FBC, CRP, glucose; pus / tissue for M/C/S before antibiotics', undefined, 'urgent'), L('Ultrasound if a collection is suspected')],
      treatment: [L('Incision and drainage of any abscess', undefined, 'urgent'), L('Empirical antibiotics per local antibiogram, rationalised to culture'), L('Elevation; mark the margin of erythema')],
      monitoring: [L('Erythema margin and temperature twice daily')],
      referrals: [],
    }),
  },
  {
    match: /diabetic foot/i,
    build: () => ({
      goals: [L('Limb salvage; control of infection; glycaemic control')],
      investigations: [L('Foot X-ray; probe-to-bone; ABPI / Doppler pulses', undefined, 'urgent'), L('FBC, CRP, HbA1c, glucose profile, U&E; deep tissue culture', undefined, 'urgent')],
      treatment: [L('Debridement of necrotic / infected tissue', undefined, 'urgent'), L('Offloading of the foot'), L('Antibiotics guided by culture if infected')],
      monitoring: [L('Daily foot review; glucose QDS')],
      referrals: [L('Vascular surgery if pulses absent / ABPI < 0.9'), L('Endocrinology / diabetes team')],
    }),
  },
  {
    match: /leg ulcer|venous ulcer|chronic (ulcer|wound)|non[- ]healing/i,
    build: () => ({
      goals: [L('Establish the cause; healing')],
      investigations: [L('ABPI before any compression', 'Compression is unsafe in arterial disease', 'urgent'), L('Wound-edge biopsy if > 3 months or atypical', 'Exclude Marjolin ulcer'), L('FBC, glucose, albumin')],
      treatment: [L('Debridement; moisture-balanced dressings'), L('Compression therapy if venous and ABPI 0.8–1.3'), L('Split-skin graft once the bed is clean')],
      monitoring: [L('Weekly measurement and photograph')],
      referrals: [L('Vascular surgery if arterial component')],
    }),
  },
  {
    match: /carcinoma|melanoma|malignan|marjolin|sarcoma|cancer|\bBCC\b|\bSCC\b/i,
    build: () => ({
      goals: [L('Histological diagnosis, staging and complete excision with clear margins')],
      investigations: [L('Biopsy (incisional / excisional) if not yet confirmed', undefined, 'urgent'), L('Examine regional lymph nodes; staging imaging per tumour type (Tumour Board)')],
      treatment: [L('Wide local excision with margins per tumour type and reconstruction'), L('Present at Tumour Board / MDT')],
      monitoring: [L('Surveillance schedule after treatment (Tumour Board)')],
      referrals: [L('Oncology / radiotherapy as indicated by MDT')],
    }),
  },
  {
    match: /keloid|hypertrophic scar/i,
    build: () => ({
      goals: [L('Flatten and soften the scar; prevent recurrence')],
      investigations: [L('Baseline measurement and photograph (Scar monitor)'), L('Vancouver / POSAS score')],
      treatment: [L('Intralesional triamcinolone series (Keloid Care)'), L('Excision with adjuvant (steroid / radiotherapy) for refractory lesions'), L('Pressure garments / silicone')],
      monitoring: [L('Review every 4–6 weeks during injections')],
      referrals: [],
    }),
  },
  {
    match: /contracture/i,
    build: () => ({
      goals: [L('Restore range of motion and function')],
      investigations: [L('Range of motion measurement; X-ray if joint involvement suspected')],
      treatment: [L('Release with graft / flap (Z-plasty for linear bands)'), L('Post-operative splinting and physiotherapy')],
      monitoring: [L('ROM at each review')],
      referrals: [L('Physiotherapy / occupational therapy')],
    }),
  },
  {
    match: /lacerat|open wound|degloving|avulsion|trauma|crush|RTA|fracture/i,
    build: () => ({
      goals: [L('Clean wound, preserved function, early definitive cover')],
      investigations: [L('Neurovascular examination distal to the injury', undefined, 'urgent'), L('X-ray for fracture / foreign body', undefined, 'urgent')],
      treatment: [L('Wound toilet and debridement; tetanus prophylaxis', undefined, 'urgent'), L('Antibiotics for contaminated / open-fracture wounds'), L('Definitive closure or reconstruction once clean')],
      monitoring: [L('Neurovascular observations; compartment watch for limb injuries')],
      referrals: [L('Orthopaedics if fracture')],
    }),
  },
];

const GENERIC: Template = () => ({
  goals: [L('Confirm the diagnosis and its severity')],
  investigations: [L('Investigations directed by the clerking and the consultant review')],
  treatment: [L('Management to be defined at consultant review')],
  monitoring: [],
  referrals: [],
});

// ── Comorbidity modifiers ──────────────────────────────────────────────────

const COMORBIDITY_ACTIONS: Record<string, (f: ClinicalFacts) => PlanLine[]> = {
  diabetes: () => [L('Capillary glucose QDS; target 6–10 mmol/L'), L('HbA1c if not done in 3 months'), L('Peri-operative insulin / OHA plan (omit metformin on the morning of surgery; VRIII if NBM)')],
  hypertension: () => [L('Continue antihypertensives (hold ACE-i / ARB on the morning of major surgery)'), L('BP target < 160/100 before elective surgery')],
  stroke: () => [L('Swallow screen before oral intake; aspiration precautions', 'Previous stroke'), L('Continue secondary prevention; plan antiplatelet management around surgery'), L('Physiotherapy for positioning and mobility')],
  sickle_cell: () => [L('Hb, HbS %; keep warm, well hydrated and oxygenated'), L('Haematology review before major surgery (transfusion / exchange)')],
  hiv: () => [L('Continue ART without interruption; CD4 count and viral load'), L('Check drug interactions with new prescriptions')],
  tb: () => [L('Confirm treatment status; infection-control precautions if active')],
  ckd: () => [L('Renally dose all drugs; avoid NSAIDs and nephrotoxins'), L('U&E every 48 h')],
  heart_disease: () => [L('ECG; echocardiogram if heart failure suspected or not recent'), L('Careful fluid balance')],
  liver_disease: () => [L('LFT, clotting; adjust drug doses')],
  asthma_copd: () => [L('Continue inhalers; peri-operative bronchodilators; chest physiotherapy')],
  epilepsy: () => [L('Continue anticonvulsants without missed doses (IV route if NBM)')],
  immunosuppression: () => [L('Steroid cover peri-operatively; expect delayed healing')],
  thromboembolism: () => [L('Previous VTE — therapeutic-dose consideration; haematology advice before surgery')],
  peripheral_arterial: () => [L('ABPI / Doppler before compression or reconstruction; vascular review')],
  obesity: () => [L('Weight-adjusted LMWH dose'), L('Bariatric equipment; anaesthetic airway assessment'), L('Higher wound dehiscence / infection risk — consider NPWT on closure')],
  malnutrition: () => [L('Dietitian; high-protein high-energy supplements')],
  anaemia: () => [L('Investigate and correct before reconstruction (target Hb ≥ 10 g/dL for flap surgery)')],
  pregnancy: () => [L('Obstetric input; avoid teratogenic drugs and unnecessary radiation')],
  immobility: () => [L('Pressure-area care 2-hourly; mattress; VTE prophylaxis')],
};

// ── Building the plan ──────────────────────────────────────────────────────

export function buildScribePlan(f: ClinicalFacts): ScribePlan {
  const problems: ProblemPlan[] = f.problems.map(pr => {
    const t = PROBLEM_TEMPLATES.find(x => x.match.test(`${pr.label} ${pr.code || ''}`))?.build || GENERIC;
    return { problem: pr.label, code: pr.code, source: pr.source, ...t(pr, f) };
  });
  // A complaint with no recorded diagnosis still gets its working plan.
  if (!problems.length) {
    for (const c of f.complaints) {
      const t = PROBLEM_TEMPLATES.find(x => x.match.test(c.label))?.build || GENERIC;
      problems.push({ problem: `${c.label}${c.duration ? ` (${c.duration})` : ''} — working diagnosis to be confirmed`, source: 'Presenting complaint', ...t({ label: c.label, source: 'Presenting complaint' }, f) });
    }
  }

  const comorbidities = [...f.conditions.values()]
    .filter(c => c.presence === 'present' && COMORBIDITY_ACTIONS[c.id] && !problemCovers(problems, c.id))
    .map(c => ({ condition: `${c.label}${c.detail ? ` (${c.detail})` : ''}`, actions: COMORBIDITY_ACTIONS[c.id](f) }));

  // VTE: decided from the patient's own risk factors.
  const vteRisks = [
    has(f, 'immobility') && 'immobility',
    has(f, 'obesity') && 'obesity',
    has(f, 'stroke') && 'previous stroke',
    has(f, 'cancer') && 'malignancy',
    has(f, 'thromboembolism') && 'previous VTE',
    (f.age ?? 0) >= 60 && `age ${f.age}`,
    has(f, 'sepsis') && 'sepsis',
  ].filter(Boolean) as string[];
  const onAnticoag = f.medications.some(m => /enoxaparin|clexane|heparin|fondaparinux|rivaroxaban|apixaban|warfarin|dabigatran/i.test(m));
  const bleedRisk = has(f, 'liver_disease') || /bleeding disorder/i.test([...f.conditions.values()].map(c => c.label).join(' '));
  const vte: PlanLine[] = vteRisks.length
    ? onAnticoag
      ? [L('Already on anticoagulation — confirm dose and plan around surgery', `Risk: ${vteRisks.join(', ')}`)]
      : [
          L(bleedRisk ? 'Mechanical prophylaxis (IPC / stockings); pharmacological only after bleeding-risk review'
                      : `Enoxaparin 40 mg SC once daily${has(f, 'obesity') ? ' (weight-adjusted)' : ''}${has(f, 'ckd') ? ' — reduce for CrCl < 30' : ''} + mechanical prophylaxis`,
            `Risk factors: ${vteRisks.join(', ')}; not currently prescribed`, 'urgent'),
          L('Hold LMWH 12 h before surgery / neuraxial anaesthesia'),
        ]
    : [L('VTE risk assessment (Caprini) on admission and after any change')];

  const general = [
    { heading: 'VTE prophylaxis', items: vte },
    { heading: 'Nutrition', items: [
      L('MUST screen; weight and BMI'),
      ...(f.problems.some(p => /ulcer|wound|burn|pressure/i.test(p.label)) || has(f, 'malnutrition')
        ? [L('High-protein diet (1.25–1.5 g/kg/day) with oral supplements; zinc / vitamin C if deficient', 'Wound healing'), L('Serum albumin / pre-albumin baseline and weekly')]
        : []),
    ] },
    { heading: 'Analgesia', items: [L('Regular paracetamol; add opioid for dressing changes / debridement as needed (WHO ladder)'), L('Avoid NSAIDs if renal impairment, peptic disease or bleeding risk')] },
    { heading: 'Nursing care', items: [
      L('Observations 4-hourly (NEWS2); fluid balance chart'),
      ...(has(f, 'immobility') || f.problems.some(p => /pressure/i.test(p.label)) ? [L('Pressure-area care: 2-hourly turns, Braden score, air mattress')] : []),
    ] },
    { heading: 'Infection control', items: [L('Wound care with aseptic technique; tissue culture before antibiotics; antibiotic review at 48–72 h')] },
    { heading: 'Mobilisation and rehabilitation', items: [L(has(f, 'immobility') ? 'Physiotherapy: positioning, chest physio, passive / active exercises' : 'Early mobilisation as tolerated')] },
  ];

  const carriedOver = f.plan
    .filter(p => p.status !== 'done')
    .map(p => L(`${p.text}${p.status && p.status !== 'pending' ? ` — ${p.status.replace(/_/g, ' ')}` : ''}`, 'From the clerking plan', p.priority === 'urgent' ? 'urgent' : 'routine'));

  const dischargeCriteria = [
    'Wound clean and either healed or with a dressing plan manageable at home / clinic',
    'Afebrile 48 h; infection markers falling; oral analgesia adequate',
    'Comorbidities stable on the discharge regimen',
    ...(has(f, 'immobility') ? ['Carer able to provide pressure-area care; pressure-relieving mattress at home'] : []),
    'Follow-up booked; patient / carer educated',
  ];
  const followUp = ['Plastic surgery clinic 1–2 weeks after discharge', 'Wound photographs at each visit (Wound Monitor)'];

  const cautions: string[] = [];
  if (f.allergies.status === 'not_documented') cautions.push('Allergy status is not documented — confirm before prescribing.');
  if ((f.age ?? 0) >= 65) cautions.push(`Age ${f.age}: frailty and delirium risk; review drug doses.`);
  if (f.sex.startsWith('f') && (f.age ?? 99) >= 12 && (f.age ?? 0) <= 50) cautions.push('Pregnancy test before theatre or radiology.');
  cautions.push(...f.gaps.filter(g => !/Allergy status/.test(g)));

  const basis = [
    ...f.complaints.map(c => `Presenting complaint: ${c.label}${c.duration ? ` (${c.duration})` : ''}`),
    ...f.problems.map(p => `Diagnosis: ${p.label}${p.code ? ` (${p.code})` : ''} — ${p.source}`),
    ...[...f.conditions.values()].filter(c => c.presence === 'present').map(c => `Condition: ${c.label} — ${c.evidence}`),
    ...f.riskFactors.map(r => `Risk factor: ${r}`),
  ];

  return { problems, comorbidities, general, carriedOver, dischargeCriteria, followUp, cautions, basis };
}

/** A problem already handled by its own template (e.g. pressure injury) is not repeated as a comorbidity. */
function problemCovers(problems: ProblemPlan[], conditionId: string) {
  const map: Record<string, RegExp> = { pressure_injury: /pressure|decubitus/i, cancer: /carcinoma|malign|cancer/i, burns: /burn/i };
  return map[conditionId] ? problems.some(p => map[conditionId].test(p.problem)) : false;
}

// ── Specialty findings (evidence-backed) ───────────────────────────────────

export function buildFindings(f: ClinicalFacts, vitals?: any, labs?: { name: string; value: number | null; unit?: string }[]): ScribeFinding[] {
  const out: ScribeFinding[] = [];
  const add = (x: ScribeFinding) => out.push(x);
  const ev = (id: string) => f.conditions.get(id)?.evidence || 'Record';

  for (const pr of f.problems) {
    if (/pressure|decubitus|\bL89\b/i.test(`${pr.label} ${pr.code || ''}`)) {
      add({ specialty: 'Plastic Surgery', category: 'Wound', finding: `${pr.label}${pr.code ? ` (${pr.code})` : ''}`, severity: 'warning',
        recommendation: 'Stage and measure; debride necrotic tissue; deep tissue culture; exclude osteomyelitis; offload 24 h; optimise nutrition; plan flap cover when clean.', evidence: pr.source });
    }
  }
  if (has(f, 'sepsis')) add({ specialty: 'Infectious Disease', category: 'Sepsis', finding: 'Sepsis documented', severity: 'critical', recommendation: 'Sepsis-6 within 1 hour: cultures, lactate, IV antibiotics, fluids, urine output, oxygen; source control.', evidence: ev('sepsis') });
  if (has(f, 'wound_infection')) add({ specialty: 'Infectious Disease', category: 'Wound', finding: 'Wound infection documented', severity: 'warning', recommendation: 'Tissue / pus culture before antibiotics; drain collections; rationalise to sensitivities.', evidence: ev('wound_infection') });
  if (has(f, 'stroke')) add({ specialty: 'Neurology / Rehabilitation', category: 'Neurological', finding: 'Previous stroke', severity: 'warning', recommendation: 'Swallow screen and aspiration precautions; plan antiplatelets around surgery; physiotherapy; contributes to immobility and pressure / VTE risk.', evidence: ev('stroke') });
  if (has(f, 'immobility')) add({ specialty: 'Rehabilitation / Nursing', category: 'Pressure & VTE', finding: `${f.conditions.get('immobility')!.label}`, severity: 'warning', recommendation: '2-hourly repositioning, pressure-redistributing mattress, Braden score; VTE prophylaxis.', evidence: ev('immobility') });
  if (has(f, 'obesity')) add({ specialty: 'Anaesthesia', category: 'Perioperative', finding: 'Obesity', severity: 'info', recommendation: 'Airway assessment; weight-adjusted LMWH; higher wound complication risk.', evidence: ev('obesity') });
  if (has(f, 'diabetes')) add({ specialty: 'Endocrinology', category: 'Metabolic', finding: `Diabetes mellitus${f.conditions.get('diabetes')!.detail ? ` (${f.conditions.get('diabetes')!.detail})` : ''}`, severity: 'warning', recommendation: 'Glucose QDS (target 6–10 mmol/L); HbA1c; peri-operative insulin / OHA plan; impaired healing.', evidence: ev('diabetes') });
  if (has(f, 'sickle_cell')) add({ specialty: 'Haematology', category: 'Blood', finding: 'Sickle cell disease', severity: 'warning', recommendation: 'Hydration, warmth, oxygenation; Hb / HbS %; haematology review before major surgery.', evidence: ev('sickle_cell') });
  if (has(f, 'hiv')) add({ specialty: 'Infectious Disease', category: 'Chronic infection', finding: 'HIV infection', severity: 'info', recommendation: 'Continue ART; CD4 and viral load; check interactions.', evidence: ev('hiv') });
  if (has(f, 'ckd')) add({ specialty: 'Nephrology', category: 'Renal', finding: 'Chronic kidney disease', severity: 'warning', recommendation: 'Renal dosing; avoid NSAIDs / nephrotoxins; U&E trend.', evidence: ev('ckd') });
  if (has(f, 'hypertension')) add({ specialty: 'Cardiology', category: 'Cardiovascular', finding: 'Hypertension', severity: 'info', recommendation: 'Continue treatment; target < 160/100 before elective surgery.', evidence: ev('hypertension') });
  if (has(f, 'cancer')) add({ specialty: 'Oncology', category: 'Malignancy', finding: 'Malignancy documented', severity: 'warning', recommendation: 'Histology, staging and Tumour Board discussion.', evidence: ev('cancer') });

  // VTE gap
  const vteRisk = has(f, 'immobility') || has(f, 'obesity') || has(f, 'stroke') || has(f, 'cancer') || (f.age ?? 0) >= 60;
  const onAnticoag = f.medications.some(m => /enoxaparin|clexane|heparin|fondaparinux|rivaroxaban|apixaban|warfarin|dabigatran/i.test(m));
  if (vteRisk && !onAnticoag) {
    add({ specialty: 'Vascular / Haematology', category: 'Thromboprophylaxis', finding: 'VTE risk present — no prophylaxis prescribed', severity: 'warning',
      recommendation: 'Prescribe LMWH (unless contraindicated) with mechanical prophylaxis.', evidence: 'Risk factors in clerking; prescriptions reviewed' });
  }

  // Vital signs — only from real numbers.
  const v = vitals || {};
  const t = Number(v.temperature), hr = Number(v.pulse ?? v.heart_rate), sbp = Number(v.bp_systolic ?? v.systolic), spo2 = Number(v.spo2 ?? v.oxygen_saturation), rr = Number(v.respiratory_rate);
  if (t >= 38) add({ specialty: 'Infectious Disease', category: 'Vital signs', finding: `Febrile ${t}°C`, severity: t >= 39.5 ? 'critical' : 'warning', recommendation: 'Look for the source (wound, chest, urine, lines); cultures before antibiotics.', evidence: 'Latest vital signs' });
  if (sbp > 0 && sbp < 90) add({ specialty: 'Critical Care', category: 'Vital signs', finding: `Hypotension ${sbp} mmHg`, severity: 'critical', recommendation: 'Fluid bolus; assess for sepsis / bleeding; escalate.', evidence: 'Latest vital signs' });
  if (hr > 120) add({ specialty: 'Critical Care', category: 'Vital signs', finding: `Tachycardia ${hr} bpm`, severity: 'warning', recommendation: 'Assess for sepsis, pain, hypovolaemia; ECG.', evidence: 'Latest vital signs' });
  if (spo2 > 0 && spo2 < 94) add({ specialty: 'Respiratory', category: 'Vital signs', finding: `SpO₂ ${spo2}%`, severity: 'critical', recommendation: 'Oxygen to target 94–98% (88–92% if COPD); chest examination, CXR.', evidence: 'Latest vital signs' });
  if (rr > 24) add({ specialty: 'Respiratory', category: 'Vital signs', finding: `Respiratory rate ${rr}/min`, severity: 'warning', recommendation: 'Assess for sepsis, PE, pneumonia.', evidence: 'Latest vital signs' });

  // Labs — numeric values only.
  for (const lab of labs || []) {
    if (lab.value == null) continue;
    if (/\b(hb|haemoglobin|hemoglobin)\b/i.test(lab.name) && lab.value < 10) add({ specialty: 'Haematology', category: 'Blood', finding: `Hb ${lab.value} g/dL`, severity: lab.value < 7 ? 'critical' : 'warning', recommendation: 'Investigate and correct; consider transfusion if < 7 g/dL or before reconstruction.', evidence: 'Laboratory result' });
    if (/albumin/i.test(lab.name) && lab.value < 30) add({ specialty: 'Nutrition', category: 'Supportive care', finding: `Albumin ${lab.value} g/L`, severity: 'warning', recommendation: 'Dietitian; protein supplementation — impaired healing.', evidence: 'Laboratory result' });
    if (/glucose/i.test(lab.name) && lab.value > 11) add({ specialty: 'Endocrinology', category: 'Metabolic', finding: `Glucose ${lab.value} mmol/L`, severity: 'warning', recommendation: 'Repeat; HbA1c; treat hyperglycaemia.', evidence: 'Laboratory result' });
  }

  if ((f.age ?? 0) >= 65) add({ specialty: 'Geriatrics', category: 'Elderly care', finding: `Age ${f.age}`, severity: 'info', recommendation: 'Frailty and delirium screen; medication review; falls risk.', evidence: 'Date of birth' });
  if (f.allergies.status === 'not_documented') add({ specialty: 'Pharmacy', category: 'Safety', finding: 'Allergy status not documented', severity: 'warning', recommendation: 'Ask and record allergies before any new prescription.', evidence: 'Clerking / registration' });

  const order = { critical: 0, warning: 1, info: 2 } as const;
  return out.sort((a, b) => order[a.severity] - order[b.severity]);
}
