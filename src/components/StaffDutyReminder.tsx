import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { format } from 'date-fns';
import {
  BellRing, Copy, Check, Loader2, AlertTriangle, Send, Megaphone, RefreshCw,
} from 'lucide-react';
import toast from 'react-hot-toast';
import { normalizeForWhatsApp } from './PhoneActions';
import { userManagementService, ApprovedUser } from '../services/userManagementService';
import { medicalTeamService } from '../services/medicalTeamService';

/**
 * Duty reminder generator.
 *
 * Pick a staff member and this builds the message their WhatsApp gets: every
 * patient currently assigned to them with ward/bed and diagnosis, plus what the
 * unit expects of them — a written review twice a week (Monday and Friday),
 * daily status updates from house officers, and checking the consult module
 * three times a day to acknowledge and act on new referrals.
 *
 * The patient list is built from the same assignment rows the rest of the app
 * uses, so it says what the app says. Nothing is sent automatically: the message
 * is shown in full first, and sending is one deliberate tap.
 */

interface Row {
  hospitalNumber: string;
  name: string;
  location: string;
  diagnosis: string;
  role: string;
}

const CONSULT_CHECKS_PER_DAY = 3;

const StaffDutyReminder: React.FC<{ onPostToBoard?: (title: string, content: string) => void }> = ({ onPostToBoard }) => {
  const [staff, setStaff] = useState<ApprovedUser[]>([]);
  const [staffId, setStaffId] = useState('');
  const [rows, setRows] = useState<Row[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [staffLoading, setStaffLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const all = await userManagementService.getAllApprovedUsers();
        if (!cancelled) setStaff(all.filter(u => u.is_active));
      } catch {
        if (!cancelled) setError('Could not load the staff list.');
      } finally {
        if (!cancelled) setStaffLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  const selected = useMemo(() => staff.find(s => String(s.id) === staffId), [staff, staffId]);

  const build = useCallback(async (id: string) => {
    if (!id) { setRows(null); return; }
    setLoading(true);
    setError(null);
    try {
      // One server call: only currently-admitted patients, with name, hospital
      // number, ward/bed and diagnosis already resolved. Stitching the
      // assignment, patient and admission lists together on the client is what
      // made every patient read as "Not currently admitted / Diagnosis not
      // recorded" — one of the three fetches came back empty and nothing could
      // tell that apart from the patient genuinely not being admitted.
      const assignments = await medicalTeamService.getAdmittedAssignments();

      const out: Row[] = [];
      for (const a of assignments) {
        const roles: string[] = [];
        if (String(a.consultant_id ?? '') === id) roles.push('Consultant');
        if (String(a.senior_registrar_id ?? '') === id) roles.push('Senior Registrar');
        if (String(a.registrar_id ?? '') === id) roles.push('Registrar');
        if (String(a.house_officer_id ?? '') === id) roles.push('House Officer');
        if (roles.length === 0) continue;

        out.push({
          hospitalNumber: (a.hospital_number || '').trim() || '—',
          name: (a.patient_name || '').trim() || 'Unknown',
          location: [a.ward_location, a.bed_number ? `Bed ${a.bed_number}` : '']
            .filter(Boolean).join(', ') || 'Ward not recorded',
          diagnosis: (a.diagnosis || '').trim() || 'Diagnosis not recorded',
          role: roles.join(' & '),
        });
      }
      out.sort((a, b) => a.location.localeCompare(b.location) || a.name.localeCompare(b.name));
      setRows(out);
    } catch (e: any) {
      // Never let a failed load look like "this person has no patients" — the
      // whole point of the message is that the list is complete.
      setRows(null);
      setError(e?.message?.replace(/^\[HTTP \d+\]\s*/, '') || 'Could not load the assigned patients.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { build(staffId); }, [staffId, build]);

  const isHouseOfficer = (selected?.role || '').includes('house_officer');

  const message = useMemo(() => {
    if (!selected || !rows) return '';
    const when = format(new Date(), 'EEE d MMM yyyy');
    const lines: string[] = [];
    lines.push(`*Plastic Surgery Unit — Duty Reminder*`);
    lines.push(`${selected.full_name} (${(selected.role || '').replace(/_/g, ' ')}) — ${when}`);
    lines.push('');

    if (rows.length === 0) {
      lines.push('You have *no admitted patients* assigned at the moment.');
    } else {
      lines.push(`*Your admitted patients (${rows.length}):*`);
      rows.forEach((r, i) => {
        lines.push(`${i + 1}. ${r.name} (${r.hospitalNumber})`);
        lines.push(`    Location: ${r.location}`);
        lines.push(`    Diagnosis: ${r.diagnosis}`);
      });
    }

    lines.push('');
    lines.push('*What is expected:*');
    lines.push('• Review each of the patients above and upload their updates to the app *every Monday and Friday*.');
    if (isHouseOfficer) {
      lines.push('• As house officer, update every patient\'s status on the app *daily*.');
    } else {
      lines.push('• House officers on your team must update patient status on the app daily — please confirm they have.');
    }
    lines.push(`• Check the *Consults module at least ${CONSULT_CHECKS_PER_DAY} times a day*: acknowledge new consults, review them, and upload your findings and plan.`);
    lines.push('');
    lines.push('Please record what you do in the Clinic Day Log.');
    return lines.join('\n');
  }, [selected, rows, isHouseOfficer]);

  const waNumber = normalizeForWhatsApp(selected?.phone || '');

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(message);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      toast.error('Could not copy — select the text and copy manually.');
    }
  };

  return (
    <div className="bg-white rounded-xl shadow-sm border p-4 mb-4">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-3">
        <div>
          <h3 className="text-sm sm:text-base font-semibold text-gray-800 flex items-center gap-2">
            <BellRing className="w-4 h-4 text-amber-500" /> Duty Reminder
          </h3>
          <p className="text-xs text-gray-500 mt-0.5">
            Pick a staff member to build their reminder — every patient assigned to them with
            location and diagnosis, plus the review, daily-update and consult-check expectations.
          </p>
        </div>
        {staffId && (
          <button
            onClick={() => build(staffId)}
            disabled={loading}
            className="self-start px-2.5 py-1.5 text-xs rounded-lg border text-gray-600 hover:bg-gray-50 inline-flex items-center gap-1 disabled:opacity-50"
          >
            <RefreshCw className={`w-3 h-3 ${loading ? 'animate-spin' : ''}`} /> Refresh
          </button>
        )}
      </div>

      <select
        value={staffId}
        onChange={e => setStaffId(e.target.value)}
        disabled={staffLoading}
        className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm bg-white mb-3"
        style={{ fontSize: '16px' }}
      >
        <option value="">{staffLoading ? 'Loading staff…' : '— Select a staff member —'}</option>
        {staff.map(s => (
          <option key={s.id} value={String(s.id)}>
            {s.full_name} ({(s.role || '').replace(/_/g, ' ')})
          </option>
        ))}
      </select>

      {error && (
        <div className="flex items-start gap-2 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2 mb-3">
          <AlertTriangle className="w-4 h-4 text-amber-600 flex-shrink-0 mt-0.5" />
          <p className="text-xs text-amber-800">
            {error}
            {staffId && <button onClick={() => build(staffId)} className="ml-2 underline font-medium">Retry</button>}
          </p>
        </div>
      )}

      {loading && (
        <div className="py-6 text-center"><Loader2 className="w-5 h-5 animate-spin mx-auto text-green-600" /></div>
      )}

      {!loading && selected && rows && (
        <>
          <div className="flex flex-wrap items-center gap-2 mb-2 text-xs">
            <span className={`px-2 py-0.5 rounded-full font-medium ${rows.length ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-600'}`}>
              {rows.length} admitted patient(s) assigned
            </span>
            {!selected.phone && (
              <span className="px-2 py-0.5 rounded-full bg-amber-100 text-amber-800 font-medium">
                No phone number on file — copy the message instead
              </span>
            )}
          </div>

          <pre className="whitespace-pre-wrap break-words text-xs bg-gray-50 border border-gray-200 rounded-lg p-3 max-h-72 overflow-y-auto font-sans text-gray-800">
            {message}
          </pre>

          <div className="flex flex-wrap gap-2 mt-3">
            {waNumber && (
              <a
                href={`https://wa.me/${waNumber}?text=${encodeURIComponent(message)}`}
                target="_blank"
                rel="noopener noreferrer"
                className="px-3 py-2 text-sm font-medium rounded-lg bg-green-600 text-white hover:bg-green-700 inline-flex items-center gap-1"
              >
                <Send className="w-4 h-4" /> Send on WhatsApp
              </a>
            )}
            <button
              onClick={copy}
              className="px-3 py-2 text-sm font-medium rounded-lg border text-gray-700 hover:bg-gray-50 inline-flex items-center gap-1"
            >
              {copied ? <Check className="w-4 h-4 text-green-600" /> : <Copy className="w-4 h-4" />}
              {copied ? 'Copied' : 'Copy message'}
            </button>
            {onPostToBoard && (
              <button
                onClick={() => onPostToBoard(`Duty reminder — ${selected.full_name}`, message)}
                className="px-3 py-2 text-sm font-medium rounded-lg border text-gray-700 hover:bg-gray-50 inline-flex items-center gap-1"
              >
                <Megaphone className="w-4 h-4" /> Post to board
              </button>
            )}
          </div>
        </>
      )}
    </div>
  );
};

export default StaffDutyReminder;
