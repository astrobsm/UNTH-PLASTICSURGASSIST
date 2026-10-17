/**
 * Follow-up encounter: reviews the progress of every problem and plan item
 * from earlier encounters, captures new complaints (with the same dynamic
 * questions as the initial clerking), interval vitals and examination, and
 * suggestions for anything new — all clinician-approved.
 */
import React, { useEffect, useMemo, useState } from 'react';
import toast from 'react-hot-toast';
import type { ClerkingData, Suggestion } from '../../../clinical/clerking/types';
import { COMPLAINT_BY_ID } from '../../../clinical/clerking/complaints';
import {
  aiPayload, emptyFollowUp, generateFollowUpNarrative, mergeSuggestions, redFlags, ruleSuggestions, type FollowUpData, type PatientContext,
} from '../../../clinical/clerking/engine';
import { clinicalEncounterService, localDraft, type ClinicalEncounter, type TrackedPlanItem, type TrackedProblem } from '../../../services/clinicalEncounterService';
import { ComplaintsEditor, ExamEditor, VitalsEditor } from './sections';
import { SuggestionReview } from './SuggestionReview';
import { Section } from './fields';

const PROBLEM_OPTIONS: Array<[string, string, string]> = [
  ['improved', 'Improved', 'bg-green-600'], ['unchanged', 'Unchanged', 'bg-gray-600'], ['worse', 'Worse', 'bg-red-600'],
  ['resolved', 'Resolved', 'bg-emerald-700'], ['ruled_out', 'Ruled out', 'bg-slate-600'],
];
const PLAN_OPTIONS: Array<[string, string, string]> = [
  ['done', 'Done', 'bg-green-600'], ['in_progress', 'In progress', 'bg-blue-600'], ['not_done', 'Not done', 'bg-amber-600'], ['stopped', 'Stopped', 'bg-gray-600'],
];

const StatusPicker: React.FC<{ options: Array<[string, string, string]>; value: string; onChange: (v: string) => void }> = ({ options, value, onChange }) => (
  <span className="inline-flex flex-wrap gap-1">
    {options.map(([v, l, tone]) => (
      <button key={v} type="button" onClick={() => onChange(value === v ? 'not_reviewed' : v)}
        className={`px-2 py-1 text-xs rounded border ${value === v ? `${tone} text-white border-transparent` : 'bg-white text-gray-700 border-gray-300'}`}>{l}</button>
    ))}
  </span>
);

interface Props {
  patientId: string;
  patientLabel: string;
  ctx: PatientContext;
  userName: string;
  canSign: boolean;
  problems: TrackedProblem[];
  planItems: TrackedPlanItem[];
  initial?: ClinicalEncounter | null;
  existing?: ClinicalEncounter | null;
  onClose: () => void;
  onSaved: () => void;
}

export const FollowUpEncounterForm: React.FC<Props> = ({ patientId, patientLabel, ctx, userName, canSign, problems, planItems, initial, existing, onClose, onSaved }) => {
  const draftType = existing ? `followup-${existing.id}` : 'followup';
  const open = (s: string) => !['resolved', 'ruled_out', 'withdrawn'].includes(s);
  const openPlan = (s: string) => !['done', 'stopped', 'withdrawn'].includes(s);

  const seed = (): FollowUpData => {
    const fu = emptyFollowUp();
    fu.problems = problems.filter(p => open(p.status)).map(p => ({ problemId: String(p.id), label: p.label, status: 'not_reviewed' }));
    fu.plan = planItems.filter(i => openPlan(i.status)).map(i => ({ itemId: String(i.id), text: i.text, kind: i.kind, status: 'not_reviewed' }));
    return fu;
  };
  const restored = useMemo(() => localDraft.load<{ data: FollowUpData; suggestions: Suggestion[]; savedAt: string }>(patientId, draftType), [patientId, draftType]);
  const [data, setData] = useState<FollowUpData>(() => restored?.data || existing?.data || seed());
  const [suggestions, setSuggestions] = useState<Suggestion[]>(() => restored?.suggestions || existing?.suggestions || []);
  const [encounter, setEncounter] = useState<ClinicalEncounter | null>(existing || null);
  const [hasNew, setHasNew] = useState<boolean | null>(data.newComplaints.length ? true : null);
  const [saving, setSaving] = useState(false);
  const [aiState, setAiState] = useState<string>('');

  useEffect(() => {
    const key = encounter ? `followup-${encounter.id}` : 'followup';
    const t = setTimeout(() => localDraft.save(patientId, key, { data, suggestions }), 600);
    return () => clearTimeout(t);
  }, [data, suggestions, patientId, encounter?.id]);

  // A clerking-shaped view of the follow-up, so the same rules / AI apply to new complaints.
  const pseudo: ClerkingData = useMemo(() => {
    const base: ClerkingData = initial?.data?.version ? initial.data : { version: 1, source: { informant: '', reliability: '' }, complaints: [], history: {}, medications: [], allergies: [], exam: {}, vitals: {} };
    return { ...base, complaints: data.newComplaints, vitals: data.vitals, exam: data.exam };
  }, [initial, data.newComplaints, data.vitals, data.exam]);

  useEffect(() => {
    if (!data.newComplaints.length) return;
    setSuggestions(prev => {
      const isRule = (s: Suggestion) => s.source === 'rules' && !s.id.startsWith('manual:');
      return [...mergeSuggestions(prev.filter(isRule), ruleSuggestions(pseudo, ctx)), ...prev.filter(s => !isRule(s))];
    });
  }, [pseudo]); // eslint-disable-line react-hooks/exhaustive-deps

  const examIds = useMemo(() => {
    const fromInitial = (initial?.data?.complaints || []).flatMap((c: any) => COMPLAINT_BY_ID[c.complaintId]?.exams || []);
    const fromNew = data.newComplaints.flatMap(c => COMPLAINT_BY_ID[c.complaintId]?.exams || []);
    return [...new Set(['general', ...fromInitial, ...fromNew])];
  }, [initial, data.newComplaints]);

  const flags = useMemo(() => redFlags(pseudo, ctx), [pseudo, ctx]);
  const narrative = useMemo(() => {
    const accepted = suggestions.filter(s => s.decision === 'accepted');
    const extra = accepted.length ? `\n\nNEW ITEMS ACCEPTED\n${accepted.map(s => `• [${s.kind}] ${s.edited || s.text}`).join('\n')}` : '';
    return `${patientLabel}\n${generateFollowUpNarrative(data, userName)}${extra}`;
  }, [data, suggestions, patientLabel, userName]);

  const unreviewed = data.problems.filter(p => p.status === 'not_reviewed').length + data.plan.filter(p => p.status === 'not_reviewed').length;
  const readOnly = encounter?.status === 'signed' || encounter?.status === 'entered_in_error';

  const save = async () => {
    setSaving(true);
    try {
      const saved = await clinicalEncounterService.save({
        id: encounter?.id, version: encounter?.version, patient_id: patientId, encounter_type: 'follow_up', parent_encounter_id: initial?.id ?? null,
        data, suggestions, narrative,
        summary: {
          problems: data.problems.map(p => ({ label: p.label, status: p.status })),
          plan: data.plan.map(p => ({ text: p.text, status: p.status })),
          new_complaints: data.newComplaints.map(c => c.label),
          red_flags: flags.map(f => f.text),
          impression: data.impression || null,
        },
      });
      setEncounter(saved);
      localDraft.clear(patientId, 'followup');
      return saved;
    } catch (e: any) {
      toast.error(navigator.onLine ? String(e?.message || 'Could not save').replace(/^\[HTTP \d+\]\s*/, '') : 'Offline — kept on this device. Save again when online.');
      return null;
    } finally {
      setSaving(false);
    }
  };

  const submit = async () => {
    if (unreviewed && !window.confirm(`${unreviewed} problem(s) / plan item(s) are not reviewed and will stay as they are. Submit anyway?`)) return;
    if (hasNew === null && !window.confirm('You have not recorded whether there are new complaints. Submit anyway?')) return;
    const saved = await save();
    if (!saved) return;
    setSaving(true);
    try {
      const r = await clinicalEncounterService.submit(saved.id, saved.version, canSign);
      localDraft.clear(patientId, `followup-${saved.id}`);
      localDraft.clear(patientId, 'followup');
      toast.success(r.encounter.status === 'signed' ? 'Follow-up signed — progress recorded' : 'Follow-up submitted for review');
      onSaved();
      onClose();
    } catch (e: any) {
      toast.error(String(e?.message || 'Could not submit').replace(/^\[HTTP \d+\]\s*/, ''));
    } finally {
      setSaving(false);
    }
  };

  const runAi = async () => {
    setAiState('Asking AI…');
    try {
      const r = await clinicalEncounterService.aiSuggest(patientId, { ...aiPayload(pseudo, ctx), context: 'Follow-up encounter: suggest only for the new complaints', known_problems: problems.filter(p => open(p.status)).map(p => p.label) });
      setSuggestions(prev => [...prev.filter(s => s.source !== 'ai' || s.decision !== 'pending'), ...r.suggestions.filter(s => !prev.some(p => p.id === s.id))]);
      setAiState('');
    } catch (e: any) {
      setAiState(String(e?.message || 'AI unavailable').replace(/^\[HTTP \d+\]\s*/, ''));
    }
  };

  const riskFactorsFromInitial: string[] = initial?.summary?.risk_factors || [];

  return (
    <div className="fixed inset-0 z-50 bg-black/40 flex items-stretch sm:items-center justify-center sm:p-4" role="dialog" aria-modal="true" aria-label="Follow-up encounter">
      <div className="bg-gray-50 w-full sm:max-w-4xl sm:rounded-2xl shadow-xl flex flex-col max-h-screen sm:max-h-[95vh]">
        <div className="bg-white border-b px-4 py-3 sm:rounded-t-2xl flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h2 className="text-lg font-bold text-gray-900">Follow-up Encounter</h2>
            <p className="text-xs text-gray-500 truncate">{patientLabel}{encounter && <> · <span className="font-medium">{encounter.status.replace('_', ' ')}</span></>}</p>
          </div>
          <button type="button" onClick={onClose} className="px-3 py-1.5 text-sm rounded-lg border">Close</button>
        </div>

        <fieldset disabled={readOnly} className="flex-1 overflow-y-auto px-3 sm:px-5 py-4 space-y-4 min-w-0">
          {riskFactorsFromInitial.length > 0 && (
            <div className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs text-amber-900">
              <strong>Known risk factors:</strong> {riskFactorsFromInitial.join(' · ')}
            </div>
          )}

          <Section title="Progress of identified problems" badge={<span className="text-[11px] px-2 py-0.5 rounded-full bg-gray-100">{data.problems.length}</span>}>
            {data.problems.length === 0 && <p className="text-xs text-gray-500">No open problems from earlier encounters.</p>}
            {data.problems.map((p, i) => (
              <div key={p.problemId} className="rounded-lg border border-gray-200 bg-white p-2.5 space-y-2">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="text-sm font-medium text-gray-900">{p.label}</span>
                  <StatusPicker options={PROBLEM_OPTIONS} value={p.status} onChange={status => setData(d => ({ ...d, problems: d.problems.map((x, j) => (j === i ? { ...x, status } : x)) }))} />
                </div>
                <input placeholder="Progress note (e.g. wound 4×3 cm, granulating, less slough)" className="w-full rounded border border-gray-300 px-2 py-1.5 text-sm"
                  value={p.note || ''} onChange={e => setData(d => ({ ...d, problems: d.problems.map((x, j) => (j === i ? { ...x, note: e.target.value || undefined } : x)) }))} />
              </div>
            ))}
          </Section>

          <Section title="Planned investigations and treatment" badge={<span className="text-[11px] px-2 py-0.5 rounded-full bg-gray-100">{data.plan.length}</span>}>
            {data.plan.length === 0 && <p className="text-xs text-gray-500">No outstanding plan items.</p>}
            {data.plan.map((p, i) => (
              <div key={p.itemId} className="rounded-lg border border-gray-200 bg-white p-2.5 space-y-2">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="text-sm text-gray-900"><span className="text-[10px] uppercase text-gray-400 mr-1">{p.kind === 'investigation' ? 'Inv' : 'Tx'}</span>{p.text}</span>
                  <StatusPicker options={PLAN_OPTIONS} value={p.status} onChange={status => setData(d => ({ ...d, plan: d.plan.map((x, j) => (j === i ? { ...x, status } : x)) }))} />
                </div>
                <input placeholder={p.kind === 'investigation' ? 'Result / reason not done' : 'Response / reason stopped'} className="w-full rounded border border-gray-300 px-2 py-1.5 text-sm"
                  value={p.note || ''} onChange={e => setData(d => ({ ...d, plan: d.plan.map((x, j) => (j === i ? { ...x, note: e.target.value || undefined } : x)) }))} />
              </div>
            ))}
          </Section>

          <Section title="Interval history and new complaints">
            <textarea rows={2} className="w-full rounded-lg border border-gray-300 px-2.5 py-2 text-sm" placeholder="How the patient feels since the last review, pain, sleep, appetite, mobility…"
              value={data.symptoms || ''} onChange={e => setData(d => ({ ...d, symptoms: e.target.value || undefined }))} />
            <div className="flex items-center gap-2 text-sm">
              <span>New complaints since the last encounter?</span>
              <button type="button" onClick={() => setHasNew(true)} className={`px-3 py-1 text-xs rounded border ${hasNew === true ? 'bg-amber-600 text-white' : ''}`}>Yes</button>
              <button type="button" onClick={() => { setHasNew(false); setData(d => ({ ...d, newComplaints: [] })); }} className={`px-3 py-1 text-xs rounded border ${hasNew === false ? 'bg-green-600 text-white' : ''}`}>No</button>
            </div>
            {hasNew && <ComplaintsEditor complaints={data.newComplaints} onChange={newComplaints => setData(d => ({ ...d, newComplaints }))} pickerPlaceholder="Type the new complaint…" />}
          </Section>

          <Section title="Vital signs"><VitalsEditor vitals={data.vitals} onChange={vitals => setData(d => ({ ...d, vitals }))} /></Section>
          <ExamEditor sectionIds={examIds} focusedIds={examIds.filter(x => x !== 'general')} exam={data.exam} onChange={exam => setData(d => ({ ...d, exam }))} />

          {flags.length > 0 && (
            <div className="rounded-xl border border-red-300 bg-red-50 p-3">
              <h4 className="text-sm font-semibold text-red-800 mb-1">⚠ Red flags</h4>
              <ul className="text-sm text-red-800 list-disc pl-5">{flags.map((f, i) => <li key={i}>{f.text}</li>)}</ul>
            </div>
          )}

          {(data.newComplaints.length > 0 || suggestions.length > 0) && (
            <Section title="Suggestions for new problems" subtitle="Accept, edit or reject — accepted items join the tracked problem list and plan">
              <div className="flex items-center gap-2 text-xs">
                <button type="button" onClick={runAi} disabled={!data.newComplaints.length} className="px-3 py-1.5 rounded-lg bg-purple-600 text-white disabled:opacity-50">✨ Get AI suggestions</button>
                {aiState && <span className="text-amber-700">{aiState}</span>}
              </div>
              <SuggestionReview suggestions={suggestions} onChange={setSuggestions} readOnly={readOnly} />
            </Section>
          )}

          <Section title="Impression and plan">
            <textarea rows={3} className="w-full rounded-lg border border-gray-300 px-2.5 py-2 text-sm" value={data.impression || ''}
              onChange={e => setData(d => ({ ...d, impression: e.target.value || undefined }))} />
          </Section>

          <Section title="Follow-up note (generated)" defaultOpen={false}>
            <pre className="whitespace-pre-wrap text-xs text-gray-800 bg-white border rounded-lg p-3 max-h-80 overflow-auto font-sans">{narrative}</pre>
          </Section>
        </fieldset>

        {!readOnly && (
          <div className="bg-white border-t px-4 py-3 flex flex-wrap items-center justify-between gap-2 sm:rounded-b-2xl">
            <span className="text-xs text-gray-500">{unreviewed ? `${unreviewed} item(s) not reviewed` : 'All items reviewed ✓'}</span>
            <div className="flex gap-2">
              <button type="button" disabled={saving} onClick={async () => { if (await save()) toast.success('Draft saved'); }} className="px-3 py-2 text-sm rounded-lg border">{saving ? 'Saving…' : 'Save draft'}</button>
              <button type="button" disabled={saving} onClick={submit} className="px-4 py-2 text-sm rounded-lg bg-green-600 text-white disabled:opacity-50">{canSign ? 'Sign follow-up' : 'Submit for review'}</button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default FollowUpEncounterForm;
