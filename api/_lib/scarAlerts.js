// ============================================================================
// Scar alerts — derived from what the case analysis already concluded.
//
// scar_alerts existed, was counted on every list and dashboard, and could be
// acknowledged, but nothing ever wrote to it, so "open alerts" was always 0.
// Alerts are now derived from the latest visit's analysis and stored once per
// visit per code (re-reading a case never duplicates them).
// ============================================================================

import { query } from './db.js';

const n = (v) => (v === null || v === undefined || v === '' ? null : Number(v));

/** Pure: the alerts this analysis warrants. */
export function deriveScarAlerts({ keloid, latest, multimodal, methodConsistency }) {
  const out = [];
  const status = keloid?.status?.status;
  if (status === 'possible_recurrence') {
    out.push({ severity: 'critical', code: 'possible_recurrence', message: keloid.status.summary });
  } else if (status === 'progressive') {
    out.push({ severity: 'warning', code: 'progressive_growth', message: keloid.status.summary });
  }
  const acc = keloid?.acceleration;
  if (acc?.ok && acc.accelerating && acc.meaningful) {
    out.push({ severity: 'warning', code: 'growth_accelerating',
      message: `Growth is accelerating (by about ${Math.abs(n(acc.deltaPerMonth) ?? 0)} cm²/month over the series).` });
  }
  if (latest?.contracture_present === true) {
    const deficit = n(latest.rom_deficit_degrees);
    out.push({ severity: deficit != null && deficit >= 30 ? 'warning' : 'info', code: 'contracture',
      message: `Contracture recorded${deficit != null ? ` with a ${deficit}° range-of-motion deficit` : ''} — consider therapy or release.` });
  }
  const pain = n(latest?.pain_0_10), itch = n(latest?.itch_0_10);
  if ((pain != null && pain >= 7) || (itch != null && itch >= 7)) {
    out.push({ severity: 'warning', code: 'severe_symptoms',
      message: `Severe symptoms reported (pain ${pain ?? '—'}/10, itch ${itch ?? '—'}/10).` });
  }
  if (multimodal?.verdict === 'discordant') {
    out.push({ severity: 'info', code: 'discordant_measures', message: multimodal.summary });
  }
  if (methodConsistency && methodConsistency.consistent === false && methodConsistency.warning) {
    out.push({ severity: 'info', code: 'mixed_methods', message: methodConsistency.warning });
  }
  return out;
}

/** Stores any not yet raised for this visit. Never throws. */
export async function raiseScarAlerts(scarId, assessmentId, alerts) {
  if (!assessmentId || !alerts.length) return 0;
  let raised = 0;
  for (const a of alerts) {
    try {
      const r = await query(
        `INSERT INTO scar_alerts (scar_id, assessment_id, severity, code, message)
         SELECT $1::int, $2::int, $3::varchar, $4::varchar, $5::text
         WHERE NOT EXISTS (SELECT 1 FROM scar_alerts
                           WHERE scar_id = $1::int AND assessment_id = $2::int AND code = $4::varchar)`,
        [scarId, assessmentId, a.severity, a.code, a.message]);
      raised += r.rowCount || 0;
    } catch (e) {
      console.warn('raiseScarAlerts:', e.message);
    }
  }
  return raised;
}
