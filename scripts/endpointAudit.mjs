/**
 * Resolves every endpoint the client calls against the routes the API serves.
 *
 * WHY
 * A client call to a path with no server route fails at runtime, in
 * production, usually inside a try/catch that falls back to local data. That
 * fallback is indistinguishable from "the server has nothing yet", so the bug
 * is invisible until someone notices data never syncs. Four such calls were
 * live in this codebase; one of them had never worked.
 *
 * Vercel's routing is the subtle part. api/patients/index.js contains a
 * handler for /api/patients/:id/name-history, but that path never reaches the
 * file: two-segment paths route to api/patients/[id].js instead. The handler
 * looked correct in review and 404'd in production. So this resolves paths the
 * way the platform does, not the way the handler hopes.
 *
 * Usage: node scripts/endpointAudit.mjs
 */

import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = (() => {
  try {
    return join(fileURLToPath(new URL('.', import.meta.url)), '..');
  } catch {
    return process.cwd();
  }
})();

/**
 * Paths known to have no server implementation.
 *
 * Chat is a built-out UI whose API was never written. The service latches
 * itself off after the first failure, so it degrades to empty rooms rather
 * than breaking the page. Listed here so the audit stays useful for finding
 * NEW breakage instead of reporting a known gap forever — and so that
 * building the chat API means deleting these lines, which is a visible act.
 */
export const KNOWN_UNIMPLEMENTED = [
  '/chat/rooms',
  '/chat/rooms/:v/messages',
  '/chat/messages/search',
];

function walk(dir, test, out = []) {
  let entries;
  try {
    entries = readdirSync(dir);
  } catch {
    return out;
  }
  for (const e of entries) {
    const f = join(dir, e);
    if (statSync(f).isDirectory()) walk(f, test, out);
    else if (test(e)) out.push(f);
  }
  return out;
}

/** Exact routes, dynamic-segment routes and catch-alls the api/ tree serves. */
function serverSurface() {
  const apiRoot = join(ROOT, 'api');
  const files = walk(apiRoot, e => e.endsWith('.js'))
    .map(p => p.slice(apiRoot.length + 1).replace(/\\/g, '/').replace(/\.js$/, ''))
    .filter(p => !p.startsWith('_lib/'));

  const exact = new Set();
  const dynamic = [];
  const catchAll = [];

  for (const f of files) {
    if (f.endsWith('/index')) exact.add('/' + f.slice(0, -'/index'.length));
    else if (/\[\.\.\..+\]$/.test(f)) catchAll.push('/' + f.replace(/\/\[\.\.\..+\]$/, ''));
    else if (/\[.+\]$/.test(f)) dynamic.push('/' + f.replace(/\/\[.+\]$/, ''));
    else exact.add('/' + f);
  }

  // Single-file dispatchers: vercel.json sends every subpath to one handler.
  const dispatchers = [];
  const vercel = JSON.parse(readFileSync(join(ROOT, 'vercel.json'), 'utf8'));
  for (const r of vercel.rewrites ?? []) {
    const m = /^\/api\/([^/]+)\/:path\*$/.exec(r.source);
    if (m) dispatchers.push('/' + m[1]);
  }

  return { exact, dynamic, catchAll, dispatchers };
}

/** Every endpoint path the client asks for, normalised. */
function clientCalls() {
  const srcRoot = join(ROOT, 'src');
  const calls = new Map();
  const CALL =
    /(?:apiClient|api|request)\s*\.\s*(?:get|post|put|patch|delete|request)\s*(?:<[^>]*>)?\s*\(\s*([`'"])([^`'"]+)\1/g;

  for (const file of walk(srcRoot, e => /\.tsx?$/.test(e))) {
    const src = readFileSync(file, 'utf8');
    let m;
    while ((m = CALL.exec(src))) {
      let p = m[2];
      if (!p.startsWith('/')) continue;
      // Template holes become a placeholder segment; the query string does not
      // affect which file serves the route.
      p = p.replace(/\$\{[^}]*\}/g, ':v').split('?')[0].replace(/\/+$/, '');
      if (!p) continue;
      const rel = file.slice(ROOT.length + 1).replace(/\\/g, '/');
      if (!calls.has(p)) calls.set(p, new Set());
      calls.get(p).add(rel);
    }
  }
  return calls;
}

function makeResolver({ exact, dynamic, catchAll, dispatchers }) {
  return function resolves(p) {
    if (exact.has(p)) return true;

    const top = '/' + p.split('/')[1];
    if (dispatchers.includes(top)) return true;
    if (catchAll.some(c => p === c || p.startsWith(c + '/'))) return true;

    // api/x/[id].js serves exactly one segment below /x.
    if (dynamic.some(d => p.startsWith(d + '/') && p.slice(d.length + 1).split('/').length === 1)) {
      return true;
    }

    // /x/:v where api/x/index.js exists — the segment is the [id] parameter.
    const parent = p.slice(0, p.lastIndexOf('/'));
    if (p.endsWith('/:v') && (exact.has(parent) || dispatchers.includes('/' + parent.split('/')[1]))) {
      return true;
    }
    return false;
  };
}

/** Client paths with no server route, excluding the known-unimplemented list. */
export function unresolvedEndpoints() {
  const resolves = makeResolver(serverSurface());
  const known = new Set(KNOWN_UNIMPLEMENTED);
  return [...clientCalls().entries()]
    .filter(([p]) => !resolves(p) && !known.has(p))
    .map(([p, files]) => ({ path: p, files: [...files].sort() }))
    .sort((a, b) => a.path.localeCompare(b.path));
}

/** Entries in KNOWN_UNIMPLEMENTED that now resolve — the list is stale. */
export function staleExemptions() {
  const resolves = makeResolver(serverSurface());
  const called = new Set(clientCalls().keys());
  return KNOWN_UNIMPLEMENTED.filter(p => resolves(p) || !called.has(p));
}

function main() {
  const missing = unresolvedEndpoints();
  const stale = staleExemptions();

  console.log(`client endpoint paths: ${clientCalls().size}`);
  console.log(`unresolved (excluding known gaps): ${missing.length}\n`);
  for (const { path, files } of missing) {
    console.log(`  ${path}`);
    for (const f of files) console.log(`      ${f}`);
  }
  if (stale.length) {
    console.log('\nstale exemptions (now served, or no longer called):');
    for (const p of stale) console.log(`  ${p}`);
  }
  if (missing.length) process.exit(1);
}

if (process.argv[1] && process.argv[1].endsWith('endpointAudit.mjs')) main();
