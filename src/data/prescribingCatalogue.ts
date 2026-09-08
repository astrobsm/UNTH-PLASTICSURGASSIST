/**
 * The drug list as a prescriber thinks of it.
 *
 * BNF_DRUG_DATABASE is organised the way a formulary is — fifty-one technical
 * classes, "Analgesics - Non-Opioid" apart from "Analgesics - Opioid",
 * paracetamol filed away from the other antipyretics. That is correct for
 * looking a drug up and wrong for writing a prescription, where the question is
 * "what am I giving this for": something for pain, something for the anaemia,
 * cover for the wound.
 *
 * So this is a view over that data, not a second copy of it. The groups below
 * map onto the existing categories; the drugs themselves, their doses, routes,
 * side effects and cautions all still come from the one database, because a
 * second drug list is a second thing to keep correct and the one that goes
 * stale is the one that hurts somebody.
 *
 * What is genuinely added here are entries the formulary was missing and the
 * Nigerian Essential Medicines List carries — the haemostatics in particular,
 * which a plastic surgery unit uses constantly and which were absent entirely.
 */

import {
  BNF_DRUG_DATABASE,
  type BNFDrug,
  type DrugCategory,
} from './bnfDrugDatabase';

/** How a prescriber groups things at the point of writing. */
export type PrescribingGroup =
  | 'Analgesics'
  | 'Antipyretics'
  | 'Antibiotics'
  | 'Haematinics'
  | 'Vitamins'
  | 'Micronutrients & Minerals'
  | 'Supplements'
  | 'Anticoagulants'
  | 'Procoagulants & Haemostatics'
  | 'Antiplatelets'
  | 'Antiemetics'
  | 'Gastrointestinal'
  | 'Antimalarials'
  | 'Antifungals & Antivirals'
  | 'Steroids'
  | 'Cardiovascular'
  | 'Respiratory'
  | 'Sedation & Anaesthesia'
  | 'Wound & Skin'
  | 'Fluids & Electrolytes'
  | 'Other';

/**
 * Which formulary classes belong to each prescribing group.
 *
 * A class may appear in more than one group where that is clinically true:
 * paracetamol is both an analgesic and an antipyretic, and hiding it from
 * whichever list the prescriber happened to open would be unhelpful.
 */
const GROUP_MAP: Record<PrescribingGroup, DrugCategory[]> = {
  'Analgesics': ['Analgesics - Non-Opioid', 'Analgesics - Opioid', 'Musculoskeletal - Antigout'] as DrugCategory[],
  'Antipyretics': ['Analgesics - Non-Opioid'] as DrugCategory[],
  'Antibiotics': [
    'Antibiotics - Penicillins', 'Antibiotics - Cephalosporins', 'Antibiotics - Quinolones',
    'Antibiotics - Aminoglycosides', 'Antibiotics - Macrolides', 'Antibiotics - Others',
    'Antibiotics - Tetracyclines', 'Antibiotics - Sulfonamides', 'Antibiotics - Lincosamides',
    'Antibiotics - Carbapenems',
  ] as DrugCategory[],
  'Haematinics': [] as DrugCategory[],              // assembled by name below
  'Vitamins': ['Vitamins & Supplements'] as DrugCategory[],
  'Micronutrients & Minerals': [] as DrugCategory[], // assembled by name below
  'Supplements': ['Vitamins & Supplements'] as DrugCategory[],
  'Anticoagulants': ['Anticoagulants'] as DrugCategory[],
  'Procoagulants & Haemostatics': [] as DrugCategory[],
  'Antiplatelets': ['Antiplatelets & Thrombolytics'] as DrugCategory[],
  'Antiemetics': ['Antiemetics'] as DrugCategory[],
  'Gastrointestinal': ['Gastrointestinal', 'Laxatives', 'Antidiarrhoeals'] as DrugCategory[],
  'Antimalarials': ['Antimalarials'] as DrugCategory[],
  'Antifungals & Antivirals': ['Antifungals', 'Antivirals'] as DrugCategory[],
  'Steroids': ['Endocrine - Steroids'] as DrugCategory[],
  'Cardiovascular': [
    'Cardiovascular - Antihypertensives', 'Cardiovascular - Antiarrhythmics',
    'Cardiovascular - Diuretics', 'Cardiovascular - Nitrates & Antianginals',
    'Cardiovascular - Lipid-lowering', 'Cardiovascular - Others',
  ] as DrugCategory[],
  'Respiratory': ['Respiratory', 'Bronchodilators', 'Antihistamines'] as DrugCategory[],
  'Sedation & Anaesthesia': [
    'CNS - Anxiolytics & Sedatives', 'Local Anaesthetics', 'General Anaesthetics',
    'Muscle Relaxants', 'CNS - Opioid Antagonists',
  ] as DrugCategory[],
  'Wound & Skin': ['Wound Care', 'Dermatology', 'Antiseptics & Disinfectants'] as DrugCategory[],
  'Fluids & Electrolytes': ['Fluids & Electrolytes', 'Blood Products & Plasma Expanders'] as DrugCategory[],
  'Other': [] as DrugCategory[],
};

/**
 * Drugs pulled into a group by name rather than by class.
 *
 * Iron and folate sit under "Vitamins & Supplements" in the formulary, which is
 * where they belong pharmacologically and not where anyone looks for them when
 * treating anaemia.
 */
const BY_NAME: Partial<Record<PrescribingGroup, string[]>> = {
  'Haematinics': ['Ferrous Sulfate', 'Folic Acid', 'Vitamin B12', 'Cyanocobalamin'],
  'Micronutrients & Minerals': ['Zinc Sulfate', 'Calcium Gluconate', 'Magnesium', 'Potassium'],
  'Antipyretics': ['Paracetamol', 'Ibuprofen', 'Aspirin'],
};

// ─── Additions the formulary was missing ────────────────────────────────────

/** A minimal, honest record. Fields the source does not give are left empty. */
function eml(d: {
  id: string; generic: string; brands?: string[]; category: DrugCategory;
  form: string; strength: string; route: BNFDrug['formulations'][0]['route'];
  adult: string; max: string; freq: BNFDrug['dosage']['adult']['frequency'];
  duration?: string; instructions: string;
  common: string[]; serious?: string[];
  contraindications?: string[];
}): BNFDrug {
  return {
    id: d.id,
    genericName: d.generic,
    brandNames: d.brands ?? [],
    category: d.category,
    formulations: [{ form: d.form, strength: d.strength, route: d.route }],
    dosage: {
      adult: {
        standard: d.adult, min: d.adult, max: d.max,
        frequency: d.freq, duration: d.duration,
      },
    },
    maxDailyDose: d.max,
    contraindications: d.contraindications ?? [],
    pregnancyCategory: 'C',
    lactationSafety: 'unknown',
    renalRisk: 'monitor',
    hepaticRisk: 'monitor',
    cardiacRisk: 'safe',
    sideEffects: { common: d.common, serious: d.serious ?? [] },
    interactions: [],
    precautions: [],
    instructions: d.instructions,
  };
}

/**
 * Nigerian Essential Medicines List entries the formulary did not carry.
 *
 * The haemostatics matter most: tranexamic acid and phytomenadione are in
 * constant use on a plastic surgery unit and there was no way to prescribe
 * either of them from this app.
 */
export const EML_ADDITIONS: BNFDrug[] = [
  eml({
    id: 'eml-tranexamic',
    generic: 'Tranexamic Acid',
    brands: ['Cyklokapron', 'Transamin'],
    category: 'Emergency Drugs' as DrugCategory,
    form: 'Tablet / Injection', strength: '500 mg tab; 500 mg/5 mL amp', route: 'oral',
    adult: '1 g (15–25 mg/kg)', max: '4 g daily', freq: ['tds'],
    duration: 'Up to 5 days',
    instructions: 'Swallow with water after food; for bleeding, start within 3 hours of injury.',
    common: ['Nausea', 'Diarrhoea', 'Dizziness on rapid IV injection'],
    serious: ['Thrombosis', 'Visual disturbance (stop and review)'],
    contraindications: ['Active thromboembolic disease', 'History of seizures (high dose)'],
  }),
  eml({
    id: 'eml-phytomenadione',
    generic: 'Phytomenadione (Vitamin K1)',
    brands: ['Konakion'],
    category: 'Emergency Drugs' as DrugCategory,
    form: 'Injection / Tablet', strength: '10 mg/mL amp; 10 mg tab', route: 'IV',
    adult: '5–10 mg', max: '40 mg daily', freq: ['od'],
    instructions: 'Give slow IV over at least 30 seconds; reverses warfarin over 6–12 hours, not immediately.',
    common: ['Flushing', 'Sweating', 'Pain at injection site'],
    serious: ['Anaphylaxis with rapid IV injection'],
  }),
  eml({
    id: 'eml-etamsylate',
    generic: 'Etamsylate',
    brands: ['Dicynone'],
    category: 'Emergency Drugs' as DrugCategory,
    form: 'Tablet / Injection', strength: '500 mg tab; 250 mg/2 mL amp', route: 'oral',
    adult: '500 mg', max: '2 g daily', freq: ['qds'],
    instructions: 'Take after food; used for capillary bleeding and oozing surgical fields.',
    common: ['Headache', 'Nausea', 'Rash'],
  }),
  eml({
    id: 'eml-b12',
    generic: 'Vitamin B12 (Cyanocobalamin)',
    brands: ['Cytamen'],
    category: 'Vitamins & Supplements',
    form: 'Injection / Tablet', strength: '1000 mcg/mL amp; 50 mcg tab', route: 'IM',
    adult: '1000 mcg', max: '1000 mcg daily', freq: ['od', 'weekly'],
    instructions: 'Deep intramuscular injection; alternate days for the first week, then weekly.',
    common: ['Pain at injection site', 'Itching', 'Nausea'],
  }),
  eml({
    id: 'eml-marcguard',
    generic: 'Marc Guard Capsules',
    brands: ['Marc Guard'],
    category: 'Vitamins & Supplements',
    form: 'Capsule', strength: '1 capsule', route: 'oral',
    adult: '1 capsule', max: '1 capsule daily', freq: ['od'],
    duration: '1 month',
    instructions: 'One capsule daily for one month; take after food.',
    common: ['Mild gastrointestinal upset'],
  }),
  eml({
    id: 'eml-vitc-zinc',
    generic: 'Vitamin C + Zinc',
    category: 'Vitamins & Supplements',
    form: 'Tablet', strength: '500 mg + 10 mg', route: 'oral',
    adult: '1 tablet', max: '2 tablets daily', freq: ['od', 'bd'],
    duration: '2–4 weeks',
    instructions: 'Take after food; supports wound healing alongside adequate protein intake.',
    common: ['Nausea on an empty stomach'],
  }),
  eml({
    id: 'eml-arginine',
    generic: 'Arginine / Wound-Healing Supplement',
    category: 'Vitamins & Supplements',
    form: 'Sachet / Capsule', strength: 'As labelled', route: 'oral',
    adult: 'As directed', max: 'As directed', freq: ['od', 'bd'],
    instructions: 'Take with or after food; used to support healing in large or slow-healing wounds.',
    common: ['Bloating', 'Loose stools'],
  }),
];

/** The whole prescribable list: the formulary plus what it was missing. */
export const PRESCRIBABLE_DRUGS: BNFDrug[] = [...BNF_DRUG_DATABASE, ...EML_ADDITIONS];

/** The groups, in the order a prescription is usually written. */
export const PRESCRIBING_GROUPS: PrescribingGroup[] = [
  'Analgesics', 'Antipyretics', 'Antibiotics', 'Haematinics',
  'Vitamins', 'Micronutrients & Minerals', 'Supplements',
  'Anticoagulants', 'Procoagulants & Haemostatics', 'Antiplatelets',
  'Antiemetics', 'Gastrointestinal', 'Antimalarials', 'Antifungals & Antivirals',
  'Steroids', 'Cardiovascular', 'Respiratory', 'Sedation & Anaesthesia',
  'Wound & Skin', 'Fluids & Electrolytes', 'Other',
];

/** The haemostatics, which exist only as additions. */
const PROCOAGULANT_IDS = ['eml-tranexamic', 'eml-phytomenadione', 'eml-etamsylate'];

/** Drugs in a prescribing group. */
export function drugsInGroup(group: PrescribingGroup): BNFDrug[] {
  if (group === 'Procoagulants & Haemostatics') {
    return PRESCRIBABLE_DRUGS.filter((d) => PROCOAGULANT_IDS.includes(d.id));
  }

  const categories = GROUP_MAP[group] ?? [];
  const names = BY_NAME[group] ?? [];

  const matched = PRESCRIBABLE_DRUGS.filter((d) => {
    if (names.some((n) => d.genericName.toLowerCase().includes(n.toLowerCase()))) return true;
    if (!categories.includes(d.category)) return false;
    // "Vitamins" and "Supplements" share a formulary class; split them so
    // neither list is a copy of the other.
    if (group === 'Vitamins') return /vitamin|ascorbic|folic|thiamine|b complex/i.test(d.genericName);
    if (group === 'Supplements') return !/vitamin|ascorbic|folic|thiamine|b complex/i.test(d.genericName);
    if (group === 'Antipyretics') return names.some((n) => d.genericName.toLowerCase().includes(n.toLowerCase()));
    return true;
  });

  if (group === 'Other') {
    // Whatever no group claimed, so nothing is unreachable.
    const claimed = new Set(
      PRESCRIBING_GROUPS.filter((g) => g !== 'Other').flatMap((g) => drugsInGroup(g).map((d) => d.id)),
    );
    return PRESCRIBABLE_DRUGS.filter((d) => !claimed.has(d.id));
  }

  return matched.sort((a, b) => a.genericName.localeCompare(b.genericName));
}

/** Groups that actually have something in them, for the picker. */
export function populatedGroups(): { group: PrescribingGroup; count: number }[] {
  return PRESCRIBING_GROUPS
    .map((group) => ({ group, count: drugsInGroup(group).length }))
    .filter((g) => g.count > 0);
}

export function findDrug(id: string): BNFDrug | undefined {
  return PRESCRIBABLE_DRUGS.find((d) => d.id === id);
}

// ─── One-line summaries, for the printed sheet ──────────────────────────────

const FREQUENCY_WORDS: Record<string, string> = {
  stat: 'immediately, once', od: 'once daily', bd: 'twice daily',
  tds: 'three times daily', qds: 'four times daily', prn: 'when required',
  nocte: 'at night', mane: 'in the morning', q3h: 'every 3 hours',
  q4h: 'every 4 hours', q6h: 'every 6 hours', q8h: 'every 8 hours',
  q12h: 'every 12 hours', weekly: 'once weekly', alternate_days: 'on alternate days',
};

export function frequencyInWords(f: string): string {
  return FREQUENCY_WORDS[f] ?? f;
}

/**
 * How to take it, in one line.
 *
 * Prefers the drug's own instruction; otherwise builds one from the dose and
 * route, because a patient handed a sheet with no instruction on it will invent
 * their own.
 */
export function howToTake(drug: BNFDrug, freq: string, route: string, duration?: string): string {
  const base = drug.instructions?.trim();
  const rhythm = [
    freq ? frequencyInWords(freq) : null,
    route && route !== 'oral' ? `by the ${route} route` : null,
    duration ? `for ${duration}` : null,
  ].filter(Boolean).join(', ');

  if (base) return rhythm ? `${base} Take ${rhythm}.` : base;
  return rhythm ? `Take ${rhythm}.` : 'Take as directed.';
}

/**
 * The side effects worth printing, in one line.
 *
 * The common ones tell a patient what is expected and not alarming; one serious
 * one tells them what to come back for. Everything is on the sheet in the app,
 * but a wall of text on a dispensing slip does not get read.
 */
export function sideEffectsLine(drug: BNFDrug): string {
  const common = drug.sideEffects.common.slice(0, 3).join(', ');
  const serious = drug.sideEffects.serious[0];
  if (common && serious) return `${common}. Stop and report: ${serious.toLowerCase()}.`;
  if (common) return `${common}.`;
  if (serious) return `Stop and report: ${serious.toLowerCase()}.`;
  return 'No commonly reported effects.';
}
