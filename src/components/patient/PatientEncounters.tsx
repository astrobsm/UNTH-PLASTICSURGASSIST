import React, { useState, useEffect, useCallback, useRef } from 'react';
import { db } from '../../db/database';
import { apiClient } from '../../services/apiClient';
import { useAuthStore } from '../../store/authStore';
import { RefreshCw } from 'lucide-react';
import { DocumenterLink, ConsultantCommentSection } from '../ClinicalInteractionComponents';
import { MultiPageScanUploader, ScannedPage } from '../MultiPageScanUploader';

interface Encounter {
  id: number | string;
  type: string;
  title: string;
  content: string;
  date: string;
  created_by_name?: string;
  created_by_role?: string;
}

interface PatientEncountersProps {
  patientId: string;
  hospitalNumber: string;
  patientName: string;
}

export const PatientEncounters: React.FC<PatientEncountersProps> = ({ patientId, hospitalNumber, patientName }) => {
  const { user } = useAuthStore();
  const [encounters, setEncounters] = useState<Encounter[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [showNewEncounter, setShowNewEncounter] = useState(false);
  const [newEncounter, setNewEncounter] = useState({ type: 'progress_note', title: '', content: '' });
  const [encounterPages, setEncounterPages] = useState<ScannedPage[]>([]);
  const [saving, setSaving] = useState(false);
  const mountedRef = useRef(true);

  /** Extract displayable content from a progress note (handles SOAP & plain formats) */
  const extractNoteContent = (n: any): string => {
    if (n.content) return n.content;
    if (n.note) return n.note;
    // SOAP note format from ProgressNoteModal
    if (n.soap && typeof n.soap === 'object') {
      const soap = typeof n.soap === 'string' ? JSON.parse(n.soap) : n.soap;
      const parts: string[] = [];
      if (soap.subjective) parts.push(`S: ${soap.subjective}`);
      if (soap.objective) parts.push(`O: ${soap.objective}`);
      if (soap.assessment) parts.push(`A: ${soap.assessment}`);
      if (soap.plan) parts.push(`P: ${soap.plan}`);
      if (soap.note) parts.push(soap.note);
      if (parts.length > 0) return parts.join(' | ');
    }
    if (n.subjective) return `S: ${n.subjective}`;
    return '';
  };

  /** Deduplicate encounters by server id or unique composite key */
  const dedup = (items: Encounter[]): Encounter[] => {
    const seen = new Set<string>();
    return items.filter((e) => {
      const key = String(e.id);
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  };

  const loadEncounters = useCallback(async (showSpinner = true) => {
    if (showSpinner) setLoading(true);
    else setRefreshing(true);

    try {
      const allEncounters: Encounter[] = [];
      const pid = Number(patientId) || patientId;

      // ─── Fetch from SERVER first (if online) ──────────────────────
      if (navigator.onLine) {
        try {
          // Progress Notes from server
          const notesResp = await apiClient.request(`/progress-notes?patientId=${pid}`);
          const serverNotes: any[] = notesResp?.notes || (Array.isArray(notesResp) ? notesResp : []);
          for (const n of serverNotes) {
            allEncounters.push({
              id: `note-${n.id}`, type: 'Progress Note',
              title: n.title || 'Progress Note',
              content: extractNoteContent(n),
              date: n.created_at || n.date || '',
              created_by_name: n.author || n.created_by_name || '',
              created_by_role: n.author_role || n.created_by_role || ''
            });
            // Also upsert into IndexedDB for offline use
            try { if (db.progress_notes) await db.progress_notes.put({ ...n, synced: true }); } catch { /* ok */ }
          }
        } catch { /* offline or error – will fall back to IndexedDB below */ }

        try {
          // Admissions from server
          const admResp = await apiClient.request(`/admissions?patientId=${pid}`);
          const serverAdm: any[] = admResp?.admissions || (Array.isArray(admResp) ? admResp : []);
          for (const a of serverAdm) {
            allEncounters.push({
              id: `adm-${a.id}`, type: 'Admission',
              title: `Admission - ${a.admitting_diagnosis || a.primary_diagnosis || 'General'}`,
              content: a.notes || a.presenting_complaint || `Ward: ${a.ward || 'N/A'}, Bed: ${a.bed_number || 'N/A'}`,
              date: a.admission_date || a.created_at || '',
              created_by_name: a.admitting_doctor || a.created_by_name || '',
              created_by_role: 'Doctor'
            });
          }
        } catch { /* ok */ }

        try {
          // Prescriptions from server
          const rxResp = await apiClient.request(`/prescriptions?patientId=${pid}`);
          const serverRx: any[] = rxResp?.prescriptions || (Array.isArray(rxResp) ? rxResp : []);
          for (const p of serverRx) {
            allEncounters.push({
              id: `rx-${p.id}`, type: 'Prescription',
              title: `Rx: ${p.medication_name || p.drug_name || 'Medication'}`,
              content: `${p.dosage || ''} ${p.frequency || ''} ${p.duration || ''} ${p.route || ''}`.trim(),
              date: p.prescribed_at || p.created_at || '',
              created_by_name: p.prescribed_by_name || p.prescribed_by || '',
              created_by_role: 'Doctor'
            });
          }
        } catch { /* ok */ }

        try {
          // Ward Rounds from server
          const wrResp = await apiClient.request(`/ward-rounds?patientId=${pid}`);
          const serverWR: any[] = wrResp?.rounds || wrResp?.wardRounds || (Array.isArray(wrResp) ? wrResp : []);
          for (const r of serverWR) {
            allEncounters.push({
              id: `round-${r.id}`, type: 'Ward Round',
              title: `Ward Round - ${r.round_type || 'General'}`,
              content: r.notes || r.assessment || r.plan || '',
              date: r.round_date || r.created_at || '',
              created_by_name: r.led_by || r.created_by_name || '',
              created_by_role: r.created_by_role || 'Doctor'
            });
          }
        } catch { /* ok */ }

        try {
          // Surgeries from server
          const surgResp = await apiClient.request(`/surgeries?patientId=${pid}`);
          const serverSurg: any[] = surgResp?.surgeries || (Array.isArray(surgResp) ? surgResp : []);
          for (const s of serverSurg) {
            allEncounters.push({
              id: `surg-${s.id}`, type: 'Surgery',
              title: `Surgery: ${s.procedure_name || s.procedure || 'Procedure'}`,
              content: s.notes || s.findings || '',
              date: s.surgery_date || s.scheduled_date || s.created_at || '',
              created_by_name: s.surgeon || s.lead_surgeon || '',
              created_by_role: 'Surgeon'
            });
          }
        } catch { /* ok */ }

        try {
          // Discharge summaries from server
          const disResp = await apiClient.request(`/discharge-summaries?patientId=${pid}`);
          const serverDis: any[] = disResp?.discharges || (Array.isArray(disResp) ? disResp : []);
          for (const d of serverDis) {
            allEncounters.push({
              id: `dis-${d.id}`, type: 'Discharge', title: 'Discharge Summary',
              content: d.summary || d.discharge_diagnosis || '',
              date: d.discharge_date || d.created_at || '',
              created_by_name: d.prepared_by || '',
              created_by_role: 'Doctor'
            });
          }
        } catch { /* ok */ }
      }

      // ─── Fallback / supplement from IndexedDB ──────────────────────
      // Always merge local data (it may contain unsynced local entries)

      // Progress Notes from IndexedDB
      try {
        const notes = await db.progress_notes?.where('patient_id').equals(pid).toArray() || [];
        for (const n of notes) {
          allEncounters.push({
            id: `note-${n.id}`, type: 'Progress Note',
            title: (n as any).title || 'Progress Note',
            content: extractNoteContent(n),
            date: (n as any).created_at || (n as any).date || '',
            created_by_name: (n as any).author || (n as any).created_by_name || '',
            created_by_role: (n as any).author_role || (n as any).created_by_role || ''
          });
        }
      } catch { /* empty */ }

      // Ward Rounds
      try {
        const rounds = await db.ward_rounds?.toArray() || [];
        const patientRounds = rounds.filter((r: any) =>
          String(r.patient_id) === String(patientId) || String(r.hospital_number) === hospitalNumber
        );
        for (const r of patientRounds as any[]) {
          allEncounters.push({
            id: `round-${r.id}`, type: 'Ward Round', title: `Ward Round - ${r.round_type || 'General'}`,
            content: r.notes || r.assessment || r.plan || '',
            date: r.round_date || r.created_at || '', created_by_name: r.led_by || r.created_by_name || '',
            created_by_role: r.created_by_role || 'Doctor'
          });
        }
      } catch { /* empty */ }

      // Admissions
      try {
        const admissions = await db.admissions?.toArray() || [];
        const patientAdm = admissions.filter((a: any) =>
          String(a.patient_id) === String(patientId) || String(a.hospital_number) === hospitalNumber
        );
        for (const a of patientAdm as any[]) {
          allEncounters.push({
            id: `adm-${a.id}`, type: 'Admission', title: `Admission - ${a.admitting_diagnosis || 'General'}`,
            content: a.notes || `Ward: ${a.ward || 'N/A'}, Bed: ${a.bed_number || 'N/A'}`,
            date: a.admission_date || a.created_at || '', created_by_name: a.admitting_doctor || a.created_by_name || '',
            created_by_role: 'Doctor'
          });
        }
      } catch { /* empty */ }

      // Discharge Summaries
      try {
        const discharges = await (db as any).discharge_summaries?.toArray() || [];
        const patientDis = discharges.filter((d: any) =>
          String(d.patient_id) === String(patientId) || String(d.hospital_number) === hospitalNumber
        );
        for (const d of patientDis as any[]) {
          allEncounters.push({
            id: `dis-${d.id}`, type: 'Discharge', title: 'Discharge Summary',
            content: d.summary || d.discharge_diagnosis || '',
            date: d.discharge_date || d.created_at || '', created_by_name: d.prepared_by || '',
            created_by_role: 'Doctor'
          });
        }
      } catch { /* empty */ }

      // Prescriptions
      try {
        const prescriptions = await db.prescriptions?.where('patient_id').equals(pid).toArray() || [];
        for (const p of prescriptions as any[]) {
          allEncounters.push({
            id: `rx-${p.id}`, type: 'Prescription', title: `Rx: ${p.medication_name || p.drug_name || 'Medication'}`,
            content: `${p.dosage || ''} ${p.frequency || ''} ${p.duration || ''} ${p.route || ''}`.trim(),
            date: p.prescribed_at || p.created_at || '', created_by_name: p.prescribed_by_name || p.prescribed_by || '',
            created_by_role: 'Doctor'
          });
        }
      } catch { /* empty */ }

      // Surgeries
      try {
        const surgeries = await db.surgery_bookings?.toArray() || [];
        const patientSurg = surgeries.filter((s: any) =>
          String(s.patient_id) === String(patientId) || String(s.hospital_number) === hospitalNumber
        );
        for (const s of patientSurg as any[]) {
          allEncounters.push({
            id: `surg-${s.id}`, type: 'Surgery', title: `Surgery: ${s.procedure_name || s.procedure || 'Procedure'}`,
            content: s.notes || s.findings || '',
            date: s.surgery_date || s.scheduled_date || s.created_at || '',
            created_by_name: s.surgeon || s.lead_surgeon || '', created_by_role: 'Surgeon'
          });
        }
      } catch { /* empty */ }

      // Deduplicate (server + local may overlap), then sort newest first
      const unique = dedup(allEncounters);
      unique.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
      if (mountedRef.current) setEncounters(unique);
    } catch (err) {
      console.error('Error loading encounters:', err);
    } finally {
      if (mountedRef.current) {
        setLoading(false);
        setRefreshing(false);
      }
    }
  }, [patientId, hospitalNumber]);

  // Load on mount + refresh on visibility change (user returns to tab / opens app)
  useEffect(() => {
    mountedRef.current = true;
    loadEncounters();

    const handleVisibility = () => {
      if (document.visibilityState === 'visible' && mountedRef.current) {
        loadEncounters(false); // silent refresh
      }
    };
    const handleOnline = () => { if (mountedRef.current) loadEncounters(false); };

    document.addEventListener('visibilitychange', handleVisibility);
    window.addEventListener('online', handleOnline);

    return () => {
      mountedRef.current = false;
      document.removeEventListener('visibilitychange', handleVisibility);
      window.removeEventListener('online', handleOnline);
    };
  }, [patientId, loadEncounters]);

  const handleSaveEncounter = async () => {
    if (!newEncounter.content.trim()) return;
    setSaving(true);
    try {
      const attachments = encounterPages.map((p, i) => ({
        id: p.id,
        index: i + 1,
        caption: p.caption || p.name || `Page ${i + 1}`,
        dataUrl: p.dataUrl,
        ocrText: p.ocrText || ''
      }));

      const note: any = {
        patient_id: Number(patientId),
        hospital_number: hospitalNumber,
        title: newEncounter.title || newEncounter.type.replace('_', ' '),
        content: newEncounter.content,
        note: newEncounter.content,
        type: newEncounter.type,
        author: user?.name || 'Unknown',
        author_role: user?.role || 'house_officer',
        created_by: user?.id,
        created_by_name: user?.name || 'Unknown',
        created_by_role: user?.role || 'house_officer',
        created_at: new Date().toISOString(),
        date: new Date().toISOString(),
        attachments,
        page_count: attachments.length
      };

      // Try API first
      try {
        await apiClient.request('/progress-notes', { method: 'POST', body: JSON.stringify(note) });
      } catch {
        // Fallback to IndexedDB
        await db.progress_notes?.add(note);
      }

      setShowNewEncounter(false);
      setNewEncounter({ type: 'progress_note', title: '', content: '' });
      setEncounterPages([]);
      loadEncounters();
    } catch (err) {
      console.error('Error saving encounter:', err);
      alert('Failed to save encounter');
    } finally {
      setSaving(false);
    }
  };

  const getTypeColor = (type: string) => {
    const colors: Record<string, string> = {
      'Progress Note': 'bg-purple-100 text-purple-800',
      'Ward Round': 'bg-blue-100 text-blue-800',
      'Admission': 'bg-green-100 text-green-800',
      'Discharge': 'bg-orange-100 text-orange-800',
      'Prescription': 'bg-yellow-100 text-yellow-800',
      'Surgery': 'bg-red-100 text-red-800',
    };
    return colors[type] || 'bg-gray-100 text-gray-800';
  };

  const formatDateTime = (dateStr: string) => {
    if (!dateStr) return 'N/A';
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return dateStr;
    return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }) +
      ' at ' + d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
  };

  if (loading) {
    return (
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-8">
        <div className="animate-pulse space-y-4">
          <div className="h-6 bg-gray-200 rounded w-1/3"></div>
          <div className="h-4 bg-gray-200 rounded"></div>
          <div className="h-4 bg-gray-200 rounded w-2/3"></div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200">
        <div className="px-4 sm:px-6 py-4 border-b border-gray-200 flex items-center justify-between">
          <div>
            <h3 className="text-lg font-semibold text-gray-900">Patient Encounters</h3>
            <p className="text-sm text-gray-500 mt-1">
              All clinical documentation for {patientName} ({encounters.length} records)
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => loadEncounters(false)}
              disabled={refreshing}
              className="p-2 text-gray-500 hover:text-green-600 hover:bg-gray-100 rounded-lg transition-colors disabled:opacity-50"
              title="Refresh encounters"
            >
              <RefreshCw className={`w-5 h-5 ${refreshing ? 'animate-spin' : ''}`} />
            </button>
            <button
              onClick={() => setShowNewEncounter(true)}
              className="px-4 py-2 bg-green-600 text-white text-sm font-medium rounded-lg hover:bg-green-700 transition-colors"
            >
              + New Encounter
            </button>
          </div>
        </div>
      </div>

      {/* New Encounter Form */}
      {showNewEncounter && (
        <div className="bg-white rounded-lg shadow-sm border border-green-200 p-4 sm:p-6">
          <h4 className="text-md font-semibold text-gray-900 mb-4">New Encounter</h4>
          <div className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Encounter Type</label>
                <select
                  value={newEncounter.type}
                  onChange={(e) => setNewEncounter({ ...newEncounter, type: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-green-500 focus:border-green-500"
                >
                  <option value="progress_note">Progress Note</option>
                  <option value="consultation">Consultation</option>
                  <option value="review">Review</option>
                  <option value="procedure_note">Procedure Note</option>
                  <option value="follow_up">Follow-up</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Title</label>
                <input
                  type="text"
                  value={newEncounter.title}
                  onChange={(e) => setNewEncounter({ ...newEncounter, title: e.target.value })}
                  placeholder="Brief encounter title"
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-green-500 focus:border-green-500"
                />
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Clinical Notes</label>
              <textarea
                value={newEncounter.content}
                onChange={(e) => setNewEncounter({ ...newEncounter, content: e.target.value })}
                rows={6}
                placeholder="Enter clinical documentation, or scan handwritten pages below and tap 'OCR' to auto-fill..."
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-green-500 focus:border-green-500"
              />
            </div>

            {/* Multi-page scanner / uploader */}
            <div className="border border-gray-200 rounded-lg p-3 bg-gray-50">
              <MultiPageScanUploader
                pages={encounterPages}
                onChange={setEncounterPages}
                enableOCR
                documentType="medical_form"
                label="Attach scanned pages (optional)"
                helper="Capture or upload handwritten notes, charts or referral letters. Tap OCR to auto-append the extracted text."
                onOCRComplete={(text) => {
                  setNewEncounter((prev) => ({
                    ...prev,
                    content: prev.content
                      ? `${prev.content}\n\n[Scanned pages OCR]\n${text}`
                      : `[Scanned pages OCR]\n${text}`
                  }));
                }}
              />
            </div>

            <div className="flex items-center gap-2 text-xs text-gray-500">
              <span>Documenting as: <strong>{user?.name || 'Unknown'}</strong> ({user?.role || 'N/A'})</span>
              <span>|</span>
              <span>{new Date().toLocaleString()}</span>
            </div>
            <div className="flex justify-end gap-3">
              <button onClick={() => { setShowNewEncounter(false); setEncounterPages([]); }} className="px-4 py-2 text-gray-700 border border-gray-300 rounded-md hover:bg-gray-50">Cancel</button>
              <button onClick={handleSaveEncounter} disabled={saving || !newEncounter.content.trim()} className="px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 disabled:opacity-50">
                {saving ? 'Saving...' : 'Save Encounter'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Encounters List */}
      {encounters.length === 0 ? (
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-8 text-center">
          <div className="text-gray-400 text-4xl mb-3">📋</div>
          <h4 className="text-lg font-medium text-gray-900 mb-2">No Encounters Yet</h4>
          <p className="text-gray-500">Clinical encounters will appear here as they are documented.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {encounters.map((enc) => (
            <div key={enc.id} className="bg-white rounded-lg shadow-sm border border-gray-200 p-4 hover:border-green-300 transition-colors">
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1 flex-wrap">
                    <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${getTypeColor(enc.type)}`}>
                      {enc.type}
                    </span>
                    <span className="text-sm font-semibold text-gray-900">{enc.title}</span>
                  </div>
                  <p className="text-sm text-gray-600 line-clamp-2">{enc.content}</p>
                  <div className="flex items-center gap-3 mt-2 text-xs text-gray-400">
                    <span>📅 {formatDateTime(enc.date)}</span>
                    {enc.created_by_name && (
                      <DocumenterLink
                        authorName={enc.created_by_name}
                        authorRole={enc.created_by_role}
                        patientName={patientName}
                        patientHospitalNumber={hospitalNumber}
                        context={`${enc.type} - ${enc.title}`}
                      />
                    )}
                  </div>
                  <ConsultantCommentSection
                    entityType="encounter"
                    entityId={String(enc.id)}
                    patientName={patientName}
                  />
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
