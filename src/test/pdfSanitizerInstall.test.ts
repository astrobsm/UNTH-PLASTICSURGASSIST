// @vitest-environment jsdom
import { describe, it, expect } from 'vitest';
import { jsPDF } from 'jspdf';
import { sanitizePdfDocument } from '../utils/pdfSafeText';

/**
 * Regression test for a fix that shipped inert.
 *
 * The first version patched jsPDF.prototype.text. In jsPDF v4 that property
 * does not exist — text() is assigned as an OWN PROPERTY of each document
 * inside the constructor — so nothing was ever installed, production logged
 * "jSPDF API not as expected" on every boot, and every PDF went out
 * unsanitised while the unit tests for the string conversion passed happily.
 *
 * These tests exercise a real jsPDF document, which is the only thing that
 * would have caught it.
 */

describe('the assumption that broke the first attempt', () => {
  it('confirms jsPDF does NOT expose text() on its prototype', () => {
    // If a future version changes this, the comment above stops being true and
    // this test should be revisited rather than silently deleted.
    expect(typeof (jsPDF as any).prototype?.text).toBe('undefined');
  });

  it('confirms text() IS an own property of each document', () => {
    const doc = new jsPDF();
    expect(Object.prototype.hasOwnProperty.call(doc, 'text')).toBe(true);
  });
});

describe('sanitizePdfDocument', () => {
  it('converts symbols before they reach the renderer', () => {
    const doc = new jsPDF();
    const captured: unknown[] = [];
    // Replace text() first, then wrap, so the wrapper calls this spy.
    (doc as any).text = (...args: unknown[]) => { captured.push(args[0]); return doc; };

    sanitizePdfDocument(doc);
    doc.text('\u{1F4DE} 08033328385', 10, 10);

    expect(captured[0]).toBe('Tel: 08033328385');
  });

  it('leaves coordinates and options untouched', () => {
    const doc = new jsPDF();
    let seen: unknown[] = [];
    (doc as any).text = (...args: unknown[]) => { seen = args; return doc; };

    sanitizePdfDocument(doc);
    doc.text('plain', 12, 34, { align: 'center' } as any);

    expect(seen[1]).toBe(12);
    expect(seen[2]).toBe(34);
    expect(seen[3]).toEqual({ align: 'center' });
  });

  it('sanitizes each element of an array of lines', () => {
    const doc = new jsPDF();
    let seen: unknown;
    (doc as any).text = (...args: unknown[]) => { seen = args[0]; return doc; };

    sanitizePdfDocument(doc);
    doc.text(['≥ 5 cm', 'area 3 cm²'] as any, 10, 10);

    expect(seen).toEqual(['>= 5 cm', 'area 3 cm2']);
  });

  it('sanitizes splitTextToSize so wrap widths match what is rendered', () => {
    const doc = new jsPDF();
    let measured: unknown;
    (doc as any).splitTextToSize = (...args: unknown[]) => { measured = args[0]; return ['x']; };

    sanitizePdfDocument(doc);
    doc.splitTextToSize('\u{1F4DE} 0803', 100);

    expect(measured).toBe('Tel: 0803');
  });

  it('is idempotent — wrapping twice does not double-convert', () => {
    const doc = new jsPDF();
    const captured: unknown[] = [];
    (doc as any).text = (...args: unknown[]) => { captured.push(args[0]); return doc; };

    sanitizePdfDocument(doc);
    sanitizePdfDocument(doc);
    doc.text('≤ 3', 10, 10);

    expect(captured).toHaveLength(1);
    expect(captured[0]).toBe('<= 3');
  });

  it('tolerates a document missing the methods rather than throwing', () => {
    // A PDF that renders unsanitised beats no PDF at all on a ward.
    expect(() => sanitizePdfDocument({} as any)).not.toThrow();
    expect(() => sanitizePdfDocument(null as any)).not.toThrow();
  });
});

describe('createPDF wires the guard for its callers', () => {
  it('returns a document that is already wrapped', async () => {
    const { createPDF } = await import('../utils/pdfUtils');
    const doc = createPDF();

    // The marker is what sanitizePdfDocument sets; its presence is direct
    // evidence the factory applied the guard, not an inference from behaviour.
    expect((doc as any)[Symbol.for('psa.pdfTextSanitized')]).toBe(true);
  });

  it('every direct `new jsPDF()` site also wraps its document', async () => {
    // The factory is not the only construction path — 19 modules build their
    // own document. This asserts the sweep that wrapped them stayed done,
    // since a new PDF module added without the call would silently regress.
    const { readFileSync, readdirSync, statSync } = await import('node:fs');
    const { join } = await import('node:path');

    const walk = (dir: string, out: string[] = []): string[] => {
      for (const entry of readdirSync(dir)) {
        const p = join(dir, entry);
        if (statSync(p).isDirectory()) walk(p, out);
        else if (/\.tsx?$/.test(entry)) out.push(p);
      }
      return out;
    };

    const offenders = walk('src')
      .filter(f => !f.includes('pdfUtils') && !f.includes('pdfSafeText') && !f.includes('test'))
      .filter(f => {
        const s = readFileSync(f, 'utf8');
        return s.includes('new jsPDF(') && !s.includes('sanitizePdfDocument');
      });

    expect(offenders).toEqual([]);
  });
});
