/**
 * Reports and the validation checklist: all three PDFs build from a real
 * assessment and solved plan; the checklist lists every coefficient with its
 * source; the discharge rendering marks unapproved plans as drafts.
 */
import { describe, it, expect } from 'vitest';
import { assessNutrition, coefficientChecklist, generateMealPlan, plannerOptionsFrom, toDischargeMealPlan, NUTRITION_CONFIG } from '../clinical/nutrition';
import { buildClinicianSummaryPdf, buildDietitianReportPdf, buildPatientPlanPdf, shoppingList } from '../clinical/nutrition/pdf';
import { seedCatalog } from './nutritionCatalog';

const a = assessNutrition({ ageYears: 50, sex: 'female', heightCm: 165, weightKg: 98, diabetes: true, mobility: 'ambulatory', goal: 'lose', targetRateKgWk: 0.5, dietary: { allergies: ['groundnut'] } });
const plan = generateMealPlan(seedCatalog(), plannerOptionsFrom(a, 'r1')!);
const meta = { patientName: 'Test Patient', hospitalNumber: 'PT-1', author: 'Dt Test', status: 'approved', approvedBy: 'Dt Test' };

describe('nutrition reports', () => {
  it('builds the clinician summary, dietitian report and patient plan', () => {
    expect(buildClinicianSummaryPdf(a, meta, { plan }).getNumberOfPages()).toBeGreaterThanOrEqual(1);
    expect(buildDietitianReportPdf(a, meta, { plan, measurements: [{ kind: 'weight', value: 98, unit: 'kg', measured_at: '2026-11-01', method: 'measured' }] }).getNumberOfPages()).toBeGreaterThanOrEqual(1);
    expect(buildPatientPlanPdf(plan, meta, { igbo: true, fluidMl: a.targets.fluidMl, restrictions: a.targets.restrictions }).getNumberOfPages()).toBeGreaterThan(1);
  });
  it('the shopping list sums raw weights across the week', () => {
    const list = shoppingList(plan);
    expect(list.length).toBeGreaterThan(5);
    expect(list.every(x => x.rawG > 0)).toBe(true);
    expect(list.some(x => /groundnut/i.test(x.name))).toBe(false);
  });
  it('discharge rendering carries targets, allergy and the draft label', () => {
    const d = toDischargeMealPlan(plan, a, { approved: false });
    expect(d.day1.lunch).not.toBe('—');
    expect(d.foods_to_avoid[0]).toMatch(/groundnut/);
    expect(d.special_considerations.join(' ')).toMatch(/DRAFT/);
    expect(d.special_considerations.join(' ')).toMatch(/kcal/);
    expect(toDischargeMealPlan(plan, a, { approved: true, approvedBy: 'Dt A' }).special_considerations.join(' ')).toMatch(/approved by Dt A/);
  });
});

describe('validation checklist', () => {
  it('lists every coefficient with a source, generated from the active config', () => {
    const rows = coefficientChecklist();
    expect(rows.length).toBeGreaterThan(50);
    expect(rows.every(r => r.source.length > 3)).toBe(true);
    expect(rows.some(r => r.key.startsWith('kneeHeight') && /Chumlea/.test(r.source))).toBe(true);
    expect(rows.some(r => r.key === 'prealbuminFallPct' && r.value === '20')).toBe(true);
    expect(NUTRITION_CONFIG.status).toBe('pending_clinical_validation');
  });
});
