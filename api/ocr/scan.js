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
import { chatCompletion } from '../_lib/openai.js';
import { OCR_EXTRACTION_PROMPT } from '../_lib/ocrPrompts.js';

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

    const { image, mimeType: providedMime, documentType, aiPostProcess = true, patientContext, useVisionOCR = false } = body;

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

    // ─── GPT-4o Vision Direct OCR (for handwriting) ──────────────
    const openaiApiKey = process.env.OPENAI_API_KEY;
    if (useVisionOCR && openaiApiKey) {
      try {
        const visionResult = await runGPT4oVisionOCR(image, mimeType, documentType || 'handwritten_note', patientContext, openaiApiKey);
        return res.status(200).json({
          success: true,
          raw_text: visionResult.raw_text,
          structured_blocks: [],
          confidence: visionResult.confidence,
          pages: 1,
          language: 'en',
          structured: visionResult.structured,
          documentType: visionResult.documentType || documentType || 'handwritten_note',
          processedAt: new Date().toISOString(),
          aiModel: visionResult.model,
          visionOCR: true,
        });
      } catch (visionErr) {
        console.warn('GPT-4o Vision OCR failed, falling back to Cloud Vision:', visionErr.message);
        // Fall through to standard Cloud Vision pipeline
      }
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

// ─── GPT-4o Vision Direct OCR (superior handwriting recognition) ───
const VISION_OCR_SYSTEM_PROMPT = `You are an expert medical document OCR and handwriting recognition system for a plastic surgery / clinical department. You are looking at a photograph of a medical document that may contain handwritten notes, printed text, or a mix of both.

Your task:
1. Read and transcribe ALL text in the image as accurately as possible, including handwritten portions
2. Correct likely medical abbreviations and terms (e.g. "Hb" → Hemoglobin context, "BP" → Blood Pressure)
3. Structure the extracted data into the appropriate medical schema
4. For handwritten text that is ambiguous, provide your best interpretation with [?] marker for uncertain words

Respond with ONLY valid JSON in this format:
{
  "raw_text": "Complete transcription of all text in the image, preserving layout with newlines",
  "document_type": "ward_round|lab_report|prescription|imaging_report|handwritten_note|general",
  "confidence": 0.0 to 1.0,
  "handwriting_detected": true/false,
  "structured": {
    For clinical notes: { "clinical_status", "subjective", "objective", "assessment", "plan", "vitals": { "temperature", "pulse", "bp_systolic", "bp_diastolic", "respiratory_rate", "spo2", "pain_score" }, "medications": [{"name","dose","route","frequency"}], "investigations": [{"type","name","result","abnormal"}], "wounds": [{"location","description","size","dressing"}], "diagnoses": [], "allergies": [], "diet", "activity", "notes", "confidence" },
    For lab_report: { "results": [{"test_name","result_value","unit","reference_range","abnormal","flag"}], "specimen_type", "confidence" },
    For prescription: { "medications": [{"name","dose","route","frequency","duration","instructions"}], "confidence" },
    For imaging_report: { "modality","body_part","findings","impression","confidence" }
  }
}

IMPORTANT:
- Read handwriting character by character when needed — you are excellent at this
- Use medical context to disambiguate unclear characters (e.g. "1" vs "l", "0" vs "O")
- Extract ALL data including dates, signatures, patient identifiers visible in the document
- For vitals written in shorthand like "T37.2 P80 BP120/80 RR18 SpO2 98%", parse each value
- Recognize common medical handwriting patterns: medication names, dosages, SOAP notes format`;

// ─── Specialized Vital Signs Chart Extraction Prompt ──────────────
const VITAL_SIGNS_CHART_PROMPT = `You are an expert medical vital signs chart reader. You are looking at a photograph of a hospital vital signs monitoring chart (observation chart / TPR chart). These charts typically contain handwritten recordings of patient vital signs taken at different times.

Your task:
1. Identify EVERY vital sign reading recorded on this chart
2. Extract the date AND time for each reading
3. Extract all available parameters: temperature, pulse, blood pressure (systolic/diastolic), respiratory rate, SpO2, weight, urine output, pain score
4. Readings may be organized as rows (each row = one time point) or columns (each column = one time point)
5. For handwritten numbers, use medical context to disambiguate (e.g. temperature is 35-42°C range, pulse 40-200, BP systolic 60-250, SpO2 70-100%)

Respond with ONLY valid JSON in this format:
{
  "raw_text": "Complete transcription preserving layout",
  "confidence": 0.0 to 1.0,
  "handwriting_detected": true,
  "vital_signs_series": [
    {
      "date": "D/M/YYYY",
      "time": "HH:MM",
      "datetime": "YYYY-MM-DDTHH:MM:SS",
      "temperature": null,
      "pulse": null,
      "bp_systolic": null,
      "bp_diastolic": null,
      "respiratory_rate": null,
      "spo2": null,
      "weight": null,
      "urine_output": null,
      "pain_score": null
    }
  ]
}

IMPORTANT:
- Extract ALL reading time points, even if some parameters are missing for that time
- Use null for parameters not recorded at a particular time
- CRITICAL: Each reading has a UNIQUE time recorded in the Time column — extract it precisely
- The Time column is usually the first or leftmost column and contains entries like "12:30", "3:00pm", "6am", "7:32pm", "2:40"
- Each row in the chart is a DIFFERENT time point — never assign the same time to multiple readings
- Dates may be written as D/M/YY (Nigerian format) — convert to D/M/YYYY (e.g. 7/4/26 → 7/4/2026)
- Date headers may appear once for a group of readings — apply that date to all readings below it until the next date header
- Times may be in 12-hour (3pm, 6am) or 24-hour format — normalize to HH:MM (24-hour)
- The "datetime" field MUST combine the correct date AND time for each reading
- Blood pressure is often written as "120/80" — split into bp_systolic=120, bp_diastolic=80
- Temperature may be in °C (typical: 35-42) or °F (typical: 96-104) — always output in °C
- Sort readings chronologically
- Include datetime as ISO format combining the row's date and time`;

const FLUID_CHART_PROMPT = `You are an expert medical fluid balance chart reader. You are reading a photograph of a hospital intake/output (I&O) or fluid balance chart. These are typically handwritten on standard hospital forms.

Extract ALL fluid entries and return as JSON:
{
  "date": "YYYY-MM-DD",
  "entries": [
    {
      "time": "HH:MM",
      "type": "input" | "output",
      "fluid_type": "e.g. Normal Saline, Ringers Lactate, Urine, Drain, Blood",
      "route": "IV | Oral | NG | Drain | Catheter | Other",
      "volume_ml": number,
      "rate_ml_hr": number | null,
      "notes": "any additional notes"
    }
  ],
  "subtotals": {
    "total_input_ml": number,
    "total_output_ml": number,
    "net_balance_ml": number
  }
}

IMPORTANT:
- Nigerian hospitals commonly use: N/S (Normal Saline), R/L (Ringer's Lactate), D5W (5% Dextrose), D/S (Dextrose Saline)
- Output categories: Urine, Drain, NGT aspirate, Vomitus, Wound drainage
- Volumes may be in ml or litres — convert all to ml
- Times may be in 12-hour or 24-hour format — standardize to 24-hour
- If handwriting is unclear, provide best estimate with a note
- Include running totals if visible on chart`;

async function runGPT4oVisionOCR(base64Image, mimeType, documentType, patientContext, apiKey) {
  // Strip data URI prefix if present, then re-add for the API
  const cleanBase64 = base64Image.replace(/^data:[^;]+;base64,/, '');
  const dataUri = `data:${mimeType || 'image/jpeg'};base64,${cleanBase64}`;

  // Use specialized prompt for vital signs charts or fluid charts
  const isVitalSignsChart = documentType === 'vital_signs_chart';
  const isFluidChart = documentType === 'fluid_chart';
  const systemPrompt = isVitalSignsChart ? VITAL_SIGNS_CHART_PROMPT : isFluidChart ? FLUID_CHART_PROMPT : VISION_OCR_SYSTEM_PROMPT;

  let userMessage = isVitalSignsChart
    ? 'Please read this vital signs monitoring chart and extract ALL vital sign readings with their dates and times.'
    : isFluidChart
    ? 'Please read this fluid balance/intake-output chart and extract ALL fluid entries with times, types, routes, and volumes.'
    : `Please read and transcribe all text from this medical document image. Document type hint: ${documentType || 'general'}.`;

  if (patientContext) {
    userMessage += `\n\nPatient context: ${patientContext.name || 'Unknown'}, Hospital# ${patientContext.hospitalNumber || 'Unknown'}, Ward: ${patientContext.ward || 'Unknown'}, Diagnosis: ${patientContext.diagnosis || 'Unknown'}`;
  }

  if (!isVitalSignsChart) {
    userMessage += '\n\nExtract ALL text including handwritten portions and structure into the JSON schema. Pay special attention to handwriting accuracy.';
  }

  // Shared helper: hard timeout + retry on 429/5xx (image OCR is the most
  // rate-limit-prone call). Longer timeout since high-detail vision is slow.
  const content = await chatCompletion({
    model: 'gpt-4o',
    messages: [
      { role: 'system', content: systemPrompt },
      {
        role: 'user',
        content: [
          { type: 'text', text: userMessage },
          { type: 'image_url', image_url: { url: dataUri, detail: 'high' } },
        ],
      },
    ],
    temperature: 0.1,
    max_tokens: 8192,
    response_format: { type: 'json_object' },
  }, { apiKey, timeoutMs: 90000 });

  if (!content) throw new Error('Empty GPT-4o Vision response');

  const parsed = JSON.parse(content);

  // For vital signs charts, wrap the series in the structured field
  if (isVitalSignsChart && parsed.vital_signs_series) {
    return {
      raw_text: parsed.raw_text || '',
      structured: { vital_signs_series: parsed.vital_signs_series },
      confidence: parsed.confidence || 0.85,
      documentType: 'vital_signs_chart',
      handwritingDetected: parsed.handwriting_detected ?? true,
      model: 'gpt-4o-vision',
    };
  }

  return {
    raw_text: parsed.raw_text || '',
    structured: parsed.structured || null,
    confidence: parsed.confidence || 0.85,
    documentType: parsed.document_type || documentType,
    handwritingDetected: parsed.handwriting_detected || false,
    model: 'gpt-4o-vision',
  };
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

  // Shared helper: timeout + retry on 429/5xx.
  const content = await chatCompletion({
    model: 'gpt-4o',
    messages: [
      { role: 'system', content: AI_SYSTEM_PROMPT },
      { role: 'user', content: userMessage },
    ],
    temperature: 0.1,
    max_tokens: 4096,
    response_format: { type: 'json_object' },
  }, { apiKey, timeoutMs: 60000 });

  if (!content) throw new Error('Empty AI response');

  return {
    structured: JSON.parse(content),
    model: 'gpt-4o',
  };
}

// Unified with api/ai/ocr-process.js via the shared prompt (single source of truth).
const AI_SYSTEM_PROMPT = OCR_EXTRACTION_PROMPT;
