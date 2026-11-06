/**
 * Import the FAO/INFOODS Food Composition Table for Western Africa (2019).
 *
 *   node scripts/nutrition/import-wafct.mjs <path/to/WAFCT_2019.xlsx>
 *
 * Source file: https://www.fao.org/fileadmin/user_upload/faoweb/2020/WAFCT_2019.xlsx
 * (linked from https://www.fao.org/infoods/infoods/tables-and-databases/faoinfoods-databases)
 *
 * Writes api/_lib/data/wafct2019.js — every food on sheet "05 NV_sum_57" with
 * its FAO code, values per 100 g edible portion, edible-portion coefficient and
 * (from sheet "07 Yield factors") raw→cooked yield factor. Nothing is typed by
 * hand: values in [brackets] are FAO's imputed/low-quality values and are
 * flagged as such; "tr" (trace) becomes 0.
 *
 * Licence (sheet 01): FAO permits use "in non-commercial products or services,
 * provided that appropriate acknowledgement of FAO as the source and copyright
 * holder is given". Commercial use needs FAO's permission (copyright@fao.org).
 */
import { createRequire } from 'node:module';
import { writeFileSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
const XLSX = require('xlsx');
const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const OUT = join(ROOT, 'api', '_lib', 'data', 'wafct2019.js');

const file = process.argv[2];
if (!file) { console.error('Usage: node scripts/nutrition/import-wafct.mjs <WAFCT_2019.xlsx>'); process.exit(1); }

/** INFOODS tagname → our per-100 g key. ENERC appears twice (kJ, kcal) and is resolved by unit. */
const TAGS = {
  WATER: 'water_g', PROTCNT: 'protein_g', FAT: 'fat_g', CHOAVLDF: 'carb_g', FIBTG: 'fibre_g',
  CA: 'ca_mg', FE: 'fe_mg', MG: 'mg_mg', P: 'p_mg', K: 'k_mg', NA: 'na_mg', ZN: 'zn_mg',
  VITA_RAE: 'vit_a_ug', VITC: 'vit_c_mg', FOLDFE: 'folate_ug',
};

export function parseValue(v) {
  if (v === null || v === undefined || v === '') return { value: null, imputed: false };
  if (typeof v === 'number') return { value: v, imputed: false };
  const s = String(v).trim();
  if (/^tr$/i.test(s)) return { value: 0, imputed: false };
  const m = /^\[?\s*(-?\d+(?:\.\d+)?)\s*\]?$/.exec(s);
  if (!m) return { value: null, imputed: false };
  return { value: Number(m[1]), imputed: s.startsWith('[') };
}

export function stateOf(name) {
  if (/\braw\b/i.test(name)) return 'raw';
  if (/boiled|stewed|fried|grilled|steamed|roasted|cooked|toasted|baked|porridge/i.test(name)) return 'cooked';
  return null;
}

const wb = XLSX.readFile(file);
const sheet = (prefix) => {
  const n = wb.SheetNames.find(s => s.startsWith(prefix));
  if (!n) throw new Error(`Sheet ${prefix} not found — is this the WAFCT 2019 workbook?`);
  return XLSX.utils.sheet_to_json(wb.Sheets[n], { header: 1, blankrows: false });
};

const yields = new Map();
for (const r of sheet('07')) if (/^\d\d_\d{3}$/.test(String(r[0])) && typeof r[3] === 'number') yields.set(r[0], r[3]);

const rows = sheet('05');
const header = rows[0].map(h => String(h ?? ''));
const tagRow = rows[2].map(t => String(t ?? '').trim());
const col = {};
tagRow.forEach((t, i) => {
  if (t === 'ENERC') { if (/\(kJ\)/.test(header[i])) col.energy_kj = i; else if (/\(kcal\)/.test(header[i])) col.energy_kcal = i; }
  else if (TAGS[t]) col[TAGS[t]] = i;
  else if (t === 'EDIBLE1') col.edible = i;
});
for (const k of ['energy_kcal', 'energy_kj', 'protein_g', 'fat_g', 'carb_g', 'edible']) if (col[k] === undefined) throw new Error(`Column ${k} not found`);

const foods = [];
let group = null;
for (const r of rows.slice(3)) {
  if (r.length === 1 && typeof r[0] === 'string') { group = r[0].split('/')[0].trim(); continue; }
  const code = String(r[0] ?? '');
  if (!/^\d\d_\d{3}$/.test(code)) continue;
  const per100g = {}; const imputed = [];
  for (const [key, i] of Object.entries(col)) {
    if (key === 'edible') continue;
    const p = parseValue(r[i]);
    if (p.value === null) continue;
    per100g[key] = p.value;
    if (p.imputed) imputed.push(key);
  }
  if (per100g.energy_kcal === undefined || per100g.protein_g === undefined) continue;
  if (imputed.length) per100g.imputed = imputed;
  const ep = parseValue(r[col.edible]).value;
  const name = String(r[1]).replace(/\s+/g, ' ').trim();
  foods.push({
    food_code: code, name, food_group: group, scientific_name: r[3] ? String(r[3]).trim() : null,
    per100g, edible_portion: ep, yield_factor: yields.get(code) ?? null, state: stateOf(name),
  });
}

const SOURCE = {
  code: 'WAFCT2019',
  name: 'FAO/INFOODS Food Composition Table for Western Africa (2019)',
  version: '2019 (published 2020)',
  url: 'https://www.fao.org/fileadmin/user_upload/faoweb/2020/WAFCT_2019.xlsx',
  licence: '© FAO, 2020. Use permitted in non-commercial products or services with acknowledgement of FAO as source and copyright holder; commercial use requires FAO permission (copyright@fao.org).',
  citation: 'Vincent, A., Grande, F., Compaoré, E., et al. 2020. FAO/INFOODS Food Composition Table for Western Africa (2019) User Guide & Condensed Food Composition Table. Rome, FAO.',
};

mkdirSync(dirname(OUT), { recursive: true });
writeFileSync(OUT, `// GENERATED by scripts/nutrition/import-wafct.mjs — do not edit by hand.
// ${SOURCE.name}. ${SOURCE.licence}
// ${SOURCE.citation}
export const WAFCT_2019_SOURCE = ${JSON.stringify(SOURCE, null, 2)};
export const WAFCT_2019_FOODS = [
${foods.map(f => '  ' + JSON.stringify(f)).join(',\n')}
];
`);
console.log(`Wrote ${foods.length} foods (${foods.filter(f => f.per100g.imputed).length} with imputed values, ${foods.filter(f => f.yield_factor).length} with yield factors) to ${OUT}`);
