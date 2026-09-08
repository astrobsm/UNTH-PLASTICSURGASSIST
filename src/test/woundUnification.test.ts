/**
 * Wound progress belongs in every module that assesses a wound.
 *
 * The unit assesses wounds in seven places. Serial measurement lived in none of
 * them — it sat in its own page, reachable from the sidebar, against a patient
 * chosen again from scratch. So a burn reviewed weekly for two months produced
 * notes and no curve, and whether it was healing was a matter of recollection.
 *
 * And a wound could not be assessed at all until someone had been registered
 * elsewhere, which in a dressing clinic meant it was written on paper and typed
 * up later, or not at all.
 */

import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

const ROOT = path.resolve(__dirname, '../..');
const read = (p: string) => fs.readFileSync(path.join(ROOT, p), 'utf8');

/** Every module that assesses a wound and so needs the same tracking. */
const WOUND_MODULES = [
  'WoundCarePage', 'BurnCarePage', 'KeloidCarePage',
  'PressureSorePage', 'LymphedemaPage', 'SickleCellUlcerPage',
];

describe('a patient can be registered where the wound is being seen', () => {
  const picker = read('src/components/patients/PatientQuickPicker.tsx');

  it('offers to register the name that was just searched for', () => {
    expect(picker).toContain('Register “${query.trim()}” as a new patient');
  });

  it('needs only a name', () => {
    // The API mints a hospital number when none is given; refusing the record
    // until one is issued loses the measurement, which cannot be recovered.
    expect(picker).toContain('Leave blank if not yet issued');
    expect(picker).toContain('A temporary number is issued if you leave this blank');
  });

  it('does not store an empty hospital number that looks like a real one', () => {
    expect(picker).toContain("...(form.hospital_number.trim() ? { hospital_number: form.hospital_number.trim() } : {})");
  });

  it('shows the split name for correction rather than guessing silently', () => {
    // Splitting on the first space is a guess, and a record filed under the
    // wrong given name is harder to find later than one never created.
    expect(picker).toContain('Splitting a typed name on the first space is a guess');
    expect(picker).toMatch(/first_name/);
    expect(picker).toMatch(/last_name/);
  });

  it('refuses to create a record with half a name', () => {
    expect(picker).toContain('Both names are needed');
  });

  it('the monitor uses it instead of its own picker', () => {
    const monitor = read('src/pages/WoundProgressMonitorPage.tsx');
    expect(monitor).toContain('<PatientQuickPicker');
    // The page's private copy, which could not register, is gone.
    expect(monitor).not.toContain('const PatientPickerModal');
  });
});

describe('every wound module carries the progress panel', () => {
  it.each(WOUND_MODULES)('%s renders WoundTrackingPanel', (mod) => {
    const src = read(`src/pages/${mod}.tsx`);
    expect(src).toContain('<WoundTrackingPanel');
    expect(src).toContain("from '../components/wound/WoundTrackingPanel'");
  });

  it.each(WOUND_MODULES)('%s passes a patient to it', (mod) => {
    const src = read(`src/pages/${mod}.tsx`);
    expect(src).toMatch(/patientId=\{(trackedPatient|patient)\?\.id\}/);
  });

  it.each(WOUND_MODULES)('%s names the kind of wound it deals with', (mod) => {
    // A burn module has no business offering "pressure sore".
    const src = read(`src/pages/${mod}.tsx`);
    expect(src).toMatch(/defaultWoundType="[^"]+"/);
  });
});

describe('the panel does not reimplement the monitor', () => {
  const panel = read('src/components/wound/WoundTrackingPanel.tsx');

  it('reads and writes through woundMonitorService', () => {
    // Two implementations of "is this wound healing" is how they come to
    // disagree, which is worse than having it in one place only.
    expect(panel).toContain("from '../../services/woundMonitorService'");
    expect(panel).toContain('listWounds(');
    expect(panel).toContain('createWound(');
  });

  it('links to the monitor at the route that exists', () => {
    const app = read('src/App.tsx');
    expect(panel).toContain('to="/wound-monitor"');
    expect(app).toContain('path="/wound-monitor"');
  });

  it('shows nothing at all without a patient', () => {
    expect(panel).toContain('if (patientId == null) return null;');
  });

  it('says which way the wound is going, not just its size', () => {
    expect(panel).toContain('TrendingDown');
    expect(panel).toContain('TrendingUp');
  });
});
