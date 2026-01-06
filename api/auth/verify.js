// Verify token endpoint for Vercel serverless
import { authenticateRequest, cors } from '../_lib/auth.js';

export default async function handler(req, res) {
  // Handle CORS
  if (cors(req, res)) return;

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const auth = authenticateRequest(req);
    if (!auth.authenticated) {
      return res.status(401).json({ error: auth.error });
    }
    
    res.status(200).json({ valid: true, user: auth.user });
  } catch (error) {
    console.error('Verify error:', error);
    res.status(500).json({ error: 'Internal server error', message: error.message });
  }
}
