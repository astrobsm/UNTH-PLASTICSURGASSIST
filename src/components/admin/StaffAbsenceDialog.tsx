/**
 * Schedule or end a staff absence (leave / outside posting).
 *
 * Deliberately states the consequence before the user commits: recording an
 * absence moves live patients and duty shifts between clinicians, which is not
 * something anyone should discover after clicking.
 */

import React, { useEffect, useState } from 'react';
import { AlertTriangle, CalendarDays, Loader2, Plane, RotateCcw, X } from 'lucide-react';
import toast from 'react-hot-toast';
import {
  ABSENCE_TYPE_LABELS, createAbsence, listAbsences, endAbsenceNow, cancelAbsence,
  describeEffect, type AbsenceType, type StaffAbsence,
} from '../../services/staffAbsenceService';

const today = () => new Date().toISOString().slice(0, 10);

interface Props {
  userId: string;
  userName: string;
  userRole?: string;
  onClose: () => void;
  onChanged?: () => void;
}

export default function StaffAbsenceDialog({ userId, userName, userRole, onClose, onChanged }: Props) {
  const [absences, setAbsences] = useState<StaffAbsence[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [type, setType] = useState<AbsenceType>('annual_leave');
  const [startDate, setStartDate] = useState(today());
  const [endDate, setEndDate] = useState('');
  const [reason, setReason] = useState('');

  const load = async () => {
    setLoading(true);
    try {
      setAbsences(await listAbsences(userId));
    } catch {
      toast.error('Could not load absence history');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [userId]);

  const active = absences.find(a => a.status === 'active');

  const submit = async () => {
    if (!endDate) { toast.error('An end date is required'); return; }
    if (endDate < startDate) { toast.error('End date must be on or after the start date'); return; }

    setSaving(true);
    try {
      const { effect } = await createAbsence({
        user_id: userId, absence_type: type, start_date: startDate, end_date: endDate, reason,
      });
      toast.success(effect ? `Absence recorded. ${describeEffect(effect)}` : 'Absence scheduled');
      setReason('');
      setEndDate('');
      await load();
      onChanged?.();
    } catch (err: any) {
      toast.error(err?.message || 'Could not record the absence');
    } finally {
      setSaving(false);
    }
  };

  const endNow = async (id: number) => {
    setSaving(true);
    try {
      const { effect } = await endAbsenceNow(id);
      toast.success(`Marked as returned. ${describeEffect(effect)}`);
      await load();
      onChanged?.();
    } catch (err: any) {
      toast.error(err?.message || 'Could not end the absence');
    } finally {
      setSaving(false);
    }
  };

  const cancel = async (id: number) => {
    setSaving(true);
    try {
      await cancelAbsence(id);
      toast.success('Absence cancelled');
      await load();
      onChanged?.();
    } catch (err: any) {
      toast.error(err?.message || 'Could not cancel');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between px-5 py-4 border-b">
          <div className="flex items-center gap-2">
            <Plane className="h-5 w-5 text-primary-600" />
            <div>
              <h2 className="font-semibold text-gray-900">Leave / Outside posting</h2>
              <p className="text-xs text-gray-500">{userName}{userRole ? ` — ${userRole.replace(/_/g, ' ')}` : ''}</p>
            </div>
          </div>
          <button onClick={onClose} className="p-1 text-gray-400 hover:text-gray-600"><X className="h-5 w-5" /></button>
        </div>

        <div className="p-5 space-y-5">
          {active && (
            <div className="bg-amber-50 border border-amber-300 rounded-lg p-3">
              <div className="flex items-start gap-2">
                <AlertTriangle className="h-4 w-4 text-amber-700 flex-shrink-0 mt-0.5" />
                <div className="flex-1">
                  <p className="text-sm text-amber-900 font-medium">
                    Currently away — {ABSENCE_TYPE_LABELS[active.absence_type]}
                  </p>
                  <p className="text-xs text-amber-800 mt-0.5">
                    {active.start_date} to {active.end_date}. Cover in place:{' '}
                    {active.patients_reassigned} patients, {active.call_duties_reassigned} call duties,{' '}
                    {active.clinic_duties_reassigned} clinic duties.
                  </p>
                  <button
                    onClick={() => endNow(active.id)}
                    disabled={saving}
                    className="mt-2 px-3 py-1.5 rounded-md text-xs font-medium bg-green-600 text-white hover:bg-green-700 disabled:opacity-50 inline-flex items-center gap-1"
                  >
                    <RotateCcw className="h-3.5 w-3.5" /> Mark returned now
                  </button>
                </div>
              </div>
            </div>
          )}

          {!active && (
            <div className="space-y-3">
              <div className="bg-blue-50 border border-blue-200 rounded p-3 text-xs text-blue-900">
                While away, this person's patients and duties are shared out evenly among the
                other {userRole ? userRole.replace(/_/g, ' ') + 's' : 'staff of the same grade'}, and they
                are excluded from new assignments. On the end date their patients return to them
                automatically and the grade is levelled.
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Reason</label>
                  <select value={type} onChange={e => setType(e.target.value as AbsenceType)} className="input">
                    {Object.entries(ABSENCE_TYPE_LABELS).map(([v, label]) => (
                      <option key={v} value={v}>{label}</option>
                    ))}
                  </select>
                </div>
                <div />
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Start date</label>
                  <input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} className="input" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">End date (last day away)</label>
                  <input type="date" value={endDate} min={startDate} onChange={e => setEndDate(e.target.value)} className="input" />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Notes (optional)</label>
                <textarea value={reason} onChange={e => setReason(e.target.value)} rows={2} className="input" />
              </div>

              <button
                onClick={submit}
                disabled={saving || !endDate}
                className="px-4 py-2 rounded-md bg-primary-600 text-white text-sm font-medium hover:bg-primary-700 disabled:opacity-50 inline-flex items-center gap-2"
              >
                {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <CalendarDays className="h-4 w-4" />}
                {startDate <= today() ? 'Record absence and reassign now' : 'Schedule absence'}
              </button>
            </div>
          )}

          <div>
            <h3 className="text-sm font-semibold text-gray-900 mb-2">History</h3>
            {loading ? (
              <div className="py-6 flex justify-center"><Loader2 className="h-5 w-5 animate-spin text-gray-400" /></div>
            ) : absences.length === 0 ? (
              <p className="text-sm text-gray-500">No absences recorded.</p>
            ) : (
              <div className="border rounded divide-y">
                {absences.map(a => (
                  <div key={a.id} className="p-3 flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-gray-900">
                        {ABSENCE_TYPE_LABELS[a.absence_type]}
                        <span className={`ml-2 px-1.5 py-0.5 rounded text-xs ${
                          a.status === 'active' ? 'bg-amber-100 text-amber-800'
                          : a.status === 'scheduled' ? 'bg-blue-100 text-blue-800'
                          : a.status === 'cancelled' ? 'bg-gray-100 text-gray-600'
                          : 'bg-green-100 text-green-800'
                        }`}>{a.status}</span>
                      </p>
                      <p className="text-xs text-gray-500">{a.start_date} to {a.end_date}</p>
                      {a.status !== 'scheduled' && (
                        <p className="text-xs text-gray-500 mt-0.5">
                          {a.patients_reassigned} patients reassigned
                          {a.patients_restored > 0 && `, ${a.patients_restored} returned`}
                        </p>
                      )}
                    </div>
                    {a.status === 'scheduled' && (
                      <button onClick={() => cancel(a.id)} disabled={saving} className="text-xs text-red-600 hover:underline whitespace-nowrap">
                        Cancel
                      </button>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
