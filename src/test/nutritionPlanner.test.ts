// @vitest-environment node
/**
 * Meal-plan solver: worked scenarios plus property tests. For every plan the
 * solver calls feasible: daily energy within ±5%, protein ≥ 100%, restrictions
 * never violated, variety rules held.
 */
import { describe, it, expect } from 'vitest';
import { generateMealPlan, type MealPlan, type PlannerOptions } from '../clinical/nutrition/planner';
import { NUTRITION_CONFIG as cfg } from '../clinical/nutrition';
import { seedCatalog } from './nutritionCatalog';

const cat = seedCatalog();
const recipeById = new Map(cat.recipes.map(r => [r.id, r]));

function checkPlan(p: MealPlan, o: PlannerOptions) {
  for (const d of p.days.filter(x => x.feasible)) {
    const e = d.totals.energy_kcal ?? 0;
    expect(e, `day ${d.day} energy`).toBeGreaterThanOrEqual(d.targetKcal * 0.95 - 1);
    expect(e, `day ${d.day} energy`).toBeLessThanOrEqual(d.targetKcal * 1.05 + 1);
    expect(d.totals.protein_g ?? 0, `day ${d.day} protein`).toBeGreaterThanOrEqual(d.targetProteinG - 0.5);
    if (o.targets.carbMaxG) expect(d.totals.carb_g ?? 0).toBeLessThanOrEqual(o.targets.carbMaxG * Math.min(1, d.targetKcal / o.targets.kcal) + 1);
    for (const i of d.items) {
      expect(i.servedG % 5 === 0 || !!i.units || i.kind === 'ons', `${i.name} rounded`).toBe(true);
      if (i.units) expect(Number.isInteger(i.units.n)).toBe(true);
    }
    expect(d.withinTolerance, `day ${d.day}: ${d.violations.join('; ')}`).toBe(true);
  }
}

describe('meal planner — scenarios', () => {
  it('maintenance plan: every day within tolerance, vegetables and fruit daily, variety rules', () => {
    const o: PlannerOptions = { targets: { kcal: 2000, proteinG: 75 }, seed: 'p1' };
    const p = generateMealPlan(cat, o);
    expect(p.days).toHaveLength(7);
    checkPlan(p, o);
    expect(p.weekly.daysWithinTolerance).toBe(7);
    const mains = new Map<string, number>();
    for (const d of p.days) {
      const recipes = d.items.filter(i => i.kind === 'recipe').map(i => recipeById.get(i.refId!)!);
      expect(recipes.some(r => r.tags?.includes('vegetable')), `day ${d.day} vegetables`).toBe(true);
      expect(d.items.some(i => i.kind === 'food' && cat.foods.find(f => f.id === i.refId)?.tags?.includes('fruit')), `day ${d.day} fruit`).toBe(true);
      for (const r of recipes.filter(x => x.category === 'soup' || (x.category === 'main' && x.meal_slots?.includes('dinner')))) mains.set(r.name, (mains.get(r.name) ?? 0) + 1);
    }
    for (const [n, c] of mains) expect(c, n).toBeLessThanOrEqual(cfg.maxDishPerWeek.value);
    const proteins = new Set(p.days.flatMap(d => d.items.filter(i => i.units && cat.foods.find(f => f.id === i.refId)?.tags?.includes('protein')).map(i => i.refId)));
    expect(proteins.size).toBeGreaterThan(3);
    // Raw weights for buying and cooked weights for serving are both given.
    const eba = p.days.flatMap(d => d.items).find(i => i.name === 'Eba');
    if (eba) { expect(eba.rawG).toBeLessThan(eba.servedG); expect(eba.ingredients?.[0].rawG).toBeGreaterThan(0); expect(eba.measure?.verified).toBe(false); }
  });

  it('diabetic weight-loss plan respects the carbohydrate cap', () => {
    const o: PlannerOptions = { targets: { kcal: 1530, proteinG: 88, carbMaxG: 172 }, goal: 'lose', baseKcal: 2080, startWeightKg: 98, seed: 'p2' };
    const p = generateMealPlan(cat, o);
    checkPlan(p, o);
    expect(p.days.filter(d => d.feasible).length).toBeGreaterThan(4);
    expect(p.trajectory[0].kg).toBe(98);
    expect(p.trajectory[8].kg).toBeLessThan(98);
  });

  it('weight gain adds energy-dense foods and projects a gain', () => {
    const o: PlannerOptions = { targets: { kcal: 2400, proteinG: 70 }, goal: 'gain', baseKcal: 2100, startWeightKg: 45, seed: 'p3' };
    const p = generateMealPlan(cat, o);
    checkPlan(p, o);
    expect(p.days.every(d => d.items.some(i => i.slot === 'afternoon'))).toBe(true);
    expect(p.trajectory[8].kg).toBeGreaterThan(45);
  });

  it('refeeding: each day follows the stepped energy schedule', () => {
    const schedule = [380, 640, 901, 1161, 1421, 1421, 1421];
    const o: PlannerOptions = { targets: { kcal: 1421, proteinG: 46 }, dailyKcal: schedule, seed: 'p4', goal: 'gain' };
    const p = generateMealPlan(cat, o);
    p.days.forEach((d, i) => expect(d.targetKcal).toBe(schedule[i]));
    expect(p.days[0].targetProteinG).toBeLessThan(p.days[6].targetProteinG);
    checkPlan(p, o);
  });

  it('groundnut allergy removes every groundnut item', () => {
    const o: PlannerOptions = { targets: { kcal: 2200, proteinG: 80 }, goal: 'gain', allergies: ['groundnut'], seed: 'p5' };
    const p = generateMealPlan(cat, o);
    for (const i of p.days.flatMap(d => d.items)) {
      expect(i.name.toLowerCase()).not.toMatch(/groundnut/);
      for (const g of i.ingredients || []) expect(g.name.toLowerCase()).not.toMatch(/groundnut/);
    }
    checkPlan(p, o);
  });

  it('vegetarian excludes meat, fish and egg', () => {
    const o: PlannerOptions = { targets: { kcal: 1800, proteinG: 55 }, religious: ['vegetarian'], seed: 'p6' };
    const p = generateMealPlan(cat, o);
    for (const i of p.days.flatMap(d => d.items)) expect(`${i.name} ${(i.ingredients || []).map(x => x.name).join(' ')}`.toLowerCase()).not.toMatch(/fish|beef|goat|chicken|crayfish|egg/);
  });

  it('an impossible protein target is explained, and an ONS makes it feasible', () => {
    const base: PlannerOptions = { targets: { kcal: 2200, proteinG: 150 }, seed: 'p7' };
    const p = generateMealPlan(cat, base);
    expect(p.days.some(d => !d.feasible)).toBe(true);
    expect(p.suggestions.join(' ')).toMatch(/supplement/i);
    const infeasible = p.days.find(d => !d.feasible)!;
    expect(infeasible.withinTolerance).toBe(false);
    expect(infeasible.violations.join(' ')).toMatch(/Protein/);
    const withOns = generateMealPlan(cat, { ...base, ons: { name: 'ONS (clinician-entered)', kcal: 300, proteinG: 20, maxServings: 3 } });
    expect(withOns.days.filter(d => d.feasible).length).toBeGreaterThan(p.days.filter(d => d.feasible).length);
    expect(withOns.days.some(d => d.items.some(i => i.kind === 'ons'))).toBe(true);
    checkPlan(withOns, base);
  });
});

describe('meal planner — properties', () => {
  // Deterministic PRNG so failures reproduce.
  let s = 42;
  const rand = () => { s = (s * 1103515245 + 12345) % 2 ** 31; return s / 2 ** 31; };
  it('feasible days always meet energy ±5%, protein ≥ target and the carb cap; allergens never appear', () => {
    let feasibleDays = 0;
    for (let n = 0; n < 12; n++) {
      const kcal = Math.round(1400 + rand() * 1400);
      const proteinG = Math.round(kcal * (0.03 + rand() * 0.02));
      const diabetic = rand() < 0.4;
      const allergy = rand() < 0.3 ? ['egg'] : [];
      const o: PlannerOptions = {
        targets: { kcal, proteinG, carbMaxG: diabetic ? Math.round((kcal * 0.45) / 4) : null },
        goal: (['maintain', 'gain', 'lose'] as const)[Math.floor(rand() * 3)], allergies: allergy, seed: `prop${n}`, days: 3,
      };
      const p = generateMealPlan(cat, o);
      checkPlan(p, o);
      feasibleDays += p.days.filter(d => d.feasible).length;
      if (allergy.length) for (const i of p.days.flatMap(d => d.items)) expect(`${i.name} ${(i.ingredients || []).map(x => x.name).join(' ')}`.toLowerCase()).not.toMatch(/egg/);
    }
    expect(feasibleDays).toBeGreaterThan(24);
  });
});
