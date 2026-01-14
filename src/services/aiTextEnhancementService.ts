/**
 * AI Text Enhancement Service
 * Provides AI-powered text regeneration and improvement for dictated medical content
 */

// Medical text improvement prompts for different contexts
const CONTEXT_PROMPTS: Record<string, string> = {
  clinical_notes: `You are a medical documentation assistant. Improve the following clinical notes to be:
- Professionally written with proper medical terminology
- Well-structured with clear sections
- Concise yet comprehensive
- Following standard medical documentation format
Preserve all clinical information accurately. Do not add or remove medical facts.`,

  operative_notes: `You are a surgical documentation specialist. Format the following operative notes to:
- Follow standard operative report structure (Preoperative diagnosis, Procedure performed, Anesthesia, Findings, Description, etc.)
- Use appropriate surgical terminology
- Be detailed and precise
- Include all relevant surgical details
Maintain all procedural details exactly as described.`,

  discharge_summary: `You are a medical records specialist. Improve this discharge summary to:
- Follow standard discharge summary format
- Include admission diagnosis, hospital course, procedures, medications, and follow-up
- Be clear for patient handoff
- Use professional medical language
Preserve all clinical facts and timeline.`,

  progress_notes: `You are a clinical documentation specialist. Improve these progress notes to:
- Follow SOAP (Subjective, Objective, Assessment, Plan) format if applicable
- Be chronologically clear
- Include all relevant clinical updates
- Use appropriate medical terminology`,

  consultation_notes: `You are a specialist consultation documentation expert. Format these consultation notes to:
- Clearly state the reason for consultation
- Include relevant history and examination findings
- Provide clear impression and recommendations
- Be professionally formatted`,

  wound_assessment: `You are a wound care specialist. Improve this wound assessment to:
- Use standardized wound assessment terminology
- Include wound dimensions, appearance, drainage, and surrounding tissue
- Follow MEASURE or TIME framework
- Be objective and measurable`,

  prescription: `You are a pharmacy documentation specialist. Format this prescription to:
- Include drug name, dose, route, frequency clearly
- Add any necessary administration instructions
- Include duration of treatment
- Follow standard prescription format`,

  lab_interpretation: `You are a laboratory medicine specialist. Improve this lab interpretation to:
- Organize results by system or category
- Highlight abnormal values
- Provide clinical correlation where appropriate
- Be concise and clinically relevant`,

  imaging_report: `You are a radiology documentation specialist. Format this imaging report to:
- Follow standard radiology reporting structure
- Include technique, comparison, findings, and impression
- Use appropriate radiological terminology
- Be systematic in describing findings`,

  general: `You are a medical documentation specialist. Improve the following text to be:
- Professionally written
- Clear and well-organized
- Using appropriate medical terminology
- Grammatically correct and polished
Preserve all information accurately.`
};

export type TextContext = keyof typeof CONTEXT_PROMPTS;

export interface EnhanceTextOptions {
  context?: TextContext;
  preserveNumbers?: boolean;
  preserveMedications?: boolean;
  customInstructions?: string;
}

export interface EnhancementResult {
  enhancedText: string;
  originalText: string;
  confidence: number;
  changes: string[];
}

export interface SuggestionResult {
  suggestions: string[];
  category: string;
}

class AITextEnhancementService {
  private apiEndpoint: string;

  constructor() {
    // Use the existing AI endpoint from the backend
    this.apiEndpoint = import.meta.env.VITE_API_URL || '';
  }

  /**
   * Enhance dictated text using AI
   */
  async enhanceText(text: string, options: EnhanceTextOptions = {}): Promise<EnhancementResult> {
    const { context = 'general', preserveNumbers = true, preserveMedications = true, customInstructions } = options;

    // First, apply local improvements
    let processedText = this.applyLocalImprovements(text);

    // Prepare the prompt
    let systemPrompt = CONTEXT_PROMPTS[context] || CONTEXT_PROMPTS.general;
    
    if (preserveNumbers) {
      systemPrompt += '\n\nIMPORTANT: Preserve all numbers, measurements, and vital signs exactly as provided.';
    }
    
    if (preserveMedications) {
      systemPrompt += '\n\nIMPORTANT: Preserve all medication names and dosages exactly as provided.';
    }

    if (customInstructions) {
      systemPrompt += `\n\nAdditional instructions: ${customInstructions}`;
    }

    try {
      // Try to use the backend AI service
      const response = await fetch(`${this.apiEndpoint}/api/ai/enhance-text`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('authToken')}`
        },
        body: JSON.stringify({
          text: processedText,
          systemPrompt,
          context
        })
      });

      if (response.ok) {
        const data = await response.json();
        return {
          enhancedText: data.enhancedText || processedText,
          originalText: text,
          confidence: data.confidence || 0.9,
          changes: data.changes || ['Text enhanced by AI']
        };
      }
    } catch (error) {
      console.warn('AI enhancement service unavailable, using local processing:', error);
    }

    // Fallback to local-only processing
    const enhancedText = this.enhanceLocally(processedText, context);
    
    return {
      enhancedText,
      originalText: text,
      confidence: 0.7,
      changes: this.detectChanges(text, enhancedText)
    };
  }

  /**
   * Apply local text improvements without AI
   */
  private applyLocalImprovements(text: string): string {
    let improved = text;

    // Capitalize first letter of sentences
    improved = improved.replace(/(^|[.!?]\s+)([a-z])/g, (match, p1, p2) => p1 + p2.toUpperCase());

    // Fix common medical abbreviation formatting
    const abbreviationFixes: [RegExp, string][] = [
      [/\b(bp|BP)\b/g, 'BP'],
      [/\b(hr|HR)\b/g, 'HR'],
      [/\b(rr|RR)\b/g, 'RR'],
      [/\b(spo2|SpO2)\b/gi, 'SpO2'],
      [/\b(temp|Temp)\b/g, 'Temp'],
      [/\b(wbc|WBC)\b/gi, 'WBC'],
      [/\b(rbc|RBC)\b/gi, 'RBC'],
      [/\b(hb|Hb|HB)\b/g, 'Hb'],
      [/\b(mcv|MCV)\b/gi, 'MCV'],
      [/\b(mch|MCH)\b/gi, 'MCH'],
      [/\b(plt|PLT)\b/gi, 'Plt'],
      [/\b(crp|CRP)\b/gi, 'CRP'],
      [/\b(esr|ESR)\b/gi, 'ESR'],
      [/\b(ct|CT)\b/g, 'CT'],
      [/\b(mri|MRI)\b/gi, 'MRI'],
      [/\b(ecg|EKG|ECG)\b/gi, 'ECG'],
      [/\b(iv|IV)\b/g, 'IV'],
      [/\b(im|IM)\b/g, 'IM'],
      [/\b(sc|SC)\b/g, 'SC'],
      [/\b(po|PO)\b/g, 'PO'],
      [/\b(prn|PRN)\b/gi, 'PRN'],
      [/\b(od|OD)\b/g, 'OD'],
      [/\b(bd|BD)\b/g, 'BD'],
      [/\b(tds|TDS)\b/gi, 'TDS'],
      [/\b(qds|QDS)\b/gi, 'QDS'],
      [/\b(nocte|NOCTE)\b/gi, 'nocte'],
      [/\b(stat|STAT)\b/gi, 'STAT'],
      [/\b(sob|SOB)\b/gi, 'SOB'],
      [/\b(nkda|NKDA)\b/gi, 'NKDA']
    ];

    abbreviationFixes.forEach(([pattern, replacement]) => {
      improved = improved.replace(pattern, replacement);
    });

    // Fix spacing around punctuation
    improved = improved
      .replace(/\s+([.,;:!?])/g, '$1')
      .replace(/([.,;:!?])([^\s\d])/g, '$1 $2');

    // Fix multiple spaces
    improved = improved.replace(/\s+/g, ' ');

    // Fix line breaks
    improved = improved.replace(/\n\s*\n\s*\n/g, '\n\n');

    return improved.trim();
  }

  /**
   * Enhance text locally based on context
   */
  private enhanceLocally(text: string, context: TextContext): string {
    let enhanced = text;

    switch (context) {
      case 'operative_notes':
        enhanced = this.formatOperativeNotes(enhanced);
        break;
      case 'discharge_summary':
        enhanced = this.formatDischargeSummary(enhanced);
        break;
      case 'progress_notes':
        enhanced = this.formatProgressNotes(enhanced);
        break;
      case 'wound_assessment':
        enhanced = this.formatWoundAssessment(enhanced);
        break;
      default:
        // Apply general formatting
        break;
    }

    return enhanced;
  }

  /**
   * Format operative notes with proper structure
   */
  private formatOperativeNotes(text: string): string {
    const sections = [
      'Preoperative Diagnosis',
      'Postoperative Diagnosis',
      'Procedure',
      'Surgeon',
      'Assistant',
      'Anesthesia',
      'Findings',
      'Description of Procedure',
      'Complications',
      'Estimated Blood Loss',
      'Specimens',
      'Disposition'
    ];

    let formatted = text;

    // Try to identify and format section headers
    sections.forEach(section => {
      const regex = new RegExp(`(${section.toLowerCase()}|${section})\\s*:?\\s*`, 'gi');
      formatted = formatted.replace(regex, `\n\n**${section}:** `);
    });

    return formatted.trim();
  }

  /**
   * Format discharge summary with proper structure
   */
  private formatDischargeSummary(text: string): string {
    const sections = [
      'Admission Date',
      'Discharge Date',
      'Admission Diagnosis',
      'Discharge Diagnosis',
      'Hospital Course',
      'Procedures',
      'Consultations',
      'Discharge Medications',
      'Discharge Instructions',
      'Follow-up',
      'Attending Physician'
    ];

    let formatted = text;

    sections.forEach(section => {
      const regex = new RegExp(`(${section.toLowerCase()}|${section})\\s*:?\\s*`, 'gi');
      formatted = formatted.replace(regex, `\n\n**${section}:** `);
    });

    return formatted.trim();
  }

  /**
   * Format progress notes in SOAP format
   */
  private formatProgressNotes(text: string): string {
    const sections = [
      { key: 'subjective', label: 'S (Subjective)' },
      { key: 'objective', label: 'O (Objective)' },
      { key: 'assessment', label: 'A (Assessment)' },
      { key: 'plan', label: 'P (Plan)' }
    ];

    let formatted = text;

    sections.forEach(({ key, label }) => {
      const regex = new RegExp(`\\b(${key})\\s*:?\\s*`, 'gi');
      formatted = formatted.replace(regex, `\n\n**${label}:** `);
    });

    return formatted.trim();
  }

  /**
   * Format wound assessment with standardized structure
   */
  private formatWoundAssessment(text: string): string {
    const sections = [
      'Location',
      'Dimensions',
      'Wound Bed',
      'Exudate',
      'Periwound',
      'Odor',
      'Pain Level',
      'Treatment'
    ];

    let formatted = text;

    sections.forEach(section => {
      const regex = new RegExp(`(${section.toLowerCase()}|${section})\\s*:?\\s*`, 'gi');
      formatted = formatted.replace(regex, `\n**${section}:** `);
    });

    return formatted.trim();
  }

  /**
   * Detect changes between original and enhanced text
   */
  private detectChanges(original: string, enhanced: string): string[] {
    const changes: string[] = [];

    if (original.length !== enhanced.length) {
      changes.push('Text length adjusted');
    }

    if (original.toLowerCase() !== enhanced.toLowerCase()) {
      changes.push('Capitalization corrected');
    }

    // Check for abbreviation fixes
    const abbrevPattern = /\b[A-Z]{2,5}\b/g;
    const originalAbbrevs = original.match(abbrevPattern) || [];
    const enhancedAbbrevs = enhanced.match(abbrevPattern) || [];
    if (originalAbbrevs.length !== enhancedAbbrevs.length) {
      changes.push('Medical abbreviations standardized');
    }

    // Check for formatting
    if ((enhanced.match(/\n\n/g) || []).length > (original.match(/\n\n/g) || []).length) {
      changes.push('Section formatting added');
    }

    if (changes.length === 0) {
      changes.push('Minor formatting improvements');
    }

    return changes;
  }

  /**
   * Get text suggestions for autocomplete
   */
  async getSuggestions(partialText: string, context: TextContext): Promise<SuggestionResult> {
    // Common medical phrase completions based on context
    const suggestions: Record<TextContext, string[]> = {
      clinical_notes: [
        'Patient presents with...',
        'On examination, findings include...',
        'Vital signs stable with...',
        'No signs of acute distress...',
        'Plan includes...'
      ],
      operative_notes: [
        'The patient was prepped and draped in sterile fashion...',
        'Incision was made...',
        'Hemostasis was achieved...',
        'Wound was closed in layers...',
        'Patient tolerated the procedure well...'
      ],
      discharge_summary: [
        'Patient admitted for...',
        'Hospital course was uncomplicated...',
        'Patient is discharged in stable condition...',
        'Follow-up appointment scheduled for...',
        'Return precautions given for...'
      ],
      progress_notes: [
        'Patient reports...',
        'Vitals this morning...',
        'Labs reviewed showing...',
        'Continue current management...',
        'Will monitor for...'
      ],
      consultation_notes: [
        'Thank you for referring this patient...',
        'I was consulted for...',
        'My recommendations include...',
        'Will continue to follow...',
        'Please feel free to contact me...'
      ],
      wound_assessment: [
        'Wound measures approximately...',
        'Wound bed appears...',
        'Minimal/Moderate/Copious drainage noted...',
        'Periwound skin intact...',
        'Dressing changed to...'
      ],
      prescription: [
        'Take one tablet by mouth...',
        'Apply topically twice daily...',
        'As needed for pain...',
        'Continue for 7 days...',
        'Dispense: ...'
      ],
      lab_interpretation: [
        'Lab results reviewed...',
        'Values within normal limits except...',
        'Trending towards normal...',
        'Will repeat labs in...',
        'Clinical correlation recommended...'
      ],
      imaging_report: [
        'Technique: ...',
        'Comparison: None available',
        'Findings: ...',
        'Impression: ...',
        'Recommendations: ...'
      ],
      general: [
        'The patient...',
        'Examination reveals...',
        'Assessment includes...',
        'Plan is to...',
        'Will follow up...'
      ]
    };

    const contextSuggestions = suggestions[context] || suggestions.general;
    
    // Filter suggestions that might complete the partial text
    const filtered = contextSuggestions.filter(s => 
      s.toLowerCase().includes(partialText.toLowerCase().slice(-20))
    );

    return {
      suggestions: filtered.length > 0 ? filtered : contextSuggestions.slice(0, 3),
      category: context
    };
  }

  /**
   * Check if text needs improvement
   */
  needsImprovement(text: string): boolean {
    // Check for common issues
    const issues = [
      text.toLowerCase() === text, // No capitalization
      /\s{2,}/.test(text), // Multiple spaces
      /[a-z]\.[A-Z]/.test(text), // Missing space after period
      !/[.!?]$/.test(text.trim()), // Doesn't end with punctuation
      text.length > 0 && text[0] === text[0].toLowerCase() // Starts lowercase
    ];

    return issues.some(issue => issue);
  }
}

export const aiTextEnhancementService = new AITextEnhancementService();
