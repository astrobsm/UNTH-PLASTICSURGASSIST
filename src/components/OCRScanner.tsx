/**
 * OCR Scanner Component
 * Reusable component for scanning documents and extracting text
 * Supports camera capture and file upload
 */

import React, { useState, useCallback, useRef, useEffect } from 'react';
import { 
  Camera, 
  Upload, 
  FileText, 
  Loader2, 
  Check, 
  X, 
  RotateCcw, 
  ZoomIn, 
  ZoomOut,
  Maximize,
  Image as ImageIcon,
  AlertCircle,
  RefreshCw
} from 'lucide-react';
import { ocrService, OCRResult, OCRProgress, DocumentType } from '../services/ocrService';

interface OCRScannerProps {
  onTextExtracted: (text: string, labValues?: Record<string, { value: string; unit?: string }>) => void;
  onCancel?: () => void;
  documentType?: DocumentType;
  autoDetectType?: boolean;
  showPreview?: boolean;
  allowCamera?: boolean;
  allowFileUpload?: boolean;
  acceptedFormats?: string;
  maxFileSize?: number; // in MB
  className?: string;
  compact?: boolean;
}

export const OCRScanner: React.FC<OCRScannerProps> = ({
  onTextExtracted,
  onCancel,
  documentType = 'general',
  autoDetectType = true,
  showPreview = true,
  allowCamera = true,
  allowFileUpload = true,
  acceptedFormats = 'image/png,image/jpeg,image/jpg,image/webp,application/pdf',
  maxFileSize = 10,
  className = '',
  compact = false
}) => {
  const [image, setImage] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [progress, setProgress] = useState<OCRProgress | null>(null);
  const [result, setResult] = useState<OCRResult | null>(null);
  const [editedText, setEditedText] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [showCamera, setShowCamera] = useState(false);
  const [zoom, setZoom] = useState(1);
  const [detectedType, setDetectedType] = useState<DocumentType>(documentType);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);

  // Cleanup camera stream on unmount
  useEffect(() => {
    return () => {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => track.stop());
      }
      ocrService.terminate();
    };
  }, []);

  // Handle file selection
  const handleFileSelect = useCallback(async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    // Validate file size
    if (file.size > maxFileSize * 1024 * 1024) {
      setError(`File too large. Maximum size is ${maxFileSize}MB.`);
      return;
    }

    // Validate file type
    if (!acceptedFormats.split(',').some(format => file.type.match(format.replace('*', '.*')))) {
      setError('Invalid file format. Please upload an image file.');
      return;
    }

    setError(null);
    
    // Create preview
    const reader = new FileReader();
    reader.onload = (e) => {
      setImage(e.target?.result as string);
    };
    reader.readAsDataURL(file);

    // Reset input
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  }, [acceptedFormats, maxFileSize]);

  // Start camera
  const startCamera = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { 
          facingMode: 'environment',
          width: { ideal: 1920 },
          height: { ideal: 1080 }
        }
      });
      
      streamRef.current = stream;
      
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
        setShowCamera(true);
      }
    } catch (err) {
      console.error('Camera access failed:', err);
      setError('Unable to access camera. Please check permissions.');
    }
  }, []);

  // Stop camera
  const stopCamera = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }
    setShowCamera(false);
  }, []);

  // Capture photo from camera
  const capturePhoto = useCallback(() => {
    if (!videoRef.current || !canvasRef.current) return;

    const video = videoRef.current;
    const canvas = canvasRef.current;
    
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    
    const ctx = canvas.getContext('2d');
    if (ctx) {
      ctx.drawImage(video, 0, 0);
      const imageData = canvas.toDataURL('image/jpeg', 0.9);
      setImage(imageData);
      stopCamera();
    }
  }, [stopCamera]);

  // Process image with OCR
  const processImage = useCallback(async () => {
    if (!image) return;

    setIsProcessing(true);
    setError(null);
    setProgress({ status: 'Initializing OCR...', progress: 0 });

    try {
      const ocrResult = await ocrService.extractText(
        image,
        documentType,
        (p) => setProgress(p)
      );

      setResult(ocrResult);
      setEditedText(ocrResult.text);

      // Auto-detect document type if enabled
      if (autoDetectType) {
        const detected = ocrService.detectDocumentType(ocrResult.text);
        setDetectedType(detected);
      }
    } catch (err: any) {
      console.error('OCR processing failed:', err);
      setError(err.message || 'Failed to extract text from image');
    } finally {
      setIsProcessing(false);
      setProgress(null);
    }
  }, [image, documentType, autoDetectType]);

  // Retry OCR with different settings
  const retryProcessing = useCallback(() => {
    setResult(null);
    setEditedText('');
    processImage();
  }, [processImage]);

  // Confirm extracted text
  const confirmText = useCallback(() => {
    const labValues = detectedType === 'lab_report' 
      ? ocrService.extractLabValues(editedText)
      : undefined;
    
    onTextExtracted(editedText, labValues);
    resetScanner();
  }, [editedText, detectedType, onTextExtracted]);

  // Reset scanner
  const resetScanner = useCallback(() => {
    setImage(null);
    setResult(null);
    setEditedText('');
    setError(null);
    setProgress(null);
    setZoom(1);
    stopCamera();
  }, [stopCamera]);

  // Handle cancel
  const handleCancel = useCallback(() => {
    resetScanner();
    onCancel?.();
  }, [resetScanner, onCancel]);

  // Render compact mode (just upload button)
  if (compact && !image && !showCamera) {
    return (
      <div className={`flex gap-2 ${className}`}>
        {allowFileUpload && (
          <>
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="inline-flex items-center gap-2 px-3 py-2 text-sm bg-blue-50 text-blue-600 rounded-lg hover:bg-blue-100 transition-colors"
            >
              <Upload className="w-4 h-4" />
              Upload Image
            </button>
            <input
              ref={fileInputRef}
              type="file"
              accept={acceptedFormats}
              onChange={handleFileSelect}
              className="hidden"
            />
          </>
        )}
        {allowCamera && (
          <button
            type="button"
            onClick={startCamera}
            className="inline-flex items-center gap-2 px-3 py-2 text-sm bg-green-50 text-green-600 rounded-lg hover:bg-green-100 transition-colors"
          >
            <Camera className="w-4 h-4" />
            Scan Document
          </button>
        )}
      </div>
    );
  }

  return (
    <div className={`ocr-scanner bg-white rounded-xl shadow-lg overflow-hidden ${className}`}>
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 bg-gray-50 border-b">
        <div className="flex items-center gap-2">
          <FileText className="w-5 h-5 text-blue-600" />
          <h3 className="font-medium text-gray-900">Document Scanner</h3>
        </div>
        <button
          type="button"
          onClick={handleCancel}
          className="p-1 text-gray-400 hover:text-gray-600 transition-colors"
        >
          <X className="w-5 h-5" />
        </button>
      </div>

      {/* Content */}
      <div className="p-4">
        {/* Camera view */}
        {showCamera && (
          <div className="relative bg-black rounded-lg overflow-hidden mb-4">
            <video
              ref={videoRef}
              autoPlay
              playsInline
              className="w-full max-h-96 object-contain"
            />
            <canvas ref={canvasRef} className="hidden" />
            
            <div className="absolute bottom-4 left-0 right-0 flex justify-center gap-4">
              <button
                type="button"
                onClick={capturePhoto}
                className="px-6 py-3 bg-white text-gray-900 rounded-full font-medium shadow-lg hover:bg-gray-100 transition-colors flex items-center gap-2"
              >
                <Camera className="w-5 h-5" />
                Capture
              </button>
              <button
                type="button"
                onClick={stopCamera}
                className="px-4 py-3 bg-gray-800 text-white rounded-full hover:bg-gray-700 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
          </div>
        )}

        {/* Image preview */}
        {image && showPreview && !showCamera && (
          <div className="relative bg-gray-100 rounded-lg overflow-hidden mb-4">
            <div 
              className="overflow-auto max-h-64"
              style={{ 
                transform: `scale(${zoom})`,
                transformOrigin: 'top left'
              }}
            >
              <img 
                src={image} 
                alt="Scanned document" 
                className="w-full object-contain"
              />
            </div>
            
            {/* Zoom controls */}
            <div className="absolute bottom-2 right-2 flex gap-1 bg-white rounded-lg shadow p-1">
              <button
                type="button"
                onClick={() => setZoom(z => Math.max(0.5, z - 0.25))}
                className="p-1.5 hover:bg-gray-100 rounded"
                disabled={zoom <= 0.5}
              >
                <ZoomOut className="w-4 h-4" />
              </button>
              <button
                type="button"
                onClick={() => setZoom(1)}
                className="p-1.5 hover:bg-gray-100 rounded text-xs font-medium"
              >
                {Math.round(zoom * 100)}%
              </button>
              <button
                type="button"
                onClick={() => setZoom(z => Math.min(3, z + 0.25))}
                className="p-1.5 hover:bg-gray-100 rounded"
                disabled={zoom >= 3}
              >
                <ZoomIn className="w-4 h-4" />
              </button>
            </div>

            {/* Clear image button */}
            <button
              type="button"
              onClick={resetScanner}
              className="absolute top-2 right-2 p-2 bg-red-500 text-white rounded-lg hover:bg-red-600 transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        )}

        {/* Upload/Camera buttons */}
        {!image && !showCamera && (
          <div className="flex flex-col items-center justify-center py-12 border-2 border-dashed border-gray-300 rounded-lg bg-gray-50">
            <ImageIcon className="w-12 h-12 text-gray-400 mb-4" />
            <p className="text-gray-600 mb-4">Select an image to scan</p>
            
            <div className="flex gap-3">
              {allowFileUpload && (
                <>
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                  >
                    <Upload className="w-4 h-4" />
                    Upload Image
                  </button>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept={acceptedFormats}
                    onChange={handleFileSelect}
                    className="hidden"
                  />
                </>
              )}
              
              {allowCamera && (
                <button
                  type="button"
                  onClick={startCamera}
                  className="inline-flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
                >
                  <Camera className="w-4 h-4" />
                  Use Camera
                </button>
              )}
            </div>
          </div>
        )}

        {/* Processing indicator */}
        {isProcessing && (
          <div className="flex flex-col items-center py-8">
            <Loader2 className="w-8 h-8 text-blue-600 animate-spin mb-4" />
            <p className="text-gray-600 mb-2">{progress?.status || 'Processing...'}</p>
            <div className="w-64 bg-gray-200 rounded-full h-2 overflow-hidden">
              <div 
                className="bg-blue-600 h-full transition-all duration-300"
                style={{ width: `${(progress?.progress || 0) * 100}%` }}
              />
            </div>
            <p className="text-sm text-gray-500 mt-2">
              {Math.round((progress?.progress || 0) * 100)}%
            </p>
          </div>
        )}

        {/* Error message */}
        {error && (
          <div className="flex items-center gap-2 p-3 bg-red-50 text-red-700 rounded-lg mb-4">
            <AlertCircle className="w-5 h-5 flex-shrink-0" />
            <p className="text-sm">{error}</p>
          </div>
        )}

        {/* OCR Result */}
        {result && !isProcessing && (
          <div className="space-y-4">
            {/* Detected type badge */}
            {autoDetectType && (
              <div className="flex items-center gap-2">
                <span className="text-sm text-gray-600">Detected type:</span>
                <span className={`
                  px-2 py-0.5 text-xs font-medium rounded-full
                  ${detectedType === 'lab_report' ? 'bg-purple-100 text-purple-700' : ''}
                  ${detectedType === 'imaging_report' ? 'bg-blue-100 text-blue-700' : ''}
                  ${detectedType === 'prescription' ? 'bg-orange-100 text-orange-700' : ''}
                  ${detectedType === 'general' ? 'bg-gray-100 text-gray-700' : ''}
                `}>
                  {detectedType.replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase())}
                </span>
                <span className="text-sm text-gray-500">
                  ({Math.round(result.confidence * 100)}% confidence)
                </span>
              </div>
            )}

            {/* Editable text */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Extracted Text (editable)
              </label>
              <textarea
                value={editedText}
                onChange={(e) => setEditedText(e.target.value)}
                rows={8}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                placeholder="No text extracted"
              />
              <p className="text-xs text-gray-500 mt-1">
                Processed in {result.processingTime}ms • {result.words.length} words detected
              </p>
            </div>

            {/* Lab values summary for lab reports */}
            {detectedType === 'lab_report' && (
              <div className="bg-purple-50 rounded-lg p-3">
                <h4 className="text-sm font-medium text-purple-900 mb-2">Detected Lab Values</h4>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-2 text-sm">
                  {Object.entries(ocrService.extractLabValues(editedText)).map(([key, { value, unit }]) => (
                    <div key={key} className="flex justify-between bg-white rounded px-2 py-1">
                      <span className="text-gray-600 capitalize">{key}:</span>
                      <span className="font-medium">{value}{unit ? ` ${unit}` : ''}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Action buttons */}
            <div className="flex gap-3 justify-end">
              <button
                type="button"
                onClick={retryProcessing}
                className="inline-flex items-center gap-2 px-4 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
              >
                <RefreshCw className="w-4 h-4" />
                Retry
              </button>
              <button
                type="button"
                onClick={handleCancel}
                className="inline-flex items-center gap-2 px-4 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
              >
                <X className="w-4 h-4" />
                Cancel
              </button>
              <button
                type="button"
                onClick={confirmText}
                className="inline-flex items-center gap-2 px-4 py-2 text-white bg-green-600 rounded-lg hover:bg-green-700 transition-colors"
              >
                <Check className="w-4 h-4" />
                Use Text
              </button>
            </div>
          </div>
        )}

        {/* Process button */}
        {image && !result && !isProcessing && (
          <div className="flex justify-center">
            <button
              type="button"
              onClick={processImage}
              className="inline-flex items-center gap-2 px-6 py-3 text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition-colors font-medium"
            >
              <FileText className="w-5 h-5" />
              Extract Text
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

export default OCRScanner;
