import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { AlertTriangle, Award, CheckCircle, Copy, MessageCircle, RefreshCw, UserX } from 'lucide-react';
import { dutyReminderService, ChasePerson, ChaseReport } from '../services/dutyReminderService';
import { normalizeForWhatsApp } from './PhoneActions';

/**
 * Duty chase & commendation for senior registrars, registrars and house
 * officers. The server works out what was missed (Monday/Friday written
 * reviews, HO morning rounds, clinic duties, overdue assigned duties) and what
 * was done, and drafts the message. Nothing is sent automatically: the button
 * opens WhatsApp with the (editable) message, and the send is recorded.
 */

type Preset = 'last7' | 'thisWeek' | 'lastWeek' | 'last14';
const PRESETS: { key: Preset; label: string }[] = [
  { key: 'last7', label: 'Last 7 days' },
  { key: 'thisWeek', label: 'This week' },
  { key: 'lastWeek', label: 'Last week' },
  { key: 'last14', label: 'Last 14 days' },
];

/** Today in Africa/Lagos as YYYY-MM-DD. */
const watToday = () => new Intl.DateTimeFormat('en-CA', { timeZone: 'Africa/Lagos' }).format(new Date());
const shift = (ymd: string, days: number) => {
  const d = new Date(`${ymd}T00:00:00Z`); d.setUTCDate(d.getUTCDate() + days); return d.toISOString().slice(0, 10);
};

export function presetRange(p: Preset, today = watToday()): { from: string; to: string } {
  const wd = (new Date(`${today}T00:00:00Z`).getUTCDay() + 6) % 7; // Monday = 0
  const monday = shift(today, -wd);
  switch (p) {
    case 'thisWeek': return { from: monday, to: shift(today, -1) };
    case 'lastWeek': return { from: shift(monday, -7), to: shift(monday, -1) };
    case 'last14': return { from: shift(today, -14), to: shift(today, -1) };
    default: return { from: shift(today, -7), to: shift(today, -1) };
  }
}

const fmt = (ymd: string) => new Date(`${ymd}T00:00:00Z`).toLocaleDateString('en-GB', { timeZone: 'UTC', weekday: 'short', day: 'numeric', month: 'short' });

const DutyChasePanel: React.FC = () => {
  const [preset, setPreset] = useState<Preset>('last7');
  const [report, setReport] = useState<ChaseReport | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [sent, setSent] = useState<Record<string, string>>({});
  const [open, setOpen] = useState<string | null>(null);
  const [gradeFilter, setGradeFilter] = useState<'all' | ChasePerson['grade']>('all');

  const load = useCallback(async () => {
    setLoading(true); setError(null);
    try {
      const { from, to } = presetRange(preset);
      if (to < from) { setReport({ from, to, reviewDays: [], people: [] }); return; }
      const r = await dutyReminderService.chasePreview(from, to);
      setReport(r);
      setDrafts(Object.fromEntries(r.people.map(p => [p.id, p.message])));
    } catch (e: any) {
      setError(e?.message || 'Could not load the duty record');
    } finally { setLoading(false); }
  }, [preset]);

  useEffect(() => { load(); }, [load]);

  const people = useMemo(() => (report?.people || []).filter(p => gradeFilter === 'all' || p.grade === gradeFilter), [report, gradeFilter]);
  const groups = useMemo(() => ([
    { key: 'chase', title: 'Needs a chase', icon: AlertTriangle, tone: 'text-red-700', rows: people.filter(p => p.verdict === 'chase') },
    { key: 'commend', title: 'Commend', icon: Award, tone: 'text-green-700', rows: people.filter(p => p.verdict === 'commend') },
    { key: 'no_record', title: 'Nothing recorded in this period', icon: UserX, tone: 'text-gray-500', rows: people.filter(p => p.verdict === 'no_record') },
  ]), [people]);

  const send = async (p: ChasePerson) => {
    const message = (drafts[p.id] ?? p.message).trim();
    if (!p.phone || !message) return;
    const kind = p.verdict === 'commend' ? 'commend' : 'chase';
    window.open(`https://wa.me/${normalizeForWhatsApp(p.phone)}?text=${encodeURIComponent(message)}`, '_blank', 'noopener');
    try {
      await dutyReminderService.chaseRecord(p.id, kind, message);
      setSent(s => ({ ...s, [p.id]: kind }));
    } catch (e: any) {
      setError(`WhatsApp opened, but the send was not recorded: ${e?.message || 'error'}`);
    }
  };

  const copy = async (p: ChasePerson) => {
    try { await navigator.clipboard.writeText(drafts[p.id] ?? p.message); } catch { /* clipboard blocked */ }
  };

  const summary = (p: ChasePerson) => {
    const bits: string[] = [];
    if (p.reviews.expected) bits.push(`Mon/Fri reviews ${p.reviews.done}/${p.reviews.expected}`);
    if (p.morning?.expected) bits.push(`Morning rounds ${p.morning.done}/${p.morning.expected}`);
    if (p.clinic.missed.length) bits.push(`${p.clinic.missed.length} clinic missed`);
    if (p.overdue.length) bits.push(`${p.overdue.length} overdue duty`);
    if (p.notes) bits.push(`${p.notes} notes`);
    if (p.calls) bits.push(`${p.calls} call`);
    return bits.join(' · ') || `${p.patientsHeld} patients held`;
  };

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-4 space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
        <div>
          <h2 className="font-semibold text-clinical-dark flex items-center gap-2">
            <MessageCircle className="h-5 w-5 text-green-600" /> Duty chase &amp; commendation
          </h2>
          <p className="text-xs text-gray-500">
            Senior registrars, registrars and house officers. Built from Mon/Fri ward-round notes, HO morning rounds, clinic duties and assigned duties.
            {report && ` ${fmt(report.from)} – ${fmt(report.to)}.`} Leave days are excluded.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <select value={preset} onChange={e => setPreset(e.target.value as Preset)} className="text-sm border rounded-lg px-2 py-1.5">
            {PRESETS.map(p => <option key={p.key} value={p.key}>{p.label}</option>)}
          </select>
          <select value={gradeFilter} onChange={e => setGradeFilter(e.target.value as any)} className="text-sm border rounded-lg px-2 py-1.5">
            <option value="all">All grades</option>
            <option value="senior_registrar">Senior Registrars</option>
            <option value="registrar">Registrars</option>
            <option value="house_officer">House Officers</option>
          </select>
          <button onClick={load} disabled={loading} className="flex items-center gap-1 px-3 py-1.5 text-sm bg-gray-100 hover:bg-gray-200 rounded-lg">
            <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} /> Refresh
          </button>
        </div>
      </div>

      {error && <div className="bg-red-50 text-red-700 px-3 py-2 rounded-lg text-sm">{error}</div>}
      {loading && !report && <div className="text-sm text-gray-500">Checking duty records…</div>}
      {report && report.to < report.from && <div className="text-sm text-gray-500">No completed days in this period yet — pick another period.</div>}

      {report && groups.map(g => g.rows.length > 0 && (
        <div key={g.key} className="space-y-2">
          <h3 className={`text-sm font-semibold flex items-center gap-1 ${g.tone}`}><g.icon className="h-4 w-4" /> {g.title} ({g.rows.length})</h3>
          {g.rows.map(p => (
            <div key={p.id} className="border rounded-lg">
              <div className="flex flex-col sm:flex-row sm:items-center gap-2 p-3">
                <button className="flex-1 text-left min-w-0" onClick={() => setOpen(open === p.id ? null : p.id)}>
                  <div className="font-medium text-sm truncate">{p.name} <span className="text-xs text-gray-500">· {p.gradeLabel}</span></div>
                  <div className="text-xs text-gray-500">{summary(p)}</div>
                </button>
                {p.verdict !== 'no_record' && (
                  <div className="flex items-center gap-2 shrink-0">
                    {sent[p.id] && <span className="text-xs text-green-700 flex items-center gap-1"><CheckCircle className="h-3.5 w-3.5" /> Sent</span>}
                    {p.phone ? (
                      <button onClick={() => send(p)}
                        className={`flex items-center gap-1 px-3 py-1.5 text-sm text-white rounded-lg ${p.verdict === 'commend' ? 'bg-green-600 hover:bg-green-700' : 'bg-amber-600 hover:bg-amber-700'}`}>
                        <MessageCircle className="h-4 w-4" /> {p.verdict === 'commend' ? 'Commend' : 'Chase'} on WhatsApp
                      </button>
                    ) : (
                      <span className="text-xs text-gray-500">No phone — add it in Admin Training</span>
                    )}
                    <button onClick={() => copy(p)} title="Copy message" className="p-1.5 rounded-lg bg-gray-100 hover:bg-gray-200"><Copy className="h-4 w-4" /></button>
                  </div>
                )}
              </div>
              {open === p.id && p.verdict !== 'no_record' && (
                <div className="border-t p-3 space-y-2">
                  <textarea value={drafts[p.id] ?? p.message} onChange={e => setDrafts(d => ({ ...d, [p.id]: e.target.value }))}
                    rows={Math.min(16, (drafts[p.id] ?? p.message).split('\n').length + 1)}
                    className="w-full text-sm border rounded-lg p-2 font-mono" />
                  <p className="text-xs text-gray-500">Edit before sending if a record is wrong. Patients are identified by hospital number and bed only.</p>
                </div>
              )}
            </div>
          ))}
        </div>
      ))}
      {report && people.length === 0 && !loading && <div className="text-sm text-gray-500">No active staff in these grades.</div>}
    </div>
  );
};

export default DutyChasePanel;
