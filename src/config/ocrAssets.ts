/**
 * Local Tesseract OCR asset paths.
 *
 * Left to its own devices tesseract.js pulls its worker and wasm core from
 * jsdelivr and the language traineddata from tessdata.projectnaptha.com the
 * first time a scan runs — so the "offline fallback" for OCR was itself
 * online-only. scripts/prepare-offline-assets.mjs copies those files into
 * public/tesseract/ at build time; these paths keep every byte same-origin and
 * cacheable.
 *
 * This lives apart from ocrService so the cache warmer can ask which files to
 * download without pulling the whole OCR/AI extraction stack into its chunk.
 */

export const TESSERACT_WORKER_PATH = '/tesseract/worker.min.js';
export const TESSERACT_LANG_PATH = '/tesseract';

/** Cache name for the OCR engine. Mirrored in sw.ts — keep the two in step. */
export const OCR_CACHE_NAME = 'ocr-engine-cache';

// wasm-feature-detect's SIMD probe, inlined: a 31-byte module that only
// validates where the SIMD proposal is implemented.
const WASM_SIMD_PROBE = new Uint8Array([
  0, 97, 115, 109, 1, 0, 0, 0, 1, 5, 1, 96, 0, 1, 123, 3, 2, 1, 0, 10, 10, 1, 8, 0, 65, 0, 253, 15, 253, 98, 11,
]);

let cachedCorePath: string | null = null;

/**
 * Resolve which local wasm core this device needs, cached after the first call.
 *
 * We pick the core ourselves rather than handing tesseract.js a directory so
 * only the ONE variant this device can run has to be downloaded and cached
 * instead of all of them. Only `-lstm` cores are shipped — the worker is created
 * with OEM.LSTM_ONLY.
 */
export function pickTesseractCore(): string {
  if (cachedCorePath) return cachedCorePath;
  let simd = false;
  try {
    simd = WebAssembly.validate(WASM_SIMD_PROBE);
  } catch {
    simd = false;
  }
  cachedCorePath = simd
    ? '/tesseract/tesseract-core-simd-lstm.wasm.js'
    : '/tesseract/tesseract-core-lstm.wasm.js';
  return cachedCorePath;
}

/**
 * Every local file the OCR engine needs, for the offline cache warmer.
 * Only the core variant this device would actually load is listed.
 */
export function getTesseractAssetUrls(): string[] {
  return [TESSERACT_WORKER_PATH, pickTesseractCore(), `${TESSERACT_LANG_PATH}/eng.traineddata.gz`];
}
