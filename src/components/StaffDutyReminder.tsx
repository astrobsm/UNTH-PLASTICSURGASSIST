import React, { useCallback, useEffect, useState } from 'react';
import {
  BellRing, Copy, Check, Loader2, AlertTriangle, Send, Megaphone, RefreshCw, CalendarClock, Info,
} from 'lucide-react';
import toast from 'react-hot-toast';
import { userManagementService, ApprovedUser } from '../services/userManagementService';
import { dutyReminderService, ReminderPreview, ReminderKind, ReminderStatus } from '../services/dutyReminderService';

/**
 * Duty reminder generator.
 *
 * Pick a staff member and this shows the message they will receive: every
 * admitted patient assigned to them with ward/bed, diagnosis and how long the
 * patient has been under our care, plus what the unit expects — a written review
 * every Monday and Friday, daily status updates from house officers, and
 * checking the consult module three times a day.
 *
 * The message is composed on the SERVER, so this preview is exactly what the
 * scheduled Monday/Friday run sends. Nothing goes out from this screen without a
 * deliberate tap.
 */
const StaffDutyReminder: React.FC<{ onPostToBoard?: (title: string, content: string) => void }> = ({ onPostToBoard }) => {
  const [staff, setStaff] = useState<ApprovedUser[]>([]);
  const [staffId, setStaffId] = useState('');
  const [kind, setKind] = useState<ReminderKind>('weekly');
  const [preview, setPreview] = useState<ReminderPreview | null>(null);
  const [loading, setLoading] = useState(false);
  const [staffLoading, setStaffLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [status, setStatus] = useState<ReminderStatus | null>(null);

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
    dutyReminderService.status().then(s => { if (!cancelled) setStatus(s); }).catch(() => {});
    return () => { cancelled = true; };
  }, []);

  const build = useCallback(async (id: string, k: ReminderKind) => {
    if (!id) { setPreview(null); return; }
    setLoading(true);
    setError(null);
    try {
      // The SERVER composes the message, so what is previewed here is exactly
      // what a scheduled Monday/Friday run will send — no second copy of the
      // wording or the patient-list logic to drift out of step.
      setPreview(await dutyReminderService.preview(id, k));
    } catch (e: any) {
      // Never let a failed load look like "this person has no patients" — the
      // whole point of the message is that the list is complete.
      setPreview(null);
      setError(e?.message?.replace(/^\[HTTP \d+\]\s*/, '') || 'Could not build the reminder.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { build(staffId, kind); }, [staffId, kind, build]);

  const copy = async () => {
    if (!preview) return;
    try {
      await navigator.clipboard.writeText(preview.message);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      toast.error('Could not copy — select the text and copy manually.');
    }
  };

  return (
    <div className="bg-white rounded-xl shadow-sm border p-4 mb-4">
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3 mb-3">
        <div>
          <h3 className="text-sm sm:text-base font-semibold text-gray-800 flex items-center gap-2">
            <BellRing className="w-4 h-4 text-amber-500" /> Duty Reminder
          </h3>
          <p className="text-xs text-gray-500 mt-0.5">
            Every patient assigned to them with location, diagnosis and days under our care,
            plus the review, daily-update and consult-check expectations.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex rounded-lg border overflow-hidden">
            <button
              onClick={() => setKind('weekly')}
              className={`px-2.5 py-1.5 text-xs font-medium ${kind === 'weekly' ? 'bg-amber-500 text-white' : 'bg-white text-gray-600'}`}
              title="The Monday & Friday review reminder"
            >
              Mon/Fri review
            </button>
            <button
              onClick={() => setKind('daily')}
              className={`px-2.5 py-1.5 text-xs font-medium ${kind === 'daily' ? 'bg-amber-500 text-white' : 'bg-white text-gray-600'}`}
              title="The daily house-officer status-update reminder"
            >
              Daily update
            </button>
          </div>
          {staffId && (
            <button
              onClick={() => build(staffId, kind)}
              disabled={loading}
              className="px-2.5 py-1.5 text-xs rounded-lg border text-gray-600 hover:bg-gray-50 inline-flex items-center gap-1 disabled:opacity-50"
            >
              <RefreshCw className={`w-3 h-3 ${loading ? 'animate-spin' : ''}`} />
            </button>
          )}
        </div>
      </div>

      {status && (
        <p className="text-[11px] text-gray-500 flex items-start gap-1 mb-3">
          <CalendarClock className="w-3 h-3 mt-0.5 flex-shrink-0" />
          <span>
            Reminders are sent by hand: build them here or in the run below, check the message,
            then send. Nothing goes out on its own.
          </span>
        </p>
      )}

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
            {staffId && <button onClick={() => build(staffId, kind)} className="ml-2 underline font-medium">Retry</button>}
          </p>
        </div>
      )}

      {loading && (
        <div className="py-6 text-center"><Loader2 className="w-5 h-5 animate-spin mx-auto text-green-600" /></div>
      )}

      {!loading && preview && (
        <>
          <div className="flex flex-wrap items-center gap-2 mb-2 text-xs">
            <span className={`px-2 py-0.5 rounded-full font-medium ${preview.patientCount ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-600'}`}>
              {preview.patientCount} admitted patient(s) assigned
            </span>
            {!preview.staff.phone && (
              <span className="px-2 py-0.5 rounded-full bg-amber-100 text-amber-800 font-medium">
                No phone number on file — copy the message instead
              </span>
            )}
          </div>

          <pre className="whitespace-pre-wrap break-words text-xs bg-gray-50 border border-gray-200 rounded-lg p-3 max-h-72 overflow-y-auto font-sans text-gray-800">
            {preview.message}
          </pre>

          <div className="flex flex-wrap gap-2 mt-3">
            {preview.whatsappLink && (
              <a
                href={preview.whatsappLink}
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
                onClick={() => onPostToBoard(`Duty reminder — ${preview.staff.full_name}`, preview.message)}
                className="px-3 py-2 text-sm font-medium rounded-lg border text-gray-700 hover:bg-gray-50 inline-flex items-center gap-1"
              >
                <Megaphone className="w-4 h-4" /> Post to board
              </button>
            )}
          </div>

          {preview.patientCount === 0 && (
            <p className="text-[11px] text-gray-500 mt-2 flex items-start gap-1">
              <Info className="w-3 h-3 mt-0.5 flex-shrink-0" />
              Scheduled runs skip anyone with no admitted patients, so this person would not be messaged.
            </p>
          )}
        </>
      )}
    </div>
  );
};

export default StaffDutyReminder;
