/**
 * Consult status-advance form with OCR scanning of the written review.
 *
 * Residents write the review on paper at the bedside. Every text field of the
 * workflow step can be filled from a photograph of that page:
 *   - "Scan written review" reads the whole page and distributes it across all
 *     of the step's fields (findings, plan, approval, implementation, comment);
 *   - the camera button on a single field reads a page into that field only.
 * Each page scanned is kept and uploaded to the consult's attachments (with its
 * transcription) when the step is saved, so the original handwriting stays on
 * record beside the typed text.
 *
 * Scanned text is a draft: fields filled from a scan are flagged until the
 * resident edits or confirms them against the page.
 */

import React, { useRef, useState } from 'react';
import { Camera, Upload, ScanLine, Loader2, X, FileText, AlertTriangle, CheckCircle2 } from 'lucide-react';
import { ocrService } from '../services/ocrService';
import {
  addAttachment, STATUS_META, updateReceivedStatus,
  type ReceivedConsult, type ReceivedConsultStatus,
} from '../services/consultsModuleService';

export type ReviewField = 'review_notes' | 'proposed_plan' | 'plan_approval_notes' | 'implementation_notes' | 'notes';

const FIELD_META: Record<ReviewField, { label: string; placeholder: string; rows: number }> = {
  review_notes:         { label: 'Review findings',      placeholder: 'Review notes (clinical findings, impression, immediate concerns)…', rows: 4 },
  proposed_plan:        { label: 'Proposed plan',        placeholder: 'Proposed management plan…', rows: 3 },
  plan_approval_notes:  { label: 'Consultant approval',  placeholder: 'Approval notes (consultant comments)…', rows: 2 },
  implementation_notes: { label: 'Implementation',       placeholder: 'Implementation notes (procedures done, outcomes)…', rows: 3 },
  notes:                { label: 'Comment for audit log', placeholder: 'Optional comment for audit log…', rows: 1 },
};

/**
 * Fields captured at each step. The reviewing resident writes findings AND a
 * proposed plan in the same note, so "reviewed" takes both — the plan is then
 * in front of the consultant at "plan approved" instead of being retyped.
 */
const FIELDS_BY_NEXT: Partial<Record<ReceivedConsultStatus, ReviewField[]>> = {
  acknowledged:     ['notes'],
  reviewed:         ['review_notes', 'proposed_plan', 'notes'],
  plan_approved:    ['proposed_plan', 'plan_approval_notes', 'notes'],
  plan_implemented: ['implementation_notes', 'notes'],
  closed:           ['notes'],
};

interface ScannedPage {
  id: string;
  fileName: string;
  mimeType: string;
  previewUrl: string | null;   // object URL for image thumbnails
  dataUrl: string;             // what is uploaded
  text: string;
  structured: Record<string, any> | null;
  target: ReviewField | 'all';
}

type StatusPayload = Parameters<typeof updateReceivedStatus>[1];

const str = (v: unknown) => (typeof v === 'string' ? v.trim() : '');

/** Append scanned text to what is already typed rather than overwrite it. */
function merge(existing: string, incoming: string): string {
  if (!incoming) return existing;
  if (!existing.trim()) return incoming;
  if (existing.includes(incoming)) return existing;
  return `${existing.trimEnd()}\n\n${incoming}`;
}

/** Text for each field from one scanned page. */
export function fieldsFromScan(structured: Record<string, any> | null, rawText: string, fields: ReviewField[]): Partial<Record<ReviewField, string>> {
  const s = structured || {};
  const out: Partial<Record<ReviewField, string>> = {};
  let reviewNotes = str(s.review_notes);
  const dx = str(s.diagnosis);
  if (dx && !reviewNotes.toLowerCase().includes(dx.toLowerCase())) {
    reviewNotes = reviewNotes ? `${reviewNotes}\nImpression: ${dx}` : `Impression: ${dx}`;
  }
  const byField: Record<ReviewField, string> = {
    review_notes: reviewNotes,
    proposed_plan: str(s.proposed_plan),
    plan_approval_notes: str(s.plan_approval_notes),
    implementation_notes: str(s.implementation_notes),
    notes: [str(s.reviewer) && `Written review by ${str(s.reviewer)}${str(s.review_datetime) ? ` (${str(s.review_datetime)})` : ''}`, str(s.notes)]
      .filter(Boolean).join('. '),
  };
  for (const f of fields) if (byField[f]) out[f] = byField[f];
  // Nothing landed in a clinical field (no AI structuring — e.g. offline
  // Tesseract) → the whole transcription goes into the step's main field
  // rather than being lost.
  const clinical = fields.filter(f => f !== 'notes');
  if (clinical.length && !clinical.some(f => out[f]) && rawText.trim()) {
    out[clinical[0]] = rawText.trim();
  }
  return out;
}

export async function downscaleToDataUrl(file: File, maxDim: number, quality: number): Promise<string> {
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

function readAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(r.result as string);
    r.onerror = () => reject(new Error('Could not read file'));
    r.readAsDataURL(file);
  });
}

export function ConsultReviewForm({ consult, nextStatus, busy, onSubmit }: {
  consult: ReceivedConsult;
  nextStatus: ReceivedConsultStatus;
  busy: boolean;
  onSubmit: (payload: StatusPayload) => Promise<void>;
}) {
  const fields = FIELDS_BY_NEXT[nextStatus] || ['notes'];
  const [values, setValues] = useState<Record<ReviewField, string>>(() => ({
    review_notes: '',
    // Carry the plan written at review into the approval step.
    proposed_plan: nextStatus === 'plan_approved' ? (consult.proposed_plan || '') : '',
    plan_approval_notes: '',
    implementation_notes: '',
    notes: '',
  }));
  const [fromScan, setFromScan] = useState<Set<ReviewField>>(new Set());
  const [pages, setPages] = useState<ScannedPage[]>([]);
  const [scanning, setScanning] = useState<ReviewField | 'all' | null>(null);
  const [progress, setProgress] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const setField = (f: ReviewField, v: string) => {
    setValues(prev => ({ ...prev, [f]: v }));
    setFromScan(prev => { if (!prev.has(f)) return prev; const n = new Set(prev); n.delete(f); return n; });
  };

  async function scan(file: File, target: ReviewField | 'all') {
    setScanning(target); setError(null); setProgress('Preparing image…');
    try {
      const result = await ocrService.processDocumentWithAI(
        file, 'consult_review',
        { name: consult.patient_name, hospitalNumber: consult.hospital_number || undefined, ward: consult.ward || undefined, diagnosis: consult.primary_diagnosis || undefined },
        (p) => setProgress(p.status),
        { handwritingMode: true },
      );
      const text = result.text || '';
      const structured = result.aiProcessed ? (result.structuredData || null) : null;
      if (!text.trim() && !structured) throw new Error('No writing was found on that page. Retake the photo in better light, flat and in focus.');

      const wanted = target === 'all' ? fields : [target];
      let extracted = fieldsFromScan(structured, text, wanted);
      // A single-field scan with nothing mapped to that field takes the page as-is.
      if (target !== 'all' && !extracted[target] && text.trim()) extracted = { [target]: text.trim() };
      const filled = Object.keys(extracted) as ReviewField[];
      if (filled.length === 0) throw new Error('The page was read but nothing could be placed into these fields. Type it in, or scan a clearer photo.');

      setValues(prev => {
        const next = { ...prev };
        for (const f of filled) next[f] = merge(prev[f], extracted[f]!);
        return next;
      });
      setFromScan(prev => new Set([...prev, ...filled]));

      const isImage = (file.type || '').startsWith('image/');
      const dataUrl = isImage ? await downscaleToDataUrl(file, 1800, 0.82) : await readAsDataUrl(file);
      setPages(prev => [...prev, {
        id: `${Date.now()}-${prev.length}`,
        fileName: file.name || `review-scan-${prev.length + 1}.jpg`,
        mimeType: isImage ? 'image/jpeg' : (file.type || 'application/octet-stream'),
        previewUrl: isImage ? URL.createObjectURL(file) : null,
        dataUrl, text, structured, target,
      }]);
    } catch (e: any) {
      setError(e?.message || 'Scan failed');
    } finally {
      setScanning(null); setProgress(null);
    }
  }

  function removePage(id: string) {
    setPages(prev => {
      const p = prev.find(x => x.id === id);
      if (p?.previewUrl) URL.revokeObjectURL(p.previewUrl);
      return prev.filter(x => x.id !== id);
    });
  }

  async function submit() {
    setError(null); setSaving(true);
    try {
      // Upload the scanned pages first: if that fails nothing has moved on, and
      // the resident retries with everything still on screen.
      const remaining = [...pages];
      for (const p of pages) {
        await addAttachment('received', consult.id, {
          kind: 'document',
          file_name: p.fileName,
          mime_type: p.mimeType,
          data_url: p.dataUrl,
          ocr_text: p.text || undefined,
          ocr_structured: p.structured || undefined,
          metadata: { source: 'consult_review_scan', stage: nextStatus, target: p.target },
        });
        remaining.shift();
        setPages([...remaining]);
        if (p.previewUrl) URL.revokeObjectURL(p.previewUrl);
      }
      const payload: StatusPayload = { to_status: nextStatus };
      for (const f of fields) if (values[f].trim()) payload[f] = values[f].trim();
      await onSubmit(payload);
    } catch (e: any) {
      setError(`${e?.message || 'Save failed'}${pages.length ? ' — scanned pages not yet uploaded are kept; try again.' : ''}`);
    } finally {
      setSaving(false);
    }
  }

  const meta = STATUS_META[nextStatus];
  const working = busy || saving || scanning !== null;
  const unconfirmed = fields.filter(f => fromScan.has(f));

  return (
    <div className="mt-3 space-y-2 bg-gray-50 border border-gray-200 rounded p-2">
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <div className="text-xs text-gray-600">From <b>{STATUS_META[consult.status].label}</b> → <b className="text-green-700">{meta.label}</b></div>
        <ScanButtons
          label="Scan written review"
          disabled={working}
          onPick={(f) => scan(f, 'all')}
        />
      </div>
      {scanning === 'all' && <ScanProgress text={progress} />}

      {fields.map(f => (
        <div key={f}>
          <div className="flex items-center justify-between gap-2 mb-0.5">
            <span className="text-[11px] font-medium text-gray-600">
              {FIELD_META[f].label}
              {fromScan.has(f) && <span className="ml-1.5 px-1.5 py-0.5 rounded bg-amber-100 text-amber-800 text-[10px]">from scan — check against the page</span>}
            </span>
            <ScanButtons compact disabled={working} onPick={(file) => scan(file, f)} />
          </div>
          {scanning === f && <ScanProgress text={progress} />}
          <textarea
            value={values[f]}
            onChange={(e) => setField(f, e.target.value)}
            rows={FIELD_META[f].rows}
            placeholder={FIELD_META[f].placeholder}
            className={`w-full px-2 py-1.5 border rounded text-sm ${fromScan.has(f) ? 'border-amber-300 bg-amber-50/40' : 'border-gray-300'}`}
          />
        </div>
      ))}

      {pages.length > 0 && (
        <div className="space-y-1">
          <div className="text-[11px] font-medium text-gray-600">Scanned pages — attached to the consult when you save</div>
          <div className="flex flex-wrap gap-2">
            {pages.map(p => (
              <div key={p.id} className="relative w-20 h-24 border border-gray-300 rounded bg-white overflow-hidden" title={p.text.slice(0, 400)}>
                {p.previewUrl
                  ? <img src={p.previewUrl} alt={p.fileName} className="w-full h-full object-cover" />
                  : <div className="w-full h-full flex flex-col items-center justify-center text-gray-400"><FileText className="w-6 h-6" /><span className="text-[9px] px-1 truncate w-full text-center">{p.fileName}</span></div>}
                <span className="absolute bottom-0 inset-x-0 bg-black/50 text-white text-[9px] text-center truncate px-0.5">
                  {p.target === 'all' ? 'Whole review' : FIELD_META[p.target].label}
                </span>
                <button type="button" onClick={() => removePage(p.id)} disabled={saving}
                  className="absolute top-0.5 right-0.5 bg-white/90 rounded-full p-0.5 text-gray-600 hover:text-red-600">
                  <X className="w-3 h-3" />
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {unconfirmed.length > 0 && (
        <p className="text-[11px] text-amber-800 flex items-start gap-1">
          <AlertTriangle className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" />
          Handwriting recognition can misread words and numbers. Check the highlighted fields against the page before saving.
        </p>
      )}
      {error && <p className="text-xs text-red-600 flex items-start gap-1"><AlertTriangle className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" />{error}</p>}

      <button
        disabled={working}
        onClick={submit}
        className="px-3 py-1.5 bg-green-600 text-white rounded text-xs font-medium hover:bg-green-700 disabled:bg-gray-300 inline-flex items-center gap-1"
      >
        {saving || busy
          ? <><Loader2 className="w-3.5 h-3.5 animate-spin" /> {pages.length ? 'Uploading scans…' : 'Updating…'}</>
          : <><CheckCircle2 className="w-3.5 h-3.5" /> Mark as {meta.label}{pages.length ? ` + attach ${pages.length} scan${pages.length > 1 ? 's' : ''}` : ''}</>}
      </button>
    </div>
  );
}

/** Camera (capture) + upload (gallery/PDF) pickers. */
function ScanButtons({ label, compact, disabled, onPick }: {
  label?: string; compact?: boolean; disabled?: boolean; onPick: (f: File) => void;
}) {
  const cameraRef = useRef<HTMLInputElement>(null);
  const uploadRef = useRef<HTMLInputElement>(null);
  const pick = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    e.target.value = '';
    if (f) onPick(f);
  };
  const base = 'inline-flex items-center gap-1 rounded border disabled:opacity-40 disabled:cursor-not-allowed';
  return (
    <span className="inline-flex items-center gap-1">
      {compact ? (
        <>
          <button type="button" disabled={disabled} onClick={() => cameraRef.current?.click()} title="Scan a page into this field"
            className={`${base} px-1.5 py-0.5 text-[10px] border-gray-300 bg-white text-gray-600 hover:border-green-400 hover:text-green-700`}>
            <Camera className="w-3 h-3" /> Scan
          </button>
          <button type="button" disabled={disabled} onClick={() => uploadRef.current?.click()} title="Upload a photo or PDF into this field"
            className={`${base} px-1.5 py-0.5 text-[10px] border-gray-300 bg-white text-gray-600 hover:border-green-400 hover:text-green-700`}>
            <Upload className="w-3 h-3" />
          </button>
        </>
      ) : (
        <>
          <button type="button" disabled={disabled} onClick={() => cameraRef.current?.click()}
            className={`${base} px-2 py-1 text-xs border-green-600 bg-green-600 text-white hover:bg-green-700`}>
            <ScanLine className="w-3.5 h-3.5" /> {label}
          </button>
          <button type="button" disabled={disabled} onClick={() => uploadRef.current?.click()} title="Upload a photo or PDF of the review"
            className={`${base} px-2 py-1 text-xs border-green-600 bg-white text-green-700 hover:bg-green-50`}>
            <Upload className="w-3.5 h-3.5" /> Upload
          </button>
        </>
      )}
      <input ref={cameraRef} type="file" accept="image/*" capture="environment" hidden onChange={pick} />
      <input ref={uploadRef} type="file" accept="image/*,application/pdf" hidden onChange={pick} />
    </span>
  );
}

function ScanProgress({ text }: { text: string | null }) {
  return (
    <div className="text-xs text-gray-500 flex items-center gap-1">
      <Loader2 className="w-3 h-3 animate-spin" /> {text || 'Reading handwriting…'}
    </div>
  );
}

export default ConsultReviewForm;
