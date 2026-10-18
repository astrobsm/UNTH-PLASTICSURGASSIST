/**
 * The scribe's comprehensive treatment plan — drafted from the record,
 * submitted by the team, approved (or returned) by a consultant.
 *
 * Every line can be left out before submitting or approving; the consultant
 * can add their own instructions; nothing becomes an active plan until a
 * consultant approves it.
 */
import { useCallback, useEffect, useMemo, useState } from 'react';
import { CheckCircle2, ClipboardCheck, Loader2, Send, XCircle, AlertTriangle, FileText } from 'lucide-react';
import toast from 'react-hot-toast';
import type { ScribePlan, PlanLine, ScribeFinding } from '../../services/scribe/scribePlan';
import { scribePlanService, type StoredScribePlan } from '../../services/scribe/scribePlanService';
import type { LoggedAction } from '../../services/scribe/planItems';
import { ImplementationTracker } from './ImplementationTracker';

type Excluded = Set<string>;

/** The plan without the lines that were unticked, plus any additions. */
export function filterPlan(plan: ScribePlan, excluded: Excluded, additions = ''): ScribePlan {
  const keep = (key: string, xs: PlanLine[]) => xs.filter((_, i) => !excluded.has(`${key}|${i}`));
  const extra = additions.split('\n').map(s => s.trim()).filter(Boolean).map(text => ({ text, why: 'Consultant instruction' }));
  return {
    ...plan,
    problems: plan.problems.map((p, pi) => ({
      ...p,
      goals: keep(`p${pi}.goals`, p.goals),
      investigations: keep(`p${pi}.investigations`, p.investigations),
      treatment: keep(`p${pi}.treatment`, p.treatment),
      monitoring: keep(`p${pi}.monitoring`, p.monitoring),
      referrals: keep(`p${pi}.referrals`, p.referrals),
    })),
    comorbidities: plan.comorbidities.map((c, ci) => ({ ...c, actions: keep(`c${ci}`, c.actions) })).filter(c => c.actions.length),
    general: [
      ...plan.general.map((g, gi) => ({ ...g, items: keep(`g${gi}`, g.items) })).filter(g => g.items.length),
      ...(extra.length ? [{ heading: 'Consultant instructions', items: extra }] : []),
    ],
    carriedOver: keep('carried', plan.carriedOver),
  };
}

function Lines({ k, items, excluded, toggle, editable }: {
  k: string; items: PlanLine[]; excluded: Excluded; toggle: (key: string) => void; editable: boolean;
}) {
  if (!items.length) return null;
  return (
    <ul className="space-y-1">
      {items.map((it, i) => {
        const key = `${k}|${i}`;
        const off = excluded.has(key);
        return (
          <li key={key} className={`flex items-start gap-2 text-sm ${off ? 'opacity-40 line-through' : ''}`}>
            {editable && <input type="checkbox" checked={!off} onChange={() => toggle(key)} className="mt-1 rounded" aria-label="Include this item" />}
            <span>
              {it.priority === 'urgent' && <span className="mr-1 text-[10px] font-bold text-red-700 bg-red-50 border border-red-200 rounded px-1">URGENT</span>}
              {it.text}
              {it.why && <span className="block text-[11px] text-gray-500">{it.why}</span>}
            </span>
          </li>
        );
      })}
    </ul>
  );
}

function PlanView({ plan, excluded, toggle, editable }: { plan: ScribePlan; excluded: Excluded; toggle: (k: string) => void; editable: boolean }) {
  return (
    <div className="space-y-4">
      {plan.problems.map((p, pi) => (
        <div key={pi} className="border rounded-lg p-3">
          <p className="font-semibold text-gray-900">{pi + 1}. {p.problem}{p.code ? ` (${p.code})` : ''} <span className="text-xs font-normal text-gray-500">· {p.source}</span></p>
          {([['Goals', 'goals'], ['Investigations', 'investigations'], ['Treatment', 'treatment'], ['Monitoring', 'monitoring'], ['Referrals', 'referrals']] as const).map(([title, key]) =>
            p[key].length ? (
              <div key={key} className="mt-2">
                <p className="text-xs font-semibold uppercase tracking-wide text-gray-500 mb-1">{title}</p>
                <Lines k={`p${pi}.${key}`} items={p[key]} excluded={excluded} toggle={toggle} editable={editable} />
              </div>
            ) : null)}
        </div>
      ))}
      {plan.comorbidities.length > 0 && (
        <div className="border rounded-lg p-3">
          <p className="font-semibold text-gray-900 mb-2">Comorbidities affecting management</p>
          {plan.comorbidities.map((c, ci) => (
            <div key={ci} className="mb-2">
              <p className="text-sm font-medium text-gray-800">{c.condition}</p>
              <Lines k={`c${ci}`} items={c.actions} excluded={excluded} toggle={toggle} editable={editable} />
            </div>
          ))}
        </div>
      )}
      <div className="border rounded-lg p-3 grid gap-3 md:grid-cols-2">
        {plan.general.map((g, gi) => (
          <div key={gi}>
            <p className="text-xs font-semibold uppercase tracking-wide text-gray-500 mb-1">{g.heading}</p>
            <Lines k={`g${gi}`} items={g.items} excluded={excluded} toggle={toggle} editable={editable} />
          </div>
        ))}
      </div>
      {plan.carriedOver.length > 0 && (
        <div className="border rounded-lg p-3">
          <p className="text-xs font-semibold uppercase tracking-wide text-gray-500 mb-1">Outstanding from the clerking plan</p>
          <Lines k="carried" items={plan.carriedOver} excluded={excluded} toggle={toggle} editable={editable} />
        </div>
      )}
      <div className="grid gap-3 md:grid-cols-2 text-sm">
        <div className="border rounded-lg p-3">
          <p className="text-xs font-semibold uppercase tracking-wide text-gray-500 mb-1">Discharge criteria</p>
          <ul className="list-disc pl-5 space-y-0.5">{plan.dischargeCriteria.map((d, i) => <li key={i}>{d}</li>)}</ul>
        </div>
        <div className="border rounded-lg p-3">
          <p className="text-xs font-semibold uppercase tracking-wide text-gray-500 mb-1">Follow-up</p>
          <ul className="list-disc pl-5 space-y-0.5">{plan.followUp.map((d, i) => <li key={i}>{d}</li>)}</ul>
        </div>
      </div>
      {plan.cautions.length > 0 && (
        <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 text-sm text-amber-900">
          {plan.cautions.map((c, i) => <p key={i} className="flex gap-1.5"><AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />{c}</p>)}
        </div>
      )}
      {plan.basis?.length > 0 && (
        <details className="text-xs text-gray-600">
          <summary className="cursor-pointer">Built from ({plan.basis.length} facts in the record)</summary>
          <ul className="list-disc pl-5 mt-1 space-y-0.5">{plan.basis.map((b, i) => <li key={i}>{b}</li>)}</ul>
        </details>
      )}
    </div>
  );
}

export function ScribeTreatmentPlanPanel({ patientId, draft, findings, defaultPlace, onChanged }: {
  patientId: string; draft: ScribePlan; findings: ScribeFinding[];
  /** Where the patient is (e.g. "Ward 10, Bed 16"), offered as the place of each log. */
  defaultPlace?: string;
  /** Called after anything is approved or logged, so the summary refreshes. */
  onChanged?: () => void;
}) {
  const [stored, setStored] = useState<StoredScribePlan[] | null>(null);
  const [actions, setActions] = useState<LoggedAction[]>([]);
  const [canLog, setCanLog] = useState(true);
  const [showDraft, setShowDraft] = useState(false);
  const [canApprove, setCanApprove] = useState(false);
  const [excluded, setExcluded] = useState<Excluded>(new Set());
  const [additions, setAdditions] = useState('');
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    try {
      const r = await scribePlanService.forPatient(patientId);
      setStored(r.plans);
      setActions(r.actions);
      setCanLog(r.can_log);
      setCanApprove(r.can_approve);
      setError('');
    } catch (e: any) {
      setStored([]);
      setError(navigator.onLine ? (e?.message || 'Could not load the plan history.') : 'Offline — the plan can be submitted when the connection returns.');
    }
  }, [patientId]);
  useEffect(() => { void load(); }, [load]);
  useEffect(() => {
    const t = setInterval(() => { if (document.visibilityState === 'visible') void load(); }, 30_000);
    return () => clearInterval(t);
  }, [load]);
  const changed = async () => { await load(); onChanged?.(); };

  const pending = stored?.find(p => p.status === 'pending_approval') || null;
  const approved = stored?.find(p => p.status === 'approved') || null;
  const lastRejected = stored?.find(p => p.status === 'rejected') || null;

  // What is shown: the plan awaiting approval (for the consultant), else the fresh draft.
  const shown: ScribePlan = pending?.plan || draft;
  const toggle = (k: string) => setExcluded(prev => { const n = new Set(prev); n.has(k) ? n.delete(k) : n.add(k); return n; });
  const reset = () => { setExcluded(new Set()); setAdditions(''); setNote(''); };

  const submit = async () => {
    setBusy('submit');
    try {
      await scribePlanService.submit(patientId, filterPlan(draft, excluded, additions), findings);
      toast.success('Plan submitted for consultant approval');
      reset();
      await changed();
    } catch (e: any) { toast.error(e?.message || 'Could not submit the plan'); }
    finally { setBusy(null); }
  };
  const approve = async () => {
    if (!pending) return;
    setBusy('approve');
    try {
      const edited = excluded.size || additions.trim() ? filterPlan(pending.plan, excluded, additions) : undefined;
      await scribePlanService.approve(pending.id, edited, note || undefined);
      toast.success('Plan approved — now the active treatment plan');
      reset();
      await changed();
    } catch (e: any) { toast.error(e?.message || 'Could not approve the plan'); }
    finally { setBusy(null); }
  };
  const reject = async () => {
    if (!pending) return;
    if (!note.trim()) { toast.error('Give the reason for returning the plan'); return; }
    setBusy('reject');
    try {
      await scribePlanService.reject(pending.id, note.trim());
      toast.success('Plan returned to the team');
      reset();
      await changed();
    } catch (e: any) { toast.error(e?.message || 'Could not reject the plan'); }
    finally { setBusy(null); }
  };

  const status = useMemo(() => {
    if (pending) return { tone: 'bg-blue-50 border-blue-200 text-blue-900', text: `Version ${pending.version} awaiting consultant approval — submitted by ${pending.generated_by_name || 'the team'} ${new Date(pending.generated_at).toLocaleString()}` };
    if (approved) return { tone: 'bg-green-50 border-green-200 text-green-900', text: `Version ${approved.version} approved by ${approved.reviewed_by_name || 'consultant'} ${approved.reviewed_at ? new Date(approved.reviewed_at).toLocaleString() : ''}${approved.review_note ? ` — “${approved.review_note}”` : ''}` };
    if (lastRejected) return { tone: 'bg-red-50 border-red-200 text-red-900', text: `Version ${lastRejected.version} returned by ${lastRejected.reviewed_by_name || 'consultant'}: “${lastRejected.review_note}”` };
    return { tone: 'bg-amber-50 border-amber-200 text-amber-900', text: 'Draft — not yet submitted. Nothing here is an order until a consultant approves it.' };
  }, [pending, approved, lastRejected]);

  const editable = pending ? canApprove : true;

  return (
    <div className="bg-white rounded-xl border shadow-sm">
      <div className="px-4 py-3 border-b flex flex-wrap items-center justify-between gap-2">
        <h3 className="font-semibold text-gray-900 flex items-center gap-2">
          <ClipboardCheck className="w-5 h-5 text-green-700" /> Comprehensive treatment plan
          <span className="text-xs font-normal text-gray-500">drafted by the scribe · consultant approval required</span>
        </h3>
      </div>
      <div className="p-4 space-y-4">
        <p className={`text-sm border rounded-lg p-2.5 ${status.tone}`}>{status.text}</p>
        {error && <p className="text-xs text-amber-700">{error}</p>}
        {stored === null ? (
          <p className="flex items-center gap-2 text-sm text-gray-500"><Loader2 className="w-4 h-4 animate-spin" /> Loading…</p>
        ) : approved && !pending && !showDraft ? (
          <>
            <ImplementationTracker
              planId={approved.id} patientId={patientId}
              plan={approved.approved_plan || approved.plan}
              actions={actions.filter(a => (a as any).scribe_plan_id === undefined || (a as any).scribe_plan_id === approved.id)}
              canLog={canLog} defaultPlace={defaultPlace} onChanged={changed}
            />
            <button onClick={() => setShowDraft(true)} className="text-sm text-green-800 underline">
              Draft a revised plan from today's record
            </button>
          </>
        ) : (
          <>
            {approved && !pending && (
              <button onClick={() => setShowDraft(false)} className="text-sm text-green-800 underline">Back to the approved plan</button>
            )}
            {pending && !canApprove && (
              <p className="text-xs text-gray-600 flex items-center gap-1.5"><FileText className="w-4 h-4" /> Showing the version awaiting approval. Submitting again replaces it with today's draft.</p>
            )}
            <PlanView plan={shown} excluded={excluded} toggle={toggle} editable={editable} />

            {editable && (
              <label className="block">
                <span className="block text-xs font-semibold text-gray-600 mb-1">{pending && canApprove ? 'Consultant instructions (one per line)' : 'Additional items (one per line)'}</span>
                <textarea value={additions} onChange={e => setAdditions(e.target.value)} rows={3} className="w-full border rounded-lg p-2 text-sm" placeholder="e.g. Book for gluteal rotation flap once wound clean" />
              </label>
            )}

            {pending && canApprove ? (
              <div className="space-y-2">
                <textarea value={note} onChange={e => setNote(e.target.value)} rows={2} className="w-full border rounded-lg p-2 text-sm" placeholder="Note (required to return the plan)" />
                <div className="flex flex-wrap gap-2">
                  <button onClick={approve} disabled={busy !== null} className="px-4 py-2 bg-green-700 text-white rounded-lg text-sm flex items-center gap-2 disabled:opacity-50">
                    {busy === 'approve' ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />} Approve plan
                  </button>
                  <button onClick={reject} disabled={busy !== null} className="px-4 py-2 border border-red-300 text-red-700 rounded-lg text-sm flex items-center gap-2 disabled:opacity-50">
                    {busy === 'reject' ? <Loader2 className="w-4 h-4 animate-spin" /> : <XCircle className="w-4 h-4" />} Return to team
                  </button>
                </div>
              </div>
            ) : (
              <button onClick={submit} disabled={busy !== null} className="px-4 py-2 bg-green-700 text-white rounded-lg text-sm flex items-center gap-2 disabled:opacity-50">
                {busy === 'submit' ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                {pending ? 'Replace with today’s draft' : 'Submit for consultant approval'}
              </button>
            )}
          </>
        )}
      </div>
    </div>
  );
}
