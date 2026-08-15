/**
 * Google service-account authentication, without the SDK.
 *
 * WHY NOT googleapis / @google-cloud/*
 * Those packages are tens of megabytes and pull large dependency trees. All that
 * is needed here is: sign a JWT with the service account key, exchange it for an
 * access token, and cache the token. That is about forty lines against Node's
 * built-in crypto, and it keeps the serverless bundle small — which matters on
 * Vercel, where bundle size is cold-start latency.
 *
 * The credentials come from GOOGLE_APPLICATION_CREDENTIALS_JSON, which has been
 * present in this project's environment for months but was referenced by nothing
 * until now.
 */

import { createSign } from 'node:crypto';

const TOKEN_URL = 'https://oauth2.googleapis.com/token';
const SCOPE = 'https://www.googleapis.com/auth/cloud-platform';

/**
 * Cached access token.
 *
 * Google's tokens last an hour. Minting one per OCR request would add a round
 * trip to every scan and burn quota for nothing, so it is held across warm
 * invocations of the same serverless instance and refreshed a minute early to
 * avoid using one that expires mid-flight.
 */
let cached = { token: null, expiresAt: 0 };

function base64url(input) {
  return Buffer.from(input)
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
}

/** Parsed service account, or null when not configured. */
export function getServiceAccount() {
  const raw = process.env.GOOGLE_APPLICATION_CREDENTIALS_JSON;
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw);
    if (!parsed.client_email || !parsed.private_key) return null;
    return parsed;
  } catch {
    // A malformed value is a configuration error worth surfacing loudly rather
    // than silently behaving as though Google were simply switched off.
    console.error('[google] GOOGLE_APPLICATION_CREDENTIALS_JSON is not valid JSON');
    return null;
  }
}

export function getProjectId() {
  return getServiceAccount()?.project_id || null;
}

/**
 * An OAuth2 access token for the service account.
 *
 * Returns null rather than throwing when Google is not configured, so callers
 * can fall back to another OCR engine instead of failing the request.
 */
export async function getAccessToken() {
  const now = Math.floor(Date.now() / 1000);
  if (cached.token && cached.expiresAt > now + 60) return cached.token;

  const sa = getServiceAccount();
  if (!sa) return null;

  const header = base64url(JSON.stringify({ alg: 'RS256', typ: 'JWT' }));
  const claims = base64url(JSON.stringify({
    iss: sa.client_email,
    scope: SCOPE,
    aud: TOKEN_URL,
    iat: now,
    exp: now + 3600,
  }));

  const signer = createSign('RSA-SHA256');
  signer.update(`${header}.${claims}`);
  // Private keys stored in environment variables usually carry literal \n
  // sequences rather than real newlines; PEM parsing fails on those.
  const key = sa.private_key.replace(/\\n/g, '\n');
  const signature = signer.sign(key, 'base64')
    .replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');

  const assertion = `${header}.${claims}.${signature}`;

  const res = await fetch(TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
      assertion,
    }),
  });

  if (!res.ok) {
    const detail = await res.text().catch(() => '');
    console.error('[google] token exchange failed:', res.status, detail.slice(0, 200));
    return null;
  }

  const body = await res.json();
  if (!body.access_token) return null;

  cached = {
    token: body.access_token,
    expiresAt: now + (body.expires_in || 3600),
  };
  return cached.token;
}

/** For tests and diagnostics — clears the cached token. */
export function resetTokenCache() {
  cached = { token: null, expiresAt: 0 };
}
