/**
 * AI Text Enhancement API Endpoint
 * POST /api/ai/enhance-text
 * Enhances medical text using AI for better documentation
 */

import { chatCompletion, getOpenAIKey } from '../_lib/openai.js';
import { cors, authenticateRequest } from '../_lib/auth.js';

// Context-specific prompts for medical documentation
const CONTEXT_PROMPTS = {
  clinical_notes: `You are a medical documentation assistant. Improve the following clinical notes to be:
- Professionally written with proper medical terminology
- Well-structured with clear sections
- Concise yet comprehensive
- Following standard medical documentation format
Preserve all clinical information accurately. Do not add or remove medical facts.`,

  operative_notes: `You are a surgical documentation specialist. Format the following operative notes to:
- Follow standard operative report structure
- Use appropriate surgical terminology
- Be detailed and precise
- Include all relevant surgical details
Maintain all procedural details exactly as described.`,

  discharge_summary: `You are a medical records specialist. Improve this discharge summary to:
- Follow standard discharge summary format
- Include admission diagnosis, hospital course, procedures, medications, and follow-up
- Be clear for patient handoff
- Use professional medical language
Preserve all clinical facts and timeline.`,

  progress_notes: `You are a clinical documentation specialist. Improve these progress notes to:
- Follow SOAP (Subjective, Objective, Assessment, Plan) format if applicable
- Be chronologically clear
- Include all relevant clinical updates
- Use appropriate medical terminology`,

  consultation_notes: `You are a specialist consultation documentation expert. Format these consultation notes to:
- Clearly state the reason for consultation
- Include relevant history and examination findings
- Provide clear impression and recommendations
- Be professionally formatted`,

  wound_assessment: `You are a wound care specialist. Improve this wound assessment to:
- Use standardized wound assessment terminology
- Include wound dimensions, appearance, drainage, and surrounding tissue
- Follow MEASURE or TIME framework
- Be objective and measurable`,

  lab_interpretation: `You are a laboratory medicine specialist. Improve this lab interpretation to:
- Organize results by system or category
- Highlight abnormal values
- Provide clinical correlation where appropriate
- Be concise and clinically relevant`,

  general: `You are a medical documentation specialist. Improve the following text to be:
- Professionally written
- Clear and well-organized
- Using appropriate medical terminology
- Grammatically correct and polished
Preserve all information accurately.`
};

export default async function handler(req, res) {
  // Shared CORS helper (origin allowlist) instead of a wildcard origin.
  if (cors(req, res)) return;

  // Spends the deployment's OPENAI_API_KEY — must not be callable anonymously.
  // Previously this endpoint had no auth and `Allow-Origin: *`, making it a
  // free public LLM proxy; exhausting the quota breaks real ward scans.
  const auth = authenticateRequest(req);
  if (!auth.authenticated) {
    return res.status(auth.status || 401).json({ error: auth.error });
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { text, context = 'general', customInstructions } = req.body || {};

    if (!text || typeof text !== 'string') {
      return res.status(400).json({ error: 'Text is required' });
    }

    // Get the appropriate system prompt
    let systemPrompt = CONTEXT_PROMPTS[context] || CONTEXT_PROMPTS.general;
    
    if (customInstructions) {
      systemPrompt += `\n\nAdditional instructions: ${customInstructions}`;
    }

    systemPrompt += '\n\nIMPORTANT: Preserve all numbers, measurements, vital signs, and medication names exactly as provided.';

    // Check if OpenAI API key is configured
    if (!getOpenAIKey()) {
      // Fallback to basic local enhancement
      const enhancedText = enhanceTextLocally(text, context);
      return res.status(200).json({
        enhancedText,
        confidence: 0.7,
        changes: ['Basic formatting applied (AI service not configured)'],
        usedAI: false
      });
    }

    // Use OpenAI for enhancement (shared helper: timeout + retry on 429/5xx).
    let enhancedText;
    try {
      enhancedText = await chatCompletion({
        model: 'gpt-4o-mini',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: `Please improve the following medical text while preserving all factual information:\n\n${text}` }
        ],
        temperature: 0.3,
        max_tokens: 2000,
      });
    } catch (aiErr) {
      console.error('OpenAI API error:', aiErr.status, aiErr.message);
      // Fallback to local enhancement
      const local = enhanceTextLocally(text, context);
      return res.status(200).json({
        enhancedText: local,
        confidence: 0.7,
        changes: ['Basic formatting applied (AI service error)'],
        usedAI: false
      });
    }

    enhancedText = enhancedText || text;

    // Calculate changes
    const changes = detectChanges(text, enhancedText);

    return res.status(200).json({
      enhancedText,
      confidence: 0.95,
      changes,
      usedAI: true
    });

  } catch (error) {
    console.error('Text enhancement error:', error);
    return res.status(500).json({ 
      error: 'Failed to enhance text',
      message: error.message 
    });
  }
}

// Basic local enhancement without AI
function enhanceTextLocally(text, context) {
  let enhanced = text;

  // Capitalize first letter of sentences
  enhanced = enhanced.replace(/(^|[.!?]\s+)([a-z])/g, (match, p1, p2) => p1 + p2.toUpperCase());

  // Fix medical abbreviation formatting
  const abbreviationFixes = [
    [/\b(bp|BP)\b/g, 'BP'],
    [/\b(hr|HR)\b/g, 'HR'],
    [/\b(rr|RR)\b/g, 'RR'],
    [/\b(spo2|SpO2)\b/gi, 'SpO2'],
    [/\b(wbc|WBC)\b/gi, 'WBC'],
    [/\b(rbc|RBC)\b/gi, 'RBC'],
    [/\b(hb|Hb|HB)\b/g, 'Hb'],
    [/\b(ct|CT)\b/g, 'CT'],
    [/\b(mri|MRI)\b/gi, 'MRI'],
    [/\b(ecg|EKG|ECG)\b/gi, 'ECG'],
    [/\b(iv|IV)\b/g, 'IV'],
    [/\b(im|IM)\b/g, 'IM'],
    [/\b(po|PO)\b/g, 'PO'],
    [/\b(prn|PRN)\b/gi, 'PRN'],
    [/\b(od|OD)\b/g, 'OD'],
    [/\b(bd|BD)\b/g, 'BD'],
    [/\b(tds|TDS)\b/gi, 'TDS'],
    [/\b(stat|STAT)\b/gi, 'STAT']
  ];

  abbreviationFixes.forEach(([pattern, replacement]) => {
    enhanced = enhanced.replace(pattern, replacement);
  });

  // Fix spacing around punctuation
  enhanced = enhanced
    .replace(/\s+([.,;:!?])/g, '$1')
    .replace(/([.,;:!?])([^\s\d])/g, '$1 $2');

  // Fix multiple spaces
  enhanced = enhanced.replace(/\s+/g, ' ');

  // Fix line breaks
  enhanced = enhanced.replace(/\n\s*\n\s*\n/g, '\n\n');

  return enhanced.trim();
}

// Detect changes between original and enhanced text
function detectChanges(original, enhanced) {
  const changes = [];

  if (original.length !== enhanced.length) {
    changes.push('Text length adjusted');
  }

  if (original.toLowerCase() !== enhanced.toLowerCase()) {
    changes.push('Capitalization corrected');
  }

  // Check for abbreviation fixes
  const abbrevPattern = /\b[A-Z]{2,5}\b/g;
  const originalAbbrevs = original.match(abbrevPattern) || [];
  const enhancedAbbrevs = enhanced.match(abbrevPattern) || [];
  if (originalAbbrevs.length !== enhancedAbbrevs.length) {
    changes.push('Medical abbreviations standardized');
  }

  // Check for formatting
  if ((enhanced.match(/\n\n/g) || []).length > (original.match(/\n\n/g) || []).length) {
    changes.push('Section formatting added');
  }

  if (changes.length === 0) {
    changes.push('Text polished for clarity');
  }

  return changes;
}
