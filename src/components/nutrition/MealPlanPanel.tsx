/**
 * Weekly meal plan: generated from the latest assessment's targets with the
 * constrained solver, reviewed, then approved by a dietitian / consultant /
 * senior registrar. The approved plan drives the intake chart and the
 * patient's printable plan.
 */
import { useMemo, useState } from 'react';
import { AlertTriangle, CheckCircle2, Loader2, Save, Send, ShieldCheck, Sparkles } from 'lucide-react';
import toast from 'react-hot-toast';
import { generateMealPlan, NUTRITION_CONFIG, plannerOptionsFrom, type MealPlan, type NutritionAssessment, type PlanDay } from '../../clinical/nutrition';
import { nutritionService, type MealPlanRecord, type NutritionAssessmentRecord } from '../../services/nutritionService';
import { clean, Notice, Num, StatusBadge, Txt } from './fields';

export const SLOT_LABEL: Record<string, string> = { breakfast: 'Breakfast', mid_morning: 'Mid-morning', lunch: 'Lunch', afternoon: 'Afternoon', dinner: 'Dinner', evening: 'Evening' };
const SLOTS = Object.keys(SLOT_LABEL);

export function DayCard({ d, igbo }: { d: PlanDay; igbo: boolean }) {
  const e = d.totals.energy_kcal ?? 0, p = d.totals.protein_g ?? 0;
  return (
    <div className="bg-white border rounded-lg">
      <div className="flex justify-between items-center px-3 py-2 border-b bg-gray-50">
        <div className="font-medium">Day {d.day}</div>
        <div className={`text-xs ${d.withinTolerance ? 'text-emerald-700' : 'text-red-700'} flex items-center gap-1`}>
          {d.withinTolerance ? <CheckCircle2 className="w-3.5 h-3.5" /> : <AlertTriangle className="w-3.5 h-3.5" />}
          {e} / {d.targetKcal} kcal · {p} / {d.targetProteinG} g protein{d.totals.carb_g ? ` · ${d.totals.carb_g} g carb` : ''}
        </div>
      </div>
      {!d.withinTolerance && <p className="text-xs text-red-700 px-3 pt-1">{d.violations.join('; ')}{d.relaxed ? ` — shown with ${d.relaxed.join(', ').replace(/_/g, ' ')} relaxed` : ''}</p>}
      <table className="min-w-full text-sm">
        <thead className="text-left text-xs text-gray-500"><tr><th className="px-3 py-1">Meal</th><th className="px-3 py-1">Item</th><th className="px-3 py-1">Serve</th><th className="px-3 py-1">Raw / buy</th><th className="px-3 py-1">kcal</th><th className="px-3 py-1">Protein</th></tr></thead>
        <tbody className="divide-y">
          {SLOTS.flatMap(slot => d.items.filter(i => i.slot === slot).map((i, k) => (
            <tr key={i.key} className="align-top">
              <td className="px-3 py-1 text-xs text-gray-500">{k === 0 ? SLOT_LABEL[slot] : ''}</td>
              <td className="px-3 py-1">{igbo && i.igbo ? <><span>{i.igbo}</span> <span className="text-xs text-gray-500">({i.name})</span></> : i.name}
                {i.draftRecipe && <span className="ml-1 text-[10px] text-amber-700">draft recipe</span>}
                {i.ingredients && <div className="text-[11px] text-gray-500">{i.ingredients.map(g => `${g.rawG} g ${g.name}`).join(', ')}</div>}</td>
              <td className="px-3 py-1 whitespace-nowrap">{i.units ? `${i.units.n} ${i.units.label}${i.units.n > 1 ? 's' : ''}${i.servedG ? ` (${i.servedG} g)` : ''}` : `${i.servedG} g`}
                {i.measure && <div className="text-[11px] text-gray-500">{i.measure.text}{i.measure.verified ? '' : ' *'}</div>}</td>
              <td className="px-3 py-1 text-xs">{i.kind === 'ons' ? '—' : `${i.rawG} g`}</td>
              <td className="px-3 py-1">{i.nutrients.energy_kcal ?? 0}</td>
              <td className="px-3 py-1">{i.nutrients.protein_g ?? 0} g</td>
            </tr>
          )))}
        </tbody>
      </table>
    </div>
  );
}

export function MealPlanPanel({ patientId, assessment, plans, canApprove, canDraft, onSaved }: {
  patientId: string; assessment: NutritionAssessmentRecord | null; plans: MealPlanRecord[]; canApprove: boolean; canDraft: boolean; onSaved: () => void;
}) {
  const live = plans.filter(p => !['entered_in_error', 'superseded'].includes(p.status));
  const [plan, setPlan] = useState<MealPlan | null>(live[0]?.plan?.days ? live[0].plan : null);
  const [rec, setRec] = useState<MealPlanRecord | null>(live[0] && ['draft', 'pending_review'].includes(live[0].status) ? live[0] : null);
  const [shown, setShown] = useState<MealPlanRecord | null>(live[0] || null);
  const [foodVersion, setFoodVersion] = useState<string | null>(live[0]?.food_data_version ?? null);
  const [ons, setOns] = useState({ name: '', kcal: null as number | null, proteinG: null as number | null, maxServings: 2 as number | null });
  const [igbo, setIgbo] = useState(false);
  const [busy, setBusy] = useState<'gen' | 'save' | null>(null);
  const result = assessment?.result as NutritionAssessment | undefined;
  const opts = useMemo(() => (result ? plannerOptionsFrom(result, patientId, ons.name && ons.kcal && ons.proteinG ? { name: ons.name, kcal: ons.kcal, proteinG: ons.proteinG, maxServings: ons.maxServings || 1 } : null) : null), [result, patientId, ons]);

  const generate = async () => {
    if (!opts) return;
    setBusy('gen');
    try {
      const cat = await nutritionService.catalog();
      if (!cat.recipes.length) { toast.error('No recipes yet — import WAFCT 2019 and apply the Enugu layer in the food database'); return; }
      const p = generateMealPlan(cat as any, opts);
      setPlan(p); setFoodVersion(cat.food_data_version); setShown(null); setRec(null);
      toast[p.weekly.daysWithinTolerance === p.days.length ? 'success' : 'error'](`${p.weekly.daysWithinTolerance} of ${p.days.length} days within targets`);
    } catch (e) { toast.error(clean(e)); } finally { setBusy(null); }
  };
  const save = async (then?: 'submit' | 'approve') => {
    if (!plan || !opts) return;
    setBusy('save');
    try {
      let r = await nutritionService.savePlan({
        id: rec?.id, version: rec?.version, patient_id: patientId, assessment_id: assessment?.id ?? null, config_version: NUTRITION_CONFIG.version,
        food_data_version: foodVersion || undefined, targets: opts.targets, plan, solver: { options: opts, suggestions: plan.suggestions, warnings: plan.warnings },
      });
      if (then === 'submit') r = await nutritionService.submit('plan', r.id, r.version);
      if (then === 'approve') r = await nutritionService.approve('plan', r.id, r.version);
      setRec(['draft', 'pending_review'].includes(r.status) ? r : null); setShown(r);
      toast.success(then === 'approve' ? 'Meal plan approved' : then === 'submit' ? 'Submitted for approval' : 'Draft saved');
      onSaved();
    } catch (e) { toast.error(clean(e)); } finally { setBusy(null); }
  };

  if (!assessment) return <p className="text-sm text-gray-600">Complete a nutrition assessment first — the plan is built from its targets.</p>;
  if (!result?.scope?.inScope) return <p className="text-sm text-red-700">{result?.scope?.notice || 'Out of scope'} — no meal plan is generated.</p>;
  return (
    <div className="space-y-3">
      <div className="bg-gray-50 border rounded-lg p-3 space-y-2">
        <div className="text-sm">Targets from the {assessment.status.replace('_', ' ')} assessment of {new Date(assessment.created_at).toLocaleDateString()}:
          <b> {opts?.targets.kcal} kcal</b>, <b>{opts?.targets.proteinG} g protein</b>{opts?.targets.carbMaxG ? `, carbohydrate ≤ ${opts.targets.carbMaxG} g` : ''}{opts?.targets.sodiumMaxMg ? `, sodium < ${opts.targets.sodiumMaxMg} mg` : ''}{opts?.dailyKcal ? ' · refeeding schedule applied' : ''}.
          {assessment.status !== 'approved' && <span className="text-amber-700"> The assessment is not yet approved.</span>}</div>
        <div className="grid grid-cols-2 md:grid-cols-5 gap-2 items-end">
          <Txt label="Oral nutritional supplement (optional)" placeholder="product name" value={ons.name} onChange={v => setOns({ ...ons, name: v })} />
          <Num label="ONS energy" unit="kcal/serving" value={ons.kcal} onChange={v => setOns({ ...ons, kcal: v })} />
          <Num label="ONS protein" unit="g/serving" value={ons.proteinG} onChange={v => setOns({ ...ons, proteinG: v })} />
          <Num label="Max servings" unit="/day" value={ons.maxServings} onChange={v => setOns({ ...ons, maxServings: v })} />
          <button disabled={!!busy || !canDraft} onClick={generate} className="h-9 px-3 rounded bg-emerald-600 text-white text-sm flex items-center justify-center gap-1 disabled:opacity-50">
            {busy === 'gen' ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}Generate 7-day plan</button>
        </div>
        <p className="text-xs text-gray-500">ONS values are entered from the product label; nothing is assumed.</p>
      </div>
      {plan && (
        <>
          <div className="flex flex-wrap items-center gap-3 text-sm">
            {shown && <StatusBadge status={shown.status} />}
            {shown?.approved_by_name && <span className="text-xs text-gray-600">Approved by {shown.approved_by_name} ({shown.approved_by_role?.replace('_', ' ')}) {shown.approved_at ? new Date(shown.approved_at).toLocaleString() : ''}</span>}
            <span>Weekly average {plan.weekly.avgKcal} kcal · {plan.weekly.avgProteinG} g protein · {plan.weekly.daysWithinTolerance}/{plan.days.length} days within targets</span>
            <label className="flex items-center gap-1 text-xs"><input type="checkbox" checked={igbo} onChange={e => setIgbo(e.target.checked)} />Igbo names</label>
          </div>
          {!!plan.suggestions.length && <ul className="text-sm text-red-800 bg-red-50 border border-red-200 rounded p-2 list-disc pl-6">{plan.suggestions.map(s => <li key={s}>{s}</li>)}</ul>}
          {!!plan.warnings.length && <ul className="text-xs text-amber-800 bg-amber-50 border border-amber-200 rounded p-2 list-disc pl-6">{plan.warnings.map(s => <li key={s}>{s}</li>)}</ul>}
          {!!plan.trajectory.length && <p className="text-sm">Projected weight: {plan.trajectory.filter(t => t.week % 2 === 0).map(t => `wk ${t.week}: ${t.kg} kg`).join(' · ')}</p>}
          <div className="space-y-3">{plan.days.map(d => <DayCard key={d.day} d={d} igbo={igbo} />)}</div>
          <p className="text-xs text-gray-500">* household measure not yet verified by local weighing. Raw weights are edible-portion weights of ingredients before cooking (buy slightly more for peel and bones).</p>
          {canDraft && (!shown || ['draft', 'pending_review'].includes(shown.status)) && (
            <div className="flex flex-wrap gap-2 justify-end">
              <button disabled={!!busy} onClick={() => save()} className="px-3 py-1.5 border rounded text-sm flex items-center gap-1"><Save className="w-4 h-4" />Save draft</button>
              {!canApprove && <button disabled={!!busy} onClick={() => save('submit')} className="px-3 py-1.5 rounded bg-amber-600 text-white text-sm flex items-center gap-1"><Send className="w-4 h-4" />Submit for approval</button>}
              {canApprove && <button disabled={!!busy} onClick={() => save('approve')} className="px-3 py-1.5 rounded bg-emerald-600 text-white text-sm flex items-center gap-1"><ShieldCheck className="w-4 h-4" />Approve plan</button>}
            </div>
          )}
          <Notice />
        </>
      )}
    </div>
  );
}
