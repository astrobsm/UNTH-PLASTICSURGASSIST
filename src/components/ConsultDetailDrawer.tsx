/**
 * Consult Detail Drawer — full workflow for a single received consult.
 *
 * Shows: identifying info, indication, status timeline, status-progression form,
 * attachments (clinical photos + OCR'd investigations), digital chart recreations,
 * and SMS feedback log/sender.
 */

import React, { useCallback, useEffect, useState } from 'react';
import {
  X, Send, Camera, FileText, Activity, Image as ImageIcon, Loader2, ChevronRight,
  CheckCircle2, AlertCircle, Trash2, MessageSquare, History, Users, ClipboardList, UserPlus,
} from 'lucide-react';
import {
  getReceivedDetail, updateReceivedStatus, addAttachment, deleteAttachment, sendConsultFeedback,
  STATUS_META, URGENCY_META, nextStatus,
  type ReceivedConsultDetail, type ReceivedConsultStatus, type AttachmentKind, type ConsultAttachment,
} from '../services/consultsModuleService';
import { mdtService } from '../services/mdtService';
import { ocrService } from '../services/ocrService';
import ConsultChartRecreator from './ConsultChartRecreator';
import PhoneActions from './PhoneActions';

interface Props {
  consultId: number;
  onClose: () => void;
  onChanged?: () => void;
}

export const ConsultDetailDrawer: React.FC<Props> = ({ consultId, onClose, onChanged }) => {
  const [detail, setDetail] = useState<ReceivedConsultDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [chartFromAttachment, setChartFromAttachment] = useState<ConsultAttachment | null>(null);
  const [enrolling, setEnrolling] = useState(false);
  const [enrolMsg, setEnrolMsg] = useState<{ ok: boolean; text: string } | null>(null);

  const enrolToMdt = useCallback(async () => {
    if (!detail) return;
    setEnrolling(true); setEnrolMsg(null);
    try {
      const r = await mdtService.enrolFromConsult(detail.consult);
      setEnrolMsg({ ok: r.ok, text: r.message });
    } catch (e: any) {
      setEnrolMsg({ ok: false, text: e?.message || 'Failed to enrol into MDT' });
    } finally { setEnrolling(false); }
  }, [detail]);

  const reload = useCallback(async () => {
    setLoading(true); setError(null);
    try { setDetail(await getReceivedDetail(consultId)); }
    catch (e: any) { setError(e.message || 'Failed to load consult'); }
    finally { setLoading(false); }
  }, [consultId]);
  useEffect(() => { reload(); }, [reload]);

  if (loading) {
    return (
      <DrawerShell onClose={onClose}>
        <div className="p-8 text-center text-gray-500"><Loader2 className="w-6 h-6 animate-spin mx-auto mb-2" />Loading consult…</div>
      </DrawerShell>
    );
  }
  if (error || !detail) {
    return (
      <DrawerShell onClose={onClose}>
        <div className="p-6 text-center text-red-600">{error || 'No data'}</div>
      </DrawerShell>
    );
  }

  const c = detail.consult;
  const statusMeta = STATUS_META[c.status] || STATUS_META.received;
  const urgencyMeta = URGENCY_META[c.urgency] || URGENCY_META.routine;
  const next = nextStatus(c.status);

  return (
    <DrawerShell onClose={onClose}>
      {/* Header */}
      <div className="px-5 pt-5 pb-3 border-b bg-white sticky top-0 z-10">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="font-mono text-xs text-gray-500">{c.consult_ref}</span>
              <span className={`px-2 py-0.5 rounded-full text-[11px] font-medium border ${urgencyMeta.color}`}>{urgencyMeta.label}</span>
              <span className={`px-2 py-0.5 rounded-full text-[11px] font-medium ${statusMeta.bg} ${statusMeta.color}`}>{statusMeta.label}</span>
            </div>
            <h2 className="text-lg font-bold text-gray-900 mt-1 truncate">{c.patient_name}</h2>
            <p className="text-xs text-gray-500">
              {c.hospital_number ? `${c.hospital_number} · ` : ''}{c.age || '?'}{c.sex ? `${c.sex.charAt(0)}` : ''} · {c.ward || '—'} {c.bed_number ? `Bed ${c.bed_number}` : ''}
            </p>
            <div className="mt-2 flex items-center gap-2 flex-wrap">
              <button
                onClick={enrolToMdt}
                disabled={enrolling}
                className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-medium bg-purple-600 text-white rounded hover:bg-purple-700 disabled:bg-gray-300"
              >
                <UserPlus className="w-3.5 h-3.5" /> {enrolling ? 'Enrolling…' : 'Enrol to MDT'}
              </button>
              {enrolMsg && (
                <span className={`text-xs ${enrolMsg.ok ? 'text-green-700' : 'text-red-600'}`}>{enrolMsg.text}</span>
              )}
            </div>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 p-1"><X className="w-5 h-5" /></button>
        </div>
      </div>

      <div className="px-5 py-4 space-y-5">
        {/* Referring team */}
        <Block icon={<Users className="w-4 h-4 text-blue-600" />} title="Referring team">
          <div className="text-sm space-y-1">
            {c.referring_hospital && <div><span className="text-gray-500">Hospital:</span> <span className="font-medium">{c.referring_hospital}</span></div>}
            {c.referring_department && <div><span className="text-gray-500">Department:</span> {c.referring_department}</div>}
            <div><span className="text-gray-500">Unit:</span> <span className="font-medium">{c.referring_unit}</span></div>
          </div>
          <div className="mt-2 divide-y divide-gray-100 border-t border-gray-100">
            <TeamRow role="Consultant"       name={c.referring_consultant} phone={c.referring_consultant_phone} />
            <TeamRow role="Senior Registrar" name={c.referring_senior_registrar_name} phone={c.referring_senior_registrar_phone} />
            <TeamRow role="Registrar"        name={c.referring_registrar_name} phone={c.referring_registrar_phone} />
            <TeamRow role="House Officer"    name={c.referring_house_officer_name} phone={c.referring_house_officer_phone} />
            <TeamRow role="Medical Officer"  name={c.referring_medical_officer_name} phone={c.referring_medical_officer_phone} />
            <TeamRow role="Contact"          name={`${c.referring_doctor_name}${c.referring_doctor_role ? ` (${c.referring_doctor_role})` : ''}`} phone={c.referring_phone} altPhone={c.referring_alt_phone} />
          </div>
        </Block>

        {/* Referral information */}
        <Block icon={<ClipboardList className="w-4 h-4 text-orange-600" />} title="Referral information">
          <div className="text-sm space-y-1">
            <div>
              <span className="text-gray-500">Priority:</span>{' '}
              <span className={`px-2 py-0.5 rounded-full text-[11px] font-medium border ${urgencyMeta.color}`}>{urgencyMeta.label}</span>
            </div>
            {(c.referral_datetime || c.created_at) && (
              <div><span className="text-gray-500">Date &amp; time:</span> {new Date(c.referral_datetime || c.created_at).toLocaleString()}</div>
            )}
          </div>
          <Field label="Reason for referral" value={c.reason_for_referral || c.indication} />
        </Block>

        {/* Clinical summary */}
        <Block icon={<FileText className="w-4 h-4 text-gray-600" />} title="Clinical summary">
          <Field label="Indication" value={c.indication} />
          <Field label="Primary diagnosis" value={c.primary_diagnosis} />
          <Field label="Presenting complaint" value={c.presenting_complaint} />
          <Field label="History" value={c.history_summary} />
          <Field label="Examination" value={c.examination_summary} />
          <Field label="Investigations" value={c.investigations_summary} />
          <Field label="Requested input" value={c.requested_input} />
        </Block>

        {/* Status workflow */}
        <Block icon={<ChevronRight className="w-4 h-4 text-green-600" />} title="Status workflow">
          <StatusTimeline current={c.status} consult={c} />
          {next && (
            <StatusAdvanceForm
              currentStatus={c.status}
              nextStatus={next}
              busy={busy}
              onSubmit={async (payload) => {
                setBusy(true);
                try {
                  await updateReceivedStatus(consultId, payload);
                  await reload();
                  onChanged?.();
                } finally { setBusy(false); }
              }}
            />
          )}
        </Block>

        {/* Attachments */}
        <Block icon={<ImageIcon className="w-4 h-4 text-purple-600" />} title="Attachments & OCR">
          <AttachmentManager
            consultId={consultId}
            attachments={detail.attachments}
            onChanged={reload}
            onRecreateChart={(a) => setChartFromAttachment(a)}
          />
        </Block>

        {/* Chart recreator */}
        {chartFromAttachment && (
          <ConsultChartRecreator
            consultId={consultId}
            sourceAttachmentId={chartFromAttachment.id}
            initialOcrText={chartFromAttachment.ocr_text || ''}
            onCancel={() => setChartFromAttachment(null)}
            onSaved={() => { setChartFromAttachment(null); reload(); }}
          />
        )}

        {/* Saved digital charts */}
        {detail.charts.length > 0 && (
          <Block icon={<Activity className="w-4 h-4 text-green-600" />} title={`Digital charts (${detail.charts.length})`}>
            <ul className="space-y-1 text-sm">
              {detail.charts.map(ch => (
                <li key={ch.id} className="bg-gray-50 border border-gray-200 rounded p-2">
                  <div className="font-medium text-gray-800">{ch.title || ch.chart_type}</div>
                  <div className="text-xs text-gray-500">
                    {ch.series.length} series · {ch.series.reduce((s, x) => s + x.points.length, 0)} points · saved {new Date(ch.created_at).toLocaleString()}
                  </div>
                </li>
              ))}
            </ul>
          </Block>
        )}

        {/* Feedback */}
        <Block icon={<MessageSquare className="w-4 h-4 text-blue-600" />} title="Feedback to referring unit">
          <FeedbackPanel
            consultId={consultId}
            referringPhone={c.referring_phone}
            referringName={c.referring_doctor_name}
            history={detail.feedback}
            onSent={reload}
          />
        </Block>

        {/* History */}
        <Block icon={<History className="w-4 h-4 text-gray-600" />} title="History">
          <ol className="text-xs space-y-1">
            {detail.history.map(h => (
              <li key={h.id} className="flex items-start gap-2">
                <CheckCircle2 className="w-3 h-3 text-green-600 mt-0.5 flex-shrink-0" />
                <span className="text-gray-600">
                  <span className="font-medium text-gray-800">{h.to_status}</span>
                  {h.actor_name && <> · {h.actor_name}</>}
                  {h.notes && <> — {h.notes}</>}
                  <span className="text-gray-400"> · {new Date(h.created_at).toLocaleString()}</span>
                </span>
              </li>
            ))}
          </ol>
        </Block>
      </div>
    </DrawerShell>
  );
};

// ── Sub-components ─────────────────────────────────────────────────────
function DrawerShell({ children, onClose }: { children: React.ReactNode; onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-50 flex">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div className="ml-auto w-full max-w-2xl bg-gray-50 h-full overflow-y-auto shadow-2xl relative">
        {children}
      </div>
    </div>
  );
}
function Block({ icon, title, children }: { icon: React.ReactNode; title: string; children: React.ReactNode }) {
  return (
    <section className="bg-white border border-gray-200 rounded-lg p-3">
      <div className="flex items-center gap-2 text-sm font-semibold text-gray-700 mb-2">{icon}<span>{title}</span></div>
      <div className="space-y-2">{children}</div>
    </section>
  );
}
function Field({ label, value }: { label: string; value?: string | null }) {
  if (!value) return null;
  return (
    <div className="text-sm">
      <div className="text-xs uppercase tracking-wide text-gray-500">{label}</div>
      <div className="text-gray-900 whitespace-pre-wrap">{value}</div>
    </div>
  );
}
function TeamRow({ role, name, phone, altPhone }: { role: string; name?: string | null; phone?: string | null; altPhone?: string | null }) {
  const hasName = !!(name && name.trim() && name.trim() !== '()');
  if (!hasName && !phone) return null;
  return (
    <div className="py-1.5 flex items-start justify-between gap-2 flex-wrap">
      <div className="text-sm min-w-0">
        <span className="text-gray-500">{role}:</span>{' '}
        <span className="text-gray-900">{hasName ? name : '—'}</span>
      </div>
      <div className="flex flex-col items-end gap-1">
        {phone && <PhoneActions phone={phone} compact />}
        {altPhone && <PhoneActions phone={altPhone} compact />}
      </div>
    </div>
  );
}

const STAGE_ORDER: ReceivedConsultStatus[] = ['received', 'acknowledged', 'reviewed', 'plan_approved', 'plan_implemented', 'closed'];
function StatusTimeline({ current, consult }: { current: ReceivedConsultStatus; consult: ReceivedConsultDetail['consult'] }) {
  const stamps: Record<string, string | null | undefined> = {
    received:           consult.created_at,
    acknowledged:       consult.acknowledged_at,
    reviewed:           consult.reviewed_at,
    plan_approved:      consult.plan_approved_at,
    plan_implemented:   consult.plan_implemented_at,
    closed:             consult.closed_at,
  };
  const currentIdx = STAGE_ORDER.indexOf(current);
  return (
    <div className="flex items-stretch overflow-x-auto pb-1">
      {STAGE_ORDER.map((s, i) => {
        const meta = STATUS_META[s];
        const done = i <= currentIdx;
        return (
          <div key={s} className="flex items-center flex-shrink-0">
            <div className={`flex flex-col items-center px-2 ${done ? '' : 'opacity-40'}`}>
              <div className={`w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold ${done ? 'bg-green-600 text-white' : 'bg-gray-200 text-gray-500'}`}>{i + 1}</div>
              <div className="mt-1 text-[10px] font-medium text-gray-700 whitespace-nowrap">{meta.label}</div>
              {stamps[s] && <div className="text-[9px] text-gray-400 whitespace-nowrap">{new Date(stamps[s] as string).toLocaleDateString()}</div>}
            </div>
            {i < STAGE_ORDER.length - 1 && <div className={`h-0.5 w-6 ${done ? 'bg-green-500' : 'bg-gray-200'}`} />}
          </div>
        );
      })}
    </div>
  );
}

function StatusAdvanceForm({ currentStatus, nextStatus, busy, onSubmit }: {
  currentStatus: ReceivedConsultStatus;
  nextStatus: ReceivedConsultStatus;
  busy: boolean;
  onSubmit: (p: any) => Promise<void>;
}) {
  const [notes, setNotes] = useState('');
  const [reviewNotes, setReviewNotes] = useState('');
  const [proposedPlan, setProposedPlan] = useState('');
  const [planApprovalNotes, setPlanApprovalNotes] = useState('');
  const [implementationNotes, setImplementationNotes] = useState('');

  const fieldsByNext: Partial<Record<ReceivedConsultStatus, React.ReactNode>> = {
    reviewed: (
      <textarea value={reviewNotes} onChange={(e) => setReviewNotes(e.target.value)} rows={2}
        placeholder="Review notes (clinical findings, immediate concerns)…"
        className="w-full px-2 py-1.5 border border-gray-300 rounded text-sm" />
    ),
    plan_approved: (
      <>
        <textarea value={proposedPlan} onChange={(e) => setProposedPlan(e.target.value)} rows={3}
          placeholder="Proposed management plan…"
          className="w-full px-2 py-1.5 border border-gray-300 rounded text-sm" />
        <textarea value={planApprovalNotes} onChange={(e) => setPlanApprovalNotes(e.target.value)} rows={2}
          placeholder="Approval notes (consultant comments)…"
          className="w-full px-2 py-1.5 border border-gray-300 rounded text-sm" />
      </>
    ),
    plan_implemented: (
      <textarea value={implementationNotes} onChange={(e) => setImplementationNotes(e.target.value)} rows={2}
        placeholder="Implementation notes (procedures done, outcomes)…"
        className="w-full px-2 py-1.5 border border-gray-300 rounded text-sm" />
    ),
  };
  const meta = STATUS_META[nextStatus];

  return (
    <div className="mt-3 space-y-2 bg-gray-50 border border-gray-200 rounded p-2">
      <div className="text-xs text-gray-600">From <b>{STATUS_META[currentStatus].label}</b> → <b className="text-green-700">{meta.label}</b></div>
      {fieldsByNext[nextStatus]}
      <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={1}
        placeholder="Optional comment for audit log…"
        className="w-full px-2 py-1.5 border border-gray-300 rounded text-sm" />
      <button
        disabled={busy}
        onClick={() => onSubmit({
          to_status: nextStatus,
          notes: notes || undefined,
          review_notes: reviewNotes || undefined,
          proposed_plan: proposedPlan || undefined,
          plan_approval_notes: planApprovalNotes || undefined,
          implementation_notes: implementationNotes || undefined,
        })}
        className="px-3 py-1.5 bg-green-600 text-white rounded text-xs font-medium hover:bg-green-700 disabled:bg-gray-300"
      >
        {busy ? 'Updating…' : `Mark as ${meta.label}`}
      </button>
    </div>
  );
}

// ── Attachments manager (photos + OCR) ──────────────────────────────────
const KIND_LABEL: Record<AttachmentKind, string> = {
  clinical_photo: 'Clinical photo',
  investigation_ocr: 'Investigation (OCR)',
  chart_ocr: 'Chart (OCR)',
  digital_chart: 'Digital chart',
  document: 'Document',
};

function AttachmentManager({ consultId, attachments, onChanged, onRecreateChart }: {
  consultId: number;
  attachments: ConsultAttachment[];
  onChanged: () => void;
  onRecreateChart: (a: ConsultAttachment) => void;
}) {
  const [uploading, setUploading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [progress, setProgress] = useState<string | null>(null);

  async function handleFile(file: File, kind: AttachmentKind) {
    setUploading(true); setMessage(null); setProgress(null);
    try {
      let ocrText: string | undefined;
      const ocrStructured: any = undefined;
      let dataUrl: string;

      if (kind === 'clinical_photo') {
        // No OCR — just store the image. Use canvas to downscale.
        dataUrl = await downscaleToDataUrl(file, 1600, 0.85);
      } else {
        // OCR-driven path
        setProgress('Optimising image…');
        const docType = kind === 'chart_ocr' ? 'vital_signs_chart' : 'lab_report';
        const result = await ocrService.extractText(file, docType as any, (p) => setProgress(`${p.status} ${(p.progress * 100).toFixed(0)}%`));
        ocrText = result.text;
        // Re-encode the original file as a smaller data URL for storage
        dataUrl = await downscaleToDataUrl(file, 1800, 0.82);
      }

      await addAttachment('received', consultId, {
        kind,
        file_name: file.name,
        mime_type: file.type || 'image/jpeg',
        data_url: dataUrl,
        ocr_text: ocrText,
        ocr_structured: ocrStructured,
      });
      setMessage('Uploaded');
      onChanged();
    } catch (e: any) {
      setMessage(`Failed: ${e.message || 'unknown error'}`);
    } finally {
      setUploading(false); setProgress(null);
    }
  }

  return (
    <div className="space-y-2">
      <div className="grid grid-cols-3 gap-2">
        <UploadButton label="Photo"        icon={<Camera className="w-4 h-4" />}    onPick={(f) => handleFile(f, 'clinical_photo')} />
        <UploadButton label="Investigation" icon={<FileText className="w-4 h-4" />} onPick={(f) => handleFile(f, 'investigation_ocr')} />
        <UploadButton label="Chart (OCR)"   icon={<Activity className="w-4 h-4" />} onPick={(f) => handleFile(f, 'chart_ocr')} />
      </div>
      {uploading && <div className="text-xs text-gray-500 flex items-center gap-1"><Loader2 className="w-3 h-3 animate-spin" /> {progress || 'Uploading…'}</div>}
      {message && <div className="text-xs text-gray-600">{message}</div>}

      {attachments.length === 0 ? (
        <p className="text-xs text-gray-400">No attachments yet.</p>
      ) : (
        <ul className="space-y-1">
          {attachments.map(a => (
            <li key={a.id} className="bg-gray-50 border border-gray-200 rounded p-2 flex items-start gap-2">
              <div className="flex-1 min-w-0">
                <div className="text-xs font-medium text-gray-800 flex items-center gap-2">
                  <span className="inline-flex items-center px-1.5 py-0.5 bg-white border border-gray-200 rounded text-[10px] text-gray-600">{KIND_LABEL[a.kind]}</span>
                  <span className="truncate">{a.file_name || '—'}</span>
                </div>
                {a.ocr_text && (
                  <details className="text-[11px] text-gray-600 mt-1">
                    <summary className="cursor-pointer">OCR text ({a.ocr_text.length} chars)</summary>
                    <pre className="whitespace-pre-wrap bg-white border border-gray-200 rounded p-2 mt-1 max-h-40 overflow-auto">{a.ocr_text}</pre>
                  </details>
                )}
                <div className="text-[10px] text-gray-400 mt-0.5">{new Date(a.created_at).toLocaleString()}{a.uploaded_by_name ? ` · ${a.uploaded_by_name}` : ''}</div>
              </div>
              <div className="flex flex-col gap-1">
                {a.kind === 'chart_ocr' && (
                  <button onClick={() => onRecreateChart(a)} className="text-[10px] px-2 py-0.5 bg-green-600 text-white rounded hover:bg-green-700">Recreate</button>
                )}
                <button onClick={async () => { await deleteAttachment('received', consultId, a.id); onChanged(); }}
                  className="text-gray-400 hover:text-red-600"><Trash2 className="w-3.5 h-3.5" /></button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function UploadButton({ label, icon, onPick }: { label: string; icon: React.ReactNode; onPick: (file: File) => void }) {
  const inputRef = React.useRef<HTMLInputElement>(null);
  return (
    <>
      <button type="button" onClick={() => inputRef.current?.click()}
        className="flex items-center justify-center gap-1 px-2 py-2 border border-dashed border-gray-300 rounded text-xs text-gray-600 hover:bg-gray-50 hover:border-green-400">
        {icon}<span>{label}</span>
      </button>
      <input ref={inputRef} type="file" accept="image/*" capture="environment" hidden
        onChange={(e) => { const f = e.target.files?.[0]; if (f) onPick(f); e.target.value = ''; }} />
    </>
  );
}

async function downscaleToDataUrl(file: File, maxDim: number, quality: number): Promise<string> {
  const url = URL.createObjectURL(file);
  try {
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const i = new Image();
      i.onload = () => resolve(i); i.onerror = () => reject(new Error('decode failed'));
      i.src = url;
    });
    const long = Math.max(img.naturalWidth, img.naturalHeight);
    const scale = long > maxDim ? maxDim / long : 1;
    const w = Math.round(img.naturalWidth * scale);
    const h = Math.round(img.naturalHeight * scale);
    const canvas = document.createElement('canvas');
    canvas.width = w; canvas.height = h;
    const ctx = canvas.getContext('2d')!;
    ctx.drawImage(img, 0, 0, w, h);
    return canvas.toDataURL('image/jpeg', quality);
  } finally { URL.revokeObjectURL(url); }
}

// ── Feedback panel ──────────────────────────────────────────────────────
function FeedbackPanel({ consultId, referringPhone, referringName, history, onSent }: {
  consultId: number;
  referringPhone: string;
  referringName: string;
  history: ReceivedConsultDetail['feedback'];
  onSent: () => void;
}) {
  const [message, setMessage] = useState('');
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function send() {
    if (!message.trim()) return;
    setSending(true); setError(null);
    try {
      await sendConsultFeedback('received', consultId, { message, channel: 'sms' });
      setMessage(''); onSent();
    } catch (e: any) { setError(e.message || 'Failed to send'); }
    finally { setSending(false); }
  }

  const presets = [
    `Hi ${referringName.split(' ')[0]}, plastic surgery received your consult. We will see the patient shortly.`,
    `Plastic surgery has reviewed the patient. Plan to follow shortly. — PSU`,
    `Plan: please continue current management. We will review again tomorrow. — PSU`,
  ];

  return (
    <div className="space-y-2">
      <div className="text-xs text-gray-500">SMS will be sent to <b>{referringPhone}</b> ({referringName})</div>
      <div className="flex flex-wrap gap-1">
        {presets.map((p, i) => (
          <button key={i} type="button" onClick={() => setMessage(p)}
            className="text-[10px] px-2 py-0.5 bg-blue-50 border border-blue-200 text-blue-700 rounded hover:bg-blue-100">
            Preset {i + 1}
          </button>
        ))}
      </div>
      <textarea value={message} onChange={(e) => setMessage(e.target.value)} rows={3} maxLength={320}
        placeholder="Type your feedback…"
        className="w-full px-2 py-1.5 border border-gray-300 rounded text-sm" />
      <div className="flex items-center justify-between">
        <span className="text-[10px] text-gray-400">{message.length}/320</span>
        <button onClick={send} disabled={sending || !message.trim()}
          className="px-3 py-1 bg-blue-600 text-white rounded text-xs hover:bg-blue-700 disabled:bg-gray-300 flex items-center gap-1">
          <Send className="w-3 h-3" /> {sending ? 'Sending…' : 'Send SMS'}
        </button>
      </div>
      {error && <p className="text-xs text-red-600">{error}</p>}
      {history.length > 0 && (
        <ul className="text-xs space-y-1 mt-2">
          {history.map(f => (
            <li key={f.id} className="bg-gray-50 border border-gray-200 rounded p-2">
              <div className="flex items-center justify-between mb-0.5">
                <span className="text-gray-500">{new Date(f.created_at).toLocaleString()} · {f.sent_by_name || '—'}</span>
                <span className={`px-1.5 py-0.5 rounded text-[10px] ${
                  f.status === 'sent' ? 'bg-green-100 text-green-700'
                  : f.status === 'failed' ? 'bg-red-100 text-red-700'
                  : 'bg-yellow-100 text-yellow-700'
                }`}>{f.status}{f.provider ? ` · ${f.provider}` : ''}</span>
              </div>
              <div className="text-gray-700 whitespace-pre-wrap">{f.message}</div>
              {f.error_message && <div className="text-red-600 text-[10px] mt-1 flex items-center gap-1"><AlertCircle className="w-3 h-3" />{f.error_message}</div>}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export default ConsultDetailDrawer;
