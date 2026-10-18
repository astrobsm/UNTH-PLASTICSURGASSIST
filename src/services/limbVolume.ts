/**
 * Limb volume from circumferences (truncated-cone / frustum method) and
 * lymphoedema staging.
 *
 * VOLUME. Each segment between two measuring points is a frustum:
 *   V = h × (C1² + C1·C2 + C2²) / (12π)       (cm³ = mL)
 * where h is the real distance between the points. The old code used h = 4
 * cm for every pair — including the hand/foot → wrist/ankle pair, which is
 * not 4 cm — summed blank rows, and let the two limbs use different segments.
 * Now: points carry their position along the limb (wrist / ankle = 0); the
 * hand / foot row has no standard distance and is left out of the volume; a
 * segment counts only when BOTH limbs are measured at BOTH ends, so the
 * limbs are compared over identical segments.
 *
 * STAGING (ISL consensus 2020). Stage is clinical:
 *   0 latent — impaired transport, no swelling
 *   I  early swelling that subsides with elevation; pitting may occur
 *   II elevation alone rarely reduces it; pitting manifest
 *   II late — fibrosis; pitting may be absent
 *   III lymphostatic elephantiasis — trophic skin changes (papillomatosis,
 *       acanthosis, warty overgrowth), pitting absent
 * Severity is separate, from excess volume (unilateral): minimal < 20 %,
 * moderate 20–40 %, severe > 40 %. The old code staged by volume.
 */

export interface LimbMeasurement {
  location: string;
  affected_cm: number;
  contralateral_cm: number;
  difference_cm: number;
  difference_pct: number;
}

/** Position (cm proximal to wrist / ankle) for the standard rows; null = not used in volume. */
export function positionOf(location: string): number | null {
  const l = location.toLowerCase();
  if (l.startsWith('hand') || l.startsWith('foot') || l.includes('metatars')) return null;
  if (l.startsWith('wrist') || l.startsWith('ankle')) return 0;
  const m = /(\d+(?:\.\d+)?)\s*cm/.exec(l);
  return m ? Number(m[1]) : null;
}

export interface VolumeResult {
  affected: number;
  contralateral: number;
  difference_pct: number;
  excess_ml: number;
  segmentsUsed: number;
  warnings: string[];
}

const frustum = (h: number, c1: number, c2: number) => (h * (c1 * c1 + c1 * c2 + c2 * c2)) / (12 * Math.PI);
const valid = (v: number) => Number.isFinite(v) && v > 0;

export function calculateLimbVolume(measurements: LimbMeasurement[]): VolumeResult {
  const warnings: string[] = [];
  const rows = measurements
    .map(m => ({ ...m, pos: positionOf(m.location) }))
    .filter(m => m.pos !== null)
    .sort((a, b) => (a.pos as number) - (b.pos as number));

  for (const m of measurements) {
    for (const v of [m.affected_cm, m.contralateral_cm]) {
      if (valid(v) && (v < 5 || v > 120)) {
        warnings.push(`${m.location}: ${v} cm is outside human limb circumferences — check the units (cm, not mm).`);
      }
    }
    if (valid(m.affected_cm) !== valid(m.contralateral_cm) && (valid(m.affected_cm) || valid(m.contralateral_cm))) {
      warnings.push(`${m.location}: only one limb measured — this level is left out of both volumes.`);
    }
  }

  let affected = 0, contralateral = 0, segmentsUsed = 0;
  for (let i = 0; i < rows.length - 1; i++) {
    const a = rows[i], b = rows[i + 1];
    const h = (b.pos as number) - (a.pos as number);
    if (h <= 0) continue;
    if (![a.affected_cm, b.affected_cm, a.contralateral_cm, b.contralateral_cm].every(valid)) continue;
    affected += frustum(h, a.affected_cm, b.affected_cm);
    contralateral += frustum(h, a.contralateral_cm, b.contralateral_cm);
    segmentsUsed++;
  }
  if (segmentsUsed === 0 && measurements.some(m => valid(m.affected_cm) || valid(m.contralateral_cm))) {
    warnings.push('No segment has both limbs measured at both ends — volume cannot be calculated yet.');
  }
  const pct = contralateral > 0 ? ((affected - contralateral) / contralateral) * 100 : 0;
  return {
    affected: Math.round(affected),
    contralateral: Math.round(contralateral),
    difference_pct: Math.round(pct * 10) / 10,
    excess_ml: Math.round(affected - contralateral),
    segmentsUsed,
    warnings: [...new Set(warnings)],
  };
}

export type ISLStage = 0 | 1 | 2 | '2late' | 3;

export function islStage(d: {
  pitting: string; fibrosis: string; elevation_reduces: boolean; papillomatosis: boolean;
  swellingPresent: boolean; trophicSkinChanges?: boolean;
}): ISLStage {
  const pits = d.pitting && d.pitting !== 'none';
  if (d.papillomatosis || d.trophicSkinChanges) return 3;
  if (!d.swellingPresent && !pits) return 0;
  if (d.elevation_reduces && d.fibrosis === 'none') return 1;
  if (d.fibrosis === 'moderate' || d.fibrosis === 'severe') return '2late';
  return 2;
}

/** ISL severity (unilateral limb) from excess volume. */
export function islSeverity(excessPct: number | null | undefined): 'none' | 'minimal' | 'moderate' | 'severe' | null {
  if (excessPct == null || !Number.isFinite(excessPct)) return null;
  if (excessPct <= 0) return 'none';
  if (excessPct < 20) return 'minimal';
  if (excessPct <= 40) return 'moderate';
  return 'severe';
}

export type CampisiStage = 'IA' | 'IB' | 'II' | 'III' | 'IV' | 'V';

/**
 * Campisi (2006): IA no oedema despite lymphatic dysfunction; IB mild oedema
 * reversible with elevation; II persistent oedema regressing only partially
 * with elevation; III persistent oedema that never regresses, recurrent
 * lymphangitis; IV fibrotic lymphoedema with lymphostatic warts; V
 * elephantiasis.
 */
export function campisiStage(isl: ISLStage, recurrentLymphangitis: boolean, warts = false): CampisiStage {
  if (isl === 3) return warts ? 'IV' : 'V';
  if (isl === '2late') return warts ? 'IV' : 'III';
  if (isl === 2) return recurrentLymphangitis ? 'III' : 'II';
  if (isl === 1) return 'IB';
  return 'IA';
}
