// Wound Measurement API endpoint - GPT-4o Vision analysis + trending
// Handles server-side wound image analysis and stores measurement history
import { query } from '../_lib/db.js';
import { cors, authenticateRequest } from '../_lib/auth.js';
import { createClient } from '@vercel/postgres';

export default async function handler(req, res) {
  if (cors(req, res)) return;

  const auth = authenticateRequest(req);
  if (!auth.authenticated) {
    return res.status(401).json({ error: auth.error });
  }

  const { method } = req;
  const url = new URL(req.url, `http://${req.headers.host}`);
  const pathParts = url.pathname.replace('/api/ocr/wound-measure', '').split('/').filter(Boolean);
  const action = pathParts[0]; // 'analyze' | 'history' | 'trend'

  try {
    switch (method) {
      case 'POST':
        if (action === 'analyze') {
          return await analyzeWound(req.body, auth.user, res);
        }
        return res.status(400).json({ error: 'Invalid action. Use /analyze' });

      case 'GET':
        if (action === 'history') {
          return await getWoundHistory(url.searchParams, res);
        }
        if (action === 'trend') {
          return await getWoundTrend(url.searchParams, res);
        }
        return res.status(400).json({ error: 'Invalid action. Use /history or /trend' });

      default:
        return res.status(405).json({ error: 'Method not allowed' });
    }
  } catch (error) {
    console.error('Wound Measurement API error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
}

const WOUND_ANALYSIS_PROMPT = `You are an expert wound assessment AI for a plastic surgery department.

Analyze this wound image and provide a structured JSON assessment.

IMPORTANT RULES:
- If a calibration reference (ruler, coin, A4 paper) is visible, use it to estimate real-world dimensions
- If no calibration reference, estimate based on anatomical landmarks and indicate lower confidence
- Describe wound characteristics using NPUAP/EPUAP/TIME framework terminology
- Be conservative — underestimate healing progress rather than overestimate

Return ONLY valid JSON with this structure:
{
  "wound_type": "string (surgical, traumatic, pressure_ulcer, burn, keloid, graft_site, flap, other)",
  "location": "string (anatomical location)",
  "dimensions": {
    "length_cm": number,
    "width_cm": number,
    "depth_cm": number | null,
    "area_cm2": number,
    "calibration_used": boolean,
    "calibration_type": "ruler|coin|paper|anatomical_estimate|none"
  },
  "wound_bed": {
    "granulation_pct": number,
    "slough_pct": number,
    "necrotic_pct": number,
    "epithelialization_pct": number
  },
  "edges": "string (well-defined, undermined, rolled, macerated, attached, not_attached)",
  "exudate": "string (none, scant, moderate, copious)",
  "exudate_type": "string (serous, serosanguinous, sanguinous, purulent)",
  "surrounding_skin": "string (healthy, erythematous, macerated, indurated, edematous)",
  "signs_of_infection": ["string"],
  "color_assessment": "string (red/pink=healthy granulation, yellow=slough, black=necrotic, mixed)",
  "healing_stage": "string (inflammatory, proliferative, remodeling, chronic/stalled)",
  "graft_viability": "string (if applicable: viable, partial_take, failed, N/A)",
  "flap_status": "string (if applicable: viable, congested, pale, necrotic, N/A)",
  "observations": "string (free text clinical observations)",
  "confidence": number (0-1, overall assessment confidence)
}`;

async function analyzeWound(body, user, res) {
  const { imageBase64, patientId, woundRecordId, calibrationType, calibrationValue } = body;

  if (!imageBase64) {
    return res.status(400).json({ error: 'imageBase64 is required' });
  }

  // Validate base64 length (max 15MB)
  if (imageBase64.length > 20_000_000) {
    return res.status(400).json({ error: 'Image too large. Maximum 15MB.' });
  }

  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    return res.status(500).json({ error: 'OpenAI API key not configured' });
  }

  // Build enhanced prompt with calibration context
  let prompt = WOUND_ANALYSIS_PROMPT;
  if (calibrationType && calibrationValue) {
    prompt += `\n\nCALIBRATION INFO: A ${calibrationType} is visible in the image. Use it as reference (${calibrationValue}).`;
  }

  try {
    // Call GPT-4o Vision
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-4o',
        messages: [
          { role: 'system', content: prompt },
          {
            role: 'user',
            content: [
              { type: 'text', text: 'Analyze this wound image and provide structured assessment.' },
              {
                type: 'image_url',
                image_url: {
                  url: imageBase64.startsWith('data:') ? imageBase64 : `data:image/jpeg;base64,${imageBase64}`,
                  detail: 'high',
                },
              },
            ],
          },
        ],
        temperature: 0.1,
        max_tokens: 2048,
        response_format: { type: 'json_object' },
      }),
    });

    if (!response.ok) {
      const errBody = await response.text();
      console.error('OpenAI API error:', errBody);
      return res.status(502).json({ error: 'AI analysis failed' });
    }

    const aiResult = await response.json();
    const content = aiResult.choices?.[0]?.message?.content;
    if (!content) {
      return res.status(502).json({ error: 'Empty AI response' });
    }

    let analysis;
    try {
      analysis = JSON.parse(content);
    } catch {
      return res.status(502).json({ error: 'Failed to parse AI response' });
    }

    // Store measurement if patientId provided
    if (patientId) {
      try {
        await query(
          `INSERT INTO wound_measurements (
            patient_id, wound_record_id, measured_by,
            length_cm, width_cm, depth_cm, area_cm2,
            granulation_pct, slough_pct, necrotic_pct, epithelialization_pct,
            wound_type, wound_bed_color, edges, exudate, exudate_type,
            surrounding_skin, healing_stage, signs_of_infection,
            graft_viability, flap_status,
            calibration_type, ai_confidence, ai_raw_response,
            observations
          ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22,$23,$24,$25)`,
          [
            patientId,
            woundRecordId || null,
            user.id,
            analysis.dimensions?.length_cm,
            analysis.dimensions?.width_cm,
            analysis.dimensions?.depth_cm,
            analysis.dimensions?.area_cm2,
            analysis.wound_bed?.granulation_pct,
            analysis.wound_bed?.slough_pct,
            analysis.wound_bed?.necrotic_pct,
            analysis.wound_bed?.epithelialization_pct,
            analysis.wound_type,
            analysis.color_assessment,
            analysis.edges,
            analysis.exudate,
            analysis.exudate_type,
            analysis.surrounding_skin,
            analysis.healing_stage,
            JSON.stringify(analysis.signs_of_infection || []),
            analysis.graft_viability || 'N/A',
            analysis.flap_status || 'N/A',
            calibrationType || analysis.dimensions?.calibration_type || 'none',
            analysis.confidence || 0.5,
            JSON.stringify(analysis),
            analysis.observations,
          ]
        );
      } catch (dbErr) {
        console.error('Failed to store wound measurement:', dbErr);
        // Don't fail the request — still return analysis
      }
    }

    return res.status(200).json({
      success: true,
      analysis,
      stored: !!patientId,
    });
  } catch (fetchErr) {
    console.error('Wound analysis fetch error:', fetchErr);
    return res.status(502).json({ error: 'Failed to connect to AI service' });
  }
}

async function getWoundHistory(searchParams, res) {
  const patientId = searchParams.get('patientId');
  const woundRecordId = searchParams.get('woundRecordId');

  if (!patientId) {
    return res.status(400).json({ error: 'patientId is required' });
  }

  let sql = `
    SELECT wm.*, u.full_name as measured_by_name
    FROM wound_measurements wm
    LEFT JOIN users u ON wm.measured_by = u.id
    WHERE wm.patient_id = $1
  `;
  const params = [patientId];

  if (woundRecordId) {
    sql += ` AND wm.wound_record_id = $2`;
    params.push(woundRecordId);
  }

  sql += ` ORDER BY wm.measured_at DESC`;

  const result = await query(sql, params);
  return res.status(200).json({ measurements: result.rows });
}

async function getWoundTrend(searchParams, res) {
  const patientId = searchParams.get('patientId');
  const woundRecordId = searchParams.get('woundRecordId');
  const metric = searchParams.get('metric') || 'area_cm2';

  if (!patientId) {
    return res.status(400).json({ error: 'patientId is required' });
  }

  // Whitelist allowed metrics to prevent SQL injection
  const allowedMetrics = [
    'area_cm2', 'length_cm', 'width_cm', 'depth_cm',
    'granulation_pct', 'slough_pct', 'necrotic_pct', 'epithelialization_pct',
  ];
  if (!allowedMetrics.includes(metric)) {
    return res.status(400).json({ error: `Invalid metric. Allowed: ${allowedMetrics.join(', ')}` });
  }

  let sql = `
    SELECT
      measured_at,
      ${metric},
      area_cm2,
      granulation_pct,
      healing_stage,
      ai_confidence
    FROM wound_measurements
    WHERE patient_id = $1
  `;
  const params = [patientId];

  if (woundRecordId) {
    sql += ` AND wound_record_id = $2`;
    params.push(woundRecordId);
  }

  sql += ` ORDER BY measured_at ASC`;

  const result = await query(sql, params);
  const measurements = result.rows;

  // Calculate healing rate
  let healingRate = null;
  if (measurements.length >= 2) {
    const first = measurements[0];
    const last = measurements[measurements.length - 1];
    const daysDiff = (new Date(last.measured_at).getTime() - new Date(first.measured_at).getTime()) / (1000 * 60 * 60 * 24);
    if (daysDiff > 0 && first.area_cm2 && last.area_cm2) {
      const areaDiff = first.area_cm2 - last.area_cm2;
      healingRate = {
        area_change_cm2: parseFloat(areaDiff.toFixed(2)),
        area_change_pct: parseFloat(((areaDiff / first.area_cm2) * 100).toFixed(1)),
        days: Math.round(daysDiff),
        rate_cm2_per_day: parseFloat((areaDiff / daysDiff).toFixed(3)),
        trajectory: areaDiff > 0 ? 'improving' : areaDiff < 0 ? 'worsening' : 'stable',
      };
    }
  }

  return res.status(200).json({
    measurements,
    healingRate,
    metric,
  });
}
