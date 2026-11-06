/** A nutrition assessment result: targets, screening, requirements and — on request — the working behind every number. */
import { useState } from 'react';
import { AlertTriangle, ChevronDown, ChevronRight, ShieldAlert } from 'lucide-react';
import type { NutritionAssessment } from '../../clinical/nutrition/assess';
import type { Calc } from '../../clinical/nutrition/types';
import { levelTone, Notice } from './fields';

const LEVEL: Record<string, string> = { low: 'Low risk', medium: 'Medium risk', high: 'High risk', refeeding: 'Refeeding risk' };

function Stat({ label, value, sub }: { label: string; value: React.ReactNode; sub?: React.ReactNode }) {
  return <div className="bg-white border rounded-lg p-2"><div className="text-xs text-gray-500">{label}</div><div className="font-semibold">{value ?? '—'}</div>{sub && <div className="text-xs text-gray-500">{sub}</div>}</div>;
}

function Working({ title, c }: { title: string; c?: Calc<any> | null }) {
  if (!c) return null;
  return (
    <tr className="align-top">
      <td className="px-2 py-1 font-medium">{title}</td>
      <td className="px-2 py-1">{String(c.value)}</td>
      <td className="px-2 py-1">{c.method}</td>
      <td className="px-2 py-1 text-xs">{Object.entries(c.inputs).map(([k, v]) => `${k}=${v ?? '—'}`).join(', ')}</td>
      <td className="px-2 py-1 text-xs">{[...c.assumptions, c.source].filter(Boolean).join(' · ')}</td>
    </tr>
  );
}

export function AssessmentResultView({ a, selectedEnergy, onSelectEnergy }: { a: NutritionAssessment; selectedEnergy?: string; onSelectEnergy?: (id: string) => void }) {
  const [show, setShow] = useState(false);
  const s = a.screening;
  return (
    <div className="space-y-3">
      {!a.scope.inScope && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-sm text-red-800 flex gap-2"><ShieldAlert className="w-5 h-5 shrink-0" />
          <div><b>{a.scope.notice}</b> — {a.scope.reasons.join(', ')}. Screening is shown; no targets or meal plan are produced.</div></div>
      )}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
        <div className={`rounded-lg p-2 ${levelTone(a.level)}`}><div className="text-xs">Monitoring level</div><div className="font-semibold">{LEVEL[a.level]}</div></div>
        <Stat label="Energy target" value={a.targets.kcal ? `${a.targets.kcal} kcal/day` : '—'} sub={a.energy.selected?.label} />
        <Stat label="Protein target" value={a.targets.proteinG ? `${a.targets.proteinG} g/day` : '—'} sub={a.protein ? `${a.protein.perKg} g/kg on ${a.protein.basis}` : null} />
        <Stat label="Fluid" value={a.targets.fluidMl ? `${a.targets.fluidMl} mL/day` : '—'} sub={a.fluid ? `${a.fluid.low}–${a.fluid.high} mL` : null} />
        <Stat label="Weight" value={a.weight ? `${a.weight.value} kg` : '—'} sub={a.weight?.method} />
        <Stat label="BMI" value={a.bmi?.value ?? (a.muacBand ? `MUAC band ${a.muacBand.value === 'lt20' ? '< 20' : a.muacBand.value === 'gt30' ? '> 30' : '20–30'}` : '—')} sub={a.height ? `Height ${a.height.value} cm · ${a.height.method}` : null} />
        <Stat label="MUST" value={s.must ? `${s.must.value} (${s.must.risk})` : '—'} sub={s.nrs2002 ? `NRS-2002 ${s.nrs2002.value}${s.nrs2002.atRisk ? ' — at risk' : ''}` : null} />
        <Stat label="GLIM" value={s.glim.value} sub={[s.sga && `SGA ${s.sga.value}${s.sga.clinicianRated ? '' : ' (suggested)'}`, s.nutric && `${s.nutric.method} ${s.nutric.value}${s.nutric.high ? ' — high' : ''}`].filter(Boolean).join(' · ')} />
      </div>
      {!!a.warnings.length && <ul className="text-sm text-amber-800 bg-amber-50 border border-amber-200 rounded p-2 list-disc pl-6">{a.warnings.map(w => <li key={w}>{w}</li>)}</ul>}

      {!!a.energy.options.length && (
        <div className="bg-white border rounded-lg overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead className="bg-gray-50 text-left text-gray-600"><tr><th className="px-2 py-1">Use</th><th className="px-2 py-1">Method</th><th className="px-2 py-1">kcal/day</th><th className="px-2 py-1">Formula</th><th className="px-2 py-1">Notes</th></tr></thead>
            <tbody className="divide-y">{a.energy.options.map(o => (
              <tr key={o.id} className={o.id === a.energy.selected?.id ? 'bg-emerald-50' : ''}>
                <td className="px-2 py-1"><input type="radio" name="energy" disabled={!onSelectEnergy} checked={(selectedEnergy || a.energy.selected?.id) === o.id} onChange={() => onSelectEnergy?.(o.id)} /></td>
                <td className="px-2 py-1">{o.label}{o.id === a.energy.recommended?.id && <span className="ml-1 text-xs text-emerald-700">recommended</span>}</td>
                <td className="px-2 py-1">{o.value}{o.low ? <span className="text-xs text-gray-500"> ({o.low}–{o.high})</span> : null}</td>
                <td className="px-2 py-1 text-xs">{o.method}</td>
                <td className="px-2 py-1 text-xs text-amber-700">{[...o.warnings, ...o.assumptions].join(' · ')}</td>
              </tr>))}</tbody>
          </table>
        </div>
      )}

      {a.goal && a.goal.goal !== 'maintain' && <p className="text-sm"><b>{a.goal.goal === 'lose' ? 'Weight loss' : 'Weight gain'}:</b> {a.goal.method}; target {a.goal.targetKcal} kcal ({a.goal.adjustmentKcal > 0 ? '+' : ''}{a.goal.adjustmentKcal}), about {a.goal.rateKgWk} kg/week. {a.goal.notes.join(' ')}</p>}
      {!!a.goal?.blocked.length && <p className="text-sm text-red-700 flex gap-1"><AlertTriangle className="w-4 h-4 shrink-0" />{a.goal.blocked.join(' ')}</p>}
      {!!a.protein?.warnings.length && <p className="text-sm text-amber-800">{a.protein.warnings.join(' ')}</p>}

      {a.refeeding.risk !== 'low' && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-sm">
          <div className="font-medium text-red-800">Refeeding risk: {a.refeeding.risk.toUpperCase()}</div>
          <div className="text-red-800 text-xs mb-1">{[...a.refeeding.major, ...a.refeeding.minor].join(' · ')}</div>
          <ul className="list-disc pl-5 text-red-900">{a.refeeding.alerts.map(x => <li key={x}>{x}</li>)}</ul>
          {!!a.refeeding.schedule.length && <div className="flex flex-wrap gap-2 mt-2">{a.refeeding.schedule.map(d => <span key={d.day} className="bg-white border rounded px-2 py-0.5 text-xs">Day {d.day}: {d.kcal} kcal ({d.kcalPerKg}/kg)</span>)}</div>}
        </div>
      )}
      {!!a.fluid?.flags.length && <p className="text-xs text-gray-600">Fluid: {a.fluid.flags.join(' · ')}</p>}
      {!!a.micronutrients.length && (
        <div className="text-sm"><span className="font-medium">Micronutrient priorities (for clinician review, not a prescription): </span>{a.micronutrients.map(m => `${m.nutrient} — ${m.why}`).join('; ')}</div>
      )}
      {!!a.targets.restrictions.length && <div className="text-sm"><span className="font-medium">Diet restrictions: </span>{a.targets.restrictions.join('; ')}</div>}

      <button onClick={() => setShow(!show)} className="text-sm text-emerald-700 flex items-center gap-1">{show ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}Show working (inputs, formulas, sources)</button>
      {show && (
        <div className="bg-white border rounded-lg overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead className="bg-gray-50 text-left text-gray-600"><tr><th className="px-2 py-1">Item</th><th className="px-2 py-1">Value</th><th className="px-2 py-1">Method</th><th className="px-2 py-1">Inputs</th><th className="px-2 py-1">Assumptions / source</th></tr></thead>
            <tbody className="divide-y">
              <Working title="Height" c={a.height} /><Working title="Weight" c={a.weight} /><Working title="BMI" c={a.bmi} /><Working title="MUAC band" c={a.muacBand} />
              <Working title="Ideal body weight" c={a.ibw} /><Working title="Adjusted body weight" c={a.adjbw} /><Working title="Weight loss 3–6 mo (%)" c={a.lossPct} />
              <Working title="MAMC (cm)" c={a.mamc} /><Working title="Grip" c={a.grip} /><Working title="MUST" c={s.must} /><Working title="NRS-2002" c={s.nrs2002} />
              <Working title="SGA" c={s.sga} /><Working title="GLIM" c={s.glim} /><Working title="NUTRIC" c={s.nutric} /><Working title="Energy" c={a.energy.selected} />
              <Working title="Protein (g)" c={a.protein} /><Working title="Fluid (mL)" c={a.fluid} />
            </tbody>
          </table>
          <p className="text-xs text-gray-500 p-2">Coefficient set {a.configVersion} ({a.configStatus.replace(/_/g, ' ')}). {a.refeeding.method} ({a.refeeding.source}).</p>
        </div>
      )}
      <Notice />
    </div>
  );
}
