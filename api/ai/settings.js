// AI Settings endpoint - placeholder for AI configuration
import { cors, authenticateRequest } from '../_lib/auth.js';
import { getOpenAIKey } from '../_lib/openai.js';
import { externalAiAllowed } from '../_lib/governance.js';

export default async function handler(req, res) {
  try {
    // Handle CORS
    try {
      if (cors(req, res)) return;
    } catch (e) {
      res.setHeader('Access-Control-Allow-Origin', '*');
      if (req.method === 'OPTIONS') {
        return res.status(200).end();
      }
    }

    const { method } = req;

  if (method === 'GET') {
    // The real state: a server key exists AND the unit allows external AI
    // (Clinical Governance, D5). The key itself never leaves the server.
    const hasKey = !!getOpenAIKey();
    const allowed = await externalAiAllowed();
    const enabled = hasKey && allowed;
    return res.status(200).json({
      enabled,
      configured: enabled,
      hasOpenAI: hasKey,
      governanceAllows: allowed,
      provider: 'openai',
      model: 'gpt-4o',
      deidentified: true,
      message: !hasKey ? 'OPENAI_API_KEY is not set on the server.'
        : !allowed ? 'External AI is switched off in Clinical Governance (D5).'
        : 'AI enabled. Patient identifiers are removed before text is sent.',
    });
  }

  if (method === 'PUT' || method === 'PATCH') {
    const auth = authenticateRequest(req);
    if (!auth.authenticated) {
      return res.status(401).json({ error: auth.error });
    }

    // Only admins can update AI settings
    if (auth.user.role !== 'super_admin' && auth.user.role !== 'consultant') {
      return res.status(403).json({ error: 'Insufficient permissions' });
    }

    return res.status(200).json({
      success: true,
      message: 'AI settings updated (placeholder)'
    });
  }

  res.status(405).json({ error: 'Method not allowed' });
  } catch (error) {
    console.error('AI Settings API Error:', error);
    res.status(200).json({
      enabled: false,
      provider: 'openai',
      model: 'gpt-4',
      features: {
        cmeGeneration: false,
        woundAnalysis: false,
        diagnosisAssist: false
      },
      message: 'AI features not configured'
    });
  }
}
