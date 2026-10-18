/**
 * The medical scribe reads the record, not word fragments: a pressure-ulcer
 * patient is not "sickle cell" because of the "ss" in "pressure", nor diabetic
 * because of the "dm" in "admitted"; negations are negatives; the structured
 * clerking is authoritative; and the draft plan follows the diagnosis.
 */
import { describe, it, expect } from 'vitest';
import { buildClinicalFacts, mentionIn, CONDITION_TERMS, has } from '../services/scribe/clinicalFacts';
import { buildScribePlan, buildFindings } from '../services/scribe/scribePlan';

const comfort = {
  patient: {
    id: 42, first_name: 'Comfort', last_name: 'Anike', date_of_birth: '1962-01-24', gender: 'Female',
    hospital_number: 'PT-556269',
    medical_history: 'ADMITTED from clinic for pressure ulcer assessment. Wound assessed, sloughy.',
  },
  admissions: [{ admitting_diagnosis: 'Gluteal pressure ulcer', ward: 'Ward 10' }],
  clinical: {
    encounters: [{
      id: 1, encounter_type: 'initial', status: 'signed', created_at: '2026-10-18T16:32:00Z',
      data: {
        complaints: [{ label: 'Gluteal ulcer', duration: { value: 2, unit: 'months' } }],
        history: {
          pmh: { stroke: { status: 'Yes' }, diabetes: { status: 'No' }, sickle_cell: { status: 'No' }, hypertension: { status: 'No' } },
          social: { mobility: 'Bed-bound' },
        },
        allergyStatus: 'not_asked', allergies: [], medications: [], vitals: { weight: 92, height: 165 },
      },
      summary: { risk_factors: ['Previous stroke', 'Obesity (BMI ≥ 30) — Wound complications, VTE', 'Bed-bound — pressure injury and VTE risk'], accepted: { differential: [] } },
    }],
    problems: [{ label: 'Pressure ulcer (L89)', status: 'active', created_at: '2026-10-18' }],
    plan_items: [
      { text: 'Complete blood count', kind: 'investigation', priority: 'urgent', status: 'pending' },
      { text: 'Wound debridement', kind: 'treatment', priority: 'urgent', status: 'pending' },
      { text: 'Nutritional support', kind: 'treatment', status: 'pending' },
    ],
  },
  now: new Date('2026-10-18T18:00:00Z'),
};

describe('text matching', () => {
  it('does not find sickle cell in "pressure" / "assessment", nor diabetes in "admitted"', () => {
    const t = 'ADMITTED for pressure ulcer assessment; SS SC';
    expect(mentionIn('ADMITTED for pressure ulcer assessment', CONDITION_TERMS.sickle_cell.patterns)).toBeNull();
    expect(mentionIn(t.toLowerCase(), CONDITION_TERMS.diabetes.patterns)).toBeNull();
    expect(mentionIn('admitted', CONDITION_TERMS.diabetes.patterns)).toBeNull();
    expect(mentionIn('Known DM on metformin', CONDITION_TERMS.diabetes.patterns)).toBe('present');
    expect(mentionIn('genotype SS', CONDITION_TERMS.sickle_cell.patterns)).toBe('present');
    expect(mentionIn('genotype AA', CONDITION_TERMS.sickle_cell.patterns)).toBeNull();
  });
  it('a negated mention is a documented negative', () => {
    expect(mentionIn('No history of diabetes or hypertension', CONDITION_TERMS.diabetes.patterns)).toBe('absent');
    expect(mentionIn('Denies HTN', CONDITION_TERMS.hypertension.patterns)).toBe('absent');
    expect(mentionIn('RVS: HIV -ve', CONDITION_TERMS.hiv.patterns)).toBe('absent');
    expect(mentionIn('pending PE workup', CONDITION_TERMS.thromboembolism.patterns)).toBe('present');
    expect(mentionIn('pending results', CONDITION_TERMS.thromboembolism.patterns)).toBeNull();
  });
});

describe('Comfort Anike — gluteal pressure ulcer', () => {
  const facts = buildClinicalFacts(comfort);
  it('reads the structured clerking', () => {
    expect(facts.complaints[0]).toEqual({ label: 'Gluteal ulcer', duration: '2 months' });
    expect(facts.problems[0]).toMatchObject({ label: 'Pressure ulcer', code: 'L89', source: 'Problem list' });
    expect(has(facts, 'stroke')).toBe(true);
    expect(has(facts, 'immobility')).toBe(true);
    expect(has(facts, 'obesity')).toBe(true);
    expect(facts.conditions.get('diabetes')?.presence).toBe('absent');
    expect(facts.conditions.get('sickle_cell')?.presence).toBe('absent');
    expect(facts.allergies.status).toBe('not_documented');
  });
  it('findings follow the diagnosis — no sickle cell, no diabetes', () => {
    const findings = buildFindings(facts);
    const names = findings.map(f => f.finding).join(' | ');
    expect(names).not.toMatch(/sickle|diabet/i);
    expect(names).toMatch(/Pressure ulcer \(L89\)/);
    expect(names).toMatch(/Previous stroke/);
    expect(names).toMatch(/VTE risk present — no prophylaxis/);
    expect(names).toMatch(/Allergy status not documented/);
    expect(findings.every(f => f.evidence)).toBe(true);
  });
  it('drafts a pressure-injury plan with VTE, nutrition, pressure care and the comorbidities', () => {
    const plan = buildScribePlan(facts);
    const p = plan.problems[0];
    expect(p.problem).toBe('Pressure ulcer');
    expect(p.treatment.map(t => t.text).join(' ')).toMatch(/debridement/i);
    expect(p.investigations.map(t => t.text).join(' ')).toMatch(/osteomyelitis|X-ray/i);
    expect(p.treatment.map(t => t.text).join(' ')).toMatch(/flap/i);
    expect(plan.comorbidities.map(c => c.condition).join(' ')).toMatch(/stroke/i);
    expect(plan.comorbidities.map(c => c.condition).join(' ')).not.toMatch(/diabet|sickle/i);
    const vte = plan.general.find(g => g.heading === 'VTE prophylaxis')!;
    expect(vte.items[0].text).toMatch(/Enoxaparin 40 mg SC once daily \(weight-adjusted\)/);
    expect(vte.items[0].why).toMatch(/immobility.*obesity.*stroke.*age 64/);
    expect(plan.carriedOver.map(c => c.text)).toContain('Wound debridement');
    expect(plan.cautions.join(' ')).toMatch(/Allergy status is not documented/);
    expect(plan.cautions.join(' ')).not.toMatch(/Pregnancy test/); // 64-year-old
  });
});

describe('free text fallback', () => {
  it('a record with only text still finds real conditions, and respects negation', () => {
    const f = buildClinicalFacts({ patient: { medical_history: 'Known hypertensive. No diabetes. Genotype AA.' } });
    expect(has(f, 'hypertension')).toBe(true);
    expect(f.conditions.get('diabetes')?.presence).toBe('absent');
    expect(has(f, 'sickle_cell')).toBe(false);
  });
});

import { filterPlan } from '../components/scribe/ScribeTreatmentPlanPanel';
describe('consultant edits', () => {
  it('unticked lines are left out and instructions are added', () => {
    const plan = buildScribePlan(buildClinicalFacts(comfort));
    const out = filterPlan(plan, new Set(['p0.treatment|0', 'carried|0']), 'Book gluteal rotation flap\n\n');
    expect(out.problems[0].treatment.length).toBe(plan.problems[0].treatment.length - 1);
    expect(out.carriedOver.length).toBe(plan.carriedOver.length - 1);
    const ci = out.general.find(g => g.heading === 'Consultant instructions')!;
    expect(ci.items.map(i => i.text)).toEqual(['Book gluteal rotation flap']);
  });
});
