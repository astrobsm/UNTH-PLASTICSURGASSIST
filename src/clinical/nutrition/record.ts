/**
 * Patient nutrition record → engine inputs, monitoring series, stored summary
 * and planner options. Pure, so the profile panel, ward round, burns card,
 * worklist and PDFs all read a patient the same way.
 */
import { NUTRITION_CONFIG } from './config';
import type { NutritionConfig } from './config/nutrition.v1';
import { assessNutrition, type NutritionAssessment } from './assess';
import { inputsFromMeasurements, latestByKind, seriesOf, type StoredMeasurement } from './fromRecord';
import { diffAssessments, monitoringAlerts, scheduleFor, type MonitoringSeries, type Point } from './monitoring';
import type { PlannerOptions } from './planner';
import type { NutritionInputs } from './types';

export interface PatientContext {
  ageYears?: number | null;
  sex?: string | null;
  allergies?: string | null;
  ward?: string | null;
  diagnosis?: string | null;
}
interface IntakeRow { intake_date: string; kcal: number; protein_g: number; target_kcal?: number | null }
interface AssessmentRow { id: number; status: string; created_at: string; inputs: any; result: any; summary: any; config_version: string }

export const normaliseSex = (s?: string | null): 'male' | 'female' | null => {
  const v = String(s || '').toLowerCase();
  return v.startsWith('m') ? 'male' : v.startsWith('f') ? 'female' : null;
};

/** Stored measurements + the clinician's form answers + patient context → engine inputs. */
export function buildInputs(measurements: StoredMeasurement[], answers: Partial<NutritionInputs>, ctx: PatientContext): NutritionInputs {
  const fromMeas = inputsFromMeasurements(measurements);
  const allergies = String(ctx.allergies || '').split(/[,;]+/).map(x => x.trim()).filter(x => x && !/^(nil|none|nkda|no known)/i.test(x));
  const dietary = { ...(answers.dietary || {}) };
  if (allergies.length && !dietary.allergies?.length) dietary.allergies = allergies;
  return {
    ageYears: ctx.ageYears ?? null,
    sex: normaliseSex(ctx.sex),
    ward: ctx.ward || undefined,
    diagnosis: ctx.diagnosis || undefined,
    ...fromMeas,
    ...answers,
    labs: { ...(fromMeas.labs || {}), ...(answers.labs || {}) },
    dietary,
  };
}

export const liveAssessments = (rows: AssessmentRow[]) => rows.filter(a => a.status !== 'entered_in_error');
export const latestAssessment = (rows: AssessmentRow[]) => liveAssessments(rows)[0] || null;

/** What the assessment table stores as its summary (also used by the worklist and other modules). */
export function assessmentSummary(a: NutritionAssessment) {
  return {
    level: a.level,
    in_scope: a.scope.inScope,
    scope_notice: a.scope.notice,
    kcal: a.targets.kcal,
    protein_g: a.targets.proteinG,
    fluid_ml: a.targets.fluidMl,
    energy_method: a.energy.selected?.label ?? null,
    must: a.screening.must?.value ?? null,
    glim: a.screening.glim.value,
    nutric: a.screening.nutric?.value ?? null,
    refeeding: a.refeeding.risk,
    bmi: a.bmi?.value ?? null,
    weight_kg: a.weight?.value ?? null,
    weight_estimated: !!a.weight?.estimated,
    goal: a.goal?.goal ?? 'maintain',
    rate_kg_wk: a.goal?.rateKgWk ?? 0,
    catabolic: a.catabolic,
    warnings: a.warnings.slice(0, 8),
  };
}
export type AssessmentSummary = ReturnType<typeof assessmentSummary>;

/** Daily % of energy target achieved, from per-meal intake rows. */
export function intakePctSeries(intake: IntakeRow[], fallbackTarget: number | null): Point[] {
  const byDay = new Map<string, { kcal: number; target: number | null }>();
  for (const r of intake) {
    const d = String(r.intake_date).slice(0, 10);
    const cur = byDay.get(d) || { kcal: 0, target: null };
    cur.kcal += Number(r.kcal) || 0;
    cur.target = cur.target ?? (r.target_kcal ? Number(r.target_kcal) : null);
    byDay.set(d, cur);
  }
  return [...byDay.entries()].map(([date, v]) => {
    const t = v.target ?? fallbackTarget;
    return t ? { date, value: Math.round((v.kcal / t) * 100) } : null;
  }).filter((x): x is Point => !!x).sort((a, b) => a.date.localeCompare(b.date));
}

/** Nitrogen balance per day that has both a 24-h UUN and recorded protein intake. */
export function nitrogenSeries(measurements: StoredMeasurement[], intake: IntakeRow[], cfg: NutritionConfig = NUTRITION_CONFIG): Point[] {
  const proteinByDay = new Map<string, number>();
  for (const r of intake) proteinByDay.set(String(r.intake_date).slice(0, 10), (proteinByDay.get(String(r.intake_date).slice(0, 10)) ?? 0) + Number(r.protein_g || 0));
  const k = cfg.nitrogen.value;
  return seriesOf(measurements, 'uun').map(u => {
    const d = u.date.slice(0, 10), p = proteinByDay.get(d);
    return p === undefined ? null : { date: d, value: Math.round((p / k.proteinToN - (u.value + k.insensibleG)) * 10) / 10 };
  }).filter((x): x is Point => !!x);
}

export function monitoringSeriesFor(measurements: StoredMeasurement[], intake: IntakeRow[], summary: Partial<AssessmentSummary> | null): MonitoringSeries {
  const last = latestByKind(measurements);
  return {
    intakePct: intakePctSeries(intake, summary?.kcal ?? null),
    muac: seriesOf(measurements, 'muac'), calf: seriesOf(measurements, 'calf'),
    prealbumin: seriesOf(measurements, 'prealbumin'), crp: seriesOf(measurements, 'crp'),
    weight: seriesOf(measurements, 'weight'), nBalance: nitrogenSeries(measurements, intake),
    latestLabs: { kMmolL: last.k?.value ?? null, po4MmolL: last.po4?.value ?? null, mgMmolL: last.mg?.value ?? null },
    refeedingRisk: (summary?.refeeding as MonitoringSeries['refeedingRisk']) ?? 'low',
    plannedRateKgWk: summary?.goal === 'lose' ? -(summary.rate_kg_wk ?? 0) : summary?.goal === 'gain' ? (summary.rate_kg_wk ?? 0) : null,
  };
}

/** Alerts, schedule and the "reassessment due" check for a patient's current record. */
export function patientStatus(record: { measurements: StoredMeasurement[]; intake: IntakeRow[]; assessments: AssessmentRow[] }, ctx: PatientContext, now = new Date(), cfg: NutritionConfig = NUTRITION_CONFIG) {
  const latest = latestAssessment(record.assessments);
  const summary: Partial<AssessmentSummary> | null = latest?.summary ?? null;
  const alerts = monitoringAlerts(monitoringSeriesFor(record.measurements, record.intake, summary), cfg);
  const level = (summary?.level as any) ?? 'medium';
  const schedule = scheduleFor(level, cfg);
  let changes: ReturnType<typeof diffAssessments> = [];
  let due: string | null = null;
  if (!latest) due = 'No nutrition assessment yet';
  else {
    const ageDays = (now.getTime() - Date.parse(latest.created_at)) / 86_400_000;
    if (ageDays >= 7) due = `Last assessment ${Math.floor(ageDays)} days ago — weekly recalculation due`;
    try {
      const prev = latest.result as NutritionAssessment;
      const fresh = assessNutrition(buildInputs(record.measurements, latest.inputs?.answers || {}, ctx), cfg, now);
      changes = prev?.targets ? diffAssessments(prev, fresh) : [];
      if (changes.length && !due) due = 'New measurements change the targets — review and save a new assessment';
    } catch { /* an older stored result shape — the form will recalculate */ }
  }
  if (latest && latest.config_version !== cfg.version) due = `Assessment used coefficients ${latest.config_version}; current is ${cfg.version} — recalculate`;
  return { latest, summary, alerts, schedule, level, changes, due };
}

/** Planner options from a stored assessment result and the dietary answers. */
export function plannerOptionsFrom(result: NutritionAssessment, seed: string, ons?: PlannerOptions['ons'], cfg: NutritionConfig = NUTRITION_CONFIG): PlannerOptions | null {
  if (!result?.scope?.inScope || !result.targets?.kcal || !result.targets?.proteinG) return null;
  const i = result.inputs || {};
  const diet = i.dietary || {};
  const sodium = i.heartFailure || i.ckd ? cfg.sodiumRestrictedMg.value : null;
  const schedule = result.refeeding?.schedule?.length ? result.refeeding.schedule.map(d => d.kcal) : undefined;
  return {
    targets: {
      kcal: result.targets.kcal, proteinG: result.targets.proteinG,
      carbMaxG: i.diabetes ? Math.round((result.targets.kcal * cfg.diabetesCarbMaxPct.value) / 100 / 4) : null,
      sodiumMaxMg: sodium,
    },
    dailyKcal: schedule ? Array.from({ length: 7 }, (_, d) => schedule[Math.min(d, schedule.length - 1)]) : undefined,
    goal: result.goal?.goal ?? 'maintain',
    baseKcal: result.goal?.baseKcal ?? null,
    startWeightKg: result.weight?.value ?? null,
    texture: diet.texture, allergies: diet.allergies, religious: diet.religious, budget: diet.budget, mealsBy: diet.mealsBy,
    ons: ons ?? null, seed,
  };
}
