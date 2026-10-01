/**
 * Unit call-pattern setup (Call Duty page → Units).
 *
 * The two units alternate call: Mon–Tue / Wed–Thu / Fri–Sun, the next week
 * starting with the other unit. Within a unit, the consultants split weekday
 * blocks one day each and take whole weekends in turn; the same applies to the
 * senior registrars and registrars, while house officers rotate daily.
 *
 * The ORDER of each list is the rotation order: the first consultant takes the
 * first day of the unit's weekday block and the unit's first weekend.
 *
 * Each unit runs its own patients. Consultants are fixed to a unit; senior
 * registrars, registrars and house officers rotate between the units every
 * set number of weeks, and the lists here are always who is in each unit
 * TODAY — moving someone by hand is an override the cycle carries on from.
 */

import React, { useEffect, useMemo, useState } from 'react';
import { Building2, ArrowUp, ArrowDown, X, Save, RefreshCw, AlertCircle, CheckCircle2, Undo2 } from 'lucide-react';
import {
  callDutyService, CALL_BLOCK_LABELS, DEFAULT_ROTATION_WEEKS, currentUnits,
  type StaffMember, type UnitCallConfig, type CallUnit, type UnitRotation, type RotatingGrade,
} from '../services/callDutyService';
import { PS_UNITS, HO_ROUND_WINDOW, unitWeek } from '../config/psUnits';
// The same pattern module the server generates the roster with, so the preview
// cannot drift from what Generate produces.
import {
  callSlotForDay, rotationIndex, dayNumberFromYmd, ymdFromDayNumber, mondayOnOrBefore, weekdayOf, mod,
} from '../../api/_lib/unitCallPattern.js';

type GradeKey = 'consultant_ids' | 'senior_registrar_ids' | 'registrar_ids' | 'house_officer_ids';
const GRADES: { key: GradeKey; label: string; hint: string }[] = [
  { key: 'consultant_ids', label: 'Consultants', hint: '1st takes day 1 of the weekday block; weekends alternate' },
  { key: 'senior_registrar_ids', label: 'Senior registrars', hint: 'Same split as the consultants' },
  { key: 'registrar_ids', label: 'Registrars', hint: 'Same split as the consultants' },
  { key: 'house_officer_ids', label: 'House officers', hint: 'Rotate daily: ward / emergency / off' },
];
const DAY_ABBR = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const ROTATING: { grade: RotatingGrade; label: string }[] = [
  { grade: 'senior_registrar', label: 'Senior registrars' },
  { grade: 'registrar', label: 'Registrars' },
  { grade: 'house_officer', label: 'House officers' },
];
type Draft = Pick<UnitCallConfig, 'anchor_date' | 'units'> & { rotation: UnitRotation };

function defaultRotation(): UnitRotation {
  return { enabled: true, start_date: todayYmd(), weeks: { ...DEFAULT_ROTATION_WEEKS } };
}

function todayYmd(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function emptyUnit(i: number): CallUnit {
  return { key: `unit${i + 1}`, name: PS_UNITS[i]?.name || `PS Unit ${i + 1}`, consultant_ids: [], senior_registrar_ids: [], registrar_ids: [], house_officer_ids: [] };
}

/** First-time setup: units named after PS_UNITS, consultants matched by name. */
function defaultConfig(consultants: StaffMember[]): Draft {
  const norm = (s: string) => s.toLowerCase().replace(/^dr\.?\s*/, '').replace(/[^a-z ]/g, ' ').trim();
  const used = new Set<string>();
  const units = [0, 1].map(i => {
    const u = emptyUnit(i);
    for (const name of PS_UNITS[i]?.consultants || []) {
      const surname = norm(name).split(/\s+/)[0];
      const m = consultants.find(c => !used.has(c.id) && surname && norm(c.full_name).split(/\s+/).includes(surname));
      if (m) { u.consultant_ids.push(m.id); used.add(m.id); }
    }
    return u;
  });
  return { anchor_date: ymdFromDayNumber(mondayOnOrBefore(dayNumberFromYmd(todayYmd()))), units, rotation: defaultRotation() };
}

export default function UnitCallSetupPanel({ staff, canEdit, onApplied }: {
  staff: { consultants: StaffMember[]; seniorRegs: StaffMember[]; registrars: StaffMember[]; houseOfficers: StaffMember[] };
  canEdit: boolean;
  /** Called after the roster is regenerated with the new pattern. */
  onApplied: (startDate: Date, endDate: Date) => void;
}) {
  const [saved, setSaved] = useState<UnitCallConfig | null>(null);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const pools: Record<GradeKey, StaffMember[]> = {
    consultant_ids: staff.consultants,
    senior_registrar_ids: staff.seniorRegs,
    registrar_ids: staff.registrars,
    house_officer_ids: staff.houseOfficers,
  };
  const nameOf = (id: string) =>
    [...staff.consultants, ...staff.seniorRegs, ...staff.registrars, ...staff.houseOfficers].find(s => String(s.id) === String(id))?.full_name
    || `Inactive user #${id}`;

  useEffect(() => {
    (async () => {
      const cfg = await callDutyService.serverGetUnitConfig();
      setSaved(cfg);
      setLoading(false);
    })();
  }, []);

  // Build the draft once both the saved config and the staff lists are known.
  useEffect(() => {
    if (loading || draft) return;
    // Edit the units as they stand today (after rotation), not the stored base.
    if (saved) setDraft({ anchor_date: saved.anchor_date, units: currentUnits(saved).map(u => ({ ...u })), rotation: saved.rotation || defaultRotation() });
    else if (staff.consultants.length) setDraft(defaultConfig(staff.consultants));
  }, [loading, saved, staff.consultants, draft]);

  const update = (unitIdx: number, patch: Partial<CallUnit>) =>
    setDraft(d => d && { ...d, units: d.units.map((u, i) => (i === unitIdx ? { ...u, ...patch } : u)) });

  const move = (unitIdx: number, grade: GradeKey, idx: number, dir: -1 | 1) => {
    const list = [...draft!.units[unitIdx][grade]];
    const j = idx + dir;
    if (j < 0 || j >= list.length) return;
    [list[idx], list[j]] = [list[j], list[idx]];
    update(unitIdx, { [grade]: list } as Partial<CallUnit>);
  };

  // Two-week preview of the pattern, from the anchor's current fortnight.
  const preview = useMemo(() => {
    if (!draft) return [];
    const anchor = dayNumberFromYmd(draft.anchor_date);
    if (anchor === null) return [];
    const today = dayNumberFromYmd(todayYmd());
    const start = mondayOnOrBefore(today);
    return Array.from({ length: 14 }, (_, k) => {
      const day = start + k;
      const slot = callSlotForDay(day, anchor);
      const unit = draft.units[slot.unitIndex];
      const cons = unit.consultant_ids;
      const consultant = cons.length ? nameOf(cons[mod(rotationIndex(slot, 'consultant'), cons.length)]) : '—';
      return { day, ymd: ymdFromDayNumber(day), dow: weekdayOf(day), unitIndex: slot.unitIndex, unitName: unit.name, block: slot.block, consultant, isToday: day === today };
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [draft, staff]);

  async function save(apply: boolean) {
    if (!draft) return;
    if (!confirm('Each unit runs its own patients. Patients already admitted stay in their units with their current teams. From now on, patients are admitted under an admitting unit (consults: the unit on call), and when a doctor rotates out or is moved, their unit patients pass to the incoming doctor of the same grade. Continue?')) return;
    setBusy(true); setError(''); setSuccess('');
    try {
      const { config: cfg, applied } = await callDutyService.serverSaveUnitConfig(draft);
      setSaved(cfg);
      const handed = applied && applied.reassigned ? ` ${applied.reassigned} patient(s) handed to their unit's doctors.` : '';
      if (apply) {
        // Regenerate from today for two months so the new pattern takes over.
        const now = new Date();
        const start = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        const end = new Date(start); end.setMonth(end.getMonth() + 2);
        await callDutyService.serverGenerate(start, end);
        setSuccess(`Units saved and the roster regenerated from today for two months.${handed}`);
        onApplied(start, end);
      } else {
        setSuccess(`Units saved. The new call pattern applies the next time the roster is generated.${handed}`);
      }
    } catch (e: any) {
      setError(e?.message || 'Failed to save');
    } finally {
      setBusy(false);
    }
  }

  async function revertToLegacy() {
    if (!confirm('Stop using the unit call pattern and go back to the 48-hour rotation across all staff? Existing rosters are not changed until you regenerate.')) return;
    setBusy(true); setError(''); setSuccess('');
    try {
      await callDutyService.serverClearUnitConfig();
      setSaved(null);
      setSuccess('Unit call pattern switched off. Regenerate the roster to apply the 48-hour rotation.');
    } catch (e: any) { setError(e?.message || 'Failed'); }
    finally { setBusy(false); }
  }

  if (loading || !draft) {
    return <div className="bg-white rounded-xl shadow-sm border p-8 text-center text-gray-500"><RefreshCw className="w-6 h-6 animate-spin mx-auto mb-2" />Loading unit setup…</div>;
  }

  const UNIT_TONE = ['bg-emerald-100 text-emerald-800 border-emerald-300', 'bg-sky-100 text-sky-800 border-sky-300'];

  return (
    <div className="bg-white rounded-xl shadow-sm border p-4 space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="text-lg font-semibold text-gray-900 flex items-center gap-2"><Building2 className="w-5 h-5 text-green-600" /> Unit call pattern</h3>
          <p className="text-sm text-gray-500 mt-1 max-w-3xl">
            Units alternate call — <b>Mon–Tue</b>, <b>Wed–Thu</b>, <b>Fri–Sun</b> — and the next week starts with the other unit, so each
            unit holds 7 call days a fortnight. Each call day runs 08:00 → 08:00. A consult goes to the team on call when it arrives.
          </p>
          <p className="text-xs mt-1">
            Status: {saved
              ? <span className="text-green-700 font-medium">active{saved.updated_at ? ` (saved ${new Date(saved.updated_at).toLocaleString()})` : ''}</span>
              : <span className="text-amber-700 font-medium">not set up — the roster uses the 48-hour rotation</span>}
          </p>
        </div>
        <label className="text-sm">
          <span className="block text-xs text-gray-500 mb-0.5">Week starting (Monday) when <b>{draft.units[0].name}</b> takes Mon–Tue</span>
          <input type="date" value={draft.anchor_date} disabled={!canEdit}
            onChange={e => setDraft(d => d && { ...d, anchor_date: e.target.value })}
            className="border border-gray-300 rounded-lg px-3 py-1.5 text-sm" />
        </label>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {draft.units.map((u, ui) => (
          <div key={u.key} className="border rounded-lg p-3 space-y-3">
            <input value={u.name} disabled={!canEdit} onChange={e => update(ui, { name: e.target.value })}
              className={`w-full font-semibold px-2 py-1 rounded border ${UNIT_TONE[ui]}`} />
            {GRADES.map(g => {
              const ids = u[g.key];
              const otherUnit = draft.units[1 - ui];
              const options = pools[g.key].filter(s => !ids.includes(s.id));
              return (
                <div key={g.key}>
                  <div className="text-xs font-medium text-gray-700">{g.label} <span className="font-normal text-gray-400">— {g.hint}</span></div>
                  <ol className="mt-1 space-y-1">
                    {ids.map((id, i) => (
                      <li key={id} className="flex items-center gap-1 text-sm bg-gray-50 border rounded px-2 py-1">
                        <span className="text-xs text-gray-400 w-4">{i + 1}.</span>
                        <span className="flex-1 truncate">{nameOf(id)}</span>
                        {canEdit && (<>
                          <button onClick={() => move(ui, g.key, i, -1)} disabled={i === 0} className="p-0.5 text-gray-400 hover:text-gray-700 disabled:opacity-30"><ArrowUp className="w-3.5 h-3.5" /></button>
                          <button onClick={() => move(ui, g.key, i, 1)} disabled={i === ids.length - 1} className="p-0.5 text-gray-400 hover:text-gray-700 disabled:opacity-30"><ArrowDown className="w-3.5 h-3.5" /></button>
                          <button onClick={() => update(ui, { [g.key]: ids.filter(x => x !== id) } as Partial<CallUnit>)} className="p-0.5 text-gray-400 hover:text-red-600"><X className="w-3.5 h-3.5" /></button>
                        </>)}
                      </li>
                    ))}
                    {ids.length === 0 && (
                      <li className="text-xs text-gray-400 italic">
                        {g.key === 'consultant_ids' ? 'At least one consultant is required.' : 'None — covered from the other unit, then from all staff of this grade.'}
                      </li>
                    )}
                  </ol>
                  {canEdit && options.length > 0 && (
                    <select value="" onChange={e => {
                      const id = e.target.value; if (!id) return;
                      // A person belongs to one unit: adding here removes them from the other.
                      setDraft(d => d && {
                        ...d,
                        units: d.units.map((x, i) => i === ui
                          ? { ...x, [g.key]: [...x[g.key], id] }
                          : { ...x, [g.key]: x[g.key].filter(v => v !== id) }),
                      });
                    }} className="mt-1 w-full border border-gray-300 rounded px-2 py-1 text-sm bg-white">
                      <option value="">+ Add {g.label.toLowerCase().replace(/s$/, '')}…</option>
                      {options.map(s => (
                        <option key={s.id} value={s.id}>{s.full_name}{otherUnit[g.key].includes(s.id) ? ` (move from ${otherUnit.name})` : ''}</option>
                      ))}
                    </select>
                  )}
                </div>
              );
            })}
          </div>
        ))}
      </div>

      {/* Rotation */}
      <div className="border rounded-lg p-3 space-y-2">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <label className="text-sm font-medium text-gray-700 flex items-center gap-2">
            <input type="checkbox" disabled={!canEdit} checked={draft.rotation.enabled}
              onChange={e => setDraft(d => d && { ...d, rotation: { ...d.rotation, enabled: e.target.checked } })} />
            Rotate junior doctors between the units automatically
          </label>
          <label className="text-xs text-gray-600 flex items-center gap-2">
            Cycle counted from
            <input type="date" disabled={!canEdit || !draft.rotation.enabled} value={draft.rotation.start_date}
              onChange={e => setDraft(d => d && { ...d, rotation: { ...d.rotation, start_date: e.target.value } })}
              className="border border-gray-300 rounded px-2 py-1 text-sm" />
          </label>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
          {ROTATING.map(r => {
            const next = saved?.next_rotation?.[r.grade];
            return (
              <label key={r.grade} className="text-xs text-gray-600 border rounded p-2 bg-gray-50">
                <span className="block font-medium text-gray-700">{r.label}</span>
                <span className="flex items-center gap-1 mt-1">
                  swap units every
                  <input type="number" min={0} max={52} disabled={!canEdit || !draft.rotation.enabled}
                    value={draft.rotation.weeks[r.grade]}
                    onChange={e => setDraft(d => d && { ...d, rotation: { ...d.rotation, weeks: { ...d.rotation.weeks, [r.grade]: Math.max(0, Number(e.target.value) || 0) } } })}
                    className="w-14 border border-gray-300 rounded px-1 py-0.5 text-sm" />
                  weeks
                </span>
                <span className="block mt-1 text-gray-500">
                  {!draft.rotation.enabled || draft.rotation.weeks[r.grade] === 0 ? 'Fixed to their unit'
                    : next ? `Next rotation: ${new Date(`${next}T12:00:00`).toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' })}` : 'Save to see the next rotation'}
                </span>
              </label>
            );
          })}
        </div>
        <p className="text-[11px] text-gray-500">
          The lists above are who is in each unit today. On each rotation date the two units exchange that grade's doctors,
          and each unit's patients pass to the incoming doctor. Moving someone by hand here overrides the cycle from today.
        </p>
      </div>

      {/* Unit timetables */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {draft.units.map((u, i) => PS_UNITS[i] && (
          <div key={u.key} className="text-xs">
            <div className="font-medium text-gray-700 mb-1">{u.name} — weekly timetable</div>
            <div className="grid grid-cols-7 gap-1">
              {unitWeek(PS_UNITS[i]).map(d => (
                <div key={d.day} className={`border rounded p-1 ${UNIT_TONE[i]}`}>
                  <div className="font-semibold">{d.day.slice(0, 3)}</div>
                  <div className="leading-tight">{d.activities.join(', ') || '—'}</div>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
      <p className="text-xs text-gray-600">Every day, both units: house officers' round {HO_ROUND_WINDOW.startTime} – {HO_ROUND_WINDOW.endTime}.</p>

      {/* Pattern preview */}
      <div>
        <div className="text-sm font-medium text-gray-700 mb-1">Preview — this week and next (consultant on call)</div>
        <div className="grid grid-cols-7 gap-1 text-xs">
          {preview.map(p => (
            <div key={p.day} className={`border rounded p-1.5 ${UNIT_TONE[p.unitIndex]} ${p.isToday ? 'ring-2 ring-offset-1 ring-green-500' : ''}`}>
              <div className="font-semibold">{DAY_ABBR[p.dow]} {p.ymd.slice(8)}/{p.ymd.slice(5, 7)}</div>
              <div className="truncate">{p.unitName}</div>
              <div className="truncate opacity-80" title={p.consultant}>{p.consultant}</div>
              <div className="opacity-60">{CALL_BLOCK_LABELS[p.block]}</div>
            </div>
          ))}
        </div>
      </div>

      {error && <div className="bg-red-50 border border-red-200 text-red-700 px-3 py-2 rounded-lg text-sm flex items-center gap-2"><AlertCircle className="w-4 h-4" />{error}</div>}
      {success && <div className="bg-green-50 border border-green-200 text-green-700 px-3 py-2 rounded-lg text-sm flex items-center gap-2"><CheckCircle2 className="w-4 h-4" />{success}</div>}

      {canEdit ? (
        <div className="flex flex-wrap gap-2">
          <button onClick={() => save(true)} disabled={busy}
            className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 flex items-center gap-2 text-sm font-medium">
            {busy ? <RefreshCw className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />} Save &amp; regenerate roster from today
          </button>
          <button onClick={() => save(false)} disabled={busy}
            className="px-4 py-2 bg-white border border-green-600 text-green-700 rounded-lg hover:bg-green-50 disabled:opacity-50 flex items-center gap-2 text-sm font-medium">
            <Save className="w-4 h-4" /> Save only
          </button>
          {saved && (
            <button onClick={revertToLegacy} disabled={busy}
              className="px-4 py-2 bg-white border border-gray-300 text-gray-600 rounded-lg hover:bg-gray-50 disabled:opacity-50 flex items-center gap-2 text-sm">
              <Undo2 className="w-4 h-4" /> Use 48-hour rotation instead
            </button>
          )}
        </div>
      ) : (
        <p className="text-xs text-gray-500">Only consultants, senior registrars and administrators can change the unit set-up.</p>
      )}
    </div>
  );
}
