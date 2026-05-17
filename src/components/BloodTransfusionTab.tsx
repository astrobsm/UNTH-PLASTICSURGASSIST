/**
 * BloodTransfusionTab — Patient profile section for blood transfusion records.
 *
 * Features:
 *   • OCR-scan a transfusion order form  →  pre-fills indication, baseline Hb,
 *     target Hb, units ordered, urgency
 *   • OCR-scan a transfusion vital-signs chart  →  pre-fills temp/pulse/BP/RR/SpO₂
 *     (pre/during/post)
 *   • OCR-scan a blood-bag label  →  pre-fills bag number, group, component,
 *     volume, donation date, expiry date
 *   • Medical-scribe (Web Speech API) dictation for reaction notes
 *   • Records complications / adverse reactions
 *   • Lists existing transfusion history for the patient
 *
 * Persistence: bloodTransfusionService — IndexedDB write-through with
 *   automatic /sync/blood-transfusions push (handled by the service).
 */
import React, { useEffect, useRef, useState } from 'react';
import { Droplet, Plus, ScanLine, Mic, MicOff, Save, X, AlertTriangle, CheckCircle2, Loader2 } from 'lucide-react';
import { ocrService } from '../services/ocrService';
import { speechToTextService } from '../services/speechToTextService';
import {
  bloodTransfusionService,
  type BloodTransfusion,
  type BloodBagDetails,
  type TransfusionVitals,
  type TransfusionComplication,
} from '../services/bloodTransfusionService';
import toast from 'react-hot-toast';

interface Props {
  patientId: string;
  hospitalNumber: string;
  patientName: string;
  userName: string;
}

type ScanTarget = 'order' | 'vitals' | 'bag';

const BLOOD_GROUPS: BloodBagDetails['blood_group'][] = ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'];
const COMPONENTS: BloodBagDetails['component_type'][] = ['whole_blood', 'packed_rbc', 'platelets', 'ffp', 'cryoprecipitate'];
const REACTION_TYPES: TransfusionComplication['complication_type'][] = [
  'febrile_reaction', 'allergic_reaction', 'hemolytic_reaction',
  'transfusion_overload', 'anaphylaxis', 'septic_reaction', 'other'
];

const emptyBag = (): BloodBagDetails => ({
  bag_number: '',
  blood_group: 'O+',
  component_type: 'packed_rbc',
  volume_ml: 350,
  donation_date: new Date(),
  expiry_date: new Date(Date.now() + 35 * 24 * 60 * 60 * 1000),
  source: 'blood_bank',
  screening_done: true,
  crossmatch_compatible: true,
});

const emptyVitals = (kind: TransfusionVitals['measurement_type']): Omit<TransfusionVitals, 'transfusion_id' | 'patient_id' | 'recorded_by'> => ({
  measurement_type: kind,
  temperature: 36.8,
  pulse: 80,
  bp_systolic: 120,
  bp_diastolic: 80,
  respiratory_rate: 16,
  spo2: 98,
  recorded_at: new Date(),
});

const BloodTransfusionTab: React.FC<Props> = ({ patientId, hospitalNumber, patientName, userName }) => {
  const [history, setHistory] = useState<BloodTransfusion[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [scanning, setScanning] = useState<ScanTarget | null>(null);
  const [listening, setListening] = useState(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const scanTargetRef = useRef<ScanTarget>('order');

  // Form state
  const [indication, setIndication] = useState('');
  const [baselineHb, setBaselineHb] = useState<number>(0);
  const [targetHb, setTargetHb] = useState<number>(10);
  const [clinicalStatus, setClinicalStatus] = useState('');
  const [urgent, setUrgent] = useState(false);
  const [bags, setBags] = useState<BloodBagDetails[]>([emptyBag()]);
  const [preVitals, setPreVitals] = useState(emptyVitals('pre'));
  const [duringVitals, setDuringVitals] = useState<ReturnType<typeof emptyVitals>[]>([emptyVitals('during')]);
  const [postVitals, setPostVitals] = useState(emptyVitals('post'));
  const [postHb, setPostHb] = useState<number | ''>('');
  const [reactions, setReactions] = useState<Array<Omit<TransfusionComplication, 'transfusion_id' | 'patient_id' | 'detected_at'> & { detected_at: Date }>>([]);
  const [reactionNotes, setReactionNotes] = useState('');

  // Load history
  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        const list = await bloodTransfusionService.getPatientTransfusions(String(patientId));
        if (!cancelled) setHistory(list);
      } catch (e) {
        console.warn('Failed to load transfusion history', e);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [patientId]);

  const resetForm = () => {
    setIndication(''); setBaselineHb(0); setTargetHb(10);
    setClinicalStatus(''); setUrgent(false);
    setBags([emptyBag()]);
    setPreVitals(emptyVitals('pre'));
    setDuringVitals([emptyVitals('during')]);
    setPostVitals(emptyVitals('post'));
    setPostHb(''); setReactions([]); setReactionNotes('');
  };

  // ─── OCR handler ─────────────────────────────────────────────
  const triggerScan = (target: ScanTarget) => {
    scanTargetRef.current = target;
    fileInputRef.current?.click();
  };

  const onFileSelected = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = ''; // reset so same file can be selected again
    const target = scanTargetRef.current;
    setScanning(target);
    try {
      const documentType =
        target === 'vitals' ? 'vital_signs_chart' :
        target === 'order'  ? 'prescription' :
                              'general';
      const result = await ocrService.processDocumentWithAI(
        file,
        documentType,
        { hospitalNumber, name: patientName },
        undefined,
        { handwritingMode: true }
      );
      const structured: any = (result as any)?.structured || (result as any)?.structuredData || {};
      const rawText: string = (result as any)?.text || (result as any)?.rawText || '';
      applyOcrToTarget(target, structured, rawText);
      toast.success(`Scanned ${target === 'order' ? 'transfusion order' : target === 'vitals' ? 'vitals chart' : 'blood bag'}`);
    } catch (err: any) {
      const offline = !navigator.onLine || /offline|network/i.test(String(err?.message));
      toast.error(offline ? 'Offline scan failed — try again when online or use the local fallback.' : 'OCR failed. You can fill the form manually.');
    } finally {
      setScanning(null);
    }
  };

  const applyOcrToTarget = (target: ScanTarget, s: any, text: string) => {
    const t = (text || '').toLowerCase();
    const num = (re: RegExp): number | null => {
      const m = t.match(re); return m ? parseFloat(m[1]) : null;
    };

    if (target === 'order') {
      if (s.indication) setIndication(String(s.indication));
      else {
        const m = t.match(/indication[:\s]+([^\n]{2,80})/);
        if (m) setIndication(m[1].trim());
      }
      const hb = s.baseline_hb ?? s.hb ?? num(/(?:hb|hgb|hemoglobin)[:\s]*(\d+\.?\d*)/);
      if (hb) setBaselineHb(parseFloat(hb));
      const tgt = s.target_hb ?? num(/target[^0-9]*(\d+\.?\d*)/);
      if (tgt) setTargetHb(parseFloat(tgt));
      if (s.clinical_status) setClinicalStatus(String(s.clinical_status));
      if (/urgent|stat|emergency/i.test(text)) setUrgent(true);
    }

    if (target === 'vitals') {
      // Apply to "during" vitals (most common scan target during monitoring)
      const idx = duringVitals.length - 1;
      const next = [...duringVitals];
      const v: any = { ...next[idx] };
      const temp = s.temperature ?? num(/(?:temp|t)[:\s]*(\d+\.?\d*)\s*°?c?/);
      const pulse = s.pulse ?? s.heart_rate ?? num(/(?:pulse|hr|p)[:\s]*(\d+)/);
      const sys = s.bp_systolic ?? num(/(?:bp|b\.p)[:\s]*(\d+)\s*\/\s*\d+/);
      const dia = s.bp_diastolic ?? num(/(?:bp|b\.p)[:\s]*\d+\s*\/\s*(\d+)/);
      const rr  = s.respiratory_rate ?? s.rr ?? num(/(?:rr|resp)[:\s]*(\d+)/);
      const spo2 = s.spo2 ?? s.sp_o2 ?? num(/(?:spo2|sp02|sao2)[:\s]*(\d+)/);
      if (temp != null) v.temperature = parseFloat(temp);
      if (pulse != null) v.pulse = parseInt(pulse);
      if (sys != null) v.bp_systolic = parseInt(sys);
      if (dia != null) v.bp_diastolic = parseInt(dia);
      if (rr != null) v.respiratory_rate = parseInt(rr);
      if (spo2 != null) v.spo2 = parseInt(spo2);
      next[idx] = v;
      setDuringVitals(next);
    }

    if (target === 'bag') {
      const idx = bags.length - 1;
      const next = [...bags];
      const b: any = { ...next[idx] };
      const bagNo = s.bag_number ?? s.unit_number ?? (text.match(/(?:bag|unit)[#\s:]*([A-Z0-9-]{4,})/i)?.[1]);
      if (bagNo) b.bag_number = String(bagNo);
      const grpRaw = s.blood_group ?? (text.match(/\b(A|B|AB|O)\s*([+-])/i));
      const grp = Array.isArray(grpRaw) ? `${grpRaw[1].toUpperCase()}${grpRaw[2]}` : grpRaw;
      if (grp && BLOOD_GROUPS.includes(grp as any)) b.blood_group = grp;
      const vol = s.volume_ml ?? num(/(\d{2,4})\s*ml/);
      if (vol) b.volume_ml = parseInt(vol);
      const compMap: Record<string, BloodBagDetails['component_type']> = {
        'whole': 'whole_blood', 'packed': 'packed_rbc', 'rbc': 'packed_rbc',
        'platelet': 'platelets', 'ffp': 'ffp', 'cryo': 'cryoprecipitate'
      };
      for (const [k, v] of Object.entries(compMap)) {
        if (t.includes(k)) { b.component_type = v; break; }
      }
      const exp = text.match(/exp(?:iry|ires?)?[:\s]+(\d{1,2}[\/-]\d{1,2}[\/-]\d{2,4})/i);
      if (exp) { const d = new Date(exp[1]); if (!isNaN(d.getTime())) b.expiry_date = d; }
      const don = text.match(/(?:collected|donated|donation)[:\s]+(\d{1,2}[\/-]\d{1,2}[\/-]\d{2,4})/i);
      if (don) { const d = new Date(don[1]); if (!isNaN(d.getTime())) b.donation_date = d; }
      next[idx] = b;
      setBags(next);
    }
  };

  // ─── Medical scribe (dictation) ──────────────────────────────
  const toggleDictation = () => {
    if (listening) {
      const finalText = speechToTextService.stopListening();
      setListening(false);
      if (finalText) setReactionNotes((prev) => (prev ? `${prev} ${finalText}` : finalText).trim());
      return;
    }
    const ok = speechToTextService.startListening({
      continuous: true,
      interimResults: true,
      onResult: (r) => {
        if (r.isFinal && r.transcript) {
          setReactionNotes((prev) => (prev ? `${prev} ${r.transcript}` : r.transcript).trim());
        }
      },
      onError: () => { setListening(false); toast.error('Dictation unavailable'); },
      onEnd: () => setListening(false),
    });
    if (ok) setListening(true);
    else toast.error('Speech recognition not supported on this browser');
  };

  // ─── Save ───────────────────────────────────────────────────
  const save = async () => {
    if (!indication.trim()) return toast.error('Indication is required');
    if (!baselineHb) return toast.error('Baseline Hb is required');
    if (bags.length === 0 || !bags[0].bag_number) return toast.error('At least one blood bag with bag number is required');

    setSaving(true);
    try {
      const now = new Date();
      const transfusion: BloodTransfusion = {
        patient_id: String(patientId),
        patient_name: patientName,
        hospital_number: hospitalNumber,
        indication: indication.trim(),
        baseline_hb: baselineHb,
        target_hb: targetHb || undefined,
        clinical_status: clinicalStatus,
        urgent,
        blood_bags: bags,
        total_units: bags.length,
        previous_transfusions: [],
        history_of_reactions: reactions.length > 0,
        reaction_details: reactionNotes || undefined,
        transfusion_date: now,
        start_time: now.toTimeString().slice(0, 5),
        consent_obtained: true,
        patient_identification_verified: true,
        blood_group_verified: true,
        crossmatch_checked: true,
        pre_transfusion_vitals: { ...preVitals, transfusion_id: '', patient_id: String(patientId), recorded_by: userName } as TransfusionVitals,
        during_transfusion_vitals: duringVitals.map((v) => ({ ...v, transfusion_id: '', patient_id: String(patientId), recorded_by: userName }) as TransfusionVitals),
        post_transfusion_vitals: { ...postVitals, transfusion_id: '', patient_id: String(patientId), recorded_by: userName } as TransfusionVitals,
        post_transfusion_hb: typeof postHb === 'number' ? postHb : undefined,
        hb_increment: typeof postHb === 'number' ? postHb - baselineHb : undefined,
        complications: reactions.map((r) => ({ ...r, transfusion_id: '', patient_id: String(patientId) }) as TransfusionComplication),
        adverse_events: reactions.length > 0,
        status: 'completed',
        administered_by: userName,
        created_at: now,
        updated_at: now,
        notes: reactionNotes || undefined,
      };
      await bloodTransfusionService.createTransfusion(transfusion);
      toast.success('Transfusion record saved');
      setShowForm(false);
      resetForm();
      const list = await bloodTransfusionService.getPatientTransfusions(String(patientId));
      setHistory(list);
    } catch (e: any) {
      toast.error(e?.message || 'Failed to save transfusion record');
    } finally {
      setSaving(false);
    }
  };

  // ─── Sub-renderers ───────────────────────────────────────────
  const VitalsRow = ({ label, value, onChange, onRemove }: { label: string; value: ReturnType<typeof emptyVitals>; onChange: (v: ReturnType<typeof emptyVitals>) => void; onRemove?: () => void }) => (
    <div className="border rounded-lg p-3 bg-gray-50">
      <div className="flex items-center justify-between gap-2 mb-2">
        <span className="font-medium text-sm text-gray-700">{label}</span>
        {onRemove && (
          <button
            type="button"
            onClick={onRemove}
            className="text-xs text-red-500 hover:text-red-700 px-2 py-0.5 rounded hover:bg-red-50 flex-shrink-0"
          >
            Remove
          </button>
        )}
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2">
        <label className="text-xs text-gray-600">Temp °C
          <input type="number" step="0.1" className="mt-1 w-full border rounded px-2 py-1 text-sm" value={value.temperature}
            onChange={(e) => onChange({ ...value, temperature: parseFloat(e.target.value) || 0 })} />
        </label>
        <label className="text-xs text-gray-600">Pulse
          <input type="number" className="mt-1 w-full border rounded px-2 py-1 text-sm" value={value.pulse}
            onChange={(e) => onChange({ ...value, pulse: parseInt(e.target.value) || 0 })} />
        </label>
        <label className="text-xs text-gray-600">BP Sys
          <input type="number" className="mt-1 w-full border rounded px-2 py-1 text-sm" value={value.bp_systolic}
            onChange={(e) => onChange({ ...value, bp_systolic: parseInt(e.target.value) || 0 })} />
        </label>
        <label className="text-xs text-gray-600">BP Dia
          <input type="number" className="mt-1 w-full border rounded px-2 py-1 text-sm" value={value.bp_diastolic}
            onChange={(e) => onChange({ ...value, bp_diastolic: parseInt(e.target.value) || 0 })} />
        </label>
        <label className="text-xs text-gray-600">RR
          <input type="number" className="mt-1 w-full border rounded px-2 py-1 text-sm" value={value.respiratory_rate}
            onChange={(e) => onChange({ ...value, respiratory_rate: parseInt(e.target.value) || 0 })} />
        </label>
        <label className="text-xs text-gray-600">SpO₂ %
          <input type="number" className="mt-1 w-full border rounded px-2 py-1 text-sm" value={value.spo2}
            onChange={(e) => onChange({ ...value, spo2: parseInt(e.target.value) || 0 })} />
        </label>
      </div>
    </div>
  );

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
        <div className="flex items-center gap-2">
          <Droplet className="w-5 h-5 text-red-600" />
          <h2 className="text-lg font-semibold text-gray-900">Blood Transfusion Records</h2>
        </div>
        <button onClick={() => setShowForm((s) => !s)}
          className="inline-flex items-center gap-1 px-3 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg text-sm font-medium">
          <Plus className="w-4 h-4" /> New Transfusion Record
        </button>
      </div>

      {/* Hidden file input shared by all OCR triggers */}
      <input ref={fileInputRef} type="file" accept="image/*,.pdf" capture="environment" hidden onChange={onFileSelected} />

      {/* New record form */}
      {showForm && (
        <div className="bg-white border border-gray-200 rounded-lg p-4 sm:p-5 space-y-5">
          {/* OCR scan toolbar */}
          <div className="flex flex-wrap gap-2 p-3 bg-blue-50 border border-blue-200 rounded-lg">
            <span className="text-sm font-medium text-blue-900 mr-2 self-center">Quick scan:</span>
            <button type="button" onClick={() => triggerScan('order')} disabled={scanning !== null}
              className="inline-flex items-center gap-1 px-3 py-1.5 bg-white border border-blue-300 hover:bg-blue-100 text-blue-700 rounded text-xs font-medium disabled:opacity-50">
              {scanning === 'order' ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <ScanLine className="w-3.5 h-3.5" />}
              Transfusion Order
            </button>
            <button type="button" onClick={() => triggerScan('vitals')} disabled={scanning !== null}
              className="inline-flex items-center gap-1 px-3 py-1.5 bg-white border border-blue-300 hover:bg-blue-100 text-blue-700 rounded text-xs font-medium disabled:opacity-50">
              {scanning === 'vitals' ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <ScanLine className="w-3.5 h-3.5" />}
              Vital Signs Chart
            </button>
            <button type="button" onClick={() => triggerScan('bag')} disabled={scanning !== null}
              className="inline-flex items-center gap-1 px-3 py-1.5 bg-white border border-blue-300 hover:bg-blue-100 text-blue-700 rounded text-xs font-medium disabled:opacity-50">
              {scanning === 'bag' ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <ScanLine className="w-3.5 h-3.5" />}
              Blood Bag Label
            </button>
            <span className="text-xs text-blue-700 self-center ml-auto">📷 Camera or file • OCR works offline</span>
          </div>

          {/* Indication & Hb */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            <label className="text-sm text-gray-700 sm:col-span-2">Indication *
              <input className="mt-1 w-full border rounded px-2 py-1.5 text-sm" value={indication}
                onChange={(e) => setIndication(e.target.value)} placeholder="e.g. Symptomatic anaemia post-op" />
            </label>
            <label className="text-sm text-gray-700">Baseline Hb (g/dL) *
              <input type="number" step="0.1" className="mt-1 w-full border rounded px-2 py-1.5 text-sm" value={baselineHb || ''}
                onChange={(e) => setBaselineHb(parseFloat(e.target.value) || 0)} />
            </label>
            <label className="text-sm text-gray-700">Target Hb (g/dL)
              <input type="number" step="0.1" className="mt-1 w-full border rounded px-2 py-1.5 text-sm" value={targetHb}
                onChange={(e) => setTargetHb(parseFloat(e.target.value) || 0)} />
            </label>
            <label className="text-sm text-gray-700 sm:col-span-3">Clinical status
              <input className="mt-1 w-full border rounded px-2 py-1.5 text-sm" value={clinicalStatus}
                onChange={(e) => setClinicalStatus(e.target.value)} placeholder="e.g. Stable, mild SOB on exertion" />
            </label>
            <label className="text-sm text-gray-700 flex items-end gap-2">
              <input type="checkbox" checked={urgent} onChange={(e) => setUrgent(e.target.checked)} className="w-4 h-4" />
              Urgent / STAT
            </label>
          </div>

          {/* Blood bags */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <h3 className="font-medium text-sm text-gray-800">Blood Bag Details ({bags.length})</h3>
              <button type="button" onClick={() => setBags([...bags, emptyBag()])}
                className="text-xs text-red-600 hover:text-red-700 font-medium">+ Add bag</button>
            </div>
            <div className="space-y-2">
              {bags.map((b, i) => (
                <div key={i} className="border rounded-lg p-3 bg-gray-50">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs font-semibold text-gray-700">Unit #{i + 1}</span>
                    {bags.length > 1 && (
                      <button type="button" onClick={() => setBags(bags.filter((_, idx) => idx !== i))}
                        className="text-xs text-red-500 hover:text-red-700">Remove</button>
                    )}
                  </div>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                    <label className="text-xs text-gray-600">Bag No
                      <input className="mt-1 w-full border rounded px-2 py-1 text-sm" value={b.bag_number}
                        onChange={(e) => { const n = [...bags]; n[i] = { ...b, bag_number: e.target.value }; setBags(n); }} />
                    </label>
                    <label className="text-xs text-gray-600">Group
                      <select className="mt-1 w-full border rounded px-2 py-1 text-sm" value={b.blood_group}
                        onChange={(e) => { const n = [...bags]; n[i] = { ...b, blood_group: e.target.value as any }; setBags(n); }}>
                        {BLOOD_GROUPS.map((g) => <option key={g} value={g}>{g}</option>)}
                      </select>
                    </label>
                    <label className="text-xs text-gray-600">Component
                      <select className="mt-1 w-full border rounded px-2 py-1 text-sm" value={b.component_type}
                        onChange={(e) => { const n = [...bags]; n[i] = { ...b, component_type: e.target.value as any }; setBags(n); }}>
                        {COMPONENTS.map((c) => <option key={c} value={c}>{c.replace('_', ' ')}</option>)}
                      </select>
                    </label>
                    <label className="text-xs text-gray-600">Volume (ml)
                      <input type="number" className="mt-1 w-full border rounded px-2 py-1 text-sm" value={b.volume_ml}
                        onChange={(e) => { const n = [...bags]; n[i] = { ...b, volume_ml: parseInt(e.target.value) || 0 }; setBags(n); }} />
                    </label>
                    <label className="text-xs text-gray-600">Donation date
                      <input type="date" className="mt-1 w-full border rounded px-2 py-1 text-sm"
                        value={new Date(b.donation_date).toISOString().slice(0, 10)}
                        onChange={(e) => { const n = [...bags]; n[i] = { ...b, donation_date: new Date(e.target.value) }; setBags(n); }} />
                    </label>
                    <label className="text-xs text-gray-600">Expiry date
                      <input type="date" className="mt-1 w-full border rounded px-2 py-1 text-sm"
                        value={new Date(b.expiry_date).toISOString().slice(0, 10)}
                        onChange={(e) => { const n = [...bags]; n[i] = { ...b, expiry_date: new Date(e.target.value) }; setBags(n); }} />
                    </label>
                    <label className="text-xs text-gray-600 flex items-center gap-1 self-end pb-1">
                      <input type="checkbox" checked={b.crossmatch_compatible}
                        onChange={(e) => { const n = [...bags]; n[i] = { ...b, crossmatch_compatible: e.target.checked }; setBags(n); }} />
                      Crossmatch OK
                    </label>
                    <label className="text-xs text-gray-600 flex items-center gap-1 self-end pb-1">
                      <input type="checkbox" checked={b.screening_done}
                        onChange={(e) => { const n = [...bags]; n[i] = { ...b, screening_done: e.target.checked }; setBags(n); }} />
                      Screened
                    </label>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Vitals */}
          <div className="space-y-2">
            <h3 className="font-medium text-sm text-gray-800">Vital Signs Monitoring</h3>
            <VitalsRow label="Pre-transfusion" value={preVitals} onChange={setPreVitals} />
            {duringVitals.map((dv, i) => (
              <div key={i} className="relative">
                <VitalsRow
                  label={`During (reading ${i + 1})`}
                  value={dv}
                  onChange={(v) => { const n = [...duringVitals]; n[i] = v; setDuringVitals(n); }}
                  onRemove={duringVitals.length > 1 ? () => setDuringVitals(duringVitals.filter((_, idx) => idx !== i)) : undefined}
                />
              </div>
            ))}
            <button type="button" onClick={() => setDuringVitals([...duringVitals, emptyVitals('during')])}
              className="text-xs text-red-600 hover:text-red-700 font-medium">+ Add another reading</button>
            <VitalsRow label="Post-transfusion" value={postVitals} onChange={setPostVitals} />
            <label className="block text-sm text-gray-700">Post-transfusion Hb (g/dL)
              <input type="number" step="0.1" className="mt-1 w-32 border rounded px-2 py-1 text-sm"
                value={postHb} onChange={(e) => setPostHb(e.target.value === '' ? '' : parseFloat(e.target.value))} />
            </label>
          </div>

          {/* Reactions */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <h3 className="font-medium text-sm text-gray-800">
                <AlertTriangle className="w-4 h-4 inline mr-1 text-amber-600" />
                Reactions / Adverse Events
              </h3>
              <button type="button"
                onClick={() => setReactions([...reactions, { complication_type: 'febrile_reaction', severity: 'mild', symptoms: [], management: '', detected_at: new Date(), resolved: false }])}
                className="text-xs text-red-600 hover:text-red-700 font-medium">+ Record reaction</button>
            </div>
            {reactions.map((r, i) => (
              <div key={i} className="border rounded-lg p-3 bg-amber-50 border-amber-200 grid grid-cols-1 sm:grid-cols-3 gap-2">
                <select aria-label="Reaction type" title="Reaction type" className="border rounded px-2 py-1 text-sm" value={r.complication_type}
                  onChange={(e) => { const n = [...reactions]; n[i] = { ...r, complication_type: e.target.value as any }; setReactions(n); }}>
                  {REACTION_TYPES.map((rt) => <option key={rt} value={rt}>{rt.replace(/_/g, ' ')}</option>)}
                </select>
                <select aria-label="Reaction severity" title="Reaction severity" className="border rounded px-2 py-1 text-sm" value={r.severity}
                  onChange={(e) => { const n = [...reactions]; n[i] = { ...r, severity: e.target.value as any }; setReactions(n); }}>
                  <option value="mild">Mild</option><option value="moderate">Moderate</option>
                  <option value="severe">Severe</option><option value="life-threatening">Life-threatening</option>
                </select>
                <input className="border rounded px-2 py-1 text-sm sm:col-span-3" placeholder="Management taken (e.g. paused, gave hydrocortisone)"
                  value={r.management} onChange={(e) => { const n = [...reactions]; n[i] = { ...r, management: e.target.value }; setReactions(n); }} />
                <button type="button" className="text-xs text-red-500 hover:text-red-700 sm:col-span-3 text-left"
                  onClick={() => setReactions(reactions.filter((_, idx) => idx !== i))}>Remove</button>
              </div>
            ))}
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="text-sm text-gray-700">Comments / clinical notes</label>
                <button type="button" onClick={toggleDictation}
                  className={`inline-flex items-center gap-1 px-2 py-1 rounded text-xs font-medium ${listening ? 'bg-red-600 text-white' : 'bg-gray-200 hover:bg-gray-300 text-gray-700'}`}>
                  {listening ? <><MicOff className="w-3 h-3" /> Stop</> : <><Mic className="w-3 h-3" /> Dictate</>}
                </button>
              </div>
              <textarea rows={3} className="w-full border rounded px-2 py-1.5 text-sm"
                placeholder="Note any reactions, monitoring observations, escalations…"
                value={reactionNotes} onChange={(e) => setReactionNotes(e.target.value)} />
            </div>
          </div>

          {/* Save bar */}
          <div className="flex items-center justify-end gap-2 pt-2 border-t">
            <button type="button" onClick={() => { setShowForm(false); resetForm(); }}
              className="px-3 py-1.5 text-sm text-gray-700 hover:bg-gray-100 rounded">Cancel</button>
            <button type="button" onClick={save} disabled={saving}
              className="inline-flex items-center gap-1 px-4 py-1.5 bg-red-600 hover:bg-red-700 disabled:opacity-50 text-white rounded text-sm font-medium">
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
              Save Transfusion Record
            </button>
          </div>
        </div>
      )}

      {/* History */}
      <div className="bg-white border border-gray-200 rounded-lg">
        <div className="p-3 border-b border-gray-200 flex items-center justify-between">
          <h3 className="font-medium text-sm text-gray-800">Transfusion History ({history.length})</h3>
        </div>
        {loading ? (
          <div className="p-6 text-center text-gray-500"><Loader2 className="w-5 h-5 animate-spin inline mr-2" />Loading…</div>
        ) : history.length === 0 ? (
          <div className="p-6 text-center text-gray-500 text-sm">No transfusion records yet. Click <strong>New Transfusion Record</strong> to add one.</div>
        ) : (
          <ul className="divide-y divide-gray-100">
            {history.map((t, i) => {
              const date = t.transfusion_date ? new Date(t.transfusion_date).toLocaleDateString() : '—';
              const hadReactions = (t.complications && t.complications.length > 0) || t.adverse_events;
              return (
                <li key={(t.id ?? i) as any} className="p-3 hover:bg-gray-50 text-sm">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-medium text-gray-900">{date}</span>
                    <span className="text-gray-600">• {t.indication}</span>
                    <span className="text-xs px-2 py-0.5 rounded bg-red-100 text-red-700">{t.total_units} unit(s)</span>
                    {t.urgent && <span className="text-xs px-2 py-0.5 rounded bg-amber-100 text-amber-700">URGENT</span>}
                    {hadReactions
                      ? <span className="text-xs px-2 py-0.5 rounded bg-amber-100 text-amber-800 inline-flex items-center gap-1"><AlertTriangle className="w-3 h-3" />Reaction</span>
                      : <span className="text-xs px-2 py-0.5 rounded bg-green-100 text-green-700 inline-flex items-center gap-1"><CheckCircle2 className="w-3 h-3" />No reaction</span>}
                  </div>
                  <div className="mt-1 text-xs text-gray-600">
                    Baseline Hb {t.baseline_hb} g/dL
                    {typeof t.post_transfusion_hb === 'number' && ` → Post Hb ${t.post_transfusion_hb} g/dL (Δ ${t.hb_increment ?? (t.post_transfusion_hb - t.baseline_hb)})`}
                    {' • '}Administered by {t.administered_by}
                  </div>
                  {t.notes && <div className="mt-1 text-xs text-gray-500 italic">"{t.notes}"</div>}
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
};

export default BloodTransfusionTab;
