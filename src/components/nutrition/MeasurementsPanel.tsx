/**
 * Anthropometry and nutrition labs. Weights from the vitals chart and analytes
 * from completed lab orders appear here read-only (labelled with their source);
 * only values entered in this module can be marked entered-in-error.
 */
import { useMemo, useState } from 'react';
import { Plus, Trash2 } from 'lucide-react';
import toast from 'react-hot-toast';
import { MEASUREMENT_KINDS, WEIGHT_METHODS } from '../../../api/_lib/data/nutritionKinds.js';
import { nutritionService } from '../../services/nutritionService';
import type { StoredMeasurement } from '../../clinical/nutrition/fromRecord';
import { clean } from './fields';

const KINDS = MEASUREMENT_KINDS as Record<string, { unit: string; min: number; max: number; label: string; group: string }>;
const SOURCE: Record<string, string> = { nutrition: 'Nutrition', vital_signs: 'Vitals chart', lab_orders: 'Lab order' };

export function MeasurementsPanel({ patientId, measurements, onChanged }: { patientId: string; measurements: StoredMeasurement[]; onChanged: () => void }) {
  const [kind, setKind] = useState('weight');
  const [value, setValue] = useState('');
  const [method, setMethod] = useState('measured');
  const [when, setWhen] = useState(() => new Date().toISOString().slice(0, 16));
  const [busy, setBusy] = useState(false);
  const [filter, setFilter] = useState<'all' | 'body' | 'lab'>('all');
  const k = KINDS[kind];

  const add = async () => {
    const v = Number(value);
    if (!value || !Number.isFinite(v)) return toast.error('Enter a value');
    if (v < k.min || v > k.max) return toast.error(`${k.label} must be ${k.min}–${k.max} ${k.unit}`);
    setBusy(true);
    try {
      await nutritionService.addMeasurement({ patient_id: patientId, kind, value: v, method: kind === 'weight' ? method : undefined, measured_at: new Date(when).toISOString() });
      toast.success(`${k.label} recorded`); setValue(''); onChanged();
    } catch (e) { toast.error(clean(e)); } finally { setBusy(false); }
  };
  const inError = async (m: StoredMeasurement) => {
    const reason = window.prompt('Reason this value was entered in error');
    if (!reason) return;
    try { await nutritionService.measurementInError(Number(m.id), reason); toast.success('Marked entered in error'); onChanged(); } catch (e) { toast.error(clean(e)); }
  };
  const rows = useMemo(() => [...measurements].reverse().filter(m => filter === 'all' || KINDS[m.kind]?.group === filter), [measurements, filter]);

  return (
    <div className="space-y-3">
      <div className="bg-gray-50 border rounded-lg p-3 grid grid-cols-2 md:grid-cols-6 gap-2 items-end">
        <label className="text-sm col-span-2"><span className="text-gray-600">Measurement</span>
          <select value={kind} onChange={e => setKind(e.target.value)} className="mt-0.5 w-full border rounded px-2 py-1 bg-white">
            <optgroup label="Body">{Object.entries(KINDS).filter(([, v]) => v.group === 'body').map(([id, v]) => <option key={id} value={id}>{v.label} ({v.unit})</option>)}</optgroup>
            <optgroup label="Laboratory">{Object.entries(KINDS).filter(([, v]) => v.group === 'lab').map(([id, v]) => <option key={id} value={id}>{v.label} ({v.unit})</option>)}</optgroup>
          </select></label>
        <label className="text-sm"><span className="text-gray-600">Value ({k.unit})</span>
          <input type="number" step="any" value={value} onChange={e => setValue(e.target.value)} className="mt-0.5 w-full border rounded px-2 py-1" /></label>
        {kind === 'weight' ? (
          <label className="text-sm"><span className="text-gray-600">How weighed</span>
            <select value={method} onChange={e => setMethod(e.target.value)} className="mt-0.5 w-full border rounded px-2 py-1 bg-white">
              {WEIGHT_METHODS.map((w: string) => <option key={w} value={w}>{w.replace('_', ' ')}</option>)}</select></label>
        ) : <div />}
        <label className="text-sm"><span className="text-gray-600">When</span>
          <input type="datetime-local" value={when} onChange={e => setWhen(e.target.value)} className="mt-0.5 w-full border rounded px-2 py-1" /></label>
        <button disabled={busy} onClick={add} className="h-9 px-3 rounded bg-emerald-600 text-white text-sm flex items-center justify-center gap-1 disabled:opacity-50"><Plus className="w-4 h-4" />Record</button>
      </div>
      {kind === 'grip' && <p className="text-xs text-gray-500">Record the best of three attempts with the dominant hand.</p>}
      {kind === 'uun' && <p className="text-xs text-gray-500">24-hour collection. Nitrogen balance is calculated for days with recorded protein intake.</p>}
      <div className="flex gap-2 text-xs">{(['all', 'body', 'lab'] as const).map(f => <button key={f} onClick={() => setFilter(f)} className={`px-2 py-0.5 rounded ${filter === f ? 'bg-emerald-600 text-white' : 'bg-gray-100'}`}>{f === 'all' ? 'All' : f === 'body' ? 'Body' : 'Laboratory'}</button>)}</div>
      <div className="bg-white border rounded-lg overflow-x-auto">
        <table className="min-w-full text-sm">
          <thead className="bg-gray-50 text-left text-gray-600"><tr><th className="px-3 py-2">When</th><th className="px-3 py-2">Measurement</th><th className="px-3 py-2">Value</th><th className="px-3 py-2">Method / source</th><th /></tr></thead>
          <tbody className="divide-y">
            {rows.map(m => (
              <tr key={String(m.id)}>
                <td className="px-3 py-1.5 whitespace-nowrap">{new Date(m.measured_at).toLocaleString(undefined, { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}</td>
                <td className="px-3 py-1.5">{KINDS[m.kind]?.label || m.kind}</td>
                <td className="px-3 py-1.5">{m.value} {m.unit}</td>
                <td className="px-3 py-1.5 text-xs text-gray-600">{m.method ? `${String(m.method).replace('_', ' ')} · ` : ''}{SOURCE[m.source || 'nutrition']}</td>
                <td className="px-3 py-1.5">{(m.source ?? 'nutrition') === 'nutrition' && <button onClick={() => inError(m)} title="Entered in error"><Trash2 className="w-4 h-4 text-red-500" /></button>}</td>
              </tr>
            ))}
            {!rows.length && <tr><td colSpan={5} className="px-3 py-6 text-center text-gray-500">No measurements yet.</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
}
