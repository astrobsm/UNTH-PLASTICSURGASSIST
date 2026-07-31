/**
 * Tumor Board — service layer.
 *
 * Persists oncology cases and their append-only staging timeline, and composes
 * the pure generators in ./oncology into the artefacts the board needs:
 * a staged assessment, a multimodality plan, referral letters, a surveillance
 * schedule and a counselling document.
 *
 * Deliberate reuse — NOT reimplemented here:
 *  - Staging, plan, letter, surveillance and counselling logic all live in
 *    src/services/oncology/* as pure functions, so they are unit-tested without
 *    a database and run unchanged offline.
 *  - Offline-first persistence and cross-device sync ride the shared apiClient
 *    and Dexie entities, exactly as woundMonitorService does.
 *  - PDF rendering goes through utils/pdfUtils via tumorBoardPdfService.
 */

import { apiClient } from './apiClient';
import { db } from '../db/database';
import {
  computeStage,
  type StageResult,
  type StagingInput,
  type TumorFamily,
  type StagingBasis,
  type SarcomaSite,
  type SarcomaGrade,
} from './oncology/stagingEngine';
import { buildManagementPlan, type ManagementPlan, type PlanContext, type Specialty } from './oncology/managementPlan';
import { generateAllReferralLetters, type LetterContext, type ReferralLetter } from './oncology/referralLetters';
import { buildSurveillancePlan, type SurveillancePlan } from './oncology/surveillance';
import { buildCounsellingDocument, type CounsellingDocument } from './oncology/counselling';

const BASE = '/tumor-board';

// ── Types ──────────────────────────────────────────────────────────────────

export type CaseStatus = 'active' | 'in_treatment' | 'surveillance' | 'closed';

export interface TumorBoardCase {
  id?: number | string;
  serverId?: number;
  patient_id: number | string;
  hospital_number?: string;
  tumor_family: TumorFamily;
  diagnosis?: string;
  primary_site?: string;
  laterality?: string;
  sarcoma_site?: SarcomaSite;
  date_of_diagnosis?: string;
  date_first_presented?: string;
  status?: CaseStatus;
  treatment_intent?: string;
  performance_status?: string;
  comorbidities?: string;
  immunosuppressed?: boolean;
  high_risk_site?: boolean;
  recurrent_disease?: boolean;
  fit_for_radical_therapy?: boolean | null;
  braf_mutated?: boolean | null;
  histology_available?: boolean;
  histologic_type?: string | null;
  current_stage_group?: string;
  current_stage_formatted?: string;
  assessment_count?: number;
  last_board_date?: string;
  // Joined from patients on the board aggregate.
  first_name?: string;
  last_name?: string;
  patient_hospital_number?: string;
  created_at?: string;
  updated_at?: string;
  synced?: boolean;
}

export interface TumorBoardAssessment {
  id?: number | string;
  serverId?: number;
  case_id: number | string;
  patient_id: number | string;
  version?: number;
  basis: StagingBasis;
  staging_system?: string;
  assessed_at?: string;
  inputs?: StagingInput | Record<string, unknown>;
  t_category?: string;
  n_category?: string;
  m_category?: string;
  stage_group?: string;
  stage_formatted?: string;
  stage_description?: string;
  caveats?: string[];
  local_spread?: string;
  regional_spread?: string;
  metastatic_spread?: string;
  histologic_type?: string | null;
  histologic_grade?: SarcomaGrade | string | null;
  margins?: string;
  lymphovascular_invasion?: boolean | null;
  perineural_invasion?: boolean | null;
  molecular_findings?: string;
  notes?: string;
  synced?: boolean;
}

export interface BoardSummary {
  total: number;
  awaitingHistology: number;
  overdueSurveillance: number;
}

export interface CaseDetail {
  case: TumorBoardCase;
  assessments: TumorBoardAssessment[];
  plans: any[];
  referrals: any[];
  surveillance: any[];
}

// ── Case CRUD ──────────────────────────────────────────────────────────────

export async function listCasesForPatient(patientId: number | string): Promise<TumorBoardCase[]> {
  try {
    const res: any = await apiClient.get(`${BASE}?patientId=${encodeURIComponent(String(patientId))}`);
    const cases: TumorBoardCase[] = res?.cases || [];
    await cacheCases(cases);
    return cases;
  } catch {
    return db.tumor_board_cases
      .where('patient_id')
      .equals(patientId as any)
      .toArray()
      .catch(() => []);
  }
}

export async function getBoard(): Promise<{ cases: TumorBoardCase[]; summary: BoardSummary }> {
  try {
    const res: any = await apiClient.get(`${BASE}?action=board`);
    const cases: TumorBoardCase[] = res?.cases || [];
    await cacheCases(cases);
    return {
      cases,
      summary: res?.summary || { total: cases.length, awaitingHistology: 0, overdueSurveillance: 0 },
    };
  } catch {
    // Offline: rebuild the aggregate from whatever is cached locally so the
    // board list still renders on a ward round.
    const cases = await db.tumor_board_cases.toArray().catch(() => [] as TumorBoardCase[]);
    const open = cases.filter(c => c.status !== 'closed');
    return {
      cases: open,
      summary: {
        total: open.length,
        awaitingHistology: open.filter(c => !c.histology_available).length,
        overdueSurveillance: 0,
      },
    };
  }
}

export async function getCaseDetail(caseId: number | string): Promise<CaseDetail | null> {
  try {
    const res: any = await apiClient.get(`${BASE}?action=detail&id=${encodeURIComponent(String(caseId))}`);
    if (res?.case) {
      await cacheCases([res.case]);
      await cacheAssessments(res.assessments || []);
    }
    return res as CaseDetail;
  } catch {
    const c = await db.tumor_board_cases.get(caseId as any).catch(() => undefined);
    if (!c) return null;
    const assessments = await db.tumor_board_assessments
      .where('case_id')
      .equals(caseId as any)
      .toArray()
      .catch(() => []);
    return { case: c, assessments, plans: [], referrals: [], surveillance: [] };
  }
}

export async function createCase(payload: Partial<TumorBoardCase>): Promise<TumorBoardCase> {
  const res: any = await apiClient.post(BASE, payload);
  const created = res?.case || res;
  await cacheCases([created]);
  return created;
}

export async function updateCase(caseId: number | string, patch: Partial<TumorBoardCase>): Promise<TumorBoardCase> {
  const res: any = await apiClient.put(`${BASE}?id=${encodeURIComponent(String(caseId))}`, patch);
  const updated = res?.case || res;
  await cacheCases([updated]);
  return updated;
}

export async function closeCase(caseId: number | string): Promise<void> {
  await apiClient.delete(`${BASE}?id=${encodeURIComponent(String(caseId))}`);
}

// ── Staging ────────────────────────────────────────────────────────────────

/**
 * Stage a case and APPEND the result to its timeline.
 *
 * Never overwrites: a case staged clinically before histology and re-staged
 * afterwards keeps both versions, so the record shows what was known when each
 * decision was taken. That is the point of the module.
 */
export async function recordAssessment(
  caseRecord: TumorBoardCase,
  input: StagingInput,
  extra: Partial<TumorBoardAssessment> = {}
): Promise<{ assessment: TumorBoardAssessment; stage: StageResult }> {
  const stage = computeStage(input);

  const payload: any = {
    case_id: caseRecord.serverId || caseRecord.id,
    patient_id: caseRecord.patient_id,
    basis: input.basis,
    staging_system: stage.stagingSystem,
    inputs: input,
    t_category: stage.T,
    n_category: stage.N,
    m_category: stage.M,
    stage_group: stage.stageGroup,
    stage_formatted: stage.formatted,
    stage_description: stage.stageDescription,
    caveats: stage.caveats,
    ...extra,
  };

  const res: any = await apiClient.post(`${BASE}?action=assess`, payload);
  const assessment = res?.assessment || payload;
  await cacheAssessments([assessment]);
  return { assessment, stage };
}

/** Re-derive the StageResult from a stored assessment without re-entering data. */
export function stageFromAssessment(a: TumorBoardAssessment): StageResult {
  if (a.inputs && typeof a.inputs === 'object' && 'family' in (a.inputs as any)) {
    return computeStage(a.inputs as StagingInput);
  }
  // Fall back to the persisted derived values for legacy rows.
  return {
    T: a.t_category || 'TX',
    N: a.n_category || 'NX',
    M: a.m_category || 'M0',
    stageGroup: a.stage_group || 'Not assignable',
    stageDescription: a.stage_description || '',
    stagingSystem: a.staging_system || 'AJCC 8th edition (2018)',
    basis: a.basis,
    prefix: a.basis === 'pathological' ? 'p' : a.basis === 'post_neoadjuvant' ? 'yp' : 'c',
    formatted: a.stage_formatted || '',
    caveats: a.caveats || [],
  };
}

// ── Plan, letters, surveillance, counselling ───────────────────────────────

export function buildPlanForCase(caseRecord: TumorBoardCase, stage: StageResult, input?: StagingInput): ManagementPlan {
  const ctx: PlanContext = {
    family: caseRecord.tumor_family,
    stage,
    breslowMm: input?.breslowMm ?? null,
    sizeCm: input?.sizeCm ?? null,
    sarcomaSite: caseRecord.sarcoma_site,
    grade: input?.grade,
    histologyAvailable: caseRecord.histology_available,
    histologicType: caseRecord.histologic_type,
    highRiskSite: caseRecord.high_risk_site,
    immunosuppressed: caseRecord.immunosuppressed,
    brafMutated: caseRecord.braf_mutated,
    recurrentDisease: caseRecord.recurrent_disease,
    perineuralInvasion: input?.perineuralInvasion,
    fitForRadicalTherapy: caseRecord.fit_for_radical_therapy ?? undefined,
  };
  return buildManagementPlan(ctx);
}

export async function savePlan(
  caseRecord: TumorBoardCase,
  plan: ManagementPlan,
  opts: { assessmentId?: number | string; boardDate?: string; boardMembers?: string } = {}
): Promise<any> {
  const res: any = await apiClient.post(`${BASE}?action=plan`, {
    case_id: caseRecord.serverId || caseRecord.id,
    patient_id: caseRecord.patient_id,
    assessment_id: opts.assessmentId || null,
    intent: plan.intent,
    summary: plan.summary,
    items: plan.items,
    specialties: plan.specialtiesInvolved,
    caveats: plan.caveats,
    board_date: opts.boardDate || null,
    board_members: opts.boardMembers || null,
  });
  return res?.plan || res;
}

export async function ratifyPlan(planId: number | string): Promise<any> {
  const res: any = await apiClient.put(`${BASE}?action=ratify&id=${encodeURIComponent(String(planId))}`, {});
  return res?.plan || res;
}

export function buildLetters(ctx: LetterContext): ReferralLetter[] {
  return generateAllReferralLetters(ctx);
}

export async function saveReferrals(
  caseRecord: TumorBoardCase,
  letters: ReferralLetter[],
  planId?: number | string
): Promise<any[]> {
  const res: any = await apiClient.post(`${BASE}?action=referrals`, {
    case_id: caseRecord.serverId || caseRecord.id,
    patient_id: caseRecord.patient_id,
    plan_id: planId || null,
    referrals: letters,
  });
  return res?.referrals || [];
}

export async function markReferralSent(referralId: number | string): Promise<any> {
  const res: any = await apiClient.put(`${BASE}?action=referral&id=${encodeURIComponent(String(referralId))}`, {
    status: 'sent',
  });
  return res?.referral || res;
}

export function buildSurveillance(
  caseRecord: TumorBoardCase,
  stage: StageResult,
  opts: { indexDate?: string; grade?: string; sentinelNodeDone?: boolean } = {}
): SurveillancePlan {
  return buildSurveillancePlan({
    family: caseRecord.tumor_family,
    stage,
    indexDate: opts.indexDate,
    grade: opts.grade,
    sentinelNodeDone: opts.sentinelNodeDone,
  });
}

export async function saveSurveillance(caseRecord: TumorBoardCase, plan: SurveillancePlan): Promise<any[]> {
  const res: any = await apiClient.post(`${BASE}?action=surveillance`, {
    case_id: caseRecord.serverId || caseRecord.id,
    patient_id: caseRecord.patient_id,
    items: plan.items,
  });
  return res?.surveillance || [];
}

export async function completeSurveillanceItem(itemId: number | string, findings?: string): Promise<any> {
  const res: any = await apiClient.put(`${BASE}?action=survitem&id=${encodeURIComponent(String(itemId))}`, {
    status: 'completed',
    findings: findings || null,
  });
  return res?.item || res;
}

export async function getDueSurveillance(withinDays = 30): Promise<any[]> {
  try {
    const res: any = await apiClient.get(`${BASE}?action=surveillance&withinDays=${withinDays}`);
    return res?.surveillance || [];
  } catch {
    return [];
  }
}

export function buildCounselling(
  caseRecord: TumorBoardCase,
  stage: StageResult,
  plan: ManagementPlan,
  patientName?: string
): CounsellingDocument {
  return buildCounsellingDocument({
    family: caseRecord.tumor_family,
    stage,
    plan,
    patientName,
    histologyPending: !caseRecord.histology_available,
    histologicType: caseRecord.histologic_type,
    primarySite: caseRecord.primary_site,
  });
}

// ── Local cache helpers ────────────────────────────────────────────────────

async function cacheCases(cases: TumorBoardCase[]): Promise<void> {
  if (!cases?.length) return;
  try {
    await db.tumor_board_cases.bulkPut(
      cases.map(c => ({ ...c, serverId: typeof c.id === 'number' ? c.id : c.serverId, synced: true }))
    );
  } catch (err) {
    console.warn('Failed to cache tumour board cases:', err);
  }
}

async function cacheAssessments(assessments: TumorBoardAssessment[]): Promise<void> {
  if (!assessments?.length) return;
  try {
    await db.tumor_board_assessments.bulkPut(
      assessments.map(a => ({ ...a, serverId: typeof a.id === 'number' ? a.id : a.serverId, synced: true }))
    );
  } catch (err) {
    console.warn('Failed to cache tumour board assessments:', err);
  }
}

export type { StageResult, StagingInput, TumorFamily, Specialty, ManagementPlan, ReferralLetter, SurveillancePlan, CounsellingDocument };
