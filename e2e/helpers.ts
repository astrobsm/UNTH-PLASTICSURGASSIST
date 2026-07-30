import { readFileSync, readdirSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import type { Page } from '@playwright/test';

// The package is "type": "module", so there is no __dirname here.
export const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

/**
 * The SIMD probe from wasm-feature-detect, inlined — mirrors pickTesseractCore()
 * in src/config/ocrAssets.ts. Kept as a plain array so it can be serialised into
 * page.evaluate().
 */
export const WASM_SIMD_PROBE = [
  0, 97, 115, 109, 1, 0, 0, 0, 1, 5, 1, 96, 0, 1, 123, 3, 2, 1, 0, 10, 10, 1, 8, 0, 65, 0, 253, 15, 253, 98, 11,
];

/** The three OCR files this device would actually download. */
export async function ocrAssetUrls(page: Page): Promise<string[]> {
  return page.evaluate((probe) => {
    const simd = WebAssembly.validate(new Uint8Array(probe));
    return [
      '/tesseract/worker.min.js',
      simd ? '/tesseract/tesseract-core-simd-lstm.wasm.js' : '/tesseract/tesseract-core-lstm.wasm.js',
      '/tesseract/eng.traineddata.gz',
    ];
  }, WASM_SIMD_PROBE);
}

/**
 * Load the app online and wait until it is genuinely offline-ready:
 * service worker active AND the precache populated.
 *
 * The first install fires `controllerchange`, which main.tsx answers with a
 * reload — so anything evaluated too early dies with "Execution context was
 * destroyed". Settling that here keeps it out of every test.
 */
export async function bootOfflineReady(page: Page, baseURL: string): Promise<number> {
  await page.goto(baseURL, { waitUntil: 'networkidle' });
  await page.evaluate(() => navigator.serviceWorker.ready);
  await page.waitForTimeout(4000);
  await page.waitForLoadState('load').catch(() => {});

  return page.evaluate(async () => {
    const count = async () => {
      const names = await caches.keys();
      const pc = names.find((n) => n.startsWith('workbox-precache'));
      return pc ? (await (await caches.open(pc)).keys()).length : 0;
    };
    for (let i = 0; i < 60; i++) {
      const n = await count();
      if (n > 100) return n;
      await new Promise((r) => setTimeout(r, 1000));
    }
    return count();
  });
}

/**
 * Pull the OCR engine into the Cache API — the page-side equivalent of
 * cacheWarmer.warmOfflineAssets(), which the app runs after login.
 */
export async function warmOcrPack(page: Page): Promise<void> {
  const urls = await ocrAssetUrls(page);
  const failures = await page.evaluate(async (list) => {
    const cache = await caches.open('ocr-engine-cache');
    const failed: string[] = [];
    for (const u of list) {
      try {
        await cache.add(u);
      } catch (e) {
        failed.push(`${u}: ${e}`);
      }
    }
    return failed;
  }, urls);

  if (failures.length) throw new Error(`Could not warm OCR pack: ${failures.join(', ')}`);
}

/** Seed the session an earlier online login would have left behind. */
export async function seedSession(page: Page): Promise<void> {
  await page.evaluate(() => {
    const user = { id: '1', name: 'E2E Consultant', email: 'e2e@example.test', role: 'admin', privileges: [] };
    localStorage.setItem('psa-auth', JSON.stringify({ state: { user, token: 'e2e-token' }, version: 0 }));
    localStorage.setItem('auth_token', 'e2e-token');
    localStorage.setItem('userId', '1');
    // Skip the House Officer acknowledgment gate.
    localStorage.setItem('ho_ack_1', 'true');
  });
}

/** Name of a built asset chunk, e.g. chunkPath('ocrService') → /assets/ocrService-a1b2c3.js */
export function chunkPath(prefix: string): string {
  const file = readdirSync(path.join(ROOT, 'dist/assets')).find((n) => n.startsWith(`${prefix}-`));
  if (!file) throw new Error(`No built chunk starting with "${prefix}-" in dist/assets`);
  return `/assets/${file}`;
}

// Routes that can't be asserted this way, with the reason:
//   /conference        full-screen WebRTC; asks for camera/mic and has no static shell
//   /submit-consult    public token route; renders an "invalid link" state by design
const ROUTE_EXCLUSIONS = ['/conference', '/submit-consult'];

/**
 * Every navigable route, read out of src/App.tsx rather than hard-coded, so a
 * module added later is covered by the offline suite without anyone remembering
 * to update this list.
 */
export function discoverRoutes(): string[] {
  const src = readFileSync(path.join(ROOT, 'src/App.tsx'), 'utf8');
  const paths = [...src.matchAll(/<Route\s+path="([^"]+)"/g)].map((m) => m[1]);

  const usable = paths.filter(
    (p) =>
      p.startsWith('/') &&
      !p.includes(':') && // needs a real id
      !p.includes('*') && // catch-alls
      !ROUTE_EXCLUSIONS.some((x) => p.startsWith(x))
  );

  return [...new Set(usable)].sort();
}
