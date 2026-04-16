/**
 * Medical Value Validation & Confidence Scoring Service
 *
 * Validates OCR-extracted medical data against physiologically plausible ranges,
 * flags abnormal values, detects common OCR misread patterns, and produces
 * per-field confidence scores for clinical review.
 *
 * Ranges are based on adult clinical norms used in Nigerian tertiary hospitals.
 */

// ────────────────────────────────────────────────────────────
// TYPES
// ────────────────────────────────────────────────────────────

export interface ValidationResult {
  valid: boolean;
  correctedValue?: number;
  confidence: number;          // 0 – 1  (how confident we are the value is correct)
  severity: 'normal' | 'warning' | 'critical' | 'implausible';
  message?: string;
  ocrCorrectionApplied?: string;
}

export interface VitalAlert {
  parameter: string;
  value: number;
  severity: 'warning' | 'critical';
  message: string;
  range: string;
}

export interface ValidatedVitalReading {
  temperature?: { value: number; validation: ValidationResult };
  pulse?: { value: number; validation: ValidationResult };
  bp_systolic?: { value: number; validation: ValidationResult };
  bp_diastolic?: { value: number; validation: ValidationResult };
  respiratory_rate?: { value: number; validation: ValidationResult };
  spo2?: { value: number; validation: ValidationResult };
  weight?: { value: number; validation: ValidationResult };
  pain_score?: { value: number; validation: ValidationResult };
  alerts: VitalAlert[];
  overallConfidence: number;
}

// ────────────────────────────────────────────────────────────
// PHYSIOLOGICAL RANGES
// ────────────────────────────────────────────────────────────

interface Range {
  min: number;        // absolute minimum (below = implausible)
  low_critical: number;
  low_warning: number;
  normal_low: number;
  normal_high: number;
  high_warning: number;
  high_critical: number;
  max: number;        // absolute maximum (above = implausible)
  unit: string;
}

const VITAL_RANGES: Record<string, Range> = {
  temperature: {
    min: 25, low_critical: 33, low_warning: 35.5, normal_low: 36.1,
    normal_high: 37.5, high_warning: 38.0, high_critical: 40.0, max: 45,
    unit: '°C',
  },
  pulse: {
    min: 15, low_critical: 40, low_warning: 50, normal_low: 60,
    normal_high: 100, high_warning: 120, high_critical: 150, max: 300,
    unit: 'bpm',
  },
  bp_systolic: {
    min: 40, low_critical: 70, low_warning: 90, normal_low: 100,
    normal_high: 140, high_warning: 160, high_critical: 200, max: 300,
    unit: 'mmHg',
  },
  bp_diastolic: {
    min: 20, low_critical: 40, low_warning: 50, normal_low: 60,
    normal_high: 90, high_warning: 100, high_critical: 130, max: 200,
    unit: 'mmHg',
  },
  respiratory_rate: {
    min: 4, low_critical: 8, low_warning: 10, normal_low: 12,
    normal_high: 20, high_warning: 25, high_critical: 35, max: 80,
    unit: '/min',
  },
  spo2: {
    min: 40, low_critical: 85, low_warning: 90, normal_low: 95,
    normal_high: 100, high_warning: 101, high_critical: 101, max: 100,
    unit: '%',
  },
  weight: {
    min: 1, low_critical: 20, low_warning: 30, normal_low: 40,
    normal_high: 150, high_warning: 200, high_critical: 300, max: 500,
    unit: 'kg',
  },
  pain_score: {
    min: 0, low_critical: 0, low_warning: 0, normal_low: 0,
    normal_high: 3, high_warning: 5, high_critical: 8, max: 10,
    unit: '/10',
  },
};

const LAB_RANGES: Record<string, Range> = {
  hemoglobin: { min: 1, low_critical: 5, low_warning: 8, normal_low: 12, normal_high: 17, high_warning: 19, high_critical: 22, max: 30, unit: 'g/dL' },
  wbc: { min: 0.1, low_critical: 1, low_warning: 3.5, normal_low: 4, normal_high: 11, high_warning: 15, high_critical: 30, max: 100, unit: '×10⁹/L' },
  platelets: { min: 5, low_critical: 20, low_warning: 100, normal_low: 150, normal_high: 400, high_warning: 600, high_critical: 1000, max: 2000, unit: '×10⁹/L' },
  creatinine: { min: 0.1, low_critical: 0.2, low_warning: 0.4, normal_low: 0.6, normal_high: 1.3, high_warning: 2.0, high_critical: 5.0, max: 30, unit: 'mg/dL' },
  sodium: { min: 100, low_critical: 120, low_warning: 130, normal_low: 135, normal_high: 145, high_warning: 150, high_critical: 160, max: 200, unit: 'mmol/L' },
  potassium: { min: 1.0, low_critical: 2.5, low_warning: 3.0, normal_low: 3.5, normal_high: 5.0, high_warning: 5.5, high_critical: 6.5, max: 12, unit: 'mmol/L' },
  glucose: { min: 10, low_critical: 40, low_warning: 60, normal_low: 70, normal_high: 110, high_warning: 180, high_critical: 400, max: 1000, unit: 'mg/dL' },
  ast: { min: 1, low_critical: 1, low_warning: 5, normal_low: 10, normal_high: 40, high_warning: 80, high_critical: 200, max: 10000, unit: 'U/L' },
  alt: { min: 1, low_critical: 1, low_warning: 5, normal_low: 7, normal_high: 40, high_warning: 80, high_critical: 200, max: 10000, unit: 'U/L' },
  bilirubin: { min: 0, low_critical: 0, low_warning: 0, normal_low: 0.1, normal_high: 1.2, high_warning: 2.5, high_critical: 10, max: 50, unit: 'mg/dL' },
  inr: { min: 0.5, low_critical: 0.5, low_warning: 0.8, normal_low: 0.9, normal_high: 1.1, high_warning: 2.5, high_critical: 5.0, max: 20, unit: '' },
};

// ────────────────────────────────────────────────────────────
// OCR ERROR CORRECTION PATTERNS
// ────────────────────────────────────────────────────────────

/** Common OCR misreads for digits */
const OCR_DIGIT_CORRECTIONS: Array<{ pattern: RegExp; replacement: string; context: string }> = [
  // O→0, I/l→1
  { pattern: /^[Oo](\d+)$/,   replacement: '0$1',    context: 'leading-O-to-0' },
  { pattern: /^(\d+)[Oo]$/,   replacement: '$10',     context: 'trailing-O-to-0' },
  { pattern: /^[Il](\d+)$/,   replacement: '1$1',     context: 'leading-I-to-1' },
  { pattern: /^(\d+)[Il]$/,   replacement: '$11',     context: 'trailing-I-to-1' },
  // S→5, B→8
  { pattern: /^[Ss](\d+)$/,   replacement: '5$1',     context: 'leading-S-to-5' },
  { pattern: /^(\d+)[Ss]$/,   replacement: '$15',     context: 'trailing-S-to-5' },
  { pattern: /^[Bb](\d{1,2})$/, replacement: '8$1',   context: 'leading-B-to-8' },
  // Decimal comma→dot
  { pattern: /^(\d+),(\d+)$/, replacement: '$1.$2',   context: 'comma-to-dot' },
];

function attemptOCRCorrection(raw: string): { value: number; correction?: string } | null {
  const trimmed = raw.trim();
  const asNumber = parseFloat(trimmed);
  if (!isNaN(asNumber)) return { value: asNumber };

  for (const rule of OCR_DIGIT_CORRECTIONS) {
    const match = trimmed.match(rule.pattern);
    if (match) {
      const corrected = trimmed.replace(rule.pattern, rule.replacement);
      const val = parseFloat(corrected);
      if (!isNaN(val)) return { value: val, correction: rule.context };
    }
  }
  return null;
}

// ────────────────────────────────────────────────────────────
// VALIDATION FUNCTIONS
// ────────────────────────────────────────────────────────────

function validateAgainstRange(value: number, range: Range): ValidationResult {
  if (value < range.min || value > range.max) {
    return { valid: false, confidence: 0.1, severity: 'implausible', message: `Value ${value} outside physiological range (${range.min}–${range.max} ${range.unit})` };
  }
  if (value < range.low_critical) {
    return { valid: true, confidence: 0.85, severity: 'critical', message: `Critically low: ${value} ${range.unit}` };
  }
  if (value > range.high_critical) {
    return { valid: true, confidence: 0.85, severity: 'critical', message: `Critically high: ${value} ${range.unit}` };
  }
  if (value < range.low_warning) {
    return { valid: true, confidence: 0.9, severity: 'warning', message: `Below normal: ${value} ${range.unit}` };
  }
  if (value > range.high_warning) {
    return { valid: true, confidence: 0.9, severity: 'warning', message: `Above normal: ${value} ${range.unit}` };
  }
  return { valid: true, confidence: 0.95, severity: 'normal' };
}

/** Validate & correct a single vital sign value */
export function validateVitalSign(parameter: string, rawValue: number | string): ValidationResult {
  const range = VITAL_RANGES[parameter];
  if (!range) return { valid: true, confidence: 0.5, severity: 'normal', message: 'Unknown parameter' };

  let value: number;
  let ocrCorrection: string | undefined;

  if (typeof rawValue === 'string') {
    const corrected = attemptOCRCorrection(rawValue);
    if (!corrected) return { valid: false, confidence: 0.1, severity: 'implausible', message: `Cannot parse value: ${rawValue}` };
    value = corrected.value;
    ocrCorrection = corrected.correction;
  } else {
    value = rawValue;
  }

  // Temperature: auto-detect °F and convert
  if (parameter === 'temperature' && value > 80 && value < 115) {
    value = parseFloat(((value - 32) * 5 / 9).toFixed(1));
    ocrCorrection = (ocrCorrection ? ocrCorrection + ', ' : '') + 'fahrenheit-to-celsius';
  }

  const result = validateAgainstRange(value, range);
  if (ocrCorrection) {
    result.ocrCorrectionApplied = ocrCorrection;
    result.correctedValue = value;
    result.confidence = Math.max(0.3, result.confidence - 0.15); // Reduce confidence for corrected values
  }
  return result;
}

/** Validate a single lab value */
export function validateLabValue(parameter: string, rawValue: number | string): ValidationResult {
  const range = LAB_RANGES[parameter];
  if (!range) return { valid: true, confidence: 0.5, severity: 'normal', message: 'Unknown lab parameter' };

  let value: number;
  let ocrCorrection: string | undefined;

  if (typeof rawValue === 'string') {
    const corrected = attemptOCRCorrection(rawValue);
    if (!corrected) return { valid: false, confidence: 0.1, severity: 'implausible', message: `Cannot parse value: ${rawValue}` };
    value = corrected.value;
    ocrCorrection = corrected.correction;
  } else {
    value = rawValue;
  }

  const result = validateAgainstRange(value, range);
  if (ocrCorrection) {
    result.ocrCorrectionApplied = ocrCorrection;
    result.correctedValue = value;
    result.confidence = Math.max(0.3, result.confidence - 0.15);
  }
  return result;
}

/** Validate a full set of vital signs and generate alerts */
export function validateVitals(reading: Record<string, any>): ValidatedVitalReading {
  const validated: ValidatedVitalReading = { alerts: [], overallConfidence: 1.0 };
  const confidenceValues: number[] = [];

  const fields = ['temperature', 'pulse', 'bp_systolic', 'bp_diastolic', 'respiratory_rate', 'spo2', 'weight', 'pain_score'] as const;

  for (const field of fields) {
    const raw = reading[field];
    if (raw == null) continue;

    const result = validateVitalSign(field, raw);
    const value = result.correctedValue ?? (typeof raw === 'number' ? raw : parseFloat(raw));
    (validated as any)[field] = { value, validation: result };
    confidenceValues.push(result.confidence);

    if (result.severity === 'critical' || result.severity === 'warning') {
      const range = VITAL_RANGES[field];
      validated.alerts.push({
        parameter: field.replace(/_/g, ' '),
        value,
        severity: result.severity,
        message: result.message || `Abnormal ${field}`,
        range: `${range.normal_low}–${range.normal_high} ${range.unit}`,
      });
    }
  }

  // BP consistency check
  if (validated.bp_systolic && validated.bp_diastolic) {
    const sys = validated.bp_systolic.value;
    const dia = validated.bp_diastolic.value;
    if (dia >= sys) {
      validated.alerts.push({
        parameter: 'blood pressure',
        value: sys,
        severity: 'critical',
        message: `Diastolic (${dia}) ≥ Systolic (${sys}) — likely OCR error`,
        range: 'Systolic must exceed Diastolic',
      });
      validated.bp_systolic.validation.confidence = 0.2;
      validated.bp_diastolic.validation.confidence = 0.2;
    }
    const pp = sys - dia;
    if (pp < 20 || pp > 100) {
      validated.alerts.push({
        parameter: 'pulse pressure',
        value: pp,
        severity: 'warning',
        message: `Pulse pressure ${pp} mmHg is ${pp < 20 ? 'narrow' : 'wide'}`,
        range: '25–60 mmHg',
      });
    }
  }

  validated.overallConfidence = confidenceValues.length > 0
    ? confidenceValues.reduce((a, b) => a + b, 0) / confidenceValues.length
    : 0;

  return validated;
}

/** Check if an image is likely unreadable (too dark, too bright, too blurry) */
export function assessImageQuality(imageData: ImageData): {
  quality: 'good' | 'acceptable' | 'poor' | 'unreadable';
  issues: string[];
  confidence: number;
} {
  const { data, width, height } = imageData;
  const issues: string[] = [];
  let totalBrightness = 0;
  let edgeStrength = 0;
  const pixelCount = width * height;

  // Sample every 4th pixel for performance
  for (let i = 0; i < data.length; i += 16) {
    const gray = data[i] * 0.299 + data[i + 1] * 0.587 + data[i + 2] * 0.114;
    totalBrightness += gray;
  }
  const avgBrightness = totalBrightness / (pixelCount / 4);

  // Edge detection (Sobel-like) on sampled rows
  const step = Math.max(1, Math.floor(height / 100));
  let edgeCount = 0;
  for (let y = 1; y < height - 1; y += step) {
    for (let x = 1; x < width - 1; x += 4) {
      const idx = (y * width + x) * 4;
      const gx = Math.abs(data[idx - 4] - data[idx + 4]);
      const gy = Math.abs(data[idx - width * 4] - data[idx + width * 4]);
      if (gx + gy > 30) edgeCount++;
    }
  }
  edgeStrength = edgeCount / (pixelCount / (step * 4));

  if (avgBrightness < 40) issues.push('Image too dark — poor lighting');
  if (avgBrightness > 240) issues.push('Image overexposed — too bright');
  if (edgeStrength < 0.02) issues.push('Image too blurry — insufficient detail for OCR');

  // Histogram variance (low variance = poor contrast)
  let varianceSum = 0;
  for (let i = 0; i < data.length; i += 16) {
    const gray = data[i] * 0.299 + data[i + 1] * 0.587 + data[i + 2] * 0.114;
    varianceSum += (gray - avgBrightness) ** 2;
  }
  const variance = varianceSum / (pixelCount / 4);
  if (variance < 200) issues.push('Low contrast — text may not be distinguishable');

  let quality: 'good' | 'acceptable' | 'poor' | 'unreadable';
  let confidence: number;

  if (issues.length === 0) {
    quality = 'good';
    confidence = 0.95;
  } else if (issues.length === 1 && !issues[0].includes('blurry')) {
    quality = 'acceptable';
    confidence = 0.7;
  } else if (issues.length <= 2) {
    quality = 'poor';
    confidence = 0.4;
  } else {
    quality = 'unreadable';
    confidence = 0.1;
  }

  return { quality, issues, confidence };
}

export const VITAL_RANGES_EXPORT = VITAL_RANGES;
export const LAB_RANGES_EXPORT = LAB_RANGES;
