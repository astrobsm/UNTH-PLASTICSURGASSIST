/**
 * OCR Service for Medical Document Scanning
 * Uses Tesseract.js for text extraction from images
 * Optimized for laboratory reports, imaging reports, and medical documents
 */

import { createWorker, Worker, PSM, OEM } from 'tesseract.js';

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

export type DocumentType = 'lab_report' | 'imaging_report' | 'prescription' | 'handwritten_note' | 'general';

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
        tessedit_char_whitelist: 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789.,;:/-+()%<>=[] \n'
      });

      this.isInitialized = true;
      console.log('✅ OCR worker initialized');
    } catch (error) {
      console.error('Failed to initialize OCR worker:', error);
      throw error;
    }
  }

  // Process image and extract text
  async extractText(
    imageSource: File | Blob | string | HTMLImageElement | HTMLCanvasElement,
    documentType: DocumentType = 'general',
    onProgress?: (progress: OCRProgress) => void
  ): Promise<OCRResult> {
    const startTime = Date.now();

    // Initialize if needed
    await this.initialize(onProgress);

    if (!this.worker) {
      throw new Error('OCR worker not initialized');
    }

    try {
      // Preprocess image for better OCR
      const processedImage = await this.preprocessImage(imageSource, documentType);
      
      onProgress?.({ status: 'recognizing', progress: 0.5 });

      // Perform OCR
      const { data } = await this.worker.recognize(processedImage);

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

  // Preprocess image for better OCR results
  private async preprocessImage(
    imageSource: File | Blob | string | HTMLImageElement | HTMLCanvasElement,
    documentType: DocumentType
  ): Promise<HTMLCanvasElement> {
    return new Promise(async (resolve, reject) => {
      try {
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        
        if (!ctx) {
          reject(new Error('Could not get canvas context'));
          return;
        }

        let img: HTMLImageElement;

        if (imageSource instanceof HTMLImageElement) {
          img = imageSource;
        } else if (imageSource instanceof HTMLCanvasElement) {
          resolve(imageSource);
          return;
        } else {
          img = new Image();
          
          if (imageSource instanceof File || imageSource instanceof Blob) {
            img.src = URL.createObjectURL(imageSource);
          } else {
            img.src = imageSource;
          }

          await new Promise<void>((res, rej) => {
            img.onload = () => res();
            img.onerror = () => rej(new Error('Failed to load image'));
          });
        }

        // Scale image for better OCR (optimal is around 300 DPI)
        const scaleFactor = Math.min(2, 2000 / Math.max(img.width, img.height));
        canvas.width = img.width * scaleFactor;
        canvas.height = img.height * scaleFactor;

        // Draw image
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

        // Apply preprocessing filters
        const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
        const data = imageData.data;

        // Convert to grayscale and apply thresholding for handwritten notes
        if (documentType === 'handwritten_note') {
          for (let i = 0; i < data.length; i += 4) {
            const gray = data[i] * 0.299 + data[i + 1] * 0.587 + data[i + 2] * 0.114;
            // Adaptive thresholding
            const threshold = gray > 180 ? 255 : 0;
            data[i] = data[i + 1] = data[i + 2] = threshold;
          }
        } else {
          // For printed documents, just enhance contrast
          for (let i = 0; i < data.length; i += 4) {
            const gray = data[i] * 0.299 + data[i + 1] * 0.587 + data[i + 2] * 0.114;
            // Increase contrast
            const enhanced = Math.min(255, Math.max(0, (gray - 128) * 1.5 + 128));
            data[i] = data[i + 1] = data[i + 2] = enhanced;
          }
        }

        ctx.putImageData(imageData, 0, 0);

        // Clean up blob URL if created
        if ((imageSource instanceof File || imageSource instanceof Blob) && img.src.startsWith('blob:')) {
          URL.revokeObjectURL(img.src);
        }

        resolve(canvas);
      } catch (error) {
        reject(error);
      }
    });
  }

  // Post-process extracted text based on document type
  private postProcessText(text: string, documentType: DocumentType): string {
    let processed = text;

    // Clean up common OCR errors
    processed = processed
      .replace(/\|/g, 'l')  // Pipe to lowercase L
      .replace(/0(?=[a-zA-Z])/g, 'O')  // Zero before letters to O
      .replace(/(?<=[a-zA-Z])0/g, 'o')  // Zero after letters to o
      .replace(/1(?=[a-zA-Z])/g, 'l')  // One before letters to l
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

export const ocrService = new OCRService();
