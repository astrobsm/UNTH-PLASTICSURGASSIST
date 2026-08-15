/**
 * Google Document AI OCR.
 *
 * This is the primary text-extraction engine for scanned clinical documents:
 * lab reports, discharge summaries, referral letters, handwritten notes. It is
 * purpose-built for documents, where the alternatives are not — a general vision
 * model reads a page by describing it, which is why it paraphrases and
 * occasionally invents a plausible number.
 *
 * FALLBACK CHAIN, and why it exists
 *   1. Document AI          most accurate on printed documents, needs network
 *   2. GPT-4o Vision        better on messy handwriting, needs network
 *   3. Tesseract in-browser slower and less accurate, but works with NO network
 *
 * The third link is not redundancy for its own sake. This application is
 * offline-first by requirement, and a clinician on a ward with no signal must
 * still be able to scan a report. Document AI is cloud-only, so removing
 * Tesseract would silently delete that capability.
 *
 * Returns null when unconfigured or on any failure, so a caller falls through
 * rather than failing the request.
 */

import { getAccessToken, getProjectId } from './googleAuth.js';

/** Whether Document AI is configured for this deployment. */
export function isDocumentAiConfigured() {
  return Boolean(
    process.env.DOCUMENT_AI_PROCESSOR_ID &&
    process.env.GOOGLE_APPLICATION_CREDENTIALS_JSON
  );
}

/** Location must match where the processor was created; a mismatch 404s. */
function getLocation() {
  return process.env.DOCUMENT_AI_LOCATION || 'us';
}

function endpointFor(projectId, location, processorId) {
  // Regional endpoints are mandatory outside `us` — calling the global host for
  // an `eu` processor fails rather than redirecting.
  return `https://${location}-documentai.googleapis.com/v1/projects/${projectId}` +
    `/locations/${location}/processors/${processorId}:process`;
}

/** Strips a data: URL prefix if one is present, leaving raw base64. */
export function stripDataUrl(input) {
  if (typeof input !== 'string') return '';
  const comma = input.indexOf(',');
  return input.startsWith('data:') && comma > -1 ? input.slice(comma + 1) : input;
}

/**
 * Mean of the per-token confidences Document AI reports.
 *
 * The API gives confidence per detected token rather than per page. Averaging
 * is a rough summary, but it is honest about being one, and it lets a caller
 * apply the same threshold it applies to the other engines.
 */
export function averageConfidence(document) {
  const pages = document?.pages || [];
  let total = 0, count = 0;
  for (const page of pages) {
    for (const token of page.tokens || []) {
      const c = token.layout?.confidence;
      if (typeof c === 'number') { total += c; count++; }
    }
  }
  return count ? total / count : 0;
}

/**
 * Text blocks with their bounding boxes, matching the shape the OCR client
 * already consumes from the existing endpoint.
 */
export function extractBlocks(document) {
  const text = document?.text || '';
  const blocks = [];
  for (const page of document?.pages || []) {
    for (const block of page.blocks || []) {
      const seg = block.layout?.textAnchor?.textSegments?.[0];
      if (!seg) continue;
      const start = Number(seg.startIndex || 0);
      const end = Number(seg.endIndex || 0);
      blocks.push({
        text: text.slice(start, end),
        confidence: block.layout?.confidence ?? 0,
        boundingBox: (block.layout?.boundingPoly?.normalizedVertices || []).map(v => ({
          x: v.x ?? 0, y: v.y ?? 0,
        })),
      });
    }
  }
  return blocks;
}

/**
 * Run a document through the processor.
 *
 * @param {string} imageBase64 raw base64 or a data: URL
 * @param {string} mimeType    e.g. image/jpeg, image/png, application/pdf
 * @returns {Promise<{raw_text: string, confidence: number, blocks: Array, pageCount: number, engine: string}|null>}
 */
export async function processDocument(imageBase64, mimeType = 'image/jpeg') {
  if (!isDocumentAiConfigured()) return null;

  const projectId = getProjectId();
  const processorId = process.env.DOCUMENT_AI_PROCESSOR_ID;
  const location = getLocation();
  if (!projectId) {
    console.error('[documentai] no project_id in the service account credentials');
    return null;
  }

  const token = await getAccessToken();
  if (!token) return null;

  try {
    const res = await fetch(endpointFor(projectId, location, processorId), {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        skipHumanReview: true,
        rawDocument: {
          content: stripDataUrl(imageBase64),
          mimeType,
        },
      }),
    });

    if (!res.ok) {
      const detail = await res.text().catch(() => '');
      // 403 usually means the Document AI API is not enabled on the project or
      // the service account lacks the Document AI API User role; 404 usually
      // means the processor id or region is wrong. Both are worth saying.
      console.warn('[documentai] process failed:', res.status, detail.slice(0, 300));
      return null;
    }

    const body = await res.json();
    const document = body?.document;
    if (!document?.text) return null;

    return {
      raw_text: document.text,
      confidence: averageConfidence(document),
      blocks: extractBlocks(document),
      pageCount: (document.pages || []).length,
      engine: 'google-document-ai',
    };
  } catch (err) {
    console.warn('[documentai] request threw:', err?.message || err);
    return null;
  }
}
