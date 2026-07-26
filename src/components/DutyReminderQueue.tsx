import React, { useCallback, useEffect, useState } from 'react';
import {
  ListChecks, Send, Check, Loader2, AlertTriangle, Play, RefreshCw, Clock,
} from 'lucide-react';
import toast from 'react-hot-toast';
import { dutyReminderService, QueuedReminder, ReminderKind, ReminderStatus } from '../services/dutyReminderService';

/**
 * The day's reminder run.
 *
 * A scheduled run builds one message per person with admitted patients. Where a
 * messaging provider is configured they are delivered outright; where none is —
 * which is the case until credentials are set — they queue here with a WhatsApp
 * link so someone can send them in a few taps and mark them done. The queue is
 * deliberately explicit about which of the two happened: a reminder shown as
 * "sent" always was.
 */
const DutyReminderQueue: React.FC = () => {
  const [reminders, setReminders] = useState<QueuedReminder[]>([]);
  const [status, setStatus] = useState<ReminderStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [running, setRunning] = useState<ReminderKind | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [date, setDate] = useState<string>('');

  const load = useCallback(async (d?: string) => {
    setLoading(true);
    setError(null);
    try {
      const res = await dutyReminderService.queue(d);
      setReminders(res.reminders || []);
      setDate(res.date);
    } catch (e: any) {
      setError(e?.message?.replace(/^\[HTTP \d+\]\s*/, '') || 'Could not load the reminder queue.');
      setReminders([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
    dutyReminderService.status().then(setStatus).catch(() => {});
  }, [load]);

  const runNow = async (kind: ReminderKind) => {
    const label = kind === 'weekly' ? 'Monday/Friday review' : 'daily house-officer';
    if (!window.confirm(
      `Build the ${label} reminders for everyone with admitted patients?\n\n` +
      (status?.canDeliver
        ? 'They will be delivered on WhatsApp straight away.'
        : 'No messaging provider is configured, so they will queue here with WhatsApp links for you to send.')
    )) return;
    setRunning(kind);
    try {
      const r = await dutyReminderService.run(kind);
      if (r?.skipped) toast(r.reason || 'Nothing due today');
      else {
        toast.success(
          `${r.created} reminder(s) built` +
          (r.delivered ? `, ${r.delivered} delivered` : '') +
          (r.pending ? `, ${r.pending} waiting to be sent` : '') +
          (r.duplicate ? ` (${r.duplicate} already existed today)` : '')
        );
      }
      await load(date);
    } catch (e: any) {
      toast.error(e?.message?.replace(/^\[HTTP \d+\]\s*/, '') || 'Could not run the reminders');
    } finally {
      setRunning(null);
    }
  };

  const markSent = async (r: QueuedReminder) => {
    try {
      await dutyReminderService.markSent(r.id);
      setReminders(list => list.map(x => (x.id === r.id ? { ...x, status: 'sent' } : x)));
    } catch (e: any) {
      toast.error(e?.message?.replace(/^\[HTTP \d+\]\s*/, '') || 'Could not update the reminder');
    }
  };

  const pending = reminders.filter(r => r.status === 'pending');
  const sent = reminders.filter(r => r.status === 'sent');
  const failed = reminders.filter(r => r.status === 'failed');

  return (
    <div className="bg-white rounded-xl shadow-sm border p-4 mb-4">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-3">
        <div>
          <h3 className="text-sm sm:text-base font-semibold text-gray-800 flex items-center gap-2">
            <ListChecks className="w-4 h-4 text-green-600" /> Reminder Run
            {date && <span className="text-xs font-normal text-gray-400">{date}</span>}
          </h3>
          <p className="text-xs text-gray-500 mt-0.5">
            {status?.canDeliver
              ? `Delivered automatically via ${status.provider}.`
              : 'Built here and sent by hand — no messaging provider is configured yet.'}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            onClick={() => runNow('weekly')}
            disabled={!!running}
            className="px-3 py-1.5 text-xs font-medium rounded-lg bg-amber-500 text-white hover:bg-amber-600 disabled:opacity-50 inline-flex items-center gap-1"
          >
            {running === 'weekly' ? <Loader2 className="w-3 h-3 animate-spin" /> : <Play className="w-3 h-3" />}
            Run Mon/Fri review
          </button>
          <button
            onClick={() => runNow('daily')}
            disabled={!!running}
            className="px-3 py-1.5 text-xs font-medium rounded-lg bg-green-600 text-white hover:bg-green-700 disabled:opacity-50 inline-flex items-center gap-1"
          >
            {running === 'daily' ? <Loader2 className="w-3 h-3 animate-spin" /> : <Play className="w-3 h-3" />}
            Run daily HO
          </button>
          <button
            onClick={() => load(date)}
            disabled={loading}
            className="px-2.5 py-1.5 text-xs rounded-lg border text-gray-600 hover:bg-gray-50 disabled:opacity-50"
          >
            <RefreshCw className={`w-3 h-3 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {error && (
        <div className="flex items-start gap-2 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2 mb-3">
          <AlertTriangle className="w-4 h-4 text-amber-600 flex-shrink-0 mt-0.5" />
          <p className="text-xs text-amber-800">
            {error}
            <button onClick={() => load(date)} className="ml-2 underline font-medium">Retry</button>
          </p>
        </div>
      )}

      {loading ? (
        <div className="py-6 text-center"><Loader2 className="w-5 h-5 animate-spin mx-auto text-green-600" /></div>
      ) : reminders.length === 0 ? (
        <p className="text-sm text-gray-500 text-center py-5">
          Nothing built for this day yet. Use the buttons above, or wait for the scheduled run.
        </p>
      ) : (
        <>
          <div className="flex flex-wrap gap-2 text-xs mb-3">
            {pending.length > 0 && (
              <span className="px-2 py-0.5 rounded-full bg-amber-100 text-amber-800 font-medium">{pending.length} to send</span>
            )}
            {sent.length > 0 && (
              <span className="px-2 py-0.5 rounded-full bg-green-100 text-green-800 font-medium">{sent.length} sent</span>
            )}
            {failed.length > 0 && (
              <span className="px-2 py-0.5 rounded-full bg-red-100 text-red-700 font-medium">{failed.length} failed</span>
            )}
          </div>

          <div className="space-y-2">
            {reminders.map(r => (
              <div
                key={r.id}
                className={`border rounded-lg px-3 py-2 flex flex-wrap items-center gap-2 ${
                  r.status === 'sent' ? 'border-green-200 bg-green-50/40'
                    : r.status === 'failed' ? 'border-red-200 bg-red-50/40' : 'border-gray-200'
                }`}
              >
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-gray-900 truncate">
                    {r.user_name}
                    <span className="ml-1 text-xs font-normal text-gray-500">
                      {(r.user_role || '').replace(/_/g, ' ')} · {r.patient_count} patient(s)
                    </span>
                  </p>
                  <p className="text-[11px] text-gray-500">
                    {r.kind === 'weekly' ? 'Mon/Fri review' : 'Daily update'}
                    {r.phone ? ` · ${r.phone}` : ' · no phone on file'}
                    {r.error_message ? ` · ${r.error_message}` : ''}
                  </p>
                </div>
                {r.status === 'sent' ? (
                  <span className="text-xs text-green-700 font-medium inline-flex items-center gap-1">
                    <Check className="w-3.5 h-3.5" /> sent
                  </span>
                ) : (
                  <div className="flex items-center gap-1">
                    {r.whatsapp_link && (
                      <a
                        href={r.whatsapp_link}
                        target="_blank"
                        rel="noopener noreferrer"
                        onClick={() => setTimeout(() => markSent(r), 1200)}
                        className="px-2.5 py-1.5 text-xs font-medium rounded-lg bg-green-600 text-white hover:bg-green-700 inline-flex items-center gap-1"
                      >
                        <Send className="w-3 h-3" /> Send
                      </a>
                    )}
                    <button
                      onClick={() => markSent(r)}
                      className="px-2.5 py-1.5 text-xs rounded-lg border text-gray-600 hover:bg-gray-50 inline-flex items-center gap-1"
                      title="Mark as sent without opening WhatsApp"
                    >
                      <Clock className="w-3 h-3" /> Mark done
                    </button>
                  </div>
                )}
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
};

export default DutyReminderQueue;
