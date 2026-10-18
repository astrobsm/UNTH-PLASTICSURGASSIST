/** Tumour measurement checks, margin status, melanoma excision margins, photo diameter. */
import { describe, it, expect } from 'vitest';
import { checkTumourMeasurements, marginStatus, marginsSummary, melanomaExcisionMargin, greatestDimensionCm } from '../services/oncology/tumourMeasurements';

describe('range checks', () => {
  it('rejects a Breslow entered in micrometres and a size entered in millimetres', () => {
    expect(checkTumourMeasurements({ breslowMm: 1200 }).errors[0]).toMatch(/micrometres/);
    expect(checkTumourMeasurements({ sizeCm: 250 }).errors[0]).toMatch(/millimetres/);
  });
  it('accepts plausible values and warns on unusual ones', () => {
    expect(checkTumourMeasurements({ breslowMm: 1.2, sizeCm: 3, largestNodeCm: 2, peripheralMarginMm: 5, deepMarginMm: 2 })).toEqual({ errors: [], warnings: [] });
    expect(checkTumourMeasurements({ breslowMm: 20 }).warnings).toHaveLength(1);
  });
});

describe('margins', () => {
  it('0 mm involved, <1 mm close, otherwise clear', () => {
    expect(marginStatus(0, 5)).toBe('involved');
    expect(marginStatus(4, 0.5)).toBe('close');
    expect(marginStatus(4, 2)).toBe('clear');
    expect(marginStatus(null, undefined)).toBe('not_reported');
  });
  it('summary reads as a margin report', () => {
    expect(marginsSummary({ peripheralMarginMm: 8, deepMarginMm: 1.5, note: 'closest at 3 o’clock' }))
      .toBe('Clear: peripheral 8 mm, deep 1.5 mm — closest at 3 o’clock');
  });
  it('melanoma wide-excision margin follows Breslow', () => {
    expect(melanomaExcisionMargin(null, true)).toMatch(/0\.5–1 cm/);
    expect(melanomaExcisionMargin(0.8)).toMatch(/^1 cm/);
    expect(melanomaExcisionMargin(1.5)).toMatch(/^1–2 cm/);
    expect(melanomaExcisionMargin(3)).toMatch(/^2 cm/);
  });
});

describe('greatest dimension from a calibrated trace', () => {
  it('a 3 × 4 cm rectangle at 50 px/cm has a 5 cm diagonal', () => {
    const pts = [{ x: 0, y: 0 }, { x: 150, y: 0 }, { x: 150, y: 200 }, { x: 0, y: 200 }];
    expect(greatestDimensionCm(pts, 50)).toBe(5);
    expect(greatestDimensionCm(pts, 0)).toBeNull();
  });
});
