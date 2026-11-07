/**
 * Nutrition reports: one-page clinician summary (ward round / case notes),
 * dietitian report (full working), and the patient / family meal plan in plain
 * English with household measures and optional Igbo names. Every report
 * carries the decision-support notice, coefficient version and approval.
 */
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { sanitizePdfDocument } from '../../utils/pdfSafeText';
import { PDF_INSTITUTION } from '../../utils/pdfUtils';
import { DECISION_SUPPORT_NOTICE, type NutritionAssessment } from './assess';
import type { Alert } from './monitoring';
import type { MealPlan, PlanItem } from './planner';
import { NUTRITION_CONFIG } from './config';
import type { NutritionConfig } from './config/nutrition.v1';

export interface ReportMeta {
  patientName: string;
  hospitalNumber?: string | null;
  ageSex?: string | null;
  ward?: string | null;
  author: string;
  status?: string | null;
  approvedBy?: string | null;
  approvedAt?: string | null;
  foodDataVersion?: string | null;
}

const GREEN: [number, number, number] = [14, 120, 90];
const SLOT: Record<string, string> = { breakfast: 'Breakfast', mid_morning: 'Mid-morning snack', lunch: 'Lunch', afternoon: 'Afternoon snack', dinner: 'Dinner', evening: 'Evening snack' };
const LEVEL: Record<string, string> = { low: 'Low risk', medium: 'Medium risk', high: 'High risk', refeeding: 'Refeeding risk' };

function doc0() { return sanitizePdfDocument(new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' })); }

function frame(doc: jsPDF, title: string, meta: ReportMeta) {
  const W = doc.internal.pageSize.getWidth();
  let y = 14;
  doc.setFont('helvetica', 'bold'); doc.setFontSize(12); doc.text(PDF_INSTITUTION.name, W / 2, y, { align: 'center' }); y += 5;
  doc.setFont('helvetica', 'normal'); doc.setFontSize(9.5); doc.text(`${PDF_INSTITUTION.department} · ${PDF_INSTITUTION.location}`, W / 2, y, { align: 'center' }); y += 3;
  doc.setDrawColor(...GREEN); doc.setLineWidth(0.6); doc.line(14, y, W - 14, y); y += 6;
  doc.setFont('helvetica', 'bold'); doc.setFontSize(13); doc.text(title, 14, y); y += 4;
  autoTable(doc, {
    startY: y, margin: { left: 14, right: 14 }, theme: 'plain', styles: { fontSize: 8.5, cellPadding: 0.8 },
    body: [
      ['Patient', `${meta.patientName}${meta.ageSex ? ` · ${meta.ageSex}` : ''}`, 'Hospital no.', meta.hospitalNumber || '—'],
      ['Ward', meta.ward || '—', 'Date', new Date().toLocaleDateString(undefined, { day: '2-digit', month: 'short', year: 'numeric' })],
      ['Prepared by', meta.author, 'Status', `${(meta.status || 'draft').replace(/_/g, ' ')}${meta.approvedBy ? ` — approved by ${meta.approvedBy}${meta.approvedAt ? ` ${new Date(meta.approvedAt).toLocaleDateString()}` : ''}` : ''}`],
    ],
    columnStyles: { 0: { fontStyle: 'bold', cellWidth: 24 }, 2: { fontStyle: 'bold', cellWidth: 24 } },
  });
  return (doc as any).lastAutoTable.finalY + 4;
}

function footer(doc: jsPDF, meta: ReportMeta, cfg: NutritionConfig) {
  const W = doc.internal.pageSize.getWidth(), H = doc.internal.pageSize.getHeight();
  const n = doc.getNumberOfPages();
  for (let i = 1; i <= n; i++) {
    doc.setPage(i); doc.setFontSize(7); doc.setTextColor(110, 110, 110);
    doc.text(`${DECISION_SUPPORT_NOTICE} Coefficients ${cfg.version} (${cfg.status.replace(/_/g, ' ')})${meta.foodDataVersion ? ` · Food data ${meta.foodDataVersion}` : ''}.`, 14, H - 10, { maxWidth: W - 40 });
    doc.text(`${meta.patientName} · Page ${i} of ${n}`, W - 14, H - 6, { align: 'right' });
    doc.setTextColor(0, 0, 0);
  }
}

function heading(doc: jsPDF, y: number, s: string) {
  const W = doc.internal.pageSize.getWidth();
  if (y > doc.internal.pageSize.getHeight() - 30) { doc.addPage(); y = 16; }
  doc.setFillColor(...GREEN); doc.rect(14, y, W - 28, 6, 'F');
  doc.setTextColor(255, 255, 255); doc.setFont('helvetica', 'bold'); doc.setFontSize(9.5); doc.text(s, 16, y + 4.3);
  doc.setTextColor(0, 0, 0); doc.setFont('helvetica', 'normal');
  return y + 8;
}
const table = (doc: jsPDF, y: number, body: any[][], opts: any = {}) => {
  autoTable(doc, { startY: y, margin: { left: 14, right: 14 }, theme: 'grid', body, styles: { fontSize: 8.3, cellPadding: 1.4, lineColor: [215, 215, 215] }, ...opts });
  return (doc as any).lastAutoTable.finalY + 4;
};

function keyRows(a: NutritionAssessment): string[][] {
  const s = a.screening;
  return [
    ['Monitoring level', LEVEL[a.level] || a.level],
    ['Energy', a.targets.kcal ? `${a.targets.kcal} kcal/day — ${a.energy.selected?.label} (${a.energy.selected?.method})` : a.scope.notice || '—'],
    ['Protein', a.targets.proteinG ? `${a.targets.proteinG} g/day — ${a.protein?.method}` : '—'],
    ['Fluid', a.targets.fluidMl ? `${a.targets.fluidMl} mL/day (${a.fluid?.low}–${a.fluid?.high})${a.fluid?.flags.length ? ` — ${a.fluid.flags.join('; ')}` : ''}` : '—'],
    ['Weight / BMI', `${a.weight ? `${a.weight.value} kg (${a.weight.method})` : '—'} · BMI ${a.bmi?.value ?? '—'}${a.height ? ` · height ${a.height.value} cm (${a.height.method})` : ''}`],
    ['Screening', `MUST ${s.must?.value ?? '—'} · GLIM ${s.glim.value}${s.nrs2002 ? ` · NRS-2002 ${s.nrs2002.value}` : ''}${s.sga ? ` · SGA ${s.sga.value}` : ''}${s.nutric ? ` · ${s.nutric.method} ${s.nutric.value}` : ''}`],
    ['Goal', a.goal ? `${a.goal.goal}${a.goal.goal !== 'maintain' ? ` — ${a.goal.method}` : ''}${a.goal.blocked.length ? ` — ${a.goal.blocked.join(' ')}` : ''}` : '—'],
    ['Refeeding', a.refeeding.risk === 'low' ? 'Low risk' : `${a.refeeding.risk.toUpperCase()}: ${[...a.refeeding.major, ...a.refeeding.minor].join('; ')}`],
    ['Restrictions', a.targets.restrictions.join('; ') || 'None'],
  ];
}

/** One page for the ward round or case notes. */
export function buildClinicianSummaryPdf(a: NutritionAssessment, meta: ReportMeta, extra: { alerts?: Alert[]; schedule?: { what: string; when: string }[]; plan?: MealPlan | null } = {}, cfg = NUTRITION_CONFIG) {
  const doc = doc0();
  let y = frame(doc, 'Clinical nutrition summary', meta);
  y = heading(doc, y, 'ASSESSMENT AND TARGETS');
  y = table(doc, y, keyRows(a), { columnStyles: { 0: { fontStyle: 'bold', cellWidth: 32 } } });
  const actions = [
    ...(extra.alerts || []).map(x => `${x.severity === 'urgent' ? 'URGENT: ' : ''}${x.text}`),
    ...a.refeeding.alerts,
    ...a.refeeding.schedule.map(d => `Refeeding day ${d.day}: ${d.kcal} kcal (${d.kcalPerKg} kcal/kg)`),
    ...a.micronutrients.map(m => `Consider ${m.nutrient} — ${m.why}`),
  ];
  if (actions.length) { y = heading(doc, y, 'ALERTS AND ACTIONS'); y = table(doc, y, actions.map(t => [t])); }
  if (extra.schedule?.length) { y = heading(doc, y, 'MONITORING'); y = table(doc, y, extra.schedule.map(s => [s.what, s.when]), { columnStyles: { 0: { fontStyle: 'bold', cellWidth: 50 } } }); }
  if (extra.plan) {
    y = heading(doc, y, 'MEAL PLAN');
    table(doc, y, [[`Weekly average ${extra.plan.weekly.avgKcal} kcal and ${extra.plan.weekly.avgProteinG} g protein; ${extra.plan.weekly.daysWithinTolerance}/${extra.plan.days.length} days within targets.${extra.plan.suggestions.length ? ` ${extra.plan.suggestions.join(' ')}` : ''}`]]);
  }
  footer(doc, meta, cfg);
  return doc;
}

/** Full working for the dietitian. */
export function buildDietitianReportPdf(a: NutritionAssessment, meta: ReportMeta, extra: { measurements?: { kind: string; value: number; unit: string; measured_at: string; method?: string | null; source?: string }[]; intakeDays?: { date: string; kcal: number; proteinG: number; pct: number | null }[]; plan?: MealPlan | null } = {}, cfg = NUTRITION_CONFIG) {
  const doc = doc0();
  let y = frame(doc, 'Dietitian nutrition report', meta);
  y = heading(doc, y, 'SUMMARY'); y = table(doc, y, keyRows(a), { columnStyles: { 0: { fontStyle: 'bold', cellWidth: 32 } } });
  const calcs: [string, any][] = [['Height', a.height], ['Weight', a.weight], ['BMI', a.bmi], ['MUAC band', a.muacBand], ['IBW', a.ibw], ['Adjusted BW', a.adjbw], ['Weight loss 3–6 mo', a.lossPct], ['MAMC', a.mamc], ['Grip', a.grip],
    ['MUST', a.screening.must], ['NRS-2002', a.screening.nrs2002], ['SGA', a.screening.sga], ['GLIM', a.screening.glim], ['NUTRIC', a.screening.nutric], ['Protein', a.protein], ['Fluid', a.fluid]];
  y = heading(doc, y, 'CALCULATIONS (value · method · inputs · assumptions / source)');
  y = table(doc, y, calcs.filter(([, c]) => c).map(([l, c]) => [l, String(c.value), c.method, Object.entries(c.inputs).map(([k, v]) => `${k}=${v ?? '—'}`).join(', '), [...(c.assumptions || []), c.source].filter(Boolean).join(' · ')]),
    { styles: { fontSize: 7.4, cellPadding: 1 }, columnStyles: { 0: { fontStyle: 'bold', cellWidth: 22 }, 1: { cellWidth: 16 } } });
  if (a.energy.options.length) {
    y = heading(doc, y, 'ENERGY — ALL APPLICABLE EQUATIONS');
    y = table(doc, y, a.energy.options.map(o => [`${o.id === a.energy.selected?.id ? '► ' : ''}${o.label}`, `${o.value}${o.low ? ` (${o.low}–${o.high})` : ''}`, o.method, [...o.warnings, ...o.assumptions].join('; ')]), { styles: { fontSize: 7.6 } });
  }
  if (extra.measurements?.length) {
    y = heading(doc, y, 'MEASUREMENTS');
    y = table(doc, y, extra.measurements.slice(-40).map(m => [new Date(m.measured_at).toLocaleDateString(), m.kind, `${m.value} ${m.unit}`, `${m.method || ''}${m.source && m.source !== 'nutrition' ? ` (${m.source.replace('_', ' ')})` : ''}`]), { styles: { fontSize: 7.6 } });
  }
  if (extra.intakeDays?.length) {
    y = heading(doc, y, 'INTAKE (LAST 7 DAYS)');
    y = table(doc, y, extra.intakeDays.slice(-7).map(d => [d.date, `${Math.round(d.kcal)} kcal`, `${Math.round(d.proteinG)} g`, d.pct != null ? `${d.pct}%` : '—']));
  }
  if (extra.plan) {
    y = heading(doc, y, 'MEAL PLAN — DAILY TOTALS');
    y = table(doc, y, extra.plan.days.map(d => [`Day ${d.day}`, `${d.totals.energy_kcal} / ${d.targetKcal} kcal`, `${d.totals.protein_g} / ${d.targetProteinG} g`, `${d.totals.carb_g ?? '—'} g carb`, `${d.totals.na_mg ?? '—'} mg Na`, d.violations.join('; ') || 'within targets']), { styles: { fontSize: 7.6 } });
    if (extra.plan.warnings.length) y = table(doc, y, extra.plan.warnings.map(w => [w]), { styles: { fontSize: 7.4 } });
  }
  if (a.warnings.length) { y = heading(doc, y, 'WARNINGS'); table(doc, y, a.warnings.map(w => [w])); }
  footer(doc, meta, cfg);
  return doc;
}

const qty = (i: PlanItem) => (i.units ? `${i.units.n} ${i.units.label}${i.units.n > 1 ? 's' : ''}` : i.measure ? `${i.measure.text.replace(/^≈\s*/, 'about ')} (${i.servedG} g)` : `${i.servedG} g`);

/** Plain-English plan for the patient and family, with household measures. */
export function buildPatientPlanPdf(plan: MealPlan, meta: ReportMeta, opts: { igbo?: boolean; fluidMl?: number | null; restrictions?: string[] } = {}, cfg = NUTRITION_CONFIG) {
  const doc = doc0();
  let y = frame(doc, 'Your 7-day meal plan', meta);
  doc.setFontSize(9.5);
  const intro = doc.splitTextToSize(
    `This plan gives you about ${plan.weekly.avgKcal} kcal and ${plan.weekly.avgProteinG} g of protein a day. Eat the amounts shown at each meal. ` +
    `If you cannot finish a meal, tell the nurse or doctor. ${opts.fluidMl ? `Drink about ${Math.round(opts.fluidMl / 250)} cups (${opts.fluidMl} mL) of fluid a day unless told otherwise. ` : ''}` +
    `${(opts.restrictions || []).length ? `Remember: ${opts.restrictions!.join('; ')}.` : ''}`, doc.internal.pageSize.getWidth() - 28);
  doc.text(intro, 14, y); y += intro.length * 4.4 + 2;
  for (const d of plan.days) {
    y = heading(doc, y, `DAY ${d.day}`);
    const rows: string[][] = [];
    for (const slot of Object.keys(SLOT)) {
      const items = d.items.filter(i => i.slot === slot);
      if (!items.length) continue;
      rows.push([SLOT[slot], items.map(i => `${opts.igbo && i.igbo ? `${i.igbo} (${i.name})` : i.name}: ${qty(i)}`).join('\n')]);
    }
    y = table(doc, y, rows, { columnStyles: { 0: { fontStyle: 'bold', cellWidth: 34 } }, styles: { fontSize: 9, cellPadding: 1.6 } });
  }
  y = heading(doc, y, 'WEEKLY SHOPPING / COOKING LIST (raw weights for the whole week)');
  const list = shoppingList(plan);
  y = table(doc, y, list.map(x => [x.name, x.rawG >= 1000 ? `${(x.rawG / 1000).toFixed(1)} kg` : `${x.rawG} g`]), { columnStyles: { 0: { cellWidth: 120 } }, styles: { fontSize: 8 } });
  doc.setFontSize(7.5); doc.setTextColor(90, 90, 90);
  const note = doc.splitTextToSize('Household measures are approximate until checked by local weighing. Weights are of cooked food as served. Prepare without extra salt or seasoning cubes if you were told to limit salt.', doc.internal.pageSize.getWidth() - 28);
  if (y > doc.internal.pageSize.getHeight() - 30) { doc.addPage(); y = 16; }
  doc.text(note, 14, y); doc.setTextColor(0, 0, 0);
  footer(doc, meta, cfg);
  return doc;
}

/** Shopping/cooking list for one week: raw ingredient weights summed across the plan. */
export function shoppingList(plan: MealPlan) {
  const m = new Map<string, number>();
  for (const d of plan.days) for (const i of d.items) {
    if (i.ingredients) for (const g of i.ingredients) m.set(g.name, (m.get(g.name) ?? 0) + g.rawG);
    else if (i.kind === 'food') m.set(i.name, (m.get(i.name) ?? 0) + i.rawG);
  }
  return [...m.entries()].sort((a, b) => b[1] - a[1]).map(([name, g]) => ({ name, rawG: Math.round(g) }));
}

export function savePdf(doc: jsPDF, meta: ReportMeta, kind: string) {
  const safe = (s: string) => s.replace(/[^\w-]+/g, '_').replace(/_+/g, '_').slice(0, 50);
  doc.save(`${safe(meta.hospitalNumber || meta.patientName)}_${kind}_${new Date().toISOString().slice(0, 10)}.pdf`);
}
