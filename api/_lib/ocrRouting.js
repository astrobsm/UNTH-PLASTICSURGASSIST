/**
 * Which OCR engine should read this document.
 *
 * Document AI is the primary engine because it transcribes rather than
 * describes: a general vision model reads a page by summarising it, and will
 * occasionally produce a plausible number that was never on the paper. For a
 * clinical document that is the worst possible failure, so text extraction goes
 * to Document AI.
 *
 * But some scans are not asking for a transcription. An observation chart is a
 * grid of twenty-odd handwritten readings, and the client recovers every row
 * from `structured.vital_signs_series`. Document AI has no `structured` field
 * at all — it answers with text, blocks and a confidence — so when it takes one
 * of these scans the chart prompt never runs and the reading collapses to the
 * rule-based scraper, which finds a fraction of the rows.
 *
 * Kept beside the handler and exported so the set can be checked against the
 * document types the client actually turns useVisionOCR on for. When those two
 * drifted, the chart prompts silently became unreachable.
 */

export const VISION_STRUCTURED_TYPES = Object.freeze([
  'handwritten_note',
  'vital_signs_chart',
  'fluid_chart',
]);

/**
 * True when the request should skip Document AI and go to the vision prompt.
 *
 * Requires the caller to have asked for it: a document type alone is not
 * enough, because the raw-OCR path deliberately wants a plain transcription.
 */
export function shouldPreferVisionOCR(useVisionOCR, documentType) {
  return Boolean(useVisionOCR) && VISION_STRUCTURED_TYPES.includes(documentType);
}
