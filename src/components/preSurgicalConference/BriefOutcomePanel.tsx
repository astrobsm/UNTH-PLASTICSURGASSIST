/**
 * What the room decided, and who is doing it.
 *
 * The briefing itself was already built; this is the half that outlives it. The
 * four plans are recorded against the patient, a consultant records the
 * clearance decision, and the jobs that come out of the meeting are assigned to
 * named people and tracked to completion — which is the difference between a
 * handover and a conversation.
 *
 * Plans save on blur rather than on every keystroke: this is typed during a
 * meeting, and a request per character would both hammer the ward connection
 * and lose the last words when someone closes the laptop.
 */

import { useCallback, useEffect, useState } from 'react';
import {
  AlertTriangle, CheckCircle2, ClipboardList, Download, Loader2, Plus, ShieldCheck, XCircle,
} from 'lucide-react';
import {
  preSurgicalBriefService,
  BRIEF_PHASES,
  BRIEF_TASK_STATUSES,
  type BriefOutcome,
  type BriefPhase,
  type BriefTask,
  type BriefTaskStatus,
} from '../../services/preSurgicalBriefService';
import type { ConferenceData } from '../../services/preSurgicalConferenceService';
import { downloadBriefPptx } from '../../services/preSurgicalBriefPptx';
import { useAuthStore } from '../../store/authStore';

interface Props {
  patientId: string;
  conferenceData: ConferenceData;
}

const PLAN_FIELDS: { key: keyof BriefOutcome & string; label: string; hint: string }[] = [
  { key: 'preop_plan', label: 'Pre-operative care', hint: 'Optimisation, fasting, consent, blood, prophylaxis' },
  { key: 'intraop_plan', label: 'Intra-operative plan', hint: 'Approach, positioning, technique, instruments' },
  { key: 'contingency_plan', label: 'Contingency', hint: 'What we do if the plan does not hold' },
  { key: 'postop_plan', label: 'Post-operative plan', hint: 'Destination, analgesia, dressings, follow-up' },
];

export default function BriefOutcomePanel({ patientId, conferenceData }: Props) {
  const { user } = useAuthStore();
  const mayClear = user?.role === 'consultant' || user?.role === 'admin';

  const [brief, setBrief] = useState<BriefOutcome | null>(null);
  const [tasks, setTasks] = useState<BriefTask[]>([]);
  const [loading, setLoading] = useState(true);
  const [savingField, setSavingField] = useState<string | null>(null);
  const [error, setError] = useState('');
  const [exporting, setExporting] = useState(false);
  const [exportNote, setExportNote] = useState('');

  // Local copies so typing is not fighting a round trip.
  const [drafts, setDrafts] = useState<Record<string, string>>({});

  const [newTask, setNewTask] = useState('');
  const [newPhase, setNewPhase] = useState<BriefPhase>('postop');
  const [newAssignee, setNewAssignee] = useState<string>('');

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const bundle = await preSurgicalBriefService.get(patientId);
      setBrief(bundle.brief);
      setTasks(bundle.tasks);
      setDrafts({
        preop_plan: bundle.brief?.preop_plan || '',
        intraop_plan: bundle.brief?.intraop_plan || '',
        contingency_plan: bundle.brief?.contingency_plan || '',
        postop_plan: bundle.brief?.postop_plan || '',
      });
    } catch {
      setError('Could not load the brief for this patient.');
    } finally {
      setLoading(false);
    }
  }, [patientId]);

  useEffect(() => { void load(); }, [load]);

  const savePlan = async (key: string) => {
    const value = drafts[key] ?? '';
    if ((brief?.[key as keyof BriefOutcome] ?? '') === value) return; // nothing changed
    setSavingField(key);
    setError('');
    try {
      const bundle = await preSurgicalBriefService.savePlans(patientId, { [key]: value });
      setBrief(bundle.brief);
    } catch {
      setError('That change could not be saved. It is still on screen — try again.');
    } finally {
      setSavingField(null);
    }
  };

  const addTask = async () => {
    const description = newTask.trim();
    if (!description) return;
    setError('');
    try {
      await preSurgicalBriefService.addTask(patientId, {
        description,
        phase: newPhase,
        assigned_to: newAssignee ? Number(newAssignee) : null,
      });
      setNewTask('');
      setNewAssignee('');
      await load();
    } catch {
      setError('The task could not be created.');
    }
  };

  const setStatus = async (task: BriefTask, status: BriefTaskStatus) => {
    // Optimistic: the list is long and a round trip per tick makes it feel dead.
    setTasks(prev => prev.map(t => (t.id === task.id ? { ...t, status } : t)));
    try {
      const res = await preSurgicalBriefService.updateTask(patientId, task.id, { status });
      if (res.tasks) setTasks(res.tasks);
    } catch {
      setError('That status change did not save.');
      await load();
    }
  };

  const recordClearance = async (cleared: boolean) => {
    setError('');
    try {
      const bundle = await preSurgicalBriefService.approve(patientId, cleared);
      setBrief(bundle.brief);
      setTasks(bundle.tasks);
    } catch {
      setError('Only a consultant or administrator may record a clearance decision.');
    }
  };

  const exportDeck = async () => {
    setExporting(true);
    setExportNote('');
    try {
      const result = await downloadBriefPptx(conferenceData, {
        outcome: brief,
        preparedBy: user?.full_name || user?.name || undefined,
      });
      setExportNote(
        result.omittedPhotographs > 0
          ? `Downloaded. ${result.omittedPhotographs} photograph(s) could not be embedded and are marked in the deck.`
          : 'Downloaded.'
      );
    } catch {
      setExportNote('The PowerPoint could not be generated.');
    } finally {
      setExporting(false);
    }
  };

  const team = conferenceData.preparingTeam || [];
  const byPhase = (p: BriefPhase) => tasks.filter(t => t.phase === p);
  const outstanding = tasks.filter(t => t.status !== 'done' && t.status !== 'cancelled').length;

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h3 className="text-lg font-semibold text-gray-800 flex items-center gap-2">
          <ClipboardList className="w-5 h-5 text-green-700" />
          Brief Decisions &amp; Plan
        </h3>
        <button
          onClick={exportDeck}
          disabled={exporting}
          className="inline-flex items-center gap-2 px-4 py-2 bg-green-700 hover:bg-green-800 text-white rounded-lg text-sm font-medium disabled:opacity-50"
        >
          {exporting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
          Export PowerPoint
        </button>
      </div>

      {exportNote && <p className="text-sm text-gray-600">{exportNote}</p>}
      {error && (
        <p className="text-sm text-red-600 flex items-center gap-2">
          <AlertTriangle className="w-4 h-4" /> {error}
        </p>
      )}

      {loading ? (
        <div className="flex items-center gap-2 text-gray-500 py-6">
          <Loader2 className="w-4 h-4 animate-spin" /> Loading the brief…
        </div>
      ) : (
        <>
          {/* ── The four plans ── */}
          <div className="grid gap-4 md:grid-cols-2">
            {PLAN_FIELDS.map(f => (
              <div key={f.key}>
                <label htmlFor={`plan-${f.key}`} className="block text-sm font-medium text-gray-700">
                  {f.label}
                  {savingField === f.key && <span className="ml-2 text-xs text-gray-400">saving…</span>}
                </label>
                <p className="text-xs text-gray-400 mb-1">{f.hint}</p>
                <textarea
                  id={`plan-${f.key}`}
                  rows={3}
                  value={drafts[f.key] ?? ''}
                  onChange={e => setDrafts(d => ({ ...d, [f.key]: e.target.value }))}
                  onBlur={() => savePlan(f.key)}
                  placeholder="Not documented"
                  className="w-full text-sm border border-gray-300 rounded-lg p-2 focus:ring-2 focus:ring-green-600 focus:border-green-600"
                />
              </div>
            ))}
          </div>

          {/* ── Clearance ── */}
          <div className="border-t pt-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h4 className="text-sm font-semibold text-gray-700 flex items-center gap-2">
                  <ShieldCheck className="w-4 h-4 text-gray-500" /> Clearance for surgery
                </h4>
                {brief?.approved_at ? (
                  <p className={`text-sm mt-1 font-medium ${brief.cleared_for_surgery ? 'text-green-700' : 'text-red-700'}`}>
                    {brief.cleared_for_surgery ? 'Cleared' : 'Not cleared'} by{' '}
                    {brief.approved_by_name || 'a consultant'} on{' '}
                    {new Date(brief.approved_at).toLocaleString()}
                  </p>
                ) : (
                  <p className="text-sm text-gray-500 mt-1">No decision recorded yet.</p>
                )}
              </div>

              {mayClear ? (
                <div className="flex gap-2">
                  <button
                    onClick={() => recordClearance(true)}
                    className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium bg-green-600 hover:bg-green-700 text-white"
                  >
                    <CheckCircle2 className="w-4 h-4" /> Clear
                  </button>
                  <button
                    onClick={() => recordClearance(false)}
                    className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium bg-red-600 hover:bg-red-700 text-white"
                  >
                    <XCircle className="w-4 h-4" /> Do not clear
                  </button>
                </div>
              ) : (
                // Shown rather than hidden, so the team can see the decision is
                // owed and who owes it.
                <p className="text-xs text-gray-500 max-w-xs">
                  A consultant records this decision.
                </p>
              )}
            </div>
          </div>

          {/* ── Tasks ── */}
          <div className="border-t pt-4">
            <h4 className="text-sm font-semibold text-gray-700 mb-3">
              Assigned tasks
              {outstanding > 0 && (
                <span className="ml-2 text-xs font-normal text-amber-700 bg-amber-50 border border-amber-200 rounded-full px-2 py-0.5">
                  {outstanding} outstanding
                </span>
              )}
            </h4>

            <div className="flex flex-wrap gap-2 mb-4">
              <input
                value={newTask}
                onChange={e => setNewTask(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); void addTask(); } }}
                placeholder="What needs doing?"
                className="flex-1 min-w-[12rem] text-sm border border-gray-300 rounded-lg px-3 py-2"
              />
              <select
                value={newPhase}
                onChange={e => setNewPhase(e.target.value as BriefPhase)}
                className="text-sm border border-gray-300 rounded-lg px-2 py-2"
                aria-label="Phase"
              >
                {BRIEF_PHASES.map(p => <option key={p.value} value={p.value}>{p.label}</option>)}
              </select>
              <select
                value={newAssignee}
                onChange={e => setNewAssignee(e.target.value)}
                className="text-sm border border-gray-300 rounded-lg px-2 py-2"
                aria-label="Assign to"
              >
                <option value="">Unassigned</option>
                {team.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
              </select>
              <button
                onClick={addTask}
                disabled={!newTask.trim()}
                className="inline-flex items-center gap-1.5 px-3 py-2 bg-green-700 hover:bg-green-800 text-white rounded-lg text-sm disabled:opacity-40"
              >
                <Plus className="w-4 h-4" /> Add
              </button>
            </div>

            {tasks.length === 0 ? (
              <p className="text-sm text-gray-400">No tasks yet.</p>
            ) : (
              <div className="space-y-4">
                {BRIEF_PHASES.map(phase => {
                  const list = byPhase(phase.value);
                  if (!list.length) return null;
                  return (
                    <div key={phase.value}>
                      <p className="text-xs uppercase tracking-wide text-gray-400 mb-1">{phase.label}</p>
                      <ul className="divide-y border rounded-lg">
                        {list.map(t => (
                          <li key={t.id} className="flex flex-wrap items-center gap-2 px-3 py-2">
                            <span className={`flex-1 min-w-[10rem] text-sm ${
                              t.status === 'done' ? 'line-through text-gray-400'
                                : t.status === 'cancelled' ? 'text-gray-400' : 'text-gray-800'
                            }`}>
                              {t.description}
                            </span>
                            <span className="text-xs text-gray-500">
                              {t.assigned_to_name || 'Unassigned'}
                            </span>
                            <select
                              value={t.status}
                              onChange={e => setStatus(t, e.target.value as BriefTaskStatus)}
                              aria-label={`Status of: ${t.description}`}
                              className="text-xs border border-gray-300 rounded px-2 py-1"
                            >
                              {BRIEF_TASK_STATUSES.map(s => (
                                <option key={s.value} value={s.value}>{s.label}</option>
                              ))}
                            </select>
                          </li>
                        ))}
                      </ul>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
