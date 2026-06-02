/**
 * Intelligent Prescription Recommendation Engine
 * -----------------------------------------------
 * Maps diagnoses + comorbidities + patient factors to a draft prescription list
 * sourced from the existing BNF drug database.
 *
 * Pipeline:
 *   1. Build candidate drug IDs from diagnosis & comorbidity rules
 *   2. Look each candidate up in BNF_DRUG_DATABASE
 *   3. Run generatePatientWarnings() and drop any drug flagged "danger"
 *      (allergy, pregnancy X/D, renal/hepatic avoid, etc.)
 *   4. Pick a sensible default dose/route/frequency (with renal/elderly tweaks)
 *   5. Return RecommendedDraft[] for clinician review
 *
 * This is a Clinical Decision Support System — the clinician remains responsible
 * for the final prescription.
 */

import {
  BNF_DRUG_DATABASE,
  getDrugById,
  generatePatientWarnings,
  type BNFDrug,
  type DrugRoute,
  type DrugFrequency,
} from '../data/bnfDrugDatabase';

export interface PatientInput {
  name?: string;
  hospitalNumber?: string;
  age?: number;
  weight?: number;
  height?: number;
  sex?: 'male' | 'female';
  pregnant?: boolean;
  gestationalAgeWeeks?: number;
  lactating?: boolean;
  gfr?: number;
  hepaticImpairment?: boolean;
  cardiacDisease?: boolean;
  allergies: string[];
  comorbidities: string[];        // free-text labels (matches rule triggers, case-insensitive)
  diagnoses: string[];            // primary + secondary + additional
  currentMedications: string[];
  /** Optional labs that may sharpen recommendations */
  labs?: {
    haemoglobin?: number;
    creatinine?: number;
    hba1c?: number;
    albumin?: number;
    crp?: number;
  };
}

export type Indication =
  | 'pain'
  | 'severe_pain'
  | 'neuropathic_pain'
  | 'infection'
  | 'wound_healing'
  | 'anaemia'
  | 'constipation'
  | 'gastroprotection'
  | 'pvd_support'
  | 'appetite'
  | 'antispasmodic'
  | 'pregnancy_supplement'
  | 'dvt_prophylaxis';

export interface RecommendedDraft {
  drug: BNFDrug;
  dose: string;
  route: DrugRoute;
  frequency: DrugFrequency;
  duration: string;
  instructions: string;
  indication: Indication;
  rationale: string;            // human-readable why
  warnings: { level: 'danger' | 'warning' | 'info'; message: string }[];
  /** Order in which this should appear; lower = higher priority */
  priority: number;
}

// ─── Rule lookups ──────────────────────────────────────────────────────────

type Norm = (s: string) => string;
const norm: Norm = (s) => (s || '').toLowerCase().trim();
const has = (list: string[], needle: string) =>
  list.some((x) => norm(x).includes(needle));
const hasAny = (list: string[], needles: string[]) =>
  needles.some((n) => has(list, n));

/** Diagnosis → candidate drug IDs (broad coverage of the spec) */
const DIAGNOSIS_RULES: Array<{
  match: string[];
  indication: Indication;
  drugIds: string[];
  priority: number;
  rationale: string;
}> = [
  // Pain
  { match: ['pain', 'post-op', 'postoperative', 'fracture', 'sprain', 'burn'],
    indication: 'pain', drugIds: ['paracetamol', 'diclofenac', 'ibuprofen'],
    priority: 10, rationale: 'First-line analgesia (WHO step 1)' },
  { match: ['severe pain', 'cancer pain', 'malignant pain', 'major surgery'],
    indication: 'severe_pain', drugIds: ['paracetamol', 'tramadol', 'morphine'],
    priority: 5, rationale: 'Multimodal analgesia for moderate-to-severe pain' },
  // Infection
  { match: ['cellulitis', 'soft tissue infection', 'wound infection', 'abscess'],
    indication: 'infection', drugIds: ['amoxicillin-clavulanate', 'cloxacillin', 'clindamycin'],
    priority: 5, rationale: 'Empirical Gram-positive cover for skin/soft tissue infection' },
  { match: ['necrotising fasciitis', 'necrotizing fasciitis', 'sepsis', 'severe infection'],
    indication: 'infection', drugIds: ['piperacillin-tazobactam', 'meropenem', 'clindamycin', 'vancomycin'],
    priority: 1, rationale: 'Broad-spectrum cover for severe / necrotising infection' },
  { match: ['osteomyelitis'],
    indication: 'infection', drugIds: ['cloxacillin', 'clindamycin', 'ceftriaxone'],
    priority: 3, rationale: 'Bone infection cover (escalate per culture/MRI)' },
  { match: ['diabetic foot', 'diabetic foot ulcer'],
    indication: 'infection', drugIds: ['amoxicillin-clavulanate', 'metronidazole', 'ciprofloxacin'],
    priority: 3, rationale: 'Mixed aerobic + anaerobic cover for diabetic foot infection' },
  { match: ['uti', 'urinary tract infection'],
    indication: 'infection', drugIds: ['ciprofloxacin', 'cefuroxime'],
    priority: 6, rationale: 'Empirical UTI cover' },
  { match: ['pneumonia', 'chest infection', 'lrti'],
    indication: 'infection', drugIds: ['amoxicillin-clavulanate', 'ceftriaxone', 'levofloxacin'],
    priority: 5, rationale: 'Community-acquired pneumonia cover' },
  // Wound healing
  { match: ['chronic wound', 'pressure ulcer', 'pressure sore', 'venous ulcer', 'diabetic foot', 'burn'],
    indication: 'wound_healing', drugIds: ['vitamin-c', 'zinc-sulphate', 'multivitamin'],
    priority: 12, rationale: 'Nutritional support for wound healing (Vit C, zinc, multivitamins)' },
  // Anaemia
  { match: ['anaemia', 'anemia', 'iron deficiency'],
    indication: 'anaemia', drugIds: ['ferrous-sulphate', 'folic-acid', 'vitamin-b12'],
    priority: 8, rationale: 'Haematinic replacement for anaemia' },
  // Neuropathic pain
  { match: ['neuropathy', 'peripheral neuropathy', 'neuropathic pain', 'post-herpetic'],
    indication: 'neuropathic_pain', drugIds: ['gabapentin', 'pregabalin', 'amitriptyline'],
    priority: 8, rationale: 'First-line neuropathic pain agents' },
  // PVD
  { match: ['peripheral vascular disease', 'pvd', 'intermittent claudication'],
    indication: 'pvd_support', drugIds: ['pentoxifylline', 'cilostazol', 'aspirin', 'clopidogrel'],
    priority: 9, rationale: 'Vasoactive + antiplatelet support for PVD' },
  // DVT prophylaxis
  { match: ['immobilised', 'immobilized', 'post-op', 'major surgery', 'dvt risk'],
    indication: 'dvt_prophylaxis', drugIds: ['enoxaparin', 'heparin'],
    priority: 7, rationale: 'Pharmacological VTE prophylaxis' },
];

/** Comorbidity → candidate drug IDs */
const COMORBIDITY_RULES: Array<{
  match: string[];
  indication: Indication;
  drugIds: string[];
  priority: number;
  rationale: string;
}> = [
  { match: ['peptic ulcer', 'pud', 'gastritis', 'gerd', 'reflux'],
    indication: 'gastroprotection', drugIds: ['pantoprazole', 'omeprazole', 'esomeprazole'],
    priority: 4, rationale: 'Gastroprotection (esp. when NSAID or steroid co-prescribed)' },
  { match: ['anaemia', 'anemia'],
    indication: 'anaemia', drugIds: ['ferrous-sulphate', 'folic-acid'],
    priority: 8, rationale: 'Haematinic replacement' },
  { match: ['malnutrition', 'cachexia', 'low albumin'],
    indication: 'wound_healing', drugIds: ['multivitamin', 'vitamin-c', 'zinc-sulphate'],
    priority: 12, rationale: 'Nutritional support' },
  { match: ['malnutrition', 'cachexia', 'poor appetite', 'anorexia'],
    indication: 'appetite', drugIds: ['cyproheptadine', 'megestrol-acetate'],
    priority: 14, rationale: 'Appetite stimulation' },
  { match: ['peripheral vascular disease', 'pvd'],
    indication: 'pvd_support', drugIds: ['pentoxifylline', 'aspirin', 'clopidogrel'],
    priority: 9, rationale: 'Vascular support' },
  { match: ['peripheral neuropathy', 'neuropathy'],
    indication: 'neuropathic_pain', drugIds: ['gabapentin', 'pregabalin', 'amitriptyline'],
    priority: 8, rationale: 'Neuropathic pain control' },
  { match: ['chronic wound', 'pressure ulcer', 'burn injury', 'diabetic foot ulcer'],
    indication: 'wound_healing', drugIds: ['vitamin-c', 'zinc-sulphate', 'multivitamin'],
    priority: 12, rationale: 'Wound healing micronutrients' },
  { match: ['pregnancy', 'pregnant'],
    indication: 'pregnancy_supplement', drugIds: ['folic-acid', 'ferrous-sulphate', 'multivitamin'],
    priority: 11, rationale: 'Antenatal supplementation' },
];

// ─── Helpers ───────────────────────────────────────────────────────────────

function isNSAID(drug: BNFDrug): boolean {
  const nsaids = ['ibuprofen', 'diclofenac', 'naproxen', 'ketorolac', 'celecoxib', 'aspirin'];
  return nsaids.includes(drug.id.toLowerCase());
}

function isPPI(drug: BNFDrug): boolean {
  return ['pantoprazole', 'omeprazole', 'esomeprazole', 'lansoprazole'].includes(drug.id.toLowerCase());
}

function isLaxative(drug: BNFDrug): boolean {
  return ['lactulose', 'bisacodyl', 'senna', 'polyethylene-glycol', 'docusate'].includes(drug.id.toLowerCase());
}

function isOpioid(drug: BNFDrug): boolean {
  return drug.category === 'Analgesics - Opioid';
}

function pickRoute(drug: BNFDrug): DrugRoute {
  return drug.formulations[0]?.route || 'oral';
}

function pickFrequency(drug: BNFDrug): DrugFrequency {
  return drug.dosage.adult.frequency[0] || 'od';
}

function pickDose(drug: BNFDrug, patient: PatientInput): string {
  // Elderly → use elderly dose if defined
  if (patient.age !== undefined && patient.age >= 65 && drug.dosage.elderly) {
    return drug.dosage.elderly.standard;
  }
  // Renal impairment with explicit guidance → flag it in dose string
  if (patient.gfr !== undefined && patient.gfr < 60 && drug.dosage.renalImpairment) {
    return `${drug.dosage.adult.standard}  ⚠ ${drug.dosage.renalImpairment.adjustment}`;
  }
  return drug.dosage.adult.standard;
}

function defaultDuration(drug: BNFDrug, indication: Indication): string {
  if (drug.dosage.adult.duration) return drug.dosage.adult.duration;
  switch (indication) {
    case 'infection': return '5–7 days';
    case 'pain':
    case 'severe_pain': return 'PRN, review in 48 h';
    case 'neuropathic_pain': return '4–6 weeks then review';
    case 'wound_healing': return 'Until wound healed';
    case 'anaemia': return '3 months minimum';
    case 'gastroprotection': return 'While on NSAID / 4–8 weeks';
    case 'pvd_support': return 'Long-term';
    case 'pregnancy_supplement': return 'Throughout pregnancy + 6 weeks post-partum';
    case 'dvt_prophylaxis': return 'Until mobile / per protocol';
    default: return 'As directed';
  }
}

// ─── Public API ────────────────────────────────────────────────────────────

/**
 * Generate ranked draft prescriptions for the given patient input.
 * Any drug whose patient-specific warnings include a `danger` flag (allergy,
 * absolute contraindication, pregnancy X/D, renal/hepatic AVOID) is dropped.
 */
export function generateRecommendations(patient: PatientInput): RecommendedDraft[] {
  const drafts = new Map<string, RecommendedDraft>(); // dedup by drug id

  const addCandidate = (
    drugId: string,
    indication: Indication,
    rationale: string,
    priority: number
  ) => {
    if (drafts.has(drugId)) return; // first rule wins (highest-priority match seen first)
    const drug = getDrugById(drugId);
    if (!drug) return;

    const warnings = generatePatientWarnings(drug, {
      sex: patient.sex,
      pregnant: patient.pregnant,
      lactating: patient.lactating,
      age: patient.age,
      weight: patient.weight,
      gfr: patient.gfr,
      hepaticImpairment: patient.hepaticImpairment,
      cardiacDisease: patient.cardiacDisease,
      allergies: patient.allergies,
      comorbidities: patient.comorbidities,
      currentMedications: patient.currentMedications,
    });

    // HARD EXCLUSION: any danger-level warning kills the candidate.
    if (warnings.some((w) => w.level === 'danger')) return;

    // Allergy class screen (the existing engine matches by interaction name;
    // we additionally screen by drug name / brand against the allergy list).
    const allergyHit = patient.allergies.some((a) => {
      const n = norm(a);
      if (!n) return false;
      if (n.includes('penicillin') && drug.category === 'Antibiotics - Penicillins') return true;
      if (n.includes('cephalosporin') && drug.category === 'Antibiotics - Cephalosporins') return true;
      if (n.includes('sulpha') && drug.category === 'Antibiotics - Sulfonamides') return true;
      if (n.includes('nsaid') && isNSAID(drug)) return true;
      if (n.includes('opioid') && isOpioid(drug)) return true;
      const drugTokens = [drug.genericName, ...drug.brandNames].map(norm);
      return drugTokens.some((t) => t && n.includes(t));
    });
    if (allergyHit) return;

    drafts.set(drugId, {
      drug,
      dose: pickDose(drug, patient),
      route: pickRoute(drug),
      frequency: pickFrequency(drug),
      duration: defaultDuration(drug, indication),
      instructions: drug.instructions || '',
      indication,
      rationale,
      warnings,
      priority,
    });
  };

  // 1. Diagnoses
  for (const dx of patient.diagnoses) {
    for (const rule of DIAGNOSIS_RULES) {
      if (rule.match.some((m) => norm(dx).includes(m))) {
        for (const id of rule.drugIds) addCandidate(id, rule.indication, rule.rationale, rule.priority);
      }
    }
  }

  // 2. Comorbidities
  for (const c of patient.comorbidities) {
    for (const rule of COMORBIDITY_RULES) {
      if (rule.match.some((m) => norm(c).includes(m))) {
        for (const id of rule.drugIds) addCandidate(id, rule.indication, rule.rationale, rule.priority);
      }
    }
  }

  // 3. Auto-pair PPI when an NSAID is recommended AND patient has GI risk
  const hasNsaid = Array.from(drafts.values()).some((d) => isNSAID(d.drug));
  const giRisk = hasAny(patient.comorbidities, ['peptic ulcer', 'gastritis', 'gerd', 'reflux']) || (patient.age ?? 0) >= 65;
  if (hasNsaid && giRisk) {
    addCandidate('pantoprazole', 'gastroprotection',
      'Auto-paired with NSAID due to GI risk (PUD/gastritis/GERD/elderly)', 4);
  }

  // 4. Auto-pair laxative when a strong opioid is recommended
  const hasStrongOpioid = Array.from(drafts.values()).some((d) =>
    isOpioid(d.drug) && !['tramadol', 'codeine'].includes(d.drug.id)
  );
  if (hasStrongOpioid) {
    addCandidate('lactulose', 'constipation',
      'Auto-paired with strong opioid to prevent opioid-induced constipation', 13);
  }

  // 5. Lab-driven additions
  if (patient.labs?.haemoglobin !== undefined && patient.labs.haemoglobin < 11) {
    addCandidate('ferrous-sulphate', 'anaemia', `Hb ${patient.labs.haemoglobin} g/dL → haematinic replacement`, 8);
    addCandidate('folic-acid', 'anaemia', `Anaemia work-up — folate supplementation`, 8);
  }

  // 6. Suppress duplicates from same family (keep highest priority only)
  const FAMILY: Record<string, string> = {
    'ibuprofen': 'nsaid', 'diclofenac': 'nsaid', 'ketorolac': 'nsaid', 'celecoxib': 'nsaid', 'naproxen': 'nsaid',
    'pantoprazole': 'ppi', 'omeprazole': 'ppi', 'esomeprazole': 'ppi',
    'ferrous-sulphate': 'oral-iron', 'ferrous-fumarate': 'oral-iron',
    'gabapentin': 'gabapentinoid', 'pregabalin': 'gabapentinoid',
  };
  const byFamily = new Map<string, RecommendedDraft>();
  const standalone: RecommendedDraft[] = [];
  for (const d of drafts.values()) {
    const fam = FAMILY[d.drug.id];
    if (!fam) { standalone.push(d); continue; }
    const existing = byFamily.get(fam);
    if (!existing || d.priority < existing.priority) byFamily.set(fam, d);
  }

  const final = [...standalone, ...byFamily.values()];
  // Sort: priority ASC, then category for stable display
  final.sort((a, b) => a.priority - b.priority || a.drug.category.localeCompare(b.drug.category));
  return final;
}

/**
 * Quick safety summary (free-text) for the patient context — useful for the
 * intake screen to show the clinician any global flags before drugs are picked.
 */
export function summarisePatientFlags(patient: PatientInput): string[] {
  const flags: string[] = [];
  if (patient.pregnant) flags.push(`Pregnant${patient.gestationalAgeWeeks ? ` (${patient.gestationalAgeWeeks} weeks)` : ''} — pregnancy-safe drugs only`);
  if (patient.lactating) flags.push('Lactating — avoid drugs labelled "avoid" in breastfeeding');
  if (patient.gfr !== undefined && patient.gfr < 60) flags.push(`Renal impairment (eGFR ${patient.gfr}) — dose adjust / avoid nephrotoxic drugs`);
  if (patient.hepaticImpairment) flags.push('Hepatic impairment — avoid / dose-adjust hepatotoxic drugs');
  if (patient.cardiacDisease) flags.push('Cardiac disease — caution with NSAIDs, fluid loading');
  if (patient.age !== undefined && patient.age >= 65) flags.push('Elderly — prefer lower starting doses');
  if (patient.allergies.length) flags.push(`Allergies: ${patient.allergies.join(', ')}`);
  return flags;
}

/** Expose for testing / inspection */
export const _internals = { DIAGNOSIS_RULES, COMORBIDITY_RULES };
// Suppress unused warning for BNF_DRUG_DATABASE if not used directly
void BNF_DRUG_DATABASE;
