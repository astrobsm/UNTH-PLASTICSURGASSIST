// @vitest-environment node
/**
 * Identifiers are removed from text before it is sent to OpenAI (decision D5).
 */
import { describe, it, expect } from 'vitest';
import { deidentifyText, deidentifyMessages } from '../../api/_lib/deidentify.js';
import { normaliseGovernance, GOVERNANCE_DEFAULTS } from '../../api/_lib/governance.js';

describe('deidentify', () => {
  it('removes the patient\'s own name and hospital number', () => {
    const out = deidentifyText('Chigbo Ngozi (UNTH/2026/P1A2B3) has a 6x4 cm ulcer. Ngozi denies fever.',
      ['Chigbo', 'Ngozi', 'UNTH/2026/P1A2B3']);
    expect(out).not.toMatch(/Chigbo|Ngozi|UNTH\/2026/);
    expect(out).toContain('6x4 cm ulcer');
  });

  it('removes hospital-number, phone and email shapes even without a patient', () => {
    const out = deidentifyText('Ref PS74516230, call 08031234567 or +234 803 123 4567, mail a.b@unth.edu.ng');
    expect(out).toBe('Ref [HOSPITAL-NO], call [PHONE] or [PHONE], mail [EMAIL]');
  });

  it('keeps clinical numbers', () => {
    const t = 'BP 120/80, HR 92, Hb 9.8 g/dL, TBSA 18%, day 3 post-op';
    expect(deidentifyText(t)).toBe(t);
  });

  it('only matches whole words for names', () => {
    expect(deidentifyText('Ada is on Adalat', ['Ada'])).toBe('[PATIENT] is on Adalat');
  });

  it('covers every message, including multimodal text parts', () => {
    const out = deidentifyMessages([
      { role: 'user', content: 'Patient Okeke' },
      { role: 'user', content: [{ type: 'text', text: 'Okeke chart' }, { type: 'image_url', image_url: { url: 'x' } }] },
    ], ['Okeke']);
    expect(JSON.stringify(out)).not.toContain('Okeke');
    expect((out[1].content as any[])[1].type).toBe('image_url');
  });
});

describe('governance', () => {
  it('defaults external AI to enabled with identifiers removed', () => {
    expect(GOVERNANCE_DEFAULTS.d5_external_ai).toBe('enabled_deidentified');
  });
  it('rejects values outside the allowed options', () => {
    expect(normaliseGovernance({ d2_early_warning: 'made_up' }).error).toBeTruthy();
    expect(normaliseGovernance({ d6_sign_roles: ['consultant', 'janitor'] }).settings!.d6_sign_roles).toEqual(['consultant']);
  });
});
