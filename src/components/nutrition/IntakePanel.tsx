/**
 * Daily food chart. For each planned item the nurse or family records the
 * fraction eaten (0, ¼, ½, ¾, all); extras, supplements and enteral volume are
 * added; the app converts all of it to kcal and protein against the day's
 * targets.
 */
import { useMemo, useState } from 'react';
import { Plus, Save, Trash2 } from 'lucide-react';
import toast from 'react-hot-toast';
import { intakeTotals, type Fraction } from '../../clinical/nutrition/monitoring';
import type { MealPlan } from '../../clinical/nutrition/planner';
import { nutritionService, type IntakeRecord, type MealPlanRecord } from '../../services/nutritionService';
import { clean, Num, Txt } from './fields';
import { SLOT_LABEL } from './MealPlanPanel';

const FRACTIONS: [Fraction, string][] = [[0, 'None'], [0.25, '¼'], [0.5, '½'], [0.75, '¾'], [1, 'All']];
const DAY = 86_400_000;

/** Which plan day a calendar date falls on (the plan repeats weekly from approval). */
export function planDayFor(planRec: MealPlanRecord, date: string) {
  const start = Date.parse(String(planRec.approved_at || planRec.created_at).slice(0, 10));
  const n = Math.floor((Date.parse(date) - start) / DAY);
  return ((n % 7) + 7) % 7;
}

interface Extra { name: string; kcal: number | null; proteinG: number | null }

export function IntakePanel({ patientId, planRec, intake, onSaved }: { patientId: string; planRec: MealPlanRecord | null; intake: IntakeRecord[]; onSaved: () => void }) {
  const [date, setDate] = useState(() => new Date().toISOString().slice(0, 10));
  const plan = planRec?.plan as MealPlan | undefined;
  const day = planRec && plan?.days?.length ? plan.days[planDayFor(planRec, date) % plan.days.length] : null;
  const recorded = useMemo(() => intake.filter(r => String(r.intake_date).slice(0, 10) === date), [intake, date]);
  const slots = day ? [...new Set(day.items.map(i => i.slot))] : ['breakfast', 'lunch', 'dinner'];

  const [eaten, setEaten] = useState<Record<string, Fraction>>({});
  const [extras, setExtras] = useState<Record<string, Extra[]>>({});
  const [enteral, setEnteral] = useState({ ml: null as number | null, kcalPerMl: null as number | null, proteinGPerL: null as number | null });
  const [note, setNote] = useState('');

  const mealTotals = (slot: string) => intakeTotals({
    items: (day?.items || []).filter(i => i.slot === slot).map(i => ({ planned: { kcal: i.nutrients.energy_kcal ?? 0, proteinG: i.nutrients.protein_g ?? 0 }, eaten: eaten[`${slot}:${i.key}`] ?? 0 })),
    extras: (extras[slot] || []).filter(x => x.kcal != null).map(x => ({ kcal: x.kcal || 0, proteinG: x.proteinG || 0 })),
  });
  const saveMeal = async (slot: string) => {
    const t = mealTotals(slot);
    try {
      await nutritionService.saveIntake({
        patient_id: patientId, intake_date: date, meal: slot, plan_id: planRec?.id ?? null,
        items: [...(day?.items || []).filter(i => i.slot === slot).map(i => ({ key: i.key, name: i.name, eaten: eaten[`${slot}:${i.key}`] ?? 0 })), ...(extras[slot] || []).map(x => ({ extra: x.name, kcal: x.kcal, proteinG: x.proteinG }))],
        kcal: t.kcal, protein_g: t.proteinG, target_kcal: day?.targetKcal ?? null, target_protein_g: day?.targetProteinG ?? null, note: note || null,
      });
      toast.success(`${SLOT_LABEL[slot] || slot} recorded`); onSaved();
    } catch (e) { toast.error(clean(e)); }
  };
  const saveEnteral = async () => {
    if (!enteral.ml || enteral.kcalPerMl == null || enteral.proteinGPerL == null) return toast.error('Enter volume, kcal/mL and protein g/L from the feed label');
    const t = intakeTotals({ enteral: { ml: enteral.ml, kcalPerMl: enteral.kcalPerMl, proteinGPerL: enteral.proteinGPerL } });
    try {
      await nutritionService.saveIntake({ patient_id: patientId, intake_date: date, meal: 'enteral', plan_id: planRec?.id ?? null, items: [{ enteral }], kcal: t.kcal, protein_g: t.proteinG, target_kcal: day?.targetKcal ?? null, target_protein_g: day?.targetProteinG ?? null, note: null });
      toast.success('Enteral feed recorded'); onSaved();
    } catch (e) { toast.error(clean(e)); }
  };

  const dayKcal = recorded.reduce((s, r) => s + Number(r.kcal), 0), dayProt = recorded.reduce((s, r) => s + Number(r.protein_g), 0);
  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-end gap-3">
        <label className="text-sm"><span className="text-gray-600">Date</span><input type="date" value={date} onChange={e => setDate(e.target.value)} className="block border rounded px-2 py-1" /></label>
        <div className="text-sm">Recorded so far: <b>{Math.round(dayKcal)} kcal</b>{day ? ` of ${day.targetKcal}` : ''} ({day ? Math.round((dayKcal / day.targetKcal) * 100) : '—'}%) · <b>{Math.round(dayProt)} g protein</b>{day ? ` of ${day.targetProteinG}` : ''}</div>
        {!planRec && <p className="text-xs text-amber-700">No approved meal plan — record foods eaten as extras.</p>}
      </div>
      {slots.map(slot => {
        const t = mealTotals(slot);
        const done = recorded.find(r => r.meal === slot);
        return (
          <div key={slot} className="bg-white border rounded-lg p-3">
            <div className="flex justify-between items-center mb-1"><div className="font-medium">{SLOT_LABEL[slot] || slot}</div>
              <div className="text-xs text-gray-600">{done ? `Saved: ${Math.round(Number(done.kcal))} kcal, ${Number(done.protein_g)} g protein${done.recorded_by_name ? ` · ${done.recorded_by_name}` : ''}` : 'Not recorded'}</div></div>
            {(day?.items || []).filter(i => i.slot === slot).map(i => (
              <div key={i.key} className="flex flex-wrap items-center gap-2 py-1 text-sm">
                <span className="flex-1 min-w-[10rem]">{i.name} <span className="text-xs text-gray-500">{i.units ? `${i.units.n} ${i.units.label}` : `${i.servedG} g`} · {i.nutrients.energy_kcal} kcal</span></span>
                <div className="flex gap-1">{FRACTIONS.map(([f, l]) => (
                  <button key={l} onClick={() => setEaten({ ...eaten, [`${slot}:${i.key}`]: f })}
                    className={`px-2 py-0.5 rounded text-xs border ${(eaten[`${slot}:${i.key}`] ?? 0) === f ? 'bg-emerald-600 text-white border-emerald-600' : 'bg-white'}`}>{l}</button>))}</div>
              </div>
            ))}
            {(extras[slot] || []).map((x, k) => (
              <div key={k} className="grid grid-cols-4 gap-2 items-end">
                <Txt label="Other food / supplement" value={x.name} onChange={v => setExtras({ ...extras, [slot]: extras[slot].map((y, j) => (j === k ? { ...y, name: v } : y)) })} />
                <Num label="Energy" unit="kcal" value={x.kcal} onChange={v => setExtras({ ...extras, [slot]: extras[slot].map((y, j) => (j === k ? { ...y, kcal: v } : y)) })} />
                <Num label="Protein" unit="g" value={x.proteinG} onChange={v => setExtras({ ...extras, [slot]: extras[slot].map((y, j) => (j === k ? { ...y, proteinG: v } : y)) })} />
                <button onClick={() => setExtras({ ...extras, [slot]: extras[slot].filter((_, j) => j !== k) })} className="h-8" aria-label="Remove"><Trash2 className="w-4 h-4 text-red-500" /></button>
              </div>
            ))}
            <div className="flex justify-between items-center mt-2">
              <button onClick={() => setExtras({ ...extras, [slot]: [...(extras[slot] || []), { name: '', kcal: null, proteinG: null }] })} className="text-xs text-emerald-700 flex items-center gap-0.5"><Plus className="w-3 h-3" />Add other food / supplement</button>
              <div className="flex items-center gap-2 text-sm">{t.kcal} kcal · {t.proteinG} g<button onClick={() => saveMeal(slot)} className="px-2 py-1 rounded bg-emerald-600 text-white text-xs flex items-center gap-1"><Save className="w-3.5 h-3.5" />Save</button></div>
            </div>
          </div>
        );
      })}
      <div className="bg-white border rounded-lg p-3 grid grid-cols-2 md:grid-cols-4 gap-2 items-end">
        <div className="col-span-2 md:col-span-4 font-medium text-sm">Enteral feed (from the feed label)</div>
        <Num label="Volume given" unit="mL" value={enteral.ml} onChange={v => setEnteral({ ...enteral, ml: v })} />
        <Num label="Energy" unit="kcal/mL" value={enteral.kcalPerMl} onChange={v => setEnteral({ ...enteral, kcalPerMl: v })} />
        <Num label="Protein" unit="g/L" value={enteral.proteinGPerL} onChange={v => setEnteral({ ...enteral, proteinGPerL: v })} />
        <button onClick={saveEnteral} className="h-9 px-3 rounded border border-emerald-600 text-emerald-700 text-sm">Save feed</button>
      </div>
      <Txt label="Note (reason for poor intake, barriers)" value={note} onChange={setNote} />
    </div>
  );
}
