import React, { useState, useRef, useCallback, useEffect } from 'react';
import { medicalDictionary } from '../services/medicalDictionaryService';

interface MedicalAutocompleteTextareaProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  rows?: number;
  className?: string;
  disabled?: boolean;
  id?: string;
  name?: string;
  required?: boolean;
  maxLength?: number;
}

/**
 * Textarea with medical word autocomplete suggestions.
 * Shows a dropdown of medical terms as the user types.
 * Supports keyboard navigation (arrow keys, Enter, Escape, Tab).
 */
export default function MedicalAutocompleteTextarea({
  value,
  onChange,
  placeholder,
  rows = 3,
  className = '',
  disabled = false,
  id,
  name,
  required,
  maxLength,
}: MedicalAutocompleteTextareaProps) {
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const suggestionsRef = useRef<HTMLDivElement>(null);
  const wordInfoRef = useRef<{ word: string; startIndex: number } | null>(null);

  const updateSuggestions = useCallback((text: string, cursorPos: number) => {
    const wordInfo = medicalDictionary.extractCurrentWord(text, cursorPos);
    wordInfoRef.current = wordInfo;

    if (!wordInfo || wordInfo.word.length < 2) {
      setSuggestions([]);
      setShowSuggestions(false);
      return;
    }

    const results = medicalDictionary.getSuggestions(wordInfo.word, 6);
    // Don't show if the only suggestion is exactly what's typed
    if (results.length === 1 && results[0].toLowerCase() === wordInfo.word.toLowerCase()) {
      setSuggestions([]);
      setShowSuggestions(false);
      return;
    }
    setSuggestions(results);
    setSelectedIndex(0);
    setShowSuggestions(results.length > 0);
  }, []);

  const applySuggestion = useCallback((suggestion: string) => {
    const wordInfo = wordInfoRef.current;
    if (!wordInfo || !textareaRef.current) return;

    const before = value.slice(0, wordInfo.startIndex);
    const after = value.slice(wordInfo.startIndex + wordInfo.word.length);
    const newValue = before + suggestion + (after.startsWith(' ') ? after : ' ' + after);
    onChange(newValue);

    setSuggestions([]);
    setShowSuggestions(false);

    // Restore cursor position after the inserted suggestion
    requestAnimationFrame(() => {
      if (textareaRef.current) {
        const newCursorPos = wordInfo.startIndex + suggestion.length + 1;
        textareaRef.current.selectionStart = newCursorPos;
        textareaRef.current.selectionEnd = newCursorPos;
        textareaRef.current.focus();
      }
    });
  }, [value, onChange]);

  const handleInputChange = useCallback((e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const newValue = e.target.value;
    onChange(newValue);
    updateSuggestions(newValue, e.target.selectionStart ?? newValue.length);
  }, [onChange, updateSuggestions]);

  const handleKeyDown = useCallback((e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (!showSuggestions || suggestions.length === 0) return;

    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        setSelectedIndex(prev => (prev + 1) % suggestions.length);
        break;
      case 'ArrowUp':
        e.preventDefault();
        setSelectedIndex(prev => (prev - 1 + suggestions.length) % suggestions.length);
        break;
      case 'Tab':
      case 'Enter':
        // Only consume Enter if suggestions are showing; let Tab always work
        if (e.key === 'Enter' && !e.shiftKey) {
          // Only intercept if suggestions are visible
          e.preventDefault();
          applySuggestion(suggestions[selectedIndex]);
        } else if (e.key === 'Tab') {
          e.preventDefault();
          applySuggestion(suggestions[selectedIndex]);
        }
        break;
      case 'Escape':
        e.preventDefault();
        setShowSuggestions(false);
        break;
    }
  }, [showSuggestions, suggestions, selectedIndex, applySuggestion]);

  const handleClick = useCallback(() => {
    if (textareaRef.current) {
      updateSuggestions(value, textareaRef.current.selectionStart ?? value.length);
    }
  }, [value, updateSuggestions]);

  // Close suggestions when clicking outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (
        suggestionsRef.current &&
        !suggestionsRef.current.contains(e.target as Node) &&
        textareaRef.current &&
        !textareaRef.current.contains(e.target as Node)
      ) {
        setShowSuggestions(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Scroll selected suggestion into view
  useEffect(() => {
    if (suggestionsRef.current && showSuggestions) {
      const selected = suggestionsRef.current.children[selectedIndex] as HTMLElement;
      selected?.scrollIntoView({ block: 'nearest' });
    }
  }, [selectedIndex, showSuggestions]);

  return (
    <div className="relative">
      <textarea
        ref={textareaRef}
        id={id}
        name={name}
        value={value}
        onChange={handleInputChange}
        onKeyDown={handleKeyDown}
        onClick={handleClick}
        placeholder={placeholder}
        rows={rows}
        className={className || 'w-full p-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-green-500 focus:border-transparent resize-none'}
        disabled={disabled}
        required={required}
        maxLength={maxLength}
        autoComplete="off"
        autoCorrect="off"
        spellCheck={false}
      />
      {showSuggestions && suggestions.length > 0 && (
        <div
          ref={suggestionsRef}
          className="absolute left-0 right-0 z-50 mt-0.5 bg-white border border-gray-200 rounded-lg shadow-lg max-h-48 overflow-y-auto"
          role="listbox"
        >
          {suggestions.map((suggestion, index) => (
            <button
              key={suggestion}
              type="button"
              role="option"
              aria-selected={index === selectedIndex}
              className={`w-full text-left px-3 py-2 text-sm cursor-pointer transition-colors ${
                index === selectedIndex
                  ? 'bg-green-50 text-green-800 font-medium'
                  : 'text-gray-700 hover:bg-gray-50'
              }`}
              onMouseDown={(e) => {
                e.preventDefault(); // Prevent blur on textarea
                applySuggestion(suggestion);
              }}
              onMouseEnter={() => setSelectedIndex(index)}
            >
              <span className="flex items-center gap-2">
                <span className="text-green-500 text-xs">●</span>
                {highlightMatch(suggestion, wordInfoRef.current?.word || '')}
              </span>
            </button>
          ))}
          <div className="px-3 py-1 text-[10px] text-gray-400 border-t border-gray-100">
            ↑↓ navigate · Tab/Enter select · Esc dismiss
          </div>
        </div>
      )}
    </div>
  );
}

/** Highlights the matching prefix in the suggestion text */
function highlightMatch(text: string, match: string): React.ReactNode {
  if (!match) return text;
  const lower = text.toLowerCase();
  const matchLower = match.toLowerCase();
  const idx = lower.indexOf(matchLower);
  if (idx === -1) return text;

  return (
    <>
      {text.slice(0, idx)}
      <span className="font-semibold text-green-700">{text.slice(idx, idx + match.length)}</span>
      {text.slice(idx + match.length)}
    </>
  );
}
