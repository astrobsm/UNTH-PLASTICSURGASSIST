/**
 * Critical-care review: build the case (drop-downs per category, serial
 * vitals and labs, every medication), see the rule-based analysis instantly,
 * request the consultant-level AI review, and save to the patient's record.
 */
import { useEffect, useMemo, useState } from 'react';
import { Brain, Download, Loader2, Plus, Save, Trash2 } from 'lucide-react';
import toast from 'react-hot-toast';
import { analyseCritical } from '../../clinical/critical/analyse';
import { FREQUENCIES, LAB_PANELS, MEDICATION_CATEGORIES, OTHER, ROUTES, SIGNS, SYMPTOMS } from '../../clinical/critical/catalogue';
import type { CcInput, CcLab, CcMedication, CcReport, CcVitals } from '../../clinical/critical/types';
import { criticalCareService, type AiReview } from '../../services/criticalCareService';
import { CriticalReportView } from './CriticalReportView';

const clean = (e: any) => String(e?.message || 'Something went wrong').replace(/^\[HTTP \d+\]\s*/, '');
const draftKey = (pid?: string | null) => `critical-care-draft:${pid || 'standalone'}`;
const n = (v: string) => (v.trim() === '' ? null : Number.isFinite(Number(v)) ? Number(v) : null);
const blank = (): CcInput => ({ patient: {}, comorbidities: [], allergies: [], symptoms: [], signs: [], vitals: [], labs: [], medications: [], imaging_ecg: [], fluid_balance: {}, ventilation: {} });
const inp = 'border rounded px-2 py-1 text-sm w-full';

function Pick({ cats, onAdd, extra }: { cats: Record<string, string[]>; onAdd: (category: string, item: string, rest: Record<string, string>) => void; extra: { key: string; label: string }[] }) {
  const [cat, setCat] = useState(Object.keys(cats)[0]);
  const [item, setItem] = useState('');
  const [other, setOther] = useState('');
  const [rest, setRest] = useState<Record<string, string>>({});
  const items = [...(cats[cat] || []), OTHER];
  const add = () => {
    const it = item === OTHER || !item ? other.trim() : item;
    if (!it) return toast.error('Choose or type an item');
    onAdd(cat, it, rest); setItem(''); setOther(''); setRest({});
  };
  return (
    <div className="grid grid-cols-2 md:grid-cols-6 gap-2 items-end">
      <select value={cat} onChange={e => { setCat(e.target.value); setItem(''); }} className={inp}>{Object.keys(cats).map(c => <option key={c}>{c}</option>)}</select>
      <select value={item} onChange={e => setItem(e.target.value)} className={inp}><option value="">— item —</option>{items.map(i => <option key={i}>{i}</option>)}</select>
      {(item === OTHER || (cats[cat] || []).length === 0) && <input placeholder="Specify" value={other} onChange={e => setOther(e.target.value)} className={inp} />}
      {extra.map(x => <input key={x.key} placeholder={x.label} value={rest[x.key] || ''} onChange={e => setRest({ ...rest, [x.key]: e.target.value })} className={inp} />)}
      <button type="button" onClick={add} className="h-8 px-2 rounded bg-emerald-600 text-white text-sm flex items-center justify-center gap-1"><Plus className="w-4 h-4" />Add</button>
    </div>
  );
}

const Chips = ({ xs, onRemove }: { xs: string[]; onRemove: (i: number) => void }) => (
  <div className="flex flex-wrap gap-1 mt-1">{xs.map((x, i) => <span key={i} className="text-xs bg-gray-100 rounded px-2 py-0.5 flex items-center gap-1">{x}<button type="button" onClick={() => onRemove(i)} aria-label="Remove">×</button></span>)}</div>
);

export function CriticalCareReview({ patientId, initial, onSaved, canSave = true }: {
  patientId?: string | null; initial?: { id: number; version: number; data: { input: CcInput; ai?: AiReview | null } } | null; onSaved?: () => void; canSave?: boolean;
}) {
  const [input, setInput] = useState<CcInput>(() => {
    if (initial?.data?.input) return initial.data.input;
    try { const d = localStorage.getItem(draftKey(patientId)); if (d) return JSON.parse(d); } catch { /* blocked storage */ }
    return blank();
  });
  const [ai, setAi] = useState<AiReview | null>(initial?.data?.ai ?? null);
  const [tab, setTab] = useState<'rule' | 'ai'>(initial?.data?.ai ? 'ai' : 'rule');
  const [busy, setBusy] = useState<'prefill' | 'ai' | 'save' | null>(null);
  useEffect(() => { try { localStorage.setItem(draftKey(patientId), JSON.stringify(input)); } catch { /* blocked storage */ } }, [input, patientId]);

  const report: CcReport | null = useMemo(() => { try { return analyseCritical(input); } catch (e) { console.error('critical analysis', e); return null; } }, [input]);
  const set = (patch: Partial<CcInput>) => { setInput(p => ({ ...p, ...patch })); };
  const setP = (k: keyof CcInput['patient'], v: any) => setInput(p => ({ ...p, patient: { ...p.patient, [k]: v } }));

  const prefill = async () => {
    if (!patientId) return;
    setBusy('prefill');
    try {
      const r = await criticalCareService.prefillFromRecord(patientId);
      setInput(p => ({ ...r.input, symptoms: p.symptoms, signs: p.signs, comorbidities: p.comorbidities?.length ? p.comorbidities : r.input.comorbidities, clinician_question: p.clinician_question }));
      toast.success(r.sources.length ? `Prefilled: ${r.sources.join(', ')}` : 'Nothing found in the record to prefill');
    } catch (e) { toast.error(clean(e)); } finally { setBusy(null); }
  };
  const askAi = async () => {
    if (!report) return;
    setBusy('ai');
    try { const r = await criticalCareService.aiReview(input, report, patientId); setAi(r); setTab('ai'); toast.success('Consultant review received'); }
    catch (e) { toast.error(clean(e)); } finally { setBusy(null); }
  };
  const save = async () => {
    if (!patientId || !report) return;
    setBusy('save');
    try {
      await criticalCareService.save(patientId, input, report, ai, initial ? { id: initial.id, version: initial.version } : null);
      try { localStorage.removeItem(draftKey(patientId)); } catch { /* blocked storage */ }
      toast.success('Saved to the patient\'s encounters'); onSaved?.();
    } catch (e) { toast.error(clean(e)); } finally { setBusy(null); }
  };
  const exportJson = () => {
    const blob = new Blob([JSON.stringify({ input, rule_based: report, ai_review: ai?.review ?? null }, null, 2)], { type: 'application/json' });
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = `critical_care_review_${new Date().toISOString().slice(0, 10)}.json`; a.click(); URL.revokeObjectURL(a.href);
  };

  // ── row editors ──
  const vitals = input.vitals || [];
  const setVital = (i: number, k: keyof CcVitals, v: string) => set({ vitals: vitals.map((x, j) => (j === i ? { ...x, [k]: k === 'time' ? v : n(v) } : x)) });
  const labs = input.labs || [];
  const [labPanel, setLabPanel] = useState(Object.keys(LAB_PANELS)[2]);
  const [labTest, setLabTest] = useState('');
  const [labVal, setLabVal] = useState(''); const [labUnit, setLabUnit] = useState(''); const [labTime, setLabTime] = useState('');
  const testDef = (LAB_PANELS[labPanel] || []).find(t => t.test === labTest);
  const addLab = () => {
    if (!labTest || labVal.trim() === '') return toast.error('Choose a test and enter a value');
    const unit = labUnit || testDef?.units[0] || '';
    const l: CcLab = { panel: labPanel, test: labTest, value: unit === 'text' ? labVal : (Number.isFinite(Number(labVal)) ? Number(labVal) : labVal), unit: unit === 'text' ? '' : unit, time: labTime || new Date().toISOString().slice(0, 16) };
    set({ labs: [...labs, l] }); setLabVal('');
  };
  const meds = input.medications || [];
  const [med, setMed] = useState<CcMedication & { category?: string; other?: string }>({ name: '', category: Object.keys(MEDICATION_CATEGORIES)[0] });
  const addMed = () => {
    const name = med.name === OTHER || !med.name ? (med.other || '').trim() : med.name;
    if (!name) return toast.error('Choose or type a medication');
    const { category, other, ...m } = med;
    set({ medications: [...meds, { ...m, name, class: m.class || category }] });
    setMed({ name: '', category });
  };

  return (
    <div className="space-y-4">
      <div className="bg-amber-50 border border-amber-200 rounded p-2 text-xs text-amber-900">Decision support only. A qualified clinician must verify all calculations, doses and orders before acting.</div>
      <div className="flex flex-wrap gap-2">
        {patientId && <button type="button" onClick={prefill} disabled={!!busy} className="px-3 py-1.5 border rounded text-sm flex items-center gap-1">{busy === 'prefill' ? <Loader2 className="w-4 h-4 animate-spin" /> : null}Prefill from the record</button>}
        <button type="button" onClick={() => { if (window.confirm('Clear the case?')) { setInput(blank()); setAi(null); } }} className="px-3 py-1.5 border rounded text-sm">Clear</button>
      </div>

      <fieldset className="border rounded-lg p-3 space-y-2">
        <legend className="px-1 text-sm font-medium">Patient</legend>
        <div className="grid grid-cols-2 md:grid-cols-7 gap-2">
          <input placeholder="Age (years)" type="number" value={input.patient.age_years ?? ''} onChange={e => setP('age_years', n(e.target.value))} className={inp} />
          <select value={input.patient.sex || ''} onChange={e => setP('sex', e.target.value)} className={inp}><option value="">Sex</option><option value="male">Male</option><option value="female">Female</option></select>
          <input placeholder="Weight (kg)" type="number" value={input.patient.weight_kg ?? ''} onChange={e => setP('weight_kg', n(e.target.value))} className={inp} />
          <input placeholder="Height (cm)" type="number" value={input.patient.height_cm ?? ''} onChange={e => setP('height_cm', n(e.target.value))} className={inp} />
          <input placeholder="Location (ICU, ward…)" value={input.patient.location || ''} onChange={e => setP('location', e.target.value)} className={inp} />
          <label className="text-sm flex items-center gap-1"><input type="checkbox" checked={!!input.patient.pregnant} onChange={e => setP('pregnant', e.target.checked)} />Pregnant</label>
          <label className="text-sm flex items-center gap-1"><input type="checkbox" checked={!!input.patient.breastfeeding} onChange={e => setP('breastfeeding', e.target.checked)} />Breastfeeding</label>
        </div>
        <input placeholder="Presenting complaint" value={input.presenting_complaint || ''} onChange={e => set({ presenting_complaint: e.target.value })} className={inp} />
        <input placeholder="Comorbidities (comma-separated)" value={(input.comorbidities || []).join(', ')} onChange={e => set({ comorbidities: e.target.value.split(',').map(x => x.trim()).filter(Boolean) })} className={inp} />
        <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
          <input placeholder="Baseline creatinine (µmol/L)" type="number" value={input.baseline_creatinine_umol_l ?? ''} onChange={e => set({ baseline_creatinine_umol_l: n(e.target.value) })} className={inp} />
          <input placeholder="Burn % TBSA (if burns)" type="number" value={input.burn_tbsa_pct ?? ''} onChange={e => set({ burn_tbsa_pct: n(e.target.value) })} className={inp} />
          <input placeholder="Allergy agent" id="cc-allergy" className={inp} onKeyDown={e => { if (e.key === 'Enter') { const t = (e.target as HTMLInputElement); const [agent, reaction] = t.value.split(':'); if (agent.trim()) { set({ allergies: [...(input.allergies || []), { agent: agent.trim(), reaction: reaction?.trim() }] }); t.value = ''; } } }} />
          <span className="text-xs text-gray-500 self-center">Allergy: type "agent: reaction" and press Enter</span>
        </div>
        <Chips xs={(input.allergies || []).map(a => `${a.agent}${a.reaction ? ` (${a.reaction})` : ''}`)} onRemove={i => set({ allergies: (input.allergies || []).filter((_, j) => j !== i) })} />
      </fieldset>

      <fieldset className="border rounded-lg p-3">
        <legend className="px-1 text-sm font-medium">Symptoms</legend>
        <Pick cats={SYMPTOMS} extra={[{ key: 'duration', label: 'Duration' }, { key: 'severity', label: 'Severity' }]} onAdd={(category, item, r) => set({ symptoms: [...(input.symptoms || []), { category, item, duration: r.duration, severity: r.severity }] })} />
        <Chips xs={(input.symptoms || []).map(s => `${s.item}${s.duration ? `, ${s.duration}` : ''}${s.severity ? `, ${s.severity}` : ''}`)} onRemove={i => set({ symptoms: (input.symptoms || []).filter((_, j) => j !== i) })} />
      </fieldset>
      <fieldset className="border rounded-lg p-3">
        <legend className="px-1 text-sm font-medium">Signs</legend>
        <Pick cats={SIGNS} extra={[{ key: 'value', label: 'Value / finding' }]} onAdd={(category, item, r) => set({ signs: [...(input.signs || []), { category, item, value: r.value || 'present' }] })} />
        <Chips xs={(input.signs || []).map(s => `${s.item}: ${s.value}`)} onRemove={i => set({ signs: (input.signs || []).filter((_, j) => j !== i) })} />
      </fieldset>

      <fieldset className="border rounded-lg p-3 overflow-x-auto">
        <legend className="px-1 text-sm font-medium">Vital signs (serial — oldest first)</legend>
        <table className="text-xs"><thead><tr>{['Time', 'HR', 'SBP', 'DBP', 'RR', 'Temp °C', 'SpO₂ %', 'FiO₂ (0.21–1)', 'GCS', ''].map(h => <th key={h} className="px-1 text-left">{h}</th>)}</tr></thead>
          <tbody>{vitals.map((x, i) => (
            <tr key={i}>
              <td><input type="datetime-local" value={x.time || ''} onChange={e => setVital(i, 'time', e.target.value)} className="border rounded px-1 w-40" /></td>
              {(['hr', 'sbp', 'dbp', 'rr', 'temp_c', 'spo2', 'fio2', 'gcs'] as const).map(k => <td key={k}><input type="number" step="any" value={(x as any)[k] ?? ''} onChange={e => setVital(i, k, e.target.value)} className="border rounded px-1 w-16" /></td>)}
              <td><button type="button" onClick={() => set({ vitals: vitals.filter((_, j) => j !== i) })} aria-label="Remove"><Trash2 className="w-4 h-4 text-red-500" /></button></td>
            </tr>))}</tbody></table>
        <button type="button" onClick={() => set({ vitals: [...vitals, { time: new Date().toISOString().slice(0, 16) }] })} className="mt-1 text-xs text-emerald-700 flex items-center gap-0.5"><Plus className="w-3 h-3" />Add vital-sign set</button>
      </fieldset>

      <fieldset className="border rounded-lg p-3 grid grid-cols-2 md:grid-cols-6 gap-2">
        <legend className="px-1 text-sm font-medium">Fluid balance and ventilation</legend>
        <input placeholder="Intake 24 h (mL)" type="number" value={input.fluid_balance?.intake_ml_24h ?? ''} onChange={e => set({ fluid_balance: { ...input.fluid_balance, intake_ml_24h: n(e.target.value) } })} className={inp} />
        <input placeholder="Output 24 h (mL)" type="number" value={input.fluid_balance?.output_ml_24h ?? ''} onChange={e => set({ fluid_balance: { ...input.fluid_balance, output_ml_24h: n(e.target.value) } })} className={inp} />
        <input placeholder="Hourly urine mL, oldest first: 40, 30, 20" value={(input.fluid_balance?.urine_ml_per_hour || []).join(', ')} onChange={e => set({ fluid_balance: { ...input.fluid_balance, urine_ml_per_hour: e.target.value.split(',').map(x => Number(x.trim())).filter(x => Number.isFinite(x)) } })} className={`${inp} col-span-2`} />
        <input placeholder="Ventilation mode" value={input.ventilation?.mode || ''} onChange={e => set({ ventilation: { ...input.ventilation, mode: e.target.value } })} className={inp} />
        <input placeholder="PEEP (cmH₂O)" type="number" value={input.ventilation?.peep ?? ''} onChange={e => set({ ventilation: { ...input.ventilation, peep: n(e.target.value) } })} className={inp} />
      </fieldset>

      <fieldset className="border rounded-lg p-3 space-y-2">
        <legend className="px-1 text-sm font-medium">Laboratory (add serial results with their time)</legend>
        <div className="grid grid-cols-2 md:grid-cols-6 gap-2 items-end">
          <select value={labPanel} onChange={e => { setLabPanel(e.target.value); setLabTest(''); }} className={inp}>{Object.keys(LAB_PANELS).map(p => <option key={p}>{p}</option>)}</select>
          <select value={labTest} onChange={e => { setLabTest(e.target.value); setLabUnit(''); }} className={inp}><option value="">— test —</option>{(LAB_PANELS[labPanel] || []).map(t => <option key={t.test}>{t.test}</option>)}</select>
          <input placeholder="Value" value={labVal} onChange={e => setLabVal(e.target.value)} className={inp} />
          <select value={labUnit || testDef?.units[0] || ''} onChange={e => setLabUnit(e.target.value)} className={inp}>{(testDef?.units || ['']).map(u => <option key={u} value={u}>{u || '(no unit)'}</option>)}</select>
          <input type="datetime-local" value={labTime} onChange={e => setLabTime(e.target.value)} className={inp} />
          <button type="button" onClick={addLab} className="h-8 px-2 rounded bg-emerald-600 text-white text-sm flex items-center justify-center gap-1"><Plus className="w-4 h-4" />Add</button>
        </div>
        <Chips xs={labs.map(l => `${l.test} ${l.value}${l.unit ? ' ' + l.unit : ''}${l.time ? ` @ ${String(l.time).replace('T', ' ').slice(0, 16)}` : ''}`)} onRemove={i => set({ labs: labs.filter((_, j) => j !== i) })} />
        <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
          <input placeholder="Imaging / ECG type (e.g. ECG, CXR)" id="cc-img-type" className={inp} />
          <input placeholder="Finding (e.g. peaked T waves)" id="cc-img-finding" className={`${inp} col-span-2`} />
          <button type="button" className="h-8 px-2 rounded border text-sm" onClick={() => {
            const t = document.getElementById('cc-img-type') as HTMLInputElement, f = document.getElementById('cc-img-finding') as HTMLInputElement;
            if (!f.value.trim()) return; set({ imaging_ecg: [...(input.imaging_ecg || []), { type: t.value.trim() || 'Imaging', finding: f.value.trim() }] }); t.value = ''; f.value = '';
          }}>Add imaging / ECG</button>
        </div>
        <Chips xs={(input.imaging_ecg || []).map(x => `${x.type}: ${x.finding}`)} onRemove={i => set({ imaging_ecg: (input.imaging_ecg || []).filter((_, j) => j !== i) })} />
      </fieldset>

      <fieldset className="border rounded-lg p-3 space-y-2">
        <legend className="px-1 text-sm font-medium">Medications (every drug, with dose, route, frequency and dates)</legend>
        <div className="grid grid-cols-2 md:grid-cols-6 gap-2 items-end">
          <select value={med.category} onChange={e => setMed({ ...med, category: e.target.value, name: '' })} className={inp}>{Object.keys(MEDICATION_CATEGORIES).map(c => <option key={c}>{c}</option>)}</select>
          <select value={med.name} onChange={e => setMed({ ...med, name: e.target.value })} className={inp}><option value="">— drug —</option>{[...(MEDICATION_CATEGORIES[med.category || ''] || []), OTHER].map(d => <option key={d}>{d}</option>)}</select>
          {(med.name === OTHER || (MEDICATION_CATEGORIES[med.category || ''] || []).length === 0) && <input placeholder="Drug name / herbal remedy" value={med.other || ''} onChange={e => setMed({ ...med, other: e.target.value })} className={inp} />}
          <input placeholder="Dose" value={med.dose ?? ''} onChange={e => setMed({ ...med, dose: e.target.value })} className={inp} />
          <input placeholder="Unit (mg, g, units, mL/h)" value={med.unit || ''} onChange={e => setMed({ ...med, unit: e.target.value })} className={inp} />
          <select value={med.route || ''} onChange={e => setMed({ ...med, route: e.target.value })} className={inp}><option value="">Route</option>{ROUTES.map(r => <option key={r}>{r}</option>)}</select>
          <select value={med.frequency || ''} onChange={e => setMed({ ...med, frequency: e.target.value })} className={inp}><option value="">Frequency</option>{FREQUENCIES.map(f => <option key={f}>{f}</option>)}</select>
          <input type="date" title="Start date" value={med.start_date || ''} onChange={e => setMed({ ...med, start_date: e.target.value })} className={inp} />
          <input placeholder="Duration (days)" type="number" value={med.duration_days ?? ''} onChange={e => setMed({ ...med, duration_days: n(e.target.value) })} className={inp} />
          <input placeholder="Indication" value={med.indication || ''} onChange={e => setMed({ ...med, indication: e.target.value })} className={inp} />
          <input placeholder="Infusion rate (if continuous)" value={med.infusion_rate || ''} onChange={e => setMed({ ...med, infusion_rate: e.target.value })} className={inp} />
          <label className="text-sm flex items-center gap-1"><input type="checkbox" checked={!!med.loading_dose} onChange={e => setMed({ ...med, loading_dose: e.target.checked })} />Loading dose</label>
          <button type="button" onClick={addMed} className="h-8 px-2 rounded bg-emerald-600 text-white text-sm flex items-center justify-center gap-1"><Plus className="w-4 h-4" />Add drug</button>
        </div>
        <Chips xs={meds.map(m => `${m.name} ${m.dose ?? ''}${m.unit ? ' ' + m.unit : ''} ${m.route || ''} ${m.frequency || ''}`.replace(/\s+/g, ' ').trim())} onRemove={i => set({ medications: meds.filter((_, j) => j !== i) })} />
      </fieldset>

      <input placeholder="Specific question for the reviewer (optional)" value={input.clinician_question || ''} onChange={e => set({ clinician_question: e.target.value })} className={inp} />

      <div className="flex flex-wrap gap-2 sticky top-0 bg-white py-2 z-10 border-b">
        <button type="button" onClick={() => setTab('rule')} className={`px-3 py-1.5 rounded text-sm ${tab === 'rule' ? 'bg-emerald-600 text-white' : 'border'}`}>Rule-based analysis (live)</button>
        <button type="button" onClick={() => (ai ? setTab('ai') : askAi())} disabled={busy === 'ai' || !report} className={`px-3 py-1.5 rounded text-sm flex items-center gap-1 ${tab === 'ai' ? 'bg-indigo-600 text-white' : 'border border-indigo-600 text-indigo-700'}`}>
          {busy === 'ai' ? <Loader2 className="w-4 h-4 animate-spin" /> : <Brain className="w-4 h-4" />}{ai ? 'Consultant AI review' : 'Request consultant AI review'}</button>
        {ai && <button type="button" onClick={askAi} disabled={!!busy} className="px-3 py-1.5 border rounded text-sm">Re-run AI review</button>}
        <button type="button" onClick={exportJson} className="px-3 py-1.5 border rounded text-sm flex items-center gap-1"><Download className="w-4 h-4" />Export JSON</button>
        {patientId && canSave && <button type="button" onClick={save} disabled={!!busy || !report} className="ml-auto px-3 py-1.5 rounded bg-emerald-700 text-white text-sm flex items-center gap-1">{busy === 'save' ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}Save to record</button>}
      </div>

      {tab === 'ai' && ai ? (
        <div className="space-y-2">
          <p className="text-xs text-gray-500">Model {ai.model} · prompt {ai.prompt_version} · {ai.deidentified ? 'de-identified' : ''}. Rule-based calculations remain the reference.</p>
          {ai.discrepancies.length > 0 && <div className="bg-red-50 border border-red-200 rounded p-2 text-xs text-red-800"><b>Differences from the app's own analysis — verify:</b><ul className="list-disc pl-5">{ai.discrepancies.map((d, i) => <li key={i}>{d}</li>)}</ul></div>}
          <CriticalReportView r={ai.review} />
        </div>
      ) : report ? <CriticalReportView r={report} /> : <p className="text-sm text-red-700">The case could not be analysed — check the entries.</p>}
    </div>
  );
}

export default CriticalCareReview;
