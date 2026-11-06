/**
 * Stored measurements → engine inputs. The latest value of each kind wins;
 * weights become the weight history. Lab values carry their date so the form
 * can show how old each one is.
 */
import type { NutritionInputs } from './types';

export interface StoredMeasurement {
  id: number | string;
  kind: string;
  value: number;
  unit: string;
  method?: string | null;
  measured_at: string;
  source?: 'nutrition' | 'vital_signs' | 'lab_orders';
}

const LAB_FIELD: Record<string, keyof NonNullable<NutritionInputs['labs']>> = {
  albumin: 'albuminGL', prealbumin: 'prealbuminGL', crp: 'crpMgL', hb: 'hbGL', lymphocytes: 'lymphocytes109L', glucose: 'glucoseMmolL',
  hba1c: 'hba1cPct', urea: 'ureaMmolL', creatinine: 'creatinineUmolL', na: 'naMmolL', k: 'kMmolL', po4: 'po4MmolL', mg: 'mgMmolL', uun: 'uunG',
};
const BODY_FIELD: Record<string, keyof NutritionInputs> = {
  height: 'heightCm', knee_height: 'kneeHeightCm', ulna: 'ulnaCm', muac: 'muacCm', tsf: 'tsfMm', calf: 'calfCm', grip: 'gripKg',
  phase_angle: 'phaseAngle', quadriceps: 'quadricepsMm', dressing_weight: 'dressingKg', indirect_calorimetry: 'indirectCalorimetryKcal',
};

export function latestByKind(ms: StoredMeasurement[]): Record<string, StoredMeasurement> {
  const out: Record<string, StoredMeasurement> = {};
  for (const m of ms) {
    const cur = out[m.kind];
    if (!cur || Date.parse(m.measured_at) >= Date.parse(cur.measured_at)) out[m.kind] = m;
  }
  return out;
}

/** Inputs derived from stored measurements; form answers are layered on top by the caller. */
export function inputsFromMeasurements(ms: StoredMeasurement[]): Partial<NutritionInputs> {
  const last = latestByKind(ms);
  const i: Partial<NutritionInputs> = {};
  const labs: NonNullable<NutritionInputs['labs']> = {};
  for (const [kind, m] of Object.entries(last)) {
    if (LAB_FIELD[kind]) (labs as any)[LAB_FIELD[kind]] = m.value;
    else if (BODY_FIELD[kind]) (i as any)[BODY_FIELD[kind]] = m.value;
  }
  if (last.height) i.heightMeasured = last.height.method !== 'reported';
  if (last.weight) {
    i.weightKg = last.weight.value;
    i.weightMethod = (['measured', 'bed_scale', 'hoist', 'reported'].includes(String(last.weight.method)) ? last.weight.method : 'measured') as NutritionInputs['weightMethod'];
  }
  i.weightHistory = ms.filter(m => m.kind === 'weight').map(m => ({ date: m.measured_at, kg: m.value }));
  if (Object.keys(labs).length) i.labs = labs;
  return i;
}

/** Time series of one kind, for charts and monitoring alerts. */
export const seriesOf = (ms: StoredMeasurement[], kind: string) =>
  ms.filter(m => m.kind === kind).map(m => ({ date: m.measured_at, value: m.value }));
