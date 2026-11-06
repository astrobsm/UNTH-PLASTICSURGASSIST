/**
 * Test / demo catalogue: the Enugu seed applied to the bundled WAFCT 2019
 * table exactly as api/_lib/nutrition.js seedEnugu does in the database.
 */
import { WAFCT_2019_FOODS } from '../../api/_lib/data/wafct2019.js';
import { LOCAL_FOODS, RECIPES, MEASURES, INGREDIENT_LABELS } from '../../api/_lib/data/enuguFoods.js';
import type { Food, Recipe } from '../clinical/nutrition/foods';
import type { Catalog } from '../clinical/nutrition/planner';

export function seedCatalog(): Catalog {
  const all = new Map<string, any>((WAFCT_2019_FOODS as any[]).map((f, i) => [f.food_code, { ...f, id: i + 1 }]));
  const foods: Food[] = (LOCAL_FOODS as any[]).map(l => {
    const f = all.get(l.code);
    return {
      id: f.id, source_code: 'WAFCT2019', food_code: f.food_code, name: f.name, food_group: f.food_group, per100g: f.per100g,
      edible_portion: f.edible_portion, yield_factor: f.yield_factor, state: f.state,
      local_names: { en: l.en, ...(l.ig ? { ig: l.ig } : {}) }, min_portion_g: l.min_g, max_portion_g: l.max_g, unit_g: l.unit_g ?? null, unit_label: l.unit_label ?? null,
      cost_tier: l.cost, seasonality: l.season ?? null, availability: l.avail, tags: ['local', l.role, ...(l.energy_dense ? ['energy_dense'] : [])],
    };
  });
  const recipes: Recipe[] = (RECIPES as any[]).map((r, k) => ({
    id: k + 1, name: r.name, local_name: r.local_name, category: r.category, meal_slots: r.slots, portion_g: r.portion_g, texture: r.texture ?? null,
    tags: r.tags, status: 'draft', notes: r.notes,
    ingredients: r.ingredients.map(([code, g]: [string, number]) => {
      const f = all.get(code);
      return { food_id: f.id, raw_g: g, food_name: (INGREDIENT_LABELS as any)[code]?.en || f.name, per100g: f.per100g, edible_portion: f.edible_portion, food_code: code };
    }),
  }));
  const measures = (MEASURES as any[]).map(m => ({
    recipe_id: m.recipe ? recipes.find(r => r.name === m.recipe)!.id : null,
    food_id: m.food ? all.get(m.food).id : null, measure: m.measure, grams: m.grams, verified: false,
  }));
  return { foods, recipes, measures };
}
