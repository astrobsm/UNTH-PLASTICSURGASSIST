/**
 * Logging the implementation of one approved plan item.
 *
 * Who and when are taken by the server (the user from the login, the time
 * from the server clock); where is taken from the device's location, with the
 * ward / theatre / clinic named by the person logging. Depending on the item:
 *
 *   medication     choose the prescribing group → drug → formulation, dose,
 *                  frequency, duration — saved as a real prescription
 *   investigation  choose the investigation category → test — saved as a real
 *                  lab order; then snap, scan, upload or type the result
 *   procedure/care done / partly / not done, with a note
 */
import { useEffect, useMemo, useState } from 'react';
import { Camera, FileUp, Loader2, MapPin, Paperclip, ScanLine, X, CheckCircle2, AlertTriangle } from 'lucide-react';
import toast from 'react-hot-toast';
import { apiClient } from '../../services/apiClient';
import { PRESCRIBABLE_DRUGS, PRESCRIBING_GROUPS, drugsInGroup, frequencyInWords, type PrescribingGroup } from '../../data/prescribingCatalogue';
import { INVESTIGATION_CATEGORIES, getInvestigationsByCategory, INVESTIGATION_DATABASE, type InvestigationCategory } from '../../data/investigationDatabase';
import MultiPageScanUploader, { type ScannedPage } from '../MultiPageScanUploader';
import type { PlanItem, LoggedAction } from '../../services/scribe/planItems';
import { itemState } from '../../services/scribe/planItems';

interface Attachment { name: string; data: string }
export interface LocationFix { latitude?: number; longitude?: number; accuracy?: number; status: 'gps' | 'denied' | 'unavailable' | 'pending'; label: string }

/** Photos are shrunk on the device (≤ 1600 px, JPEG) so a log fits in one request. */
export async function compressImage(file: File, maxSide = 1600, quality = 0.75): Promise<string> {
  const url = URL.createObjectURL(file);
  try {
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const i = new Image(); i.onload = () => resolve(i); i.onerror = reject; i.src = url;
    });
    const scale = Math.min(1, maxSide / Math.max(img.width, img.height));
    const c = document.createElement('canvas');
    c.width = Math.round(img.width * scale); c.height = Math.round(img.height * scale);
    c.getContext('2d')!.drawImage(img, 0, 0, c.width, c.height);
    return c.toDataURL('image/jpeg', quality);
  } finally { URL.revokeObjectURL(url); }
}
const fileToDataUrl = (f: File) => new Promise<string>((res, rej) => { const r = new FileReader(); r.onload = () => res(String(r.result)); r.onerror = rej; r.readAsDataURL(f); });

/** The device's position, if it will give one within a few seconds. */
export function getLocation(timeoutMs = 8000): Promise<Omit<LocationFix, 'label'>> {
  return new Promise(resolve => {
    if (!navigator.geolocation) return resolve({ status: 'unavailable' });
    navigator.geolocation.getCurrentPosition(
      p => resolve({ status: 'gps', latitude: p.coords.latitude, longitude: p.coords.longitude, accuracy: p.coords.accuracy }),
      e => resolve({ status: e.code === e.PERMISSION_DENIED ? 'denied' : 'unavailable' }),
      { enableHighAccuracy: true, timeout: timeoutMs, maximumAge: 60_000 },
    );
  });
}

const PLACES = ['Ward', 'Theatre', 'Clinic', 'Emergency', 'Dressing room', 'ICU / HDU', 'Laboratory', 'Radiology', 'Pharmacy', 'Other'];

/** The drug the plan line names, if the formulary has it. */
function drugFromText(text: string) {
  const t = text.toLowerCase();
  return PRESCRIBABLE_DRUGS.find(d => t.includes(d.genericName.toLowerCase().split(/[ (]/)[0]));
}
function investigationFromText(text: string) {
  const t = ` ${text.toLowerCase()} `;
  return INVESTIGATION_DATABASE.find(i => (i.abbreviation && new RegExp(`\\b${i.abbreviation.toLowerCase().replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`).test(t))
    || t.includes(` ${i.name.toLowerCase()} `));
}

export function ImplementationDialog({ planId, patientId, item, actions, defaultPlace, onSaved, onClose }: {
  planId: number; patientId: string; item: PlanItem; actions: LoggedAction[];
  defaultPlace?: string; onSaved: () => void; onClose: () => void;
}) {
  const state = itemState(actions);
  const lastOrder = actions.find(a => a.status === 'ordered' && a.investigation)?.investigation;
  const [loc, setLoc] = useState<LocationFix>({ status: 'pending', label: defaultPlace || 'Ward' });
  const [status, setStatus] = useState<string>('done');
  const [note, setNote] = useState('');
  const [saving, setSaving] = useState(false);

  // Medication
  const guessDrug = useMemo(() => drugFromText(item.text), [item.text]);
  const [group, setGroup] = useState<PrescribingGroup | ''>('');
  const [drugId, setDrugId] = useState(guessDrug?.id || '');
  const drug = PRESCRIBABLE_DRUGS.find(d => d.id === drugId);
  const [formIdx, setFormIdx] = useState(0);
  const [dose, setDose] = useState(guessDrug?.dosage?.adult?.standard || '');
  const [freq, setFreq] = useState<string>(guessDrug?.dosage?.adult?.frequency?.[0] || '');
  const [duration, setDuration] = useState(guessDrug?.dosage?.adult?.duration || '');
  const [instructions, setInstructions] = useState('');

  // Investigation
  const guessInv = useMemo(() => investigationFromText(item.text), [item.text]);
  const [invCat, setInvCat] = useState<InvestigationCategory | ''>(guessInv?.category || '');
  const [invName, setInvName] = useState(guessInv?.name || '');
  const inv = INVESTIGATION_DATABASE.find(i => i.name === invName);
  const [priority, setPriority] = useState<'routine' | 'urgent' | 'stat'>(item.priority === 'urgent' ? 'urgent' : 'routine');

  // Result
  const [showResult, setShowResult] = useState(item.kind === 'investigation' && !!lastOrder);
  const [resultValue, setResultValue] = useState('');
  const [resultUnit, setResultUnit] = useState('');
  const [resultText, setResultText] = useState('');
  const [files, setFiles] = useState<Attachment[]>([]);
  const [scanPages, setScanPages] = useState<ScannedPage[]>([]);
  const [showScan, setShowScan] = useState(false);

  useEffect(() => {
    if (drug && !group) {
      const g = PRESCRIBING_GROUPS.find(gr => drugsInGroup(gr).some(d => d.id === drug.id));
      if (g) setGroup(g);
    }
  }, [drug, group]);
  useEffect(() => { if (inv?.unit && !resultUnit) setResultUnit(inv.unit); }, [inv, resultUnit]);
  useEffect(() => { void getLocation().then(f => setLoc(l => ({ ...l, ...f }))); }, []);

  const addFiles = async (list: FileList | null, compress: boolean) => {
    if (!list) return;
    const out: Attachment[] = [];
    for (const f of Array.from(list)) {
      try {
        const data = f.type.startsWith('image/') && compress ? await compressImage(f) : await fileToDataUrl(f);
        if (data.length > 3_500_000) { toast.error(`${f.name} is too large — photograph it instead, or upload a smaller PDF`); continue; }
        out.push({ name: f.name || 'result.jpg', data });
      } catch { toast.error(`Could not read ${f.name}`); }
    }
    setFiles(prev => [...prev, ...out]);
  };

  const send = async (body: Record<string, unknown>) => {
    const location = { latitude: loc.latitude, longitude: loc.longitude, accuracy: loc.accuracy, label: loc.label, status: loc.status };
    await apiClient.post(`/scribe-plans?action=log&id=${planId}`, {
      item_key: item.key, item_text: item.text, item_kind: item.kind, location,
      client_time: new Date().toISOString(), ...body,
    });
  };

  const save = async (mode: 'status' | 'prescribe' | 'request' | 'result') => {
    setSaving(true);
    try {
      if (mode === 'prescribe') {
        if (!drug) throw new Error('Choose the drug');
        if (!dose.trim() || !freq) throw new Error('Give the dose and frequency');
        const form = drug.formulations[formIdx];
        const route = form?.route || 'oral';
        const r: any = await apiClient.createPrescription({
          patient_id: patientId,
          prescriptions: [{
            medication: drug.genericName, genericName: drug.genericName, dosage: dose.trim(), route,
            frequency: freq, duration: duration.trim(), instructions: instructions.trim() || undefined, indication: item.text,
          }],
        });
        await send({ status: 'prescribed', note: note || null, prescription: {
          drug: drug.genericName, form: form ? `${form.form} ${form.strength}` : undefined, dose: dose.trim(), route,
          frequency: freq, frequency_words: frequencyInWords(freq), duration: duration.trim(), instructions: instructions.trim() || undefined,
          prescription_id: r?.id ?? r?.prescription?.id ?? null,
        } });
        toast.success(`${drug.genericName} prescribed and logged`);
      } else if (mode === 'request') {
        if (!inv) throw new Error('Choose the investigation');
        const r: any = await apiClient.createLabInvestigation({
          patient_id: patientId, test_type: inv.category, test_name: inv.name, priority,
          clinical_notes: item.text, status: 'pending',
        });
        await send({ status: 'ordered', note: note || null, investigation: {
          category: inv.category, test: inv.name, abbreviation: inv.abbreviation, specimen: inv.specimen, priority,
          lab_order_id: r?.id ?? null,
        } });
        toast.success(`${inv.abbreviation || inv.name} requested and logged`);
        setShowResult(true);
      } else if (mode === 'result') {
        const scanned = scanPages.map((p, i) => ({ name: p.name || `scan-${i + 1}.jpg`, data: p.dataUrl }));
        const all = [...files, ...scanned];
        const ocrText = scanPages.map(p => p.ocrText).filter(Boolean).join('\n');
        if (!resultValue.trim() && !resultText.trim() && !all.length) throw new Error('Enter the result, or snap / scan / upload it');
        const order = lastOrder || (inv ? { test: inv.name, category: inv.category } : null);
        const result = { test: order?.test || item.text, value: resultValue.trim() || null, unit: resultUnit.trim() || null,
          text: resultText.trim() || null, ocr_text: ocrText || null, reference: inv?.normalRange || null };
        await send({ status: 'result_entered', note: note || null, investigation: order, result, attachments: all });
        // Also onto the lab order and the patient's investigation record.
        if (order?.lab_order_id) {
          apiClient.updateLabInvestigation(String(order.lab_order_id), { status: 'completed', results: result, completedAt: new Date().toISOString() })
            .catch(() => { /* the log already holds it */ });
        }
        for (const f of all) {
          apiClient.post('/investigation-uploads', {
            patient_id: patientId, upload_type: 'result', file_name: f.name, file_data: f.data,
            test_name: result.test, ocr_text: ocrText || null, status: 'received',
          }).catch(() => { /* the log already holds it */ });
        }
        toast.success('Result saved');
      } else {
        if (['partial', 'not_done', 'cancelled'].includes(status) && !note.trim()) throw new Error('Say why it was not (fully) done');
        await send({ status, note: note.trim() || null });
        toast.success('Logged');
      }
      onSaved();
      if (mode !== 'request') onClose();
    } catch (e: any) {
      toast.error(String(e?.message || 'Could not save').replace(/^\[HTTP \d+\]\s*/, ''));
    } finally { setSaving(false); }
  };

  const openAttachment = async (id: number) => {
    try {
      const r: any = await apiClient.get(`/scribe-plans?attachment=${id}`);
      const w = window.open();
      if (w && r?.attachment?.data) {
        w.document.write(r.attachment.mime === 'application/pdf'
          ? `<iframe src="${r.attachment.data}" style="border:0;width:100%;height:100vh"></iframe>`
          : `<img src="${r.attachment.data}" style="max-width:100%">`);
      }
    } catch { toast.error('Could not open the file'); }
  };

  const sel = 'w-full border rounded-lg px-2 py-2 text-sm bg-white';

  return (
    <div className="fixed inset-0 z-50 bg-black/50 flex items-end sm:items-center justify-center p-0 sm:p-4" role="dialog" aria-modal="true">
      <div className="bg-white w-full sm:max-w-2xl max-h-[95vh] overflow-y-auto rounded-t-2xl sm:rounded-2xl">
        <div className="sticky top-0 bg-white border-b px-4 py-3 flex items-start justify-between gap-2">
          <div className="min-w-0">
            <p className="text-xs text-gray-500">{item.group} · <span className="capitalize">{item.kind}</span></p>
            <h3 className="font-semibold text-gray-900">{item.text}</h3>
            {item.why && <p className="text-xs text-gray-500">{item.why}</p>}
            <p className="text-xs mt-1">Status: <strong>{state.label}</strong></p>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-gray-100" aria-label="Close"><X className="w-5 h-5" /></button>
        </div>

        <div className="p-4 space-y-4">
          {/* Where */}
          <div className="rounded-lg border p-3 bg-gray-50">
            <p className="text-xs font-semibold text-gray-600 mb-1.5 flex items-center gap-1"><MapPin className="w-3.5 h-3.5" /> Where</p>
            <div className="grid grid-cols-2 gap-2">
              <select value={PLACES.includes(loc.label.split(' ')[0]) ? loc.label.split(' ')[0] : 'Other'} onChange={e => setLoc(l => ({ ...l, label: e.target.value === 'Ward' && defaultPlace ? defaultPlace : e.target.value }))} className={sel}>
                {PLACES.map(p => <option key={p}>{p}</option>)}
              </select>
              <input value={loc.label} onChange={e => setLoc(l => ({ ...l, label: e.target.value }))} className={sel} placeholder="e.g. Ward 10, Bed 16" />
            </div>
            <p className="text-[11px] mt-1.5 text-gray-500">
              {loc.status === 'pending' && 'Getting the device location…'}
              {loc.status === 'gps' && `Device location recorded (±${Math.round(loc.accuracy || 0)} m).`}
              {loc.status === 'denied' && 'Location permission was declined — the place named above is recorded.'}
              {loc.status === 'unavailable' && 'Device location unavailable — the place named above is recorded.'}
              {' '}Your name and the time are added by the server.
            </p>
          </div>

          {/* Medication: category → drug */}
          {item.kind === 'medication' && (
            <div className="rounded-lg border p-3 space-y-2">
              <p className="text-sm font-semibold text-gray-900">Prescribe</p>
              <div className="grid sm:grid-cols-2 gap-2">
                <label className="text-xs text-gray-600">Medication category
                  <select value={group} onChange={e => { setGroup(e.target.value as PrescribingGroup); setDrugId(''); }} className={sel}>
                    <option value="">— choose —</option>
                    {PRESCRIBING_GROUPS.filter(g => drugsInGroup(g).length).map(g => <option key={g} value={g}>{g} ({drugsInGroup(g).length})</option>)}
                  </select>
                </label>
                <label className="text-xs text-gray-600">Drug
                  <select value={drugId} onChange={e => {
                    const d = PRESCRIBABLE_DRUGS.find(x => x.id === e.target.value);
                    setDrugId(e.target.value); setFormIdx(0);
                    setDose(d?.dosage?.adult?.standard || ''); setFreq(d?.dosage?.adult?.frequency?.[0] || ''); setDuration(d?.dosage?.adult?.duration || '');
                  }} className={sel} disabled={!group}>
                    <option value="">— choose —</option>
                    {(group ? drugsInGroup(group as PrescribingGroup) : []).map(d => <option key={d.id} value={d.id}>{d.genericName}</option>)}
                  </select>
                </label>
              </div>
              {drug && (
                <>
                  <div className="grid sm:grid-cols-2 gap-2">
                    <label className="text-xs text-gray-600">Formulation
                      <select value={formIdx} onChange={e => setFormIdx(Number(e.target.value))} className={sel}>
                        {drug.formulations.map((f, i) => <option key={i} value={i}>{f.form} {f.strength} — {f.route}</option>)}
                      </select>
                    </label>
                    <label className="text-xs text-gray-600">Dose
                      <input value={dose} onChange={e => setDose(e.target.value)} className={sel} placeholder={drug.dosage?.adult?.standard} />
                    </label>
                    <label className="text-xs text-gray-600">Frequency
                      <select value={freq} onChange={e => setFreq(e.target.value)} className={sel}>
                        <option value="">— choose —</option>
                        {['od', 'bd', 'tds', 'qds', 'q4h', 'q6h', 'q8h', 'q12h', 'nocte', 'mane', 'prn', 'stat', 'weekly'].map(f => <option key={f} value={f}>{f.toUpperCase()} — {frequencyInWords(f)}</option>)}
                      </select>
                    </label>
                    <label className="text-xs text-gray-600">Duration
                      <input value={duration} onChange={e => setDuration(e.target.value)} className={sel} placeholder="e.g. 5 days" />
                    </label>
                  </div>
                  <input value={instructions} onChange={e => setInstructions(e.target.value)} className={sel} placeholder="Instructions (optional)" />
                  {drug.dosage?.adult?.notes && <p className="text-[11px] text-gray-500">Dosing note: {drug.dosage.adult.notes}</p>}
                  {(drug.contraindications || []).length > 0 && <p className="text-[11px] text-amber-800 flex gap-1"><AlertTriangle className="w-3.5 h-3.5 shrink-0" /> Contraindications: {drug.contraindications.slice(0, 4).join('; ')}</p>}
                </>
              )}
              <button onClick={() => save('prescribe')} disabled={saving || !drug} className="px-4 py-2 bg-green-700 text-white rounded-lg text-sm disabled:opacity-50 flex items-center gap-2">
                {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />} Prescribe and log
              </button>
            </div>
          )}

          {/* Investigation: category → test, then results */}
          {item.kind === 'investigation' && (
            <div className="rounded-lg border p-3 space-y-2">
              <p className="text-sm font-semibold text-gray-900">{lastOrder ? `Requested: ${lastOrder.test}${lastOrder.priority ? ` (${lastOrder.priority})` : ''}` : 'Request the investigation'}</p>
              {!lastOrder && (
                <>
                  <div className="grid sm:grid-cols-3 gap-2">
                    <label className="text-xs text-gray-600">Category
                      <select value={invCat} onChange={e => { setInvCat(e.target.value as InvestigationCategory); setInvName(''); }} className={sel}>
                        <option value="">— choose —</option>
                        {INVESTIGATION_CATEGORIES.map(c => <option key={c}>{c}</option>)}
                      </select>
                    </label>
                    <label className="text-xs text-gray-600 sm:col-span-2">Investigation
                      <select value={invName} onChange={e => setInvName(e.target.value)} className={sel} disabled={!invCat}>
                        <option value="">— choose —</option>
                        {(invCat ? getInvestigationsByCategory(invCat as InvestigationCategory) : []).map(i => <option key={i.name} value={i.name}>{i.name}{i.abbreviation ? ` (${i.abbreviation})` : ''}</option>)}
                      </select>
                    </label>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <select value={priority} onChange={e => setPriority(e.target.value as any)} className="border rounded-lg px-2 py-2 text-sm">
                      <option value="routine">Routine</option><option value="urgent">Urgent</option><option value="stat">STAT</option>
                    </select>
                    {inv?.specimen && <span className="text-xs text-gray-500">Specimen: {inv.specimen}</span>}
                    <button onClick={() => save('request')} disabled={saving || !inv} className="px-4 py-2 bg-green-700 text-white rounded-lg text-sm disabled:opacity-50 flex items-center gap-2">
                      {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />} Request and log
                    </button>
                  </div>
                </>
              )}

              <button onClick={() => setShowResult(v => !v)} className="text-sm text-green-800 underline">
                {showResult ? 'Hide result entry' : 'Results available? Enter, snap, scan or upload'}
              </button>
              {showResult && (
                <div className="space-y-2 border-t pt-2">
                  <div className="grid grid-cols-3 gap-2">
                    <input value={resultValue} onChange={e => setResultValue(e.target.value)} className={`${sel} col-span-2`} placeholder="Result value (e.g. 9.8)" />
                    <input value={resultUnit} onChange={e => setResultUnit(e.target.value)} className={sel} placeholder="Unit" />
                  </div>
                  {inv?.normalRange && <p className="text-[11px] text-gray-500">Reference: {inv.normalRange}</p>}
                  <textarea value={resultText} onChange={e => setResultText(e.target.value)} rows={2} className={sel} placeholder="Report / interpretation (e.g. culture: Staph. aureus, sensitive to …)" />
                  <div className="flex flex-wrap gap-2">
                    <label className="px-3 py-2 border rounded-lg text-sm flex items-center gap-1.5 cursor-pointer hover:bg-gray-50">
                      <Camera className="w-4 h-4" /> Snap
                      <input type="file" accept="image/*" capture="environment" className="hidden" onChange={e => { void addFiles(e.target.files, true); e.target.value = ''; }} />
                    </label>
                    <button type="button" onClick={() => setShowScan(v => !v)} className="px-3 py-2 border rounded-lg text-sm flex items-center gap-1.5 hover:bg-gray-50">
                      <ScanLine className="w-4 h-4" /> Scan pages
                    </button>
                    <label className="px-3 py-2 border rounded-lg text-sm flex items-center gap-1.5 cursor-pointer hover:bg-gray-50">
                      <FileUp className="w-4 h-4" /> Upload
                      <input type="file" accept="image/*,application/pdf" multiple className="hidden" onChange={e => { void addFiles(e.target.files, true); e.target.value = ''; }} />
                    </label>
                  </div>
                  {showScan && (
                    <MultiPageScanUploader pages={scanPages} onChange={setScanPages} enableOCR documentType="lab_results"
                      label="Scan the result pages" helper="Text is read from the pages and kept with the result."
                      onOCRComplete={(text) => { if (!resultText.trim()) setResultText(text.slice(0, 2000)); }} />
                  )}
                  {files.length > 0 && (
                    <ul className="text-xs space-y-1">
                      {files.map((f, i) => (
                        <li key={i} className="flex items-center gap-2"><Paperclip className="w-3.5 h-3.5" /> {f.name}
                          <button onClick={() => setFiles(fs => fs.filter((_, j) => j !== i))} className="text-red-700 underline">remove</button></li>
                      ))}
                    </ul>
                  )}
                  <button onClick={() => save('result')} disabled={saving} className="px-4 py-2 bg-green-700 text-white rounded-lg text-sm disabled:opacity-50 flex items-center gap-2">
                    {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />} Save result
                  </button>
                </div>
              )}
            </div>
          )}

          {/* Every item can be marked done / not done */}
          <div className="rounded-lg border p-3 space-y-2">
            <p className="text-sm font-semibold text-gray-900">{item.kind === 'medication' || item.kind === 'investigation' ? 'Or record the outcome' : 'Record the implementation'}</p>
            <div className="flex flex-wrap gap-2">
              {[['done', 'Done'], ['partial', 'Partly done'], ['not_done', 'Not done'], ['cancelled', 'Cancelled']].map(([v, l]) => (
                <button key={v} onClick={() => setStatus(v)} className={`px-3 py-1.5 rounded-full text-sm border ${status === v ? 'bg-green-700 text-white border-green-700' : 'bg-white'}`}>{l}</button>
              ))}
            </div>
            <textarea value={note} onChange={e => setNote(e.target.value)} rows={2} className={sel}
              placeholder={['partial', 'not_done', 'cancelled'].includes(status) ? 'Why? (required)' : 'Note (optional) — what was done, findings'} />
            <button onClick={() => save('status')} disabled={saving} className="px-4 py-2 border border-green-700 text-green-800 rounded-lg text-sm disabled:opacity-50">
              Save
            </button>
          </div>

          {/* History */}
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-gray-500 mb-1">Log ({actions.length})</p>
            {actions.length === 0 && <p className="text-xs text-gray-500">Nothing logged yet.</p>}
            <ul className="space-y-2">
              {actions.map(a => (
                <li key={a.id} className="text-xs border rounded-lg p-2">
                  <p><strong className="capitalize">{a.status.replace(/_/g, ' ')}</strong> · {a.user_name || 'Unknown'}{a.user_role ? ` (${a.user_role.replace(/_/g, ' ')})` : ''} · {new Date(a.logged_at).toLocaleString()}</p>
                  <p className="text-gray-600 flex items-center gap-1"><MapPin className="w-3 h-3" />{a.location_label || 'Place not named'}
                    {a.latitude != null && a.longitude != null && (
                      <a className="underline ml-1" target="_blank" rel="noreferrer" href={`https://maps.google.com/?q=${a.latitude},${a.longitude}`}>map (±{Math.round(a.accuracy_m || 0)} m)</a>
                    )}</p>
                  {a.prescription && <p>Rx: {a.prescription.drug} {a.prescription.dose} {a.prescription.route} {String(a.prescription.frequency || '').toUpperCase()}{a.prescription.duration ? ` × ${a.prescription.duration}` : ''}</p>}
                  {a.investigation && a.status === 'ordered' && <p>Requested: {a.investigation.test} ({a.investigation.priority})</p>}
                  {a.result && <p>Result: {[a.result.value, a.result.unit].filter(Boolean).join(' ')}{a.result.text ? ` — ${a.result.text}` : ''}</p>}
                  {a.note && <p className="text-gray-700">“{a.note}”</p>}
                  {(a.attachments || []).map(f => (
                    <button key={f.id} onClick={() => openAttachment(f.id)} className="mr-2 underline text-green-800 inline-flex items-center gap-1"><Paperclip className="w-3 h-3" />{f.name}</button>
                  ))}
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}
