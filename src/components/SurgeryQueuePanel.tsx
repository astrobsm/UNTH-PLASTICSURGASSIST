// Surgery Scheduling Queue panel — Phase 2 integration.
// Shows patients flagged for surgery planning with a pre-op checklist
// (pre-op checklist, consent, investigations, anaesthetic review, theatre booking, admission).
import { useState, useEffect, useCallback } from 'react';
import { Scissors, RefreshCw, CheckCircle2, Circle, Trash2, ChevronDown, ChevronUp } from 'lucide-react';
import toast from 'react-hot-toast';
import {
  clinicConfigService, SurgeryQueueEntry, SURGERY_CHECKLIST_LABELS,
} from '../services/clinicConfigService';

const STATUS_BADGE: Record<string, string> = {
  pending: 'bg-gray-100 text-gray-700',
  in_progress: 'bg-blue-100 text-blue-800',
  ready: 'bg-green-100 text-green-800',
  scheduled: 'bg-purple-100 text-purple-800',
  cancelled: 'bg-red-100 text-red-700',
};

export default function SurgeryQueuePanel({ refreshKey }: { refreshKey?: number }) {
  const [entries, setEntries] = useState<SurgeryQueueEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setEntries(await clinicConfigService.getSurgeryQueue());
    } catch {
      setEntries([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load, refreshKey]);

  const toggleItem = async (entry: SurgeryQueueEntry, key: string) => {
    const checklist = { ...entry.checklist, [key]: !entry.checklist[key] };
    setEntries(es => es.map(e => e.id === entry.id ? { ...e, checklist } : e));
    try {
      const updated = await clinicConfigService.updateSurgeryQueueEntry(entry.id, { checklist });
      setEntries(es => es.map(e => e.id === entry.id ? updated : e));
    } catch (e: any) {
      toast.error(`Update failed: ${e.message}`);
      load();
    }
  };

  const setStatus = async (entry: SurgeryQueueEntry, status: string) => {
    try {
      const updated = await clinicConfigService.updateSurgeryQueueEntry(entry.id, { status });
      setEntries(es => es.map(e => e.id === entry.id ? updated : e));
    } catch (e: any) { toast.error(`Update failed: ${e.message}`); }
  };

  const remove = async (entry: SurgeryQueueEntry) => {
    if (!confirm('Remove this patient from the surgery queue?')) return;
    try {
      await clinicConfigService.removeSurgeryQueueEntry(entry.id);
      setEntries(es => es.filter(e => e.id !== entry.id));
    } catch (e: any) { toast.error(`Remove failed: ${e.message}`); }
  };

  if (!loading && entries.length === 0) return null;

  return (
    <div className="bg-white rounded-lg border border-gray-200 mb-4">
      <button onClick={() => setExpanded(e => !e)} className="w-full flex items-center justify-between px-4 py-3 text-left">
        <div className="flex items-center gap-2">
          <Scissors className="w-4 h-4 text-orange-600" />
          <span className="text-sm font-semibold text-gray-800">Surgery Scheduling Queue</span>
          {entries.length > 0 && (
            <span className="px-2 py-0.5 rounded-full bg-orange-100 text-orange-700 text-xs font-semibold">{entries.length}</span>
          )}
        </div>
        <div className="flex items-center gap-2">
          <span onClick={(e) => { e.stopPropagation(); load(); }} className="p-1 text-gray-400 hover:text-gray-600 cursor-pointer">
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </span>
          {expanded ? <ChevronUp className="w-4 h-4 text-gray-400" /> : <ChevronDown className="w-4 h-4 text-gray-400" />}
        </div>
      </button>

      {expanded && (
        <div className="border-t border-gray-100 divide-y divide-gray-100">
          {entries.map(entry => {
            const items = Object.keys(SURGERY_CHECKLIST_LABELS);
            const done = items.filter(k => entry.checklist[k]).length;
            return (
              <div key={entry.id} className="p-4">
                <div className="flex items-start justify-between flex-wrap gap-2 mb-2">
                  <div>
                    <p className="font-semibold text-gray-900">{entry.patient_name || entry.patient_number}</p>
                    <p className="text-xs text-gray-500">{entry.appointment_date} &middot; {done}/{items.length} steps complete</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <select value={entry.status} onChange={e => setStatus(entry, e.target.value)}
                      className={`text-xs font-semibold rounded-full px-2.5 py-1 border-0 ${STATUS_BADGE[entry.status] || ''}`}>
                      <option value="pending">Pending</option>
                      <option value="in_progress">In Progress</option>
                      <option value="ready">Ready</option>
                      <option value="scheduled">Scheduled</option>
                    </select>
                    <button onClick={() => remove(entry)} className="text-red-500 hover:text-red-700 p-1">
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-1.5">
                  {items.map(key => (
                    <button key={key} onClick={() => toggleItem(entry, key)}
                      className={`flex items-center gap-1.5 px-2 py-1.5 rounded-md text-xs text-left transition-colors ${
                        entry.checklist[key] ? 'bg-green-50 text-green-800' : 'bg-gray-50 text-gray-600 hover:bg-gray-100'
                      }`}>
                      {entry.checklist[key]
                        ? <CheckCircle2 className="w-3.5 h-3.5 text-green-600 flex-shrink-0" />
                        : <Circle className="w-3.5 h-3.5 text-gray-400 flex-shrink-0" />}
                      {SURGERY_CHECKLIST_LABELS[key]}
                    </button>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
