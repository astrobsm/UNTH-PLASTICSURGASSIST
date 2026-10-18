/**
 * The patient number — the first thing entered when registering.
 *
 * Written as PT-12345 whatever the case or spacing typed ("pt12345",
 * "Pt 12345" all become PT-12345). As soon as a number is entered it is
 * looked up — on this device and on the server — ignoring case and
 * punctuation, and an existing registration is shown with a link to it, so
 * the same patient is not registered twice.
 */
import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { AlertTriangle, CheckCircle2, Loader2, WifiOff } from 'lucide-react';
import { db } from '../db/database';
import { apiClient } from '../services/apiClient';
import { hospitalNumberKey, isPtFormat, normalizeHospitalNumber } from '../utils/hospitalNumber';

export interface ExistingPatient { id: string | number; name: string; hospital_number: string; date_of_birth?: string; created_at?: string }
export type NumberCheck =
  | { state: 'empty' } | { state: 'invalid' } | { state: 'checking' }
  | { state: 'clear'; offline?: boolean } | { state: 'duplicate'; matches: ExistingPatient[] };

async function findLocal(key: string): Promise<ExistingPatient[]> {
  try {
    const all = await db.patients.toArray();
    return all
      .filter((p: any) => p.deleted !== true && hospitalNumberKey(p.hospital_number) === key)
      .map((p: any) => ({
        id: p.serverId ?? p.id,
        name: (p.full_name || `${p.first_name || ''} ${p.last_name || ''}`).trim(),
        hospital_number: p.hospital_number,
        date_of_birth: p.date_of_birth,
        created_at: p.created_at,
      }));
  } catch { return []; }
}

export function HospitalNumberField({ value, onChange, onCheck, optional = false, onUseExisting, className = 'md:col-span-2' }: {
  value: string;
  onChange: (v: string) => void;
  onCheck: (c: NumberCheck) => void;
  /** Emergency / quick add: the number may not be issued yet, so blank is allowed. */
  optional?: boolean;
  /** Where the caller can carry on with the existing patient instead (quick add). */
  onUseExisting?: (m: ExistingPatient) => void;
  className?: string;
}) {
  const [check, setCheck] = useState<NumberCheck>({ state: 'empty' });
  const seq = useRef(0);

  const report = (c: NumberCheck) => { setCheck(c); onCheck(c); };

  useEffect(() => {
    const normalized = normalizeHospitalNumber(value);
    if (!normalized) { report({ state: 'empty' }); return; }
    if (!isPtFormat(normalized)) { report({ state: 'invalid' }); return; }
    const key = hospitalNumberKey(normalized);
    const mine = ++seq.current;
    report({ state: 'checking' });
    const t = setTimeout(async () => {
      const local = await findLocal(key);
      let server: ExistingPatient[] = [];
      let offline = false;
      try {
        const r: any = await apiClient.get(`/patients?hospital_number_lookup=${encodeURIComponent(normalized)}`, { freshRead: true } as any);
        server = (r?.matches || []).map((m: any) => ({ ...m, name: m.name || `${m.first_name || ''} ${m.last_name || ''}`.trim() }));
      } catch { offline = true; }
      if (mine !== seq.current) return; // a newer number was typed meanwhile
      const seen = new Set<string>();
      const matches = [...server, ...local].filter(m => {
        const k = String(m.id);
        if (seen.has(k)) return false;
        seen.add(k);
        return true;
      });
      report(matches.length ? { state: 'duplicate', matches } : { state: 'clear', offline });
    }, 400);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);

  const border = check.state === 'duplicate' || check.state === 'invalid' ? 'border-red-400 focus:ring-red-400'
    : check.state === 'clear' ? 'border-green-500 focus:ring-green-500' : 'border-gray-300 focus:ring-green-500';

  return (
    <div className={className}>
      <label htmlFor="reg-hospital-number" className="block text-sm font-medium text-gray-700 mb-1">
        Patient number{optional ? '' : ' *'} <span className="font-normal text-gray-500">(PT-12345)</span>
      </label>
      <input
        id="reg-hospital-number"
        type="text"
        required={!optional}
        autoFocus
        autoComplete="off"
        autoCapitalize="characters"
        spellCheck={false}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        // Shown in its written form once the person moves on.
        onBlur={() => { const n = normalizeHospitalNumber(value); if (n && n !== value) onChange(n); }}
        className={`w-full p-2 border rounded-md focus:ring-2 focus:border-transparent uppercase ${border}`}
        placeholder="PT-12345"
        aria-describedby="reg-hospital-number-status"
      />
      <div id="reg-hospital-number-status" className="mt-1.5 text-sm" role="status" aria-live="polite">
        {check.state === 'empty' && optional && (
          <span className="text-xs text-gray-500">Not issued yet? Leave blank — a temporary number is given and can be replaced later.</span>
        )}
        {check.state === 'checking' && (
          <span className="flex items-center gap-1.5 text-gray-500"><Loader2 className="w-4 h-4 animate-spin" /> Checking {normalizeHospitalNumber(value)}…</span>
        )}
        {check.state === 'invalid' && (
          <span className="flex items-center gap-1.5 text-red-700"><AlertTriangle className="w-4 h-4" /> Enter the patient number as PT followed by digits, e.g. PT-12345.</span>
        )}
        {check.state === 'clear' && (
          <span className={`flex items-center gap-1.5 ${check.offline ? 'text-amber-700' : 'text-green-700'}`}>
            {check.offline ? <WifiOff className="w-4 h-4" /> : <CheckCircle2 className="w-4 h-4" />}
            {normalizeHospitalNumber(value)} is not registered{check.offline ? ' on this device (offline — the server will check again when it syncs)' : ''}.
          </span>
        )}
        {check.state === 'duplicate' && (
          <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-red-900">
            <p className="font-semibold flex items-center gap-1.5">
              <AlertTriangle className="w-4 h-4" /> {normalizeHospitalNumber(value)} is already registered
            </p>
            <ul className="mt-2 space-y-1.5">
              {check.matches.map(m => (
                <li key={String(m.id)} className="flex flex-wrap items-center justify-between gap-2">
                  <span>
                    <strong>{m.name || 'Unnamed patient'}</strong> · {m.hospital_number}
                    {m.date_of_birth ? ` · born ${String(m.date_of_birth).slice(0, 10)}` : ''}
                  </span>
                  {onUseExisting ? (
                    <button type="button" onClick={() => onUseExisting(m)} className="px-3 py-1 rounded-md bg-red-700 text-white text-xs hover:bg-red-800">
                      Use this patient
                    </button>
                  ) : (
                    <Link to={`/patients/${m.id}`} className="px-3 py-1 rounded-md bg-red-700 text-white text-xs hover:bg-red-800">
                      Open existing record
                    </Link>
                  )}
                </li>
              ))}
            </ul>
            <p className="mt-2 text-xs">Registration is blocked to prevent a duplicate. If this number was typed wrongly, correct it above.</p>
          </div>
        )}
      </div>
    </div>
  );
}
