/**
 * The holistic assessment every template carries, whatever the procedure:
 * nutrition, everything that impairs wound healing, psychological and social
 * status, and counselling. Plastic surgery outcomes are decided as much by
 * these as by the operation, so no review is complete without them.
 *
 * Score sources: MUST (BAPEN 2003); PHQ-2 (Kroenke 2003); GAD-2 (Kroenke
 * 2007). Healing impediments follow Guo & DiPietro 2010 (Factors affecting
 * wound healing, J Dent Res) and the IWII 2022 consensus on host factors.
 */
import { ans, multi, n, note, num, sel, text } from './common';
import { bmiCalc } from '../nutrition/anthropometry';
import { mustOf as engineMust } from '../nutrition/screening';
import { NUTRITION_CONFIG } from '../nutrition/config';
import type { Answers, ScoreDef, TemplateSection } from './types';

export const nutritionSection = (): TemplateSection => ({
  id: 'nutrition',
  title: 'Nutritional assessment (MUST)',
  subtitle: 'Malnutrition is the commonest correctable cause of poor healing, flap failure and dehiscence.',
  questions: [
    num('weight', 'Weight', 'kg', { required: true }),
    num('height', 'Height', 'cm', { required: true }),
    sel('wt_loss', 'Unplanned weight loss in the past 3–6 months', ['< 5%', '5–10%', '> 10%', 'Unknown'], { required: true, redFlags: ['> 10%'] }),
    sel('acute', 'Acutely ill with no / likely no intake for > 5 days', ['No', 'Yes'], { required: true, redFlags: ['Yes'] }),
    sel('intake', 'Current oral intake', ['Normal', 'Reduced (< 75% of needs)', 'Poor (< 50% of needs)', 'Nil by mouth / tube fed'], { redFlags: ['Poor (< 50% of needs)'] }),
    num('albumin', 'Serum albumin', 'g/L'),
    num('lymph', 'Total lymphocyte count', '×10⁹/L'),
    multi('micro', 'Micronutrient concerns', ['None', 'Iron deficiency', 'Vitamin C', 'Zinc', 'Vitamin D', 'Vitamin A (steroid use)', 'Protein deficit']),
    sel('dietitian', 'Dietitian involvement', ['Not needed', 'Refer', 'Already under dietitian']),
  ],
});

export const HEALING_FACTORS = [
  'Diabetes mellitus', 'Poor glycaemic control', 'Smoking / nicotine', 'Malnutrition / hypoalbuminaemia', 'Anaemia',
  'Obesity (BMI ≥ 30)', 'Peripheral arterial disease', 'Venous insufficiency', 'Lymphoedema / chronic oedema',
  'Previous radiotherapy to the site', 'Chemotherapy (current / recent)', 'Systemic steroids', 'Immunosuppressants / biologics',
  'HIV', 'Sickle cell disease', 'Chronic kidney disease', 'Liver disease', 'Advanced age (> 70)', 'Local infection / biofilm',
  'Foreign body / exposed hardware', 'Repetitive pressure / shear', 'Moisture / incontinence', 'Neuropathy (loss of protective sensation)',
  'Immobility', 'Alcohol excess', 'Poor adherence / unable to offload', 'Keloid tendency', 'Connective tissue disease',
];

export const healingSection = (): TemplateSection => ({
  id: 'healing',
  title: 'Factors that will interfere with healing',
  subtitle: 'Every factor ticked becomes a line in the treatment plan.',
  questions: [
    multi('factors', 'Host and local factors present', ['None', ...HEALING_FACTORS], { required: true }),
    num('hba1c', 'HbA1c', '%', { showIf: { q: 'factors', in: ['Diabetes mellitus', 'Poor glycaemic control'] } }),
    num('rbs', 'Random blood glucose today', 'mmol/L', { showIf: { q: 'factors', in: ['Diabetes mellitus', 'Poor glycaemic control'] } }),
    num('abpi', 'ABPI (affected limb)', '', { showIf: { q: 'factors', in: ['Peripheral arterial disease', 'Diabetes mellitus'] } }),
    num('cd4', 'CD4 count', 'cells/µL', { showIf: { q: 'factors', in: ['HIV'] } }),
    sel('rt_when', 'Radiotherapy to the site — when', ['< 6 weeks ago', '6 weeks – 6 months', '> 6 months'], { showIf: { q: 'factors', in: ['Previous radiotherapy to the site'] } }),
    num('pack_years', 'Smoking', 'pack-years', { showIf: { q: 'factors', in: ['Smoking / nicotine'] } }),
    sel('cessation', 'Smoking cessation', ['Stopped ≥ 4 weeks', 'Agreed to stop — support offered', 'Declined'], { showIf: { q: 'factors', in: ['Smoking / nicotine'] }, redFlags: ['Declined'] }),
  ],
});

export const psychSection = (): TemplateSection => ({
  id: 'psych',
  title: 'Psychological and social status',
  subtitle: 'Disfigurement, chronic wounds and amputation carry a high burden of depression and anxiety.',
  questions: [
    sel('phq_1', 'PHQ-2 — little interest or pleasure in doing things (past 2 weeks)', ['0 — not at all', '1 — several days', '2 — more than half the days', '3 — nearly every day'], { required: true }),
    sel('phq_2', 'PHQ-2 — feeling down, depressed or hopeless', ['0 — not at all', '1 — several days', '2 — more than half the days', '3 — nearly every day'], { required: true }),
    sel('gad_1', 'GAD-2 — feeling nervous, anxious or on edge', ['0 — not at all', '1 — several days', '2 — more than half the days', '3 — nearly every day']),
    sel('gad_2', 'GAD-2 — not able to stop or control worrying', ['0 — not at all', '1 — several days', '2 — more than half the days', '3 — nearly every day']),
    sel('self_harm', 'Thoughts of self-harm or that they would be better off dead', ['No', 'Yes — assess risk now'], { redFlags: ['Yes — assess risk now'] }),
    sel('body_image', 'Body-image / appearance distress', ['None', 'Mild', 'Moderate', 'Severe — affecting function']),
    sel('expectations', 'Expectations of the outcome', ['Realistic', 'Unclear — needs further discussion', 'Unrealistic'], { redFlags: ['Unrealistic'] }),
    sel('cognition', 'Cognition / understanding', ['Intact', 'Impaired — involve carer']),
    sel('coping', 'Coping with pain and illness', ['Coping well', 'Struggling', 'Not coping']),
    sel('support', 'Social support at home', ['Good', 'Limited', 'None — lives alone without help'], { required: true, redFlags: ['None — lives alone without help'] }),
    multi('barriers', 'Practical barriers to care', ['None', 'Cost of dressings / medicines', 'Distance / transport to clinic', 'Loss of income from time off work', 'Caring responsibilities', 'Housing / hygiene', 'Language / literacy', 'Religious or cultural considerations', 'Traditional / herbal treatment use']),
    sel('substance', 'Alcohol / substance use', ['None', 'Within safe limits', 'Harmful — offer support']),
    text('occupation', 'Occupation / hand dominance / functional demands'),
  ],
});

/** Counselling every review records, even when no operation is planned today. */
export const counsellingSection = (topics: string[] = []): TemplateSection => ({
  id: 'counselling',
  title: 'Counselling and shared decision-making',
  questions: [
    multi('discussed', 'Discussed with the patient (and family, with consent)', ['Diagnosis and what it means', 'Treatment options, including no treatment', 'Expected course and time to heal', 'Wound care at home', 'Warning signs and who to call', 'Smoking cessation', 'Nutrition and diet', 'Glycaemic control', 'Offloading / positioning', 'Scar care and sun protection', 'Return to work / activity', 'Costs and logistics', ...topics], { required: true }),
    sel('understanding', 'Patient understanding (teach-back)', ['Good — explained back correctly', 'Partial — reinforced', 'Poor — carer involved / written leaflet'], { required: true }),
    sel('leaflet', 'Written information given', ['Yes', 'No']),
    sel('agrees', 'Patient agrees with the plan', ['Yes', 'Wants time to decide', 'Declines (document reason)'], { required: true, redFlags: ['Declines (document reason)'] }),
    note('patient_concerns', 'Patient’s own concerns and priorities'),
  ],
});

// ── scores ────────────────────────────────────────────────────────────────

/** BMI from the template's nutrition answers (engine arithmetic). */
export function bmiOf(a: Answers): number | null {
  return bmiCalc(n(a, 'nutrition', 'weight'), n(a, 'nutrition', 'height'))?.value ?? null;
}

/** The template's categorical weight-loss answer, as the % the engine scores. */
const LOSS_PCT: Record<string, number | null> = { '< 5%': 0, '5–10%': 7.5, '> 10%': 10.1, Unknown: null };

/** MUST — the clinical nutrition engine's implementation, fed from the template answers. */
export function mustOf(a: Answers): number | null {
  const bmi = bmiOf(a);
  const loss = ans(a, 'nutrition', 'wt_loss'), acute = ans(a, 'nutrition', 'acute');
  if (bmi === null || !loss || !acute) return null;
  return engineMust({ acutelyIllNoIntake5d: acute === 'Yes' }, { bmi, muacBand: null, lossPct: LOSS_PCT[loss] ?? null }, NUTRITION_CONFIG)?.value ?? null;
}

export const bmiScore: ScoreDef = {
  id: 'bmi', label: 'BMI', compute: (a) => {
    const b = bmiOf(a);
    if (b === null) return null;
    const band = b < 18.5 ? 'Underweight' : b < 25 ? 'Normal' : b < 30 ? 'Overweight' : b < 40 ? 'Obese' : 'Morbidly obese';
    return { value: b, band, tone: b < 18.5 || b >= 40 ? 'danger' : b >= 30 ? 'warn' : 'ok' };
  },
};

export const mustScore: ScoreDef = {
  id: 'must', label: 'MUST', reference: 'BAPEN Malnutrition Universal Screening Tool (2003)',
  compute: (a) => {
    const s = mustOf(a);
    if (s === null) return null;
    if (s === 0) return { value: s, band: 'Low risk — routine care', tone: 'ok' };
    if (s === 1) return { value: s, band: 'Medium risk — observe, document intake', tone: 'warn' };
    return { value: s, band: 'High risk — treat; dietitian referral', tone: 'danger' };
  },
};

const lead = (v: any) => { const m = /^(\d)/.exec(String(v ?? '')); return m ? Number(m[1]) : null; };
export function phq2Of(a: Answers) { const p = [lead(ans(a, 'psych', 'phq_1')), lead(ans(a, 'psych', 'phq_2'))]; return p.some(x => x === null) ? null : p[0]! + p[1]!; }
export function gad2Of(a: Answers) { const p = [lead(ans(a, 'psych', 'gad_1')), lead(ans(a, 'psych', 'gad_2'))]; return p.some(x => x === null) ? null : p[0]! + p[1]!; }

export const phq2Score: ScoreDef = {
  id: 'phq2', label: 'PHQ-2', reference: 'Kroenke et al. 2003',
  compute: (a) => { const s = phq2Of(a); return s === null ? null : { value: s, band: s >= 3 ? 'Positive depression screen — PHQ-9 / refer' : 'Negative screen', tone: s >= 3 ? 'warn' : 'ok' }; },
};
export const gad2Score: ScoreDef = {
  id: 'gad2', label: 'GAD-2', reference: 'Kroenke et al. 2007',
  compute: (a) => { const s = gad2Of(a); return s === null ? null : { value: s, band: s >= 3 ? 'Positive anxiety screen — GAD-7 / support' : 'Negative screen', tone: s >= 3 ? 'warn' : 'ok' }; },
};

/** Factors present (excluding "None"). */
export const healingFactors = (a: Answers): string[] => (ans(a, 'healing', 'factors') || []).filter((x: string) => x !== 'None');

export const holisticSections = (counsellingTopics: string[] = []) => [nutritionSection(), healingSection(), psychSection(), counsellingSection(counsellingTopics)];
export const holisticScores = [bmiScore, mustScore, phq2Score, gad2Score];

export const HOLISTIC_REFS = [
  'BAPEN — Malnutrition Universal Screening Tool (MUST)',
  'ESPEN 2021 — Clinical nutrition in surgery',
  'Guo & DiPietro 2010 — Factors affecting wound healing',
  'PHQ-2 / GAD-2 screening (Kroenke 2003, 2007)',
  'NICE CG91 — Depression in adults with a chronic physical health problem',
];
