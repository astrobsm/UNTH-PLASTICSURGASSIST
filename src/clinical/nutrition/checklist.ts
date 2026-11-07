/**
 * Validation checklist: every coefficient and threshold in the active
 * configuration, generated from the config itself so it can never drift from
 * what the engine uses. Recipes and household measures awaiting verification
 * are appended from the food database by the caller.
 */
import { NUTRITION_CONFIG } from './config';
import type { NutritionConfig } from './config/nutrition.v1';

export interface ChecklistRow { key: string; value: string; source: string; note?: string }

const fmt = (v: unknown): string => (v !== null && typeof v === 'object' ? JSON.stringify(v).replace(/"/g, '').replace(/,/g, ', ') : String(v));

export function coefficientChecklist(cfg: NutritionConfig = NUTRITION_CONFIG): ChecklistRow[] {
  const rows: ChecklistRow[] = [];
  const walk = (o: any, path: string[]) => {
    if (!o || typeof o !== 'object') return;
    if ('value' in o && 'source' in o) { rows.push({ key: path.join(' › '), value: fmt(o.value), source: String(o.source), ...(o.note ? { note: String(o.note) } : {}) }); return; }
    for (const [k, v] of Object.entries(o)) if (k !== 'version' && k !== 'status') walk(v, [...path, k]);
    if (typeof o.note === 'string' && path.length) rows.push({ key: [...path, 'note'].join(' › '), value: '—', source: o.note });
  };
  walk(cfg, []);
  return rows;
}
