/**
 * Tumor Board PDF generation — standardised on utils/pdfUtils, like the other
 * document services in this codebase.
 *
 * Four documents, each with a different reader in mind:
 *   1. Board summary   — the case record: staging timeline, plan, decisions
 *   2. Referral letter — one per specialty, on its own so it can be sent alone
 *   3. Surveillance    — the follow-up schedule as a dated table
 *   4. Counselling     — written FOR THE PATIENT, deliberately plainer typography
 *
 * The counselling document is set larger and with more leading than the
 * clinical ones. That is not decoration: it is read by people who are
 * frightened, often older, and frequently in poor light on a ward.
 */

import { format } from 'date-fns';
import {
  createPDF,
  sanitizeTextForPDF,
  addFooter,
  PDF_MARGINS,
  PDF_FONT_SIZES,
  PDF_COLORS,
} from '../utils/pdfUtils';
import type { StageResult } from './oncology/stagingEngine';
import type { ManagementPlan } from './oncology/managementPlan';
import { SPECIALTY_LABELS } from './oncology/managementPlan';
import type { ReferralLetter } from './oncology/referralLetters';
import type { SurveillancePlan } from './oncology/surveillance';
import type { CounsellingDocument } from './oncology/counselling';
import type { TumorBoardAssessment, TumorBoardCase } from './tumorBoardService';

const clean = (t: string | undefined | null): string => sanitizeTextForPDF(t || '');

interface DocHeader {
  title: string;
  patientName?: string;
  hospitalNumber?: string;
  diagnosis?: string;
  boardDate?: string;
}

/** Shared banner + patient block. Returns the y position to continue from. */
function header(doc: any, meta: DocHeader, accent = PDF_COLORS.primary): number {
  const pageWidth = doc.internal.pageSize.getWidth();

  doc.setFillColor(accent.r, accent.g, accent.b);
  doc.rect(0, 0, pageWidth, 30, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(PDF_FONT_SIZES.title);
  doc.setFont('times', 'bold');
  doc.text(meta.title.toUpperCase(), pageWidth / 2, 13, { align: 'center' });
  doc.setFontSize(PDF_FONT_SIZES.small);
  doc.setFont('times', 'normal');
  doc.text(`Generated: ${format(new Date(), 'dd MMMM yyyy')}`, pageWidth / 2, 22, { align: 'center' });

  doc.setTextColor(0, 0, 0);
  let y = 40;

  const lines = [
    meta.patientName ? `Patient: ${clean(meta.patientName)}` : null,
    meta.hospitalNumber ? `Hospital Number: ${clean(meta.hospitalNumber)}` : null,
    meta.diagnosis ? `Diagnosis: ${clean(meta.diagnosis)}` : null,
    meta.boardDate ? `Tumour board: ${clean(meta.boardDate)}` : null,
  ].filter(Boolean) as string[];

  if (lines.length) {
    doc.setFillColor(240, 253, 244);
    doc.setDrawColor(accent.r, accent.g, accent.b);
    doc.rect(PDF_MARGINS.left, y - 5, pageWidth - PDF_MARGINS.left - PDF_MARGINS.right, lines.length * 6 + 6, 'FD');
    doc.setFontSize(PDF_FONT_SIZES.body);
    for (const line of lines) {
      doc.text(line, PDF_MARGINS.left + 3, y);
      y += 6;
    }
    y += 8;
  }
  return y;
}

/** Page-break-aware paragraph writer. */
function writeBlock(doc: any, text: string, y: number, opts: { size?: number; bold?: boolean; lineHeight?: number } = {}): number {
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const maxWidth = pageWidth - PDF_MARGINS.left - PDF_MARGINS.right;
  const size = opts.size ?? PDF_FONT_SIZES.body;
  const lh = opts.lineHeight ?? 5.5;

  doc.setFontSize(size);
  doc.setFont('times', opts.bold ? 'bold' : 'normal');

  for (const line of doc.splitTextToSize(clean(text), maxWidth)) {
    if (y > pageHeight - 25) {
      doc.addPage();
      y = 20;
    }
    doc.text(line, PDF_MARGINS.left, y);
    y += lh;
  }
  return y;
}

function sectionTitle(doc: any, title: string, y: number): number {
  const pageHeight = doc.internal.pageSize.getHeight();
  if (y > pageHeight - 35) {
    doc.addPage();
    y = 20;
  }
  y += 3;
  doc.setFontSize(PDF_FONT_SIZES.sectionHeader);
  doc.setFont('times', 'bold');
  doc.setTextColor(PDF_COLORS.primary.r, PDF_COLORS.primary.g, PDF_COLORS.primary.b);
  doc.text(clean(title), PDF_MARGINS.left, y);
  doc.setTextColor(0, 0, 0);
  return y + 6;
}

// ── 1. Board summary ─────────────────────────────────────────────────────

export function generateBoardSummaryPdf(args: {
  case: TumorBoardCase;
  assessments: TumorBoardAssessment[];
  stage: StageResult;
  plan: ManagementPlan;
  patientName?: string;
  boardDate?: string;
}): void {
  const doc = createPDF();
  let y = header(doc, {
    title: 'Tumour Board Case Summary',
    patientName: args.patientName,
    hospitalNumber: args.case.hospital_number || args.case.patient_hospital_number,
    diagnosis: args.case.diagnosis,
    boardDate: args.boardDate,
  });

  y = sectionTitle(doc, 'Current Stage', y);
  y = writeBlock(doc, args.stage.formatted, y, { bold: true });
  y = writeBlock(doc, `Staging system: ${args.stage.stagingSystem} (${args.stage.basis} staging)`, y);
  if (args.stage.stageDescription) y = writeBlock(doc, args.stage.stageDescription, y);
  y += 3;

  // The staging timeline is the reason this module exists — show every version,
  // oldest first, so the reader can see what was known when.
  y = sectionTitle(doc, 'Staging Timeline', y);
  const ordered = [...args.assessments].sort((a, b) => (a.version || 0) - (b.version || 0));
  if (!ordered.length) {
    y = writeBlock(doc, 'No assessments recorded.', y);
  }
  for (const a of ordered) {
    const when = a.assessed_at ? format(new Date(a.assessed_at), 'dd MMM yyyy') : '';
    y = writeBlock(doc, `v${a.version} — ${a.basis} staging — ${when}`, y, { bold: true });
    y = writeBlock(doc, `  ${a.stage_formatted || `${a.t_category} ${a.n_category} ${a.m_category}`}`, y);
    if (a.histologic_type) y = writeBlock(doc, `  Histology: ${a.histologic_type}`, y);
    if (a.histologic_grade) y = writeBlock(doc, `  Grade: ${a.histologic_grade}`, y);
    if (a.local_spread) y = writeBlock(doc, `  Local spread: ${a.local_spread}`, y);
    if (a.regional_spread) y = writeBlock(doc, `  Regional spread: ${a.regional_spread}`, y);
    if (a.metastatic_spread) y = writeBlock(doc, `  Metastatic spread: ${a.metastatic_spread}`, y);
    if (a.margins) y = writeBlock(doc, `  Margins: ${a.margins}`, y);
    if (a.molecular_findings) y = writeBlock(doc, `  Molecular: ${a.molecular_findings}`, y);
    if (a.notes) y = writeBlock(doc, `  Notes: ${a.notes}`, y);
    y += 2;
  }

  y = sectionTitle(doc, 'Multimodality Management Plan', y);
  y = writeBlock(doc, `Treatment intent: ${args.plan.intent}`, y, { bold: true });
  y += 2;
  for (const item of args.plan.items) {
    y = writeBlock(doc, `[${item.strength.toUpperCase()}] ${item.title}`, y, { bold: true });
    y = writeBlock(doc, `  ${item.detail}`, y);
    y = writeBlock(doc, `  Owner: ${SPECIALTY_LABELS[item.owner]}  |  Basis: ${item.basis}`, y, { size: 8 });
    y += 2;
  }

  if (args.plan.caveats.length) {
    y = sectionTitle(doc, 'Caveats', y);
    for (const c of args.plan.caveats) y = writeBlock(doc, `- ${c}`, y);
  }

  addFooter(doc);
  doc.save(`tumour-board-summary-${args.case.hospital_number || args.case.patient_id}.pdf`);
}

// ── 2. Referral letter ───────────────────────────────────────────────────

export function generateReferralLetterPdf(letter: ReferralLetter, meta: DocHeader): void {
  const doc = createPDF();
  let y = header(doc, { ...meta, title: `Referral — ${letter.specialtyLabel}` });

  if (letter.urgency !== 'routine') {
    // Urgency has to be impossible to miss on a printed letter.
    const label = letter.urgency === 'two_week' ? 'URGENT — CANCER PATHWAY' : 'URGENT';
    doc.setFillColor(254, 226, 226);
    doc.setDrawColor(220, 38, 38);
    doc.rect(PDF_MARGINS.left, y - 5, doc.internal.pageSize.getWidth() - PDF_MARGINS.left - PDF_MARGINS.right, 10, 'FD');
    doc.setTextColor(153, 27, 27);
    doc.setFont('times', 'bold');
    doc.setFontSize(PDF_FONT_SIZES.body);
    doc.text(label, PDF_MARGINS.left + 3, y + 1.5);
    doc.setTextColor(0, 0, 0);
    y += 14;
  }

  y = writeBlock(doc, letter.subject, y, { bold: true });
  y += 4;
  writeBlock(doc, letter.body, y);

  addFooter(doc);
  doc.save(`referral-${letter.specialty}-${meta.hospitalNumber || 'patient'}.pdf`);
}

/** Every letter in one file, each starting on a fresh page for separation. */
export function generateAllReferralLettersPdf(letters: ReferralLetter[], meta: DocHeader): void {
  const doc = createPDF();
  letters.forEach((letter, index) => {
    if (index > 0) doc.addPage();
    let y = header(doc, { ...meta, title: `Referral — ${letter.specialtyLabel}` });
    y = writeBlock(doc, letter.subject, y, { bold: true });
    y += 4;
    writeBlock(doc, letter.body, y);
  });
  addFooter(doc);
  doc.save(`referrals-${meta.hospitalNumber || 'patient'}.pdf`);
}

// ── 3. Surveillance schedule ─────────────────────────────────────────────

export function generateSurveillancePdf(plan: SurveillancePlan, meta: DocHeader): void {
  const doc = createPDF();
  let y = header(doc, { ...meta, title: 'Treatment Monitoring & Surveillance Schedule' });

  y = writeBlock(doc, plan.narrative, y);
  y += 4;
  y = writeBlock(doc, `Planned surveillance duration: ${plan.durationYears} years. Basis: ${plan.basis}`, y, { size: 8 });
  y += 4;

  let currentPhase = '';
  for (const item of plan.items) {
    if (item.phase !== currentPhase) {
      currentPhase = item.phase;
      y = sectionTitle(doc, currentPhase, y);
    }
    y = writeBlock(doc, `${item.dueDate}  —  ${item.title}`, y, { bold: true });
    y = writeBlock(doc, `   ${item.detail}`, y, { size: 9 });
    y += 1;
  }

  addFooter(doc);
  doc.save(`surveillance-schedule-${meta.hospitalNumber || 'patient'}.pdf`);
}

// ── 4. Patient & family counselling ──────────────────────────────────────

export function generateCounsellingPdf(document_: CounsellingDocument, meta: DocHeader): void {
  const doc = createPDF();
  // Softer accent than the clinical documents — this one goes home with a family.
  const accent = { r: 14, g: 159, b: 110 };
  let y = header(doc, { ...meta, title: 'Information For You And Your Family' }, accent);

  // Larger type and more leading throughout: see the note at the top of this file.
  const bodySize = PDF_FONT_SIZES.body + 1;
  const lineHeight = 6.5;

  for (const section of document_.sections) {
    y = sectionTitle(doc, section.heading, y);
    y = writeBlock(doc, section.body, y, { size: bodySize, lineHeight });
    y += 3;
  }

  y = sectionTitle(doc, 'Questions you may want to ask us', y);
  for (const q of document_.questionsToAsk) {
    y = writeBlock(doc, `-  ${q}`, y, { size: bodySize, lineHeight });
  }
  y += 3;

  // Red flags get a visual box — this is the section that has to be findable in
  // a hurry, by someone who is worried at 2am.
  y = sectionTitle(doc, 'When to contact us urgently', y);
  const pageWidth = doc.internal.pageSize.getWidth();
  const boxTop = y - 4;
  let boxY = y;
  for (const flag of document_.redFlags) {
    boxY = writeBlock(doc, `-  ${flag}`, boxY, { size: bodySize, lineHeight });
  }
  doc.setDrawColor(220, 38, 38);
  doc.setLineWidth(0.5);
  doc.rect(PDF_MARGINS.left - 2, boxTop, pageWidth - PDF_MARGINS.left - PDF_MARGINS.right + 4, boxY - boxTop);
  doc.setLineWidth(0.2);
  y = boxY + 8;

  y = sectionTitle(doc, 'Please note', y);
  writeBlock(doc, document_.disclaimer, y, { size: bodySize - 1, lineHeight: 6 });

  addFooter(doc);
  doc.save(`patient-information-${meta.hospitalNumber || 'patient'}.pdf`);
}
