/**
 * The patient's nutrition record — one place for screening, assessment,
 * measurements, the food chart, the approved meal plan and trends. Other
 * modules (ward round, burns, pre-op, wound, discharge) show a summary of this
 * record and link here; none keeps its own nutrition calculation.
 */
import { useCallback, useEffect, useMemo, useState } from 'react';
import { AlertTriangle, CalendarClock, Loader2, RefreshCw, ShieldCheck } from 'lucide-react';
import toast from 'react-hot-toast';
import { intakePctSeries, nitrogenSeries, patientStatus, type PatientContext } from '../../clinical/nutrition';
import { nutritionService, type PatientNutrition } from '../../services/nutritionService';
import { AssessmentResultView } from './AssessmentResultView';
import { clean, levelTone, StatusBadge } from './fields';
import { IntakePanel } from './IntakePanel';
import { MealPlanPanel } from './MealPlanPanel';
import { MeasurementsPanel } from './MeasurementsPanel';
import { NutritionAssessmentForm } from './NutritionAssessmentForm';
import { NutritionTrends } from './NutritionTrends';

type Tab = 'overview' | 'assessment' | 'measurements' | 'intake' | 'plan' | 'trends';
const LEVEL: Record<string, string> = { low: 'Low risk', medium: 'Medium risk', high: 'High risk', refeeding: 'Refeeding risk' };

export function PatientNutritionPanel({ patientId, ctx: ctxProp, initialTab = 'overview' }: { patientId: string; ctx: PatientContext; initialTab?: Tab }) {
  const ctxKey = JSON.stringify(ctxProp);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const ctx = useMemo(() => ctxProp, [ctxKey]);
  const [rec, setRec] = useState<PatientNutrition | null>(null);
  const [tab, setTab] = useState<Tab>(initialTab);
  const load = useCallback(async () => {
    try { setRec(await nutritionService.patient(patientId)); } catch (e) { toast.error(clean(e)); }
  }, [patientId]);
  useEffect(() => { void load(); }, [load]);

  const status = useMemo(() => (rec ? patientStatus(rec as any, ctx) : null), [rec, ctx]);
  const activePlan = useMemo(() => rec?.meal_plans.find(p => p.status === 'approved') || null, [rec]);
  const pending = useMemo(() => [...(rec?.assessments || []), ...(rec?.meal_plans || [])].filter(r => r.status === 'pending_review'), [rec]);

  if (!rec || !status) return <div className="p-4"><Loader2 className="w-5 h-5 animate-spin" /></div>;
  const latest = status.latest as any;
  const approve = async (r: any) => {
    const kind = 'targets' in r && 'plan' in r ? 'plan' : 'assessment';
    try { await nutritionService.approve(kind, r.id, r.version); toast.success('Approved'); void load(); } catch (e) { toast.error(clean(e)); }
  };
  const tabs: [Tab, string][] = [['overview', 'Overview'], ['assessment', 'Assessment'], ['measurements', 'Measurements'], ['intake', 'Food chart'], ['plan', 'Meal plan'], ['trends', 'Trends']];

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-1 border-b">
        {tabs.map(([id, l]) => <button key={id} onClick={() => setTab(id)} className={`px-3 py-1.5 text-sm border-b-2 -mb-px ${tab === id ? 'border-emerald-600 text-emerald-700 font-medium' : 'border-transparent text-gray-600'}`}>{l}</button>)}
        <button onClick={() => void load()} className="ml-auto p-1 text-gray-500" title="Refresh"><RefreshCw className="w-4 h-4" /></button>
      </div>

      {tab === 'overview' && (
        <div className="space-y-3">
          {status.due && <div className="bg-blue-50 border border-blue-200 rounded p-2 text-sm text-blue-900 flex items-center gap-2"><CalendarClock className="w-4 h-4" />{status.due}
            <button onClick={() => setTab('assessment')} className="ml-auto text-xs underline">Assess now</button></div>}
          {status.alerts.map(a => (
            <div key={a.id} className={`rounded p-2 text-sm flex gap-2 ${a.severity === 'urgent' ? 'bg-red-50 border border-red-200 text-red-800' : 'bg-amber-50 border border-amber-200 text-amber-900'}`}><AlertTriangle className="w-4 h-4 shrink-0" />{a.text}</div>
          ))}
          {latest ? (
            <div className="bg-white border rounded-lg p-3 space-y-2">
              <div className="flex flex-wrap items-center gap-2 text-sm">
                <span className={`px-2 py-0.5 rounded ${levelTone(status.level)}`}>{LEVEL[status.level] || status.level}</span>
                <StatusBadge status={latest.status} />
                <span className="text-gray-600">Assessed {new Date(latest.created_at).toLocaleString()} by {latest.created_by_name || '—'}{latest.approved_by_name ? ` · approved by ${latest.approved_by_name}` : ''}</span>
              </div>
              <AssessmentResultView a={latest.result} />
            </div>
          ) : <p className="text-sm text-gray-600">No nutrition assessment yet.</p>}
          {!!status.changes.length && (
            <div className="bg-white border rounded-lg p-3 text-sm"><div className="font-medium mb-1">Recalculated from today's measurements</div>
              <ul className="list-disc pl-5">{status.changes.map(c => <li key={c.what}>{c.what}: {c.from} → {c.to}{c.why.length ? ` (${c.why.join(', ')})` : ''}</li>)}</ul></div>
          )}
          <div className="bg-white border rounded-lg p-3">
            <div className="text-sm font-medium mb-1">Monitoring schedule ({LEVEL[status.level] || status.level})</div>
            <table className="text-sm"><tbody>{status.schedule.map(s => <tr key={s.what}><td className="pr-4 text-gray-600">{s.what}</td><td>{s.when}</td></tr>)}</tbody></table>
          </div>
          {!!pending.length && (
            <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 text-sm">
              <div className="font-medium mb-1">Awaiting approval</div>
              {pending.map((r: any) => (
                <div key={`${r.id}-${'plan' in r ? 'p' : 'a'}`} className="flex items-center gap-2">
                  {'plan' in r ? 'Meal plan' : 'Assessment'} by {r.created_by_name} · {new Date(r.created_at).toLocaleString()}
                  {rec.can_approve && <button onClick={() => approve(r)} className="ml-auto px-2 py-0.5 rounded bg-emerald-600 text-white text-xs flex items-center gap-1"><ShieldCheck className="w-3.5 h-3.5" />Approve</button>}
                </div>
              ))}
            </div>
          )}
        </div>
      )}
      {tab === 'assessment' && (rec.can_draft
        ? <NutritionAssessmentForm patientId={patientId} ctx={ctx} measurements={rec.measurements} previous={latest} canApprove={rec.can_approve} canDraft={rec.can_draft} onSaved={() => { void load(); setTab('overview'); }} />
        : <p className="text-sm text-gray-600">Your role records measurements and the food chart; assessments are completed by doctors and dietitians.</p>)}
      {tab === 'measurements' && <MeasurementsPanel patientId={patientId} measurements={rec.measurements} onChanged={load} />}
      {tab === 'intake' && <IntakePanel patientId={patientId} planRec={activePlan} intake={rec.intake} onSaved={load} />}
      {tab === 'plan' && <MealPlanPanel patientId={patientId} assessment={latest} plans={rec.meal_plans} canApprove={rec.can_approve} canDraft={rec.can_draft} onSaved={load} />}
      {tab === 'trends' && <NutritionTrends measurements={rec.measurements} intakePct={intakePctSeries(rec.intake, status.summary?.kcal ?? null)} nBalance={nitrogenSeries(rec.measurements, rec.intake)} />}
    </div>
  );
}
