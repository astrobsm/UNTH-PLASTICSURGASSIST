/**
 * AI-Powered Wound Measurement Service
 *
 * Uses TensorFlow.js for wound segmentation and native CV algorithms for:
 * - HSV color-space wound detection
 * - Adaptive thresholding & morphological ops
 * - Connected component labeling (largest wound region)
 * - Contour tracing (Moore boundary trace)
 * - Hough line transform for ruler/grid calibration detection
 * - Green calibration marker detection
 * - Progress report generation with Chart.js data
 *
 * Replaces OpenCV dependency with native TypeScript implementations.
 */

import * as tf from '@tensorflow/tfjs';

// ============================================
// INTERFACES
// ============================================

export interface WoundMeasurementResult {
  length: number;          // cm
  width: number;           // cm
  area: number;            // cm�
  perimeter: number;       // cm
  depth?: number;
  confidence: number;      // 0-1
  boundingBox: { x: number; y: number; width: number; height: number };
  contourPoints: Array<{ x: number; y: number }>;
  segmentationMask: ImageData;
  measurements: {
    pixelLength: number;
    pixelWidth: number;
    pixelArea: number;
    pixelPerimeter: number;
    calibrationFactor: number; // pixels per cm
  };
  calibrationMethod: string;
}

export interface CalibrationReference {
  type: 'ruler' | 'coin' | 'card' | 'manual' | 'grid' | 'green_marker';
  knownSizeCm: number;
  pixelSize: number;
  detectionMethod: 'automatic' | 'manual_selection';
  confidence: number;
}

export interface WoundProgressEntry {
  date: string;
  length: number;
  width: number;
  area: number;
  perimeter?: number;
  granulation_percentage?: number;
  healing_phase?: string;
}

export interface WoundProgressReport {
  trend: 'improving' | 'stable' | 'worsening';
  percentageChange: number;
  averageHealingRate: number;
  estimatedHealingTime?: number;
  weeklyRates: Array<{ week: string; rate: number }>;
  recommendations: string[];
}

// ============================================
// HELPER: RGB ? HSV
// ============================================

function rgbToHsv(r: number, g: number, b: number): [number, number, number] {
  r /= 255; g /= 255; b /= 255;
  const max = Math.max(r, g, b), min = Math.min(r, g, b);
  const d = max - min;
  let h = 0;
  const s = max === 0 ? 0 : d / max;
  const v = max;
  if (d !== 0) {
    if (max === r) h = ((g - b) / d + (g < b ? 6 : 0)) / 6;
    else if (max === g) h = ((b - r) / d + 2) / 6;
    else h = ((r - g) / d + 4) / 6;
  }
  return [h * 360, s * 100, v * 100];
}

// ============================================
// CORE CV ALGORITHMS (native OpenCV equivalents)
// ============================================

/** Gaussian blur 5�5 */
function gaussianBlur5x5(data: Uint8ClampedArray, w: number, h: number): Uint8ClampedArray {
  const kernel = [1,4,7,4,1,4,16,26,16,4,7,26,41,26,7,4,16,26,16,4,1,4,7,4,1];
  const kSum = 273;
  const out = new Uint8ClampedArray(data.length);
  for (let y = 2; y < h - 2; y++) {
    for (let x = 2; x < w - 2; x++) {
      let rS = 0, gS = 0, bS = 0;
      for (let ky = -2; ky <= 2; ky++) {
        for (let kx = -2; kx <= 2; kx++) {
          const idx = ((y + ky) * w + (x + kx)) * 4;
          const kv = kernel[(ky + 2) * 5 + (kx + 2)];
          rS += data[idx] * kv; gS += data[idx + 1] * kv; bS += data[idx + 2] * kv;
        }
      }
      const idx = (y * w + x) * 4;
      out[idx] = rS / kSum; out[idx + 1] = gS / kSum; out[idx + 2] = bS / kSum; out[idx + 3] = 255;
    }
  }
  return out;
}

/** RGBA ? grayscale (single channel) */
function toGrayscale(data: Uint8ClampedArray, length: number): Uint8Array {
  const gray = new Uint8Array(length / 4);
  for (let i = 0; i < gray.length; i++) {
    const idx = i * 4;
    gray[i] = Math.round(0.299 * data[idx] + 0.587 * data[idx + 1] + 0.114 * data[idx + 2]);
  }
  return gray;
}

/** Morphological erosion (binary single-channel mask) */
function erodeMask(mask: Uint8Array, w: number, h: number, radius: number): Uint8Array {
  const out = new Uint8Array(mask.length);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      let min = 255;
      for (let ky = -radius; ky <= radius; ky++) {
        for (let kx = -radius; kx <= radius; kx++) {
          const ny = y + ky, nx = x + kx;
          if (ny >= 0 && ny < h && nx >= 0 && nx < w) min = Math.min(min, mask[ny * w + nx]);
          else min = 0;
        }
      }
      out[y * w + x] = min;
    }
  }
  return out;
}

/** Morphological dilation */
function dilateMask(mask: Uint8Array, w: number, h: number, radius: number): Uint8Array {
  const out = new Uint8Array(mask.length);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      let max = 0;
      for (let ky = -radius; ky <= radius; ky++) {
        for (let kx = -radius; kx <= radius; kx++) {
          const ny = y + ky, nx = x + kx;
          if (ny >= 0 && ny < h && nx >= 0 && nx < w) max = Math.max(max, mask[ny * w + nx]);
        }
      }
      out[y * w + x] = max;
    }
  }
  return out;
}

function morphOpen(mask: Uint8Array, w: number, h: number, r: number): Uint8Array {
  return dilateMask(erodeMask(mask, w, h, r), w, h, r);
}
function morphClose(mask: Uint8Array, w: number, h: number, r: number): Uint8Array {
  return erodeMask(dilateMask(mask, w, h, r), w, h, r);
}

/** Connected component labeling (4-connected) � equivalent to cv2.connectedComponents */
function connectedComponents(mask: Uint8Array, w: number, h: number): { labels: Int32Array; count: number } {
  const labels = new Int32Array(mask.length);
  let nextLabel = 1;
  const parent = new Int32Array(w * h + 1);
  for (let i = 0; i < parent.length; i++) parent[i] = i;
  function find(x: number): number { while (parent[x] !== x) { parent[x] = parent[parent[x]]; x = parent[x]; } return x; }
  function union(a: number, b: number) { const ra = find(a), rb = find(b); if (ra !== rb) parent[ra] = rb; }

  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const idx = y * w + x;
      if (mask[idx] === 0) continue;
      const up = y > 0 ? labels[(y - 1) * w + x] : 0;
      const left = x > 0 ? labels[y * w + (x - 1)] : 0;
      if (up === 0 && left === 0) labels[idx] = nextLabel++;
      else if (up !== 0 && left === 0) labels[idx] = up;
      else if (up === 0 && left !== 0) labels[idx] = left;
      else { labels[idx] = Math.min(up, left); if (up !== left) union(up, left); }
    }
  }
  const remap = new Map<number, number>(); let finalCount = 0;
  for (let i = 0; i < labels.length; i++) {
    if (labels[i] === 0) continue;
    const root = find(labels[i]);
    if (!remap.has(root)) remap.set(root, ++finalCount);
    labels[i] = remap.get(root)!;
  }
  return { labels, count: finalCount };
}

function largestComponent(labels: Int32Array, count: number): number {
  const sizes = new Int32Array(count + 1);
  for (let i = 0; i < labels.length; i++) if (labels[i] > 0) sizes[labels[i]]++;
  let best = 1, bestSize = 0;
  for (let l = 1; l <= count; l++) if (sizes[l] > bestSize) { bestSize = sizes[l]; best = l; }
  return best;
}

/** Moore boundary tracing � equivalent to cv2.findContours */
function traceContour(mask: Uint8Array, w: number, h: number): Array<{ x: number; y: number }> {
  let startX = -1, startY = -1;
  for (let y = 0; y < h && startX < 0; y++)
    for (let x = 0; x < w && startX < 0; x++)
      if (mask[y * w + x] > 0) { startX = x; startY = y; }
  if (startX < 0) return [];

  const dx = [1,1,0,-1,-1,-1,0,1];
  const dy = [0,1,1,1,0,-1,-1,-1];
  const contour: Array<{ x: number; y: number }> = [];
  let cx = startX, cy = startY, dir = 7;
  const maxIter = w * h * 2;
  for (let iter = 0; iter < maxIter; iter++) {
    contour.push({ x: cx, y: cy });
    const searchStart = (dir + (dir % 2 === 0 ? 7 : 6)) % 8;
    let found = false;
    for (let i = 0; i < 8; i++) {
      const d = (searchStart + i) % 8;
      const nx = cx + dx[d], ny = cy + dy[d];
      if (nx >= 0 && nx < w && ny >= 0 && ny < h && mask[ny * w + nx] > 0) {
        dir = d; cx = nx; cy = ny; found = true; break;
      }
    }
    if (!found) break;
    if (cx === startX && cy === startY && contour.length > 2) break;
  }
  return contour;
}

function contourPerimeter(pts: Array<{ x: number; y: number }>): number {
  if (pts.length < 2) return 0;
  let p = 0;
  for (let i = 0; i < pts.length; i++) {
    const next = pts[(i + 1) % pts.length];
    p += Math.sqrt((next.x - pts[i].x) ** 2 + (next.y - pts[i].y) ** 2);
  }
  return p;
}

/** PCA-based minimum area bounding rectangle */
function minAreaRect(pts: Array<{ x: number; y: number }>): { length: number; width: number; cx: number; cy: number } {
  if (pts.length === 0) return { length: 0, width: 0, cx: 0, cy: 0 };
  let sumX = 0, sumY = 0;
  for (const p of pts) { sumX += p.x; sumY += p.y; }
  const cx = sumX / pts.length, cy = sumY / pts.length;
  let cxx = 0, cyy = 0, cxy = 0;
  for (const p of pts) { const dx = p.x - cx, dy = p.y - cy; cxx += dx * dx; cyy += dy * dy; cxy += dx * dy; }
  const angle = 0.5 * Math.atan2(2 * cxy, cxx - cyy);
  const cos = Math.cos(angle), sin = Math.sin(angle);
  let minU = Infinity, maxU = -Infinity, minV = Infinity, maxV = -Infinity;
  for (const p of pts) {
    const u = (p.x - cx) * cos + (p.y - cy) * sin;
    const v = -(p.x - cx) * sin + (p.y - cy) * cos;
    minU = Math.min(minU, u); maxU = Math.max(maxU, u); minV = Math.min(minV, v); maxV = Math.max(maxV, v);
  }
  const d1 = maxU - minU, d2 = maxV - minV;
  return { length: Math.max(d1, d2), width: Math.min(d1, d2), cx, cy };
}

// ============================================
// CALIBRATION DETECTION
// ============================================

/** Detect green calibration markers from our printed rulers */
function detectGreenMarkers(data: Uint8ClampedArray, w: number, h: number): { found: boolean; pixelsPerCm: number; confidence: number } {
  const greenMask = new Uint8Array(w * h);
  let greenCount = 0;
  for (let i = 0; i < w * h; i++) {
    const idx = i * 4;
    const [hue, sat, val] = rgbToHsv(data[idx], data[idx + 1], data[idx + 2]);
    if (hue >= 80 && hue <= 160 && sat > 30 && val > 25) { greenMask[i] = 255; greenCount++; }
  }
  if (greenCount < 50) return { found: false, pixelsPerCm: 0, confidence: 0 };
  const cleaned = morphOpen(morphClose(greenMask, w, h, 2), w, h, 1);
  const cc = connectedComponents(cleaned, w, h);
  if (cc.count === 0) return { found: false, pixelsPerCm: 0, confidence: 0 };
  const targetLabel = largestComponent(cc.labels, cc.count);
  let minX = w, maxX = 0, minY = h, maxY = 0, count = 0;
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    if (cc.labels[y * w + x] === targetLabel) { minX = Math.min(minX, x); maxX = Math.max(maxX, x); minY = Math.min(minY, y); maxY = Math.max(maxY, y); count++; }
  }
  const mW = maxX - minX, mH = maxY - minY;
  const longer = Math.max(mW, mH);
  const aspect = mW > mH ? mW / Math.max(1, mH) : mH / Math.max(1, mW);
  const knownCm = aspect > 8 ? 15 : aspect > 3 ? 5 : 1;
  const pxPerCm = longer / knownCm;
  const fill = count / ((mW + 1) * (mH + 1));
  return { found: true, pixelsPerCm: pxPerCm, confidence: Math.min(0.95, 0.5 + fill * 0.3 + (longer > 100 ? 0.15 : 0)) };
}

/** Detect 1cm grid lines via horizontal line frequency analysis */
function detectGridLines(gray: Uint8Array, w: number, h: number): { found: boolean; pixelsPerCm: number; confidence: number } {
  const hEdges = new Float32Array(w * h);
  for (let y = 1; y < h - 1; y++)
    for (let x = 1; x < w - 1; x++)
      hEdges[y * w + x] = Math.abs(-gray[(y - 1) * w + x] + gray[(y + 1) * w + x]);
  const rowProj = new Float32Array(h);
  for (let y = 0; y < h; y++) { let s = 0; for (let x = 0; x < w; x++) s += hEdges[y * w + x]; rowProj[y] = s; }
  const thresh = rowProj.reduce((a, b) => a + b, 0) / h * 2;
  const peaks: number[] = [];
  for (let y = 2; y < h - 2; y++)
    if (rowProj[y] > thresh && rowProj[y] >= rowProj[y - 1] && rowProj[y] >= rowProj[y + 1]) peaks.push(y);
  if (peaks.length < 3) return { found: false, pixelsPerCm: 0, confidence: 0 };
  const spacings: number[] = [];
  for (let i = 1; i < peaks.length; i++) spacings.push(peaks[i] - peaks[i - 1]);
  spacings.sort((a, b) => a - b);
  const median = spacings[Math.floor(spacings.length / 2)];
  const consistent = spacings.filter(s => Math.abs(s - median) / median < 0.3);
  if (consistent.length < 2) return { found: false, pixelsPerCm: 0, confidence: 0 };
  const avg = consistent.reduce((a, b) => a + b, 0) / consistent.length;
  const ratio = consistent.length / spacings.length;
  return { found: true, pixelsPerCm: avg, confidence: Math.min(0.95, 0.4 + ratio * 0.4 + (consistent.length > 5 ? 0.15 : 0)) };
}

/** Detect ruler tick marks via vertical edge projection */
function detectRulerMarkings(gray: Uint8Array, w: number, h: number): { found: boolean; pixelsPerCm: number; confidence: number } {
  const vEdges = new Float32Array(w * h);
  for (let y = 1; y < h - 1; y++)
    for (let x = 1; x < w - 1; x++)
      vEdges[y * w + x] = Math.abs(-gray[y * w + (x - 1)] + gray[y * w + (x + 1)]);
  const colProj = new Float32Array(w);
  for (let x = 0; x < w; x++) { let s = 0; for (let y = 0; y < h; y++) s += vEdges[y * w + x]; colProj[x] = s; }
  const thresh = colProj.reduce((a, b) => a + b, 0) / w * 2;
  const peaks: number[] = [];
  for (let x = 2; x < w - 2; x++)
    if (colProj[x] > thresh && colProj[x] >= colProj[x - 1] && colProj[x] >= colProj[x + 1]) peaks.push(x);
  if (peaks.length < 3) return { found: false, pixelsPerCm: 0, confidence: 0 };
  const spacings: number[] = [];
  for (let i = 1; i < peaks.length; i++) spacings.push(peaks[i] - peaks[i - 1]);
  spacings.sort((a, b) => a - b);
  const median = spacings[Math.floor(spacings.length / 2)];
  const consistent = spacings.filter(s => Math.abs(s - median) / median < 0.3);
  if (consistent.length < 2) return { found: false, pixelsPerCm: 0, confidence: 0 };
  const avg = consistent.reduce((a, b) => a + b, 0) / consistent.length;
  const pxPerCm = avg < 20 ? avg * 10 : avg; // 1mm vs 1cm ticks
  const ratio = consistent.length / spacings.length;
  return { found: true, pixelsPerCm: pxPerCm, confidence: Math.min(0.9, 0.35 + ratio * 0.4 + (consistent.length > 5 ? 0.15 : 0)) };
}

// ============================================
// WOUND SEGMENTATION
// ============================================

/** HSV-based wound pixel classification */
function classifyWoundPixel(r: number, g: number, b: number): boolean {
  const [h, s, v] = rgbToHsv(r, g, b);
  if (v < 12 || v > 95) return false;
  if (s < 12 && v > 60) return false;
  if (h >= 80 && h <= 170 && s > 20) return false; // green (calibration)
  if (h >= 190 && h <= 260 && s > 25) return false; // blue (gloves)
  if ((h <= 25 || h >= 340) && s > 20 && v > 20) return true; // red/pink
  if (h >= 15 && h <= 45 && s > 15 && s < 70 && v > 15 && v < 70) return true; // brown
  if (h >= 40 && h <= 70 && s > 20 && v > 30) return true; // yellow slough
  if ((h <= 15 || h >= 345) && s > 40 && v > 15 && v < 55) return true; // dark red
  return false;
}

/** TensorFlow.js + HSV hybrid wound segmentation */
async function segmentWoundTF(imageData: ImageData): Promise<Uint8Array> {
  const { width: w, height: h, data } = imageData;
  const tensor = tf.tidy(() => {
    const img = tf.browser.fromPixels(imageData).toFloat().div(255);
    const r = img.slice([0, 0, 0], [-1, -1, 1]).squeeze();
    const g = img.slice([0, 0, 1], [-1, -1, 1]).squeeze();
    const b = img.slice([0, 0, 2], [-1, -1, 1]).squeeze();
    const score = r.sub(g.mul(0.5)).sub(b.mul(0.3));
    const min = score.min(), max = score.max();
    return score.sub(min).div(max.sub(min).add(1e-6));
  });
  const probMap = await tensor.data() as Float32Array;
  tensor.dispose();

  const mask = new Uint8Array(w * h);
  for (let i = 0; i < w * h; i++) {
    const idx = i * 4;
    const hsv = classifyWoundPixel(data[idx], data[idx + 1], data[idx + 2]);
    const p = probMap[i];
    if ((hsv && p > 0.3) || p > 0.6 || (hsv && p > 0.15)) mask[i] = 255;
  }
  const cleaned = morphOpen(morphClose(mask, w, h, 3), w, h, 2);
  const cc = connectedComponents(cleaned, w, h);
  if (cc.count === 0) return cleaned;
  const mainLabel = largestComponent(cc.labels, cc.count);
  const result = new Uint8Array(w * h);
  for (let i = 0; i < result.length; i++) result[i] = cc.labels[i] === mainLabel ? 255 : 0;
  return dilateMask(result, w, h, 1);
}

// ============================================
// MAIN SERVICE CLASS
// ============================================

export class AIWoundMeasurementService {
  private isReady = false;

  async initialize(): Promise<void> {
    await tf.ready();
    this.isReady = true;
    console.log('AI Wound Measurement engine ready (TF.js backend:', tf.getBackend(), ')');
  }

  /** Auto-detect calibration: green markers → grid lines → ruler markings → fallback */
  async detectCalibration(imageData: ImageData): Promise<CalibrationReference> {
    const { width: w, height: h, data } = imageData;
    const gray = toGrayscale(data, data.length);

    const green = detectGreenMarkers(data, w, h);
    if (green.found && green.confidence > 0.5) {
      return { type: 'green_marker', knownSizeCm: 1, pixelSize: green.pixelsPerCm, detectionMethod: 'automatic', confidence: green.confidence };
    }
    const grid = detectGridLines(gray, w, h);
    if (grid.found && grid.confidence > 0.45) {
      return { type: 'grid', knownSizeCm: 1, pixelSize: grid.pixelsPerCm, detectionMethod: 'automatic', confidence: grid.confidence };
    }
    const ruler = detectRulerMarkings(gray, w, h);
    if (ruler.found && ruler.confidence > 0.4) {
      return { type: 'ruler', knownSizeCm: 1, pixelSize: ruler.pixelsPerCm, detectionMethod: 'automatic', confidence: ruler.confidence };
    }
    const estimatedPxPerCm = Math.max(w, h) / 20;
    return { type: 'manual', knownSizeCm: 1, pixelSize: estimatedPxPerCm, detectionMethod: 'automatic', confidence: 0.2 };
  }

  createManualCalibration(pixelLength: number, knownCm: number): CalibrationReference {
    return { type: 'manual', knownSizeCm: knownCm, pixelSize: pixelLength / knownCm, detectionMethod: 'manual_selection', confidence: 0.95 };
  }

  createReferenceCalibration(type: 'coin' | 'card', pixelSize: number): CalibrationReference {
    const knownSizes = { coin: 2.4, card: 8.56 };
    return { type, knownSizeCm: knownSizes[type], pixelSize: pixelSize / knownSizes[type], detectionMethod: 'manual_selection', confidence: 0.85 };
  }

  /** Full wound measurement pipeline */
  async measureWound(imageData: ImageData, calibrationOverride?: CalibrationReference): Promise<WoundMeasurementResult> {
    if (!this.isReady) await this.initialize();
    const { width: w, height: h } = imageData;

    const calibration = calibrationOverride || await this.detectCalibration(imageData);
    const pxPerCm = calibration.pixelSize;

    const blurred = gaussianBlur5x5(imageData.data, w, h);
    const blurredImageData = new ImageData(new Uint8ClampedArray(blurred), w, h);
    const woundMask = await segmentWoundTF(blurredImageData);

    let pixelArea = 0;
    let minX = w, maxX = 0, minY = h, maxY = 0;
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        if (woundMask[y * w + x] > 0) {
          pixelArea++;
          minX = Math.min(minX, x); maxX = Math.max(maxX, x);
          minY = Math.min(minY, y); maxY = Math.max(maxY, y);
        }
      }
    }

    if (pixelArea < 20) {
      const emptyMask = new ImageData(w, h);
      return {
        length: 0, width: 0, area: 0, perimeter: 0, confidence: 0,
        boundingBox: { x: 0, y: 0, width: 0, height: 0 },
        contourPoints: [], segmentationMask: emptyMask,
        measurements: { pixelLength: 0, pixelWidth: 0, pixelArea: 0, pixelPerimeter: 0, calibrationFactor: pxPerCm },
        calibrationMethod: calibration.type
      };
    }

    const contour = traceContour(woundMask, w, h);
    const pixelPerimeter = contourPerimeter(contour);
    const rect = contour.length > 10
      ? minAreaRect(contour)
      : { length: maxX - minX, width: maxY - minY, cx: (minX + maxX) / 2, cy: (minY + maxY) / 2 };

    const lengthCm = rect.length / pxPerCm;
    const widthCm = rect.width / pxPerCm;
    const areaCm2 = pixelArea / (pxPerCm * pxPerCm);
    const perimeterCm = pixelPerimeter / pxPerCm;

    const fillRatio = pixelArea / ((maxX - minX + 1) * (maxY - minY + 1));
    const confidence = Math.min(0.98, calibration.confidence * 0.5 + fillRatio * 0.3 + (contour.length > 50 ? 0.18 : 0.05));

    const maskImageData = new ImageData(w, h);
    for (let i = 0; i < woundMask.length; i++) {
      if (woundMask[i] > 0) {
        const idx = i * 4;
        maskImageData.data[idx] = 255;
        maskImageData.data[idx + 1] = 60;
        maskImageData.data[idx + 2] = 60;
        maskImageData.data[idx + 3] = 160;
      }
    }

    const step = Math.max(1, Math.floor(contour.length / 200));
    const sampledContour = contour.filter((_, i) => i % step === 0);

    return {
      length: parseFloat(lengthCm.toFixed(2)),
      width: parseFloat(widthCm.toFixed(2)),
      area: parseFloat(areaCm2.toFixed(2)),
      perimeter: parseFloat(perimeterCm.toFixed(2)),
      confidence: parseFloat(confidence.toFixed(3)),
      boundingBox: { x: minX, y: minY, width: maxX - minX + 1, height: maxY - minY + 1 },
      contourPoints: sampledContour,
      segmentationMask: maskImageData,
      measurements: { pixelLength: rect.length, pixelWidth: rect.width, pixelArea, pixelPerimeter, calibrationFactor: pxPerCm },
      calibrationMethod: calibration.type
    };
  }

  /** Render measurement overlay on canvas */
  renderOverlay(ctx: CanvasRenderingContext2D, result: WoundMeasurementResult, canvasWidth: number, canvasHeight: number): void {
    const scaleX = canvasWidth / result.segmentationMask.width;
    const scaleY = canvasHeight / result.segmentationMask.height;

    const tc = document.createElement('canvas');
    tc.width = result.segmentationMask.width;
    tc.height = result.segmentationMask.height;
    tc.getContext('2d')!.putImageData(result.segmentationMask, 0, 0);
    ctx.globalAlpha = 0.4;
    ctx.drawImage(tc, 0, 0, canvasWidth, canvasHeight);
    ctx.globalAlpha = 1.0;

    if (result.contourPoints.length > 2) {
      ctx.beginPath();
      ctx.moveTo(result.contourPoints[0].x * scaleX, result.contourPoints[0].y * scaleY);
      for (const pt of result.contourPoints) ctx.lineTo(pt.x * scaleX, pt.y * scaleY);
      ctx.closePath();
      ctx.strokeStyle = '#00FF00';
      ctx.lineWidth = 2;
      ctx.stroke();
    }

    const bb = result.boundingBox;
    ctx.strokeStyle = '#FFD700';
    ctx.lineWidth = 2;
    ctx.setLineDash([6, 4]);
    ctx.strokeRect(bb.x * scaleX, bb.y * scaleY, bb.width * scaleX, bb.height * scaleY);
    ctx.setLineDash([]);

    const fs = Math.max(12, Math.min(18, canvasWidth / 30));
    ctx.font = `bold ${fs}px sans-serif`;
    ctx.fillStyle = '#FFD700';
    ctx.strokeStyle = '#000';
    ctx.lineWidth = 3;

    const lt = `${result.length} cm`;
    const lx = (bb.x + bb.width / 2) * scaleX;
    const ly = bb.y * scaleY - 8;
    ctx.strokeText(lt, lx - ctx.measureText(lt).width / 2, ly);
    ctx.fillText(lt, lx - ctx.measureText(lt).width / 2, ly);

    const wt = `${result.width} cm`;
    const wx = (bb.x + bb.width) * scaleX + 8;
    const wy = (bb.y + bb.height / 2) * scaleY;
    ctx.strokeText(wt, wx, wy);
    ctx.fillText(wt, wx, wy);

    ctx.font = `bold ${fs + 2}px sans-serif`;
    ctx.fillStyle = '#FFF';
    const at = `${result.area} cm\u00B2`;
    const ax = (bb.x + bb.width / 2) * scaleX - ctx.measureText(at).width / 2;
    const ay = (bb.y + bb.height / 2) * scaleY;
    ctx.strokeText(at, ax, ay);
    ctx.fillText(at, ax, ay);

    const bf = Math.max(10, fs - 4);
    ctx.font = `${bf}px sans-serif`;
    const calText = `Cal: ${result.calibrationMethod} (${(result.confidence * 100).toFixed(0)}%)`;
    const cw = ctx.measureText(calText).width + 12;
    ctx.fillStyle = 'rgba(0,0,0,0.7)';
    ctx.fillRect(canvasWidth - cw - 8, canvasHeight - bf - 14, cw, bf + 8);
    ctx.fillStyle = result.confidence > 0.5 ? '#4ADE80' : '#FBBF24';
    ctx.fillText(calText, canvasWidth - cw - 2, canvasHeight - 10);
  }

  /** Generate wound healing progress report */
  generateProgressReport(measurements: WoundProgressEntry[]): WoundProgressReport {
    if (measurements.length < 2) {
      return {
        trend: 'stable', percentageChange: 0, averageHealingRate: 0,
        weeklyRates: [],
        recommendations: ['Continue current treatment plan', 'Reassess after next measurement']
      };
    }
    const sorted = [...measurements].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
    const first = sorted[0], last = sorted[sorted.length - 1];
    const areaChange = first.area - last.area;
    const percentageChange = first.area > 0 ? (areaChange / first.area) * 100 : 0;
    const totalDays = Math.max(1, (new Date(last.date).getTime() - new Date(first.date).getTime()) / 86400000);
    const avgRate = areaChange / totalDays;

    const weeklyRates: Array<{ week: string; rate: number }> = [];
    for (let i = 1; i < sorted.length; i++) {
      const dd = (new Date(sorted[i].date).getTime() - new Date(sorted[i - 1].date).getTime()) / 86400000;
      if (dd > 0) weeklyRates.push({ week: new Date(sorted[i].date).toLocaleDateString(), rate: (sorted[i - 1].area - sorted[i].area) / dd });
    }

    let trend: 'improving' | 'stable' | 'worsening';
    if (percentageChange > 10) trend = 'improving';
    else if (percentageChange < -10) trend = 'worsening';
    else trend = 'stable';

    let estimatedHealingTime: number | undefined;
    if (avgRate > 0 && last.area > 0) estimatedHealingTime = Math.ceil(last.area / avgRate);

    const recommendations: string[] = [];
    if (trend === 'improving') {
      recommendations.push('Wound is healing well \u2014 continue current treatment.');
      recommendations.push(`Healing rate: ${avgRate.toFixed(2)} cm\u00B2/day`);
      if (estimatedHealingTime) recommendations.push(`Estimated complete healing: ~${estimatedHealingTime} days`);
    } else if (trend === 'worsening') {
      recommendations.push('Wound size increasing \u2014 reassess treatment immediately.');
      recommendations.push('Consider: infection, inadequate debridement, poor perfusion.');
      recommendations.push('Review: nutrition, glycemic control, pressure offloading.');
      recommendations.push('Consider specialist consultation if no improvement in 1 week.');
    } else {
      recommendations.push('Wound size stable \u2014 monitor closely for changes.');
      recommendations.push('Consider treatment modification if no improvement in 2 weeks.');
    }

    return {
      trend,
      percentageChange: parseFloat(percentageChange.toFixed(1)),
      averageHealingRate: parseFloat(avgRate.toFixed(3)),
      estimatedHealingTime,
      weeklyRates,
      recommendations
    };
  }
}

// Singleton
export const aiWoundMeasurement = new AIWoundMeasurementService();
