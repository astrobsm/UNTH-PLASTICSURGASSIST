/**
 * Patient and family counselling document generation.
 *
 * Written to be READ BY THE PATIENT, not by clinicians. That constrains the
 * language: no TNM notation, no abbreviations, no "lesion"/"excision" where
 * "growth"/"operation to remove it" will do, and no numbers presented as
 * certainties. Clinical staging detail is deliberately confined to a single
 * "what the tests showed" section, expressed in plain terms.
 *
 * The document is a STARTING POINT for a conversation, not a replacement for
 * one — that is stated on the document itself, because a printed handout can
 * otherwise be mistaken for the whole of the consent process.
 */

import type { ManagementPlan, Modality } from './managementPlan';
import type { StageResult, TumorFamily } from './stagingEngine';
import { isMetastatic, isNodePositive } from './stagingEngine';

export interface CounsellingSection {
  heading: string;
  body: string;
}

export interface CounsellingDocument {
  title: string;
  forAudience: 'patient_and_family';
  sections: CounsellingSection[];
  questionsToAsk: string[];
  redFlags: string[];
  disclaimer: string;
}

const FAMILY_PLAIN_NAME: Record<TumorFamily, string> = {
  cutaneous_melanoma: 'melanoma, a type of skin cancer that starts in the pigment-producing cells',
  cutaneous_scc: 'squamous cell carcinoma, a common type of skin cancer that starts in the surface layer of the skin',
  cutaneous_bcc: 'basal cell carcinoma, the most common type of skin cancer, which grows slowly and rarely spreads',
  merkel_cell: 'Merkel cell carcinoma, an uncommon skin cancer that needs to be treated promptly',
  soft_tissue_sarcoma: 'a soft tissue sarcoma, a cancer that develops in the supporting tissues of the body such as muscle, fat or fibrous tissue',
};

const MODALITY_PLAIN: Record<Modality, string> = {
  diagnostics: 'Further tests to complete the picture',
  surgery: 'An operation',
  radiation_oncology: 'Radiotherapy (high-energy X-ray treatment)',
  systemic_therapy: 'Medicines that treat the whole body',
  molecular_pathology: 'Detailed laboratory tests on the tissue sample',
  reconstruction: 'Reconstructive surgery to repair the area',
  supportive_care: 'Support for you and your family',
  clinical_trial: 'The possibility of joining a research study',
};

function spreadExplanation(stage: StageResult, family: TumorFamily): string {
  const metastatic = isMetastatic(stage);
  const nodePos = isNodePositive(stage);

  if (stage.T === 'Tis') {
    return (
      'The abnormal cells are confined to the very surface layer of the skin and have not grown into the deeper ' +
      'tissue. This is the earliest possible stage, and treatment is expected to remove it completely.'
    );
  }
  if (metastatic) {
    return (
      'The tests show that the cancer has spread beyond where it started to other parts of the body. This changes ' +
      'the aim of treatment: rather than trying to remove everything with an operation, the focus moves to ' +
      'treatments that work throughout the body to control the cancer, relieve symptoms and give you as much good ' +
      'time as possible. ' +
      (family === 'cutaneous_melanoma' || family === 'merkel_cell'
        ? 'It is important to know that modern immunotherapy treatments can control this type of cancer for a long ' +
          'time in some people, and a minority do very well indeed. Your oncologist will explain what is realistic ' +
          'in your particular situation.'
        : '')
    );
  }
  if (nodePos) {
    return (
      'The cancer has spread from where it started into nearby lymph glands. Lymph glands are part of the body\'s ' +
      'drainage system and are often the first place cancer travels to. This does not mean it has spread widely, ' +
      'but it does mean treatment needs to address both the original area and the glands, and usually that ' +
      'additional treatment is recommended after surgery to reduce the chance of it coming back.'
    );
  }
  return (
    'The tests have not found any sign that the cancer has spread to the lymph glands or elsewhere in the body. ' +
    'The aim of treatment is to remove it completely and to reduce the risk of it returning.'
  );
}

export interface CounsellingContext {
  family: TumorFamily;
  stage: StageResult;
  plan: ManagementPlan;
  patientName?: string;
  histologyPending?: boolean;
  histologicType?: string | null;
  primarySite?: string;
}

export function buildCounsellingDocument(ctx: CounsellingContext): CounsellingDocument {
  const { family, stage, plan } = ctx;
  const sections: CounsellingSection[] = [];
  const metastatic = isMetastatic(stage);

  sections.push({
    heading: 'What we have found',
    body:
      `You have been diagnosed with ${FAMILY_PLAIN_NAME[family]}` +
      (ctx.primarySite ? `, which started in the ${ctx.primarySite}` : '') +
      '. ' +
      (ctx.histologyPending
        ? 'Some of the laboratory results are still awaited. What follows is our plan based on what we know so far, ' +
          'and we will go through it with you again once all the results are back — it may change.'
        : 'The diagnosis has been confirmed by examining the tissue under a microscope.'),
  });

  sections.push({
    heading: 'What the tests showed about spread',
    body: spreadExplanation(stage, family),
  });

  sections.push({
    heading: 'Who has been involved in planning your care',
    body:
      'Your case has been discussed by a multidisciplinary team — a meeting where surgeons, cancer doctors, ' +
      'radiologists, pathologists and specialist nurses review the results together and agree a plan. This means the ' +
      'recommendation you are being given is a team decision, not one person\'s opinion. ' +
      `The following specialists are involved in your care: ${plan.specialtiesInvolved
        .map(s => s.replace(/_/g, ' '))
        .join(', ')}.`,
  });

  // Group the plan by modality so the patient sees "an operation, then
  // radiotherapy" rather than a list of 12 clinical instructions.
  const byModality = new Map<Modality, string[]>();
  for (const item of plan.items) {
    if (item.modality === 'molecular_pathology' && !ctx.histologyPending) continue;
    const list = byModality.get(item.modality) || [];
    list.push(item.title);
    byModality.set(item.modality, list);
  }

  const planBody = Array.from(byModality.entries())
    .map(([modality, titles]) => `${MODALITY_PLAIN[modality]}:\n  ${titles.join('\n  ')}`)
    .join('\n\n');

  sections.push({
    heading: 'The plan we recommend',
    body:
      planBody +
      '\n\nThese steps happen in a particular order, and each one is planned around the results of the one before. ' +
      'You will not be asked to agree to all of it at once.',
  });

  sections.push({
    heading: 'What we are aiming for',
    body:
      plan.intent === 'curative'
        ? 'The aim of treatment is to cure the cancer — to remove it completely and reduce the chance of it coming back.'
        : plan.intent === 'palliative'
          ? 'The aim of treatment is to control the cancer and manage symptoms rather than to cure it. That does not ' +
            'mean nothing can be done — treatment can often control the disease for a considerable time and keep you ' +
            'feeling well. We will be honest with you at every stage about what treatment can and cannot achieve.'
          : plan.intent === 'diagnostic'
            ? 'The immediate aim is to complete the tests so that we can give you a definite diagnosis and a firm plan. ' +
              'We know waiting is difficult.'
            : 'The aim of treatment will depend on how the cancer responds. Modern treatments can control this type of ' +
              'cancer for a long time in some people, and we will review the goal with you as we see how you respond.',
  });

  sections.push({
    heading: 'What this means day to day',
    body:
      'Most people want to know about work, driving, family and travel. These depend on which parts of the plan you ' +
      'have and how you respond to them, so please ask us specifically — we would rather answer a practical question ' +
      'than have you guess. If you are working, we can provide letters for your employer. If you care for someone ' +
      'else, tell us, because that changes how we schedule treatment.',
  });

  sections.push({
    heading: 'Bringing someone with you',
    body:
      'You are welcome to bring a relative or friend to any appointment, and we encourage it — two people remember ' +
      'more of a conversation than one. If you would prefer that we speak to a particular family member, or that we ' +
      'do NOT discuss things with certain people, tell us and we will record that in your notes.',
  });

  if (family === 'cutaneous_melanoma' || family === 'cutaneous_scc' || family === 'cutaneous_bcc') {
    sections.push({
      heading: 'Protecting your skin from now on',
      body:
        'Having had one skin cancer raises the chance of developing another, so sun protection matters from now on: ' +
        'shade in the middle of the day, covering clothing and a broad-spectrum sunscreen on exposed skin. Check ' +
        'your own skin once a month for any new or changing spot, and get anything that changes looked at rather ' +
        'than waiting for your next appointment. Your close relatives may also benefit from being more careful about ' +
        'sun exposure and from having their own skin checked.',
    });
  }

  if (family === 'soft_tissue_sarcoma') {
    sections.push({
      heading: 'Why you are being referred to a specialist centre',
      body:
        'Sarcomas are uncommon, and the evidence is clear that they are best treated in centres that see a lot of ' +
        'them. This is why we are involving a specialist sarcoma team rather than treating this locally. It may mean ' +
        'travelling, and it may feel like a delay, but getting the first operation right matters more than getting ' +
        'it done quickly.',
    });
  }

  const questionsToAsk = [
    'What is the aim of my treatment — is it to cure the cancer or to control it?',
    'What happens if I decide not to have some part of this treatment?',
    'How long will the whole plan take, from now until the end?',
    'What side effects should I expect, and which ones should worry me?',
    'Who do I contact if something goes wrong out of hours?',
    'Will this treatment affect my ability to work, drive or travel?',
    'Is there a research study I could take part in?',
    'What will follow-up involve, and for how long?',
  ];

  const redFlags = [
    'A fever or feeling shivery and unwell — especially if you are on treatment that affects your immune system. This can be an emergency; contact us immediately, do not wait.',
    'The wound becoming red, hot, swollen, or leaking fluid.',
    'A new lump anywhere, or an existing one getting bigger.',
    'Breathlessness, a persistent cough, or coughing up blood.',
    'Persistent diarrhoea, or a new skin rash, while on immunotherapy — these need urgent review.',
    'New or worsening pain that your usual painkillers do not control.',
    'Any new weakness, numbness, severe headache, or change in vision.',
  ];

  if (metastatic) {
    questionsToAsk.push('What can I expect over the coming months, and how will we know if treatment is working?');
    questionsToAsk.push('Who can support me and my family emotionally through this?');
  }

  return {
    title: `Information for you and your family${ctx.patientName ? ` — ${ctx.patientName}` : ''}`,
    forAudience: 'patient_and_family',
    sections,
    questionsToAsk,
    redFlags,
    disclaimer:
      'This document summarises what your medical team discussed and agreed. It is a starting point for a ' +
      'conversation, not a substitute for one — please ask about anything here that is unclear or that you disagree ' +
      'with. Your plan may change as further results become available, and nothing in this document commits you to ' +
      'any treatment. You can change your mind at any point.',
  };
}
