/**
 * BNF drug dosing lookup.
 *
 * This is a view over the app's existing BNF database — the same records the
 * prescribing module uses, so a dose looked up here cannot differ from the dose
 * prescribed there.
 *
 * It is loaded lazily. The drug database is several thousand records, and
 * pulling it into the calculator tab would make every other calculator wait for
 * it.
 *
 * It deliberately does not prescribe. Interaction checking needs the patient's
 * current medication list, which lives in the prescribing module; the link at
 * the foot goes there.
 */

import React, { useMemo, useState } from 'react';
import { AlertTriangle, Info, Search, ShieldAlert } from 'lucide-react';
import { Link } from 'react-router-dom';
import {
  searchDrugs, generatePatientWarnings, getFrequencyLabel, getRouteLabel,
  type BNFDrug,
} from '../../../data/bnfDrugDatabase';

interface Props {
  weightKg: number;
  ageYears: number;
  sex: string;
  /** Passed through from the eGFR calculator when one has been run. */
  gfr?: number | null;
}

const WARN_STYLE: Record<string, string> = {
  danger: 'bg-red-50 border-red-300 text-red-900',
  warning: 'bg-amber-50 border-amber-300 text-amber-900',
  info: 'bg-blue-50 border-blue-200 text-blue-900',
};

export default function BnfDrugPanel({ weightKg, ageYears, sex, gfr }: Props) {
  const [query, setQuery] = useState('');
  const [selected, setSelected] = useState<BNFDrug | null>(null);
  const [pregnant, setPregnant] = useState(false);
  const [lactating, setLactating] = useState(false);
  const [hepatic, setHepatic] = useState(false);
  const [cardiac, setCardiac] = useState(false);

  const results = useMemo(
    () => (query.trim().length < 2 ? [] : searchDrugs(query).slice(0, 12)),
    [query]
  );

  const warnings = useMemo(() => {
    if (!selected) return [];
    return generatePatientWarnings(selected, {
      sex,
      pregnant,
      lactating,
      age: ageYears || undefined,
      weight: weightKg || undefined,
      gfr: gfr ?? undefined,
      hepaticImpairment: hepatic,
      cardiacDisease: cardiac,
    });
  }, [selected, sex, pregnant, lactating, ageYears, weightKg, gfr, hepatic, cardiac]);

  // Which dosage block applies. Elderly and paediatric doses are not the adult
  // dose adjusted by eye, and showing the adult figure to a prescriber treating
  // a child is the error this guards against.
  const doseBlock = useMemo(() => {
    if (!selected) return null;
    if (ageYears && ageYears < 18 && selected.dosage.pediatric) {
      return { label: 'Paediatric', info: selected.dosage.pediatric };
    }
    if (ageYears && ageYears >= 65 && selected.dosage.elderly) {
      return { label: 'Elderly', info: selected.dosage.elderly };
    }
    return { label: 'Adult', info: selected.dosage.adult };
  }, [selected, ageYears]);

  return (
    <div className="space-y-4">
      <div className="relative">
        <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
        <input
          value={query}
          onChange={e => { setQuery(e.target.value); setSelected(null); }}
          placeholder="Search by generic or brand name…"
          className="input pl-9"
        />
      </div>

      <div className="flex flex-wrap gap-4 text-sm">
        {sex === 'female' && (
          <>
            <label className="flex items-center gap-2">
              <input type="checkbox" checked={pregnant} onChange={e => setPregnant(e.target.checked)} /> Pregnant
            </label>
            <label className="flex items-center gap-2">
              <input type="checkbox" checked={lactating} onChange={e => setLactating(e.target.checked)} /> Breastfeeding
            </label>
          </>
        )}
        <label className="flex items-center gap-2">
          <input type="checkbox" checked={hepatic} onChange={e => setHepatic(e.target.checked)} /> Liver impairment
        </label>
        <label className="flex items-center gap-2">
          <input type="checkbox" checked={cardiac} onChange={e => setCardiac(e.target.checked)} /> Cardiac disease
        </label>
      </div>

      {gfr != null && (
        <p className="text-xs text-gray-600 flex items-center gap-1.5">
          <Info className="w-3.5 h-3.5" />
          Renal warnings use the eGFR of {gfr} mL/min/1.73m² from the GFR calculator.
        </p>
      )}

      {results.length > 0 && !selected && (
        <div className="border rounded-lg divide-y max-h-64 overflow-y-auto">
          {results.map(d => (
            <button
              key={d.id}
              onClick={() => setSelected(d)}
              className="w-full text-left p-2.5 hover:bg-gray-50"
            >
              <div className="text-sm font-medium text-gray-900">{d.genericName}</div>
              <div className="text-xs text-gray-500">
                {d.category}{d.brandNames.length > 0 && ` · ${d.brandNames.slice(0, 3).join(', ')}`}
              </div>
            </button>
          ))}
        </div>
      )}

      {query.trim().length >= 2 && results.length === 0 && !selected && (
        <p className="text-sm text-gray-600">
          No drug matches "{query}". The database covers the formulary this app prescribes from — a
          drug missing here should be checked in the current BNF.
        </p>
      )}

      {selected && (
        <div className="space-y-3">
          <div className="flex items-start justify-between gap-3">
            <div>
              <h3 className="font-semibold text-gray-900">{selected.genericName}</h3>
              {selected.brandNames.length > 0 && (
                <p className="text-xs text-gray-500">{selected.brandNames.join(', ')}</p>
              )}
            </div>
            <button onClick={() => setSelected(null)} className="text-sm text-primary-700 hover:underline">
              Change drug
            </button>
          </div>

          {warnings.length > 0 && (
            <div className="space-y-1.5">
              {warnings.map((w, i) => (
                <div key={i} className={`rounded-lg border p-2.5 text-sm flex gap-2 ${WARN_STYLE[w.level]}`}>
                  {w.level === 'danger' ? <ShieldAlert className="w-4 h-4 flex-shrink-0 mt-0.5" />
                    : w.level === 'warning' ? <AlertTriangle className="w-4 h-4 flex-shrink-0 mt-0.5" />
                    : <Info className="w-4 h-4 flex-shrink-0 mt-0.5" />}
                  <span>{w.message}</span>
                </div>
              ))}
            </div>
          )}

          {doseBlock && (
            <div className="border rounded-lg p-3 bg-gray-50">
              <div className="text-xs font-semibold text-gray-700 uppercase tracking-wide mb-1.5">
                {doseBlock.label} dose
              </div>
              <p className="text-sm font-medium text-gray-900">{doseBlock.info.standard}</p>
              <p className="text-xs text-gray-600 mt-1">
                Range {doseBlock.info.min} – {doseBlock.info.max} · Maximum daily {selected.maxDailyDose}
              </p>
              <p className="text-xs text-gray-600 mt-1">
                Frequency: {doseBlock.info.frequency.map(getFrequencyLabel).join(', ')}
                {doseBlock.info.duration && ` · ${doseBlock.info.duration}`}
              </p>
              {doseBlock.info.notes && <p className="text-xs text-gray-600 mt-1">{doseBlock.info.notes}</p>}
            </div>
          )}

          {selected.dosage.renalImpairment && (
            <div className="border rounded-lg p-3">
              <div className="text-xs font-semibold text-gray-700 uppercase tracking-wide mb-1">Renal impairment</div>
              <p className="text-sm text-gray-800">{selected.dosage.renalImpairment.adjustment}</p>
              {selected.dosage.renalImpairment.gfrThreshold && (
                <p className="text-xs text-gray-600 mt-0.5">Threshold: {selected.dosage.renalImpairment.gfrThreshold}</p>
              )}
            </div>
          )}

          {selected.dosage.hepaticImpairment && (
            <div className="border rounded-lg p-3">
              <div className="text-xs font-semibold text-gray-700 uppercase tracking-wide mb-1">Hepatic impairment</div>
              <p className="text-sm text-gray-800">{selected.dosage.hepaticImpairment.adjustment}</p>
            </div>
          )}

          {selected.formulations.length > 0 && (
            <div className="border rounded-lg p-3">
              <div className="text-xs font-semibold text-gray-700 uppercase tracking-wide mb-1.5">Formulations</div>
              <ul className="text-sm text-gray-800 space-y-0.5">
                {selected.formulations.map((f, i) => (
                  <li key={i}>{f.form} — {getRouteLabel(f.route)}</li>
                ))}
              </ul>
            </div>
          )}

          {selected.contraindications.length > 0 && (
            <div className="border border-red-200 bg-red-50 rounded-lg p-3">
              <div className="text-xs font-semibold text-red-800 uppercase tracking-wide mb-1.5">Contraindications</div>
              <ul className="list-disc pl-5 text-sm text-red-900 space-y-0.5">
                {selected.contraindications.map((c, i) => <li key={i}>{c}</li>)}
              </ul>
            </div>
          )}

          {selected.monitoringRequired && selected.monitoringRequired.length > 0 && (
            <div className="border rounded-lg p-3">
              <div className="text-xs font-semibold text-gray-700 uppercase tracking-wide mb-1.5">Monitoring</div>
              <ul className="list-disc pl-5 text-sm text-gray-800 space-y-0.5">
                {selected.monitoringRequired.map((m, i) => <li key={i}>{m}</li>)}
              </ul>
            </div>
          )}

          <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 text-sm text-blue-900">
            Interactions are not checked here — that needs this patient's current medication list.
            {' '}<Link to="/prescriptions" className="font-medium underline">Prescribe in the medication module</Link>,
            which checks interactions and allergies against what they are already taking.
          </div>
        </div>
      )}
    </div>
  );
}
