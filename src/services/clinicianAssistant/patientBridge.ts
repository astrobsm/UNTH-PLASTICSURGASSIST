/**
 * Bridge between this app's patient record and the diagnostic engine.
 *
 * The engine was written for a standalone tool that read everything off a
 * scanned page. Here the same values already exist in Postgres — investigation
 * results, vital signs, demographics — so the scan becomes optional and the
 * record becomes the primary source.
 *
 * MAPPING IS NOT INVENTED. Test names coming out of investigation_uploads are
 * matched to canonical analyte keys using the engine's OWN synonym dictionary
 * (ANALYTES[].synonyms) and its own unit normaliser (toCanonical). Writing a
 * second mapping table here would be a duplicate that silently drifts from the
 * one the parsers use, so anything the engine cannot recognise is reported as
 * unmapped rather than guessed at.
 */

import { apiClient } from '../apiClient';
import { resolvePercentages } from './parse/labParser';
import { toAnalyte, toPercentage, isPercentageResult, type UnmappedResult, type PercentageResult } from './analyteMapping';
import { emptyExtraction, type Extraction } from './engine/context';
import { emptyPatient, type PatientContext, type Observation, type Sex } from './engine/types';

export type { UnmappedResult };

export interface BridgeResult {
  patient: PatientContext;
  extraction: Extraction;
  /** Results the engine could not recognise — shown to the clinician, never dropped silently. */
  unmapped: UnmappedResult[];
  sources: { investigations: number; vitals: number };
}

const sexFrom = (gender: unknown): Sex => {
  const g = String(gender || '').toLowerCase();
  if (g.startsWith('m')) return 'male';
  if (g.startsWith('f')) return 'female';
  return 'unspecified';
};

function ageFrom(dateOfBirth: unknown): number | null {
  if (!dateOfBirth) return null;
  const dob = new Date(String(dateOfBirth));
  if (Number.isNaN(dob.getTime())) return null;
  const now = new Date();
  let age = now.getFullYear() - dob.getFullYear();
  const m = now.getMonth() - dob.getMonth();
  if (m < 0 || (m === 0 && now.getDate() < dob.getDate())) age--;
  return age >= 0 && age < 130 ? age : null;
}

/**
 * Vital signs the engine can correlate against laboratory findings — fever
 * driving an infective interpretation, hypoxia driving a respiratory one.
 */
function vitalsToObservations(v: any): Observation[] {
  const out: Observation[] = [];
  // Observation.value is a string: the type carries qualitative findings
  // ("clear", "growth") as well as numeric ones, so the unit travels in the
  // value text rather than a separate field.
  const add = (key: string, label: string, value: unknown, unit: string) => {
    const n = typeof value === 'number' ? value : parseFloat(String(value ?? ''));
    if (Number.isFinite(n)) {
      out.push({
        key,
        label,
        value: String(n),
        rawText: `${n} ${unit}`,
        confidence: 1,
        edited: false,
      });
    }
  };
  add('temperature', 'Temperature', v?.temperature, '°C');
  add('pulse', 'Pulse', v?.pulse, 'bpm');
  add('sbp', 'Systolic BP', v?.bp_systolic, 'mmHg');
  add('dbp', 'Diastolic BP', v?.bp_diastolic, 'mmHg');
  add('rr', 'Respiratory rate', v?.respiratory_rate, '/min');
  add('spo2', 'SpO2', v?.spo2, '%');
  return out;
}

/**
 * Assemble everything the engine needs for one patient, straight from the
 * database. Each fetch degrades independently: a patient with no recorded
 * investigations still yields a valid context, and the UI reports what was
 * found rather than failing the whole analysis.
 */
export async function buildFromPatientRecord(patientId: string | number): Promise<BridgeResult> {
  const id = encodeURIComponent(String(patientId));

  const [patientRow, uploads, vitals] = await Promise.all([
    apiClient.get(`/patients/${id}`).catch(() => null),
    apiClient.get(`/investigation-uploads?patientId=${id}`).catch(() => null),
    apiClient.get(`/vital-signs?patientId=${id}`).catch(() => null),
  ]);

  const p: any = (patientRow as any)?.patient || patientRow || {};
  const patient: PatientContext = {
    ...emptyPatient(),
    name: [p.first_name, p.last_name].filter(Boolean).join(' ').trim(),
    hospitalNumber: p.hospital_number || '',
    age: ageFrom(p.date_of_birth),
    sex: sexFrom(p.gender),
    weightKg: Number.isFinite(Number(p.weight)) ? Number(p.weight) : null,
    heightCm: Number.isFinite(Number(p.height)) ? Number(p.height) : null,
    ward: p.ward || '',
    diagnosis: p.primary_diagnosis || '',
    collectedAt: new Date().toISOString(),
  };

  const extraction: Extraction = emptyExtraction();
  const unmapped: UnmappedResult[] = [];
  const percentages: PercentageResult[] = [];

  // ── Investigation results ──
  const uploadRows: any[] = (uploads as any)?.uploads || (uploads as any)?.investigations || (Array.isArray(uploads) ? uploads : []);
  let investigationCount = 0;

  for (const row of uploadRows) {
    // Stored as { results: [ { test_name, result_value, unit, ... } ] }.
    const inner: any[] = row?.results?.results || row?.results || [];
    if (!Array.isArray(inner)) continue;

    for (const r of inner) {
      const testName = r?.test_name ?? r?.testName ?? '';
      const value = r?.result_value ?? r?.value ?? '';
      const unit = r?.unit ?? '';
      if (!testName) continue;

      // A differential percentage is not an analyte. Held back and converted
      // to an absolute count below, once the white cell count is known —
      // filing "LYM% 14.36" as a cell count would be a hundredfold error.
      if (isPercentageResult(String(testName), String(unit))) {
        const pct = toPercentage(String(testName), value);
        if (pct) { percentages.push(pct); continue; }
      }

      const { analyte, reason } = toAnalyte(testName, value, unit);
      if (analyte) {
        extraction.analytes.push(analyte);
        investigationCount++;
      } else {
        unmapped.push({ testName: String(testName), value: String(value), unit: String(unit), reason: reason! });
      }
    }
  }

  // ── Differential percentages → absolute counts ──
  // resolvePercentages is the engine's own routine: it derives the absolute
  // count from the white cell count and detects a lost decimal point in the
  // differential. Reusing it keeps one implementation of that logic.
  if (percentages.length) {
    const parseResult = { analytes: extraction.analytes, percentages, observations: extraction.observations };
    const derived = resolvePercentages(parseResult as any, patient, 'patient-record', 1);
    extraction.analytes.push(...derived);
    investigationCount += derived.length;
  }

  // ── Vital signs: most recent set only ──
  const vitalRows: any[] = (vitals as any)?.vitals || (vitals as any)?.vital_signs || (Array.isArray(vitals) ? vitals : []);
  const latestVitals = vitalRows
    .slice()
    .sort((a, b) => new Date(b?.date || b?.created_at || 0).getTime() - new Date(a?.date || a?.created_at || 0).getTime())[0];

  if (latestVitals) {
    extraction.observations.push(...vitalsToObservations(latestVitals));
    // Temperature drives infective correlation rules in the engine.
    const temp = Number(latestVitals.temperature);
    if (Number.isFinite(temp) && temp >= 38) patient.fever = true;
    const wt = Number(latestVitals.weight);
    if (!patient.weightKg && Number.isFinite(wt) && wt > 0) patient.weightKg = wt;
  }

  return {
    patient,
    extraction,
    unmapped,
    sources: { investigations: investigationCount, vitals: latestVitals ? 1 : 0 },
  };
}
