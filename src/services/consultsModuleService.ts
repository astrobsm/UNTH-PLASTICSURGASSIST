/**
 * Native Consults Module — frontend service.
 * Talks to /api/consults-module/* (path-dispatched serverless function).
 *
 * Two flows:
 *   - Received consults: other units -> our PSU (via shareable public link or staff entry)
 *   - Delivered consults: our PSU -> other units (OCR'd handwritten consult page)
 */

import { apiClient } from './apiClient';

// ── Types ───────────────────────────────────────────────────────────────
export type ReceivedConsultStatus =
  | 'received' | 'acknowledged' | 'reviewed' | 'plan_approved' | 'plan_implemented' | 'closed' | 'cancelled';

export type DeliveredConsultStatus =
  | 'delivered' | 'acknowledged' | 'responded' | 'closed';

export type Urgency = 'emergency' | 'urgent' | 'routine';

export type AttachmentKind =
  | 'clinical_photo' | 'investigation_ocr' | 'chart_ocr' | 'digital_chart' | 'document';

export interface SubmissionLink {
  id: number;
  token: string;
  unit_label: string;
  description?: string | null;
  is_active: boolean;
  submission_count: number;
  created_at: string;
  last_used_at?: string | null;
}

export interface ReceivedConsult {
  id: number;
  consult_ref: string;
  submission_token?: string | null;
  source: 'public_form' | 'staff_entry' | 'phone_dictation';
  patient_name: string;
  hospital_number?: string | null;
  age?: number | null;
  sex?: string | null;
  ward?: string | null;
  bed_number?: string | null;
  referring_unit: string;
  referring_consultant?: string | null;
  referring_doctor_name: string;
  referring_doctor_role?: string | null;
  referring_phone: string;
  referring_alt_phone?: string | null;
  primary_diagnosis?: string | null;
  presenting_complaint?: string | null;
  history_summary?: string | null;
  examination_summary?: string | null;
  investigations_summary?: string | null;
  indication: string;
  urgency: Urgency;
  requested_input?: string | null;
  status: ReceivedConsultStatus;
  acknowledged_at?: string | null;
  reviewed_at?: string | null;
  plan_approved_at?: string | null;
  plan_implemented_at?: string | null;
  closed_at?: string | null;
  review_notes?: string | null;
  proposed_plan?: string | null;
  plan_approval_notes?: string | null;
  implementation_notes?: string | null;
  created_at: string;
  updated_at?: string | null;
  last_feedback_sent_at?: string | null;
}

export interface DeliveredConsult {
  id: number;
  consult_ref: string;
  patient_name: string;
  hospital_number?: string | null;
  receiving_unit: string;
  receiving_consultant?: string | null;
  receiver_name: string;
  receiver_phone: string;
  receiver_role?: string | null;
  written_by_name?: string | null;
  handwritten_image_url?: string | null;
  ocr_raw_text?: string | null;
  ocr_structured?: Record<string, any> | null;
  consult_summary?: string | null;
  status: DeliveredConsultStatus;
  delivered_at: string;
  acknowledged_at?: string | null;
  response_received_at?: string | null;
  response_text?: string | null;
  created_at: string;
  updated_at?: string | null;
}

export interface ConsultAttachment {
  id: number;
  kind: AttachmentKind;
  file_name?: string | null;
  mime_type?: string | null;
  ocr_text?: string | null;
  ocr_structured?: Record<string, any> | null;
  metadata?: Record<string, any> | null;
  uploaded_by_name?: string | null;
  created_at: string;
  has_data_url: boolean;
  remote_url?: string | null;
  data_url?: string | null; // populated when uploading; not returned in lists
}

export interface ConsultStatusEvent {
  id: number;
  consult_kind: 'received' | 'delivered';
  consult_id: number;
  from_status?: string | null;
  to_status: string;
  notes?: string | null;
  actor_name?: string | null;
  created_at: string;
}

export interface DigitalChartSeries {
  label: string;
  color: string;
  unit?: string;
  points: { t: string | number; v: number | null }[];
}

export interface ConsultDigitalChart {
  id: number;
  chart_type: 'vital_signs' | 'fluid_balance' | 'glucose' | 'pain_score' | 'custom';
  title?: string | null;
  series: DigitalChartSeries[];
  source_attachment_id?: number | null;
  notes?: string | null;
  created_by_name?: string | null;
  created_at: string;
}

export interface ConsultFeedbackEvent {
  id: number;
  channel: 'sms' | 'whatsapp' | 'email';
  to_phone?: string | null;
  to_name?: string | null;
  message: string;
  status: 'queued' | 'sent' | 'failed';
  provider?: string | null;
  sent_by_name?: string | null;
  created_at: string;
  sent_at?: string | null;
  error_message?: string | null;
}

export interface ReceivedConsultDetail {
  consult: ReceivedConsult;
  attachments: ConsultAttachment[];
  history: ConsultStatusEvent[];
  charts: ConsultDigitalChart[];
  feedback: ConsultFeedbackEvent[];
}

export interface DeliveredConsultDetail {
  consult: DeliveredConsult;
  attachments: ConsultAttachment[];
  history: ConsultStatusEvent[];
  feedback: ConsultFeedbackEvent[];
}

interface ListResponse<T> { total: number; page: number; per_page: number; consults: T[] }

const BASE = '/consults-module';

// ── Submission links ────────────────────────────────────────────────────
export async function listLinks(): Promise<SubmissionLink[]> {
  const r = await apiClient.request<{ links: SubmissionLink[] }>(`${BASE}/links`);
  return r.links || [];
}
export function createLink(unit_label: string, description?: string) {
  return apiClient.post<SubmissionLink>(`${BASE}/links`, { unit_label, description });
}
export function setLinkActive(id: number, is_active: boolean) {
  return apiClient.request<SubmissionLink>(`${BASE}/links/${id}`, {
    method: 'PATCH', body: JSON.stringify({ is_active }),
  });
}

// ── Received ────────────────────────────────────────────────────────────
export async function listReceived(opts: {
  status?: ReceivedConsultStatus | ''; urgency?: Urgency | ''; search?: string; page?: number; per_page?: number;
} = {}) {
  const p = new URLSearchParams();
  if (opts.status) p.set('status', opts.status);
  if (opts.urgency) p.set('urgency', opts.urgency);
  if (opts.search) p.set('search', opts.search);
  if (opts.page) p.set('page', String(opts.page));
  if (opts.per_page) p.set('per_page', String(opts.per_page));
  return apiClient.request<ListResponse<ReceivedConsult>>(`${BASE}/received?${p.toString()}`);
}
export function getReceivedDetail(id: number) {
  return apiClient.request<ReceivedConsultDetail>(`${BASE}/received/${id}`);
}
export function createReceivedByStaff(payload: Partial<ReceivedConsult> & { notes?: string }) {
  return apiClient.post<ReceivedConsult>(`${BASE}/received`, payload);
}
export function updateReceivedStatus(id: number, payload: {
  to_status: ReceivedConsultStatus; notes?: string;
  review_notes?: string; proposed_plan?: string; plan_approval_notes?: string; implementation_notes?: string;
}) {
  return apiClient.request<ReceivedConsult>(`${BASE}/received/${id}/status`, {
    method: 'PATCH', body: JSON.stringify(payload),
  });
}

// ── Delivered ───────────────────────────────────────────────────────────
export async function listDelivered(opts: { status?: DeliveredConsultStatus | ''; search?: string; page?: number; per_page?: number } = {}) {
  const p = new URLSearchParams();
  if (opts.status) p.set('status', opts.status);
  if (opts.search) p.set('search', opts.search);
  if (opts.page) p.set('page', String(opts.page));
  if (opts.per_page) p.set('per_page', String(opts.per_page));
  return apiClient.request<ListResponse<DeliveredConsult>>(`${BASE}/delivered?${p.toString()}`);
}
export function getDeliveredDetail(id: number) {
  return apiClient.request<DeliveredConsultDetail>(`${BASE}/delivered/${id}`);
}
export function createDelivered(payload: Partial<DeliveredConsult> & { notes?: string }) {
  return apiClient.post<DeliveredConsult>(`${BASE}/delivered`, payload);
}
export function updateDeliveredStatus(id: number, payload: { to_status: DeliveredConsultStatus; notes?: string; response_text?: string }) {
  return apiClient.request<DeliveredConsult>(`${BASE}/delivered/${id}/status`, {
    method: 'PATCH', body: JSON.stringify(payload),
  });
}

// ── Attachments / charts / feedback (generic) ───────────────────────────
export function addAttachment(kind: 'received' | 'delivered', consultId: number, payload: {
  kind: AttachmentKind; file_name?: string; mime_type?: string;
  data_url?: string; remote_url?: string;
  ocr_text?: string; ocr_structured?: Record<string, any>; metadata?: Record<string, any>;
}) {
  return apiClient.post<ConsultAttachment>(`${BASE}/${kind}/${consultId}/attachments`, payload);
}
export function deleteAttachment(kind: 'received' | 'delivered', consultId: number, attachmentId: number) {
  return apiClient.delete<void>(`${BASE}/${kind}/${consultId}/attachments/${attachmentId}`);
}
export function saveDigitalChart(consultId: number, payload: {
  chart_type: ConsultDigitalChart['chart_type']; title?: string; series: DigitalChartSeries[];
  source_attachment_id?: number; notes?: string;
}) {
  return apiClient.post<ConsultDigitalChart>(`${BASE}/received/${consultId}/charts`, payload);
}
export function sendConsultFeedback(kind: 'received' | 'delivered', consultId: number, payload: {
  message: string; channel?: 'sms' | 'whatsapp' | 'email'; to_phone?: string; to_name?: string;
}) {
  return apiClient.post<ConsultFeedbackEvent>(`${BASE}/${kind}/${consultId}/feedback`, payload);
}

// ── Public (no auth) ────────────────────────────────────────────────────
// These hit the API directly because apiClient injects Authorization headers
// the public endpoints intentionally don't require.
const apiBase = (import.meta.env.VITE_API_BASE_URL as string | undefined) || '/api';

export async function publicVerifyLink(token: string): Promise<{ token: string; unit_label: string; description?: string | null; is_active: boolean }> {
  const r = await fetch(`${apiBase}${BASE}/public/link/${encodeURIComponent(token)}`);
  if (!r.ok) throw new Error((await r.json().catch(() => ({}))).error || 'Link invalid');
  return r.json();
}
export async function publicSubmitConsult(token: string, payload: Record<string, any>): Promise<{ success: boolean; consult_ref: string; created_at: string; message: string }> {
  const r = await fetch(`${apiBase}${BASE}/public/submit/${encodeURIComponent(token)}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  const data = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(data.error || 'Submission failed');
  return data;
}

// ── Helpers ─────────────────────────────────────────────────────────────
export function buildShareableUrl(token: string, originOverride?: string): string {
  const origin = originOverride || (typeof window !== 'undefined' ? window.location.origin : '');
  return `${origin}/submit-consult/${token}`;
}

export const STATUS_FLOW: ReceivedConsultStatus[] = [
  'received', 'acknowledged', 'reviewed', 'plan_approved', 'plan_implemented', 'closed',
];

export function nextStatus(current: ReceivedConsultStatus): ReceivedConsultStatus | null {
  const i = STATUS_FLOW.indexOf(current);
  if (i < 0 || i === STATUS_FLOW.length - 1) return null;
  return STATUS_FLOW[i + 1];
}

export const STATUS_META: Record<ReceivedConsultStatus, { label: string; color: string; bg: string }> = {
  received:           { label: 'Received',           color: 'text-yellow-800', bg: 'bg-yellow-100' },
  acknowledged:       { label: 'Acknowledged',       color: 'text-blue-800',   bg: 'bg-blue-100' },
  reviewed:           { label: 'Reviewed',           color: 'text-purple-800', bg: 'bg-purple-100' },
  plan_approved:      { label: 'Plan Approved',      color: 'text-cyan-800',   bg: 'bg-cyan-100' },
  plan_implemented:   { label: 'Plan Implemented',   color: 'text-green-800',  bg: 'bg-green-100' },
  closed:             { label: 'Closed',             color: 'text-gray-700',   bg: 'bg-gray-200' },
  cancelled:          { label: 'Cancelled',          color: 'text-gray-600',   bg: 'bg-gray-100' },
};

export const URGENCY_META: Record<Urgency, { label: string; color: string }> = {
  emergency: { label: 'Emergency', color: 'bg-red-100 text-red-800 border-red-300' },
  urgent:    { label: 'Urgent',    color: 'bg-orange-100 text-orange-800 border-orange-300' },
  routine:   { label: 'Routine',   color: 'bg-blue-100 text-blue-800 border-blue-300' },
};
