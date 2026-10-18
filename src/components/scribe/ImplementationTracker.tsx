/**
 * The approved plan, item by item, with where each stands. Every item is
 * clickable to log its implementation (who / when / where come with it).
 */
import { useMemo, useState } from 'react';
import { ChevronRight, MapPin, Pill, FlaskConical, Scissors, HeartHandshake } from 'lucide-react';
import type { ScribePlan } from '../../services/scribe/scribePlan';
import { flattenPlan, itemState, type LoggedAction, type PlanItem } from '../../services/scribe/planItems';
import { ImplementationDialog } from './ImplementationDialog';

const KIND_ICON = { medication: Pill, investigation: FlaskConical, procedure: Scissors, care: HeartHandshake };
const TONE = {
  none: 'bg-gray-100 text-gray-700', progress: 'bg-amber-100 text-amber-900',
  done: 'bg-green-100 text-green-800', problem: 'bg-red-100 text-red-800',
};

export function ImplementationTracker({ planId, patientId, plan, actions, canLog, defaultPlace, onChanged }: {
  planId: number; patientId: string; plan: ScribePlan; actions: LoggedAction[];
  canLog: boolean; defaultPlace?: string; onChanged: () => void;
}) {
  const items = useMemo(() => flattenPlan(plan).filter(i => i.actionable), [plan]);
  const byKey = useMemo(() => {
    const m = new Map<string, LoggedAction[]>();
    for (const a of actions) { if (!m.has(a.item_key)) m.set(a.item_key, []); m.get(a.item_key)!.push(a); }
    return m;
  }, [actions]);
  const [open, setOpen] = useState<PlanItem | null>(null);
  const [filter, setFilter] = useState<'all' | 'open' | 'done'>('all');

  const states = items.map(i => ({ item: i, st: itemState(byKey.get(i.key) || []) }));
  const done = states.filter(s => s.st.tone === 'done').length;
  const groups = useMemo(() => {
    const g = new Map<string, typeof states>();
    for (const s of states) {
      if (filter === 'open' && s.st.tone === 'done') continue;
      if (filter === 'done' && s.st.tone !== 'done') continue;
      if (!g.has(s.item.group)) g.set(s.item.group, []);
      g.get(s.item.group)!.push(s);
    }
    return [...g.entries()];
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [states.map(s => s.st.label).join('|'), filter, items]);

  return (
    <div className="space-y-3">
      <div>
        <div className="flex items-center justify-between text-sm">
          <span className="font-semibold text-gray-900">Implementation — {done} of {items.length} done</span>
          <span className="flex gap-1 text-xs">
            {(['all', 'open', 'done'] as const).map(f => (
              <button key={f} onClick={() => setFilter(f)} className={`px-2 py-0.5 rounded-full border ${filter === f ? 'bg-green-700 text-white border-green-700' : ''}`}>{f}</button>
            ))}
          </span>
        </div>
        <div className="mt-1 h-2 bg-gray-100 rounded-full overflow-hidden">
          <div className="h-full bg-green-600" style={{ width: `${items.length ? (done / items.length) * 100 : 0}%` }} />
        </div>
      </div>

      {groups.map(([group, rows]) => (
        <div key={group} className="border rounded-lg">
          <p className="px-3 py-1.5 bg-gray-50 border-b text-xs font-semibold text-gray-700">{group}</p>
          <ul className="divide-y">
            {rows.map(({ item, st }) => {
              const Icon = KIND_ICON[item.kind];
              return (
                <li key={item.key}>
                  <button
                    onClick={() => canLog && setOpen(item)} disabled={!canLog}
                    className="w-full text-left px-3 py-2 flex items-start gap-2 hover:bg-green-50 disabled:hover:bg-transparent">
                    <Icon className="w-4 h-4 mt-0.5 text-gray-500 shrink-0" />
                    <span className="flex-1 min-w-0">
                      <span className="text-sm text-gray-900">
                        {item.priority === 'urgent' && <span className="mr-1 text-[10px] font-bold text-red-700">URGENT</span>}
                        {item.text}
                      </span>
                      {st.last && (
                        <span className="block text-[11px] text-gray-500">
                          {st.last.user_name || 'Unknown'} · {new Date(st.last.logged_at).toLocaleString()}
                          <span className="inline-flex items-center gap-0.5 ml-1"><MapPin className="w-3 h-3" />{st.last.location_label || '—'}</span>
                          {st.last.prescription ? ` · ${st.last.prescription.drug} ${st.last.prescription.dose}` : ''}
                          {st.last.result ? ` · ${[st.last.result.value, st.last.result.unit].filter(Boolean).join(' ') || 'result attached'}` : ''}
                        </span>
                      )}
                    </span>
                    <span className={`text-[11px] px-2 py-0.5 rounded-full whitespace-nowrap ${TONE[st.tone]}`}>{st.label}</span>
                    <ChevronRight className="w-4 h-4 text-gray-400 shrink-0 mt-0.5" />
                  </button>
                </li>
              );
            })}
          </ul>
        </div>
      ))}

      {open && (
        <ImplementationDialog
          planId={planId} patientId={patientId} item={open}
          actions={byKey.get(open.key) || []} defaultPlace={defaultPlace}
          onSaved={onChanged} onClose={() => setOpen(null)}
        />
      )}
    </div>
  );
}
