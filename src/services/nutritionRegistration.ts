/**
 * The nutrition screen taken at registration, saved into the patient's
 * Clinical Nutrition record (not the legacy nutritional_assessments table):
 * the measured weight and height as measurements, and an engine assessment
 * submitted for approval so it reaches the dietitian worklist.
 *
 * Never throws — registration must not fail because of nutrition.
 */
import { assessNutrition, assessmentSummary, buildInputs, NUTRITION_CONFIG, type PatientContext } from '../clinical/nutrition';
import type { StoredMeasurement } from '../clinical/nutrition/fromRecord';
import { nutritionService } from './nutritionService';

export interface RegistrationScreen {
  weightKg?: number | null;
  heightCm?: number | null;
  weightLossPct?: number | null;
  acuteNoIntake5d?: boolean;
  comorbidities?: string[];
}

const ok = (x: unknown): x is number => typeof x === 'number' && Number.isFinite(x) && x > 0;

/** Comorbidity free text → engine flags (shared with the registration plan). */
export function comorbidityFlags(list: string[] = []) {
  const cm = list.map(x => String(x).toLowerCase());
  const has = (re: RegExp) => cm.some(x => re.test(x));
  return { diabetes: has(/diabet/), ckd: has(/renal|kidney|ckd/), liverDisease: has(/liver|hepat|cirrho/), heartFailure: has(/heart_failure|heart failure|cardiac_failure|ccf|chf/) };
}

export async function recordRegistrationScreen(patientId: string, s: RegistrationScreen, ctx: PatientContext): Promise<{ saved: boolean; must: number | null; error?: string }> {
  try {
    const now = new Date().toISOString();
    const measurements: StoredMeasurement[] = [];
    for (const [kind, value] of [['weight', s.weightKg], ['height', s.heightCm]] as const) {
      if (!ok(value)) continue;
      try {
        await nutritionService.addMeasurement({ patient_id: patientId, kind, value, method: kind === 'weight' ? 'measured' : undefined, measured_at: now, note: 'Recorded at registration' });
      } catch { /* implausible value or offline: the assessment still uses it below, flagged by the engine */ }
      measurements.push({ id: `reg-${kind}`, kind, value, unit: kind === 'weight' ? 'kg' : 'cm', method: kind === 'weight' ? 'measured' : null, measured_at: now, source: 'nutrition' });
    }
    const answers = {
      weightLossPct3to6m: s.weightLossPct != null && Number.isFinite(s.weightLossPct) ? Math.max(0, s.weightLossPct) : null,
      acutelyIllNoIntake5d: !!s.acuteNoIntake5d,
      ...comorbidityFlags(s.comorbidities),
    };
    const result = assessNutrition(buildInputs(measurements, answers, ctx));
    if (!result.screening.must && !measurements.length) return { saved: false, must: null, error: 'No weight or height at registration' };
    const rec = await nutritionService.saveAssessment({
      patient_id: patientId, config_version: NUTRITION_CONFIG.version,
      inputs: { answers, context: ctx, source: 'registration' }, result, summary: assessmentSummary(result),
    });
    try { await nutritionService.submit('assessment', rec.id, rec.version); } catch { /* stays a draft — still on the worklist */ }
    return { saved: true, must: result.screening.must?.value ?? null };
  } catch (e: any) {
    return { saved: false, must: null, error: String(e?.message || e) };
  }
}
