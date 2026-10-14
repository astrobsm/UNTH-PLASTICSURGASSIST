/**
 * Clinical Governance — the unit's decisions (D1–D7) and the postoperative
 * monitoring protocols (D3), in one place.
 *
 * The software holds and enforces these; the unit makes them. Every save is
 * kept with who made it and when. Monitoring protocols start as drafts written
 * from published guidance: edit them here, save (each save is a new version),
 * and an approver named in D1 approves the version the unit will use. Drafts
 * and approved protocols are shown to staff as guidance; no automatic alert is
 * raised from them yet.
 */

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ShieldCheck, Save, Loader2, AlertTriangle, CheckCircle2, History, ClipboardList, Plus, Trash2,
  ChevronLeft, BookOpen, BadgeCheck, Undo2,
} from 'lucide-react';
import { apiClient } from '../services/apiClient';
import { userManagementService, type ApprovedUser } from '../services/userManagementService';

// ── Types ────────────────────────────────────────────────────────────────
interface Governance {
  d1_content_approver_ids: string[];
  d2_early_warning: string;
  d3_show_draft_profiles: boolean;
  d4_terminology: string;
  d5_external_ai: string;
  d6_sign_roles: string[];
  d6_countersign_roles: string[];
  d6_amend_roles: string[];
  d7_research_approver_ids: string[];
  d7_ethics_reference: string;
  _meta?: { updated_by_name?: string; updated_at?: string; note?: string } | null;
}
interface SettingsResponse {
  settings: Governance;
  options: Record<string, string[]>;
  can_edit: boolean;
  can_approve_content: boolean;
  can_edit_profiles: boolean;
}
interface Phase { label: string; from_hours: number | null; to_hours: number | null }
interface Param { key: string; label: string; method: string; frequency: string[]; notes: string }
interface Source { citation: string; note: string; verified: boolean }
interface ProfileDefinition {
  summary: string; applies_to: string; phases: Phase[]; parameters: Param[];
  expected_progress: string[]; amber_triggers: string[]; red_triggers: string[]; escalation: string[];
}
interface Profile {
  id: string; version: number; title: string; definition: ProfileDefinition; sources: Source[];
  approval_status: 'draft' | 'approved' | 'retired'; change_note?: string | null; content_hash: string;
  created_by_name?: string | null; created_at: string; approved_by_name?: string | null; approved_at?: string | null;
  approved_version?: { version: number; approved_at: string; approved_by_name: string } | null;
}

const BASE = '/clinical-governance';

const ROLE_LABEL: Record<string, string> = {
  house_officer: 'House officer', registrar: 'Registrar', junior_registrar: 'Junior registrar',
  senior_registrar: 'Senior registrar', consultant: 'Consultant', admin: 'Admin', super_admin: 'Super admin',
};

// ── Page ─────────────────────────────────────────────────────────────────
export default function ClinicalGovernancePage() {
  const [tab, setTab] = useState<'decisions' | 'protocols'>('decisions');
  const [meta, setMeta] = useState<SettingsResponse | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

  const loadMeta = useCallback(async () => {
    try {
      setMeta(await apiClient.get<SettingsResponse>(`${BASE}?action=settings`, { freshRead: true }));
      setLoadError(null);
    } catch (e: any) {
      setLoadError(e?.message || 'Could not load governance settings');
    }
  }, []);
  useEffect(() => { loadMeta(); }, [loadMeta]);

  return (
    <div className="max-w-6xl mx-auto px-4 py-6 space-y-4">
      <header>
        <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
          <ShieldCheck className="w-7 h-7 text-green-600" /> Clinical Governance
        </h1>
        <p className="text-sm text-gray-500 mt-1">
          The unit's decisions that the system enforces, and the postoperative monitoring protocols. Every change is kept with who made it and when.
        </p>
      </header>
      <nav className="flex gap-1 border-b border-gray-200">
        {([['decisions', 'Decisions (D1–D7)', ShieldCheck], ['protocols', 'Monitoring protocols (D3)', ClipboardList]] as const).map(([k, label, Icon]) => (
          <button key={k} onClick={() => setTab(k)}
            className={`flex items-center gap-1.5 px-4 py-2 text-sm font-medium border-b-2 -mb-[2px] ${tab === k ? 'border-green-600 text-green-700' : 'border-transparent text-gray-500 hover:text-gray-700'}`}>
            <Icon className="w-4 h-4" /> {label}
          </button>
        ))}
      </nav>
      {loadError && <Banner kind="error">{loadError}</Banner>}
      {meta && tab === 'decisions' && <DecisionsTab meta={meta} onSaved={loadMeta} />}
      {meta && tab === 'protocols' && <ProtocolsTab meta={meta} />}
      {!meta && !loadError && <Loading />}
    </div>
  );
}

// ── Decisions ────────────────────────────────────────────────────────────
function DecisionsTab({ meta, onSaved }: { meta: SettingsResponse; onSaved: () => void }) {
  const [draft, setDraft] = useState<Governance>(meta.settings);
  const [users, setUsers] = useState<ApprovedUser[]>([]);
  const [note, setNote] = useState('');
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [history, setHistory] = useState<any[] | null>(null);

  useEffect(() => { setDraft(meta.settings); }, [meta.settings]);
  useEffect(() => { userManagementService.getAllApprovedUsers().then(setUsers).catch(() => setUsers([])); }, []);

  const senior = users.filter(u => ['consultant', 'admin', 'super_admin', 'senior_registrar'].includes(u.role as string));
  const ro = !meta.can_edit;
  const set = <K extends keyof Governance>(k: K, v: Governance[K]) => setDraft(d => ({ ...d, [k]: v }));
  const toggle = (k: 'd1_content_approver_ids' | 'd7_research_approver_ids' | 'd6_sign_roles' | 'd6_countersign_roles' | 'd6_amend_roles', v: string) =>
    setDraft(d => ({ ...d, [k]: d[k].includes(v) ? d[k].filter(x => x !== v) : [...d[k], v] }));

  const save = async () => {
    setSaving(true); setMsg(null);
    try {
      const { _meta, ...settings } = draft;
      await apiClient.put(`${BASE}?action=settings`, { ...settings, note });
      setMsg({ ok: true, text: 'Decisions saved. The previous version is kept in the history.' });
      setNote('');
      onSaved();
    } catch (e: any) {
      setMsg({ ok: false, text: e?.message || 'Save failed' });
    } finally { setSaving(false); }
  };

  const loadHistory = async () => {
    try { setHistory((await apiClient.get<any>(`${BASE}?action=history`, { freshRead: true })).history || []); }
    catch { setHistory([]); }
  };

  return (
    <div className="space-y-4">
      {ro && <Banner kind="info">You can view these decisions. Only consultants and administrators can change them.</Banner>}
      {draft._meta?.updated_at && (
        <p className="text-xs text-gray-500">In force since {new Date(draft._meta.updated_at).toLocaleString()} — set by {draft._meta.updated_by_name || 'unknown'}{draft._meta.note ? ` (“${draft._meta.note}”)` : ''}.</p>
      )}

      <Decision code="D1" title="Clinical content approvers"
        help="Who approves templates, rules and monitoring protocols. Until someone is named, any consultant or administrator can approve.">
        <PeoplePicker people={senior} selected={draft.d1_content_approver_ids} disabled={ro} onToggle={(id) => toggle('d1_content_approver_ids', id)} />
      </Decision>

      <Decision code="D2" title="Early-warning score"
        help="Which score drives red/amber/green deterioration status on ward rounds. Until decided, early-warning rules are computed in the background only and never shown as alerts.">
        <Choice name="d2" value={draft.d2_early_warning} disabled={ro} onChange={(v) => set('d2_early_warning', v)} options={[
          ['undecided', 'Not decided yet', 'Rules run in shadow mode only.'],
          ['news2_standard', 'NEWS2 as published (RCP 2017)', 'Thresholds exactly as the Royal College of Physicians publishes them, including the SpO₂ scale 2 option.'],
          ['news2_local_modified', 'NEWS2 with local modifications', 'Thresholds edited and approved by the unit (each change versioned).'],
          ['none', 'No early-warning score', 'Statuses come from clinician assessment only.'],
        ]} />
      </Decision>

      <Decision code="D3" title="Postoperative monitoring protocols"
        help="Protocols are edited and approved one by one on the Monitoring protocols tab. Choose whether staff may see drafts that are not yet approved.">
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" checked={draft.d3_show_draft_profiles} disabled={ro} onChange={(e) => set('d3_show_draft_profiles', e.target.checked)} />
          Show unapproved draft protocols to staff (clearly marked “draft”)
        </label>
      </Decision>

      <Decision code="D4" title="Terminology and coding"
        help="How structured clinical terms are coded. SNOMED CT requires a licence; Nigeria is not a SNOMED International member country, so confirm a licence before choosing it.">
        <Choice name="d4" value={draft.d4_terminology} disabled={ro} onChange={(v) => set('d4_terminology', v)} options={[
          ['local_only', 'Local terms only', 'Searchable unit vocabulary with synonyms, no external codes.'],
          ['local_icd10_loinc', 'Local terms + ICD-10 and LOINC codes', 'Diagnoses mapped to ICD-10, laboratory tests to LOINC where the mapping is unambiguous.'],
          ['snomed_licensed', 'SNOMED CT (licence confirmed)', 'Concepts also mapped to SNOMED CT.'],
        ]} />
      </Decision>

      <Decision code="D5" title="External AI (OpenAI)"
        help="Whether clinical text may be sent to OpenAI. When enabled, patient names, hospital numbers, phone numbers and emails are removed on the server first, and every request is recorded in the clinical audit log.">
        <Choice name="d5" value={draft.d5_external_ai} disabled={ro} onChange={(v) => set('d5_external_ai', v)} options={[
          ['enabled_deidentified', 'Enabled — identifiers removed', 'Scribe, OCR structuring, summaries and suggestions available. AI output is always a suggestion for clinician review.'],
          ['disabled', 'Disabled', 'No clinical text leaves the hospital system; AI features fall back to rule-based or manual entry.'],
        ]} />
      </Decision>

      <Decision code="D6" title="Signing and amendment"
        help="Who may sign, countersign and amend clinical documents. Enforced on the server when signed encounters are introduced.">
        {([['d6_sign_roles', 'May sign'], ['d6_countersign_roles', 'May countersign'], ['d6_amend_roles', 'May amend a signed document (reason required)']] as const).map(([k, label]) => (
          <div key={k} className="mb-2">
            <div className="text-xs font-medium text-gray-600 mb-1">{label}</div>
            <div className="flex flex-wrap gap-2">
              {meta.options.d6_sign_roles.map(r => (
                <label key={r} className={`text-xs px-2 py-1 rounded border flex items-center gap-1 ${draft[k].includes(r) ? 'bg-green-50 border-green-400' : 'bg-white border-gray-300'}`}>
                  <input type="checkbox" checked={draft[k].includes(r)} disabled={ro} onChange={() => toggle(k, r)} /> {ROLE_LABEL[r] || r}
                </label>
              ))}
            </div>
          </div>
        ))}
      </Decision>

      <Decision code="D7" title="Research data access"
        help="Who approves de-identified research exports, and the ethics committee approval they are covered by.">
        <PeoplePicker people={senior} selected={draft.d7_research_approver_ids} disabled={ro} onToggle={(id) => toggle('d7_research_approver_ids', id)} />
        <label className="block text-sm mt-2">
          <span className="text-xs text-gray-600">Ethics committee approval reference</span>
          <input value={draft.d7_ethics_reference} disabled={ro} onChange={(e) => set('d7_ethics_reference', e.target.value)}
            placeholder="e.g. UNTH/HREC/2026/xx/xxx" className="mt-1 w-full sm:w-96 border border-gray-300 rounded px-2 py-1.5 text-sm" />
        </label>
      </Decision>

      {!ro && (
        <div className="bg-white border rounded-lg p-4 flex flex-wrap items-end gap-3 sticky bottom-2 shadow-sm">
          <label className="flex-1 min-w-[240px] text-sm">
            <span className="text-xs text-gray-600">Reason for this change (kept in the history)</span>
            <input value={note} onChange={(e) => setNote(e.target.value)} placeholder="e.g. Agreed at departmental meeting 14/10/2026"
              className="mt-1 w-full border border-gray-300 rounded px-2 py-1.5 text-sm" />
          </label>
          <button onClick={save} disabled={saving} className="px-4 py-2 bg-green-600 text-white rounded-lg text-sm font-medium hover:bg-green-700 disabled:opacity-50 flex items-center gap-2">
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />} Save decisions
          </button>
        </div>
      )}
      {msg && <Banner kind={msg.ok ? 'ok' : 'error'}>{msg.text}</Banner>}

      <div>
        <button onClick={loadHistory} className="text-sm text-gray-600 hover:text-gray-900 flex items-center gap-1"><History className="w-4 h-4" /> Show change history</button>
        {history && (
          <ul className="mt-2 text-xs divide-y border rounded bg-white">
            {history.length === 0 && <li className="p-2 text-gray-500">No changes saved yet — the defaults are in force.</li>}
            {history.map(h => (
              <li key={h.id} className="p-2">
                <span className="font-medium">{new Date(h.created_at).toLocaleString()}</span> — {h.updated_by_name || 'unknown'}
                {h.note && <span className="text-gray-600"> · {h.note}</span>}
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

function Decision({ code, title, help, children }: { code: string; title: string; help: string; children: React.ReactNode }) {
  return (
    <section className="bg-white border rounded-lg p-4">
      <div className="flex items-start gap-3">
        <span className="px-2 py-0.5 rounded bg-gray-900 text-white text-xs font-bold">{code}</span>
        <div className="flex-1 min-w-0">
          <h2 className="font-semibold text-gray-900">{title}</h2>
          <p className="text-xs text-gray-500 mb-3">{help}</p>
          {children}
        </div>
      </div>
    </section>
  );
}

function Choice({ name, value, options, disabled, onChange }: {
  name: string; value: string; disabled: boolean; onChange: (v: string) => void; options: Array<[string, string, string]>;
}) {
  return (
    <div className="space-y-1.5">
      {options.map(([v, label, desc]) => (
        <label key={v} className={`flex items-start gap-2 p-2 rounded border text-sm cursor-pointer ${value === v ? 'border-green-500 bg-green-50' : 'border-gray-200'}`}>
          <input type="radio" name={name} className="mt-1" checked={value === v} disabled={disabled} onChange={() => onChange(v)} />
          <span><span className="font-medium">{label}</span><span className="block text-xs text-gray-500">{desc}</span></span>
        </label>
      ))}
    </div>
  );
}

function PeoplePicker({ people, selected, disabled, onToggle }: { people: ApprovedUser[]; selected: string[]; disabled: boolean; onToggle: (id: string) => void }) {
  if (!people.length) return <p className="text-xs text-gray-400">Loading staff…</p>;
  return (
    <div className="flex flex-wrap gap-2">
      {people.map(p => {
        const on = selected.includes(String(p.id));
        return (
          <label key={p.id} className={`text-xs px-2 py-1 rounded border flex items-center gap-1 ${on ? 'bg-green-50 border-green-400' : 'bg-white border-gray-300'}`}>
            <input type="checkbox" checked={on} disabled={disabled} onChange={() => onToggle(String(p.id))} />
            {p.full_name} <span className="text-gray-400">({ROLE_LABEL[p.role as string] || p.role})</span>
          </label>
        );
      })}
    </div>
  );
}

// ── Monitoring protocols ─────────────────────────────────────────────────
function ProtocolsTab({ meta }: { meta: SettingsResponse }) {
  const [profiles, setProfiles] = useState<Profile[] | null>(null);
  const [openId, setOpenId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try { setProfiles((await apiClient.get<any>(`${BASE}?action=profiles`, { freshRead: true })).profiles || []); setError(null); }
    catch (e: any) { setError(e?.message || 'Could not load protocols'); }
  }, []);
  useEffect(() => { load(); }, [load]);

  if (openId) return <ProfileEditor id={openId} meta={meta} onBack={() => { setOpenId(null); load(); }} />;
  if (error) return <Banner kind="error">{error}</Banner>;
  if (!profiles) return <Loading />;

  return (
    <div className="space-y-3">
      <Banner kind="info">
        These protocols start as drafts written from published guidance (NEWS2, NICE, ISBI and others) and common practice. Edit each one to match the unit's
        practice, check every source, then an approver named in D1 approves it. They are shown to staff as guidance; no automatic alerts are raised from them yet.
      </Banner>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {profiles.map(p => (
          <button key={p.id} onClick={() => setOpenId(p.id)} className="text-left bg-white border rounded-lg p-4 hover:border-green-400 hover:shadow-sm">
            <div className="flex items-start justify-between gap-2">
              <h3 className="font-semibold text-gray-900">{p.title}</h3>
              <StatusBadge p={p} />
            </div>
            <p className="text-xs text-gray-500 mt-1 line-clamp-2">{p.definition.summary}</p>
            <p className="text-[11px] text-gray-400 mt-2">
              {p.definition.parameters.length} monitored items · {p.definition.phases.length} time phases · {p.sources.filter(s => !s.verified).length} source(s) to verify
            </p>
          </button>
        ))}
      </div>
    </div>
  );
}

function StatusBadge({ p }: { p: Profile }) {
  if (p.approval_status === 'approved') return <span className="text-[11px] px-2 py-0.5 rounded-full bg-green-100 text-green-800 whitespace-nowrap">Approved v{p.version}</span>;
  if (p.approved_version) return <span className="text-[11px] px-2 py-0.5 rounded-full bg-amber-100 text-amber-800 whitespace-nowrap">v{p.approved_version.version} approved · draft v{p.version}</span>;
  return <span className="text-[11px] px-2 py-0.5 rounded-full bg-gray-200 text-gray-700 whitespace-nowrap">Draft v{p.version}</span>;
}

function ProfileEditor({ id, meta, onBack }: { id: string; meta: SettingsResponse; onBack: () => void }) {
  const [versions, setVersions] = useState<Profile[] | null>(null);
  const [form, setForm] = useState<Profile | null>(null);
  const [changeNote, setChangeNote] = useState('');
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const editable = meta.can_edit_profiles;

  const load = useCallback(async () => {
    const v = (await apiClient.get<any>(`${BASE}?action=profile&id=${encodeURIComponent(id)}`, { freshRead: true })).versions as Profile[];
    setVersions(v);
    setForm(v[0] ? JSON.parse(JSON.stringify(v[0])) : null);
  }, [id]);
  useEffect(() => { load().catch(e => setMsg({ ok: false, text: e?.message || 'Load failed' })); }, [load]);

  const latest = versions?.[0];
  const dirty = useMemo(() => !!(form && latest && JSON.stringify({ t: form.title, d: form.definition, s: form.sources }) !== JSON.stringify({ t: latest.title, d: latest.definition, s: latest.sources })), [form, latest]);

  if (!form || !latest) return <Loading />;
  const d = form.definition;
  const setDef = (patch: Partial<ProfileDefinition>) => setForm(f => f && ({ ...f, definition: { ...f.definition, ...patch } }));

  const saveVersion = async () => {
    setBusy(true); setMsg(null);
    try {
      await apiClient.post(`${BASE}?action=profile&id=${encodeURIComponent(id)}`, {
        title: form.title, definition: form.definition, sources: form.sources,
        change_note: changeNote, base_version: latest.version,
      });
      setChangeNote('');
      setMsg({ ok: true, text: 'Saved as a new draft version. The approved version (if any) stays in force until this one is approved.' });
      await load();
    } catch (e: any) { setMsg({ ok: false, text: e?.message || 'Save failed' }); }
    finally { setBusy(false); }
  };
  const approve = async (version: number) => {
    const unverified = latest.sources.filter(s => !s.verified).length;
    if (!confirm(`Approve version ${version} of "${latest.title}" as the unit's protocol?${unverified ? `\n\n${unverified} source(s) are not marked as verified.` : ''}`)) return;
    setBusy(true); setMsg(null);
    try {
      await apiClient.post(`${BASE}?action=approve&id=${encodeURIComponent(id)}&version=${version}`, {});
      setMsg({ ok: true, text: `Version ${version} approved.` });
      await load();
    } catch (e: any) { setMsg({ ok: false, text: e?.message || 'Approval failed' }); }
    finally { setBusy(false); }
  };
  const withdraw = async (version: number) => {
    if (!confirm(`Withdraw approval of version ${version}? The protocol will have no approved version in force.`)) return;
    setBusy(true);
    try { await apiClient.post(`${BASE}?action=retire&id=${encodeURIComponent(id)}&version=${version}`, {}); await load(); }
    catch (e: any) { setMsg({ ok: false, text: e?.message || 'Failed' }); }
    finally { setBusy(false); }
  };

  const updateParam = (i: number, patch: Partial<Param>) => setDef({ parameters: d.parameters.map((p, j) => (j === i ? { ...p, ...patch } : p)) });
  const updatePhase = (i: number, patch: Partial<Phase>) => setDef({ phases: d.phases.map((p, j) => (j === i ? { ...p, ...patch } : p)) });

  return (
    <div className="space-y-4">
      <button onClick={onBack} className="text-sm text-gray-600 hover:text-gray-900 flex items-center gap-1"><ChevronLeft className="w-4 h-4" /> All protocols</button>
      <div className="bg-white border rounded-lg p-4 space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <input value={form.title} disabled={!editable} onChange={(e) => setForm({ ...form, title: e.target.value })}
            className="text-xl font-bold text-gray-900 border-b border-transparent focus:border-gray-300 outline-none flex-1 min-w-[240px]" />
          <StatusBadge p={latest} />
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm">
          <Field label="Summary" value={d.summary} disabled={!editable} rows={3} onChange={(v) => setDef({ summary: v })} />
          <Field label="Applies to" value={d.applies_to} disabled={!editable} rows={3} onChange={(v) => setDef({ applies_to: v })} />
        </div>
      </div>

      {/* Phases + parameters */}
      <div className="bg-white border rounded-lg p-4 overflow-x-auto">
        <h3 className="font-semibold text-gray-900 mb-2">Observations and frequency</h3>
        <table className="w-full text-xs min-w-[900px]">
          <thead>
            <tr className="bg-gray-50 text-left">
              <th className="p-2 w-64">Monitored item</th>
              <th className="p-2 w-40">Method</th>
              {d.phases.map((ph, i) => (
                <th key={i} className="p-2 align-top">
                  <input value={ph.label} disabled={!editable} onChange={(e) => updatePhase(i, { label: e.target.value })} className="w-full font-semibold bg-transparent border-b border-gray-200" />
                  <div className="flex gap-1 mt-1 text-[10px] text-gray-500 items-center">
                    <input type="number" value={ph.from_hours ?? ''} disabled={!editable} onChange={(e) => updatePhase(i, { from_hours: e.target.value === '' ? null : Number(e.target.value) })} className="w-12 border rounded px-1" />h –
                    <input type="number" value={ph.to_hours ?? ''} placeholder="∞" disabled={!editable} onChange={(e) => updatePhase(i, { to_hours: e.target.value === '' ? null : Number(e.target.value) })} className="w-12 border rounded px-1" />h
                    {editable && d.phases.length > 1 && (
                      <button title="Remove phase" onClick={() => setDef({ phases: d.phases.filter((_, j) => j !== i), parameters: d.parameters.map(p => ({ ...p, frequency: p.frequency.filter((_, j) => j !== i) })) })} className="text-gray-400 hover:text-red-600"><Trash2 className="w-3 h-3" /></button>
                    )}
                  </div>
                </th>
              ))}
              <th className="p-2 w-48">Notes</th>
              <th className="p-2 w-6" />
            </tr>
          </thead>
          <tbody className="divide-y">
            {d.parameters.map((p, i) => (
              <tr key={i} className="align-top">
                <td className="p-1"><textarea rows={2} value={p.label} disabled={!editable} onChange={(e) => updateParam(i, { label: e.target.value })} className="w-full border rounded px-1 py-0.5" /></td>
                <td className="p-1"><textarea rows={2} value={p.method} disabled={!editable} onChange={(e) => updateParam(i, { method: e.target.value })} className="w-full border rounded px-1 py-0.5" /></td>
                {d.phases.map((_, j) => (
                  <td key={j} className="p-1"><input value={p.frequency[j] || ''} disabled={!editable} placeholder="—"
                    onChange={(e) => updateParam(i, { frequency: d.phases.map((__, k) => (k === j ? e.target.value : p.frequency[k] || '')) })}
                    className="w-full border rounded px-1 py-0.5" /></td>
                ))}
                <td className="p-1"><textarea rows={2} value={p.notes} disabled={!editable} onChange={(e) => updateParam(i, { notes: e.target.value })} className="w-full border rounded px-1 py-0.5" /></td>
                <td className="p-1">{editable && <button title="Remove item" onClick={() => setDef({ parameters: d.parameters.filter((_, j) => j !== i) })} className="text-gray-400 hover:text-red-600"><Trash2 className="w-3.5 h-3.5" /></button>}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {editable && (
          <div className="flex gap-3 mt-2">
            <button onClick={() => setDef({ parameters: [...d.parameters, { key: `item_${d.parameters.length + 1}`, label: '', method: '', frequency: d.phases.map(() => ''), notes: '' }] })}
              className="text-xs text-green-700 flex items-center gap-1"><Plus className="w-3.5 h-3.5" /> Add monitored item</button>
            <button onClick={() => setDef({ phases: [...d.phases, { label: 'New phase', from_hours: null, to_hours: null }], parameters: d.parameters.map(p => ({ ...p, frequency: [...p.frequency, ''] })) })}
              className="text-xs text-green-700 flex items-center gap-1"><Plus className="w-3.5 h-3.5" /> Add time phase</button>
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <ListBox title="Expected progress" tone="green" items={d.expected_progress} disabled={!editable} onChange={(v) => setDef({ expected_progress: v })} />
        <ListBox title="Escalation pathway" tone="blue" items={d.escalation} disabled={!editable} onChange={(v) => setDef({ escalation: v })} />
        <ListBox title="Amber — warning signs" tone="amber" items={d.amber_triggers} disabled={!editable} onChange={(v) => setDef({ amber_triggers: v })} />
        <ListBox title="Red — urgent signs" tone="red" items={d.red_triggers} disabled={!editable} onChange={(v) => setDef({ red_triggers: v })} />
      </div>

      {/* Sources */}
      <div className="bg-white border rounded-lg p-4">
        <h3 className="font-semibold text-gray-900 mb-1 flex items-center gap-1"><BookOpen className="w-4 h-4" /> Sources</h3>
        <p className="text-xs text-gray-500 mb-2">Tick “verified” only after checking the citation and that the protocol matches it. Draft citations are unverified.</p>
        <div className="space-y-2">
          {form.sources.map((s, i) => (
            <div key={i} className="flex flex-wrap gap-2 items-start border rounded p-2">
              <textarea rows={2} value={s.citation} disabled={!editable} placeholder="Citation"
                onChange={(e) => setForm({ ...form, sources: form.sources.map((x, j) => (j === i ? { ...x, citation: e.target.value } : x)) })}
                className="flex-1 min-w-[260px] border rounded px-2 py-1 text-xs" />
              <textarea rows={2} value={s.note} disabled={!editable} placeholder="What it supports"
                onChange={(e) => setForm({ ...form, sources: form.sources.map((x, j) => (j === i ? { ...x, note: e.target.value } : x)) })}
                className="flex-1 min-w-[200px] border rounded px-2 py-1 text-xs" />
              <label className={`text-xs flex items-center gap-1 px-2 py-1 rounded ${s.verified ? 'bg-green-50 text-green-800' : 'bg-amber-50 text-amber-800'}`}>
                <input type="checkbox" checked={s.verified} disabled={!editable}
                  onChange={(e) => setForm({ ...form, sources: form.sources.map((x, j) => (j === i ? { ...x, verified: e.target.checked } : x)) })} />
                Verified
              </label>
              {editable && <button onClick={() => setForm({ ...form, sources: form.sources.filter((_, j) => j !== i) })} className="text-gray-400 hover:text-red-600"><Trash2 className="w-3.5 h-3.5" /></button>}
            </div>
          ))}
          {editable && <button onClick={() => setForm({ ...form, sources: [...form.sources, { citation: '', note: '', verified: false }] })} className="text-xs text-green-700 flex items-center gap-1"><Plus className="w-3.5 h-3.5" /> Add source</button>}
        </div>
      </div>

      {/* Save / approve */}
      <div className="bg-white border rounded-lg p-4 flex flex-wrap items-end gap-3 sticky bottom-2 shadow-sm">
        {editable && (
          <>
            <label className="flex-1 min-w-[240px] text-sm">
              <span className="text-xs text-gray-600">What changed (kept with the version)</span>
              <input value={changeNote} onChange={(e) => setChangeNote(e.target.value)} className="mt-1 w-full border border-gray-300 rounded px-2 py-1.5 text-sm" />
            </label>
            <button onClick={saveVersion} disabled={busy || !dirty}
              className="px-4 py-2 bg-green-600 text-white rounded-lg text-sm font-medium hover:bg-green-700 disabled:opacity-50 flex items-center gap-2">
              {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />} Save as version {latest.version + 1}
            </button>
          </>
        )}
        {meta.can_approve_content && latest.approval_status !== 'approved' && (
          <button onClick={() => approve(latest.version)} disabled={busy || dirty} title={dirty ? 'Save your changes first' : ''}
            className="px-4 py-2 bg-gray-900 text-white rounded-lg text-sm font-medium hover:bg-black disabled:opacity-50 flex items-center gap-2">
            <BadgeCheck className="w-4 h-4" /> Approve version {latest.version}
          </button>
        )}
        {!editable && !meta.can_approve_content && <p className="text-xs text-gray-500">Read only. Consultants and senior registrars can edit; approvers named in D1 can approve.</p>}
      </div>
      {msg && <Banner kind={msg.ok ? 'ok' : 'error'}>{msg.text}</Banner>}

      {/* Versions */}
      <div className="bg-white border rounded-lg p-4">
        <h3 className="font-semibold text-gray-900 mb-2 flex items-center gap-1"><History className="w-4 h-4" /> Versions</h3>
        <ul className="text-xs divide-y">
          {versions!.map(v => (
            <li key={v.version} className="py-1.5 flex flex-wrap items-center gap-2">
              <span className="font-mono">v{v.version}</span>
              <span className={`px-1.5 rounded ${v.approval_status === 'approved' ? 'bg-green-100 text-green-800' : v.approval_status === 'retired' ? 'bg-gray-100 text-gray-500' : 'bg-amber-50 text-amber-800'}`}>{v.approval_status}</span>
              <span className="text-gray-500">{new Date(v.created_at).toLocaleString()} · {v.created_by_name || '—'}</span>
              {v.approved_at && <span className="text-green-700">approved {new Date(v.approved_at).toLocaleDateString()} by {v.approved_by_name}</span>}
              {v.change_note && <span className="text-gray-600">“{v.change_note}”</span>}
              <span className="font-mono text-gray-400" title="Content fingerprint (SHA-256)">#{v.content_hash.slice(0, 10)}</span>
              {meta.can_approve_content && v.approval_status === 'approved' && (
                <button onClick={() => withdraw(v.version)} className="text-gray-500 hover:text-red-600 flex items-center gap-0.5"><Undo2 className="w-3 h-3" /> withdraw</button>
              )}
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

// ── Small pieces ────────────────────────────────────────────────────────
function ListBox({ title, tone, items, disabled, onChange }: { title: string; tone: 'green' | 'amber' | 'red' | 'blue'; items: string[]; disabled: boolean; onChange: (v: string[]) => void }) {
  const colour = { green: 'border-green-300', amber: 'border-amber-300', red: 'border-red-300', blue: 'border-blue-300' }[tone];
  return (
    <div className={`bg-white border-l-4 ${colour} border rounded-lg p-3`}>
      <h3 className="font-semibold text-gray-900 text-sm mb-1">{title}</h3>
      <p className="text-[11px] text-gray-500 mb-1">One item per line.</p>
      <textarea rows={Math.max(4, items.length + 1)} disabled={disabled} value={items.join('\n')}
        onChange={(e) => onChange(e.target.value.split('\n'))}
        onBlur={(e) => onChange(e.target.value.split('\n').map(s => s.trim()).filter(Boolean))}
        className="w-full border rounded px-2 py-1 text-xs" />
    </div>
  );
}

function Field({ label, value, onChange, disabled, rows = 2 }: { label: string; value: string; onChange: (v: string) => void; disabled: boolean; rows?: number }) {
  return (
    <label className="block">
      <span className="text-xs text-gray-600">{label}</span>
      <textarea rows={rows} value={value} disabled={disabled} onChange={(e) => onChange(e.target.value)} className="mt-1 w-full border border-gray-300 rounded px-2 py-1.5 text-sm" />
    </label>
  );
}

function Banner({ kind, children }: { kind: 'ok' | 'error' | 'info'; children: React.ReactNode }) {
  const cls = kind === 'ok' ? 'bg-green-50 border-green-200 text-green-800' : kind === 'error' ? 'bg-red-50 border-red-200 text-red-800' : 'bg-blue-50 border-blue-200 text-blue-900';
  const Icon = kind === 'ok' ? CheckCircle2 : AlertTriangle;
  return <div className={`border rounded-lg p-3 text-sm flex items-start gap-2 ${cls}`}><Icon className="w-4 h-4 mt-0.5 flex-shrink-0" /><div>{children}</div></div>;
}

function Loading() {
  return <div className="py-10 text-center text-gray-500"><Loader2 className="w-6 h-6 animate-spin mx-auto" /></div>;
}
