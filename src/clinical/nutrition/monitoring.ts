/**
 * Monitoring: the measurement schedule by risk, the six trend alerts, intake
 * conversion (fraction eaten → kcal/protein) and the "what changed and why"
 * diff between two assessments.
 */
import type { NutritionConfig } from './config/nutrition.v1';
import type { NutritionAssessment } from './assess';

export type Point = { date: string; value: number };
const byDate = (s: Point[] = []) => [...s].filter(p => Number.isFinite(p.value) && !Number.isNaN(Date.parse(p.date))).sort((a, b) => Date.parse(a.date) - Date.parse(b.date));
const DAY = 86_400_000;

// ── Schedule ────────────────────────────────────────────────────────────────
export type ScheduleLevel = 'low' | 'medium' | 'high' | 'refeeding';
export function scheduleFor(level: ScheduleLevel, cfg: NutritionConfig) {
  const s = cfg.schedule.value[level];
  return [
    { what: 'Food and fluid intake', when: s.intake },
    { what: 'Weight', when: s.weight },
    { what: 'MUAC and calf circumference', when: s.muacCalf },
    { what: 'Hand-grip strength', when: s.grip },
    { what: 'Laboratory', when: s.labs },
    { what: 'Re-screen', when: s.rescreen },
  ];
}

// ── Intake ──────────────────────────────────────────────────────────────────
export type Fraction = 0 | 0.25 | 0.5 | 0.75 | 1;
export interface IntakeItem { planned: { kcal: number; proteinG: number }; eaten: Fraction }
export interface IntakeDay {
  items?: IntakeItem[];
  /** Extra foods not on the plan, already in kcal/protein. */
  extras?: { kcal: number; proteinG: number }[];
  supplements?: { kcal: number; proteinG: number; servings: number }[];
  enteral?: { ml: number; kcalPerMl: number; proteinGPerL: number };
}
export function intakeTotals(d: IntakeDay) {
  let kcal = 0, proteinG = 0;
  for (const it of d.items || []) { kcal += it.planned.kcal * it.eaten; proteinG += it.planned.proteinG * it.eaten; }
  for (const x of d.extras || []) { kcal += x.kcal; proteinG += x.proteinG; }
  for (const s of d.supplements || []) { kcal += s.kcal * s.servings; proteinG += s.proteinG * s.servings; }
  if (d.enteral) { kcal += d.enteral.ml * d.enteral.kcalPerMl; proteinG += (d.enteral.ml / 1000) * d.enteral.proteinGPerL; }
  return { kcal: Math.round(kcal), proteinG: Math.round(proteinG * 10) / 10 };
}

// ── Alerts ──────────────────────────────────────────────────────────────────
export interface MonitoringSeries {
  /** % of the energy target achieved, one point per day. */
  intakePct?: Point[];
  muac?: Point[];
  calf?: Point[];
  prealbumin?: Point[];
  crp?: Point[];
  nBalance?: Point[];
  weight?: Point[];
  latestLabs?: { kMmolL?: number | null; po4MmolL?: number | null; mgMmolL?: number | null };
  refeedingRisk?: 'low' | 'high' | 'extreme';
  /** Planned weekly change in kg (negative = loss). */
  plannedRateKgWk?: number | null;
}
export interface Alert { id: string; severity: 'warning' | 'urgent'; text: string }

export function monitoringAlerts(s: MonitoringSeries, cfg: NutritionConfig): Alert[] {
  const A = cfg.alerts.value;
  const out: Alert[] = [];

  const intake = byDate(s.intakePct);
  let run = 0;
  for (let k = intake.length - 1; k >= 0 && intake[k].value < A.lowIntakePct; k--) run++;
  if (run >= A.lowIntakeDays) out.push({ id: 'low_intake', severity: 'warning', text: `Intake below ${A.lowIntakePct}% of target for ${run} consecutive days — review barriers, consider supplements or tube feeding` });

  for (const [id, label, series] of [['muac_drop', 'MUAC', s.muac], ['calf_drop', 'Calf circumference', s.calf]] as const) {
    const p = byDate(series);
    if (p.length >= 2) {
      const drop = ((p[0].value - p[p.length - 1].value) / p[0].value) * 100;
      if (drop >= A.muacCalfDropPct) out.push({ id, severity: 'warning', text: `${label} down ${Math.round(drop * 10) / 10}% from baseline (${p[0].value} → ${p[p.length - 1].value} cm)` });
    }
  }

  const pa = byDate(s.prealbumin), crp = byDate(s.crp);
  if (pa.length >= 2) {
    const prev = pa[pa.length - 2], last = pa[pa.length - 1];
    const fall = ((prev.value - last.value) / prev.value) * 100;
    if (fall >= cfg.prealbuminFallPct.value) {
      const c = crp.filter(x => Date.parse(x.date) <= Date.parse(last.date) + DAY);
      const crpNotRising = c.length >= 2 ? c[c.length - 1].value <= c[c.length - 2].value : null;
      if (crpNotRising) out.push({ id: 'prealbumin_fall', severity: 'warning', text: `Prealbumin fell ${Math.round(fall)}% while CRP was stable or falling — suggests inadequate intake rather than inflammation` });
    }
  }

  const nb = byDate(s.nBalance);
  if (nb.length >= A.negativeNBalanceRuns && nb.slice(-A.negativeNBalanceRuns).every(p => p.value < 0)) {
    out.push({ id: 'negative_n', severity: 'warning', text: `Negative nitrogen balance on ${A.negativeNBalanceRuns} consecutive measurements — increase protein` });
  }

  if (s.refeedingRisk && s.refeedingRisk !== 'low' && s.latestLabs) {
    const R = cfg.refeeding.value, L = s.latestLabs;
    const low = [L.kMmolL != null && L.kMmolL < R.lowK && `K ${L.kMmolL}`, L.po4MmolL != null && L.po4MmolL < R.lowPO4 && `PO₄ ${L.po4MmolL}`, L.mgMmolL != null && L.mgMmolL < R.lowMg && `Mg ${L.mgMmolL}`].filter(Boolean);
    if (low.length) out.push({ id: 'refeeding_labs', severity: 'urgent', text: `Refeeding risk with low ${low.join(', ')} mmol/L — replace, slow feeding advancement and recheck daily` });
  }

  const w = byDate(s.weight);
  if (s.plannedRateKgWk && w.length >= 2) {
    const first = w[0], last = w[w.length - 1];
    const weeks = (Date.parse(last.date) - Date.parse(first.date)) / (7 * DAY);
    if (weeks >= 2) {
      const rate = (last.value - first.value) / weeks;
      const planned = s.plannedRateKgWk;
      if (Math.sign(rate) === Math.sign(planned) && Math.abs(rate) > Math.abs(planned) * cfg.rateTooFastFactor.value) {
        out.push({ id: 'rate_too_fast', severity: 'warning', text: `Weight ${rate < 0 ? 'loss' : 'gain'} of ${Math.abs(Math.round(rate * 100) / 100)} kg/week exceeds the planned ${Math.abs(planned)} kg/week — reassess the plan` });
      }
    }
  }
  return out;
}

// ── Recalculation diff ──────────────────────────────────────────────────────
export interface Change { what: string; from: string; to: string; why: string[] }

export function diffAssessments(prev: NutritionAssessment, next: NutritionAssessment): Change[] {
  const changes: Change[] = [];
  const inputsChanged = (keys: string[]) => keys.filter(k => JSON.stringify((prev.inputs as any)[k]) !== JSON.stringify((next.inputs as any)[k])).map(k => `${k} changed`);
  const cmp = (what: string, a: unknown, b: unknown, keys: string[]) => {
    const fa = a == null ? '—' : String(a), fb = b == null ? '—' : String(b);
    if (fa !== fb) changes.push({ what, from: fa, to: fb, why: inputsChanged(keys) });
  };
  cmp('Working weight (kg)', prev.weight?.value, next.weight?.value, ['weightKg', 'weightMethod', 'dressingKg', 'kneeHeightCm', 'muacCm', 'amputations']);
  cmp('BMI', prev.bmi?.value, next.bmi?.value, ['weightKg', 'heightCm', 'kneeHeightCm', 'ulnaCm']);
  cmp('MUST', prev.screening.must?.value, next.screening.must?.value, ['weightKg', 'weightHistory', 'weightLossPct3to6m', 'acutelyIllNoIntake5d', 'muacCm']);
  cmp('GLIM', prev.screening.glim.value, next.screening.glim.value, ['weightHistory', 'weightLossPct3to6m', 'muscleMass', 'calfCm', 'intakePctOfNeeds', 'labs', 'sepsis']);
  cmp('Energy target (kcal)', prev.targets.kcal, next.targets.kcal, ['weightKg', 'goal', 'targetRateKgWk', 'mobility', 'stress', 'icu', 'ventilated', 'tbsaPct', 'indirectCalorimetryKcal', 'energyMethod']);
  cmp('Energy method', prev.energy.selected?.label, next.energy.selected?.label, ['energyMethod', 'icu', 'ventilated', 'tbsaPct', 'indirectCalorimetryKcal']);
  cmp('Protein target (g)', prev.targets.proteinG, next.targets.proteinG, ['weightKg', 'ckd', 'icu', 'tbsaPct', 'woundAreaCm2', 'exudate']);
  cmp('Refeeding risk', prev.refeeding.risk, next.refeeding.risk, ['daysLittleOrNoIntake', 'labs', 'alcoholMisuse', 'refeedingDrugs', 'weightHistory']);
  return changes;
}
