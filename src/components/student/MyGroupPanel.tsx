/**
 * The student's posting group, and what it has been asked to do.
 *
 * A student on a clinical posting works as part of a group: the patients are
 * assigned to the group, the topic is presented by the group, and the four
 * required activities are ticked off by the group. Their own dashboard showed
 * none of it, so a student could see their clerkings and still not know which
 * patients were theirs to clerk, what topic they were presenting, or how close
 * the group was to signing out.
 *
 * The activities and their targets are the same four Training Admin tracks,
 * read from the same tables, so the student's view and the administrator's
 * cannot disagree about whether something has been done.
 */

import { useState, useEffect, useCallback } from 'react';
import {
  Users, Loader2, CheckCircle2, Circle, ClipboardList, User,
  RefreshCw, CalendarCheck,
} from 'lucide-react';
import { learningContentService } from '../../services/learningContentService';

interface GroupProgress {
  type: string;
  label: string;
  target: number;
  done: number;
  met: boolean;
}

interface GroupData {
  inGroup: boolean;
  student?: { full_name?: string; group_number?: number | null; surgery_level?: string | null };
  group?: { group_number: number; topic_title?: string | null; topic_presented?: boolean };
  members?: { id: number; full_name: string; is_me: boolean }[];
  patients?: { patient_id: string; hospital_number?: string; patient_name?: string }[];
  activities?: { activity_type: string; title?: string; patient_name?: string; activity_date?: string }[];
  progress?: GroupProgress[];
  complete?: boolean;
}

export function MyGroupPanel({ className = '' }: { className?: string }) {
  const [data, setData] = useState<GroupData | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setData(await learningContentService.myGroup());
    } catch {
      setData(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  if (loading) {
    return (
      <div className={`bg-white border rounded-xl p-4 flex items-center gap-2 text-sm text-gray-500 ${className}`}>
        <Loader2 className="w-4 h-4 animate-spin" /> Loading your group…
      </div>
    );
  }

  // A dashboard that cannot reach the server is still a usable dashboard.
  if (!data) return null;

  if (!data.inGroup) {
    return (
      <div className={`bg-white border rounded-xl p-4 ${className}`}>
        <h3 className="text-sm font-semibold text-gray-800 flex items-center gap-2 mb-1">
          <Users className="w-4 h-4 text-gray-400" /> Your group
        </h3>
        <p className="text-sm text-gray-500">
          You have not been placed in a posting group yet. An administrator assigns
          the groups, and your patients and topic arrive with it.
        </p>
      </div>
    );
  }

  const done = data.progress?.filter((p) => p.met).length ?? 0;
  const total = data.progress?.length ?? 0;

  return (
    <section className={`bg-white border rounded-xl overflow-hidden ${className}`}>
      <header className="flex items-center justify-between gap-3 px-4 py-3 border-b bg-gray-50">
        <h3 className="text-sm font-semibold text-gray-800 flex items-center gap-2">
          <Users className="w-4 h-4 text-green-600" />
          Group {data.group?.group_number}
          <span className="font-normal text-gray-500">
            · {data.members?.length ?? 0} students · {data.patients?.length ?? 0} patients
          </span>
        </h3>
        <div className="flex items-center gap-2">
          <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${
            data.complete ? 'bg-green-100 text-green-700' : 'bg-amber-100 text-amber-800'
          }`}>
            {done}/{total} activities
          </span>
          <button onClick={load} className="p-1 rounded hover:bg-gray-200 text-gray-400" title="Reload">
            <RefreshCw className="w-3.5 h-3.5" />
          </button>
        </div>
      </header>

      <div className="p-4 space-y-4">
        {/* The topic, which is the group's own piece of work */}
        <div>
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">Topic</p>
          {data.group?.topic_title ? (
            <p className="text-sm text-gray-800 flex items-center gap-2">
              {data.group.topic_presented
                ? <CheckCircle2 className="w-4 h-4 text-green-600 shrink-0" />
                : <Circle className="w-4 h-4 text-gray-300 shrink-0" />}
              {data.group.topic_title}
              {data.group.topic_presented && (
                <span className="text-xs text-green-700">presented</span>
              )}
            </p>
          ) : (
            <p className="text-sm text-gray-400">No topic set for your group yet.</p>
          )}
        </div>

        {/* What the group still owes */}
        {data.progress && data.progress.length > 0 && (
          <div>
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">
              Required activities
            </p>
            <ul className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
              {data.progress.map((p) => (
                <li
                  key={p.type}
                  className={`flex items-center justify-between gap-2 px-2.5 py-1.5 rounded-lg text-sm border ${
                    p.met ? 'bg-green-50 border-green-200 text-green-900'
                          : 'bg-gray-50 border-gray-200 text-gray-700'
                  }`}
                >
                  <span className="flex items-center gap-1.5 min-w-0">
                    {p.met
                      ? <CheckCircle2 className="w-3.5 h-3.5 shrink-0 text-green-600" />
                      : <Circle className="w-3.5 h-3.5 shrink-0 text-gray-300" />}
                    <span className="truncate">{p.label}</span>
                  </span>
                  <span className="text-xs tabular-nums shrink-0">{p.done}/{p.target}</span>
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* The patients the group is responsible for */}
        <div>
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5 flex items-center gap-1.5">
            <ClipboardList className="w-3.5 h-3.5" /> Patients assigned to your group
          </p>
          {data.patients?.length ? (
            <ul className="divide-y border rounded-lg">
              {data.patients.map((p) => (
                <li key={p.patient_id} className="px-3 py-2 flex items-center justify-between gap-2 text-sm">
                  <span className="truncate text-gray-800">{p.patient_name || 'Patient'}</span>
                  <span className="text-xs text-gray-400 shrink-0">{p.hospital_number}</span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-gray-400">No patients assigned to your group yet.</p>
          )}
        </div>

        {/* Who else is in it */}
        <div>
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5 flex items-center gap-1.5">
            <User className="w-3.5 h-3.5" /> Your group
          </p>
          <div className="flex flex-wrap gap-1.5">
            {data.members?.map((m) => (
              <span
                key={m.id}
                className={`px-2 py-0.5 rounded-full text-xs ${
                  m.is_me ? 'bg-green-600 text-white font-medium' : 'bg-gray-100 text-gray-700'
                }`}
              >
                {m.full_name}{m.is_me ? ' (you)' : ''}
              </span>
            ))}
          </div>
        </div>

        {/* What has actually been logged, most recent first */}
        {data.activities && data.activities.length > 0 && (
          <div>
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5 flex items-center gap-1.5">
              <CalendarCheck className="w-3.5 h-3.5" /> Recently logged
            </p>
            <ul className="space-y-1">
              {data.activities.slice(0, 5).map((a, i) => (
                <li key={`${a.activity_type}-${i}`} className="text-xs text-gray-600 flex items-baseline gap-2">
                  <span className="w-1 h-1 rounded-full bg-gray-300 shrink-0 mt-1.5" />
                  <span className="truncate">
                    {a.title || a.activity_type.replace(/_/g, ' ')}
                    {a.patient_name ? ` · ${a.patient_name}` : ''}
                    {a.activity_date ? ` · ${new Date(a.activity_date).toLocaleDateString()}` : ''}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </section>
  );
}

export default MyGroupPanel;
