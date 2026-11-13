import React, { useEffect, useState } from 'react';
import { BellRing, CheckCircle, Copy, Loader2, MessageCircle, X } from 'lucide-react';
import {
  getConsultChase, recordConsultChase, STATUS_META,
  type ConsultChasePreview, type ConsultChaseRecipient,
} from '../services/consultsModuleService';
import { normalizeForWhatsApp } from './PhoneActions';

/**
 * Chase a received consult: call the attention of the on-call senior
 * registrar, registrar and house officer recorded on it. Each press opens
 * WhatsApp with an editable message, logs the chase on the consult and pushes
 * it to that person inside the app.
 */
const ConsultChaseModal: React.FC<{ consultId: number; onClose: () => void }> = ({ consultId, onClose }) => {
  const [data, setData] = useState<ConsultChasePreview | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [sent, setSent] = useState<Record<string, boolean>>({});
  const [open, setOpen] = useState<string | null>(null);

  useEffect(() => {
    let live = true;
    getConsultChase(consultId)
      .then(d => { if (!live) return; setData(d); setDrafts(Object.fromEntries(d.recipients.map(r => [r.role, r.message]))); })
      .catch((e: any) => live && setError(e?.message || 'Could not load the on-call team'));
    return () => { live = false; };
  }, [consultId]);

  const chase = async (r: ConsultChaseRecipient) => {
    const message = (drafts[r.role] ?? r.message).trim();
    if (r.phone) window.open(`https://wa.me/${normalizeForWhatsApp(r.phone)}?text=${encodeURIComponent(message)}`, '_blank', 'noopener');
    try {
      await recordConsultChase(consultId, r.role, message);
      setSent(s => ({ ...s, [r.role]: true }));
    } catch (e: any) {
      setError(`${r.phone ? 'WhatsApp opened, but the' : 'The'} chase was not recorded: ${e?.message || 'error'}`);
    }
  };

  return (
    <div className="fixed inset-0 z-[60] bg-black/40 flex items-end sm:items-center justify-center p-0 sm:p-4" onClick={onClose}>
      <div className="bg-white w-full sm:max-w-xl rounded-t-xl sm:rounded-xl max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between px-4 py-3 border-b sticky top-0 bg-white">
          <h2 className="font-semibold flex items-center gap-2"><BellRing className="w-5 h-5 text-amber-600" /> Chase consult response</h2>
          <button onClick={onClose} aria-label="Close" className="p-1 rounded hover:bg-gray-100"><X className="w-5 h-5" /></button>
        </div>
        <div className="p-4 space-y-3">
          {error && <div className="bg-red-50 text-red-700 px-3 py-2 rounded text-sm">{error}</div>}
          {!data && !error && <div className="py-8 text-center"><Loader2 className="w-6 h-6 animate-spin mx-auto text-gray-400" /></div>}
          {data && (
            <>
              <p className="text-xs text-gray-600">
                {data.consult_ref} · {STATUS_META[data.status]?.label || data.status}. The chase opens WhatsApp with the message,
                logs it on the consult and sends the person an in-app notification.
              </p>
              {!data.open && <div className="bg-gray-50 text-gray-600 px-3 py-2 rounded text-sm">This consult is closed — there is nothing to chase.</div>}
              {data.open && data.recipients.length === 0 && (
                <div className="bg-amber-50 text-amber-800 px-3 py-2 rounded text-sm">
                  No on-call team is recorded on this consult (the call roster had no one for that day).
                </div>
              )}
              {data.open && data.recipients.map(r => (
                <div key={r.role} className="border rounded-lg">
                  <div className="flex flex-col sm:flex-row sm:items-center gap-2 p-3">
                    <button className="flex-1 text-left min-w-0" onClick={() => setOpen(open === r.role ? null : r.role)}>
                      <div className="text-sm font-medium truncate">{r.name || 'Name not recorded'}</div>
                      <div className="text-xs text-gray-500">{r.label}{r.phone ? '' : ' · no phone on file'} · tap to view/edit message</div>
                    </button>
                    <div className="flex items-center gap-2 shrink-0">
                      {sent[r.role] && <span className="text-xs text-green-700 flex items-center gap-1"><CheckCircle className="w-3.5 h-3.5" /> Chased</span>}
                      <button onClick={() => chase(r)} disabled={!r.phone && !r.id}
                        className="flex items-center gap-1 px-3 py-1.5 text-sm text-white rounded-lg bg-amber-600 hover:bg-amber-700 disabled:opacity-50">
                        {r.phone ? <MessageCircle className="w-4 h-4" /> : <BellRing className="w-4 h-4" />}
                        {r.phone ? 'Chase on WhatsApp' : 'Chase in app'}
                      </button>
                      <button onClick={() => navigator.clipboard?.writeText(drafts[r.role] ?? r.message).catch(() => {})}
                        title="Copy message" className="p-1.5 rounded-lg bg-gray-100 hover:bg-gray-200"><Copy className="w-4 h-4" /></button>
                    </div>
                  </div>
                  {open === r.role && (
                    <div className="border-t p-3">
                      <textarea value={drafts[r.role] ?? r.message} onChange={e => setDrafts(d => ({ ...d, [r.role]: e.target.value }))}
                        rows={Math.min(14, (drafts[r.role] ?? r.message).split('\n').length + 1)}
                        className="w-full text-sm border rounded-lg p-2 font-mono" />
                      <p className="text-xs text-gray-500 mt-1">The patient is named by initials, hospital number and bed only.</p>
                    </div>
                  )}
                </div>
              ))}
              {data.history.length > 0 && (
                <div>
                  <h3 className="text-xs font-semibold text-gray-700 mb-1">Earlier chases</h3>
                  <ul className="text-xs text-gray-600 space-y-0.5">
                    {data.history.map(h => (
                      <li key={h.id}>{new Date(h.sent_at || h.created_at).toLocaleString()} — {h.to_name}{h.sent_by_name ? `, by ${h.sent_by_name}` : ''}</li>
                    ))}
                  </ul>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default ConsultChaseModal;
