import { useCallback, useEffect, useMemo, useState } from 'react';
import { format } from 'date-fns';
import {
  ClipboardList, Plus, Trash2, Loader2, AlertTriangle, BarChart3, Users, CheckCircle2, X, Save, Edit3,
} from 'lucide-react';
import toast from 'react-hot-toast';
import { useAuthStore } from '../store/authStore';
import { clinicDayLogService, ClinicDayLog, DayLogSummary, todayISO } from '../services/clinicDayLogService';
import { DUTY_TYPES, DUTY_GROUPS, dutyLabel, isPatientLinked } from '../config/clinicDuties';

/**
 * Clinic Day Log — every user records the duties they did today, chosen from the
 * unit's duty catalogue. Because the duty is picked rather than typed, the same
 * work is named the same way by everyone, which is what makes the totals at the
 * bottom of this page mean anything.
 */
export default function ClinicDayLogPage() {
  const { user } = useAuthStore();
  const myId = user?.id != null ? String(user.id) : '';
  const isSupervisor = !!user?.role && ['admin', 'super_admin', 'consultant', 'senior_registrar'].includes(user.role);

  const [date, setDate] = useState(todayISO());
  const [logs, setLogs] = useState<ClinicDayLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [scope, setScope] = useState<'me' | 'everyone'>('me');

  // Entry form
  const [dutyType, setDutyType] = useState('clerking');
  const [otherLabel, setOtherLabel] = useState('');
  const [quantity, setQuantity] = useState(1);
  const [patientRef, setPatientRef] = useState('');
  const [location, setLocation] = useState('');
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);

  // Editing an existing row
  const [editId, setEditId] = useState<number | null>(null);
  const [editQty, setEditQty] = useState(1);
  const [editNotes, setEditNotes] = useState('');

  // Summary
  const [summary, setSummary] = useState<DayLogSummary | null>(null);
  const [summaryRange, setSummaryRange] = useState<'day' | 'week' | 'month'>('day');
  const [summaryLoading, setSummaryLoading] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setLogs(await clinicDayLogService.getForDate(date));
    } catch (e: any) {
      // A failed fetch must not read as "nobody did anything today".
      setError(e?.message?.replace(/^\[HTTP \d+\]\s*/, '') || 'Could not load the day log');
      setLogs([]);
    } finally {
      setLoading(false);
    }
  }, [date]);

  useEffect(() => { load(); }, [load]);

  const loadSummary = useCallback(async () => {
    setSummaryLoading(true);
    try {
      const end = date;
      const d = new Date(`${date}T12:00:00`);
      if (summaryRange === 'week') d.setDate(d.getDate() - 6);
      if (summaryRange === 'month') d.setDate(d.getDate() - 29);
      const start = summaryRange === 'day' ? date : d.toISOString().slice(0, 10);
      setSummary(await clinicDayLogService.getSummary(start, end));
    } catch {
      setSummary(null);
    } finally {
      setSummaryLoading(false);
    }
  }, [date, summaryRange]);

  useEffect(() => { loadSummary(); }, [loadSummary]);

  const visible = useMemo(
    () => (scope === 'me' ? logs.filter(l => String(l.user_id) === myId) : logs),
    [logs, scope, myId]
  );

  const myCount = useMemo(
    () => logs.filter(l => String(l.user_id) === myId).reduce((n, l) => n + (l.quantity || 1), 0),
    [logs, myId]
  );

  const add = async () => {
    if (dutyType === 'other' && !otherLabel.trim()) {
      toast.error('Say what the duty was');
      return;
    }
    setSaving(true);
    try {
      await clinicDayLogService.add({
        log_date: date,
        duty_type: dutyType,
        duty_label: dutyType === 'other' ? otherLabel.trim() : dutyLabel(dutyType),
        quantity,
        hospital_number: patientRef.trim() || null,
        location: location.trim() || null,
        notes: notes.trim() || null,
      });
      setQuantity(1); setPatientRef(''); setNotes(''); setOtherLabel('');
      await load();
      await loadSummary();
      toast.success('Logged');
    } catch (e: any) {
      toast.error(e?.message?.replace(/^\[HTTP \d+\]\s*/, '') || 'Could not save the entry');
    } finally {
      setSaving(false);
    }
  };

  const saveEdit = async (log: ClinicDayLog) => {
    try {
      await clinicDayLogService.update(log.id!, { quantity: editQty, notes: editNotes || null });
      setEditId(null);
      await load();
      await loadSummary();
    } catch (e: any) {
      toast.error(e?.message?.replace(/^\[HTTP \d+\]\s*/, '') || 'Could not update the entry');
    }
  };

  const remove = async (log: ClinicDayLog) => {
    if (!window.confirm(`Delete "${log.duty_label || dutyLabel(log.duty_type)}"${log.quantity > 1 ? ` ×${log.quantity}` : ''} from the log?`)) return;
    try {
      await clinicDayLogService.remove(log.id!);
      await load();
      await loadSummary();
    } catch (e: any) {
      toast.error(e?.message?.replace(/^\[HTTP \d+\]\s*/, '') || 'Could not delete the entry');
    }
  };

  const canEdit = (log: ClinicDayLog) => String(log.user_id) === myId || isSupervisor;
  const isToday = date === todayISO();

  return (
    <div className="p-4 sm:p-6 space-y-4 max-w-6xl mx-auto">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-gray-900 flex items-center gap-2">
            <ClipboardList className="w-6 h-6 text-green-600" /> Clinic Day Log
          </h1>
          <p className="text-sm text-gray-500 mt-1">
            Log the duties you carried out — clerking, debridements, wound inspections and the rest.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <label className="text-xs text-gray-500">Day</label>
          <input
            type="date"
            value={date}
            onChange={e => setDate(e.target.value)}
            className="border rounded-lg px-2 py-1.5 text-sm"
            style={{ fontSize: '16px' }}
          />
          {!isToday && (
            <button onClick={() => setDate(todayISO())} className="text-xs text-green-700 hover:underline">Today</button>
          )}
        </div>
      </div>

      {/* ── Log a duty ─────────────────────────────────────────────────── */}
      <div className="bg-white rounded-xl shadow-sm border p-4">
        <h2 className="text-sm font-semibold text-gray-800 mb-3 flex items-center gap-2">
          <Plus className="w-4 h-4 text-green-600" /> Log a duty
          {myCount > 0 && (
            <span className="ml-auto text-xs font-normal text-gray-500">
              {myCount} logged by you {isToday ? 'today' : `on ${format(new Date(`${date}T12:00:00`), 'dd MMM')}`}
            </span>
          )}
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          <label className="block sm:col-span-2">
            <span className="block text-xs font-medium text-gray-600 mb-1">Duty *</span>
            <select
              value={dutyType}
              onChange={e => setDutyType(e.target.value)}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm bg-white"
              style={{ fontSize: '16px' }}
            >
              {DUTY_GROUPS.map(group => (
                <optgroup key={group} label={group}>
                  {DUTY_TYPES.filter(d => d.group === group).map(d => (
                    <option key={d.key} value={d.key}>{d.label}</option>
                  ))}
                </optgroup>
              ))}
            </select>
          </label>

          <label className="block">
            <span className="block text-xs font-medium text-gray-600 mb-1">How many</span>
            <input
              type="number" min={1} max={200} value={quantity}
              onChange={e => setQuantity(Math.max(1, Math.min(200, parseInt(e.target.value || '1', 10))))}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
              style={{ fontSize: '16px' }}
            />
          </label>

          <label className="block">
            <span className="block text-xs font-medium text-gray-600 mb-1">
              Patient {isPatientLinked(dutyType) ? '' : '(optional)'}
            </span>
            <input
              value={patientRef}
              onChange={e => setPatientRef(e.target.value)}
              placeholder="Hospital number"
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
              style={{ fontSize: '16px' }}
            />
          </label>

          {dutyType === 'other' && (
            <label className="block sm:col-span-2">
              <span className="block text-xs font-medium text-gray-600 mb-1">What was it? *</span>
              <input
                value={otherLabel}
                onChange={e => setOtherLabel(e.target.value)}
                placeholder="Describe the duty"
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
                style={{ fontSize: '16px' }}
              />
            </label>
          )}

          <label className="block">
            <span className="block text-xs font-medium text-gray-600 mb-1">Where (optional)</span>
            <input
              value={location}
              onChange={e => setLocation(e.target.value)}
              placeholder="Ward, clinic, theatre"
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
              style={{ fontSize: '16px' }}
            />
          </label>

          <label className="block sm:col-span-2 lg:col-span-2">
            <span className="block text-xs font-medium text-gray-600 mb-1">Notes (optional)</span>
            <input
              value={notes}
              onChange={e => setNotes(e.target.value)}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
              style={{ fontSize: '16px' }}
            />
          </label>

          <div className="flex items-end">
            <button
              onClick={add}
              disabled={saving}
              className="w-full px-4 py-2 rounded-lg bg-green-600 text-white text-sm font-medium hover:bg-green-700 disabled:opacity-50 inline-flex items-center justify-center gap-1"
            >
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />} Add to log
            </button>
          </div>
        </div>
      </div>

      {/* ── The day's log ──────────────────────────────────────────────── */}
      <div className="bg-white rounded-xl shadow-sm border p-4">
        <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
          <h2 className="text-sm font-semibold text-gray-800 flex items-center gap-2">
            <Users className="w-4 h-4 text-green-600" />
            {format(new Date(`${date}T12:00:00`), 'EEEE, d MMMM yyyy')}
          </h2>
          <div className="flex rounded-lg border overflow-hidden">
            <button
              onClick={() => setScope('me')}
              className={`px-3 py-1.5 text-xs font-medium ${scope === 'me' ? 'bg-green-600 text-white' : 'bg-white text-gray-600'}`}
            >
              Mine
            </button>
            <button
              onClick={() => setScope('everyone')}
              className={`px-3 py-1.5 text-xs font-medium ${scope === 'everyone' ? 'bg-green-600 text-white' : 'bg-white text-gray-600'}`}
            >
              Everyone
            </button>
          </div>
        </div>

        {error && (
          <div className="flex items-start gap-2 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2 mb-2">
            <AlertTriangle className="w-4 h-4 text-amber-600 flex-shrink-0 mt-0.5" />
            <p className="text-xs text-amber-800">
              {error}
              <button onClick={load} className="ml-2 underline font-medium">Retry</button>
            </p>
          </div>
        )}

        {loading ? (
          <div className="py-8 text-center"><Loader2 className="w-6 h-6 animate-spin mx-auto text-green-600" /></div>
        ) : visible.length === 0 ? (
          !error && (
            <p className="text-sm text-gray-500 text-center py-6">
              {scope === 'me' ? 'You have not logged any duties for this day yet.' : 'Nothing logged for this day yet.'}
            </p>
          )
        ) : (
          <div className="space-y-2">
            {visible.map(log => (
              <div key={log.id} className="border border-gray-100 rounded-lg px-3 py-2 flex flex-wrap items-start gap-2">
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-gray-900">
                    {log.duty_label || dutyLabel(log.duty_type)}
                    {log.quantity > 1 && <span className="ml-1 text-green-700">×{log.quantity}</span>}
                  </p>
                  <p className="text-xs text-gray-500">
                    {scope === 'everyone' && <span className="font-medium text-gray-600">{log.user_name || 'Unknown'} · </span>}
                    {[log.hospital_number, log.location].filter(Boolean).join(' · ') || '—'}
                  </p>
                  {editId === log.id ? (
                    <div className="flex flex-wrap items-center gap-2 mt-2">
                      <input
                        type="number" min={1} max={200} value={editQty}
                        onChange={e => setEditQty(Math.max(1, Math.min(200, parseInt(e.target.value || '1', 10))))}
                        className="w-20 border rounded px-2 py-1 text-sm"
                      />
                      <input
                        value={editNotes}
                        onChange={e => setEditNotes(e.target.value)}
                        placeholder="Notes"
                        className="flex-1 min-w-[8rem] border rounded px-2 py-1 text-sm"
                      />
                      <button onClick={() => saveEdit(log)} className="px-2 py-1 text-xs rounded bg-green-600 text-white inline-flex items-center gap-1">
                        <Save className="w-3 h-3" /> Save
                      </button>
                      <button onClick={() => setEditId(null)} className="px-2 py-1 text-xs rounded border">
                        <X className="w-3 h-3" />
                      </button>
                    </div>
                  ) : (
                    log.notes && <p className="text-xs text-gray-600 mt-0.5">{log.notes}</p>
                  )}
                </div>
                {canEdit(log) && editId !== log.id && (
                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => { setEditId(log.id!); setEditQty(log.quantity || 1); setEditNotes(log.notes || ''); }}
                      className="p-1.5 text-blue-600 hover:bg-blue-50 rounded" title="Edit"
                    >
                      <Edit3 className="w-3.5 h-3.5" />
                    </button>
                    <button onClick={() => remove(log)} className="p-1.5 text-red-600 hover:bg-red-50 rounded" title="Delete">
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ── Totals ─────────────────────────────────────────────────────── */}
      <div className="bg-white rounded-xl shadow-sm border p-4">
        <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
          <h2 className="text-sm font-semibold text-gray-800 flex items-center gap-2">
            <BarChart3 className="w-4 h-4 text-green-600" /> Totals
          </h2>
          <div className="flex rounded-lg border overflow-hidden">
            {(['day', 'week', 'month'] as const).map(r => (
              <button
                key={r}
                onClick={() => setSummaryRange(r)}
                className={`px-3 py-1.5 text-xs font-medium ${summaryRange === r ? 'bg-green-600 text-white' : 'bg-white text-gray-600'}`}
              >
                {r === 'day' ? 'This day' : r === 'week' ? 'Last 7 days' : 'Last 30 days'}
              </button>
            ))}
          </div>
        </div>

        {summaryLoading ? (
          <div className="py-6 text-center"><Loader2 className="w-5 h-5 animate-spin mx-auto text-green-600" /></div>
        ) : !summary || summary.byUser.length === 0 ? (
          <p className="text-sm text-gray-500 text-center py-4">Nothing logged in this period.</p>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <p className="text-xs font-medium text-gray-500 uppercase tracking-wider mb-2">By staff member</p>
              <div className="space-y-1">
                {summary.byUser.map(u => (
                  <div key={u.user_id} className="flex items-center justify-between text-sm border-b border-gray-50 py-1">
                    <span className="text-gray-800 truncate">
                      {u.user_name || 'Unknown'}
                      <span className="text-xs text-gray-400 ml-1">{(u.user_role || '').replace(/_/g, ' ')}</span>
                    </span>
                    <span className="font-semibold text-green-700 flex-shrink-0">
                      {u.total}
                      {summaryRange !== 'day' && <span className="text-xs font-normal text-gray-400 ml-1">/ {u.days_logged}d</span>}
                    </span>
                  </div>
                ))}
              </div>
            </div>
            <div>
              <p className="text-xs font-medium text-gray-500 uppercase tracking-wider mb-2">By duty</p>
              <div className="space-y-1">
                {summary.byDuty.map(d => (
                  <div key={`${d.duty_type}-${d.duty_label}`} className="flex items-center justify-between text-sm border-b border-gray-50 py-1">
                    <span className="text-gray-800 truncate">{d.duty_label || dutyLabel(d.duty_type)}</span>
                    <span className="font-semibold text-gray-700 flex-shrink-0">{d.total}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>

      {isToday && myCount > 0 && (
        <p className="text-xs text-green-700 flex items-center gap-1 justify-center">
          <CheckCircle2 className="w-3.5 h-3.5" /> Your duties for today are logged.
        </p>
      )}
    </div>
  );
}
