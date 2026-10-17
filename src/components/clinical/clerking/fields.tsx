/**
 * Form controls for structured clerking. Every question is a dropdown (or chip
 * set for multi-answer questions); nothing is pre-filled, so an untouched
 * field is reported as "not documented". Red-flag answers turn red.
 */
import React, { useEffect, useMemo, useRef, useState } from 'react';
import type { ComplaintEntry, Question } from '../../../clinical/clerking/types';
import { COMPLAINT_BY_ID, searchComplaints } from '../../../clinical/clerking/complaints';
import { isVisible } from '../../../clinical/clerking/engine';

type Answers = Record<string, any>;

const isRed = (q: Question, v: any) =>
  !!q.redFlags && (Array.isArray(v) ? v : [v]).some(x => q.redFlags!.includes(String(x)));

export const QuestionField: React.FC<{ q: Question; value: any; onChange: (v: any) => void }> = ({ q, value, onChange }) => {
  const red = isRed(q, value);
  const answered = value !== undefined && value !== null && value !== '' && !(Array.isArray(value) && value.length === 0);
  const base = `w-full rounded-lg border px-2.5 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500 ${red ? 'border-red-400 bg-red-50 text-red-800' : answered ? 'border-green-300 bg-white' : 'border-gray-300 bg-white'}`;

  let control: React.ReactNode;
  if (q.type === 'select') {
    control = (
      <select className={base} value={value ?? ''} onChange={e => onChange(e.target.value || undefined)}>
        <option value="">— select —</option>
        {q.options!.map(o => <option key={o} value={o}>{o}</option>)}
      </select>
    );
  } else if (q.type === 'multiselect') {
    const list: string[] = Array.isArray(value) ? value : [];
    const toggle = (o: string) => {
      // "None"/"Unknown"/"Not examined" are exclusive of the other answers.
      const exclusive = ['None', 'None known', 'Unknown', 'Not examined', 'Nothing relieves it'];
      let next = list.includes(o) ? list.filter(x => x !== o) : exclusive.includes(o) ? [o] : [...list.filter(x => !exclusive.includes(x)), o];
      onChange(next.length ? next : undefined);
    };
    control = (
      <div className="flex flex-wrap gap-1.5">
        {q.options!.map(o => {
          const on = list.includes(o);
          const flag = q.redFlags?.includes(o);
          return (
            <button key={o} type="button" onClick={() => toggle(o)} aria-pressed={on}
              className={`px-2.5 py-1 rounded-full text-xs border transition ${on ? (flag ? 'bg-red-600 text-white border-red-600' : 'bg-green-600 text-white border-green-600') : 'bg-white text-gray-700 border-gray-300 hover:border-green-500'}`}>
              {o}
            </button>
          );
        })}
      </div>
    );
  } else if (q.type === 'number') {
    control = (
      <div className="flex items-center gap-2">
        <input type="number" inputMode="decimal" className={base} value={value ?? ''} placeholder={q.placeholder}
          onChange={e => onChange(e.target.value === '' ? undefined : Number(e.target.value))} />
        {q.unit && <span className="text-xs text-gray-500 whitespace-nowrap">{q.unit}</span>}
      </div>
    );
  } else if (q.type === 'textarea') {
    control = <textarea className={base} rows={2} value={value ?? ''} placeholder={q.placeholder} onChange={e => onChange(e.target.value || undefined)} />;
  } else {
    control = <input className={base} value={value ?? ''} placeholder={q.placeholder} onChange={e => onChange(e.target.value || undefined)} />;
  }

  return (
    <label className={`block ${q.type === 'multiselect' || q.type === 'textarea' ? 'sm:col-span-2' : ''}`}>
      <span className={`block text-xs font-medium mb-1 ${red ? 'text-red-700' : 'text-gray-600'}`}>
        {q.label}{red && ' ⚠'}
      </span>
      {control}
      {q.hint && <span className="block text-[11px] text-gray-400 mt-0.5">{q.hint}</span>}
    </label>
  );
};

export const QuestionGrid: React.FC<{ questions: Question[]; answers: Answers; onChange: (id: string, v: any) => void }> = ({ questions, answers, onChange }) => (
  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
    {questions.filter(q => isVisible(q, answers)).map(q => (
      <QuestionField key={q.id} q={q} value={answers[q.id]} onChange={v => onChange(q.id, v)} />
    ))}
  </div>
);

export const Section: React.FC<{ title: string; subtitle?: string; badge?: React.ReactNode; defaultOpen?: boolean; children: React.ReactNode }> = ({ title, subtitle, badge, defaultOpen = true, children }) => {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="border border-gray-200 rounded-xl bg-white">
      <button type="button" onClick={() => setOpen(o => !o)} className="w-full flex items-center justify-between gap-2 px-4 py-3 text-left">
        <span>
          <span className="font-semibold text-gray-800">{title}</span>
          {subtitle && <span className="block text-xs text-gray-500">{subtitle}</span>}
        </span>
        <span className="flex items-center gap-2">{badge}<span className={`text-gray-400 transition-transform ${open ? 'rotate-180' : ''}`}>▾</span></span>
      </button>
      {open && <div className="border-t border-gray-100 p-4 space-y-4">{children}</div>}
    </div>
  );
};

export const DURATION_UNITS = ['hours', 'days', 'weeks', 'months', 'years'];

export const DurationInput: React.FC<{ value?: ComplaintEntry['duration']; onChange: (d: ComplaintEntry['duration']) => void }> = ({ value, onChange }) => (
  <div className="flex items-center gap-2">
    <input type="number" min={0} inputMode="numeric" placeholder="Duration" aria-label="Duration"
      className={`w-24 rounded-lg border px-2.5 py-2 text-sm ${value?.value ? 'border-green-300' : 'border-amber-400 bg-amber-50'}`}
      value={value?.value ?? ''} onChange={e => onChange({ value: e.target.value === '' ? null : Number(e.target.value), unit: value?.unit || 'days' })} />
    <select aria-label="Duration unit" className="rounded-lg border border-gray-300 px-2 py-2 text-sm" value={value?.unit || 'days'}
      onChange={e => onChange({ value: value?.value ?? null, unit: e.target.value })}>
      {DURATION_UNITS.map(u => <option key={u} value={u}>{u}</option>)}
    </select>
  </div>
);

/**
 * Type-ahead complaint picker: suggestions appear as the clinician types
 * (labels, lay terms, abbreviations, misspellings). Enter picks the first
 * match; anything unlisted can be added as free text.
 */
export const ComplaintPicker: React.FC<{ onPick: (complaintId: string, label: string) => void; exclude?: string[]; placeholder?: string }> = ({ onPick, exclude = [], placeholder }) => {
  const [q, setQ] = useState('');
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const boxRef = useRef<HTMLDivElement>(null);
  const results = useMemo(() => (q.trim() ? searchComplaints(q, 12) : []).filter(r => !exclude.includes(r.complaint.id)), [q, exclude]);

  useEffect(() => {
    const close = (e: MouseEvent) => { if (boxRef.current && !boxRef.current.contains(e.target as Node)) setOpen(false); };
    document.addEventListener('mousedown', close);
    return () => document.removeEventListener('mousedown', close);
  }, []);

  const pick = (id: string, label: string) => { onPick(id, label); setQ(''); setOpen(false); setActive(0); };

  return (
    <div ref={boxRef} className="relative">
      <input
        value={q}
        onChange={e => { setQ(e.target.value); setOpen(true); setActive(0); }}
        onFocus={() => setOpen(true)}
        onKeyDown={e => {
          if (e.key === 'ArrowDown') { e.preventDefault(); setActive(a => Math.min(a + 1, results.length)); }
          else if (e.key === 'ArrowUp') { e.preventDefault(); setActive(a => Math.max(a - 1, 0)); }
          else if (e.key === 'Enter') {
            e.preventDefault();
            if (results[active]) pick(results[active].complaint.id, results[active].complaint.label);
            else if (q.trim()) pick('other', q.trim());
          } else if (e.key === 'Escape') setOpen(false);
        }}
        placeholder={placeholder || 'Type a presenting complaint — e.g. ulcer, burn, keloid, swelling, SOB…'}
        className="w-full rounded-lg border-2 border-green-500 px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-green-300"
        aria-autocomplete="list"
        aria-expanded={open}
      />
      {open && q.trim() && (
        <ul role="listbox" className="absolute z-30 mt-1 w-full max-h-72 overflow-auto rounded-lg border border-gray-200 bg-white shadow-lg">
          {results.map((r, i) => (
            <li key={r.complaint.id} role="option" aria-selected={i === active}>
              <button type="button" onMouseDown={e => e.preventDefault()} onClick={() => pick(r.complaint.id, r.complaint.label)}
                className={`w-full text-left px-3 py-2 text-sm ${i === active ? 'bg-green-50' : 'hover:bg-gray-50'}`}>
                <span className="font-medium text-gray-800">{r.complaint.label}</span>
                <span className="ml-2 text-xs text-gray-400">{r.complaint.system}{r.matched ? ` · “${r.matched}”` : ''}</span>
              </button>
            </li>
          ))}
          <li role="option" aria-selected={active === results.length}>
            <button type="button" onMouseDown={e => e.preventDefault()} onClick={() => pick('other', q.trim())}
              className={`w-full text-left px-3 py-2 text-sm text-gray-600 border-t ${active === results.length ? 'bg-green-50' : 'hover:bg-gray-50'}`}>
              + Add “{q.trim()}” as written
            </button>
          </li>
        </ul>
      )}
    </div>
  );
};

export const complaintSystem = (id: string) => COMPLAINT_BY_ID[id]?.system || 'Other';

/** Present / Absent / Not asked toggles (review of systems). */
export const TriState: React.FC<{ label: string; value?: string; onChange: (v?: string) => void }> = ({ label, value, onChange }) => (
  <div className="flex items-center justify-between gap-2 py-1">
    <span className={`text-sm ${value === 'present' ? 'text-red-700 font-medium' : 'text-gray-700'}`}>{label}</span>
    <span className="inline-flex rounded-lg border border-gray-300 overflow-hidden text-xs">
      {[['present', 'Yes'], ['absent', 'No']].map(([v, l]) => (
        <button key={v} type="button" onClick={() => onChange(value === v ? undefined : v)}
          className={`px-2.5 py-1 ${value === v ? (v === 'present' ? 'bg-red-600 text-white' : 'bg-green-600 text-white') : 'bg-white text-gray-600'}`}>{l}</button>
      ))}
    </span>
  </div>
);

/** Yes / No / Unknown segmented control (comorbidities). */
export const YesNoUnknown: React.FC<{ value?: string; onChange: (v?: string) => void }> = ({ value, onChange }) => (
  <span className="inline-flex rounded-lg border border-gray-300 overflow-hidden text-xs shrink-0">
    {['Yes', 'No', 'Unknown'].map(v => (
      <button key={v} type="button" onClick={() => onChange(value === v ? undefined : v)}
        className={`px-2.5 py-1.5 ${value === v ? (v === 'Yes' ? 'bg-amber-600 text-white' : v === 'No' ? 'bg-green-600 text-white' : 'bg-gray-500 text-white') : 'bg-white text-gray-600'}`}>{v}</button>
    ))}
  </span>
);
