// @vitest-environment node
/**
 * Food data: the bundled WAFCT 2019 table is complete and traceable, every
 * WAFCT code the Enugu layer references exists, recipe nutrients are summed
 * from table values (never typed in), and the importer's parsing rules hold.
 */
import { describe, it, expect } from 'vitest';
import { WAFCT_2019_FOODS, WAFCT_2019_SOURCE } from '../../api/_lib/data/wafct2019.js';
import { LOCAL_FOODS, INGREDIENT_LABELS, RECIPES, MEASURES, MISSING_FROM_WAFCT } from '../../api/_lib/data/enuguFoods.js';
import { recipeNutrients, nutrientsOf, purchaseWeight } from '../clinical/nutrition/foods';

const byCode = new Map<string, any>(WAFCT_2019_FOODS.map((f: any) => [f.food_code, f]));

describe('WAFCT 2019 bundle', () => {
  it('carries source, licence and citation', () => {
    expect(WAFCT_2019_SOURCE.code).toBe('WAFCT2019');
    expect(WAFCT_2019_SOURCE.licence).toMatch(/non-commercial/);
    expect(WAFCT_2019_SOURCE.citation).toMatch(/Vincent/);
  });
  it('has the full table with energy and protein for every food, unique codes', () => {
    expect(WAFCT_2019_FOODS.length).toBeGreaterThan(1000);
    expect(new Set(WAFCT_2019_FOODS.map((f: any) => f.food_code)).size).toBe(WAFCT_2019_FOODS.length);
    for (const f of WAFCT_2019_FOODS as any[]) {
      expect(f.food_code).toMatch(/^\d\d_\d{3}$/);
      expect(typeof f.per100g.energy_kcal).toBe('number');
      expect(typeof f.per100g.protein_g).toBe('number');
    }
  });
  it('spot values match the FAO sheet (white gari 02_039, dika nut 06_008)', () => {
    expect(byCode.get('02_039').per100g).toMatchObject({ energy_kcal: 351, protein_g: 1.2 });
    expect(byCode.get('06_008').scientific_name).toBe('Irvingia gabonensis');
    expect(byCode.get('06_008').per100g.imputed).toBeDefined();
  });
});

describe('Enugu layer', () => {
  it('every referenced WAFCT code exists', () => {
    const codes = [
      ...LOCAL_FOODS.map((f: any) => f.code), ...Object.keys(INGREDIENT_LABELS),
      ...RECIPES.flatMap((r: any) => r.ingredients.map(([c]: [string]) => c)), ...MEASURES.filter((m: any) => m.food).map((m: any) => m.food),
    ];
    const missing = codes.filter(c => !byCode.has(c));
    expect(missing).toEqual([]);
  });
  it('recipes are drafts with unique names, and measures point at real recipes', () => {
    expect(new Set(RECIPES.map((r: any) => r.name)).size).toBe(RECIPES.length);
    for (const r of RECIPES as any[]) expect(r.notes).toMatch(/Draft — dietitian to verify/);
    for (const m of MEASURES.filter((x: any) => x.recipe) as any[]) expect(RECIPES.some((r: any) => r.name === m.recipe)).toBe(true);
  });
  it('local foods with no WAFCT entry are listed, and ugu is not substituted with Cucurbita leaves', () => {
    expect(MISSING_FROM_WAFCT.some((m: string) => /ugu/.test(m))).toBe(true);
    const pumpkinCodes = ['04_053', '04_054', '04_055', '04_116'];
    expect(RECIPES.some((r: any) => r.ingredients.some(([c]: [string]) => pumpkinCodes.includes(c)))).toBe(false);
  });
});

describe('recipe arithmetic', () => {
  const recipe = (name: string) => {
    const r: any = RECIPES.find((x: any) => x.name === name);
    return { portion_g: r.portion_g, ingredients: r.ingredients.map(([c, g]: [string, number]) => ({ food_id: 0, raw_g: g, per100g: byCode.get(c).per100g, food_name: byCode.get(c).name })) };
  };
  it('eba = 100 g white gari', () => {
    expect(recipeNutrients(recipe('Eba')).perPortion.energy_kcal).toBeCloseTo(351, 5);
  });
  it('sums every ingredient', () => {
    const r = recipe('Moi moi');
    const expected = r.ingredients.reduce((s: number, i: any) => s + (i.per100g.protein_g * i.raw_g) / 100, 0);
    expect(recipeNutrients(r).perPortion.protein_g).toBeCloseTo(expected, 6);
  });
  it('nutrientsOf scales per 100 g; purchase weight undoes the edible portion', () => {
    expect(nutrientsOf({ energy_kcal: 200, protein_g: 10 }, 50)).toEqual({ energy_kcal: 100, protein_g: 5 });
    expect(purchaseWeight(87, 0.87)).toBeCloseTo(100);
    expect(purchaseWeight(87, 1)).toBe(87);
  });
});
