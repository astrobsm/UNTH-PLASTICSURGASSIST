/**
 * Food composition arithmetic. Nutrients are always computed from the stored
 * per-100 g values of the source table — never typed in — so a dish's totals
 * change only when its ingredients or the table change.
 */

export const NUTRIENTS = [
  { key: 'energy_kcal', label: 'Energy', unit: 'kcal' },
  { key: 'protein_g', label: 'Protein', unit: 'g' },
  { key: 'fat_g', label: 'Fat', unit: 'g' },
  { key: 'carb_g', label: 'Carbohydrate', unit: 'g' },
  { key: 'fibre_g', label: 'Fibre', unit: 'g' },
  { key: 'water_g', label: 'Water', unit: 'g' },
  { key: 'na_mg', label: 'Sodium', unit: 'mg' },
  { key: 'k_mg', label: 'Potassium', unit: 'mg' },
  { key: 'ca_mg', label: 'Calcium', unit: 'mg' },
  { key: 'fe_mg', label: 'Iron', unit: 'mg' },
  { key: 'zn_mg', label: 'Zinc', unit: 'mg' },
  { key: 'p_mg', label: 'Phosphorus', unit: 'mg' },
  { key: 'mg_mg', label: 'Magnesium', unit: 'mg' },
  { key: 'vit_a_ug', label: 'Vitamin A (RAE)', unit: 'µg' },
  { key: 'vit_c_mg', label: 'Vitamin C', unit: 'mg' },
  { key: 'folate_ug', label: 'Folate (DFE)', unit: 'µg' },
] as const;
export type NutrientKey = (typeof NUTRIENTS)[number]['key'];
export type Nutrients = Partial<Record<NutrientKey, number>>;

export interface Food {
  id: number;
  source_code: string;
  food_code: string;
  name: string;
  local_names?: { en?: string; ig?: string; sci?: string };
  food_group?: string | null;
  per100g: Nutrients & { imputed?: string[] };
  edible_portion?: number | null;
  yield_factor?: number | null;
  state?: string | null;
  min_portion_g?: number | null;
  max_portion_g?: number | null;
  unit_g?: number | null;
  unit_label?: string | null;
  cost_tier?: 'low' | 'medium' | 'high' | null;
  seasonality?: string | null;
  availability?: { hospital?: boolean; home?: boolean };
  tags?: string[];
}

export interface RecipeIngredient { food_id: number; raw_g: number; food_name?: string; per100g?: Food['per100g']; edible_portion?: number | null; source_code?: string; food_code?: string }
export interface Recipe {
  id: number;
  name: string;
  local_name?: string | null;
  category?: string | null;
  meal_slots?: string[];
  portion_g?: number | null;
  texture?: string | null;
  tags?: string[];
  status: 'draft' | 'verified';
  notes?: string | null;
  verified_by_name?: string | null;
  ingredients: RecipeIngredient[];
}

const round = (x: number, d = 1) => Math.round(x * 10 ** d) / 10 ** d;

/** Nutrients in `grams` of edible portion of a food. */
export function nutrientsOf(per100g: Food['per100g'] | undefined, grams: number): Nutrients {
  const out: Nutrients = {};
  if (!per100g) return out;
  for (const { key } of NUTRIENTS) {
    const v = per100g[key];
    if (typeof v === 'number') out[key] = (v * grams) / 100;
  }
  return out;
}

export function addNutrients(...xs: Nutrients[]): Nutrients {
  const out: Nutrients = {};
  for (const x of xs) for (const [k, v] of Object.entries(x)) out[k as NutrientKey] = (out[k as NutrientKey] ?? 0) + (v as number);
  return out;
}

export const scaleNutrients = (n: Nutrients, f: number): Nutrients =>
  Object.fromEntries(Object.entries(n).map(([k, v]) => [k, (v as number) * f])) as Nutrients;

export const roundNutrients = (n: Nutrients): Nutrients =>
  Object.fromEntries(Object.entries(n).map(([k, v]) => [k, round(v as number, k === 'energy_kcal' || k.endsWith('_mg') || k.endsWith('_ug') ? 0 : 1)])) as Nutrients;

/** Raw (as-purchased) weight of an edible-portion weight — what to buy. */
export const purchaseWeight = (edibleG: number, ediblePortion?: number | null) =>
  ediblePortion && ediblePortion > 0 && ediblePortion < 1 ? edibleG / ediblePortion : edibleG;

/** One portion of a recipe: summed ingredient nutrients and which values were imputed by the table. */
export function recipeNutrients(r: Pick<Recipe, 'ingredients' | 'portion_g'>) {
  const parts = r.ingredients.map(i => nutrientsOf(i.per100g, Number(i.raw_g)));
  const total = addNutrients(...parts);
  const imputed = [...new Set(r.ingredients.flatMap(i => (i.per100g?.imputed || []).filter(k => (i.per100g as any)?.[k] > 0)))];
  const rawWeight = r.ingredients.reduce((s, i) => s + Number(i.raw_g), 0);
  const per100Served = r.portion_g ? scaleNutrients(total, 100 / r.portion_g) : null;
  return { perPortion: total, per100Served, rawWeight, imputed, missingValues: r.ingredients.filter(i => !i.per100g || i.per100g.energy_kcal === undefined).map(i => i.food_name || String(i.food_id)) };
}

export const displayName = (f: Pick<Food, 'name' | 'local_names'>, igbo = false) =>
  (igbo && f.local_names?.ig ? `${f.local_names.ig} — ` : '') + (f.local_names?.en || f.name);
