/**
 * Ward census — create a link for the doctors covering the wards, share it,
 * then review what they flagged and discharge in bulk, so the admission list
 * matches the patients actually in the beds.
 */
import { useCallback, useEffect, useMemo, useState } from 'react';
import { CheckCircle2, ClipboardCheck, Copy, Link2, Loader2, LogOut, RefreshCw, Share2, XCircle, MessageCircle } from 'lucide-react';
import toast from 'react-hot-toast';
import { wardCensusService, reasonLabel, type CensusReport, type CensusRound } from '../services/wardCensusService';

const clean = (e: any) => String(e?.message || 'Something went wrong').replace(/^\[HTTP \d+\]\s*/, '');

export default function WardCensusPage() {
  const [rounds, setRounds] = useState<CensusRound[] | null>(null);
  const [title, setTitle] = useState(`Ward census — ${new Date().toLocaleDateString()}`);
  const [ward, setWard] = useState('');
  const [days, setDays] = useState(2);
  const [creating, setCreating] = useState(false);
  const [openId, setOpenId] = useState<string | null>(() => new URLSearchParams(window.location.search).get('review'));

  const load = useCallback(async () => {
    try { setRounds((await wardCensusService.list()).rounds); }
    catch (e) { toast.error(clean(e)); setRounds([]); }
  }, []);
  useEffect(() => { void load(); }, [load]);

  const create = async () => {
    setCreating(true);
    try {
      const { round } = await wardCensusService.create({ title, ward: ward.trim() || undefined, days_valid: days });
      toast.success('Census link created');
      await load();
      setOpenId(round.id);
      void share(round);
    } catch (e) { toast.error(clean(e)); }
    finally { setCreating(false); }
  };

  const share = async (r: CensusRound) => {
    const url = wardCensusService.link(r.id);
    const text = `${r.title}: please tick every patient who is no longer on admission and submit — ${url}`;
    try {
      if (navigator.share) { await navigator.share({ title: r.title, text, url }); return; }
    } catch { /* cancelled */ }
    try { await navigator.clipboard.writeText(url); toast.success('Link copied'); } catch { window.prompt('Copy this link', url); }
  };

  return (
    <div className="max-w-5xl mx-auto space-y-4">
      <div>
        <h1 className="text-xl font-bold text-gray-900 flex items-center gap-2"><ClipboardCheck className="w-6 h-6 text-green-700" /> Ward census</h1>
        <p className="text-sm text-gray-600 mt-1">
          Send a link to the doctors covering the wards. They tick the patients who are no longer on admission; you review
          and discharge them in bulk, so the admission list matches the patients in the beds. Staff must be signed in to open the link.
        </p>
      </div>

      <div className="bg-white border rounded-xl p-4 space-y-3">
        <p className="font-semibold text-gray-900">New census link</p>
        <div className="grid gap-2 sm:grid-cols-4">
          <input value={title} onChange={e => setTitle(e.target.value)} className="border rounded-lg px-3 py-2 text-sm sm:col-span-2" placeholder="Title" />
          <input value={ward} onChange={e => setWard(e.target.value)} className="border rounded-lg px-3 py-2 text-sm" placeholder="One ward only (optional)" />
          <select value={days} onChange={e => setDays(Number(e.target.value))} className="border rounded-lg px-3 py-2 text-sm">
            {[1, 2, 3, 7, 14].map(d => <option key={d} value={d}>Open for {d} day{d > 1 ? 's' : ''}</option>)}
          </select>
        </div>
        <button onClick={create} disabled={creating} className="px-4 py-2 bg-green-700 text-white rounded-lg text-sm flex items-center gap-2 disabled:opacity-50">
          {creating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Link2 className="w-4 h-4" />} Create and share link
        </button>
      </div>

      <div className="bg-white border rounded-xl">
        <div className="px-4 py-3 border-b flex items-center justify-between">
          <p className="font-semibold text-gray-900">Census links</p>
          <button onClick={load} className="text-sm text-gray-600 flex items-center gap-1"><RefreshCw className="w-4 h-4" /> Refresh</button>
        </div>
        {rounds === null ? <p className="p-4 text-sm text-gray-500 flex items-center gap-2"><Loader2 className="w-4 h-4 animate-spin" /> Loading…</p>
          : rounds.length === 0 ? <p className="p-4 text-sm text-gray-500">No census yet.</p>
          : (
          <ul className="divide-y">
            {rounds.map(r => {
              const open = r.status === 'open' && (!r.expires_at || new Date(r.expires_at) > new Date());
              return (
                <li key={r.id} className="p-4">
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="font-medium text-gray-900">{r.title}{r.ward_filter ? ` · ${r.ward_filter}` : ''}</p>
                      <p className="text-xs text-gray-500">
                        {open ? `Open until ${r.expires_at ? new Date(r.expires_at).toLocaleString() : '—'}` : 'Closed'} ·
                        {' '}{r.submissions || 0} submission(s) · <strong className="text-amber-700">{r.pending || 0} awaiting review</strong> · {r.discharged || 0} discharged
                      </p>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {open && <button onClick={() => share(r)} className="px-3 py-1.5 border rounded-lg text-sm flex items-center gap-1"><Share2 className="w-4 h-4" /> Share</button>}
                      {open && <a href={`https://wa.me/?text=${encodeURIComponent(`${r.title}: please tick every patient who is no longer on admission and submit — ${wardCensusService.link(r.id)}`)}`} target="_blank" rel="noreferrer" className="px-3 py-1.5 border rounded-lg text-sm flex items-center gap-1 text-green-700"><MessageCircle className="w-4 h-4" /> WhatsApp</a>}
                      {open && <button onClick={async () => { try { await navigator.clipboard.writeText(wardCensusService.link(r.id)); toast.success('Link copied'); } catch { window.prompt('Copy this link', wardCensusService.link(r.id)); } }} className="px-3 py-1.5 border rounded-lg text-sm flex items-center gap-1"><Copy className="w-4 h-4" /> Copy</button>}
                      <button onClick={() => setOpenId(openId === r.id ? null : r.id)} className="px-3 py-1.5 bg-green-700 text-white rounded-lg text-sm">{openId === r.id ? 'Hide review' : 'Review'}</button>
                    </div>
                  </div>
                  {openId === r.id && <Review roundId={r.id} onChanged={load} />}
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}

function Review({ roundId, onChanged }: { roundId: string; onChanged: () => void }) {
  const [data, setData] = useState<Awaited<ReturnType<typeof wardCensusService.review>> | null>(null);
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    try { setData(await wardCensusService.review(roundId)); }
    catch (e) { toast.error(clean(e)); }
  }, [roundId]);
  useEffect(() => { void load(); }, [load]);

  // One row per patient: every report about them, newest first.
  const rows = useMemo(() => {
    const m = new Map<number, CensusReport[]>();
    for (const r of data?.reports || []) { if (!m.has(r.admission_id)) m.set(r.admission_id, []); m.get(r.admission_id)!.push(r); }
    return [...m.entries()].map(([admission_id, reports]) => ({
      admission_id, reports, first: reports[reports.length - 1],
      pending: reports.some(r => r.decision === 'pending') && ['active', 'admitted'].includes(reports[0].admission_status),
    }));
  }, [data]);
  const pendingRows = rows.filter(r => r.pending);
  const decidedRows = rows.filter(r => !r.pending);

  const all = pendingRows.length > 0 && pendingRows.every(r => selected.has(r.admission_id));
  const toggle = (id: number) => setSelected(s => { const n = new Set(s); n.has(id) ? n.delete(id) : n.add(id); return n; });

  const act = async (kind: 'discharge' | 'keep') => {
    const ids = [...selected];
    if (!ids.length) { toast.error('Tick at least one patient'); return; }
    if (kind === 'discharge' && !window.confirm(`Discharge ${ids.length} patient(s)? Each is discharged on the date the doctor said they left, with the reason given. Their team assignments end.`)) return;
    setBusy(true);
    try {
      if (kind === 'discharge') {
        const r = await wardCensusService.discharge(roundId, ids);
        toast.success(`${r.discharged} discharged — ${r.on_admission} now on admission`);
      } else {
        const r = await wardCensusService.keep(roundId, ids);
        toast.success(`${r.kept} kept on admission`);
      }
      setSelected(new Set());
      await load();
      onChanged();
    } catch (e) { toast.error(clean(e)); }
    finally { setBusy(false); }
  };

  if (!data) return <p className="mt-3 text-sm text-gray-500 flex items-center gap-2"><Loader2 className="w-4 h-4 animate-spin" /> Loading review…</p>;

  const flaggedN = pendingRows.length;
  return (
    <div className="mt-4 space-y-3">
      <div className="grid grid-cols-3 gap-2 text-center">
        <div className="rounded-lg bg-gray-50 border p-2"><p className="text-xl font-bold text-gray-900">{data.on_admission}</p><p className="text-xs text-gray-600">listed on admission</p></div>
        <div className="rounded-lg bg-amber-50 border border-amber-200 p-2"><p className="text-xl font-bold text-amber-800">{flaggedN}</p><p className="text-xs text-amber-800">flagged as gone</p></div>
        <div className="rounded-lg bg-green-50 border border-green-200 p-2"><p className="text-xl font-bold text-green-800">{data.on_admission - flaggedN}</p><p className="text-xs text-green-800">actually on admission*</p></div>
      </div>
      <p className="text-[11px] text-gray-500">* if every flag is confirmed. {data.submissions.length} submission(s): {data.submissions.slice(0, 6).map((s: any) => `${s.submitted_by_name || 'Unknown'} (${s.flagged_count} flagged${s.ward ? `, ${s.ward}` : ''})`).join('; ')}</p>

      {pendingRows.length === 0 ? (
        <p className="text-sm text-gray-600">Nothing awaiting review.</p>
      ) : (
        <div className="border rounded-lg overflow-hidden">
          <div className="px-3 py-2 bg-gray-50 border-b flex flex-wrap items-center justify-between gap-2">
            <label className="text-sm flex items-center gap-2">
              <input type="checkbox" checked={all} onChange={e => setSelected(e.target.checked ? new Set(pendingRows.map(r => r.admission_id)) : new Set())} />
              Select all ({pendingRows.length})
            </label>
            <div className="flex gap-2">
              <button onClick={() => act('keep')} disabled={busy || !selected.size} className="px-3 py-1.5 border rounded-lg text-sm flex items-center gap-1 disabled:opacity-50"><XCircle className="w-4 h-4" /> Keep on admission</button>
              <button onClick={() => act('discharge')} disabled={busy || !selected.size} className="px-3 py-1.5 bg-red-700 text-white rounded-lg text-sm flex items-center gap-1 disabled:opacity-50">
                {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <LogOut className="w-4 h-4" />} Discharge selected ({selected.size})
              </button>
            </div>
          </div>
          <ul className="divide-y">
            {pendingRows.map(({ admission_id, reports, first }) => (
              <li key={admission_id}>
                <label className="flex items-start gap-3 px-3 py-2.5 cursor-pointer hover:bg-gray-50">
                  <input type="checkbox" checked={selected.has(admission_id)} onChange={() => toggle(admission_id)} className="mt-1 w-4 h-4" />
                  <span className="flex-1 min-w-0 text-sm">
                    <span className="font-medium text-gray-900">{first.patient_name || 'Unnamed'}</span>
                    <span className="text-gray-600"> · {first.hospital_number || '—'} · {first.ward || 'No ward'}{first.bed_number ? `, bed ${first.bed_number}` : ''}</span>
                    {reports.map(r => (
                      <span key={r.id} className="block text-xs text-gray-600">
                        {reasonLabel(r.reason)}{r.left_date ? ` on ${new Date(r.left_date).toLocaleDateString()}` : ''} — {r.reported_by_name || 'Unknown'}
                        {r.reported_by_role ? ` (${r.reported_by_role.replace(/_/g, ' ')})` : ''}, {new Date(r.reported_at).toLocaleString()}
                        {r.note ? ` — “${r.note}”` : ''}
                      </span>
                    ))}
                    {new Set(reports.map(r => r.reason)).size > 1 && <span className="block text-[11px] text-amber-800">Reports disagree — check before discharging.</span>}
                  </span>
                </label>
              </li>
            ))}
          </ul>
        </div>
      )}

      {decidedRows.length > 0 && (
        <details className="text-sm">
          <summary className="cursor-pointer text-gray-600">Decided ({decidedRows.length})</summary>
          <ul className="mt-2 space-y-1">
            {decidedRows.map(({ admission_id, reports, first }) => {
              const d = reports.find(r => r.decision !== 'pending');
              return (
                <li key={admission_id} className="text-xs text-gray-700 flex items-center gap-1.5">
                  {d?.decision === 'discharged' ? <CheckCircle2 className="w-3.5 h-3.5 text-green-600" /> : <XCircle className="w-3.5 h-3.5 text-gray-400" />}
                  {first.patient_name} — {d?.decision === 'discharged' ? 'discharged' : d?.decision === 'kept' ? 'kept on admission' : `now ${reports[0].admission_status}`}
                  {d?.decided_by_name ? ` by ${d.decided_by_name}` : ''}
                </li>
              );
            })}
          </ul>
        </details>
      )}

      {data.open && (
        <button onClick={async () => { try { await wardCensusService.close(roundId); toast.success('Census closed'); onChanged(); await load(); } catch (e) { toast.error(clean(e)); } }}
          className="text-sm text-gray-600 underline">Close this census (the link stops accepting reports)</button>
      )}
    </div>
  );
}
