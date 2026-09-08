/**
 * Writing a prescription.
 *
 * Category, then drug, then the dose — which is the order a prescriber thinks
 * in, and the reason this is not simply a search box. Searching works when you
 * already know the name; the categories are for when you know what you want the
 * drug to do and not which one you are reaching for.
 *
 * Every choice is pre-filled from the formulary's own standard adult dose, so
 * the common case is two clicks and no typing, and every field stays editable
 * because the standard dose is a starting point and not an instruction.
 *
 * What is added to the sheet, always, is how to take it and what to expect from
 * it — one line each. A slip carrying a drug and a dose but no instruction
 * leaves the patient to invent the rest.
 */

import { useState, useMemo, useCallback } from 'react';
import {
  Pill, Search, Plus, Trash2, Printer, FileDown, AlertTriangle,
  ChevronRight, X, Check,
} from 'lucide-react';
import {
  populatedGroups, drugsInGroup, findDrug, howToTake, sideEffectsLine,
  frequencyInWords, type PrescribingGroup,
} from '../../data/prescribingCatalogue';
import type { BNFDrug, DrugFrequency, DrugRoute } from '../../data/bnfDrugDatabase';
import {
  printThermalSlip, generatePrescriptionPdf, doseLine,
  type PrescriptionItem, type PrescriptionDocument,
} from '../../services/prescriptionPrintService';

interface Props {
  patient: {
    id?: number | string;
    name: string;
    hospitalNumber?: string;
    age?: string | number;
    sex?: string;
    ward?: string;
    allergies?: string;
  };
  prescriber: { name: string; role?: string };
  /** Persists the finished prescription; printing works without it. */
  onSave?: (items: PrescriptionItem[], notes: string) => Promise<void> | void;
}

const FREQUENCIES: DrugFrequency[] = [
  'stat', 'od', 'bd', 'tds', 'qds', 'q6h', 'q8h', 'q12h', 'nocte', 'mane', 'prn', 'weekly',
];

export function PrescriptionBuilder({ patient, prescriber, onSave }: Props) {
  const [group, setGroup] = useState<PrescribingGroup | null>(null);
  const [query, setQuery] = useState('');
  const [picking, setPicking] = useState<BNFDrug | null>(null);
  const [items, setItems] = useState<PrescriptionItem[]>([]);
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);

  const groups = useMemo(() => populatedGroups(), []);

  /** Search cuts across every group; the categories are for browsing. */
  const results = useMemo(() => {
    const term = query.trim().toLowerCase();
    if (term.length >= 2) {
      return groups
        .flatMap(({ group: g }) => drugsInGroup(g))
        .filter((d, i, arr) => arr.findIndex((x) => x.id === d.id) === i)
        .filter((d) =>
          d.genericName.toLowerCase().includes(term)
          || d.brandNames.some((b) => b.toLowerCase().includes(term)))
        .slice(0, 40);
    }
    return group ? drugsInGroup(group) : [];
  }, [query, group, groups]);

  const addItem = useCallback((item: PrescriptionItem) => {
    setItems((cur) => [...cur, item]);
    setPicking(null);
  }, []);

  const document_: PrescriptionDocument = {
    patient: {
      name: patient.name,
      hospitalNumber: patient.hospitalNumber,
      age: patient.age,
      sex: patient.sex,
      ward: patient.ward,
      allergies: patient.allergies,
    },
    prescriber,
    items,
    notes: notes.trim() || undefined,
  };

  /**
   * Warns where a prescribed drug appears in the patient's recorded allergies.
   *
   * A plain substring match, deliberately: it is a prompt to look, not a
   * clearance to prescribe, and a check that quietly missed a match would be
   * worse than none because it would be trusted.
   */
  const allergyWarnings = useMemo(() => {
    const recorded = (patient.allergies || '').toLowerCase();
    if (!recorded.trim()) return [];
    return items.filter((i) => {
      const drug = findDrug(i.drugId);
      const names = [i.name, ...(drug?.brandNames ?? []), drug?.genericName ?? '']
        .filter(Boolean).map((n) => n!.toLowerCase());
      return names.some((n) => {
        const head = n.split(/[\s(]/)[0];
        return head.length > 3 && recorded.includes(head);
      });
    }).map((i) => i.name);
  }, [items, patient.allergies]);

  const save = async () => {
    if (!onSave || !items.length) return;
    setSaving(true);
    try { await onSave(items, notes.trim()); } finally { setSaving(false); }
  };

  return (
    <div className="space-y-4">
      {/* What has been written so far */}
      <section className="bg-white border rounded-xl overflow-hidden">
        <header className="flex items-center justify-between gap-3 px-4 py-3 border-b bg-gray-50">
          <h3 className="font-semibold text-gray-800 flex items-center gap-2">
            <Pill className="w-4 h-4 text-green-600" />
            Prescription
            {items.length > 0 && (
              <span className="text-xs font-normal text-gray-500">
                {items.length} medicine{items.length === 1 ? '' : 's'}
              </span>
            )}
          </h3>
          {items.length > 0 && (
            <div className="flex items-center gap-2">
              <button
                onClick={() => printThermalSlip(document_)}
                className="flex items-center gap-1.5 px-3 py-1.5 text-sm rounded-lg bg-gray-800 text-white hover:bg-gray-900"
                title="Print on the 80 mm thermal printer"
              >
                <Printer className="w-4 h-4" /> Print 80 mm
              </button>
              <button
                onClick={() => generatePrescriptionPdf(document_)}
                className="flex items-center gap-1.5 px-3 py-1.5 text-sm rounded-lg border border-gray-300 hover:bg-gray-50"
              >
                <FileDown className="w-4 h-4" /> PDF
              </button>
              {onSave && (
                <button
                  onClick={save} disabled={saving}
                  className="flex items-center gap-1.5 px-3 py-1.5 text-sm rounded-lg bg-green-600 text-white hover:bg-green-700 disabled:opacity-60"
                >
                  <Check className="w-4 h-4" /> {saving ? 'Saving…' : 'Save'}
                </button>
              )}
            </div>
          )}
        </header>

        {allergyWarnings.length > 0 && (
          <div role="alert" className="flex items-start gap-2 px-4 py-2.5 bg-red-50 border-b border-red-200 text-sm text-red-800">
            <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" />
            <span>
              <strong>{allergyWarnings.join(', ')}</strong> may match this patient&rsquo;s recorded
              allergies ({patient.allergies}). Check before dispensing.
            </span>
          </div>
        )}

        {items.length === 0 ? (
          <p className="px-4 py-6 text-sm text-gray-500">
            Nothing prescribed yet. Choose a category below, or search for a medicine by name.
          </p>
        ) : (
          <ul className="divide-y">
            {items.map((item, i) => {
              const drug = findDrug(item.drugId);
              return (
                <li key={`${item.drugId}-${i}`} className="px-4 py-3">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="font-medium text-gray-900">{i + 1}. {item.name}</p>
                      <p className="text-sm text-gray-600">{doseLine(item)}</p>
                      {drug && (
                        <>
                          <p className="text-xs text-gray-500 mt-1">
                            <span className="font-medium">How:</span>{' '}
                            {howToTake(drug, item.frequency, item.route, item.duration)}
                          </p>
                          <p className="text-xs text-gray-500 italic">
                            <span className="font-medium not-italic">Effects:</span>{' '}
                            {sideEffectsLine(drug)}
                          </p>
                        </>
                      )}
                      {item.notes && <p className="text-xs text-gray-500 mt-0.5">Note: {item.notes}</p>}
                    </div>
                    <button
                      onClick={() => setItems((cur) => cur.filter((_, j) => j !== i))}
                      className="p-1.5 rounded hover:bg-red-50 text-red-500 shrink-0"
                      aria-label={`Remove ${item.name}`}
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </li>
              );
            })}
          </ul>
        )}

        {items.length > 0 && (
          <div className="px-4 py-3 border-t">
            <label className="block text-xs font-medium text-gray-600 mb-1">
              Notes for the patient or the pharmacy
            </label>
            <textarea
              value={notes} onChange={(e) => setNotes(e.target.value)} rows={2}
              placeholder="e.g. Review in two weeks. Complete the full antibiotic course."
              className="w-full px-3 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-green-500 focus:border-transparent"
            />
          </div>
        )}
      </section>

      {/* Choosing */}
      <section className="bg-white border rounded-xl p-4">
        <div className="relative mb-3">
          <Search className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            value={query} onChange={(e) => setQuery(e.target.value)}
            placeholder="Search any medicine by generic or brand name…"
            className="w-full pl-9 pr-3 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-green-500 focus:border-transparent"
          />
        </div>

        {!query.trim() && (
          <div className="flex flex-wrap gap-1.5 mb-3">
            {groups.map(({ group: g, count }) => (
              <button
                key={g}
                onClick={() => setGroup(group === g ? null : g)}
                className={`px-2.5 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                  group === g
                    ? 'bg-green-600 text-white'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                {g} <span className="opacity-60">{count}</span>
              </button>
            ))}
          </div>
        )}

        {results.length > 0 ? (
          <ul className="max-h-72 overflow-y-auto divide-y border rounded-lg">
            {results.map((drug) => (
              <li key={drug.id}>
                <button
                  onClick={() => setPicking(drug)}
                  className="w-full text-left px-3 py-2.5 hover:bg-green-50 flex items-center justify-between gap-3"
                >
                  <span className="min-w-0">
                    <span className="block text-sm font-medium text-gray-900 truncate">
                      {drug.genericName}
                    </span>
                    <span className="block text-xs text-gray-500 truncate">
                      {drug.brandNames.slice(0, 2).join(', ') || drug.category}
                      {' · '}{drug.dosage.adult.standard}
                    </span>
                  </span>
                  <ChevronRight className="w-4 h-4 text-gray-300 shrink-0" />
                </button>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-gray-400 py-4 text-center">
            {query.trim()
              ? `No medicine matches “${query.trim()}”.`
              : 'Choose a category, or search by name.'}
          </p>
        )}
      </section>

      {picking && (
        <DoseDialog
          drug={picking}
          onCancel={() => setPicking(null)}
          onAdd={addItem}
        />
      )}
    </div>
  );
}

/** Dose, route, frequency and duration — pre-filled from the formulary. */
function DoseDialog({ drug, onAdd, onCancel }: {
  drug: BNFDrug;
  onAdd: (item: PrescriptionItem) => void;
  onCancel: () => void;
}) {
  const formulation = drug.formulations[0];
  const [form, setForm] = useState({
    dose: drug.dosage.adult.standard,
    route: (formulation?.route ?? 'oral') as DrugRoute,
    frequency: (drug.dosage.adult.frequency[0] ?? 'od') as DrugFrequency,
    duration: drug.dosage.adult.duration ?? '',
    quantity: '',
    notes: '',
  });

  const routes = Array.from(new Set(drug.formulations.map((f) => f.route)));

  return (
    <div
      className="fixed inset-0 z-50 bg-black/40 flex items-start sm:items-center justify-center p-4 overflow-y-auto"
      onClick={onCancel} role="dialog" aria-modal="true" aria-label={`Prescribe ${drug.genericName}`}
    >
      <div className="bg-white rounded-xl shadow-xl w-full max-w-lg my-8 sm:my-0" onClick={(e) => e.stopPropagation()}>
        <header className="flex items-start justify-between gap-3 px-4 py-3 border-b">
          <div className="min-w-0">
            <h3 className="font-semibold text-gray-900">{drug.genericName}</h3>
            <p className="text-xs text-gray-500">
              {drug.brandNames.slice(0, 3).join(', ') || drug.category}
            </p>
          </div>
          <button onClick={onCancel} className="p-1 rounded hover:bg-gray-100" aria-label="Cancel">
            <X className="w-5 h-5 text-gray-500" />
          </button>
        </header>

        <div className="p-4 space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <Field label="Dose">
              <input
                value={form.dose} onChange={(e) => setForm({ ...form, dose: e.target.value })}
                className={inputCls}
              />
            </Field>
            <Field label="Route">
              <select
                value={form.route} onChange={(e) => setForm({ ...form, route: e.target.value as DrugRoute })}
                className={inputCls}
              >
                {routes.map((r) => <option key={r} value={r}>{r}</option>)}
              </select>
            </Field>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <Field label="Frequency">
              <select
                value={form.frequency}
                onChange={(e) => setForm({ ...form, frequency: e.target.value as DrugFrequency })}
                className={inputCls}
              >
                {FREQUENCIES.map((f) => (
                  <option key={f} value={f}>{f} — {frequencyInWords(f)}</option>
                ))}
              </select>
            </Field>
            <Field label="Duration" hint="Blank means ongoing">
              <input
                value={form.duration} onChange={(e) => setForm({ ...form, duration: e.target.value })}
                placeholder="e.g. 5 days" className={inputCls}
              />
            </Field>
          </div>

          <Field label="Quantity to dispense" hint="Optional">
            <input
              value={form.quantity} onChange={(e) => setForm({ ...form, quantity: e.target.value })}
              placeholder="e.g. 15 tablets" className={inputCls}
            />
          </Field>

          {/* Shown before it is added, not after: the maximum and the cautions
              are what decide whether this dose is right. */}
          <div className="bg-gray-50 border rounded-lg p-3 text-xs text-gray-600 space-y-1">
            <p><span className="font-medium">Standard adult:</span> {drug.dosage.adult.standard} · max {drug.maxDailyDose}</p>
            <p><span className="font-medium">How to take:</span> {howToTake(drug, form.frequency, form.route, form.duration || undefined)}</p>
            <p><span className="font-medium">Side effects:</span> {sideEffectsLine(drug)}</p>
            {drug.contraindications.length > 0 && (
              <p className="text-red-700">
                <span className="font-medium">Do not give in:</span> {drug.contraindications.slice(0, 3).join(', ')}
              </p>
            )}
          </div>

          <Field label="Note on this medicine" hint="Optional">
            <input
              value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })}
              placeholder="e.g. take with food" className={inputCls}
            />
          </Field>
        </div>

        <footer className="flex justify-end gap-2 px-4 py-3 border-t">
          <button onClick={onCancel} className="px-3 py-2 text-sm rounded-lg border hover:bg-gray-50">
            Cancel
          </button>
          <button
            onClick={() => onAdd({
              drugId: drug.id,
              name: drug.genericName,
              strength: formulation?.strength,
              dose: form.dose,
              route: form.route,
              frequency: form.frequency,
              duration: form.duration.trim() || undefined,
              quantity: form.quantity.trim() || undefined,
              notes: form.notes.trim() || undefined,
            })}
            disabled={!form.dose.trim()}
            className="flex items-center gap-1.5 px-3 py-2 text-sm rounded-lg bg-green-600 text-white hover:bg-green-700 disabled:opacity-60"
          >
            <Plus className="w-4 h-4" /> Add to prescription
          </button>
        </footer>
      </div>
    </div>
  );
}

const inputCls =
  'w-full px-3 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-green-500 focus:border-transparent';

function Field({ label, hint, children }: {
  label: string; hint?: string; children: React.ReactNode;
}) {
  return (
    <label className="block">
      <span className="block text-xs font-medium text-gray-600 mb-1">
        {label}{hint && <span className="font-normal text-gray-400"> · {hint}</span>}
      </span>
      {children}
    </label>
  );
}

export default PrescriptionBuilder;
