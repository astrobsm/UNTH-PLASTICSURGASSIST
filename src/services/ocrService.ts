/**
 * OCR Service for Medical Document Scanning
 * 
 * Primary: Google Cloud Vision API via backend /api/ocr/scan
 * Fallback: Tesseract.js (local, offline-capable)
 * 
 * Optimized for laboratory reports, imaging reports, and medical documents
 */

import { createWorker, Worker, PSM, OEM } from 'tesseract.js';
import { apiClient } from './apiClient';

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

export type DocumentType = 'lab_report' | 'imaging_report' | 'prescription' | 'handwritten_note' | 'general' | 'clinical_note' | 'consultation';

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
      .replace(/\s+/g, ' ')  // Multiple spaces to single
      .replace(/\n\s*\n\s*\n/g, '\n\n');  // Multiple newlines to double

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
    const useVisionOCR = options?.handwritingMode ?? (documentType === 'handwritten_note');
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
    if (structuredData && !structuredData.vital_signs_series) {
      const series = this.parseVitalSignsSeries(ocrResult.text);
      if (series && series.length > 1) {
        structuredData.vital_signs_series = series;
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
   * and monitoring charts. Uses BP readings as anchor points and extracts
   * surrounding vitals (temp, pulse, resp, SpO2) for each row.
   */
  private parseVitalSignsSeries(text: string): any[] | null {
    // Find all BP readings as anchor points — these are the most reliable markers
    const bpRegex = /(\d{2,3})\s*\/\s*(\d{2,3})/g;
    const bpMatches: { index: number; systolic: number; diastolic: number }[] = [];
    let m: RegExpExecArray | null;
    while ((m = bpRegex.exec(text)) !== null) {
      const sys = parseInt(m[1]), dia = parseInt(m[2]);
      // Filter to clinically plausible BP values
      if (sys >= 50 && sys <= 260 && dia >= 20 && dia <= 160 && sys > dia) {
        bpMatches.push({ index: m.index, systolic: sys, diastolic: dia });
      }
    }

    // Need at least 2 BP readings to consider it a time-series chart
    if (bpMatches.length < 2) return null;

    // Find all date markers and their positions
    const dateRegex = /(\d{1,2})\/(\d{1,2})(?:\/(\d{2,4}))?/g;
    const datePositions: { index: number; dateStr: string }[] = [];
    let dm: RegExpExecArray | null;
    while ((dm = dateRegex.exec(text)) !== null) {
      // Skip if this is part of a BP reading (e.g., 100/70)
      const surrounding = text.substring(Math.max(0, dm.index - 5), Math.min(text.length, dm.index + dm[0].length + 5));
      if (/\d\s*\/\s*\d/.test(surrounding) && !surrounding.match(/\d{1,2}\/\d{1,2}\/\d{2,4}/)) {
        // Simple ratio like BP — check if day/month values make sense as dates
        const d = parseInt(dm[1]), mo = parseInt(dm[2]);
        if (d > 31 || mo > 12) continue; // Not a valid date
        // Only treat as date if preceded by newline, start, or clear separator (not a digit)
        const charBefore = dm.index > 0 ? text[dm.index - 1] : '\n';
        if (/\d/.test(charBefore)) continue; // Part of a number sequence, not a date
      }
      datePositions.push({ index: dm.index, dateStr: dm[0] });
    }

    // Extract the header date if present
    const headerDateMatch = text.match(/Date[:\s]*(\d{1,2}\/\d{1,2}(?:\/\d{2,4})?)/i);
    let currentDate = headerDateMatch ? headerDateMatch[1] : '';

    // Time patterns: "12:30", "3:00pm", "6am", "8:50", "12:10pm", "6:15", "6pm"
    const timeRegex = /(\d{1,2}(?::\d{2})?)\s*(am|pm)?/gi;

    const readings: any[] = [];

    for (const bp of bpMatches) {
      // Look backward up to 80 chars for a time pattern
      const lookbackStart = Math.max(0, bp.index - 80);
      const beforeBP = text.substring(lookbackStart, bp.index);

      // Find the closest time before the BP  
      let time = '';
      let timeMatch: RegExpExecArray | null;
      const allTimes: { time: string; index: number }[] = [];
      const localTimeRegex = /(\d{1,2}(?::\d{2})?)\s*(am|pm)?/gi;
      while ((timeMatch = localTimeRegex.exec(beforeBP)) !== null) {
        const t = timeMatch[1] + (timeMatch[2] || '');
        // Filter out numbers that are clearly not times
        const num = parseInt(timeMatch[1]);
        if (num >= 1 && num <= 24) {
          allTimes.push({ time: t, index: timeMatch.index });
        }
      }
      if (allTimes.length > 0) {
        time = allTimes[allTimes.length - 1].time; // Closest time before BP
      }

      // Update current date if a date marker appears before this BP
      for (const dp of datePositions) {
        if (dp.index < bp.index) {
          // Check it's a plausible date (not a BP ratio)
          const parts = dp.dateStr.split('/');
          if (parseInt(parts[0]) <= 31 && parseInt(parts[1]) <= 12) {
            currentDate = dp.dateStr;
          }
        }
      }

      // Look forward after BP for: temperature, pulse, resp rate, SpO2
      const bpEnd = bp.index + `${bp.systolic}/${bp.diastolic}`.length;
      const afterBP = text.substring(bpEnd, Math.min(text.length, bpEnd + 80));

      // Extract numbers following the BP — they should be: temp, pulse, resp, [spo2]
      const numbersAfter = afterBP.match(/[\d.]+%?/g);
      let temperature: number | undefined;
      let pulse: number | undefined;
      let respiratory_rate: number | undefined;
      let spo2: number | undefined;
      let notes = '';

      if (numbersAfter) {
        let idx = 0;
        for (const numStr of numbersAfter) {
          const num = parseFloat(numStr.replace('%', ''));
          if (idx === 0 && num >= 30 && num <= 42) {
            // Temperature (typically 34-40, but allow wider range for OCR errors)
            temperature = num;
            idx++;
          } else if (idx === 1 && num >= 30 && num <= 220 && Number.isInteger(num)) {
            // Pulse
            pulse = num;
            idx++;
          } else if (idx === 2 && num >= 8 && num <= 60 && Number.isInteger(num)) {
            // Respiratory rate
            respiratory_rate = num;
            idx++;
          } else if (idx === 3 && num >= 50 && num <= 100) {
            // SpO2
            spo2 = numStr.includes('%') ? num : (num >= 80 ? num : undefined);
            idx++;
            break;
          } else if (idx > 0) {
            break; // Stop if number doesn't fit expected pattern
          }
        }
      }

      // Extract notes (text after numbers)
      const notesMatch = afterBP.match(/[A-Za-z][A-Za-z\s,.-]+/);
      if (notesMatch) notes = notesMatch[0].trim();

      // Build ISO-ish datetime from date + time
      let datetime = '';
      if (currentDate && time) {
        datetime = `${currentDate} ${time}`;
      } else if (time) {
        datetime = time;
      }

      readings.push({
        date: datetime,
        time: time,
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

    return readings.length >= 2 ? readings : null;
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

    // Detect post-op / observation charts and extract time-series vital signs
    const vitalsSeries = this.parseVitalSignsSeries(text);
    if (vitalsSeries && vitalsSeries.length > 1) {
      result.vital_signs_series = vitalsSeries;
      result.confidence = 0.6; // Higher confidence for structured chart data
    }

    // Extract lab values using existing patterns
    const labValues = this.extractLabValues(text);
    if (Object.keys(labValues).length > 0) {
      result.investigations = Object.entries(labValues).map(([name, data]) => ({
        type: 'lab',
        name: name.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase()),
        result: data.value,
        unit: data.unit || '',
        abnormal: false,
      }));
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
}

export const ocrService = new OCRService();
