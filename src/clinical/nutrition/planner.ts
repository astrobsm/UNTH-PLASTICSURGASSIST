/**
 * Weekly meal-plan generator.
 *
 * 1. Menu: dishes are chosen by rule — a swallow with a vegetable soup at
 *    lunch, a rice/porridge main at dinner, a breakfast, fruit and snacks —
 *    rotating proteins, no main dish more than twice a week, vegetables and
 *    fruit daily, honouring texture, allergies, religion, budget and where the
 *    food comes from.
 * 2. Quantities: one linear programme per day (javascript-lp-solver) finds the
 *    portion of every item so that energy is within ±5% of target, protein is
 *    ≥ 100%, carbohydrate / sodium / potassium / phosphate limits hold, each
 *    meal carries a sensible share of the day, and portions stay within
 *    realistic limits — while staying as close as possible to standard
 *    portions. Countable items (eggs, pieces of meat) are integers.
 * 3. Rounding: served weights to 5 g, whole units; totals are then re-checked
 *    and nudged back inside the tolerance.
 * 4. If a day is infeasible, each constraint group is relaxed in turn to name
 *    the one that blocks it, with a suggestion (often: add ONS).
 *
 * All nutrient values come from the food table via recipes/foods passed in.
 */
import solver from 'javascript-lp-solver';
import { NUTRITION_CONFIG } from './config';
import type { NutritionConfig } from './config/nutrition.v1';
import { addNutrients, nutrientsOf, purchaseWeight, recipeNutrients, roundNutrients, scaleNutrients, type Food, type Nutrients, type Recipe } from './foods';

export interface PlannerTargets {
  kcal: number;
  proteinG: number;
  carbMaxG?: number | null;
  sodiumMaxMg?: number | null;
  potassiumMaxMg?: number | null;
  phosphateMaxMg?: number | null;
}
export interface Ons { name: string; kcal: number; proteinG: number; maxServings: number }
export interface Measure { food_id?: number | null; recipe_id?: number | null; measure: string; grams: number; verified?: boolean }
export interface Catalog { foods: Food[]; recipes: Recipe[]; measures?: Measure[] }
export interface PlannerOptions {
  targets: PlannerTargets;
  /** Per-day energy override (refeeding schedule), index 0 = day 1. */
  dailyKcal?: (number | null | undefined)[];
  goal?: 'maintain' | 'gain' | 'lose';
  /** Maintenance energy, for the projected weight trajectory. */
  baseKcal?: number | null;
  startWeightKg?: number | null;
  texture?: 'normal' | 'soft' | 'minced_moist' | 'pureed' | 'liquid';
  allergies?: string[];
  religious?: string[];
  budget?: 'low' | 'medium' | 'high';
  mealsBy?: 'hospital' | 'family';
  ons?: Ons | null;
  snacks?: 2 | 3;
  days?: number;
  /** Rotation seed (e.g. patient id) so two patients do not get identical weeks. */
  seed?: string;
}

export type Slot = 'breakfast' | 'mid_morning' | 'lunch' | 'afternoon' | 'dinner' | 'evening';
const SLOT_SHARE: Record<Slot, keyof NutritionConfig['mealSplit']['value']> = {
  breakfast: 'breakfast', mid_morning: 'snacks', lunch: 'lunch', afternoon: 'snacks', dinner: 'dinner', evening: 'snacks',
};

export interface PlanItem {
  key: string;
  kind: 'recipe' | 'food' | 'ons';
  refId: number | null;
  name: string;
  igbo?: string | null;
  slot: Slot;
  servedG: number;
  /** Weight to buy/cook: recipe ingredients raw, foods as purchased. */
  rawG: number;
  units?: { n: number; label: string } | null;
  measure?: { text: string; verified: boolean } | null;
  ingredients?: { name: string; rawG: number }[];
  nutrients: Nutrients;
  draftRecipe?: boolean;
}
export interface PlanDay {
  day: number;
  targetKcal: number;
  targetProteinG: number;
  items: PlanItem[];
  totals: Nutrients;
  feasible: boolean;
  withinTolerance: boolean;
  violations: string[];
  relaxed?: string[];
}
export interface MealPlan {
  days: PlanDay[];
  weekly: { avgKcal: number; avgProteinG: number; daysWithinTolerance: number };
  trajectory: { week: number; kg: number }[];
  warnings: string[];
  suggestions: string[];
  configVersion: string;
}

// ── helpers ─────────────────────────────────────────────────────────────────
const hash = (s = '') => { let h = 0; for (const ch of s) h = (h * 31 + ch.charCodeAt(0)) >>> 0; return h; };
const has = (xs: unknown, t: string) => Array.isArray(xs) && xs.includes(t);
const num = (x: unknown) => (x === null || x === undefined || x === '' ? null : Number(x));
const words = (xs: string[] = []) => xs.flatMap(x => x.toLowerCase().split(/[,;/]+/)).map(x => x.trim()).filter(Boolean);
const ALLERGY_ALIASES: Record<string, string[]> = {
  peanut: ['groundnut'], groundnut: ['groundnut'], shellfish: ['shrimp', 'crayfish'], crayfish: ['crayfish', 'shrimp'], fish: ['fish', 'catfish', 'mackerel', 'crayfish', 'shrimp'],
  egg: ['egg'], milk: ['milk'], dairy: ['milk'], lactose: ['milk'], gluten: ['wheat', 'bread'], wheat: ['wheat', 'bread'], soy: ['soy'],
};

interface Candidate { kind: 'recipe' | 'food'; recipe?: Recipe; food?: Food; names: string }

function textOf(c: Candidate) {
  if (c.recipe) return [c.recipe.name, c.recipe.local_name, ...c.recipe.ingredients.map(i => i.food_name)].join(' ').toLowerCase();
  return [c.food!.name, c.food!.local_names?.en, c.food!.local_names?.ig, c.food!.food_group].join(' ').toLowerCase();
}

function excluded(c: Candidate, o: PlannerOptions): string | null {
  const t = c.names;
  for (const a of words(o.allergies)) {
    for (const w of ALLERGY_ALIASES[a] || [a]) if (t.includes(w)) return `allergy: ${a}`;
  }
  const rel = words(o.religious);
  if (rel.some(r => /vegetarian|vegan/.test(r)) && /fish|beef|goat|chicken|meat|crayfish|shrimp|egg|liver/.test(t)) return 'vegetarian';
  if (rel.some(r => /vegan/.test(r)) && /milk|egg/.test(t)) return 'vegan';
  if (rel.some(r => /no beef|hindu/.test(r)) && /beef/.test(t)) return 'no beef';
  if (rel.some(r => /no pork|halal|muslim/.test(r)) && /pork|bacon|ham\b/.test(t)) return 'no pork';
  const tx = o.texture || 'normal';
  if (tx !== 'normal') {
    if (c.recipe && has(c.recipe.tags, 'fried')) return 'texture';
    if (c.food && /dried|tiger nut|bread|fried/.test(t)) return 'texture';
    if ((tx === 'pureed' || tx === 'liquid') && c.recipe && !['swallow', 'soup', 'breakfast'].includes(c.recipe.category || '') && !has(c.recipe.tags, 'porridge')) return 'texture';
    if (tx === 'liquid' && !(c.recipe && (c.recipe.texture === 'liquid' || c.recipe.category === 'soup'))) return 'texture';
  }
  if (c.food) {
    if (o.mealsBy === 'hospital' && c.food.availability && c.food.availability.hospital === false) return 'not in hospital kitchen';
    if (o.mealsBy === 'family' && c.food.availability && c.food.availability.home === false) return 'not available at home';
    if (o.budget === 'low' && c.food.cost_tier === 'high') return 'budget';
  }
  return null;
}

/** Variable coefficients for one LP unit of an item. */
interface LpItem {
  key: string; slot: Slot; kind: 'recipe' | 'food' | 'ons';
  recipe?: Recipe; food?: Food; ons?: Ons;
  /** nutrients per LP unit: recipe = 1 portion, food (continuous) = 100 g, unit food = 1 unit, ons = 1 serving */
  per: Nutrients;
  min: number; max: number; std: number; int: boolean;
  /** objective weights for going above/below the standard portion */
  up: number; down: number; cost: number;
}

function lpItemFor(c: Candidate, slot: Slot, o: PlannerOptions, cfg: NutritionConfig, idx: number): LpItem {
  const goal = o.goal || 'maintain';
  const ps = cfg.portionScale.value;
  const costW = (tier?: string | null) => (tier === 'high' ? 0.3 : tier === 'medium' ? 0.1 : 0);
  if (c.recipe) {
    const r = c.recipe;
    const dense = has(r.tags, 'energy_dense'), swallow = r.category === 'swallow', veg = has(r.tags, 'vegetable');
    return {
      key: `r${r.id}_${slot}_${idx}`, slot, kind: 'recipe', recipe: r, per: recipeNutrients(r).perPortion,
      min: ps.min, max: swallow ? ps.swallowMax : ps.max, std: 1, int: false,
      up: goal === 'lose' && (swallow || dense) ? 3 : goal === 'lose' && veg ? 0.5 : 1,
      down: goal === 'gain' && (dense || swallow) ? 3 : 1, cost: 0,
    };
  }
  const f = c.food!;
  const unit = num(f.unit_g);
  const minG = num(f.min_portion_g) ?? 50, maxG = num(f.max_portion_g) ?? Math.max(minG * 3, 150);
  const dense = has(f.tags, 'energy_dense');
  if (unit && unit > 0) {
    const min = Math.max(1, Math.ceil(minG / unit - 1e-9)), max = Math.max(min, Math.floor(maxG / unit + 1e-9));
    return { key: `f${f.id}_${slot}_${idx}`, slot, kind: 'food', food: f, per: nutrientsOf(f.per100g, unit), min, max, std: min, int: true,
      up: goal === 'lose' && dense ? 3 : 1, down: goal === 'gain' && dense ? 3 : 1, cost: costW(f.cost_tier) };
  }
  return { key: `f${f.id}_${slot}_${idx}`, slot, kind: 'food', food: f, per: nutrientsOf(f.per100g, 100), min: minG / 100, max: maxG / 100,
    std: (minG + (maxG - minG) / 3) / 100, int: false, up: goal === 'lose' && dense ? 3 : 1, down: goal === 'gain' && dense ? 3 : 1, cost: costW(f.cost_tier) };
}

// ── menu selection ──────────────────────────────────────────────────────────
function buildMenus(cat: Catalog, o: PlannerOptions, cfg: NutritionConfig, days: number) {
  const warnings: string[] = [];
  const excludedNames = new Map<string, string>();
  const ok = (c: Candidate) => { const why = excluded(c, o); if (why) excludedNames.set(c.recipe?.name || c.food!.name, why); return !why; };
  const R = cat.recipes.map(r => ({ kind: 'recipe' as const, recipe: { ...r, portion_g: num(r.portion_g), ingredients: r.ingredients.map(i => ({ ...i, raw_g: Number(i.raw_g) })) }, names: '' }))
    .map(c => ({ ...c, names: textOf(c) })).filter(ok);
  const F = cat.foods.map(f => ({ kind: 'food' as const, food: f, names: '' })).map(c => ({ ...c, names: textOf(c) })).filter(ok);
  const cats = (k: string) => R.filter(c => c.recipe!.category === k);
  const swallows = cats('swallow'), soups = cats('soup');
  const mains = R.filter(c => c.recipe!.category === 'main' && has(c.recipe!.meal_slots, 'dinner'));
  const breakfasts = R.filter(c => has(c.recipe!.meal_slots, 'breakfast'));
  const sides = cats('side');
  const proteins = F.filter(c => has(c.food!.tags, 'protein') && num(c.food!.unit_g));
  const fruits = F.filter(c => has(c.food!.tags, 'fruit'));
  const staples = F.filter(c => has(c.food!.tags, 'staple'));
  const dairy = F.filter(c => has(c.food!.tags, 'dairy'));
  const dense = F.filter(c => has(c.food!.tags, 'energy_dense'));
  if (!soups.length) warnings.push('No vegetable soup is available after restrictions — vegetables may be missing on some days');
  if (!fruits.length) warnings.push('No fruit is available after restrictions');
  if (!proteins.length) warnings.push('No protein foods are available after restrictions — protein relies on dishes alone');

  const s0 = hash(o.seed);
  const uses = new Map<string, number>();
  const cap = cfg.maxDishPerWeek.value;
  const pick = <T extends Candidate>(pool: T[], i: number, countAs?: (c: T) => string): T | null => {
    for (let k = 0; k < pool.length; k++) {
      const c = pool[(s0 + i + k) % pool.length];
      const id = countAs ? countAs(c) : null;
      if (id && (uses.get(id) ?? 0) >= cap) continue;
      if (id) uses.set(id, (uses.get(id) ?? 0) + 1);
      return c;
    }
    return null;
  };
  const menus: { slot: Slot; c: Candidate }[][] = [];
  for (let d = 0; d < days; d++) {
    const m: { slot: Slot; c: Candidate }[] = [];
    const add = (slot: Slot, c: Candidate | null) => { if (c) m.push({ slot, c }); };
    // Breakfast: a breakfast dish; a liquid one is paired with a solid, a sauce with a staple.
    const b = pick(breakfasts, d, c => c.recipe!.name);
    add('breakfast', b);
    if (b && (b.recipe!.texture === 'liquid' || b.recipe!.category === 'breakfast')) add('breakfast', pick(breakfasts.filter(x => x !== b && x.recipe!.texture !== 'liquid' && x.recipe!.category === 'main'), d));
    if (b && b.recipe!.category === 'side') add('breakfast', pick(staples, d));
    // Lunch: swallow + vegetable soup + protein piece.
    if (swallows.length && soups.length) {
      add('lunch', pick(swallows, d));
      add('lunch', pick(soups, d, c => c.recipe!.name));
    } else add('lunch', pick(mains, d, c => c.recipe!.name));
    add('lunch', pick(proteins, 2 * d));
    // Dinner: a main; rice gets a stew; plus a protein piece.
    const mn = pick(mains, d + 3, c => c.recipe!.name) || pick(swallows, d + 1);
    add('dinner', mn);
    if (mn?.recipe && has(mn.recipe.tags, 'rice') && !has(mn.recipe.tags, 'one_pot') && mn.recipe.name.toLowerCase().includes('boiled')) add('dinner', pick(sides.filter(s => has(s.recipe!.tags, 'sauce')), d));
    add('dinner', pick(proteins, 2 * d + 1));
    // Snacks: fruit daily; energy-dense addition when gaining.
    add('mid_morning', pick(fruits, d));
    if (o.goal === 'gain') add('afternoon', pick(dense.length ? dense : dairy, d) || pick(fruits, d + 1));
    else add('afternoon', pick(fruits.length > 1 ? fruits : dairy, d + 1));
    if ((o.snacks ?? 2) === 3) add('evening', pick(dairy.length ? dairy : fruits, d));
    // Vegetables daily: if no dish today carries vegetables, add a vegetable side at dinner.
    if (!m.some(x => has(x.c.recipe?.tags, 'vegetable'))) add('dinner', pick(sides.filter(s => has(s.recipe!.tags, 'vegetable')), d));
    menus.push(m);
  }
  for (const [n, why] of excludedNames) if (why !== 'texture' && why !== 'budget') warnings.push(`${n} excluded (${why})`);
  if ((o.texture || 'normal') !== 'normal') warnings.push(`Texture-modified diet (${o.texture!.replace('_', ' ')}): the kitchen must prepare dishes to the prescribed IDDSI level`);
  return { menus, warnings };
}

// ── LP ──────────────────────────────────────────────────────────────────────
type Group = 'energy_min' | 'energy_max' | 'protein' | 'carb' | 'sodium' | 'potassium' | 'phosphate' | 'meal_split' | 'portion_limits';

function solveDay(items: LpItem[], kcal: number, protein: number, t: PlannerTargets, frac: number, cfg: NutritionConfig, drop: Group[] = []) {
  // Solve to slightly inside each limit, so rounding to 5 g / whole units has room to land.
  const tol = cfg.energyTolerancePct.value / 100 * 0.8;
  const C: Record<string, { min?: number; max?: number; equal?: number }> = {};
  if (!drop.includes('energy_min')) C.kcal = { ...(C.kcal || {}), min: kcal * (1 - tol) };
  if (!drop.includes('energy_max')) C.kcal = { ...(C.kcal || {}), max: kcal * (1 + tol) };
  if (!drop.includes('protein')) C.protein = { min: protein * 1.02 };
  if (t.carbMaxG && !drop.includes('carb')) C.carb = { max: t.carbMaxG * frac * 0.97 };
  if (t.sodiumMaxMg && !drop.includes('sodium')) C.na = { max: t.sodiumMaxMg };
  if (t.potassiumMaxMg && !drop.includes('potassium')) C.k = { max: t.potassiumMaxMg };
  if (t.phosphateMaxMg && !drop.includes('phosphate')) C.p = { max: t.phosphateMaxMg };
  const band = cfg.mealEnergyBand.value, split = cfg.mealSplit.value;
  const slots = [...new Set(items.map(i => i.slot))];
  const snackSlots = slots.filter(s => SLOT_SHARE[s] === 'snacks');
  if (!drop.includes('meal_split')) {
    for (const s of slots.filter(x => SLOT_SHARE[x] !== 'snacks')) C[`m_${s}`] = { min: kcal * split[SLOT_SHARE[s]] * band.min, max: kcal * split[SLOT_SHARE[s]] * band.max };
    if (snackSlots.length) C.m_snacks = { max: kcal * split.snacks * band.max * 1.5 };
  }
  const widen = drop.includes('portion_limits') ? 1.5 : 1;
  const V: Record<string, Record<string, number>> = {};
  const ints: Record<string, 1> = {};
  for (const it of items) {
    const v: Record<string, number> = {
      kcal: it.per.energy_kcal ?? 0, protein: it.per.protein_g ?? 0, carb: it.per.carb_g ?? 0, na: it.per.na_mg ?? 0, k: it.per.k_mg ?? 0, p: it.per.p_mg ?? 0,
      cost: it.cost, [`cap_${it.key}`]: 1, [`dev_${it.key}`]: 1,
    };
    v[SLOT_SHARE[it.slot] === 'snacks' ? 'm_snacks' : `m_${it.slot}`] = it.per.energy_kcal ?? 0;
    V[it.key] = v;
    C[`cap_${it.key}`] = { min: it.kind === 'ons' ? 0 : it.min / (it.int ? 1 : widen), max: it.max * widen };
    C[`dev_${it.key}`] = { equal: it.std };
    V[`dp_${it.key}`] = { [`dev_${it.key}`]: -1, cost: it.up };
    V[`dm_${it.key}`] = { [`dev_${it.key}`]: 1, cost: it.down };
    if (it.int) ints[it.key] = 1;
  }
  const r = solver.Solve({ optimize: 'cost', opType: 'min', constraints: C, variables: V, ints, options: { tolerance: 0.02, timeout: 4000 } } as any);
  return r as Record<string, number> & { feasible: boolean };
}

function diagnose(items: LpItem[], kcal: number, protein: number, t: PlannerTargets, frac: number, cfg: NutritionConfig) {
  const groups: Group[] = ['protein', 'energy_min', 'energy_max', 'carb', 'sodium', 'potassium', 'phosphate', 'meal_split', 'portion_limits'];
  const fixes: Group[] = [];
  let firstSolution: any = null;
  for (const g of groups) {
    if (g === 'carb' && !t.carbMaxG) continue;
    if (g === 'sodium' && !t.sodiumMaxMg) continue;
    if (g === 'potassium' && !t.potassiumMaxMg) continue;
    if (g === 'phosphate' && !t.phosphateMaxMg) continue;
    const r = solveDay(items, kcal, protein, t, frac, cfg, [g]);
    if (r.feasible) { fixes.push(g); firstSolution ??= { r, g }; }
  }
  return { fixes, firstSolution };
}

const SUGGEST: Record<Group, string> = {
  protein: 'Protein target cannot be met with realistic portions — add an oral nutritional supplement or extra protein foods (eggs, fish, milk)',
  energy_min: 'Energy target is above what realistic portions provide — add energy-dense additions, an oral nutritional supplement or enteral feeding',
  energy_max: 'Energy target is below the minimum portions of the chosen dishes — reduce the number of items or use smaller snacks',
  carb: 'The carbohydrate limit is too tight for these dishes — review the diabetic carbohydrate cap with the physician',
  sodium: 'The sodium limit cannot be met with these dishes — prepare without added salt/seasoning cubes and review',
  potassium: 'The potassium limit cannot be met with these dishes — physician/dietitian review (leaching, portion control)',
  phosphate: 'The phosphate limit cannot be met with these dishes — physician/dietitian review',
  meal_split: 'The meal energy split is too rigid for this target — allow a larger meal or more snacks',
  portion_limits: 'Portion limits are too narrow for this target — widen limits or add a meal',
};

// ── rounding ────────────────────────────────────────────────────────────────
function realise(lp: LpItem, x: number, cfg: NutritionConfig, measures: Measure[]): PlanItem {
  const step = cfg.roundingG.value;
  const rnd = (g: number) => Math.max(step, Math.round(g / step) * step);
  if (lp.kind === 'ons') {
    const n = Math.round(x);
    return { key: lp.key, kind: 'ons', refId: null, name: lp.ons!.name, slot: lp.slot, servedG: 0, rawG: 0, units: { n, label: 'serving' },
      nutrients: { energy_kcal: lp.ons!.kcal * n, protein_g: lp.ons!.proteinG * n } };
  }
  if (lp.recipe) {
    const r = lp.recipe;
    const portion = num(r.portion_g) ?? 250;
    const servedG = rnd(x * portion);
    const scale = servedG / portion;
    const m = measures.find(mm => mm.recipe_id === r.id);
    return {
      key: lp.key, kind: 'recipe', refId: r.id, name: r.name, igbo: r.local_name, slot: lp.slot, servedG,
      rawG: Math.round(r.ingredients.reduce((s, i) => s + Number(i.raw_g), 0) * scale),
      ingredients: r.ingredients.map(i => ({ name: i.food_name || `#${i.food_id}`, rawG: Math.round(Number(i.raw_g) * scale) })),
      measure: m ? { text: `≈ ${Math.round((servedG / Number(m.grams)) * 2) / 2} × ${m.measure}`, verified: !!m.verified } : null,
      nutrients: scaleNutrients(lp.per, scale), draftRecipe: r.status !== 'verified',
    };
  }
  const f = lp.food!;
  const unit = num(f.unit_g);
  const g = lp.int && unit ? Math.round(x) * unit : rnd(x * 100);
  const m = measures.find(mm => mm.food_id === f.id);
  return {
    key: lp.key, kind: 'food', refId: f.id, name: f.local_names?.en || f.name, igbo: f.local_names?.ig, slot: lp.slot, servedG: g,
    rawG: Math.round(purchaseWeight(g, num(f.edible_portion))),
    units: lp.int && unit ? { n: Math.round(x), label: f.unit_label || 'unit' } : null,
    measure: m && !lp.int ? { text: `≈ ${Math.round((g / Number(m.grams)) * 2) / 2} × ${m.measure}`, verified: !!m.verified } : null,
    nutrients: nutrientsOf(f.per100g, g),
  };
}

function totalsOf(items: PlanItem[]) { return addNutrients(...items.map(i => i.nutrients)); }

/**
 * Nudge rounded portions back inside the energy band, over the protein floor
 * and under the carbohydrate cap. Works to a 1-unit margin inside each limit
 * so the final rounding of totals can never cross one.
 */
function settle(items: PlanItem[], lps: Map<string, LpItem>, kcal: number, protein: number, carbMax: number | null, cfg: NutritionConfig) {
  const tol = cfg.energyTolerancePct.value / 100, step = cfg.roundingG.value;
  const lo = kcal * (1 - tol) + 1, hi = kcal * (1 + tol) - 1, pMin = protein + 0.5, cMax = carbMax != null ? carbMax - 1 : Infinity;
  const flexible = items.filter(i => i.kind !== 'ons' && !i.units);
  const density = (i: PlanItem) => ({ kcal: (i.nutrients.energy_kcal ?? 0) / i.servedG, prot: (i.nutrients.protein_g ?? 0) / i.servedG, carb: (i.nutrients.carb_g ?? 0) / i.servedG });
  const limits = (i: PlanItem) => {
    const lp = lps.get(i.key)!;
    if (lp.recipe) { const p = num(lp.recipe.portion_g) ?? 250; return { min: lp.min * p, max: lp.max * p }; }
    return { min: lp.min * 100, max: lp.max * 100 };
  };
  const resize = (i: PlanItem, g: number) => {
    const f = g / i.servedG;
    i.nutrients = scaleNutrients(i.nutrients, f); i.rawG = Math.round(i.rawG * f);
    if (i.ingredients) i.ingredients = i.ingredients.map(x => ({ ...x, rawG: Math.round(x.rawG * f) }));
    i.servedG = g;
  };
  for (let n = 0; n < 400; n++) {
    const t = totalsOf(items);
    const e = t.energy_kcal ?? 0, p = t.protein_g ?? 0, c = t.carb_g ?? 0;
    if (e >= lo && e <= hi && p >= pMin && c <= cMax) break;
    // Direction: too much energy or carbohydrate → shrink; otherwise grow.
    const up = !(e > hi || c > cMax);
    let best: PlanItem | null = null, score = -Infinity;
    for (const i of flexible) {
      const d = density(i), L = limits(i);
      if (up && i.servedG + step > L.max) continue;
      if (!up && i.servedG - step < L.min) continue;
      let s: number;
      if (up) {
        // Grow what fixes the shortfall without breaking the energy ceiling or carb cap.
        if (e + d.kcal * step > hi || c + d.carb * step > cMax) continue;
        s = p < pMin ? d.prot / Math.max(d.kcal, 0.01) : d.kcal - d.carb;
      } else {
        // Shrink what removes the excess without dropping protein or energy below their floors.
        if (p - d.prot * step < pMin && p >= pMin) continue;
        if (e - d.kcal * step < lo && e <= hi) continue;
        s = c > cMax ? d.carb - d.prot : d.kcal - d.prot * 4;
      }
      if (s > score) { score = s; best = i; }
    }
    if (!best) break;
    resize(best, best.servedG + (up ? step : -step));
  }
}

// ── main ────────────────────────────────────────────────────────────────────
export function generateMealPlan(cat: Catalog, o: PlannerOptions, cfg: NutritionConfig = NUTRITION_CONFIG): MealPlan {
  const days = o.days ?? 7;
  const { menus, warnings } = buildMenus(cat, o, cfg, days);
  const measures = (cat.measures || []).map(m => ({ ...m, grams: Number(m.grams) }));
  const suggestions = new Set<string>();
  const out: PlanDay[] = [];
  const tol = cfg.energyTolerancePct.value / 100;

  menus.forEach((menu, d) => {
    const dayKcal = o.dailyKcal?.[d] ?? o.targets.kcal;
    const frac = Math.min(1, dayKcal / o.targets.kcal);
    const dayProtein = Math.round(o.targets.proteinG * frac);
    const lps = menu.map((m, k) => lpItemFor(m.c, m.slot, o, cfg, k));
    if (o.ons && o.ons.maxServings > 0) {
      lps.push({ key: `ons_${d}`, slot: 'afternoon', kind: 'ons', ons: o.ons, per: { energy_kcal: o.ons.kcal, protein_g: o.ons.proteinG },
        min: 0, max: o.ons.maxServings, std: 0, int: true, up: 4, down: 0, cost: 0 });
    }
    let r = solveDay(lps, dayKcal, dayProtein, o.targets, frac, cfg);
    let relaxed: string[] | undefined;
    if (!r.feasible) {
      const dg = diagnose(lps, dayKcal, dayProtein, o.targets, frac, cfg);
      if (dg.fixes.length) dg.fixes.forEach(g => suggestions.add(SUGGEST[g]));
      else suggestions.add('No single relaxation makes this day feasible — dietitian review required');
      if (dg.firstSolution) { r = dg.firstSolution.r; relaxed = [dg.firstSolution.g]; }
    }
    const lpMap = new Map(lps.map(l => [l.key, l]));
    const items = r.feasible
      ? lps.map(l => ({ l, x: Number(r[l.key] ?? 0) })).filter(({ l, x }) => x > 1e-6 || l.kind !== 'ons').map(({ l, x }) => realise(l, x, cfg, measures)).filter(i => i.kind !== 'ons' || (i.units?.n ?? 0) > 0)
      : [];
    if (items.length && !relaxed) settle(items, lpMap, dayKcal, dayProtein, o.targets.carbMaxG ? o.targets.carbMaxG * frac : null, cfg);
    items.forEach(i => { i.nutrients = roundNutrients(i.nutrients); });
    const totals = roundNutrients(totalsOf(items));
    const violations: string[] = [];
    const e = totals.energy_kcal ?? 0, p = totals.protein_g ?? 0;
    if (!items.length) violations.push('No feasible plan');
    else {
      if (e < dayKcal * (1 - tol) || e > dayKcal * (1 + tol)) violations.push(`Energy ${e} kcal outside ${Math.round(dayKcal * (1 - tol))}–${Math.round(dayKcal * (1 + tol))}`);
      if (p < dayProtein) violations.push(`Protein ${p} g below ${dayProtein} g`);
      if (o.targets.carbMaxG && (totals.carb_g ?? 0) > o.targets.carbMaxG * frac + 0.5) violations.push(`Carbohydrate ${totals.carb_g} g above ${Math.round(o.targets.carbMaxG * frac)} g`);
      if (o.targets.sodiumMaxMg && (totals.na_mg ?? 0) > o.targets.sodiumMaxMg) violations.push(`Sodium ${totals.na_mg} mg above ${o.targets.sodiumMaxMg} mg (excludes added salt)`);
      if (o.targets.potassiumMaxMg && (totals.k_mg ?? 0) > o.targets.potassiumMaxMg) violations.push(`Potassium above ${o.targets.potassiumMaxMg} mg`);
      if (o.targets.phosphateMaxMg && (totals.p_mg ?? 0) > o.targets.phosphateMaxMg) violations.push(`Phosphate above ${o.targets.phosphateMaxMg} mg`);
    }
    out.push({ day: d + 1, targetKcal: Math.round(dayKcal), targetProteinG: dayProtein, items, totals, feasible: !!r.feasible && !relaxed, withinTolerance: violations.length === 0, violations, ...(relaxed ? { relaxed } : {}) });
  });

  const ok = out.filter(d => d.items.length);
  const avgKcal = ok.length ? Math.round(ok.reduce((s, d) => s + (d.totals.energy_kcal ?? 0), 0) / ok.length) : 0;
  const avgProteinG = ok.length ? Math.round(ok.reduce((s, d) => s + (d.totals.protein_g ?? 0), 0) / ok.length) : 0;
  const trajectory: MealPlan['trajectory'] = [];
  if (o.startWeightKg && o.baseKcal && avgKcal) {
    const perWeek = ((avgKcal - o.baseKcal) * 7) / cfg.kcalPerKgFat.value;
    for (let w = 0; w <= 8; w++) trajectory.push({ week: w, kg: Math.round((o.startWeightKg + perWeek * w) * 10) / 10 });
  }
  if (out.some(d => d.items.some(i => i.draftRecipe))) warnings.push('Some dishes use draft recipes not yet verified by local weighing');
  if (o.targets.sodiumMaxMg) warnings.push('Sodium totals exclude salt and seasoning cubes added in cooking');
  return {
    days: out, weekly: { avgKcal, avgProteinG, daysWithinTolerance: out.filter(d => d.withinTolerance).length },
    trajectory, warnings, suggestions: [...suggestions], configVersion: cfg.version,
  };
}
