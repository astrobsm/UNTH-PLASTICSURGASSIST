// @vitest-environment node
import { describe, it, expect } from 'vitest';
import { matchAnalyte, toAnalyte, toPercentage, isPercentageResult } from '../services/clinicianAssistant/analyteMapping';
import { analyse } from '../services/clinicianAssistant/engine/analyse';
import { emptyExtraction } from '../services/clinicianAssistant/engine/context';
import { emptyPatient } from '../services/clinicianAssistant/engine/types';

/**
 * The bridge decides which stored investigation results reach the diagnostic
 * engine. A test name that fails to map is a value the clinician entered and
 * the interpretation silently ignored, so the mapping needs holding to account
 * — particularly the real names this app already stores.
 */

describe('analyte matching against stored test names', () => {
  it('maps the abbreviations investigation_uploads actually contains', () => {
    // Taken from live rows in this database, not invented.
    expect(matchAnalyte('WBC')?.key).toBe('wbc');
  });

  it('does NOT treat a differential percentage as an analyte', () => {
    // "LYM%" is a percentage, while the engine's `lymph` is an absolute count.
    // Matching it directly would file a percentage as though it were a cell
    // count — 14.36 x10^9/L instead of 14.36% of the white count.
    expect(isPercentageResult('LYM%', '%')).toBe(true);
    expect(toPercentage('LYM%', '14.36')?.key).toBe('lymph');
    expect(toPercentage('LYM%', '14.36')?.percent).toBeCloseTo(14.36, 2);
  });

  it('recognises percentages by unit as well as by name', () => {
    expect(isPercentageResult('Neutrophils', '%')).toBe(true);
    expect(isPercentageResult('Neutrophils', 'x10^9/L')).toBe(false);
  });

  it('rejects a percentage outside 0-100 rather than passing it on', () => {
    expect(toPercentage('LYM%', '140')).toBeNull();
    expect(toPercentage('LYM%', '-4')).toBeNull();
  });

  it('maps common full names and abbreviations to the same analyte', () => {
    expect(matchAnalyte('Haemoglobin')?.key).toBe('hb');
    expect(matchAnalyte('Hb')?.key).toBe('hb');
    expect(matchAnalyte('HAEMOGLOBIN')?.key).toBe('hb');
  });

  it('is case- and whitespace-insensitive', () => {
    expect(matchAnalyte('  platelet count  ')?.key).toBe(matchAnalyte('Platelet Count')?.key);
  });

  it('returns null for a name the engine does not know, rather than guessing', () => {
    // Guessing here would attach a real number to the wrong analyte, which is
    // worse than not interpreting it at all.
    expect(matchAnalyte('Ward round note')).toBeNull();
    expect(matchAnalyte('')).toBeNull();
  });
});

describe('converting a stored result into an engine analyte', () => {
  it('carries the value through and records the original text', () => {
    const { analyte } = toAnalyte('WBC', '13.01', '10^9/L');
    expect(analyte).not.toBeNull();
    expect(analyte!.key).toBe('wbc');
    expect(analyte!.value).toBeCloseTo(13.01, 2);
    expect(analyte!.rawText).toContain('13.01');
  });

  it('marks record-sourced values as fully confident, not OCR-confident', () => {
    const { analyte } = toAnalyte('Haemoglobin', 9.2, 'g/dL');
    expect(analyte!.confidence).toBe(1);
    expect(analyte!.edited).toBe(false);
  });

  it('rejects a non-numeric result instead of coercing it to zero', () => {
    // "Not detected" becoming 0 would read as a real measured value.
    const { analyte, reason } = toAnalyte('WBC', 'Not detected', '');
    expect(analyte).toBeNull();
    expect(reason).toBe('non-numeric');
  });

  it('rejects an implausible value using the engine\'s own guard', () => {
    // A decimal-point slip: 74 g/dL haemoglobin is not survivable and is a
    // transcription error, not a critical result.
    const { analyte, reason } = toAnalyte('Haemoglobin', 740, 'g/dL');
    expect(analyte).toBeNull();
    expect(reason).toBe('implausible');
  });

  it('reports an unrecognised test rather than dropping it silently', () => {
    const { analyte, reason } = toAnalyte('Serum unicorn', '5', 'mg/L');
    expect(analyte).toBeNull();
    expect(reason).toBe('no-matching-analyte');
  });
});

describe('engine accepts bridge output', () => {
  it('analyses a context assembled from record values', () => {
    const extraction = emptyExtraction();
    for (const [name, value, unit] of [
      ['Haemoglobin', '7.4', 'g/dL'],
      ['WBC', '18.9', '10^9/L'],
      ['Platelet Count', '95', '10^9/L'],
    ] as const) {
      const { analyte } = toAnalyte(name, value, unit);
      if (analyte) extraction.analytes.push(analyte);
    }
    expect(extraction.analytes.length).toBe(3);

    const patient = { ...emptyPatient(), age: 68, sex: 'male' as const };
    const result = analyse(patient, extraction, []);

    expect(result.modules.length).toBeGreaterThan(0);
    expect(result.overallSeverity).toBeDefined();
    expect(Array.isArray(result.impression)).toBe(true);
    expect(result.generatedAt).toBeTruthy();
  });

  it('produces a valid result for a patient with no investigations at all', () => {
    // A patient with nothing recorded must not crash the module — it should
    // simply have nothing to say.
    const result = analyse({ ...emptyPatient(), age: 40 }, emptyExtraction(), []);
    expect(result).toBeDefined();
    expect(Array.isArray(result.modules)).toBe(true);
  });
});
