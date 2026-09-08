/**
 * The drug list as a prescriber thinks of it.
 *
 * The formulary is organised into fifty-one technical classes — paracetamol
 * filed away from the other antipyretics, iron and folate under "Vitamins &
 * Supplements" rather than where anyone treating anaemia would look. Correct
 * for looking a drug up; wrong for writing a prescription.
 *
 * These check the grouping actually finds things, and that nothing became
 * unreachable in the regrouping.
 */

import { describe, it, expect } from 'vitest';
import {
  PRESCRIBING_GROUPS, PRESCRIBABLE_DRUGS, EML_ADDITIONS,
  drugsInGroup, populatedGroups, findDrug,
  howToTake, sideEffectsLine, frequencyInWords,
} from '../data/prescribingCatalogue';
import { BNF_DRUG_DATABASE } from '../data/bnfDrugDatabase';

describe('the catalogue is a view, not a second copy', () => {
  it('carries every drug the formulary has', () => {
    // A second drug list is a second thing to keep correct, and the one that
    // goes stale is the one that hurts somebody.
    for (const d of BNF_DRUG_DATABASE) {
      expect(findDrug(d.id), d.genericName).toBeDefined();
    }
  });

  it('adds what the formulary was missing', () => {
    expect(PRESCRIBABLE_DRUGS.length).toBe(BNF_DRUG_DATABASE.length + EML_ADDITIONS.length);
  });

  it('has no duplicate ids after merging', () => {
    const ids = PRESCRIBABLE_DRUGS.map((d) => d.id);
    expect(new Set(ids).size).toBe(ids.length);
  });
});

describe('the groups the request asked for are populated', () => {
  const REQUIRED = [
    'Analgesics', 'Antipyretics', 'Antibiotics', 'Haematinics',
    'Vitamins', 'Micronutrients & Minerals', 'Supplements',
    'Anticoagulants', 'Procoagulants & Haemostatics', 'Antiplatelets',
  ] as const;

  it.each(REQUIRED)('%s has something in it', (group) => {
    const drugs = drugsInGroup(group);
    expect(drugs.length, `${group} is empty`).toBeGreaterThan(0);
  });

  it('haematinics finds the iron and the folate', () => {
    // They live under "Vitamins & Supplements" in the formulary, which is not
    // where anyone treating anaemia looks.
    const names = drugsInGroup('Haematinics').map((d) => d.genericName.toLowerCase());
    expect(names.some((n) => n.includes('ferrous'))).toBe(true);
    expect(names.some((n) => n.includes('folic'))).toBe(true);
  });

  it('antipyretics finds paracetamol', () => {
    const names = drugsInGroup('Antipyretics').map((d) => d.genericName.toLowerCase());
    expect(names.some((n) => n.includes('paracetamol'))).toBe(true);
  });

  it('the haemostatics exist at all, which they did not before', () => {
    const names = drugsInGroup('Procoagulants & Haemostatics').map((d) => d.genericName.toLowerCase());
    expect(names.some((n) => n.includes('tranexamic'))).toBe(true);
    expect(names.some((n) => n.includes('phytomenadione'))).toBe(true);
  });

  it('vitamins and supplements are not the same list twice', () => {
    const vitamins = drugsInGroup('Vitamins').map((d) => d.id);
    const supplements = drugsInGroup('Supplements').map((d) => d.id);
    expect(vitamins.filter((id) => supplements.includes(id))).toEqual([]);
  });

  it('Marc Guard is prescribable, with its month', () => {
    const marc = PRESCRIBABLE_DRUGS.find((d) => /marc guard/i.test(d.genericName));
    expect(marc).toBeDefined();
    expect(marc!.dosage.adult.duration).toBe('1 month');
    expect(marc!.dosage.adult.frequency).toContain('od');
    expect(drugsInGroup('Supplements').map((d) => d.id)).toContain(marc!.id);
  });
});

describe('nothing is unreachable', () => {
  it('every drug appears in at least one group', () => {
    // A drug in the database that no group shows cannot be prescribed, which
    // is worse than it not being there — it looks available and is not.
    const reachable = new Set(PRESCRIBING_GROUPS.flatMap((g) => drugsInGroup(g).map((d) => d.id)));
    const missing = PRESCRIBABLE_DRUGS.filter((d) => !reachable.has(d.id)).map((d) => d.genericName);
    expect(missing).toEqual([]);
  });

  it('the picker offers only groups that have something in them', () => {
    for (const { group, count } of populatedGroups()) {
      expect(count, group).toBeGreaterThan(0);
    }
  });
});

describe('the printed lines', () => {
  const paracetamol = PRESCRIBABLE_DRUGS.find((d) => /paracetamol/i.test(d.genericName))!;

  it('turns a frequency into words a patient can follow', () => {
    expect(frequencyInWords('tds')).toBe('three times daily');
    expect(frequencyInWords('prn')).toBe('when required');
    // An unknown code is passed through rather than dropped.
    expect(frequencyInWords('zzz')).toBe('zzz');
  });

  it('always produces an instruction, even with nothing to go on', () => {
    // A sheet with no instruction on it invites the patient to invent one.
    const bare = { ...paracetamol, instructions: undefined };
    expect(howToTake(bare, '', '', undefined)).toBe('Take as directed.');
    expect(howToTake(bare, 'bd', 'oral', '5 days')).toContain('twice daily');
    expect(howToTake(bare, 'bd', 'oral', '5 days')).toContain('for 5 days');
  });

  it('names the route only when it is not oral', () => {
    const bare = { ...paracetamol, instructions: undefined };
    expect(howToTake(bare, 'od', 'oral')).not.toContain('route');
    expect(howToTake(bare, 'od', 'IV')).toContain('by the IV route');
  });

  it('says what to expect and what to come back for, in one line', () => {
    const line = sideEffectsLine(paracetamol);
    expect(line.length).toBeGreaterThan(0);
    expect(line.split('\n')).toHaveLength(1);
  });

  it('does not claim there are no effects when there are', () => {
    const none = { ...paracetamol, sideEffects: { common: [], serious: [] } };
    expect(sideEffectsLine(none)).toBe('No commonly reported effects.');
    expect(sideEffectsLine(paracetamol)).not.toBe('No commonly reported effects.');
  });
});
