// ============================================================================
// What the browser needs to reach the signalling channel.
//
// WebRTC cannot start without a way for two browsers to exchange an offer, an
// answer and their ICE candidates. Vercel is serverless and cannot hold a
// WebSocket open, so the app's own host is no use for that; the browsers talk
// to Supabase Realtime directly instead, and Vercel is not in the path.
//
// The anon key is served from here rather than baked into the bundle at build
// time. It is a public key by design — it grants nothing on its own, and row
// level security governs what it can reach — but serving it means it can be
// rotated in the Vercel dashboard without rebuilding and redeploying the app.
//
// Requires SUPABASE_URL and SUPABASE_ANON_KEY in the environment. Without them
// this returns `configured: false` and the conference explains itself rather
// than failing with a broken connection.
// ============================================================================

import { cors, authenticateRequest } from './_lib/auth.js';

export default async function handler(req, res) {
  if (cors(req, res)) return;

  if (req.method !== 'GET') {
    res.setHeader('Allow', ['GET']);
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // Signed in only. The key is public, but there is no reason to hand it to
  // anonymous traffic, and the conference is for the unit.
  const auth = authenticateRequest(req, { allowStudents: true });
  if (!auth.authenticated) {
    return res.status(auth.status || 401).json({ error: 'Unauthorized', message: auth.error });
  }

  const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || null;
  const anonKey = process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY || null;

  if (!url || !anonKey) {
    return res.status(200).json({
      configured: false,
      reason: 'SUPABASE_URL and SUPABASE_ANON_KEY are not set on the server. '
        + 'Add them in the Vercel project settings to enable the conference.',
    });
  }

  return res.status(200).json({
    configured: true,
    url,
    anonKey,
    // TURN matters on hospital networks, where a symmetric NAT or a firewall
    // will stop two peers reaching each other directly. STUN alone is enough
    // on most home and mobile networks but not reliably inside a hospital.
    iceServers: buildIceServers(),
  });
}

/**
 * ICE servers for the peer connections.
 *
 * Google's public STUN is the default and costs nothing. A TURN relay is used
 * when configured, and is what makes the call connect from behind a hospital
 * firewall that blocks peer-to-peer UDP.
 */
function buildIceServers() {
  const servers = [
    { urls: ['stun:stun.l.google.com:19302', 'stun:stun1.l.google.com:19302'] },
  ];

  const turnUrl = process.env.TURN_URL;
  if (turnUrl) {
    servers.push({
      urls: turnUrl.split(',').map((u) => u.trim()).filter(Boolean),
      username: process.env.TURN_USERNAME || undefined,
      credential: process.env.TURN_CREDENTIAL || undefined,
    });
  }
  return servers;
}
