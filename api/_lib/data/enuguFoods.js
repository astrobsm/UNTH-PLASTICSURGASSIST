// Enugu / South-East Nigeria layer over WAFCT 2019.
//
// Nothing here is a nutrient value. Nutrients always come from the WAFCT row
// named by `code`. This file only says which WAFCT foods are local, what they
// are called locally, how the planner may portion them, and how local dishes
// are composed (grams of WAFCT ingredients per portion).
//
// STATUS: DRAFT — every recipe, portion limit, Igbo label and household
// measure here needs dietitian verification by local weighing before go-live.
// Seeding inserts recipes as status 'draft' and measures as verified = false.

export const ENUGU_SEED_VERSION = 'enugu-draft-1';

/**
 * Local foods the planner can serve directly. unit_g = edible grams of one
 * countable unit (egg, piece of meat) so plans round to whole pieces.
 * cost: low | medium | high (budget tier). avail: hospital kitchen / home.
 */
export const LOCAL_FOODS = [
  // Proteins (served as separate pieces so the plan can rotate sources)
  { code: '08_002', en: 'Boiled egg', ig: 'Akwa', role: 'protein', unit_g: 50, unit_label: 'egg', min_g: 50, max_g: 150, cost: 'low', avail: { hospital: true, home: true } },
  { code: '07_010', en: 'Beef, lean, boiled', ig: 'Anụ ehi', role: 'protein', unit_g: 40, unit_label: 'piece', min_g: 40, max_g: 160, cost: 'medium', avail: { hospital: true, home: true } },
  { code: '07_113', en: 'Goat meat, boiled', ig: 'Anụ ewu', role: 'protein', unit_g: 40, unit_label: 'piece', min_g: 40, max_g: 160, cost: 'high', avail: { hospital: false, home: true } },
  { code: '07_102', en: 'Chicken, stewed', ig: 'Ọkụkọ', role: 'protein', unit_g: 80, unit_label: 'piece', min_g: 80, max_g: 160, cost: 'high', avail: { hospital: true, home: true } },
  { code: '09_108', en: 'Catfish, boiled', ig: 'Azụ', role: 'protein', unit_g: 80, unit_label: 'piece', min_g: 80, max_g: 160, cost: 'medium', avail: { hospital: true, home: true } },
  { code: '09_072', en: 'Fresh fish (horse mackerel), boiled', ig: 'Azụ', role: 'protein', unit_g: 80, unit_label: 'piece', min_g: 80, max_g: 160, cost: 'medium', avail: { hospital: true, home: true } },
  { code: '09_053', en: 'Dried fish', ig: 'Azụ mkpọ', role: 'protein', unit_g: 20, unit_label: 'piece', min_g: 20, max_g: 60, cost: 'medium', avail: { hospital: true, home: true } },
  { code: '03_007', en: 'Beans, boiled', ig: 'Agwa', role: 'protein', min_g: 100, max_g: 300, cost: 'low', avail: { hospital: true, home: true } },
  // Dairy and energy-dense additions
  { code: '10_002', en: 'Powdered milk (whole)', ig: 'Mmiri ara ehi', role: 'dairy', unit_g: 8, unit_label: 'tablespoon', min_g: 8, max_g: 48, cost: 'medium', avail: { hospital: true, home: true }, energy_dense: true },
  { code: '10_016', en: 'Evaporated milk', role: 'dairy', min_g: 50, max_g: 170, cost: 'medium', avail: { hospital: true, home: true } },
  { code: '06_026', en: 'Groundnut paste', ig: 'Ahụekere', role: 'addition', unit_g: 15, unit_label: 'tablespoon', min_g: 15, max_g: 45, cost: 'low', avail: { hospital: false, home: true }, energy_dense: true },
  { code: '11_004', en: 'Palm oil (red)', ig: 'Mmanụ nkwụ', role: 'addition', unit_g: 5, unit_label: 'teaspoon', min_g: 5, max_g: 20, cost: 'low', avail: { hospital: true, home: true }, energy_dense: true },
  // Starchy sides
  { code: '02_035', en: 'Boiled yam', ig: 'Ji', role: 'staple', min_g: 150, max_g: 350, cost: 'medium', avail: { hospital: true, home: true } },
  { code: '02_057', en: 'Boiled ripe plantain', ig: 'Ogede', role: 'staple', min_g: 100, max_g: 250, cost: 'low', avail: { hospital: true, home: true } },
  { code: '02_084', en: 'Fried plantain (dodo)', ig: 'Ogede eghere eghe', role: 'staple', min_g: 80, max_g: 200, cost: 'low', avail: { hospital: false, home: true } },
  { code: '02_023', en: 'Boiled sweet potato', role: 'staple', min_g: 150, max_g: 300, cost: 'low', avail: { hospital: false, home: true } },
  { code: '02_006', en: 'Boiled cocoyam', ig: 'Ede', role: 'staple', min_g: 150, max_g: 300, cost: 'low', avail: { hospital: false, home: true } },
  { code: '01_045', en: 'White bread', ig: 'Achịcha', role: 'staple', unit_g: 30, unit_label: 'slice', min_g: 30, max_g: 120, cost: 'low', avail: { hospital: true, home: true } },
  // Fruit
  { code: '05_016', en: 'Orange', ig: 'Oroma', role: 'fruit', unit_g: 130, unit_label: 'fruit', min_g: 130, max_g: 260, cost: 'low', avail: { hospital: true, home: true } },
  { code: '05_017', en: 'Pawpaw', ig: 'Okwuru bekee', role: 'fruit', min_g: 100, max_g: 250, cost: 'low', avail: { hospital: true, home: true } },
  { code: '05_018', en: 'Pineapple', role: 'fruit', min_g: 80, max_g: 200, cost: 'low', avail: { hospital: false, home: true } },
  { code: '05_028', en: 'Banana', ig: 'Unere', role: 'fruit', unit_g: 80, unit_label: 'fruit', min_g: 80, max_g: 160, cost: 'low', avail: { hospital: true, home: true } },
  { code: '05_022', en: 'Watermelon', role: 'fruit', min_g: 150, max_g: 400, cost: 'low', avail: { hospital: false, home: true } },
  { code: '05_015', en: 'Mango (seasonal)', role: 'fruit', unit_g: 150, unit_label: 'fruit', min_g: 150, max_g: 300, cost: 'low', avail: { hospital: false, home: true }, season: 'Mar–Jun' },
  { code: '02_024', en: 'Tiger nut', role: 'snack', min_g: 30, max_g: 60, cost: 'low', avail: { hospital: false, home: true } },
];

// Ingredient-level Igbo labels for foods used only inside recipes.
export const INGREDIENT_LABELS = {
  '02_039': { en: 'Garri (white)', ig: 'Garri' },
  '02_041': { en: 'Cassava fufu (wet)', ig: 'Akpu' },
  '03_045': { en: 'Cowpea, dehulled', ig: 'Agwa' },
  '03_027': { en: 'Brown beans, dry', ig: 'Agwa' },
  '03_001': { en: 'Bambara nut, dry', ig: 'Okpa' },
  '06_013': { en: 'Melon seed', ig: 'Egusi' },
  '06_008': { en: 'Dika nut (ogbono)', ig: 'Ogbono / Ugiri' },
  '04_017': { en: 'Okra', ig: 'Okwuru' },
  '04_070': { en: 'Bitter leaf', ig: 'Onugbu' },
  '04_080': { en: 'Wild spinach (ukazi)', ig: 'Ukazi / Okazi' },
  '04_078': { en: 'Waterleaf', ig: 'Mgbolodi' },
  '04_074': { en: 'Garden egg', ig: 'Anara' },
  '05_040': { en: 'Palm fruit', ig: 'Akwụ' },
  '01_100': { en: 'Pap (ogi), cooked', ig: 'Akamu' },
  '09_057': { en: 'Crayfish, dried', ig: 'Crayfish' },
  '02_002': { en: 'Dried cassava (abacha base)', ig: 'Abacha' },
};

/**
 * Draft standardised recipes — ONE portion each, grams of the WAFCT food as
 * coded (raw codes = raw weight for buying/cooking; cooked codes = cooked).
 * portion_g = served weight. Proteins served with soups are separate items.
 */
const NOTE = 'Draft — dietitian to verify ingredient weights by local weighing.';
export const RECIPES = [
  // Swallows
  { name: 'Eba', local_name: 'Eba', category: 'swallow', slots: ['lunch', 'dinner'], portion_g: 250, texture: 'soft', tags: ['swallow'], ingredients: [['02_039', 100]] },
  { name: 'Akpu (cassava fufu)', local_name: 'Akpu', category: 'swallow', slots: ['lunch', 'dinner'], portion_g: 250, texture: 'soft', tags: ['swallow'], ingredients: [['02_041', 250]] },
  { name: 'Pounded yam', local_name: 'Ji akpụrụ akpụ', category: 'swallow', slots: ['lunch', 'dinner'], portion_g: 250, texture: 'soft', tags: ['swallow'], ingredients: [['02_035', 250]] },
  { name: 'Wheat swallow', local_name: 'Wheat', category: 'swallow', slots: ['lunch', 'dinner'], portion_g: 250, texture: 'soft', tags: ['swallow'], ingredients: [['01_043', 90]] },
  // Soups (eaten with a swallow; protein pieces added separately)
  { name: 'Ofe onugbu (bitter leaf soup)', local_name: 'Ofe onugbu', category: 'soup', slots: ['lunch', 'dinner'], portion_g: 250, tags: ['soup', 'vegetable'], ingredients: [['02_006', 40], ['04_070', 40], ['11_004', 15], ['09_057', 6], ['09_053', 10], ['04_018', 10]] },
  { name: 'Egusi soup', local_name: 'Ofe egusi', category: 'soup', slots: ['lunch', 'dinner'], portion_g: 250, tags: ['soup', 'vegetable'], ingredients: [['06_013', 40], ['04_070', 30], ['11_004', 15], ['09_057', 6], ['09_053', 10], ['04_018', 15]] },
  { name: 'Ogbono soup', local_name: 'Ofe ogbono', category: 'soup', slots: ['lunch', 'dinner'], portion_g: 250, tags: ['soup', 'vegetable'], ingredients: [['06_008', 25], ['04_017', 40], ['04_080', 15], ['11_004', 12], ['09_057', 6], ['09_053', 10]] },
  { name: 'Okra soup', local_name: 'Ofe okwuru', category: 'soup', slots: ['lunch', 'dinner'], portion_g: 250, tags: ['soup', 'vegetable'], ingredients: [['04_017', 120], ['11_004', 12], ['09_057', 6], ['09_053', 10], ['04_018', 10]] },
  { name: 'Ofe ukazi', local_name: 'Ofe okazi', category: 'soup', slots: ['lunch', 'dinner'], portion_g: 250, tags: ['soup', 'vegetable'], ingredients: [['04_080', 50], ['04_078', 80], ['02_006', 30], ['11_004', 20], ['09_057', 6], ['09_053', 10]] },
  { name: 'Ofe nsala (white soup) with catfish', local_name: 'Ofe nsala', category: 'soup', slots: ['lunch', 'dinner'], portion_g: 300, tags: ['soup', 'fish'], ingredients: [['02_035', 40], ['09_018', 100], ['04_018', 10], ['09_057', 6], ['04_047', 3]] },
  { name: 'Ofe akwu (palm fruit soup)', local_name: 'Ofe akwu', category: 'soup', slots: ['lunch', 'dinner'], portion_g: 250, tags: ['soup', 'energy_dense'], ingredients: [['05_040', 60], ['09_057', 6], ['09_053', 10], ['04_018', 10], ['04_070', 15]] },
  // Main dishes
  { name: 'Yam porridge', local_name: 'Awa ji', category: 'main', slots: ['breakfast', 'lunch', 'dinner'], portion_g: 350, tags: ['one_pot'], ingredients: [['02_034', 250], ['11_004', 10], ['04_018', 20], ['04_021', 40], ['09_057', 5], ['04_047', 5]] },
  { name: 'Beans and plantain porridge', local_name: 'Agwa na ogede', category: 'main', slots: ['lunch', 'dinner'], portion_g: 350, tags: ['legume', 'one_pot'], ingredients: [['03_027', 80], ['02_042', 100], ['11_004', 10], ['04_018', 20], ['09_057', 5]] },
  { name: 'Jollof rice', local_name: 'Jollof', category: 'main', slots: ['lunch', 'dinner'], portion_g: 330, tags: ['rice'], ingredients: [['01_135', 250], ['11_010', 10], ['04_066', 15], ['04_021', 40], ['04_018', 20], ['04_047', 10]] },
  { name: 'Boiled rice', local_name: 'Osikapa', category: 'main', slots: ['lunch', 'dinner'], portion_g: 250, tags: ['rice'], ingredients: [['01_135', 250]] },
  { name: 'Tomato stew', local_name: 'Stew', category: 'side', slots: ['lunch', 'dinner'], portion_g: 150, tags: ['sauce'], ingredients: [['04_021', 100], ['04_066', 10], ['04_018', 30], ['11_010', 15], ['04_047', 10]] },
  { name: 'Garden egg sauce with egg', local_name: 'Ofe anara', category: 'side', slots: ['breakfast', 'lunch', 'dinner'], portion_g: 200, tags: ['sauce', 'vegetable'], ingredients: [['04_074', 100], ['11_004', 10], ['04_018', 15], ['09_057', 5], ['08_002', 50]] },
  // Breakfast / light meals / snacks
  { name: 'Moi moi', local_name: 'Moi moi', category: 'main', slots: ['breakfast', 'lunch', 'snack'], portion_g: 150, tags: ['legume'], ingredients: [['03_045', 60], ['11_004', 8], ['04_018', 15], ['09_057', 4], ['08_002', 25]] },
  { name: 'Akara (bean cakes)', local_name: 'Akara', category: 'main', slots: ['breakfast', 'snack'], portion_g: 90, tags: ['legume', 'fried'], ingredients: [['03_045', 50], ['04_018', 10], ['11_010', 12]] },
  { name: 'Okpa', local_name: 'Okpa', category: 'main', slots: ['breakfast', 'lunch', 'snack'], portion_g: 160, tags: ['legume'], ingredients: [['03_001', 70], ['11_004', 10], ['04_047', 3]] },
  { name: 'Akamu (pap) with milk', local_name: 'Akamu', category: 'breakfast', slots: ['breakfast', 'snack'], portion_g: 325, texture: 'liquid', tags: ['porridge'], ingredients: [['01_100', 300], ['10_002', 15], ['13_002', 10]] },
  { name: 'Fortified akamu (milk and groundnut)', local_name: 'Akamu', category: 'breakfast', slots: ['breakfast', 'snack'], portion_g: 335, texture: 'liquid', tags: ['porridge', 'energy_dense', 'weight_gain'], ingredients: [['01_100', 300], ['10_002', 20], ['06_026', 15], ['13_002', 10]] },
  { name: 'Abacha (African salad, without ugba)', local_name: 'Abacha', category: 'main', slots: ['lunch', 'snack'], portion_g: 200, tags: ['cassava'], ingredients: [['02_002', 80], ['11_004', 15], ['04_074', 30], ['04_018', 15], ['09_057', 5]],
    note: 'Ugba (oil bean) is not in WAFCT 2019 and is omitted until a verified value is added.' },
].map(r => ({ ...r, notes: r.note ? `${NOTE} ${r.note}` : NOTE }));

/** Household measures (UNVERIFIED — "to be verified by local weighing"). */
export const MEASURES = [
  { recipe: 'Eba', measure: '1 medium wrap', grams: 250 },
  { recipe: 'Akpu (cassava fufu)', measure: '1 medium wrap', grams: 250 },
  { recipe: 'Pounded yam', measure: '1 medium wrap', grams: 250 },
  { recipe: 'Wheat swallow', measure: '1 medium wrap', grams: 250 },
  { recipe: 'Boiled rice', measure: '1 serving spoon (cooked)', grams: 60 },
  { recipe: 'Jollof rice', measure: '1 serving spoon (cooked)', grams: 60 },
  { recipe: 'Ofe onugbu (bitter leaf soup)', measure: '1 soup ladle', grams: 120 },
  { recipe: 'Egusi soup', measure: '1 soup ladle', grams: 120 },
  { recipe: 'Ogbono soup', measure: '1 soup ladle', grams: 120 },
  { recipe: 'Okra soup', measure: '1 soup ladle', grams: 120 },
  { recipe: 'Moi moi', measure: '1 wrap / leaf', grams: 150 },
  { recipe: 'Akara (bean cakes)', measure: '1 ball', grams: 30 },
  { recipe: 'Okpa', measure: '1 wrap', grams: 160 },
  { recipe: 'Akamu (pap) with milk', measure: '1 cup (250 mL)', grams: 250 },
  { food: '02_035', measure: '1 slice (boiled yam)', grams: 70 },
  { food: '10_002', measure: '1 tablespoon', grams: 8 },
  { food: '06_026', measure: '1 tablespoon', grams: 15 },
  { food: '11_004', measure: '1 teaspoon', grams: 5 },
  { food: '01_045', measure: '1 slice', grams: 30 },
];

/** Local foods with no WAFCT 2019 entry — need a verified source (e.g. Nigerian FCT) before use. */
export const MISSING_FROM_WAFCT = [
  'Fluted pumpkin leaves (ugu, Telfairia occidentalis) — WAFCT "pumpkin leaves" are Cucurbita and are NOT substituted',
  'Oha leaves (Pterocarpus mildbraedii/soyauxii)',
  'African oil bean (ugba, Pentaclethra macrophylla)',
  'Stockfish (dried cod)',
  'Cow skin (kpomo) — flag as low-quality protein when added',
  'Semolina (semovita)',
  'Uziza, utazi, ehuru (soup spices)',
];
