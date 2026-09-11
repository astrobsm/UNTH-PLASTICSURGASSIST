/**
 * The tissue adapter's arithmetic and its refusals.
 *
 * Inference itself needs a model and a browser; everything around it — the
 * geometry, the proportions, the confidence policy and the registration gate —
 * is pure and is checked here against shapes whose answers are known.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  maskToFractions, fractionsToAreas, qualitativeConfidence, configFromEnv,
  rasterisePolygon, polygonAreaPx, initTissueModelFromEnv, USEFUL_MAE_CEILING_PP,
} from '../services/tissueModelProvider';
import {
  getComputerVisionProvider, NULL_PROVIDER, analyseTissue, tissueAnalysisAvailable,
  registerComputerVisionProvider,
} from '../services/computerVisionProvider';

const CLASSES = ['background', 'viable', 'nonviable'];

describe('maskToFractions', () => {
  it('reports proportions of the wound, not of the photograph', () => {
    // 6 background, 3 viable, 1 nonviable. Background must not dilute it:
    // the answer is 75/25, not 30/10.
    const mask = [0, 0, 0, 0, 0, 0, 1, 1, 1, 2];
    const f = maskToFractions(mask, CLASSES);
    expect(f.viable).toBeCloseTo(0.75, 6);
    expect(f.nonviable).toBeCloseTo(0.25, 6);
  });

  it('counts only pixels inside the traced contour', () => {
    const mask = [1, 1, 2, 2];
    // Only the first two pixels are inside; both are viable.
    const inside = Uint8Array.from([1, 1, 0, 0]);
    const f = maskToFractions(mask, CLASSES, inside);
    expect(f.viable).toBe(1);
    expect(f.nonviable).toBe(0);
  });

  it('returns zeros rather than NaN when nothing is inside', () => {
    const f = maskToFractions([0, 0, 0], CLASSES, Uint8Array.from([0, 0, 0]));
    expect(f.viable).toBe(0);
    expect(f.nonviable).toBe(0);
  });

  it('ignores class indices the model should not have emitted', () => {
    const f = maskToFractions([1, 9, 2], CLASSES);
    expect(f.viable + f.nonviable).toBeCloseTo(1, 6);
  });
});

describe('fractionsToAreas', () => {
  it('scales by the measured wound area', () => {
    const a = fractionsToAreas({ viable: 0.9, nonviable: 0.1 }, 50.2);
    expect(a.viable).toBeCloseTo(45.18, 2);
    expect(a.nonviable).toBeCloseTo(5.02, 2);
  });
});

describe('qualitativeConfidence', () => {
  it('is low when the model has not declared its error', () => {
    expect(qualitativeConfidence({ validated: true, maePercentagePoints: null })).toBe('low');
  });

  it('never reports high for an unvalidated model, however small its error', () => {
    expect(qualitativeConfidence({ validated: false, maePercentagePoints: 1 })).toBe('moderate');
  });

  it('caps a validated but imprecise model at moderate', () => {
    // 14pp is the published state of the art, and cannot separate 85% from 99%.
    expect(qualitativeConfidence({ validated: true, maePercentagePoints: 14.3 })).toBe('moderate');
    expect(qualitativeConfidence({ validated: false, maePercentagePoints: 14.3 })).toBe('low');
  });

  it('reports high only for a validated model inside the useful ceiling', () => {
    expect(qualitativeConfidence({
      validated: true, maePercentagePoints: USEFUL_MAE_CEILING_PP - 1,
    })).toBe('high');
  });
});

describe('configFromEnv', () => {
  it('returns nothing when no model is configured', () => {
    expect(configFromEnv({})).toBeNull();
    expect(configFromEnv({ VITE_TISSUE_MODEL_URL: '   ' })).toBeNull();
  });

  it('refuses a model that does not declare its output classes', () => {
    expect(configFromEnv({ VITE_TISSUE_MODEL_URL: '/m.json' })).toBeNull();
    expect(configFromEnv({
      VITE_TISSUE_MODEL_URL: '/m.json', VITE_TISSUE_MODEL_CLASSES: 'background',
    })).toBeNull();
  });

  it('treats anything but an explicit true as unvalidated', () => {
    const base = { VITE_TISSUE_MODEL_URL: '/m.json', VITE_TISSUE_MODEL_CLASSES: 'background,viable' };
    expect(configFromEnv(base)!.validated).toBe(false);
    expect(configFromEnv({ ...base, VITE_TISSUE_MODEL_VALIDATED: '1' })!.validated).toBe(false);
    expect(configFromEnv({ ...base, VITE_TISSUE_MODEL_VALIDATED: 'yes' })!.validated).toBe(false);
    expect(configFromEnv({ ...base, VITE_TISSUE_MODEL_VALIDATED: 'TRUE' })!.validated).toBe(true);
  });

  it('carries the declared error through, and null when absent', () => {
    const base = { VITE_TISSUE_MODEL_URL: '/m.json', VITE_TISSUE_MODEL_CLASSES: 'background,viable' };
    expect(configFromEnv(base)!.maePercentagePoints).toBeNull();
    expect(configFromEnv({ ...base, VITE_TISSUE_MODEL_MAE_PP: '8.84' })!.maePercentagePoints).toBeCloseTo(8.84);
  });
});

describe('polygon geometry', () => {
  it('measures a rectangle by its sides', () => {
    const r = [{ x: 0, y: 0 }, { x: 10, y: 0 }, { x: 10, y: 4 }, { x: 0, y: 4 }];
    expect(polygonAreaPx(r)).toBeCloseTo(40, 6);
  });

  it('is unsigned, so winding direction does not make a negative wound', () => {
    const cw = [{ x: 0, y: 0 }, { x: 0, y: 4 }, { x: 10, y: 4 }, { x: 10, y: 0 }];
    expect(polygonAreaPx(cw)).toBeCloseTo(40, 6);
  });

  it('rasterises a square to about its true area', () => {
    // Half the width and half the height of a 100x100 image, at size 100:
    // a 50x50 square, so about 2500 pixels.
    const sq = [{ x: 25, y: 25 }, { x: 75, y: 25 }, { x: 75, y: 75 }, { x: 25, y: 75 }];
    const mask = rasterisePolygon(sq, 100, 100, 100);
    const filled = mask.reduce((s, v) => s + v, 0);
    expect(filled).toBeGreaterThan(2300);
    expect(filled).toBeLessThan(2700);
  });

  it('fills nothing for a degenerate contour', () => {
    expect(rasterisePolygon([{ x: 1, y: 1 }], 10, 10, 10).reduce((s, v) => s + v, 0)).toBe(0);
  });
});

describe('registration gate', () => {
  beforeEach(() => registerComputerVisionProvider(NULL_PROVIDER));

  it('registers nothing when the deployment has declared no model', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    expect(initTissueModelFromEnv({})).toBe(false);
    expect(getComputerVisionProvider()).toBe(NULL_PROVIDER);
    warn.mockRestore();
  });

  it('leaves the honest refusal in place while nothing is registered', async () => {
    expect(tissueAnalysisAvailable('graft_viability')).toBe(false);
    const r = await analyseTissue({
      query: 'graft_viability', imageData: { width: 1, height: 1, data: new Uint8ClampedArray(4) } as ImageData,
    });
    expect(r.status).toBe('unavailable');
    if (r.status === 'unavailable') {
      expect(r.reason).toMatch(/no validated tissue-classification model is registered/i);
      // The refusal has to tell the clinician what to do instead.
      expect(r.guidance).toMatch(/clinical/i);
    }
  });

  it('registers a declared model and warns that it is unvalidated', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const info = vi.spyOn(console, 'info').mockImplementation(() => {});
    const ok = initTissueModelFromEnv({
      VITE_TISSUE_MODEL_URL: '/models/t/model.json',
      VITE_TISSUE_MODEL_CLASSES: 'background,viable,nonviable',
      VITE_TISSUE_MODEL_NAME: 'probe', VITE_TISSUE_MODEL_VERSION: '0.1',
      VITE_TISSUE_MODEL_MAE_PP: '14.3',
    });
    expect(ok).toBe(true);
    const p = getComputerVisionProvider();
    expect(p.name).toBe('probe');
    expect(p.isValidated).toBe(false);
    expect(warn.mock.calls.flat().join(' ')).toMatch(/NOT declared clinically validated/);
    // And separately, that its error is too wide to be decisive.
    expect(warn.mock.calls.flat().join(' ')).toMatch(/percentage points/);
    warn.mockRestore(); info.mockRestore();
    registerComputerVisionProvider(NULL_PROVIDER);
  });

  it('honours the declared supported queries', () => {
    const info = vi.spyOn(console, 'info').mockImplementation(() => {});
    initTissueModelFromEnv({
      VITE_TISSUE_MODEL_URL: '/m.json',
      VITE_TISSUE_MODEL_CLASSES: 'background,epithelialized',
      VITE_TISSUE_MODEL_SUPPORTS: 'donor_epithelialization',
    });
    expect(tissueAnalysisAvailable('donor_epithelialization')).toBe(true);
    expect(tissueAnalysisAvailable('graft_viability')).toBe(false);
    info.mockRestore();
    registerComputerVisionProvider(NULL_PROVIDER);
  });

  it('turns a provider that throws into a refusal, not a crash', async () => {
    registerComputerVisionProvider({
      name: 'broken', version: '1', isValidated: false,
      supports: () => true,
      analyse: async () => { throw new Error('CUDA is on fire'); },
    });
    const r = await analyseTissue({
      query: 'graft_viability', imageData: { width: 1, height: 1, data: new Uint8ClampedArray(4) } as ImageData,
    });
    expect(r.status).toBe('unavailable');
    if (r.status === 'unavailable') expect(r.reason).toMatch(/CUDA is on fire/);
    registerComputerVisionProvider(NULL_PROVIDER);
  });
});
