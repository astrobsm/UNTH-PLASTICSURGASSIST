/**
 * Building blocks shared by every template: the sections every pre-op,
 * post-op and follow-up review has, and the validated scores they compute.
 *
 * Score sources: ASA Physical Status (ASA 2020); Caprini VTE risk (Caprini
 * 2005, as used by ACCP 2012); NEWS2 (RCP 2017); Braden Scale (Bergstrom
 * 1987); Vancouver Scar Scale (Sullivan 1990, Baryza 1995 modification);
 * STOP-BANG (Chung 2008); Revised Cardiac Risk Index (Lee 1999).
 */
import type { Answers, ScoreDef, ScoreResult, TemplateQuestion, TemplateSection } from './types';

// ── helpers ────────────────────────────────────────────────────────────────

export const q = (id: string, label: string, type: TemplateQuestion['type'], extra: Partial<TemplateQuestion> = {}): TemplateQuestion =>
  ({ id, label, type, ...extra });
export const sel = (id: string, label: string, options: string[], extra: Partial<TemplateQuestion> = {}) => q(id, label, 'select', { options, ...extra });
export const multi = (id: string, label: string, options: string[], extra: Partial<TemplateQuestion> = {}) => q(id, label, 'multiselect', { options, ...extra });
export const num = (id: string, label: string, unit?: string, extra: Partial<TemplateQuestion> = {}) => q(id, label, 'number', { unit, ...extra });
export const text = (id: string, label: string, extra: Partial<TemplateQuestion> = {}) => q(id, label, 'text', extra);
export const note = (id: string, label: string, extra: Partial<TemplateQuestion> = {}) => q(id, label, 'textarea', extra);

/** The answer to one question, wherever it sits. */
export function ans(a: Answers, section: string, id: string): any { return a?.[section]?.[id]; }
export const has = (a: Answers, section: string, id: string, value: string) => {
  const v = ans(a, section, id);
  return Array.isArray(v) ? v.includes(value) : v === value;
};
export const n = (a: Answers, section: string, id: string): number | null => {
  const v = ans(a, section, id);
  return typeof v === 'number' && Number.isFinite(v) ? v : (typeof v === 'string' && v.trim() !== '' && !Number.isNaN(Number(v)) ? Number(v) : null);
};
const lead = (v: any): number | null => { const m = /^(\d+)/.exec(String(v ?? '')); return m ? Number(m[1]) : null; };

export const YES_NO = ['Yes', 'No'];
export const YES_NO_NA = ['Yes', 'No', 'Not applicable'];

// ── shared sections ───────────────────────────────────────────────────────

export const ASA_OPTIONS = [
  'ASA I — healthy', 'ASA II — mild systemic disease', 'ASA III — severe systemic disease',
  'ASA IV — severe disease, constant threat to life', 'ASA V — moribund', 'ASA VI — brain-dead donor',
];

export const CAPRINI_FACTORS: [string, number][] = [
  ['Age 41–60', 1], ['Age 61–74', 2], ['Age ≥ 75', 3], ['Minor surgery planned', 1], ['Major surgery > 45 min', 2],
  ['Laparoscopic surgery > 45 min', 2], ['BMI > 25', 1], ['Swollen legs (current)', 1], ['Varicose veins', 1],
  ['Sepsis (< 1 month)', 1], ['Serious lung disease / pneumonia (< 1 month)', 1], ['Acute MI', 1], ['Congestive heart failure (< 1 month)', 1],
  ['Inflammatory bowel disease', 1], ['Bed rest / medical patient at bed rest', 1], ['Confined to bed > 72 h', 2],
  ['Immobilising plaster cast (< 1 month)', 2], ['Central venous access', 2], ['Malignancy (present or previous)', 2],
  ['Previous DVT / PE', 3], ['Family history of VTE', 3], ['Factor V Leiden / prothrombin mutation / thrombophilia', 3],
  ['Pregnant or post-partum', 1], ['Oral contraceptive / HRT', 1], ['Stroke (< 1 month)', 5],
  ['Elective hip / knee arthroplasty', 5], ['Hip, pelvis or leg fracture', 5], ['Acute spinal cord injury (< 1 month)', 5],
];

export const fitnessSection = (extraInvestigations: string[] = []): TemplateSection => ({
  id: 'fitness',
  title: 'Fitness for anaesthesia and optimisation',
  questions: [
    sel('asa', 'ASA physical status', ASA_OPTIONS, { required: true }),
    sel('anaesthesia', 'Planned anaesthesia', ['General', 'Regional block', 'Spinal / epidural', 'Local anaesthesia', 'Local with sedation', 'To be decided by anaesthetist'], { required: true }),
    multi('comorbid', 'Comorbidities to optimise', ['None', 'Hypertension', 'Diabetes mellitus', 'Ischaemic heart disease', 'Heart failure', 'Asthma / COPD', 'CKD', 'Liver disease', 'Sickle cell disease', 'HIV', 'Obesity', 'Anaemia', 'Malnutrition', 'Previous stroke', 'Epilepsy'], { required: true }),
    sel('dm_control', 'Glycaemic control', ['Good (HbA1c < 8.5% / 69 mmol/mol)', 'Suboptimal', 'Poor — optimise before elective surgery', 'Not diabetic'], { showIf: { q: 'comorbid', in: ['Diabetes mellitus'] } }),
    num('hb', 'Haemoglobin', 'g/dL'),
    sel('airway', 'Airway assessment', ['No concerns', 'Possible difficult airway — anaesthetist aware', 'Known difficult airway'], { redFlags: ['Known difficult airway'] }),
    multi('stopbang', 'STOP-BANG (tick those present)', ['Snoring', 'Tired / sleepy in the day', 'Observed apnoea', 'High blood pressure', 'BMI > 35', 'Age > 50', 'Neck > 40 cm', 'Male']),
    multi('rcri', 'Revised Cardiac Risk Index factors', ['None', 'High-risk surgery', 'Ischaemic heart disease', 'Heart failure', 'Cerebrovascular disease', 'Insulin-treated diabetes', 'Creatinine > 177 µmol/L']),
    multi('meds_hold', 'Medicines needing a peri-operative plan', ['None', 'Anticoagulant (warfarin / DOAC)', 'Antiplatelet', 'Insulin', 'Oral hypoglycaemics', 'Long-term steroids', 'Antihypertensives (ACE-i / ARB)', 'Herbal medicines', 'Antiretrovirals'], { required: true }),
    note('meds_plan', 'Medication plan (what to stop / continue / bridge, and when)', { showIf: { q: 'meds_hold', in: ['Anticoagulant (warfarin / DOAC)', 'Antiplatelet', 'Insulin', 'Oral hypoglycaemics', 'Long-term steroids', 'Antihypertensives (ACE-i / ARB)', 'Herbal medicines', 'Antiretrovirals'] } }),
    multi('allergy', 'Allergies', ['None known', 'Penicillin', 'Cephalosporin', 'Sulphonamide', 'Latex', 'Chlorhexidine', 'Iodine', 'NSAIDs', 'Opioid', 'Other (note below)'], { required: true, redFlags: ['Latex', 'Chlorhexidine'] }),
    multi('smoking', 'Smoking / nicotine', ['Never', 'Ex-smoker', 'Current smoker', 'Nicotine replacement / vaping'], { redFlags: ['Current smoker'] }),
    multi('workup', 'Investigations reviewed', ['FBC', 'U&E / creatinine', 'Random / fasting glucose', 'HbA1c', 'Coagulation (INR / APTT)', 'Group & save', 'Cross-match', 'ECG', 'Chest X-ray', 'Echocardiogram', 'HIV / HBsAg / HCV screening', 'Sickling / genotype', 'Pregnancy test', 'Albumin', ...extraInvestigations]),
  ],
});

export const vteSection = (): TemplateSection => ({
  id: 'vte',
  title: 'VTE risk (Caprini)',
  subtitle: 'Tick every factor that applies; the score and recommended prophylaxis are calculated.',
  questions: [
    multi('caprini', 'Caprini risk factors', CAPRINI_FACTORS.map(([l]) => l)),
    sel('bleeding_risk', 'Bleeding risk precluding pharmacological prophylaxis', ['No', 'Yes — mechanical only']),
    sel('vte_plan', 'VTE prophylaxis plan', ['None (low risk) — early mobilisation', 'Mechanical (IPC / stockings)', 'LMWH', 'LMWH + mechanical', 'Already anticoagulated'], { required: true }),
  ],
});

export const consentSection = (risks: string[], alternatives: string[] = []): TemplateSection => ({
  id: 'consent',
  title: 'Counselling and consent',
  subtitle: 'Document each specific risk discussed.',
  questions: [
    sel('capacity', 'Capacity to consent', ['Has capacity', 'Lacks capacity — best-interests / guardian', 'Minor — parent / guardian consenting'], { required: true }),
    multi('risks', 'Risks discussed', ['Bleeding / haematoma', 'Infection', 'Scarring (hypertrophic / keloid)', 'Pain', 'Anaesthetic risks', 'DVT / PE', 'Need for further surgery', ...risks], { required: true }),
    multi('alternatives', 'Alternatives discussed', ['Non-operative management', 'Delay / observation', ...alternatives]),
    sel('photo_consent', 'Consent for clinical photography', ['Given', 'Declined', 'Not asked']),
    sel('consent_signed', 'Consent form signed', ['Yes', 'No — to be completed'], { required: true, redFlags: ['No — to be completed'] }),
    text('interpreter', 'Language / interpreter used'),
  ],
});

export const daySection = (extra: string[] = []): TemplateSection => ({
  id: 'day',
  title: 'Day-of-surgery readiness (WHO Surgical Safety Checklist — sign in)',
  questions: [
    multi('checks', 'Confirmed', ['Identity and procedure confirmed with patient', 'Site and side marked', 'Consent signed', 'Fasting: solids 6 h, clear fluids 2 h', 'Anaesthetic review done', 'Blood available / group & save', 'Antibiotic prophylaxis planned', 'Implants / special equipment available', 'Pre-operative photographs taken', 'Bed / ward booked for after surgery', ...extra], { required: true }),
    sel('abx', 'Antibiotic prophylaxis', ['Not indicated (clean surgery)', 'Single dose at induction (within 60 min of incision)', 'Therapeutic course already running', 'Per microbiology advice']),
    sel('decision', 'Decision', ['Fit — proceed as planned', 'Proceed with conditions (note)', 'Postpone — optimise first', 'Cancel'], { required: true, redFlags: ['Postpone — optimise first', 'Cancel'] }),
    note('decision_note', 'Conditions / reason', { showIf: { q: 'decision', in: ['Proceed with conditions (note)', 'Postpone — optimise first', 'Cancel'] } }),
  ],
});

export const postopObsSection = (): TemplateSection => ({
  id: 'obs',
  title: 'Observations and general state',
  questions: [
    num('pod', 'Post-operative day', 'POD', { required: true }),
    num('rr', 'Respiratory rate', '/min', { required: true }),
    num('spo2', 'SpO₂', '%', { required: true }),
    sel('o2', 'Supplemental oxygen', ['No', 'Yes']),
    num('sbp', 'Systolic BP', 'mmHg', { required: true }),
    num('hr', 'Heart rate', 'bpm', { required: true }),
    num('temp', 'Temperature', '°C', { required: true }),
    sel('avpu', 'Consciousness (ACVPU)', ['Alert', 'New confusion', 'Voice', 'Pain', 'Unresponsive'], { required: true, redFlags: ['New confusion', 'Voice', 'Pain', 'Unresponsive'] }),
    num('pain', 'Pain score at rest', '/10', { required: true }),
    sel('analgesia', 'Analgesia adequate', ['Yes', 'No — escalate'], { redFlags: ['No — escalate'] }),
    sel('nausea', 'Nausea / vomiting', ['None', 'Mild', 'Persistent'], { redFlags: ['Persistent'] }),
    sel('diet', 'Oral intake', ['Nil by mouth', 'Sips', 'Fluids', 'Light diet', 'Normal diet']),
    num('urine', 'Urine output (last 6–12 h)', 'mL/kg/h'),
    sel('void', 'Passed urine since surgery', ['Yes', 'No — retention risk', 'Catheterised'], { redFlags: ['No — retention risk'] }),
    sel('mobility', 'Mobility', ['Bed rest (procedure-specific)', 'Bed to chair', 'Walking with help', 'Independent']),
    sel('vte_given', 'VTE prophylaxis given as planned', ['Yes', 'No', 'Not required'], { redFlags: ['No'] }),
    sel('calf', 'Calf pain / swelling', ['None', 'Present — assess for DVT'], { redFlags: ['Present — assess for DVT'] }),
  ],
});

export const drainSection = (): TemplateSection => ({
  id: 'drains',
  title: 'Drains',
  questions: [
    sel('drain', 'Drain in situ', ['None', 'Yes — one', 'Yes — more than one']),
    num('drain_24h', 'Output in the last 24 h (total)', 'mL', { showIf: { q: 'drain', in: ['Yes — one', 'Yes — more than one'] } }),
    sel('drain_char', 'Character', ['Serous', 'Serosanguineous', 'Frank blood', 'Purulent', 'Chylous'], { showIf: { q: 'drain', in: ['Yes — one', 'Yes — more than one'] }, redFlags: ['Frank blood', 'Purulent', 'Chylous'] }),
    sel('drain_plan', 'Plan', ['Keep', 'Remove today (< 30 mL / 24 h)', 'Remove when < 30 mL / 24 h'], { showIf: { q: 'drain', in: ['Yes — one', 'Yes — more than one'] } }),
  ],
});

export const woundCheckSection = (): TemplateSection => ({
  id: 'wound',
  title: 'Wound and dressing',
  questions: [
    sel('dressing', 'Dressing', ['Intact, dry', 'Light strike-through', 'Soaked — changed', 'Taken down for inspection', 'NPWT — seal intact', 'NPWT — leak / alarm'], { required: true, redFlags: ['NPWT — leak / alarm'] }),
    multi('wound_signs', 'Wound findings', ['Clean and dry', 'Healing well', 'Erythema', 'Swelling', 'Haematoma', 'Seroma', 'Discharge', 'Wound edge necrosis', 'Dehiscence', 'Not inspected'], { required: true, redFlags: ['Haematoma', 'Discharge', 'Wound edge necrosis', 'Dehiscence'] }),
    sel('infection', 'Surgical site infection (CDC)', ['No', 'Superficial incisional', 'Deep incisional', 'Organ / space'], { redFlags: ['Superficial incisional', 'Deep incisional', 'Organ / space'] }),
  ],
});

export const dischargeSection = (): TemplateSection => ({
  id: 'discharge',
  title: 'Plan and discharge readiness',
  questions: [
    multi('ready', 'Discharge criteria met', ['Observations stable', 'Pain controlled on oral analgesia', 'Eating and drinking', 'Passed urine', 'Mobile as expected', 'Wound satisfactory', 'Drains out / plan for drain at home', 'Understands wound care and warning signs', 'Follow-up booked']),
    sel('disposition', 'Disposition', ['Continue ward care', 'Discharge today', 'Discharge tomorrow if stable', 'Return to theatre', 'Escalate to HDU / ICU'], { required: true, redFlags: ['Return to theatre', 'Escalate to HDU / ICU'] }),
    num('fu_weeks', 'Clinic follow-up in', 'weeks'),
  ],
});

export const followUpBaseSection = (): TemplateSection => ({
  id: 'interval',
  title: 'Interval history',
  questions: [
    num('weeks', 'Time since surgery', 'weeks', { required: true }),
    sel('overall', 'Patient-reported progress', ['Better than expected', 'As expected', 'Slower than expected', 'Worse'], { required: true, redFlags: ['Worse'] }),
    num('pain_fu', 'Pain', '/10'),
    multi('complications', 'Complications since discharge', ['None', 'Wound infection', 'Wound dehiscence', 'Haematoma / seroma', 'Re-admission', 'Return to theatre', 'DVT / PE', 'Partial flap / graft loss', 'Hypertrophic scar / keloid', 'Contracture', 'Recurrence'], { required: true, redFlags: ['Wound infection', 'Wound dehiscence', 'DVT / PE', 'Partial flap / graft loss', 'Recurrence', 'Re-admission'] }),
    sel('sutures', 'Sutures / staples', ['Absorbable — none to remove', 'Removed today', 'Removed earlier', 'Still in — remove at next visit']),
    sel('adherence', 'Adherence to post-operative instructions', ['Good', 'Partial', 'Poor'], { redFlags: ['Poor'] }),
    sel('work', 'Return to work / school / usual activity', ['Returned', 'Not yet — expected', 'Not yet — delayed', 'Not applicable']),
  ],
});

export const scarSection = (): TemplateSection => ({
  id: 'scar',
  title: 'Scar (Vancouver Scar Scale)',
  questions: [
    sel('vss_vasc', 'Vascularity', ['0 — normal', '1 — pink', '2 — red', '3 — purple']),
    sel('vss_pig', 'Pigmentation', ['0 — normal', '1 — hypopigmented', '2 — hyperpigmented', '3 — mixed']),
    sel('vss_pli', 'Pliability', ['0 — normal', '1 — supple', '2 — yielding', '3 — firm', '4 — banding', '5 — contracture']),
    sel('vss_hgt', 'Height', ['0 — flat', '1 — < 2 mm', '2 — 2–5 mm', '3 — > 5 mm']),
    multi('scar_care', 'Scar care advised', ['Massage with emollient', 'Silicone gel / sheet', 'Pressure garment', 'Sun protection', 'Intralesional steroid', 'Laser / referral']),
  ],
});

export const outcomeSection = (extra: TemplateQuestion[] = []): TemplateSection => ({
  id: 'outcome',
  title: 'Outcome and next step',
  questions: [
    ...extra,
    sel('satisfaction', 'Patient satisfaction', ['Very satisfied', 'Satisfied', 'Neutral', 'Dissatisfied']),
    sel('next', 'Next step', ['Discharge from clinic', 'Review again', 'Further surgery planned', 'Refer (note)'], { required: true }),
    num('next_weeks', 'Review again in', 'weeks', { showIf: { q: 'next', in: ['Review again', 'Further surgery planned'] } }),
  ],
});

// ── scores ────────────────────────────────────────────────────────────────

export const asaScore: ScoreDef = {
  id: 'asa', label: 'ASA', reference: 'ASA Physical Status Classification (2020)',
  compute: (a) => {
    const v = ans(a, 'fitness', 'asa');
    if (!v) return null;
    const grade = /ASA ([IV]+)/.exec(v)?.[1] || '';
    const tone = ['I', 'II'].includes(grade) ? 'ok' : grade === 'III' ? 'warn' : 'danger';
    return { value: grade, band: v.split(' — ')[1] || '', tone };
  },
};

export function capriniOf(a: Answers): number | null {
  const ticked: string[] = ans(a, 'vte', 'caprini') || [];
  if (!Array.isArray(ticked)) return null;
  return ticked.reduce((s, t) => s + (CAPRINI_FACTORS.find(([l]) => l === t)?.[1] || 0), 0);
}
export const capriniScore: ScoreDef = {
  id: 'caprini', label: 'Caprini VTE', reference: 'Caprini 2005; ACCP 2012 (Gould et al.)',
  compute: (a) => {
    const s = capriniOf(a);
    if (s === null || ans(a, 'vte', 'caprini') === undefined) return null;
    if (s <= 1) return { value: s, band: 'Very low / low — early mobilisation', tone: 'ok' };
    if (s === 2) return { value: s, band: 'Low — mechanical prophylaxis', tone: 'info' };
    if (s <= 4) return { value: s, band: 'Moderate — LMWH or mechanical', tone: 'warn' };
    return { value: s, band: 'High — LMWH + mechanical', tone: 'danger' };
  },
};

export const stopBangScore: ScoreDef = {
  id: 'stopbang', label: 'STOP-BANG', reference: 'Chung et al. 2008',
  compute: (a) => {
    const v = ans(a, 'fitness', 'stopbang');
    if (!Array.isArray(v)) return null;
    const s = v.length;
    return { value: s, band: s >= 5 ? 'High risk of OSA' : s >= 3 ? 'Intermediate risk of OSA' : 'Low risk of OSA', tone: s >= 5 ? 'danger' : s >= 3 ? 'warn' : 'ok' };
  },
};

export const rcriScore: ScoreDef = {
  id: 'rcri', label: 'RCRI', reference: 'Lee et al. 1999',
  compute: (a) => {
    const v = ans(a, 'fitness', 'rcri');
    if (!Array.isArray(v)) return null;
    const s = v.filter(x => x !== 'None').length;
    const risk = ['3.9%', '6.0%', '10.1%', '15%'][Math.min(s, 3)];
    return { value: s, band: `Major cardiac event ~${risk}${s >= 3 ? ' (≥ 3 factors)' : ''}`, tone: s >= 3 ? 'danger' : s >= 2 ? 'warn' : 'ok', detail: 'Duceppe 2017 recalibration' };
  },
};

/** NEWS2 from the post-op observations (SpO₂ scale 1). */
export function news2Of(a: Answers): { total: number; anyThree: boolean } | null {
  const s = 'obs';
  const rr = n(a, s, 'rr'), spo2 = n(a, s, 'spo2'), sbp = n(a, s, 'sbp'), hr = n(a, s, 'hr'), t = n(a, s, 'temp');
  const avpu = ans(a, s, 'avpu'), o2 = ans(a, s, 'o2');
  if ([rr, spo2, sbp, hr, t].some(v => v === null) || !avpu) return null;
  const parts = [
    rr! <= 8 ? 3 : rr! <= 11 ? 1 : rr! <= 20 ? 0 : rr! <= 24 ? 2 : 3,
    spo2! <= 91 ? 3 : spo2! <= 93 ? 2 : spo2! <= 95 ? 1 : 0,
    o2 === 'Yes' ? 2 : 0,
    sbp! <= 90 ? 3 : sbp! <= 100 ? 2 : sbp! <= 110 ? 1 : sbp! <= 219 ? 0 : 3,
    hr! <= 40 ? 3 : hr! <= 50 ? 1 : hr! <= 90 ? 0 : hr! <= 110 ? 1 : hr! <= 130 ? 2 : 3,
    avpu === 'Alert' ? 0 : 3,
    t! <= 35 ? 3 : t! <= 36 ? 1 : t! <= 38 ? 0 : t! <= 39 ? 1 : 2,
  ];
  return { total: parts.reduce((x, y) => x + y, 0), anyThree: parts.some(p => p === 3) };
}
export const news2Score: ScoreDef = {
  id: 'news2', label: 'NEWS2', reference: 'Royal College of Physicians, NEWS2 (2017)',
  compute: (a) => {
    const r = news2Of(a);
    if (!r) return null;
    if (r.total >= 7) return { value: r.total, band: 'High — emergency response', tone: 'danger' };
    if (r.total >= 5 || r.anyThree) return { value: r.total, band: r.total >= 5 ? 'Medium — urgent review' : 'Low-medium (single parameter 3) — urgent ward review', tone: 'warn' };
    return { value: r.total, band: r.total === 0 ? 'Low — routine' : 'Low — ward assessment', tone: 'ok' };
  },
};

export const vssScore: ScoreDef = {
  id: 'vss', label: 'Vancouver Scar Scale', reference: 'Sullivan 1990; Baryza 1995',
  compute: (a) => {
    const parts = ['vss_vasc', 'vss_pig', 'vss_pli', 'vss_hgt'].map(k => lead(ans(a, 'scar', k)));
    if (parts.some(p => p === null)) return null;
    const s = parts.reduce((x, y) => x! + y!, 0)!;
    return { value: `${s}/13`, band: s <= 3 ? 'Mild' : s <= 7 ? 'Moderate' : 'Severe', tone: s <= 3 ? 'ok' : s <= 7 ? 'warn' : 'danger' };
  },
};

export const BRADEN: [string, string[]][] = [
  ['Sensory perception', ['1 — completely limited', '2 — very limited', '3 — slightly limited', '4 — no impairment']],
  ['Moisture', ['1 — constantly moist', '2 — very moist', '3 — occasionally moist', '4 — rarely moist']],
  ['Activity', ['1 — bedfast', '2 — chairfast', '3 — walks occasionally', '4 — walks frequently']],
  ['Mobility', ['1 — completely immobile', '2 — very limited', '3 — slightly limited', '4 — no limitation']],
  ['Nutrition', ['1 — very poor', '2 — probably inadequate', '3 — adequate', '4 — excellent']],
  ['Friction and shear', ['1 — problem', '2 — potential problem', '3 — no apparent problem']],
];
export const bradenQuestions = (): TemplateQuestion[] =>
  BRADEN.map(([label, opts], i) => sel(`braden_${i}`, `Braden — ${label}`, opts));
export const bradenScore = (section: string): ScoreDef => ({
  id: 'braden', label: 'Braden', reference: 'Bergstrom et al. 1987',
  compute: (a) => {
    const parts = BRADEN.map((_, i) => lead(ans(a, section, `braden_${i}`)));
    if (parts.some(p => p === null)) return null;
    const s = parts.reduce((x, y) => x! + y!, 0)!;
    const band = s <= 9 ? 'Very high risk' : s <= 12 ? 'High risk' : s <= 14 ? 'Moderate risk' : s <= 18 ? 'Mild risk' : 'Not at risk';
    return { value: s, band, tone: s <= 12 ? 'danger' : s <= 14 ? 'warn' : s <= 18 ? 'info' : 'ok' };
  },
});

export const COMMON_PREOP_REFS = [
  'WHO Surgical Safety Checklist (2009)',
  'NICE NG180 — Perioperative care in adults (2020)',
  'NICE NG45 — Routine preoperative tests for elective surgery (2016)',
  'NICE NG89 — VTE in over 16s (2018); Caprini risk assessment',
  'Montgomery v Lanarkshire (2015) — material risks in consent',
];
export const COMMON_POSTOP_REFS = [
  'RCP NEWS2 (2017)',
  'CDC/NHSN surgical site infection criteria',
  'NICE NG125 — Surgical site infections (2019)',
];

export const scoreTone = (r: ScoreResult | null) => r?.tone || 'info';
