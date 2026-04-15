/**
 * Offline Search Service
 *
 * Provides full-text-like search across IndexedDB when the device is offline
 * (or as a fast local-first complement to server search when online).
 *
 * Searches patient records, admissions, prescriptions, progress notes,
 * treatment plans, surgery bookings, and ward rounds — all from Dexie.
 */

import { db } from '../db/database';

// ── Result types ─────────────────────────────────────────────────────
export interface SearchResult {
  type: 'patient' | 'admission' | 'prescription' | 'progress_note' | 'treatment_plan' | 'surgery' | 'ward_round' | 'lab';
  id: number;
  patientId?: number | string;
  title: string;
  subtitle: string;
  matchedField: string;
  timestamp?: Date;
}

// ── Helpers ──────────────────────────────────────────────────────────
function normalize(text: unknown): string {
  return String(text ?? '').toLowerCase().trim();
}

function matches(haystack: unknown, needle: string): boolean {
  return normalize(haystack).includes(needle);
}

// ── Main search function ─────────────────────────────────────────────
export async function offlineSearch(
  query: string,
  options: { limit?: number; types?: SearchResult['type'][] } = {}
): Promise<SearchResult[]> {
  const q = query.toLowerCase().trim();
  if (!q || q.length < 2) return [];

  const limit = options.limit ?? 50;
  const searchTypes = options.types ?? [
    'patient', 'admission', 'prescription', 'progress_note',
    'treatment_plan', 'surgery', 'ward_round', 'lab',
  ];

  const results: SearchResult[] = [];

  // Utility to push results and short-circuit if limit reached
  const push = (r: SearchResult) => { if (results.length < limit) results.push(r); };
  const full = () => results.length >= limit;

  // ── Patients ────────────────────────────────────────────────────
  if (searchTypes.includes('patient') && !full()) {
    try {
      const patients = await db.patients.filter(p =>
        !p.deleted &&
        (matches(p.first_name, q) ||
         matches(p.last_name, q) ||
         matches(p.hospital_number, q) ||
         matches(p.full_name, q) ||
         matches(p.phone, q) ||
         matches(p.email, q))
      ).limit(limit).toArray();

      for (const p of patients) {
        if (full()) break;
        const name = p.full_name || `${p.first_name || ''} ${p.last_name || ''}`.trim();
        const field = matches(p.hospital_number, q) ? 'Hospital #' :
                      matches(p.phone, q) ? 'Phone' :
                      matches(p.email, q) ? 'Email' : 'Name';
        push({ type: 'patient', id: p.id!, title: name, subtitle: `HN: ${p.hospital_number || '—'}`, matchedField: field });
      }
    } catch { /* table may not exist */ }
  }

  // ── Admissions ──────────────────────────────────────────────────
  if (searchTypes.includes('admission') && !full()) {
    try {
      const admissions = await db.admissions.filter((a: any) =>
        !a.deleted &&
        (matches(a.medical_record_number, q) ||
         matches(a.provisional_diagnosis, q) ||
         matches(a.ward_location, q) ||
         matches(a.patient_name, q))
      ).limit(limit).toArray();

      for (const a of admissions) {
        if (full()) break;
        const field = matches(a.provisional_diagnosis, q) ? 'Diagnosis' :
                      matches(a.ward_location, q) ? 'Ward' : 'MRN/Name';
        push({
          type: 'admission', id: a.id!, patientId: a.patient_id,
          title: a.patient_name || `Admission #${a.id}`,
          subtitle: `Ward: ${a.ward_location || '—'} • ${a.provisional_diagnosis || ''}`.slice(0, 80),
          matchedField: field, timestamp: a.admission_date ? new Date(a.admission_date) : undefined,
        });
      }
    } catch { /* */ }
  }

  // ── Prescriptions ──────────────────────────────────────────────
  if (searchTypes.includes('prescription') && !full()) {
    try {
      const rxs = await db.prescriptions.filter((r: any) =>
        !r.deleted &&
        (matches(r.medication_name, q) ||
         matches(r.generic_name, q) ||
         matches(r.notes, q))
      ).limit(limit).toArray();

      for (const r of rxs) {
        if (full()) break;
        push({
          type: 'prescription', id: r.id!, patientId: r.patient_id,
          title: r.medication_name || r.generic_name || 'Prescription',
          subtitle: `${r.dosage || ''} ${r.frequency || ''}`.trim() || '—',
          matchedField: 'Medication', timestamp: r.created_at ? new Date(r.created_at) : undefined,
        });
      }
    } catch { /* */ }
  }

  // ── Progress Notes ─────────────────────────────────────────────
  if (searchTypes.includes('progress_note') && !full()) {
    try {
      const notes = await db.progress_notes.filter((n: any) =>
        !n.deleted &&
        (matches(n.subjective, q) ||
         matches(n.objective, q) ||
         matches(n.assessment, q) ||
         matches(n.plan, q) ||
         matches(n.content, q))
      ).limit(limit).toArray();

      for (const n of notes) {
        if (full()) break;
        const preview = (n.assessment || n.subjective || n.content || '').slice(0, 80);
        push({
          type: 'progress_note', id: n.id!, patientId: n.patient_id,
          title: `Note ${n.id}`, subtitle: preview || '—',
          matchedField: 'SOAP', timestamp: n.created_at ? new Date(n.created_at) : undefined,
        });
      }
    } catch { /* */ }
  }

  // ── Treatment Plans ────────────────────────────────────────────
  if (searchTypes.includes('treatment_plan') && !full()) {
    try {
      const plans = await db.treatment_plans.filter(p =>
        !p.deleted &&
        (matches(p.title, q) ||
         matches(p.diagnosis, q) ||
         matches(p.description, q) ||
         matches(p.patient_name, q))
      ).limit(limit).toArray();

      for (const p of plans) {
        if (full()) break;
        push({
          type: 'treatment_plan', id: p.id!, patientId: p.patient_id,
          title: p.title || 'Treatment Plan',
          subtitle: p.diagnosis || p.description || '—',
          matchedField: matches(p.diagnosis, q) ? 'Diagnosis' : 'Title',
          timestamp: p.created_at ? new Date(p.created_at) : undefined,
        });
      }
    } catch { /* */ }
  }

  // ── Surgery Bookings ───────────────────────────────────────────
  if (searchTypes.includes('surgery') && !full()) {
    try {
      const surgeries = await db.surgery_bookings.filter((s: any) =>
        !s.deleted &&
        (matches(s.procedure_name, q) ||
         matches(s.patient_name, q) ||
         matches(s.surgeon_name, q) ||
         matches(s.notes, q))
      ).limit(limit).toArray();

      for (const s of surgeries) {
        if (full()) break;
        push({
          type: 'surgery', id: s.id!, patientId: s.patient_id,
          title: s.procedure_name || 'Surgery',
          subtitle: `${s.patient_name || ''} • ${s.surgeon_name || ''}`.trim(),
          matchedField: matches(s.procedure_name, q) ? 'Procedure' : 'Name',
          timestamp: s.surgery_date ? new Date(s.surgery_date) : undefined,
        });
      }
    } catch { /* */ }
  }

  // ── Ward Rounds ────────────────────────────────────────────────
  if (searchTypes.includes('ward_round') && !full()) {
    try {
      const rounds = await db.ward_rounds.filter((w: any) =>
        !w.deleted &&
        (matches(w.notes, q) ||
         matches(w.findings, q) ||
         matches(w.instructions, q))
      ).limit(limit).toArray();

      for (const w of rounds) {
        if (full()) break;
        push({
          type: 'ward_round', id: w.id!, patientId: w.patient_id,
          title: `Ward Round ${w.id}`,
          subtitle: (w.notes || w.findings || '').slice(0, 80),
          matchedField: 'Notes',
          timestamp: w.date ? new Date(w.date) : undefined,
        });
      }
    } catch { /* */ }
  }

  // ── Lab Investigations ─────────────────────────────────────────
  if (searchTypes.includes('lab') && !full()) {
    try {
      const labs = await db.lab_investigations.filter((l: any) =>
        !l.deleted &&
        (matches(l.test_name, q) ||
         matches(l.category, q) ||
         matches(l.notes, q))
      ).limit(limit).toArray();

      for (const l of labs) {
        if (full()) break;
        push({
          type: 'lab', id: l.id!, patientId: l.patient_id,
          title: l.test_name || 'Lab Investigation',
          subtitle: `${l.category || ''} • ${l.status || ''}`.trim(),
          matchedField: 'Test', timestamp: l.created_at ? new Date(l.created_at) : undefined,
        });
      }
    } catch { /* */ }
  }

  // Sort by timestamp descending (most recent first)
  results.sort((a, b) => {
    const ta = a.timestamp?.getTime() ?? 0;
    const tb = b.timestamp?.getTime() ?? 0;
    return tb - ta;
  });

  return results;
}
