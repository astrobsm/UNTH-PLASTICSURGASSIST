/**
 * Scan a stack of diagnostic reports and merge them into one analysis.
 *
 * Several pages at once is the whole point — cross-modality correlation needs
 * the blood gas, the full blood count and the culture together, and a clinician
 * handed four printouts should not run four separate analyses and reconcile
 * them by eye.
 *
 * The values read off the paper stay visible and editable before anything is
 * interpreted. OCR misreads, and a number nobody checked is a number nobody
 * should act on.
 */

import React, { useRef, useState } from 'react';
import { AlertTriangle, Camera, CheckCircle2, FileText, Loader2, Upload, X } from 'lucide-react';
import {
  scanReports, identityWarning, type ScannedFile, type ScanResult,
} from '../../services/clinicianAssistant/scanPipeline';
import type { PatientContext } from '../../services/clinicianAssistant/engine/types';
import type { Extraction } from '../../services/clinicianAssistant/engine/context';

interface Props {
  patient: PatientContext;
  /** Values already read from the record, so scans can add to them. */
  recordExtraction?: Extraction | null;
  onCancel: () => void;
  onAnalyse: (extraction: Extraction, documents: ScanResult['documents']) => void;
}

const STATUS_LABEL: Record<ScannedFile['status'], string> = {
  queued: 'Waiting',
  reading: 'Reading',
  parsing: 'Parsing',
  done: 'Read',
  failed: 'Failed',
};

export default function ScanReportsPanel({ patient, recordExtraction, onCancel, onAnalyse }: Props) {
  const cameraRef = useRef<HTMLInputElement>(null);
  const galleryRef = useRef<HTMLInputElement>(null);

  const [queue, setQueue] = useState<File[]>([]);
  const [progress, setProgress] = useState<ScannedFile[]>([]);
  const [result, setResult] = useState<ScanResult | null>(null);
  const [scanning, setScanning] = useState(false);
  const [combine, setCombine] = useState(true);

  const addFiles = (list: FileList | null) => {
    if (!list?.length) return;
    setQueue(prev => [...prev, ...Array.from(list)]);
    setResult(null);
  };

  const run = async () => {
    if (!queue.length) return;
    setScanning(true);
    setProgress([]);
    try {
      const r = await scanReports(queue, patient, setProgress);
      setResult(r);
    } finally {
      setScanning(false);
    }
  };

  const warning = result ? identityWarning(result.demographics, patient) : null;

  const merged = (): Extraction => {
    if (!result) return { analytes: [], observations: [], micro: [], ecg: [] };
    if (!combine || !recordExtraction) return result.extraction;
    // Scanned values are appended AFTER the record's, and ClinicalContext keeps
    // the last value for a given analyte — so a freshly scanned result
    // supersedes an older one already on file, which is the behaviour a
    // clinician expects from a report they have just taken off the printer.
    return {
      analytes: [...recordExtraction.analytes, ...result.extraction.analytes],
      observations: [...recordExtraction.observations, ...result.extraction.observations],
      micro: [...recordExtraction.micro, ...result.extraction.micro],
      ecg: [...recordExtraction.ecg, ...result.extraction.ecg],
    };
  };

  const totalValues = result
    ? result.extraction.analytes.length + result.extraction.micro.length + result.extraction.ecg.length
    : 0;

  return (
    <div className="space-y-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="font-semibold text-gray-900">Scan diagnostic reports</h2>
          <p className="text-sm text-gray-600">
            Add every report for this episode — blood count, biochemistry, blood gas, culture,
            ECG. They are interpreted together, which is what makes the correlations possible.
          </p>
        </div>
        <button onClick={onCancel} className="p-1 text-gray-400 hover:text-gray-600"><X className="h-5 w-5" /></button>
      </div>

      <input ref={cameraRef} type="file" accept="image/*" capture="environment" multiple className="hidden"
        onChange={e => { addFiles(e.target.files); e.target.value = ''; }} />
      <input ref={galleryRef} type="file" accept="image/*,application/pdf" multiple className="hidden"
        onChange={e => { addFiles(e.target.files); e.target.value = ''; }} />

      <div className="grid grid-cols-2 gap-2">
        <button
          onClick={() => cameraRef.current?.click()}
          disabled={scanning}
          className="py-5 border-2 border-dashed border-primary-300 rounded-xl text-primary-700 hover:bg-primary-50 flex flex-col items-center gap-1.5 disabled:opacity-60"
        >
          <Camera className="w-5 h-5" />
          <span className="text-sm font-medium">Photograph reports</span>
        </button>
        <button
          onClick={() => galleryRef.current?.click()}
          disabled={scanning}
          className="py-5 border-2 border-dashed border-primary-300 rounded-xl text-primary-700 hover:bg-primary-50 flex flex-col items-center gap-1.5 disabled:opacity-60"
        >
          <Upload className="w-5 h-5" />
          <span className="text-sm font-medium">Upload files or PDFs</span>
        </button>
      </div>

      {queue.length > 0 && !result && (
        <div className="bg-white border rounded-lg p-3">
          <p className="text-sm font-medium text-gray-900 mb-2">{queue.length} page(s) queued</p>
          <ul className="text-xs text-gray-600 space-y-1 mb-3">
            {queue.map((f, i) => (
              <li key={i} className="flex items-center justify-between gap-2">
                <span className="truncate">{f.name}</span>
                {!scanning && (
                  <button
                    onClick={() => setQueue(q => q.filter((_, j) => j !== i))}
                    className="text-red-600 hover:underline"
                  >remove</button>
                )}
              </li>
            ))}
          </ul>
          <button
            onClick={run}
            disabled={scanning}
            className="px-4 py-2 rounded-md bg-primary-600 text-white text-sm font-medium disabled:opacity-50 inline-flex items-center gap-2"
          >
            {scanning ? <Loader2 className="w-4 h-4 animate-spin" /> : <FileText className="w-4 h-4" />}
            {scanning ? 'Reading…' : `Read ${queue.length} page(s)`}
          </button>
          {scanning && (
            <p className="text-xs text-gray-500 mt-2">
              Pages are read one at a time. Recognition runs on this device, so it works with no
              network — but it is slower than a server would be.
            </p>
          )}
        </div>
      )}

      {progress.length > 0 && (
        <div className="bg-white border rounded-lg divide-y">
          {progress.map(f => (
            <div key={f.id} className="p-2.5 flex items-center justify-between gap-3 text-sm">
              <span className="truncate flex-1">{f.name}</span>
              <span className="text-xs text-gray-500 whitespace-nowrap">
                {f.kind ? `${f.kind} · ` : ''}{f.readMethod === 'text-layer' ? 'PDF text · ' : f.readMethod === 'mixed' ? 'PDF mixed · ' : ''}{STATUS_LABEL[f.status]}
                {f.status === 'done' && ` · ${f.valueCount} value(s)`}
              </span>
              {f.status === 'done' && <CheckCircle2 className="w-4 h-4 text-green-600 flex-shrink-0" />}
              {f.status === 'failed' && <AlertTriangle className="w-4 h-4 text-amber-600 flex-shrink-0" />}
              {(f.status === 'reading' || f.status === 'parsing') && (
                <Loader2 className="w-4 h-4 animate-spin text-gray-400 flex-shrink-0" />
              )}
            </div>
          ))}
        </div>
      )}

      {result && (
        <>
          {warning && (
            <div className="bg-red-50 border border-red-300 rounded-lg p-3">
              <p className="text-sm text-red-900 flex gap-2">
                <AlertTriangle className="w-4 h-4 flex-shrink-0 mt-0.5" />
                <span>{warning}</span>
              </p>
            </div>
          )}

          {result.files.some(f => f.status === 'failed') && (
            <div className="bg-amber-50 border border-amber-300 rounded-lg p-3 text-sm text-amber-900">
              {result.files.filter(f => f.status === 'failed').length} page(s) could not be read and
              were skipped. Re-photograph them in better light, or enter those values by hand.
            </div>
          )}

          <div className="bg-white border rounded-lg p-3">
            <p className="text-sm font-medium text-gray-900 mb-2">
              {totalValues} value(s) read from {result.files.filter(f => f.status === 'done').length} page(s)
            </p>

            {result.extraction.analytes.length > 0 && (
              <div className="max-h-56 overflow-y-auto border rounded">
                <table className="w-full text-xs">
                  <thead className="bg-gray-50 sticky top-0">
                    <tr>
                      <th className="text-left p-1.5">Test</th>
                      <th className="text-left p-1.5">Value</th>
                      <th className="text-left p-1.5">Read as</th>
                    </tr>
                  </thead>
                  <tbody>
                    {result.extraction.analytes.map((a, i) => (
                      <tr key={i} className="border-t">
                        <td className="p-1.5">{a.label}</td>
                        <td className="p-1.5 font-mono">{a.value} {a.unit}</td>
                        <td className="p-1.5 text-gray-500">{a.rawText}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            <p className="text-xs text-gray-500 mt-2">
              Check these against the printed reports before analysing. Recognition is not perfect,
              and a misread value produces a confident but wrong interpretation.
            </p>
          </div>

          {recordExtraction && recordExtraction.analytes.length > 0 && (
            <label className="flex items-start gap-2 text-sm text-gray-700">
              <input type="checkbox" checked={combine} onChange={e => setCombine(e.target.checked)} className="mt-0.5" />
              <span>
                Combine with the {recordExtraction.analytes.length} value(s) already in this patient's
                record. Where both hold the same test, the scanned result is treated as the newer one.
              </span>
            </label>
          )}

          <div className="flex gap-2">
            <button
              onClick={() => onAnalyse(merged(), result.documents)}
              disabled={totalValues === 0}
              className="px-4 py-2 rounded-md bg-primary-600 text-white text-sm font-medium disabled:opacity-50"
            >
              Analyse these results
            </button>
            <button onClick={() => { setResult(null); setQueue([]); setProgress([]); }} className="px-4 py-2 border rounded-md text-sm">
              Start again
            </button>
          </div>
        </>
      )}
    </div>
  );
}
