// Nigerian / West African food composition data + wound-healing meal-plan
// generator. Per-serving energy (kcal) and protein (g) values are drawn from the
// Food Composition Table for Nigeria / West African Food Composition Table
// (FAO), rounded to practical household portions. Values are approximate and
// intended for clinical meal planning, not laboratory precision.

export interface FoodPortion {
  name: string;
  qty: string;   // household measure
  kcal: number;
  protein: number; // grams
}

export interface Meal {
  label: string;
  items: FoodPortion[];
}

export interface DayPlan {
  day: string;
  breakfast: Meal;
  midMorningSnack: Meal;
  lunch: Meal;
  afternoonSnack: Meal;
  dinner: Meal;
  totalKcal: number;
  totalProtein: number;
}

// ── Core food items (per stated portion) ────────────────────────────────────
const F = {
  pap:            { name: 'Pap / akamu', qty: '1 large bowl (300 ml)', kcal: 150, protein: 3 },
  moimoi:         { name: 'Moi moi (beans)', qty: '1 wrap (150 g)', kcal: 200, protein: 12 },
  akara:          { name: 'Akara (bean cakes)', qty: '3 balls (90 g)', kcal: 180, protein: 8 },
  bread:          { name: 'Wheat bread', qty: '2 slices (60 g)', kcal: 160, protein: 6 },
  eggs2:          { name: 'Boiled eggs', qty: '2 eggs', kcal: 140, protein: 12 },
  eggSauce:       { name: 'Egg & sardine sauce', qty: '1 serving', kcal: 190, protein: 15 },
  yamBoiled:      { name: 'Boiled yam', qty: '4 slices (200 g)', kcal: 240, protein: 3 },
  dodo:           { name: 'Fried plantain (dodo)', qty: '1 serving (150 g)', kcal: 230, protein: 2 },
  oatmeal:        { name: 'Oatmeal + milk', qty: '1 bowl', kcal: 220, protein: 9 },
  milk:           { name: 'Fresh/soy milk', qty: '1 glass (200 ml)', kcal: 120, protein: 8 },
  yoghurt:        { name: 'Plain yoghurt', qty: '1 cup (150 ml)', kcal: 130, protein: 7 },
  groundnut:      { name: 'Groundnuts', qty: '1 handful (30 g)', kcal: 170, protein: 8 },
  orange:         { name: 'Orange', qty: '1 fruit', kcal: 60, protein: 1 },
  pawpaw:         { name: 'Pawpaw (vit A/C)', qty: '1 cup', kcal: 60, protein: 1 },
  watermelon:     { name: 'Watermelon (hydrating)', qty: '1 cup', kcal: 45, protein: 1 },
  banana:         { name: 'Banana', qty: '1 fruit', kcal: 100, protein: 1 },
  tigernut:       { name: 'Tigernut + coconut', qty: '1 serving', kcal: 150, protein: 4 },
  dates:          { name: 'Dates (iron/energy)', qty: '4 pieces', kcal: 110, protein: 1 },
  jollof:         { name: 'Jollof rice', qty: '1 plate (250 g)', kcal: 330, protein: 6 },
  whiteRice:      { name: 'White rice', qty: '1 plate (250 g)', kcal: 320, protein: 6 },
  ofada:          { name: 'Ofada rice', qty: '1 plate (250 g)', kcal: 330, protein: 7 },
  beans:          { name: 'Beans (cooked)', qty: '1 cup (200 g)', kcal: 340, protein: 21 },
  eba:            { name: 'Eba (garri)', qty: '1 wrap (200 g)', kcal: 350, protein: 2 },
  poundedYam:     { name: 'Pounded yam', qty: '1 wrap (250 g)', kcal: 330, protein: 4 },
  fufu:           { name: 'Semovita / fufu', qty: '1 wrap (250 g)', kcal: 340, protein: 3 },
  egusi:          { name: 'Egusi soup', qty: '1 serving', kcal: 300, protein: 14 },
  ogbono:         { name: 'Ogbono soup', qty: '1 serving', kcal: 250, protein: 12 },
  eforiro:        { name: 'Efo riro / vegetable soup', qty: '1 serving', kcal: 200, protein: 10 },
  okro:           { name: 'Okro soup', qty: '1 serving', kcal: 180, protein: 9 },
  vegSoup:        { name: 'Edikang ikong (veg)', qty: '1 serving', kcal: 220, protein: 12 },
  pepperSoup:     { name: 'Catfish pepper soup', qty: '1 bowl', kcal: 220, protein: 24 },
  fish:           { name: 'Grilled fish (titus/tilapia)', qty: '1 fillet (120 g)', kcal: 180, protein: 26 },
  chicken:        { name: 'Grilled/boiled chicken', qty: '1 piece (120 g)', kcal: 200, protein: 25 },
  beef:           { name: 'Beef / assorted meat', qty: '100 g', kcal: 250, protein: 26 },
  goat:           { name: 'Goat meat', qty: '100 g', kcal: 240, protein: 25 },
  ugu:            { name: 'Ugwu / vegetable side', qty: '1 serving', kcal: 60, protein: 3 },
  liver:          { name: 'Liver (iron/folate)', qty: '80 g', kcal: 150, protein: 20 },
} as const;

const meal = (label: string, items: FoodPortion[]): Meal => ({ label, items });

// ── Rotating pools (7 distinct options each for a full week) ─────────────────
const BREAKFASTS: Meal[] = [
  meal('Breakfast', [F.pap, F.moimoi, F.orange, F.milk]),
  meal('Breakfast', [F.bread, F.eggSauce, F.pawpaw]),
  meal('Breakfast', [F.yamBoiled, F.eggSauce, F.orange]),
  meal('Breakfast', [F.oatmeal, F.groundnut, F.banana]),
  meal('Breakfast', [F.akara, F.pap, F.milk]),
  meal('Breakfast', [F.bread, F.eggs2, F.milk, F.orange]),
  meal('Breakfast', [F.dodo, F.eggSauce, F.pawpaw]),
];

const LUNCHES: Meal[] = [
  meal('Lunch', [F.poundedYam, F.egusi, F.fish, F.ugu]),
  meal('Lunch', [F.jollof, F.chicken, F.ugu]),
  meal('Lunch', [F.eba, F.ogbono, F.beef, F.ugu]),
  meal('Lunch', [F.whiteRice, F.beans, F.fish]),
  meal('Lunch', [F.fufu, F.vegSoup, F.goat]),
  meal('Lunch', [F.ofada, F.eforiro, F.chicken]),
  meal('Lunch', [F.poundedYam, F.okro, F.fish, F.ugu]),
];

const DINNERS: Meal[] = [
  meal('Dinner', [F.beans, F.dodo, F.fish]),
  meal('Dinner', [F.whiteRice, F.eforiro, F.chicken]),
  meal('Dinner', [F.pepperSoup, F.yamBoiled]),
  meal('Dinner', [F.eba, F.okro, F.fish]),
  meal('Dinner', [F.jollof, F.liver, F.ugu]),
  meal('Dinner', [F.fufu, F.egusi, F.chicken]),
  meal('Dinner', [F.whiteRice, F.vegSoup, F.fish]),
];

const SNACKS: Meal[] = [
  meal('Snack', [F.groundnut, F.orange]),
  meal('Snack', [F.yoghurt, F.banana]),
  meal('Snack', [F.moimoi, F.watermelon]),
  meal('Snack', [F.milk, F.dates]),
  meal('Snack', [F.tigernut, F.pawpaw]),
  meal('Snack', [F.eggs2, F.orange]),
  meal('Snack', [F.groundnut, F.watermelon]),
];

// High-protein "top-up" portions used when protein target is not yet met.
const PROTEIN_BOOSTS: FoodPortion[] = [F.eggs2, F.fish, F.milk, F.moimoi, F.groundnut];

const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

const sumMeals = (meals: Meal[]) => meals.reduce(
  (acc, m) => {
    m.items.forEach(i => { acc.kcal += i.kcal; acc.protein += i.protein; });
    return acc;
  }, { kcal: 0, protein: 0 }
);

/**
 * Generate a 7-day wound-healing meal plan tuned to the patient's daily energy
 * and protein targets, using Nigerian foods with practical quantities.
 */
export function generateMealPlan(targetKcal: number, targetProtein: number): DayPlan[] {
  const plan: DayPlan[] = [];
  for (let i = 0; i < 7; i++) {
    const breakfast = BREAKFASTS[i % BREAKFASTS.length];
    const midMorningSnack = { ...SNACKS[i % SNACKS.length] };
    const lunch = LUNCHES[i % LUNCHES.length];
    const afternoonSnack = { ...SNACKS[(i + 3) % SNACKS.length] };
    const dinner = DINNERS[i % DINNERS.length];

    const meals: Meal[] = [breakfast, midMorningSnack, lunch, afternoonSnack, dinner];
    let { kcal, protein } = sumMeals(meals);

    // Top up protein/energy toward the target with extra Nigerian protein portions
    const extra: FoodPortion[] = [];
    let guard = 0;
    while ((protein < targetProtein - 5 || kcal < targetKcal - 150) && guard < 6) {
      const boost = PROTEIN_BOOSTS[(i + guard) % PROTEIN_BOOSTS.length];
      extra.push(boost);
      protein += boost.protein;
      kcal += boost.kcal;
      guard++;
    }
    const afternoon = extra.length
      ? meal('Snack', [...afternoonSnack.items, ...extra])
      : afternoonSnack;
    const totals = sumMeals([breakfast, midMorningSnack, lunch, afternoon, dinner]);

    plan.push({
      day: DAYS[i],
      breakfast, midMorningSnack, lunch,
      afternoonSnack: afternoon,
      dinner,
      totalKcal: totals.kcal,
      totalProtein: totals.protein,
    });
  }
  return plan;
}
