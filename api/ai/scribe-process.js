/**
 * AI Medical Scribe Transcript Processing Endpoint
 * POST /api/ai/scribe-process
 * 
 * Takes a raw speech transcript + context and returns a structured SOAP note
 * with extracted vitals, medications, orders, and wound assessments.
 */

import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

const supabase = supabaseUrl && supabaseServiceKey 
  ? createClient(supabaseUrl, supabaseServiceKey)
  : null;

// System prompt for structured note extraction
const SCRIBE_SYSTEM_PROMPT = `You are an expert plastic surgery AI medical scribe. Your task is to process a spoken clinical transcript and produce a structured SOAP note in JSON format.

You MUST respond with ONLY valid JSON (no markdown fences, no explanation). Use EXACTLY this schema:

{
  "subjective": "Patient's reported symptoms, complaints, and history...",
  "objective": "Physical examination findings, wound descriptions, drain output...",
  "assessment": "Clinical impression, diagnosis, progress status...",
  "plan": "Treatment plan, follow-up, discharge planning...",
  "vitals": {
    "temperature": null or number (Celsius),
    "pulse": null or number (bpm),
    "bp_systolic": null or number (mmHg),
    "bp_diastolic": null or number (mmHg),
    "respiratory_rate": null or number (breaths/min),
    "spo2": null or number (%),
    "pain_score": null or number (0-10)
  },
  "medications": [
    {
      "action": "start|continue|stop|modify",
      "name": "medication name",
      "dose": "dose with units",
      "route": "oral|iv|im|sc|topical|pr|sl|inhaled",
      "frequency": "frequency"
    }
  ],
  "orders": [
    {
      "type": "lab|imaging|consultation|procedure",
      "description": "order description",
      "priority": "routine|urgent|stat"
    }
  ],
  "wounds": [
    {
      "location": "wound location",
      "description": "wound status, size, appearance, drainage",
      "needs_dressing_change": true or false
    }
  ],
  "progress_status": "improved|stable|deteriorating|critical",
  "discharge_planning": "Discharge readiness and plan, if discussed",
  "complications": "Any complications mentioned, or empty string",
  "confidence": 0.0 to 1.0
}

RULES:
- Extract ALL mentioned vitals, medications, investigations, and wound assessments.
- If a value is not mentioned, use null (for vitals) or omit (for lists).
- Use proper medical terminology and abbreviations.
- For plastic surgery, pay special attention to wound descriptions, flap viability, graft take, drain outputs, and dressing details.
- The "confidence" field should reflect how clearly the transcript conveyed the clinical information (0.0 = unintelligible, 1.0 = perfectly clear).
- Keep each SOAP section concise but complete. Do NOT fabricate data not in the transcript.
`;

const CONTEXT_PROMPTS = {
  ward_round: 'This is a ward round. Focus on overnight events, current status, vitals, wound check, plan for the day.',
  patient_review: 'This is a patient review. Document comprehensive review findings, treatment response, and updated plan.',
  consultation: 'This is a consultation. Document presenting complaint, relevant history, examination, and specialist recommendations.',
  procedure_note: 'This is a procedure note. Document procedure details, findings, technique, and post-procedure orders.',
  admission: 'This is an admission. Document presenting complaint, history, examination, initial investigations, and management plan.'
};

export default async function handler(req, res) {
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
    // Optional auth verification
    const authHeader = req.headers.authorization;
    if (supabase && authHeader?.startsWith('Bearer ')) {
      const token = authHeader.replace('Bearer ', '');
      const { error: authError } = await supabase.auth.getUser(token);
      if (authError) {
        console.warn('Scribe: token validation failed, continuing anyway');
      }
    }

    const { transcript, context = 'ward_round', patientName, hospitalNumber, roundType } = req.body;

    if (!transcript || typeof transcript !== 'string') {
      return res.status(400).json({ error: 'Transcript text is required' });
    }

    if (transcript.trim().length < 10) {
      return res.status(400).json({ error: 'Transcript is too short to process' });
    }

    const openaiApiKey = process.env.OPENAI_API_KEY;

    if (!openaiApiKey) {
      // Return a flag so the client knows to use local extraction
      return res.status(200).json({
        structuredNote: null,
        usedAI: false,
        message: 'AI service not configured. Use local extraction.'
      });
    }

    // Build the user message
    let userMessage = '';
    if (patientName) userMessage += `Patient: ${patientName}`;
    if (hospitalNumber) userMessage += ` (${hospitalNumber})`;
    if (roundType) userMessage += ` | Round: ${roundType}`;
    userMessage += '\n\n';

    const contextHint = CONTEXT_PROMPTS[context] || CONTEXT_PROMPTS.ward_round;
    userMessage += `Context: ${contextHint}\n\n`;
    userMessage += `Transcript:\n${transcript}`;

    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${openaiApiKey}`
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [
          { role: 'system', content: SCRIBE_SYSTEM_PROMPT },
          { role: 'user', content: userMessage }
        ],
        temperature: 0.2,
        max_tokens: 3000,
        response_format: { type: 'json_object' }
      })
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      console.error('OpenAI API error:', errorData);
      return res.status(200).json({
        structuredNote: null,
        usedAI: false,
        message: 'AI processing failed. Use local extraction.',
        error: errorData.error?.message || 'Unknown API error'
      });
    }

    const aiResponse = await response.json();
    const content = aiResponse.choices?.[0]?.message?.content;

    if (!content) {
      return res.status(200).json({
        structuredNote: null,
        usedAI: false,
        message: 'Empty AI response. Use local extraction.'
      });
    }

    // Parse the JSON from the AI response
    let structuredNote;
    try {
      structuredNote = JSON.parse(content);
    } catch (parseError) {
      // Try to extract JSON from markdown code block
      const jsonMatch = content.match(/```(?:json)?\s*([\s\S]*?)```/);
      if (jsonMatch) {
        structuredNote = JSON.parse(jsonMatch[1].trim());
      } else {
        console.error('Failed to parse AI scribe response:', content.substring(0, 200));
        return res.status(200).json({
          structuredNote: null,
          usedAI: false,
          message: 'Failed to parse AI response. Use local extraction.'
        });
      }
    }

    // Validate essential fields
    if (!structuredNote.subjective && !structuredNote.objective && !structuredNote.assessment) {
      return res.status(200).json({
        structuredNote: null,
        usedAI: false,
        message: 'AI response missing essential SOAP fields. Use local extraction.'
      });
    }

    // Normalize the response
    const normalized = {
      subjective: structuredNote.subjective || '',
      objective: structuredNote.objective || '',
      assessment: structuredNote.assessment || '',
      plan: structuredNote.plan || '',
      vitals: {
        temperature: structuredNote.vitals?.temperature ?? undefined,
        pulse: structuredNote.vitals?.pulse ?? undefined,
        bp_systolic: structuredNote.vitals?.bp_systolic ?? undefined,
        bp_diastolic: structuredNote.vitals?.bp_diastolic ?? undefined,
        respiratory_rate: structuredNote.vitals?.respiratory_rate ?? undefined,
        spo2: structuredNote.vitals?.spo2 ?? undefined,
        pain_score: structuredNote.vitals?.pain_score ?? undefined,
      },
      medications: Array.isArray(structuredNote.medications) ? structuredNote.medications : [],
      orders: Array.isArray(structuredNote.orders) ? structuredNote.orders : [],
      wounds: Array.isArray(structuredNote.wounds) ? structuredNote.wounds : [],
      progress_status: structuredNote.progress_status || 'stable',
      discharge_planning: structuredNote.discharge_planning || '',
      complications: structuredNote.complications || '',
      confidence: typeof structuredNote.confidence === 'number' ? structuredNote.confidence : 0.85,
      raw_transcript: transcript,
      processed_at: new Date().toISOString(),
      ai_model: 'gpt-4o-mini'
    };

    return res.status(200).json({
      structuredNote: normalized,
      usedAI: true
    });

  } catch (error) {
    console.error('Scribe processing error:', error);
    return res.status(500).json({
      error: 'Failed to process transcript',
      message: error.message
    });
  }
}
