/**
 * Past medical / surgical, drug, allergy, gynaecological, family and social
 * history and the review of systems. "Not asked" is always distinguishable
 * from a documented negative.
 */
import React from 'react';
import type { ClerkingData, Medication, Allergy } from '../../../clinical/clerking/types';
import {
  COMORBIDITIES, PSH_QUESTIONS, FAMILY_QUESTIONS, SOCIAL_QUESTIONS, GYN_QUESTIONS, ROS,
  DRUG_ROUTES, DRUG_FREQUENCIES, DRUG_ADHERENCE, HIGH_RISK_DRUG_CLASSES, COMMON_ALLERGENS, ALLERGY_REACTIONS, ALLERGY_SEVERITY, ALLERGY_CERTAINTY,
} from '../../../clinical/clerking/history';
import { QuestionField, QuestionGrid, Section, TriState, YesNoUnknown } from './fields';

const COMMON_DRUGS = [
  'Metformin', 'Glibenclamide', 'Insulin (soluble)', 'Insulin (mixtard)', 'Amlodipine', 'Lisinopril', 'Losartan', 'Nifedipine', 'Hydrochlorothiazide', 'Atenolol',
  'Aspirin', 'Clopidogrel', 'Warfarin', 'Rivaroxaban', 'Enoxaparin', 'Atorvastatin', 'Folic acid', 'Hydroxyurea', 'Paludrine (proguanil)',
  'Tenofovir/lamivudine/dolutegravir (TLD)', 'Isoniazid', 'Rifampicin-based TB regimen', 'Prednisolone', 'Dexamethasone', 'Salbutamol inhaler', 'Beclomethasone inhaler',
  'Carbamazepine', 'Phenytoin', 'Sodium valproate', 'Levothyroxine', 'Carbimazole', 'Omeprazole', 'Paracetamol', 'Ibuprofen', 'Diclofenac', 'Tramadol',
  'Amoxicillin-clavulanate', 'Ciprofloxacin', 'Metronidazole', 'Ceftriaxone', 'Ferrous sulphate', 'Vitamin C', 'Zinc', 'Combined oral contraceptive', 'Herbal preparation',
];

// Full class names (not built from fragments) so Tailwind keeps them.
const ON_TONES: Record<string, string> = {
  green: 'bg-green-600 text-white border-green-600',
  red: 'bg-red-600 text-white border-red-600',
  gray: 'bg-gray-600 text-white border-gray-600',
};
const btn = (on: boolean, tone: 'green' | 'red' | 'gray' = 'green') =>
  `px-3 py-1.5 text-xs rounded-lg border ${on ? ON_TONES[tone] : 'bg-white text-gray-700 border-gray-300 hover:border-gray-400'}`;

export const HistoryEditor: React.FC<{
  data: ClerkingData;
  onChange: (next: ClerkingData) => void;
  showGyn: boolean;
  onToggleGyn?: () => void;
}> = ({ data, onChange, showGyn, onToggleGyn }) => {
  const h = data.history;
  const setH = (key: string, value: any) => onChange({ ...data, history: { ...h, [key]: value } });
  const pmh = h.pmh || {};
  const setPmh = (id: string, patch: Record<string, any>) => setH('pmh', { ...pmh, [id]: { ...(pmh[id] || {}), ...patch } });
  const ros = h.ros || {};

  const setMed = (i: number, patch: Partial<Medication>) => onChange({ ...data, medications: data.medications.map((m, j) => (j === i ? { ...m, ...patch } : m)) });
  const setAllergy = (i: number, patch: Partial<Allergy>) => onChange({ ...data, allergies: data.allergies.map((a, j) => (j === i ? { ...a, ...patch } : a)) });
  const answeredPmh = COMORBIDITIES.filter(c => pmh[c.id]?.status).length;

  return (
    <div className="space-y-4">
      <Section title="Source of history">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <QuestionField q={{ id: 'informant', label: 'Informant', type: 'select', options: ['Patient', 'Relative', 'Carer / guardian', 'Referral letter', 'Old records', 'Interpreter'] }}
            value={data.source.informant || undefined} onChange={v => onChange({ ...data, source: { ...data.source, informant: v || '' } })} />
          <QuestionField q={{ id: 'reliability', label: 'Reliability', type: 'select', options: ['Reliable', 'Partly reliable', 'Unreliable'] }}
            value={data.source.reliability || undefined} onChange={v => onChange({ ...data, source: { ...data.source, reliability: v || '' } })} />
        </div>
      </Section>

      <Section title="Past medical history, comorbidities and risk factors" subtitle="Yes / No / Unknown for each — unanswered rows are reported as “not asked”"
        badge={<span className="text-[11px] px-2 py-0.5 rounded-full bg-gray-100 text-gray-600">{answeredPmh}/{COMORBIDITIES.length}</span>}>
        <div className="flex justify-end">
          <button type="button" className="text-xs text-green-700 underline"
            onClick={() => { const next = { ...pmh }; COMORBIDITIES.forEach(c => { if (!next[c.id]?.status) next[c.id] = { ...(next[c.id] || {}), status: 'No' }; }); setH('pmh', next); }}>
            Patient denies all the remaining conditions → mark them “No”
          </button>
        </div>
        <div className="divide-y divide-gray-100">
          {COMORBIDITIES.map(c => (
            <div key={c.id} className="py-2">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <span className={`text-sm ${pmh[c.id]?.status === 'Yes' ? 'font-semibold text-amber-800' : 'text-gray-800'}`}>{c.label}</span>
                  {c.riskFactor && pmh[c.id]?.status === 'Yes' && <span className="block text-[11px] text-amber-700">{c.riskFactor}</span>}
                </div>
                <YesNoUnknown value={pmh[c.id]?.status} onChange={v => setPmh(c.id, { status: v })} />
              </div>
              {pmh[c.id]?.status === 'Yes' && c.details && (
                <div className="mt-2 pl-3 border-l-2 border-amber-200">
                  <QuestionGrid questions={c.details} answers={pmh[c.id]} onChange={(id, v) => setPmh(c.id, { [id]: v })} />
                </div>
              )}
            </div>
          ))}
        </div>
        <label className="block">
          <span className="block text-xs font-medium text-gray-600 mb-1">Other medical conditions</span>
          <input className="w-full rounded-lg border border-gray-300 px-2.5 py-2 text-sm" value={pmh.other || ''} onChange={e => setH('pmh', { ...pmh, other: e.target.value || undefined })} />
        </label>
      </Section>

      <Section title="Past surgical history" defaultOpen={false}>
        <QuestionGrid questions={PSH_QUESTIONS} answers={h.psh || {}} onChange={(id, v) => setH('psh', { ...(h.psh || {}), [id]: v })} />
      </Section>

      <Section title="Drug history" subtitle="Regular medicines, herbal preparations and adherence"
        badge={!data.medicationStatus ? <span className="text-[11px] px-2 py-0.5 rounded-full bg-amber-100 text-amber-700">Not documented</span> : undefined}>
        <div className="flex flex-wrap gap-2">
          <button type="button" className={btn(data.medicationStatus === 'documented')} onClick={() => onChange({ ...data, medicationStatus: 'documented', medications: data.medications.length ? data.medications : [{ name: '' }] })}>Takes medicines</button>
          <button type="button" className={btn(data.medicationStatus === 'none')} onClick={() => onChange({ ...data, medicationStatus: 'none', medications: [] })}>No regular medicines</button>
          <button type="button" className={btn(data.medicationStatus === 'unknown', 'gray')} onClick={() => onChange({ ...data, medicationStatus: 'unknown' })}>Unknown</button>
        </div>
        {data.medicationStatus === 'documented' && (
          <div className="space-y-2">
            <datalist id="clerking-drugs">{COMMON_DRUGS.map(d => <option key={d} value={d} />)}</datalist>
            {data.medications.map((m, i) => (
              <div key={i} className="grid grid-cols-2 sm:grid-cols-6 gap-2 items-end bg-gray-50 rounded-lg p-2">
                <input list="clerking-drugs" placeholder="Drug name" className="col-span-2 rounded border border-gray-300 px-2 py-1.5 text-sm" value={m.name} onChange={e => setMed(i, { name: e.target.value })} />
                <input placeholder="Dose" className="rounded border border-gray-300 px-2 py-1.5 text-sm" value={m.dose || ''} onChange={e => setMed(i, { dose: e.target.value })} />
                <select className="rounded border border-gray-300 px-2 py-1.5 text-sm" value={m.route || ''} onChange={e => setMed(i, { route: e.target.value || undefined })}>
                  <option value="">Route</option>{DRUG_ROUTES.map(r => <option key={r}>{r}</option>)}
                </select>
                <select className="rounded border border-gray-300 px-2 py-1.5 text-sm" value={m.frequency || ''} onChange={e => setMed(i, { frequency: e.target.value || undefined })}>
                  <option value="">Frequency</option>{DRUG_FREQUENCIES.map(r => <option key={r}>{r}</option>)}
                </select>
                <select className="rounded border border-gray-300 px-2 py-1.5 text-sm" value={m.adherence || ''} onChange={e => setMed(i, { adherence: e.target.value || undefined })}>
                  <option value="">Adherence</option>{DRUG_ADHERENCE.map(r => <option key={r}>{r}</option>)}
                </select>
                <input placeholder="For (indication)" className="col-span-2 sm:col-span-5 rounded border border-gray-300 px-2 py-1.5 text-sm" value={m.indication || ''} onChange={e => setMed(i, { indication: e.target.value })} />
                <button type="button" className="text-xs text-red-600" onClick={() => onChange({ ...data, medications: data.medications.filter((_, j) => j !== i) })}>Remove</button>
              </div>
            ))}
            <button type="button" className="text-sm text-green-700" onClick={() => onChange({ ...data, medications: [...data.medications, { name: '' }] })}>+ Add medicine</button>
          </div>
        )}
        <QuestionField q={{ id: 'drug_high_risk', label: 'Specifically asked — is the patient on any of these?', type: 'multiselect', options: [...HIGH_RISK_DRUG_CLASSES, 'None of these'] }}
          value={h.drug_high_risk} onChange={v => setH('drug_high_risk', v)} />
      </Section>

      <Section title="Allergies" subtitle="State “No known drug allergies” explicitly — a blank is never assumed to mean none"
        badge={!data.allergyStatus || data.allergyStatus === 'not_asked' ? <span className="text-[11px] px-2 py-0.5 rounded-full bg-red-100 text-red-700">Not asked</span> : undefined}>
        <div className="flex flex-wrap gap-2">
          <button type="button" className={btn(data.allergyStatus === 'nkda')} onClick={() => onChange({ ...data, allergyStatus: 'nkda', allergies: [] })}>No known drug allergies</button>
          <button type="button" className={btn(data.allergyStatus === 'has_allergies', 'red')} onClick={() => onChange({ ...data, allergyStatus: 'has_allergies', allergies: data.allergies.length ? data.allergies : [{ substance: '' }] })}>Has allergies</button>
          <button type="button" className={btn(data.allergyStatus === 'unable', 'gray')} onClick={() => onChange({ ...data, allergyStatus: 'unable' })}>Unable to obtain</button>
        </div>
        {data.allergyStatus === 'has_allergies' && (
          <div className="space-y-2">
            {data.allergies.map((a, i) => {
              const listed = COMMON_ALLERGENS.includes(a.substance);
              return (
                <div key={i} className="grid grid-cols-2 sm:grid-cols-5 gap-2 items-end bg-red-50 rounded-lg p-2">
                  <select className="rounded border border-gray-300 px-2 py-1.5 text-sm" value={listed ? a.substance : a.substance ? 'Other' : ''}
                    onChange={e => setAllergy(i, { substance: e.target.value === 'Other' ? ' ' : e.target.value })}>
                    <option value="">Substance</option>{COMMON_ALLERGENS.map(x => <option key={x}>{x}</option>)}
                  </select>
                  {!listed && a.substance !== '' && (
                    <input placeholder="Name the substance" className="rounded border border-gray-300 px-2 py-1.5 text-sm" value={a.substance.trim()} onChange={e => setAllergy(i, { substance: e.target.value || ' ' })} />
                  )}
                  <select className="rounded border border-gray-300 px-2 py-1.5 text-sm" value={a.reaction || ''} onChange={e => setAllergy(i, { reaction: e.target.value || undefined })}>
                    <option value="">Reaction</option>{ALLERGY_REACTIONS.map(x => <option key={x}>{x}</option>)}
                  </select>
                  <select className="rounded border border-gray-300 px-2 py-1.5 text-sm" value={a.severity || ''} onChange={e => setAllergy(i, { severity: e.target.value || undefined })}>
                    <option value="">Severity</option>{ALLERGY_SEVERITY.map(x => <option key={x}>{x}</option>)}
                  </select>
                  <select className="rounded border border-gray-300 px-2 py-1.5 text-sm" value={a.certainty || ''} onChange={e => setAllergy(i, { certainty: e.target.value || undefined })}>
                    <option value="">Certainty</option>{ALLERGY_CERTAINTY.map(x => <option key={x}>{x}</option>)}
                  </select>
                  <button type="button" className="text-xs text-red-600" onClick={() => onChange({ ...data, allergies: data.allergies.filter((_, j) => j !== i) })}>Remove</button>
                </div>
              );
            })}
            <button type="button" className="text-sm text-red-700" onClick={() => onChange({ ...data, allergies: [...data.allergies, { substance: '' }] })}>+ Add allergy</button>
          </div>
        )}
      </Section>

      {showGyn ? (
        <Section title="Gynaecological and obstetric history" subtitle="Woman of reproductive age — pregnancy status affects drugs, imaging and anaesthesia">
          <QuestionGrid questions={GYN_QUESTIONS} answers={h.gyn || {}} onChange={(id, v) => setH('gyn', { ...(h.gyn || {}), [id]: v })} />
        </Section>
      ) : onToggleGyn ? (
        <button type="button" onClick={onToggleGyn} className="text-xs text-gray-600 underline">Add gynaecological / obstetric history</button>
      ) : null}

      <Section title="Family history" defaultOpen={false}>
        <QuestionGrid questions={FAMILY_QUESTIONS} answers={h.family || {}} onChange={(id, v) => setH('family', { ...(h.family || {}), [id]: v })} />
      </Section>

      <Section title="Social history" subtitle="Smoking, alcohol, mobility, support and payment — all affect healing and discharge planning" defaultOpen={false}>
        <QuestionGrid questions={SOCIAL_QUESTIONS} answers={h.social || {}} onChange={(id, v) => setH('social', { ...(h.social || {}), [id]: v })} />
      </Section>

      <Section title="Review of systems" defaultOpen={false}
        badge={<span className="text-[11px] px-2 py-0.5 rounded-full bg-gray-100 text-gray-600">{Object.values(ros).filter(Boolean).length} asked</span>}>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {ROS.map(sys => (
            <div key={sys.system} className="rounded-lg border border-gray-100 p-2">
              <div className="flex items-center justify-between mb-1">
                <span className="text-xs font-semibold text-gray-700">{sys.system}</span>
                <button type="button" className="text-[11px] text-green-700 underline"
                  onClick={() => { const next = { ...ros }; sys.symptoms.forEach(s => { if (!next[s]) next[s] = 'absent'; }); setH('ros', next); }}>
                  Rest “No”
                </button>
              </div>
              {sys.symptoms.map(s => <TriState key={s} label={s} value={ros[s]} onChange={v => setH('ros', { ...ros, [s]: v })} />)}
            </div>
          ))}
        </div>
      </Section>
    </div>
  );
};
