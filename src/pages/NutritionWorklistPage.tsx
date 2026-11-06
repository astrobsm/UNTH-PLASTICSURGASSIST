/**
 * Clinical nutrition worklist — every patient with a nutrition assessment,
 * highest risk first, with what needs doing: approval, reassessment, refeeding.
 */
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Apple, Database, Loader2, RefreshCw } from 'lucide-react';
import toast from 'react-hot-toast';
import { nutritionService } from '../services/nutritionService';
import { clean, levelTone, StatusBadge } from '../components/nutrition/fields';

const RANK: Record<string, number> = { refeeding: 0, high: 1, medium: 2, low: 3 };
const LEVEL: Record<string, string> = { low: 'Low', medium: 'Medium', high: 'High', refeeding: 'Refeeding' };

export default function NutritionWorklistPage() {
  const [data, setData] = useState<any>(null);
  const [filter, setFilter] = useState<'all' | 'action'>('action');
  const load = useCallback(async () => { try { setData(await nutritionService.worklist()); } catch (e) { toast.error(clean(e)); setData({ assessments: [], pending_plans: [] }); } }, []);
  useEffect(() => { void load(); }, [load]);

  const rows = useMemo(() => {
    const now = Date.now();
    const pendingPlans = new Set((data?.pending_plans || []).map((p: any) => String(p.patient_id)));
    return (data?.assessments || []).map((a: any) => {
      const days = Math.floor((now - Date.parse(a.created_at)) / 86_400_000);
      const actions = [
        a.status === 'pending_review' && 'Assessment awaiting approval',
        a.status === 'draft' && 'Assessment in draft',
        pendingPlans.has(String(a.patient_id)) && 'Meal plan awaiting approval',
        days >= 7 && `Reassess (${days} days)`,
        a.summary?.refeeding && a.summary.refeeding !== 'low' && 'Refeeding protocol — daily K, PO₄, Mg',
        a.summary?.in_scope === false && 'Specialist input required',
      ].filter(Boolean) as string[];
      return { ...a, days, actions };
    }).sort((x: any, y: any) => (RANK[x.summary?.level] ?? 2) - (RANK[y.summary?.level] ?? 2) || y.actions.length - x.actions.length);
  }, [data]);
  const shown = filter === 'action' ? rows.filter((r: any) => r.actions.length) : rows;

  return (
    <div className="max-w-6xl mx-auto p-4 space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <Apple className="w-6 h-6 text-emerald-600" />
        <div><h1 className="text-xl font-semibold">Clinical nutrition</h1><p className="text-sm text-gray-600">Patients under nutrition care, highest risk first.</p></div>
        <div className="ml-auto flex gap-2">
          <Link to="/nutrition/foods" className="px-3 py-1.5 border rounded text-sm flex items-center gap-1"><Database className="w-4 h-4" />Food database</Link>
          <button onClick={() => void load()} className="px-3 py-1.5 border rounded text-sm flex items-center gap-1"><RefreshCw className="w-4 h-4" />Refresh</button>
        </div>
      </div>
      <div className="flex gap-2 text-sm">
        <button onClick={() => setFilter('action')} className={`px-3 py-1 rounded ${filter === 'action' ? 'bg-emerald-600 text-white' : 'bg-gray-100'}`}>Needs action ({rows.filter((r: any) => r.actions.length).length})</button>
        <button onClick={() => setFilter('all')} className={`px-3 py-1 rounded ${filter === 'all' ? 'bg-emerald-600 text-white' : 'bg-gray-100'}`}>All ({rows.length})</button>
      </div>
      {!data ? <Loader2 className="w-5 h-5 animate-spin" /> : (
        <div className="bg-white border rounded-lg overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead className="bg-gray-50 text-left text-gray-600"><tr><th className="px-3 py-2">Patient</th><th className="px-3 py-2">Risk</th><th className="px-3 py-2">Targets</th><th className="px-3 py-2">Screening</th><th className="px-3 py-2">Assessment</th><th className="px-3 py-2">To do</th></tr></thead>
            <tbody className="divide-y">
              {shown.map((r: any) => (
                <tr key={r.patient_id} className="align-top">
                  <td className="px-3 py-2"><Link to={`/patients/${r.patient_id}?section=nutrition`} className="text-emerald-700 font-medium hover:underline">{[r.first_name, r.last_name].filter(Boolean).join(' ') || `Patient ${r.patient_id}`}</Link>
                    <div className="text-xs text-gray-500">{r.hospital_number}</div></td>
                  <td className="px-3 py-2"><span className={`px-2 py-0.5 rounded text-xs ${levelTone(r.summary?.level)}`}>{LEVEL[r.summary?.level] || '—'}</span></td>
                  <td className="px-3 py-2 text-xs">{r.summary?.kcal ? `${r.summary.kcal} kcal · ${r.summary.protein_g} g protein` : '—'}{r.summary?.goal && r.summary.goal !== 'maintain' ? <div>{r.summary.goal === 'lose' ? 'Loss' : 'Gain'} {r.summary.rate_kg_wk} kg/wk</div> : null}</td>
                  <td className="px-3 py-2 text-xs">MUST {r.summary?.must ?? '—'} · GLIM {r.summary?.glim ?? '—'}{r.summary?.bmi ? ` · BMI ${r.summary.bmi}` : ''}</td>
                  <td className="px-3 py-2 text-xs"><StatusBadge status={r.status} /><div className="text-gray-500">{r.days} d ago · {r.created_by_name}</div></td>
                  <td className="px-3 py-2 text-xs">{r.actions.length ? <ul className="list-disc pl-4">{r.actions.map((x: string) => <li key={x}>{x}</li>)}</ul> : <span className="text-gray-400">—</span>}</td>
                </tr>
              ))}
              {!shown.length && <tr><td colSpan={6} className="px-3 py-6 text-center text-gray-500">{filter === 'action' ? 'Nothing needs action.' : 'No nutrition assessments yet.'}</td></tr>}
            </tbody>
          </table>
        </div>
      )}
      <p className="text-xs text-gray-500">Generated by decision-support software. Review before clinical use.</p>
    </div>
  );
}
