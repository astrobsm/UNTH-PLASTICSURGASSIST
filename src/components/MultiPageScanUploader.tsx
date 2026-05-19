/**
 * MultiPageScanUploader
 * ---------------------
 * Reusable component that lets the user capture or upload MULTIPLE pages
 * (e.g. encounter notes, vital signs charts, wound photos) and optionally
 * run OCR across all of them. Each page can be removed or reordered.
 *
 * Designed for mobile-first clinical use — large tap targets, camera-first.
 *
 * Usage:
 *   <MultiPageScanUploader
 *     pages={pages}
 *     onChange={setPages}
 *     enableOCR
 *     onOCRComplete={(text) => appendToNote(text)}
 *     label="Scan note pages"
 *   />
 */
import React, { useRef, useState, useCallback } from 'react';
import { Camera, Upload, X, ScanLine, Loader2, ChevronUp, ChevronDown, FileImage } from 'lucide-react';
import { ocrService } from '../services/ocrService';

export interface ScannedPage {
  id: string;
  /** base64 data URL or remote URL */
  dataUrl: string;
  /** original filename if uploaded */
  name?: string;
  /** OCR-extracted text once processed */
  ocrText?: string;
  /** caption / label the user may attach (e.g. "Page 2 - Vitals") */
  caption?: string;
}

interface Props {
  pages: ScannedPage[];
  onChange: (pages: ScannedPage[]) => void;
  /** Show the "Run OCR on all pages" button */
  enableOCR?: boolean;
  /** Called with concatenated OCR text when scanning finishes */
  onOCRComplete?: (allText: string, perPage: ScannedPage[]) => void;
  /** Document type hint passed to ocrService */
  documentType?: 'medical_form' | 'lab_results' | 'prescription' | 'general';
  /** Label rendered above the controls */
  label?: string;
  /** Optional helper text under the label */
  helper?: string;
  /** Allow users to add a caption per page (default true) */
  allowCaption?: boolean;
  /** Disable the whole control */
  disabled?: boolean;
}

const fileToDataUrl = (file: File): Promise<string> =>
  new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(String(r.result));
    r.onerror = reject;
    r.readAsDataURL(file);
  });

export const MultiPageScanUploader: React.FC<Props> = ({
  pages,
  onChange,
  enableOCR = false,
  onOCRComplete,
  documentType = 'general',
  label = 'Scan / upload pages',
  helper,
  allowCaption = true,
  disabled = false,
}) => {
  const cameraRef = useRef<HTMLInputElement>(null);
  const uploadRef = useRef<HTMLInputElement>(null);
  const [ocrInProgress, setOcrInProgress] = useState(false);
  const [ocrProgress, setOcrProgress] = useState<{ page: number; total: number; pct: number }>({ page: 0, total: 0, pct: 0 });

  const addFiles = useCallback(
    async (files: FileList | File[]) => {
      const list = Array.from(files);
      const next: ScannedPage[] = [];
      for (const f of list) {
        if (!f.type.startsWith('image/')) continue;
        try {
          const dataUrl = await fileToDataUrl(f);
          next.push({ id: `pg_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`, dataUrl, name: f.name });
        } catch {
          /* skip */
        }
      }
      if (next.length) onChange([...pages, ...next]);
    },
    [pages, onChange]
  );

  const onCameraChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files?.length) addFiles(e.target.files);
    e.target.value = '';
  };

  const onUploadChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files?.length) addFiles(e.target.files);
    e.target.value = '';
  };

  const removePage = (id: string) => onChange(pages.filter((p) => p.id !== id));

  const movePage = (id: string, dir: -1 | 1) => {
    const idx = pages.findIndex((p) => p.id === id);
    if (idx < 0) return;
    const target = idx + dir;
    if (target < 0 || target >= pages.length) return;
    const copy = pages.slice();
    [copy[idx], copy[target]] = [copy[target], copy[idx]];
    onChange(copy);
  };

  const updateCaption = (id: string, caption: string) => {
    onChange(pages.map((p) => (p.id === id ? { ...p, caption } : p)));
  };

  const runOCR = async () => {
    if (!pages.length) return;
    setOcrInProgress(true);
    setOcrProgress({ page: 0, total: pages.length, pct: 0 });
    const updated: ScannedPage[] = [];
    try {
      for (let i = 0; i < pages.length; i++) {
        const page = pages[i];
        setOcrProgress({ page: i + 1, total: pages.length, pct: 0 });
        let ocrText = page.ocrText || '';
        if (!ocrText) {
          try {
            const result = await ocrService.extractText(
              page.dataUrl,
              documentType as any,
              (p: any) => setOcrProgress((cur) => ({ ...cur, pct: Math.round((p?.progress ?? 0) * 100) }))
            );
            ocrText = result?.text || '';
          } catch (err) {
            console.warn('OCR failed for page', i + 1, err);
          }
        }
        updated.push({ ...page, ocrText });
      }
      onChange(updated);
      const combined = updated
        .map((p, i) => {
          const cap = p.caption ? ` — ${p.caption}` : '';
          return `--- Page ${i + 1}${cap} ---\n${(p.ocrText || '').trim()}`;
        })
        .join('\n\n');
      onOCRComplete?.(combined, updated);
    } finally {
      setOcrInProgress(false);
    }
  };

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="min-w-0">
          <label className="block text-sm font-medium text-gray-700">{label}</label>
          {helper && <p className="text-xs text-gray-500 mt-0.5">{helper}</p>}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => cameraRef.current?.click()}
            disabled={disabled || ocrInProgress}
            className="inline-flex items-center gap-1.5 px-3 py-2 bg-green-600 text-white text-sm rounded-lg hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed"
            title="Use camera to capture a page"
          >
            <Camera className="w-4 h-4" /> Capture
          </button>
          <button
            type="button"
            onClick={() => uploadRef.current?.click()}
            disabled={disabled || ocrInProgress}
            className="inline-flex items-center gap-1.5 px-3 py-2 bg-sky-100 text-navy-900 text-sm rounded-lg hover:bg-sky-200 border border-sky-300 disabled:opacity-50 disabled:cursor-not-allowed"
            title="Upload one or more images"
          >
            <Upload className="w-4 h-4" /> Upload
          </button>
          {enableOCR && pages.length > 0 && (
            <button
              type="button"
              onClick={runOCR}
              disabled={disabled || ocrInProgress}
              className="inline-flex items-center gap-1.5 px-3 py-2 bg-purple-600 text-white text-sm rounded-lg hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed"
              title="Run OCR on all captured pages and append the text"
            >
              {ocrInProgress ? <Loader2 className="w-4 h-4 animate-spin" /> : <ScanLine className="w-4 h-4" />}
              {ocrInProgress ? `OCR ${ocrProgress.page}/${ocrProgress.total}…` : `OCR ${pages.length} page${pages.length > 1 ? 's' : ''}`}
            </button>
          )}
        </div>
      </div>

      {/* Hidden inputs */}
      <input ref={cameraRef} type="file" accept="image/*" capture="environment" multiple onChange={onCameraChange} className="hidden" />
      <input ref={uploadRef} type="file" accept="image/*" multiple onChange={onUploadChange} className="hidden" />

      {ocrInProgress && (
        <div className="bg-purple-50 border border-purple-200 rounded-lg p-3">
          <div className="flex items-center justify-between text-xs text-purple-800 mb-1">
            <span>Scanning page {ocrProgress.page} of {ocrProgress.total}…</span>
            <span>{ocrProgress.pct}%</span>
          </div>
          <div className="w-full bg-purple-100 rounded-full h-1.5">
            <div className="bg-purple-600 h-1.5 rounded-full transition-all" style={{ width: `${ocrProgress.pct}%` }} />
          </div>
        </div>
      )}

      {pages.length === 0 ? (
        <div className="border-2 border-dashed border-gray-200 rounded-lg p-6 text-center text-gray-400">
          <FileImage className="w-8 h-8 mx-auto mb-2 opacity-60" />
          <p className="text-sm">No pages added yet. Use <strong>Capture</strong> for camera or <strong>Upload</strong> to attach files.</p>
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
          {pages.map((page, idx) => (
            <div key={page.id} className="relative border border-gray-200 rounded-lg overflow-hidden bg-white group">
              <div className="aspect-[3/4] bg-gray-100 relative">
                <img src={page.dataUrl} alt={page.caption || page.name || `Page ${idx + 1}`} className="w-full h-full object-cover" />
                <div className="absolute top-1 left-1 px-1.5 py-0.5 rounded bg-black/60 text-white text-[10px] font-semibold">
                  {idx + 1}
                </div>
                <button
                  type="button"
                  onClick={() => removePage(page.id)}
                  disabled={disabled || ocrInProgress}
                  className="absolute top-1 right-1 p-1 rounded-full bg-red-600 text-white opacity-90 hover:opacity-100 disabled:opacity-40"
                  title="Remove this page"
                >
                  <X className="w-3 h-3" />
                </button>
                <div className="absolute bottom-1 right-1 flex flex-col gap-1">
                  <button
                    type="button"
                    onClick={() => movePage(page.id, -1)}
                    disabled={disabled || ocrInProgress || idx === 0}
                    className="p-1 rounded bg-white/90 text-gray-700 hover:bg-white disabled:opacity-40"
                    title="Move up"
                  >
                    <ChevronUp className="w-3 h-3" />
                  </button>
                  <button
                    type="button"
                    onClick={() => movePage(page.id, 1)}
                    disabled={disabled || ocrInProgress || idx === pages.length - 1}
                    className="p-1 rounded bg-white/90 text-gray-700 hover:bg-white disabled:opacity-40"
                    title="Move down"
                  >
                    <ChevronDown className="w-3 h-3" />
                  </button>
                </div>
                {page.ocrText && (
                  <div className="absolute bottom-1 left-1 px-1.5 py-0.5 rounded bg-purple-600 text-white text-[10px] font-semibold">
                    OCR
                  </div>
                )}
              </div>
              {allowCaption && (
                <input
                  type="text"
                  value={page.caption || ''}
                  onChange={(e) => updateCaption(page.id, e.target.value)}
                  placeholder={page.name || `Page ${idx + 1}`}
                  disabled={disabled || ocrInProgress}
                  className="w-full px-2 py-1 text-xs border-t border-gray-200 focus:outline-none focus:bg-sky-50"
                />
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default MultiPageScanUploader;
