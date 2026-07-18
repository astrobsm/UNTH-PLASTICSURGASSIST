/**
 * AI-Enhanced OCR Document Processing Endpoint
 * POST /api/ai/ocr-process
 * 
 * Takes raw OCR text + document context and returns structured clinical data
 * mapped to ward round / review note form fields.
 * Implements ABBYY FineReader-level intelligent field extraction via AI layering.
 */

import { chatJSON, getOpenAIKey, OpenAIError } from '../_lib/openai.js';
import { OCR_EXTRACTION_PROMPT } from '../_lib/ocrPrompts.js';

// Shared single-source-of-truth clinical extraction prompt.
const OCR_SYSTEM_PROMPT = OCR_EXTRACTION_PROMPT;

export default async function handler(req, res) {
  // CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    // Parse body — handle both pre-parsed and raw body cases
    let body = req.body;
    if (typeof body === 'string') {
      try { body = JSON.parse(body); } catch { /* already parsed */ }
    }
    if (!body || typeof body !== 'object') {
      return res.status(400).json({ error: 'Request body is required (JSON with ocrText field)' });
    }

    const { ocrText, documentType, patientContext } = body;

    if (typeof ocrText !== 'string') {
      return res.status(400).json({ error: 'ocrText is required and must be a string', receivedType: typeof ocrText, bodyKeys: Object.keys(body) });
    }

    // Handle empty / whitespace-only OCR text gracefully
    const cleanedText = ocrText.trim();
    if (!cleanedText) {
      return res.status(200).json({
        success: false,
        error: 'OCR text is empty — no text was extracted from the document',
        fallback: true,
        structured: null,
        rawText: '',
        processedAt: new Date().toISOString(),
      });
    }

    // Trim excessively long OCR text to avoid token limits
    const trimmedText = cleanedText.length > 15000 ? cleanedText.substring(0, 15000) + '\n[...truncated]' : cleanedText;

    if (!getOpenAIKey()) {
      return res.status(501).json({ error: 'AI not configured', fallback: true, message: 'No OPENAI_API_KEY — use client-side rule-based extraction' });
    }

    const docType = documentType || 'general';

    // Build user message with context
    let userMessage = `Document type: ${docType}\n\nRaw OCR Text:\n---\n${trimmedText}\n---`;

    if (patientContext) {
      userMessage += `\n\nPatient Context:\n- Name: ${patientContext.name || 'Unknown'}\n- Hospital Number: ${patientContext.hospitalNumber || 'Unknown'}\n- Ward: ${patientContext.ward || 'Unknown'}\n- Diagnosis: ${patientContext.diagnosis || 'Unknown'}`;
    }

    userMessage += '\n\nPlease extract and structure ALL medical data from this OCR text into the appropriate JSON schema for this document type. Correct obvious OCR errors in medical terminology.';

    // Call OpenAI GPT-4o for maximum accuracy (shared helper: timeout + retry + JSON salvage).
    let structured;
    try {
      structured = await chatJSON({
        model: 'gpt-4o',
        messages: [
          { role: 'system', content: OCR_SYSTEM_PROMPT },
          { role: 'user', content: userMessage },
        ],
        temperature: 0.1,
        max_tokens: 4096,
      });
    } catch (aiErr) {
      console.error('OCR AI processing error:', aiErr.status, aiErr.message);
      const status = aiErr instanceof OpenAIError && aiErr.status >= 400 && aiErr.status < 600 ? aiErr.status : 502;
      return res.status(status).json({ error: 'AI processing failed', details: aiErr.message });
    }

    return res.status(200).json({
      success: true,
      documentType: docType,
      structured,
      rawText: ocrText,
      processedAt: new Date().toISOString(),
      model: 'gpt-4o',
    });
  } catch (err) {
    console.error('OCR processing error:', err);
    return res.status(500).json({ error: 'Internal server error', message: err.message });
  }
}
