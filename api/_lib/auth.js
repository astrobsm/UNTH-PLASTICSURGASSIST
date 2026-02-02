// Shared authentication utilities for Vercel serverless functions

import jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET || 'fallback-dev-secret-please-set-jwt-secret-in-env';

// Log warning if using fallback (only in development)
if (!process.env.JWT_SECRET && process.env.NODE_ENV !== 'production') {
  console.warn('WARNING: JWT_SECRET not set, using fallback. Set JWT_SECRET in environment variables.');
}

export function verifyToken(token) {
  try {
    return jwt.verify(token, JWT_SECRET);
  } catch (error) {
    return null;
  }
}

export function signToken(payload, expiresIn = '24h') {
  return jwt.sign(payload, JWT_SECRET, { expiresIn });
}

export function getTokenFromRequest(req) {
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    return authHeader.slice(7);
  }
  return null;
}

export function authenticateRequest(req) {
  const token = getTokenFromRequest(req);
  if (!token) {
    return { authenticated: false, error: 'No token provided' };
  }
  
  const decoded = verifyToken(token);
  if (!decoded) {
    return { authenticated: false, error: 'Invalid or expired token' };
  }
  
  return { authenticated: true, user: decoded };
}

// CORS helper for API routes
export function cors(req, res) {
  const origin = req.headers.origin;
  
  // Allow all Vercel preview deployments and the main domain
  const isAllowedOrigin = (
    origin === 'https://plasticsurgassisstant.vercel.app' ||
    (origin && origin.startsWith('https://plasticsurgassisstant-') && origin.endsWith('.vercel.app')) ||
    (process.env.NODE_ENV !== 'production' && origin === 'http://localhost:5173')
  );
  
  // Set CORS headers if origin is allowed
  if (isAllowedOrigin) {
    res.setHeader('Access-Control-Allow-Origin', origin);
    res.setHeader('Access-Control-Allow-Credentials', 'true');
  } else if (!origin) {
    // Allow requests with no origin (e.g., same-origin requests, curl, etc.)
    res.setHeader('Access-Control-Allow-Origin', '*');
  }
  
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
  res.setHeader(
    'Access-Control-Allow-Headers',
    'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version, Authorization'
  );
  
  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return true;
  }
  return false;
}

export default { verifyToken, signToken, getTokenFromRequest, authenticateRequest, cors };
