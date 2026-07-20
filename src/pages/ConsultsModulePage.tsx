/**
 * Consults Module page — authenticated.
 *
 * Three sections:
 *   - Received tab: list incoming consults (from public link or staff entry), open detail drawer
 *   - Delivered tab: list outgoing consults; create new ones by OCR-scanning the handwritten consult page
 *   - Links: manage shareable submission links handed out to other units
 */

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Inbox, Send, Link as LinkIcon, Plus, Copy, Check, Loader2, AlertTriangle,
  Search, Camera, X,
} from 'lucide-react';
import {
  listLinks, createLink, setLinkActive,
  listReceived, createReceivedByStaff,
  listDelivered, createDelivered, addAttachment,
  listStaff, REFERRING_DEPARTMENTS, REFERRING_UNITS,
  STATUS_META, URGENCY_META, buildShareableUrl,
  type ReceivedConsult, type DeliveredConsult, type SubmissionLink,
  type ReceivedConsultStatus, type Urgency, type StaffOption,
} from '../services/consultsModuleService';
import { ocrService } from '../services/ocrService';
import ConsultDetailDrawer from '../components/ConsultDetailDrawer';

type Tab = 'received' | 'delivered' | 'links';

export default function ConsultsModulePage() {
  const [tab, setTab] = useState<Tab>('received');
  const [openConsultId, setOpenConsultId] = useState<number | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);

  return (
    <div className="max-w-6xl mx-auto px-4 py-6">
      <header className="mb-4">
        <h1 className="text-2xl font-bold text-gray-900">Consults</h1>
        <p className="text-sm text-gray-500">Bidirectional consults — received from other units and delivered by our team.</p>
      </header>

      <nav className="flex gap-1 border-b border-gray-200 mb-4">
        <TabBtn active={tab === 'received'}  onClick={() => setTab('received')}  icon={<Inbox    className="w-4 h-4" />} label="Received" />
        <TabBtn active={tab === 'delivered'} onClick={() => setTab('delivered')} icon={<Send     className="w-4 h-4" />} label="Delivered" />
        <TabBtn active={tab === 'links'}     onClick={() => setTab('links')}     icon={<LinkIcon className="w-4 h-4" />} label="Shareable links" />
      </nav>

      {tab === 'received'  && <ReceivedTab refreshKey={refreshKey} onOpen={setOpenConsultId} />}
      {tab === 'delivered' && <DeliveredTab refreshKey={refreshKey} onOpen={() => { /* delivered detail not yet wired */ }} />}
      {tab === 'links'     && <LinksTab />}

      {openConsultId !== null && (
        <ConsultDetailDrawer
          consultId={openConsultId}
          onClose={() => setOpenConsultId(null)}
          onChanged={() => setRefreshKey((k) => k + 1)}
        />
      )}
    </div>
  );
}

function TabBtn({ active, onClick, icon, label }: { active: boolean; onClick: () => void; icon: React.ReactNode; label: string }) {
  return (
    <button onClick={onClick}
      className={`flex items-center gap-1.5 px-4 py-2 text-sm font-medium border-b-2 -mb-[2px] ${
        active ? 'border-green-600 text-green-700' : 'border-transparent text-gray-500 hover:text-gray-700'
      }`}>
      {icon}<span>{label}</span>
    </button>
  );
}

// ── Received tab ───────────────────────────────────────────────────────
function ReceivedTab({ refreshKey, onOpen }: { refreshKey: number; onOpen: (id: number) => void }) {
  const [items, setItems] = useState<ReceivedConsult[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const perPage = 20;
  const [statusFilter, setStatusFilter] = useState<ReceivedConsultStatus | ''>('');
  const [urgencyFilter, setUrgencyFilter] = useState<Urgency | ''>('');
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showManual, setShowManual] = useState(false);

  const load = useCallback(async () => {
    setLoading(true); setError(null);
    try {
      const r = await listReceived({ status: statusFilter, urgency: urgencyFilter, search, page, per_page: perPage });
      setItems(r.consults); setTotal(r.total);
    } catch (e: any) {
      const msg = e?.message || 'Failed to load';
      // A missing/expired session (common on offline field devices) surfaces as
      // "No token provided" — show the actionable fix instead of the raw error.
      if (/no token|token|401|unauthor/i.test(msg)) {
        setError('Your session has expired. Reconnect to the internet and sign in again to view and respond to consults.');
      } else if (!navigator.onLine) {
        setError('You are offline. Reconnect to load the latest consults.');
      } else {
        setError(msg);
      }
    }
    finally { setLoading(false); }
  }, [statusFilter, urgencyFilter, search, page, refreshKey]);
  useEffect(() => { load(); }, [load]);

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-2 items-center">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="w-4 h-4 absolute left-2 top-1/2 -translate-y-1/2 text-gray-400" />
          <input value={search} onChange={(e) => { setSearch(e.target.value); setPage(1); }} placeholder="Patient, ref or unit…"
            className="pl-8 pr-3 py-2 border border-gray-300 rounded text-sm w-full" />
        </div>
        <select value={statusFilter} onChange={(e) => { setStatusFilter(e.target.value as any); setPage(1); }}
          className="px-2 py-2 border border-gray-300 rounded text-sm bg-white">
          <option value="">All statuses</option>
          {Object.entries(STATUS_META).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
        </select>
        <select value={urgencyFilter} onChange={(e) => { setUrgencyFilter(e.target.value as any); setPage(1); }}
          className="px-2 py-2 border border-gray-300 rounded text-sm bg-white">
          <option value="">All urgencies</option>
          {Object.entries(URGENCY_META).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
        </select>
        <button onClick={() => setShowManual(true)} className="px-3 py-2 bg-green-600 text-white rounded text-sm hover:bg-green-700 flex items-center gap-1">
          <Plus className="w-4 h-4" /> Manual entry
        </button>
      </div>

      {error && <Banner kind="error" message={error} />}

      {loading ? (
        <div className="py-10 text-center text-gray-500"><Loader2 className="w-6 h-6 animate-spin mx-auto" /></div>
      ) : items.length === 0 ? (
        <Empty title="No received consults yet" hint="Share a public submission link with referring units, or create a manual entry." />
      ) : (
        <ul className="space-y-2">
          {items.map(c => {
            const sm = STATUS_META[c.status] || STATUS_META.received;
            const um = URGENCY_META[c.urgency] || URGENCY_META.routine;
            return (
              <li key={c.id} onClick={() => onOpen(c.id)}
                className="bg-white border border-gray-200 rounded-lg p-3 cursor-pointer hover:border-green-400 hover:shadow-sm">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-mono text-xs text-gray-500">{c.consult_ref}</span>
                  <span className={`px-2 py-0.5 rounded-full text-[11px] font-medium border ${um.color}`}>{um.label}</span>
                  <span className={`px-2 py-0.5 rounded-full text-[11px] font-medium ${sm.bg} ${sm.color}`}>{sm.label}</span>
                  <span className="ml-auto text-xs text-gray-400">{new Date(c.created_at).toLocaleString()}</span>
                </div>
                <div className="mt-1 flex items-baseline gap-2">
                  <span className="font-semibold text-gray-900">{c.patient_name}</span>
                  <span className="text-xs text-gray-500">{c.referring_unit} · {c.referring_doctor_name}</span>
                </div>
                {c.indication && <p className="text-xs text-gray-600 mt-0.5 line-clamp-2">{c.indication}</p>}
              </li>
            );
          })}
        </ul>
      )}

      <Pagination page={page} perPage={perPage} total={total} onPageChange={setPage} />

      {showManual && (
        <ManualReceivedConsultModal
          onClose={() => setShowManual(false)}
          onCreated={() => { setShowManual(false); load(); }}
        />
      )}
    </div>
  );
}

const MANUAL_EMPTY = {
  patient_name: '', hospital_number: '', age: '', sex: '', ward: '', bed_number: '',
  referring_hospital: '', referring_department: '', referring_unit: '',
  referring_consultant: '', referring_consultant_id: '' as string | number | '', referring_consultant_phone: '',
  referring_senior_registrar_name: '', referring_senior_registrar_phone: '',
  referring_registrar_name: '', referring_registrar_phone: '',
  referring_house_officer_name: '', referring_house_officer_phone: '',
  referring_medical_officer_name: '', referring_medical_officer_phone: '',
  referring_doctor_name: '', referring_doctor_role: '', referring_phone: '',
  indication: '', urgency: 'routine' as Urgency,
};

function ManualReceivedConsultModal({ onClose, onCreated }: { onClose: () => void; onCreated: () => void }) {
  const [form, setForm] = useState({ ...MANUAL_EMPTY });
  const [staff, setStaff] = useState<StaffOption[]>([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => { listStaff().then(setStaff).catch(() => setStaff([])); }, []);

  function up<K extends keyof typeof form>(k: K, v: (typeof form)[K]) { setForm(p => ({ ...p, [k]: v })); }

  // Selecting a staff member from the consultant list auto-fills phone + id.
  function onConsultantChange(v: string) {
    const match = staff.find(s => s.full_name === v);
    setForm(p => ({
      ...p,
      referring_consultant: v,
      referring_consultant_id: match ? match.id : '',
      referring_consultant_phone: match?.phone ? match.phone : p.referring_consultant_phone,
    }));
  }

  async function save() {
    setError(null);
    const missing: string[] = [];
    if (!form.patient_name) missing.push('Patient name');
    if (!form.referring_hospital) missing.push('Referring hospital');
    if (!form.referring_department) missing.push('Referring department');
    if (!form.referring_unit) missing.push('Referring unit');
    if (!form.referring_consultant) missing.push('Referring consultant');
    if (!form.ward) missing.push('Ward');
    if (!form.referring_doctor_name) missing.push('Contact name');
    if (!form.referring_phone) missing.push('Contact phone');
    if (!form.indication) missing.push('Reason for referral');
    if (missing.length) { setError(`Please complete: ${missing.join(', ')}`); return; }
    setSaving(true);
    try {
      await createReceivedByStaff({
        ...form,
        age: form.age ? parseInt(form.age, 10) : undefined,
        referring_consultant_id: form.referring_consultant_id || undefined,
        referral_priority: form.urgency,
        reason_for_referral: form.indication,
        referral_datetime: new Date().toISOString(),
      } as any);
      onCreated();
    } catch (e: any) { setError(e.message || 'Failed to create'); }
    finally { setSaving(false); }
  }

  return (
    <ModalShell title="Manual received consult" onClose={onClose}>
      <SectionLabel>Patient</SectionLabel>
      <div className="grid grid-cols-2 gap-2 text-sm">
        <Inp label="Patient name *"            value={form.patient_name}            onChange={(v) => up('patient_name', v)} />
        <Inp label="Hospital number"           value={form.hospital_number}         onChange={(v) => up('hospital_number', v)} />
        <Inp label="Age"                       value={form.age}                     onChange={(v) => up('age', v)} type="number" />
        <Inp label="Sex"                       value={form.sex}                     onChange={(v) => up('sex', v)} />
        <Inp label="Ward *"                    value={form.ward}                    onChange={(v) => up('ward', v)} />
        <Inp label="Bed"                       value={form.bed_number}              onChange={(v) => up('bed_number', v)} />
      </div>

      <SectionLabel>Referring unit / inviting team</SectionLabel>
      <div className="grid grid-cols-2 gap-2 text-sm">
        <Inp label="Referring hospital *"      value={form.referring_hospital}      onChange={(v) => up('referring_hospital', v)} />
        <Inp label="Referring department *"    value={form.referring_department}    onChange={(v) => up('referring_department', v)} list="mref-departments" options={REFERRING_DEPARTMENTS} />
        <Inp label="Referring unit *"          value={form.referring_unit}          onChange={(v) => up('referring_unit', v)} list="mref-units" options={REFERRING_UNITS} />
        <label className="text-xs text-gray-600">Referral priority *
          <select value={form.urgency} onChange={(e) => up('urgency', e.target.value as Urgency)}
            className="mt-1 w-full px-2 py-1.5 border border-gray-300 rounded text-sm bg-white">
            <option value="routine">Routine</option>
            <option value="urgent">Urgent</option>
            <option value="emergency">Emergency</option>
          </select>
        </label>
        <Inp label="Referring consultant *"    value={form.referring_consultant}    onChange={onConsultantChange} list="mref-staff" options={staff.map(s => s.full_name)} placeholder="Search staff or type name" />
        <Inp label="Consultant phone"          value={form.referring_consultant_phone}    onChange={(v) => up('referring_consultant_phone', v)} type="tel" />
        <Inp label="Senior registrar"          value={form.referring_senior_registrar_name}  onChange={(v) => up('referring_senior_registrar_name', v)} />
        <Inp label="Senior registrar phone"    value={form.referring_senior_registrar_phone} onChange={(v) => up('referring_senior_registrar_phone', v)} type="tel" />
        <Inp label="Registrar"                 value={form.referring_registrar_name}      onChange={(v) => up('referring_registrar_name', v)} />
        <Inp label="Registrar phone"           value={form.referring_registrar_phone}     onChange={(v) => up('referring_registrar_phone', v)} type="tel" />
        <Inp label="House officer"             value={form.referring_house_officer_name}  onChange={(v) => up('referring_house_officer_name', v)} />
        <Inp label="House officer phone"       value={form.referring_house_officer_phone} onChange={(v) => up('referring_house_officer_phone', v)} type="tel" />
        <Inp label="Medical officer"           value={form.referring_medical_officer_name}  onChange={(v) => up('referring_medical_officer_name', v)} />
        <Inp label="Medical officer phone"     value={form.referring_medical_officer_phone} onChange={(v) => up('referring_medical_officer_phone', v)} type="tel" />
      </div>

      <SectionLabel>Contact for feedback</SectionLabel>
      <div className="grid grid-cols-2 gap-2 text-sm">
        <Inp label="Contact name *"            value={form.referring_doctor_name}   onChange={(v) => up('referring_doctor_name', v)} />
        <Inp label="Contact role"              value={form.referring_doctor_role}   onChange={(v) => up('referring_doctor_role', v)} />
        <Inp label="Contact phone *"           value={form.referring_phone}         onChange={(v) => up('referring_phone', v)} type="tel" />
      </div>

      <label className="text-xs text-gray-600 block mt-2">Reason for referral *
        <textarea value={form.indication} onChange={(e) => up('indication', e.target.value)} rows={3}
          className="mt-1 w-full px-2 py-1.5 border border-gray-300 rounded text-sm" />
      </label>
      {error && <Banner kind="error" message={error} />}
      <ModalFooter>
        <button onClick={onClose} className="px-3 py-1.5 text-sm text-gray-600 hover:bg-gray-100 rounded">Cancel</button>
        <button onClick={save} disabled={saving} className="px-4 py-1.5 bg-green-600 text-white rounded text-sm hover:bg-green-700 disabled:bg-gray-300">
          {saving ? 'Saving…' : 'Create consult'}
        </button>
      </ModalFooter>
    </ModalShell>
  );
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return <div className="text-xs font-semibold text-gray-500 uppercase tracking-wide mt-3 mb-1 first:mt-0">{children}</div>;
}

// ── Delivered tab ──────────────────────────────────────────────────────
function DeliveredTab({ refreshKey, onOpen }: { refreshKey: number; onOpen: (id: number) => void }) {
  const [items, setItems] = useState<DeliveredConsult[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const perPage = 20;
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showCreate, setShowCreate] = useState(false);

  const load = useCallback(async () => {
    setLoading(true); setError(null);
    try {
      const r = await listDelivered({ search, page, per_page: perPage });
      setItems(r.consults); setTotal(r.total);
    } catch (e: any) { setError(e.message || 'Failed to load'); }
    finally { setLoading(false); }
  }, [search, page, refreshKey]);
  useEffect(() => { load(); }, [load]);

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-2 items-center">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="w-4 h-4 absolute left-2 top-1/2 -translate-y-1/2 text-gray-400" />
          <input value={search} onChange={(e) => { setSearch(e.target.value); setPage(1); }} placeholder="Patient, ref or unit…"
            className="pl-8 pr-3 py-2 border border-gray-300 rounded text-sm w-full" />
        </div>
        <button onClick={() => setShowCreate(true)} className="px-3 py-2 bg-green-600 text-white rounded text-sm hover:bg-green-700 flex items-center gap-1">
          <Camera className="w-4 h-4" /> Log delivered consult
        </button>
      </div>

      {error && <Banner kind="error" message={error} />}

      {loading ? (
        <div className="py-10 text-center text-gray-500"><Loader2 className="w-6 h-6 animate-spin mx-auto" /></div>
      ) : items.length === 0 ? (
        <Empty title="No delivered consults yet" hint="Scan a handwritten consult page to log it here." />
      ) : (
        <ul className="space-y-2">
          {items.map(c => (
            <li key={c.id} onClick={() => onOpen(c.id)}
              className="bg-white border border-gray-200 rounded-lg p-3 cursor-pointer hover:border-green-400 hover:shadow-sm">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="font-mono text-xs text-gray-500">{c.consult_ref}</span>
                <span className="px-2 py-0.5 rounded-full text-[11px] font-medium bg-blue-100 text-blue-800">{c.status}</span>
                <span className="ml-auto text-xs text-gray-400">{new Date(c.delivered_at).toLocaleString()}</span>
              </div>
              <div className="mt-1 flex items-baseline gap-2">
                <span className="font-semibold text-gray-900">{c.patient_name}</span>
                <span className="text-xs text-gray-500">→ {c.receiving_unit} · {c.receiver_name}</span>
              </div>
              {c.consult_summary && <p className="text-xs text-gray-600 mt-0.5 line-clamp-2">{c.consult_summary}</p>}
            </li>
          ))}
        </ul>
      )}
      <Pagination page={page} perPage={perPage} total={total} onPageChange={setPage} />

      {showCreate && (
        <DeliveredConsultCreator onClose={() => setShowCreate(false)} onCreated={() => { setShowCreate(false); load(); }} />
      )}
    </div>
  );
}

function DeliveredConsultCreator({ onClose, onCreated }: { onClose: () => void; onCreated: () => void }) {
  const [form, setForm] = useState({
    patient_name: '', hospital_number: '',
    receiving_unit: '', receiving_consultant: '', receiver_name: '', receiver_phone: '', receiver_role: '',
    written_by_name: '', consult_summary: '',
  });
  const [scanning, setScanning] = useState(false);
  const [progress, setProgress] = useState<string | null>(null);
  const [ocrText, setOcrText] = useState('');
  const [imageDataUrl, setImageDataUrl] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function up<K extends keyof typeof form>(k: K, v: (typeof form)[K]) { setForm(p => ({ ...p, [k]: v })); }

  async function handleScan(file: File) {
    setScanning(true); setError(null);
    try {
      const result = await ocrService.extractText(file, 'handwritten_note', (p) => setProgress(`${p.status} ${(p.progress * 100).toFixed(0)}%`));
      setOcrText(result.text);
      const dataUrl = await downscale(file, 1800, 0.82);
      setImageDataUrl(dataUrl);
    } catch (e: any) { setError(e.message || 'OCR failed'); }
    finally { setScanning(false); setProgress(null); }
  }

  async function save() {
    setError(null);
    if (!form.patient_name || !form.receiving_unit || !form.receiver_name || !form.receiver_phone) {
      setError('Patient, receiving unit, receiver name & phone are required.'); return;
    }
    setSaving(true);
    try {
      const created = await createDelivered({
        ...form,
        ocr_raw_text: ocrText || undefined,
        handwritten_image_url: undefined,
      } as any);
      // Attach the image as the handwritten scan
      if (imageDataUrl) {
        await addAttachment('delivered', created.id, {
          kind: 'document',
          file_name: 'handwritten_consult.jpg',
          mime_type: 'image/jpeg',
          data_url: imageDataUrl,
          ocr_text: ocrText || undefined,
        });
      }
      onCreated();
    } catch (e: any) { setError(e.message || 'Failed to save'); }
    finally { setSaving(false); }
  }

  return (
    <ModalShell title="Log delivered (handwritten) consult" onClose={onClose}>
      <div className="space-y-3">
        <div className="bg-blue-50 border border-blue-200 rounded p-2 text-xs text-blue-800">
          Scan or upload a photograph of the handwritten consult page. We will OCR it and let you confirm receiver details.
        </div>
        <FilePicker label="Scan handwritten consult" onPick={handleScan} />
        {scanning && <div className="text-xs text-gray-500 flex items-center gap-1"><Loader2 className="w-3 h-3 animate-spin" /> {progress || 'Scanning…'}</div>}
        {imageDataUrl && (
          <div className="flex gap-3">
            <img src={imageDataUrl} alt="handwritten consult" className="w-32 h-32 object-cover rounded border" />
            <textarea value={ocrText} onChange={(e) => setOcrText(e.target.value)} rows={6}
              className="flex-1 px-2 py-1.5 border border-gray-300 rounded text-xs font-mono"
              placeholder="OCR text — edit as needed" />
          </div>
        )}

        <div className="grid grid-cols-2 gap-2 text-sm">
          <Inp label="Patient name *"            value={form.patient_name}            onChange={(v) => up('patient_name', v)} />
          <Inp label="Hospital number"           value={form.hospital_number}         onChange={(v) => up('hospital_number', v)} />
          <Inp label="Receiving unit *"          value={form.receiving_unit}          onChange={(v) => up('receiving_unit', v)} />
          <Inp label="Receiving consultant"      value={form.receiving_consultant}    onChange={(v) => up('receiving_consultant', v)} />
          <Inp label="Receiver name *"           value={form.receiver_name}           onChange={(v) => up('receiver_name', v)} />
          <Inp label="Receiver phone *"          value={form.receiver_phone}          onChange={(v) => up('receiver_phone', v)} />
          <Inp label="Receiver role"             value={form.receiver_role}           onChange={(v) => up('receiver_role', v)} />
          <Inp label="Written by"                value={form.written_by_name}         onChange={(v) => up('written_by_name', v)} />
        </div>
        <label className="text-xs text-gray-600 block">Consult summary
          <textarea value={form.consult_summary} onChange={(e) => up('consult_summary', e.target.value)} rows={2}
            className="mt-1 w-full px-2 py-1.5 border border-gray-300 rounded text-sm" />
        </label>
        {error && <Banner kind="error" message={error} />}
      </div>
      <ModalFooter>
        <button onClick={onClose} className="px-3 py-1.5 text-sm text-gray-600 hover:bg-gray-100 rounded">Cancel</button>
        <button onClick={save} disabled={saving} className="px-4 py-1.5 bg-green-600 text-white rounded text-sm hover:bg-green-700 disabled:bg-gray-300">
          {saving ? 'Saving…' : 'Save delivered consult'}
        </button>
      </ModalFooter>
    </ModalShell>
  );
}

// ── Links tab ──────────────────────────────────────────────────────────
// Single universal submission link: any external unit/subspecialty can use it
// to send a consult. The submitter identifies their unit in the public form.
const UNIVERSAL_LINK_LABEL = 'All units';

function LinksTab() {
  const [link, setLink] = useState<SubmissionLink | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [reactivating, setReactivating] = useState(false);

  const load = useCallback(async () => {
    setLoading(true); setError(null);
    try {
      const all = await listLinks();
      // Prefer the first active link; otherwise reuse any existing one;
      // if none at all, auto-create the universal link.
      let chosen = all.find(l => l.is_active) || all[0] || null;
      if (!chosen) {
        chosen = await createLink(UNIVERSAL_LINK_LABEL, 'Universal submission link for any external unit or subspecialty.');
      }
      setLink(chosen);
    } catch (e: any) {
      setError(e.message || 'Failed to load link');
    } finally { setLoading(false); }
  }, []);
  useEffect(() => { load(); }, [load]);

  async function copyUrl() {
    if (!link) return;
    try {
      await navigator.clipboard.writeText(buildShareableUrl(link.token));
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch { /* ignore */ }
  }

  async function reactivate() {
    if (!link || link.is_active) return;
    setReactivating(true);
    try { await setLinkActive(link.id, true); await load(); }
    finally { setReactivating(false); }
  }

  return (
    <div className="space-y-3">
      <p className="text-sm text-gray-600">
        One universal submission link covers <span className="font-medium">all external units and subspecialties</span>.
        Share this URL — submitters identify their own unit on the consult form. No login required for them.
      </p>

      {error && <Banner kind="error" message={error} />}

      {loading ? (
        <div className="py-10 text-center text-gray-500"><Loader2 className="w-6 h-6 animate-spin mx-auto" /></div>
      ) : !link ? (
        <Empty title="No submission link yet" hint="A universal link will be created automatically when this tab loads. Please refresh." />
      ) : (
        <div className="bg-white border border-gray-200 rounded-lg p-4">
          <div className="flex items-center gap-2 flex-wrap mb-2">
            <LinkIcon className="w-4 h-4 text-green-600" />
            <span className="font-semibold text-gray-900">Universal consult submission link</span>
            <span className={`px-1.5 py-0.5 rounded text-[10px] ${link.is_active ? 'bg-green-100 text-green-800' : 'bg-gray-200 text-gray-600'}`}>
              {link.is_active ? 'Active' : 'Disabled'}
            </span>
            <span className="text-xs text-gray-400 ml-auto">
              {link.submission_count} submissions{link.last_used_at ? ` · last ${new Date(link.last_used_at).toLocaleDateString()}` : ''}
            </span>
          </div>
          <div className="flex items-center gap-2 bg-gray-50 border border-gray-200 rounded px-2 py-2">
            <code className="text-xs text-gray-700 truncate flex-1">{buildShareableUrl(link.token)}</code>
            <button onClick={copyUrl} className="px-2 py-1 text-xs text-green-700 hover:bg-green-50 rounded flex items-center gap-1" title="Copy link">
              {copied ? <><Check className="w-4 h-4" /> Copied</> : <><Copy className="w-4 h-4" /> Copy</>}
            </button>
          </div>
          {!link.is_active && (
            <div className="mt-3 flex items-center justify-between bg-amber-50 border border-amber-200 rounded p-2 text-xs text-amber-800">
              <span className="flex items-center gap-1"><AlertTriangle className="w-3.5 h-3.5" /> This link is currently disabled — submitters can't use it.</span>
              <button onClick={reactivate} disabled={reactivating}
                className="px-2 py-1 bg-green-600 text-white rounded hover:bg-green-700 disabled:bg-gray-300">
                {reactivating ? 'Reactivating…' : 'Reactivate'}
              </button>
            </div>
          )}
          <p className="mt-3 text-xs text-gray-500">
            Tip: print or pin this URL/QR in referring wards. Each submission records the referring unit, doctor name and phone for SMS feedback.
          </p>
        </div>
      )}
    </div>
  );
}

// ── Common UI helpers ──────────────────────────────────────────────────
function Empty({ title, hint }: { title: string; hint?: string }) {
  return (
    <div className="bg-white border border-dashed border-gray-300 rounded-lg p-10 text-center">
      <p className="text-sm font-medium text-gray-700">{title}</p>
      {hint && <p className="text-xs text-gray-500 mt-1">{hint}</p>}
    </div>
  );
}
function Banner({ kind, message }: { kind: 'error' | 'info'; message: string }) {
  const klass = kind === 'error' ? 'bg-red-50 border-red-200 text-red-800' : 'bg-blue-50 border-blue-200 text-blue-800';
  return (
    <div className={`border rounded p-2 text-xs flex items-start gap-2 ${klass}`}>
      <AlertTriangle className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" /><span>{message}</span>
    </div>
  );
}
function Pagination({ page, perPage, total, onPageChange }: { page: number; perPage: number; total: number; onPageChange: (p: number) => void }) {
  const last = Math.max(1, Math.ceil(total / perPage));
  if (last <= 1) return null;
  return (
    <div className="flex items-center justify-between text-xs text-gray-500">
      <span>Page {page} of {last} · {total} consults</span>
      <div className="flex gap-1">
        <button disabled={page <= 1}    onClick={() => onPageChange(page - 1)} className="px-2 py-1 border border-gray-300 rounded disabled:opacity-40">Prev</button>
        <button disabled={page >= last} onClick={() => onPageChange(page + 1)} className="px-2 py-1 border border-gray-300 rounded disabled:opacity-40">Next</button>
      </div>
    </div>
  );
}
function ModalShell({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        <div className="px-4 py-3 border-b flex items-center justify-between">
          <h3 className="font-semibold text-gray-900">{title}</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600"><X className="w-5 h-5" /></button>
        </div>
        <div className="p-4 space-y-3">{children}</div>
      </div>
    </div>
  );
}
function ModalFooter({ children }: { children: React.ReactNode }) {
  return <div className="flex justify-end gap-2 mt-3 pt-3 border-t">{children}</div>;
}
function Inp({ label, value, onChange, type = 'text', placeholder, list, options }: { label: string; value: string; onChange: (v: string) => void; type?: string; placeholder?: string; list?: string; options?: string[] }) {
  return (
    <label className="text-xs text-gray-600 block">{label}
      <input type={type} value={value} placeholder={placeholder} list={list} onChange={(e) => onChange(e.target.value)}
        className="mt-1 w-full px-2 py-1.5 border border-gray-300 rounded text-sm" />
      {list && options && (
        <datalist id={list}>{options.map(o => <option key={o} value={o} />)}</datalist>
      )}
    </label>
  );
}
function FilePicker({ label, onPick }: { label: string; onPick: (f: File) => void }) {
  const ref = React.useRef<HTMLInputElement>(null);
  return (
    <>
      <button type="button" onClick={() => ref.current?.click()}
        className="w-full px-3 py-2 border border-dashed border-gray-300 rounded text-sm text-gray-600 hover:bg-gray-50 hover:border-green-400 flex items-center justify-center gap-1">
        <Camera className="w-4 h-4" /> {label}
      </button>
      <input ref={ref} type="file" accept="image/*" capture="environment" hidden
        onChange={(e) => { const f = e.target.files?.[0]; if (f) onPick(f); e.target.value = ''; }} />
    </>
  );
}
async function downscale(file: File, maxDim: number, quality: number): Promise<string> {
  const url = URL.createObjectURL(file);
  try {
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const i = new Image();
      i.onload = () => resolve(i); i.onerror = () => reject(new Error('decode failed'));
      i.src = url;
    });
    const long = Math.max(img.naturalWidth, img.naturalHeight);
    const scale = long > maxDim ? maxDim / long : 1;
    const canvas = document.createElement('canvas');
    canvas.width = Math.round(img.naturalWidth * scale);
    canvas.height = Math.round(img.naturalHeight * scale);
    canvas.getContext('2d')!.drawImage(img, 0, 0, canvas.width, canvas.height);
    return canvas.toDataURL('image/jpeg', quality);
  } finally { URL.revokeObjectURL(url); }
}
