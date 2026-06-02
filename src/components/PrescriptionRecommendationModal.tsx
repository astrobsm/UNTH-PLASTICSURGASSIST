/**
 * PrescriptionRecommendationModal
 * --------------------------------
 * Intake → Draft → Review workflow for the Intelligent Prescription
 * Recommendation Engine. Generates evidence-based drug suggestions from
 * patient diagnoses, comorbidities, allergies, renal/hepatic/pregnancy state
 * and labs, then lets the clinician accept individual recommendations into the
 * working prescription list of the existing PrescriptionsPage.
 *
 * IMPORTANT: This is a Clinical Decision Support System. The attending
 * clinician remains responsible for the final prescription.
 */
import React, { useMemo, useState } from 'react';
import {
  X, Sparkles, AlertTriangle, AlertCircle, Info, Check, Plus, Search, Pill, ShieldAlert, Calculator,
} from 'lucide-react';
import {
  generateRecommendations,
  summarisePatientFlags,
  type PatientInput,
  type RecommendedDraft,
} from '../services/prescriptionRecommendationEngine';
import { getFrequencyLabel, getRouteLabel } from '../data/bnfDrugDatabase';

/** Comorbidity catalogue from the spec — kept as plain strings so they pass straight to the engine. */
const COMORBIDITY_OPTIONS: string[] = [
  'Peptic Ulcer Disease', 'Gastritis', 'GERD', 'Malignancy',
  'Chronic Kidney Disease', 'Acute Kidney Injury', 'Liver Disease',
  'Heart Failure', 'Hypertension', 'Diabetes Mellitus',
  'Peripheral Vascular Disease', 'Venous Insufficiency', 'Deep Vein Thrombosis',
  'Coronary Artery Disease', 'Stroke', 'Epilepsy', 'Neuropathy',
  'Parkinsonism', 'Dementia', 'COPD', 'Asthma', 'Tuberculosis', 'HIV',
  'Sickle Cell Disease', 'Anaemia', 'Pregnancy', 'Breastfeeding',
  'Osteoporosis', 'Autoimmune Disease', 'Obesity', 'Malnutrition',
  'Pressure Ulcer', 'Burn Injury', 'Chronic Wound', 'Diabetic Foot Ulcer',
  'Peripheral Neuropathy', 'Smoking', 'Alcohol Use',
  'Penicillin Allergy', 'Sulphonamide Allergy', 'NSAID Allergy', 'Opioid Allergy',
  'Renal Transplant', 'Liver Transplant', 'Immunosuppression', 'Sepsis',
];

interface SeedContext {
  name?: string;
  hospitalNumber?: string;
  age?: number;
  weight?: number;
  sex?: 'male' | 'female';
  pregnant?: boolean;
  lactating?: boolean;
  gfr?: number;
  hepaticImpairment?: boolean;
  cardiacDisease?: boolean;
  allergies?: string[];
  comorbidities?: string[];
  currentMedications?: string[];
}

interface Props {
  open: boolean;
  onClose: () => void;
  /** Seed values pulled from the current PrescriptionsPage patient context. */
  seed?: SeedContext;
  /** Called with the drafts the clinician accepts (one or many). */
  onAccept: (accepted: RecommendedDraft[]) => void;
}

const WarnIcon: React.FC<{ level: 'danger' | 'warning' | 'info' }> = ({ level }) => {
  if (level === 'danger') return <AlertTriangle className="w-4 h-4 text-red-600 flex-shrink-0" />;
  if (level === 'warning') return <AlertCircle className="w-4 h-4 text-amber-600 flex-shrink-0" />;
  return <Info className="w-4 h-4 text-blue-600 flex-shrink-0" />;
};

export const PrescriptionRecommendationModal: React.FC<Props> = ({ open, onClose, seed, onAccept }) => {
  const [step, setStep] = useState<'intake' | 'review'>('intake');

  // Intake state — seeded from the page context but fully editable
  const [age, setAge] = useState<string>(seed?.age?.toString() ?? '');
  const [weight, setWeight] = useState<string>(seed?.weight?.toString() ?? '');
  const [height, setHeight] = useState<string>('');
  const [sex, setSex] = useState<'male' | 'female'>(seed?.sex ?? 'male');
  const [pregnant, setPregnant] = useState<boolean>(!!seed?.pregnant);
  const [gestAge, setGestAge] = useState<string>('');
  const [lactating, setLactating] = useState<boolean>(!!seed?.lactating);
  const [gfr, setGfr] = useState<string>(seed?.gfr?.toString() ?? '');
  const [hepatic, setHepatic] = useState<boolean>(!!seed?.hepaticImpairment);
  const [cardiac, setCardiac] = useState<boolean>(!!seed?.cardiacDisease);

  // Diagnoses
  const [primaryDx, setPrimaryDx] = useState('');
  const [secondaryDx, setSecondaryDx] = useState('');
  const [additionalDx, setAdditionalDx] = useState<string[]>([]);
  const [addDxInput, setAddDxInput] = useState('');

  // Comorbidities
  const [comorbSearch, setComorbSearch] = useState('');
  const [comorbidities, setComorbidities] = useState<string[]>(seed?.comorbidities ?? []);

  // Allergies & meds — seeded
  const [allergies, setAllergies] = useState<string[]>(seed?.allergies ?? []);
  const [allergyInput, setAllergyInput] = useState('');
  const [currentMeds, setCurrentMeds] = useState<string[]>(seed?.currentMedications ?? []);
  const [medInput, setMedInput] = useState('');

  // Labs (optional)
  const [labs, setLabs] = useState<{ haemoglobin?: string; creatinine?: string; hba1c?: string; albumin?: string; crp?: string }>({});

  // Drafts & per-draft edits
  const [drafts, setDrafts] = useState<RecommendedDraft[]>([]);
  const [accepted, setAccepted] = useState<Set<string>>(new Set());
  const [edits, setEdits] = useState<Record<string, Partial<RecommendedDraft>>>({});

  const filteredComorb = useMemo(() => {
    const q = comorbSearch.toLowerCase().trim();
    if (!q) return COMORBIDITY_OPTIONS;
    return COMORBIDITY_OPTIONS.filter((c) => c.toLowerCase().includes(q));
  }, [comorbSearch]);

  const bmi = useMemo(() => {
    const w = parseFloat(weight); const h = parseFloat(height);
    if (!w || !h) return null;
    const m = h / 100;
    return (w / (m * m)).toFixed(1);
  }, [weight, height]);

  const buildPatientInput = (): PatientInput => {
    const dxList = [primaryDx, secondaryDx, ...additionalDx].map((s) => s.trim()).filter(Boolean);
    return {
      name: seed?.name,
      hospitalNumber: seed?.hospitalNumber,
      age: age ? parseFloat(age) : undefined,
      weight: weight ? parseFloat(weight) : undefined,
      height: height ? parseFloat(height) : undefined,
      sex,
      pregnant: sex === 'female' ? pregnant : false,
      gestationalAgeWeeks: pregnant && gestAge ? parseFloat(gestAge) : undefined,
      lactating: sex === 'female' ? lactating : false,
      gfr: gfr ? parseFloat(gfr) : undefined,
      hepaticImpairment: hepatic,
      cardiacDisease: cardiac,
      allergies,
      comorbidities,
      diagnoses: dxList,
      currentMedications: currentMeds,
      labs: {
        haemoglobin: labs.haemoglobin ? parseFloat(labs.haemoglobin) : undefined,
        creatinine: labs.creatinine ? parseFloat(labs.creatinine) : undefined,
        hba1c: labs.hba1c ? parseFloat(labs.hba1c) : undefined,
        albumin: labs.albumin ? parseFloat(labs.albumin) : undefined,
        crp: labs.crp ? parseFloat(labs.crp) : undefined,
      },
    };
  };

  const runEngine = () => {
    const input = buildPatientInput();
    const result = generateRecommendations(input);
    setDrafts(result);
    setAccepted(new Set(result.map((d) => d.drug.id))); // pre-select all
    setEdits({});
    setStep('review');
  };

  const toggleAccept = (id: string) => {
    const next = new Set(accepted);
    if (next.has(id)) next.delete(id); else next.add(id);
    setAccepted(next);
  };

  const patchEdit = (id: string, patch: Partial<RecommendedDraft>) => {
    setEdits((prev) => ({ ...prev, [id]: { ...(prev[id] || {}), ...patch } }));
  };

  const handleConfirm = () => {
    const out = drafts
      .filter((d) => accepted.has(d.drug.id))
      .map((d) => ({ ...d, ...(edits[d.drug.id] || {}) }));
    onAccept(out);
    onClose();
  };

  const toggleComorb = (c: string) => {
    setComorbidities((prev) => prev.includes(c) ? prev.filter((x) => x !== c) : [...prev, c]);
  };

  const addAllergy = () => {
    const v = allergyInput.trim();
    if (!v) return;
    if (!allergies.includes(v)) setAllergies([...allergies, v]);
    setAllergyInput('');
  };

  const addMed = () => {
    const v = medInput.trim();
    if (!v) return;
    if (!currentMeds.includes(v)) setCurrentMeds([...currentMeds, v]);
    setMedInput('');
  };

  const addDx = () => {
    const v = addDxInput.trim();
    if (!v) return;
    if (!additionalDx.includes(v)) setAdditionalDx([...additionalDx, v]);
    setAddDxInput('');
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-2 sm:p-4">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-5xl max-h-[95vh] flex flex-col overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-4 sm:px-6 py-3 bg-gradient-to-r from-purple-600 to-indigo-600 text-white">
          <div className="flex items-center gap-2 min-w-0">
            <Sparkles className="w-5 h-5 flex-shrink-0" />
            <div className="min-w-0">
              <h2 className="text-base sm:text-lg font-semibold truncate">Intelligent Prescription Recommendations</h2>
              <p className="text-[11px] text-purple-100">Clinical Decision Support — clinician approval required</p>
            </div>
          </div>
          <button onClick={onClose} className="p-1 hover:bg-white/20 rounded-lg" aria-label="Close">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Step indicator */}
        <div className="flex border-b border-gray-200 bg-gray-50 text-xs sm:text-sm">
          <div className={`flex-1 px-4 py-2 text-center font-medium ${step === 'intake' ? 'bg-white text-purple-700 border-b-2 border-purple-600' : 'text-gray-500'}`}>
            1. Patient Intake
          </div>
          <div className={`flex-1 px-4 py-2 text-center font-medium ${step === 'review' ? 'bg-white text-purple-700 border-b-2 border-purple-600' : 'text-gray-500'}`}>
            2. Review Draft ({drafts.length})
          </div>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-4 sm:px-6 py-4">
          {step === 'intake' && (
            <div className="space-y-5">
              {/* Demographics */}
              <section className="bg-gray-50 border border-gray-200 rounded-lg p-3">
                <h3 className="text-sm font-semibold text-gray-800 mb-2">Demographics</h3>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  <div>
                    <label className="block text-[11px] text-gray-600 mb-0.5">Age (years)</label>
                    <input type="number" value={age} onChange={(e) => setAge(e.target.value)} className="w-full px-2 py-1 border border-gray-300 rounded text-sm" />
                  </div>
                  <div>
                    <label className="block text-[11px] text-gray-600 mb-0.5">Sex</label>
                    <select value={sex} onChange={(e) => setSex(e.target.value as 'male' | 'female')} className="w-full px-2 py-1 border border-gray-300 rounded text-sm" aria-label="Sex">
                      <option value="male">Male</option>
                      <option value="female">Female</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-[11px] text-gray-600 mb-0.5">Weight (kg)</label>
                    <input type="number" value={weight} onChange={(e) => setWeight(e.target.value)} className="w-full px-2 py-1 border border-gray-300 rounded text-sm" />
                  </div>
                  <div>
                    <label className="block text-[11px] text-gray-600 mb-0.5">Height (cm)</label>
                    <input type="number" value={height} onChange={(e) => setHeight(e.target.value)} className="w-full px-2 py-1 border border-gray-300 rounded text-sm" />
                  </div>
                  {bmi && (
                    <div className="col-span-2 sm:col-span-4 flex items-center gap-2 text-xs text-gray-600">
                      <Calculator className="w-3.5 h-3.5" /> BMI: <strong className="text-gray-800">{bmi} kg/m²</strong>
                    </div>
                  )}
                </div>
                {sex === 'female' && (
                  <div className="mt-2 grid grid-cols-2 sm:grid-cols-3 gap-2">
                    <label className="inline-flex items-center gap-1.5 text-xs"><input type="checkbox" checked={pregnant} onChange={(e) => setPregnant(e.target.checked)} className="rounded" /> Pregnant</label>
                    {pregnant && (
                      <div>
                        <label className="block text-[11px] text-gray-600 mb-0.5">Gestational age (wk)</label>
                        <input type="number" value={gestAge} onChange={(e) => setGestAge(e.target.value)} className="w-full px-2 py-1 border border-gray-300 rounded text-sm" />
                      </div>
                    )}
                    <label className="inline-flex items-center gap-1.5 text-xs"><input type="checkbox" checked={lactating} onChange={(e) => setLactating(e.target.checked)} className="rounded" /> Lactating</label>
                  </div>
                )}
              </section>

              {/* Organ function */}
              <section className="bg-gray-50 border border-gray-200 rounded-lg p-3">
                <h3 className="text-sm font-semibold text-gray-800 mb-2">Organ function</h3>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                  <div>
                    <label className="block text-[11px] text-gray-600 mb-0.5">eGFR (ml/min/1.73m²)</label>
                    <input type="number" value={gfr} onChange={(e) => setGfr(e.target.value)} className="w-full px-2 py-1 border border-gray-300 rounded text-sm" />
                  </div>
                  <label className="inline-flex items-center gap-1.5 text-xs"><input type="checkbox" checked={hepatic} onChange={(e) => setHepatic(e.target.checked)} className="rounded" /> Hepatic impairment</label>
                  <label className="inline-flex items-center gap-1.5 text-xs"><input type="checkbox" checked={cardiac} onChange={(e) => setCardiac(e.target.checked)} className="rounded" /> Cardiac disease</label>
                </div>
              </section>

              {/* Diagnoses */}
              <section className="bg-gray-50 border border-gray-200 rounded-lg p-3">
                <h3 className="text-sm font-semibold text-gray-800 mb-2">Diagnoses</h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  <div>
                    <label className="block text-[11px] text-gray-600 mb-0.5">Primary diagnosis *</label>
                    <input value={primaryDx} onChange={(e) => setPrimaryDx(e.target.value)} placeholder="e.g. Diabetic foot ulcer" className="w-full px-2 py-1 border border-gray-300 rounded text-sm" />
                  </div>
                  <div>
                    <label className="block text-[11px] text-gray-600 mb-0.5">Secondary diagnosis</label>
                    <input value={secondaryDx} onChange={(e) => setSecondaryDx(e.target.value)} placeholder="e.g. Peripheral neuropathy" className="w-full px-2 py-1 border border-gray-300 rounded text-sm" />
                  </div>
                </div>
                <div className="mt-2">
                  <label className="block text-[11px] text-gray-600 mb-0.5">Additional diagnoses</label>
                  <div className="flex gap-2">
                    <input value={addDxInput} onChange={(e) => setAddDxInput(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addDx(); } }} placeholder="Type then press Enter" className="flex-1 px-2 py-1 border border-gray-300 rounded text-sm" />
                    <button type="button" onClick={addDx} className="px-3 py-1 bg-purple-600 text-white text-sm rounded hover:bg-purple-700">Add</button>
                  </div>
                  {additionalDx.length > 0 && (
                    <div className="flex flex-wrap gap-1.5 mt-2">
                      {additionalDx.map((d) => (
                        <span key={d} className="inline-flex items-center gap-1 px-2 py-0.5 bg-purple-100 text-purple-800 text-xs rounded-full">
                          {d}
                          <button onClick={() => setAdditionalDx(additionalDx.filter((x) => x !== d))} className="hover:text-red-600" aria-label={`Remove ${d}`}><X className="w-3 h-3" /></button>
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              </section>

              {/* Comorbidities */}
              <section className="bg-gray-50 border border-gray-200 rounded-lg p-3">
                <div className="flex items-center justify-between mb-2 flex-wrap gap-2">
                  <h3 className="text-sm font-semibold text-gray-800">Comorbidities ({comorbidities.length})</h3>
                  <div className="relative">
                    <Search className="absolute left-2 top-1.5 w-3.5 h-3.5 text-gray-400" />
                    <input value={comorbSearch} onChange={(e) => setComorbSearch(e.target.value)} placeholder="Filter…" className="pl-7 pr-2 py-1 border border-gray-300 rounded text-xs w-44" />
                  </div>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-1 max-h-48 overflow-y-auto pr-1">
                  {filteredComorb.map((c) => (
                    <label key={c} className={`inline-flex items-center gap-1.5 text-xs px-1.5 py-1 rounded cursor-pointer ${comorbidities.includes(c) ? 'bg-purple-100 text-purple-800' : 'hover:bg-white'}`}>
                      <input type="checkbox" checked={comorbidities.includes(c)} onChange={() => toggleComorb(c)} className="rounded" />
                      {c}
                    </label>
                  ))}
                </div>
              </section>

              {/* Allergies & current meds */}
              <section className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="bg-gray-50 border border-gray-200 rounded-lg p-3">
                  <h3 className="text-sm font-semibold text-gray-800 mb-2 flex items-center gap-1"><ShieldAlert className="w-4 h-4 text-red-600" /> Allergies</h3>
                  <div className="flex gap-2">
                    <input value={allergyInput} onChange={(e) => setAllergyInput(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addAllergy(); } }} placeholder="e.g. Penicillin" className="flex-1 px-2 py-1 border border-gray-300 rounded text-sm" />
                    <button type="button" onClick={addAllergy} className="px-3 py-1 bg-red-600 text-white text-sm rounded hover:bg-red-700">Add</button>
                  </div>
                  <div className="flex flex-wrap gap-1.5 mt-2">
                    {allergies.map((a) => (
                      <span key={a} className="inline-flex items-center gap-1 px-2 py-0.5 bg-red-100 text-red-800 text-xs rounded-full">
                        {a}
                        <button onClick={() => setAllergies(allergies.filter((x) => x !== a))} aria-label={`Remove ${a}`}><X className="w-3 h-3" /></button>
                      </span>
                    ))}
                  </div>
                </div>
                <div className="bg-gray-50 border border-gray-200 rounded-lg p-3">
                  <h3 className="text-sm font-semibold text-gray-800 mb-2 flex items-center gap-1"><Pill className="w-4 h-4 text-blue-600" /> Current medications</h3>
                  <div className="flex gap-2">
                    <input value={medInput} onChange={(e) => setMedInput(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addMed(); } }} placeholder="e.g. Warfarin" className="flex-1 px-2 py-1 border border-gray-300 rounded text-sm" />
                    <button type="button" onClick={addMed} className="px-3 py-1 bg-blue-600 text-white text-sm rounded hover:bg-blue-700">Add</button>
                  </div>
                  <div className="flex flex-wrap gap-1.5 mt-2">
                    {currentMeds.map((m) => (
                      <span key={m} className="inline-flex items-center gap-1 px-2 py-0.5 bg-blue-100 text-blue-800 text-xs rounded-full">
                        {m}
                        <button onClick={() => setCurrentMeds(currentMeds.filter((x) => x !== m))} aria-label={`Remove ${m}`}><X className="w-3 h-3" /></button>
                      </span>
                    ))}
                  </div>
                </div>
              </section>

              {/* Labs */}
              <section className="bg-gray-50 border border-gray-200 rounded-lg p-3">
                <h3 className="text-sm font-semibold text-gray-800 mb-2">Labs (optional)</h3>
                <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
                  {([
                    { k: 'haemoglobin', l: 'Hb (g/dL)' },
                    { k: 'creatinine', l: 'Creat (mg/dL)' },
                    { k: 'hba1c', l: 'HbA1c (%)' },
                    { k: 'albumin', l: 'Alb (g/dL)' },
                    { k: 'crp', l: 'CRP (mg/L)' },
                  ] as const).map(({ k, l }) => (
                    <div key={k}>
                      <label className="block text-[11px] text-gray-600 mb-0.5">{l}</label>
                      <input type="number" step="0.1" value={(labs as any)[k] || ''} onChange={(e) => setLabs({ ...labs, [k]: e.target.value })} className="w-full px-2 py-1 border border-gray-300 rounded text-sm" aria-label={l} />
                    </div>
                  ))}
                </div>
              </section>

              {/* Live safety flags */}
              <div className="bg-amber-50 border border-amber-200 rounded-lg p-3">
                <p className="text-xs font-semibold text-amber-900 mb-1">Patient safety flags</p>
                <ul className="text-xs text-amber-800 space-y-0.5">
                  {summarisePatientFlags(buildPatientInput()).map((f, i) => <li key={i}>• {f}</li>)}
                  {summarisePatientFlags(buildPatientInput()).length === 0 && <li className="text-amber-700/70">No special flags detected.</li>}
                </ul>
              </div>
            </div>
          )}

          {step === 'review' && (
            <div className="space-y-3">
              {drafts.length === 0 ? (
                <div className="text-center py-12 text-gray-500">
                  <Sparkles className="w-10 h-10 mx-auto mb-2 text-gray-300" />
                  <p className="text-sm">No drug recommendations were generated for this patient.</p>
                  <p className="text-xs mt-1">Try adding more specific diagnoses or comorbidities, then run again.</p>
                </div>
              ) : (
                drafts.map((d) => {
                  const isChosen = accepted.has(d.drug.id);
                  const e = edits[d.drug.id] || {};
                  return (
                    <div key={d.drug.id} className={`border-2 rounded-lg p-3 transition-colors ${isChosen ? 'border-purple-300 bg-purple-50/40' : 'border-gray-200 bg-white'}`}>
                      <div className="flex items-start justify-between gap-3">
                        <label className="flex items-start gap-2 cursor-pointer min-w-0 flex-1">
                          <input type="checkbox" checked={isChosen} onChange={() => toggleAccept(d.drug.id)} className="mt-1 rounded" />
                          <div className="min-w-0 flex-1">
                            <div className="flex flex-wrap items-center gap-2">
                              <h4 className="font-semibold text-gray-900 truncate">{d.drug.genericName}</h4>
                              <span className="text-[10px] px-1.5 py-0.5 bg-gray-100 text-gray-700 rounded">{d.drug.category}</span>
                              <span className="text-[10px] px-1.5 py-0.5 bg-purple-100 text-purple-700 rounded">{d.indication.replace(/_/g, ' ')}</span>
                            </div>
                            <p className="text-xs text-gray-600 mt-0.5">{d.rationale}</p>
                          </div>
                        </label>
                      </div>
                      <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 mt-2">
                        <div>
                          <label className="block text-[10px] text-gray-500 mb-0.5">Dose</label>
                          <input value={e.dose ?? d.dose} onChange={(ev) => patchEdit(d.drug.id, { dose: ev.target.value })} className="w-full px-2 py-1 border border-gray-300 rounded text-xs" aria-label="Dose" />
                        </div>
                        <div>
                          <label className="block text-[10px] text-gray-500 mb-0.5">Route</label>
                          <input value={(e.route as string) ?? getRouteLabel(d.route)} onChange={(ev) => patchEdit(d.drug.id, { route: ev.target.value as any })} className="w-full px-2 py-1 border border-gray-300 rounded text-xs" aria-label="Route" />
                        </div>
                        <div>
                          <label className="block text-[10px] text-gray-500 mb-0.5">Frequency</label>
                          <input value={(e.frequency as string) ?? getFrequencyLabel(d.frequency)} onChange={(ev) => patchEdit(d.drug.id, { frequency: ev.target.value as any })} className="w-full px-2 py-1 border border-gray-300 rounded text-xs" aria-label="Frequency" />
                        </div>
                        <div>
                          <label className="block text-[10px] text-gray-500 mb-0.5">Duration</label>
                          <input value={e.duration ?? d.duration} onChange={(ev) => patchEdit(d.drug.id, { duration: ev.target.value })} className="w-full px-2 py-1 border border-gray-300 rounded text-xs" aria-label="Duration" />
                        </div>
                        <div>
                          <label className="block text-[10px] text-gray-500 mb-0.5">Instructions</label>
                          <input value={e.instructions ?? d.instructions} onChange={(ev) => patchEdit(d.drug.id, { instructions: ev.target.value })} className="w-full px-2 py-1 border border-gray-300 rounded text-xs" aria-label="Instructions" />
                        </div>
                      </div>
                      {d.warnings.length > 0 && (
                        <div className="mt-2 space-y-1">
                          {d.warnings.map((w, i) => (
                            <div key={i} className={`flex items-start gap-1.5 text-[11px] px-2 py-1 rounded ${w.level === 'danger' ? 'bg-red-50 text-red-800' : w.level === 'warning' ? 'bg-amber-50 text-amber-800' : 'bg-blue-50 text-blue-800'}`}>
                              <WarnIcon level={w.level} />
                              <span>{w.message}</span>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  );
                })
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="border-t border-gray-200 px-4 sm:px-6 py-3 bg-gray-50 flex flex-wrap items-center justify-between gap-2">
          <p className="text-[11px] text-gray-500">
            ⚠ Decision support only. The clinician remains responsible for the final prescription.
          </p>
          <div className="flex items-center gap-2">
            {step === 'review' && (
              <button onClick={() => setStep('intake')} className="px-3 py-1.5 text-sm text-gray-700 border border-gray-300 rounded hover:bg-white">
                ← Back
              </button>
            )}
            <button onClick={onClose} className="px-3 py-1.5 text-sm text-gray-700 border border-gray-300 rounded hover:bg-white">Cancel</button>
            {step === 'intake' ? (
              <button onClick={runEngine} disabled={!primaryDx.trim()} className="px-4 py-1.5 text-sm bg-purple-600 text-white rounded hover:bg-purple-700 disabled:opacity-50 inline-flex items-center gap-1.5">
                <Sparkles className="w-4 h-4" /> Generate recommendations
              </button>
            ) : (
              <button onClick={handleConfirm} disabled={accepted.size === 0} className="px-4 py-1.5 text-sm bg-green-600 text-white rounded hover:bg-green-700 disabled:opacity-50 inline-flex items-center gap-1.5">
                <Check className="w-4 h-4" /> Accept {accepted.size} into prescription
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default PrescriptionRecommendationModal;
// avoid unused-warning for Plus icon (kept for future custom-add row)
void Plus;
