/**
 * Getting a prescription off the screen and into a patient's hand.
 *
 * Two outputs, because they are read in different places. The 80 mm slip is
 * what comes out of the thermal printer at the dispensing point and goes home
 * with the patient — narrow, no colour, no images, and every instruction short
 * enough to survive the width. The A4 sheet is the copy that goes in the notes
 * and carries the fuller detail.
 *
 * Both say the same thing about each drug: what it is, how to take it, and what
 * to expect from it. A slip that lists a drug and a dose but not how to take it
 * leaves the patient to invent the rest, which they will.
 */

import { format } from 'date-fns';
import {
  createPDF, sanitizeTextForPDF, PDF_MARGINS, PDF_FONT_SIZES, PDF_COLORS,
} from '../utils/pdfUtils';
import { howToTake, sideEffectsLine, frequencyInWords, findDrug } from '../data/prescribingCatalogue';

/** One prescribed item, as the builder produces it. */
export interface PrescriptionItem {
  drugId: string;
  /** Kept alongside the id so a slip still prints if the catalogue moves on. */
  name: string;
  strength?: string;
  dose: string;
  route: string;
  frequency: string;
  duration?: string;
  quantity?: string;
  notes?: string;
}

export interface PrescriptionDocument {
  patient: {
    name: string;
    hospitalNumber?: string;
    age?: string | number;
    sex?: string;
    ward?: string;
    allergies?: string;
  };
  prescriber: { name: string; role?: string };
  items: PrescriptionItem[];
  issuedAt?: Date;
  notes?: string;
}

const clean = (t?: string | null) => sanitizeTextForPDF(t || '');

/** The dose line every output shares, so they cannot disagree. */
export function doseLine(item: PrescriptionItem): string {
  return [
    item.dose,
    item.strength && !item.dose.includes(item.strength) ? `(${item.strength})` : null,
    item.route,
    frequencyInWords(item.frequency),
    item.duration ? `for ${item.duration}` : null,
  ].filter(Boolean).join(' · ');
}

// ─── 80 mm thermal ──────────────────────────────────────────────────────────

/**
 * The dispensing slip.
 *
 * Rendered as HTML in a hidden window and printed, rather than as a PDF: a
 * thermal printer is driven through the browser's own print path, and an 80 mm
 * page there means an 80 mm roll. Monospace, because thermal print heads render
 * proportional fonts unevenly at this width.
 *
 * 72 mm of printable width inside the roll's own margins, which is what the
 * common 80 mm printers actually give.
 */
export function printThermalSlip(doc: PrescriptionDocument): void {
  const issued = doc.issuedAt ?? new Date();
  const rule = '-'.repeat(32);

  const items = doc.items.map((item, i) => {
    const drug = findDrug(item.drugId);
    const how = drug ? howToTake(drug, item.frequency, item.route, item.duration) : '';
    const effects = drug ? sideEffectsLine(drug) : '';
    return `
      <div class="item">
        <div class="name">${i + 1}. ${esc(item.name)}</div>
        <div class="dose">${esc(doseLine(item))}</div>
        ${item.quantity ? `<div class="qty">Supply: ${esc(item.quantity)}</div>` : ''}
        ${how ? `<div class="how">How: ${esc(how)}</div>` : ''}
        ${effects ? `<div class="se">Effects: ${esc(effects)}</div>` : ''}
        ${item.notes ? `<div class="note">Note: ${esc(item.notes)}</div>` : ''}
      </div>`;
  }).join('');

  const html = `<!doctype html>
<html><head><meta charset="utf-8"><title>Prescription</title>
<style>
  /* An 80 mm roll, with the margins the printer takes for itself. */
  @page { size: 80mm auto; margin: 3mm; }
  * { box-sizing: border-box; }
  body {
    width: 72mm; margin: 0; padding: 0;
    font-family: "Courier New", Courier, monospace;
    font-size: 9.5pt; line-height: 1.35; color: #000;
  }
  .centre { text-align: center; }
  .unit { font-weight: bold; font-size: 10.5pt; }
  .small { font-size: 8pt; }
  .rule { white-space: pre; margin: 3px 0; }
  .kv { display: flex; gap: 4px; }
  .kv span:first-child { font-weight: bold; }
  .item { margin: 5px 0; page-break-inside: avoid; }
  .name { font-weight: bold; text-transform: uppercase; }
  .dose { margin-left: 3mm; }
  .qty, .how, .se, .note { margin-left: 3mm; font-size: 8pt; }
  .se { font-style: italic; }
  .allergy { font-weight: bold; border: 1px solid #000; padding: 2px; margin: 3px 0; }
  .sign { margin-top: 8mm; }
  /* Long words must wrap rather than run off a roll that cannot scroll. */
  body, div { overflow-wrap: anywhere; word-break: break-word; }
</style></head>
<body>
  <div class="centre unit">UNTH ITUKU-OZALLA</div>
  <div class="centre small">Plastic &amp; Reconstructive Surgery</div>
  <div class="centre small">PRESCRIPTION</div>
  <div class="rule">${rule}</div>

  <div class="kv"><span>Patient:</span><span>${esc(doc.patient.name)}</span></div>
  ${doc.patient.hospitalNumber ? `<div class="kv"><span>No:</span><span>${esc(doc.patient.hospitalNumber)}</span></div>` : ''}
  ${doc.patient.age || doc.patient.sex ? `<div class="kv"><span>Age/Sex:</span><span>${esc(String(doc.patient.age ?? '—'))} / ${esc(doc.patient.sex ?? '—')}</span></div>` : ''}
  ${doc.patient.ward ? `<div class="kv"><span>Ward:</span><span>${esc(doc.patient.ward)}</span></div>` : ''}
  <div class="kv"><span>Date:</span><span>${format(issued, 'dd MMM yyyy HH:mm')}</span></div>

  ${doc.patient.allergies
    ? `<div class="allergy">ALLERGIES: ${esc(doc.patient.allergies)}</div>`
    : '<div class="small">Allergies: none recorded</div>'}

  <div class="rule">${rule}</div>
  ${items || '<div class="small">No medicines prescribed.</div>'}
  <div class="rule">${rule}</div>

  ${doc.notes ? `<div class="small">${esc(doc.notes)}</div><div class="rule">${rule}</div>` : ''}

  <div class="sign small">
    <div>Prescriber: ${esc(doc.prescriber.name)}</div>
    ${doc.prescriber.role ? `<div>${esc(doc.prescriber.role)}</div>` : ''}
    <div style="margin-top:6mm">Signature: ______________</div>
  </div>
  <div class="centre small" style="margin-top:4mm">Keep out of reach of children</div>
</body></html>`;

  openAndPrint(html);
}

/**
 * Prints without navigating away from the record.
 *
 * A hidden iframe rather than window.open: a popup blocker silently swallows
 * the second, and a clinician who pressed print and saw nothing happen has no
 * way of telling why.
 */
function openAndPrint(html: string): void {
  const frame = document.createElement('iframe');
  frame.setAttribute('aria-hidden', 'true');
  frame.style.cssText = 'position:fixed;right:0;bottom:0;width:0;height:0;border:0;';
  document.body.appendChild(frame);

  const w = frame.contentWindow;
  if (!w) { document.body.removeChild(frame); return; }

  w.document.open();
  w.document.write(html);
  w.document.close();

  // Printed after layout settles, or the first line can be clipped.
  const go = () => {
    try { w.focus(); w.print(); } finally {
      // Left in place briefly: removing it during the print dialog cancels the job.
      setTimeout(() => { if (frame.parentNode) document.body.removeChild(frame); }, 60_000);
    }
  };
  if (w.document.readyState === 'complete') setTimeout(go, 120);
  else frame.onload = () => setTimeout(go, 120);
}

function esc(s: string): string {
  return String(s).replace(/[&<>"']/g, (c) => (
    { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c] as string
  ));
}

// ─── A4 PDF ─────────────────────────────────────────────────────────────────

/** The copy for the notes, with the fuller detail the slip cannot hold. */
export function generatePrescriptionPdf(doc: PrescriptionDocument): void {
  const pdf = createPDF();
  const pageWidth = pdf.internal.pageSize.getWidth();
  const pageHeight = pdf.internal.pageSize.getHeight();
  const margin = PDF_MARGINS.left;
  const maxWidth = pageWidth - margin - PDF_MARGINS.right;
  const issued = doc.issuedAt ?? new Date();
  let y = 15;

  pdf.setFillColor(PDF_COLORS.primary.r, PDF_COLORS.primary.g, PDF_COLORS.primary.b);
  pdf.rect(0, 0, pageWidth, 26, 'F');
  pdf.setTextColor(255, 255, 255);
  pdf.setFontSize(PDF_FONT_SIZES.title);
  pdf.text('PRESCRIPTION', margin, 12);
  pdf.setFontSize(PDF_FONT_SIZES.small);
  pdf.text('UNTH Ituku-Ozalla · Plastic & Reconstructive Surgery', margin, 19);
  pdf.setTextColor(0, 0, 0);
  y = 34;

  pdf.setFontSize(PDF_FONT_SIZES.body);
  const header = [
    `Patient: ${clean(doc.patient.name)}`,
    doc.patient.hospitalNumber ? `Hospital no: ${clean(doc.patient.hospitalNumber)}` : null,
    doc.patient.age || doc.patient.sex ? `Age/Sex: ${doc.patient.age ?? '—'} / ${doc.patient.sex ?? '—'}` : null,
    doc.patient.ward ? `Ward: ${clean(doc.patient.ward)}` : null,
    `Date: ${format(issued, 'dd MMM yyyy HH:mm')}`,
  ].filter(Boolean) as string[];
  for (const line of header) { pdf.text(line, margin, y); y += 5; }

  // Allergies are boxed, because this is the line that stops a prescription.
  y += 2;
  if (doc.patient.allergies) {
    pdf.setDrawColor(200, 0, 0);
    pdf.setFillColor(255, 240, 240);
    pdf.rect(margin, y - 4, maxWidth, 8, 'FD');
    pdf.setTextColor(160, 0, 0);
    pdf.text(`ALLERGIES: ${clean(doc.patient.allergies)}`, margin + 2, y + 1);
    pdf.setTextColor(0, 0, 0);
    y += 12;
  } else {
    pdf.setFontSize(PDF_FONT_SIZES.small);
    pdf.text('Allergies: none recorded', margin, y);
    y += 8;
  }

  doc.items.forEach((item, i) => {
    const drug = findDrug(item.drugId);
    const how = drug ? howToTake(drug, item.frequency, item.route, item.duration) : '';
    const effects = drug ? sideEffectsLine(drug) : '';

    const block: Array<[string, number, boolean]> = [
      [`${i + 1}. ${clean(item.name)}`, PDF_FONT_SIZES.body, true],
      [`    ${clean(doseLine(item))}`, PDF_FONT_SIZES.body, false],
    ];
    if (item.quantity) block.push([`    Supply: ${clean(item.quantity)}`, PDF_FONT_SIZES.small, false]);
    if (how) block.push([`    How to take: ${clean(how)}`, PDF_FONT_SIZES.small, false]);
    if (effects) block.push([`    Side effects: ${clean(effects)}`, PDF_FONT_SIZES.small, false]);
    if (item.notes) block.push([`    Note: ${clean(item.notes)}`, PDF_FONT_SIZES.small, false]);

    for (const [text, size, bold] of block) {
      pdf.setFontSize(size);
      pdf.setFont('helvetica', bold ? 'bold' : 'normal');
      const wrapped = pdf.splitTextToSize(text, maxWidth) as string[];
      for (const line of wrapped) {
        // A drug split across a page break is a dispensing error waiting to happen.
        if (y > pageHeight - 30) { pdf.addPage(); y = 20; }
        pdf.text(line, margin, y);
        y += size <= PDF_FONT_SIZES.small ? 4.2 : 5;
      }
    }
    pdf.setFont('helvetica', 'normal');
    y += 3;
  });

  if (doc.notes) {
    if (y > pageHeight - 40) { pdf.addPage(); y = 20; }
    pdf.setFontSize(PDF_FONT_SIZES.small);
    for (const line of pdf.splitTextToSize(`Notes: ${clean(doc.notes)}`, maxWidth) as string[]) {
      pdf.text(line, margin, y); y += 4.2;
    }
  }

  if (y > pageHeight - 34) { pdf.addPage(); y = 20; }
  y += 8;
  pdf.setFontSize(PDF_FONT_SIZES.body);
  pdf.text(`Prescriber: ${clean(doc.prescriber.name)}`, margin, y);
  if (doc.prescriber.role) {
    pdf.setFontSize(PDF_FONT_SIZES.small);
    pdf.text(clean(doc.prescriber.role), margin, y + 4.5);
  }
  pdf.setDrawColor(120, 120, 120);
  pdf.line(pageWidth - margin - 55, y + 10, pageWidth - margin, y + 10);
  pdf.setFontSize(PDF_FONT_SIZES.small);
  pdf.text('Signature & date', pageWidth - margin - 55, y + 14);

  const safeName = (doc.patient.name || 'patient').replace(/[^a-z0-9]+/gi, '-').toLowerCase();
  pdf.save(`prescription-${safeName}-${format(issued, 'yyyyMMdd-HHmm')}.pdf`);
}
