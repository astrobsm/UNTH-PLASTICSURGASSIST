// @vitest-environment node
/**
 * Structured clinical encounters: AI output is normalised into reviewable
 * suggestions (never auto-accepted), and the endpoint is wired safely.
 */
import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';
import { normaliseAiSuggestions, AI_SYSTEM_PROMPT } from '../../api/_lib/clinicalEncounters.js';

describe('AI clerking suggestions', () => {
  it('normalises the model output into pending, labelled suggestions', () => {
    const out = normaliseAiSuggestions({
      differentials: [{ diagnosis: "Marjolin's ulcer", icd10: 'C44.9', reasons: ['Ulcer on old burn scar'], dangerous: true }, { diagnosis: '' }],
      investigations: [{ test: 'Wedge biopsy', reason: 'Exclude SCC', urgent: true }],
      treatment: [{ action: 'Wound care per local guideline', reason: 'Interim' }],
      missing_information: ['Regional lymph nodes'],
    });
    expect(out.suggestions).toHaveLength(3);
    expect(out.suggestions.every((s: any) => s.decision === 'pending' && s.source === 'ai')).toBe(true);
    expect(out.suggestions[0]).toMatchObject({ kind: 'differential', dangerous: true, priority: 'urgent', text: "Marjolin's ulcer (C44.9)" });
    expect(out.missing).toEqual(['Regional lymph nodes']);
  });

  it('survives malformed output', () => {
    expect(normaliseAiSuggestions(null)).toEqual({ suggestions: [], missing: [] });
    expect(normaliseAiSuggestions({ differentials: 'nonsense' }).suggestions).toEqual([]);
  });

  it('tells the model that missing data is not normal and not to dose', () => {
    expect(AI_SYSTEM_PROMPT).toMatch(/never assume they are normal/);
    expect(AI_SYSTEM_PROMPT).toMatch(/Do not give patient-specific drug doses/);
  });
});

describe('clinical-encounters endpoint wiring', () => {
  const src = fs.readFileSync(path.resolve(__dirname, '../../api/clinical-encounters.js'), 'utf8');
  it('authenticates, gates AI on D5 and de-identifies', () => {
    expect(src).toMatch(/authenticateRequest\(req\)/);
    expect(src).toMatch(/externalAiAllowed\(\)/);
    expect(src).toMatch(/deidentifyText\(/);
  });
  it('is never queued for offline replay', () => {
    const client = fs.readFileSync(path.resolve(__dirname, '../services/apiClient.ts'), 'utf8');
    const sw = fs.readFileSync(path.resolve(__dirname, '../sw.ts'), 'utf8');
    expect(client).toMatch(/'\/clinical-encounters'/);
    expect(sw).toMatch(/'\/api\/clinical-encounters'/);
  });
});
