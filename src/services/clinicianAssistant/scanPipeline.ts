/**
 * Scan several diagnostic reports and merge them into one analysable dataset.
 *
 * This is the path PocketClinician was built around: photograph or upload the
 * paper reports, read the values off them, and interpret everything together
 * rather than one report at a time. Cross-modality correlation is the point —
 * a raised white count means something different alongside a raised creatinine
 * than it does alone.
 *
 * OCR IS THE APP'S EXISTING ENGINE. ocrService already runs Cloud Vision with a
 * local Tesseract fallback, is self-hosted for offline use, and is the thing
 * this app maintains. PocketClinician's own OCR layer was deliberately not
 * ported — a second engine would be a duplicate that drifts. Only the PARSERS
 * came across, and they take text, so they attach to whatever produced it.
 */

import { ocrService } from '../ocrService';
import { classifyReport } from './parse/classify';
import { parseLabValues, resolvePercentages, parseDemographics } from './parse/labParser';
import { parseMicrobiology } from './parse/microParser';
import { parseEcg } from './parse/ecgParser';
import { emptyExtraction, type Extraction } from './engine/context';
import type { PatientContext, ScannedDocument } from './engine/types';

export type ScanStatus = 'queued' | 'reading' | 'parsing' | 'done' | 'failed';

export interface ScannedFile {
  id: string;
  name: string;
  status: ScanStatus;
  /** 0-1 while OCR runs. */
  progress: number;
  /** What the classifier decided this page is. */
  kind?: string;
  /** How many values were read off it. */
  valueCount: number;
  confidence: number;
  error?: string;
  text?: string;
}

export interface ScanResult {
  extraction: Extraction;
  documents: ScannedDocument[];
  files: ScannedFile[];
  /** Demographics read off the reports, for confirming against the record. */
  demographics: ReturnType<typeof parseDemographics> | null;
}

const newId = () => `scan-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

/**
 * Read one file and parse whatever modality it turns out to be.
 *
 * The classifier decides; the caller does not have to tell us what a page is.
 * A clinician handed a stack of reports should not have to sort them first.
 */
async function readOne(
  file: File,
  patient: PatientContext,
  onProgress: (p: number) => void
): Promise<{ file: ScannedFile; extraction: Extraction; document: ScannedDocument | null }> {
  const entry: ScannedFile = {
    id: newId(),
    name: file.name,
    status: 'reading',
    progress: 0,
    valueCount: 0,
    confidence: 0,
  };
  const extraction = emptyExtraction();

  try {
    const ocr = await ocrService.extractText(file, 'lab_report', p => {
      entry.progress = p.progress ?? 0;
      onProgress(entry.progress);
    });

    const text = ocr?.text || '';
    entry.text = text;
    entry.confidence = ocr?.confidence ?? 0;
    entry.status = 'parsing';

    if (!text.trim()) {
      entry.status = 'failed';
      entry.error = 'No text could be read from this page';
      return { file: entry, extraction, document: null };
    }

    const classification = classifyReport(text);
    entry.kind = classification.primary;

    // Laboratory values. Percentages are held back and converted once the white
    // cell count is known — the engine's own routine does that, including
    // correcting a decimal point lost in recognition.
    const lab = parseLabValues(text, patient, entry.id, entry.confidence);
    extraction.analytes.push(...lab.analytes);
    extraction.observations.push(...lab.observations);
    const derived = resolvePercentages(lab, patient, entry.id, entry.confidence);
    extraction.analytes.push(...derived);

    // Microbiology and ECG report text are separate structures, not analytes.
    const micro = parseMicrobiology(text);
    if (micro) extraction.micro.push(micro);

    const ecg = parseEcg(text);
    if (ecg) extraction.ecg.push(ecg);

    entry.valueCount =
      extraction.analytes.length + extraction.micro.length + extraction.ecg.length;
    entry.status = 'done';

    const document: ScannedDocument = {
      id: entry.id,
      fileName: file.name,
      mime: file.type || 'image/*',
      pageCount: 1,
      rawText: text,
      meanConfidence: entry.confidence,
      detectedModules: classification.modules,
      addedAt: new Date().toISOString(),
      status: 'done',
    };

    return { file: entry, extraction, document };
  } catch (err: any) {
    entry.status = 'failed';
    entry.error = err?.message || 'Could not read this page';
    return { file: entry, extraction, document: null };
  }
}

/**
 * Read a batch of reports and merge them.
 *
 * Sequential, not parallel: OCR is CPU-bound in a WebAssembly worker, and
 * running several at once on a ward tablet makes every one of them slower while
 * the interface stops responding.
 *
 * A page that fails is reported and skipped — one unreadable photograph must
 * not discard the four that read cleanly.
 */
export async function scanReports(
  files: File[],
  patient: PatientContext,
  onUpdate?: (files: ScannedFile[]) => void
): Promise<ScanResult> {
  const merged = emptyExtraction();
  const documents: ScannedDocument[] = [];
  const entries: ScannedFile[] = files.map(f => ({
    id: newId(),
    name: f.name,
    status: 'queued' as ScanStatus,
    progress: 0,
    valueCount: 0,
    confidence: 0,
  }));
  onUpdate?.([...entries]);

  let demographics: ScanResult['demographics'] = null;

  for (let i = 0; i < files.length; i++) {
    const { file, extraction, document } = await readOne(files[i], patient, () => {
      entries[i] = { ...entries[i], status: 'reading' };
      onUpdate?.([...entries]);
    });

    entries[i] = file;
    onUpdate?.([...entries]);

    merged.analytes.push(...extraction.analytes);
    merged.observations.push(...extraction.observations);
    merged.micro.push(...extraction.micro);
    merged.ecg.push(...extraction.ecg);
    if (document) documents.push(document);

    // Demographics from the first page that carries them, for the clinician to
    // check against the selected patient — a report belonging to someone else
    // is the failure that matters most here.
    if (!demographics && file.text) {
      const d = parseDemographics(file.text);
      if (d && (d.name || d.hospitalNumber)) demographics = d;
    }
  }

  return { extraction: merged, documents, files: entries, demographics };
}

/**
 * Does the scanned paperwork appear to belong to the selected patient?
 *
 * Returns null when there is nothing to compare. A mismatch is surfaced, never
 * acted on automatically: names are transcribed inconsistently and OCR misreads,
 * so this prompts a human check rather than blocking the analysis.
 */
export function identityWarning(
  scanned: ScanResult['demographics'],
  patient: PatientContext
): string | null {
  if (!scanned) return null;

  const norm = (s: unknown) => String(s || '').toLowerCase().replace(/[^a-z0-9]/g, '');

  const scannedNo = norm(scanned.hospitalNumber);
  const patientNo = norm(patient.hospitalNumber);
  if (scannedNo && patientNo && scannedNo !== patientNo) {
    return `The report carries hospital number "${scanned.hospitalNumber}" but the selected patient is "${patient.hospitalNumber}". Confirm these are the same person before using this analysis.`;
  }

  const scannedName = norm(scanned.name);
  const patientName = norm(patient.name);
  if (scannedName && patientName) {
    // Surnames survive transcription better than full names, so compare tokens
    // rather than the whole string.
    const tokens = String(scanned.name || '').toLowerCase().split(/\s+/).filter(t => t.length > 2);
    const anyMatch = tokens.some(t => patientName.includes(t.replace(/[^a-z0-9]/g, '')));
    if (!anyMatch) {
      return `The report is in the name "${scanned.name}" but the selected patient is "${patient.name}". Confirm these are the same person.`;
    }
  }

  return null;
}
