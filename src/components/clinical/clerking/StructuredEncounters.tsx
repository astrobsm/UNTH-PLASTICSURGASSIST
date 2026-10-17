/**
 * Patient-profile panels for structured encounters:
 *   StructuredEncountersPanel  (Encounters tab) start / continue the initial
 *                              clerking, follow-ups, review & sign, problem
 *                              list and plan tracking, encounter history.
 *   ClinicalOutcomesSummary    (Summary tab) outcomes of every tracked problem
 *                              and plan item across encounters.
 */
import React, { useCallback, useEffect, useRef, useState } from 'react';
import toast from 'react-hot-toast';
import { useAuthStore } from '../../../store/authStore';
import type { PatientContext } from '../../../clinical/clerking/engine';
import { clinicalEncounterService, localDraft, type ClinicalEncounter, type PatientEncounters, type TrackedPlanItem, type TrackedProblem } from '../../../services/clinicalEncounterService';
import InitialEncounterForm from './InitialEncounterForm';
import FollowUpEncounterForm from './FollowUpEncounterForm';

const STATUS_STYLE: Record<string, string> = {
  draft: 'bg-gray-100 text-gray-700', pending_review: 'bg-amber-100 text-amber-800', signed: 'bg-green-100 text-green-800', entered_in_error: 'bg-red-100 text-red-700 line-through',
  active: 'bg-blue-100 text-blue-800', improving: 'bg-green-100 text-green-800', worsening: 'bg-red-100 text-red-800', resolved: 'bg-emerald-100 text-emerald-800', ruled_out: 'bg-slate-100 text-slate-700',
  pending: 'bg-gray-100 text-gray-700', in_progress: 'bg-blue-100 text-blue-800', done: 'bg-green-100 text-green-800', not_done: 'bg-amber-100 text-amber-800', stopped: 'bg-slate-100 text-slate-700',
};
const label = (s: string) => s.replace(/_/g, ' ');
const Badge: React.FC<{ s: string }> = ({ s }) => <span className={`text-[11px] px-2 py-0.5 rounded-full capitalize ${STATUS_STYLE[s] || 'bg-gray-100'}`}>{label(s)}</span>;
const fmt = (d?: string | null) => (d ? new Date(d).toLocaleString(undefined, { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : '');

function useEncounters(patientId: string) {
  const [state, setState] = useState<PatientEncounters | null>(null);
  const [error, setError] = useState<string | null>(null);
  const current = useRef(patientId);
  const load = useCallback(async () => {
    current.current = patientId;
    try {
      const r = await clinicalEncounterService.list(patientId);
      if (current.current === patientId) { setState(r); setError(null); }
    } catch (e: any) {
      if (current.current === patientId) setError(navigator.onLine ? 'Could not load structured encounters' : 'Offline — structured encounters load when you reconnect');
    }
  }, [patientId]);
  useEffect(() => { setState(null); load(); }, [load]);
  return { state, error, reload: load };
}

export const StructuredEncountersPanel: React.FC<{ patientId: string; patientLabel: string; ctx: PatientContext; userName: string }> = ({ patientId, patientLabel, ctx, userName }) => {
  const { user } = useAuthStore();
  const { state, error, reload } = useEncounters(patientId);
  const [form, setForm] = useState<{ type: 'initial' | 'follow_up'; existing?: ClinicalEncounter | null } | null>(null);
  const [viewing, setViewing] = useState<number | null>(null);

  const encounters = (state?.encounters || []).filter(e => e.status !== 'entered_in_error' || viewing === e.id);
  const initial = (state?.encounters || []).find(e => e.encounter_type === 'initial' && e.status !== 'entered_in_error' && e.status !== 'draft')
    || (state?.encounters || []).find(e => e.encounter_type === 'initial' && e.status !== 'entered_in_error');
  const myDraft = (state?.encounters || []).find(e => e.status === 'draft' && String(e.created_by) === String(user?.id));
  const localInitial = localDraft.load<any>(patientId, 'initial');
  const pending = (state?.encounters || []).filter(e => e.status === 'pending_review');
  const problems = state?.problems || [];
  const planItems = state?.plan_items || [];
  const canSign = !!state?.can_sign;

  const openExisting = (e: ClinicalEncounter) => setForm({ type: e.encounter_type, existing: e });

  const changeStatus = async (kind: 'problem' | 'plan', id: number, status: string) => {
    try {
      if (kind === 'problem') await clinicalEncounterService.updateProblem(id, status);
      else await clinicalEncounterService.updatePlanItem(id, status);
      reload();
    } catch (e: any) {
      toast.error(String(e?.message || 'Could not update').replace(/^\[HTTP \d+\]\s*/, ''));
    }
  };

  const markError = async (e: ClinicalEncounter) => {
    const reason = window.prompt('Why is this encounter entered in error? (required)');
    if (!reason) return;
    try { await clinicalEncounterService.markInError(e.id, reason); toast.success('Marked entered in error'); reload(); }
    catch (err: any) { toast.error(String(err?.message || 'Could not update').replace(/^\[HTTP \d+\]\s*/, '')); }
  };

  return (
    <div className="bg-white rounded-xl border-2 border-green-200 overflow-hidden">
      <div className="bg-gradient-to-r from-green-50 to-emerald-50 px-4 py-3 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h3 className="font-bold text-gray-900">🩺 Initial Patient Encounter <span className="text-xs font-normal text-gray-500">· structured clerking</span></h3>
          <p className="text-xs text-gray-600">Detailed review by the house officer / junior registrar, with rule-based and AI-assisted differentials for your approval.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          {myDraft ? (
            <button type="button" onClick={() => openExisting(myDraft)} className="px-3 py-2 text-sm rounded-lg bg-green-600 text-white">Continue draft ({myDraft.encounter_type === 'initial' ? 'initial' : 'follow-up'})</button>
          ) : (
            <button type="button" onClick={() => setForm({ type: 'initial' })} className="px-3 py-2 text-sm rounded-lg bg-green-600 text-white">
              {localInitial ? 'Continue clerking (saved on this device)' : initial ? 'New initial clerking' : 'Start initial clerking'}
            </button>
          )}
          <button type="button" disabled={!initial && problems.length === 0} onClick={() => setForm({ type: 'follow_up' })}
            title={!initial ? 'Complete an initial clerking first' : undefined}
            className="px-3 py-2 text-sm rounded-lg border border-green-600 text-green-700 disabled:opacity-40">Follow-up encounter</button>
        </div>
      </div>

      <div className="p-4 space-y-4">
        {error && <p className="text-xs text-amber-700">{error}</p>}
        {!state && !error && <p className="text-xs text-gray-500">Loading…</p>}

        {canSign && pending.length > 0 && (
          <div className="rounded-lg border border-amber-300 bg-amber-50 p-3">
            <p className="text-sm font-semibold text-amber-900 mb-2">Awaiting your review</p>
            {pending.map(e => (
              <div key={e.id} className="flex flex-wrap items-center justify-between gap-2 text-sm py-1">
                <span>{e.encounter_type === 'initial' ? 'Initial clerking' : 'Follow-up'} by {e.created_by_name || 'unknown'} · {fmt(e.submitted_at || e.updated_at)}</span>
                <button type="button" onClick={() => openExisting(e)} className="px-3 py-1 text-xs rounded bg-amber-600 text-white">Review & sign</button>
              </div>
            ))}
          </div>
        )}

        {state && (problems.length > 0 || planItems.length > 0) && (
          <div className="grid md:grid-cols-2 gap-4">
            <TrackedList title="Problem list" items={problems} statuses={['active', 'improving', 'worsening', 'resolved', 'ruled_out']}
              text={p => (p as TrackedProblem).label} danger={p => (p as TrackedProblem).dangerous} onStatus={(id, s) => changeStatus('problem', id, s)} />
            <TrackedList title="Plan (investigations & treatment)" items={planItems} statuses={['pending', 'in_progress', 'done', 'not_done', 'stopped']}
              text={p => `${(p as TrackedPlanItem).kind === 'investigation' ? '🔬' : '💊'} ${(p as TrackedPlanItem).text}`} onStatus={(id, s) => changeStatus('plan', id, s)} />
          </div>
        )}

        {state && encounters.length > 0 && (
          <div>
            <h4 className="text-sm font-semibold text-gray-700 mb-2">Structured encounters</h4>
            <ul className="divide-y divide-gray-100 border rounded-lg">
              {encounters.map(e => (
                <li key={e.id} className="p-2.5">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="text-sm">
                      <span className="font-medium">{e.encounter_type === 'initial' ? 'Initial clerking' : 'Follow-up'}</span>{' '}
                      <Badge s={e.status} />
                      <span className="block text-[11px] text-gray-500">
                        {fmt(e.created_at)} · {e.created_by_name || 'unknown'}{e.signed_by_name ? ` · signed by ${e.signed_by_name} ${fmt(e.signed_at)}` : ''}
                      </span>
                      {e.summary?.complaints?.length > 0 && <span className="block text-xs text-gray-600">{e.summary.complaints.map((c: any) => c.label).join(' · ')}</span>}
                    </div>
                    <div className="flex gap-1">
                      <button type="button" onClick={() => setViewing(viewing === e.id ? null : e.id)} className="px-2 py-1 text-xs rounded border">{viewing === e.id ? 'Hide' : 'View note'}</button>
                      {['draft', 'pending_review'].includes(e.status) && (String(e.created_by) === String(user?.id) || canSign) && (
                        <button type="button" onClick={() => openExisting(e)} className="px-2 py-1 text-xs rounded border border-green-600 text-green-700">Open</button>
                      )}
                      {e.status !== 'entered_in_error' && (
                        <button type="button" onClick={() => markError(e)} className="px-2 py-1 text-xs rounded border text-red-600">Entered in error</button>
                      )}
                    </div>
                  </div>
                  {viewing === e.id && (
                    <pre className="mt-2 whitespace-pre-wrap text-xs bg-gray-50 border rounded p-3 max-h-96 overflow-auto font-sans">{e.narrative || 'No note generated.'}{e.error_reason ? `\n\nENTERED IN ERROR: ${e.error_reason}` : ''}</pre>
                  )}
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>

      {form?.type === 'initial' && (
        <InitialEncounterForm patientId={patientId} patientLabel={patientLabel} ctx={ctx} userName={userName} canSign={canSign}
          existing={form.existing} onClose={() => setForm(null)} onSaved={reload} />
      )}
      {form?.type === 'follow_up' && (
        <FollowUpEncounterForm patientId={patientId} patientLabel={patientLabel} ctx={ctx} userName={userName} canSign={canSign}
          problems={problems} planItems={planItems} initial={initial} existing={form.existing} onClose={() => setForm(null)} onSaved={reload} />
      )}
    </div>
  );
};

const TrackedList: React.FC<{
  title: string;
  items: Array<TrackedProblem | TrackedPlanItem>;
  statuses: string[];
  text: (i: TrackedProblem | TrackedPlanItem) => string;
  danger?: (i: TrackedProblem | TrackedPlanItem) => boolean;
  onStatus: (id: number, status: string) => void;
}> = ({ title, items, statuses, text, danger, onStatus }) => (
  <div className="rounded-lg border border-gray-200">
    <h4 className="text-sm font-semibold text-gray-700 px-3 py-2 border-b bg-gray-50">{title} <span className="font-normal text-gray-500">· {items.length}</span></h4>
    <ul className="divide-y divide-gray-100 max-h-72 overflow-auto">
      {items.length === 0 && <li className="px-3 py-2 text-xs text-gray-500">None</li>}
      {items.map(i => (
        <li key={i.id} className="px-3 py-2 flex items-start justify-between gap-2">
          <div className="min-w-0">
            <p className="text-sm text-gray-900">{danger?.(i) && <span title="Can't-miss diagnosis" className="text-red-600">⚠ </span>}{text(i)}</p>
            {i.last_review?.note && <p className="text-[11px] text-gray-500">Last: {i.last_review.note}</p>}
          </div>
          <select aria-label="Status" value={i.status} onChange={e => onStatus(i.id, e.target.value)}
            className={`text-[11px] rounded-full px-2 py-0.5 border-0 capitalize ${STATUS_STYLE[i.status] || 'bg-gray-100'}`}>
            {statuses.map(s => <option key={s} value={s}>{label(s)}</option>)}
          </select>
        </li>
      ))}
    </ul>
  </div>
);

/** Summary tab: outcomes of the structured encounters. */
export const ClinicalOutcomesSummary: React.FC<{ patientId: string }> = ({ patientId }) => {
  const { state, error } = useEncounters(patientId);
  if (error || !state) return error ? <p className="text-xs text-amber-700">{error}</p> : null;
  const live = state.encounters.filter(e => e.status !== 'entered_in_error');
  if (!live.length) return null;

  const initial = live.filter(e => e.encounter_type === 'initial').slice(-1)[0] || live[live.length - 1];
  const latest = live[0];
  const followUps = live.filter(e => e.encounter_type === 'follow_up');
  const problems = state.problems;
  const plan = state.plan_items;
  const count = (arr: Array<{ status: string }>, ...s: string[]) => arr.filter(x => s.includes(x.status)).length;
  const planDone = count(plan, 'done');
  const planPct = plan.length ? Math.round((planDone / plan.length) * 100) : 0;
  const latestFlags: string[] = latest.summary?.red_flags || [];

  return (
    <div className="bg-white rounded-xl border-2 border-green-200 p-4 space-y-4 mb-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="font-bold text-gray-900">🩺 Clinical encounters — outcomes</h3>
        <span className="text-xs text-gray-500">{live.length} encounter(s) · first {fmt(initial.created_at)} · last {fmt(latest.created_at)}</span>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 text-center">
        {[
          ['Active', count(problems, 'active'), 'text-blue-700'],
          ['Improving', count(problems, 'improving'), 'text-green-700'],
          ['Worsening', count(problems, 'worsening'), 'text-red-700'],
          ['Resolved', count(problems, 'resolved', 'ruled_out'), 'text-emerald-700'],
          ['Plan done', `${planDone}/${plan.length}`, 'text-gray-800'],
        ].map(([l, v, c]) => (
          <div key={String(l)} className="rounded-lg bg-gray-50 p-2">
            <div className={`text-xl font-bold ${c}`}>{v}</div>
            <div className="text-[11px] text-gray-500">{l}</div>
          </div>
        ))}
      </div>
      {plan.length > 0 && (
        <div className="h-2 rounded-full bg-gray-100 overflow-hidden" aria-label={`Plan ${planPct}% complete`}>
          <div className="h-full bg-green-500" style={{ width: `${planPct}%` }} />
        </div>
      )}

      {initial.summary?.complaints?.length > 0 && (
        <p className="text-sm"><strong>Presenting complaints:</strong> {initial.summary.complaints.map((c: any) => `${c.label}${c.duration?.value ? ` (${c.duration.value} ${c.duration.unit})` : ''}`).join(' · ')}</p>
      )}
      {initial.summary?.risk_factors?.length > 0 && (
        <p className="text-xs text-amber-900 bg-amber-50 rounded p-2"><strong>Risk factors:</strong> {initial.summary.risk_factors.join(' · ')}</p>
      )}
      {latestFlags.length > 0 && (
        <p className="text-xs text-red-800 bg-red-50 rounded p-2"><strong>⚠ Red flags at last encounter:</strong> {latestFlags.join(' · ')}</p>
      )}

      {problems.length > 0 && (
        <div>
          <h4 className="text-sm font-semibold text-gray-700 mb-1">Problem outcomes</h4>
          <table className="w-full text-xs">
            <thead><tr className="text-left text-gray-500"><th className="py-1">Problem</th><th>Since</th><th>Status</th><th className="hidden sm:table-cell">Latest review</th></tr></thead>
            <tbody>
              {problems.map(p => (
                <tr key={p.id} className="border-t">
                  <td className="py-1.5 pr-2">{p.dangerous && <span className="text-red-600">⚠ </span>}{p.label}</td>
                  <td className="pr-2 whitespace-nowrap">{new Date(p.created_at).toLocaleDateString()}</td>
                  <td className="pr-2"><Badge s={p.status} /></td>
                  <td className="hidden sm:table-cell text-gray-600">{p.last_review?.note || (p.last_review?.status ? label(p.last_review.status) : '—')}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {plan.filter(p => !['done', 'stopped'].includes(p.status)).length > 0 && (
        <div>
          <h4 className="text-sm font-semibold text-gray-700 mb-1">Outstanding plan items</h4>
          <ul className="text-xs space-y-0.5">
            {plan.filter(p => !['done', 'stopped'].includes(p.status)).map(p => (
              <li key={p.id} className="flex items-center gap-2"><Badge s={p.status} /> {p.kind === 'investigation' ? '🔬' : '💊'} {p.text}{p.priority === 'urgent' && <span className="text-orange-600">(urgent)</span>}</li>
            ))}
          </ul>
        </div>
      )}

      {followUps.length > 0 && (
        <div>
          <h4 className="text-sm font-semibold text-gray-700 mb-1">Follow-up trajectory</h4>
          <ol className="text-xs space-y-1">
            {[...followUps].reverse().map(f => (
              <li key={f.id} className="border-l-2 border-green-300 pl-2">
                <span className="text-gray-500">{fmt(f.created_at)} · {f.created_by_name}</span>
                <span className="block">{(f.summary?.problems || []).filter((p: any) => p.status !== 'not_reviewed').map((p: any) => `${p.label}: ${label(p.status)}`).join(' · ') || 'No problem updates'}</span>
                {f.summary?.new_complaints?.length > 0 && <span className="block text-amber-700">New: {f.summary.new_complaints.join(', ')}</span>}
              </li>
            ))}
          </ol>
        </div>
      )}
    </div>
  );
};

export default StructuredEncountersPanel;
