/**
 * Clinician Assistant — service layer.
 *
 * Runs the diagnostic engine against a patient's record and persists what it
 * produced. The interpretation itself happens HERE, client-side: the engine is
 * pure, so it runs unchanged with no network, which is the condition a ward
 * round actually happens in. The API stores the result; it holds no clinical
 * logic and must not acquire any.
 */

import { apiClient } from '../apiClient';
import { db } from '../../db/database';
import { analyse } from './engine/analyse';
import { buildFromPatientRecord, type BridgeResult, type UnmappedResult } from './patientBridge';
import type { AnalysisResult, PatientContext, Severity } from './engine/types';
import type { Extraction } from './engine/context';

const BASE = '/clinician-assistant';

/**
 * Bumped whenever the engine's rules change. Stored with every analysis: an
 * impression cannot be interpreted later without knowing which ruleset wrote it.
 */
export const ENGINE_VERSION = '1.0.0';

export interface SavedAnalysisSummary {
  id: number;
  patient_id: number | null;
  hospital_number?: string;
  source: string;
  overall_severity: Severity;
  impression: string[];
  engine_version?: string;
  analysed_at: string;
  notes?: string;
  first_name?: string;
  last_name?: string;
}

export interface RunResult {
  analysis: AnalysisResult;
  unmapped: UnmappedResult[];
  sources: BridgeResult['sources'];
}

/**
 * Pull a patient's record, interpret it, and return the result WITHOUT saving.
 * Saving is a separate, deliberate act — an analysis run to look at something
 * should not silently become part of the record.
 */
export async function runForPatient(patientId: string | number): Promise<RunResult> {
  const bridge = await buildFromPatientRecord(patientId);
  const analysis = analyse(bridge.patient, bridge.extraction, []);
  return { analysis, unmapped: bridge.unmapped, sources: bridge.sources };
}

/** Interpret values the clinician entered or scanned, rather than the record. */
export function runForContext(patient: PatientContext, extraction: Extraction): AnalysisResult {
  return analyse(patient, extraction, []);
}

export async function saveAnalysis(
  patientId: string | number | null,
  result: RunResult,
  opts: { source?: 'record' | 'scan' | 'manual' | 'mixed'; notes?: string } = {}
): Promise<any> {
  const { analysis, unmapped } = result;
  const payload = {
    patient_id: patientId ?? null,
    hospital_number: analysis.patient.hospitalNumber || null,
    source: opts.source || 'record',
    overall_severity: analysis.overallSeverity,
    impression: analysis.impression,
    next_steps: analysis.nextSteps,
    modules: analysis.modules,
    correlations: analysis.correlations,
    patient_context: analysis.patient,
    extraction: { analytes: [], observations: [], micro: [], ecg: [] },
    unmapped,
    engine_version: ENGINE_VERSION,
    notes: opts.notes || null,
  };

  const res: any = await apiClient.post(BASE, payload);
  const saved = res?.analysis || res;
  await cacheAnalyses([saved]);
  return saved;
}

export async function listForPatient(patientId: string | number): Promise<SavedAnalysisSummary[]> {
  try {
    const res: any = await apiClient.get(`${BASE}?patientId=${encodeURIComponent(String(patientId))}`);
    const rows: SavedAnalysisSummary[] = res?.analyses || [];
    await cacheAnalyses(rows);
    return rows;
  } catch {
    // Offline: the previously-seen analyses for this patient are still readable.
    return db.clinician_analyses
      .where('patient_id')
      .equals(patientId as any)
      .reverse()
      .toArray()
      .catch(() => []);
  }
}

export async function listRecent(limit = 50): Promise<SavedAnalysisSummary[]> {
  try {
    const res: any = await apiClient.get(`${BASE}?action=recent&limit=${limit}`);
    const rows: SavedAnalysisSummary[] = res?.analyses || [];
    await cacheAnalyses(rows);
    return rows;
  } catch {
    return db.clinician_analyses.reverse().limit(limit).toArray().catch(() => []);
  }
}

export async function getAnalysis(id: number): Promise<any | null> {
  try {
    const res: any = await apiClient.get(`${BASE}?action=detail&id=${id}`);
    return res?.analysis || null;
  } catch {
    return db.clinician_analyses.get(id).catch(() => null);
  }
}

export async function annotateAnalysis(id: number, notes: string): Promise<any> {
  const res: any = await apiClient.put(`${BASE}?id=${id}`, { notes });
  return res?.analysis || res;
}

async function cacheAnalyses(rows: any[]): Promise<void> {
  if (!rows?.length) return;
  try {
    await db.clinician_analyses.bulkPut(
      rows.map(r => ({ ...r, serverId: typeof r.id === 'number' ? r.id : undefined, synced: true }))
    );
  } catch (err) {
    console.warn('Failed to cache clinician analyses:', err);
  }
}

export type { AnalysisResult, UnmappedResult };
