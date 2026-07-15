/**
 * Speech-to-Text Input Component
 * Reusable component for voice dictation with medical terminology support
 */

import React, { useState, useCallback, useEffect, useRef } from 'react';
import { Mic, MicOff, Loader2, Wand2, RotateCcw, Volume2, Check, X, AlertCircle, Camera, Upload, ScanLine } from 'lucide-react';
import { speechToTextService, SpeechRecognitionResult } from '../services/speechToTextService';
import { aiTextEnhancementService, TextContext } from '../services/aiTextEnhancementService';
import { ocrService } from '../services/ocrService';

interface SpeechToTextInputProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  label?: string;
  rows?: number;
  disabled?: boolean;
  className?: string;
  context?: TextContext;
  showAIEnhance?: boolean;
  showWordCount?: boolean;
  required?: boolean;
  id?: string;
  name?: string;
  maxLength?: number;
  helperText?: string;
  error?: string;
  /** When true, shows a Scan button that captures/uploads an image and appends OCR text. */
  enableScan?: boolean;
  /** Hint for the OCR pipeline. Common values: 'general' | 'clinical_note' | 'lab_report' | 'prescription' */
  scanDocumentType?: string;
  /** Custom scan button tooltip. */
  scanLabel?: string;
}

export const SpeechToTextInput: React.FC<SpeechToTextInputProps> = ({
  value,
  onChange,
  placeholder = 'Type or use voice dictation...',
  label,
  rows = 4,
  disabled = false,
  className = '',
  context = 'general',
  showAIEnhance = true,
  showWordCount = false,
  required = false,
  id,
  name,
  maxLength,
  helperText,
  error,
  enableScan = false,
  scanDocumentType = 'general',
  scanLabel = 'Scan / upload document'
}) => {
  const [isListening, setIsListening] = useState(false);
  const [isEnhancing, setIsEnhancing] = useState(false);
  const [interimTranscript, setInterimTranscript] = useState('');
  const [speechError, setSpeechError] = useState<string | null>(null);
  const [uncertainText, setUncertainText] = useState<string | null>(null);
  const [showEnhanceSuccess, setShowEnhanceSuccess] = useState(false);
  const [isSpeechSupported, setIsSpeechSupported] = useState(true);
  const [isScanning, setIsScanning] = useState(false);
  const [scanProgress, setScanProgress] = useState<string>('');
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const originalValueRef = useRef<string>('');
  const currentValueRef = useRef<string>(value);
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Keep currentValueRef in sync with value prop
  useEffect(() => {
    currentValueRef.current = value;
  }, [value]);

  // Check speech recognition support
  useEffect(() => {
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    setIsSpeechSupported(!!SpeechRecognition);
  }, []);

  // Handle speech recognition results — NEW architecture:
  // The service sends ONLY new segments via onResult (not the full transcript).
  // For isFinal: we APPEND the new segment to the current value.
  // For interim: we show it as a preview suffix.
  const handleSpeechResult = useCallback((result: SpeechRecognitionResult) => {
    if (result.isFinal) {
      const newSegment = result.transcript.trim();
      if (!newSegment) return;

      // Process punctuation commands
      const processed = speechToTextService.processPunctuationCommands(newSegment);
      setUncertainText(result.confidence < 0.65 ? processed : null);

      // Use ref to get the LATEST value (avoids stale closure)
      const currentVal = currentValueRef.current.trim();
      const separator = currentVal ? ' ' : '';
      const newValue = currentVal + separator + processed;
      currentValueRef.current = newValue; // Update ref immediately
      onChange(newValue);

      setInterimTranscript('');
    } else {
      // Show interim results as preview
      setInterimTranscript(result.transcript || '');
    }
  }, [onChange]);

  // Handle speech recognition errors
  const handleSpeechError = useCallback((error: string) => {
    setSpeechError(error);
    setIsListening(false);
    
    // Clear error after 5 seconds
    setTimeout(() => setSpeechError(null), 5000);
  }, []);

  // Toggle speech recognition
  const toggleListening = useCallback(async () => {
    if (!isSpeechSupported) {
      setSpeechError('Speech recognition is not supported in this browser. Please use Chrome or Edge.');
      return;
    }

    if (isListening) {
      speechToTextService.stopListening();
      setIsListening(false);
      setInterimTranscript('');
    } else {
      setSpeechError(null);
      originalValueRef.current = value;
      
      try {
        speechToTextService.startListening({
          continuous: speechToTextService.getSettings().continuous,
          interimResults: true,
          language: speechToTextService.getSettings().language,
          onResult: handleSpeechResult,
          onError: handleSpeechError,
          onEnd: () => {
            setIsListening(false);
            setInterimTranscript('');
          }
        });
        setIsListening(true);
      } catch (err: any) {
        handleSpeechError(err.message || 'Failed to start speech recognition');
      }
    }
  }, [isListening, isSpeechSupported, value, handleSpeechResult, handleSpeechError]);

  // Stop listening when component unmounts
  useEffect(() => {
    return () => {
      if (isListening) {
        speechToTextService.stopListening();
      }
    };
  }, [isListening]);

  // Enhance text with AI
  const enhanceText = useCallback(async () => {
    if (!value.trim() || isEnhancing) return;

    setIsEnhancing(true);
    originalValueRef.current = value;

    try {
      const result = await aiTextEnhancementService.enhanceText(value, { context });
      onChange(result.enhancedText);
      setShowEnhanceSuccess(true);
      setTimeout(() => setShowEnhanceSuccess(false), 3000);
    } catch (err) {
      console.error('Text enhancement failed:', err);
      setSpeechError('Failed to enhance text. Please try again.');
    } finally {
      setIsEnhancing(false);
    }
  }, [value, context, onChange, isEnhancing]);

  // Revert to original text
  const revertText = useCallback(() => {
    if (originalValueRef.current) {
      onChange(originalValueRef.current);
      setShowEnhanceSuccess(false);
    }
  }, [onChange]);

  // Scan / upload document via OCR
  const handleScanFile = useCallback(async (file: File | null) => {
    if (!file) return;
    setIsScanning(true);
    setSpeechError(null);
    setScanProgress('Preparing image...');
    originalValueRef.current = value;
    try {
      const result = await ocrService.extractText(file, scanDocumentType as any, (p: any) => {
        if (p?.status) setScanProgress(p.status);
      });
      const extracted = (result?.text || '').trim();
      if (!extracted) {
        setSpeechError('No readable text found in the scan. Try a clearer photo with better lighting.');
        return;
      }
      const currentVal = currentValueRef.current.trim();
      const separator = currentVal ? '\n\n' : '';
      const newValue = currentVal + separator + extracted;
      currentValueRef.current = newValue;
      onChange(newValue);
      setShowEnhanceSuccess(true);
      setTimeout(() => setShowEnhanceSuccess(false), 3000);
    } catch (err: any) {
      console.error('OCR scan failed:', err);
      setSpeechError(err?.message || 'Failed to scan document. Please try again.');
      setTimeout(() => setSpeechError(null), 5000);
    } finally {
      setIsScanning(false);
      setScanProgress('');
      // Reset inputs so picking the same file again still fires onChange
      if (cameraInputRef.current) cameraInputRef.current.value = '';
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  }, [onChange, scanDocumentType, value]);

  // Calculate word count
  const wordCount = value.trim() ? value.trim().split(/\s+/).length : 0;

  // Combined display value (actual + interim)
  const displayValue = interimTranscript 
    ? `${value} ${interimTranscript}`.trim()
    : value;

  return (
    <div className={`speech-to-text-input ${className}`}>
      {label && (
        <label 
          htmlFor={id}
          className="block text-sm font-medium text-gray-700 mb-1"
        >
          {label}
          {required && <span className="text-red-500 ml-1">*</span>}
        </label>
      )}

      <div className="relative">
        <textarea
          ref={textareaRef}
          id={id}
          name={name}
          value={displayValue}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          rows={rows}
          disabled={disabled || isListening}
          required={required}
          maxLength={maxLength}
          className={`
            w-full px-3 py-2 pr-14
            border rounded-lg
            focus:ring-2 focus:ring-green-500 focus:border-green-500
            disabled:bg-gray-100 disabled:cursor-not-allowed
            ${error ? 'border-red-500' : 'border-gray-300'}
            ${isListening ? 'bg-green-50 border-green-300' : ''}
            transition-colors duration-200
          `}
          style={{ 
            minHeight: `${rows * 24}px`,
            resize: 'vertical'
          }}
        />

        {/* Control buttons */}
        <div className="absolute right-2 top-2 flex flex-col gap-1">
          {/* Microphone button */}
          <button
            type="button"
            onClick={toggleListening}
            disabled={disabled || !isSpeechSupported}
            className={`
              p-2 rounded-lg transition-all duration-200
              ${isListening 
                ? 'bg-red-500 text-white animate-pulse hover:bg-red-600' 
                : 'bg-gray-100 text-gray-600 hover:bg-green-100 hover:text-green-600'
              }
              ${disabled || !isSpeechSupported ? 'opacity-50 cursor-not-allowed' : ''}
            `}
            title={isListening ? 'Stop dictation' : 'Start voice dictation'}
          >
            {isListening ? (
              <MicOff className="w-5 h-5" />
            ) : (
              <Mic className="w-5 h-5" />
            )}
          </button>

          {/* AI Enhance button */}
          {showAIEnhance && value.trim() && (
            <button
              type="button"
              onClick={enhanceText}
              disabled={disabled || isEnhancing || isListening}
              className={`
                p-2 rounded-lg transition-all duration-200
                ${isEnhancing 
                  ? 'bg-purple-500 text-white' 
                  : showEnhanceSuccess
                    ? 'bg-green-500 text-white'
                    : 'bg-gray-100 text-gray-600 hover:bg-purple-100 hover:text-purple-600'
                }
                ${disabled || isEnhancing ? 'opacity-50 cursor-not-allowed' : ''}
              `}
              title="Enhance text with AI"
            >
              {isEnhancing ? (
                <Loader2 className="w-5 h-5 animate-spin" />
              ) : showEnhanceSuccess ? (
                <Check className="w-5 h-5" />
              ) : (
                <Wand2 className="w-5 h-5" />
              )}
            </button>
          )}

          {/* Revert button */}
          {showEnhanceSuccess && originalValueRef.current && (
            <button
              type="button"
              onClick={revertText}
              disabled={disabled}
              className="p-2 rounded-lg bg-gray-100 text-gray-600 hover:bg-orange-100 hover:text-orange-600 transition-all duration-200"
              title="Revert to original"
            >
              <RotateCcw className="w-5 h-5" />
            </button>
          )}

          {/* Scan / upload buttons */}
          {enableScan && (
            <>
              <button
                type="button"
                onClick={() => cameraInputRef.current?.click()}
                disabled={disabled || isScanning}
                className={`
                  p-2 rounded-lg transition-all duration-200
                  ${isScanning
                    ? 'bg-blue-500 text-white'
                    : 'bg-gray-100 text-gray-600 hover:bg-blue-100 hover:text-blue-600'
                  }
                  ${disabled || isScanning ? 'opacity-50 cursor-not-allowed' : ''}
                `}
                title="Scan with camera"
              >
                {isScanning ? (
                  <Loader2 className="w-5 h-5 animate-spin" />
                ) : (
                  <Camera className="w-5 h-5" />
                )}
              </button>
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                disabled={disabled || isScanning}
                className={`
                  p-2 rounded-lg transition-all duration-200
                  bg-gray-100 text-gray-600 hover:bg-blue-100 hover:text-blue-600
                  ${disabled || isScanning ? 'opacity-50 cursor-not-allowed' : ''}
                `}
                title={scanLabel || 'Upload image / PDF for OCR'}
              >
                <Upload className="w-5 h-5" />
              </button>
              <input
                ref={cameraInputRef}
                type="file"
                accept="image/*"
                capture="environment"
                className="hidden"
                onChange={(e) => handleScanFile(e.target.files?.[0] || null)}
              />
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*,application/pdf"
                className="hidden"
                onChange={(e) => handleScanFile(e.target.files?.[0] || null)}
              />
            </>
          )}
        </div>

        {/* Listening indicator */}
        {isListening && (
          <div className="absolute bottom-2 left-2 flex items-center gap-2 text-green-600 text-sm">
            <Volume2 className="w-4 h-4 animate-pulse" />
            <span>Listening...</span>
            <div className="flex gap-1">
              <span className="w-1 h-3 bg-green-500 rounded animate-bounce" style={{ animationDelay: '0ms' }} />
              <span className="w-1 h-3 bg-green-500 rounded animate-bounce" style={{ animationDelay: '150ms' }} />
              <span className="w-1 h-3 bg-green-500 rounded animate-bounce" style={{ animationDelay: '300ms' }} />
            </div>
          </div>
        )}

        {/* Scanning indicator */}
        {isScanning && (
          <div className="absolute bottom-2 left-2 flex items-center gap-2 text-blue-600 text-sm bg-white/90 px-2 py-1 rounded">
            <ScanLine className="w-4 h-4 animate-pulse" />
            <span>{scanProgress || 'Scanning document...'}</span>
          </div>
        )}
      </div>

      {/* Helper text and word count */}
      <div className="mt-1 flex justify-between items-center text-sm">
        <div className="flex-1">
          {error ? (
            <p className="text-red-500 flex items-center gap-1">
              <AlertCircle className="w-4 h-4" />
              {error}
            </p>
          ) : speechError ? (
            <p className="text-orange-500 flex items-center gap-1">
              <AlertCircle className="w-4 h-4" />
              {speechError}
            </p>
          ) : uncertainText ? (
            <p className="text-amber-600 flex items-center gap-1">
              <AlertCircle className="w-4 h-4" />
              Review uncertain dictation: "{uncertainText}"
            </p>
          ) : helperText ? (
            <p className="text-gray-500">{helperText}</p>
          ) : null}
        </div>
        
        {showWordCount && (
          <span className="text-gray-400">
            {wordCount} word{wordCount !== 1 ? 's' : ''}
            {maxLength && ` • ${value.length}/${maxLength}`}
          </span>
        )}
      </div>

      {/* Voice commands help */}
      {isListening && (
        <div className="mt-2 p-2 bg-gray-50 rounded-lg text-xs text-gray-600">
          <p className="font-medium mb-1">Voice commands:</p>
          <ul className="grid grid-cols-1 sm:grid-cols-2 gap-1">
            <li>"period" / "full stop" → .</li>
            <li>"comma" → ,</li>
            <li>"new line" → ↵</li>
            <li>"new paragraph" → ↵↵</li>
            <li>"colon" → :</li>
            <li>"semicolon" → ;</li>
          </ul>
        </div>
      )}
    </div>
  );
};

export default SpeechToTextInput;
