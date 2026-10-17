/**
 * Accept / edit / reject every suggested diagnosis, investigation and
 * treatment. Nothing is ordered or recorded until the clinician accepts it;
 * accepted items become the tracked problem list and plan when submitted.
 */
import React, { useState } from 'react';
import type { Suggestion } from '../../../clinical/clerking/types';

const KIND_TITLES: Record<Suggestion['kind'], string> = {
  differential: 'Differential diagnoses',
  investigation: 'Investigations',
  treatment: 'Treatment / management',
};

const SuggestionRow: React.FC<{ s: Suggestion; readOnly?: boolean; onChange: (s: Suggestion) => void; onRemove?: () => void }> = ({ s, readOnly, onChange, onRemove }) => {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(s.edited || s.text);
  const tone = s.decision === 'accepted' ? 'border-green-400 bg-green-50' : s.decision === 'rejected' ? 'border-gray-200 bg-gray-50 opacity-60' : s.dangerous ? 'border-red-300 bg-red-50/40' : 'border-gray-200 bg-white';
  return (
    <li className={`rounded-lg border p-3 ${tone}`}>
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          {editing ? (
            <div className="flex gap-2">
              <input autoFocus className="flex-1 rounded border border-gray-300 px-2 py-1 text-sm" value={draft} onChange={e => setDraft(e.target.value)} />
              <button type="button" className="px-2 py-1 text-xs rounded bg-green-600 text-white"
                onClick={() => { onChange({ ...s, edited: draft.trim() && draft.trim() !== s.text ? draft.trim() : undefined, decision: 'accepted' }); setEditing(false); }}>Save</button>
              <button type="button" className="px-2 py-1 text-xs rounded border" onClick={() => { setDraft(s.edited || s.text); setEditing(false); }}>Cancel</button>
            </div>
          ) : (
            <p className={`text-sm font-medium ${s.decision === 'rejected' ? 'line-through text-gray-500' : 'text-gray-900'}`}>
              {s.edited || s.text}
              {s.edited && <span className="ml-1 text-[11px] font-normal text-gray-400">(edited from “{s.text}”)</span>}
            </p>
          )}
          <div className="flex flex-wrap gap-1 mt-1">
            <span className={`text-[10px] px-1.5 py-0.5 rounded ${s.source === 'ai' ? 'bg-purple-100 text-purple-700' : s.id.startsWith('manual:') ? 'bg-blue-100 text-blue-700' : 'bg-slate-100 text-slate-700'}`}>
              {s.source === 'ai' ? 'AI suggestion' : s.id.startsWith('manual:') ? 'Added by clinician' : 'Clinical rules'}
            </span>
            {s.dangerous && <span className="text-[10px] px-1.5 py-0.5 rounded bg-red-100 text-red-700">Can't-miss</span>}
            {s.priority === 'urgent' && <span className="text-[10px] px-1.5 py-0.5 rounded bg-orange-100 text-orange-700">Urgent</span>}
          </div>
          {s.reasons.length > 0 && (
            <ul className="mt-1.5 text-xs text-gray-600 list-disc pl-4 space-y-0.5">{s.reasons.map((r, i) => <li key={i}>{r}</li>)}</ul>
          )}
          {s.against && s.against.length > 0 && (
            <ul className="mt-1 text-xs text-amber-700 list-disc pl-4 space-y-0.5">{s.against.map((r, i) => <li key={i}>Against: {r}</li>)}</ul>
          )}
        </div>
        {!readOnly && !editing && (
          <div className="flex gap-1 shrink-0">
            <button type="button" onClick={() => onChange({ ...s, decision: s.decision === 'accepted' ? 'pending' : 'accepted' })}
              className={`px-2.5 py-1 text-xs rounded border ${s.decision === 'accepted' ? 'bg-green-600 text-white border-green-600' : 'border-green-600 text-green-700 hover:bg-green-50'}`}>
              {s.decision === 'accepted' ? '✓ Accepted' : 'Accept'}
            </button>
            <button type="button" onClick={() => setEditing(true)} className="px-2.5 py-1 text-xs rounded border border-gray-300 text-gray-700 hover:bg-gray-50">Edit</button>
            {onRemove ? (
              <button type="button" onClick={onRemove} className="px-2.5 py-1 text-xs rounded border border-gray-300 text-gray-600 hover:bg-gray-50">Remove</button>
            ) : (
              <button type="button" onClick={() => onChange({ ...s, decision: s.decision === 'rejected' ? 'pending' : 'rejected' })}
                className={`px-2.5 py-1 text-xs rounded border ${s.decision === 'rejected' ? 'bg-gray-600 text-white border-gray-600' : 'border-gray-300 text-gray-600 hover:bg-gray-50'}`}>
                {s.decision === 'rejected' ? 'Rejected' : 'Reject'}
              </button>
            )}
          </div>
        )}
      </div>
    </li>
  );
};

export const SuggestionReview: React.FC<{
  suggestions: Suggestion[];
  onChange: (next: Suggestion[]) => void;
  readOnly?: boolean;
  kinds?: Suggestion['kind'][];
}> = ({ suggestions, onChange, readOnly, kinds = ['differential', 'investigation', 'treatment'] }) => {
  const [adding, setAdding] = useState<Record<string, string>>({});
  const update = (s: Suggestion) => onChange(suggestions.map(x => (x.id === s.id ? s : x)));
  const add = (kind: Suggestion['kind']) => {
    const text = (adding[kind] || '').trim();
    if (!text) return;
    onChange([...suggestions, { id: `manual:${kind}:${Date.now()}`, kind, text, reasons: [], source: 'rules', decision: 'accepted' }]);
    setAdding(a => ({ ...a, [kind]: '' }));
  };

  return (
    <div className="space-y-5">
      {kinds.map(kind => {
        const list = suggestions.filter(s => s.kind === kind)
          .sort((a, b) => Number(b.decision === 'accepted') - Number(a.decision === 'accepted') || Number(a.decision === 'rejected') - Number(b.decision === 'rejected'));
        const accepted = list.filter(s => s.decision === 'accepted').length;
        return (
          <div key={kind}>
            <h4 className="text-sm font-semibold text-gray-800 mb-2">
              {KIND_TITLES[kind]} <span className="font-normal text-gray-500">· {accepted} accepted of {list.length}</span>
            </h4>
            {list.length === 0 && <p className="text-xs text-gray-500 mb-2">No suggestions yet — complete more of the history and examination, or add your own.</p>}
            <ul className="space-y-2">
              {list.map(s => (
                <SuggestionRow key={s.id} s={s} readOnly={readOnly} onChange={update}
                  onRemove={s.id.startsWith('manual:') ? () => onChange(suggestions.filter(x => x.id !== s.id)) : undefined} />
              ))}
            </ul>
            {!readOnly && (
              <div className="flex gap-2 mt-2">
                <input className="flex-1 rounded-lg border border-gray-300 px-2.5 py-1.5 text-sm" placeholder={`Add your own ${kind === 'differential' ? 'diagnosis' : kind}…`}
                  value={adding[kind] || ''} onChange={e => setAdding(a => ({ ...a, [kind]: e.target.value }))}
                  onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); add(kind); } }} />
                <button type="button" onClick={() => add(kind)} className="px-3 py-1.5 text-sm rounded-lg bg-gray-800 text-white">Add</button>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
};
