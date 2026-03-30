/**
 * useOCR — Reusable React hook for OCR processing
 *
 * Uses the centralized ocrService which tries Google Cloud Vision API
 * first (via backend /api/ocr/scan) and falls back to local Tesseract.js.
 *
 * Usage:
 *   const { scan, scanWithAI, isProcessing, progress, result, error, reset } = useOCR();
 *   await scan(imageFile);           // Raw OCR
 *   await scanWithAI(imageFile);     // OCR + AI structuring
 */

import { useState, useCallback, useRef, useEffect } from 'react';
import {
  ocrService,
  OCRResult,
  AIEnhancedOCRResult,
  OCRProgress,
  DocumentType,
} from '../services/ocrService';

interface UseOCROptions {
  documentType?: DocumentType;
  patientContext?: {
    name?: string;
    hospitalNumber?: string;
    ward?: string;
    diagnosis?: string;
  };
  autoDetectType?: boolean;
  onSuccess?: (result: OCRResult | AIEnhancedOCRResult) => void;
  onError?: (error: Error) => void;
}

interface UseOCRReturn {
  /** Run raw OCR extraction (Cloud Vision → Tesseract fallback) */
  scan: (imageSource: File | Blob | string | HTMLImageElement | HTMLCanvasElement) => Promise<OCRResult | null>;
  /** Run OCR + AI structured extraction */
  scanWithAI: (imageSource: File | Blob | string | HTMLImageElement | HTMLCanvasElement) => Promise<AIEnhancedOCRResult | null>;
  /** Whether OCR is currently processing */
  isProcessing: boolean;
  /** Current progress (0–100) */
  progress: number;
  /** Progress status text */
  progressText: string;
  /** Last successful result */
  result: OCRResult | AIEnhancedOCRResult | null;
  /** Last error message */
  error: string | null;
  /** Reset state */
  reset: () => void;
  /** Extract lab values from text */
  extractLabValues: (text: string) => Record<string, { value: string; unit?: string }>;
  /** Detect document type from text */
  detectDocumentType: (text: string) => DocumentType;
}

export function useOCR(options: UseOCROptions = {}): UseOCRReturn {
  const {
    documentType = 'general',
    patientContext,
    autoDetectType = true,
    onSuccess,
    onError,
  } = options;

  const [isProcessing, setIsProcessing] = useState(false);
  const [progress, setProgress] = useState(0);
  const [progressText, setProgressText] = useState('');
  const [result, setResult] = useState<OCRResult | AIEnhancedOCRResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const abortRef = useRef(false);

  useEffect(() => {
    return () => { abortRef.current = true; };
  }, []);

  const handleProgress = useCallback((p: OCRProgress) => {
    if (abortRef.current) return;
    setProgress(Math.round(p.progress * 100));
    setProgressText(p.status || 'Processing...');
  }, []);

  const reset = useCallback(() => {
    setIsProcessing(false);
    setProgress(0);
    setProgressText('');
    setResult(null);
    setError(null);
  }, []);

  const scan = useCallback(async (
    imageSource: File | Blob | string | HTMLImageElement | HTMLCanvasElement
  ): Promise<OCRResult | null> => {
    setIsProcessing(true);
    setError(null);
    setProgress(0);
    setProgressText('Starting OCR...');
    abortRef.current = false;

    try {
      const ocrResult = await ocrService.extractText(imageSource, documentType, handleProgress);
      if (abortRef.current) return null;
      setResult(ocrResult);
      onSuccess?.(ocrResult);
      return ocrResult;
    } catch (err: any) {
      if (abortRef.current) return null;
      const msg = err.message || 'OCR processing failed';
      setError(msg);
      onError?.(err);
      return null;
    } finally {
      if (!abortRef.current) setIsProcessing(false);
    }
  }, [documentType, handleProgress, onSuccess, onError]);

  const scanWithAI = useCallback(async (
    imageSource: File | Blob | string | HTMLImageElement | HTMLCanvasElement
  ): Promise<AIEnhancedOCRResult | null> => {
    setIsProcessing(true);
    setError(null);
    setProgress(0);
    setProgressText('Starting AI-enhanced OCR...');
    abortRef.current = false;

    try {
      const aiResult = await ocrService.processDocumentWithAI(
        imageSource,
        documentType,
        patientContext,
        handleProgress
      );
      if (abortRef.current) return null;
      setResult(aiResult);
      onSuccess?.(aiResult);
      return aiResult;
    } catch (err: any) {
      if (abortRef.current) return null;
      const msg = err.message || 'AI OCR processing failed';
      setError(msg);
      onError?.(err);
      return null;
    } finally {
      if (!abortRef.current) setIsProcessing(false);
    }
  }, [documentType, patientContext, handleProgress, onSuccess, onError]);

  const extractLabValues = useCallback((text: string) => {
    return ocrService.extractLabValues(text);
  }, []);

  const detectDocumentType = useCallback((text: string): DocumentType => {
    return autoDetectType ? ocrService.detectDocumentType(text) : documentType;
  }, [autoDetectType, documentType]);

  return {
    scan,
    scanWithAI,
    isProcessing,
    progress,
    progressText,
    result,
    error,
    reset,
    extractLabValues,
    detectDocumentType,
  };
}
