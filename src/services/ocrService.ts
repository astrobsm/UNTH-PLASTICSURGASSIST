/**
 * OCR Service for Medical Document Scanning
 * 
 * Primary: Google Cloud Vision API via backend /api/ocr/scan
 * Fallback: Tesseract.js (local, offline-capable)
 * 
 * Optimized for laboratory reports, imaging reports, and medical documents
 */

import type { Worker } from 'tesseract.js';
import { apiClient } from './apiClient';
import { validateVitals, validateLabValue, assessImageQuality, type ValidatedVitalReading, type VitalAlert } from './medicalValidation';
import { extractClinicalNotes, type ClinicalNotesExtractionResult } from './clinicalNotesExtraction';

export interface OCRResult {
  text: string;
  confidence: number;
  words: OCRWord[];
  processingTime: number;
}

export interface OCRWord {
  text: string;
  confidence: number;
  bbox: {
    x0: number;
    y0: number;
    x1: number;
    y1: number;
  };
}

export interface OCRProgress {
  status: string;
  progress: number;
}

export type DocumentType = 'lab_report' | 'imaging_report' | 'prescription' | 'handwritten_note' | 'general' | 'clinical_note' | 'consultation' | 'fluid_chart' | 'vital_signs_chart';

// Medical lab value patterns for extraction
const LAB_VALUE_PATTERNS: Record<string, RegExp> = {
  // Complete Blood Count
  hemoglobin: /(?:hb|hgb|haemoglobin|hemoglobin)[:\s]*(\d+\.?\d*)\s*(?:g\/dl|g\/l)?/gi,
  wbc: /(?:wbc|white blood cells?|leucocytes?)[:\s]*(\d+\.?\d*)\s*(?:x10\^?9\/l|\/ul|\/mm3)?/gi,
  rbc: /(?:rbc|red blood cells?|erythrocytes?)[:\s]*(\d+\.?\d*)\s*(?:x10\^?12\/l|m\/ul)?/gi,
  platelets: /(?:plt|platelets?|thrombocytes?)[:\s]*(\d+\.?\d*)\s*(?:x10\^?9\/l|\/ul)?/gi,
  hematocrit: /(?:hct|hematocrit|pcv)[:\s]*(\d+\.?\d*)\s*%?/gi,
  mcv: /(?:mcv)[:\s]*(\d+\.?\d*)\s*(?:fl)?/gi,
  mch: /(?:mch)[:\s]*(\d+\.?\d*)\s*(?:pg)?/gi,
  mchc: /(?:mchc)[:\s]*(\d+\.?\d*)\s*(?:g\/dl)?/gi,
  
  // Renal Function
  creatinine: /(?:creatinine|cr)[:\s]*(\d+\.?\d*)\s*(?:mg\/dl|umol\/l)?/gi,
  urea: /(?:urea|bun)[:\s]*(\d+\.?\d*)\s*(?:mg\/dl|mmol\/l)?/gi,
  sodium: /(?:sodium|na\+?)[:\s]*(\d+\.?\d*)\s*(?:mmol\/l|meq\/l)?/gi,
  potassium: /(?:potassium|k\+?)[:\s]*(\d+\.?\d*)\s*(?:mmol\/l|meq\/l)?/gi,
  chloride: /(?:chloride|cl-?)[:\s]*(\d+\.?\d*)\s*(?:mmol\/l|meq\/l)?/gi,
  bicarbonate: /(?:bicarbonate|hco3-?|co2)[:\s]*(\d+\.?\d*)\s*(?:mmol\/l|meq\/l)?/gi,
  
  // Liver Function
  ast: /(?:ast|sgot|aspartate)[:\s]*(\d+\.?\d*)\s*(?:u\/l|iu\/l)?/gi,
  alt: /(?:alt|sgpt|alanine)[:\s]*(\d+\.?\d*)\s*(?:u\/l|iu\/l)?/gi,
  alp: /(?:alp|alkaline phosphatase)[:\s]*(\d+\.?\d*)\s*(?:u\/l|iu\/l)?/gi,
  bilirubin: /(?:bilirubin|bili)[:\s]*(\d+\.?\d*)\s*(?:mg\/dl|umol\/l)?/gi,
  albumin: /(?:albumin|alb)[:\s]*(\d+\.?\d*)\s*(?:g\/dl|g\/l)?/gi,
  totalProtein: /(?:total protein|tp)[:\s]*(\d+\.?\d*)\s*(?:g\/dl|g\/l)?/gi,
  
  // Coagulation
  pt: /(?:pt|prothrombin time)[:\s]*(\d+\.?\d*)\s*(?:seconds?|s)?/gi,
  inr: /(?:inr)[:\s]*(\d+\.?\d*)/gi,
  aptt: /(?:aptt|ptt)[:\s]*(\d+\.?\d*)\s*(?:seconds?|s)?/gi,
  
  // Blood Sugar
  glucose: /(?:glucose|blood sugar|fbs|rbs)[:\s]*(\d+\.?\d*)\s*(?:mg\/dl|mmol\/l)?/gi,
  hba1c: /(?:hba1c|glycated hemoglobin)[:\s]*(\d+\.?\d*)\s*%?/gi,
  
  // Lipid Profile
  cholesterol: /(?:cholesterol|total cholesterol|tc)[:\s]*(\d+\.?\d*)\s*(?:mg\/dl|mmol\/l)?/gi,
  triglycerides: /(?:triglycerides|tg)[:\s]*(\d+\.?\d*)\s*(?:mg\/dl|mmol\/l)?/gi,
  hdl: /(?:hdl)[:\s]*(\d+\.?\d*)\s*(?:mg\/dl|mmol\/l)?/gi,
  ldl: /(?:ldl)[:\s]*(\d+\.?\d*)\s*(?:mg\/dl|mmol\/l)?/gi,
  
  // Thyroid
  tsh: /(?:tsh)[:\s]*(\d+\.?\d*)\s*(?:miu\/l|uiu\/ml)?/gi,
  t3: /(?:t3|triiodothyronine)[:\s]*(\d+\.?\d*)\s*(?:ng\/dl|nmol\/l)?/gi,
  t4: /(?:t4|thyroxine)[:\s]*(\d+\.?\d*)\s*(?:ug\/dl|nmol\/l)?/gi,
  
  // Cardiac Markers
  troponin: /(?:troponin|tnl|tni)[:\s]*(\d+\.?\d*)\s*(?:ng\/ml|ug\/l)?/gi,
  bnp: /(?:bnp|nt-probnp)[:\s]*(\d+\.?\d*)\s*(?:pg\/ml)?/gi,
  ck: /(?:ck|cpk|creatine kinase)[:\s]*(\d+\.?\d*)\s*(?:u\/l|iu\/l)?/gi,
  
  // Urinalysis
  specificGravity: /(?:specific gravity|sp\.?\s*gr\.?)[:\s]*(\d+\.?\d*)/gi,
  ph: /(?:ph)[:\s]*(\d+\.?\d*)/gi,
  protein: /(?:protein)[:\s]*(negative|trace|\+{1,4}|\d+\.?\d*)/gi,
  glucose_urine: /(?:glucose)[:\s]*(negative|trace|\+{1,4}|\d+\.?\d*)/gi,
  
  // Blood Gas
  pao2: /(?:pao2|po2)[:\s]*(\d+\.?\d*)\s*(?:mmhg)?/gi,
  paco2: /(?:paco2|pco2)[:\s]*(\d+\.?\d*)\s*(?:mmhg)?/gi,
  arterialPh: /(?:arterial\s*)?ph[:\s]*(\d+\.?\d*)/gi,
  baseExcess: /(?:base excess|be)[:\s]*(-?\d+\.?\d*)\s*(?:mmol\/l)?/gi,
  lactate: /(?:lactate)[:\s]*(\d+\.?\d*)\s*(?:mmol\/l)?/gi
};

// Imaging report keywords
const IMAGING_KEYWORDS = [
  'impression', 'findings', 'conclusion', 'recommendation',
  'technique', 'comparison', 'indication', 'clinical history',
  'normal', 'abnormal', 'unremarkable', 'no acute',
  'opacity', 'consolidation', 'effusion', 'infiltrate',
  'fracture', 'dislocation', 'mass', 'lesion', 'nodule',
  'attenuation', 'enhancement', 'signal intensity'
];

class OCRService {
  private worker: Worker | null = null;
  private isInitialized: boolean = false;
  private initializationPromise: Promise<void> | null = null;

  // Initialize Tesseract worker
  async initialize(onProgress?: (progress: OCRProgress) => void): Promise<void> {
    if (this.isInitialized) return;
    
    if (this.initializationPromise) {
      await this.initializationPromise;
      return;
    }

    this.initializationPromise = this.initializeWorker(onProgress);
    await this.initializationPromise;
  }

  private async initializeWorker(onProgress?: (progress: OCRProgress) => void): Promise<void> {
    try {
      console.log('🔄 Initializing OCR worker...');

      // Lazy-load tesseract.js (~1.5MB + wasm) only when an OCR scan is actually requested.
      // Cloud Vision is the primary path — most users never trigger this fallback.
      const { createWorker, OEM, PSM } = await import('tesseract.js');

      this.worker = await createWorker('eng', OEM.LSTM_ONLY, {
        logger: (m: any) => {
          if (onProgress && m.progress !== undefined) {
            onProgress({
              status: m.status || 'processing',
              progress: m.progress
            });
          }
          console.log(`OCR: ${m.status} - ${Math.round((m.progress || 0) * 100)}%`);
        }
      });

      // Configure for best accuracy on medical documents
      await this.worker.setParameters({
        tessedit_pageseg_mode: PSM.AUTO,
        preserve_interword_spaces: '1',
        tessedit_char_whitelist: 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789.,;:/-+()%<>=[]\'"#@!?&_°~ \n'
      });

      this.isInitialized = true;
      console.log('✅ OCR worker initialized');
    } catch (error) {
      console.error('Failed to initialize OCR worker:', error);
      throw error;
    }
  }

  // Process image and extract text — tries Cloud Vision first, falls back to Tesseract
  async extractText(
    imageSource: File | Blob | string | HTMLImageElement | HTMLCanvasElement,
    documentType: DocumentType = 'general',
    onProgress?: (progress: OCRProgress) => void
  ): Promise<OCRResult> {
    const startTime = Date.now();

    // Try Google Cloud Vision via backend first
    try {
      onProgress?.({ status: 'Sending to Cloud Vision...', progress: 0.1 });
      const base64 = await this.imageToBase64(imageSource);
      onProgress?.({ status: 'Processing with Cloud Vision...', progress: 0.3 });

      const response = await apiClient.post('/ocr/scan', {
        image: base64,
        documentType,
        aiPostProcess: false, // Raw OCR only — AI is handled separately in processDocumentWithAI
      });

      if (response?.success && response.raw_text) {
        onProgress?.({ status: 'Cloud Vision complete', progress: 1.0 });
        const processedText = this.postProcessText(response.raw_text, documentType);
        const words: OCRWord[] = (response.structured_blocks || []).map((b: any) => ({
          text: b.text || '',
          confidence: b.confidence || 0,
          bbox: b.boundingBox ? { x0: b.boundingBox[0]?.x || 0, y0: b.boundingBox[0]?.y || 0, x1: b.boundingBox[2]?.x || 0, y1: b.boundingBox[2]?.y || 0 } : { x0: 0, y0: 0, x1: 0, y1: 0 },
        }));

        const result: OCRResult = {
          text: processedText,
          confidence: response.confidence ?? 0.9,
          words,
          processingTime: Date.now() - startTime,
        };
        console.log(`✅ Cloud Vision OCR completed in ${result.processingTime}ms with ${Math.round(result.confidence * 100)}% confidence`);
        return result;
      }
    } catch (cloudErr: any) {
      console.warn('Cloud Vision OCR unavailable, falling back to Tesseract:', cloudErr.message || cloudErr);
    }

    // Fallback: local Tesseract.js
    onProgress?.({ status: 'Initializing local OCR...', progress: 0.05 });
    await this.initialize(onProgress);

    if (!this.worker) {
      throw new Error('OCR worker not initialized');
    }

    try {
      // Preprocess image for better OCR; fall back to raw source if preprocessing fails
      let recognizeInput: any = imageSource;
      try {
        recognizeInput = await this.preprocessImage(imageSource, documentType);
      } catch (preprocessErr) {
        console.warn('Image preprocessing failed, using raw image:', preprocessErr);
        // Convert File/Blob to base64 data URL so Tesseract can read it
        if (imageSource instanceof File || imageSource instanceof Blob) {
          recognizeInput = await this.imageToBase64(imageSource);
        }
      }
      
      onProgress?.({ status: 'recognizing', progress: 0.5 });

      // Perform OCR
      const { data } = await this.worker.recognize(recognizeInput);

      // Post-process based on document type
      let processedText = this.postProcessText(data.text, documentType);

      // Extract words from the result (Tesseract.js v5+ structure)
      const wordsData = (data as any).words || [];
      
      const result: OCRResult = {
        text: processedText,
        confidence: data.confidence / 100,
        words: wordsData.map((w: any) => ({
          text: w.text,
          confidence: (w.confidence || 0) / 100,
          bbox: w.bbox || { x0: 0, y0: 0, x1: 0, y1: 0 }
        })),
        processingTime: Date.now() - startTime
      };

      console.log(`✅ OCR completed in ${result.processingTime}ms with ${Math.round(result.confidence * 100)}% confidence`);
      
      return result;
    } catch (error) {
      console.error('OCR extraction failed:', error);
      throw error;
    }
  }

  // Convert any image source to a base64 data URI for backend upload
  private async imageToBase64(
    imageSource: File | Blob | string | HTMLImageElement | HTMLCanvasElement
  ): Promise<string> {
    if (typeof imageSource === 'string') {
      return imageSource; // Already a data URI or base64
    }
    if (imageSource instanceof HTMLCanvasElement) {
      return imageSource.toDataURL('image/jpeg', 0.92);
    }
    if (imageSource instanceof HTMLImageElement) {
      const canvas = document.createElement('canvas');
      canvas.width = imageSource.naturalWidth || imageSource.width;
      canvas.height = imageSource.naturalHeight || imageSource.height;
      const ctx = canvas.getContext('2d');
      if (ctx) { ctx.drawImage(imageSource, 0, 0); }
      return canvas.toDataURL('image/jpeg', 0.92);
    }
    // File or Blob
    return new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = () => reject(new Error('Failed to read image file'));
      reader.readAsDataURL(imageSource);
    });
  }

  // ──────────────────────────────────────────────────────────
  // Advanced Image Preprocessing Pipeline for Tesseract.js
  // Steps: Load → Upscale → Grayscale → Denoise → Normalize
  //        → Sharpen → Adaptive Binarize → Border Cleanup
  // ──────────────────────────────────────────────────────────

  private async preprocessImage(
    imageSource: File | Blob | string | HTMLImageElement | HTMLCanvasElement,
    documentType: DocumentType
  ): Promise<HTMLCanvasElement> {
    // Step 1: Load image onto a canvas at optimal resolution
    const srcCanvas = await this.loadImageToCanvas(imageSource);
    const { width, height } = srcCanvas;
    const ctx = srcCanvas.getContext('2d')!;

    // Step 2: Upscale small images to ~300 DPI equivalent
    const TARGET_MIN_DIM = 2400;
    const maxDim = Math.max(width, height);
    let workCanvas = srcCanvas;
    if (maxDim < TARGET_MIN_DIM) {
      const scale = TARGET_MIN_DIM / maxDim;
      workCanvas = this.scaleCanvas(srcCanvas, scale);
    } else if (maxDim > 4000) {
      // Downscale very large images to save memory
      workCanvas = this.scaleCanvas(srcCanvas, 4000 / maxDim);
    }

    const wCtx = workCanvas.getContext('2d')!;
    let imgData = wCtx.getImageData(0, 0, workCanvas.width, workCanvas.height);

    // Step 3: Convert to grayscale (luminosity)
    imgData = this.toGrayscale(imgData);

    // Step 4: Denoise (3×3 median filter — removes salt-and-pepper noise)
    imgData = this.medianFilter(imgData, workCanvas.width, workCanvas.height);

    // Step 5: Contrast normalization (histogram stretch to use full 0–255 range)
    imgData = this.histogramStretch(imgData);

    // Step 6: Sharpen (unsharp mask to recover edges after denoising)
    imgData = this.unsharpMask(imgData, workCanvas.width, workCanvas.height, 1.5);

    // Step 7: Adaptive binarization or contrast enhancement
    if (documentType === 'handwritten_note') {
      // Sauvola adaptive thresholding — handles uneven lighting on paper
      imgData = this.sauvolaThreshold(imgData, workCanvas.width, workCanvas.height, 15, 0.2);
    } else if (documentType === 'lab_report' || documentType === 'prescription') {
      // Aggressive Otsu binarization for clean printed text
      imgData = this.otsuThreshold(imgData);
    } else {
      // Gentle contrast boost + Otsu for general documents
      imgData = this.enhanceContrast(imgData, 1.8);
      imgData = this.otsuThreshold(imgData);
    }

    // Step 8: Border cleanup — remove dark edges (from scanning)
    imgData = this.cleanBorders(imgData, workCanvas.width, workCanvas.height, 5);

    // Write final result
    wCtx.putImageData(imgData, 0, 0);
    return workCanvas;
  }

  /** Load any image source into a canvas at its native resolution */
  private async loadImageToCanvas(
    imageSource: File | Blob | string | HTMLImageElement | HTMLCanvasElement
  ): Promise<HTMLCanvasElement> {
    if (imageSource instanceof HTMLCanvasElement) {
      return imageSource;
    }

    let img: HTMLImageElement;
    let blobUrl: string | null = null;

    if (imageSource instanceof HTMLImageElement) {
      img = imageSource;
    } else {
      img = new Image();
      if (imageSource instanceof File || imageSource instanceof Blob) {
        blobUrl = URL.createObjectURL(imageSource);
        img.src = blobUrl;
      } else {
        img.src = imageSource;
      }
      await new Promise<void>((res, rej) => {
        img.onload = () => res();
        img.onerror = () => {
          if (blobUrl) URL.revokeObjectURL(blobUrl);
          rej(new Error('Failed to load image for OCR preprocessing'));
        };
        // If the image is already cached / complete, resolve immediately
        if (img.complete && img.naturalWidth > 0) res();
      });
    }

    const canvas = document.createElement('canvas');
    canvas.width = img.naturalWidth || img.width;
    canvas.height = img.naturalHeight || img.height;
    const ctx = canvas.getContext('2d')!;
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

    if (blobUrl) URL.revokeObjectURL(blobUrl);
    return canvas;
  }

  /** Scale a canvas by a given factor */
  private scaleCanvas(src: HTMLCanvasElement, scale: number): HTMLCanvasElement {
    const dst = document.createElement('canvas');
    dst.width = Math.round(src.width * scale);
    dst.height = Math.round(src.height * scale);
    const ctx = dst.getContext('2d')!;
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(src, 0, 0, dst.width, dst.height);
    return dst;
  }

  /** Convert RGBA ImageData to grayscale (in-place, keeps RGBA format) */
  private toGrayscale(imgData: ImageData): ImageData {
    const d = imgData.data;
    for (let i = 0; i < d.length; i += 4) {
      const gray = d[i] * 0.2126 + d[i + 1] * 0.7152 + d[i + 2] * 0.0722;
      d[i] = d[i + 1] = d[i + 2] = gray;
    }
    return imgData;
  }

  /** 3×3 median filter for noise removal */
  private medianFilter(imgData: ImageData, w: number, h: number): ImageData {
    const src = new Uint8ClampedArray(imgData.data);
    const dst = imgData.data;
    const neighbors = new Uint8Array(9);

    for (let y = 1; y < h - 1; y++) {
      for (let x = 1; x < w - 1; x++) {
        let n = 0;
        for (let dy = -1; dy <= 1; dy++) {
          for (let dx = -1; dx <= 1; dx++) {
            neighbors[n++] = src[((y + dy) * w + (x + dx)) * 4];
          }
        }
        // Partial sort to find median (index 4) — insertion sort on 9 elements
        for (let i = 1; i < 9; i++) {
          const key = neighbors[i];
          let j = i - 1;
          while (j >= 0 && neighbors[j] > key) {
            neighbors[j + 1] = neighbors[j];
            j--;
          }
          neighbors[j + 1] = key;
        }
        const med = neighbors[4];
        const idx = (y * w + x) * 4;
        dst[idx] = dst[idx + 1] = dst[idx + 2] = med;
      }
    }
    return imgData;
  }

  /** Stretch histogram so darkest pixel → 0, brightest → 255 */
  private histogramStretch(imgData: ImageData): ImageData {
    const d = imgData.data;
    let min = 255, max = 0;
    for (let i = 0; i < d.length; i += 4) {
      if (d[i] < min) min = d[i];
      if (d[i] > max) max = d[i];
    }
    if (max - min < 10) return imgData; // already flat, skip
    const range = max - min;
    for (let i = 0; i < d.length; i += 4) {
      const v = Math.round(((d[i] - min) / range) * 255);
      d[i] = d[i + 1] = d[i + 2] = v;
    }
    return imgData;
  }

  /** Unsharp mask sharpening: sharpened = original + amount * (original - blurred) */
  private unsharpMask(imgData: ImageData, w: number, h: number, amount: number): ImageData {
    const d = imgData.data;
    // Create Gaussian-blurred copy (3×3 box blur as approximation)
    const blurred = new Uint8ClampedArray(d);
    for (let y = 1; y < h - 1; y++) {
      for (let x = 1; x < w - 1; x++) {
        let sum = 0;
        for (let dy = -1; dy <= 1; dy++) {
          for (let dx = -1; dx <= 1; dx++) {
            sum += d[((y + dy) * w + (x + dx)) * 4];
          }
        }
        blurred[(y * w + x) * 4] = sum / 9;
      }
    }
    for (let i = 0; i < d.length; i += 4) {
      const v = Math.round(d[i] + amount * (d[i] - blurred[i]));
      d[i] = d[i + 1] = d[i + 2] = Math.min(255, Math.max(0, v));
    }
    return imgData;
  }

  /** Otsu's method — compute optimal global threshold, then binarize */
  private otsuThreshold(imgData: ImageData): ImageData {
    const d = imgData.data;
    const hist = new Int32Array(256);
    const totalPixels = d.length / 4;

    // Build histogram
    for (let i = 0; i < d.length; i += 4) hist[d[i]]++;

    // Otsu's algorithm
    let sumAll = 0;
    for (let t = 0; t < 256; t++) sumAll += t * hist[t];

    let sumBg = 0, wBg = 0, maxVariance = 0, threshold = 128;
    for (let t = 0; t < 256; t++) {
      wBg += hist[t];
      if (wBg === 0) continue;
      const wFg = totalPixels - wBg;
      if (wFg === 0) break;

      sumBg += t * hist[t];
      const meanBg = sumBg / wBg;
      const meanFg = (sumAll - sumBg) / wFg;
      const variance = wBg * wFg * (meanBg - meanFg) * (meanBg - meanFg);
      if (variance > maxVariance) {
        maxVariance = variance;
        threshold = t;
      }
    }

    // Binarize
    for (let i = 0; i < d.length; i += 4) {
      const v = d[i] > threshold ? 255 : 0;
      d[i] = d[i + 1] = d[i + 2] = v;
    }
    return imgData;
  }

  /** Sauvola adaptive thresholding — excellent for uneven illumination */
  private sauvolaThreshold(
    imgData: ImageData, w: number, h: number, windowRadius: number, k: number
  ): ImageData {
    const d = imgData.data;
    const gray = new Float32Array(w * h);
    for (let i = 0; i < gray.length; i++) gray[i] = d[i * 4];

    // Build integral image and integral of squares for fast local stats
    const integral = new Float64Array((w + 1) * (h + 1));
    const integralSq = new Float64Array((w + 1) * (h + 1));
    const iw = w + 1;

    for (let y = 0; y < h; y++) {
      let rowSum = 0, rowSumSq = 0;
      for (let x = 0; x < w; x++) {
        const v = gray[y * w + x];
        rowSum += v;
        rowSumSq += v * v;
        integral[(y + 1) * iw + (x + 1)] = integral[y * iw + (x + 1)] + rowSum;
        integralSq[(y + 1) * iw + (x + 1)] = integralSq[y * iw + (x + 1)] + rowSumSq;
      }
    }

    // Compute local threshold for each pixel
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const x1 = Math.max(0, x - windowRadius);
        const y1 = Math.max(0, y - windowRadius);
        const x2 = Math.min(w - 1, x + windowRadius);
        const y2 = Math.min(h - 1, y + windowRadius);
        const area = (x2 - x1 + 1) * (y2 - y1 + 1);

        const sum = integral[(y2 + 1) * iw + (x2 + 1)]
                  - integral[y1 * iw + (x2 + 1)]
                  - integral[(y2 + 1) * iw + x1]
                  + integral[y1 * iw + x1];
        const sumSq = integralSq[(y2 + 1) * iw + (x2 + 1)]
                    - integralSq[y1 * iw + (x2 + 1)]
                    - integralSq[(y2 + 1) * iw + x1]
                    + integralSq[y1 * iw + x1];

        const mean = sum / area;
        const variance = (sumSq / area) - mean * mean;
        const stddev = Math.sqrt(Math.max(0, variance));
        const R = 128; // dynamic range of standard deviation
        const threshold = mean * (1 + k * (stddev / R - 1));

        const idx = (y * w + x) * 4;
        const v = gray[y * w + x] > threshold ? 255 : 0;
        d[idx] = d[idx + 1] = d[idx + 2] = v;
      }
    }
    return imgData;
  }

  /** Simple linear contrast enhancement: out = (in - 128) * factor + 128 */
  private enhanceContrast(imgData: ImageData, factor: number): ImageData {
    const d = imgData.data;
    for (let i = 0; i < d.length; i += 4) {
      const v = Math.round((d[i] - 128) * factor + 128);
      d[i] = d[i + 1] = d[i + 2] = Math.min(255, Math.max(0, v));
    }
    return imgData;
  }

  /** Remove dark border pixels (common from scanning / camera shots) */
  private cleanBorders(imgData: ImageData, w: number, h: number, borderPx: number): ImageData {
    const d = imgData.data;
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        if (x < borderPx || x >= w - borderPx || y < borderPx || y >= h - borderPx) {
          const idx = (y * w + x) * 4;
          d[idx] = d[idx + 1] = d[idx + 2] = 255;
        }
      }
    }
    return imgData;
  }

  // Post-process extracted text based on document type
  private postProcessText(text: string, documentType: DocumentType): string {
    let processed = text;

    // Light cleanup only — avoid aggressive replacements that corrupt handwritten OCR
    processed = processed
      .replace(/[^\S\n]+/g, ' ')  // Multiple horizontal spaces to single (preserve newlines)
      .replace(/\n\s*\n\s*\n/g, '\n\n');  // Multiple blank lines to double

    if (documentType === 'lab_report') {
      processed = this.formatLabReport(processed);
    } else if (documentType === 'imaging_report') {
      processed = this.formatImagingReport(processed);
    } else if (documentType === 'prescription') {
      processed = this.formatPrescription(processed);
    }

    return processed.trim();
  }

  // Format lab report text
  private formatLabReport(text: string): string {
    let formatted = text;

    // Try to structure lab values
    const lines = formatted.split('\n');
    const structuredLines: string[] = [];

    for (const line of lines) {
      // Check if line contains a lab value pattern
      let matched = false;
      for (const [name, pattern] of Object.entries(LAB_VALUE_PATTERNS)) {
        const match = line.match(pattern);
        if (match) {
          structuredLines.push(`${name.charAt(0).toUpperCase() + name.slice(1)}: ${match[1]}`);
          matched = true;
          break;
        }
      }
      if (!matched && line.trim()) {
        structuredLines.push(line);
      }
    }

    return structuredLines.join('\n');
  }

  // Format imaging report text
  private formatImagingReport(text: string): string {
    let formatted = text;

    // Capitalize section headers
    IMAGING_KEYWORDS.forEach(keyword => {
      const regex = new RegExp(`\\b${keyword}\\b`, 'gi');
      formatted = formatted.replace(regex, keyword.toUpperCase());
    });

    // Add line breaks before section headers
    ['IMPRESSION', 'FINDINGS', 'CONCLUSION', 'TECHNIQUE', 'INDICATION'].forEach(header => {
      const regex = new RegExp(`(?<!\n)\\s*(${header}:?)`, 'g');
      formatted = formatted.replace(regex, '\n\n$1');
    });

    return formatted;
  }

  // Format prescription text
  private formatPrescription(text: string): string {
    let formatted = text;

    // Common prescription patterns
    const medicationPattern = /(\d+)\s*(mg|ml|g|mcg|iu)\s+(\w+)/gi;
    formatted = formatted.replace(medicationPattern, '$3 $1$2');

    // Dosing patterns
    const dosingPatterns: [RegExp, string][] = [
      [/\bonce daily\b/gi, 'OD'],
      [/\btwice daily\b/gi, 'BD'],
      [/\bthree times daily\b/gi, 'TDS'],
      [/\bfour times daily\b/gi, 'QDS'],
      [/\bas needed\b/gi, 'PRN'],
      [/\bat bedtime\b/gi, 'nocte'],
      [/\bbefore meals?\b/gi, 'AC'],
      [/\bafter meals?\b/gi, 'PC']
    ];

    dosingPatterns.forEach(([pattern, replacement]) => {
      formatted = formatted.replace(pattern, replacement);
    });

    return formatted;
  }

  // Extract structured lab values from text
  extractLabValues(text: string): Record<string, { value: string; unit?: string }> {
    const results: Record<string, { value: string; unit?: string }> = {};

    for (const [name, pattern] of Object.entries(LAB_VALUE_PATTERNS)) {
      const match = text.match(pattern);
      if (match) {
        // Extract value and unit from the full match
        const fullMatch = match[0];
        const value = match[1];
        
        // Try to extract unit
        const unitMatch = fullMatch.match(/\d+\.?\d*\s*([a-zA-Z/%]+(?:\/[a-zA-Z]+)?)/);
        const unit = unitMatch ? unitMatch[1] : undefined;

        results[name] = { value, unit };
      }
    }

    return results;
  }

  // Check if document is likely a lab report
  isLabReport(text: string): boolean {
    const labKeywords = ['laboratory', 'lab report', 'test results', 'specimen', 'reference range', 'normal range'];
    const lowerText = text.toLowerCase();
    return labKeywords.some(kw => lowerText.includes(kw)) || 
           Object.keys(this.extractLabValues(text)).length > 3;
  }

  // Check if document is likely an imaging report
  isImagingReport(text: string): boolean {
    const imagingKeywords = ['x-ray', 'ct scan', 'mri', 'ultrasound', 'radiograph', 'imaging', 'radiology'];
    const lowerText = text.toLowerCase();
    return imagingKeywords.some(kw => lowerText.includes(kw)) ||
           IMAGING_KEYWORDS.some(kw => lowerText.includes(kw.toLowerCase()));
  }

  // Auto-detect document type
  detectDocumentType(text: string): DocumentType {
    if (this.isLabReport(text)) return 'lab_report';
    if (this.isImagingReport(text)) return 'imaging_report';
    
    const prescriptionKeywords = ['rx', 'prescription', 'sig:', 'dispense', 'refill'];
    if (prescriptionKeywords.some(kw => text.toLowerCase().includes(kw))) {
      return 'prescription';
    }
    
    return 'general';
  }

  // ──────────────────────────────────────────────────────────
  // AI-Enhanced OCR Processing (Cloud Vision + AI pipeline)
  // ──────────────────────────────────────────────────────────

  /**
   * Process a document image with OCR + AI post-processing.
   * 
   * Pipeline:
   * 1. If handwritingMode, try GPT-4o Vision direct OCR (best for handwriting)
   * 2. Try backend /api/ocr/scan (Cloud Vision + AI in one call)
   * 3. If backend unavailable, fall back to local Tesseract + separate AI endpoint
   * 4. If AI unavailable, fall back to rule-based extraction
   */
  async processDocumentWithAI(
    imageSource: File | Blob | string | HTMLImageElement | HTMLCanvasElement,
    documentType: DocumentType = 'general',
    patientContext?: {
      name?: string;
      hospitalNumber?: string;
      ward?: string;
      diagnosis?: string;
    },
    onProgress?: (progress: OCRProgress) => void,
    options?: { handwritingMode?: boolean }
  ): Promise<AIEnhancedOCRResult> {
    const startTime = Date.now();

    // ── Attempt 1: Unified backend (Cloud Vision + AI in one call) ──
    // If handwritingMode, use GPT-4o Vision for direct image-to-text+structured
    const useVisionOCR = options?.handwritingMode ?? (documentType === 'handwritten_note' || documentType === 'fluid_chart' || documentType === 'vital_signs_chart');
    try {
      onProgress?.({ status: useVisionOCR ? 'Sending to AI Vision (handwriting)...' : 'Sending to Cloud Vision AI...', progress: 0.1 });
      const base64 = await this.imageToBase64(imageSource);

      onProgress?.({ status: useVisionOCR ? 'AI reading handwriting...' : 'Cloud Vision processing...', progress: 0.3 });
      const backendResult = await apiClient.post('/ocr/scan', {
        image: base64,
        documentType: useVisionOCR ? 'handwritten_note' : documentType,
        aiPostProcess: true,
        patientContext,
        useVisionOCR,
      });

      if (backendResult?.success && backendResult.raw_text) {
        onProgress?.({ status: 'AI structuring complete', progress: 1.0 });

        const processedText = this.postProcessText(backendResult.raw_text, documentType);
        const detectedType = backendResult.documentType || documentType;
        const words: OCRWord[] = (backendResult.structured_blocks || []).map((b: any) => ({
          text: b.text || '',
          confidence: b.confidence || 0,
          bbox: b.boundingBox ? { x0: b.boundingBox[0]?.x || 0, y0: b.boundingBox[0]?.y || 0, x1: b.boundingBox[2]?.x || 0, y1: b.boundingBox[2]?.y || 0 } : { x0: 0, y0: 0, x1: 0, y1: 0 },
        }));

        let structuredData = backendResult.structured;
        let aiConfidence = structuredData?.confidence || 0.8;
        const aiProcessed = !!structuredData;

        // If no AI structured data, use rule-based fallback
        if (!structuredData) {
          structuredData = this.ruleBasedExtraction(processedText, detectedType as DocumentType);
          aiConfidence = 0.5;
        }

        const result: AIEnhancedOCRResult = {
          text: processedText,
          confidence: backendResult.confidence ?? 0.9,
          words,
          processingTime: Date.now() - startTime,
          documentType: detectedType as DocumentType,
          structuredData,
          aiConfidence,
          aiProcessed,
        };
        console.log(`✅ Cloud Vision + AI completed in ${result.processingTime}ms`);
        return result;
      }
    } catch (backendErr: any) {
      console.warn('Backend OCR unavailable, falling back to Tesseract:', backendErr.message || backendErr);
    }

    // ── Attempt 2: Local Tesseract OCR + separate AI endpoint ──
    onProgress?.({ status: 'Using local OCR engine...', progress: 0.1 });
    const ocrResult = await this.extractText(imageSource, documentType, (p) => {
      onProgress?.({ ...p, progress: p.progress * 0.5 }); // First 50% is OCR
    });

    onProgress?.({ status: 'recognizing', progress: 0.55 });

    // Auto-detect document type if not specified
    const detectedType = documentType === 'general'
      ? this.detectDocumentType(ocrResult.text)
      : documentType;

    // AI post-processing via separate endpoint
    onProgress?.({ status: 'AI analyzing content...', progress: 0.6 });
    let structuredData: any = null;
    let aiConfidence = 0;

    try {
      const token = localStorage.getItem('auth_token');
      let response: Response | null = null;
      for (let attempt = 0; attempt < 3; attempt++) {
        response = await fetch('/api/ai/ocr-process', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...(token ? { 'Authorization': `Bearer ${token}` } : {}),
          },
          body: JSON.stringify({
            ocrText: ocrResult.text,
            documentType: detectedType,
            patientContext,
          }),
        });
        if (response.status !== 503 || attempt === 2) break;
        await new Promise(r => setTimeout(r, (attempt + 1) * 1000));
      }

      if (response!.ok) {
        const result = await response!.json();
        if (result.success && result.structured) {
          structuredData = result.structured;
          aiConfidence = result.structured.confidence || 0.8;
        }
      } else {
        const errData = await response!.json().catch(() => ({}));
        console.warn(`AI OCR returned ${response!.status}:`, errData);
        if (errData.fallback) {
          console.log('AI not configured, using rule-based extraction');
        }
      }
    } catch (err) {
      console.warn('AI post-processing failed, falling back to rule-based extraction:', err);
    }

    onProgress?.({ status: 'recognizing', progress: 0.85 });

    // Step 4: If AI failed, use enhanced rule-based extraction
    if (!structuredData) {
      structuredData = this.ruleBasedExtraction(ocrResult.text, detectedType);
      aiConfidence = 0.5;
    }

    // Step 5: Always try to extract vital signs series from raw text
    // (AI may only extract a single vitals object from post-op charts)
    // Always run the rule-based parser and keep whichever yields more readings
    if (structuredData) {
      const series = this.parseVitalSignsSeries(ocrResult.text);
      if (series && series.length >= 1) {
        const existingSeries = structuredData.vital_signs_series;
        if (!existingSeries || series.length > existingSeries.length) {
          structuredData.vital_signs_series = series;
        }
      }
    }

    onProgress?.({ status: 'recognizing', progress: 1.0 });

    return {
      ...ocrResult,
      documentType: detectedType,
      structuredData,
      aiConfidence,
      processingTime: Date.now() - startTime,
      aiProcessed: structuredData !== null,
    };
  }

  /**
   * Parse time-series vital signs from post-op charts, observation charts,
   * and monitoring charts. Uses a two-pass approach:
   *   Pass 1: Line-based extraction — split OCR text into lines, parse each row
   *   Pass 2: BP-anchor extraction — find BP readings and extract surrounding values
   *   Pass 3: Column-oriented extraction — for charts where each parameter is on its own row
   * Returns whichever pass yields more readings.
   */
  private parseVitalSignsSeries(text: string): any[] | null {
    const lineResults = this.parseVitalsByLines(text);
    const anchorResults = this.parseVitalsByBPAnchor(text);
    const columnResults = this.parseVitalsByColumns(text);

    console.log('[OCR Series] Line-based:', lineResults?.length || 0, 'readings');
    console.log('[OCR Series] BP-anchor:', anchorResults?.length || 0, 'readings');
    console.log('[OCR Series] Column:', columnResults?.length || 0, 'readings');

    // Return whichever found more valid readings
    const candidates = [lineResults, anchorResults, columnResults];
    let best: any[] | null = null;
    for (const c of candidates) {
      if (c && c.length > (best?.length || 0)) best = c;
    }
    console.log('[OCR Series] Best pass yielded', best?.length || 0, 'readings');
    return best && best.length >= 1 ? best : null;
  }

  /**
   * Pass 1: Line-based vital signs extraction.
   * Splits OCR text into lines and tries to extract vital sign rows from each line.
   * Works best when OCR preserves line boundaries.
   */
  private parseVitalsByLines(text: string): any[] | null {
    const lines = text.split(/\n/).map(l => l.trim()).filter(l => l.length > 5);
    const readings: any[] = [];
    let currentDate = '';

    // Try to find a header date 
    const headerDateMatch = text.match(/Date[:\s]*(\d{1,2}[\/\-]\d{1,2}(?:[\/\-]\d{2,4})?)/i);
    if (headerDateMatch) currentDate = headerDateMatch[1].replace(/-/g, '/');

    for (const line of lines) {
      // Skip header/label lines
      if (/^\s*(time|date|temp|pulse|blood|pressure|ward|surname|first|hosp|fluid|drugs|condition|resp|intake|output|urine)/i.test(line)) continue;

      // Check if line starts with a date like "7/4/26" or "9/4"
      const leadingDate = line.match(/^(\d{1,2})[\/\-](\d{1,2})(?:[\/\-](\d{2,4}))?\b/);
      if (leadingDate) {
        const d = parseInt(leadingDate[1]), mo = parseInt(leadingDate[2]);
        if (d >= 1 && d <= 31 && mo >= 1 && mo <= 12) {
          currentDate = leadingDate[0];
        }
      }

      // Find ALL BP readings on this line (handles merged OCR lines)
      const bpRegex = /(\d{2,3})\s*[\/\\]\s*(\d{2,3})/g;
      let bpMatch: RegExpExecArray | null;
      let bpFound = false;

      // Extract line-level time once (used by both BP and non-BP paths)
      let lineTime = '';
      const lineTimeMatches = line.match(/(\d{1,2}(?:[:.]\d{2})?)\s*(am|pm)/gi);
      if (lineTimeMatches && lineTimeMatches.length > 0) {
        lineTime = lineTimeMatches[0].trim();
      }
      if (!lineTime) {
        const ltm = line.match(/^(?:\d{1,2}[\/\-]\d{1,2}(?:[\/\-]\d{2,4})?\s+)?(\d{1,2}(?:[:.]\d{2})?)\s*(am|pm)?/i);
        if (ltm) lineTime = (ltm[1] + (ltm[2] || '')).trim();
      }

      while ((bpMatch = bpRegex.exec(line)) !== null) {
        const sys = parseInt(bpMatch[1]), dia = parseInt(bpMatch[2]);
        if (sys < 50 || sys > 260 || dia < 20 || dia > 160 || sys <= dia) continue;
        bpFound = true;

        const beforeBP = line.substring(0, bpMatch.index || 0);
        const afterBP = line.substring((bpMatch.index || 0) + bpMatch[0].length);

        let time = '';
        const timeMatches = beforeBP.match(/(\d{1,2}(?:[:.]\d{2})?)\s*(am|pm)?/gi);
        if (timeMatches && timeMatches.length > 0) {
          time = timeMatches[timeMatches.length - 1].trim();
        }
        if (!time) time = lineTime;

        // Extract all numbers from after BP
        const allNums: number[] = [];
        const numRegex = /(\d+\.?\d*)\s*%?/g;
        let nm: RegExpExecArray | null;
        while ((nm = numRegex.exec(afterBP)) !== null) {
          allNums.push(parseFloat(nm[1]));
        }

        // Extract numbers between time and BP (temp before BP)
        const preNums: number[] = [];
        const preNumRegex = /(\d+\.?\d*)/g;
        let pnm: RegExpExecArray | null;
        const afterTimeStr = timeMatches ? beforeBP.substring(beforeBP.lastIndexOf(timeMatches[timeMatches.length - 1]) + timeMatches[timeMatches.length - 1].length) : beforeBP;
        while ((pnm = preNumRegex.exec(afterTimeStr)) !== null) {
          const pn = parseFloat(pnm[1]);
          if (pn > 0) preNums.push(pn);
        }

        // RESET per-reading variables (Bug #1 fix: no variable contamination)
        let temperature: number | undefined;
        let pulse: number | undefined;
        let respiratory_rate: number | undefined;
        let spo2: number | undefined;

        // Check pre-BP numbers for temperature (Bug #2 fix: removed .includes('.') check)
        for (const pn of preNums) {
          if (pn >= 34 && pn <= 42) {
            temperature = pn;
            break;
          }
        }

        // Classify post-BP numbers
        for (const n of allNums) {
          if (!temperature && n >= 34 && n <= 42) {
            temperature = n;
          } else if (!pulse && n >= 30 && n <= 220 && Number.isInteger(n)) {
            pulse = n;
          } else if (!respiratory_rate && n >= 8 && n <= 60 && Number.isInteger(n) && pulse) {
            respiratory_rate = n;
          } else if (!spo2 && n >= 80 && n <= 100 && respiratory_rate) {
            spo2 = n;
          }
        }

        if (!pulse) {
          for (const pn of preNums) {
            if (pn >= 30 && pn <= 220 && Number.isInteger(pn) && pn !== temperature) {
              pulse = pn;
              break;
            }
          }
        }

        let datetime = '';
        if (currentDate && time) datetime = `${currentDate} ${time}`;
        else if (time) datetime = time;
        else if (currentDate) datetime = currentDate;

        readings.push({
          date: datetime,
          time,
          chart_date: currentDate,
          temperature,
          pulse,
          bp_systolic: sys,
          bp_diastolic: dia,
          respiratory_rate,
          spo2,
        });
      } // end while (bpMatch)

      // Bug #6 fix: if no BP found on this line, still extract temp/pulse/RR/SpO2
      if (!bpFound) {
        const allLineNums: number[] = [];
        const nlr = /(\d+\.?\d*)\s*%?/g;
        let nlm: RegExpExecArray | null;
        while ((nlm = nlr.exec(line)) !== null) {
          const v = parseFloat(nlm[1]);
          if (v > 0) allLineNums.push(v);
        }
        // Filter out date components already in currentDate
        let temperature: number | undefined;
        let pulse: number | undefined;
        let respiratory_rate: number | undefined;
        let spo2: number | undefined;

        for (const n of allLineNums) {
          if (!temperature && n >= 34 && n <= 42) {
            temperature = n;
          } else if (!pulse && n >= 30 && n <= 220 && Number.isInteger(n)) {
            pulse = n;
          } else if (!respiratory_rate && n >= 8 && n <= 60 && Number.isInteger(n) && pulse) {
            respiratory_rate = n;
          } else if (!spo2 && n >= 80 && n <= 100) {
            spo2 = n;
          }
        }

        if (temperature || pulse) {
          let datetime = '';
          if (currentDate && lineTime) datetime = `${currentDate} ${lineTime}`;
          else if (lineTime) datetime = lineTime;
          else if (currentDate) datetime = currentDate;

          readings.push({
            date: datetime,
            time: lineTime,
            chart_date: currentDate,
            temperature,
            pulse,
            bp_systolic: undefined,
            bp_diastolic: undefined,
            respiratory_rate,
            spo2,
          });
        }
      }
    }

    return readings.length >= 1 ? readings : null;
  }

  /**
   * Pass 2: BP-anchor-based extraction.
   * Finds BP readings anywhere in text and extracts surrounding values.
   * Works when OCR doesn't preserve line boundaries well.
   */
  private parseVitalsByBPAnchor(text: string): any[] | null {
    const bpRegex = /(\d{2,3})\s*[\/\\]\s*(\d{2,3})/g;
    const bpMatches: { index: number; systolic: number; diastolic: number; matchLen: number }[] = [];
    let m: RegExpExecArray | null;
    while ((m = bpRegex.exec(text)) !== null) {
      const sys = parseInt(m[1]), dia = parseInt(m[2]);
      if (sys >= 50 && sys <= 260 && dia >= 20 && dia <= 160 && sys > dia) {
        bpMatches.push({ index: m.index, systolic: sys, diastolic: dia, matchLen: m[0].length });
      }
    }

    if (bpMatches.length < 1) return null;

    // Find date markers (excluding those that are part of BP readings)
    const datePositions: { index: number; dateStr: string }[] = [];
    const dateRegex = /(?:^|[\s\n])(\d{1,2})\/(\d{1,2})(?:\/(\d{2,4}))?(?=[\s\n]|$)/gm;
    let dm: RegExpExecArray | null;
    while ((dm = dateRegex.exec(text)) !== null) {
      const d = parseInt(dm[1]), mo = parseInt(dm[2]);
      if (d >= 1 && d <= 31 && mo >= 1 && mo <= 12) {
        // Ensure this isn't one of our BP matches (check overlap, not proximity)
        const isBP = bpMatches.some(bp => {
          const bpEnd = bp.index + bp.matchLen;
          const dmEnd = dm!.index + dm![0].length;
          return (dm!.index >= bp.index && dm!.index < bpEnd) || (bp.index >= dm!.index && bp.index < dmEnd);
        });
        if (!isBP) {
          datePositions.push({ index: dm.index, dateStr: dm[0].trim() });
        }
      }
    }

    const headerDateMatch = text.match(/Date[:\s]*(\d{1,2}\/\d{1,2}(?:\/\d{2,4})?)/i);
    let currentDate = headerDateMatch ? headerDateMatch[1] : '';

    const readings: any[] = [];

    for (let bi = 0; bi < bpMatches.length; bi++) {
      const bp = bpMatches[bi];

      // Determine the text region for this reading
      // From just after previous BP (or start) to just before next BP (or end)
      const regionStart = bi > 0 ? bpMatches[bi - 1].index + bpMatches[bi - 1].matchLen : Math.max(0, bp.index - 120);
      const regionEnd = bi < bpMatches.length - 1 ? bpMatches[bi + 1].index : Math.min(text.length, bp.index + bp.matchLen + 120);

      const beforeBP = text.substring(Math.max(regionStart, bp.index - 120), bp.index);
      const afterBP = text.substring(bp.index + bp.matchLen, Math.min(regionEnd, bp.index + bp.matchLen + 100));

      // Update date
      for (const dp of datePositions) {
        if (dp.index < bp.index && dp.index >= regionStart) {
          currentDate = dp.dateStr;
        }
      }

      // Find time
      let time = '';
      const timeCandidates = [...beforeBP.matchAll(/(\d{1,2}(?:[:.]\d{2})?)\s*(am|pm)?/gi)];
      if (timeCandidates.length > 0) {
        const last = timeCandidates[timeCandidates.length - 1];
        const t = (last[1] + (last[2] || '')).trim();
        const h = parseInt(last[1]);
        if (h >= 1 && h <= 24) time = t;
      }

      // Extract numbers after BP
      const afterNums: number[] = [];
      const numR = /(\d+\.?\d*)\s*%?/g;
      let an: RegExpExecArray | null;
      while ((an = numR.exec(afterBP)) !== null) {
        afterNums.push(parseFloat(an[1]));
      }

      // Extract numbers before BP (between time and BP)
      const preNums: number[] = [];
      const preR = /(\d+\.?\d*)/g; // Match integers and decimals for temp before BP
      let pn: RegExpExecArray | null;
      while ((pn = preR.exec(beforeBP)) !== null) {
        const v = parseFloat(pn[1]);
        if (v >= 34 && v <= 42) preNums.push(v);
      }

      let temperature: number | undefined;
      let pulse: number | undefined;
      let respiratory_rate: number | undefined;
      let spo2: number | undefined;

      // Check pre-BP for temperature
      if (preNums.length > 0) temperature = preNums[preNums.length - 1];

      // Classify post-BP numbers flexibly
      for (const n of afterNums) {
        if (!temperature && n >= 34 && n <= 42) {
          temperature = n;
        } else if (!pulse && n >= 30 && n <= 220 && Number.isInteger(n)) {
          pulse = n;
        } else if (pulse && !respiratory_rate && n >= 8 && n <= 60 && Number.isInteger(n)) {
          respiratory_rate = n;
        } else if (respiratory_rate && !spo2 && n >= 80 && n <= 100) {
          spo2 = n;
        }
      }

      // Extract notes
      let notes = '';
      const fullRegion = beforeBP + afterBP;
      const notePatterns = /(?:FBG|RBG|FBS|RBS|RGB|FPG)\s*[-:=]\s*\d+\.?\d*\s*(?:mg\/?d?l?)?(?:\s*(?:at|@)\s*\S+)?/gi;
      const noteMatch = fullRegion.match(notePatterns);
      if (noteMatch) notes = noteMatch.join('; ');

      const transMatch = fullRegion.match(/(?:pre|post|intra)\s*[-]?\s*trans?fusion/gi);
      if (transMatch) notes += (notes ? '; ' : '') + transMatch.join('; ');

      let datetime = '';
      if (currentDate && time) datetime = `${currentDate} ${time}`;
      else if (time) datetime = time;
      else if (currentDate) datetime = currentDate;

      readings.push({
        date: datetime,
        time,
        chart_date: currentDate,
        temperature,
        pulse,
        bp_systolic: bp.systolic,
        bp_diastolic: bp.diastolic,
        respiratory_rate,
        spo2,
        notes: notes || undefined,
      });
    }

    return readings.length >= 1 ? readings : null;
  }

  /**
   * Pass 3: Column-oriented vital signs extraction.
   * For observation charts where each parameter has its own row with multiple time-column values:
   *   Time:  6am   9am   12pm  3pm   6pm
   *   Temp:  36.8  37.0  37.2  37.1  36.9
   *   BP:    120/80 118/78 130/84 ...
   *   Pulse: 88    92    86    ...
   */
  private parseVitalsByColumns(text: string): any[] | null {
    const lines = text.split(/\n/).map(l => l.trim()).filter(l => l.length > 2);

    // Find time row — a line starting with "Time" or containing multiple time patterns
    let times: string[] = [];
    for (const line of lines) {
      if (/^time/i.test(line) || (/\d{1,2}\s*(?:am|pm)/i.test(line) && (line.match(/\d{1,2}\s*(?:am|pm|:\d{2})/gi) || []).length >= 2)) {
        const timeTokens = line.match(/\d{1,2}(?:[:.]\d{2})?\s*(?:am|pm)?/gi) || [];
        if (timeTokens.length >= 2) {
          times = timeTokens.map(t => t.trim());
          break;
        }
      }
    }

    if (times.length < 2) return null;

    const numSlots = times.length;
    const temps: (number | undefined)[] = new Array(numSlots).fill(undefined);
    const bpSys: (number | undefined)[] = new Array(numSlots).fill(undefined);
    const bpDia: (number | undefined)[] = new Array(numSlots).fill(undefined);
    const pulses: (number | undefined)[] = new Array(numSlots).fill(undefined);
    const rrs: (number | undefined)[] = new Array(numSlots).fill(undefined);
    const spo2s: (number | undefined)[] = new Array(numSlots).fill(undefined);

    for (const line of lines) {
      const isTemp = /^(?:temp|temperature|T)\b/i.test(line);
      const isBP = /^(?:BP|B\.P|blood\s*pressure|B\/P)\b/i.test(line);
      const isPulse = /^(?:pulse|PR|HR|heart\s*rate)\b/i.test(line);
      const isRR = /^(?:RR|resp|respiratory)\b/i.test(line);
      const isSpo2 = /^(?:SpO2|O2\s*sat|oxygen|sat)\b/i.test(line);

      if (isTemp) {
        const nums = line.match(/\d{2,3}\.?\d*/g) || [];
        nums.forEach((n, i) => { if (i < numSlots) { const v = parseFloat(n); if (v >= 34 && v <= 42) temps[i] = v; } });
      } else if (isBP) {
        const bps = line.match(/\d{2,3}\s*[\/\\]\s*\d{2,3}/g) || [];
        bps.forEach((bp, i) => {
          if (i < numSlots) {
            const parts = bp.split(/[\/\\]/);
            const sys = parseInt(parts[0].trim()), dia = parseInt(parts[1].trim());
            if (sys >= 50 && sys <= 260 && dia >= 20 && dia <= 160 && sys > dia) {
              bpSys[i] = sys; bpDia[i] = dia;
            }
          }
        });
      } else if (isPulse) {
        const nums = line.match(/\b\d{2,3}\b/g) || [];
        const filtered = nums.map(Number).filter(n => n >= 30 && n <= 220);
        filtered.forEach((n, i) => { if (i < numSlots) pulses[i] = n; });
      } else if (isRR) {
        const nums = line.match(/\b\d{1,2}\b/g) || [];
        const filtered = nums.map(Number).filter(n => n >= 8 && n <= 60);
        filtered.forEach((n, i) => { if (i < numSlots) rrs[i] = n; });
      } else if (isSpo2) {
        const nums = line.match(/\b\d{2,3}\b/g) || [];
        const filtered = nums.map(Number).filter(n => n >= 80 && n <= 100);
        filtered.forEach((n, i) => { if (i < numSlots) spo2s[i] = n; });
      }
    }

    // Check if we found any actual data
    const hasAnyData = bpSys.some(v => v !== undefined) || temps.some(v => v !== undefined) || pulses.some(v => v !== undefined);
    if (!hasAnyData) return null;

    // Find header date
    const headerDateMatch = text.match(/Date[:\s]*(\d{1,2}[\/\-]\d{1,2}(?:[\/\-]\d{2,4})?)/i);
    const chartDate = headerDateMatch ? headerDateMatch[1].replace(/-/g, '/') : '';

    const readings: any[] = [];
    for (let i = 0; i < numSlots; i++) {
      if (bpSys[i] === undefined && temps[i] === undefined && pulses[i] === undefined) continue;
      readings.push({
        date: chartDate && times[i] ? `${chartDate} ${times[i]}` : times[i] || chartDate || '',
        time: times[i] || '',
        chart_date: chartDate,
        temperature: temps[i],
        pulse: pulses[i],
        bp_systolic: bpSys[i],
        bp_diastolic: bpDia[i],
        respiratory_rate: rrs[i],
        spo2: spo2s[i],
      });
    }

    return readings.length >= 1 ? readings : null;
  }

  /**
   * Rule-based fallback extraction for when AI is not available.
   * Extracts vitals, lab values, medications from raw OCR text.
   */
  private ruleBasedExtraction(text: string, documentType: DocumentType): any {
    const result: any = { confidence: 0.4 };

    // Extract vitals
    const vitals: any = {};
    const tempMatch = text.match(/(?:temp|temperature|T)[:\s]*(\d{2,3}\.?\d?)\s*(?:°?[CF]?)/i);
    if (tempMatch) vitals.temperature = parseFloat(tempMatch[1]);

    const pulseMatch = text.match(/(?:pulse|PR|HR|heart rate)[:\s]*(\d{2,3})\s*(?:bpm|\/min)?/i);
    if (pulseMatch) vitals.pulse = parseInt(pulseMatch[1]);

    const bpMatch = text.match(/(?:BP|blood pressure)[:\s]*(\d{2,3})\s*\/\s*(\d{2,3})/i);
    if (bpMatch) {
      vitals.bp_systolic = parseInt(bpMatch[1]);
      vitals.bp_diastolic = parseInt(bpMatch[2]);
    }

    const rrMatch = text.match(/(?:RR|respiratory rate|resp rate)[:\s]*(\d{1,2})/i);
    if (rrMatch) vitals.respiratory_rate = parseInt(rrMatch[1]);

    const spo2Match = text.match(/(?:SpO2|O2 sat|oxygen sat)[:\s]*(\d{2,3})\s*%?/i);
    if (spo2Match) vitals.spo2 = parseInt(spo2Match[1]);

    const painMatch = text.match(/(?:pain|pain score|VAS)[:\s]*(\d{1,2})\s*(?:\/10)?/i);
    if (painMatch) vitals.pain_score = parseInt(painMatch[1]);

    if (Object.keys(vitals).length > 0) result.vitals = vitals;

    // Validate vitals using medical validation service
    if (result.vitals && Object.keys(result.vitals).length > 0) {
      const validated = validateVitals(result.vitals);
      result.validatedVitals = validated;
      result.alerts = validated.alerts;
      if (validated.overallConfidence > result.confidence) {
        result.confidence = Math.min(result.confidence + 0.1, validated.overallConfidence);
      }
    }

    // Detect post-op / observation charts and extract time-series vital signs
    const vitalsSeries = this.parseVitalSignsSeries(text);
    if (vitalsSeries && vitalsSeries.length >= 1) {
      result.vital_signs_series = vitalsSeries;
      result.confidence = 0.6; // Higher confidence for structured chart data

      // Validate each reading in the series
      result.validated_series = vitalsSeries.map((reading: any) => {
        const validated = validateVitals(reading);
        return { ...reading, validation: validated };
      });
      // Collect all alerts from series
      const seriesAlerts: VitalAlert[] = [];
      for (const r of result.validated_series) {
        if (r.validation?.alerts) seriesAlerts.push(...r.validation.alerts);
      }
      result.series_alerts = seriesAlerts;
    }

    // Extract lab values using existing patterns + validate
    const labValues = this.extractLabValues(text);
    if (Object.keys(labValues).length > 0) {
      result.investigations = Object.entries(labValues).map(([name, data]) => {
        const validation = validateLabValue(name, data.value);
        return {
          type: 'lab',
          name: name.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase()),
          result: data.value,
          unit: data.unit || '',
          abnormal: validation.severity !== 'normal',
          severity: validation.severity,
          validationMessage: validation.message,
          confidence: validation.confidence,
        };
      });
    }

    // Extract medications (simple pattern matching)
    const medPatterns = text.match(/(?:tab|cap|inj|syp|susp)\s+[\w\s]+\s+\d+\s*(?:mg|ml|g|mcg|iu)\s+(?:bd|tds|qds|od|prn|nocte|stat)/gi);
    if (medPatterns) {
      result.medications = medPatterns.map((m: string) => ({ name: m.trim() }));
    }

    // Extract SOAP-like sections
    const subjectiveMatch = text.match(/(?:subjective|S[:\s]|complaints?[:\s])([\s\S]*?)(?=\n(?:O[:\s]|objective|assessment|plan|$))/i);
    if (subjectiveMatch) result.subjective = subjectiveMatch[1].trim();

    const objectiveMatch = text.match(/(?:objective|O[:\s]|examination[:\s]|findings?[:\s])([\s\S]*?)(?=\n(?:A[:\s]|assessment|plan|$))/i);
    if (objectiveMatch) result.objective = objectiveMatch[1].trim();

    const assessmentMatch = text.match(/(?:assessment|A[:\s]|impression[:\s]|diagnosis[:\s])([\s\S]*?)(?=\n(?:P[:\s]|plan|$))/i);
    if (assessmentMatch) result.assessment = assessmentMatch[1].trim();

    const planMatch = text.match(/(?:plan|P[:\s]|management[:\s])([\s\S]*?)$/i);
    if (planMatch) result.plan = planMatch[1].trim();

    // Always include the raw text so the user can apply it as a generic field
    result.raw_text = text.trim();

    // If no structured data was extracted, also set notes/findings so it shows as selectable
    const hasStructuredData = Object.keys(result).some(
      k => !['confidence', 'raw_text'].includes(k) && result[k] != null
    );
    if (!hasStructuredData && text.trim()) {
      result.notes = text.trim();
      result.findings = text.trim();
      result.content_summary = text.trim();
      result.review_text = text.trim();
    }

    return result;
  }

  // Terminate worker when done
  async terminate(): Promise<void> {
    if (this.worker) {
      await this.worker.terminate();
      this.worker = null;
      this.isInitialized = false;
      console.log('🛑 OCR worker terminated');
    }
  }
}

// Extended result type for AI-enhanced processing
export interface AIEnhancedOCRResult extends OCRResult {
  documentType: DocumentType;
  structuredData: any;
  aiConfidence: number;
  aiProcessed: boolean;
  validatedVitals?: ValidatedVitalReading;
  alerts?: VitalAlert[];
  validated_series?: any[];
  series_alerts?: VitalAlert[];
  clinicalExtraction?: ClinicalNotesExtractionResult;
}

export const ocrService = new OCRService();
