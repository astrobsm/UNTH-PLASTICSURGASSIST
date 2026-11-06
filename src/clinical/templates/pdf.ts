/**
 * PDF of a templated review: the full assessment, scores, alerts, the
 * integrated treatment plan by domain, counselling and consent with signature
 * blocks — printable for the case notes or to hand to the patient.
 */
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { isVisible } from '../clerking/engine';
import { sanitizePdfDocument } from '../../utils/pdfSafeText';
import { PDF_INSTITUTION } from '../../utils/pdfUtils';
import { completeness, computeScores, templateFlags } from './engine';
import { PLAN_DOMAINS, type ClinicalTemplate, type TemplateData } from './types';

export interface PdfMeta {
  patientName: string;
  hospitalNumber?: string;
  ageSex?: string;
  author: string;
  status?: string;
  signedBy?: string | null;
  signedAt?: string | null;
  when?: Date;
}

const GREEN: [number, number, number] = [14, 120, 90];
const RED: [number, number, number] = [185, 28, 28];

const answered = (v: any) => v !== undefined && v !== null && v !== '' && !(Array.isArray(v) && v.length === 0);
const fmt = (v: any, unit?: string) => (Array.isArray(v) ? v.join(', ') : `${v}${unit ? ` ${unit}` : ''}`);

export function buildTemplatePdf(t: ClinicalTemplate, data: TemplateData, meta: PdfMeta): jsPDF {
  const doc = sanitizePdfDocument(new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' }));
  const W = doc.internal.pageSize.getWidth();
  const H = doc.internal.pageSize.getHeight();
  const M = 14;
  const a = data.answers;
  let y = 14;

  const lastY = () => (doc as any).lastAutoTable?.finalY ?? y;
  const ensure = (need: number) => { if (y + need > H - 18) { doc.addPage(); y = 16; } };
  const heading = (s: string, color: [number, number, number] = GREEN) => {
    ensure(12);
    doc.setFillColor(...color); doc.rect(M, y, W - 2 * M, 6.5, 'F');
    doc.setTextColor(255, 255, 255); doc.setFont('helvetica', 'bold'); doc.setFontSize(10);
    doc.text(s, M + 2, y + 4.6);
    doc.setTextColor(0, 0, 0); doc.setFont('helvetica', 'normal');
    y += 8;
  };
  const table = (body: string[][], opts: any = {}) => {
    autoTable(doc, {
      startY: y, margin: { left: M, right: M }, theme: 'grid', body,
      styles: { fontSize: 8.5, cellPadding: 1.6, valign: 'top', lineColor: [210, 210, 210] },
      columnStyles: { 0: { cellWidth: 62, fontStyle: 'bold', textColor: [60, 60, 60] } },
      ...opts,
    });
    y = lastY() + 4;
  };

  // Letterhead
  doc.setFont('helvetica', 'bold'); doc.setFontSize(12);
  doc.text(PDF_INSTITUTION.name, W / 2, y, { align: 'center' }); y += 5;
  doc.setFont('helvetica', 'normal'); doc.setFontSize(9.5);
  doc.text(`${PDF_INSTITUTION.department} · ${PDF_INSTITUTION.location}`, W / 2, y, { align: 'center' }); y += 3;
  doc.setDrawColor(...GREEN); doc.setLineWidth(0.6); doc.line(M, y, W - M, y); y += 6;
  doc.setFont('helvetica', 'bold'); doc.setFontSize(13);
  doc.text(t.title, M, y, { maxWidth: W - 2 * M }); y += doc.splitTextToSize(t.title, W - 2 * M).length * 5.5;
  doc.setFont('helvetica', 'normal'); doc.setFontSize(8.5); doc.setTextColor(90, 90, 90);
  doc.text(t.subtitle, M, y); y += 5; doc.setTextColor(0, 0, 0);

  const when = (meta.when || new Date()).toLocaleString(undefined, { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
  table([
    ['Patient', `${meta.patientName}${meta.ageSex ? ` · ${meta.ageSex}` : ''}`],
    ['Hospital number', meta.hospitalNumber || '—'],
    ['Date / time', when],
    ['Reviewed by', meta.author],
    ['Status', `${(meta.status || 'draft').replace(/_/g, ' ')}${meta.signedBy ? ` · signed by ${meta.signedBy}${meta.signedAt ? ` (${new Date(meta.signedAt).toLocaleString()})` : ''}` : ''}`],
  ], { columnStyles: { 0: { cellWidth: 40, fontStyle: 'bold' } } });

  // Alerts first — they are what a reader must see.
  const flags = templateFlags(t, a);
  if (flags.length) {
    heading('ALERTS', RED);
    table(flags.map(f => [f.severity === 'urgent' ? 'URGENT' : 'Warning', f.text]), { columnStyles: { 0: { cellWidth: 22, fontStyle: 'bold', textColor: RED } } });
  }

  const scores = computeScores(t, a);
  if (scores.length) {
    heading('SCORES AND RISK STRATIFICATION');
    table(scores.map(s => [s.label, `${s.result.value} — ${s.result.band}${s.result.detail ? ` (${s.result.detail})` : ''}`]), { columnStyles: { 0: { cellWidth: 40, fontStyle: 'bold' } } });
  }

  for (const s of t.sections) {
    const sa = a[s.id] || {};
    const rows = s.questions.filter(q => isVisible(q, sa) && answered(sa[q.id])).map(q => [q.label, fmt(sa[q.id], q.unit)]);
    if (!rows.length) continue;
    heading(s.title.toUpperCase());
    table(rows);
  }

  if (data.impression) { heading('IMPRESSION'); table([['Impression', data.impression]]); }

  const plan = data.plan.filter(l => l.include);
  if (plan.length) {
    heading('INTEGRATED TREATMENT PLAN');
    const body: any[] = [];
    for (const d of PLAN_DOMAINS) {
      const ls = plan.filter(l => l.domain === d);
      if (!ls.length) continue;
      body.push([{ content: d, colSpan: 2, styles: { fillColor: [232, 245, 239], fontStyle: 'bold', textColor: [20, 80, 60] } }]);
      ls.forEach(l => body.push([l.priority === 'urgent' ? 'URGENT' : l.kind === 'investigation' ? 'Investigation' : '', `${l.text}${l.why ? `  (${l.why})` : ''}`]));
    }
    autoTable(doc, {
      startY: y, margin: { left: M, right: M }, theme: 'grid', body,
      styles: { fontSize: 8.5, cellPadding: 1.6, lineColor: [210, 210, 210] },
      columnStyles: { 0: { cellWidth: 24, fontStyle: 'bold', textColor: [120, 60, 0] } },
    });
    y = lastY() + 4;
  }
  if (data.notes) { heading('ADDITIONAL NOTES'); table([['Notes', data.notes]]); }

  const c = completeness(t, a);
  if (c.missing.length) {
    ensure(10);
    doc.setFontSize(7.5); doc.setTextColor(120, 120, 120);
    const txt = doc.splitTextToSize(`Not documented (${c.missing.length}/${c.total} required items): ${c.missing.map(m => m.label).join('; ')}`, W - 2 * M);
    doc.text(txt, M, y); y += txt.length * 3.3 + 3; doc.setTextColor(0, 0, 0);
  }

  // Consent and signatures
  heading('CONSENT AND SIGNATURES');
  doc.setFontSize(8.5);
  const declaration = doc.splitTextToSize(
    'I confirm that the diagnosis, the proposed treatment, its intended benefits, its material risks and the reasonable alternatives (including no treatment) have been explained to me in a language I understand, that I have been able to ask questions, and that I agree to the plan above.', W - 2 * M);
  ensure(declaration.length * 4 + 40);
  doc.text(declaration, M, y); y += declaration.length * 4 + 8;
  const sig = (label: string, x: number) => {
    doc.line(x, y, x + 55, y);
    doc.setFontSize(7.5); doc.text(label, x, y + 4);
    doc.text('Name / date / time', x, y + 8);
  };
  sig('Patient / parent / guardian', M); sig('Clinician', M + 63); sig('Witness / interpreter', M + 126);
  y += 16;

  ensure(14);
  doc.setFontSize(6.8); doc.setTextColor(110, 110, 110);
  const refs = doc.splitTextToSize(`Template basis: ${t.references.join('; ')}.`, W - 2 * M);
  doc.text(refs, M, y);
  doc.setTextColor(0, 0, 0);

  const pages = doc.getNumberOfPages();
  for (let i = 1; i <= pages; i++) {
    doc.setPage(i);
    doc.setFontSize(7); doc.setTextColor(120, 120, 120);
    doc.text(`${meta.patientName}${meta.hospitalNumber ? ` · ${meta.hospitalNumber}` : ''} · ${t.title}`, M, H - 8, { maxWidth: W - 2 * M - 25 });
    doc.text(`Page ${i} of ${pages}`, W - M, H - 8, { align: 'right' });
    doc.setTextColor(0, 0, 0);
  }
  return doc;
}

export function downloadTemplatePdf(t: ClinicalTemplate, data: TemplateData, meta: PdfMeta) {
  const doc = buildTemplatePdf(t, data, meta);
  const safe = (s: string) => s.replace(/[^\w-]+/g, '_').replace(/_+/g, '_').slice(0, 60);
  doc.save(`${safe(meta.hospitalNumber || meta.patientName)}_${safe(t.title)}_${new Date().toISOString().slice(0, 10)}.pdf`);
}
