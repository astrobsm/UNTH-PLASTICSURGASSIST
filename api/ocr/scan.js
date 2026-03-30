/**
 * Universal OCR Scan Endpoint
 * POST /api/ocr/scan
 *
 * Accepts image as base64 string, calls Google Cloud Vision API via
 * the centralized ocrService, optionally runs AI post-processing,
 * and returns structured text with confidence scores.
 *
 * Request body (JSON):
 *   image:        string  — base64-encoded image (with or without data URI prefix)
 *   mimeType?:    string  — e.g. 'image/jpeg' (default: auto-detect from data URI or 'image/jpeg')
 *   documentType?: string — 'lab_report' | 'imaging_report' | 'prescription' | 'handwritten_note' | 'general'
 *   aiPostProcess?: boolean — whether to run AI structuring (default: true)
 *   patientContext?: { name, hospitalNumber, ward, diagnosis }
 *
 * Response:
 *   { success, raw_text, structured_blocks, confidence, structured?, documentType, processedAt }
 */

import { performOCR, OCRError } from '../_lib/ocrService.js';

// Max body size guard — Vercel has a 4.5 MB body limit for serverless;
// images are base64 so ~33% overhead
const MAX_BASE64_LENGTH = 15 * 1024 * 1024; // ~10 MB decoded

export default async function handler(req, res) {
  // CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  try {
    let body = req.body;
    if (typeof body === 'string') {
      try { body = JSON.parse(body); } catch { /* already parsed */ }
    }
    if (!body || typeof body !== 'object') {
      return res.status(400).json({ error: 'JSON body required with "image" field' });
    }

    const { image, mimeType: providedMime, documentType, aiPostProcess = true, patientContext } = body;

    if (!image || typeof image !== 'string') {
      return res.status(400).json({ error: '"image" field is required (base64 string)' });
    }

    if (image.length > MAX_BASE64_LENGTH) {
      return res.status(413).json({ error: 'Image too large. Maximum ~10 MB.' });
    }

    // Detect MIME type from data URI prefix if present
    let mimeType = providedMime || 'image/jpeg';
    const dataUriMatch = image.match(/^data:([^;]+);base64,/);
    if (dataUriMatch) {
      mimeType = dataUriMatch[1];
    }

    // Validate MIME
    const allowed = ['image/jpeg', 'image/png', 'image/gif', 'image/webp', 'image/tiff', 'application/pdf'];
    if (!allowed.includes(mimeType)) {
      return res.status(400).json({ error: `Unsupported file type: ${mimeType}. Allowed: ${allowed.join(', ')}` });
    }

    // ─── Run Google Cloud Vision OCR ──────────────────────────────
    const ocrResult = await performOCR(image, mimeType);

    // If no text extracted, return early
    if (!ocrResult.raw_text.trim()) {
      return res.status(200).json({
        success: true,
        raw_text: '',
        structured_blocks: ocrResult.structured_blocks,
        confidence: ocrResult.confidence,
        pages: ocrResult.pages,
        language: ocrResult.language,
        structured: null,
        documentType: documentType || 'general',
        processedAt: new Date().toISOString(),
        message: 'No text detected in image',
      });
    }

    // ─── Optional AI Post-Processing ─────────────────────────────
    let structured = null;
    let aiModel = null;

    if (aiPostProcess) {
      try {
        const openaiApiKey = process.env.OPENAI_API_KEY;
        if (openaiApiKey) {
          const aiResult = await runAIPostProcessing(
            ocrResult.raw_text,
            documentType || 'general',
            patientContext,
            openaiApiKey
          );
          structured = aiResult.structured;
          aiModel = aiResult.model;
        }
      } catch (aiErr) {
        // AI failure is non-fatal — we still return raw OCR results
        console.warn('AI post-processing failed (non-fatal):', aiErr.message);
      }
    }

    return res.status(200).json({
      success: true,
      raw_text: ocrResult.raw_text,
      structured_blocks: ocrResult.structured_blocks,
      confidence: ocrResult.confidence,
      pages: ocrResult.pages,
      language: ocrResult.language,
      structured,
      documentType: documentType || 'general',
      processedAt: new Date().toISOString(),
      aiModel,
    });

  } catch (err) {
    console.error('OCR scan error:', err);

    if (err instanceof OCRError) {
      const statusMap = {
        INVALID_INPUT: 400,
        FILE_TOO_LARGE: 413,
        INVALID_FILE_TYPE: 400,
        NOT_CONFIGURED: 501,
        INVALID_CREDENTIALS: 500,
        AUTH_FAILED: 500,
        VISION_API_ERROR: 502,
        NETWORK_ERROR: 502,
        EMPTY_RESPONSE: 502,
      };
      return res.status(statusMap[err.code] || 500).json({
        error: err.message,
        code: err.code,
        fallback: err.code === 'NOT_CONFIGURED',
      });
    }

    return res.status(500).json({ error: 'Internal server error', message: err.message });
  }
}

// ─── AI Post-Processing (reuses same prompt from api/ai/ocr-process.js) ───
async function runAIPostProcessing(rawText, documentType, patientContext, apiKey) {
  const trimmedText = rawText.length > 15000
    ? rawText.substring(0, 15000) + '\n[...truncated]'
    : rawText;

  let userMessage = `Document type: ${documentType}\n\nRaw OCR Text:\n---\n${trimmedText}\n---`;

  if (patientContext) {
    userMessage += `\n\nPatient Context:\n- Name: ${patientContext.name || 'Unknown'}\n- Hospital Number: ${patientContext.hospitalNumber || 'Unknown'}\n- Ward: ${patientContext.ward || 'Unknown'}\n- Diagnosis: ${patientContext.diagnosis || 'Unknown'}`;
  }

  userMessage += '\n\nPlease extract and structure ALL medical data from this OCR text into the appropriate JSON schema for this document type. Correct obvious OCR errors in medical terminology.';

  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: 'gpt-4o-mini',
      messages: [
        { role: 'system', content: AI_SYSTEM_PROMPT },
        { role: 'user', content: userMessage },
      ],
      temperature: 0.1,
      max_tokens: 4096,
      response_format: { type: 'json_object' },
    }),
  });

  if (!response.ok) {
    throw new Error(`OpenAI API error: ${response.status}`);
  }

  const data = await response.json();
  const content = data.choices?.[0]?.message?.content;
  if (!content) throw new Error('Empty AI response');

  return {
    structured: JSON.parse(content),
    model: 'gpt-4o-mini',
  };
}

const AI_SYSTEM_PROMPT = `You are an expert medical document OCR processor for a plastic surgery department. Analyze raw OCR text and structure it into appropriate medical form fields.

Respond with ONLY valid JSON. For clinical notes (ward_round/review_note/general), use:
{
  "clinical_status": "improved|stable|deteriorating|critical",
  "subjective": "...", "objective": "...", "assessment": "...", "plan": "...",
  "vitals": { "temperature": null, "pulse": null, "bp_systolic": null, "bp_diastolic": null, "respiratory_rate": null, "spo2": null, "pain_score": null },
  "medications": [{"name":"...","dose":"...","route":"...","frequency":"..."}],
  "investigations": [{"type":"lab|imaging","name":"...","result":"...","abnormal":false}],
  "wounds": [{"location":"...","description":"...","size":"...","dressing":"..."}],
  "diagnoses": [], "allergies": [],
  "diet": null, "activity": null, "notes": null, "confidence": 0.8
}

For lab_report: { "results": [{"test_name":"...","result_value":"...","unit":"...","reference_range":"...","abnormal":false,"flag":"normal"}], "specimen_type":"...", "confidence": 0.8 }

For prescription: { "medications": [{"name":"...","dose":"...","route":"...","frequency":"...","duration":"..."}], "confidence": 0.8 }

For imaging_report: { "modality":"...","body_part":"...","findings":"...","impression":"...","confidence": 0.8 }

Rules: Extract ALL medical data. Correct OCR errors in medical terms. Use null for missing fields. Set abnormal flags based on standard ranges.`;
