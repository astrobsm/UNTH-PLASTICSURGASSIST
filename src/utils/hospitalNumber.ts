/**
 * Patient (hospital) numbers: one written form (PT-12345) and one matching
 * key (case, spaces and punctuation ignored). Mirrors api/_lib/hospitalNumber.js
 * — a test checks the two agree.
 */

const PT_FORM = /^P\s*T[\s\-_/.:]*(\d{1,10})$/i;

export function normalizeHospitalNumber(raw: unknown): string {
  if (raw === null || raw === undefined) return '';
  const s = String(raw).trim().replace(/\s+/g, ' ');
  if (!s) return '';
  const m = PT_FORM.exec(s);
  if (m) return `PT-${m[1]}`;
  if (/^\d{1,10}$/.test(s)) return `PT-${s}`;
  return s.toUpperCase().replace(/\s*([-/])\s*/g, '$1');
}

export function hospitalNumberKey(raw: unknown): string {
  return normalizeHospitalNumber(raw).toUpperCase().replace(/[^A-Z0-9]/g, '');
}

export function isPtFormat(raw: unknown): boolean {
  return /^PT-\d{1,10}$/.test(normalizeHospitalNumber(raw));
}

/** A patient on this device with the same number (case and punctuation ignored). */
export async function findLocalPatientByHospitalNumber(raw: unknown): Promise<any | null> {
  const key = hospitalNumberKey(raw);
  if (!key) return null;
  try {
    const { db } = await import('../db/database');
    const all = await db.patients.toArray();
    return all.find((p: any) => p.deleted !== true && hospitalNumberKey(p.hospital_number) === key) || null;
  } catch { return null; }
}
