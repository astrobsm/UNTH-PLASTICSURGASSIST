/**
 * Symbol-to-text conversion for printed and exported documents.
 *
 * WHY THIS EXISTS — two distinct problems, often confused:
 *
 * 1. ENCODING. An HTML document built as a blob and printed by the browser is
 *    decoded using the document's declared charset. With no `<meta charset>`
 *    and no charset on the blob's MIME type, the browser falls back to a locale
 *    default (Windows-1252 here), so UTF-8 bytes are read as Latin-1 and a
 *    phone glyph renders as "ðŸ“ž". That is fixed by declaring the charset —
 *    see printDocument() — NOT by removing characters.
 *
 * 2. LEGIBILITY. Even correctly encoded, emoji and arrows are a poor fit for a
 *    printed clinical document: they render inconsistently across print
 *    drivers and PDF engines, they carry no meaning to a reader working from a
 *    photocopy, and a phone icon is simply less clear than "Tel:".
 *
 * This module addresses (2). Meaningful symbols become real words; decorative
 * emoji are dropped. Letters are NEVER transliterated — an "ö" in a patient or
 * staff name must survive intact, which is why this is an explicit symbol map
 * rather than an ASCII filter.
 */

/** Symbols that carry meaning, and the text that carries it as well or better. */
const SYMBOL_TEXT: Record<string, string> = {
  // Contact
  '\u{1F4DE}': 'Tel:',   // telephone receiver
  '☎': 'Tel:',      // black telephone
  '\u{1F4F1}': 'Mobile:',
  '✉': 'Email:',

  // Arrows — spelled out, since a printed arrow loses its referent
  '→': '->',
  '←': '<-',
  '↑': 'as above',
  '↓': 'as below',
  '⇒': '=>',
  '⇐': '<=',

  // Dashes and bullets
  '—': '-',   // em dash
  '–': '-',   // en dash
  '‐': '-',
  '‑': '-',
  '‒': '-',
  '―': '-',
  '−': '-',   // minus sign
  '•': '-',   // bullet
  '●': '-',
  '○': '-',
  '▪': '-',
  '·': '-',

  // Status marks
  '✓': 'Yes',
  '✔': 'Yes',
  '✅': 'Yes',
  '✗': 'No',
  '✘': 'No',
  '❌': 'No',
  '⚠': 'Warning:',
  '❗': 'Important:',
  '☐': '[ ]',
  '☑': '[x]',
  '☒': '[x]',

  // Clinical and mathematical operators — these change meaning if dropped
  '≥': '>=',
  '≤': '<=',
  '≠': '!=',
  '±': '+/-',
  '×': 'x',
  '÷': '/',
  '°': ' deg',
  'µ': 'u',    // micro sign, e.g. umol/L
  'μ': 'u',    // Greek mu, often used interchangeably
  '′': "'",
  '″': '"',

  // Superscripts that appear in units (cm2, m3)
  '²': '2',
  '³': '3',
  '¹': '1',
  '⁰': '0',
  '⁴': '4',
  '⁵': '5',
  '⁶': '6',
  '⁷': '7',
  '⁸': '8',
  '⁹': '9',

  // Fractions
  '¼': '1/4',
  '½': '1/2',
  '¾': '3/4',

  // Typographic punctuation
  '“': '"',
  '”': '"',
  '„': '"',
  '‟': '"',
  '‘': "'",
  '’': "'",
  '‚': "'",
  '‛': "'",
  '…': '...',
  '©': '(c)',
  '®': '(R)',
  '™': '(TM)',
  ' ': ' ',   // non-breaking space
};

// Decorative pictographs: no text equivalent worth printing, so they are removed
// rather than mapped. Ranges cover emoji, dingbats, transport, flags and the
// supplemental symbols block that holds newer medical pictographs.
const DECORATIVE_RANGES = [
  /[\u{1F300}-\u{1F5FF}]/gu, // misc symbols & pictographs
  /[\u{1F600}-\u{1F64F}]/gu, // emoticons
  /[\u{1F680}-\u{1F6FF}]/gu, // transport & map
  /[\u{1F900}-\u{1F9FF}]/gu, // supplemental symbols
  /[\u{1FA70}-\u{1FAFF}]/gu, // extended-A (includes medical pictographs)
  /[\u{1F1E6}-\u{1F1FF}]/gu, // regional indicators (flags)
  /[✀-➿]/gu,       // dingbats
  /[⬀-⯿]/gu,       // misc symbols & arrows
  /[\u{1F000}-\u{1F02F}]/gu, // mahjong/dominoes
];

/**
 * Convert a string for printed output: meaningful symbols become words,
 * decorative emoji are removed, letters and accents are preserved.
 *
 * Safe for HTML print documents (where the charset is correct and accented
 * letters render properly) and used as the first stage of PDF sanitisation.
 */
export function toPrintableText(input: string | null | undefined): string {
  if (input === null || input === undefined) return '';
  let out = typeof input === 'string' ? input : String(input);

  // NFC, not NFKC: NFKC would rewrite superscripts and ligatures before the map
  // below can give them a sensible spelling, and would alter some names.
  out = out.normalize('NFC');

  // Zero-width and bidirectional formatting characters: invisible on screen,
  // but they survive into PDFs as stray boxes.
  // Strips zero-width and bidirectional marks, a byte-order mark and a soft
  // hyphen — none of which a thermal printer renders, and all of which have
  // to appear here to be removed.
  // eslint-disable-next-line no-irregular-whitespace
  out = out.replace(/[​-‏‪-‮⁠-⁯﻿­]/g, '');

  // Variation selectors and the keycap combiner, which otherwise leave orphans
  // behind once their base emoji is removed.
  out = out.replace(/[︀-️⃣]/g, '');

  // Zero-width joiner sequences (e.g. multi-part profession emoji) must go as a
  // unit before individual codepoints are stripped, or fragments remain.
  out = out.replace(/\p{Extended_Pictographic}(‍\p{Extended_Pictographic})+/gu, '');

  for (const [symbol, text] of Object.entries(SYMBOL_TEXT)) {
    if (out.includes(symbol)) out = out.split(symbol).join(text);
  }

  for (const range of DECORATIVE_RANGES) out = out.replace(range, '');

  // Any remaining pictographic character with no mapping.
  out = out.replace(/\p{Extended_Pictographic}/gu, '');

  // Control characters, keeping the whitespace that carries layout.
  // Control characters are the subject of this pattern: it removes the ones a PDF or thermal printer cannot render.
  // eslint-disable-next-line no-control-regex
  out = out.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '');

  // Collapse the runs of spaces left behind by removed glyphs, and tidy the
  // space that a removed leading icon leaves before its label.
  out = out.replace(/[^\S\r\n]{2,}/g, ' ');
  out = out.replace(/([([]) +/g, '$1');
  out = out.replace(/ +([),\].:;])/g, '$1');

  return out.trim();
}

/**
 * Build a complete, correctly-encoded HTML document for printing.
 *
 * The charset is declared in BOTH places it can be read from — the meta tag and
 * the blob's MIME type — because a browser opening a blob URL may consult
 * either, and omitting them is what produced "ðŸ“ž" in place of a phone number.
 *
 * Pass the body already converted with toPrintableText() where it contains
 * symbols; this function does not transform content, so that callers keep
 * control over markup.
 */
export function buildPrintDocument(title: string, headContent: string, bodyContent: string): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${title}</title>
${headContent}
</head>
<body>
${bodyContent}
</body>
</html>`;
}

/**
 * Open a print document in a new window and trigger the print dialog.
 *
 * Centralises the charset-tagged blob so no caller can reintroduce the encoding
 * bug, and revokes the object URL once printing has started rather than leaking
 * it for the life of the tab.
 */
export function openPrintWindow(html: string): Window | null {
  const blob = new Blob([html], { type: 'text/html;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const printWindow = window.open(url, '_blank');

  if (printWindow) {
    printWindow.onload = () => {
      setTimeout(() => {
        printWindow.print();
        // Give the print dialog time to read the document before releasing it.
        setTimeout(() => URL.revokeObjectURL(url), 10_000);
      }, 500);
    };
  } else {
    // Pop-up blocked: release immediately rather than leaking the blob.
    URL.revokeObjectURL(url);
  }

  return printWindow;
}
