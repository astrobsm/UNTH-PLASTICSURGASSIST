/**
 * Pure mapping between stored laboratory result rows and the engine's canonical
 * analytes. No I/O and no app imports, so it can be unit-tested in a plain node
 * environment and reused anywhere the mapping is needed.
 *
 * MAPPING IS NOT INVENTED. Test names are matched using the engine's OWN
 * synonym dictionary (ANALYTES[].synonyms) and normalised with its own unit
 * converter. A second mapping table maintained here would drift from the one
 * the parsers use, so anything unrecognised is reported rather than guessed.
 */

import { ANALYTES, type AnalyteDef } from './engine/referenceRanges';
import { toCanonical } from './engine/units';
import type { Analyte } from './engine/types';

/**
 * A differential percentage ("LYM%", "NEUT %"). These are NOT analytes: the
 * engine stores neutrophils and lymphocytes as absolute counts and derives them
 * from the percentage once the white cell count is known — correcting a lost
 * decimal point along the way. They are collected separately so the engine's
 * own resolvePercentages() can do that, rather than this module inventing a
 * second conversion.
 */
export interface PercentageResult {
  key: string;
  percent: number;
  raw: string;
}

/** True when a stored result is a differential percentage rather than a count. */
export function isPercentageResult(testName: string, unit: string): boolean {
  const name = String(testName || '').trim();
  const u = String(unit || '').trim();
  return name.endsWith('%') || /pct/i.test(name) || u === '%';
}

// Longest synonyms first: "neutrophil %" must win over "neutrophil".
const SYNONYM_INDEX: { synonym: string; def: AnalyteDef }[] = ANALYTES
  .flatMap(def => def.synonyms.map(synonym => ({ synonym: synonym.toLowerCase(), def })))
  .sort((a, b) => b.synonym.length - a.synonym.length);

export interface UnmappedResult {
  testName: string;
  value: string;
  unit: string;
  reason: 'no-matching-analyte' | 'non-numeric' | 'implausible';
}

/** Resolve a lab test name to a canonical analyte, or null. */
export function matchAnalyte(testName: string): AnalyteDef | null {
  const name = String(testName || '').toLowerCase().trim();
  if (!name) return null;
  for (const { synonym, def } of SYNONYM_INDEX) {
    if (name === synonym || name.includes(synonym)) return def;
  }
  return null;
}

/**
 * Read a differential percentage into the shape resolvePercentages() expects.
 * Returns null when the name does not resolve to a known differential.
 */
export function toPercentage(testName: string, rawValue: string | number): PercentageResult | null {
  // Strip the trailing marker so "LYM%" matches the "lymphocyte" synonyms.
  const bare = String(testName || '').replace(/\s*%\s*$/, '').replace(/pct/gi, '').trim();
  const def = matchAnalyte(bare);
  if (!def) return null;

  const percent = typeof rawValue === 'number' ? rawValue : parseFloat(String(rawValue).replace(/[^0-9.+-]/g, ''));
  if (!Number.isFinite(percent) || percent < 0 || percent > 100) return null;

  return { key: def.key, percent, raw: `${testName} ${rawValue}%` };
}

/** Convert one stored investigation row into an engine Analyte. */
export function toAnalyte(
  testName: string,
  rawValue: string | number,
  rawUnit: string
): { analyte: Analyte | null; reason?: UnmappedResult['reason'] } {
  const def = matchAnalyte(testName);
  if (!def) return { analyte: null, reason: 'no-matching-analyte' };

  const numeric = typeof rawValue === 'number' ? rawValue : parseFloat(String(rawValue).replace(/[^0-9.+-]/g, ''));
  if (!Number.isFinite(numeric)) return { analyte: null, reason: 'non-numeric' };

  const { value, unit } = toCanonical(def.unitRule, numeric, String(rawUnit || ''));

  // The engine's own plausibility guard. A transcription slip that puts
  // haemoglobin at 740 g/L must not reach the interpreter as a real value.
  if (def.plausible) {
    const { low, high } = def.plausible;
    if ((low != null && value < low) || (high != null && value > high)) {
      return { analyte: null, reason: 'implausible' };
    }
  }

  return {
    analyte: {
      key: def.key,
      label: def.label,
      value,
      unit,
      rawText: `${rawValue}${rawUnit ? ' ' + rawUnit : ''}`,
      rawValue: numeric,
      rawUnit: String(rawUnit || ''),
      // Read from the record rather than OCR, so confidence is not in question.
      confidence: 1,
      edited: false,
      manual: false,
    },
  };
}

