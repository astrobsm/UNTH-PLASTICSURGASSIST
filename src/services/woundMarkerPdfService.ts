/**
 * Printable calibration marker sheets for AI wound measurement.
 *
 * Generated with jsPDF in MILLIMETRE units rather than rendered from HTML.
 * That is the point: a rectangle placed at 50 mm in a mm-unit PDF is exactly
 * 50 mm on paper when printed at 100%, whereas CSS millimetres go through the
 * browser's DPI assumptions and its print scaling before they reach the page.
 * The marker's whole purpose is to carry a known length, so the length has to
 * survive printing.
 *
 * Two pages, one marker size each, tiled to fill the sheet with cut lines
 * between them — a unit gets a page of markers, not one marker per print.
 *
 * The dimensions here are not arbitrary. detectGreenMarkers() in
 * aiWoundMeasurement identifies which marker it is from the ratio of length to
 * width, so the two must be far enough apart that an oblique photograph cannot
 * turn one into the other:
 *
 *    50 x 10 mm  → aspect  5  → read as  5 cm   (bucket: aspect 3-8)
 *   100 x 10 mm  → aspect 10  → read as 10 cm   (bucket: aspect > 8)
 *
 * The colour is likewise chosen against the detector's own thresholds — see
 * MARKER_RGB below.
 */

import { createPDF } from '../utils/pdfUtils';

/**
 * RGB(0,160,0): hue exactly 120°, saturation 100%, value 63%.
 *
 * detectGreenMarkers accepts hue 80-160 with saturation above 30 and value
 * above 25. This sits at the centre of that window, so print variation, ward
 * lighting and camera white balance all have room to move without pushing the
 * marker out of range. Skin, blood, slough and granulation carry no green of
 * this hue, so the marker cannot be confused with the wound.
 */
export const MARKER_RGB = { r: 0, g: 160, b: 0 };

export interface MarkerSpec {
  /** Real length in centimetres — what the app will read this marker as. */
  cm: number;
  widthMm: number;
  heightMm: number;
  label: string;
}

export const MARKER_5CM: MarkerSpec = { cm: 5, widthMm: 50, heightMm: 10, label: '5 cm' };
export const MARKER_10CM: MarkerSpec = { cm: 10, widthMm: 100, heightMm: 10, label: '10 cm' };

const A4 = { width: 210, height: 297 };
const PAGE_MARGIN = 8;      // mm — inside the printer's unprintable border
const HEADER_HEIGHT = 16;   // mm reserved for the page title
const GUTTER = 4;           // mm of white around each marker, for scissors

export interface TileLayout {
  columns: number;
  rows: number;
  cellWidth: number;
  cellHeight: number;
  total: number;
  /** Left offset that centres the block of cells on the page. */
  offsetX: number;
}

/**
 * How many markers fit, and where the block sits.
 *
 * Exported and pure so the arithmetic can be tested — an off-by-one here prints
 * a marker half off the page, which is only discovered after printing.
 */
export function computeTileLayout(spec: MarkerSpec, page = A4): TileLayout {
  const cellWidth = spec.widthMm + GUTTER * 2;
  const cellHeight = spec.heightMm + GUTTER * 2;

  const usableWidth = page.width - PAGE_MARGIN * 2;
  const usableHeight = page.height - PAGE_MARGIN * 2 - HEADER_HEIGHT;

  const columns = Math.max(1, Math.floor(usableWidth / cellWidth));
  const rows = Math.max(1, Math.floor(usableHeight / cellHeight));

  const blockWidth = columns * cellWidth;
  const offsetX = PAGE_MARGIN + Math.max(0, (usableWidth - blockWidth) / 2);

  return { columns, rows, cellWidth, cellHeight, total: columns * rows, offsetX };
}

function drawSheet(doc: any, spec: MarkerSpec, pageLabel: string): void {
  const layout = computeTileLayout(spec);

  // ── Header ──
  doc.setTextColor(0, 0, 0);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.text(`Wound calibration markers — ${spec.label}`, PAGE_MARGIN, PAGE_MARGIN + 5);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.5);
  doc.text(
    `${spec.widthMm} x ${spec.heightMm} mm. PRINT AT 100% — no "fit to page". ` +
    `Check with a ruler: the green block must measure exactly ${spec.widthMm} mm. ${pageLabel}`,
    PAGE_MARGIN,
    PAGE_MARGIN + 10
  );

  const top = PAGE_MARGIN + HEADER_HEIGHT;

  for (let row = 0; row < layout.rows; row++) {
    for (let col = 0; col < layout.columns; col++) {
      const cellX = layout.offsetX + col * layout.cellWidth;
      const cellY = top + row * layout.cellHeight;

      // Cut line around the whole cell, so a cut anywhere on it leaves the
      // marker intact with a white margin.
      doc.setDrawColor(170, 170, 170);
      doc.setLineWidth(0.1);
      doc.rect(cellX, cellY, layout.cellWidth, layout.cellHeight);

      // The marker itself, inset by the gutter.
      doc.setFillColor(MARKER_RGB.r, MARKER_RGB.g, MARKER_RGB.b);
      doc.rect(cellX + GUTTER, cellY + GUTTER, spec.widthMm, spec.heightMm, 'F');
    }
  }

  // Footer: what this page is, in case a single marker is found loose later.
  doc.setFontSize(6.5);
  doc.setTextColor(120, 120, 120);
  doc.text(
    `${layout.columns} x ${layout.rows} = ${layout.total} markers · ` +
    `colour #00A000 · Plastic Surgery Unit, UNTH Enugu · cut along the grey lines`,
    PAGE_MARGIN,
    A4.height - PAGE_MARGIN
  );
}

/**
 * Build the two-page sheet: 5 cm markers on page one, 10 cm on page two.
 *
 * Returns the document rather than saving it, so callers can save, open or
 * attach it.
 */
export function buildMarkerSheet(): any {
  const doc = createPDF('portrait');

  drawSheet(doc, MARKER_5CM, 'Page 1 of 2 — use for most wounds.');
  doc.addPage();
  drawSheet(doc, MARKER_10CM, 'Page 2 of 2 — use when the wound exceeds about 10 cm.');

  return doc;
}

/** Generate and download the marker sheet. */
export function downloadMarkerSheet(): void {
  buildMarkerSheet().save('wound-calibration-markers.pdf');
}
