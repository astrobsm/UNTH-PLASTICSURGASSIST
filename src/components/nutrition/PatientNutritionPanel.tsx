/**
 * The patient's nutrition record — one place for screening, assessment,
 * measurements, the food chart, the approved meal plan and trends. Other
 * modules (ward round, burns, pre-op, wound, discharge) show a summary of this
 * record and link here; none keeps its own nutrition calculation.
 */
import { useCallback, useEffect, useMemo, useState } from 'react';
import { AlertTriangle, CalendarClock, FileText, Loader2, RefreshCw, ShieldCheck } from 'lucide-react';
import { useAuthStore } from '../../store/authStore';
import type { ReportMeta } from '../../clinical/nutrition/pdf';
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

export function PatientNutritionPanel({ patientId, ctx: ctxProp, initialTab = 'overview', patientName, hospitalNumber }: {
  patientId: string; ctx: PatientContext; initialTab?: Tab; patientName?: string; hospitalNumber?: string;
}) {
  const { user } = useAuthStore();
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
  const meta = (r: { status?: string; approved_by_name?: string | null; approved_at?: string | null; food_data_version?: string | null } | null): ReportMeta => ({
    patientName: patientName || `Patient ${patientId}`, hospitalNumber, ward: ctx.ward,
    ageSex: [ctx.ageYears != null ? `${ctx.ageYears} y` : null, ctx.sex].filter(Boolean).join(' · ') || null,
    author: user?.name || (user as any)?.full_name || 'Unknown', status: r?.status, approvedBy: r?.approved_by_name, approvedAt: r?.approved_at, foodDataVersion: r?.food_data_version,
  });
  const pdf = async (kind: 'summary' | 'dietitian' | 'patient', igbo = false) => {
    const m = await import('../../clinical/nutrition/pdf');
    const planRec = activePlan || rec.meal_plans.find(p => !['entered_in_error', 'superseded'].includes(p.status)) || null;
    if (kind === 'patient') {
      if (!planRec) return toast.error('No meal plan yet');
      const md = meta(planRec);
      return m.savePdf(m.buildPatientPlanPdf(planRec.plan, md, { igbo, fluidMl: latest?.result?.targets?.fluidMl, restrictions: latest?.result?.targets?.restrictions }), md, 'meal_plan');
    }
    if (!latest) return toast.error('No assessment yet');
    const md = meta({ ...latest, food_data_version: planRec?.food_data_version });
    const intakeDays = intakePctSeries(rec.intake, status.summary?.kcal ?? null).map(p => {
      const day = rec.intake.filter(r => String(r.intake_date).slice(0, 10) === p.date);
      return { date: p.date, pct: p.value, kcal: day.reduce((s, r) => s + Number(r.kcal), 0), proteinG: day.reduce((s, r) => s + Number(r.protein_g), 0) };
    });
    const doc = kind === 'summary'
      ? m.buildClinicianSummaryPdf(latest.result, md, { alerts: status.alerts, schedule: status.schedule, plan: planRec?.plan })
      : m.buildDietitianReportPdf(latest.result, md, { measurements: rec.measurements, intakeDays, plan: planRec?.plan });
    m.savePdf(doc, md, kind === 'summary' ? 'nutrition_summary' : 'dietitian_report');
  };
  const tabs: [Tab, string][] = [['overview', 'Overview'], ['assessment', 'Assessment'], ['measurements', 'Measurements'], ['intake', 'Food chart'], ['plan', 'Meal plan'], ['trends', 'Trends']];

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-1 border-b">
        {tabs.map(([id, l]) => <button key={id} onClick={() => setTab(id)} className={`px-3 py-1.5 text-sm border-b-2 -mb-px ${tab === id ? 'border-emerald-600 text-emerald-700 font-medium' : 'border-transparent text-gray-600'}`}>{l}</button>)}
        <div className="ml-auto flex items-center gap-1">
          <button onClick={() => void pdf('summary')} className="px-2 py-1 text-xs border rounded flex items-center gap-1" title="One page for the ward round / case notes"><FileText className="w-3.5 h-3.5" />Clinician summary</button>
          <button onClick={() => void pdf('dietitian')} className="px-2 py-1 text-xs border rounded flex items-center gap-1"><FileText className="w-3.5 h-3.5" />Dietitian report</button>
          <button onClick={() => void pdf('patient')} className="px-2 py-1 text-xs border rounded flex items-center gap-1"><FileText className="w-3.5 h-3.5" />Patient plan</button>
          <button onClick={() => void pdf('patient', true)} className="px-2 py-1 text-xs border rounded" title="Patient plan with Igbo food names">Igbo</button>
          <button onClick={() => void load()} className="p-1 text-gray-500" title="Refresh"><RefreshCw className="w-4 h-4" /></button>
        </div>
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
