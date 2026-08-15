/**
 * Document AI response handling.
 *
 * The network call is not tested here — the pure parsing is, because that is
 * where a wrong assumption about the response shape would silently produce
 * empty text or a fabricated confidence.
 *
 * Fixtures follow the documented v1 `Document` shape: a single `text` string
 * with blocks and tokens referring into it by character offset. Getting those
 * offsets wrong is the classic way to slice the wrong words out of a report.
 */

import { describe, it, expect } from 'vitest';
// Plain JS module shared with the serverless functions.
import { averageConfidence, extractBlocks, stripDataUrl } from '../../api/_lib/documentAi.js';

const doc = {
  text: 'HAEMOGLOBIN 9.4 g/dL\nWBC 14.2',
  pages: [{
    tokens: [
      { layout: { confidence: 0.98 } },
      { layout: { confidence: 0.94 } },
      { layout: { confidence: 0.90 } },
    ],
    blocks: [
      {
        layout: {
          confidence: 0.97,
          textAnchor: { textSegments: [{ startIndex: 0, endIndex: 20 }] },
          boundingPoly: { normalizedVertices: [{ x: 0.1, y: 0.1 }, { x: 0.9, y: 0.1 }] },
        },
      },
      {
        layout: {
          confidence: 0.91,
          textAnchor: { textSegments: [{ startIndex: 21, endIndex: 29 }] },
          boundingPoly: { normalizedVertices: [] },
        },
      },
    ],
  }],
};

describe('stripDataUrl', () => {
  it('removes a data URL prefix', () => {
    expect(stripDataUrl('data:image/jpeg;base64,AAAB')).toBe('AAAB');
  });

  it('leaves raw base64 untouched', () => {
    expect(stripDataUrl('AAAB')).toBe('AAAB');
  });

  it('does not truncate base64 that happens to contain a comma-free prefix', () => {
    const raw = 'iVBORw0KGgoAAAANSUhEUg';
    expect(stripDataUrl(raw)).toBe(raw);
  });

  it('handles non-string input rather than throwing', () => {
    expect(stripDataUrl(undefined as any)).toBe('');
    expect(stripDataUrl(null as any)).toBe('');
  });
});

describe('averageConfidence', () => {
  it('averages the per-token confidences', () => {
    // The API reports confidence per token, not per page; the mean is a summary
    // and the code should not pretend otherwise by inventing a page-level value.
    expect(averageConfidence(doc)).toBeCloseTo((0.98 + 0.94 + 0.90) / 3, 6);
  });

  it('is zero when there are no tokens, not NaN', () => {
    // A NaN confidence would compare false against every threshold and let a
    // failed read through as though it had passed.
    expect(averageConfidence({ pages: [{ tokens: [] }] })).toBe(0);
    expect(averageConfidence({})).toBe(0);
    expect(averageConfidence(null)).toBe(0);
  });

  it('ignores tokens with no confidence rather than counting them as zero', () => {
    const partial = { pages: [{ tokens: [{ layout: { confidence: 0.9 } }, { layout: {} }] }] };
    expect(averageConfidence(partial)).toBeCloseTo(0.9, 6);
  });
});

describe('extractBlocks', () => {
  it('slices each block out of the document text by offset', () => {
    const blocks = extractBlocks(doc);
    expect(blocks).toHaveLength(2);
    expect(blocks[0].text).toBe('HAEMOGLOBIN 9.4 g/dL');
    expect(blocks[1].text).toBe('WBC 14.2');
  });

  it('carries confidence and bounding boxes through', () => {
    const blocks = extractBlocks(doc);
    expect(blocks[0].confidence).toBe(0.97);
    expect(blocks[0].boundingBox).toHaveLength(2);
    expect(blocks[0].boundingBox[0]).toEqual({ x: 0.1, y: 0.1 });
  });

  it('skips blocks with no text anchor instead of emitting empty ones', () => {
    const odd = { text: 'abc', pages: [{ blocks: [{ layout: {} }] }] };
    expect(extractBlocks(odd)).toHaveLength(0);
  });

  it('returns nothing for an empty document', () => {
    expect(extractBlocks({})).toEqual([]);
    expect(extractBlocks(null)).toEqual([]);
  });

  it('defaults a missing offset to zero rather than producing undefined slices', () => {
    const partial = {
      text: 'HELLO',
      pages: [{ blocks: [{ layout: { textAnchor: { textSegments: [{ endIndex: 5 }] } } }] }],
    };
    expect(extractBlocks(partial)[0].text).toBe('HELLO');
  });
});
