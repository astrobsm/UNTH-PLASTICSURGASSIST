// AI Settings endpoint - placeholder for AI configuration
import { cors, authenticateRequest } from '../_lib/auth.js';

export default async function handler(req, res) {
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
    // Return default AI settings
    return res.status(200).json({
      enabled: false,
      provider: 'openai',
      model: 'gpt-4',
      features: {
        cmeGeneration: false,
        woundAnalysis: false,
        diagnosisAssist: false
      },
      message: 'AI features require VITE_OPENAI_API_KEY environment variable'
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
}
