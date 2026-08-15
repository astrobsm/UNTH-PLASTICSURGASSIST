#!/usr/bin/env node
/**
 * Confirms the wound-image bucket is usable AND private.
 *
 * "Private" is the part worth checking rather than trusting. A bucket left
 * public makes every wound photograph readable by anyone who can guess a URL,
 * with no login and no trace — and the setting is one toggle, easy to miss.
 * So this does not read the dashboard's word for it: it uploads a probe object
 * and then tries to fetch it anonymously. If that fetch succeeds, the bucket is
 * public whatever the settings page says.
 *
 * Everything it creates is deleted before it exits.
 *
 *   node scripts/verify-wound-bucket.mjs [--env <file>]
 */

import { readFileSync } from 'node:fs';

const BUCKET = 'wound-images';

// Read the env file directly: these values live in Vercel, not in .env.local,
// so the usual dotenv path does not find them.
const argIdx = process.argv.indexOf('--env');
const envFile = argIdx > -1 ? process.argv[argIdx + 1] : '.env.vercel.tmp';

function loadEnv(file) {
  const out = {};
  let text;
  try {
    text = readFileSync(file, 'utf8');
  } catch {
    return out;
  }
  for (const line of text.split('\n')) {
    const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
    if (m) out[m[1]] = m[2].replace(/^["']|["']$/g, '').trim();
  }
  return out;
}

const env = { ...loadEnv(envFile), ...process.env };
const URL_BASE = env.SUPABASE_URL?.replace(/\/$/, '');
const KEY = env.SUPABASE_SERVICE_ROLE_KEY;

if (!URL_BASE || !KEY) {
  console.error('SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY not found.');
  console.error(`Looked in ${envFile} and the environment.`);
  process.exit(1);
}

const auth = { apikey: KEY, Authorization: `Bearer ${KEY}` };
const probePath = `_healthcheck/probe-${Date.now()}.txt`;
let uploaded = false;
let failures = 0;

const ok = (msg) => console.log(`  ok    ${msg}`);
const bad = (msg) => { console.log(`  FAIL  ${msg}`); failures++; };

try {
  // 1. The bucket exists and its declared visibility.
  const listRes = await fetch(`${URL_BASE}/storage/v1/bucket`, { headers: auth });
  if (!listRes.ok) {
    bad(`could not list buckets (HTTP ${listRes.status}) — is the key a service-role/secret key?`);
    process.exit(1);
  }
  const buckets = await listRes.json();
  const bucket = buckets.find(b => b.name === BUCKET);

  if (!bucket) {
    bad(`bucket "${BUCKET}" does not exist. Buckets found: ${buckets.map(b => b.name).join(', ') || '(none)'}`);
    process.exit(1);
  }
  ok(`bucket "${BUCKET}" exists`);
  bucket.public ? bad('bucket is marked PUBLIC — turn "Public bucket" off') : ok('bucket is marked private');

  // 2. Upload a probe.
  const up = await fetch(`${URL_BASE}/storage/v1/object/${BUCKET}/${probePath}`, {
    method: 'POST',
    headers: { ...auth, 'Content-Type': 'text/plain' },
    body: 'probe',
  });
  if (!up.ok) {
    bad(`upload failed (HTTP ${up.status}): ${(await up.text()).slice(0, 160)}`);
  } else {
    uploaded = true;
    ok('service-role upload works');
  }

  // 3. THE CHECK THAT MATTERS: fetch it with no credentials at all.
  if (uploaded) {
    const anon = await fetch(`${URL_BASE}/storage/v1/object/public/${BUCKET}/${probePath}`);
    if (anon.ok) {
      bad('an anonymous request READ the object — the bucket is publicly readable');
    } else {
      ok(`anonymous read refused (HTTP ${anon.status}) — photographs are not public`);
    }

    // 4. Signed URLs work, which is how the app will serve images.
    const signRes = await fetch(`${URL_BASE}/storage/v1/object/sign/${BUCKET}/${probePath}`, {
      method: 'POST',
      headers: { ...auth, 'Content-Type': 'application/json' },
      body: JSON.stringify({ expiresIn: 60 }),
    });
    if (!signRes.ok) {
      bad(`could not create a signed URL (HTTP ${signRes.status})`);
    } else {
      const { signedURL } = await signRes.json();
      const signed = await fetch(`${URL_BASE}/storage/v1${signedURL}`);
      signed.ok
        ? ok('signed URL grants time-limited read')
        : bad(`signed URL did not resolve (HTTP ${signed.status})`);
    }
  }
} finally {
  if (uploaded) {
    const del = await fetch(`${URL_BASE}/storage/v1/object/${BUCKET}/${probePath}`, {
      method: 'DELETE', headers: auth,
    });
    console.log(del.ok ? '  ok    probe deleted' : '  FAIL  probe NOT deleted — remove it by hand');
    if (!del.ok) failures++;
  }
}

console.log(failures === 0 ? '\nBucket is ready and private.' : `\n${failures} problem(s) found.`);
process.exit(failures === 0 ? 0 : 1);
