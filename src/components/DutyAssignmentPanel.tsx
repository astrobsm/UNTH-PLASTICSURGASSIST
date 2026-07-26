import React, { useMemo, useState } from 'react';
import { format } from 'date-fns';
import {
  ClipboardList, Save, RotateCcw, Loader2, AlertTriangle, CheckCircle2, User, Calendar, Wand2,
} from 'lucide-react';
import {
  callDutyService, CallDutyShift, StaffMember, SR_SHIFTS_PER_BLOCK,
} from '../services/callDutyService';

/**
 * Manual duty assignment for the call-duty roster.
 *
 * Two ways to work, because the two jobs are different:
 *  - By shift: set every slot on one shift (who is on call this 48 hours). Works
 *    on a phone — the desktop table's inline editor needs a wide screen.
 *  - By person: pick one person and tick the shifts they cover, which is how you
 *    plan a month for a single registrar or house officer.
 *
 * Edits are held as a draft and written in one Save, so a half-finished plan is
 * never persisted and the roster everyone else is reading stays stable until you
 * commit.
 */

type Mode = 'shift' | 'person';
/** Roster slots an admin assigns, and the pool each draws from. */
type SlotKey = 'consultant' | 'senior_registrar' | 'registrar' | 'ho_ward' | 'ho_emergency' | 'ho_off';

const SLOTS: { key: SlotKey; label: string; short: string; color: string }[] = [
  { key: 'consultant', label: 'Consultant', short: 'Cons', color: 'text-rose-700' },
  { key: 'senior_registrar', label: 'Senior Registrar', short: 'SR', color: 'text-purple-700' },
  { key: 'registrar', label: 'Registrar', short: 'Reg', color: 'text-blue-700' },
  { key: 'ho_ward', label: 'House Officer — Ward', short: 'HO Ward', color: 'text-green-700' },
  { key: 'ho_emergency', label: 'House Officer — Emergency', short: 'HO ER', color: 'text-orange-700' },
  { key: 'ho_off', label: 'House Officer — Off', short: 'HO Off', color: 'text-gray-500' },
];

interface Props {
  shifts: CallDutyShift[];
  consultants: StaffMember[];
  seniorRegs: StaffMember[];
  registrars: StaffMember[];
  houseOfficers: StaffMember[];
  staffLoaded: boolean;
  onSaved: () => void | Promise<void>;
}

/** Read the id currently held in a slot. */
function slotId(shift: CallDutyShift, slot: SlotKey): string {
  switch (slot) {
    case 'consultant': return String(shift.consultant_id || '');
    case 'senior_registrar': return String(shift.senior_registrar_id || '');
    case 'registrar': return String(shift.registrar_id || '');
    case 'ho_ward': return String(shift.ho_ward_id || '');
    case 'ho_emergency': return String(shift.ho_emergency_id || '');
    case 'ho_off': return String(shift.ho_off_id || '');
  }
}

/** Put a person (or nobody, when `staff` is null) into a slot. */
function withSlot(shift: CallDutyShift, slot: SlotKey, staff: StaffMember | null): CallDutyShift {
  const name = staff?.full_name || (slot === 'ho_off' ? 'Off' : 'TBD');
  const id = staff?.id ? String(staff.id) : '';
  const phone = staff?.phone || '';
  switch (slot) {
    case 'consultant':
      return { ...shift, consultant_id: id, consultant_name: name, consultant_phone: phone };
    case 'senior_registrar':
      return { ...shift, senior_registrar_id: id, senior_registrar_name: name, senior_registrar_phone: phone };
    case 'registrar':
      return { ...shift, registrar_id: id, registrar_name: name, registrar_phone: phone };
    case 'ho_ward':
      // house_officer_* is the legacy mirror of the ward HO — keep them in step.
      return { ...shift, ho_ward_id: id, ho_ward_name: name, ho_ward_phone: phone, house_officer_id: id, house_officer_name: name };
    case 'ho_emergency':
      return { ...shift, ho_emergency_id: id, ho_emergency_name: name, ho_emergency_phone: phone };
    case 'ho_off':
      return { ...shift, ho_off_id: id, ho_off_name: name, ho_off_phone: phone };
  }
}

const DutyAssignmentPanel: React.FC<Props> = ({
  shifts, consultants, seniorRegs, registrars, houseOfficers, staffLoaded, onSaved,
}) => {
  const [mode, setMode] = useState<Mode>('shift');
  // Pending edits keyed by shift id. Absent = untouched.
  const [draft, setDraft] = useState<Record<number, CallDutyShift>>({});
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saved, setSaved] = useState<number | null>(null);

  // Person mode
  const [personId, setPersonId] = useState('');
  const [personSlot, setPersonSlot] = useState<SlotKey>('ho_ward');

  const ordered = useMemo(
    () => [...shifts].sort((a, b) => a.shift_number - b.shift_number),
    [shifts]
  );

  const poolFor = (slot: SlotKey): StaffMember[] => {
    if (slot === 'consultant') return consultants;
    if (slot === 'senior_registrar') return seniorRegs;
    if (slot === 'registrar') return registrars;
    return houseOfficers;
  };

  const current = (shift: CallDutyShift) => draft[shift.id!] ?? shift;
  const changedIds = Object.keys(draft).map(Number);

  const setSlot = (shift: CallDutyShift, slot: SlotKey, staffId: string) => {
    const staff = poolFor(slot).find(s => String(s.id) === staffId) || null;
    setDraft(d => ({ ...d, [shift.id!]: withSlot(current(shift), slot, staff) }));
    setSaved(null);
  };

  // ── Everyone in one pool, in turn, in blocks ───────────────────────────
  // Senior registrars default to SR_SHIFTS_PER_BLOCK shifts each (the weekly
  // block the generator uses); the other grades change every shift.
  const autoRotate = (slot: SlotKey, blockSize: number) => {
    const pool = poolFor(slot);
    if (pool.length === 0) return;
    const next = { ...draft };
    ordered.forEach((shift, i) => {
      const person = pool[Math.floor(i / Math.max(1, blockSize)) % pool.length];
      next[shift.id!] = withSlot(next[shift.id!] ?? shift, slot, person);
    });
    setDraft(next);
    setSaved(null);
  };

  /** Ward / Emergency / Off rotation across the HO pool, matching generation. */
  const autoRotateHOs = () => {
    const pool = houseOfficers;
    if (pool.length === 0) return;
    const next = { ...draft };
    ordered.forEach((shift, i) => {
      let s = next[shift.id!] ?? shift;
      if (pool.length >= 3) {
        s = withSlot(s, 'ho_ward', pool[i % pool.length]);
        s = withSlot(s, 'ho_emergency', pool[(i + 1) % pool.length]);
        s = withSlot(s, 'ho_off', pool[(i + 2) % pool.length]);
      } else if (pool.length === 2) {
        s = withSlot(s, 'ho_ward', pool[i % 2]);
        s = withSlot(s, 'ho_emergency', pool[i % 2]);
        s = withSlot(s, 'ho_off', pool[(i + 1) % 2]);
      } else {
        s = withSlot(s, 'ho_ward', pool[0]);
        s = withSlot(s, 'ho_emergency', pool[0]);
        s = withSlot(s, 'ho_off', null);
      }
      next[shift.id!] = s;
    });
    setDraft(next);
    setSaved(null);
  };

  // ── Person mode ────────────────────────────────────────────────────────
  const personPool = useMemo(() => ([
    ...seniorRegs.map(s => ({ ...s, slot: 'senior_registrar' as SlotKey, grade: 'Senior Registrar' })),
    ...registrars.map(s => ({ ...s, slot: 'registrar' as SlotKey, grade: 'Registrar' })),
    ...houseOfficers.map(s => ({ ...s, slot: 'ho_ward' as SlotKey, grade: 'House Officer' })),
    ...consultants.map(s => ({ ...s, slot: 'consultant' as SlotKey, grade: 'Consultant' })),
  ]), [seniorRegs, registrars, houseOfficers, consultants]);

  const person = personPool.find(p => String(p.id) === personId);
  const isHO = person?.grade === 'House Officer';
  const activeSlot: SlotKey = isHO ? personSlot : (person?.slot ?? 'ho_ward');

  const togglePersonShift = (shift: CallDutyShift, on: boolean) => {
    if (!person) return;
    const staff: StaffMember = { id: String(person.id), full_name: person.full_name, email: person.email, role: person.role, phone: person.phone };
    setDraft(d => ({ ...d, [shift.id!]: withSlot(current(shift), activeSlot, on ? staff : null) }));
    setSaved(null);
  };

  const personShiftCount = ordered.filter(s => slotId(current(s), activeSlot) === personId).length;

  // ── Save ───────────────────────────────────────────────────────────────
  const save = async () => {
    if (changedIds.length === 0) return;
    setSaving(true);
    setSaveError(null);
    let ok = 0;
    const failed: number[] = [];
    for (const id of changedIds) {
      try {
        await callDutyService.serverUpdateShift(id, draft[id]);
        ok++;
      } catch {
        failed.push(id);
      }
    }
    setSaving(false);
    if (failed.length) {
      setSaveError(`${ok} shift(s) saved, ${failed.length} failed (shift ${failed.map(id => draft[id]?.shift_number ?? id).join(', ')}). Your unsaved changes are still here — try Save again.`);
      setDraft(d => Object.fromEntries(failed.map(id => [id, d[id]])));
    } else {
      setDraft({});
      setSaved(ok);
    }
    await onSaved();
  };

  if (ordered.length === 0) {
    return (
      <div className="bg-white rounded-xl shadow-sm border p-8 text-center">
        <ClipboardList className="w-10 h-10 mx-auto text-gray-300 mb-2" />
        <p className="text-sm text-gray-500">Generate a roster first, then assign duties here.</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {/* Header + mode switch */}
      <div className="bg-white rounded-xl shadow-sm border p-3 sm:p-4">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div>
            <h3 className="text-sm sm:text-base font-semibold text-gray-800 flex items-center gap-2">
              <ClipboardList className="w-4 h-4 text-green-600" /> Assign Duties
            </h3>
            <p className="text-xs text-gray-500 mt-0.5">
              {ordered.length} shift(s) in this roster. Changes are saved only when you press Save.
            </p>
          </div>
          <div className="flex rounded-lg border overflow-hidden self-start">
            <button
              onClick={() => setMode('shift')}
              className={`px-3 py-1.5 text-xs font-medium ${mode === 'shift' ? 'bg-green-600 text-white' : 'bg-white text-gray-600'}`}
            >
              <Calendar className="w-3 h-3 inline mr-1" />By shift
            </button>
            <button
              onClick={() => setMode('person')}
              className={`px-3 py-1.5 text-xs font-medium ${mode === 'person' ? 'bg-green-600 text-white' : 'bg-white text-gray-600'}`}
            >
              <User className="w-3 h-3 inline mr-1" />By person
            </button>
          </div>
        </div>

        {!staffLoaded && (
          <p className="text-xs text-amber-700 mt-2 flex items-center gap-1">
            <Loader2 className="w-3 h-3 animate-spin" /> Loading staff lists…
          </p>
        )}

        {/* Quick rotations — fill the draft, review, then save */}
        <div className="flex flex-wrap gap-2 mt-3 pt-3 border-t border-gray-100">
          <span className="text-xs text-gray-500 flex items-center gap-1 mr-1">
            <Wand2 className="w-3 h-3" /> Rotate everyone in turn:
          </span>
          <button
            onClick={() => autoRotate('senior_registrar', SR_SHIFTS_PER_BLOCK)}
            disabled={seniorRegs.length === 0}
            className="px-2 py-1 text-xs rounded border border-purple-200 text-purple-700 bg-purple-50 hover:bg-purple-100 disabled:opacity-40"
            title={`Each senior registrar takes ${SR_SHIFTS_PER_BLOCK} shifts in a row (${SR_SHIFTS_PER_BLOCK * 2} days)`}
          >
            Senior registrars — weekly blocks
          </button>
          <button
            onClick={() => autoRotate('registrar', 1)}
            disabled={registrars.length === 0}
            className="px-2 py-1 text-xs rounded border border-blue-200 text-blue-700 bg-blue-50 hover:bg-blue-100 disabled:opacity-40"
          >
            Registrars — every shift
          </button>
          <button
            onClick={autoRotateHOs}
            disabled={houseOfficers.length === 0}
            className="px-2 py-1 text-xs rounded border border-green-200 text-green-700 bg-green-50 hover:bg-green-100 disabled:opacity-40"
            title="Ward / Emergency / Off rotation across the house officers"
          >
            House officers — ward/ER/off
          </button>
          <button
            onClick={() => autoRotate('consultant', 1)}
            disabled={consultants.length === 0}
            className="px-2 py-1 text-xs rounded border border-rose-200 text-rose-700 bg-rose-50 hover:bg-rose-100 disabled:opacity-40"
          >
            Consultants — every shift
          </button>
        </div>
      </div>

      {/* Sticky save bar */}
      <div className="sticky top-0 z-10 bg-white rounded-xl shadow-sm border p-3 flex flex-wrap items-center gap-2">
        <span className="text-xs text-gray-600 flex-1 min-w-[9rem]">
          {changedIds.length === 0
            ? (saved !== null ? <span className="text-green-700 flex items-center gap-1"><CheckCircle2 className="w-3 h-3" />{saved} shift(s) saved</span> : 'No unsaved changes')
            : <strong>{changedIds.length} shift(s) changed</strong>}
        </span>
        <button
          onClick={() => { setDraft({}); setSaved(null); setSaveError(null); }}
          disabled={changedIds.length === 0 || saving}
          className="px-3 py-1.5 text-xs font-medium rounded-lg border text-gray-700 hover:bg-gray-50 disabled:opacity-40 inline-flex items-center gap-1"
        >
          <RotateCcw className="w-3 h-3" /> Discard
        </button>
        <button
          onClick={save}
          disabled={changedIds.length === 0 || saving}
          className="px-4 py-1.5 text-xs font-medium rounded-lg bg-green-600 text-white hover:bg-green-700 disabled:opacity-40 inline-flex items-center gap-1"
        >
          {saving ? <Loader2 className="w-3 h-3 animate-spin" /> : <Save className="w-3 h-3" />}
          {saving ? 'Saving…' : 'Save'}
        </button>
      </div>

      {saveError && (
        <div className="flex items-start gap-2 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
          <AlertTriangle className="w-4 h-4 text-red-600 flex-shrink-0 mt-0.5" />
          <p className="text-xs text-red-700">{saveError}</p>
        </div>
      )}

      {/* ── By shift ──────────────────────────────────────────────────── */}
      {mode === 'shift' && (
        <div className="space-y-2">
          {ordered.map(shift => {
            const s = current(shift);
            const isChanged = draft[shift.id!] !== undefined;
            return (
              <div
                key={shift.id ?? shift.shift_number}
                className={`bg-white rounded-xl shadow-sm border p-3 ${isChanged ? 'border-green-400 ring-1 ring-green-200' : ''}`}
              >
                <div className="flex items-center justify-between mb-2">
                  <div className="text-sm font-semibold text-gray-800">
                    Shift {shift.shift_number}
                    <span className="ml-2 font-normal text-xs text-gray-500">
                      {format(new Date(shift.start_date), 'EEE dd MMM')} → {format(new Date(shift.end_date), 'EEE dd MMM')}
                    </span>
                  </div>
                  {isChanged && <span className="text-[10px] font-medium text-green-700 bg-green-50 border border-green-200 rounded px-1.5 py-0.5">edited</span>}
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
                  {SLOTS.map(slot => {
                    const pool = poolFor(slot.key);
                    return (
                      <label key={slot.key} className="block">
                        <span className={`block text-[11px] font-medium mb-0.5 ${slot.color}`}>{slot.label}</span>
                        <select
                          value={slotId(s, slot.key)}
                          onChange={e => setSlot(shift, slot.key, e.target.value)}
                          className="w-full border border-gray-300 rounded-lg px-2 py-2 text-sm bg-white"
                          style={{ fontSize: '16px' }}
                        >
                          <option value="">{slot.key === 'ho_off' ? '— nobody off —' : '— TBD —'}</option>
                          {pool.map(p => <option key={p.id} value={String(p.id)}>{p.full_name}</option>)}
                        </select>
                      </label>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* ── By person ─────────────────────────────────────────────────── */}
      {mode === 'person' && (
        <div className="bg-white rounded-xl shadow-sm border p-3 sm:p-4 space-y-3">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <label className="block">
              <span className="block text-xs font-medium text-gray-600 mb-1">Staff member</span>
              <select
                value={personId}
                onChange={e => setPersonId(e.target.value)}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm bg-white"
                style={{ fontSize: '16px' }}
              >
                <option value="">— select —</option>
                {personPool.map(p => (
                  <option key={`${p.slot}-${p.id}`} value={String(p.id)}>{p.full_name} ({p.grade})</option>
                ))}
              </select>
            </label>
            {isHO && (
              <label className="block">
                <span className="block text-xs font-medium text-gray-600 mb-1">Duty</span>
                <select
                  value={personSlot}
                  onChange={e => setPersonSlot(e.target.value as SlotKey)}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm bg-white"
                  style={{ fontSize: '16px' }}
                >
                  <option value="ho_ward">Ward</option>
                  <option value="ho_emergency">Emergency</option>
                  <option value="ho_off">Off</option>
                </select>
              </label>
            )}
          </div>

          {!person ? (
            <p className="text-sm text-gray-400 text-center py-6">
              Pick a staff member to tick the shifts they cover.
            </p>
          ) : (
            <>
              <p className="text-xs text-gray-600">
                <strong>{person.full_name}</strong> — {person.grade}. Ticked shifts are the ones they
                cover as <strong>{SLOTS.find(x => x.key === activeSlot)?.label}</strong>.
                Currently <strong>{personShiftCount}</strong> of {ordered.length}.
              </p>
              <p className="text-[11px] text-amber-700 bg-amber-50 border border-amber-200 rounded px-2 py-1">
                Un-ticking a shift leaves that duty unfilled until you assign someone else to it.
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-1.5">
                {ordered.map(shift => {
                  const s = current(shift);
                  const holder = slotId(s, activeSlot);
                  const mine = holder === personId;
                  const someoneElse = !!holder && !mine;
                  const heldByName = activeSlot === 'senior_registrar' ? s.senior_registrar_name
                    : activeSlot === 'registrar' ? s.registrar_name
                    : activeSlot === 'consultant' ? s.consultant_name
                    : activeSlot === 'ho_emergency' ? s.ho_emergency_name
                    : activeSlot === 'ho_off' ? s.ho_off_name
                    : s.ho_ward_name;
                  return (
                    <label
                      key={shift.id ?? shift.shift_number}
                      className={`flex items-start gap-2 border rounded-lg px-2 py-2 cursor-pointer ${
                        mine ? 'border-green-400 bg-green-50' : 'border-gray-200 hover:bg-gray-50'
                      }`}
                    >
                      <input
                        type="checkbox"
                        checked={mine}
                        onChange={e => togglePersonShift(shift, e.target.checked)}
                        className="mt-0.5 h-4 w-4 accent-green-600"
                      />
                      <span className="text-xs min-w-0">
                        <span className="font-medium text-gray-800">Shift {shift.shift_number}</span>
                        <span className="block text-gray-500">
                          {format(new Date(shift.start_date), 'EEE dd MMM')} → {format(new Date(shift.end_date), 'dd MMM')}
                        </span>
                        {someoneElse && (
                          <span className="block text-[11px] text-gray-400 truncate">now: {heldByName || 'TBD'}</span>
                        )}
                      </span>
                    </label>
                  );
                })}
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
};

export default DutyAssignmentPanel;
