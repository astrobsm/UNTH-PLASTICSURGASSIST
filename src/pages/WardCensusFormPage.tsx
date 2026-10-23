/**
 * The page a shared census link opens: every patient on admission, grouped by
 * ward. The doctor ticks the ones who are no longer on admission, says how
 * they left and when, and submits. Nothing is discharged here — a supervisor
 * reviews the ticks and discharges in bulk.
 */
import { useEffect, useMemo, useState } from 'react';
import { useParams } from 'react-router-dom';
import { CheckCircle2, ClipboardCheck, Loader2, Search, AlertTriangle, Send } from 'lucide-react';
import { wardCensusService, CENSUS_REASONS, reasonLabel, type CensusPatient, type CensusRound } from '../services/wardCensusService';

interface Mark { reason: string; left_date: string; note: string }
const today = () => new Date().toISOString().slice(0, 10);

export default function WardCensusFormPage() {
  const { roundId = '' } = useParams();
  const [round, setRound] = useState<CensusRound | null>(null);
  const [patients, setPatients] = useState<CensusPatient[]>([]);
  const [flagged, setFlagged] = useState<Map<number, string>>(new Map());
  const [marks, setMarks] = useState<Record<number, Mark>>({});
  const [ward, setWard] = useState<string>('all');
  const [search, setSearch] = useState('');
  const [note, setNote] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [done, setDone] = useState<{ flagged: number; shown: number } | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const r = await wardCensusService.form(roundId);
        setRound(r.round);
        setPatients(r.patients);
        setFlagged(new Map(r.flagged.map(f => [f.admission_id, `${reasonLabel(f.reason)} — flagged by ${f.reported_by_name || 'a colleague'}`])));
      } catch (e: any) {
        setError(String(e?.message || 'Could not open the census').replace(/^\[HTTP \d+\]\s*/, ''));
      } finally { setLoading(false); }
    })();
  }, [roundId]);

  const wards = useMemo(() => [...new Set(patients.map(p => p.ward || 'No ward recorded'))], [patients]);
  const shown = useMemo(() => {
    const q = search.trim().toLowerCase();
    return patients.filter(p =>
      (ward === 'all' || (p.ward || 'No ward recorded') === ward) &&
      (!q || `${p.patient_name} ${p.hospital_number || ''} ${p.bed_number || ''}`.toLowerCase().includes(q)));
  }, [patients, ward, search]);
  const grouped = useMemo(() => {
    const m = new Map<string, CensusPatient[]>();
    for (const p of shown) { const w = p.ward || 'No ward recorded'; if (!m.has(w)) m.set(w, []); m.get(w)!.push(p); }
    return [...m.entries()];
  }, [shown]);

  const ticked = Object.keys(marks).map(Number);
  const toggle = (id: number) => setMarks(m => {
    const n = { ...m };
    if (n[id]) delete n[id]; else n[id] = { reason: 'discharged', left_date: today(), note: '' };
    return n;
  });
  const setMark = (id: number, patch: Partial<Mark>) => setMarks(m => ({ ...m, [id]: { ...m[id], ...patch } }));
  const toggleWard = (list: CensusPatient[], on: boolean) => setMarks(m => {
    const n = { ...m };
    for (const p of list) { if (on && !n[p.admission_id]) n[p.admission_id] = { reason: 'discharged', left_date: today(), note: '' }; if (!on) delete n[p.admission_id]; }
    return n;
  });

  const submit = async () => {
    setError('');
    const bad = ticked.find(id => marks[id].reason === 'other' && !marks[id].note.trim());
    if (bad) { setError('For "Other", say what happened to the patient.'); return; }
    if (!ticked.length && !window.confirm('You have not ticked anyone. Submit to confirm every listed patient is still on admission?')) return;
    setSaving(true);
    try {
      await wardCensusService.submit(roundId, {
        items: ticked.map(id => ({ admission_id: id, reason: marks[id].reason, left_date: marks[id].left_date || undefined, note: marks[id].note.trim() || undefined })),
        shown_count: shown.length, note: note.trim() || undefined, ward: ward === 'all' ? undefined : ward,
      });
      setDone({ flagged: ticked.length, shown: shown.length });
    } catch (e: any) {
      setError(String(e?.message || 'Could not submit').replace(/^\[HTTP \d+\]\s*/, ''));
    } finally { setSaving(false); }
  };

  if (loading) return <div className="p-8 flex justify-center"><Loader2 className="w-6 h-6 animate-spin text-green-700" /></div>;
  if (!round) {
    return (
      <div className="max-w-lg mx-auto p-6 text-center">
        <AlertTriangle className="w-10 h-10 text-amber-500 mx-auto mb-2" />
        <p className="text-gray-800">{error || 'This census link is not available.'}</p>
      </div>
    );
  }
  if (done) {
    return (
      <div className="max-w-lg mx-auto p-6 text-center">
        <CheckCircle2 className="w-12 h-12 text-green-600 mx-auto mb-3" />
        <h1 className="text-lg font-semibold text-gray-900">Thank you — census submitted</h1>
        <p className="text-sm text-gray-600 mt-1">
          {done.flagged
            ? `${done.flagged} of ${done.shown} patient(s) marked as no longer on admission. A consultant will review and discharge them.`
            : `All ${done.shown} patient(s) confirmed as still on admission.`}
        </p>
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto pb-28">
      <div className="bg-white border rounded-xl p-4 mb-3">
        <h1 className="text-lg font-bold text-gray-900 flex items-center gap-2"><ClipboardCheck className="w-5 h-5 text-green-700" /> {round.title}</h1>
        <p className="text-sm text-gray-600 mt-1">
          Tick every patient who is <strong>no longer on admission</strong>, say how they left and when, then submit.
          Nobody is discharged until a consultant reviews the list.
        </p>
        <p className="text-xs text-gray-500 mt-1">
          {patients.length} on admission{round.ward_filter ? ` in ${round.ward_filter}` : ''} · requested by {round.created_by_name || 'the unit'}
          {round.expires_at ? ` · open until ${new Date(round.expires_at).toLocaleString()}` : ''}
        </p>
      </div>

      <div className="sticky top-0 z-10 bg-gray-50/95 backdrop-blur py-2 flex flex-wrap gap-2">
        <select value={ward} onChange={e => setWard(e.target.value)} className="border rounded-lg px-2 py-2 text-sm bg-white" aria-label="Ward">
          <option value="all">All wards ({patients.length})</option>
          {wards.map(w => <option key={w} value={w}>{w} ({patients.filter(p => (p.ward || 'No ward recorded') === w).length})</option>)}
        </select>
        <div className="relative flex-1 min-w-[12rem]">
          <Search className="w-4 h-4 text-gray-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search name, number or bed" className="w-full border rounded-lg pl-8 pr-2 py-2 text-sm" />
        </div>
      </div>

      {grouped.map(([w, list]) => {
        const allOn = list.every(p => marks[p.admission_id]);
        return (
          <section key={w} className="bg-white border rounded-xl mb-3 overflow-hidden">
            <header className="px-3 py-2 bg-green-50 border-b flex items-center justify-between">
              <p className="font-semibold text-gray-900 text-sm">{w} <span className="font-normal text-gray-600">· {list.length}</span></p>
              <label className="text-xs flex items-center gap-1.5 text-gray-700">
                <input type="checkbox" checked={allOn} onChange={e => toggleWard(list, e.target.checked)} /> Tick all in ward
              </label>
            </header>
            <ul className="divide-y">
              {list.map(p => {
                const m = marks[p.admission_id];
                return (
                  <li key={p.admission_id} className={m ? 'bg-amber-50' : ''}>
                    <label className="flex items-start gap-3 px-3 py-3 cursor-pointer">
                      <input type="checkbox" checked={!!m} onChange={() => toggle(p.admission_id)} className="mt-1 w-5 h-5 accent-green-700"
                        aria-label={`${p.patient_name} is no longer on admission`} />
                      <span className="flex-1 min-w-0">
                        <span className="block text-sm font-medium text-gray-900">{p.patient_name || 'Unnamed'}</span>
                        <span className="block text-xs text-gray-600">
                          {p.hospital_number || 'No number'}{p.bed_number ? ` · Bed ${p.bed_number}` : ''}
                          {p.admission_date ? ` · admitted ${new Date(p.admission_date).toLocaleDateString()}` : ''}
                        </span>
                        {(p.admitting_diagnosis || p.adm_primary_diagnosis) && <span className="block text-xs text-gray-500 truncate">{p.admitting_diagnosis || p.adm_primary_diagnosis}</span>}
                        {flagged.has(p.admission_id) && <span className="block text-[11px] text-amber-800 mt-0.5">Already flagged: {flagged.get(p.admission_id)}</span>}
                      </span>
                    </label>
                    {m && (
                      <div className="px-3 pb-3 pl-11 grid gap-2 sm:grid-cols-3">
                        <select value={m.reason} onChange={e => setMark(p.admission_id, { reason: e.target.value })} className="border rounded-lg px-2 py-2 text-sm bg-white" aria-label="How they left">
                          {CENSUS_REASONS.map(r => <option key={r.value} value={r.value}>{r.label}</option>)}
                        </select>
                        <input type="date" value={m.left_date} max={today()} onChange={e => setMark(p.admission_id, { left_date: e.target.value })} className="border rounded-lg px-2 py-2 text-sm" aria-label="Date left" />
                        <input value={m.note} onChange={e => setMark(p.admission_id, { note: e.target.value })} placeholder={m.reason === 'other' ? 'What happened? (required)' : 'Note (optional)'} className="border rounded-lg px-2 py-2 text-sm" />
                      </div>
                    )}
                  </li>
                );
              })}
            </ul>
          </section>
        );
      })}
      {grouped.length === 0 && <p className="text-sm text-gray-500 text-center py-8">No patients match.</p>}

      <textarea value={note} onChange={e => setNote(e.target.value)} rows={2} placeholder="Comment for the consultant (optional)" className="w-full border rounded-xl p-3 text-sm mb-3" />

      <div className="fixed bottom-0 inset-x-0 bg-white border-t p-3 z-20">
        <div className="max-w-3xl mx-auto flex items-center justify-between gap-3">
          <p className="text-sm text-gray-700"><strong>{ticked.length}</strong> marked as no longer on admission</p>
          {error && <p className="text-xs text-red-700 flex-1 text-right">{error}</p>}
          <button onClick={submit} disabled={saving} className="px-4 py-2.5 bg-green-700 text-white rounded-lg text-sm font-medium flex items-center gap-2 disabled:opacity-50">
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />} Submit
          </button>
        </div>
      </div>
    </div>
  );
}
