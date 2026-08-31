// @vitest-environment node
import { describe, it, expect } from 'vitest';
import { toPrintableText, buildPrintDocument } from '../utils/printText';
import { toPdfSafeText } from '../utils/pdfSafeText';

describe('toPrintableText — meaningful symbols become words', () => {
  it('turns telephone glyphs into a readable label', () => {
    // The exact defect from the call duty roster.
    expect(toPrintableText('📞 08033328385')).toBe('Tel: 08033328385');
    expect(toPrintableText('☎ 08033328385')).toBe('Tel: 08033328385');
    expect(toPrintableText('📱 08033328385')).toBe('Mobile: 08033328385');
  });

  it('spells out arrows, which lose their referent in print', () => {
    expect(toPrintableText('→ next')).toBe('-> next');
    expect(toPrintableText('↑ same')).toBe('as above same');
  });

  it('normalises dashes and bullets to ASCII', () => {
    expect(toPrintableText('1 Aug 2026 — 1 Sept 2026')).toBe('1 Aug 2026 - 1 Sept 2026');
    expect(toPrintableText('Week 3 – 4')).toBe('Week 3 - 4');
    expect(toPrintableText('• item')).toBe('- item');
  });

  it('preserves clinical operators as text rather than dropping them', () => {
    // Dropping these would silently change the meaning of a measurement.
    expect(toPrintableText('≥ 5 cm')).toBe('>= 5 cm');
    expect(toPrintableText('≤ 2 mm')).toBe('<= 2 mm');
    expect(toPrintableText('± 1.5')).toBe('+/- 1.5');
    expect(toPrintableText('37.5°C')).toBe('37.5 degC');
    expect(toPrintableText('area 12 cm²')).toBe('area 12 cm2');
    expect(toPrintableText('5 µmol/L')).toBe('5 umol/L');
    expect(toPrintableText('3 × 4')).toBe('3 x 4');
  });

  it('converts status marks to words', () => {
    expect(toPrintableText('✓')).toBe('Yes');
    expect(toPrintableText('✗')).toBe('No');
    expect(toPrintableText('⚠ check')).toBe('Warning: check');
  });

  it('normalises smart quotes and ellipsis', () => {
    expect(toPrintableText('“quoted”')).toBe('"quoted"');
    expect(toPrintableText('it’s')).toBe("it's");
    expect(toPrintableText('wait…')).toBe('wait...');
  });
});

describe('toPrintableText — letters are never transliterated', () => {
  it('keeps accented names intact', () => {
    // A staff or patient name must survive; this is why the module uses an
    // explicit symbol map rather than an ASCII filter.
    expect(toPrintableText('Björn Müller')).toBe('Björn Müller');
    expect(toPrintableText('Chinenye Uzochukwu')).toBe('Chinenye Uzochukwu');
    expect(toPrintableText('José Ngozi')).toBe('José Ngozi');
  });

  it('leaves ordinary clinical text untouched', () => {
    const text = 'DR UGOCHUKWU ONYIA (W+ER), 08144984707';
    expect(toPrintableText(text)).toBe(text);
  });
});

describe('toPrintableText — decorative pictographs are removed', () => {
  it('drops emoji that carry no printable meaning', () => {
    expect(toPrintableText('📊 Report')).toBe('Report');
    expect(toPrintableText('💊 Medication')).toBe('Medication');
    expect(toPrintableText('🔔 Reminder')).toBe('Reminder');
    expect(toPrintableText('🩹 Dressing')).toBe('Dressing');
  });

  it('removes multi-codepoint emoji whole, leaving no fragments', () => {
    const out = toPrintableText('👨‍⚕️ Consultant');
    expect(out).toBe('Consultant');
    // The combined character is deliberate — this asserts the sanitizer handles one.
    // eslint-disable-next-line no-misleading-character-class
    expect(out).not.toMatch(/[‍️]/);
  });

  it('tidies the space an removed leading icon leaves behind', () => {
    expect(toPrintableText('📅  Appointment')).toBe('Appointment');
    expect(toPrintableText('Ward (📞 123)')).toBe('Ward (Tel: 123)');
  });

  it('strips zero-width characters that survive into PDFs as boxes', () => {
    expect(toPrintableText('a​b﻿c')).toBe('abc');
  });
});

describe('toPrintableText — input handling', () => {
  it('handles null, undefined and non-strings without throwing', () => {
    expect(toPrintableText(null)).toBe('');
    expect(toPrintableText(undefined)).toBe('');
    expect(toPrintableText(123 as unknown as string)).toBe('123');
  });

  it('preserves newlines and tabs, which carry layout', () => {
    expect(toPrintableText('line1\nline2')).toBe('line1\nline2');
  });
});

describe('buildPrintDocument — encoding', () => {
  it('always declares UTF-8, which is the root-cause fix', () => {
    const html = buildPrintDocument('Roster', '<style>p{}</style>', '<p>x</p>');
    expect(html).toMatch(/<meta charset="utf-8">/);
    // The charset must precede the title, or a title with non-ASCII is decoded
    // before the declaration is read.
    expect(html.indexOf('charset')).toBeLessThan(html.indexOf('<title>'));
  });

  it('includes the supplied head and body content', () => {
    const html = buildPrintDocument('T', '<style>a{}</style>', '<div>body</div>');
    expect(html).toContain('<style>a{}</style>');
    expect(html).toContain('<div>body</div>');
    expect(html).toContain('<title>T</title>');
  });
});

describe('toPdfSafeText — jsPDF standard-font encoding', () => {
  it('applies the same symbol conversion as print output', () => {
    expect(toPdfSafeText('📞 0803')).toBe('Tel: 0803');
    expect(toPdfSafeText('≥ 5')).toBe('>= 5');
  });

  it('keeps Latin-1 letters, which WinAnsi can render', () => {
    expect(toPdfSafeText('Björn')).toBe('Björn');
  });

  it('drops characters outside the renderable set rather than emitting boxes', () => {
    // Greek and CJK have no glyph in the built-in fonts.
    expect(toPdfSafeText('α beta')).toBe('beta');
    expect(toPdfSafeText('中文 text')).toBe('text');
  });

  it('handles null and undefined', () => {
    expect(toPdfSafeText(null)).toBe('');
    expect(toPdfSafeText(undefined)).toBe('');
  });
});
