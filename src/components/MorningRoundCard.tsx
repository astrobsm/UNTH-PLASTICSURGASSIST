import React, { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Sunrise, CheckCircle2, AlertTriangle, Clock, XCircle, FolderX, Loader2 } from 'lucide-react';
import { apiClient } from '../services/apiClient';
import { useAuthStore } from '../store/authStore';
import { HO_ROUND_WINDOW } from '../config/psUnits';

type Status = 'done' | 'no_folder' | 'late' | 'missed' | 'pending';
interface ChecklistItem {
  patient_id: string; name: string; hospital_number: string | null; ward: string | null; bed: string | null;
  status: Status; documented_at: string | null;
}
interface Summary { expected: number; done: number; no_folder: number; late: number; missed: number; pending: number }
interface Checklist { day: string; window: { start: string; end: string; state: 'before' | 'open' | 'closed' }; items: ChecklistItem[]; summary: Summary }
interface UnitHO { ho_id: string; name: string; unit_name: string | null; summary: Summary }

const STATUS_META: Record<Status, { label: string; cls: string; icon: React.ReactNode }> = {
  done:      { label: 'Done',            cls: 'bg-green-100 text-green-800',  icon: <CheckCircle2 className="h-3.5 w-3.5" /> },
  no_folder: { label: 'Folder not confirmed', cls: 'bg-amber-100 text-amber-800', icon: <FolderX className="h-3.5 w-3.5" /> },
  late:      { label: 'Late',            cls: 'bg-orange-100 text-orange-800', icon: <Clock className="h-3.5 w-3.5" /> },
  missed:    { label: 'Missed',          cls: 'bg-red-100 text-red-800',      icon: <XCircle className="h-3.5 w-3.5" /> },
  pending:   { label: 'To do',           cls: 'bg-gray-100 text-gray-700',    icon: <AlertTriangle className="h-3.5 w-3.5" /> },
};
const SUPERVISOR_ROLES = ['admin', 'super_admin', 'consultant', 'senior_registrar', 'registrar', 'junior_registrar'];

/**
 * House officers' morning round (07:00–09:00). A house officer sees today's
 * patients and what is still to document; consultants and residents see each
 * house officer's tally. Counts towards house officers' performance.
 */
export default function MorningRoundCard() {
  const { user } = useAuthStore();
  const isHO = user?.role === 'house_officer';
  const isSupervisor = SUPERVISOR_ROLES.includes(user?.role || '');
  const [mine, setMine] = useState<Checklist | null>(null);
  const [hos, setHos] = useState<UnitHO[] | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    try {
      if (isHO) setMine(await apiClient.get('/ward-rounds?action=morning-checklist', { freshRead: true }) as any);
      if (isSupervisor) setHos(((await apiClient.get('/ward-rounds?action=morning-units', { freshRead: true })) as any)?.house_officers || []);
    } catch { /* offline — keep last */ }
    finally { setLoading(false); }
  }, [isHO, isSupervisor]);

  useEffect(() => {
    if (!isHO && !isSupervisor) { setLoading(false); return; }
    load();
    // Every minute, and whenever the tab comes back into view, so the tally is live.
    const t = setInterval(load, 60000);
    const onVisible = () => { if (document.visibilityState === 'visible') load(); };
    document.addEventListener('visibilitychange', onVisible);
    return () => { clearInterval(t); document.removeEventListener('visibilitychange', onVisible); };
  }, [load, isHO, isSupervisor]);

  if (!isHO && !isSupervisor) return null;
  if (loading) {
    return <div className="card p-4 sm:p-6 text-sm text-gray-500 flex items-center gap-2"><Loader2 className="h-4 w-4 animate-spin" /> Loading morning round…</div>;
  }

  const header = (extra?: React.ReactNode) => (
    <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
      <h3 className="text-base sm:text-lg font-semibold text-clinical-dark flex items-center gap-2">
        <Sunrise className="h-5 w-5 text-amber-500" /> House officers' morning round
        <span className="text-sm font-normal text-gray-500">{HO_ROUND_WINDOW.startTime} – {HO_ROUND_WINDOW.endTime}</span>
      </h3>
      {extra}
    </div>
  );

  return (
    <div className="card p-4 sm:p-6 space-y-4">
      {isHO && mine && (
        <div>
          {header(
            <span className={`text-xs px-2 py-1 rounded-full ${mine.window.state === 'open' ? 'bg-green-100 text-green-800' : mine.window.state === 'before' ? 'bg-blue-100 text-blue-800' : 'bg-gray-100 text-gray-700'}`}>
              {mine.window.state === 'open' ? 'Window open now' : mine.window.state === 'before' ? 'Opens at 7:00 AM' : 'Window closed for today'}
            </span>
          )}
          <p className="text-xs text-gray-600 mb-2">
            Round on each patient, document it here (House Officers Round) and in the folder, and tick the folder box.
            {' '}{mine.summary.done}/{mine.summary.expected} done today.
          </p>
          {mine.items.length === 0 ? (
            <p className="text-sm text-gray-500">No patients are assigned to you today.</p>
          ) : (
            <ul className="divide-y divide-gray-100">
              {mine.items.map(i => {
                const m = STATUS_META[i.status];
                return (
                  <li key={i.patient_id} className="py-2 flex items-center gap-2">
                    <div className="flex-1 min-w-0">
                      <div className="font-medium text-clinical-dark truncate">{i.name}</div>
                      <div className="text-xs text-gray-500">{[i.hospital_number, i.ward && `${i.ward}${i.bed ? `, Bed ${i.bed}` : ''}`].filter(Boolean).join(' · ')}
                        {i.documented_at && <> · documented {new Date(i.documented_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</>}
                      </div>
                    </div>
                    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs ${m.cls}`}>{m.icon}{m.label}</span>
                    {i.status !== 'done' && (
                      <Link to={`/ward-rounds?patient=${encodeURIComponent(i.patient_id)}`} className="text-xs text-primary-700 hover:underline whitespace-nowrap">
                        {i.status === 'no_folder' ? 'Open rounds' : 'Document'}
                      </Link>
                    )}
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      )}

      {isSupervisor && hos && (
        <div>
          {!isHO && header()}
          {hos.length === 0 ? (
            <p className="text-sm text-gray-500">No house officers have patients assigned today.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-gray-50 text-left text-gray-600">
                    <th className="px-2 py-1.5 font-medium">House officer</th>
                    <th className="px-2 py-1.5 font-medium">Unit</th>
                    <th className="px-2 py-1.5 font-medium text-center">Patients</th>
                    <th className="px-2 py-1.5 font-medium text-center">Done</th>
                    <th className="px-2 py-1.5 font-medium text-center">No folder</th>
                    <th className="px-2 py-1.5 font-medium text-center">Late</th>
                    <th className="px-2 py-1.5 font-medium text-center">Missed / to do</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {hos.map(h => (
                    <tr key={h.ho_id}>
                      <td className="px-2 py-1.5 font-medium">{h.name}</td>
                      <td className="px-2 py-1.5 text-gray-600">{h.unit_name || '—'}</td>
                      <td className="px-2 py-1.5 text-center">{h.summary.expected}</td>
                      <td className="px-2 py-1.5 text-center text-green-700 font-medium">{h.summary.done}</td>
                      <td className="px-2 py-1.5 text-center text-amber-700">{h.summary.no_folder}</td>
                      <td className="px-2 py-1.5 text-center text-orange-700">{h.summary.late}</td>
                      <td className="px-2 py-1.5 text-center text-red-700">{h.summary.missed + h.summary.pending}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
