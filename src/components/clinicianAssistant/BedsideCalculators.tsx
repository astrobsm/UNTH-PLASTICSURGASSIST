/**
 * Bedside calculators for the Clinician Assistant.
 *
 * The arithmetic lives in services/clinicianAssistant/calculators.ts as pure,
 * tested functions — this file is only the form around them. That separation is
 * the point: the numbers a clinician acts on are verified independently of the
 * markup, which is what the original Critical Care Calculator could not do
 * because its maths was embedded in JSX.
 *
 * All fifteen categories from that app are here. Four are implemented in
 * calculators.ts; the rest are forms over logic this codebase already had —
 * the acid-base and electrolyte engines, the burn care service, the risk
 * assessment service, the food composition data. Nothing clinical is
 * reimplemented, so a number shown here cannot drift from the module that owns
 * it.
 */

import React, { Suspense, lazy, useEffect, useMemo, useState } from 'react';
import {
  Activity, Apple, Bed, Droplet, Flame, FlaskConical, Heart, HeartPulse, Loader2,
  Pill, Soup, TrendingDown, TrendingUp, UtensilsCrossed, Zap,
} from 'lucide-react';
import {
  weightGainPlan, weightReductionPlan, assessSepsis, fluidDeficitMl,
  maintenanceFluidMlPerHour, sickleCrisisPlan,
  type ActivityLevel, type Sex, type DehydrationSeverity,
} from '../../services/clinicianAssistant/calculators';
import {
  AcidBasePanel, ElectrolytePanel, GfrPanel, BurnsPanel, DvtPanel,
  PressureSorePanel, MustPanel, WoundMealPlanPanel, NutritionPanel, MealPlanDays,
} from './CalculatorPanels';
import { generateMealPlan } from '../../data/nigerianFoods';

// The BNF database is several thousand drug records. Loading it with the tab
// would make every other calculator wait for data most of them never touch.
const BnfDrugPanel = lazy(() => import('./panels/BnfDrugPanel'));

/** Values carried over from the selected patient, so nothing is re-typed. */
export interface PatientPrefill {
  weightKg?: number | null;
  heightCm?: number | null;
  ageYears?: number | null;
  sex?: Sex;
}

type Tool =
  | 'resuscitation' | 'sickle' | 'gain' | 'reduction'
  | 'sodium' | 'potassium' | 'acidbase' | 'gfr' | 'bnf'
  | 'burns' | 'nutrition' | 'dvt' | 'pressuresore' | 'must' | 'woundmeal';

type ToolDef = {
  id: Tool;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  /** Which of the shared demographic fields this calculator actually uses. */
  needs?: ('weight' | 'height' | 'age' | 'sex')[];
};

const TOOLS: ToolDef[] = [
  { id: 'resuscitation', label: 'Emergency & sepsis', icon: Activity, needs: ['weight'] },
  { id: 'sodium', label: 'Sodium', icon: Droplet, needs: ['weight', 'age', 'sex'] },
  { id: 'potassium', label: 'Potassium', icon: Zap, needs: ['weight', 'age', 'sex'] },
  { id: 'acidbase', label: 'Acid-base', icon: FlaskConical, needs: [] },
  { id: 'gfr', label: 'GFR', icon: Activity, needs: ['age', 'sex'] },
  { id: 'bnf', label: 'BNF drugs', icon: Pill, needs: ['weight', 'age', 'sex'] },
  { id: 'burns', label: 'Burns', icon: Flame, needs: ['weight', 'age'] },
  { id: 'nutrition', label: 'Nutrition', icon: UtensilsCrossed, needs: ['weight'] },
  { id: 'dvt', label: 'DVT risk', icon: Heart, needs: ['weight', 'height', 'age'] },
  { id: 'pressuresore', label: 'Pressure sore', icon: Bed, needs: [] },
  { id: 'must', label: 'MUST score', icon: Apple, needs: ['weight', 'height'] },
  { id: 'woundmeal', label: 'Wound meal plan', icon: Soup, needs: ['weight'] },
  { id: 'reduction', label: 'Weight loss', icon: TrendingDown, needs: ['weight', 'height', 'age', 'sex'] },
  { id: 'gain', label: 'Weight gain', icon: TrendingUp, needs: ['weight', 'height', 'age', 'sex'] },
  { id: 'sickle', label: 'Sickle cell', icon: HeartPulse, needs: ['weight'] },
];

const num = (v: string): number => {
  const n = parseFloat(v);
  return Number.isFinite(n) ? n : 0;
};
/** Empty means "not recorded", which must stay distinct from zero. */
const numOrNull = (v: string): number | null => {
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

export default function BedsideCalculators({ prefill }: { prefill?: PatientPrefill }) {
  const [tool, setTool] = useState<Tool>('resuscitation');

  // Shared demographics, seeded from the patient record where available.
  const [weight, setWeight] = useState('');
  const [height, setHeight] = useState('');
  const [age, setAge] = useState('');
  const [sex, setSex] = useState<Sex>('unspecified');

  // Lifted so the BNF tab can warn on renal dosing using a GFR the clinician
  // has already calculated, rather than asking for the creatinine twice.
  const [gfr, setGfr] = useState<number | null>(null);

  useEffect(() => {
    if (prefill?.weightKg) setWeight(String(prefill.weightKg));
    if (prefill?.heightCm) setHeight(String(prefill.heightCm));
    if (prefill?.ageYears) setAge(String(prefill.ageYears));
    if (prefill?.sex) setSex(prefill.sex);
  }, [prefill]);

  const active = TOOLS.find(t => t.id === tool);
  const needs = active?.needs ?? ['weight', 'height', 'age', 'sex'];
  const showDemographics = needs.length > 0;

  const w = num(weight), h = num(height), a = num(age);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2">
        {TOOLS.map(t => (
          <button
            key={t.id}
            onClick={() => setTool(t.id)}
            className={`px-3 py-1.5 rounded-lg text-sm font-medium flex items-center gap-1.5 ${
              tool === t.id ? 'bg-primary-600 text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
          >
            <t.icon className="w-4 h-4" /> {t.label}
          </button>
        ))}
      </div>

      <div className="bg-white border rounded-lg p-4">
        {/* Only the fields the selected calculator actually uses. A form that
            asks for a height it will not use invites someone to believe the
            result depended on it. */}
        {showDemographics && (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-4 pb-4 border-b">
            {needs.includes('weight') && (
              <Field label="Weight (kg)">
                <input type="number" value={weight} onChange={e => setWeight(e.target.value)} className="input" />
              </Field>
            )}
            {needs.includes('height') && (
              <Field label="Height (cm)">
                <input type="number" value={height} onChange={e => setHeight(e.target.value)} className="input" />
              </Field>
            )}
            {needs.includes('age') && (
              <Field label="Age (years)">
                <input type="number" value={age} onChange={e => setAge(e.target.value)} className="input" />
              </Field>
            )}
            {needs.includes('sex') && (
              <Field label="Sex">
                <select value={sex} onChange={e => setSex(e.target.value as Sex)} className="input">
                  <option value="unspecified">Not specified</option>
                  <option value="male">Male</option>
                  <option value="female">Female</option>
                </select>
              </Field>
            )}
          </div>
        )}

        {tool === 'resuscitation' && <Resuscitation weightKg={w} />}
        {tool === 'sickle' && <SickleCell weightKg={w} />}
        {tool === 'gain' && <WeightPlan mode="gain" weightKg={w} heightCm={h} ageYears={a} sex={sex} />}
        {tool === 'reduction' && <WeightPlan mode="reduction" weightKg={w} heightCm={h} ageYears={a} sex={sex} />}

        {tool === 'sodium' && <ElectrolytePanel analyte="sodium" weightKg={w} ageYears={a} sex={sex} />}
        {tool === 'potassium' && <ElectrolytePanel analyte="potassium" weightKg={w} ageYears={a} sex={sex} />}
        {tool === 'acidbase' && <AcidBasePanel />}
        {tool === 'gfr' && <GfrPanel ageYears={a} sex={sex} onGfr={setGfr} />}
        {tool === 'burns' && <BurnsPanel weightKg={w} ageYears={a} />}
        {tool === 'nutrition' && <NutritionPanel weightKg={w} />}
        {tool === 'dvt' && <DvtPanel weightKg={w} heightCm={h} ageYears={a} />}
        {tool === 'pressuresore' && <PressureSorePanel />}
        {tool === 'must' && <MustPanel weightKg={w} heightCm={h} />}
        {tool === 'woundmeal' && <WoundMealPlanPanel weightKg={w} />}

        {tool === 'bnf' && (
          <Suspense fallback={
            <div className="py-8 flex items-center justify-center gap-2 text-sm text-gray-600">
              <Loader2 className="w-4 h-4 animate-spin" /> Loading the drug database…
            </div>
          }>
            <BnfDrugPanel weightKg={w} ageYears={a} sex={sex} gfr={gfr} />
          </Suspense>
        )}
      </div>
    </div>
  );
}

// ── Resuscitation & sepsis ────────────────────────────────────────────────

function Resuscitation({ weightKg }: { weightKg: number }) {
  const [sbp, setSbp] = useState('');
  const [dbp, setDbp] = useState('');
  const [hr, setHr] = useState('');
  const [rr, setRr] = useState('');
  const [temp, setTemp] = useState('');
  const [gcs, setGcs] = useState('');
  const [wbc, setWbc] = useState('');
  const [lactate, setLactate] = useState('');
  const [dehydration, setDehydration] = useState<DehydrationSeverity>('moderate');

  const result = useMemo(() => assessSepsis(
    {
      systolicBP: numOrNull(sbp), diastolicBP: numOrNull(dbp), heartRate: numOrNull(hr),
      respiratoryRate: numOrNull(rr), temperature: numOrNull(temp), gcs: numOrNull(gcs),
    },
    { wbc: numOrNull(wbc), lactate: numOrNull(lactate) }
  ), [sbp, dbp, hr, rr, temp, gcs, wbc, lactate]);

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <Field label="Systolic BP"><input type="number" value={sbp} onChange={e => setSbp(e.target.value)} className="input" /></Field>
        <Field label="Diastolic BP"><input type="number" value={dbp} onChange={e => setDbp(e.target.value)} className="input" /></Field>
        <Field label="Heart rate"><input type="number" value={hr} onChange={e => setHr(e.target.value)} className="input" /></Field>
        <Field label="Respiratory rate"><input type="number" value={rr} onChange={e => setRr(e.target.value)} className="input" /></Field>
        <Field label="Temperature (°C)"><input type="number" step="0.1" value={temp} onChange={e => setTemp(e.target.value)} className="input" /></Field>
        <Field label="GCS"><input type="number" value={gcs} onChange={e => setGcs(e.target.value)} className="input" /></Field>
        <Field label="WBC (×10⁹/L)"><input type="number" step="0.1" value={wbc} onChange={e => setWbc(e.target.value)} className="input" /></Field>
        <Field label="Lactate (mmol/L)"><input type="number" step="0.1" value={lactate} onChange={e => setLactate(e.target.value)} className="input" /></Field>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <Stat label="MAP" value={result.map ?? '—'} unit={result.map ? 'mmHg' : ''}
          tone={result.map != null && result.map < 65 ? 'bg-red-50 border-red-300' : undefined} />
        <Stat label="qSOFA" value={`${result.qSOFA}/3`}
          tone={result.qSOFA >= 2 ? 'bg-red-50 border-red-300' : undefined} />
        <Stat label="SIRS" value={`${result.sirs}/4`}
          tone={result.sirs >= 2 ? 'bg-amber-50 border-amber-300' : undefined} />
        <Stat label="Maintenance fluid" value={maintenanceFluidMlPerHour(weightKg) || '—'} unit="mL/hr" />
      </div>

      {(result.sepsisSuspected || result.septicShock) && (
        <div className={`rounded-lg border p-3 ${result.septicShock ? 'bg-red-50 border-red-300' : 'bg-amber-50 border-amber-300'}`}>
          <p className="font-semibold text-sm">
            {result.septicShock ? 'Septic shock criteria met' : 'Sepsis suspected'}
          </p>
          <p className="text-xs mt-1">
            Start the sepsis bundle: cultures before antibiotics, broad-spectrum antibiotics within one hour,
            fluid resuscitation, and lactate measurement with a repeat if raised.
          </p>
        </div>
      )}

      {/* The components are shown, not just the score: a number whose inputs
          cannot be checked gets trusted when a value was simply never entered. */}
      {(result.qSOFAComponents.length > 0 || result.sirsComponents.length > 0) && (
        <div className="text-xs text-gray-600 space-y-1">
          {result.qSOFAComponents.length > 0 && <p><span className="font-medium">qSOFA scored on:</span> {result.qSOFAComponents.join('; ')}</p>}
          {result.sirsComponents.length > 0 && <p><span className="font-medium">SIRS scored on:</span> {result.sirsComponents.join('; ')}</p>}
          <p className="text-gray-500">Parameters left blank are not scored, so an incomplete set understates the score.</p>
        </div>
      )}

      <div className="pt-3 border-t">
        <Field label="Dehydration severity" hint="Estimated deficit is 3 / 6 / 9 % of body weight.">
          <select value={dehydration} onChange={e => setDehydration(e.target.value as DehydrationSeverity)} className="input max-w-xs">
            <option value="mild">Mild (3%)</option>
            <option value="moderate">Moderate (6%)</option>
            <option value="severe">Severe (9%)</option>
          </select>
        </Field>
        <div className="mt-3 grid grid-cols-2 gap-3 max-w-md">
          <Stat label="Estimated deficit" value={fluidDeficitMl(weightKg, dehydration) || '—'} unit="mL" />
          <Stat label="Maintenance" value={maintenanceFluidMlPerHour(weightKg) || '—'} unit="mL/hr" />
        </div>
        {!weightKg && <p className="text-xs text-amber-700 mt-2">Enter a weight — fluid volumes cannot be estimated without it.</p>}
      </div>
    </div>
  );
}

// ── Sickle cell crisis ────────────────────────────────────────────────────

function SickleCell({ weightKg }: { weightKg: number }) {
  const [pain, setPain] = useState('7');
  const [hb, setHb] = useState('');
  const [baseline, setBaseline] = useState('');
  const [spo2, setSpo2] = useState('');
  const [temp, setTemp] = useState('');
  const [chest, setChest] = useState(false);
  const [stroke, setStroke] = useState(false);

  const plan = useMemo(() => sickleCrisisPlan({
    weightKg,
    painScore: num(pain),
    haemoglobinGdL: numOrNull(hb),
    baselineHbGdL: numOrNull(baseline),
    spo2: numOrNull(spo2),
    temperatureC: numOrNull(temp),
    chestSymptoms: chest,
    priorStroke: stroke,
  }), [weightKg, pain, hb, baseline, spo2, temp, chest, stroke]);

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
        <Field label="Pain score (0-10)"><input type="number" min="0" max="10" value={pain} onChange={e => setPain(e.target.value)} className="input" /></Field>
        <Field label="Haemoglobin (g/dL)"><input type="number" step="0.1" value={hb} onChange={e => setHb(e.target.value)} className="input" /></Field>
        <Field label="Baseline Hb (g/dL)"><input type="number" step="0.1" value={baseline} onChange={e => setBaseline(e.target.value)} className="input" /></Field>
        <Field label="SpO₂ (%)"><input type="number" value={spo2} onChange={e => setSpo2(e.target.value)} className="input" /></Field>
        <Field label="Temperature (°C)"><input type="number" step="0.1" value={temp} onChange={e => setTemp(e.target.value)} className="input" /></Field>
      </div>

      <div className="flex flex-wrap gap-4">
        <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={chest} onChange={e => setChest(e.target.checked)} /> Chest symptoms</label>
        <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={stroke} onChange={e => setStroke(e.target.checked)} /> Previous stroke</label>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
        <Stat label="Pain severity" value={plan.painSeverity}
          tone={plan.painSeverity === 'severe' ? 'bg-red-50 border-red-300' : undefined} />
        <Stat label="Crisis fluid (1.5× maintenance)" value={plan.fluidMlPerHour || '—'} unit="mL/hr" />
        <Stat label="Transfusion / exchange"
          value={plan.exchangeConsidered ? 'Exchange' : plan.transfusionConsidered ? 'Consider' : 'Not indicated'}
          tone={plan.exchangeConsidered ? 'bg-red-50 border-red-300' : plan.transfusionConsidered ? 'bg-amber-50 border-amber-300' : undefined} />
      </div>

      {plan.redFlags.length > 0 && (
        <div className="bg-red-50 border border-red-300 rounded-lg p-3">
          <p className="font-semibold text-sm text-red-900">Red flags</p>
          <ul className="list-disc pl-5 text-sm text-red-900 mt-1 space-y-0.5">
            {plan.redFlags.map((f, i) => <li key={i}>{f}</li>)}
          </ul>
        </div>
      )}

      <div>
        <p className="font-semibold text-sm text-gray-900 mb-1">Analgesia</p>
        <ul className="list-disc pl-5 text-sm text-gray-700 space-y-0.5">
          {plan.analgesia.map((a, i) => <li key={i}>{a}</li>)}
        </ul>
      </div>

      <div>
        <p className="font-semibold text-sm text-gray-900 mb-1">Investigations</p>
        <ul className="list-disc pl-5 text-sm text-gray-700 space-y-0.5">
          {plan.investigations.map((a, i) => <li key={i}>{a}</li>)}
        </ul>
      </div>

      {!weightKg && <p className="text-xs text-amber-700">Enter a weight for fluid and opioid dosing.</p>}
    </div>
  );
}

// ── Weight gain / reduction ───────────────────────────────────────────────

function WeightPlan({
  mode, weightKg, heightCm, ageYears, sex,
}: { mode: 'gain' | 'reduction'; weightKg: number; heightCm: number; ageYears: number; sex: Sex }) {
  const [activity, setActivity] = useState<ActivityLevel>('moderate');
  const [targetChange, setTargetChange] = useState('');
  const [weeks, setWeeks] = useState('');

  const plan = useMemo(() => {
    const input = {
      weightKg, heightCm, ageYears, sex, activity,
      targetChangeKg: numOrNull(targetChange) ?? undefined,
      weeks: numOrNull(weeks) ?? undefined,
    };
    return mode === 'gain' ? weightGainPlan(input) : weightReductionPlan(input);
  }, [mode, weightKg, heightCm, ageYears, sex, activity, targetChange, weeks]);

  const ready = weightKg > 0 && heightCm > 0 && ageYears > 0;

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <Field label="Activity level">
          <select value={activity} onChange={e => setActivity(e.target.value as ActivityLevel)} className="input">
            <option value="sedentary">Sedentary (×1.2)</option>
            <option value="light">Light (×1.375)</option>
            <option value="moderate">Moderate (×1.55)</option>
            <option value="active">Active (×1.725)</option>
            <option value="very-active">Very active (×1.9)</option>
          </select>
        </Field>
        <Field label={`Target ${mode === 'gain' ? 'gain' : 'loss'} (kg)`}>
          <input type="number" step="0.5" value={targetChange} onChange={e => setTargetChange(e.target.value)} className="input" />
        </Field>
        <Field label="Over (weeks)">
          <input type="number" value={weeks} onChange={e => setWeeks(e.target.value)} className="input" />
        </Field>
      </div>

      {!ready ? (
        <p className="text-sm text-amber-700">Weight, height and age are all required to estimate energy requirement.</p>
      ) : (
        <>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <Stat label="BMR" value={plan.bmr} unit="kcal/day" />
            <Stat label="Maintenance (TDEE)" value={plan.tdee} unit="kcal/day" />
            <Stat label="Target intake" value={plan.targetCalories} unit="kcal/day"
              tone={mode === 'gain' ? 'bg-green-50 border-green-200' : 'bg-blue-50 border-blue-200'} />
            <Stat label={mode === 'gain' ? 'Surplus' : 'Deficit'} value={Math.abs(plan.calorieDelta)} unit="kcal/day" />
          </div>

          <div className="grid grid-cols-3 gap-3">
            <Stat label="Protein" value={plan.proteinG} unit="g/day" />
            <Stat label="Carbohydrate" value={plan.carbG} unit="g/day" />
            <Stat label="Fat" value={plan.fatG} unit="g/day" />
          </div>

          {plan.notes.length > 0 && (
            <div className="bg-amber-50 border border-amber-200 rounded-lg p-3">
              <ul className="list-disc pl-5 text-sm text-amber-900 space-y-0.5">
                {plan.notes.map((n, i) => <li key={i}>{n}</li>)}
              </ul>
            </div>
          )}

          <p className="text-xs text-gray-500">
            Energy requirement from the Harris-Benedict equation.
          </p>

          <MealPlanSection
            mode={mode}
            targetCalories={plan.targetCalories}
            proteinG={plan.proteinG}
          />
        </>
      )}
    </div>
  );
}

/**
 * A seven-day plan against the targets just calculated, built from the app's
 * West African food composition data — the same generator the wound-healing
 * plan uses. It is collapsed by default because the numbers above are what
 * most consultations need; the plan is what the patient goes home with.
 */
function MealPlanSection({
  mode, targetCalories, proteinG,
}: { mode: 'gain' | 'reduction'; targetCalories: number; proteinG: number }) {
  const [open, setOpen] = useState(false);
  const days = useMemo(
    () => (open ? generateMealPlan(targetCalories, proteinG) : null),
    [open, targetCalories, proteinG]
  );

  return (
    <div className="pt-3 border-t">
      <button
        onClick={() => setOpen(o => !o)}
        className="text-sm font-medium text-primary-700 hover:underline"
      >
        {open ? 'Hide' : 'Show'} seven-day {mode === 'gain' ? 'weight gain' : 'weight loss'} meal plan
      </button>

      {days && (
        <div className="mt-3">
          <p className="text-xs text-gray-600 mb-2">
            Built to {targetCalories.toLocaleString()} kcal and {proteinG} g protein per day using local
            foods and household measures.
            {mode === 'reduction' && ' Protein is held high so the deficit comes off fat rather than muscle.'}
          </p>
          <MealPlanDays days={days} />
        </div>
      )}
    </div>
  );
}
