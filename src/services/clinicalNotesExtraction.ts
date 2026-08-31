/**
 * Clinical Notes NLP Extraction Service
 *
 * Extracts structured medical entities from free-text clinical notes
 * using a combination of rule-based NLP and AI (GPT-4o) for:
 * - ICD-10 diagnosis mapping
 * - Medication parsing (drug, dose, route, frequency)
 * - Procedure identification
 * - Allergy detection
 * - SOAP note segmentation
 * - Clinical entity linking
 *
 * Designed for Nigerian plastic surgery clinical notes with common
 * abbreviations, Pidgin English fragments, and mixed notation.
 */

// ────────────────────────────────────────────────────────────
// TYPES
// ────────────────────────────────────────────────────────────

export interface ExtractedMedication {
  name: string;
  dose?: string;
  route?: string;
  frequency?: string;
  duration?: string;
  indication?: string;
  confidence: number;
}

export interface ExtractedDiagnosis {
  name: string;
  icd10Hint?: string;
  isPrimary: boolean;
  confidence: number;
}

export interface ExtractedProcedure {
  name: string;
  type: 'surgical' | 'diagnostic' | 'therapeutic' | 'unknown';
  confidence: number;
}

export interface ExtractedAllergy {
  allergen: string;
  reaction?: string;
  severity?: 'mild' | 'moderate' | 'severe';
  confidence: number;
}

export interface SOAPNote {
  subjective?: string;
  objective?: string;
  assessment?: string;
  plan?: string;
}

export interface ClinicalEntity {
  text: string;
  type: 'diagnosis' | 'medication' | 'procedure' | 'allergy' | 'lab_value' | 'vital_sign' | 'anatomy' | 'symptom';
  offset: number;
  length: number;
  confidence: number;
  normalized?: string;
}

export interface ClinicalNotesExtractionResult {
  diagnoses: ExtractedDiagnosis[];
  medications: ExtractedMedication[];
  procedures: ExtractedProcedure[];
  allergies: ExtractedAllergy[];
  soapNote: SOAPNote;
  entities: ClinicalEntity[];
  vitalSigns: Record<string, any>;
  labValues: Record<string, any>;
  overallConfidence: number;
  aiProcessed: boolean;
}

// ────────────────────────────────────────────────────────────
// MEDICAL ABBREVIATION DICTIONARY (Nigerian clinical context)
// ────────────────────────────────────────────────────────────

const ABBREVIATIONS: Record<string, string> = {
  // Vitals
  'T': 'Temperature', 'PR': 'Pulse Rate', 'HR': 'Heart Rate',
  'BP': 'Blood Pressure', 'RR': 'Respiratory Rate', 'SpO2': 'Oxygen Saturation',
  // SOAP
  'S': 'Subjective', 'O': 'Objective', 'A': 'Assessment', 'P': 'Plan',
  // Routes
  'PO': 'per oral', 'IV': 'intravenous', 'IM': 'intramuscular',
  'SC': 'subcutaneous', 'SL': 'sublingual', 'p.r.': 'per rectum',
  'TOP': 'topical', 'INH': 'inhaled',
  // Frequency
  'OD': 'once daily', 'BD': 'twice daily', 'TDS': 'three times daily',
  'QDS': 'four times daily', 'PRN': 'as needed', 'STAT': 'immediately',
  'nocte': 'at night', 'mane': 'in the morning',
  // Dosage forms
  'Tab': 'Tablet', 'Cap': 'Capsule', 'Inj': 'Injection',
  'Syp': 'Syrup', 'Susp': 'Suspension', 'Cr': 'Cream', 'Oint': 'Ointment',
  // Common clinical
  'C/O': 'complains of', 'H/O': 'history of', 'O/E': 'on examination',
  'NAD': 'no abnormality detected', 'WNL': 'within normal limits',
  'NKDA': 'no known drug allergies', 'NKA': 'no known allergies',
  'POD': 'post-operative day', 'D/C': 'discharge',
  // Plastic surgery specific
  'SSG': 'Split-skin graft', 'FTSG': 'Full-thickness skin graft',
  'STSG': 'Split-thickness skin graft', 'PBB': 'Post-burn contracture',
  'Z-plasty': 'Z-plasty', 'FTR': 'Flap tissue repair',
  'VAC': 'Vacuum-assisted closure', 'NPWT': 'Negative pressure wound therapy',
  'WDC': 'Wound debridement and closure',
  'EUA': 'Examination under anaesthesia',
};

// ────────────────────────────────────────────────────────────
// REGEX-BASED EXTRACTION (offline-capable)
// ────────────────────────────────────────────────────────────

/** Parse medications from text */
function extractMedicationsRegex(text: string): ExtractedMedication[] {
  const meds: ExtractedMedication[] = [];

  // Pattern: (formulation) (drug name) (dose) (route)? (frequency) (duration)?
  const medRegex = /(?:Tab|Cap|Inj|Syp|Susp|Cr|Oint)\.?\s+([\w\s\-/]+?)\s+(\d+\.?\d*\s*(?:mg|g|ml|mcg|iu|mmol|units?))\s*(?:(PO|IV|IM|SC|SL|PR|INH|topical|TOP)[\s,]*)?\s*(OD|BD|TDS|QDS|PRN|STAT|nocte|mane|q\d+h?)(?:\s+(?:for|x|×)\s+(\d+\s*(?:days?|weeks?|months?|\/\d+)))?/gi;

  let match;
  while ((match = medRegex.exec(text)) !== null) {
    meds.push({
      name: match[1].trim(),
      dose: match[2].trim(),
      route: match[3]?.trim() || 'PO',
      frequency: match[4].trim(),
      duration: match[5]?.trim(),
      confidence: 0.8,
    });
  }

  // Simpler pattern: drug name + dose
  const simpleMedRegex = /(?:^|\n|[;,])\s*((?:Tab|Cap|Inj|Syp|Susp|Cr|Oint)\.?\s+\S+(?:\s+\S+)?)\s+(\d+\.?\d*\s*(?:mg|g|ml|mcg|iu))\s*((?:BD|TDS|QDS|OD|PRN|STAT|nocte|mane)?)/gi;

  while ((match = simpleMedRegex.exec(text)) !== null) {
    const name = match[1].replace(/^(Tab|Cap|Inj|Syp|Susp|Cr|Oint)\.?\s*/i, '').trim();
    // Skip if already found
    if (!meds.some(m => m.name.toLowerCase() === name.toLowerCase())) {
      meds.push({
        name,
        dose: match[2].trim(),
        frequency: match[3]?.trim() || undefined,
        confidence: 0.6,
      });
    }
  }

  return meds;
}

/** Parse diagnoses from text */
function extractDiagnosesRegex(text: string): ExtractedDiagnosis[] {
  const diagnoses: ExtractedDiagnosis[] = [];

  // Look for diagnosis/assessment sections
  const dxSections = text.match(/(?:diagnosis|diagnoses|assessment|impression|A[:\s])[:\s]*([\s\S]*?)(?=\n\s*(?:P[:\s]|plan|management|treatment|$))/gi);

  if (dxSections) {
    for (const section of dxSections) {
      // Split by newlines or numbered items
      const items = section.split(/\n|(?:\d+[.)]\s)/).filter(s => s.trim().length > 3);
      items.forEach((item, i) => {
        const cleaned = item.replace(/^(?:assessment|diagnosis|diagnoses|impression|A)[:\s]*/i, '').trim();
        if (cleaned.length > 3 && cleaned.length < 200) {
          diagnoses.push({
            name: cleaned,
            isPrimary: i === 0,
            confidence: 0.7,
          });
        }
      });
    }
  }

  // Plastic surgery specific diagnosis patterns
  const plasticDxPatterns = [
    { pattern: /(?:post[- ]?burn|PBB)\s+contracture/gi, name: 'Post-burn contracture' },
    { pattern: /keloid\b/gi, name: 'Keloid' },
    { pattern: /hypertrophic\s+scar/gi, name: 'Hypertrophic scar' },
    { pattern: /hand\s+(?:crush\s+)?injury/gi, name: 'Hand injury' },
    { pattern: /facial\s+(?:laceration|injury)/gi, name: 'Facial laceration' },
    { pattern: /cleft\s+(?:lip|palate)/gi, name: 'Cleft lip/palate' },
    { pattern: /skin\s+(?:loss|defect)/gi, name: 'Skin loss' },
    { pattern: /necrotizing\s+fasciitis/gi, name: 'Necrotizing fasciitis' },
    { pattern: /pressure\s+(?:ulcer|sore)/gi, name: 'Pressure ulcer' },
    { pattern: /diabetic\s+(?:foot|ulcer)/gi, name: 'Diabetic foot/ulcer' },
    { pattern: /gangrene/gi, name: 'Gangrene' },
    { pattern: /(?:burn|scald)\s+(?:injury|wounds?)/gi, name: 'Burn injury' },
    { pattern: /TBSA\s*(?::|=)\s*(\d+)/gi, name: 'Burns' },
  ];

  for (const dx of plasticDxPatterns) {
    if (dx.pattern.test(text)) {
      if (!diagnoses.some(d => d.name.toLowerCase().includes(dx.name.toLowerCase()))) {
        diagnoses.push({ name: dx.name, isPrimary: diagnoses.length === 0, confidence: 0.85 });
      }
    }
  }

  return diagnoses;
}

/** Parse procedures from text */
function extractProceduresRegex(text: string): ExtractedProcedure[] {
  const procedures: ExtractedProcedure[] = [];

  const procedurePatterns = [
    { pattern: /(?:split[- ]?(?:skin|thickness)\s+graft|SSG|STSG)/gi, name: 'Split-skin graft', type: 'surgical' as const },
    { pattern: /(?:full[- ]?thickness\s+(?:skin\s+)?graft|FTSG)/gi, name: 'Full-thickness skin graft', type: 'surgical' as const },
    { pattern: /(?:wound\s+)?debridement/gi, name: 'Wound debridement', type: 'surgical' as const },
    { pattern: /Z[- ]?plasty/gi, name: 'Z-plasty', type: 'surgical' as const },
    { pattern: /flap\s+(?:cover|repair|reconstruction|closure)/gi, name: 'Flap reconstruction', type: 'surgical' as const },
    { pattern: /(?:VAC|NPWT|neg(?:ative)?\s+pressure)/gi, name: 'Negative pressure wound therapy', type: 'therapeutic' as const },
    { pattern: /dressing\s+change/gi, name: 'Dressing change', type: 'therapeutic' as const },
    { pattern: /(?:excision|excise)\s+(?:of\s+)?(?:keloid|scar|lesion|mass)/gi, name: 'Excision', type: 'surgical' as const },
    { pattern: /cleft\s+(?:lip|palate)\s+(?:repair|surgery)/gi, name: 'Cleft repair', type: 'surgical' as const },
    { pattern: /skin\s+(?:grafting|graft(?:ing)?)/gi, name: 'Skin grafting', type: 'surgical' as const },
    { pattern: /contracture\s+release/gi, name: 'Contracture release', type: 'surgical' as const },
    { pattern: /EUA/g, name: 'Examination under anaesthesia', type: 'diagnostic' as const },
    { pattern: /(?:wound|tissue)\s+(?:culture|swab|biopsy)/gi, name: 'Wound culture/biopsy', type: 'diagnostic' as const },
  ];

  for (const proc of procedurePatterns) {
    if (proc.pattern.test(text)) {
      if (!procedures.some(p => p.name === proc.name)) {
        procedures.push({ name: proc.name, type: proc.type, confidence: 0.8 });
      }
    }
  }

  return procedures;
}

/** Parse allergies from text */
function extractAllergiesRegex(text: string): ExtractedAllergy[] {
  const allergies: ExtractedAllergy[] = [];

  // "Allergic to X", "Allergy: X", "NKDA"
  const allergySection = text.match(/(?:allerg(?:y|ies|ic\s+to)|drug\s+allerg(?:y|ies))[:\s]*([\s\S]*?)(?=\n\s*(?:\w+[:\s])|$)/gi);

  if (allergySection) {
    for (const section of allergySection) {
      const cleaned = section.replace(/^(?:allerg(?:y|ies|ic\s+to)|drug\s+allerg(?:y|ies))[:\s]*/i, '').trim();
      if (/^(?:NKDA|NKA|nil|none|no\s+known)/i.test(cleaned)) continue;

      const items = cleaned.split(/[,;\n]/).filter(s => s.trim().length > 1);
      for (const item of items) {
        allergies.push({
          allergen: item.trim(),
          confidence: 0.75,
        });
      }
    }
  }

  return allergies;
}

/** Extract SOAP note structure */
function extractSOAPRegex(text: string): SOAPNote {
  const soap: SOAPNote = {};

  // Try explicit S/O/A/P labels
  const subjectiveMatch = text.match(
    /(?:^|\n)\s*(?:S(?:ubjective)?|Complaints?|C\/O|History|Hx)[:\s]+([\s\S]*?)(?=\n\s*(?:O(?:bjective)?|O\/E|Examination|Findings|A(?:ssessment)?|P(?:lan)?)[:\s]|$)/i
  );
  if (subjectiveMatch) soap.subjective = subjectiveMatch[1].trim();

  const objectiveMatch = text.match(
    /(?:^|\n)\s*(?:O(?:bjective)?|O\/E|Examination|Findings|On\s+Examination)[:\s]+([\s\S]*?)(?=\n\s*(?:A(?:ssessment)?|Impression|Diagnosis|P(?:lan)?)[:\s]|$)/i
  );
  if (objectiveMatch) soap.objective = objectiveMatch[1].trim();

  const assessmentMatch = text.match(
    /(?:^|\n)\s*(?:A(?:ssessment)?|Impression|Diagnosis|Diagnoses)[:\s]+([\s\S]*?)(?=\n\s*(?:P(?:lan)?|Management|Treatment)[:\s]|$)/i
  );
  if (assessmentMatch) soap.assessment = assessmentMatch[1].trim();

  const planMatch = text.match(
    /(?:^|\n)\s*(?:P(?:lan)?|Management|Treatment|Disposition)[:\s]+([\s\S]*?)$/i
  );
  if (planMatch) soap.plan = planMatch[1].trim();

  return soap;
}

/** Extract vital signs from text */
function extractVitalsRegex(text: string): Record<string, any> {
  const vitals: Record<string, any> = {};

  const patterns: Array<{ key: string; regex: RegExp }> = [
    { key: 'temperature', regex: /(?:temp|temperature|T)[:\s]*(\d{2,3}\.?\d?)\s*(?:°?[CF]?)/i },
    { key: 'pulse', regex: /(?:pulse|PR|HR|heart\s+rate)[:\s]*(\d{2,3})\s*(?:bpm|\/min)?/i },
    { key: 'bp', regex: /(?:BP|blood\s+pressure)[:\s]*(\d{2,3})\s*\/\s*(\d{2,3})/i },
    { key: 'respiratory_rate', regex: /(?:RR|resp(?:iratory)?\s+rate)[:\s]*(\d{1,2})/i },
    { key: 'spo2', regex: /(?:SpO2|O2\s+sat|oxygen\s+sat)[:\s]*(\d{2,3})\s*%?/i },
    { key: 'weight', regex: /(?:weight|Wt)[:\s]*(\d{2,3}\.?\d?)\s*(?:kg)?/i },
    { key: 'pain_score', regex: /(?:pain|pain\s+score|VAS)[:\s]*(\d{1,2})\s*(?:\/10)?/i },
    { key: 'urine_output', regex: /(?:urine\s+output|UOP|U\/O)[:\s]*(\d+)\s*(?:mls?|cc)?/i },
    { key: 'blood_sugar', regex: /(?:FBG|RBG|FBS|RBS|glucose|blood\s+sugar)[:\s]*(\d+\.?\d*)\s*(?:mg\/?d?l?|mmol\/l)?/i },
  ];

  for (const { key, regex } of patterns) {
    const match = text.match(regex);
    if (match) {
      if (key === 'bp') {
        vitals.bp_systolic = parseInt(match[1]);
        vitals.bp_diastolic = parseInt(match[2]);
      } else {
        vitals[key] = parseFloat(match[1]);
      }
    }
  }

  return vitals;
}

/** Extract lab values from text  */
function extractLabValuesRegex(text: string): Record<string, any> {
  const labs: Record<string, any> = {};

  const labPatterns: Array<{ key: string; regex: RegExp; unit: string }> = [
    { key: 'hemoglobin', regex: /(?:Hb|Hgb|Haemoglobin|Hemoglobin)[:\s]*(\d+\.?\d*)\s*(?:g\/dl)?/i, unit: 'g/dL' },
    { key: 'pcv', regex: /(?:PCV|Hct|Hematocrit)[:\s]*(\d+\.?\d*)\s*%?/i, unit: '%' },
    { key: 'wbc', regex: /(?:WBC|WCC|White\s+(?:cell|blood))[:\s]*(\d+\.?\d*)\s*(?:×?\s*10[⁹³]?)?/i, unit: '×10⁹/L' },
    { key: 'platelets', regex: /(?:Plat(?:elet)?s?|PLT)[:\s]*(\d+\.?\d*)/i, unit: '×10⁹/L' },
    { key: 'sodium', regex: /(?:Na\+?|Sodium)[:\s]*(\d+\.?\d*)\s*(?:mmol\/l|meq\/l)?/i, unit: 'mmol/L' },
    { key: 'potassium', regex: /(?:K\+?|Potassium)[:\s]*(\d+\.?\d*)\s*(?:mmol\/l|meq\/l)?/i, unit: 'mmol/L' },
    { key: 'creatinine', regex: /(?:Creat(?:inine)?|Cr)[:\s]*(\d+\.?\d*)\s*(?:mg\/dl|µmol\/l)?/i, unit: 'mg/dL' },
    { key: 'urea', regex: /(?:Urea|BUN)[:\s]*(\d+\.?\d*)\s*(?:mg\/dl|mmol\/l)?/i, unit: 'mg/dL' },
    { key: 'albumin', regex: /(?:Albumin|Alb)[:\s]*(\d+\.?\d*)\s*(?:g\/dl|g\/l)?/i, unit: 'g/dL' },
    { key: 'total_protein', regex: /(?:Total\s+Protein|TP)[:\s]*(\d+\.?\d*)/i, unit: 'g/dL' },
    { key: 'inr', regex: /(?:INR)[:\s]*(\d+\.?\d*)/i, unit: '' },
    { key: 'pt', regex: /(?:PT|Prothrombin\s+Time)[:\s]*(\d+\.?\d*)\s*(?:sec)?/i, unit: 'sec' },
    { key: 'aptt', regex: /(?:aPTT|APTT|PTT)[:\s]*(\d+\.?\d*)\s*(?:sec)?/i, unit: 'sec' },
    { key: 'hba1c', regex: /(?:HbA1c|A1c|Glycated\s+Hb)[:\s]*(\d+\.?\d*)\s*%?/i, unit: '%' },
    { key: 'esr', regex: /(?:ESR)[:\s]*(\d+)\s*(?:mm\/hr)?/i, unit: 'mm/hr' },
    { key: 'crp', regex: /(?:CRP|C[- ]reactive)[:\s]*(\d+\.?\d*)\s*(?:mg\/l)?/i, unit: 'mg/L' },
  ];

  for (const { key, regex, unit } of labPatterns) {
    const match = text.match(regex);
    if (match) {
      labs[key] = { value: parseFloat(match[1]), unit };
    }
  }

  return labs;
}

// ────────────────────────────────────────────────────────────
// AI-ENHANCED EXTRACTION (GPT-4o)
// ────────────────────────────────────────────────────────────

const CLINICAL_NOTES_AI_PROMPT = `You are a clinical NLP specialist for a Nigerian plastic surgery department.

Extract structured medical entities from the following clinical notes text (which may be OCR-scanned and contain errors).

Return ONLY valid JSON with this structure:
{
  "diagnoses": [{"name": "string", "icd10Hint": "L90.5 etc or null", "isPrimary": boolean}],
  "medications": [{"name": "string", "dose": "string", "route": "PO/IV/IM/SC/etc", "frequency": "OD/BD/TDS/etc", "duration": "string or null", "indication": "string or null"}],
  "procedures": [{"name": "string", "type": "surgical|diagnostic|therapeutic"}],
  "allergies": [{"allergen": "string", "reaction": "string or null", "severity": "mild|moderate|severe or null"}],
  "soapNote": {"subjective": "string or null", "objective": "string or null", "assessment": "string or null", "plan": "string or null"},
  "vitalSigns": {"temperature": number, "pulse": number, "bp_systolic": number, "bp_diastolic": number, "respiratory_rate": number, "spo2": number, ...},
  "labValues": {"hemoglobin": {"value": number, "unit": "g/dL"}, ...}
}

RULES:
- Nigerian clinical abbreviations: Tab=Tablet, Cap=Capsule, Inj=Injection, BD=twice daily, TDS=three times daily, OD=once daily, QDS=four times daily
- Fix obvious OCR errors in drug names (e.g., "Augmentn" → "Augmentin", "Metronidazo1e" → "Metronidazole")
- Include ICD-10 hints for diagnoses where confident
- Preserve original date formats (D/M/YYYY Nigerian format)
- If text says NKDA or NKA, return empty allergies array
- Plastic surgery context: SSG, FTSG, Z-plasty, NPWT/VAC, flap types, graft take assessment`;

export async function extractClinicalNotesWithAI(
  text: string,
  apiKey?: string
): Promise<ClinicalNotesExtractionResult | null> {
  const key = apiKey || (typeof import.meta !== 'undefined' ? (import.meta as any).env?.VITE_OPENAI_API_KEY : undefined);
  if (!key) return null;

  try {
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${key}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-4o',
        messages: [
          { role: 'system', content: CLINICAL_NOTES_AI_PROMPT },
          { role: 'user', content: `Extract structured clinical data from these notes:\n\n${text.substring(0, 8000)}` },
        ],
        temperature: 0.1,
        max_tokens: 4096,
        response_format: { type: 'json_object' },
      }),
    });

    if (!response.ok) return null;

    const result = await response.json();
    const content = result.choices?.[0]?.message?.content;
    if (!content) return null;

    const parsed = JSON.parse(content);
    return {
      diagnoses: (parsed.diagnoses || []).map((d: any) => ({ ...d, confidence: 0.85 })),
      medications: (parsed.medications || []).map((m: any) => ({ ...m, confidence: 0.85 })),
      procedures: (parsed.procedures || []).map((p: any) => ({ ...p, confidence: 0.85 })),
      allergies: (parsed.allergies || []).map((a: any) => ({ ...a, confidence: 0.85 })),
      soapNote: parsed.soapNote || {},
      entities: [],
      vitalSigns: parsed.vitalSigns || {},
      labValues: parsed.labValues || {},
      overallConfidence: 0.85,
      aiProcessed: true,
    };
  } catch {
    return null;
  }
}

// ────────────────────────────────────────────────────────────
// MAIN EXTRACTION FUNCTION (offline-capable with AI enhancement)
// ────────────────────────────────────────────────────────────

export async function extractClinicalNotes(
  text: string,
  options?: { useAI?: boolean; apiKey?: string }
): Promise<ClinicalNotesExtractionResult> {
  // Always run rule-based extraction first (works offline)
  const medications = extractMedicationsRegex(text);
  const diagnoses = extractDiagnosesRegex(text);
  const procedures = extractProceduresRegex(text);
  const allergies = extractAllergiesRegex(text);
  const soapNote = extractSOAPRegex(text);
  const vitalSigns = extractVitalsRegex(text);
  const labValues = extractLabValuesRegex(text);

  const ruleBasedResult: ClinicalNotesExtractionResult = {
    diagnoses,
    medications,
    procedures,
    allergies,
    soapNote,
    entities: [],
    vitalSigns,
    labValues,
    overallConfidence: 0.6,
    aiProcessed: false,
  };

  // Try AI enhancement if online
  if (options?.useAI !== false) {
    const aiResult = await extractClinicalNotesWithAI(text, options?.apiKey);
    if (aiResult) {
      return mergeExtractionResults(ruleBasedResult, aiResult);
    }
  }

  return ruleBasedResult;
}

/** Merge rule-based and AI results, preferring AI where confidence is higher */
function mergeExtractionResults(
  ruleBased: ClinicalNotesExtractionResult,
  ai: ClinicalNotesExtractionResult
): ClinicalNotesExtractionResult {
  // For medications: AI usually catches more and corrects OCR errors
  const medications = ai.medications.length > 0 ? ai.medications : ruleBased.medications;
  const diagnoses = ai.diagnoses.length > 0 ? ai.diagnoses : ruleBased.diagnoses;
  const procedures = ai.procedures.length > 0 ? ai.procedures : ruleBased.procedures;
  const allergies = ai.allergies.length > 0 ? ai.allergies : ruleBased.allergies;

  // Merge vitals — prefer AI but fill gaps with rule-based
  const vitalSigns = { ...ruleBased.vitalSigns, ...ai.vitalSigns };
  const labValues = { ...ruleBased.labValues, ...ai.labValues };

  // SOAP: prefer AI if present
  const soapNote = (ai.soapNote.subjective || ai.soapNote.objective)
    ? ai.soapNote
    : ruleBased.soapNote;

  return {
    diagnoses,
    medications,
    procedures,
    allergies,
    soapNote,
    entities: [...ruleBased.entities, ...ai.entities],
    vitalSigns,
    labValues,
    overallConfidence: 0.85,
    aiProcessed: true,
  };
}
