/**
 * The clinical vocabularies.
 *
 * These are data, not logic, so the tests are about the properties a picker
 * depends on: no duplicate values (a <select> with two identical options
 * cannot round-trip), no empty groups, no stray whitespace, and coverage of
 * the sites and causes this unit actually sees.
 */

import { describe, it, expect } from 'vitest';
import {
  ANATOMICAL_SITES, WOUND_ETIOLOGIES, WOUND_TYPES, BODY_SIDES, OTHER_OPTION,
  flatten, isListed, groupOf, type TaxonomyGroup,
} from '../data/woundTaxonomy';

const TAXONOMIES: [string, TaxonomyGroup[]][] = [
  ['anatomical sites', ANATOMICAL_SITES],
  ['aetiologies', WOUND_ETIOLOGIES],
];

describe.each(TAXONOMIES)('%s', (_name, groups) => {
  it('has no duplicate option anywhere', () => {
    // A repeated value makes the select ambiguous and breaks round-tripping.
    const all = flatten(groups);
    const seen = new Map<string, number>();
    for (const o of all) seen.set(o, (seen.get(o) ?? 0) + 1);
    const dupes = [...seen.entries()].filter(([, n]) => n > 1).map(([o]) => o);
    expect(dupes).toEqual([]);
  });

  it('has no duplicate group name', () => {
    const names = groups.map((g) => g.group);
    expect(new Set(names).size).toBe(names.length);
  });

  it('has no empty group', () => {
    for (const g of groups) expect(g.options.length).toBeGreaterThan(0);
  });

  it('has no option that is blank or carries stray whitespace', () => {
    // Leading or trailing space is how "Sacral " became its own category in
    // the free-text data this list replaces.
    for (const o of flatten(groups)) {
      expect(o).toBe(o.trim());
      expect(o.length).toBeGreaterThan(1);
    }
  });

  it('does not contain the Other sentinel as a real option', () => {
    // TaxonomySelect appends it separately; a duplicate would break the
    // free-text branch.
    expect(flatten(groups)).not.toContain(OTHER_OPTION);
  });

  it('is large enough to be worth a dropdown', () => {
    expect(flatten(groups).length).toBeGreaterThan(40);
  });
});

describe('anatomical coverage', () => {
  const all = flatten(ANATOMICAL_SITES);

  it('covers the pressure points that produce pressure injuries', () => {
    for (const site of ['Sacrum', 'Ischial tuberosity', 'Greater trochanter', 'Heel']) {
      expect(all).toContain(site);
    }
  });

  it('covers the graft and flap donor sites this unit harvests from', () => {
    for (const site of [
      'Thigh — anterolateral', 'Thigh — lateral', 'Buttock / gluteal',
      'Groin / inguinal', 'Postauricular / retroauricular', 'Supraclavicular',
      'Hypothenar eminence',
    ]) {
      expect(all).toContain(site);
    }
  });

  it('details the hand, which a plastic unit needs at digit level', () => {
    for (const site of [
      'Thumb', 'Index finger', 'Little finger', 'Nail bed', 'First web space',
      'Hand — dorsum', 'Hand — palm',
    ]) {
      expect(all).toContain(site);
    }
  });

  it('can describe a wound that is not at one point', () => {
    for (const site of ['Multiple sites', 'Circumferential — limb']) {
      expect(all).toContain(site);
    }
  });
});

describe('aetiology coverage', () => {
  const all = flatten(WOUND_ETIOLOGIES);

  it('covers the burn mechanisms seen here, not only the textbook ones', () => {
    for (const cause of [
      'Flame burn', 'Scald — hot water', 'Kerosene / petrol burn',
      'Generator / fuel burn', 'Chemical burn — acid', 'Electrical burn — high voltage',
    ]) {
      expect(all).toContain(cause);
    }
  });

  it('covers the tropical and regional causes a generic list omits', () => {
    for (const cause of [
      'Buruli ulcer', 'Tropical phagedenic ulcer', 'Sickle cell ulcer',
      'Snake bite', 'Motorcycle (okada) injury',
      'Traditional / native medicine application', 'Noma (cancrum oris)',
    ]) {
      expect(all).toContain(cause);
    }
  });

  it('covers the surgical causes, since the unit creates wounds too', () => {
    for (const cause of [
      'Skin graft donor site', 'Flap necrosis', 'Wound dehiscence',
      'Surgical site infection', 'Extravasation injury',
    ]) {
      expect(all).toContain(cause);
    }
  });

  it('covers malignancy including the one that arises in a chronic wound', () => {
    expect(all).toContain("Marjolin's ulcer");
    expect(all).toContain('Squamous cell carcinoma');
  });

  it('lets a clinician say the cause is not known', () => {
    expect(all).toContain('Cause unknown');
  });
});

describe('helpers', () => {
  it('flatten returns every option once', () => {
    const n = ANATOMICAL_SITES.reduce((s, g) => s + g.options.length, 0);
    expect(flatten(ANATOMICAL_SITES)).toHaveLength(n);
  });

  it('isListed distinguishes a listed value from free text', () => {
    expect(isListed(ANATOMICAL_SITES, 'Sacrum')).toBe(true);
    expect(isListed(ANATOMICAL_SITES, 'left heel-ish')).toBe(false);
    expect(isListed(ANATOMICAL_SITES, '')).toBe(false);
    expect(isListed(ANATOMICAL_SITES, null)).toBe(false);
  });

  it('isListed is exact, so old free text does not masquerade as coded', () => {
    // The real data held "right leg" and "Sacral " — neither is the coded value.
    expect(isListed(ANATOMICAL_SITES, 'right leg')).toBe(false);
    expect(isListed(ANATOMICAL_SITES, 'Sacral ')).toBe(false);
  });

  it('groupOf finds the group, and null for free text', () => {
    expect(groupOf(ANATOMICAL_SITES, 'Sacrum')).toBe('Back, sacrum & buttock');
    expect(groupOf(WOUND_ETIOLOGIES, 'Snake bite')).toBe('Bites & envenomation');
    expect(groupOf(ANATOMICAL_SITES, 'somewhere else')).toBeNull();
  });
});

describe('supporting lists', () => {
  it('wound types are unique and non-empty', () => {
    expect(new Set(WOUND_TYPES).size).toBe(WOUND_TYPES.length);
    for (const t of WOUND_TYPES) expect(t).toBe(t.trim());
  });

  it('body sides cover laterality and its absence', () => {
    for (const s of ['Left', 'Right', 'Midline', 'Bilateral', 'Not applicable']) {
      expect(BODY_SIDES).toContain(s);
    }
  });
});
