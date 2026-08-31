// @vitest-environment node
/**
 * The OCR engine chosen for a scan must match what the caller needs back.
 *
 * Document AI is the primary engine and it transcribes well, but it answers
 * with text, blocks and a confidence — there is no `structured` field and no
 * vital_signs_series. An observation chart is a grid of twenty-odd handwritten
 * readings, and ocrService recovers every row from `structured.vital_signs_series`.
 *
 * When Document AI was made primary, the exemption that sends a scan to the
 * vision prompt instead covered only 'handwritten_note'. The client turns
 * useVisionOCR on for the two chart types as well, so those scans were answered
 * by Document AI first and the chart prompts became unreachable: a full
 * post-operative chart came back as one flat transcription and the reading fell
 * to the rule-based scraper, which finds a fraction of the rows.
 *
 * The last test here is the one that matters over time — it reads the condition
 * out of the client and fails if the two sides drift apart again.
 */

import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { shouldPreferVisionOCR, VISION_STRUCTURED_TYPES } from '../../api/_lib/ocrRouting.js';

describe('OCR engine routing', () => {
  it('sends messy handwriting to the vision prompt', () => {
    expect(shouldPreferVisionOCR(true, 'handwritten_note')).toBe(true);
  });

  it('sends observation and fluid charts to the vision prompt', () => {
    // These are the ones the regression broke.
    expect(shouldPreferVisionOCR(true, 'vital_signs_chart')).toBe(true);
    expect(shouldPreferVisionOCR(true, 'fluid_chart')).toBe(true);
  });

  it('leaves ordinary documents with Document AI', () => {
    // A printed lab report is exactly what Document AI is better at, and a
    // general vision model is the one that paraphrases numbers.
    expect(shouldPreferVisionOCR(true, 'lab_report')).toBe(false);
    expect(shouldPreferVisionOCR(true, 'imaging_report')).toBe(false);
    expect(shouldPreferVisionOCR(true, 'general')).toBe(false);
    expect(shouldPreferVisionOCR(true, undefined)).toBe(false);
  });

  it('never diverts a scan the caller did not ask to divert', () => {
    // The raw-OCR path wants a plain transcription and does not set the flag.
    for (const t of VISION_STRUCTURED_TYPES) {
      expect(shouldPreferVisionOCR(false, t)).toBe(false);
    }
  });

  it('covers every document type the client enables vision OCR for', () => {
    // ocrService.ts:
    //   const useVisionOCR = options?.handwritingMode ?? (documentType === 'a' || ...)
    // Any type listed there but missing here goes to Document AI and loses its
    // structured extraction silently.
    const src = readFileSync(
      join(process.cwd(), 'src/services/ocrService.ts'),
      'utf8'
    );
    const line = src.split(/\r?\n/).find(l => l.includes('const useVisionOCR ='));
    expect(line, 'could not find the client-side useVisionOCR condition').toBeTruthy();

    const clientTypes = [...line!.matchAll(/documentType === '([a-z_]+)'/g)].map(m => m[1]);
    expect(clientTypes.length, 'no document types parsed from the client condition').toBeGreaterThan(0);

    for (const t of clientTypes) {
      expect(
        VISION_STRUCTURED_TYPES,
        `ocrService.ts turns useVisionOCR on for "${t}", but api/_lib/ocrRouting.js ` +
        'does not exempt it from Document AI, so its prompt can never run.'
      ).toContain(t);
    }
  });
});
