/**
 * Assembles a review template (shared sections + procedure module + the
 * holistic assessment) and derives everything from the answers: scores, red
 * flags, completeness, the integrated treatment plan, the tracked items and
 * the written note.
 */
import { isVisible } from '../clerking/engine';
import type { Suggestion } from '../clerking/types';
import {
  COMMON_POSTOP_REFS, COMMON_PREOP_REFS, ans, asaScore, capriniOf, capriniScore, consentSection, daySection, dischargeSection, drainSection,
  fitnessSection, followUpBaseSection, has, n, news2Of, news2Score, note, outcomeSection, postopObsSection, rcriScore, scarSection, sel,
  stopBangScore, text, vssScore, vteSection, woundCheckSection,
} from './common';
import { HOLISTIC_REFS, bmiOf, counsellingSection, gad2Of, healingFactors, healingSection, holisticScores, mustOf, nutritionSection, phq2Of, psychSection } from './holistic';
import { PROCEDURE_BY_ID, type ProcedureSpec } from './procedures';
import { WOUND_REFS, woundFlags, woundPlan, woundScores, woundSections } from './woundReview';
import {
  PLAN_DOMAINS, REVIEW_KINDS, type Answers, type ClinicalTemplate, type FlagRule, type PlanLine, type PlanRule, type ReviewKind,
  type ScoreResult, type TemplateData, type TemplateSection,
} from './types';

// ── sections that depend on the kind ──────────────────────────────────────

const indicationSection = (kind: ReviewKind, spec: ProcedureSpec | null): TemplateSection => {
  const base = [
    text('diagnosis', kind === 'preop_review' ? 'Diagnosis / indication for surgery' : 'Diagnosis', { required: true }),
    sel('side', 'Side', ['Left', 'Right', 'Bilateral', 'Midline / not applicable']),
  ];
  if (kind === 'preop_review') return {
    id: 'indication', title: 'Indication and plan',
    questions: [
      ...base,
      text('procedure_planned', 'Procedure planned', { required: true, placeholder: spec?.label }),
      sel('urgency', 'Urgency (NCEPOD)', ['Immediate', 'Urgent (hours–days)', 'Expedited', 'Elective'], { required: true }),
      text('surgery_date', 'Planned date of surgery', { placeholder: 'YYYY-MM-DD' }),
      text('surgeon', 'Operating surgeon / consultant'),
      note('goals', 'Goals of surgery agreed with the patient'),
    ],
  };
  return {
    id: 'indication', title: 'Operation',
    questions: [
      ...base,
      text('procedure_done', 'Procedure performed', { required: true, placeholder: spec?.label }),
      text('surgery_date', 'Date of surgery', { required: true, placeholder: 'YYYY-MM-DD' }),
      text('surgeon', 'Operating surgeon'),
      note('op_findings', kind === 'postop_review' ? 'Key operative findings / instructions from the operation note' : 'Operative findings (summary)'),
    ],
  };
};

/** Consent for the treatment proposed at this review — every review documents it, not only pre-op. */
const careConsentSection = (): TemplateSection => ({
  id: 'care_consent', title: 'Consent for the treatment proposed today',
  questions: [
    sel('care_consent', 'Consent for the plan below', ['Verbal consent given', 'Written consent given', 'Consent from parent / guardian', 'Declined', 'Lacks capacity — best interests'], { required: true, redFlags: ['Declined'] }),
    text('care_risks', 'Specific risks of today’s treatment explained', { placeholder: 'e.g. bleeding with sharp debridement, pain at dressing change' }),
  ],
});

const PROC_SECTION_TITLE: Record<ReviewKind, string> = {
  wound_review: '', preop_review: 'Procedure-specific assessment', postop_review: 'Procedure-specific monitoring', procedure_follow_up: 'Procedure-specific outcome',
};
const procSection = (kind: ReviewKind, spec: ProcedureSpec): TemplateSection | null => {
  const qs = kind === 'preop_review' ? spec.preop : kind === 'postop_review' ? spec.postop : spec.followUp;
  if (!qs.length) return null;
  return { id: kind === 'preop_review' ? 'procedure' : kind === 'postop_review' ? 'monitor' : 'proc_fu', title: `${PROC_SECTION_TITLE[kind]} — ${spec.label}`, questions: qs };
};

// ── shared flags ─────────────────────────────────────────────────────────

const HOLISTIC_FLAGS: FlagRule[] = [
  { severity: 'urgent', text: 'Thoughts of self-harm — assess suicide risk now, do not leave alone, urgent psychiatry liaison', when: (a) => has(a, 'psych', 'self_harm', 'Yes — assess risk now') },
  { severity: 'warning', text: 'High malnutrition risk (MUST ≥ 2) — will impair healing; dietitian and nutritional support', when: (a) => (mustOf(a) ?? 0) >= 2 },
  { severity: 'warning', text: 'Positive depression screen (PHQ-2 ≥ 3)', when: (a) => (phq2Of(a) ?? 0) >= 3 },
  { severity: 'warning', text: 'Patient declines the proposed plan — document the discussion and their reasons; offer a second opinion', when: (a) => has(a, 'counselling', 'agrees', 'Declines (document reason)') || has(a, 'care_consent', 'care_consent', 'Declined') },
];

const PREOP_FLAGS: FlagRule[] = [
  { severity: 'warning', text: 'HbA1c above 8.5% (69 mmol/mol) — optimise before elective surgery (CPOC 2021)', when: (a) => (n(a, 'healing', 'hba1c') ?? 0) > 8.5 },
  { severity: 'warning', text: 'Haemoglobin < 10 g/dL — investigate and correct before elective surgery', when: (a) => { const h = n(a, 'fitness', 'hb'); return h !== null && h < 10; } },
  { severity: 'warning', text: 'High VTE risk (Caprini ≥ 5) — pharmacological + mechanical prophylaxis', when: (a) => (capriniOf(a) ?? 0) >= 5 && !['LMWH + mechanical', 'Already anticoagulated'].includes(ans(a, 'vte', 'vte_plan')) },
  { severity: 'warning', text: 'Consent not yet signed', when: (a) => has(a, 'consent', 'consent_signed', 'No — to be completed') },
];

const POSTOP_FLAGS: FlagRule[] = [
  { severity: 'urgent', text: 'NEWS2 ≥ 7 — emergency assessment by a clinician with critical-care competencies', when: (a) => (news2Of(a)?.total ?? 0) >= 7 },
  { severity: 'warning', text: 'NEWS2 5–6 or a single parameter scoring 3 — urgent review by the surgical team', when: (a) => { const r = news2Of(a); return !!r && r.total < 7 && (r.total >= 5 || r.anyThree); } },
  { severity: 'warning', text: 'Calf pain / swelling — exclude DVT (Wells score, duplex)', when: (a) => has(a, 'obs', 'calf', 'Present — assess for DVT') },
];

// ── plan rules shared across templates ───────────────────────────────────

const f = (a: Answers, x: string) => healingFactors(a).includes(x);

const HOLISTIC_PLAN: PlanRule[] = [
  // Nutrition
  { domain: 'Nutrition', text: 'Dietitian referral; high-protein, high-energy diet with oral nutritional supplements twice daily; weekly weights', why: 'MUST ≥ 2', when: (a) => (mustOf(a) ?? 0) >= 2 },
  { domain: 'Nutrition', text: 'Document food and fluid intake for 3 days and repeat MUST weekly', why: 'MUST 1', when: (a) => mustOf(a) === 1 },
  { domain: 'Nutrition', text: 'Protein 1.25–1.5 g/kg/day and energy 30–35 kcal/kg/day for wound healing', why: 'NPIAP 2019 nutrition recommendations', when: (a) => (mustOf(a) ?? 0) >= 1 || f(a, 'Malnutrition / hypoalbuminaemia') || (n(a, 'nutrition', 'albumin') ?? 99) < 30 },
  { domain: 'Nutrition', text: (a) => `Correct micronutrient deficits: ${(ans(a, 'nutrition', 'micro') || []).filter((x: string) => x !== 'None').join(', ')}`, when: (a) => (ans(a, 'nutrition', 'micro') || []).some((x: string) => x !== 'None') },
  { domain: 'Nutrition', text: 'Supervised weight-management advice (obesity increases wound and VTE complications)', when: (a) => (bmiOf(a) ?? 0) >= 30 || f(a, 'Obesity (BMI ≥ 30)') },
  { domain: 'Investigations', kind: 'investigation', text: 'Serum albumin, FBC, zinc and ferritin', why: 'Nutritional work-up', when: (a) => ((mustOf(a) ?? 0) >= 1 || f(a, 'Malnutrition / hypoalbuminaemia')) && n(a, 'nutrition', 'albumin') === null },
  // Factors that impair healing
  { domain: 'Comorbidity and metabolic optimisation', text: 'Glycaemic control: capillary glucose monitoring, target 6–10 mmol/L; diabetes team review', why: 'Hyperglycaemia impairs neutrophil function and collagen synthesis', when: (a) => f(a, 'Diabetes mellitus') || f(a, 'Poor glycaemic control') },
  { domain: 'Investigations', kind: 'investigation', text: 'HbA1c', when: (a) => (f(a, 'Diabetes mellitus') || f(a, 'Poor glycaemic control')) && n(a, 'healing', 'hba1c') === null },
  { domain: 'Comorbidity and metabolic optimisation', text: 'Smoking cessation — stop all nicotine ≥ 4 weeks before and after surgery; refer to cessation support / NRT', why: 'Nicotine vasoconstriction triples flap and wound complications', when: (a) => f(a, 'Smoking / nicotine') },
  { domain: 'Comorbidity and metabolic optimisation', text: 'Investigate and correct anaemia (iron studies; oral / IV iron; transfuse only if indicated)', when: (a) => f(a, 'Anaemia') || ((n(a, 'fitness', 'hb') ?? 99) < 10) },
  { domain: 'Comorbidity and metabolic optimisation', text: 'Vascular surgery assessment for revascularisation before reconstruction', priority: 'urgent', when: (a) => f(a, 'Peripheral arterial disease') || ((n(a, 'healing', 'abpi') ?? 1) < 0.8) },
  { domain: 'Comorbidity and metabolic optimisation', text: 'Compression therapy and leg elevation for venous disease (once arterial supply confirmed)', when: (a) => f(a, 'Venous insufficiency') },
  { domain: 'Comorbidity and metabolic optimisation', text: 'Oedema control: elevation, compression / manual lymphatic drainage', when: (a) => f(a, 'Lymphoedema / chronic oedema') },
  { domain: 'Comorbidity and metabolic optimisation', text: 'Irradiated bed: favour vascularised (flap) cover; delay surgery until > 6 weeks after radiotherapy where possible; consider hyperbaric oxygen', when: (a) => f(a, 'Previous radiotherapy to the site') },
  { domain: 'Comorbidity and metabolic optimisation', text: 'Chemotherapy: time surgery with oncology (neutrophils and platelets recovered)', when: (a) => f(a, 'Chemotherapy (current / recent)') },
  { domain: 'Comorbidity and metabolic optimisation', text: 'Systemic steroids: lowest effective dose, peri-operative steroid cover; consider vitamin A to counter steroid-impaired healing', when: (a) => f(a, 'Systemic steroids') },
  { domain: 'Comorbidity and metabolic optimisation', text: 'Immunosuppressants / biologics: agree peri-operative holding with the prescribing team', when: (a) => f(a, 'Immunosuppressants / biologics') },
  { domain: 'Comorbidity and metabolic optimisation', text: 'HIV: confirm ART adherence, CD4 and viral load; co-trimoxazole prophylaxis if CD4 < 200', when: (a) => f(a, 'HIV') },
  { domain: 'Comorbidity and metabolic optimisation', text: 'Sickle cell disease: haematology review, keep warm, well hydrated and oxygenated; avoid tourniquet unless agreed', when: (a) => f(a, 'Sickle cell disease') },
  { domain: 'Comorbidity and metabolic optimisation', text: 'CKD: renally adjusted drug doses, avoid nephrotoxins (NSAIDs, aminoglycosides), monitor U&E', when: (a) => f(a, 'Chronic kidney disease') },
  { domain: 'Comorbidity and metabolic optimisation', text: 'Liver disease: check coagulation and albumin; adjust drug doses', when: (a) => f(a, 'Liver disease') },
  { domain: 'Infection control and antimicrobials', text: 'Treat local infection / biofilm: cleanse, debride and topical antimicrobial before closure', when: (a) => f(a, 'Local infection / biofilm') },
  { domain: 'Surgical / wound management', text: 'Remove the foreign body / cover or remove exposed hardware (with orthopaedics)', when: (a) => f(a, 'Foreign body / exposed hardware') },
  { domain: 'Rehabilitation and function', text: 'Pressure relief: 2-hourly repositioning, pressure-redistributing mattress / cushion, heel offloading', when: (a) => f(a, 'Repetitive pressure / shear') || f(a, 'Immobility') },
  { domain: 'Surgical / wound management', text: 'Moisture / incontinence management: barrier products, continence assessment, catheter or faecal management system if needed', when: (a) => f(a, 'Moisture / incontinence') },
  { domain: 'Counselling, education and consent', text: 'Protective-sensation education: inspect skin daily, protective footwear, test bath water', when: (a) => f(a, 'Neuropathy (loss of protective sensation)') },
  { domain: 'Psychological and social care', text: 'Alcohol: brief intervention; thiamine and withdrawal monitoring if dependent', when: (a) => f(a, 'Alcohol excess') || has(a, 'psych', 'substance', 'Harmful — offer support') },
  { domain: 'Surgical / wound management', text: 'Keloid tendency: plan tension-free closure, early silicone / pressure and low threshold for intralesional steroid', when: (a) => f(a, 'Keloid tendency') },
  // Psychological and social
  { domain: 'Psychological and social care', text: 'Urgent psychiatric liaison and risk assessment; safe environment', priority: 'urgent', when: (a) => has(a, 'psych', 'self_harm', 'Yes — assess risk now') },
  { domain: 'Psychological and social care', text: 'Complete PHQ-9; refer to clinical psychology / liaison psychiatry if ≥ 10', why: 'PHQ-2 ≥ 3', when: (a) => (phq2Of(a) ?? 0) >= 3 },
  { domain: 'Psychological and social care', text: 'Complete GAD-7; anxiety support and clear information about the procedure', why: 'GAD-2 ≥ 3', when: (a) => (gad2Of(a) ?? 0) >= 3 },
  { domain: 'Psychological and social care', text: 'Psychological support for appearance concerns; offer peer support and camouflage advice', when: (a) => ['Moderate', 'Severe — affecting function'].includes(ans(a, 'psych', 'body_image')) },
  { domain: 'Psychological and social care', text: 'Further consultation to align expectations before any elective procedure (consider psychology)', when: (a) => has(a, 'psych', 'expectations', 'Unrealistic') },
  { domain: 'Psychological and social care', text: 'Pain psychology / coping support', when: (a) => ['Struggling', 'Not coping'].includes(ans(a, 'psych', 'coping')) },
  { domain: 'Psychological and social care', text: 'Involve the carer / next of kin in all explanations and decisions', when: (a) => has(a, 'psych', 'cognition', 'Impaired — involve carer') },
  { domain: 'Psychological and social care', text: 'Medical social worker referral: home support, carers, and discharge planning', when: (a) => ['Limited', 'None — lives alone without help'].includes(ans(a, 'psych', 'support')) },
  { domain: 'Psychological and social care', text: (a) => `Address practical barriers: ${(ans(a, 'psych', 'barriers') || []).filter((x: string) => x !== 'None').join(', ')} — social welfare, cost-effective dressings, nearest dressing centre, sick note`, when: (a) => (ans(a, 'psych', 'barriers') || []).some((x: string) => x !== 'None') },
  { domain: 'Counselling, education and consent', text: 'Explain the risks of traditional / herbal applications to the wound and agree to stop them', when: (a) => has(a, 'psych', 'barriers', 'Traditional / herbal treatment use') || (ans(a, 'wound_hx', 'prev_tx') || []).includes('Traditional / herbal applications') },
  // Counselling
  { domain: 'Counselling, education and consent', text: (a) => `Counselled on: ${(ans(a, 'counselling', 'discussed') || []).join('; ').toLowerCase()}`, when: (a) => (ans(a, 'counselling', 'discussed') || []).length > 0 },
  { domain: 'Counselling, education and consent', text: 'Reinforce understanding with the carer and a written / pictorial leaflet; check again at the next review', when: (a) => ['Partial — reinforced', 'Poor — carer involved / written leaflet'].includes(ans(a, 'counselling', 'understanding')) },
  { domain: 'Counselling, education and consent', text: 'Patient wants time to decide — arrange a further discussion and provide written information', when: (a) => has(a, 'counselling', 'agrees', 'Wants time to decide') },
  { domain: 'Follow-up and safety-netting', text: 'Return immediately for fever, spreading redness, increasing pain, bleeding, offensive discharge, or a cold / dusky flap or digit' },
];

const PREOP_PLAN: PlanRule[] = [
  { domain: 'Comorbidity and metabolic optimisation', text: 'Pre-assessment anaesthetic review (ASA III or above)', when: (a) => /ASA (III|IV|V)/.test(ans(a, 'fitness', 'asa') || '') },
  { domain: 'Comorbidity and metabolic optimisation', text: 'Defer elective surgery and optimise glycaemic control (HbA1c > 8.5%)', when: (a) => (n(a, 'healing', 'hba1c') ?? 0) > 8.5 && ans(a, 'indication', 'urgency') === 'Elective' },
  { domain: 'Comorbidity and metabolic optimisation', text: 'Variable-rate insulin infusion / diabetes peri-operative protocol (JBDS)', when: (a) => has(a, 'fitness', 'meds_hold', 'Insulin') },
  { domain: 'Comorbidity and metabolic optimisation', text: (a) => `Medication plan: ${ans(a, 'fitness', 'meds_plan') || 'per peri-operative medicines guidance'}`, when: (a) => (ans(a, 'fitness', 'meds_hold') || []).some((x: string) => x !== 'None') },
  { domain: 'Comorbidity and metabolic optimisation', text: 'Suspected obstructive sleep apnoea — anaesthetic alert, minimise opioids, post-op monitored bed', when: (a) => ((ans(a, 'fitness', 'stopbang') || []).length) >= 5 },
  { domain: 'Investigations', kind: 'investigation', text: 'ECG ± echocardiogram; cardiology opinion if symptomatic', why: 'RCRI ≥ 2', when: (a) => ((ans(a, 'fitness', 'rcri') || []).filter((x: string) => x !== 'None').length) >= 2 },
  { domain: 'Investigations', kind: 'investigation', text: (a) => `Outstanding pre-operative tests: ${['FBC', 'U&E / creatinine', 'Group & save'].filter(x => !(ans(a, 'fitness', 'workup') || []).includes(x)).join(', ')}`, when: (a) => ans(a, 'fitness', 'workup') !== undefined && ['FBC', 'U&E / creatinine', 'Group & save'].some(x => !(ans(a, 'fitness', 'workup') || []).includes(x)) && !/Local anaesthesia/.test(ans(a, 'fitness', 'anaesthesia') || '') },
  { domain: 'VTE prophylaxis', text: (a) => { const s = capriniOf(a) ?? 0; return s >= 5 ? 'LMWH (e.g. enoxaparin 40 mg SC daily, 12 h post-op) + IPC / stockings until fully mobile; consider 7–10 days extended' : s >= 3 ? 'LMWH or IPC (bleeding risk) until mobile' : s === 2 ? 'Mechanical prophylaxis (IPC / stockings) and early mobilisation' : 'Early mobilisation; no pharmacological prophylaxis'; }, why: 'Caprini score (ASPS / ACCP)', when: (a) => ans(a, 'vte', 'caprini') !== undefined },
  { domain: 'VTE prophylaxis', text: 'Bleeding risk — mechanical prophylaxis only; reassess daily for LMWH', when: (a) => has(a, 'vte', 'bleeding_risk', 'Yes — mechanical only') },
  { domain: 'Infection control and antimicrobials', text: (a) => `Antibiotic prophylaxis: ${ans(a, 'day', 'abx') || 'per local policy'}`, when: (a) => !!ans(a, 'day', 'abx') },
  { domain: 'Infection control and antimicrobials', text: 'Latex-free / chlorhexidine-free theatre — allergy alert on the list', priority: 'urgent', when: (a) => has(a, 'fitness', 'allergy', 'Latex') || has(a, 'fitness', 'allergy', 'Chlorhexidine') },
  { domain: 'Analgesia and comfort', text: 'Multimodal analgesia plan: regional / local anaesthetic infiltration, regular paracetamol, NSAID unless contraindicated, opioid for breakthrough' },
  { domain: 'Counselling, education and consent', text: 'Complete and sign the consent form (material risks documented) before the day of surgery', priority: 'urgent', when: (a) => has(a, 'consent', 'consent_signed', 'No — to be completed') },
  { domain: 'Counselling, education and consent', text: 'Fasting instructions (solids 6 h, clear fluids 2 h) and what to bring on the day' },
  { domain: 'Surgical / wound management', text: (a) => `Decision: ${ans(a, 'day', 'decision')}${ans(a, 'day', 'decision_note') ? ` — ${ans(a, 'day', 'decision_note')}` : ''}`, when: (a) => !!ans(a, 'day', 'decision') },
];

const POSTOP_PLAN: PlanRule[] = [
  { domain: 'Surgical / wound management', text: 'Urgent senior surgical review (NEWS2 trigger)', priority: 'urgent', when: (a) => { const r = news2Of(a); return !!r && (r.total >= 5 || r.anyThree); } },
  { domain: 'Surgical / wound management', text: 'Return to theatre', priority: 'urgent', when: (a) => has(a, 'discharge', 'disposition', 'Return to theatre') },
  { domain: 'Surgical / wound management', text: (a) => `Drain: ${String(ans(a, 'drains', 'drain_plan') || '').toLowerCase()}`, when: (a) => !!ans(a, 'drains', 'drain_plan') },
  { domain: 'Surgical / wound management', text: 'Evacuate haematoma / review in theatre', priority: 'urgent', when: (a) => has(a, 'wound', 'wound_signs', 'Haematoma') },
  { domain: 'Infection control and antimicrobials', text: 'Surgical site infection: wound swab, open / drain as needed, antibiotics per culture', when: (a) => ['Superficial incisional', 'Deep incisional', 'Organ / space'].includes(ans(a, 'wound', 'infection')) },
  { domain: 'Investigations', kind: 'investigation', text: 'Wound swab for culture', when: (a) => has(a, 'wound', 'wound_signs', 'Discharge') || ['Superficial incisional', 'Deep incisional', 'Organ / space'].includes(ans(a, 'wound', 'infection')) },
  { domain: 'Investigations', kind: 'investigation', text: 'Lower-limb venous duplex', priority: 'urgent', when: (a) => has(a, 'obs', 'calf', 'Present — assess for DVT') },
  { domain: 'Investigations', kind: 'investigation', text: 'Bladder scan; catheterise if > 500 mL', when: (a) => has(a, 'obs', 'void', 'No — retention risk') },
  { domain: 'Analgesia and comfort', text: 'Escalate analgesia (step up the multimodal regimen; acute pain team if uncontrolled)', when: (a) => (n(a, 'obs', 'pain') ?? 0) >= 4 || has(a, 'obs', 'analgesia', 'No — escalate') },
  { domain: 'Analgesia and comfort', text: 'Antiemetic (e.g. ondansetron) and review opioid dose', when: (a) => has(a, 'obs', 'nausea', 'Persistent') },
  { domain: 'VTE prophylaxis', text: 'Continue the VTE prophylaxis plan; document any missed doses', when: (a) => !has(a, 'obs', 'vte_given', 'Not required') },
  { domain: 'Rehabilitation and function', text: 'Mobilise as the procedure allows; physiotherapy for chest and mobility' },
  { domain: 'Follow-up and safety-netting', text: (a) => `Clinic review in ${n(a, 'discharge', 'fu_weeks')} week(s)`, when: (a) => n(a, 'discharge', 'fu_weeks') !== null },
];

const FOLLOWUP_PLAN: PlanRule[] = [
  { domain: 'Surgical / wound management', text: 'Scar management: silicone gel / sheet 12–23 h a day, massage, sun protection for 12 months', when: (a) => { const v = vssScore.compute(a); return !!v && v.tone !== 'ok'; } },
  { domain: 'Surgical / wound management', text: 'Intralesional triamcinolone for raised / firm scar', when: (a) => ['2 — 2–5 mm', '3 — > 5 mm'].includes(ans(a, 'scar', 'vss_hgt')) },
  { domain: 'Surgical / wound management', text: (a) => `Manage complication(s): ${(ans(a, 'interval', 'complications') || []).filter((x: string) => x !== 'None').join(', ')}`, priority: 'urgent', when: (a) => (ans(a, 'interval', 'complications') || []).some((x: string) => x !== 'None') },
  { domain: 'Surgical / wound management', text: 'Remove sutures at the next visit', when: (a) => has(a, 'interval', 'sutures', 'Still in — remove at next visit') },
  { domain: 'Rehabilitation and function', text: 'Return-to-work / activity plan with occupational therapy; fitness note', when: (a) => has(a, 'interval', 'work', 'Not yet — delayed') },
  { domain: 'Counselling, education and consent', text: 'Re-explain the post-operative instructions and why they matter; involve family', when: (a) => ['Partial', 'Poor'].includes(ans(a, 'interval', 'adherence')) },
  { domain: 'Follow-up and safety-netting', text: (a) => ans(a, 'outcome', 'next') === 'Discharge from clinic' ? 'Discharged from the clinic with open access to return' : `${ans(a, 'outcome', 'next')}${n(a, 'outcome', 'next_weeks') ? ` in ${n(a, 'outcome', 'next_weeks')} week(s)` : ''}`, when: (a) => !!ans(a, 'outcome', 'next') },
];

// ── assembly ─────────────────────────────────────────────────────────────

const compact = <T,>(xs: (T | null | undefined | false)[]) => xs.filter(Boolean) as T[];

export function buildTemplate(kind: ReviewKind, procedureId: string | null): ClinicalTemplate {
  const spec = procedureId ? PROCEDURE_BY_ID[procedureId] || null : null;
  const kindLabel = REVIEW_KINDS.find(k => k.kind === kind)!.label;
  const holistic = [nutritionSection(), healingSection(), psychSection(), counsellingSection(spec?.counselling)];
  const specFlags = spec?.flags?.[kind] || [];
  const specPlan = spec?.plan?.[kind] || [];
  const refs = spec?.references || [];

  if (kind === 'wound_review') {
    return {
      id: 'wound_review', kind, procedureId: null, title: kindLabel, subtitle: 'TIME / TIMERS · IWII infection continuum · PUSH',
      sections: [...woundSections(), ...holistic, careConsentSection()],
      scores: [...woundScores, ...holisticScores], flags: [...woundFlags, ...HOLISTIC_FLAGS],
      plan: [...woundPlan, ...HOLISTIC_PLAN], references: [...WOUND_REFS, ...HOLISTIC_REFS],
    };
  }
  if (!spec) throw new Error(`Unknown procedure: ${procedureId}`);

  if (kind === 'preop_review') {
    return {
      id: `${kind}:${spec.id}`, kind, procedureId: spec.id, title: `${kindLabel} — ${spec.label}`, subtitle: spec.group,
      sections: compact([
        indicationSection(kind, spec), procSection(kind, spec), fitnessSection(spec.workup), vteSection(), ...holistic,
        consentSection(spec.risks, spec.alternatives), daySection(spec.dayChecks),
      ]),
      scores: [asaScore, capriniScore, stopBangScore, rcriScore, ...holisticScores],
      flags: [...specFlags, ...PREOP_FLAGS, ...HOLISTIC_FLAGS],
      plan: [...specPlan, ...PREOP_PLAN, ...HOLISTIC_PLAN],
      references: [...refs, ...COMMON_PREOP_REFS, ...HOLISTIC_REFS],
    };
  }
  if (kind === 'postop_review') {
    return {
      id: `${kind}:${spec.id}`, kind, procedureId: spec.id, title: `${kindLabel} — ${spec.label}`, subtitle: spec.schedule || spec.group,
      sections: compact([
        indicationSection(kind, spec), postopObsSection(), procSection(kind, spec), woundCheckSection(), drainSection(),
        ...holistic, careConsentSection(), dischargeSection(),
      ]),
      scores: [news2Score, ...holisticScores],
      flags: [...specFlags, ...POSTOP_FLAGS, ...HOLISTIC_FLAGS],
      plan: [...specPlan, ...POSTOP_PLAN, ...HOLISTIC_PLAN],
      references: [...refs, ...COMMON_POSTOP_REFS, ...HOLISTIC_REFS],
    };
  }
  return {
    id: `${kind}:${spec.id}`, kind, procedureId: spec.id, title: `${kindLabel} — ${spec.label}`, subtitle: spec.schedule || spec.group,
    sections: compact([
      indicationSection(kind, spec), followUpBaseSection(), procSection(kind, spec), scarSection(),
      ...holistic, careConsentSection(), outcomeSection(),
    ]),
    scores: [vssScore, ...holisticScores],
    flags: [...specFlags, ...HOLISTIC_FLAGS],
    plan: [...specPlan, ...FOLLOWUP_PLAN, ...HOLISTIC_PLAN],
    references: [...refs, ...HOLISTIC_REFS],
  };
}

export function emptyTemplateData(t: ClinicalTemplate): TemplateData {
  return { version: 1, templateId: t.id, kind: t.kind, procedureId: t.procedureId, procedureLabel: t.procedureId ? PROCEDURE_BY_ID[t.procedureId]?.label : undefined, answers: {}, plan: [] };
}

// ── derived state ────────────────────────────────────────────────────────

const answered = (v: any) => v !== undefined && v !== null && v !== '' && !(Array.isArray(v) && v.length === 0);

export interface ComputedScore { id: string; label: string; result: ScoreResult; reference?: string }
export function computeScores(t: ClinicalTemplate, a: Answers): ComputedScore[] {
  const out: ComputedScore[] = [];
  for (const s of t.scores) {
    let result: ScoreResult | null = null;
    try { result = s.compute(a); } catch { result = null; }
    if (result) out.push({ id: s.id, label: s.label, result, reference: s.reference });
  }
  return out;
}

export interface TemplateFlag { text: string; severity: 'urgent' | 'warning'; section?: string }

export function templateFlags(t: ClinicalTemplate, a: Answers): TemplateFlag[] {
  const out: TemplateFlag[] = [];
  for (const r of t.flags) { try { if (r.when(a)) out.push({ text: r.text, severity: r.severity }); } catch { /* incomplete answers */ } }
  // Any answer the template marks as a red flag.
  for (const s of t.sections) {
    const sa = a[s.id] || {};
    for (const q of s.questions) {
      if (!q.redFlags || !isVisible(q, sa)) continue;
      const vals = (Array.isArray(sa[q.id]) ? sa[q.id] : [sa[q.id]]).filter(answered).map(String);
      const hit = vals.filter((v: string) => q.redFlags!.includes(v));
      if (hit.length) out.push({ text: `${q.label}: ${hit.join(', ')}`, severity: 'warning', section: s.title });
    }
  }
  return out;
}

export function completeness(t: ClinicalTemplate, a: Answers): { done: number; total: number; missing: { section: string; label: string }[] } {
  const missing: { section: string; label: string }[] = [];
  let total = 0;
  for (const s of t.sections) {
    const sa = a[s.id] || {};
    for (const q of s.questions) {
      if (!q.required || !isVisible(q, sa)) continue;
      total++;
      if (!answered(sa[q.id])) missing.push({ section: s.title, label: q.label });
    }
  }
  return { done: total - missing.length, total, missing };
}

const ruleId = (r: PlanRule, i: number) => `t${i}:${r.domain.slice(0, 12)}`;

/**
 * The integrated plan: every rule whose condition holds proposes a line.
 * Lines the clinician edited or excluded keep their state; lines they added
 * are always kept; template lines whose condition no longer holds disappear
 * unless the clinician edited them.
 */
export function buildPlan(t: ClinicalTemplate, a: Answers, previous: PlanLine[] = []): PlanLine[] {
  const prev = new Map(previous.map(l => [l.id, l]));
  const out: PlanLine[] = [];
  t.plan.forEach((r, i) => {
    let on = false, txt = '';
    try { on = r.when ? r.when(a) : true; txt = on ? (typeof r.text === 'function' ? r.text(a) : r.text) : ''; } catch { on = false; }
    const id = ruleId(r, i);
    const old = prev.get(id);
    if (!on) { if (old?.edited) out.push(old); return; }
    out.push(old ? { ...old, text: old.edited ? old.text : txt, priority: r.priority ?? old.priority } :
      { id, domain: r.domain, text: txt, kind: r.kind || (r.domain === 'Investigations' ? 'investigation' : 'treatment'), priority: r.priority, why: r.why, source: 'template', include: true });
  });
  for (const l of previous) if (l.source === 'clinician') out.push(l);
  return out.sort((x, y) => PLAN_DOMAINS.indexOf(x.domain) - PLAN_DOMAINS.indexOf(y.domain));
}

/**
 * Plan lines that become tracked plan items (Problem list / Plan panel):
 * investigations, urgent actions and what the clinician added — the
 * actionable items, not standing advice repeated at every review.
 */
export function planSuggestions(data: TemplateData, encounterTitle: string): Suggestion[] {
  return data.plan.filter(l => l.include && (l.kind === 'investigation' || l.priority === 'urgent' || l.source === 'clinician')).map(l => ({
    id: `plan:${l.id}`, kind: l.kind, text: l.text, reasons: [encounterTitle, l.domain, ...(l.why ? [l.why] : [])],
    source: 'rules' as const, priority: l.priority, decision: 'accepted' as const,
  }));
}

const fmtAnswer = (v: any, unit?: string) => (Array.isArray(v) ? v.join(', ') : `${v}${unit ? ` ${unit}` : ''}`);

/** Plain-text clinical note, as saved with the encounter and shown under "View note". */
export function templateNarrative(t: ClinicalTemplate, data: TemplateData, opts: { patientLabel: string; author: string; when?: Date }): string {
  const a = data.answers;
  const lines: string[] = [];
  const when = (opts.when || new Date()).toLocaleString(undefined, { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
  lines.push(t.title.toUpperCase(), opts.patientLabel, `${when} · ${opts.author}`, '');
  for (const s of t.sections) {
    const sa = a[s.id] || {};
    const items = s.questions.filter(q => isVisible(q, sa) && answered(sa[q.id])).map(q => `  ${q.label}: ${fmtAnswer(sa[q.id], q.unit)}`);
    if (!items.length) continue;
    lines.push(s.title.toUpperCase(), ...items, '');
  }
  const scores = computeScores(t, a);
  if (scores.length) lines.push('SCORES', ...scores.map(s => `  ${s.label}: ${s.result.value} — ${s.result.band}`), '');
  const flags = templateFlags(t, a);
  if (flags.length) lines.push('ALERTS', ...flags.map(f2 => `  ${f2.severity === 'urgent' ? '[URGENT] ' : ''}${f2.text}`), '');
  if (data.impression) lines.push('IMPRESSION', `  ${data.impression}`, '');
  const plan = data.plan.filter(l => l.include);
  if (plan.length) {
    lines.push('INTEGRATED TREATMENT PLAN');
    for (const d of PLAN_DOMAINS) {
      const ls = plan.filter(l => l.domain === d);
      if (!ls.length) continue;
      lines.push(`  ${d}`, ...ls.map(l => `    • ${l.priority === 'urgent' ? '[URGENT] ' : ''}${l.text}`));
    }
    lines.push('');
  }
  if (data.notes) lines.push('ADDITIONAL NOTES', `  ${data.notes}`, '');
  const c = completeness(t, a);
  if (c.missing.length) lines.push(`Not documented (${c.missing.length}): ${c.missing.map(m => m.label).join('; ')}`, '');
  lines.push(`Basis: ${t.references.join('; ')}`);
  return lines.join('\n');
}

/** Summary saved with the encounter (list labels, scribe, outcomes). */
export function templateSummary(t: ClinicalTemplate, data: TemplateData) {
  const a = data.answers;
  return {
    template: t.id, title: t.title, kind: t.kind, procedure: data.procedureLabel || null,
    diagnosis: ans(a, 'indication', 'diagnosis') || ans(a, 'wound_hx', 'aetiology') || null,
    surgery_date: ans(a, 'indication', 'surgery_date') || null,
    scores: computeScores(t, a).map(s => ({ label: s.label, value: s.result.value, band: s.result.band })),
    red_flags: templateFlags(t, a).map(f2 => f2.text),
    healing_factors: healingFactors(a),
    plan: data.plan.filter(l => l.include).map(l => ({ domain: l.domain, text: l.text, priority: l.priority || null })),
    impression: data.impression || null,
    completeness: (() => { const c = completeness(t, a); return { done: c.done, total: c.total }; })(),
  };
}

/** Days between two YYYY-MM-DD dates (post-operative day / weeks since surgery). */
export function daysSince(dateStr: string | undefined, now = new Date()): number | null {
  if (!dateStr || !/^\d{4}-\d{2}-\d{2}/.test(dateStr)) return null;
  const d = Date.parse(`${dateStr.slice(0, 10)}T00:00:00`);
  if (Number.isNaN(d)) return null;
  return Math.floor((now.getTime() - d) / 86400000);
}

