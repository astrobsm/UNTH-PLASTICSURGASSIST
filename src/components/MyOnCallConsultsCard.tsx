import React, { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Stethoscope, Loader2, ChevronRight } from 'lucide-react';
import {
  listReceived, STATUS_META, URGENCY_META,
  type ReceivedConsult,
} from '../services/consultsModuleService';
import ConsultDetailDrawer from './ConsultDetailDrawer';

/**
 * Open consults routed to the signed-in user — the consultant, senior
 * registrar, registrar and house officer who were on call when each consult
 * arrived. Shown on the Dashboard; opening one goes straight to its workflow.
 * Renders nothing when the user has none, so off-call staff see no empty card.
 */
const MyOnCallConsultsCard: React.FC = () => {
  const [items, setItems] = useState<ReceivedConsult[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [openId, setOpenId] = useState<number | null>(null);

  const load = useCallback(async () => {
    try {
      const r = await listReceived({ mine: true, open: true, per_page: 10 });
      setItems(r.consults); setTotal(r.total);
    } catch {
      // Offline or signed out — keep whatever was last shown.
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
    const timer = setInterval(load, 60000);
    return () => clearInterval(timer);
  }, [load]);

  if (loading) {
    return (
      <div className="card p-4 sm:p-6 text-sm text-gray-500 flex items-center gap-2">
        <Loader2 className="h-4 w-4 animate-spin" /> Loading your consults…
      </div>
    );
  }
  if (items.length === 0) return null;

  return (
    <div className="card p-4 sm:p-6">
      <div className="flex items-center justify-between gap-2 mb-3">
        <h3 className="text-base sm:text-lg font-semibold text-clinical-dark flex items-center gap-2">
          <Stethoscope className="h-5 w-5 text-primary-600" />
          My on-call consults
          <span className="text-sm font-normal text-gray-500">({total} open)</span>
        </h3>
        <Link to="/consults" className="text-xs text-primary-700 hover:underline">All consults</Link>
      </div>
      <ul className="divide-y divide-gray-100">
        {items.map(c => {
          const sm = STATUS_META[c.status] || STATUS_META.received;
          const um = URGENCY_META[c.urgency] || URGENCY_META.routine;
          return (
            <li key={c.id}>
              <button onClick={() => setOpenId(c.id)} className="w-full text-left py-2 flex items-center gap-2 hover:bg-primary-50/50 rounded px-1">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-medium text-clinical-dark">{c.patient_name}</span>
                    <span className={`px-2 py-0.5 rounded-full text-[11px] font-medium border ${um.color}`}>{um.label}</span>
                    <span className={`px-2 py-0.5 rounded-full text-[11px] font-medium ${sm.bg} ${sm.color}`}>{sm.label}</span>
                  </div>
                  <div className="text-xs text-gray-500 truncate">
                    {c.referring_unit} · {c.ward || 'ward —'} · {new Date(c.created_at).toLocaleString()}
                    {c.oncall_team?.consultant?.name && <> · Consultant: {c.oncall_team.consultant.name}</>}
                  </div>
                </div>
                <ChevronRight className="h-4 w-4 text-gray-400 flex-shrink-0" />
              </button>
            </li>
          );
        })}
      </ul>
      {openId !== null && (
        <ConsultDetailDrawer consultId={openId} onClose={() => setOpenId(null)} onChanged={load} />
      )}
    </div>
  );
};

export default MyOnCallConsultsCard;
