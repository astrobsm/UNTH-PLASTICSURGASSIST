/**
 * useSelectedPatient
 * ------------------
 * Reads the "currently-selected patient" context that the Patients listing
 * sets when a clinician picks an action from the per-patient dropdown.
 *
 * Lookup order (first non-empty wins):
 *   1. `?patientId=` / `?patient=` query param + DB fetch
 *   2. localStorage `selectedPatient` (set by Patients.tsx action menu)
 *
 * The hook returns the resolved Patient (or null while loading / not found)
 * plus a `clear()` helper for pages that want to release the context after
 * the user navigates away.
 */
import { useEffect, useState, useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';
import { db, type Patient } from '../db/database';
import patientService from '../services/patientService';

interface CachedSelectedPatient {
  id: number | string;
  first_name?: string;
  last_name?: string;
  full_name?: string;
  hospital_number?: string;
  date_of_birth?: string;
  gender?: string;
  phone?: string;
  selectedAt?: string;
}

const STORAGE_KEY = 'selectedPatient';

export function readSelectedPatientFromStorage(): CachedSelectedPatient | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as CachedSelectedPatient;
  } catch {
    return null;
  }
}

export function clearSelectedPatient(): void {
  try { localStorage.removeItem(STORAGE_KEY); } catch { /* ignore */ }
}

export function useSelectedPatient(): {
  patient: Patient | null;
  patientId: string | null;
  loading: boolean;
  clear: () => void;
} {
  const [searchParams] = useSearchParams();
  const queryId = searchParams.get('patientId') || searchParams.get('patient');
  const [patient, setPatient] = useState<Patient | null>(null);
  const [loading, setLoading] = useState<boolean>(!!queryId);

  useEffect(() => {
    let cancelled = false;
    async function resolve() {
      // 1. Query param wins — try local DB then API
      if (queryId) {
        setLoading(true);
        try {
          const numId = Number(queryId);
          let p: Patient | undefined;
          if (!Number.isNaN(numId)) {
            p = await db.patients.get(numId);
          }
          if (!p) {
            try { p = await patientService.getPatientById(queryId as any); } catch { /* ignore */ }
          }
          if (!cancelled && p) {
            setPatient(p);
            setLoading(false);
            return;
          }
        } catch { /* fall through to storage */ }
      }
      // 2. Fall back to localStorage cache
      const cached = readSelectedPatientFromStorage();
      if (cached && !cancelled) {
        setPatient(cached as unknown as Patient);
      }
      if (!cancelled) setLoading(false);
    }
    resolve();
    return () => { cancelled = true; };
  }, [queryId]);

  const clear = useCallback(() => {
    clearSelectedPatient();
    setPatient(null);
  }, []);

  return { patient, patientId: queryId, loading, clear };
}
