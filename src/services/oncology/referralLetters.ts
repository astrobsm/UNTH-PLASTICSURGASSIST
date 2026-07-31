/**
 * Subspecialty referral letter generation.
 *
 * Builds a complete, sendable letter for every specialty the management plan
 * involves. Letters are deliberately generated from the SAME plan items the
 * board ratified, so a referral cannot drift from the agreed plan.
 *
 * Each letter states what is being asked for, why, and what the receiving team
 * needs to know to act — the three things a referral most often omits.
 */

import type { ManagementPlan, PlanItem, Specialty } from './managementPlan';
import { SPECIALTY_LABELS } from './managementPlan';
import type { StageResult } from './stagingEngine';

export interface LetterPatient {
  name: string;
  hospitalNumber?: string;
  age?: number | null;
  sex?: string;
  ward?: string;
}

export interface LetterContext {
  patient: LetterPatient;
  stage: StageResult;
  plan: ManagementPlan;
  diagnosis: string;
  histologicType?: string | null;
  primarySite?: string;
  boardDate?: string;
  /** Consultant chairing the board — the letter is sent in their name. */
  fromClinician?: string;
  fromUnit?: string;
  comorbidities?: string;
  performanceStatus?: string | null;
}

export interface ReferralLetter {
  specialty: Specialty;
  specialtyLabel: string;
  subject: string;
  body: string;
  /** The plan items this letter is asking the receiving team to deliver. */
  requestedItems: string[];
  urgency: 'routine' | 'urgent' | 'two_week';
}

/** What each specialty specifically needs told to them. */
const SPECIALTY_BRIEF: Record<Specialty, { asks: string; needs: string }> = {
  radiation_oncology: {
    asks: 'assessment for radiotherapy planning',
    needs:
      'Operative note and histopathology report including margin status, tumour bed clip placement, and any ' +
      'perineural or extranodal extension. Please advise on timing relative to surgery and on preoperative versus ' +
      'postoperative treatment where both are options.',
  },
  medical_oncology: {
    asks: 'assessment for systemic therapy',
    needs:
      'Full staging imaging, histology with any molecular results, performance status, renal, hepatic and cardiac ' +
      'baseline. Please advise on regimen, sequencing relative to surgery, and trial eligibility.',
  },
  surgical_oncology: {
    asks: 'assessment for oncological resection',
    needs: 'Cross-sectional imaging, biopsy result and the tumour board record. Please advise on resectability and approach.',
  },
  plastic_reconstructive_surgery: {
    asks: 'assessment for resection and reconstruction',
    needs:
      'Defect size and site anticipated after clearance, and whether margins will be confirmed before definitive ' +
      'reconstruction. Please advise on the reconstructive plan and its staging.',
  },
  histopathology: {
    asks: 'specialist pathology review and ancillary testing',
    needs:
      'Original blocks and slides, clinical and radiological context. Please confirm subtype, grade and margin ' +
      'status, and perform the molecular studies specified below.',
  },
  radiology: {
    asks: 'staging and surveillance imaging',
    needs: 'Clinical question, primary site and the specific modality requested. Please report against staging criteria.',
  },
  nuclear_medicine: {
    asks: 'lymphoscintigraphy / functional imaging',
    needs: 'Primary site and laterality, planned date of surgery so tracer timing can be coordinated.',
  },
  dermatology: {
    asks: 'dermatological assessment and field surveillance',
    needs: 'Lesion history, immunosuppression status and prior skin cancer history.',
  },
  palliative_care: {
    asks: 'symptom control and supportive care input alongside active treatment',
    needs:
      'Current symptom burden, analgesic requirements, understanding of prognosis, and what the patient and family ' +
      'have already been told.',
  },
  clinical_genetics: {
    asks: 'assessment for an inherited cancer predisposition',
    needs: 'Family history across three generations, age at diagnosis, and any synchronous or multiple primaries.',
  },
  psycho_oncology: {
    asks: 'psychological assessment and support',
    needs: 'Distress screening result, current support network and any prior mental health history.',
  },
  nutrition_dietetics: {
    asks: 'nutritional assessment and support',
    needs: 'Weight trajectory, planned surgery or chemoradiotherapy, and any swallowing difficulty.',
  },
  physiotherapy_rehabilitation: {
    asks: 'rehabilitation assessment',
    needs: 'Planned resection and expected functional deficit, including any lymphadenectomy and lymphoedema risk.',
  },
  specialist_nursing: {
    asks: 'key worker allocation and patient support',
    needs: 'Diagnosis, plan and what the patient has been told to date.',
  },
};

function urgencyFor(specialty: Specialty, plan: ManagementPlan): ReferralLetter['urgency'] {
  const items = plan.items.filter(i => i.owner === specialty);
  if (items.some(i => i.strength === 'required')) return 'urgent';
  if (plan.intent === 'palliative') return 'urgent';
  // Cancer pathways are time-critical; anything on the treatment path is at
  // minimum a two-week-wait equivalent.
  if (items.some(i => ['surgery', 'systemic_therapy', 'radiation_oncology'].includes(i.modality))) return 'two_week';
  return 'routine';
}

function formatItems(items: PlanItem[]): string {
  return items
    .map((i, n) => `${n + 1}. [${i.strength.toUpperCase()}] ${i.title}\n   ${i.detail}\n   Basis: ${i.basis}`)
    .join('\n\n');
}

export function generateReferralLetter(ctx: LetterContext, specialty: Specialty): ReferralLetter {
  const items = ctx.plan.items.filter(i => i.owner === specialty);
  const brief = SPECIALTY_BRIEF[specialty];
  const label = SPECIALTY_LABELS[specialty];
  const p = ctx.patient;

  const patientLine = [
    p.name,
    p.hospitalNumber ? `Hospital No: ${p.hospitalNumber}` : null,
    p.age !== null && p.age !== undefined ? `${p.age} years` : null,
    p.sex || null,
  ]
    .filter(Boolean)
    .join(' | ');

  const subject = `Referral for ${brief.asks} — ${ctx.diagnosis} (Stage ${ctx.stage.stageGroup})`;

  const body = [
    `Dear ${label} Team,`,
    '',
    `Re: ${patientLine}`,
    '',
    `Thank you for accepting this referral for ${brief.asks}.`,
    '',
    'DIAGNOSIS',
    `${ctx.diagnosis}${ctx.histologicType ? ` — ${ctx.histologicType}` : ''}`,
    ctx.primarySite ? `Primary site: ${ctx.primarySite}` : '',
    '',
    'STAGE',
    `${ctx.stage.formatted}`,
    `Staging system: ${ctx.stage.stagingSystem} (${ctx.stage.basis} staging)`,
    ctx.stage.stageDescription ? ctx.stage.stageDescription : '',
    '',
    ctx.performanceStatus ? `PERFORMANCE STATUS\n${ctx.performanceStatus}\n` : '',
    ctx.comorbidities ? `RELEVANT COMORBIDITY\n${ctx.comorbidities}\n` : '',
    'TUMOUR BOARD DECISION',
    `Discussed at the multidisciplinary tumour board${ctx.boardDate ? ` on ${ctx.boardDate}` : ''}. ` +
      `Agreed treatment intent: ${ctx.plan.intent}.`,
    '',
    `SPECIFICALLY REQUESTED OF ${label.toUpperCase()}`,
    items.length ? formatItems(items) : `Assessment and opinion regarding ${brief.asks}.`,
    '',
    'INFORMATION ENCLOSED / REQUIRED',
    brief.needs,
    '',
    'FULL AGREED PLAN (for context)',
    ctx.plan.items.map(i => `- [${SPECIALTY_LABELS[i.owner]}] ${i.title}`).join('\n'),
    '',
    ctx.stage.caveats.length ? `CAVEATS\n${ctx.stage.caveats.map(c => `- ${c}`).join('\n')}\n` : '',
    'Please contact the unit if any element of this plan needs to be revisited before you see the patient.',
    '',
    'Yours sincerely,',
    '',
    ctx.fromClinician || '',
    ctx.fromUnit || 'Plastic & Reconstructive Surgery Unit',
  ]
    .filter(line => line !== '')
    .join('\n');

  return {
    specialty,
    specialtyLabel: label,
    subject,
    body,
    requestedItems: items.map(i => i.title),
    urgency: urgencyFor(specialty, ctx.plan),
  };
}

/** One letter per specialty the plan involves. */
export function generateAllReferralLetters(ctx: LetterContext): ReferralLetter[] {
  return ctx.plan.specialtiesInvolved.map(s => generateReferralLetter(ctx, s));
}
