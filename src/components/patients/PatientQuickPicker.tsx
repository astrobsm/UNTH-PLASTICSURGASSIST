/**
 * Choose a patient, or register one on the spot.
 *
 * A wound is often assessed before anyone has been near the admissions desk —
 * a dressing clinic, a ward referral, someone brought in by a relative. The
 * picker previously offered only the patients already on file, so the
 * assessment had to wait for a registration done somewhere else, and in
 * practice that meant it was written on paper and typed up later, or not at all.
 *
 * A name is enough to start. The hospital number is asked for but not demanded:
 * the server mints a temporary one when it is not given, and the record can be
 * completed later from the patient's own page. Refusing to record a wound
 * because a number has not been issued yet loses the measurement, which is the
 * thing that cannot be recovered.
 */

import { useState, useEffect, useMemo, useCallback } from 'react';
import { Search, UserPlus, Loader2, AlertCircle, X, ArrowLeft } from 'lucide-react';
import { apiClient } from '../../services/apiClient';

export interface PickedPatient {
  id: number | string;
  /** The populated one in this database; first/last are not always both set. */
  full_name?: string;
  first_name?: string;
  last_name?: string;
  hospital_number?: string;
  [key: string]: unknown;
}

interface Props {
  onPick: (patient: PickedPatient) => void;
  onClose: () => void;
  title?: string;
  /** Hides the register option where a new record would be wrong. */
  allowRegister?: boolean;
}

export const displayName = (p: PickedPatient) =>
  // full_name first: every row in this database has it, while last_name is
  // sometimes empty and the pair then renders as a lone forename.
  (p.full_name || '').trim()
  || [p.first_name, p.last_name].filter(Boolean).join(' ').trim()
  || 'Patient';

export function PatientQuickPicker({
  onPick, onClose, title = 'Select patient', allowRegister = true,
}: Props) {
  const [query, setQuery] = useState('');
  const [all, setAll] = useState<PickedPatient[]>([]);
  const [loading, setLoading] = useState(true);
  const [registering, setRegistering] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await apiClient.getPatients();
        const list = Array.isArray(res) ? res : (res as { patients?: PickedPatient[] })?.patients || [];
        if (!cancelled) setAll(list as PickedPatient[]);
      } catch {
        if (!cancelled) setAll([]);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  const filtered = useMemo(() => {
    const term = query.trim().toLowerCase();
    if (!term) return all.slice(0, 30);
    return all
      .filter((p) => [p.full_name, p.first_name, p.last_name, p.hospital_number]
        .filter(Boolean).join(' ').toLowerCase().includes(term))
      .slice(0, 30);
  }, [query, all]);

  if (registering) {
    return (
      <QuickRegister
        initialName={query.trim()}
        onCancel={() => setRegistering(false)}
        onRegistered={onPick}
        onClose={onClose}
        title={title}
      />
    );
  }

  return (
    <Shell title={title} onClose={onClose}>
      <div className="relative mb-3">
        <Search className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
        <input
          autoFocus value={query} onChange={(e) => setQuery(e.target.value)}
          placeholder="Search name or hospital number…"
          className="w-full pl-9 pr-3 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-teal-500 focus:border-teal-500 outline-none"
        />
      </div>

      {loading ? (
        <div className="h-40 bg-gray-50 rounded animate-pulse" />
      ) : (
        <>
          <ul className="max-h-72 overflow-y-auto divide-y">
            {filtered.map((p) => (
              <li key={String(p.id)}>
                <button
                  onClick={() => onPick(p)}
                  className="w-full text-left px-2 py-2.5 hover:bg-gray-50 rounded flex items-center justify-between gap-3"
                >
                  <span className="text-sm text-gray-800 truncate">{displayName(p)}</span>
                  <span className="text-xs text-gray-400 shrink-0">{p.hospital_number}</span>
                </button>
              </li>
            ))}
            {!filtered.length && (
              <li className="py-6 text-center text-sm text-gray-400">
                {query.trim() ? `No patient matches “${query.trim()}”.` : 'No patients yet.'}
              </li>
            )}
          </ul>

          {allowRegister && (
            <div className="mt-3 pt-3 border-t">
              <button
                onClick={() => setRegistering(true)}
                className="w-full flex items-center justify-center gap-2 px-3 py-2.5 rounded-lg bg-teal-600 text-white text-sm font-medium hover:bg-teal-700"
              >
                <UserPlus className="w-4 h-4" />
                {query.trim() ? `Register “${query.trim()}” as a new patient` : 'Register a new patient'}
              </button>
              <p className="text-[11px] text-gray-400 text-center mt-1.5">
                Name is enough to start. The rest can be filled in later.
              </p>
            </div>
          )}
        </>
      )}
    </Shell>
  );
}

/**
 * The smallest registration that still produces a usable record.
 *
 * Splitting a typed name on the first space is a guess, so the two halves are
 * shown as separate fields for correction rather than applied silently — a
 * record filed under the wrong given name is harder to find later than one
 * that was never created.
 */
function QuickRegister({ initialName, onCancel, onRegistered, onClose, title }: {
  initialName: string;
  onCancel: () => void;
  onRegistered: (p: PickedPatient) => void;
  onClose: () => void;
  title: string;
}) {
  const [first, ...rest] = initialName.split(/\s+/).filter(Boolean);
  const [form, setForm] = useState({
    first_name: first || '',
    last_name: rest.join(' ') || '',
    hospital_number: '',
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const submit = useCallback(async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (!form.first_name.trim() || !form.last_name.trim()) {
      setError('Both names are needed — the record is hard to find later without them.');
      return;
    }

    setSaving(true);
    try {
      const created = await apiClient.createPatient({
        first_name: form.first_name.trim(),
        last_name: form.last_name.trim(),
        // Left out entirely when blank, so the server mints one rather than
        // storing an empty string that looks like a real number.
        ...(form.hospital_number.trim() ? { hospital_number: form.hospital_number.trim() } : {}),
      });
      const patient = (created?.patient || created) as PickedPatient;
      if (!patient?.id) throw new Error('The patient was created but came back without an id.');
      onRegistered(patient);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not register the patient.');
    } finally {
      setSaving(false);
    }
  }, [form, onRegistered]);

  return (
    <Shell title={title} onClose={onClose}>
      <button
        onClick={onCancel}
        className="flex items-center gap-1.5 text-xs text-gray-500 hover:text-gray-700 mb-3"
      >
        <ArrowLeft className="w-3.5 h-3.5" /> Back to the list
      </button>

      <form onSubmit={submit} className="space-y-3">
        <div className="grid grid-cols-2 gap-3">
          <label className="block">
            <span className="block text-xs font-medium text-gray-600 mb-1">
              First name <span className="text-red-500">*</span>
            </span>
            <input
              autoFocus required value={form.first_name}
              onChange={(e) => setForm({ ...form, first_name: e.target.value })}
              className="w-full px-3 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-teal-500 focus:border-teal-500 outline-none"
            />
          </label>
          <label className="block">
            <span className="block text-xs font-medium text-gray-600 mb-1">
              Surname <span className="text-red-500">*</span>
            </span>
            <input
              required value={form.last_name}
              onChange={(e) => setForm({ ...form, last_name: e.target.value })}
              className="w-full px-3 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-teal-500 focus:border-teal-500 outline-none"
            />
          </label>
        </div>

        <label className="block">
          <span className="block text-xs font-medium text-gray-600 mb-1">Hospital number</span>
          <input
            value={form.hospital_number}
            onChange={(e) => setForm({ ...form, hospital_number: e.target.value })}
            placeholder="Leave blank if not yet issued"
            className="w-full px-3 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-teal-500 focus:border-teal-500 outline-none"
          />
          <span className="block text-[11px] text-gray-400 mt-1">
            A temporary number is issued if you leave this blank, and can be replaced later.
          </span>
        </label>

        {error && (
          <div role="alert" className="flex items-start gap-2 text-xs text-red-700 bg-red-50 border border-red-200 rounded-lg p-2">
            <AlertCircle className="w-3.5 h-3.5 mt-0.5 shrink-0" /> {error}
          </div>
        )}

        <button
          type="submit" disabled={saving}
          className="w-full flex items-center justify-center gap-2 px-3 py-2.5 rounded-lg bg-teal-600 text-white text-sm font-medium hover:bg-teal-700 disabled:opacity-60"
        >
          {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <UserPlus className="w-4 h-4" />}
          {saving ? 'Registering…' : 'Register and continue'}
        </button>
      </form>
    </Shell>
  );
}

function Shell({ title, onClose, children }: {
  title: string; onClose: () => void; children: React.ReactNode;
}) {
  return (
    <div
      className="fixed inset-0 z-50 bg-black/40 flex items-start sm:items-center justify-center p-4 overflow-y-auto"
      onClick={onClose} role="dialog" aria-modal="true" aria-label={title}
    >
      <div
        className="bg-white rounded-xl shadow-xl w-full max-w-md my-8 sm:my-0"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-4 py-3 border-b">
          <h2 className="font-semibold text-gray-900">{title}</h2>
          <button onClick={onClose} className="p-1 rounded hover:bg-gray-100" aria-label="Close">
            <X className="w-5 h-5 text-gray-500" />
          </button>
        </div>
        <div className="p-4">{children}</div>
      </div>
    </div>
  );
}

export default PatientQuickPicker;
