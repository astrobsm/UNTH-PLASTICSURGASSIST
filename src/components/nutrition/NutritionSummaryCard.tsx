/**
 * The patient's nutrition status in one card, for the modules that need it —
 * ward round, burns, pre-op, wound, pressure sore, limb salvage, sickle cell,
 * discharge. Reads the shared nutrition record; never calculates on its own.
 */
import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { AlertTriangle, Apple, Loader2 } from 'lucide-react';
import { patientStatus, type PatientContext } from '../../clinical/nutrition/record';
import { nutritionService, type PatientNutrition } from '../../services/nutritionService';
import { levelTone } from './fields';

const LEVEL: Record<string, string> = { low: 'Low risk', medium: 'Medium risk', high: 'High risk', refeeding: 'Refeeding risk' };

export function NutritionSummaryCard({ patientId, ctx = {}, context }: { patientId: string | number | null | undefined; ctx?: PatientContext; context?: string }) {
  const [rec, setRec] = useState<PatientNutrition | null>(null);
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    if (!patientId) return;
    let live = true;
    nutritionService.patient(String(patientId)).then(r => live && setRec(r)).catch(() => live && setFailed(true));
    return () => { live = false; };
  }, [patientId]);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const status = useMemo(() => (rec ? patientStatus(rec as any, ctx) : null), [rec]);
  if (!patientId || failed) return null;
  const link = `/patients/${patientId}?section=nutrition`;
  if (!status) return <div className="border rounded-lg p-2 text-sm text-gray-500 flex items-center gap-2"><Loader2 className="w-4 h-4 animate-spin" />Nutrition…</div>;
  const s = status.summary;
  const plan = rec?.meal_plans.find(p => p.status === 'approved');
  return (
    <div className="border rounded-lg p-3 bg-white space-y-1.5 text-sm">
      <div className="flex flex-wrap items-center gap-2">
        <Apple className="w-4 h-4 text-emerald-600" /><span className="font-medium">Nutrition{context ? ` — ${context}` : ''}</span>
        {s && <span className={`px-2 py-0.5 rounded text-xs ${levelTone(status.level)}`}>{LEVEL[status.level] || status.level}</span>}
        <Link to={link} className="ml-auto text-xs text-emerald-700 underline">Open nutrition record</Link>
      </div>
      {s ? (
        <div className="text-gray-700">
          {s.in_scope === false ? <span className="text-red-700">{s.scope_notice}</span> : <>Targets <b>{s.kcal ?? '—'} kcal</b> · <b>{s.protein_g ?? '—'} g protein</b>{s.fluid_ml ? ` · ${s.fluid_ml} mL fluid` : ''}</>}
          {' · '}MUST {s.must ?? '—'} · GLIM {s.glim}{s.bmi ? ` · BMI ${s.bmi}` : ''}{s.refeeding && s.refeeding !== 'low' ? <b className="text-red-700"> · refeeding risk {s.refeeding}</b> : null}
          <div className="text-xs text-gray-500">{plan ? `Approved meal plan from ${new Date(plan.approved_at || plan.created_at).toLocaleDateString()}` : 'No approved meal plan'} · assessed {new Date(status.latest!.created_at).toLocaleDateString()} ({status.latest!.status.replace('_', ' ')})</div>
        </div>
      ) : <p className="text-gray-600">Not yet assessed.</p>}
      {status.due && <p className="text-xs text-blue-800">{status.due}</p>}
      {status.alerts.slice(0, 3).map(a => <p key={a.id} className={`text-xs flex gap-1 ${a.severity === 'urgent' ? 'text-red-700' : 'text-amber-800'}`}><AlertTriangle className="w-3.5 h-3.5 shrink-0" />{a.text}</p>)}
    </div>
  );
}
