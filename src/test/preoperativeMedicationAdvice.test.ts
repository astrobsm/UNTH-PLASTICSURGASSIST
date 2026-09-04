// @vitest-environment node
/**
 * Pre-operative medication guidance.
 *
 * This tells a team which drugs need a decision before theatre. Three of its
 * behaviours are the ones that would cause harm if they broke, so they are
 * pinned here rather than left to review:
 *
 *   - an unrecognised drug returns null, never a guess
 *   - "continue" advice survives, because stopping a beta blocker, a statin or
 *     long-term steroid is itself the injury
 *   - matching is on whole words, so "asa" does not fire inside "Asacol"
 */

import { describe, it, expect } from 'vitest';
import {
  adviseOnMedication,
  adviseOnMedications,
  PREOP_ACTION_META,
} from '../services/preoperativeMedicationAdvice';

describe('drugs that must not be stopped', () => {
  it('says continue for a beta blocker', () => {
    // Abrupt withdrawal causes rebound ischaemia. Silence here would read as
    // "nothing to do", which is the same as advice to omit it while fasting.
    const a = adviseOnMedication('Bisoprolol 5mg');
    expect(a?.action).toBe('continue');
    expect(a?.reason).toMatch(/withdrawal/i);
  });

  it('says continue for a statin', () => {
    expect(adviseOnMedication('Atorvastatin')?.action).toBe('continue');
  });

  it('says continue for long-term steroid, and mentions stress dosing', () => {
    const a = adviseOnMedication('Prednisolone 10mg od');
    expect(a?.action).toBe('continue');
    expect(a?.reason).toMatch(/adrenal|stress/i);
  });
});

describe('drugs that need stopping', () => {
  it('flags warfarin with an INR check', () => {
    const a = adviseOnMedication('Warfarin');
    expect(a?.action).toBe('stop');
    expect(a?.timing).toMatch(/5 days/);
    expect(a?.timing).toMatch(/INR/i);
  });

  it('flags a DOAC and notes renal function', () => {
    for (const d of ['Apixaban 5mg bd', 'Rivaroxaban', 'Eliquis']) {
      const a = adviseOnMedication(d);
      expect(a?.action, d).toBe('stop');
      expect(a?.klass, d).toMatch(/DOAC/);
    }
    expect(adviseOnMedication('Apixaban')?.reason).toMatch(/renal|creatinine/i);
  });

  it('flags an SGLT2 inhibitor for euglycaemic DKA', () => {
    // The dangerous one: the glucose looks fine while the patient is acidotic.
    const a = adviseOnMedication('Empagliflozin 10mg');
    expect(a?.action).toBe('stop');
    expect(a?.reason).toMatch(/euglycaemic|ketoacidosis/i);
  });

  it('flags a GLP-1 agonist for aspiration risk', () => {
    expect(adviseOnMedication('Semaglutide weekly')?.reason).toMatch(/gastric|aspiration/i);
  });
});

describe('drugs where the answer depends on the indication', () => {
  it('does not tell anyone to simply stop aspirin', () => {
    // Stopping it in secondary prevention can be more dangerous than the bleed.
    const a = adviseOnMedication('Aspirin 75mg');
    expect(a?.action).toBe('seek-advice');
  });

  it('adjusts rather than stops insulin', () => {
    // Omitting insulin in type 1 diabetes risks ketoacidosis.
    const a = adviseOnMedication('Insulin glargine');
    expect(a?.action).toBe('adjust');
    expect(a?.timing).toMatch(/reduced|infusion/i);
  });
});

describe('what it refuses to do', () => {
  it('returns null for a drug it does not recognise', () => {
    // The single most important behaviour. A guess here is worse than silence,
    // and the caller renders null as "review manually".
    expect(adviseOnMedication('Zzytherimab')).toBeNull();
    expect(adviseOnMedication('some local herbal mixture')).toBeNull();
    expect(adviseOnMedication('')).toBeNull();
  });

  it('does not match a drug name inside a longer word', () => {
    // "asa" inside "Asacol" would stop a drug the patient needs; "ace" inside
    // "Acetaminophen" would flag a painkiller as an ACE inhibitor.
    expect(adviseOnMedication('Asacol')).toBeNull();
    expect(adviseOnMedication('Acetaminophen')).toBeNull();
  });

  it('marks every piece of advice as needing confirmation', () => {
    // Nothing here is self-executing; the interval is a starting point that the
    // anaesthetist and prescriber decide on.
    for (const d of ['Warfarin', 'Bisoprolol', 'Metformin', 'Aspirin']) {
      expect(adviseOnMedication(d)?.confirmationRequired, d).toBe(true);
    }
  });
});

describe('annotating a whole list', () => {
  it('keeps the ward order and carries nulls through', () => {
    // The list is checked against the drug chart, so reordering it by severity
    // would make that harder, and dropping the unrecognised ones would hide
    // exactly the drugs that need a human to look.
    const meds = [
      { medication_name: 'Bisoprolol' },
      { medication_name: 'Zzytherimab' },
      { medication_name: 'Warfarin' },
    ];
    const out = adviseOnMedications(meds);

    expect(out).toHaveLength(3);
    expect(out.map(o => o.medication.medication_name)).toEqual(['Bisoprolol', 'Zzytherimab', 'Warfarin']);
    expect(out[1].advice).toBeNull();
    expect(out[2].advice?.action).toBe('stop');
  });

  it('survives an empty or malformed list', () => {
    expect(adviseOnMedications([])).toEqual([]);
    expect(adviseOnMedications([{ name: '' }])[0].advice).toBeNull();
  });
});

describe('presentation metadata', () => {
  it('has a label and tone for every action', () => {
    for (const action of ['stop', 'continue', 'adjust', 'seek-advice'] as const) {
      expect(PREOP_ACTION_META[action].label).toBeTruthy();
      expect(PREOP_ACTION_META[action].tone).toBeTruthy();
    }
  });
});
