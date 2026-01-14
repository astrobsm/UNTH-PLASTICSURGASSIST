/**
 * Speech-to-Text Input Component
 * Reusable component for voice dictation with medical terminology support
 */

import React, { useState, useCallback, useEffect, useRef } from 'react';
import { Mic, MicOff, Loader2, Wand2, RotateCcw, Volume2, Check, X, AlertCircle } from 'lucide-react';
import { speechToTextService, SpeechRecognitionResult } from '../services/speechToTextService';
import { aiTextEnhancementService, TextContext } from '../services/aiTextEnhancementService';

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
  error
}) => {
  const [isListening, setIsListening] = useState(false);
  const [isEnhancing, setIsEnhancing] = useState(false);
  const [interimTranscript, setInterimTranscript] = useState('');
  const [speechError, setSpeechError] = useState<string | null>(null);
  const [showEnhanceSuccess, setShowEnhanceSuccess] = useState(false);
  const [isSpeechSupported, setIsSpeechSupported] = useState(true);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const originalValueRef = useRef<string>('');

  // Check speech recognition support
  useEffect(() => {
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    setIsSpeechSupported(!!SpeechRecognition);
  }, []);

  // Handle speech recognition results
  const handleSpeechResult = useCallback((result: SpeechRecognitionResult) => {
    if (result.isFinal) {
      // Append final result to existing text
      const newValue = value 
        ? `${value} ${result.transcript}`.trim()
        : result.transcript;
      onChange(newValue);
      setInterimTranscript('');
    } else {
      setInterimTranscript(result.transcript);
    }
  }, [value, onChange]);

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
          continuous: true,
          interimResults: true,
          language: 'en-US',
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
            w-full px-3 py-2 pr-24 
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
          <ul className="grid grid-cols-2 gap-1">
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
