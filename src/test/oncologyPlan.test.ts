// @vitest-environment node
import { describe, it, expect } from 'vitest';
import { computeStage, type StagingInput } from '../services/oncology/stagingEngine';
import { buildManagementPlan, melanomaExcisionMargin, type PlanContext } from '../services/oncology/managementPlan';
import { buildSurveillancePlan } from '../services/oncology/surveillance';
import { generateAllReferralLetters } from '../services/oncology/referralLetters';
import { buildCounsellingDocument } from '../services/oncology/counselling';

const planFor = (input: StagingInput, over: Partial<PlanContext> = {}) => {
  const stage = computeStage(input);
  return buildManagementPlan({
    family: input.family,
    stage,
    breslowMm: input.breslowMm,
    sizeCm: input.sizeCm,
    grade: input.grade,
    sarcomaSite: input.sarcomaSite,
    histologyAvailable: input.histologyAvailable,
    ...over,
  });
};

const titles = (plan: { items: { title: string }[] }) => plan.items.map(i => i.title).join(' | ');

describe('melanoma excision margins', () => {
  it('follows the NCCN thickness bands', () => {
    expect(melanomaExcisionMargin(null, true)).toBe('0.5-1.0 cm');
    expect(melanomaExcisionMargin(0.6, false)).toBe('1 cm');
    expect(melanomaExcisionMargin(1.0, false)).toBe('1 cm');
    expect(melanomaExcisionMargin(1.8, false)).toBe('1-2 cm');
    expect(melanomaExcisionMargin(5.0, false)).toBe('2 cm');
  });

  it('does not invent a margin when thickness is unknown', () => {
    expect(melanomaExcisionMargin(null, false)).toMatch(/determined by Breslow/);
  });
});

describe('melanoma management plan', () => {
  it('does not push SLNB for thin non-ulcerated melanoma', () => {
    const plan = planFor({ family: 'cutaneous_melanoma', basis: 'pathological', breslowMm: 0.5 });
    expect(titles(plan)).toMatch(/not routinely indicated/);
  });

  it('offers SLNB from T1b upward', () => {
    const plan = planFor({ family: 'cutaneous_melanoma', basis: 'pathological', breslowMm: 0.9 });
    expect(titles(plan)).toMatch(/offer sentinel lymph node biopsy/i);
    expect(titles(plan)).toMatch(/lymphoscintigraphy/i);
  });

  it('recommends neoadjuvant immunotherapy BEFORE dissection for macroscopic stage III', () => {
    // The NADINA reversal — surgery-first would be the wrong answer here.
    const plan = planFor({
      family: 'cutaneous_melanoma', basis: 'pathological',
      breslowMm: 3, nodesInvolved: 2, nodesClinicallyDetected: true,
    });
    const neo = plan.items.find(i => /neoadjuvant ipilimumab/i.test(i.title));
    // Anchored: the neoadjuvant item's own title ends "...BEFORE lymph node
    // dissection", so a loose /lymph node dissection/ matcher finds itself.
    const dissection = plan.items.find(i => /^Therapeutic lymph node dissection/i.test(i.title));
    expect(neo).toBeDefined();
    expect(dissection).toBeDefined();
    expect(neo!.sequence).toBeLessThan(dissection!.sequence);
    expect(neo!.basis).toMatch(/NADINA/);
  });

  it('prefers nodal ultrasound over completion dissection for occult nodal disease', () => {
    const plan = planFor({
      family: 'cutaneous_melanoma', basis: 'pathological', breslowMm: 3, nodesInvolved: 1,
    });
    expect(titles(plan)).toMatch(/ultrasound surveillance rather than completion/i);
    expect(titles(plan)).not.toMatch(/neoadjuvant/i);
  });

  it('recommends adjuvant anti-PD-1 for resected stage IIB/IIC even when node-negative', () => {
    const plan = planFor({
      family: 'cutaneous_melanoma', basis: 'pathological', breslowMm: 3.5, ulceration: true,
    });
    expect(titles(plan)).toMatch(/adjuvant anti-PD-1/i);
  });

  it('adds stereotactic radiosurgery only for CNS metastases', () => {
    const cns = planFor({
      family: 'cutaneous_melanoma', basis: 'clinical', breslowMm: 3,
      distantMets: true, metSites: ['cns'],
    });
    expect(titles(cns)).toMatch(/stereotactic radiosurgery/i);

    const lung = planFor({
      family: 'cutaneous_melanoma', basis: 'clinical', breslowMm: 3,
      distantMets: true, metSites: ['lung'],
    });
    expect(titles(lung)).not.toMatch(/stereotactic radiosurgery/i);
  });

  it('does not call metastatic melanoma palliative, because it may not be', () => {
    const plan = planFor({
      family: 'cutaneous_melanoma', basis: 'clinical', breslowMm: 3,
      distantMets: true, metSites: ['lung'],
    });
    expect(plan.intent).toBe('undetermined');
  });
});

describe('keratinocyte carcinoma plan', () => {
  it('escalates to Mohs when high-risk features are present', () => {
    const plan = planFor({ family: 'cutaneous_scc', basis: 'pathological', sizeCm: 1 }, { perineuralInvasion: true });
    expect(titles(plan)).toMatch(/Mohs/i);
  });

  it('uses standard excision for a low-risk lesion', () => {
    const plan = planFor({ family: 'cutaneous_scc', basis: 'pathological', sizeCm: 1 });
    expect(titles(plan)).toMatch(/Standard surgical excision/i);
  });

  it('recommends adjuvant radiotherapy for perineural invasion', () => {
    const plan = planFor({ family: 'cutaneous_scc', basis: 'pathological', sizeCm: 1, perineuralInvasion: true }, { perineuralInvasion: true });
    expect(titles(plan)).toMatch(/Adjuvant radiotherapy/i);
  });

  it('warns about graft rejection when starting immunotherapy in the immunosuppressed', () => {
    const plan = planFor(
      { family: 'cutaneous_scc', basis: 'clinical', sizeCm: 3, distantMets: true },
      { immunosuppressed: true }
    );
    const io = plan.items.find(i => /cemiplimab/i.test(i.title));
    expect(io?.detail).toMatch(/graft rejection/i);
  });

  it('routes BCC to hedgehog inhibitors rather than anti-PD-1 first line', () => {
    const plan = planFor({ family: 'cutaneous_bcc', basis: 'clinical', sizeCm: 3, distantMets: true });
    expect(titles(plan)).toMatch(/Hedgehog/i);
  });
});

describe('Merkel cell plan', () => {
  it('requires baseline imaging and SLNB when node-negative', () => {
    const plan = planFor({ family: 'merkel_cell', basis: 'clinical', sizeCm: 2 });
    expect(titles(plan)).toMatch(/Baseline whole-body imaging/i);
    expect(titles(plan)).toMatch(/Sentinel lymph node biopsy/i);
    expect(titles(plan)).toMatch(/Adjuvant radiotherapy/i);
  });
});

describe('soft tissue sarcoma plan', () => {
  it('puts referral-before-biopsy first, ahead of everything else', () => {
    const plan = planFor({ family: 'soft_tissue_sarcoma', basis: 'clinical', sizeCm: 9, grade: 'G3' });
    expect(plan.items[0].title).toMatch(/BEFORE any biopsy/i);
    expect(plan.items[0].strength).toBe('required');
    expect(plan.items[0].detail).toMatch(/whoops/i);
  });

  it('recommends radiotherapy only for large high-grade tumours', () => {
    const big = planFor({ family: 'soft_tissue_sarcoma', basis: 'pathological', sizeCm: 9, grade: 'G3' });
    expect(titles(big)).toMatch(/Radiotherapy/i);

    const small = planFor({ family: 'soft_tissue_sarcoma', basis: 'pathological', sizeCm: 3, grade: 'G1' });
    expect(titles(small)).not.toMatch(/Radiotherapy/i);
  });

  it('notes the STRASS caveat for retroperitoneal disease', () => {
    const plan = planFor({
      family: 'soft_tissue_sarcoma', basis: 'pathological',
      sizeCm: 12, grade: 'G3', sarcomaSite: 'retroperitoneal',
    });
    const rt = plan.items.find(i => /Radiotherapy/i.test(i.title));
    expect(rt?.detail).toMatch(/STRASS/);
  });
});

describe('cross-cutting plan behaviour', () => {
  it('blocks committing to treatment while histology is pending', () => {
    const plan = planFor({
      family: 'cutaneous_melanoma', basis: 'clinical', breslowMm: 2, histologyAvailable: false,
    });
    const gate = plan.items.find(i => /definitive histology/i.test(i.title));
    expect(gate?.strength).toBe('required');
  });

  it('always carries a ratification caveat', () => {
    const plan = planFor({ family: 'cutaneous_melanoma', basis: 'pathological', breslowMm: 1 });
    expect(plan.caveats.join(' ')).toMatch(/ratified by the multidisciplinary tumour board/i);
  });

  it('adds early palliative care alongside active treatment when metastatic', () => {
    const plan = planFor({
      family: 'soft_tissue_sarcoma', basis: 'clinical', sizeCm: 8, grade: 'G3', distantMets: true,
    });
    const pc = plan.items.find(i => /palliative care referral/i.test(i.title));
    expect(pc?.detail).toMatch(/not a substitute for anticancer therapy/i);
  });

  it('derives the specialty list from the plan items', () => {
    const plan = planFor({ family: 'cutaneous_melanoma', basis: 'pathological', breslowMm: 3, nodesInvolved: 1 });
    const owners = new Set(plan.items.map(i => i.owner));
    expect(new Set(plan.specialtiesInvolved)).toEqual(owners);
  });
});

describe('referral letters', () => {
  const build = () => {
    const stage = computeStage({ family: 'cutaneous_melanoma', basis: 'pathological', breslowMm: 3, nodesInvolved: 1 });
    const plan = buildManagementPlan({ family: 'cutaneous_melanoma', stage, breslowMm: 3 });
    return generateAllReferralLetters({
      patient: { name: 'A Patient', hospitalNumber: 'H123' },
      stage, plan, diagnosis: 'Cutaneous melanoma',
    });
  };

  it('writes one letter per involved specialty', () => {
    const letters = build();
    expect(letters.length).toBeGreaterThan(2);
    expect(new Set(letters.map(l => l.specialty)).size).toBe(letters.length);
  });

  it('includes stage, the specific ask and the full plan for context', () => {
    const letter = build().find(l => l.specialty === 'medical_oncology')!;
    expect(letter.body).toMatch(/pT3a/);
    expect(letter.body).toMatch(/SPECIFICALLY REQUESTED OF MEDICAL ONCOLOGY/);
    expect(letter.body).toMatch(/FULL AGREED PLAN/);
    expect(letter.body).toMatch(/H123/);
  });

  it('flags treatment-path referrals on the cancer pathway', () => {
    const letters = build();
    const onco = letters.find(l => l.specialty === 'medical_oncology')!;
    expect(['urgent', 'two_week']).toContain(onco.urgency);
  });
});

describe('surveillance schedule', () => {
  it('front-loads follow-up for high-risk melanoma', () => {
    const stage = computeStage({ family: 'cutaneous_melanoma', basis: 'pathological', breslowMm: 5, ulceration: true });
    const plan = buildSurveillancePlan({ family: 'cutaneous_melanoma', stage, indexDate: '2026-01-01' });
    const firstYear = plan.items.filter(i => i.dueMonth <= 12 && i.category === 'clinical_review');
    expect(firstYear.length).toBeGreaterThanOrEqual(4);
    expect(plan.items.every(i => /^\d{4}-\d{2}-\d{2}$/.test(i.dueDate))).toBe(true);
  });

  it('keeps early-stage melanoma out of imaging surveillance', () => {
    const stage = computeStage({ family: 'cutaneous_melanoma', basis: 'pathological', breslowMm: 0.6 });
    const plan = buildSurveillancePlan({ family: 'cutaneous_melanoma', stage });
    expect(plan.items.some(i => i.category === 'cross_sectional_imaging')).toBe(false);
    expect(plan.narrative).toMatch(/Routine imaging is not indicated/i);
  });

  it('prioritises chest imaging for sarcoma and extends to 10 years', () => {
    const stage = computeStage({ family: 'soft_tissue_sarcoma', basis: 'pathological', sizeCm: 9, grade: 'G3' });
    const plan = buildSurveillancePlan({ family: 'soft_tissue_sarcoma', stage, grade: 'G3' });
    expect(plan.items.some(i => i.category === 'chest_imaging')).toBe(true);
    expect(plan.durationYears).toBe(10);
  });

  it('adds toxicity review when systemic therapy is likely', () => {
    const stage = computeStage({ family: 'cutaneous_melanoma', basis: 'pathological', breslowMm: 5, ulceration: true });
    const plan = buildSurveillancePlan({ family: 'cutaneous_melanoma', stage });
    expect(plan.items.some(i => i.category === 'toxicity_review')).toBe(true);
  });

  it('returns items in chronological order', () => {
    const stage = computeStage({ family: 'merkel_cell', basis: 'pathological', sizeCm: 3 });
    const plan = buildSurveillancePlan({ family: 'merkel_cell', stage });
    const months = plan.items.map(i => i.dueMonth);
    expect([...months].sort((a, b) => a - b)).toEqual(months);
  });
});

describe('patient counselling document', () => {
  const doc = (input: StagingInput) => {
    const stage = computeStage(input);
    const plan = buildManagementPlan({ family: input.family, stage, breslowMm: input.breslowMm, sizeCm: input.sizeCm, grade: input.grade });
    return buildCounsellingDocument({ family: input.family, stage, plan });
  };

  it('avoids TNM notation in patient-facing text', () => {
    const d = doc({ family: 'cutaneous_melanoma', basis: 'pathological', breslowMm: 3, nodesInvolved: 1 });
    const allText = d.sections.map(s => s.body).join(' ');
    expect(allText).not.toMatch(/\bpT\d|\bcN\d|\bM1[abcd]\b/);
  });

  it('explains nodal spread in plain language', () => {
    const d = doc({ family: 'cutaneous_melanoma', basis: 'pathological', breslowMm: 3, nodesInvolved: 1 });
    const spread = d.sections.find(s => /spread/i.test(s.heading))!;
    expect(spread.body).toMatch(/lymph glands/i);
    expect(spread.body).toMatch(/drainage system/i);
  });

  it('offers realistic hope for metastatic melanoma rather than bare palliation', () => {
    const d = doc({ family: 'cutaneous_melanoma', basis: 'clinical', breslowMm: 3, distantMets: true, metSites: ['lung'] });
    const spread = d.sections.find(s => /spread/i.test(s.heading))!;
    expect(spread.body).toMatch(/control this type of cancer for a long time/i);
  });

  it('always includes red flags and a disclaimer', () => {
    const d = doc({ family: 'cutaneous_bcc', basis: 'clinical', sizeCm: 1 });
    expect(d.redFlags.length).toBeGreaterThan(3);
    expect(d.disclaimer).toMatch(/not a substitute/i);
    expect(d.questionsToAsk.length).toBeGreaterThan(4);
  });

  it('explains the sarcoma centre referral so it does not read as a delay', () => {
    const d = doc({ family: 'soft_tissue_sarcoma', basis: 'clinical', sizeCm: 9, grade: 'G3' });
    const section = d.sections.find(s => /specialist centre/i.test(s.heading))!;
    expect(section.body).toMatch(/getting the first operation right/i);
  });

  it('adds sun-protection advice for skin cancers only', () => {
    const skin = doc({ family: 'cutaneous_scc', basis: 'pathological', sizeCm: 1 });
    expect(skin.sections.some(s => /Protecting your skin/i.test(s.heading))).toBe(true);

    const sarcoma = doc({ family: 'soft_tissue_sarcoma', basis: 'pathological', sizeCm: 6, grade: 'G2' });
    expect(sarcoma.sections.some(s => /Protecting your skin/i.test(s.heading))).toBe(false);
  });
});
