/**
 * Templated reviews — wound care review, pre-operative review, post-operative
 * review and follow-up, for every plastic surgery procedure.
 *
 * Step 1 picks the review and the procedure; step 2 is the structured form
 * (procedure module + holistic assessment), with live scores, alerts and
 * completeness, and an integrated treatment plan proposed from the answers
 * that the clinician edits, extends and approves. Saving, submitting and
 * signing follow the same flow as the clerking; the review exports to PDF.
 */
import React, { useEffect, useMemo, useState } from 'react';
import toast from 'react-hot-toast';
import type { PatientContext } from '../../../clinical/clerking/engine';
import {
  buildPlan, buildTemplate, completeness, computeScores, daysSince, emptyTemplateData, planSuggestions, templateFlags, templateNarrative, templateSummary,
} from '../../../clinical/templates/engine';
import { downloadTemplatePdf } from '../../../clinical/templates/pdf';
import { PROCEDURE_BY_ID, PROCEDURE_GROUPS, searchProcedures } from '../../../clinical/templates/procedures';
import { PLAN_DOMAINS, REVIEW_KINDS, type PlanDomain, type PlanLine, type ReviewKind, type TemplateData } from '../../../clinical/templates/types';
import { clinicalEncounterService, localDraft, type ClinicalEncounter } from '../../../services/clinicalEncounterService';
import { QuestionGrid, Section } from '../clerking/fields';

export const TEMPLATE_KINDS: ReviewKind[] = REVIEW_KINDS.map(k => k.kind);
export const isTemplateKind = (t: string): t is ReviewKind => (TEMPLATE_KINDS as string[]).includes(t);

const TONE: Record<string, string> = {
  ok: 'bg-green-50 border-green-200 text-green-800', info: 'bg-blue-50 border-blue-200 text-blue-800',
  warn: 'bg-amber-50 border-amber-300 text-amber-900', danger: 'bg-red-50 border-red-300 text-red-800',
};
const ICON: Record<ReviewKind, string> = { wound_review: '🩹', preop_review: '📋', postop_review: '🛏️', procedure_follow_up: '📅' };

export function patientMetaFromLabel(patientLabel: string, ctx: PatientContext) {
  const [name, hosp] = patientLabel.split(' · ');
  const ageSex = [ctx.ageYears != null ? `${ctx.ageYears} y` : '', ctx.sex || ''].filter(Boolean).join(' / ');
  return { patientName: name || patientLabel, hospitalNumber: hosp, ageSex: ageSex || undefined };
}

/** Export any saved templated encounter to PDF (used from the encounter list too). */
export function exportEncounterPdf(e: ClinicalEncounter, patientLabel: string, ctx: PatientContext) {
  const d = e.data as TemplateData;
  if (!d?.templateId || !isTemplateKind(e.encounter_type)) return;
  const t = buildTemplate(d.kind, d.procedureId);
  downloadTemplatePdf(t, { ...d, plan: d.plan || [] }, {
    ...patientMetaFromLabel(patientLabel, ctx), author: e.created_by_name || 'unknown', status: e.status,
    signedBy: e.signed_by_name, signedAt: e.signed_at, when: new Date(e.created_at),
  });
}

// ── Picker ────────────────────────────────────────────────────────────────

const TemplatePicker: React.FC<{
  preops: ClinicalEncounter[];
  initialKind?: ReviewKind;
  onPick: (kind: ReviewKind, procedureId: string | null, linked?: ClinicalEncounter) => void;
}> = ({ preops, initialKind, onPick }) => {
  const [kind, setKind] = useState<ReviewKind | null>(initialKind || null);
  const [term, setTerm] = useState('');
  const list = searchProcedures(term);
  const linkable = preops.filter(p => p.data?.procedureId && PROCEDURE_BY_ID[p.data.procedureId]);

  return (
    <div className="space-y-4">
      <div className="grid sm:grid-cols-2 gap-2">
        {REVIEW_KINDS.map(k => (
          <button key={k.kind} type="button" onClick={() => (k.kind === 'wound_review' ? onPick('wound_review', null) : setKind(k.kind))}
            className={`text-left rounded-xl border p-3 transition ${kind === k.kind ? 'border-green-600 bg-green-50 ring-2 ring-green-200' : 'border-gray-200 bg-white hover:border-green-400'}`}>
            <span className="font-semibold text-gray-900">{ICON[k.kind]} {k.label}</span>
            <span className="block text-xs text-gray-600 mt-0.5">{k.description}</span>
          </button>
        ))}
      </div>

      {kind && kind !== 'wound_review' && (
        <div className="space-y-3">
          {kind !== 'preop_review' && linkable.length > 0 && (
            <div className="rounded-xl border border-blue-200 bg-blue-50 p-3">
              <p className="text-xs font-semibold text-blue-900 mb-1.5">Continue from a pre-operative review (details carried forward)</p>
              <div className="flex flex-wrap gap-1.5">
                {linkable.slice(0, 6).map(p => (
                  <button key={p.id} type="button" onClick={() => onPick(kind, p.data.procedureId, p)} className="px-2.5 py-1 text-xs rounded-full bg-white border border-blue-300 text-blue-800 hover:bg-blue-100">
                    {PROCEDURE_BY_ID[p.data.procedureId].label} · {new Date(p.created_at).toLocaleDateString()}
                  </button>
                ))}
              </div>
            </div>
          )}
          <input autoFocus value={term} onChange={e => setTerm(e.target.value)} placeholder="Search procedure — e.g. graft, melanoma, tendon, diabetic foot, scalp, pressure sore…"
            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm" />
          <div className="space-y-3 max-h-[50vh] overflow-y-auto">
            {PROCEDURE_GROUPS.map(g => {
              const items = list.filter(p => p.group === g);
              if (!items.length) return null;
              return (
                <div key={g}>
                  <p className="text-[11px] uppercase tracking-wide text-gray-500 font-semibold mb-1">{g}</p>
                  <div className="grid sm:grid-cols-2 gap-1.5">
                    {items.map(p => (
                      <button key={p.id} type="button" onClick={() => onPick(kind, p.id)} className="text-left text-sm rounded-lg border border-gray-200 bg-white px-3 py-2 hover:border-green-500 hover:bg-green-50">{p.label}</button>
                    ))}
                  </div>
                </div>
              );
            })}
            {!list.length && <p className="text-xs text-gray-500">No procedure matches. Use the closest template, or the wound care review.</p>}
          </div>
        </div>
      )}
    </div>
  );
};

// ── Plan editor ───────────────────────────────────────────────────────────

const PlanEditor: React.FC<{ plan: PlanLine[]; onChange: (p: PlanLine[]) => void; readOnly: boolean }> = ({ plan, onChange, readOnly }) => {
  const [domain, setDomain] = useState<PlanDomain>('Surgical / wound management');
  const [txt, setTxt] = useState('');
  const set = (id: string, patch: Partial<PlanLine>) => onChange(plan.map(l => (l.id === id ? { ...l, ...patch } : l)));
  const add = () => {
    if (!txt.trim()) return;
    onChange([...plan, { id: `c${Date.now().toString(36)}`, domain, text: txt.trim(), kind: domain === 'Investigations' ? 'investigation' : 'treatment', source: 'clinician', include: true }]);
    setTxt('');
  };
  return (
    <div className="space-y-3">
      {PLAN_DOMAINS.map(d => {
        const ls = plan.filter(l => l.domain === d);
        if (!ls.length) return null;
        return (
          <div key={d} className="rounded-lg border border-gray-200 bg-white">
            <p className="px-3 py-1.5 text-xs font-semibold text-green-900 bg-green-50 border-b rounded-t-lg">{d}</p>
            <ul className="divide-y divide-gray-100">
              {ls.map(l => (
                <li key={l.id} className={`px-3 py-2 flex items-start gap-2 ${l.include ? '' : 'opacity-50'}`}>
                  <input type="checkbox" className="mt-1.5" checked={l.include} disabled={readOnly} aria-label="Include in plan" onChange={e => set(l.id, { include: e.target.checked })} />
                  <div className="flex-1 min-w-0">
                    <textarea rows={1} disabled={readOnly} value={l.text} onChange={e => set(l.id, { text: e.target.value, edited: true })}
                      className="w-full text-sm border-0 border-b border-transparent focus:border-green-400 focus:ring-0 p-0 resize-y bg-transparent" />
                    <span className="text-[11px] text-gray-500">
                      {l.priority === 'urgent' && <span className="text-red-700 font-semibold mr-1">URGENT</span>}
                      {l.kind === 'investigation' && <span className="mr-1">🔬 investigation</span>}
                      {l.source === 'clinician' ? 'added by clinician' : l.why || ''}
                      {l.edited && l.source === 'template' && ' · edited'}
                    </span>
                  </div>
                  {!readOnly && (
                    <button type="button" onClick={() => set(l.id, { priority: l.priority === 'urgent' ? 'routine' : 'urgent' })} title="Toggle urgent"
                      className={`text-[11px] px-1.5 py-0.5 rounded border ${l.priority === 'urgent' ? 'bg-red-600 text-white border-red-600' : 'text-gray-500'}`}>!</button>
                  )}
                  {!readOnly && l.source === 'clinician' && (
                    <button type="button" onClick={() => onChange(plan.filter(x => x.id !== l.id))} className="text-xs text-red-600" aria-label="Remove">✕</button>
                  )}
                </li>
              ))}
            </ul>
          </div>
        );
      })}
      {!plan.length && <p className="text-xs text-gray-500">The plan builds itself as you complete the assessment.</p>}
      {!readOnly && (
        <div className="flex flex-col sm:flex-row gap-2">
          <select value={domain} onChange={e => setDomain(e.target.value as PlanDomain)} className="rounded-lg border border-gray-300 px-2 py-2 text-sm sm:w-64">
            {PLAN_DOMAINS.map(d => <option key={d} value={d}>{d}</option>)}
          </select>
          <input value={txt} onChange={e => setTxt(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); add(); } }}
            placeholder="Add your own plan item…" className="flex-1 rounded-lg border border-gray-300 px-3 py-2 text-sm" />
          <button type="button" onClick={add} className="px-3 py-2 text-sm rounded-lg bg-green-600 text-white">Add</button>
        </div>
      )}
    </div>
  );
};

// ── Form ──────────────────────────────────────────────────────────────────

interface Props {
  patientId: string;
  patientLabel: string;
  ctx: PatientContext;
  userName: string;
  canSign: boolean;
  encounters: ClinicalEncounter[];
  existing?: ClinicalEncounter | null;
  initialKind?: ReviewKind;
  onClose: () => void;
  onSaved: () => void;
}

/** Answers carried from a pre-op into the post-op / follow-up that continues it. */
function carryForward(from: TemplateData | undefined, kind: ReviewKind): TemplateData['answers'] {
  if (!from?.answers) return {};
  const ind = from.answers.indication || {};
  const out: TemplateData['answers'] = {
    indication: { diagnosis: ind.diagnosis, side: ind.side, procedure_done: ind.procedure_planned || ind.procedure_done, surgery_date: ind.surgery_date, surgeon: ind.surgeon },
    healing: from.answers.healing ? { ...from.answers.healing } : undefined as any,
    nutrition: from.answers.nutrition ? { weight: from.answers.nutrition.weight, height: from.answers.nutrition.height } : undefined as any,
  };
  if (kind === 'procedure_follow_up' && from.answers.psych?.occupation) out.psych = { occupation: from.answers.psych.occupation };
  for (const k of Object.keys(out)) if (!out[k]) delete out[k];
  return out;
}

export const TemplatedReviewForm: React.FC<Props> = ({ patientId, patientLabel, ctx, userName, canSign, encounters, existing, initialKind, onClose, onSaved }) => {
  const [encounter, setEncounter] = useState<ClinicalEncounter | null>(existing || null);
  const [pick, setPick] = useState<{ kind: ReviewKind; procedureId: string | null; linkedId: number | null } | null>(() =>
    existing?.data?.templateId ? { kind: existing.data.kind, procedureId: existing.data.procedureId, linkedId: existing.parent_encounter_id ?? null } : null);
  const template = useMemo(() => (pick ? buildTemplate(pick.kind, pick.procedureId) : null), [pick?.kind, pick?.procedureId]);
  const draftKey = encounter ? `template-${encounter.id}` : pick ? `template-${pick.kind}-${pick.procedureId || 'wound'}` : '';

  const [data, setData] = useState<TemplateData | null>(() => (existing?.data?.templateId ? { ...existing.data, plan: existing.data.plan || [] } : null));
  const [saving, setSaving] = useState(false);
  const readOnly = encounter?.status === 'signed' || encounter?.status === 'entered_in_error';

  const choose = (kind: ReviewKind, procedureId: string | null, linked?: ClinicalEncounter) => {
    const t = buildTemplate(kind, procedureId);
    const key = `template-${kind}-${procedureId || 'wound'}`;
    const restored = localDraft.load<{ data: TemplateData }>(patientId, key);
    const base = emptyTemplateData(t);
    if (linked) { base.answers = carryForward(linked.data, kind); base.linkedEncounterId = linked.id; }
    setData(restored?.data?.templateId === t.id && !linked ? restored.data : base);
    setPick({ kind, procedureId, linkedId: linked?.id ?? null });
    if (restored?.data && !linked) toast('Restored your unsaved draft from this device', { icon: '💾' });
  };

  // Post-operative day / weeks since surgery from the date of surgery.
  const surgeryDate = data?.answers?.indication?.surgery_date;
  useEffect(() => {
    if (!data || readOnly) return;
    const days = daysSince(surgeryDate);
    if (days === null || days < 0) return;
    if (pick?.kind === 'postop_review' && data.answers.obs?.pod === undefined) setAns('obs', 'pod', days);
    if (pick?.kind === 'procedure_follow_up' && data.answers.interval?.weeks === undefined) setAns('interval', 'weeks', Math.round((days / 7) * 10) / 10);
  }, [surgeryDate]); // eslint-disable-line react-hooks/exhaustive-deps

  // The plan follows the answers.
  useEffect(() => {
    if (!template || !data || readOnly) return;
    const next = buildPlan(template, data.answers, data.plan);
    if (JSON.stringify(next) !== JSON.stringify(data.plan)) setData(d => (d ? { ...d, plan: next } : d));
  }, [template, data?.answers]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!data || !draftKey || readOnly) return;
    const t = setTimeout(() => localDraft.save(patientId, draftKey, { data }), 600);
    return () => clearTimeout(t);
  }, [data, draftKey, patientId, readOnly]);

  function setAns(section: string, id: string, v: any) {
    setData(d => (d ? { ...d, answers: { ...d.answers, [section]: { ...(d.answers[section] || {}), [id]: v } } } : d));
  }

  const scores = useMemo(() => (template && data ? computeScores(template, data.answers) : []), [template, data?.answers]);
  const flags = useMemo(() => (template && data ? templateFlags(template, data.answers) : []), [template, data?.answers]);
  const comp = useMemo(() => (template && data ? completeness(template, data.answers) : { done: 0, total: 0, missing: [] }), [template, data?.answers]);
  const sectionMissing = (id: string, title: string) => comp.missing.filter(m => m.section === title).length;
  const urgent = flags.filter(f => f.severity === 'urgent');
  const meta = patientMetaFromLabel(patientLabel, ctx);

  const save = async () => {
    if (!template || !data || !pick) return null;
    setSaving(true);
    try {
      const narrative = templateNarrative(template, data, { patientLabel, author: userName });
      const saved = await clinicalEncounterService.save({
        id: encounter?.id, version: encounter?.version, patient_id: patientId, encounter_type: pick.kind,
        parent_encounter_id: pick.linkedId ?? data.linkedEncounterId ?? null,
        data, suggestions: planSuggestions(data, template.title), summary: templateSummary(template, data), narrative,
      });
      setEncounter(saved);
      localDraft.clear(patientId, `template-${pick.kind}-${pick.procedureId || 'wound'}`);
      return saved;
    } catch (e: any) {
      toast.error(navigator.onLine ? String(e?.message || 'Could not save').replace(/^\[HTTP \d+\]\s*/, '') : 'Offline — kept on this device. Save again when online.');
      return null;
    } finally {
      setSaving(false);
    }
  };

  const submit = async () => {
    if (comp.missing.length && !window.confirm(`${comp.missing.length} required item(s) are not documented:\n\n${comp.missing.slice(0, 12).map(m => `• ${m.label}`).join('\n')}${comp.missing.length > 12 ? '\n…' : ''}\n\nThey will be recorded as "not documented". Submit anyway?`)) return;
    if (data && !data.plan.some(l => l.include) && !window.confirm('The treatment plan is empty. Submit anyway?')) return;
    const saved = await save();
    if (!saved) return;
    setSaving(true);
    try {
      const r = await clinicalEncounterService.submit(saved.id, saved.version, canSign);
      localDraft.clear(patientId, `template-${saved.id}`);
      toast.success(r.encounter.status === 'signed' ? 'Review signed — plan items added to the patient’s plan' : 'Review submitted for consultant approval');
      onSaved();
      onClose();
    } catch (e: any) {
      toast.error(String(e?.message || 'Could not submit').replace(/^\[HTTP \d+\]\s*/, ''));
    } finally {
      setSaving(false);
    }
  };

  const pdf = () => {
    if (!template || !data) return;
    downloadTemplatePdf(template, data, { ...meta, author: encounter?.created_by_name || userName, status: encounter?.status || 'draft', signedBy: encounter?.signed_by_name, signedAt: encounter?.signed_at });
  };

  const preops = encounters.filter(e => e.encounter_type === 'preop_review' && e.status !== 'entered_in_error');

  return (
    <div className="fixed inset-0 z-50 bg-black/40 flex items-stretch sm:items-center justify-center sm:p-4" role="dialog" aria-modal="true" aria-label="Clinical review">
      <div className="bg-gray-50 w-full sm:max-w-5xl sm:rounded-2xl shadow-xl flex flex-col max-h-screen sm:max-h-[95vh]">
        <div className="bg-white border-b px-4 py-3 sm:rounded-t-2xl flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h2 className="text-lg font-bold text-gray-900 truncate">{template ? `${ICON[template.kind]} ${template.title}` : 'New clinical review'}</h2>
            <p className="text-xs text-gray-500 truncate">
              {patientLabel}{template && <> · {template.subtitle}</>}{encounter && <> · <span className="font-medium">{encounter.status.replace('_', ' ')}</span></>}
            </p>
          </div>
          <div className="flex gap-2 shrink-0">
            {template && <button type="button" onClick={pdf} className="px-3 py-1.5 text-sm rounded-lg border border-gray-300">⬇ PDF</button>}
            <button type="button" onClick={onClose} className="px-3 py-1.5 text-sm rounded-lg border">Close</button>
          </div>
        </div>

        {!template || !data ? (
          <div className="flex-1 overflow-y-auto p-4"><TemplatePicker preops={preops} initialKind={initialKind} onPick={choose} /></div>
        ) : (
          <>
            {/* Live summary */}
            <div className="bg-white border-b px-3 sm:px-5 py-2 space-y-2">
              <div className="flex items-center gap-2">
                <div className="flex-1 h-1.5 rounded-full bg-gray-100 overflow-hidden" aria-label={`${comp.done} of ${comp.total} required items`}>
                  <div className={`h-full ${comp.done === comp.total ? 'bg-green-500' : 'bg-amber-400'}`} style={{ width: `${comp.total ? (comp.done / comp.total) * 100 : 100}%` }} />
                </div>
                <span className="text-[11px] text-gray-600 whitespace-nowrap">{comp.done}/{comp.total} required</span>
              </div>
              {scores.length > 0 && (
                <div className="flex flex-wrap gap-1.5">
                  {scores.map(s => (
                    <span key={s.id} title={s.reference} className={`text-[11px] px-2 py-0.5 rounded-full border ${TONE[s.result.tone]}`}>
                      <strong>{s.label}</strong> {s.result.value} · {s.result.band}
                    </span>
                  ))}
                </div>
              )}
              {urgent.length > 0 && (
                <div className="rounded-lg bg-red-600 text-white text-xs px-3 py-1.5 space-y-0.5">
                  {urgent.map((f, i) => <p key={i}>⚠ {f.text}</p>)}
                </div>
              )}
            </div>

            <fieldset disabled={readOnly} className="flex-1 overflow-y-auto px-3 sm:px-5 py-4 space-y-3 min-w-0">
              {pick?.linkedId && (
                <p className="text-xs text-blue-800 bg-blue-50 border border-blue-200 rounded-lg px-3 py-2">Linked to the pre-operative review — diagnosis, procedure, surgery date, nutrition and healing factors carried forward. Check and update them.</p>
              )}
              {template.sections.map((s, i) => {
                const miss = sectionMissing(s.id, s.title);
                return (
                  <Section key={s.id} title={s.title} subtitle={s.subtitle} defaultOpen={i < 3 || miss > 0}
                    badge={miss ? <span className="text-[11px] px-2 py-0.5 rounded-full bg-amber-100 text-amber-800">{miss} to do</span> : <span className="text-[11px] px-2 py-0.5 rounded-full bg-green-100 text-green-800">✓</span>}>
                    <QuestionGrid questions={s.questions} answers={data.answers[s.id] || {}} onChange={(id, v) => setAns(s.id, id, v)} />
                  </Section>
                );
              })}

              {flags.length > 0 && (
                <div className="rounded-xl border border-red-300 bg-red-50 p-3">
                  <h4 className="text-sm font-semibold text-red-800 mb-1">⚠ Alerts ({flags.length})</h4>
                  <ul className="text-sm text-red-800 list-disc pl-5 space-y-0.5">{flags.map((f, i) => <li key={i} className={f.severity === 'urgent' ? 'font-semibold' : ''}>{f.text}</li>)}</ul>
                </div>
              )}

              <Section title="Impression">
                <textarea rows={2} className="w-full rounded-lg border border-gray-300 px-2.5 py-2 text-sm" placeholder="Your clinical impression in one or two sentences"
                  value={data.impression || ''} onChange={e => setData(d => (d ? { ...d, impression: e.target.value || undefined } : d))} />
              </Section>

              <Section title="Integrated treatment plan" subtitle="Proposed from every part of the assessment — untick what does not apply, edit the wording, add your own. Investigations and urgent items join the patient's tracked plan when signed."
                badge={<span className="text-[11px] px-2 py-0.5 rounded-full bg-green-100 text-green-800">{data.plan.filter(l => l.include).length} items</span>}>
                <PlanEditor plan={data.plan} onChange={plan => setData(d => (d ? { ...d, plan } : d))} readOnly={readOnly} />
                <textarea rows={2} className="w-full rounded-lg border border-gray-300 px-2.5 py-2 text-sm" placeholder="Additional notes (optional)"
                  value={data.notes || ''} onChange={e => setData(d => (d ? { ...d, notes: e.target.value || undefined } : d))} />
              </Section>

              <Section title="Guideline basis" defaultOpen={false}>
                <ul className="text-xs text-gray-600 list-disc pl-5 space-y-0.5">{template.references.map(r => <li key={r}>{r}</li>)}</ul>
              </Section>

              <Section title="Note (generated)" defaultOpen={false}>
                <pre className="whitespace-pre-wrap text-xs text-gray-800 bg-white border rounded-lg p-3 max-h-80 overflow-auto font-sans">{templateNarrative(template, data, { patientLabel, author: userName })}</pre>
              </Section>
            </fieldset>

            {!readOnly && (
              <div className="bg-white border-t px-4 py-3 flex flex-wrap items-center justify-between gap-2 sm:rounded-b-2xl">
                <span className="text-xs text-gray-500">{comp.missing.length ? `${comp.missing.length} required item(s) to complete` : 'All required items documented ✓'}</span>
                <div className="flex gap-2">
                  <button type="button" disabled={saving} onClick={async () => { if (await save()) toast.success('Draft saved'); }} className="px-3 py-2 text-sm rounded-lg border">{saving ? 'Saving…' : 'Save draft'}</button>
                  <button type="button" disabled={saving} onClick={submit} className="px-4 py-2 text-sm rounded-lg bg-green-600 text-white disabled:opacity-50">{canSign ? 'Approve & sign' : 'Submit for approval'}</button>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
};

export default TemplatedReviewForm;
