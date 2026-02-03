/**
 * Speech-to-Text Service for Medical Dictation
 * Uses Web Speech API with medical terminology support
 */

export interface SpeechRecognitionResult {
  transcript: string;
  confidence: number;
  isFinal: boolean;
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
  'keloid': 'keloid',
  'hyper trophic': 'hypertrophic',
  
  // Anatomy
  'sub cutaneous': 'subcutaneous',
  'intra muscular': 'intramuscular',
  'intra venous': 'intravenous',
  'epi dermal': 'epidermal',
  'dermal': 'dermal',
  
  // Medications
  'lidocaine': 'lidocaine',
  'epi nephrine': 'epinephrine',
  'ceftriaxone': 'ceftriaxone',
  'metro nidazole': 'metronidazole',
  'ampicillin': 'ampicillin',
  'gentamicin': 'gentamicin',
  'tramadol': 'tramadol',
  'paracetamol': 'paracetamol',
  'diclofenac': 'diclofenac',
  
  // Lab values
  'hemoglobin': 'hemoglobin',
  'hemo globin': 'hemoglobin',
  'white blood cell': 'WBC',
  'red blood cell': 'RBC',
  'platelet': 'platelet',
  'creatinine': 'creatinine',
  'electro lytes': 'electrolytes',
  
  // Common phrases
  'patient is': 'Patient is',
  'impression': 'Impression',
  'plan': 'Plan',
  'assessment': 'Assessment',
  'vital signs': 'Vital signs',
  'wound is': 'Wound is',
  'no signs of': 'No signs of',
  'signs of': 'Signs of'
};

// Medical abbreviation expansions
const MEDICAL_ABBREVIATIONS: Record<string, string> = {
  'bp': 'BP',
  'hr': 'HR',
  'rr': 'RR',
  'spo2': 'SpO2',
  'temp': 'Temperature',
  'iv': 'IV',
  'im': 'IM',
  'po': 'PO',
  'bid': 'BD',
  'tid': 'TDS',
  'qid': 'QDS',
  'prn': 'PRN',
  'stat': 'STAT',
  'npo': 'NPO',
  'uo': 'Urine output',
  'sob': 'SOB',
  'nkda': 'NKDA',
  'wbc': 'WBC',
  'rbc': 'RBC',
  'hgb': 'Hgb',
  'hct': 'Hct',
  'plt': 'Platelets',
  'bun': 'BUN',
  'cr': 'Creatinine',
  'na': 'Na+',
  'k': 'K+',
  'cl': 'Cl-',
  'co2': 'CO2',
  'ast': 'AST',
  'alt': 'ALT',
  'inr': 'INR',
  'ptt': 'PTT'
};

class SpeechToTextService {
  private recognition: any = null;
  private isListening: boolean = false;
  private currentTranscript: string = '';
  private finalizedTranscript: string = '';  // Track what's been finalized
  private lastFinalIndex: number = 0;        // Track last finalized result index
  private options: SpeechToTextOptions = {};
  private sessionId: number = 0;             // Track unique session

  constructor() {
    this.initializeRecognition();
  }

  private initializeRecognition(): void {
    // Check for browser support
    const SpeechRecognition = (window as any).SpeechRecognition || 
                              (window as any).webkitSpeechRecognition;

    if (!SpeechRecognition) {
      console.warn('Speech Recognition not supported in this browser');
      return;
    }

    this.recognition = new SpeechRecognition();
  }

  // Check if speech recognition is supported
  isSupported(): boolean {
    return this.recognition !== null;
  }

  // Start listening
  startListening(options: SpeechToTextOptions = {}): boolean {
    if (!this.recognition) {
      options.onError?.('Speech recognition not supported');
      return false;
    }

    if (this.isListening) {
      return false;
    }

    this.options = options;
    this.currentTranscript = '';
    this.finalizedTranscript = '';
    this.lastFinalIndex = 0;
    this.sessionId = Date.now();

    // Configure recognition
    this.recognition.lang = options.language || 'en-US';
    this.recognition.continuous = options.continuous ?? true;
    this.recognition.interimResults = options.interimResults ?? true;
    this.recognition.maxAlternatives = options.maxAlternatives ?? 1;

    // Set up event handlers
    this.recognition.onstart = () => {
      this.isListening = true;
      console.log('🎤 Speech recognition started (session:', this.sessionId, ')');
      this.options.onStart?.();
    };

    this.recognition.onresult = (event: any) => {
      // Build the complete transcript from all results
      let fullTranscript = '';
      let currentInterim = '';
      
      // Process all results from the beginning to ensure we don't lose anything
      for (let i = 0; i < event.results.length; i++) {
        const result = event.results[i];
        const transcript = result[0].transcript;
        
        if (result.isFinal) {
          // Add finalized text with medical corrections
          fullTranscript += this.correctMedicalTerms(transcript);
        } else {
          // Current interim (only the latest non-final)
          currentInterim = transcript;
        }
      }
      
      // Store the finalized transcript
      this.finalizedTranscript = fullTranscript;
      this.currentTranscript = fullTranscript + (currentInterim ? ' ' + currentInterim : '');
      
      // Send the result
      // For isFinal, send the complete finalized transcript
      // For interim, send what's being spoken now
      const latestResult = event.results[event.results.length - 1];
      const isFinal = latestResult.isFinal;
      
      this.options.onResult?.({
        transcript: isFinal ? this.finalizedTranscript : this.currentTranscript,
        confidence: latestResult[0].confidence || 0.9,
        isFinal: isFinal
      });
    };

    this.recognition.onerror = (event: any) => {
      console.error('Speech recognition error:', event.error);
      this.options.onError?.(event.error);
      
      if (event.error === 'no-speech') {
        // Auto restart on no-speech if continuous
        if (this.options.continuous && this.isListening) {
          setTimeout(() => this.recognition?.start(), 100);
        }
      }
    };

    this.recognition.onend = () => {
      console.log('🎤 Speech recognition ended');
      
      // Auto restart if continuous mode
      if (this.options.continuous && this.isListening) {
        setTimeout(() => {
          try {
            this.recognition?.start();
          } catch (e) {
            this.isListening = false;
            this.options.onEnd?.();
          }
        }, 100);
      } else {
        this.isListening = false;
        this.options.onEnd?.();
      }
    };

    try {
      this.recognition.start();
      return true;
    } catch (error) {
      console.error('Failed to start recognition:', error);
      this.options.onError?.('Failed to start recognition');
      return false;
    }
  }

  // Stop listening
  stopListening(): string {
    if (this.recognition && this.isListening) {
      this.isListening = false;
      this.recognition.stop();
      console.log('🎤 Speech recognition stopped');
    }
    return this.currentTranscript;
  }

  // Get current transcript
  getTranscript(): string {
    return this.currentTranscript;
  }

  // Clear transcript
  clearTranscript(): void {
    this.currentTranscript = '';
  }

  // Check if currently listening
  getIsListening(): boolean {
    return this.isListening;
  }

  // Correct common medical misrecognitions
  private correctMedicalTerms(text: string): string {
    let corrected = text;

    // Apply corrections
    for (const [wrong, right] of Object.entries(MEDICAL_CORRECTIONS)) {
      const regex = new RegExp(wrong, 'gi');
      corrected = corrected.replace(regex, right);
    }

    // Expand abbreviations when spoken
    for (const [abbr, full] of Object.entries(MEDICAL_ABBREVIATIONS)) {
      // Only expand if it's a standalone word
      const regex = new RegExp(`\\b${abbr}\\b`, 'gi');
      corrected = corrected.replace(regex, full);
    }

    return corrected;
  }

  // Format dictated text with proper punctuation and structure
  formatDictatedText(text: string): string {
    let formatted = text;

    // Capitalize first letter of sentences
    formatted = formatted.replace(/(^\s*\w|[.!?]\s*\w)/g, (c) => c.toUpperCase());

    // Add periods after common medical section headers
    const headers = ['Impression', 'Plan', 'Assessment', 'Diagnosis', 'History', 'Examination', 'Findings'];
    headers.forEach(header => {
      const regex = new RegExp(`(${header})\\s*:?\\s*`, 'gi');
      formatted = formatted.replace(regex, `\n\n${header}:\n`);
    });

    // Format vital signs
    formatted = formatted.replace(/vital signs/gi, '\n\nVital Signs:\n');

    // Format bullet points when "dash" or "bullet" is spoken
    formatted = formatted.replace(/\b(dash|bullet)\s*/gi, '\n• ');

    // Add comma after common transition words
    const transitions = ['however', 'therefore', 'additionally', 'furthermore', 'moreover'];
    transitions.forEach(word => {
      const regex = new RegExp(`\\b${word}\\b`, 'gi');
      formatted = formatted.replace(regex, `${word},`);
    });

    // Clean up extra whitespace
    formatted = formatted.replace(/\n{3,}/g, '\n\n');
    formatted = formatted.trim();

    return formatted;
  }

  // Add punctuation commands processing
  processPunctuationCommands(text: string): string {
    return text
      .replace(/\bperiod\b/gi, '.')
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
