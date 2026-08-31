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
  return name.endsWith('%') || /\bpct\s*$/i.test(name) || u === '%';
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

/** Names are lower-cased before matching, so letters and digits are enough. */
function isWordChar(c: string | undefined): boolean {
  return c !== undefined && /[a-z0-9]/.test(c);
}

/**
 * True when `needle` occurs in `haystack` as a whole word rather than as a
 * fragment of a longer one.
 *
 * WHY THIS IS NOT `includes()`. Every synonym is a candidate substring of some
 * unrelated test name, and the short ones collide constantly: "hb" sits inside
 * "HbA1c", "k" inside "Ketones", "ck" inside "Sickling test", "ph" inside
 * "Acid Phosphatase", "ig" inside "Triglycerides" and "Antigen". A plain
 * substring match filed each of those under the wrong analyte, carrying the
 * wrong unit and the wrong reference range with it — an HbA1c of 9.5% was read
 * as a haemoglobin of 9.5 g/dL, which the engine then reports as anaemia.
 *
 * Boundaries are tested against the neighbouring characters rather than with a
 * \b regex because synonyms carry punctuation ("pct%", "haemoglobin (hb)",
 * "albumin:creatinine ratio") that \b does not sit beside predictably.
 */
function containsWord(haystack: string, needle: string): boolean {
  if (!needle) return false;
  for (let from = 0; ; ) {
    const i = haystack.indexOf(needle, from);
    if (i < 0) return false;
    const startsClean = !isWordChar(needle[0]) || !isWordChar(haystack[i - 1]);
    const endsClean =
      !isWordChar(needle[needle.length - 1]) || !isWordChar(haystack[i + needle.length]);
    if (startsClean && endsClean) return true;
    from = i + 1;
  }
}

/**
 * Qualifiers that change which quantity, or which specimen, is being reported.
 *
 * Word boundaries stop a synonym matching inside a longer word, but not a
 * synonym matching one word of a longer name: "creatinine clearance" still
 * contains "creatinine". The clearance is a filtration rate in mL/min and the
 * synonym stands for a serum concentration in umol/L, so filing one as the
 * other attaches a reference range that was never meant for it — as it does
 * for "urine sodium" against serum sodium, and "glycated haemoglobin" against
 * haemoglobin.
 *
 * The rule: a qualifier present in the name but absent from the synonym that
 * matched means the synonym describes only part of the name. Those are left
 * unmapped, which puts them in front of the clinician in the `unmapped` list
 * rather than into the engine under the wrong analyte. A synonym that carries
 * the qualifier itself ("urine ph", "albumin:creatinine ratio") still matches.
 */
const DISQUALIFYING_QUALIFIERS = [
  'urine', 'urinary', 'csf', 'clearance', 'glycated', 'a1c',
  'vitamin', 'ratio', 'antigen', 'antibody',
];

function qualifierMismatch(name: string, synonym: string): boolean {
  return DISQUALIFYING_QUALIFIERS.some(
    q => containsWord(name, q) && !containsWord(synonym, q)
  );
}

/** Resolve a lab test name to a canonical analyte, or null. */
export function matchAnalyte(testName: string): AnalyteDef | null {
  const name = String(testName || '').toLowerCase().trim();
  if (!name) return null;
  for (const { synonym, def } of SYNONYM_INDEX) {
    if (name === synonym) return def;
    if (containsWord(name, synonym) && !qualifierMismatch(name, synonym)) return def;
  }
  return null;
}

/**
 * Read a differential percentage into the shape resolvePercentages() expects.
 * Returns null when the name does not resolve to a known differential.
 */
export function toPercentage(testName: string, rawValue: string | number): PercentageResult | null {
  // Strip the trailing marker so "LYM%" matches the "lymphocyte" synonyms.
  const bare = String(testName || '').replace(/\s*%\s*$/, '').replace(/\s*\bpct\s*$/i, '').trim();
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

