import { test, expect } from '@playwright/test';
import { bootOfflineReady, chunkPath, discoverRoutes, ocrAssetUrls, seedSession, warmOcrPack } from './helpers';

/**
 * Offline guarantees for the clinical PWA.
 *
 * The promise these tests defend: a device that has loaded the app once can be
 * taken onto a ward with no connectivity and every module still opens, the type
 * still renders, and document scanning still works.
 */

test.describe('offline PWA', () => {
  test('app shell, module chunks and local assets survive the network being cut', async ({ page, context, baseURL }) => {
    const external = new Set<string>();
    page.on('request', (r) => {
      const origin = new URL(r.url()).origin;
      if (origin !== baseURL && !r.url().startsWith('data:') && !r.url().startsWith('blob:')) {
        external.add(origin);
      }
    });

    const precached = await bootOfflineReady(page, baseURL!);
    expect(precached, 'service worker should precache the whole app shell').toBeGreaterThan(100);

    await warmOcrPack(page);

    // ── Cut the network ──
    await context.setOffline(true);
    await page.reload({ waitUntil: 'domcontentloaded' });

    expect(await page.evaluate(() => navigator.onLine), 'browser should report offline').toBe(false);

    // The login screen is the app shell rendering from cache.
    await expect(page.locator('input[type="password"]')).toBeVisible({ timeout: 20_000 });

    // Every lazy route chunk must resolve from cache, not just the ones this
    // page happened to import — that is what makes unvisited modules work.
    const chunks = await page.evaluate(async () => {
      const names = await caches.keys();
      const pc = names.find((n) => n.startsWith('workbox-precache'))!;
      const urls = (await (await caches.open(pc)).keys())
        .map((r) => r.url)
        .filter((u) => u.includes('/assets/') && u.endsWith('.js'));

      const failed: Array<[string, unknown]> = [];
      for (const u of urls) {
        try {
          const res = await fetch(u);
          if (!res.ok) failed.push([u, res.status]);
        } catch (e) {
          failed.push([u, String(e)]);
        }
      }
      return { total: urls.length, failed };
    });

    expect(chunks.total, 'expected the build to produce many code-split chunks').toBeGreaterThan(50);
    expect(chunks.failed, 'every module chunk must load offline').toEqual([]);

    // Self-hosted font + OCR engine: the assets that used to come from Google
    // and jsdelivr, and so were the app's last runtime network dependencies.
    const localAssets = ['/fonts/inter.css', '/fonts/inter-latin-400.woff2', ...(await ocrAssetUrls(page))];
    const served = await page.evaluate(async (urls) => {
      const out: Record<string, { status?: number; bytes?: number; error?: string }> = {};
      for (const u of urls) {
        try {
          const res = await fetch(u);
          out[u] = { status: res.status, bytes: (await res.arrayBuffer()).byteLength };
        } catch (e) {
          out[u] = { error: String(e) };
        }
      }
      return out;
    }, localAssets);

    for (const [url, result] of Object.entries(served)) {
      expect(result.status, `${url} should be served from cache offline`).toBe(200);
      expect(result.bytes ?? 0, `${url} should not be empty`).toBeGreaterThan(0);
    }

    // Nothing may have reached for a third-party host at any point.
    expect([...external], 'the app must have no external network dependencies').toEqual([]);
  });

  test('OCR reads a document with the network cut', async ({ page, context, baseURL }) => {
    await bootOfflineReady(page, baseURL!);
    await warmOcrPack(page);

    await context.setOffline(true);
    await page.reload({ waitUntil: 'domcontentloaded' });
    expect(await page.evaluate(() => navigator.onLine)).toBe(false);

    // Drive the app's real ocrService singleton out of its built chunk, so this
    // exercises the shipped worker/core/traineddata paths rather than a mock.
    const result = await page.evaluate(async (chunk) => {
      const canvas = document.createElement('canvas');
      canvas.width = 700;
      canvas.height = 180;
      const g = canvas.getContext('2d')!;
      g.fillStyle = '#fff';
      g.fillRect(0, 0, canvas.width, canvas.height);
      g.fillStyle = '#000';
      g.font = 'bold 64px Arial';
      g.fillText('HAEMOGLOBIN 11.4', 20, 110);

      const mod: any = await import(/* @vite-ignore */ chunk);
      const svc: any = Object.values(mod).find((v: any) => v && typeof v.initialize === 'function');
      if (!svc) return { error: 'ocrService singleton not found in chunk exports' };

      await svc.initialize();
      const blob = await (await fetch(canvas.toDataURL('image/png'))).blob();
      const file = new File([blob], 'labs.png', { type: 'image/png' });

      // 'general' keeps the raw recognised text; the lab_report post-processor
      // reshapes it into name/value pairs, which is a separate concern.
      const res = await svc.extractText(file, 'general');
      return { text: (res?.text || '').trim(), confidence: res?.confidence };
    }, chunkPath('ocrService'));

    expect(result.error).toBeUndefined();
    expect(result.text?.toUpperCase()).toContain('HAEMOGLOBIN');
    expect(result.text).toMatch(/11\.?4/);
  });

  test('every module route renders with the network cut', async ({ page, context, baseURL }) => {
    const routes = discoverRoutes();
    // Budget the WORST case per route (nav + the full render wait + settle), not
    // the typical one. Sized to the typical case this timed out on a loaded
    // machine and reported as an opaque test timeout with no failing route named.
    test.setTimeout(90_000 + routes.length * 15_000);

    await bootOfflineReady(page, baseURL!);
    await seedSession(page);
    await context.setOffline(true);

    expect(routes.length, 'routes should be discovered from src/App.tsx').toBeGreaterThan(40);

    for (const route of routes) {
      // A step per route: if the walk ever runs out of time, the report names the
      // route it died on instead of just attaching a screenshot of somewhere.
      await test.step(`offline route ${route}`, async () => {
        const pageErrors: string[] = [];
        const onError = (e: Error) => pageErrors.push(e.message);
        page.on('pageerror', onError);

        try {
          await page.goto(baseURL + route, { waitUntil: 'domcontentloaded' });

          // Wait for the condition rather than a fixed sleep: the lazy chunk has
          // mounted once the pre-React skeleton is gone and real content exists.
          // A timeout here isn't a failure — fall through and let the assertions
          // below report exactly what the page was showing.
          await page
            .waitForFunction(
              () => !document.getElementById('app-loader') && (document.body.innerText || '').trim().length > 40,
              undefined,
              { timeout: 5_000 }
            )
            .catch(() => {});

          // Brief settle so errors thrown by the first round of data reads (which
          // resolve just after paint) are still attributed to this route — the
          // listener is detached in `finally`, so anything later is lost.
          await page.waitForTimeout(800);

          const state = await page.evaluate(() => {
            const text = (document.body.innerText || '').trim();
            return {
              chars: text.length,
              // ErrorBoundary copy, and the pre-React skeleton that never cleared.
              boundary: /Something went wrong|Application Error/i.test(text),
              stuckOnLoader: !!document.getElementById('app-loader'),
              head: text.slice(0, 80).replace(/\s+/g, ' '),
            };
          });

          // Soft so one broken module reports alongside the rest instead of
          // masking every route after it.
          expect.soft(state.boundary, `${route} hit the error boundary`).toBe(false);
          expect.soft(state.stuckOnLoader, `${route} never left the loading skeleton`).toBe(false);
          expect.soft(state.chars, `${route} rendered no content (saw: "${state.head}")`).toBeGreaterThan(40);
          expect.soft(pageErrors, `${route} threw: ${pageErrors[0] ?? ''}`).toEqual([]);
        } finally {
          page.off('pageerror', onError);
        }
      });
    }
  });
});
