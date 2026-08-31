/**
 * Translates a locally-held wound assessment into the shape /api/wound-care
 * accepts.
 *
 * WHY THIS EXISTS
 * The two sides never agreed on a single field name. WoundCarePage writes
 * `patient_id`, `location` and `photos`; the handler destructures `patientId`,
 * `woundLocation` and `images`, and rejects anything missing the first two. So
 * every create was answered with 400 "Patient ID and wound location are
 * required", the local row kept `synced: false` forever, and the assessment
 * existed on exactly one phone. That is what clinicians were reporting when
 * they could not see wound documentation they had entered themselves from a
 * second device — the photographs were only the visible half of it.
 *
 * Photographs travel as refs, never as bytes. The dataUrls held on the page are
 * megabytes each, and woundImageStore is already uploading the real copy; a
 * dataUrl here would be a second copy that nothing can resolve.
 *
 * Kept as a pure function, separate from the sync service, so the mapping can
 * be tested against the handler's contract without a database or a network.
 */

export interface WoundCarePayload {
  patientId: unknown;
  woundLocation: unknown;
  woundType: unknown;
  woundSize: string | null;
  woundStage: unknown;
  treatmentProvided: string | null;
  dressingUsed: string | null;
  observations: string | null;
  nextDressingDate: unknown;
  images: string[];
}

export function toWoundCarePayload(w: any): WoundCarePayload {
  const record = w || {};

  const dims = [record.length, record.width, record.depth]
    .filter((n: any) => Number(n) > 0)
    .map((n: any) => `${Number(n)}cm`)
    .join(' x ');

  const protocol: any[] = Array.isArray(record.dressing_protocol) ? record.dressing_protocol : [];
  const photos: any[] = Array.isArray(record.photos) ? record.photos : [];

  const treatment = protocol
    .map(s => [s?.action, s?.product].filter(Boolean).join(' — '))
    .filter(Boolean)
    .join('\n');
  const dressings = protocol.map(s => s?.product).filter(Boolean).join(', ');

  return {
    // Both spellings are accepted on the way in, so a record written by any
    // other caller still maps rather than silently losing its patient.
    patientId: record.patient_id ?? record.patientId ?? null,
    woundLocation: record.location ?? record.woundLocation ?? null,
    woundType: record.wound_type ?? record.woundType ?? null,
    woundSize: dims || (Number(record.area) > 0 ? `${Number(record.area).toFixed(1)} cm2` : null),
    woundStage: record.healing_phase ?? record.woundStage ?? null,
    treatmentProvided: treatment || record.treatmentProvided || null,
    dressingUsed: dressings || record.dressingUsed || null,
    observations: record.notes ?? record.observations ?? null,
    nextDressingDate: record.next_dressing_date ?? record.nextDressingDate ?? null,
    images: photos.map(p => p?.ref).filter((r: any): r is string => typeof r === 'string' && r.length > 0),
  };
}
