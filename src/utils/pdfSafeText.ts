/**
 * Global text guard for every jsPDF document in the app.
 *
 * WHY A PROTOTYPE PATCH RATHER THAN FIXING CALL SITES
 * Thirty-plus modules generate PDFs and twenty of them construct `new jsPDF()`
 * directly rather than going through createPDF(), so there is no single factory
 * to intercept. Sanitising at each call site means editing them all and relying
 * on the next person who adds a PDF export to remember — which is precisely how
 * the emoji reached the printed roster in the first place. Patching
 * jsPDF.prototype.text once covers every existing and future document.
 *
 * WHAT IT FIXES
 * jsPDF's built-in fonts (helvetica/times/courier) are encoded WinAnsi. Any
 * codepoint outside that set renders as a wrong glyph or a blank box. Emoji,
 * arrows and typographic dashes are the common offenders. This converts the
 * meaningful ones to words ("Tel:", ">=", "-") and drops the decorative ones,
 * so the printed document says what it means.
 *
 * Accented Latin letters ARE preserved: WinAnsi covers them, so a name like
 * "Björn" prints correctly. Only characters outside that encoding are dropped.
 */

import { jsPDF } from 'jspdf';
import { toPrintableText } from './printText';

/** Characters jsPDF's standard fonts can actually render (WinAnsi ≈ Latin-1). */
// The renderable set is defined by listing it, and tab, newline and carriage
// return belong to that set — so the pattern necessarily contains them.
// eslint-disable-next-line no-control-regex, no-irregular-whitespace
const RENDERABLE = /[^\x09\x0A\x0D\x20-\x7E -ÿ€‚ƒ„…†‡ˆ‰Š‹ŒŽ‘’“”•–—˜™š›œžŸ]/g;

/**
 * Prepare a string for a jsPDF standard font: symbols to words, decorative
 * pictographs removed, then anything still unrenderable dropped.
 */
export function toPdfSafeText(value: unknown): string {
  if (value === null || value === undefined) return '';
  return toPrintableText(String(value))
    .replace(RENDERABLE, '')
    // Dropping a glyph leaves its surrounding space behind, which would print
    // as a stray indent or a double gap mid-sentence.
    .replace(/[^\S\r\n]{2,}/g, ' ')
    .replace(/^[^\S\r\n]+|[^\S\r\n]+$/gm, '');
}

/** Apply to a string, or element-wise to an array, leaving other types alone. */
function sanitizeArg<T>(arg: T): T {
  if (typeof arg === 'string') return toPdfSafeText(arg) as unknown as T;
  if (Array.isArray(arg)) return arg.map(item => (typeof item === 'string' ? toPdfSafeText(item) : item)) as unknown as T;
  return arg;
}

/** Marks a document that has already been wrapped, so it is not wrapped twice. */
const WRAPPED = Symbol.for('psa.pdfTextSanitized');

/**
 * Wrap ONE jsPDF document so its text output is sanitised.
 *
 * Instance-level, not prototype-level, and that is forced by the library: in
 * jsPDF v4 `text` and `splitTextToSize` are assigned as OWN PROPERTIES of each
 * document inside the constructor. jsPDF.prototype.text is undefined, so an
 * earlier attempt to patch the prototype installed nothing and logged
 * "jsPDF API not as expected" on every production boot while every PDF went
 * out unsanitised.
 *
 * Call this on every document. createPDF() and createThermalPDF() do it for
 * their callers; code constructing `new jsPDF()` directly must call it itself.
 */
export function sanitizePdfDocument<T>(doc: T): T {
  const d = doc as unknown as Record<string | symbol, any>;
  if (!d || d[WRAPPED]) return doc;

  if (typeof d.text === 'function') {
    const originalText = d.text.bind(doc);
    // Signature is text(text, x, y, options) — only the first argument carries
    // content; the rest are coordinates and options and must pass through.
    d.text = (...args: unknown[]) => {
      if (args.length) args[0] = sanitizeArg(args[0]);
      return originalText(...args);
    };
  }

  // splitTextToSize measures a string to wrap it. If it measured the raw text
  // while text() rendered the sanitised version, line breaks would be computed
  // for characters that never appear and wrap widths would drift.
  if (typeof d.splitTextToSize === 'function') {
    const originalSplit = d.splitTextToSize.bind(doc);
    d.splitTextToSize = (...args: unknown[]) => {
      if (args.length) args[0] = sanitizeArg(args[0]);
      return originalSplit(...args);
    };
  }

  d[WRAPPED] = true;
  return doc;
}

/**
 * Retained so main.tsx keeps a single obvious call site, and to fail loudly if
 * a future jsPDF version moves these methods back onto the prototype — in which
 * case wrapping instances would still work, but the assumption should be
 * re-checked rather than silently relied upon.
 */
export function installPdfTextSanitizer(): void {
  const proto = (jsPDF as unknown as { prototype?: Record<string, any> })?.prototype;
  if (proto && typeof proto.text === 'function') {
    console.info('[pdf] jsPDF now exposes text() on the prototype; instance wrapping still applies.');
  }
}
