/**
 * Admin → Duplicate patients.
 *
 * Patients registered more than once under the same patient number (PT-12345
 * typed as "pt 12345", "PT12345" …). For each group the administrator picks
 * the record to keep — the one with the most recorded is suggested — and the
 * others are merged into it: every admission, round, prescription, wound and
 * plan moves across, blanks are filled, and the duplicate is retired (kept for
 * the audit trail, never deleted).
 */
import { useCallback, useEffect, useState } from 'react';
import { AlertTriangle, CheckCircle2, GitMerge, Loader2, RefreshCw, Users } from 'lucide-react';
import { apiClient } from '../../services/apiClient';
import { db } from '../../db/database';
import { useAuthStore } from '../../store/authStore';

interface DupPatient {
  id: number | string;
  hospital_number: string;
  name: string;
  created_at?: string;
  records?: { total: number; tables: Record<string, number> };
}
interface DupGroup { key: string; patients: DupPatient[] }
interface MergeResult { movedTotal: number; moved: Record<string, number>; notMoved: { table: string; rows: number; reason: string }[] }

const label = (t: string) => t.replace(/_/g, ' ');
const fullest = (g: DupGroup) => [...g.patients].sort((a, b) => (b.records?.total || 0) - (a.records?.total || 0)
  || String(a.created_at || '').localeCompare(String(b.created_at || '')))[0];

export default function DuplicatePatientsMerge() {
  const { user } = useAuthStore();
  const canMerge = ['admin', 'super_admin'].includes(user?.role || '');
  const [groups, setGroups] = useState<DupGroup[] | null>(null);
  const [error, setError] = useState('');
  const [keep, setKeep] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState<string | null>(null);
  const [done, setDone] = useState<Record<string, { ok: boolean; text: string; notMoved?: MergeResult['notMoved'] }>>({});

  const load = useCallback(async () => {
    setError('');
    setGroups(null);
    try {
      const r: any = await apiClient.get('/patients?hospital_number_duplicates=1', { freshRead: true } as any);
      const list: DupGroup[] = r?.duplicates || [];
      setGroups(list);
      setKeep(Object.fromEntries(list.map(g => [g.key, String(fullest(g).id)])));
    } catch (e: any) {
      setError(e?.message || 'Could not load the duplicate list.');
      setGroups([]);
    }
  }, []);
  useEffect(() => { void load(); }, [load]);

  const merge = async (g: DupGroup) => {
    const keepId = keep[g.key];
    const kept = g.patients.find(p => String(p.id) === keepId);
    const others = g.patients.filter(p => String(p.id) !== keepId);
    if (!kept || !others.length) return;
    const ok = window.confirm(
      `Keep ${kept.name} (${kept.hospital_number}, ${kept.records?.total || 0} records) and merge ` +
      `${others.length === 1 ? 'the other record' : `the other ${others.length} records`} into it?\n\n` +
      'All their admissions, notes, prescriptions, wounds and plans move to the kept record. ' +
      'The duplicate is retired, not deleted. This cannot be undone from the app.');
    if (!ok) return;

    setBusy(g.key);
    let moved = 0;
    const notMoved: MergeResult['notMoved'] = [];
    try {
      for (const o of others) {
        const r: any = await apiClient.post('/patients?action=merge', { keepId, dropId: o.id });
        moved += r?.movedTotal || 0;
        notMoved.push(...(r?.notMoved || []));
        // The retired record should not linger on this device.
        try {
          const locals = await db.patients.toArray();
          for (const p of locals as any[]) {
            if (String(p.serverId ?? p.id) === String(o.id)) await db.patients.delete(p.id);
          }
        } catch { /* local cache only */ }
      }
      setDone(d => ({ ...d, [g.key]: {
        ok: true,
        text: `Merged into ${kept.name} (${kept.hospital_number}) — ${moved} record${moved === 1 ? '' : 's'} moved.`,
        notMoved,
      } }));
    } catch (e: any) {
      setDone(d => ({ ...d, [g.key]: { ok: false, text: e?.message || 'The merge failed; nothing was changed.' } }));
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
            <Users className="w-5 h-5 text-green-700" /> Duplicate patients
          </h2>
          <p className="text-sm text-gray-600 mt-1 max-w-2xl">
            Patients registered more than once under the same patient number (capitals, spaces and dashes ignored).
            Choose the record to keep; the others are merged into it.
          </p>
        </div>
        <button onClick={load} className="px-3 py-2 border rounded-lg text-sm flex items-center gap-2 hover:bg-gray-50">
          <RefreshCw className="w-4 h-4" /> Refresh
        </button>
      </div>

      {!canMerge && (
        <p className="text-sm bg-amber-50 border border-amber-200 text-amber-900 rounded-lg p-3">
          You can view duplicates; only an administrator can merge them.
        </p>
      )}
      {error && <p className="text-sm bg-red-50 border border-red-200 text-red-800 rounded-lg p-3">{error}</p>}
      {groups === null && <p className="flex items-center gap-2 text-sm text-gray-500"><Loader2 className="w-4 h-4 animate-spin" /> Looking for duplicates…</p>}
      {groups && groups.length === 0 && !error && (
        <p className="flex items-center gap-2 text-sm bg-green-50 border border-green-200 text-green-800 rounded-lg p-3">
          <CheckCircle2 className="w-4 h-4" /> No duplicate patient numbers. Every patient is registered once.
        </p>
      )}

      {groups?.map(g => {
        const result = done[g.key];
        return (
          <div key={g.key} className={`bg-white border rounded-xl p-4 ${result?.ok ? 'opacity-70' : ''}`}>
            <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
              <p className="font-semibold text-gray-900">
                {g.patients[0]?.hospital_number} <span className="text-sm font-normal text-gray-500">· {g.patients.length} registrations</span>
              </p>
              {canMerge && !result?.ok && (
                <button onClick={() => merge(g)} disabled={busy !== null}
                  className="px-3 py-2 bg-green-700 text-white rounded-lg text-sm flex items-center gap-2 hover:bg-green-800 disabled:opacity-50">
                  {busy === g.key ? <Loader2 className="w-4 h-4 animate-spin" /> : <GitMerge className="w-4 h-4" />}
                  Merge into the kept record
                </button>
              )}
            </div>

            <div className="grid gap-2 sm:grid-cols-2">
              {g.patients.map(p => {
                const isKeep = keep[g.key] === String(p.id);
                const top = Object.entries(p.records?.tables || {}).sort((a, b) => b[1] - a[1]).slice(0, 4);
                return (
                  <label key={String(p.id)}
                    className={`block rounded-lg border p-3 cursor-pointer ${isKeep ? 'border-green-600 bg-green-50 ring-1 ring-green-600' : 'border-gray-200 hover:bg-gray-50'}`}>
                    <div className="flex items-start gap-2">
                      <input type="radio" name={`keep-${g.key}`} checked={isKeep} disabled={!canMerge || !!result?.ok}
                        onChange={() => setKeep(k => ({ ...k, [g.key]: String(p.id) }))} className="mt-1" />
                      <div className="min-w-0">
                        <p className="font-medium text-gray-900">{p.name || 'Unnamed'} {isKeep && <span className="ml-1 text-xs text-green-700 font-semibold">KEEP</span>}</p>
                        <p className="text-xs text-gray-600">
                          Stored as “{p.hospital_number}” · record #{String(p.id)}
                          {p.created_at ? ` · registered ${String(p.created_at).slice(0, 10)}` : ''}
                        </p>
                        <p className="text-xs text-gray-700 mt-1">
                          <strong>{p.records?.total || 0}</strong> linked record{(p.records?.total || 0) === 1 ? '' : 's'}
                          {top.length > 0 && <> — {top.map(([t, n]) => `${label(t)} ${n}`).join(', ')}</>}
                        </p>
                      </div>
                    </div>
                  </label>
                );
              })}
            </div>

            {g.patients.some((p, i, all) => all.some(q => q !== p && q.name.toLowerCase() !== p.name.toLowerCase())) && (
              <p className="mt-3 text-xs flex items-start gap-1.5 text-amber-800">
                <AlertTriangle className="w-3.5 h-3.5 mt-0.5 shrink-0" />
                The names differ. Check these are the same person before merging — if not, one number was mistyped:
                correct it on that patient's record instead.
              </p>
            )}

            {result && (
              <div className={`mt-3 text-sm rounded-lg p-2.5 ${result.ok ? 'bg-green-50 text-green-800' : 'bg-red-50 text-red-800'}`}>
                {result.text}
                {result.notMoved && result.notMoved.length > 0 && (
                  <p className="text-xs mt-1">
                    Left on the retired record (the kept patient already has its own): {result.notMoved.map(n => `${label(n.table)} (${n.rows})`).join(', ')}.
                  </p>
                )}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
