/**
 * Medical Text Input Component
 * A comprehensive text input with speech-to-text, OCR scanning, and AI enhancement
 * Designed for medical documentation workflows
 */

import React, { useState, useCallback, useRef, useEffect } from 'react';
import { 
  Mic, 
  MicOff, 
  Camera, 
  Upload, 
  Wand2, 
  Loader2, 
  Volume2, 
  Check, 
  RotateCcw,
  AlertCircle,
} from 'lucide-react';
import { speechToTextService, SpeechRecognitionResult } from '../services/speechToTextService';
import { aiTextEnhancementService, TextContext } from '../services/aiTextEnhancementService';
import { ocrService, OCRProgress, DocumentType } from '../services/ocrService';
import { medicalDictionary } from '../services/medicalDictionaryService';

interface MedicalTextInputProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  label?: string;
  rows?: number;
  disabled?: boolean;
  className?: string;
  context?: TextContext;
  documentType?: DocumentType;
  showSpeech?: boolean;
  showOCR?: boolean;
  showAIEnhance?: boolean;
  showWordCount?: boolean;
  required?: boolean;
  id?: string;
  name?: string;
  maxLength?: number;
  helperText?: string;
  error?: string;
  onLabValuesExtracted?: (labValues: Record<string, { value: string; unit?: string }>) => void;
}

export const MedicalTextInput: React.FC<MedicalTextInputProps> = ({
  value,
  onChange,
  placeholder = 'Type, dictate, or scan document...',
  label,
  rows = 4,
  disabled = false,
  className = '',
  context = 'general',
  documentType = 'general',
  showSpeech = true,
  showOCR = true,
  showAIEnhance = true,
  showWordCount = false,
  required = false,
  id,
  name,
  maxLength,
  helperText,
  error,
  onLabValuesExtracted
}) => {
  // Speech-to-text state
  const [isListening, setIsListening] = useState(false);
  const [interimTranscript, setInterimTranscript] = useState('');
  const [isSpeechSupported, setIsSpeechSupported] = useState(true);
  
  // OCR state
  const [isScanning, setIsScanning] = useState(false);
  const [ocrImage, setOcrImage] = useState<string | null>(null);
  const [ocrProgress, setOcrProgress] = useState<OCRProgress | null>(null);
  
  // AI enhancement state
  const [isEnhancing, setIsEnhancing] = useState(false);
  const [showEnhanceSuccess, setShowEnhanceSuccess] = useState(false);
  
  // Common state
  const [inputError, setInputError] = useState<string | null>(null);
  const [uncertainText, setUncertainText] = useState<string | null>(null);
  const [originalValue, setOriginalValue] = useState<string>('');
  const [showToolbar, setShowToolbar] = useState(false);
  
  // Refs
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const preRecordingValueRef = useRef<string>('');
  const currentValueRef = useRef<string>(value);

  // Autocomplete state
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [selectedSuggestionIdx, setSelectedSuggestionIdx] = useState(0);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const suggestionsRef = useRef<HTMLDivElement>(null);
  const wordInfoRef = useRef<{ word: string; startIndex: number } | null>(null);

  // Keep currentValueRef in sync with value prop
  useEffect(() => {
    currentValueRef.current = value;
  }, [value]);

  // Check speech recognition support
  useEffect(() => {
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    setIsSpeechSupported(!!SpeechRecognition);
  }, []);

  // Speech recognition handlers — NEW architecture:
  // The service sends ONLY new segments via onResult.
  // For isFinal: transcript = new finalized segment. We APPEND it to the value.
  // For interim: transcript = current interim text. We show it as preview.
  const handleSpeechResult = useCallback((result: SpeechRecognitionResult) => {
    if (result.isFinal) {
      const newSegment = result.transcript.trim();
      if (!newSegment) return;

      // Process punctuation commands in the new segment
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
      // Just update the interim preview
      setInterimTranscript(result.transcript || '');
    }
  }, [onChange]);

  const handleSpeechError = useCallback((error: string) => {
    setInputError(error);
    setIsListening(false);
    setTimeout(() => setInputError(null), 5000);
  }, []);

  // Toggle speech recognition
  const toggleListening = useCallback(async () => {
    if (!isSpeechSupported) {
      setInputError('Speech recognition not supported. Use Chrome or Edge.');
      return;
    }

    if (isListening) {
      speechToTextService.stopListening();
      setIsListening(false);
      setInterimTranscript('');
    } else {
      setInputError(null);
      setOriginalValue(value);
      preRecordingValueRef.current = value;
      
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

  // Stop listening on unmount
  useEffect(() => {
    return () => {
      if (isListening) {
        speechToTextService.stopListening();
      }
    };
  }, [isListening]);

  // Handle file selection for OCR
  const handleFileSelect = useCallback(async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    // Validate file size (10MB max)
    if (file.size > 10 * 1024 * 1024) {
      setInputError('File too large. Maximum size is 10MB.');
      return;
    }

    // Create preview and process
    const reader = new FileReader();
    reader.onload = async (e) => {
      const imageData = e.target?.result as string;
      setOcrImage(imageData);
      await processOCR(imageData);
    };
    reader.readAsDataURL(file);

    // Reset input
    if (fileInputRef.current) fileInputRef.current.value = '';
    if (cameraInputRef.current) cameraInputRef.current.value = '';
  }, []);

  // Process image with OCR
  const processOCR = useCallback(async (imageData: string) => {
    setIsScanning(true);
    setInputError(null);
    setOcrProgress({ status: 'Initializing...', progress: 0 });

    try {
      const result = await ocrService.extractText(
        imageData,
        documentType,
        (p) => setOcrProgress(p)
      );

      if (result.text.trim()) {
        // Append extracted text to existing content
        const newValue = value 
          ? `${value}\n\n--- Scanned Document ---\n${result.text}`
          : result.text;
        onChange(newValue);

        // Extract lab values if applicable
        if ((documentType === 'lab_report' || ocrService.isLabReport(result.text)) && onLabValuesExtracted) {
          const labValues = ocrService.extractLabValues(result.text);
          if (Object.keys(labValues).length > 0) {
            onLabValuesExtracted(labValues);
          }
        }
      } else {
        setInputError('No text detected in image. Try a clearer image.');
      }
    } catch (err: any) {
      console.error('OCR failed:', err);
      setInputError(err.message || 'Failed to extract text from image');
    } finally {
      setIsScanning(false);
      setOcrProgress(null);
      setOcrImage(null);
    }
  }, [documentType, value, onChange, onLabValuesExtracted]);

  // AI text enhancement
  const enhanceText = useCallback(async () => {
    if (!value.trim() || isEnhancing) return;

    setIsEnhancing(true);
    setOriginalValue(value);
    setInputError(null);

    try {
      const result = await aiTextEnhancementService.enhanceText(value, { context });
      onChange(result.enhancedText);
      setShowEnhanceSuccess(true);
      setTimeout(() => setShowEnhanceSuccess(false), 3000);
    } catch (err) {
      console.error('Text enhancement failed:', err);
      setInputError('Failed to enhance text. Please try again.');
    } finally {
      setIsEnhancing(false);
    }
  }, [value, context, onChange, isEnhancing]);

  // Revert to original text
  const revertText = useCallback(() => {
    if (originalValue) {
      onChange(originalValue);
      setShowEnhanceSuccess(false);
    }
  }, [originalValue, onChange]);

  // ─── Autocomplete helpers ───
  const updateSuggestions = useCallback((text: string, cursorPos: number) => {
    const wordInfo = medicalDictionary.extractCurrentWord(text, cursorPos);
    wordInfoRef.current = wordInfo;
    if (!wordInfo || wordInfo.word.length < 2) {
      setSuggestions([]);
      setShowSuggestions(false);
      return;
    }
    const results = medicalDictionary.getSuggestions(wordInfo.word, 6);
    if (results.length === 1 && results[0].toLowerCase() === wordInfo.word.toLowerCase()) {
      setSuggestions([]);
      setShowSuggestions(false);
      return;
    }
    setSuggestions(results);
    setSelectedSuggestionIdx(0);
    setShowSuggestions(results.length > 0);
  }, []);

  const applySuggestion = useCallback((suggestion: string) => {
    const wordInfo = wordInfoRef.current;
    if (!wordInfo) return;
    const before = value.slice(0, wordInfo.startIndex);
    const after = value.slice(wordInfo.startIndex + wordInfo.word.length);
    const newValue = before + suggestion + (after.startsWith(' ') ? after : ' ' + after);
    onChange(newValue);
    setSuggestions([]);
    setShowSuggestions(false);
    requestAnimationFrame(() => {
      if (textareaRef.current) {
        const pos = wordInfo.startIndex + suggestion.length + 1;
        textareaRef.current.selectionStart = pos;
        textareaRef.current.selectionEnd = pos;
        textareaRef.current.focus();
      }
    });
  }, [value, onChange]);

  const handleAutocompleteKeyDown = useCallback((e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (!showSuggestions || suggestions.length === 0) return;
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSelectedSuggestionIdx(prev => (prev + 1) % suggestions.length);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelectedSuggestionIdx(prev => (prev - 1 + suggestions.length) % suggestions.length);
    } else if (e.key === 'Tab') {
      e.preventDefault();
      applySuggestion(suggestions[selectedSuggestionIdx]);
    } else if (e.key === 'Escape') {
      e.preventDefault();
      setShowSuggestions(false);
    }
  }, [showSuggestions, suggestions, selectedSuggestionIdx, applySuggestion]);

  // Calculate word count
  const wordCount = value.trim() ? value.trim().split(/\s+/).length : 0;

  // Combined display value
  const displayValue = interimTranscript 
    ? `${value} ${interimTranscript}`.trim()
    : value;

  // Determine if any tool is active
  const isAnyToolActive = isListening || isScanning || isEnhancing;

  return (
    <div className={`medical-text-input ${className}`}>
      {label && (
        <label 
          htmlFor={id}
          className="block text-sm font-medium text-gray-700 mb-1"
        >
          {label}
          {required && <span className="text-red-500 ml-1">*</span>}
        </label>
      )}

      <div className="relative group">
        <textarea
          ref={textareaRef}
          id={id}
          name={name}
          value={displayValue}
          onChange={(e) => {
            onChange(e.target.value);
            updateSuggestions(e.target.value, e.target.selectionStart ?? e.target.value.length);
          }}
          onKeyDown={handleAutocompleteKeyDown}
          placeholder={placeholder}
          rows={rows}
          disabled={disabled || isListening || isScanning}
          required={required}
          maxLength={maxLength}
          onFocus={() => setShowToolbar(true)}
          onBlur={() => setTimeout(() => { setShowToolbar(false); setShowSuggestions(false); }, 200)}
          className={`
            w-full px-3 py-2 pr-28
            border rounded-lg
            focus:ring-2 focus:ring-green-500 focus:border-green-500
            disabled:bg-gray-100 disabled:cursor-not-allowed
            ${error ? 'border-red-500' : 'border-gray-300'}
            ${isListening ? 'bg-green-50 border-green-300 animate-pulse' : ''}
            ${isScanning ? 'bg-blue-50 border-blue-300' : ''}
            transition-all duration-200
          `}
          style={{ minHeight: `${rows * 24}px`, resize: 'vertical' }}
        />

        {/* Medical Autocomplete Suggestions */}
        {showSuggestions && suggestions.length > 0 && (
          <div
            ref={suggestionsRef}
            className="absolute left-0 right-0 z-50 bg-white border border-gray-200 rounded-lg shadow-lg max-h-48 overflow-y-auto"
            style={{ top: `${(rows * 24) + 8}px` }}
          >
            {suggestions.map((suggestion, index) => (
              <button
                key={suggestion}
                type="button"
                className={`w-full text-left px-3 py-2 text-sm cursor-pointer transition-colors ${
                  index === selectedSuggestionIdx
                    ? 'bg-green-50 text-green-800 font-medium'
                    : 'text-gray-700 hover:bg-gray-50'
                }`}
                onMouseDown={(e) => { e.preventDefault(); applySuggestion(suggestion); }}
                onMouseEnter={() => setSelectedSuggestionIdx(index)}
              >
                <span className="flex items-center gap-2">
                  <span className="text-green-500 text-xs">●</span>
                  {suggestion}
                </span>
              </button>
            ))}
            <div className="px-3 py-1 text-[10px] text-gray-400 border-t border-gray-100">
              ↑↓ navigate · Tab select · Esc dismiss
            </div>
          </div>
        )}

        {/* Toolbar - Always visible on right side */}
        <div className="absolute right-2 top-2 flex flex-col gap-1.5">
          {/* Speech button */}
          {showSpeech && (
            <button
              type="button"
              onClick={toggleListening}
              disabled={disabled || !isSpeechSupported || isScanning}
              className={`
                p-2 rounded-lg transition-all duration-200 shadow-sm
                ${isListening 
                  ? 'bg-red-500 text-white ring-2 ring-red-300' 
                  : 'bg-white text-gray-600 hover:bg-green-50 hover:text-green-600 border border-gray-200'
                }
                ${disabled || !isSpeechSupported || isScanning ? 'opacity-50 cursor-not-allowed' : ''}
              `}
              title={isListening ? 'Stop dictation (click or say "stop listening")' : 'Start voice dictation'}
            >
              {isListening ? <MicOff className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
            </button>
          )}

          {/* OCR buttons */}
          {showOCR && (
            <>
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                disabled={disabled || isListening || isScanning}
                className={`
                  p-2 rounded-lg transition-all duration-200 shadow-sm
                  ${isScanning 
                    ? 'bg-blue-500 text-white' 
                    : 'bg-white text-gray-600 hover:bg-blue-50 hover:text-blue-600 border border-gray-200'
                  }
                  ${disabled || isListening || isScanning ? 'opacity-50 cursor-not-allowed' : ''}
                `}
                title="Upload document image"
              >
                {isScanning ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
              </button>
              
              <button
                type="button"
                onClick={() => cameraInputRef.current?.click()}
                disabled={disabled || isListening || isScanning}
                className={`
                  p-2 rounded-lg transition-all duration-200 shadow-sm
                  bg-white text-gray-600 hover:bg-blue-50 hover:text-blue-600 border border-gray-200
                  ${disabled || isListening || isScanning ? 'opacity-50 cursor-not-allowed' : ''}
                `}
                title="Capture document with camera"
              >
                <Camera className="w-4 h-4" />
              </button>
            </>
          )}

          {/* AI Enhance button */}
          {showAIEnhance && value.trim().length > 20 && (
            <button
              type="button"
              onClick={enhanceText}
              disabled={disabled || isEnhancing || isListening || isScanning}
              className={`
                p-2 rounded-lg transition-all duration-200 shadow-sm
                ${isEnhancing 
                  ? 'bg-purple-500 text-white' 
                  : showEnhanceSuccess
                    ? 'bg-green-500 text-white'
                    : 'bg-white text-gray-600 hover:bg-purple-50 hover:text-purple-600 border border-gray-200'
                }
                ${disabled || isEnhancing || isListening || isScanning ? 'opacity-50 cursor-not-allowed' : ''}
              `}
              title="Polish text with AI"
            >
              {isEnhancing ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : showEnhanceSuccess ? (
                <Check className="w-4 h-4" />
              ) : (
                <Wand2 className="w-4 h-4" />
              )}
            </button>
          )}

          {/* Revert button */}
          {showEnhanceSuccess && originalValue && (
            <button
              type="button"
              onClick={revertText}
              disabled={disabled}
              className="p-2 rounded-lg bg-white text-gray-600 hover:bg-orange-50 hover:text-orange-600 border border-gray-200 transition-all duration-200 shadow-sm"
              title="Revert to original"
            >
              <RotateCcw className="w-4 h-4" />
            </button>
          )}
        </div>

        {/* Hidden file inputs */}
        <input
          ref={fileInputRef}
          type="file"
          accept="image/png,image/jpeg,image/jpg,image/webp"
          onChange={handleFileSelect}
          className="hidden"
        />
        <input
          ref={cameraInputRef}
          type="file"
          accept="image/*"
          capture="environment"
          onChange={handleFileSelect}
          className="hidden"
        />

        {/* Listening indicator */}
        {isListening && (
          <div className="absolute bottom-2 left-2 flex items-center gap-2 text-green-600 text-sm bg-white/90 px-2 py-1 rounded-lg shadow-sm">
            <Volume2 className="w-4 h-4" />
            <span>Listening...</span>
            <div className="flex gap-0.5">
              {[0, 1, 2].map(i => (
                <span 
                  key={i}
                  className="w-1 h-3 bg-green-500 rounded animate-bounce"
                  style={{ animationDelay: `${i * 150}ms` }}
                />
              ))}
            </div>
          </div>
        )}

        {/* Scanning indicator */}
        {isScanning && ocrProgress && (
          <div className="absolute bottom-2 left-2 right-16 bg-white/95 px-3 py-2 rounded-lg shadow-sm">
            <div className="flex items-center justify-between text-sm text-blue-600 mb-1">
              <span>{ocrProgress.status}</span>
              <span>{Math.round(ocrProgress.progress * 100)}%</span>
            </div>
            <div className="w-full bg-gray-200 rounded-full h-1.5 overflow-hidden">
              <div 
                className="bg-blue-500 h-full transition-all duration-300"
                style={{ width: `${ocrProgress.progress * 100}%` }}
              />
            </div>
          </div>
        )}
      </div>

      {/* Footer info */}
      <div className="mt-1 flex justify-between items-start text-sm">
        <div className="flex-1">
          {error ? (
            <p className="text-red-500 flex items-center gap-1">
              <AlertCircle className="w-4 h-4" />
              {error}
            </p>
          ) : inputError ? (
            <p className="text-orange-500 flex items-center gap-1">
              <AlertCircle className="w-4 h-4" />
              {inputError}
            </p>
          ) : uncertainText ? (
            <p className="text-amber-600 flex items-center gap-1">
              <AlertCircle className="w-4 h-4" />
              Review uncertain dictation: "{uncertainText}"
            </p>
          ) : helperText ? (
            <p className="text-gray-500">{helperText}</p>
          ) : (
            <p className="text-gray-400 text-xs">
              {showSpeech && '🎤 Voice'}
              {showSpeech && showOCR && ' • '}
              {showOCR && '📷 Scan'}
              {(showSpeech || showOCR) && showAIEnhance && ' • '}
              {showAIEnhance && '✨ AI Polish'}
            </p>
          )}
        </div>
        
        {showWordCount && (
          <span className="text-gray-400 text-xs">
            {wordCount} word{wordCount !== 1 ? 's' : ''}
            {maxLength && ` • ${value.length}/${maxLength}`}
          </span>
        )}
      </div>

      {/* Voice commands tooltip */}
      {isListening && (
        <div className="mt-2 p-2 bg-green-50 border border-green-200 rounded-lg text-xs text-green-700">
          <p className="font-medium mb-1">💡 Voice commands:</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-0.5">
            <span>"period" → .</span>
            <span>"comma" → ,</span>
            <span>"new line" → ↵</span>
            <span>"new paragraph" → ↵↵</span>
          </div>
        </div>
      )}
    </div>
  );
};

export default MedicalTextInput;
