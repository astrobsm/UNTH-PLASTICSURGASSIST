/**
 * Initial Patient Encounter — structured clerking by the house officer /
 * junior registrar.
 *
 *   1 Complaints   searchable presenting complaints, duration, and the
 *                  complaint-specific history questions
 *   2 History      PMH / comorbidities, PSH, drugs, allergies, gynae, family,
 *                  social, review of systems
 *   3 Examination  vitals, general, systemic and focused examination
 *   4 Assessment   red flags, risk factors, gaps, rule-based + AI suggestions
 *                  for the clinician to accept / edit / reject, narrative
 *
 * Autosaves on this device continuously; "Save draft" stores it on the server.
 * Submitting sends a house officer's clerking for review; a registrar or
 * consultant (D6) signs. Accepted items become the tracked problem list/plan.
 */
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import toast from 'react-hot-toast';
import type { ClerkingData, Suggestion } from '../../../clinical/clerking/types';
import { COMPLAINT_BY_ID } from '../../../clinical/clerking/complaints';
import {
  aiPayload, completeness, emptyClerking, examSectionsFor, generateNarrative, mergeSuggestions, redFlags, riskFactors, ruleSuggestions, showGynaecology,
  type PatientContext,
} from '../../../clinical/clerking/engine';
import { clinicalEncounterService, localDraft, type ClinicalEncounter } from '../../../services/clinicalEncounterService';
import { ComplaintsEditor, ExamEditor, VitalsEditor } from './sections';
import { HistoryEditor } from './HistoryEditor';
import { SuggestionReview } from './SuggestionReview';
import { Section } from './fields';

const STEPS = ['Complaints & HPC', 'History', 'Examination', 'Assessment & plan'];

interface Props {
  patientId: string;
  patientLabel: string;
  ctx: PatientContext;
  userName: string;
  canSign: boolean;
  existing?: ClinicalEncounter | null;
  onClose: () => void;
  onSaved: () => void;
}

/** Combine regenerated rule suggestions with AI / manual ones and earlier decisions. */
function refreshRules(previous: Suggestion[], data: ClerkingData, ctx: PatientContext): Suggestion[] {
  const isRule = (s: Suggestion) => s.source === 'rules' && !s.id.startsWith('manual:');
  return [...mergeSuggestions(previous.filter(isRule), ruleSuggestions(data, ctx)), ...previous.filter(s => !isRule(s))];
}

export const InitialEncounterForm: React.FC<Props> = ({ patientId, patientLabel, ctx, userName, canSign, existing, onClose, onSaved }) => {
  const draftType = existing ? `initial-${existing.id}` : 'initial';
  const restored = useMemo(() => localDraft.load<{ data: ClerkingData; suggestions: Suggestion[]; savedAt: string; version?: number }>(patientId, draftType), [patientId, draftType]);
  const useRestored = !!restored && (!existing || (restored.version ?? 0) >= existing.version);

  const [data, setData] = useState<ClerkingData>(() => (useRestored ? restored!.data : existing?.data?.version ? existing.data : emptyClerking()));
  const [suggestions, setSuggestions] = useState<Suggestion[]>(() => (useRestored ? restored!.suggestions : existing?.suggestions || []));
  const [encounter, setEncounter] = useState<ClinicalEncounter | null>(existing || null);
  const [step, setStep] = useState(0);
  const [gynOverride, setGynOverride] = useState(false);
  const [saving, setSaving] = useState(false);
  const [ai, setAi] = useState<{ state: 'idle' | 'loading' | 'done' | 'error'; message?: string; missing?: string[] }>({ state: 'idle' });
  const [showNarrative, setShowNarrative] = useState(false);
  const aiTried = useRef(false);
  const topRef = useRef<HTMLDivElement>(null);

  const gyn = showGynaecology(ctx) || gynOverride;
  const effCtx: PatientContext = gynOverride ? { ...ctx, ageYears: ctx.ageYears != null ? Math.min(Math.max(ctx.ageYears, 10), 55) : null, sex: ctx.sex || 'Female' } : ctx;

  // Continuous autosave on this device.
  useEffect(() => {
    const key = encounter ? `initial-${encounter.id}` : 'initial';
    const t = setTimeout(() => localDraft.save(patientId, key, { data, suggestions, version: encounter?.version ?? 0 }), 600);
    return () => clearTimeout(t);
  }, [data, suggestions, patientId, encounter?.id, encounter?.version]);

  useEffect(() => { topRef.current?.scrollIntoView?.({ behavior: 'smooth', block: 'start' }); }, [step]);

  // Rule suggestions follow the data as it is entered.
  useEffect(() => {
    if (step === 3) setSuggestions(prev => refreshRules(prev, data, effCtx));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step, data]);

  const runAi = useCallback(async () => {
    if (!data.complaints.length) { toast.error('Add a presenting complaint first'); return; }
    if (!navigator.onLine) { setAi({ state: 'error', message: 'Offline — rule-based suggestions are shown. Try AI when back online.' }); return; }
    setAi({ state: 'loading' });
    try {
      const r = await clinicalEncounterService.aiSuggest(patientId, aiPayload(data, effCtx));
      setSuggestions(prev => {
        const prevAi = new Map(prev.filter(s => s.source === 'ai').map(s => [s.id, s]));
        const fresh = r.suggestions.map(s => { const p = prevAi.get(s.id); return p && p.decision !== 'pending' ? { ...s, decision: p.decision, edited: p.edited } : s; });
        const freshIds = new Set(fresh.map(s => s.id));
        const keptAi = prev.filter(s => s.source === 'ai' && !freshIds.has(s.id) && s.decision !== 'pending');
        return [...prev.filter(s => s.source !== 'ai'), ...keptAi, ...fresh];
      });
      setAi({ state: 'done', missing: r.missing });
    } catch (e: any) {
      setAi({ state: 'error', message: String(e?.message || 'AI unavailable').replace(/^\[HTTP \d+\]\s*/, '') });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data, patientId]);

  useEffect(() => {
    if (step === 3 && !aiTried.current && data.complaints.length && navigator.onLine) { aiTried.current = true; runAi(); }
  }, [step, data.complaints.length, runAi]);

  const flags = useMemo(() => redFlags(data, effCtx), [data, gynOverride]); // eslint-disable-line react-hooks/exhaustive-deps
  const risks = useMemo(() => riskFactors(data), [data]);
  const gaps = useMemo(() => completeness(data, effCtx), [data, gynOverride]); // eslint-disable-line react-hooks/exhaustive-deps
  const narrative = useMemo(() => generateNarrative({ patientLabel, ctx: effCtx, data, suggestions, author: userName }), [data, suggestions, patientLabel, userName, gynOverride]); // eslint-disable-line react-hooks/exhaustive-deps
  const focusedExams = useMemo(() => [...new Set(data.complaints.flatMap(c => COMPLAINT_BY_ID[c.complaintId]?.exams || []))], [data.complaints]);
  const readOnly = encounter?.status === 'signed' || encounter?.status === 'entered_in_error';

  const summary = () => ({
    complaints: data.complaints.map(c => ({ label: c.label, duration: c.duration })),
    red_flags: flags.map(f => f.text),
    risk_factors: risks,
    accepted: {
      differential: suggestions.filter(s => s.kind === 'differential' && s.decision === 'accepted').map(s => s.edited || s.text),
      investigation: suggestions.filter(s => s.kind === 'investigation' && s.decision === 'accepted').map(s => s.edited || s.text),
      treatment: suggestions.filter(s => s.kind === 'treatment' && s.decision === 'accepted').map(s => s.edited || s.text),
    },
    impression: data.impression || null,
    gaps: gaps.filter(g => g.essential).map(g => `${g.section}: ${g.missing}`),
  });

  const save = async (): Promise<ClinicalEncounter | null> => {
    if (!data.complaints.length) { toast.error('Add at least one presenting complaint before saving'); setStep(0); return null; }
    setSaving(true);
    try {
      const saved = await clinicalEncounterService.save({
        id: encounter?.id, version: encounter?.version, patient_id: patientId, encounter_type: 'initial',
        data, suggestions, summary: summary(), narrative,
      });
      setEncounter(saved);
      // From now on the device copy lives under this encounter's own key.
      localDraft.clear(patientId, 'initial');
      localDraft.save(patientId, `initial-${saved.id}`, { data, suggestions, version: saved.version });
      return saved;
    } catch (e: any) {
      const msg = String(e?.message || '').replace(/^\[HTTP \d+\]\s*/, '');
      toast.error(navigator.onLine ? (msg || 'Could not save') : 'Offline — your clerking is kept on this device. Save again when online.');
      return null;
    } finally {
      setSaving(false);
    }
  };

  const submit = async () => {
    const essentials = gaps.filter(g => g.essential);
    if (essentials.length && !window.confirm(`These essentials are not documented:\n\n${essentials.map(g => `• ${g.section}: ${g.missing}`).join('\n')}\n\nThey will be recorded as “not documented”. Submit anyway?`)) return;
    const pending = suggestions.filter(s => s.decision === 'pending').length;
    const acceptedDx = suggestions.filter(s => s.kind === 'differential' && s.decision === 'accepted').length;
    if (!acceptedDx && !window.confirm('No diagnosis has been accepted, so nothing will be tracked as a problem. Submit anyway?')) return;
    if (pending && !window.confirm(`${pending} suggestion(s) are still undecided and will not be tracked. Continue?`)) return;
    const saved = await save();
    if (!saved) return;
    setSaving(true);
    try {
      const r = await clinicalEncounterService.submit(saved.id, saved.version, canSign);
      localDraft.clear(patientId, `initial-${saved.id}`);
      localDraft.clear(patientId, 'initial');
      toast.success(r.encounter.status === 'signed' ? 'Clerking signed — problems and plan are now tracked' : 'Submitted for registrar / consultant review');
      onSaved();
      onClose();
    } catch (e: any) {
      toast.error(String(e?.message || 'Could not submit').replace(/^\[HTTP \d+\]\s*/, ''));
    } finally {
      setSaving(false);
    }
  };

  const essentialsMissing = gaps.filter(g => g.essential).length;

  return (
    <div className="fixed inset-0 z-50 bg-black/40 flex items-stretch sm:items-center justify-center sm:p-4" role="dialog" aria-modal="true" aria-label="Initial patient encounter">
      <div className="bg-gray-50 w-full sm:max-w-5xl sm:rounded-2xl shadow-xl flex flex-col max-h-screen sm:max-h-[95vh]">
        <div className="bg-white border-b px-4 py-3 sm:rounded-t-2xl">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <h2 className="text-lg font-bold text-gray-900">Initial Patient Encounter</h2>
              <p className="text-xs text-gray-500 truncate">{patientLabel} · {ctx.ageYears ?? '?'} y · {ctx.sex || 'sex not recorded'}
                {encounter && <> · <span className="font-medium">{encounter.status.replace('_', ' ')}</span></>}</p>
            </div>
            <button type="button" onClick={onClose} className="px-3 py-1.5 text-sm rounded-lg border">Close</button>
          </div>
          {useRestored && restored?.savedAt && (
            <p className="mt-2 text-[11px] text-blue-700 bg-blue-50 rounded px-2 py-1">
              Restored your unsaved work from {new Date(restored.savedAt).toLocaleString()}.{' '}
              <button type="button" className="underline" onClick={() => { if (window.confirm('Discard the unsaved work on this device?')) { localDraft.clear(patientId, draftType); setData(existing?.data?.version ? existing.data : emptyClerking()); setSuggestions(existing?.suggestions || []); } }}>Discard</button>
            </p>
          )}
          <nav className="mt-3 flex gap-1 overflow-x-auto" aria-label="Clerking steps">
            {STEPS.map((s, i) => (
              <button key={s} type="button" onClick={() => setStep(i)}
                className={`px-3 py-1.5 rounded-full text-xs whitespace-nowrap border ${i === step ? 'bg-green-600 text-white border-green-600' : 'bg-white text-gray-700 border-gray-300'}`}>
                {i + 1}. {s}{i === 3 && flags.length ? ` ⚠${flags.length}` : ''}
              </button>
            ))}
          </nav>
        </div>

        <div className="flex-1 overflow-y-auto px-3 sm:px-5 py-4 space-y-4">
          <div ref={topRef} />
          {readOnly && <p className="text-sm bg-gray-100 rounded-lg p-2">This encounter is {encounter?.status.replace(/_/g, ' ')} and can no longer be edited. Record changes in a follow-up encounter.</p>}
          <fieldset disabled={readOnly} className="space-y-4 min-w-0">
            {step === 0 && (
              <Section title="Presenting complaints" subtitle="A patient may have several — add each one, with its duration">
                <ComplaintsEditor complaints={data.complaints} onChange={complaints => setData(d => ({ ...d, complaints }))} />
              </Section>
            )}
            {step === 1 && <HistoryEditor data={data} onChange={setData} showGyn={gyn} onToggleGyn={(ctx.sex || '').toLowerCase().startsWith('f') || !ctx.sex ? () => setGynOverride(true) : undefined} />}
            {step === 2 && (
              <>
                <Section title="Vital signs">
                  <VitalsEditor vitals={data.vitals} onChange={vitals => setData(d => ({ ...d, vitals }))} />
                </Section>
                <ExamEditor sectionIds={examSectionsFor(data)} focusedIds={focusedExams} exam={data.exam} onChange={exam => setData(d => ({ ...d, exam }))} />
              </>
            )}
            {step === 3 && (
              <>
                {flags.length > 0 && (
                  <div className="rounded-xl border border-red-300 bg-red-50 p-3">
                    <h4 className="text-sm font-semibold text-red-800 mb-1">⚠ Red flags — discuss with the senior on call</h4>
                    <ul className="text-sm text-red-800 list-disc pl-5">{flags.map((f, i) => <li key={i}>{f.text} <span className="text-red-500 text-xs">({f.where})</span></li>)}</ul>
                  </div>
                )}
                <div className="grid md:grid-cols-2 gap-3">
                  <div className="rounded-xl border border-amber-200 bg-amber-50 p-3">
                    <h4 className="text-sm font-semibold text-amber-900 mb-1">Risk factors and comorbidities</h4>
                    {risks.length ? <ul className="text-xs text-amber-900 list-disc pl-4 space-y-0.5">{risks.map((r, i) => <li key={i}>{r}</li>)}</ul> : <p className="text-xs text-amber-800">None identified from what is documented.</p>}
                  </div>
                  <div className="rounded-xl border border-gray-200 bg-white p-3">
                    <h4 className="text-sm font-semibold text-gray-800 mb-1">Still to document {essentialsMissing ? <span className="text-red-600">({essentialsMissing} essential)</span> : '✓'}</h4>
                    {gaps.length ? (
                      <ul className="text-xs space-y-0.5 max-h-40 overflow-auto">
                        {gaps.map((g, i) => <li key={i} className={g.essential ? 'text-red-700' : 'text-gray-500'}>{g.essential ? '•' : '◦'} {g.section}: {g.missing}</li>)}
                      </ul>
                    ) : <p className="text-xs text-green-700">Complete.</p>}
                  </div>
                </div>

                <Section title="Clinical impression" subtitle="Your own summary and working diagnosis">
                  <textarea rows={3} className="w-full rounded-lg border border-gray-300 px-2.5 py-2 text-sm" value={data.impression || ''}
                    placeholder="e.g. 52-year-old man with a 12-year non-healing ulcer on an old burn scar with everted edges — Marjolin's ulcer until proven otherwise."
                    onChange={e => setData(d => ({ ...d, impression: e.target.value || undefined }))} />
                </Section>

                <Section title="Suggested diagnoses, investigations and treatment" subtitle="Clinical-rule and AI suggestions — accept, edit or reject each one. Nothing is ordered automatically.">
                  <div className="flex flex-wrap items-center gap-2 text-xs">
                    <button type="button" onClick={runAi} disabled={ai.state === 'loading' || readOnly}
                      className="px-3 py-1.5 rounded-lg bg-purple-600 text-white disabled:opacity-50">
                      {ai.state === 'loading' ? 'Asking AI…' : ai.state === 'done' ? '↻ Refresh AI suggestions' : '✨ Get AI suggestions'}
                    </button>
                    <span className="text-gray-500">The AI receives the clerking without name or hospital number.</span>
                    {ai.state === 'error' && <span className="text-amber-700">{ai.message}</span>}
                  </div>
                  {ai.missing && ai.missing.length > 0 && (
                    <div className="rounded-lg bg-purple-50 border border-purple-200 p-2 text-xs text-purple-900">
                      <strong>To narrow the diagnosis, consider documenting:</strong>
                      <ul className="list-disc pl-4 mt-1">{ai.missing.map((m, i) => <li key={i}>{m}</li>)}</ul>
                    </div>
                  )}
                  <SuggestionReview suggestions={suggestions} onChange={setSuggestions} readOnly={readOnly} />
                </Section>

                <Section title="Clerking note (generated)" defaultOpen={showNarrative}>
                  <div className="flex justify-end gap-2">
                    <button type="button" className="text-xs underline" onClick={() => { navigator.clipboard?.writeText(narrative); toast.success('Copied'); }}>Copy</button>
                    <button type="button" className="text-xs underline" onClick={() => setShowNarrative(s => !s)}>{showNarrative ? 'Hide' : 'Show'}</button>
                  </div>
                  <pre className="whitespace-pre-wrap text-xs text-gray-800 bg-white border rounded-lg p-3 max-h-96 overflow-auto font-sans">{narrative}</pre>
                </Section>
              </>
            )}
          </fieldset>
        </div>

        <div className="bg-white border-t px-4 py-3 flex flex-wrap items-center justify-between gap-2 sm:rounded-b-2xl">
          <div className="flex gap-2">
            <button type="button" disabled={step === 0} onClick={() => setStep(s => s - 1)} className="px-3 py-2 text-sm rounded-lg border disabled:opacity-40">← Back</button>
            {step < 3 && <button type="button" onClick={() => setStep(s => s + 1)} className="px-3 py-2 text-sm rounded-lg border border-green-600 text-green-700">Next →</button>}
          </div>
          {!readOnly && (
            <div className="flex gap-2">
              <button type="button" disabled={saving} onClick={async () => { if (await save()) toast.success('Draft saved'); }} className="px-3 py-2 text-sm rounded-lg border">
                {saving ? 'Saving…' : 'Save draft'}
              </button>
              <button type="button" disabled={saving || step < 3} onClick={submit} title={step < 3 ? 'Review the assessment step first' : undefined}
                className="px-4 py-2 text-sm rounded-lg bg-green-600 text-white disabled:opacity-50">
                {canSign ? (encounter?.status === 'pending_review' ? 'Review & sign' : 'Sign clerking') : 'Submit for review'}
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default InitialEncounterForm;
