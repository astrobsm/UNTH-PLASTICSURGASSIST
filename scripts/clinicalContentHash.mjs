/**
 * Digest of the clinical logic that a sign-off attests to.
 *
 * WHY
 * A clinical review is only meaningful against the exact content that was
 * reviewed. Without binding the two, a consultant ratifies the staging engine
 * in August, someone edits the treatment thresholds in October, and the
 * "Locally ratified by Dr X" banner keeps reassuring users about logic that
 * doctor never saw. The attestation silently becomes a lie.
 *
 * So a ratification records the digest of the files it covers. If those files
 * change, the digest no longer matches and the ratification is treated as
 * stale — the module falls back to the "not yet reviewed" banner and a test
 * fails in CI. Re-review is then a deliberate act, not something anyone can
 * forget.
 *
 * Usage:
 *   node scripts/clinicalContentHash.mjs            print current digests
 *   node scripts/clinicalContentHash.mjs --check     exit 1 if a ratified digest is stale
 */

import { createHash } from 'node:crypto';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

/**
 * Repo root.
 *
 * Vitest transforms this module and hands it a non-file `import.meta.url`, so
 * fileURLToPath throws there. The test suite is the main consumer of this
 * digest, so falling back to the working directory is not a nicety — without
 * it the guard cannot run at all.
 */
const ROOT = (() => {
  try {
    return join(fileURLToPath(new URL('.', import.meta.url)), '..');
  } catch {
    return process.cwd();
  }
})();

/**
 * The file sets each sign-off covers.
 *
 * `exclude` keeps the provenance file itself out of its own digest — it
 * contains the recorded hash, so including it would make the digest
 * impossible to satisfy.
 */
export const MODULES = {
  oncology: {
    label: 'Tumour Board',
    provenance: 'src/services/oncology/guidelineProvenance.ts',
    roots: ['src/services/oncology'],
    exclude: ['src/services/oncology/guidelineProvenance.ts'],
  },
  clinicianAssistant: {
    label: 'Clinician Assistant',
    provenance: 'src/services/clinicianAssistant/clinicalProvenance.ts',
    roots: [
      'src/services/clinicianAssistant/engine',
      'src/services/clinicianAssistant/ecg',
    ],
    files: [
      'src/services/clinicianAssistant/calculators.ts',
      'src/services/clinicianAssistant/clinicalCalculators.ts',
    ],
    exclude: ['src/services/clinicianAssistant/clinicalProvenance.ts'],
  },
};

function walk(dir, out = []) {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) walk(full, out);
    else if (/\.tsx?$/.test(entry)) out.push(full);
  }
  return out;
}

/** Every file a module's sign-off covers, as repo-relative POSIX paths, sorted. */
export function filesFor(name) {
  const mod = MODULES[name];
  if (!mod) throw new Error(`Unknown clinical module: ${name}`);

  const abs = [];
  for (const root of mod.roots ?? []) abs.push(...walk(join(ROOT, root)));
  for (const f of mod.files ?? []) abs.push(join(ROOT, f));

  const rel = abs.map(p => relative(ROOT, p).split(sep).join('/'));
  const excluded = new Set(mod.exclude ?? []);

  // Sorted so the digest does not depend on directory iteration order, which
  // differs between filesystems.
  return [...new Set(rel)].filter(p => !excluded.has(p)).sort();
}

/**
 * SHA-256 over the covered files. Line endings are normalised so a checkout on
 * Windows and one on Linux produce the same digest — otherwise CI would report
 * every ratification as stale.
 */
export function digestFor(name) {
  const hash = createHash('sha256');
  for (const rel of filesFor(name)) {
    const content = readFileSync(join(ROOT, rel), 'utf8').replace(/\r\n/g, '\n');
    hash.update(rel);
    hash.update('\0');
    hash.update(content);
    hash.update('\0');
  }
  return hash.digest('hex').slice(0, 32);
}

/**
 * Reads `status` and `ratifiedContentHash` out of a provenance source file.
 *
 * Comments are stripped first. The sign-off instructions in those files say
 * "Set `status: 'ratified'`" verbatim, and matching that made every module
 * report itself ratified — the exact false reassurance this whole mechanism
 * exists to prevent.
 */
export function recordedReview(name) {
  const mod = MODULES[name];
  let src;
  try {
    src = readFileSync(join(ROOT, mod.provenance), 'utf8');
  } catch {
    return { status: 'missing', ratifiedContentHash: null };
  }

  const code = src
    .replace(/\/\*[\s\S]*?\*\//g, '')   // block comments
    .replace(/(^|[^:])\/\/.*$/gm, '$1'); // line comments, leaving URLs alone

  const status = /status:\s*'(pending_local_review|ratified)'/.exec(code)?.[1] ?? 'unknown';
  const ratifiedContentHash = /ratifiedContentHash:\s*'([a-f0-9]*)'/.exec(code)?.[1] ?? null;
  return { status, ratifiedContentHash };
}

function main() {
  const check = process.argv.includes('--check');
  let stale = false;

  for (const name of Object.keys(MODULES)) {
    const current = digestFor(name);
    const { status, ratifiedContentHash } = recordedReview(name);
    const count = filesFor(name).length;

    let verdict;
    if (status === 'ratified' && ratifiedContentHash !== current) {
      verdict = 'STALE — logic changed since sign-off';
      stale = true;
    } else if (status === 'ratified') {
      verdict = 'ratified, digest matches';
    } else {
      verdict = 'awaiting clinical review';
    }

    console.log(`${MODULES[name].label}`);
    console.log(`  files covered   ${count}`);
    console.log(`  current digest  ${current}`);
    console.log(`  recorded        ${ratifiedContentHash ?? '(none)'}`);
    console.log(`  status          ${verdict}\n`);
  }

  if (check && stale) {
    console.error('A ratified module has changed since it was signed off. Re-review, then update');
    console.error('ratifiedContentHash to the current digest printed above.');
    process.exit(1);
  }
}

if (process.argv[1] && process.argv[1].endsWith('clinicalContentHash.mjs')) main();
