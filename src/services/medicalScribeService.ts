/**
 * Medical Scribe Service
 * 
 * AI-powered medical scribe for ward rounds and patient reviews.
 * Records speech, transcribes in real-time, structures into SOAP notes,
 * extracts vitals/medications/orders, and auto-populates ward round forms.
 */

import { speechToTextService } from './speechToTextService';
import { aiTextEnhancementService } from './aiTextEnhancementService';
import { db } from '../db/database';

// ─── Types ────────────────────────────────────────────────────────────────────

export type ScribeSessionStatus = 'recording' | 'processing' | 'review' | 'finalized' | 'discarded';
export type ScribeContext = 'ward_round' | 'patient_review' | 'consultation' | 'procedure_note' | 'admission';
export type NoteSection = 'subjective' | 'objective' | 'assessment' | 'plan' | 'vitals' | 'orders' | 'medications' | 'wounds';

export interface ExtractedVitals {
  temperature?: number;
  pulse?: number;
  bp_systolic?: number;
  bp_diastolic?: number;
  respiratory_rate?: number;
  spo2?: number;
  pain_score?: number;
}

export interface ExtractedMedication {
  name: string;
  dose?: string;
  route?: string;
  frequency?: string;
  action: 'continue' | 'start' | 'stop' | 'modify';
  notes?: string;
}

export interface ExtractedOrder {
  type: 'lab' | 'imaging' | 'consultation' | 'procedure' | 'nursing' | 'other';
  description: string;
  priority: 'routine' | 'urgent' | 'stat';
  notes?: string;
}

export interface ExtractedWoundAssessment {
  location: string;
  description: string;
  size?: string;
  drainage?: string;
  dressing_change?: boolean;
  notes?: string;
}

export interface StructuredNote {
  subjective: string;       // Patient's complaints, history, symptoms
  objective: string;        // Clinical findings, exam, vitals narrative
  assessment: string;       // Diagnosis, clinical impression
  plan: string;             // Treatment plan, follow-up
  vitals: ExtractedVitals;
  medications: ExtractedMedication[];
  orders: ExtractedOrder[];
  wounds: ExtractedWoundAssessment[];
  discharge_planning?: string;
  complications?: string;
  progress_status: 'improved' | 'stable' | 'deteriorating' | 'critical';
  raw_transcript: string;
  confidence: number;
}

export interface ScribeSession {
  id: string;
  patient_id: string;
  patient_name: string;
  hospital_number: string;
  context: ScribeContext;
  status: ScribeSessionStatus;
  round_type?: string;
  
  // Recording
  started_at: Date;
  ended_at?: Date;
  duration_seconds: number;
  
  // Transcription
  raw_transcript: string;
  transcript_segments: TranscriptSegment[];
  
  // AI-Structured output
  structured_note?: StructuredNote;
  
  // Ward round linkage
  ward_round_id?: string;
  
  // User
  recorded_by: string;
  recorded_by_role: string;
  
  // Audit
  ai_processed: boolean;
  ai_model_used?: string;
  edits_made: number;
  finalized_by?: string;
  finalized_at?: Date;
  
  created_at: Date;
  updated_at: Date;
}

export interface TranscriptSegment {
  id: string;
  text: string;
  timestamp: number;  // seconds from start
  confidence: number;
  is_final: boolean;
  speaker?: string;   // If speaker diarization available
  section_hint?: NoteSection;
}

export interface ScribeTemplate {
  id: string;
  name: string;
  context: ScribeContext;
  sections: {
    name: string;
    prompt_hint: string;
    required: boolean;
  }[];
  default_for_round_type?: string;
}

// ─── Default Templates ────────────────────────────────────────────────────────

const DEFAULT_TEMPLATES: ScribeTemplate[] = [
  {
    id: 'ward_round_standard',
    name: 'Standard Ward Round',
    context: 'ward_round',
    sections: [
      { name: 'Chief Complaint/Interval History', prompt_hint: 'What the patient reports since last review', required: true },
      { name: 'Vital Signs', prompt_hint: 'Temperature, pulse, BP, RR, SpO2', required: true },
      { name: 'Examination Findings', prompt_hint: 'General appearance, systemic examination, wound status', required: true },
      { name: 'Lab Review', prompt_hint: 'Recent lab results and their significance', required: false },
      { name: 'Assessment', prompt_hint: 'Clinical impression, diagnosis update', required: true },
      { name: 'Plan', prompt_hint: 'Medications, orders, procedures, follow-up', required: true },
      { name: 'Wound Care', prompt_hint: 'Wound assessment and dressing plan', required: false },
      { name: 'Discharge Planning', prompt_hint: 'Expected discharge date, criteria', required: false },
    ],
    default_for_round_type: 'house_officers_round'
  },
  {
    id: 'consultant_round',
    name: 'Consultant Ward Round',
    context: 'ward_round',
    sections: [
      { name: 'Presenting Complaint', prompt_hint: 'Primary reason for admission', required: true },
      { name: 'Progress Summary', prompt_hint: 'Brief summary of hospital course', required: true },
      { name: 'Current Status', prompt_hint: 'Vitals, examination, investigations', required: true },
      { name: 'Consultant Assessment', prompt_hint: 'Senior clinical impression', required: true },
      { name: 'Consultant Plan', prompt_hint: 'Treatment modifications, decisions', required: true },
      { name: 'Surgical Decision', prompt_hint: 'Operative plan, consent, scheduling', required: false },
      { name: 'Discharge Plan', prompt_hint: 'Estimated discharge, follow-up', required: false },
    ],
    default_for_round_type: 'consultants_round'
  },
  {
    id: 'patient_review',
    name: 'Patient Review',
    context: 'patient_review',
    sections: [
      { name: 'Review Reason', prompt_hint: 'Why this review was requested', required: true },
      { name: 'Subjective', prompt_hint: 'Patient symptoms and complaints', required: true },
      { name: 'Objective', prompt_hint: 'Examination and investigation findings', required: true },
      { name: 'Assessment', prompt_hint: 'Clinical impression', required: true },
      { name: 'Plan', prompt_hint: 'Actions taken and follow-up', required: true },
    ],
    default_for_round_type: undefined
  }
];

// ─── Medical Pattern Extraction ───────────────────────────────────────────────

const VITAL_PATTERNS = {
  temperature: [
    /temp(?:erature)?\s*(?:is|of|:)?\s*(\d{2}(?:\.\d)?)\s*(?:°?[cf]|degrees?)?/gi,
    /(\d{2}\.\d)\s*(?:°?[cf]|degrees?\s*(?:celsius|centigrade))/gi,
    /febrile\s+at\s+(\d{2}(?:\.\d)?)/gi,
    /afebrile\s+at\s+(\d{2}(?:\.\d)?)/gi,
  ],
  pulse: [
    /(?:pulse|hr|heart\s*rate)\s*(?:is|of|:)?\s*(\d{2,3})\s*(?:bpm|beats?\s*per\s*min)?/gi,
    /(\d{2,3})\s*(?:bpm|beats?\s*per\s*min)/gi,
  ],
  bp: [
    /(?:bp|blood\s*pressure)\s*(?:is|of|:)?\s*(\d{2,3})\s*(?:over|\/|on)\s*(\d{2,3})/gi,
    /(\d{2,3})\s*\/\s*(\d{2,3})\s*(?:mm\s*hg|mmhg)?/gi,
  ],
  respiratory_rate: [
    /(?:rr|resp(?:iratory)?\s*rate)\s*(?:is|of|:)?\s*(\d{1,2})\s*(?:bpm|breaths?)?/gi,
    /(?:resp(?:irations?)?\s*(?:is|of|:)?\s*)(\d{1,2})/gi,
  ],
  spo2: [
    /(?:spo2|sats?|oxygen\s*sat(?:uration)?)\s*(?:is|of|:)?\s*(\d{2,3})\s*%?/gi,
    /(\d{2,3})\s*%\s*(?:on\s*(?:room\s*air|ra|nasal|mask|o2))/gi,
  ],
  pain_score: [
    /pain\s*(?:score|level|rating)?\s*(?:is|of|:)?\s*(\d{1,2})\s*(?:out\s*of\s*10|\/\s*10)?/gi,
  ],
};

const MEDICATION_PATTERNS = [
  // "start IV ceftriaxone 1g BD"
  /(?:start|commence|begin|give|administer)\s+(?:(IV|IM|PO|SC|oral|topical)\s+)?(\w+(?:\s+\w+)?)\s+(\d+\s*(?:mg|g|ml|mcg|units?))\s*(?:(OD|BD|TDS|QDS|QID|PRN|STAT|nocte|daily|twice\s+daily))?/gi,
  // "continue metronidazole"
  /(?:continue|maintain|keep)\s+(?:(?:IV|IM|PO|SC|oral)\s+)?(\w+(?:\s+\w+)?)/gi,
  // "stop tramadol"
  /(?:stop|discontinue|d\/c|dc|hold|withhold)\s+(\w+(?:\s+\w+)?)/gi,
  // "change dose of X to Y"
  /(?:change|modify|increase|decrease|reduce|uptitrate|titrate)\s+(?:dose\s+of\s+)?(\w+(?:\s+\w+)?)\s+to\s+(\d+\s*(?:mg|g|ml|mcg|units?))/gi,
];

const ORDER_PATTERNS = [
  // Lab orders
  /(?:order|request|send|check|repeat)\s+(?:an?\s+)?(?:urgent\s+|stat\s+)?(FBC|CBC|U&E|UEC|LFT|CRP|ESR|PT|INR|APTT|blood\s*culture|blood\s*sugar|RBS|FBS|HbA1c|ABG|VBG|troponin|d-dimer|lipase|amylase|urinalysis|urine\s*(?:m\/c\/s|culture)|serum\s*(?:\w+)|electrolytes?|clotting|cross\s*match|group\s*and\s*save)/gi,
  // Imaging
  /(?:order|request|book|arrange)\s+(?:an?\s+)?(?:urgent\s+|stat\s+)?(x[\s-]*ray|xray|CT\s*scan|MRI|ultrasound|USS|echo|echocardiogram|doppler)/gi,
  // Consultation
  /(?:refer|consult|call|page|invite)\s+(?:the\s+)?(\w+(?:\s+\w+)?)\s+(?:team|surgeon|consultant|doctor|specialist)/gi,
  // Nursing
  /(?:nurse|nursing)\s+(?:to\s+)?(?:monitor|observe|check|measure|record|chart|track)\s+(.+?)(?:\.|$)/gi,
];

const PROGRESS_PATTERNS = {
  improved: /(?:improv(?:ed|ing)|better|progressing\s*well|good\s*progress|recovering|well|doing\s*well)/gi,
  stable: /(?:stable|no\s*change|unchanged|same|maintained|holding|steady)/gi,
  deteriorating: /(?:deterior(?:ated|ating|ation)|wors(?:e|ened|ening)|declin(?:e|ed|ing)|not\s*improving|going\s*down)/gi,
  critical: /(?:critical|unstable|emergency|crash|arrest|shock|septic|coding)/gi,
};

// ─── Service Class ────────────────────────────────────────────────────────────

class MedicalScribeService {
  private currentSession: ScribeSession | null = null;
  private recordingStartTime: number = 0;
  private segmentCounter: number = 0;
  private onTranscriptUpdate: ((session: ScribeSession) => void) | null = null;
  private onStatusChange: ((status: ScribeSessionStatus) => void) | null = null;
  private processingTimeout: ReturnType<typeof setTimeout> | null = null;

  // ─── Session Management ─────────────────────────────────────────────

  /**
   * Start a new scribe session for a patient
   */
  startSession(params: {
    patient_id: string;
    patient_name: string;
    hospital_number: string;
    context: ScribeContext;
    round_type?: string;
    recorded_by: string;
    recorded_by_role: string;
    ward_round_id?: string;
    onTranscriptUpdate?: (session: ScribeSession) => void;
    onStatusChange?: (status: ScribeSessionStatus) => void;
  }): ScribeSession {
    // End any existing session
    if (this.currentSession?.status === 'recording') {
      this.stopRecording();
    }

    const session: ScribeSession = {
      id: `scribe_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`,
      patient_id: params.patient_id,
      patient_name: params.patient_name,
      hospital_number: params.hospital_number,
      context: params.context,
      status: 'recording',
      round_type: params.round_type,
      started_at: new Date(),
      duration_seconds: 0,
      raw_transcript: '',
      transcript_segments: [],
      ward_round_id: params.ward_round_id,
      recorded_by: params.recorded_by,
      recorded_by_role: params.recorded_by_role,
      ai_processed: false,
      edits_made: 0,
      created_at: new Date(),
      updated_at: new Date(),
    };

    this.currentSession = session;
    this.recordingStartTime = Date.now();
    this.segmentCounter = 0;
    this.onTranscriptUpdate = params.onTranscriptUpdate || null;
    this.onStatusChange = params.onStatusChange || null;

    // Start speech recognition
    this.startSpeechRecognition();

    return session;
  }

  /**
   * Start speech recognition and accumulate transcript
   */
  private startSpeechRecognition(): void {
    const started = speechToTextService.startListening({
      language: 'en-US',
      continuous: true,
      interimResults: true,
      onResult: (result) => {
        if (!this.currentSession) return;

        const segment: TranscriptSegment = {
          id: `seg_${++this.segmentCounter}`,
          text: result.transcript,
          timestamp: (Date.now() - this.recordingStartTime) / 1000,
          confidence: result.confidence,
          is_final: result.isFinal,
          section_hint: this.inferSection(result.transcript),
        };

        if (result.isFinal) {
          this.currentSession.transcript_segments.push(segment);
          this.currentSession.raw_transcript = result.fullTranscript;
        }

        this.currentSession.duration_seconds = (Date.now() - this.recordingStartTime) / 1000;
        this.currentSession.updated_at = new Date();
        this.onTranscriptUpdate?.(this.currentSession);
      },
      onError: (error) => {
        console.error('Scribe speech error:', error);
      },
      onStart: () => {
        this.onStatusChange?.('recording');
      },
      onEnd: () => {
        // Auto stopped by browser, will auto-restart from speechToTextService
      },
    });

    if (!started) {
      console.warn('Failed to start speech recognition for scribe');
    }
  }

  /**
   * Infer which SOAP section a transcript segment belongs to
   */
  private inferSection(text: string): NoteSection | undefined {
    const lower = text.toLowerCase();
    
    // Vitals mentioned
    if (/temp|pulse|blood\s*pressure|bp\s|spo2|sats|respiratory\s*rate|heart\s*rate/i.test(lower)) {
      return 'vitals';
    }
    // Medication mentions
    if (/start|stop|continue|prescri|medic|tablet|capsule|antibiotic|analges|infusion|drip/i.test(lower)) {
      return 'medications';
    }
    // Orders
    if (/order|request|send|check|lab|blood\s*test|x[\s-]*ray|scan|refer|consult/i.test(lower)) {
      return 'orders';
    }
    // Wound
    if (/wound|dressing|flap|graft|suture|drain|necrosis|granulat|slough|debrid/i.test(lower)) {
      return 'wounds';
    }
    // Subjective (patient-reported)
    if (/patient\s*(?:says|reports|complains|feels|states)|pain|symptom|complaint|nausea|vomit|fever|sleep|appetite/i.test(lower)) {
      return 'subjective';
    }
    // Objective (examination)
    if (/on\s*exam|examin|inspect|palp|auscult|percuss|abdomen|chest|limb/i.test(lower)) {
      return 'objective';
    }
    // Plan
    if (/plan|discharge|follow[\s-]*up|review|next|will|should|arrange|book|schedule/i.test(lower)) {
      return 'plan';
    }
    // Assessment
    if (/diagnos|impression|assess|likely|suspect|differential|conclude/i.test(lower)) {
      return 'assessment';
    }

    return undefined;
  }

  /**
   * Stop recording and begin AI processing
   */
  async stopRecording(): Promise<ScribeSession | null> {
    if (!this.currentSession) return null;

    // Stop speech recognition
    speechToTextService.stopListening();

    // Get final transcript from service
    const finalTranscript = speechToTextService.getFullTranscript();
    if (finalTranscript) {
      this.currentSession.raw_transcript = finalTranscript;
    }

    this.currentSession.ended_at = new Date();
    this.currentSession.duration_seconds = (Date.now() - this.recordingStartTime) / 1000;
    this.currentSession.status = 'processing';
    this.onStatusChange?.('processing');

    // Process the transcript with AI
    try {
      const structured = await this.processTranscript(this.currentSession);
      this.currentSession.structured_note = structured;
      this.currentSession.ai_processed = true;
      this.currentSession.status = 'review';
      this.onStatusChange?.('review');
    } catch (error) {
      console.error('AI processing failed, using local extraction:', error);
      // Fallback to local NLP extraction
      this.currentSession.structured_note = this.extractStructuredNoteLocally(this.currentSession.raw_transcript);
      this.currentSession.ai_processed = false;
      this.currentSession.status = 'review';
      this.onStatusChange?.('review');
    }

    // Save to IndexedDB
    await this.saveSession(this.currentSession);

    return this.currentSession;
  }

  /**
   * Pause recording without processing
   */
  pauseRecording(): void {
    speechToTextService.stopListening();
  }

  /**
   * Resume recording
   */
  resumeRecording(): void {
    if (this.currentSession?.status === 'recording') {
      this.startSpeechRecognition();
    }
  }

  /**
   * Discard current session
   */
  discardSession(): void {
    if (this.currentSession) {
      speechToTextService.stopListening();
      this.currentSession.status = 'discarded';
      this.currentSession = null;
    }
    this.onTranscriptUpdate = null;
    this.onStatusChange = null;
  }

  /**
   * Get the current session
   */
  getCurrentSession(): ScribeSession | null {
    return this.currentSession;
  }

  // ─── AI Processing ─────────────────────────────────────────────────

  /**
   * Process transcript through AI to generate structured SOAP note
   */
  private async processTranscript(session: ScribeSession): Promise<StructuredNote> {
    const transcript = session.raw_transcript;
    
    if (!transcript.trim()) {
      return this.getEmptyStructuredNote(transcript);
    }

    // Try AI-powered enhancement first
    try {
      const response = await fetch('/api/ai/scribe-process', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('authToken')}`
        },
        body: JSON.stringify({
          transcript,
          context: session.context,
          round_type: session.round_type,
          patient_name: session.patient_name,
          template: this.getTemplateForContext(session.context, session.round_type),
        })
      });

      if (response.ok) {
        const data = await response.json();
        if (data.structured_note) {
          // Merge AI result with local extraction for vitals (more reliable)
          const localVitals = this.extractVitals(transcript);
          return {
            ...data.structured_note,
            vitals: {
              ...data.structured_note.vitals,
              ...localVitals, // Local regex is more reliable for vitals
            },
            raw_transcript: transcript,
            confidence: data.confidence || 0.85,
          };
        }
      }
    } catch (err) {
      console.warn('AI scribe processing unavailable, falling back to local extraction');
    }

    // Fallback: local extraction
    return this.extractStructuredNoteLocally(transcript);
  }

  /**
   * Extract structured note using local NLP patterns (no AI needed)
   */
  extractStructuredNoteLocally(transcript: string): StructuredNote {
    if (!transcript.trim()) {
      return this.getEmptyStructuredNote(transcript);
    }

    const vitals = this.extractVitals(transcript);
    const medications = this.extractMedications(transcript);
    const orders = this.extractOrders(transcript);
    const wounds = this.extractWoundAssessments(transcript);
    const progressStatus = this.detectProgressStatus(transcript);

    // Section classification using segment hints
    const segments = this.currentSession?.transcript_segments || [];
    
    // Simple section extraction from transcript text
    const sections = this.classifySections(transcript);

    return {
      subjective: sections.subjective || this.extractByKeywords(transcript, [
        'patient complains', 'patient says', 'patient reports', 'states that',
        'feels', 'symptoms include', 'pain', 'appetite', 'sleep', 'nausea',
        'complaining of', 'chief complaint', 'presenting complaint'
      ]),
      objective: sections.objective || this.extractByKeywords(transcript, [
        'on examination', 'examination reveals', 'inspection shows', 'findings',
        'auscultation', 'palpation', 'abdomen', 'chest', 'limbs',
        'alert', 'oriented', 'conscious', 'general appearance'
      ]),
      assessment: sections.assessment || this.extractByKeywords(transcript, [
        'assessment', 'impression', 'diagnosis', 'likely', 'suspect',
        'differential', 'consistent with', 'conclusion', 'clinical impression'
      ]),
      plan: sections.plan || this.extractByKeywords(transcript, [
        'plan', 'will', 'to', 'for', 'arrange', 'schedule', 'book',
        'discharge', 'follow up', 'review', 'next', 'continue',
        'start', 'stop', 'order', 'refer'
      ]),
      vitals,
      medications,
      orders,
      wounds,
      discharge_planning: this.extractByKeywords(transcript, [
        'discharge', 'going home', 'ready for discharge', 'discharge date',
        'discharge criteria', 'follow up appointment'
      ]) || undefined,
      complications: this.extractByKeywords(transcript, [
        'complication', 'concern', 'problem', 'issue', 'deteriorat',
        'infection', 'seroma', 'hematoma', 'dehiscence', 'necrosis'
      ]) || undefined,
      progress_status: progressStatus,
      raw_transcript: transcript,
      confidence: 0.65,
    };
  }

  /**
   * Extract vitals from transcript using regex patterns
   */
  private extractVitals(text: string): ExtractedVitals {
    const vitals: ExtractedVitals = {};

    // Temperature
    for (const pattern of VITAL_PATTERNS.temperature) {
      const match = pattern.exec(text);
      if (match) {
        const temp = parseFloat(match[1]);
        if (temp >= 35 && temp <= 42) vitals.temperature = temp;
        pattern.lastIndex = 0;
        break;
      }
      pattern.lastIndex = 0;
    }

    // Pulse
    for (const pattern of VITAL_PATTERNS.pulse) {
      const match = pattern.exec(text);
      if (match) {
        const pulse = parseInt(match[1]);
        if (pulse >= 30 && pulse <= 250) vitals.pulse = pulse;
        pattern.lastIndex = 0;
        break;
      }
      pattern.lastIndex = 0;
    }

    // Blood Pressure
    for (const pattern of VITAL_PATTERNS.bp) {
      const match = pattern.exec(text);
      if (match) {
        const sys = parseInt(match[1]);
        const dia = parseInt(match[2]);
        if (sys >= 50 && sys <= 300 && dia >= 20 && dia <= 200) {
          vitals.bp_systolic = sys;
          vitals.bp_diastolic = dia;
        }
        pattern.lastIndex = 0;
        break;
      }
      pattern.lastIndex = 0;
    }

    // Respiratory Rate
    for (const pattern of VITAL_PATTERNS.respiratory_rate) {
      const match = pattern.exec(text);
      if (match) {
        const rr = parseInt(match[1]);
        if (rr >= 5 && rr <= 60) vitals.respiratory_rate = rr;
        pattern.lastIndex = 0;
        break;
      }
      pattern.lastIndex = 0;
    }

    // SpO2
    for (const pattern of VITAL_PATTERNS.spo2) {
      const match = pattern.exec(text);
      if (match) {
        const spo2 = parseInt(match[1]);
        if (spo2 >= 50 && spo2 <= 100) vitals.spo2 = spo2;
        pattern.lastIndex = 0;
        break;
      }
      pattern.lastIndex = 0;
    }

    // Pain Score
    for (const pattern of VITAL_PATTERNS.pain_score) {
      const match = pattern.exec(text);
      if (match) {
        const pain = parseInt(match[1]);
        if (pain >= 0 && pain <= 10) vitals.pain_score = pain;
        pattern.lastIndex = 0;
        break;
      }
      pattern.lastIndex = 0;
    }

    return vitals;
  }

  /**
   * Extract medications from transcript
   */
  private extractMedications(text: string): ExtractedMedication[] {
    const meds: ExtractedMedication[] = [];
    const seen = new Set<string>();

    // Start patterns
    const startPattern = /(?:start|commence|begin|give|administer)\s+(?:(IV|IM|PO|SC|oral|topical)\s+)?(\w+(?:\s+\w+)?)\s*(\d+\s*(?:mg|g|ml|mcg|units?))?\s*(?:(OD|BD|TDS|QDS|QID|PRN|STAT|nocte|daily|twice\s+daily))?/gi;
    let match;
    while ((match = startPattern.exec(text)) !== null) {
      const name = match[2]?.trim();
      if (name && !seen.has(name.toLowerCase())) {
        seen.add(name.toLowerCase());
        meds.push({
          name,
          route: match[1]?.toUpperCase() || undefined,
          dose: match[3]?.trim() || undefined,
          frequency: match[4]?.toUpperCase() || undefined,
          action: 'start',
        });
      }
    }

    // Continue patterns
    const continuePattern = /(?:continue|maintain|keep(?:\s+on)?)\s+(?:(?:IV|IM|PO|SC|oral)\s+)?(\w+(?:\s+\w+)?)/gi;
    while ((match = continuePattern.exec(text)) !== null) {
      const name = match[1]?.trim();
      if (name && !seen.has(name.toLowerCase()) && name.length > 2) {
        seen.add(name.toLowerCase());
        meds.push({ name, action: 'continue' });
      }
    }

    // Stop patterns
    const stopPattern = /(?:stop|discontinue|d\/c|dc|hold|withhold)\s+(\w+(?:\s+\w+)?)/gi;
    while ((match = stopPattern.exec(text)) !== null) {
      const name = match[1]?.trim();
      if (name && name.length > 2) {
        // Check if already in list, update action
        const existing = meds.find(m => m.name.toLowerCase() === name.toLowerCase());
        if (existing) {
          existing.action = 'stop';
        } else {
          seen.add(name.toLowerCase());
          meds.push({ name, action: 'stop' });
        }
      }
    }

    return meds;
  }

  /**
   * Extract orders from transcript
   */
  private extractOrders(text: string): ExtractedOrder[] {
    const orders: ExtractedOrder[] = [];
    const seen = new Set<string>();

    // Lab orders
    const labPattern = /(?:order|request|send|check|repeat)\s+(?:an?\s+)?(?:(urgent|stat)\s+)?(FBC|CBC|U&E|UEC|LFT|CRP|ESR|PT|INR|APTT|blood\s*culture|blood\s*sugar|RBS|FBS|HbA1c|ABG|VBG|troponin|d-dimer|lipase|amylase|urinalysis|urine\s*(?:m\/c\/s|culture)|serum\s*\w+|electrolytes?|clotting|cross\s*match|group\s*and\s*save)/gi;
    let match;
    while ((match = labPattern.exec(text)) !== null) {
      const desc = match[2]?.trim().toUpperCase();
      if (desc && !seen.has(desc)) {
        seen.add(desc);
        orders.push({
          type: 'lab',
          description: desc,
          priority: (match[1]?.toLowerCase() === 'stat' ? 'stat' : match[1]?.toLowerCase() === 'urgent' ? 'urgent' : 'routine') as 'routine' | 'urgent' | 'stat',
        });
      }
    }

    // Imaging orders
    const imagingPattern = /(?:order|request|book|arrange)\s+(?:an?\s+)?(?:(urgent|stat)\s+)?(x[\s-]*ray|xray|CT\s*scan|MRI|ultrasound|USS|echo|echocardiogram|doppler)/gi;
    while ((match = imagingPattern.exec(text)) !== null) {
      const desc = match[2]?.trim();
      if (desc && !seen.has(desc.toLowerCase())) {
        seen.add(desc.toLowerCase());
        orders.push({
          type: 'imaging',
          description: desc,
          priority: (match[1]?.toLowerCase() === 'stat' ? 'stat' : match[1]?.toLowerCase() === 'urgent' ? 'urgent' : 'routine') as 'routine' | 'urgent' | 'stat',
        });
      }
    }

    // Consultation orders
    const consultPattern = /(?:refer|consult|call|page|invite)\s+(?:the\s+)?(\w+(?:\s+\w+)?)\s+(?:team|surgeon|consultant|doctor|specialist)/gi;
    while ((match = consultPattern.exec(text)) !== null) {
      const specialty = match[1]?.trim();
      if (specialty && !seen.has(specialty.toLowerCase())) {
        seen.add(specialty.toLowerCase());
        orders.push({
          type: 'consultation',
          description: `Refer to ${specialty}`,
          priority: 'routine',
        });
      }
    }

    return orders;
  }

  /**
   * Extract wound assessments
   */
  private extractWoundAssessments(text: string): ExtractedWoundAssessment[] {
    const wounds: ExtractedWoundAssessment[] = [];

    // Look for wound-related sentences
    const woundSentences = text.split(/[.!?]/).filter(s =>
      /wound|flap|graft|surgical\s*site|incision|dressing|drain|ulcer|sore/i.test(s)
    );

    if (woundSentences.length > 0) {
      const combined = woundSentences.join('. ').trim();
      
      // Try to parse individual wound mentions
      const locationPattern = /(left|right|bilateral|anterior|posterior|medial|lateral)?\s*(arm|leg|hand|foot|thigh|abdomen|chest|face|scalp|back|buttock|sacral|heel|finger|toe|forearm|shin|calf|breast|axilla|groin|neck|flap|graft|donor\s*site)/gi;
      let locMatch;
      const locations: string[] = [];
      while ((locMatch = locationPattern.exec(combined)) !== null) {
        const loc = `${locMatch[1] || ''} ${locMatch[2]}`.trim();
        if (!locations.includes(loc)) locations.push(loc);
      }

      if (locations.length > 0) {
        locations.forEach(loc => {
          wounds.push({
            location: loc,
            description: combined,
            dressing_change: /dress(?:ing)?\s*(?:change|done|applied|renewed)/i.test(combined),
          });
        });
      } else {
        wounds.push({
          location: 'Site not specified',
          description: combined,
          dressing_change: /dress(?:ing)?\s*(?:change|done|applied|renewed)/i.test(combined),
        });
      }
    }

    return wounds;
  }

  /**
   * Detect overall progress status
   */
  private detectProgressStatus(text: string): 'improved' | 'stable' | 'deteriorating' | 'critical' {
    // Check in severity order
    if (PROGRESS_PATTERNS.critical.test(text)) {
      PROGRESS_PATTERNS.critical.lastIndex = 0;
      return 'critical';
    }
    if (PROGRESS_PATTERNS.deteriorating.test(text)) {
      PROGRESS_PATTERNS.deteriorating.lastIndex = 0;
      return 'deteriorating';
    }
    if (PROGRESS_PATTERNS.improved.test(text)) {
      PROGRESS_PATTERNS.improved.lastIndex = 0;
      return 'improved';
    }
    // Reset all
    Object.values(PROGRESS_PATTERNS).forEach(p => p.lastIndex = 0);
    return 'stable';
  }

  /**
   * Extract text near specified keywords
   */
  private extractByKeywords(text: string, keywords: string[]): string {
    const sentences = text.split(/[.!?]+/).map(s => s.trim()).filter(Boolean);
    const matched: string[] = [];

    for (const sentence of sentences) {
      const lower = sentence.toLowerCase();
      if (keywords.some(kw => lower.includes(kw.toLowerCase()))) {
        matched.push(sentence);
      }
    }

    return matched.join('. ').trim();
  }

  /**
   * Classify transcript text into SOAP sections 
   */
  private classifySections(text: string): Record<string, string> {
    const result: Record<string, string> = {};
    
    // Check for explicit section markers
    const sectionMarkers: [string, RegExp][] = [
      ['subjective', /(?:^|\n)\s*(?:subjective|S:|history|HPI|chief\s*complaint|CC)[\s:]+/im],
      ['objective', /(?:^|\n)\s*(?:objective|O:|examination|physical\s*exam|PE|on\s*exam)[\s:]+/im],
      ['assessment', /(?:^|\n)\s*(?:assessment|A:|impression|diagnosis|Dx)[\s:]+/im],
      ['plan', /(?:^|\n)\s*(?:plan|P:|management|Mx|treatment\s*plan)[\s:]+/im],
    ];

    let remaining = text;
    const sectionPositions: { section: string; start: number; text: string }[] = [];

    for (const [section, pattern] of sectionMarkers) {
      const match = pattern.exec(text);
      if (match) {
        sectionPositions.push({
          section,
          start: match.index + match[0].length,
          text: ''
        });
      }
    }

    // Sort by position and extract text between markers
    sectionPositions.sort((a, b) => a.start - b.start);
    for (let i = 0; i < sectionPositions.length; i++) {
      const end = i + 1 < sectionPositions.length ? sectionPositions[i + 1].start : text.length;
      sectionPositions[i].text = text.substring(sectionPositions[i].start, end).trim();
      result[sectionPositions[i].section] = sectionPositions[i].text;
    }

    return result;
  }

  /**
   * Get empty structured note
   */
  private getEmptyStructuredNote(transcript: string): StructuredNote {
    return {
      subjective: '',
      objective: '',
      assessment: '',
      plan: '',
      vitals: {},
      medications: [],
      orders: [],
      wounds: [],
      progress_status: 'stable',
      raw_transcript: transcript,
      confidence: 0,
    };
  }

  // ─── Template Management ────────────────────────────────────────────

  getTemplates(): ScribeTemplate[] {
    return DEFAULT_TEMPLATES;
  }

  getTemplateForContext(context: ScribeContext, roundType?: string): ScribeTemplate | undefined {
    if (roundType) {
      const byRoundType = DEFAULT_TEMPLATES.find(t => t.default_for_round_type === roundType);
      if (byRoundType) return byRoundType;
    }
    return DEFAULT_TEMPLATES.find(t => t.context === context);
  }

  // ─── Ward Round Integration ─────────────────────────────────────────

  /**
   * Convert structured note to WardRound form data that can populate the form
   */
  toWardRoundFormData(note: StructuredNote): Record<string, any> {
    const formData: Record<string, any> = {};

    // Clinical text fields
    if (note.subjective) {
      formData.chief_complaint = note.subjective;
    }
    if (note.objective) {
      formData.examination_findings = note.objective;
    }
    if (note.assessment) {
      formData.clinical_notes = note.assessment;
    }
    if (note.plan) {
      formData.follow_up_plan = note.plan;
    }

    // Vitals
    if (note.vitals.temperature) formData.temperature = String(note.vitals.temperature);
    if (note.vitals.pulse) formData.pulse = String(note.vitals.pulse);
    if (note.vitals.bp_systolic && note.vitals.bp_diastolic) {
      formData.blood_pressure = `${note.vitals.bp_systolic}/${note.vitals.bp_diastolic}`;
    }
    if (note.vitals.respiratory_rate) formData.respiratory_rate = String(note.vitals.respiratory_rate);
    if (note.vitals.spo2) formData.spo2 = String(note.vitals.spo2);
    if (note.vitals.pain_score !== undefined) formData.pain_score = note.vitals.pain_score;

    // Progress status
    formData.progress_status = note.progress_status;

    // Medication changes
    const medChanges = note.medications.filter(m => m.action !== 'continue');
    if (medChanges.length > 0) {
      formData.medications_changed = true;
      formData.medication_changes = medChanges.map(m =>
        `${m.action.toUpperCase()}: ${m.name}${m.dose ? ` ${m.dose}` : ''}${m.route ? ` ${m.route}` : ''}${m.frequency ? ` ${m.frequency}` : ''}`
      ).join('\n');
    }

    // Orders
    if (note.orders.length > 0) {
      formData.new_orders = note.orders.map(o =>
        `[${o.type.toUpperCase()}${o.priority !== 'routine' ? ` - ${o.priority.toUpperCase()}` : ''}] ${o.description}`
      ).join('\n');

      // Lab review flags
      const hasLabOrders = note.orders.some(o => o.type === 'lab');
      if (hasLabOrders) {
        formData.recent_labs_reviewed = true;
        formData.lab_notes = note.orders.filter(o => o.type === 'lab').map(o => o.description).join(', ');
      }

      // Consultation flags
      const consultOrders = note.orders.filter(o => o.type === 'consultation');
      if (consultOrders.length > 0) {
        formData.consultation_requested = true;
        formData.consultation_specialty = consultOrders[0].description.replace('Refer to ', '');
        formData.consultation_reason = consultOrders.map(o => o.description).join('; ');
      }
    }

    // Wound assessment
    if (note.wounds.length > 0) {
      formData.wound_assessment_done = true;
      formData.wound_notes = note.wounds.map(w =>
        `${w.location}: ${w.description}${w.dressing_change ? ' (dressing changed)' : ''}`
      ).join('\n');
    }

    // Discharge planning
    if (note.discharge_planning) {
      formData.discharge_planning = note.discharge_planning;
    }

    // Complications
    if (note.complications) {
      formData.complications = note.complications;
    }

    return formData;
  }

  // ─── Persistence ────────────────────────────────────────────────────

  /**
   * Save session to IndexedDB
   */
  async saveSession(session: ScribeSession): Promise<void> {
    try {
      await db.table('scribe_sessions').put(session);
    } catch (error) {
      console.error('Error saving scribe session:', error);
      // Fallback: store in localStorage
      try {
        const sessions = JSON.parse(localStorage.getItem('scribe_sessions') || '[]');
        const idx = sessions.findIndex((s: any) => s.id === session.id);
        if (idx >= 0) sessions[idx] = session;
        else sessions.push(session);
        localStorage.setItem('scribe_sessions', JSON.stringify(sessions));
      } catch { /* ignore */ }
    }
  }

  /**
   * Get all scribe sessions for a patient
   */
  async getPatientSessions(patientId: string): Promise<ScribeSession[]> {
    try {
      const sessions = await db.table('scribe_sessions')
        .where('patient_id').equals(patientId)
        .reverse()
        .sortBy('created_at');
      return sessions;
    } catch {
      try {
        const all = JSON.parse(localStorage.getItem('scribe_sessions') || '[]');
        return all.filter((s: ScribeSession) => s.patient_id === patientId);
      } catch { return []; }
    }
  }

  /**
   * Get all scribe sessions 
   */
  async getAllSessions(limit: number = 50): Promise<ScribeSession[]> {
    try {
      const sessions = await db.table('scribe_sessions')
        .reverse()
        .limit(limit)
        .sortBy('created_at');
      return sessions;
    } catch {
      try {
        const all = JSON.parse(localStorage.getItem('scribe_sessions') || '[]');
        return all.slice(0, limit);
      } catch { return []; }
    }
  }

  /**
   * Get a specific session
   */
  async getSession(sessionId: string): Promise<ScribeSession | undefined> {
    try {
      return await db.table('scribe_sessions').get(sessionId);
    } catch {
      try {
        const all = JSON.parse(localStorage.getItem('scribe_sessions') || '[]');
        return all.find((s: ScribeSession) => s.id === sessionId);
      } catch { return undefined; }
    }
  }

  /**
   * Update a session's structured note (after user edits)
   */
  async updateStructuredNote(sessionId: string, note: StructuredNote): Promise<void> {
    const session = await this.getSession(sessionId);
    if (session) {
      session.structured_note = note;
      session.edits_made = (session.edits_made || 0) + 1;
      session.updated_at = new Date();
      await this.saveSession(session);
    }
  }

  /**
   * Finalize a session
   */
  async finalizeSession(sessionId: string, finalizedBy: string): Promise<void> {
    const session = await this.getSession(sessionId);
    if (session) {
      session.status = 'finalized';
      session.finalized_by = finalizedBy;
      session.finalized_at = new Date();
      session.updated_at = new Date();
      await this.saveSession(session);
      if (this.currentSession?.id === sessionId) {
        this.currentSession = null;
      }
    }
  }

  /**
   * Delete a session
   */
  async deleteSession(sessionId: string): Promise<void> {
    try {
      await db.table('scribe_sessions').delete(sessionId);
    } catch {
      try {
        const all = JSON.parse(localStorage.getItem('scribe_sessions') || '[]');
        localStorage.setItem('scribe_sessions', JSON.stringify(
          all.filter((s: ScribeSession) => s.id !== sessionId)
        ));
      } catch { /* ignore */ }
    }
  }

  // ─── AI Enhancement for Editing ─────────────────────────────────────

  /**
   * Enhance a specific section using AI
   */
  async enhanceSection(sectionText: string, sectionName: NoteSection): Promise<string> {
    try {
      const contextMap: Record<NoteSection, string> = {
        subjective: 'clinical_notes',
        objective: 'clinical_notes',
        assessment: 'clinical_notes',
        plan: 'clinical_notes',
        vitals: 'clinical_notes',
        orders: 'clinical_notes',
        medications: 'prescription',
        wounds: 'wound_assessment',
      };

      const result = await aiTextEnhancementService.enhanceText(sectionText, {
        context: contextMap[sectionName] as any,
        preserveNumbers: true,
        preserveMedications: true,
      });

      return result.enhancedText;
    } catch {
      return sectionText; // Return unchanged if AI fails
    }
  }
}

// Export singleton
export const medicalScribeService = new MedicalScribeService();
export default medicalScribeService;
