/**
 * Speech-to-Text Service for Medical Dictation — Advanced Engine
 * Uses Web Speech API with robust accumulation, deduplication, and medical terminology support.
 * 
 * Key design decisions:
 * - The SERVICE owns the accumulated transcript across recognition restarts
 * - Each finalized segment is stored as a separate entry to prevent echoes
 * - Deduplication compares new segments against recent history
 * - Consumer components receive ONLY new segments (not the full transcript) via onResult
 * - The service exposes getFullTranscript() for the complete accumulated text
 */

export interface SpeechRecognitionResult {
  /** The new text segment (NOT the full transcript — just the new part) */
  transcript: string;
  confidence: number;
  isFinal: boolean;
  /** The complete accumulated transcript so far (all segments joined) */
  fullTranscript: string;
}

export interface SpeechToTextOptions {
  language?: string;
  continuous?: boolean;
  interimResults?: boolean;
  maxAlternatives?: number;
  onResult?: (result: SpeechRecognitionResult) => void;
  onError?: (error: string) => void;
  onStart?: () => void;
  onEnd?: () => void;
}

// Medical terminology corrections for common misrecognitions
const MEDICAL_CORRECTIONS: Record<string, string> = {
  // Surgical terms
  'abdominal plasty': 'abdominoplasty',
  'rhino plasty': 'rhinoplasty',
  'mammo plasty': 'mammoplasty',
  'blepharo plasty': 'blepharoplasty',
  'rhytid ectomy': 'rhytidectomy',
  'face lift': 'facelift',
  'breast aug': 'breast augmentation',
  'lipo suction': 'liposuction',
  
  // Medical conditions
  'hema toma': 'hematoma',
  'sero ma': 'seroma',
  'necro sis': 'necrosis',
  'cell u litis': 'cellulitis',
  'de his ence': 'dehiscence',
  'hyper trophic': 'hypertrophic',
  
  // Anatomy
  'sub cutaneous': 'subcutaneous',
  'intra muscular': 'intramuscular',
  'intra venous': 'intravenous',
  'epi dermal': 'epidermal',
  
  // Medications
  'epi nephrine': 'epinephrine',
  'metro nidazole': 'metronidazole',
  
  // Lab values
  'hemo globin': 'hemoglobin',
  'white blood cell': 'WBC',
  'red blood cell': 'RBC',
  'electro lytes': 'electrolytes',
  
  // Common phrases
  'vital signs': 'Vital signs',
  'wound is': 'Wound is',
  'no signs of': 'No signs of',
  'signs of': 'Signs of'
};

// Medical abbreviation expansions
const MEDICAL_ABBREVIATIONS: Record<string, string> = {
  'bp': 'BP', 'hr': 'HR', 'rr': 'RR', 'spo2': 'SpO2',
  'iv': 'IV', 'im': 'IM', 'po': 'PO',
  'bid': 'BD', 'tid': 'TDS', 'qid': 'QDS', 'prn': 'PRN',
  'stat': 'STAT', 'npo': 'NPO',
  'sob': 'SOB', 'nkda': 'NKDA',
  'wbc': 'WBC', 'rbc': 'RBC', 'hgb': 'Hgb', 'hct': 'Hct',
  'plt': 'Platelets', 'bun': 'BUN', 'cr': 'Creatinine',
  'na': 'Na+', 'k': 'K+', 'cl': 'Cl-', 'co2': 'CO2',
  'ast': 'AST', 'alt': 'ALT', 'inr': 'INR', 'ptt': 'PTT'
};

/**
 * Normalize text for comparison (lowercase, collapse spaces, trim punctuation)
 */
function normalize(text: string): string {
  return text.toLowerCase().replace(/[.,!?;:]/g, '').replace(/\s+/g, ' ').trim();
}

/**
 * Check if `candidate` is a suffix/substring of `existing` or vice-versa (echo detection)
 */
function isEchoOrRepeat(existing: string, candidate: string): boolean {
  const a = normalize(existing);
  const b = normalize(candidate);
  if (!a || !b) return false;
  if (a === b) return true;
  // Check if one contains the other
  if (a.includes(b) || b.includes(a)) return true;
  // Check if the candidate starts/ends with a large overlap (>60%) of existing
  const minLen = Math.min(a.length, b.length);
  const overlapThreshold = Math.floor(minLen * 0.6);
  if (overlapThreshold < 5) return false;
  // Check trailing overlap: end of existing matches start of candidate
  for (let len = overlapThreshold; len <= minLen; len++) {
    if (a.endsWith(b.substring(0, len))) return true;
    if (b.endsWith(a.substring(0, len))) return true;
  }
  return false;
}

class SpeechToTextService {
  private recognition: any = null;
  private isListening: boolean = false;
  private options: SpeechToTextOptions = {};

  /**
   * ACCUMULATED SEGMENTS: Each finalized speech result is stored as a separate segment.
   * This array persists across recognition restarts in continuous mode.
   * The full transcript = segments.join(' ')
   */
  private segments: string[] = [];

  /**
   * The number of finalized results processed in the CURRENT recognition session.
   * Reset on each recognition restart. Used to know which event.results are new.
   */
  private processedFinalCount: number = 0;

  /**
   * Track whether we're in a deliberate stop (vs. auto-restart)
   */
  private deliberatelyStopped: boolean = false;

  /**
   * Debounce timer for auto-restart
   */
  private restartTimer: ReturnType<typeof setTimeout> | null = null;

  /**
   * Last interim text, for dedup
   */
  private lastInterim: string = '';

  constructor() {
    this.initializeRecognition();
  }

  private initializeRecognition(): void {
    const SpeechRecognition = (window as any).SpeechRecognition || 
                              (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) {
      console.warn('Speech Recognition not supported in this browser');
      return;
    }
    this.recognition = new SpeechRecognition();
  }

  isSupported(): boolean {
    return this.recognition !== null;
  }

  /**
   * Start listening. The service accumulates all finalized text internally.
   * onResult receives ONLY new segments (isFinal=true) or current interim (isFinal=false).
   * Both carry `fullTranscript` (the complete accumulated text so far).
   */
  startListening(options: SpeechToTextOptions = {}): boolean {
    if (!this.recognition) {
      options.onError?.('Speech recognition not supported');
      return false;
    }
    if (this.isListening) {
      return false;
    }

    this.options = options;
    this.segments = [];
    this.processedFinalCount = 0;
    this.deliberatelyStopped = false;
    this.lastInterim = '';

    this.setupRecognition();

    try {
      this.recognition.start();
      return true;
    } catch (error) {
      console.error('Failed to start recognition:', error);
      this.options.onError?.('Failed to start recognition');
      return false;
    }
  }

  private setupRecognition(): void {
    const rec = this.recognition;
    rec.lang = this.options.language || 'en-US';
    rec.continuous = true;           // Always continuous internally
    rec.interimResults = this.options.interimResults ?? true;
    rec.maxAlternatives = 1;

    rec.onstart = () => {
      this.isListening = true;
      this.processedFinalCount = 0; // Reset for this session
      console.log('🎤 Recognition session started');
      this.options.onStart?.();
    };

    rec.onresult = (event: any) => {
      this.handleRecognitionResult(event);
    };

    rec.onerror = (event: any) => {
      console.warn('Speech recognition error:', event.error);
      if (event.error === 'no-speech' || event.error === 'audio-capture') {
        // Non-fatal — will auto-restart
        return;
      }
      if (event.error === 'aborted') {
        return; // Normal during restart
      }
      this.options.onError?.(event.error);
    };

    rec.onend = () => {
      console.log('🎤 Recognition session ended');
      if (!this.deliberatelyStopped && this.isListening) {
        // Auto-restart with a small delay to prevent rapid cycling
        this.restartTimer = setTimeout(() => {
          if (this.isListening && !this.deliberatelyStopped) {
            try {
              console.log('🎤 Auto-restarting recognition...');
              this.processedFinalCount = 0; // Reset for new session
              this.recognition.start();
            } catch (e) {
              console.error('Auto-restart failed:', e);
              this.isListening = false;
              this.options.onEnd?.();
            }
          }
        }, 300);
      } else {
        this.isListening = false;
        this.options.onEnd?.();
      }
    };
  }

  /**
   * Core result handler. Processes event.results and extracts only NEW finalized segments.
   */
  private handleRecognitionResult(event: any): void {
    let newFinalSegments: string[] = [];
    let currentInterim = '';

    for (let i = 0; i < event.results.length; i++) {
      const result = event.results[i];
      if (result.isFinal) {
        // Only process if this is a NEW final result (index >= processedFinalCount)
        if (i >= this.processedFinalCount) {
          const rawText = result[0].transcript.trim();
          if (rawText) {
            const corrected = this.correctMedicalTerms(rawText);
            // Dedup: check against last 3 segments
            const recentSegments = this.segments.slice(-3);
            const isDuplicate = recentSegments.some(seg => isEchoOrRepeat(seg, corrected));
            if (!isDuplicate) {
              newFinalSegments.push(corrected);
            } else {
              console.log('🔇 Duplicate segment suppressed:', corrected.substring(0, 50));
            }
          }
          this.processedFinalCount = i + 1;
        }
      } else {
        // Interim — always take the latest
        currentInterim = result[0].transcript.trim();
      }
    }

    // Add new segments to accumulated array
    if (newFinalSegments.length > 0) {
      this.segments.push(...newFinalSegments);
      const joinedNew = newFinalSegments.join(' ');
      const fullTranscript = this.segments.join(' ');

      this.options.onResult?.({
        transcript: joinedNew,
        confidence: event.results[event.results.length - 1][0].confidence || 0.9,
        isFinal: true,
        fullTranscript
      });
      this.lastInterim = '';
    }

    // Send interim if changed
    if (currentInterim && currentInterim !== this.lastInterim) {
      this.lastInterim = currentInterim;
      const fullSoFar = this.segments.length > 0
        ? this.segments.join(' ') + ' ' + currentInterim
        : currentInterim;

      this.options.onResult?.({
        transcript: currentInterim,
        confidence: 0.5,
        isFinal: false,
        fullTranscript: fullSoFar
      });
    }
  }

  /**
   * Stop listening. Returns the full accumulated transcript.
   */
  stopListening(): string {
    this.deliberatelyStopped = true;
    if (this.restartTimer) {
      clearTimeout(this.restartTimer);
      this.restartTimer = null;
    }
    if (this.recognition && this.isListening) {
      this.isListening = false;
      try {
        this.recognition.stop();
      } catch (e) {
        // Already stopped
      }
      console.log('🎤 Speech recognition stopped');
    }
    return this.getFullTranscript();
  }

  /**
   * Get the complete accumulated transcript (all finalized segments joined).
   */
  getFullTranscript(): string {
    return this.segments.join(' ');
  }

  /**
   * Get the number of accumulated segments.
   */
  getSegmentCount(): number {
    return this.segments.length;
  }

  getIsListening(): boolean {
    return this.isListening;
  }

  // Correct common medical misrecognitions
  private correctMedicalTerms(text: string): string {
    let corrected = text;
    for (const [wrong, right] of Object.entries(MEDICAL_CORRECTIONS)) {
      const regex = new RegExp(wrong, 'gi');
      corrected = corrected.replace(regex, right);
    }
    for (const [abbr, full] of Object.entries(MEDICAL_ABBREVIATIONS)) {
      const regex = new RegExp(`\\b${abbr}\\b`, 'gi');
      corrected = corrected.replace(regex, full);
    }
    return corrected;
  }

  // Format dictated text with proper punctuation and structure
  formatDictatedText(text: string): string {
    let formatted = text;
    formatted = formatted.replace(/(^\s*\w|[.!?]\s*\w)/g, (c) => c.toUpperCase());
    const headers = ['Impression', 'Plan', 'Assessment', 'Diagnosis', 'History', 'Examination', 'Findings'];
    headers.forEach(header => {
      const regex = new RegExp(`(${header})\\s*:?\\s*`, 'gi');
      formatted = formatted.replace(regex, `\n\n${header}:\n`);
    });
    formatted = formatted.replace(/vital signs/gi, '\n\nVital Signs:\n');
    formatted = formatted.replace(/\b(dash|bullet)\s*/gi, '\n• ');
    const transitions = ['however', 'therefore', 'additionally', 'furthermore', 'moreover'];
    transitions.forEach(word => {
      const regex = new RegExp(`\\b${word}\\b`, 'gi');
      formatted = formatted.replace(regex, `${word},`);
    });
    formatted = formatted.replace(/\n{3,}/g, '\n\n').trim();
    return formatted;
  }

  // Process punctuation commands
  processPunctuationCommands(text: string): string {
    return text
      .replace(/\bperiod\b/gi, '.')
      .replace(/\bfull stop\b/gi, '.')
      .replace(/\bcomma\b/gi, ',')
      .replace(/\bquestion mark\b/gi, '?')
      .replace(/\bexclamation mark\b/gi, '!')
      .replace(/\bcolon\b/gi, ':')
      .replace(/\bsemicolon\b/gi, ';')
      .replace(/\bnew line\b/gi, '\n')
      .replace(/\bnew paragraph\b/gi, '\n\n')
      .replace(/\bopen parenthesis\b/gi, '(')
      .replace(/\bclose parenthesis\b/gi, ')')
      .replace(/\bhyphen\b/gi, '-')
      .replace(/\bslash\b/gi, '/');
  }
}

export const speechToTextService = new SpeechToTextService();
