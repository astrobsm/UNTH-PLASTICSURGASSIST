/**
 * Tumour measurements: range checks, the structured margin report and the
 * recommended melanoma excision margin.
 *
 * Measurements used to be free numbers with no units check (a Breslow typed
 * in micrometres staged as T4) and margins were one free-text line. Each
 * figure is now checked against what is physically plausible, margins are
 * recorded as distances in millimetres and classified, and for melanoma the
 * wide-excision margin the Breslow thickness calls for is shown beside them.
 */

export interface TumourMeasureInput {
  breslowMm?: number | null;
  sizeCm?: number | null;
  largestNodeCm?: number | null;
  peripheralMarginMm?: number | null;
  deepMarginMm?: number | null;
}

const isNum = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v);

/** Problems that should stop a save (errors) or make the clinician look again (warnings). */
export function checkTumourMeasurements(m: TumourMeasureInput): { errors: string[]; warnings: string[] } {
  const errors: string[] = [], warnings: string[] = [];
  if (isNum(m.breslowMm)) {
    if (m.breslowMm < 0) errors.push('Breslow thickness cannot be negative.');
    else if (m.breslowMm > 50) errors.push(`Breslow ${m.breslowMm} mm is not plausible — enter millimetres (e.g. 1.2), not micrometres.`);
    else if (m.breslowMm > 15) warnings.push(`Breslow ${m.breslowMm} mm is unusually thick — confirm against the pathology report.`);
  }
  if (isNum(m.sizeCm)) {
    if (m.sizeCm <= 0) errors.push('Tumour size must be greater than 0 cm.');
    else if (m.sizeCm > 100) errors.push(`Tumour size ${m.sizeCm} cm is not plausible — enter centimetres, not millimetres.`);
    else if (m.sizeCm > 40) warnings.push(`Tumour size ${m.sizeCm} cm — confirm the unit (cm).`);
  }
  if (isNum(m.largestNodeCm)) {
    if (m.largestNodeCm <= 0) errors.push('Node size must be greater than 0 cm.');
    else if (m.largestNodeCm > 20) errors.push(`Node ${m.largestNodeCm} cm is not plausible — enter centimetres.`);
  }
  for (const [label, v] of [['Peripheral', m.peripheralMarginMm], ['Deep', m.deepMarginMm]] as const) {
    if (isNum(v)) {
      if (v < 0) errors.push(`${label} margin cannot be negative.`);
      else if (v > 100) errors.push(`${label} margin ${v} mm is not plausible — enter millimetres.`);
    }
  }
  return { errors, warnings };
}

export type MarginStatus = 'involved' | 'close' | 'clear' | 'not_reported';

/**
 * Histological margin status. 0 mm = involved (tumour at ink). "Close" is
 * < 1 mm for keratinocyte cancers and melanoma, and < 1 mm for sarcoma too
 * when used as a flag for re-excision discussion (R1 is ≤ 1 mm in many
 * sarcoma reporting schemes).
 */
export function marginStatus(peripheralMm?: number | null, deepMm?: number | null): MarginStatus {
  const vals = [peripheralMm, deepMm].filter(isNum);
  if (!vals.length) return 'not_reported';
  const closest = Math.min(...vals);
  if (closest <= 0) return 'involved';
  if (closest < 1) return 'close';
  return 'clear';
}

/** Recommended clinical wide-excision margin for a primary melanoma (NCCN / BAD). */
export function melanomaExcisionMargin(breslowMm?: number | null, inSitu = false): string | null {
  if (inSitu) return '0.5–1 cm clinical margin (melanoma in situ)';
  if (!isNum(breslowMm) || breslowMm < 0) return null;
  if (breslowMm <= 1) return '1 cm clinical margin (Breslow ≤ 1.0 mm)';
  if (breslowMm <= 2) return '1–2 cm clinical margin (Breslow 1.01–2.0 mm)';
  return '2 cm clinical margin (Breslow > 2.0 mm)';
}

/** The text stored in the record's margins field. */
export function marginsSummary(m: { peripheralMarginMm?: number | null; deepMarginMm?: number | null; note?: string }): string {
  const parts: string[] = [];
  if (isNum(m.peripheralMarginMm)) parts.push(`peripheral ${m.peripheralMarginMm} mm`);
  if (isNum(m.deepMarginMm)) parts.push(`deep ${m.deepMarginMm} mm`);
  const st = marginStatus(m.peripheralMarginMm, m.deepMarginMm);
  const head = st === 'not_reported' ? '' : `${st === 'involved' ? 'Involved' : st === 'close' ? 'Close' : 'Clear'}: ${parts.join(', ')}`;
  return [head, (m.note || '').trim()].filter(Boolean).join(' — ');
}

/** Greatest dimension (cm) of an outline traced on a calibrated photograph. */
export function greatestDimensionCm(points: { x: number; y: number }[], pixelsPerCm: number): number | null {
  if (points.length < 2 || !(pixelsPerCm > 0)) return null;
  let max = 0;
  for (let i = 0; i < points.length; i++) {
    for (let j = i + 1; j < points.length; j++) {
      const d = Math.hypot(points[i].x - points[j].x, points[i].y - points[j].y);
      if (d > max) max = d;
    }
  }
  return Math.round((max / pixelsPerCm) * 10) / 10;
}
