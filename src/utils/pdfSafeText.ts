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

let installed = false;

/**
 * Install the guard. Idempotent, and safe to call before any PDF is created.
 * Called once from main.tsx so coverage does not depend on import order.
 */
export function installPdfTextSanitizer(): void {
  if (installed) return;

  const proto = (jsPDF as unknown as { prototype: Record<string, any> })?.prototype;
  if (!proto || typeof proto.text !== 'function') {
    // Never let a failed patch break PDF generation entirely — an unsanitised
    // PDF is far better than no PDF on a ward.
    console.warn('[pdf] Could not install text sanitizer; jsPDF API not as expected');
    return;
  }
  installed = true;

  const originalText = proto.text;
  proto.text = function patchedText(this: unknown, ...args: unknown[]) {
    // Signature is text(text, x, y, options) — only the first argument carries
    // content; the rest are coordinates and options and must pass through.
    if (args.length) args[0] = sanitizeArg(args[0]);
    return originalText.apply(this, args as never);
  };

  // splitTextToSize measures a string to wrap it. If it measured the raw text
  // while text() rendered the sanitised version, line breaks would be computed
  // for characters that never appear, so wrap widths would drift.
  if (typeof proto.splitTextToSize === 'function') {
    const originalSplit = proto.splitTextToSize;
    proto.splitTextToSize = function patchedSplit(this: unknown, ...args: unknown[]) {
      if (args.length) args[0] = sanitizeArg(args[0]);
      return originalSplit.apply(this, args as never);
    };
  }
}
