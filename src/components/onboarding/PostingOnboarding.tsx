/**
 * First-login posting onboarding for house officers and residents:
 *   1 Posting       start / end dates and the unit they are posted to
 *   2 Expectations  what the unit expects of their grade
 *   3 Sign-out      the rules for signing out of the unit — each key rule
 *                   ticked, then accepted
 * Submitting officially starts the rotation. Registering after the start date
 * sets catch-up reading and missed CBTs, shown before acceptance.
 */
import { useMemo, useState } from 'react';
import { CalendarDays, ClipboardCheck, ShieldCheck, ChevronDown, ChevronUp, LogOut, BookOpen } from 'lucide-react';
import { RESPONSIBILITIES_SECTIONS, SIGNOUT_CRITERIA } from '../HOResponsibilitiesGuide';
import { GRADE_LABEL, RESIDENT_EXPECTATIONS, RULES_VERSION, previewCatchUp, signOutRules, type Grade } from '../../data/postingRules';
import { postingOnboardingService, type OnboardingStatus } from '../../services/postingOnboardingService';
import { blockAt, blocksUntil } from '../../utils/residentBlocks';

interface Props {
  status: OnboardingStatus;
  userName: string;
  onDone: (s: OnboardingStatus) => void;
  onLogout: () => void;
}

const fmt = (d: string) => new Date(`${d}T00:00:00`).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' });
const addDays = (d: string, n: number) => new Date(Date.parse(`${d}T00:00:00Z`) + n * 86400000).toISOString().slice(0, 10);

export default function PostingOnboarding({ status, userName, onDone, onLogout }: Props) {
  const grade = (status.grade || 'house_officer') as Grade;
  const req = status.requirements!;
  const today = status.today || new Date().toISOString().slice(0, 10);
  const [step, setStep] = useState(0);
  const [start, setStart] = useState(status.defaults?.start || today);
  const [end, setEnd] = useState(status.defaults?.end || today);
  const [unit, setUnit] = useState('');
  const [ticked, setTicked] = useState<Set<string>>(new Set());
  const [readExpectations, setReadExpectations] = useState(false);
  const [accept, setAccept] = useState(false);
  const [open, setOpen] = useState<number | null>(0);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [result, setResult] = useState<(OnboardingStatus & { unitNote?: string | null }) | null>(null);

  // Residents: the posting is the current six-month block, in the unit it
  // falls to, alternating from the unit they started in. Their residency can
  // have started long ago — that is not a reason to stop them.
  const resident = status.cycle === 'resident';
  const units = status.units || [];
  const block = useMemo(() => (resident && start && unit
    ? blockAt({ residencyStart: start, initialUnitKey: unit, units, today }) : null), [resident, start, unit, units, today]);
  const history = useMemo(() => (resident && start && unit
    ? blocksUntil({ residencyStart: start, initialUnitKey: unit, units, today }) : []), [resident, start, unit, units, today]);
  const postStart = resident ? (block?.start || start) : start;
  const postEnd = resident ? (block?.end || end) : end;

  const catchUp = useMemo(() => previewCatchUp(postStart, postEnd, today, req), [postStart, postEnd, today, req]);
  const rules = useMemo(() => signOutRules({
    grade, req, passThreshold: status.signOut?.passThreshold ?? 70, minSectionScore: status.signOut?.minSectionScore ?? 40,
    cmeAvailable: status.cmeAvailable ?? null, late: !!catchUp,
  }), [grade, req, status, catchUp]);
  const mustTick = rules.filter(r => r.mustTick);
  const allTicked = mustTick.every(r => ticked.has(r.id));

  const postingError = (() => {
    if (resident) {
      if (!start) return 'Enter the date your residency started';
      if ((Date.parse(start) - Date.parse(today)) / 86400000 > 60) return 'The start date is more than 60 days away';
      if ((Date.parse(today) - Date.parse(start)) / 86400000 > 366 * 8) return 'That start date is more than eight years ago';
      if (!unit) return 'Select the unit you started in';
      return '';
    }
    if (!start || !end) return 'Enter both dates';
    const len = (Date.parse(end) - Date.parse(start)) / 86400000;
    if (len < 7) return 'The posting must end at least a week after it starts';
    if (end < today) return 'That end date has already passed';
    if ((Date.parse(start) - Date.parse(today)) / 86400000 > 60) return 'The start date is more than 60 days away';
    if (!unit) return 'Select the unit you are posted to';
    return '';
  })();

  const submit = async () => {
    setSaving(true);
    setError('');
    try {
      const r = await postingOnboardingService.submit({
        posting_start: postStart, posting_end: postEnd, unit_key: unit, accepted: true, rules_version: RULES_VERSION,
        ...(resident ? { residency_start: start } : {}),
      });
      setResult(r);
      setStep(3);
    } catch (e: any) {
      const msg = String(e?.message || '').replace(/^\[HTTP \d+\]\s*/, '');
      setError(navigator.onLine ? (msg || 'Could not submit. Try again.') : 'You are offline. Connect to the internet to start your rotation.');
    } finally {
      setSaving(false);
    }
  };

  const STEPS = ['Posting', 'Expectations', 'Sign-out rules'];
  const unitName = resident ? block?.unitName : status.units?.find(u => u.key === unit)?.name;

  return (
    <div className="min-h-screen bg-gradient-to-b from-green-50 to-white flex items-start sm:items-center justify-center p-3 sm:p-6">
      <div className="w-full max-w-3xl bg-white rounded-2xl shadow-xl border border-green-100 flex flex-col max-h-[96vh]">
        <div className="px-5 py-4 border-b">
          <div className="flex items-start justify-between gap-3">
            <div>
              <h1 className="text-xl font-bold text-gray-900">Welcome to Plastic Surgery, {userName.split(' ')[0] || 'Doctor'}</h1>
              <p className="text-sm text-gray-600">{GRADE_LABEL[grade]} posting registration — about 3 minutes. Your rotation starts officially when you submit.</p>
            </div>
            <button type="button" onClick={onLogout} className="text-xs text-gray-500 flex items-center gap-1 shrink-0"><LogOut className="w-3.5 h-3.5" /> Sign out</button>
          </div>
          {step < 3 && (
            <ol className="mt-3 flex gap-2 text-xs">
              {STEPS.map((s, i) => (
                <li key={s} className={`flex-1 rounded-full px-3 py-1.5 text-center ${i === step ? 'bg-green-600 text-white' : i < step ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-500'}`}>{i + 1}. {s}</li>
              ))}
            </ol>
          )}
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4">
          {step === 0 && (
            <>
              {resident ? (
              <section className="space-y-3">
                <h2 className="font-semibold text-gray-800 flex items-center gap-2"><CalendarDays className="w-4 h-4 text-green-600" /> Your residency</h2>
                <p className="text-xs text-gray-600">Residents rotate between the two units every six months. Give the date you started in the unit and the unit you started in — the app works out where you are now and moves you automatically at each change-over.</p>
                <label className="block">
                  <span className="block text-xs font-medium text-gray-600 mb-1">Residency in the unit started on</span>
                  <input type="date" value={start} max={addDays(today, 60)} onChange={e => setStart(e.target.value)} className="w-full rounded-lg border border-gray-300 px-3 py-2" />
                </label>
                <h3 className="font-semibold text-gray-800 pt-1">Unit you started in</h3>
                <div className="grid sm:grid-cols-2 gap-2">
                  {units.map(u => (
                    <button key={u.key} type="button" onClick={() => setUnit(u.key)}
                      className={`rounded-xl border-2 px-4 py-3 text-left ${unit === u.key ? 'border-green-600 bg-green-50' : 'border-gray-200 hover:border-green-300'}`}>
                      <span className="font-semibold text-gray-900">{u.name}</span>
                    </button>
                  ))}
                </div>
                {block && (
                  <div className="rounded-xl border border-green-200 bg-green-50 p-3 text-sm text-green-900 space-y-1">
                    <p className="font-semibold">Now: {block.unitName} · {fmt(block.start)} – {fmt(block.end)}</p>
                    <p className="text-xs">You move to <strong>{block.nextUnitName}</strong> automatically on {fmt(block.nextStart)}, and every six months after.</p>
                    {history.length > 1 && (
                      <ul className="text-xs text-green-800 list-disc pl-5">
                        {history.slice(0, -1).slice(-4).map(h => <li key={h.index}>{h.unitName}: {fmt(h.start)} – {fmt(h.end)} (completed)</li>)}
                      </ul>
                    )}
                  </div>
                )}
              </section>
              ) : (
              <>
              <section className="space-y-3">
                <h2 className="font-semibold text-gray-800 flex items-center gap-2"><CalendarDays className="w-4 h-4 text-green-600" /> Your posting</h2>
                <div className="grid sm:grid-cols-2 gap-3">
                  <label className="block">
                    <span className="block text-xs font-medium text-gray-600 mb-1">Posting started / starts on</span>
                    <input type="date" value={start} max={addDays(today, 60)} onChange={e => setStart(e.target.value)} className="w-full rounded-lg border border-gray-300 px-3 py-2" />
                  </label>
                  <label className="block">
                    <span className="block text-xs font-medium text-gray-600 mb-1">Posting ends on</span>
                    <input type="date" value={end} min={addDays(start, 7)} onChange={e => setEnd(e.target.value)} className="w-full rounded-lg border border-gray-300 px-3 py-2" />
                  </label>
                </div>
                {start && end && end > start && (
                  <p className="text-xs text-gray-500">{Math.round((Date.parse(end) - Date.parse(start)) / 86400000)} days ({Math.round((Date.parse(end) - Date.parse(start)) / 604800000)} weeks). Pre-filled from your unit’s rotation settings where available — correct it if your posting letter says otherwise.</p>
                )}
              </section>
              <section className="space-y-2">
                <h2 className="font-semibold text-gray-800">Unit you are posted to</h2>
                <div className="grid sm:grid-cols-2 gap-2">
                  {(status.units || []).map(u => (
                    <button key={u.key} type="button" onClick={() => setUnit(u.key)}
                      className={`rounded-xl border-2 px-4 py-3 text-left ${unit === u.key ? 'border-green-600 bg-green-50' : 'border-gray-200 hover:border-green-300'}`}>
                      <span className="font-semibold text-gray-900">{u.name}</span>
                    </button>
                  ))}
                </div>
              </section>
              </>
              )}
              {catchUp && (
                <div className="rounded-xl border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900">
                  <p className="font-semibold">You are registering {catchUp.daysLate} day{catchUp.daysLate === 1 ? '' : 's'} after your {resident ? 'current unit block' : 'posting'} started.</p>
                  <p className="mt-1">Catch-up to complete within {catchUp.dueInDays} days of today: <strong>{catchUp.articles} CME article{catchUp.articles === 1 ? '' : 's'}</strong>{catchUp.cbt > 0 && <> and <strong>{catchUp.cbt} missed CBT{catchUp.cbt === 1 ? '' : 's'}</strong></>}.</p>
                </div>
              )}
            </>
          )}

          {step === 1 && (
            <>
              <h2 className="font-semibold text-gray-800 flex items-center gap-2"><ClipboardCheck className="w-4 h-4 text-green-600" /> What the unit expects of a {GRADE_LABEL[grade]}</h2>
              {grade === 'house_officer' ? (
                <div className="space-y-2">
                  {RESPONSIBILITIES_SECTIONS.map((s, i) => (
                    <div key={s.title} className="border rounded-lg">
                      <button type="button" onClick={() => setOpen(open === i ? null : i)} className="w-full flex justify-between items-center px-3 py-2 text-left text-sm font-medium">
                        {s.title} {open === i ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                      </button>
                      {open === i && (
                        <ul className="px-5 pb-3 list-disc text-sm text-gray-700 space-y-1">{s.responsibilities.map((r: string) => <li key={r}>{r}</li>)}</ul>
                      )}
                    </div>
                  ))}
                  <div className="rounded-lg bg-gray-50 p-3">
                    <p className="text-sm font-medium mb-1">Daily documentation standards</p>
                    <ul className="list-disc pl-5 text-xs text-gray-700 space-y-0.5">{SIGNOUT_CRITERIA.map(c => <li key={c}>{c}</li>)}</ul>
                  </div>
                </div>
              ) : (
                RESIDENT_EXPECTATIONS[grade].map(s => (
                  <div key={s.title} className="rounded-lg border p-3">
                    <p className="text-sm font-semibold text-gray-800 mb-1">{s.title}</p>
                    <ul className="list-disc pl-5 text-sm text-gray-700 space-y-1">{s.items.map(x => <li key={x}>{x}</li>)}</ul>
                  </div>
                ))
              )}
              <label className="flex items-start gap-2 text-sm bg-green-50 rounded-lg p-3">
                <input type="checkbox" className="mt-0.5" checked={readExpectations} onChange={e => setReadExpectations(e.target.checked)} />
                I have read what is expected of me as a {GRADE_LABEL[grade]} in this unit.
              </label>
            </>
          )}

          {step === 2 && (
            <>
              <h2 className="font-semibold text-gray-800 flex items-center gap-2"><ShieldCheck className="w-4 h-4 text-green-600" /> Rules for signing out of the unit</h2>
              <p className="text-xs text-gray-500">Tick each rule marked as required to show you have read it.</p>
              <ul className="space-y-2">
                {rules.map(r => (
                  <li key={r.id} className={`rounded-lg border p-3 text-sm ${r.mustTick ? (ticked.has(r.id) ? 'border-green-400 bg-green-50' : 'border-amber-300') : 'border-gray-200'}`}>
                    {r.mustTick ? (
                      <label className="flex items-start gap-2">
                        <input type="checkbox" className="mt-0.5" checked={ticked.has(r.id)}
                          onChange={e => setTicked(t => { const n = new Set(t); if (e.target.checked) n.add(r.id); else n.delete(r.id); return n; })} />
                        <span>{r.text}</span>
                      </label>
                    ) : <span className="text-gray-700">{r.text}</span>}
                  </li>
                ))}
              </ul>
              {catchUp && (
                <p className="text-sm rounded-lg bg-amber-50 border border-amber-300 p-3 text-amber-900">
                  Your catch-up: {catchUp.articles} CME article{catchUp.articles === 1 ? '' : 's'}{catchUp.cbt > 0 ? ` and ${catchUp.cbt} CBT${catchUp.cbt === 1 ? '' : 's'}` : ''} within {catchUp.dueInDays} days.
                </p>
              )}
              <div className="rounded-lg bg-gray-50 p-3 text-sm">
                <p><strong>{resident ? 'Current block' : 'Posting'}:</strong> {fmt(postStart)} – {fmt(postEnd)} · <strong>Unit:</strong> {unitName}</p>
                {resident && block && <p className="text-xs text-gray-600 mt-1">Then {block.nextUnitName} from {fmt(block.nextStart)} — automatically, every six months.</p>}
              </div>
              <label className="flex items-start gap-2 text-sm font-medium bg-green-50 rounded-lg p-3">
                <input type="checkbox" className="mt-0.5" checked={accept} disabled={!allTicked} onChange={e => setAccept(e.target.checked)} />
                I accept these expectations and the rules for signing out of the unit, and confirm my posting details are correct.
              </label>
              {error && <p className="text-sm text-red-600">{error}</p>}
            </>
          )}

          {step === 3 && result && (
            <div className="text-center space-y-3 py-4">
              <div className="mx-auto w-14 h-14 rounded-full bg-green-100 flex items-center justify-center"><ShieldCheck className="w-7 h-7 text-green-700" /></div>
              <h2 className="text-lg font-bold">Your rotation has officially started</h2>
              <p className="text-sm text-gray-600">{unitName} · {fmt(postStart)} – {fmt(postEnd)}</p>
              {resident && block && <p className="text-xs text-gray-500">You will move to {block.nextUnitName} automatically on {fmt(block.nextStart)}.</p>}
              {result.catchUp && (
                <div className="text-left rounded-xl border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900">
                  <p className="font-semibold flex items-center gap-1"><BookOpen className="w-4 h-4" /> Catch-up due by {fmt(result.catchUp.due)}</p>
                  <p>{result.catchUp.articles.required} CME article(s){result.catchUp.cbt.required ? ` and ${result.catchUp.cbt.required} CBT(s)` : ''}. Your progress shows on the dashboard.</p>
                </div>
              )}
              {result.unitNote && <p className="text-xs text-gray-500">Note for the roster admin: {result.unitNote}</p>}
            </div>
          )}
        </div>

        <div className="px-5 py-3 border-t flex items-center justify-between gap-2">
          {step > 0 && step < 3 ? <button type="button" onClick={() => setStep(s => s - 1)} className="px-4 py-2 text-sm rounded-lg border">Back</button> : <span />}
          {step === 0 && <button type="button" disabled={!!postingError} title={postingError} onClick={() => setStep(1)} className="px-5 py-2 text-sm rounded-lg bg-green-600 text-white disabled:opacity-50">{postingError || 'Continue'}</button>}
          {step === 1 && <button type="button" disabled={!readExpectations} onClick={() => setStep(2)} className="px-5 py-2 text-sm rounded-lg bg-green-600 text-white disabled:opacity-50">Continue</button>}
          {step === 2 && <button type="button" disabled={!accept || !allTicked || saving} onClick={submit} className="px-5 py-2 text-sm rounded-lg bg-green-600 text-white disabled:opacity-50">{saving ? 'Starting…' : 'Accept and start my rotation'}</button>}
          {step === 3 && result && <button type="button" onClick={() => onDone(result)} className="px-5 py-2 text-sm rounded-lg bg-green-600 text-white">Go to the app</button>}
        </div>
      </div>
    </div>
  );
}
