/**
 * A seven-day plan against explicit targets, built by the constrained solver
 * from the WAFCT 2019 catalogue. Used by the bedside calculators and modules
 * that work from a target rather than a patient's nutrition record. It is a
 * draft for discussion; the patient's approved plan lives in their record.
 */
import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Loader2 } from 'lucide-react';
import { generateMealPlan, type MealPlan, type PlannerOptions } from '../../clinical/nutrition/planner';
import { nutritionService } from '../../services/nutritionService';
import { DayCard } from './MealPlanPanel';
import { clean, Notice } from './fields';

let catalogPromise: ReturnType<typeof nutritionService.catalog> | null = null;
/** The catalogue changes rarely; one fetch per session. */
export const loadCatalog = () => (catalogPromise ??= nutritionService.catalog().catch(e => { catalogPromise = null; throw e; }));

export function useQuickPlan(targetKcal: number, proteinG: number, extra: Partial<PlannerOptions> = {}, enabled = true) {
  const [plan, setPlan] = useState<MealPlan | null>(null);
  const [error, setError] = useState<string | null>(null);
  const key = JSON.stringify([targetKcal, proteinG, extra, enabled]);
  useEffect(() => {
    if (!enabled || !(targetKcal > 0) || !(proteinG > 0)) { setPlan(null); return; }
    let live = true;
    setPlan(null); setError(null);
    loadCatalog().then(cat => {
      if (!live) return;
      if (!cat.recipes.length) { setError('empty'); return; }
      setPlan(generateMealPlan(cat as any, { targets: { kcal: targetKcal, proteinG }, ...extra }));
    }).catch(e => live && setError(clean(e)));
    return () => { live = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);
  return { plan, error };
}

export function QuickMealPlan({ targetKcal, proteinG, options, intro }: { targetKcal: number; proteinG: number; options?: Partial<PlannerOptions>; intro?: string }) {
  const { plan, error } = useQuickPlan(targetKcal, proteinG, options);
  const [igbo, setIgbo] = useState(false);
  if (error === 'empty') return <p className="text-sm text-amber-700">The food database has no recipes yet. <Link to="/nutrition/foods" className="underline">Import WAFCT 2019 and apply the Enugu layer</Link>.</p>;
  if (error) return <p className="text-sm text-red-700">{error}</p>;
  if (!plan) return <Loader2 className="w-5 h-5 animate-spin" />;
  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center gap-3 text-xs text-gray-600">
        <span>{intro || `Built to ${targetKcal.toLocaleString()} kcal and ${proteinG} g protein a day`} from WAFCT 2019 values — {plan.weekly.daysWithinTolerance}/{plan.days.length} days within targets.</span>
        <label className="flex items-center gap-1"><input type="checkbox" checked={igbo} onChange={e => setIgbo(e.target.checked)} />Igbo names</label>
      </div>
      {!!plan.suggestions.length && <ul className="text-xs text-red-800 list-disc pl-5">{plan.suggestions.map(s => <li key={s}>{s}</li>)}</ul>}
      {plan.days.map(d => <DayCard key={d.day} d={d} igbo={igbo} />)}
      <Notice />
    </div>
  );
}
