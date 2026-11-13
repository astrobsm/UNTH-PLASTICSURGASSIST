import React, { useEffect, useMemo, useState } from 'react';
import { BellRing, CheckCircle, Copy, Loader2, MessageCircle, X } from 'lucide-react';
import { getChaseDigest, recordChaseDigest, type ChaseDigestPerson } from '../services/consultsModuleService';
import { normalizeForWhatsApp } from './PhoneActions';

/**
 * Chase consult responses — ONE message per person. Every senior registrar,
 * registrar and house officer on call for open consults gets a single WhatsApp
 * message listing all of them (emergencies first, longest waiting first),
 * sent with one press. The press also logs the chase on every consult listed
 * and pushes an in-app notification to that person.
 *
 * With `focusConsultId`, only the team of that consult is shown — but each
 * message still lists all of that person's open consults.
 */
const ConsultChaseModal: React.FC<{ focusConsultId?: number; onClose: () => void }> = ({ focusConsultId, onClose }) => {
  const [people, setPeople] = useState<ChaseDigestPerson[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [sent, setSent] = useState<Record<string, boolean>>({});
  const [open, setOpen] = useState<string | null>(null);
  const [showAll, setShowAll] = useState(!focusConsultId);

  useEffect(() => {
    let live = true;
    getChaseDigest()
      .then(d => { if (!live) return; setPeople(d.people); setDrafts(Object.fromEntries(d.people.map(p => [p.id, p.message]))); })
      .catch((e: any) => live && setError(e?.message || 'Could not load the consults awaiting attention'));
    return () => { live = false; };
  }, []);

  const shown = useMemo(() => (people || []).filter(p => showAll || !focusConsultId || p.consults.some(c => c.id === focusConsultId)), [people, showAll, focusConsultId]);

  const chase = async (p: ChaseDigestPerson) => {
    const message = (drafts[p.id] ?? p.message).trim();
    if (p.phone) window.open(`https://wa.me/${normalizeForWhatsApp(p.phone)}?text=${encodeURIComponent(message)}`, '_blank', 'noopener');
    try {
      await recordChaseDigest(p.id, message);
      setSent(s => ({ ...s, [p.id]: true }));
    } catch (e: any) {
      setError(`${p.phone ? 'WhatsApp opened, but the' : 'The'} chase was not recorded: ${e?.message || 'error'}`);
    }
  };

  const countText = (p: ChaseDigestPerson) =>
    (['emergency', 'urgent', 'routine'] as const).filter(u => p.counts[u]).map(u => `${p.counts[u]} ${u}`).join(' · ');

  return (
    <div className="fixed inset-0 z-[60] bg-black/40 flex items-end sm:items-center justify-center p-0 sm:p-4" onClick={onClose}>
      <div className="bg-white w-full sm:max-w-2xl rounded-t-xl sm:rounded-xl max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between px-4 py-3 border-b sticky top-0 bg-white z-10">
          <h2 className="font-semibold flex items-center gap-2"><BellRing className="w-5 h-5 text-amber-600" /> Chase consult responses</h2>
          <button onClick={onClose} aria-label="Close" className="p-1 rounded hover:bg-gray-100"><X className="w-5 h-5" /></button>
        </div>
        <div className="p-4 space-y-3">
          <p className="text-xs text-gray-600">
            One message per person, listing every open consult they were on call for. One press opens WhatsApp with the whole list,
            records the chase on each consult and sends them an in-app notification.
          </p>
          {focusConsultId && people && (
            <label className="flex items-center gap-2 text-xs text-gray-700">
              <input type="checkbox" checked={showAll} onChange={e => setShowAll(e.target.checked)} />
              Show everyone with open consults (not only this consult's team)
            </label>
          )}
          {error && <div className="bg-red-50 text-red-700 px-3 py-2 rounded text-sm">{error}</div>}
          {!people && !error && <div className="py-8 text-center"><Loader2 className="w-6 h-6 animate-spin mx-auto text-gray-400" /></div>}
          {people && shown.length === 0 && (
            <div className="bg-gray-50 text-gray-600 px-3 py-2 rounded text-sm">No senior registrar, registrar or house officer has open consults to chase.</div>
          )}
          {shown.map(p => (
            <div key={p.id} className="border rounded-lg">
              <div className="flex flex-col sm:flex-row sm:items-center gap-2 p-3">
                <button className="flex-1 text-left min-w-0" onClick={() => setOpen(open === p.id ? null : p.id)}>
                  <div className="text-sm font-medium truncate">{p.name || 'Name not recorded'} <span className="text-xs text-gray-500">· {p.roles.join(' / ')}</span></div>
                  <div className="text-xs text-gray-500">
                    {p.consults.length} consult{p.consults.length === 1 ? '' : 's'} — {countText(p)}
                    {p.last_chased_at && ` · last chased ${new Date(p.last_chased_at).toLocaleString()}`}
                    {!p.phone && ' · no phone on file'} · tap to view/edit
                  </div>
                </button>
                <div className="flex items-center gap-2 shrink-0">
                  {sent[p.id] && <span className="text-xs text-green-700 flex items-center gap-1"><CheckCircle className="w-3.5 h-3.5" /> Chased</span>}
                  <button onClick={() => chase(p)}
                    className="flex items-center gap-1 px-3 py-1.5 text-sm text-white rounded-lg bg-amber-600 hover:bg-amber-700">
                    {p.phone ? <MessageCircle className="w-4 h-4" /> : <BellRing className="w-4 h-4" />}
                    {p.phone ? 'Chase on WhatsApp' : 'Chase in app'}
                  </button>
                  <button onClick={() => navigator.clipboard?.writeText(drafts[p.id] ?? p.message).catch(() => {})}
                    title="Copy message" className="p-1.5 rounded-lg bg-gray-100 hover:bg-gray-200"><Copy className="w-4 h-4" /></button>
                </div>
              </div>
              {open === p.id && (
                <div className="border-t p-3">
                  <textarea value={drafts[p.id] ?? p.message} onChange={e => setDrafts(d => ({ ...d, [p.id]: e.target.value }))}
                    rows={Math.min(18, (drafts[p.id] ?? p.message).split('\n').length + 1)}
                    className="w-full text-xs border rounded-lg p-2 font-mono" />
                  <p className="text-xs text-gray-500 mt-1">Patients are named by initials, hospital number and bed only.</p>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default ConsultChaseModal;
