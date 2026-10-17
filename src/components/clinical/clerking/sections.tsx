/**
 * Building blocks shared by the initial and follow-up encounter forms:
 * presenting complaints with their dynamic question sets, vital signs with
 * plausibility checks, and the examination sections.
 */
import React, { useState } from 'react';
import type { ComplaintEntry } from '../../../clinical/clerking/types';
import { COMPLAINT_BY_ID } from '../../../clinical/clerking/complaints';
import { EXAM_SECTIONS, VITALS, VITALS_CONTEXT } from '../../../clinical/clerking/examination';
import { questionsForComplaint } from '../../../clinical/clerking/engine';
import { ComplaintPicker, DurationInput, QuestionField, QuestionGrid, Section } from './fields';

const uid = () => `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 7)}`;

export const ComplaintsEditor: React.FC<{
  complaints: ComplaintEntry[];
  onChange: (next: ComplaintEntry[]) => void;
  pickerPlaceholder?: string;
}> = ({ complaints, onChange, pickerPlaceholder }) => {
  const [openUid, setOpenUid] = useState<string | null>(complaints[0]?.uid ?? null);
  const setEntry = (u: string, patch: Partial<ComplaintEntry>) => onChange(complaints.map(c => (c.uid === u ? { ...c, ...patch } : c)));
  const move = (i: number, d: number) => {
    const next = [...complaints];
    const [x] = next.splice(i, 1);
    next.splice(i + d, 0, x);
    onChange(next);
  };

  return (
    <div className="space-y-3">
      <ComplaintPicker
        placeholder={pickerPlaceholder}
        exclude={complaints.map(c => c.complaintId).filter(id => id !== 'other')}
        onPick={(complaintId, label) => {
          const entry: ComplaintEntry = { uid: uid(), complaintId, label, duration: { value: null, unit: 'days' }, answers: {} };
          onChange([...complaints, entry]);
          setOpenUid(entry.uid);
        }}
      />
      {complaints.length === 0 && <p className="text-xs text-gray-500">Add each presenting complaint in the patient's order of importance. Questions specific to each complaint appear once it is added.</p>}
      {complaints.map((c, i) => {
        const open = openUid === c.uid;
        const modules = questionsForComplaint(c);
        const total = modules.reduce((n, m) => n + m.questions.length, 0);
        const answered = Object.values(c.answers).filter(v => v !== undefined && v !== '' && !(Array.isArray(v) && !v.length)).length;
        return (
          <div key={c.uid} className="border border-gray-200 rounded-xl bg-white">
            <div className="flex flex-wrap items-center gap-2 px-3 py-2.5">
              <span className="w-6 h-6 rounded-full bg-green-600 text-white text-xs flex items-center justify-center shrink-0">{i + 1}</span>
              <button type="button" className="flex-1 min-w-[10rem] text-left" onClick={() => setOpenUid(open ? null : c.uid)}>
                <span className="font-medium text-gray-900">{c.label}</span>
                <span className="block text-[11px] text-gray-500">{COMPLAINT_BY_ID[c.complaintId]?.system || 'Free-text complaint'} · {answered}/{total} answered</span>
              </button>
              <DurationInput value={c.duration} onChange={d => setEntry(c.uid, { duration: d })} />
              <span className="flex gap-1">
                {i > 0 && <button type="button" title="Move up" onClick={() => move(i, -1)} className="px-2 py-1 text-xs border rounded">↑</button>}
                {i < complaints.length - 1 && <button type="button" title="Move down" onClick={() => move(i, 1)} className="px-2 py-1 text-xs border rounded">↓</button>}
                <button type="button" title="Remove complaint" onClick={() => { if (answered === 0 || window.confirm(`Remove “${c.label}” and its answers?`)) onChange(complaints.filter(x => x.uid !== c.uid)); }}
                  className="px-2 py-1 text-xs border rounded text-red-600">✕</button>
              </span>
            </div>
            {open && (
              <div className="border-t border-gray-100 p-3 space-y-4">
                {modules.map(m => (
                  <div key={m.title}>
                    <h5 className="text-xs font-semibold text-green-700 uppercase tracking-wide mb-2">{m.title}</h5>
                    <QuestionGrid questions={m.questions} answers={c.answers}
                      onChange={(id, v) => setEntry(c.uid, { answers: { ...c.answers, [id]: v } })} />
                  </div>
                ))}
                <label className="block">
                  <span className="block text-xs font-medium text-gray-600 mb-1">Additional details in the patient's words</span>
                  <textarea rows={2} className="w-full rounded-lg border border-gray-300 px-2.5 py-2 text-sm" value={(c.answers.free_text as string) || ''}
                    onChange={e => setEntry(c.uid, { answers: { ...c.answers, free_text: e.target.value || undefined } as any })} />
                </label>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
};

export const VitalsEditor: React.FC<{ vitals: Record<string, any>; onChange: (next: Record<string, any>) => void }> = ({ vitals, onChange }) => {
  const [errors, setErrors] = useState<Record<string, string>>({});
  const bmi = vitals.weight && vitals.height ? Number(vitals.weight) / ((Number(vitals.height) / 100) ** 2) : null;
  const check = (id: string) => {
    const v = VITALS.find(x => x.id === id)!;
    const n = Number(vitals[id]);
    if (vitals[id] === undefined || vitals[id] === '') { setErrors(e => ({ ...e, [id]: '' })); return; }
    if (!Number.isFinite(n) || n < v.min || n > v.max) {
      setErrors(e => ({ ...e, [id]: `Not possible (${v.min}–${v.max} ${v.unit}) — re-enter` }));
      onChange({ ...vitals, [id]: undefined });
      return;
    }
    if ((n < v.plausibleMin || n > v.plausibleMax) && !window.confirm(`${v.label} ${n} ${v.unit} is very unusual. Keep this value?`)) {
      onChange({ ...vitals, [id]: undefined });
      return;
    }
    setErrors(e => ({ ...e, [id]: '' }));
  };
  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
        {VITALS.map(v => (
          <label key={v.id} className="block">
            <span className="block text-xs font-medium text-gray-600 mb-1">{v.label} <span className="text-gray-400">({v.unit})</span></span>
            <input type="number" inputMode="decimal" step="any" value={vitals[v.id] ?? ''} onBlur={() => check(v.id)}
              onChange={e => onChange({ ...vitals, [v.id]: e.target.value === '' ? undefined : Number(e.target.value) })}
              className={`w-full rounded-lg border px-2.5 py-2 text-sm ${errors[v.id] ? 'border-red-400 bg-red-50' : vitals[v.id] !== undefined ? 'border-green-300' : 'border-gray-300'}`} />
            {errors[v.id] && <span className="block text-[11px] text-red-600 mt-0.5">{errors[v.id]}</span>}
          </label>
        ))}
      </div>
      {bmi && <p className="text-xs text-gray-600">BMI: <strong>{bmi.toFixed(1)}</strong> kg/m²</p>}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {VITALS_CONTEXT.map(q => <QuestionField key={q.id} q={q} value={vitals[q.id]} onChange={val => onChange({ ...vitals, [q.id]: val })} />)}
      </div>
    </div>
  );
};

export const ExamEditor: React.FC<{
  sectionIds: string[];
  exam: Record<string, Record<string, any>>;
  onChange: (next: Record<string, Record<string, any>>) => void;
  focusedIds?: string[];
}> = ({ sectionIds, exam, onChange, focusedIds = [] }) => (
  <div className="space-y-3">
    {sectionIds.map(sid => {
      const s = EXAM_SECTIONS[sid];
      if (!s) return null;
      const answers = exam[sid] || {};
      const answered = Object.values(answers).filter(v => v !== undefined && v !== '' && !(Array.isArray(v) && !v.length)).length;
      const focused = focusedIds.includes(sid);
      return (
        <Section key={sid} title={s.title} subtitle={focused ? 'Focused examination for the presenting complaint' : undefined}
          defaultOpen={sid === 'general' || focused}
          badge={<span className={`text-[11px] px-2 py-0.5 rounded-full ${answered ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>{answered ? `${answered}/${s.questions.length}` : 'Not examined'}</span>}>
          <QuestionGrid questions={s.questions} answers={answers}
            onChange={(id, v) => onChange({ ...exam, [sid]: { ...answers, [id]: v } })} />
          <label className="block">
            <span className="block text-xs font-medium text-gray-600 mb-1">Other findings</span>
            <textarea rows={2} className="w-full rounded-lg border border-gray-300 px-2.5 py-2 text-sm" value={answers.other_findings || ''}
              onChange={e => onChange({ ...exam, [sid]: { ...answers, other_findings: e.target.value || undefined } })} />
          </label>
        </Section>
      );
    })}
  </div>
);
