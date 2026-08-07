/**
 * The remaining bedside calculator panels.
 *
 * Every panel here is a form over logic that already exists elsewhere in this
 * app — the acid-base engine, the electrolyte replacement engine, the burn care
 * service, the risk assessment service, the Nigerian food composition data.
 * None of it is reimplemented, so a figure shown here matches the figure the
 * corresponding module shows.
 *
 * Where a full recording module exists (burns, pressure sore, VTE), the panel
 * computes and then points at it. A calculator cannot write to the chart, and
 * a score that is never recorded is a score nobody can audit.
 */

import React, { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { AlertTriangle, ArrowUpRight, Info } from 'lucide-react';
import {
  acidBase, electrolyteCorrection, egfrCkdEpi, woundHealingMealPlan,
  type ElectrolyteFinding, type WoundSeverity,
} from '../../services/clinicianAssistant/clinicalCalculators';
import type { Sex } from '../../services/clinicianAssistant/calculators';
import { generateMealPlan, type DayPlan } from '../../data/nigerianFoods';
import { burnCareService } from '../../services/burnCareService';
import { riskAssessmentService } from '../../services/riskAssessmentService';

// ── shared bits ───────────────────────────────────────────────────────────

export const num = (v: string): number => {
  const n = parseFloat(v);
  return Number.isFinite(n) ? n : 0;
};
export const numOrNull = (v: string): number | null => {
  if (v.trim() === '') return null;
  const n = parseFloat(v);
  return Number.isFinite(n) ? n : null;
};

const Field = ({ label, children, hint }: { label: string; children: React.ReactNode; hint?: string }) => (
  <div>
    <label className="block text-sm font-medium text-gray-700 mb-1">{label}</label>
    {children}
    {hint && <p className="text-xs text-gray-500 mt-0.5">{hint}</p>}
  </div>
);

const Stat = ({ label, value, unit, tone }: { label: string; value: React.ReactNode; unit?: string; tone?: string }) => (
  <div className={`rounded-lg border p-3 ${tone || 'bg-gray-50 border-gray-200'}`}>
    <div className="text-xs text-gray-600">{label}</div>
    <div className="text-lg font-bold text-gray-900">
      {value}{unit && <span className="text-sm font-normal text-gray-600 ml-1">{unit}</span>}
    </div>
  </div>
);

const ModuleLink = ({ to, children }: { to: string; children: React.ReactNode }) => (
  <Link to={to} className="inline-flex items-center gap-1 text-sm font-medium text-primary-700 hover:underline">
    {children} <ArrowUpRight className="w-3.5 h-3.5" />
  </Link>
);

const Note = ({ children, tone = 'info' }: { children: React.ReactNode; tone?: 'info' | 'warn' | 'danger' }) => (
  <div className={`rounded-lg border p-3 text-sm flex gap-2 ${
    tone === 'danger' ? 'bg-red-50 border-red-300 text-red-900'
      : tone === 'warn' ? 'bg-amber-50 border-amber-300 text-amber-900'
      : 'bg-blue-50 border-blue-200 text-blue-900'
  }`}>
    {tone === 'info' ? <Info className="w-4 h-4 flex-shrink-0 mt-0.5" /> : <AlertTriangle className="w-4 h-4 flex-shrink-0 mt-0.5" />}
    <div>{children}</div>
  </div>
);

// ── Acid-base ─────────────────────────────────────────────────────────────

export function AcidBasePanel() {
  const [ph, setPh] = useState('');
  const [paco2, setPaco2] = useState('');
  const [unit, setUnit] = useState<'kPa' | 'mmHg'>('kPa');
  const [hco3, setHco3] = useState('');
  const [na, setNa] = useState('');
  const [cl, setCl] = useState('');
  const [alb, setAlb] = useState('');

  const r = useMemo(() => acidBase({
    ph: numOrNull(ph), paco2: numOrNull(paco2), paco2Unit: unit,
    hco3: numOrNull(hco3), sodium: numOrNull(na), chloride: numOrNull(cl), albumin: numOrNull(alb),
  }), [ph, paco2, unit, hco3, na, cl, alb]);

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <Field label="pH"><input type="number" step="0.01" value={ph} onChange={e => setPh(e.target.value)} className="input" /></Field>
        <Field label={`PaCO₂ (${unit})`}>
          <div className="flex gap-1">
            <input type="number" step="0.1" value={paco2} onChange={e => setPaco2(e.target.value)} className="input" />
            <select value={unit} onChange={e => setUnit(e.target.value as 'kPa' | 'mmHg')} className="input w-24">
              <option value="kPa">kPa</option>
              <option value="mmHg">mmHg</option>
            </select>
          </div>
        </Field>
        <Field label="Bicarbonate (mmol/L)"><input type="number" step="0.1" value={hco3} onChange={e => setHco3(e.target.value)} className="input" /></Field>
        <Field label="Albumin (g/dL)" hint="Corrects the gap"><input type="number" step="0.1" value={alb} onChange={e => setAlb(e.target.value)} className="input" /></Field>
        <Field label="Sodium (mmol/L)"><input type="number" value={na} onChange={e => setNa(e.target.value)} className="input" /></Field>
        <Field label="Chloride (mmol/L)"><input type="number" value={cl} onChange={e => setCl(e.target.value)} className="input" /></Field>
      </div>

      {r.interpretation && (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <Stat label="Primary disorder" value={r.interpretation.primary}
              tone={r.interpretation.primary === 'normal' ? undefined : 'bg-amber-50 border-amber-300'} />
            <Stat label="Compensation" value={r.interpretation.compensation}
              tone={r.interpretation.compensation === 'appropriate' ? 'bg-green-50 border-green-200' : undefined} />
            <Stat label="Anion gap" value={r.correctedAnionGap != null ? r.correctedAnionGap.toFixed(1) : r.anionGap != null ? r.anionGap.toFixed(1) : '—'}
              unit={r.correctedAnionGap != null ? '(corrected)' : ''}
              tone={(r.correctedAnionGap ?? r.anionGap ?? 0) > 12 ? 'bg-amber-50 border-amber-300' : undefined} />
          </div>
          <p className="text-sm text-gray-700">{r.interpretation.narrative}</p>
        </>
      )}

      {r.notes.length > 0 && (
        <ul className="list-disc pl-5 text-sm text-gray-700 space-y-0.5">
          {r.notes.map((n, i) => <li key={i}>{n}</li>)}
        </ul>
      )}
    </div>
  );
}

// ── Electrolyte replacement ───────────────────────────────────────────────

const ELECTROLYTES: Record<string, {
  label: string; unit: string; key: string;
  low: ElectrolyteFinding; high: ElectrolyteFinding;
  lowCut: number; highCut: number;
}> = {
  sodium:    { label: 'Sodium',    unit: 'mmol/L', key: 'na', low: 'lyte.hyponatraemia', high: 'lyte.hypernatraemia', lowCut: 135, highCut: 145 },
  potassium: { label: 'Potassium', unit: 'mmol/L', key: 'k',  low: 'lyte.hypokalaemia',  high: 'lyte.hyperkalaemia',  lowCut: 3.5, highCut: 5.3 },
};

export function ElectrolytePanel({
  analyte, weightKg, ageYears, sex,
}: { analyte: 'sodium' | 'potassium'; weightKg: number; ageYears: number; sex: Sex }) {
  const cfg = ELECTROLYTES[analyte];
  const [value, setValue] = useState('');
  const [severity, setSeverity] = useState<'mild' | 'moderate' | 'severe' | 'critical'>('moderate');

  useEffect(() => { setValue(''); }, [analyte]);

  const v = numOrNull(value);
  const direction = v == null ? null : v < cfg.lowCut ? 'low' : v > cfg.highCut ? 'high' : 'normal';

  const plan = useMemo(() => {
    if (v == null || direction === 'normal' || direction === null) return null;
    return electrolyteCorrection({
      finding: direction === 'low' ? cfg.low : cfg.high,
      values: { [cfg.key]: v },
      weightKg: weightKg || null,
      ageYears: ageYears || null,
      sex,
      severity,
    });
  }, [v, direction, cfg, weightKg, ageYears, sex, severity]);

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
        <Field label={`${cfg.label} (${cfg.unit})`}>
          <input type="number" step="0.1" value={value} onChange={e => setValue(e.target.value)} className="input" />
        </Field>
        <Field label="Clinical severity" hint="Symptoms, not the number alone">
          <select value={severity} onChange={e => setSeverity(e.target.value as any)} className="input">
            <option value="mild">Mild — asymptomatic</option>
            <option value="moderate">Moderate</option>
            <option value="severe">Severe — symptomatic</option>
            <option value="critical">Critical — seizures / arrhythmia</option>
          </select>
        </Field>
      </div>

      {direction === 'normal' && (
        <Note>{cfg.label} of {v} {cfg.unit} is within the reference interval. No replacement is indicated.</Note>
      )}

      {v == null && (
        <p className="text-sm text-gray-600">Enter a {cfg.label.toLowerCase()} to generate a correction plan.</p>
      )}

      {plan && (
        <div className="space-y-3">
          <div>
            <h3 className="font-semibold text-gray-900">{plan.title}</h3>
            <p className="text-sm text-gray-600">Measured {plan.measured} · Target {plan.target}</p>
          </div>

          {plan.deficit && (
            <div className="rounded-lg border bg-gray-50 p-3">
              <div className="text-xs text-gray-600">{plan.deficit.label}</div>
              <div className="text-lg font-bold text-gray-900">{plan.deficit.value}</div>
              <p className="text-xs text-gray-600 mt-0.5">{plan.deficit.note}</p>
            </div>
          )}

          {plan.prerequisites && plan.prerequisites.length > 0 && (
            <Note tone="warn">
              <span className="font-medium">Correct first:</span>
              <ul className="list-disc pl-5 mt-1 space-y-0.5">
                {plan.prerequisites.map((p, i) => <li key={i}>{p}</li>)}
              </ul>
            </Note>
          )}

          <div>
            <p className="font-semibold text-sm text-gray-900 mb-1">Plan</p>
            <ol className="list-decimal pl-5 text-sm text-gray-700 space-y-1">
              {plan.steps.map((s: any, i: number) => (
                <li key={i}>
                  {typeof s === 'string' ? s : (
                    <>
                      <span className="font-medium">{s.title ?? s.label ?? ''}</span>
                      {s.detail && <span> — {s.detail}</span>}
                      {s.text && <span>{s.text}</span>}
                    </>
                  )}
                </li>
              ))}
            </ol>
          </div>

          {plan.hardLimits.length > 0 && (
            <Note tone="danger">
              <span className="font-medium">Hard limits — do not exceed whatever the deficit suggests:</span>
              <ul className="list-disc pl-5 mt-1 space-y-0.5">
                {plan.hardLimits.map((h, i) => <li key={i}>{h}</li>)}
              </ul>
            </Note>
          )}

          {plan.monitoring.length > 0 && (
            <div>
              <p className="font-semibold text-sm text-gray-900 mb-1">Monitoring</p>
              <ul className="list-disc pl-5 text-sm text-gray-700 space-y-0.5">
                {plan.monitoring.map((m, i) => <li key={i}>{m}</li>)}
              </ul>
            </div>
          )}
        </div>
      )}

      {!weightKg && v != null && direction !== 'normal' && (
        <p className="text-xs text-amber-700">Enter a weight — deficit estimates depend on total body water.</p>
      )}
    </div>
  );
}

// ── eGFR ──────────────────────────────────────────────────────────────────

export function GfrPanel({
  ageYears, sex, onGfr,
}: { ageYears: number; sex: Sex; onGfr?: (v: number | null) => void }) {
  const [creat, setCreat] = useState('');
  const [unit, setUnit] = useState<'umol' | 'mgdl'>('umol');

  const umol = useMemo(() => {
    const n = numOrNull(creat);
    if (n == null) return null;
    return unit === 'mgdl' ? n * 88.4 : n;
  }, [creat, unit]);

  const r = useMemo(
    () => egfrCkdEpi({ creatinineUmolL: umol, ageYears: ageYears || null, sex }),
    [umol, ageYears, sex]
  );

  useEffect(() => { onGfr?.(r.egfr); }, [r.egfr, onGfr]);

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
        <Field label="Creatinine">
          <div className="flex gap-1">
            <input type="number" step="0.01" value={creat} onChange={e => setCreat(e.target.value)} className="input" />
            <select value={unit} onChange={e => setUnit(e.target.value as any)} className="input w-28">
              <option value="umol">µmol/L</option>
              <option value="mgdl">mg/dL</option>
            </select>
          </div>
        </Field>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <Stat label="eGFR (CKD-EPI 2021)" value={r.egfr ?? '—'} unit={r.egfr != null ? 'mL/min/1.73m²' : ''}
          tone={r.egfr != null && r.egfr < 60 ? 'bg-amber-50 border-amber-300' : undefined} />
        <Stat label="CKD stage" value={r.stage} />
      </div>

      <p className="text-sm text-gray-700">{r.note}</p>

      <Note>
        This is the 2021 race-free equation. The older version applied a coefficient for Black
        patients that has been withdrawn; it overestimated kidney function and delayed referral.
        {r.egfr != null && <> The BNF tab uses this eGFR for renal dosing warnings.</>}
      </Note>

      {!ageYears && <p className="text-xs text-amber-700">Enter an age — the equation depends on it.</p>}
    </div>
  );
}

// ── Burns ─────────────────────────────────────────────────────────────────

const NINES = [
  { key: 'head_neck', label: 'Head & neck', max: 9 },
  { key: 'anterior_trunk', label: 'Anterior trunk', max: 18 },
  { key: 'posterior_trunk', label: 'Posterior trunk', max: 18 },
  { key: 'right_arm', label: 'Right arm', max: 9 },
  { key: 'left_arm', label: 'Left arm', max: 9 },
  { key: 'right_leg', label: 'Right leg', max: 18 },
  { key: 'left_leg', label: 'Left leg', max: 18 },
  { key: 'genitalia', label: 'Genitalia', max: 1 },
];

export function BurnsPanel({ weightKg, ageYears }: { weightKg: number; ageYears: number }) {
  const [areas, setAreas] = useState<Record<string, string>>({});
  const [hoursSince, setHoursSince] = useState('0');
  const [inhalation, setInhalation] = useState(false);
  const [fullThickness, setFullThickness] = useState(false);
  const [circumferential, setCircumferential] = useState(false);

  const tbsa = useMemo(
    () => NINES.reduce((sum, r) => sum + Math.min(num(areas[r.key] || ''), r.max), 0),
    [areas]
  );

  const elapsed = num(hoursSince);

  const plan = useMemo(() => {
    if (!weightKg || !tbsa) return null;
    // The service works from a burn time; derive it from hours elapsed so the
    // current rate reflects time already lost before presentation — which is
    // the whole reason Parkland is anchored to injury, not to arrival.
    const now = new Date();
    const burnTime = new Date(now.getTime() - elapsed * 3600_000);
    return burnCareService.calculateParklandFormula(weightKg, tbsa, burnTime, now);
  }, [weightKg, tbsa, elapsed]);

  const baux = useMemo(
    () => (ageYears && tbsa ? burnCareService.calculateRevisedBauxScore(ageYears, tbsa, inhalation) : null),
    [ageYears, tbsa, inhalation]
  );

  const nutrition = useMemo(
    () => (weightKg && tbsa ? burnCareService.calculateNutritionTargets(weightKg, tbsa) : null),
    [weightKg, tbsa]
  );

  const disposition = useMemo(() => {
    if (!tbsa) return null;
    return burnCareService.determineDisposition(tbsa, inhalation, fullThickness, ageYears || 30, 'flame', circumferential);
  }, [tbsa, inhalation, fullThickness, ageYears, circumferential]);

  return (
    <div className="space-y-4">
      <div>
        <p className="text-sm font-medium text-gray-900 mb-2">Burned area by region (rule of nines, % TBSA)</p>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {NINES.map(r => (
            <Field key={r.key} label={r.label} hint={`max ${r.max}%`}>
              <input
                type="number" min="0" max={r.max} value={areas[r.key] || ''}
                onChange={e => setAreas(a => ({ ...a, [r.key]: e.target.value }))}
                className="input"
              />
            </Field>
          ))}
        </div>
        <p className="text-xs text-gray-500 mt-2">
          Count partial and full thickness only — superficial erythema is excluded from TBSA, and
          including it overestimates fluid substantially.
        </p>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-3 border-t">
        <Field label="Hours since burn"><input type="number" step="0.5" value={hoursSince} onChange={e => setHoursSince(e.target.value)} className="input" /></Field>
      </div>

      <div className="flex flex-wrap gap-4 text-sm">
        <label className="flex items-center gap-2"><input type="checkbox" checked={inhalation} onChange={e => setInhalation(e.target.checked)} /> Inhalation injury</label>
        <label className="flex items-center gap-2"><input type="checkbox" checked={fullThickness} onChange={e => setFullThickness(e.target.checked)} /> Full thickness</label>
        <label className="flex items-center gap-2"><input type="checkbox" checked={circumferential} onChange={e => setCircumferential(e.target.checked)} /> Circumferential</label>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <Stat label="TBSA" value={tbsa ? tbsa.toFixed(1) : '—'} unit="%"
          tone={tbsa >= 20 ? 'bg-red-50 border-red-300' : tbsa >= 10 ? 'bg-amber-50 border-amber-300' : undefined} />
        <Stat label="Parkland 24 h" value={plan?.totalVolume24h?.toLocaleString() ?? '—'} unit="mL" />
        <Stat label="Current rate" value={plan?.currentRate?.toLocaleString() ?? '—'} unit="mL/hr" />
        <Stat label="Revised Baux" value={baux ?? '—'}
          tone={baux != null && baux >= 100 ? 'bg-red-50 border-red-300' : undefined} />
      </div>

      {plan && (
        <div className="text-sm text-gray-700 space-y-1">
          <p>
            <span className="font-medium">First 8 h from injury:</span> {plan.firstHalfVolume.toLocaleString()} mL ·
            {' '}<span className="font-medium">next 16 h:</span> {plan.secondHalfVolume.toLocaleString()} mL, Hartmann's.
          </p>
          <p>
            <span className="font-medium">Titrate to urine output</span> {plan.urineOutputTarget.min}–{plan.urineOutputTarget.max} mL/kg/hr
            {weightKg > 0 && ` (${Math.round(plan.urineOutputTarget.min * weightKg)}–${Math.round(plan.urineOutputTarget.max * weightKg)} mL/hr)`}.
            The formula sets the starting rate; urine output sets the actual rate.
          </p>
          {elapsed > 0 && (
            <p className="text-amber-700">
              {elapsed} h have already elapsed since the burn — the rate above is increased to deliver
              the first-phase volume in the time remaining, not restarted from arrival.
            </p>
          )}
        </div>
      )}

      {nutrition && (
        <div className="grid grid-cols-2 gap-3">
          <Stat label="Energy (Curreri)" value={nutrition.caloriesPerDay.toLocaleString()} unit="kcal/day" />
          <Stat label="Protein" value={nutrition.proteinPerDay} unit="g/day" />
        </div>
      )}

      {disposition && disposition.reasons.length > 0 && (
        <Note tone={disposition.disposition === 'burn_center' || disposition.disposition === 'icu' ? 'warn' : 'info'}>
          <span className="font-medium">Recommended disposition: {disposition.disposition.replace('_', ' ')}</span>
          <ul className="list-disc pl-5 mt-1 space-y-0.5">
            {disposition.reasons.map((r, i) => <li key={i}>{r}</li>)}
          </ul>
        </Note>
      )}

      {!weightKg && <p className="text-xs text-amber-700">Enter a weight — Parkland cannot be calculated without it.</p>}

      <div className="pt-3 border-t">
        <ModuleLink to="/burn-care">Open the burn care module to chart fluids and monitor</ModuleLink>
        <p className="text-xs text-gray-500 mt-1">
          This panel calculates. Recording the resuscitation, hourly urine output and rate
          adjustments happens there.
        </p>
      </div>
    </div>
  );
}

// ── Caprini VTE risk ──────────────────────────────────────────────────────

const CAPRINI: { points: number; items: { key: string; label: string }[] }[] = [
  {
    points: 1,
    items: [
      { key: 'minor_surgery', label: 'Minor surgery' },
      { key: 'swollen_legs', label: 'Swollen legs' },
      { key: 'varicose_veins', label: 'Varicose veins' },
      { key: 'pregnancy_postpartum', label: 'Pregnancy or postpartum' },
      { key: 'oral_contraceptives', label: 'Oral contraceptives / HRT' },
      { key: 'sepsis_1month', label: 'Sepsis within 1 month' },
      { key: 'serious_lung_disease', label: 'Serious lung disease' },
      { key: 'abnormal_pulmonary', label: 'Abnormal pulmonary function' },
      { key: 'acute_mi', label: 'Acute myocardial infarction' },
      { key: 'chf_1month', label: 'Heart failure within 1 month' },
      { key: 'inflammatory_bowel', label: 'Inflammatory bowel disease' },
      { key: 'medical_patient_bedrest', label: 'Medical patient on bed rest' },
    ],
  },
  {
    points: 2,
    items: [
      { key: 'arthroscopic_surgery', label: 'Arthroscopic surgery' },
      { key: 'malignancy', label: 'Malignancy (present or previous)' },
      { key: 'major_surgery_45min', label: 'Major surgery > 45 min' },
      { key: 'laparoscopic_45min', label: 'Laparoscopic surgery > 45 min' },
      { key: 'patient_confined_bed', label: 'Confined to bed > 72 h' },
      { key: 'immobilizing_cast', label: 'Immobilising plaster cast' },
      { key: 'central_venous_access', label: 'Central venous access' },
    ],
  },
  {
    points: 3,
    items: [
      { key: 'personal_history_vte', label: 'Personal history of VTE' },
      { key: 'family_history_vte', label: 'Family history of VTE' },
      { key: 'factor_v_leiden', label: 'Factor V Leiden' },
      { key: 'prothrombin_mutation', label: 'Prothrombin 20210A mutation' },
      { key: 'elevated_homocysteine', label: 'Elevated homocysteine' },
      { key: 'lupus_anticoagulant', label: 'Lupus anticoagulant' },
      { key: 'anticardiolipin_antibodies', label: 'Anticardiolipin antibodies' },
      { key: 'heparin_thrombocytopenia', label: 'Heparin-induced thrombocytopenia' },
      { key: 'other_thrombophilia', label: 'Other thrombophilia' },
    ],
  },
  {
    points: 5,
    items: [
      { key: 'stroke_1month', label: 'Stroke within 1 month' },
      { key: 'elective_arthroplasty', label: 'Elective arthroplasty' },
      { key: 'hip_pelvis_fracture', label: 'Hip, pelvis or leg fracture' },
      { key: 'acute_spinal_injury', label: 'Acute spinal cord injury' },
    ],
  },
];

const RISK_TONE: Record<string, string> = {
  high: 'bg-red-50 border-red-300',
  moderate: 'bg-amber-50 border-amber-300',
  low: 'bg-blue-50 border-blue-200',
  very_low: 'bg-green-50 border-green-200',
  very_high: 'bg-red-50 border-red-300',
};

export function DvtPanel({ weightKg, heightCm, ageYears }: { weightKg: number; heightCm: number; ageYears: number }) {
  const [checked, setChecked] = useState<Record<string, boolean>>({});
  const [result, setResult] = useState<{ score: number; riskLevel: string; interpretation: string } | null>(null);

  const bmi = heightCm > 0 && weightKg > 0 ? weightKg / Math.pow(heightCm / 100, 2) : null;

  // Age and BMI are derived, not asked again. Caprini scores exactly one age
  // band; offering three checkboxes invites scoring two of them.
  const derived = useMemo(() => ({
    age_41_60: ageYears >= 41 && ageYears <= 60,
    age_61_74: ageYears >= 61 && ageYears <= 74,
    age_over_75: ageYears >= 75,
    bmi_over_25: bmi != null && bmi > 25,
  }), [ageYears, bmi]);

  const factors = useMemo(() => {
    const all: Record<string, boolean> = { ...derived };
    for (const group of CAPRINI) for (const item of group.items) all[item.key] = !!checked[item.key];
    return all;
  }, [checked, derived]);

  useEffect(() => {
    let live = true;
    riskAssessmentService
      .calculateDVTRisk({ risk_factors: factors as any })
      .then(r => { if (live) setResult(r); })
      .catch(() => { if (live) setResult(null); });
    return () => { live = false; };
  }, [factors]);

  return (
    <div className="space-y-4">
      <div className="bg-gray-50 border rounded-lg p-3 text-sm">
        <p className="font-medium text-gray-900 mb-1">Scored automatically from the details above</p>
        <ul className="text-gray-700 space-y-0.5">
          <li>Age {ageYears || '—'}: {derived.age_over_75 ? '+3 (over 75)' : derived.age_61_74 ? '+2 (61-74)' : derived.age_41_60 ? '+1 (41-60)' : 'no points'}</li>
          <li>BMI {bmi ? bmi.toFixed(1) : '—'}: {derived.bmi_over_25 ? '+1 (over 25)' : 'no points'}</li>
        </ul>
      </div>

      {CAPRINI.map(group => (
        <div key={group.points}>
          <p className="text-sm font-semibold text-gray-900 mb-1.5">{group.points} point{group.points > 1 ? 's' : ''} each</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-1.5">
            {group.items.map(item => (
              <label key={item.key} className="flex items-start gap-2 text-sm text-gray-700">
                <input
                  type="checkbox"
                  checked={!!checked[item.key]}
                  onChange={e => setChecked(c => ({ ...c, [item.key]: e.target.checked }))}
                  className="mt-0.5"
                />
                {item.label}
              </label>
            ))}
          </div>
        </div>
      ))}

      {result && (
        <div className="space-y-3 pt-3 border-t">
          <div className="grid grid-cols-2 gap-3">
            <Stat label="Caprini score" value={result.score} tone={RISK_TONE[result.riskLevel]} />
            <Stat label="Risk" value={result.riskLevel.replace('_', ' ')} tone={RISK_TONE[result.riskLevel]} />
          </div>
          <p className="text-sm text-gray-700">{result.interpretation}</p>
          <Note>
            Prophylaxis choice also depends on bleeding risk, which this score does not measure.
            A high Caprini score in a patient actively bleeding does not mean anticoagulate.
          </Note>
          <ModuleLink to="/booking-register">Record this assessment in preoperative planning</ModuleLink>
        </div>
      )}
    </div>
  );
}

// ── Braden pressure sore risk ─────────────────────────────────────────────

const BRADEN: { key: string; label: string; options: { v: number; l: string }[] }[] = [
  { key: 'sensory_perception', label: 'Sensory perception', options: [
    { v: 1, l: '1 — Completely limited' }, { v: 2, l: '2 — Very limited' },
    { v: 3, l: '3 — Slightly limited' }, { v: 4, l: '4 — No impairment' }] },
  { key: 'moisture', label: 'Moisture', options: [
    { v: 1, l: '1 — Constantly moist' }, { v: 2, l: '2 — Often moist' },
    { v: 3, l: '3 — Occasionally moist' }, { v: 4, l: '4 — Rarely moist' }] },
  { key: 'activity', label: 'Activity', options: [
    { v: 1, l: '1 — Bedfast' }, { v: 2, l: '2 — Chairfast' },
    { v: 3, l: '3 — Walks occasionally' }, { v: 4, l: '4 — Walks frequently' }] },
  { key: 'mobility', label: 'Mobility', options: [
    { v: 1, l: '1 — Completely immobile' }, { v: 2, l: '2 — Very limited' },
    { v: 3, l: '3 — Slightly limited' }, { v: 4, l: '4 — No limitation' }] },
  { key: 'nutrition', label: 'Nutrition', options: [
    { v: 1, l: '1 — Very poor' }, { v: 2, l: '2 — Probably inadequate' },
    { v: 3, l: '3 — Adequate' }, { v: 4, l: '4 — Excellent' }] },
  { key: 'friction_shear', label: 'Friction & shear', options: [
    { v: 1, l: '1 — Problem' }, { v: 2, l: '2 — Potential problem' },
    { v: 3, l: '3 — No apparent problem' }] },
];

export function PressureSorePanel() {
  const [scores, setScores] = useState<Record<string, number>>({
    sensory_perception: 4, moisture: 4, activity: 4, mobility: 4, nutrition: 4, friction_shear: 3,
  });
  const [result, setResult] = useState<{ score: number; riskLevel: string; interpretation: string } | null>(null);

  useEffect(() => {
    let live = true;
    riskAssessmentService
      .calculatePressureSoreRisk({ braden_subscores: scores as any })
      .then(r => { if (live) setResult(r); })
      .catch(() => { if (live) setResult(null); });
    return () => { live = false; };
  }, [scores]);

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {BRADEN.map(d => (
          <Field key={d.key} label={d.label}>
            <select
              value={scores[d.key]}
              onChange={e => setScores(s => ({ ...s, [d.key]: parseInt(e.target.value, 10) }))}
              className="input"
            >
              {d.options.map(o => <option key={o.v} value={o.v}>{o.l}</option>)}
            </select>
          </Field>
        ))}
      </div>

      {result && (
        <div className="space-y-3 pt-3 border-t">
          <div className="grid grid-cols-2 gap-3">
            <Stat label="Braden total" value={`${result.score}/23`} tone={RISK_TONE[result.riskLevel]} />
            <Stat label="Risk" value={result.riskLevel.replace('_', ' ')} tone={RISK_TONE[result.riskLevel]} />
          </div>
          <p className="text-sm text-gray-700">{result.interpretation}</p>
          <Note>
            The score guides how intensively to prevent; it does not replace looking at the skin.
            Reassess after any change in mobility, continence or conscious level.
          </Note>
          <ModuleLink to="/pressure-sore">Open the pressure sore module</ModuleLink>
        </div>
      )}
    </div>
  );
}

// ── MUST malnutrition screening ───────────────────────────────────────────

export function MustPanel({ weightKg, heightCm }: { weightKg: number; heightCm: number }) {
  const [weightLossPct, setWeightLossPct] = useState('');
  const [acuteIllness, setAcuteIllness] = useState(false);
  const [result, setResult] = useState<{ score: number; riskLevel: string; interpretation: string } | null>(null);

  const bmi = heightCm > 0 && weightKg > 0 ? weightKg / Math.pow(heightCm / 100, 2) : null;

  const bmiScore = bmi == null ? 0 : bmi > 20 ? 0 : bmi >= 18.5 ? 1 : 2;
  const lossPct = numOrNull(weightLossPct);
  const lossScore = lossPct == null ? 0 : lossPct > 10 ? 2 : lossPct >= 5 ? 1 : 0;
  const acuteScore = acuteIllness ? 2 : 0;

  useEffect(() => {
    let live = true;
    riskAssessmentService
      .calculateNutritionalRisk({
        must_components: { bmi_score: bmiScore, weight_loss_score: lossScore, acute_disease_score: acuteScore },
      } as any)
      .then(r => { if (live) setResult(r); })
      .catch(() => { if (live) setResult(null); });
    return () => { live = false; };
  }, [bmiScore, lossScore, acuteScore]);

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <Field label="Unplanned weight loss (%)" hint="Over the past 3–6 months">
          <input type="number" step="0.1" value={weightLossPct} onChange={e => setWeightLossPct(e.target.value)} className="input" />
        </Field>
      </div>

      <label className="flex items-start gap-2 text-sm text-gray-700">
        <input type="checkbox" checked={acuteIllness} onChange={e => setAcuteIllness(e.target.checked)} className="mt-0.5" />
        <span>Acutely ill <em>and</em> there has been, or is likely to be, no nutritional intake for more than 5 days</span>
      </label>

      <div className="bg-gray-50 border rounded-lg p-3 text-sm">
        <p className="text-gray-700">
          BMI {bmi ? bmi.toFixed(1) : '—'} → {bmiScore} point{bmiScore === 1 ? '' : 's'} ·
          {' '}Weight loss → {lossScore} · Acute illness → {acuteScore}
        </p>
        {bmi == null && <p className="text-amber-700 mt-1">Enter weight and height for the BMI component.</p>}
      </div>

      {result && (
        <div className="space-y-3 pt-3 border-t">
          <div className="grid grid-cols-2 gap-3">
            <Stat label="MUST score" value={result.score} tone={RISK_TONE[result.riskLevel]} />
            <Stat label="Risk" value={result.riskLevel} tone={RISK_TONE[result.riskLevel]} />
          </div>
          <p className="text-sm text-gray-700">{result.interpretation}</p>
        </div>
      )}
    </div>
  );
}

// ── Meal plans ────────────────────────────────────────────────────────────

function MealPlanDays({ days }: { days: DayPlan[] }) {
  const [open, setOpen] = useState(0);
  const d = days[open];
  if (!d) return null;

  const meals = [
    ['Breakfast', d.breakfast], ['Mid-morning', d.midMorningSnack],
    ['Lunch', d.lunch], ['Afternoon', d.afternoonSnack], ['Dinner', d.dinner],
  ] as const;

  return (
    <div>
      <div className="flex flex-wrap gap-1.5 mb-3">
        {days.map((day, i) => (
          <button
            key={i}
            onClick={() => setOpen(i)}
            className={`px-2.5 py-1 rounded text-xs font-medium ${
              i === open ? 'bg-primary-600 text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
          >
            {day.day}
          </button>
        ))}
      </div>

      <div className="border rounded-lg divide-y">
        {meals.map(([label, meal]) => (
          <div key={label} className="p-3">
            <p className="text-xs font-semibold text-gray-700 uppercase tracking-wide mb-1">{label}</p>
            <ul className="text-sm text-gray-800 space-y-0.5">
              {meal.items.map((it, i) => (
                <li key={i} className="flex justify-between gap-3">
                  <span>{it.name} — <span className="text-gray-600">{it.qty}</span></span>
                  <span className="text-xs text-gray-500 whitespace-nowrap">{it.kcal} kcal · {it.protein} g</span>
                </li>
              ))}
            </ul>
          </div>
        ))}
        <div className="p-3 bg-gray-50 text-sm font-medium text-gray-900">
          Day total: {d.totalKcal} kcal · {d.totalProtein} g protein
        </div>
      </div>
    </div>
  );
}

export function WoundMealPlanPanel({ weightKg }: { weightKg: number }) {
  const [severity, setSeverity] = useState<WoundSeverity>('moderate');
  const [albumin, setAlbumin] = useState('');
  const [diabetes, setDiabetes] = useState(false);
  const [ckd, setCkd] = useState(false);
  const [liver, setLiver] = useState(false);

  const r = useMemo(() => (weightKg > 0 ? woundHealingMealPlan({
    weightKg, severity, albuminGdL: numOrNull(albumin), diabetes, ckd, liverDisease: liver,
  }) : null), [weightKg, severity, albumin, diabetes, ckd, liver]);

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <Field label="Wound severity">
          <select value={severity} onChange={e => setSeverity(e.target.value as WoundSeverity)} className="input">
            <option value="mild">Mild / small</option>
            <option value="moderate">Moderate</option>
            <option value="severe">Severe, multiple or extensive</option>
          </select>
        </Field>
        <Field label="Albumin (g/dL)" hint="Optional"><input type="number" step="0.1" value={albumin} onChange={e => setAlbumin(e.target.value)} className="input" /></Field>
      </div>

      <div className="flex flex-wrap gap-4 text-sm">
        <label className="flex items-center gap-2"><input type="checkbox" checked={diabetes} onChange={e => setDiabetes(e.target.checked)} /> Diabetes</label>
        <label className="flex items-center gap-2"><input type="checkbox" checked={ckd} onChange={e => setCkd(e.target.checked)} /> Chronic kidney disease</label>
        <label className="flex items-center gap-2"><input type="checkbox" checked={liver} onChange={e => setLiver(e.target.checked)} /> Liver disease</label>
      </div>

      {!r ? (
        <p className="text-sm text-amber-700">Enter a weight to build the plan.</p>
      ) : (
        <>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <Stat label="Energy" value={r.targetKcal.toLocaleString()} unit="kcal/day" />
            <Stat label="Protein" value={r.targetProtein} unit="g/day"
              tone={r.proteinPerKg <= 1.0 ? 'bg-amber-50 border-amber-300' : 'bg-green-50 border-green-200'} />
            <Stat label="Per kg" value={`${r.kcalPerKg} / ${r.proteinPerKg}`} unit="kcal / g" />
            <Stat label="Fluid" value={r.fluidMl.toLocaleString()} unit="mL/day" />
          </div>

          {r.cautions.map((c, i) => <Note key={i} tone="warn">{c}</Note>)}

          {r.modifications.length > 0 && (
            <div>
              <p className="font-semibold text-sm text-gray-900 mb-1">Dietary modifications</p>
              <ul className="list-disc pl-5 text-sm text-gray-700 space-y-0.5">
                {r.modifications.map((m, i) => <li key={i}>{m}</li>)}
              </ul>
            </div>
          )}

          <div>
            <p className="font-semibold text-sm text-gray-900 mb-1">Rationale</p>
            <ul className="list-disc pl-5 text-sm text-gray-700 space-y-0.5">
              {r.rationale.map((m, i) => <li key={i}>{m}</li>)}
            </ul>
          </div>

          <div>
            <p className="font-semibold text-sm text-gray-900 mb-2">Seven-day plan</p>
            <MealPlanDays days={r.days} />
          </div>
        </>
      )}
    </div>
  );
}

/**
 * Nutrition: a meal plan against an explicit energy and protein target, for
 * when the target comes from somewhere other than the wound or weight
 * calculators — a dietitian's figure, or a condition-specific requirement.
 */
export function NutritionPanel({ weightKg }: { weightKg: number }) {
  const [kcal, setKcal] = useState('');
  const [proteinPerKg, setProteinPerKg] = useState('1.2');

  const targetKcal = num(kcal);
  const protein = Math.round(weightKg * num(proteinPerKg));

  // Built against the protein target actually displayed above. Routing this
  // through weightLossMealPlan would silently use its own 1.6 g/kg figure and
  // the plan would not match the headline.
  const days = useMemo(
    () => (targetKcal > 0 && protein > 0 ? generateMealPlan(targetKcal, protein) : null),
    [targetKcal, protein]
  );

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <Field label="Energy target (kcal/day)">
          <input type="number" value={kcal} onChange={e => setKcal(e.target.value)} className="input" />
        </Field>
        <Field label="Protein (g/kg/day)" hint="1.0 maintenance · 1.2–1.5 surgical · 1.5–2.0 catabolic">
          <input type="number" step="0.1" value={proteinPerKg} onChange={e => setProteinPerKg(e.target.value)} className="input" />
        </Field>
      </div>

      {weightKg > 0 && (
        <div className="grid grid-cols-2 gap-3">
          <Stat label="Protein target" value={protein} unit="g/day" />
          <Stat label="Energy target" value={targetKcal ? targetKcal.toLocaleString() : '—'} unit="kcal/day" />
        </div>
      )}

      {!weightKg && <p className="text-sm text-amber-700">Enter a weight above.</p>}

      {days && (
        <div>
          <p className="font-semibold text-sm text-gray-900 mb-2">Seven-day plan</p>
          <MealPlanDays days={days} />
        </div>
      )}

      <Note>
        Portions use West African foods with household measures, from the app's food composition
        data. Energy and protein figures are approximate and intended for planning, not for
        prescribing parenteral nutrition.
      </Note>
    </div>
  );
}

export { MealPlanDays };
