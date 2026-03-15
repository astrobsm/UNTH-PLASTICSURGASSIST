/**
 * AI-Enhanced OCR Document Processing Endpoint
 * POST /api/ai/ocr-process
 * 
 * Takes raw OCR text + document context and returns structured clinical data
 * mapped to ward round / review note form fields.
 * Implements ABBYY FineReader-level intelligent field extraction via AI layering.
 */

// System prompt for intelligent OCR field extraction
const OCR_SYSTEM_PROMPT = `You are an expert medical document OCR processor for a plastic surgery department. Your task is to analyze raw OCR-extracted text from clinical documents and structure it into appropriate medical form fields.

You MUST respond with ONLY valid JSON (no markdown fences, no explanation). Use the schema matching the document type provided.

For "ward_round" or "review_note" documents, use this schema:
{
  "clinical_status": "improved|stable|deteriorating|critical",
  "subjective": "Patient complaints, symptoms reported...",
  "objective": "Physical examination findings...",
  "assessment": "Clinical impression, working diagnosis...",
  "plan": "Treatment plan, orders, follow-up...",
  "vitals": {
    "temperature": null or number,
    "pulse": null or number,
    "bp_systolic": null or number,
    "bp_diastolic": null or number,
    "respiratory_rate": null or number,
    "spo2": null or number,
    "pain_score": null or number,
    "weight": null or number,
    "height": null or number
  },
  "medications": [
    {
      "name": "medication name",
      "dose": "dose with units",
      "route": "oral|iv|im|sc|topical",
      "frequency": "frequency",
      "duration": "duration if mentioned"
    }
  ],
  "investigations": [
    {
      "type": "lab|imaging|other",
      "name": "test/investigation name",
      "result": "result if available",
      "reference_range": "ref range if shown",
      "abnormal": true or false
    }
  ],
  "wounds": [
    {
      "location": "wound location",
      "description": "wound status description",
      "size": "dimensions if mentioned",
      "dressing": "dressing type if mentioned"
    }
  ],
  "diagnoses": ["list of diagnoses mentioned"],
  "allergies": ["list of allergies mentioned"],
  "procedures_done": ["procedures mentioned as done"],
  "procedures_planned": ["procedures mentioned as planned"],
  "fluid_balance": {
    "intake": null or string,
    "output": null or string,
    "drain_output": null or string
  },
  "diet": "diet instructions if mentioned",
  "activity": "mobility/activity level if mentioned",
  "notes": "any additional important text not fitting above categories",
  "confidence": 0.0 to 1.0
}

For "lab_report" documents, use this schema:
{
  "patient_name": "if visible",
  "hospital_number": "if visible",
  "collection_date": "if visible",
  "results": [
    {
      "test_name": "test name",
      "result_value": "numeric or text value",
      "unit": "unit of measurement",
      "reference_range": "reference range",
      "abnormal": true or false,
      "flag": "high|low|critical_high|critical_low|normal"
    }
  ],
  "specimen_type": "blood|urine|csf|other",
  "lab_comments": "any comments",
  "confidence": 0.0 to 1.0
}

For "prescription" documents, use this schema:
{
  "medications": [
    {
      "name": "medication name",
      "generic_name": "generic if mentioned",
      "dose": "dose",
      "route": "route",
      "frequency": "frequency",
      "duration": "duration",
      "instructions": "special instructions"
    }
  ],
  "prescriber": "prescriber name if visible",
  "date": "date if visible",
  "confidence": 0.0 to 1.0
}

For "imaging_report" documents, use this schema:
{
  "modality": "xray|ct|mri|ultrasound|other",
  "body_part": "body part examined",
  "indication": "clinical indication",
  "findings": "detailed findings text",
  "impression": "radiologist impression/conclusion",
  "comparison": "comparison with prior studies if mentioned",
  "radiologist": "reporting radiologist name if visible",
  "date": "date if visible",
  "confidence": 0.0 to 1.0
}

For "general" or "referral" documents, use:
{
  "document_type": "best guess of document type",
  "patient_name": "if visible",
  "date": "if visible",
  "author": "if visible",
  "content_summary": "structured summary of content",
  "key_findings": ["list of key medical findings"],
  "diagnoses": ["diagnoses mentioned"],
  "recommendations": ["recommendations mentioned"],
  "confidence": 0.0 to 1.0
}

IMPORTANT RULES:
1. Extract ALL medical data visible in the OCR text, even if partially readable
2. Use medical abbreviation knowledge to interpret shorthand (e.g., "BP 120/80" → systolic 120, diastolic 80)
3. Correct obvious OCR errors in medical terms (e.g., "hemog1obin" → "hemoglobin")
4. Set abnormal flags based on standard reference ranges when results are present
5. If no value is found for a field, use null (not empty string)
6. The confidence field should reflect overall extraction quality (0.0-1.0)
7. Always try to extract vitals even from shorthand like "T 37.2 P 80 BP 120/80 RR 18 SpO2 98%"`;

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
    const { ocrText, documentType, patientContext } = req.body;

    if (!ocrText || typeof ocrText !== 'string') {
      return res.status(400).json({ error: 'ocrText is required and must be a string' });
    }

    const openaiApiKey = process.env.OPENAI_API_KEY;
    if (!openaiApiKey) {
      return res.status(501).json({ error: 'AI not configured', fallback: true, message: 'No OPENAI_API_KEY — use client-side rule-based extraction' });
    }

    const docType = documentType || 'general';
    
    // Build user message with context
    let userMessage = `Document type: ${docType}\n\nRaw OCR Text:\n---\n${ocrText}\n---`;
    
    if (patientContext) {
      userMessage += `\n\nPatient Context:\n- Name: ${patientContext.name || 'Unknown'}\n- Hospital Number: ${patientContext.hospitalNumber || 'Unknown'}\n- Ward: ${patientContext.ward || 'Unknown'}\n- Diagnosis: ${patientContext.diagnosis || 'Unknown'}`;
    }

    userMessage += '\n\nPlease extract and structure ALL medical data from this OCR text into the appropriate JSON schema for this document type. Correct obvious OCR errors in medical terminology.';

    // Call OpenAI GPT-4o-mini
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${openaiApiKey}`,
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [
          { role: 'system', content: OCR_SYSTEM_PROMPT },
          { role: 'user', content: userMessage },
        ],
        temperature: 0.1,
        max_tokens: 4096,
        response_format: { type: 'json_object' },
      }),
    });

    if (!response.ok) {
      const errText = await response.text();
      console.error('OpenAI API error:', errText);
      return res.status(502).json({ error: 'AI processing failed', details: errText });
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content;

    if (!content) {
      return res.status(502).json({ error: 'No response from AI model' });
    }

    let structured;
    try {
      structured = JSON.parse(content);
    } catch {
      return res.status(502).json({ error: 'AI returned invalid JSON', raw: content });
    }

    return res.status(200).json({
      success: true,
      documentType: docType,
      structured,
      rawText: ocrText,
      processedAt: new Date().toISOString(),
      model: 'gpt-4o-mini',
    });
  } catch (err) {
    console.error('OCR processing error:', err);
    return res.status(500).json({ error: 'Internal server error', message: err.message });
  }
}
