/**
 * Renal dose guidance — the single resolver for every renal-dosing question
 * in the app (prescribing, treatment plans, the critical-care review).
 *
 * The app holds three tables that were written separately and do not agree
 * (e.g. amoxicillin: the BNF database adjusts below 30 mL/min, the other two
 * from 59). They are ranked, not merged:
 *   1. BNF database (bnfDrugDatabase.ts) — the reference and the prescribing
 *      catalogue; its renal text is shown as written.
 *   2. BNF medications table (bnfMedications.ts) — numeric bands, used only
 *      where the reference has no renal guidance; labelled secondary.
 *   3. GFR dosing table (gfrDosingTable.ts) — likewise, last.
 * Every other source for the same drug is returned too, so a disagreement is
 * visible to the prescriber. docs/RENAL_DOSING_RECONCILIATION.md lists them
 * for the pharmacist.
 */
import { BNF_DRUG_DATABASE, type BNFDrug } from './bnfDrugDatabase';
import { BNF_MEDICATIONS, type BNFMedication } from './bnfMedications';
import { GFR_DOSING_DATABASE } from './gfrDosingTable';

export type RenalSourceName = 'BNF database (reference)' | 'BNF medications table (secondary)' | 'GFR dosing table (secondary)';
export interface RenalSource { source: RenalSourceName; text: string; dose?: string; frequency?: string; contraindicated: boolean }
export interface RenalGuidance {
  drug: string;
  crcl: number | null;
  band: string;
  primary: RenalSource | null;
  sources: RenalSource[];
  /** The primary guidance is the reference table (still confirm with the pharmacist). */
  verified: boolean;
  /** More than one table holds renal guidance for this drug — they may disagree. */
  multipleSources: boolean;
  contraindicated: boolean;
  summary: string;
}

/** "amoxicillin/clavulanic acid (co-amoxiclav)" → "amoxicillin+": first word, plus a marker for combinations. */
export function drugKey(name: string) {
  const n = String(name || '').toLowerCase().replace(/\(.*?\)/g, ' ').trim();
  const first = (n.match(/[a-z]+/) || [''])[0];
  return first + (/[/+]|\bwith\b|-clav|–clav/.test(n) ? '+' : '');
}
const sameDrug = (a: string, b: string) => drugKey(a) !== '' && drugKey(a) === drugKey(b);

export const crclBand = (crcl: number | null) => (crcl == null ? 'CrCl unknown' : crcl > 50 ? 'CrCl > 50 mL/min' : crcl >= 30 ? 'CrCl 30–50 mL/min' : crcl >= 10 ? 'CrCl 10–29 mL/min' : 'CrCl < 10 mL/min');

/** Threshold below which reference text says "avoid"/"contraindicated". */
function referenceContraindicated(text: string, threshold: string | undefined, crcl: number | null) {
  if (crcl == null || !/contraindicat|avoid/i.test(text)) return false;
  const t = /<\s*(\d+)/.exec(threshold || '') || /(?:gfr|crcl)\s*<\s*(\d+)[^.;]*(?:avoid|contraindicat)|(?:avoid|contraindicat)[^.;]*(?:gfr|crcl)\s*<\s*(\d+)/i.exec(text);
  const limit = t ? Number(t[1] ?? t[2]) : /severe/i.test(text) ? 30 : /moderate/i.test(text) ? 60 : null;
  return limit != null && crcl < limit;
}

function fromReference(d: BNFDrug, crcl: number | null): RenalSource | null {
  const ri = d.dosage?.renalImpairment;
  // Some entries use 'caution' outside the declared RenalRisk union; treat any non-safe value as a flag.
  const risk = String(d.renalRisk || 'safe');
  const flag = risk === 'avoid' ? 'Avoid in renal impairment' : risk === 'dose_adjust' ? 'Dose adjustment needed in renal impairment'
    : risk === 'monitor' ? 'Monitor renal function' : risk !== 'safe' ? 'Use with caution in renal impairment' : '';
  const text = ri?.adjustment || (d.renalNotes ? `${flag ? `${flag}. ` : ''}${d.renalNotes}` : flag ? `${flag} (no band detail in the reference table)` : '');
  if (!text) return null;
  return { source: 'BNF database (reference)', text: `${text}${ri?.gfrThreshold ? ` (threshold ${ri.gfrThreshold})` : ''}`, contraindicated: referenceContraindicated(text, ri?.gfrThreshold, crcl) };
}

function fromMedicationsTable(m: BNFMedication, crcl: number | null): RenalSource | null {
  if (!m.gfrAdjustments?.length) return null;
  if (crcl == null) return { source: 'BNF medications table (secondary)', text: m.gfrAdjustments.map(a => `${a.gfrRange}: ${a.adjustedDose} ${a.adjustedFrequency}`).join('; '), contraindicated: false };
  const a = m.gfrAdjustments.find(x => crcl >= x.gfrMin && crcl <= x.gfrMax) || m.gfrAdjustments.find(x => crcl >= x.gfrMin && crcl < x.gfrMax + 1);
  if (!a) return null;
  return { source: 'BNF medications table (secondary)', text: `GFR ${a.gfrRange}: ${a.adjustedDose} ${a.adjustedFrequency}${a.notes ? ` — ${a.notes}` : ''}`, dose: a.adjustedDose, frequency: a.adjustedFrequency, contraindicated: !!a.contraindicated };
}

function fromGfrTable(name: string, crcl: number | null): RenalSource | null {
  const key = Object.keys(GFR_DOSING_DATABASE).find(k => sameDrug(k, name));
  if (!key) return null;
  const t = GFR_DOSING_DATABASE[key];
  if (crcl == null) return { source: 'GFR dosing table (secondary)', text: `≥90 ${t.normal.dose} ${t.normal.frequency}; 30–59 ${t.moderate.dose} ${t.moderate.frequency}; 15–29 ${t.severe.dose} ${t.severe.frequency}; <15 ${t.kidney_failure.dose} ${t.kidney_failure.frequency}`, contraindicated: false };
  const b = crcl >= 90 ? t.normal : crcl >= 60 ? t.mild : crcl >= 30 ? t.moderate : crcl >= 15 ? t.severe : t.kidney_failure;
  const ci = !!(b as any).contraindicated || /avoid|contraindicat/i.test(b.dose);
  return { source: 'GFR dosing table (secondary)', text: `${b.dose} ${b.frequency}${t.notes ? ` — ${t.notes}` : ''}`, dose: b.dose, frequency: b.frequency, contraindicated: ci };
}

export function renalDoseGuidance(drugName: string, crcl: number | null | undefined): RenalGuidance {
  const c = typeof crcl === 'number' && Number.isFinite(crcl) && crcl >= 0 ? crcl : null;
  const ref = BNF_DRUG_DATABASE.find(d => sameDrug(d.genericName, drugName) || d.brandNames.some(b => b.toLowerCase() === String(drugName).toLowerCase().trim()));
  const med = BNF_MEDICATIONS.find(m => sameDrug(m.genericName, drugName) || sameDrug(m.name, drugName));
  const sources = [ref && fromReference(ref, c), med && fromMedicationsTable(med, c), fromGfrTable(drugName, c)].filter((x): x is RenalSource => !!x);
  const primary = sources[0] ?? null;
  const verified = primary?.source === 'BNF database (reference)';
  const contraindicated = sources.some(s => s.contraindicated) && (verified ? sources[0].contraindicated : true);
  const band = crclBand(c);
  const others = sources.slice(1);
  const summary = !primary
    ? `No renal-dosing data in the app for ${drugName}. Consult the clinical pharmacist or nephrology (${band}).`
    : `${band}. ${primary.source}: ${primary.text}.${verified ? '' : ' Secondary source — pharmacist to verify.'}${others.length ? ` Other table${others.length > 1 ? 's' : ''}: ${others.map(o => `${o.source} — ${o.text}`).join(' | ')} (sources differ — confirm).` : ''} Confirm with the formulary / pharmacist.`;
  return { drug: drugName, crcl: c, band, primary, sources, verified, multipleSources: sources.length > 1, contraindicated, summary };
}
