// Shared authentication utilities for Vercel serverless functions

import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import { touchLastSeen } from './presence.js';

if (!process.env.JWT_SECRET) {
  if (process.env.NODE_ENV === 'production' || process.env.VERCEL) {
    throw new Error('FATAL: JWT_SECRET environment variable is required in production');
  }
  console.error('WARNING: JWT_SECRET not set. Using random secret (sessions will not persist across restarts).');
}
const JWT_SECRET = process.env.JWT_SECRET || crypto.randomBytes(32).toString('hex');

export function verifyToken(token) {
  try {
    return jwt.verify(token, JWT_SECRET);
  } catch (error) {
    return null;
  }
}

// 30-day sessions: this is a ward app used on phones with intermittent/offline
// connectivity. A 24h token expired between uses and got cleared, so field staff
// (house officers, registrars) saw "No token provided" on protected pages like
// Consults and — being offline — could not re-login. 30 days keeps them signed in.
export function signToken(payload, expiresIn = '30d') {
  return jwt.sign(payload, JWT_SECRET, { expiresIn });
}

export function getTokenFromRequest(req) {
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    return authHeader.slice(7);
  }
  return null;
}

// SECURITY: student tokens are default-denied.
//
// api/students.js exposes PUBLIC self-registration (POST /api/students/register)
// and auto-approves the account on first login, then signs a token with the SAME
// JWT_SECRET as staff tokens. Such a token satisfies a bare authenticated check,
// so before this guard ANYONE on the internet could mint a credential that
// passed the auth gate on every clinical handler in this API — including
// DELETE /api/patients/:id.
//
// Students are only ever meant to use api/students.js, which is the sole caller
// that opts in via { allowStudents: true }. Default-deny here fixes every other
// handler at once rather than relying on 76 files each remembering to check.
export function authenticateRequest(req, options = {}) {
  const { allowStudents = false } = options;
  const token = getTokenFromRequest(req);
  if (!token) {
    return { authenticated: false, error: 'No token provided' };
  }

  const decoded = verifyToken(token);
  if (!decoded) {
    return { authenticated: false, error: 'Invalid or expired token' };
  }

  // `role` covers tokens issued before sub_type existed, so already-issued
  // student tokens are rejected too rather than being grandfathered in.
  if (!allowStudents && (decoded.sub_type === 'student' || decoded.role === 'student')) {
    return {
      authenticated: false,
      status: 403,
      error: 'This endpoint is not available to student accounts',
    };
  }

  // "Last active" for the Admin page (throttled, never awaited). Staff only.
  if (!(decoded.sub_type === 'student' || decoded.role === 'student')) touchLastSeen(decoded.id);

  return { authenticated: true, user: decoded };
}

// CORS for API routes: any origin may call the API.
//
// Safe because authentication is a bearer token in the Authorization header —
// there are no cookies or other ambient credentials, so a page on another
// origin cannot act as a signed-in user; it must hold the user's token.
// Credentials mode is therefore never allowed (and is incompatible with "*").
// vercel.json sets the same headers for every /api route.
export const CORS_ALLOW_HEADERS = 'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version, Authorization, X-Idempotency-Key, x-init-secret';

export function cors(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
  res.setHeader('Access-Control-Allow-Headers', CORS_ALLOW_HEADERS);
  res.setHeader('Access-Control-Max-Age', '86400');
  if (req.method === 'OPTIONS') {
    res.status(204).end();
    return true;
  }
  return false;
}

// Role-based access control helper
// Usage: const { user } = requireRole(req, res, ['admin', 'consultant']); if (!user) return;
export function requireRole(req, res, allowedRoles, options = {}) {
  const auth = authenticateRequest(req, options);
  if (!auth.authenticated) {
    res.status(auth.status || 401).json({ error: auth.error });
    return { user: null };
  }
  if (allowedRoles && allowedRoles.length > 0 && !allowedRoles.includes(auth.user.role)) {
    res.status(403).json({ error: 'Insufficient permissions' });
    return { user: null };
  }
  return { user: auth.user };
}

export default { verifyToken, signToken, getTokenFromRequest, authenticateRequest, cors, requireRole };
