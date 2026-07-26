// ============================================================================
// "Under our care since" — the date the unit became responsible for a patient.
//
// Two ways a patient becomes ours, and the clock starts at different moments:
//   - referred to us: the day the consult was sent for our review
//   - our own patient: the day we admitted them
//
// So care start = the consult's referral date when one exists, else the
// admission date. Computed in SQL because the join is fiddly (hospital numbers
// are hand-entered) and because the client must never have to stitch this
// together itself — that is what produced blank wards and diagnoses before.
// ============================================================================

/**
 * Hospital numbers are typed by hand: "PT 532094", "Pt530938", "PT-23456",
 * "PT: 526637". Compare on letters and digits only, upper-cased.
 */
const norm = (expr) => `UPPER(REGEXP_REPLACE(COALESCE(${expr}, ''), '[^A-Za-z0-9]', '', 'g'))`;

/**
 * The unit's clock. `admissions.admission_date` is `timestamp WITHOUT time zone`
 * holding local ward time, while consults use `timestamptz` (true UTC) — so
 * comparing the two raw is an hour out, and near midnight that lands on the
 * wrong day. Everything below is therefore reduced to a LOCAL CALENDAR DATE,
 * which is also exactly what the requirement means: the DAY the consult was sent
 * and the DAY we admitted. Single-site app (UNTH, West Africa Time, no DST).
 */
const APP_TIMEZONE = 'Africa/Lagos';

/** A consult's timestamptz as a local calendar date. */
const consultDay = (expr) => `((${expr}) AT TIME ZONE '${APP_TIMEZONE}')::date`;
/** A naive local admission timestamp as a calendar date. */
const admissionDay = (expr) => `(${expr})::date`;

/** How long before an admission a referral can be and still be THIS episode's. */
const CONSULT_LOOKBACK_DAYS = 60;
/**
 * Grace after the admission date. Auto-admitted consults create the admission
 * row the moment the referral lands, and admission_date is a date (midnight)
 * while the consult carries a timestamp — so the consult routinely reads a few
 * hours "after" the admission it caused.
 */
const CONSULT_GRACE_DAYS = 2;

/**
 * LATERAL join that finds the consult that brought this patient to us for the
 * CURRENT admission: the most recent referral from up to
 * CONSULT_LOOKBACK_DAYS before the admission until CONSULT_GRACE_DAYS after it.
 * Bounding it this way stops a referral from an episode months ago being counted
 * against a fresh admission.
 *
 * Matches on the normalised hospital number, or on the consult reference: a
 * patient created from a consult with no hospital number gets one like
 * "CONSULT-RC-2026-EA606A", so the bare ref and the CONSULT-prefixed form are
 * both accepted.
 *
 * @param patientAlias   table alias holding hospital_number (e.g. 'p')
 * @param admissionAlias table alias holding admission_date (e.g. 'a' or 'adm')
 * @param joinAlias      alias to expose the consult under (default 'cs')
 */
export function consultStartJoin(patientAlias, admissionAlias, joinAlias = 'cs') {
  const pHn = norm(`${patientAlias}.hospital_number`);
  const cHn = norm('rc.hospital_number');
  const cRef = norm('rc.consult_ref');
  const cDay = consultDay('COALESCE(rc.referral_datetime, rc.created_at)');
  const aDay = admissionDay(`${admissionAlias}.admission_date`);
  return `
    LEFT JOIN LATERAL (
      SELECT ${cDay} AS consult_day,
             rc.consult_ref
        FROM received_consults rc
       WHERE (
               (${cHn} <> '' AND ${cHn} = ${pHn})
            OR (${cRef} <> '' AND ${pHn} IN (${cRef}, 'CONSULT' || ${cRef}))
             )
         AND (
               ${admissionAlias}.admission_date IS NULL
            OR ${cDay} BETWEEN ${aDay} - ${CONSULT_LOOKBACK_DAYS}
                           AND ${aDay} + ${CONSULT_GRACE_DAYS}
             )
       ORDER BY ${cDay} DESC NULLS LAST
       LIMIT 1
    ) ${joinAlias} ON TRUE`;
}

/**
 * SELECT columns exposing the care clock. Requires consultStartJoin() to be in
 * the same query.
 *
 * care_start_date is the EARLIER of the referral and the admission, so the time
 * under our care is never understated: a patient referred three days before we
 * admitted them has been ours for those three days, and one we admitted before
 * the paperwork arrived has been ours since admission.
 *
 * care_start_source says which date won, so the UI can word it truthfully
 * ("referred 20 Jul" vs "admitted 20 Jul"). care_consult_ref is set whenever a
 * consult matched at all, so a referred patient can still be marked as referred
 * even when the admission date started the clock.
 *
 * @param admissionAlias alias holding admission_date (e.g. 'a' or 'adm')
 * @param joinAlias      the alias used for consultStartJoin
 */
export function careStartColumns(admissionAlias, joinAlias = 'cs') {
  const aDay = admissionDay(`${admissionAlias}.admission_date`);
  const cDay = `${joinAlias}.consult_day`;
  return `
    LEAST(COALESCE(${cDay}, ${aDay}), COALESCE(${aDay}, ${cDay})) AS care_start_date,
    CASE
      WHEN ${cDay} IS NOT NULL
       AND (${aDay} IS NULL OR ${cDay} <= ${aDay}) THEN 'consult'
      WHEN ${admissionAlias}.admission_date IS NOT NULL THEN 'admission'
      WHEN ${cDay} IS NOT NULL THEN 'consult'
      ELSE NULL
    END AS care_start_source,
    ${joinAlias}.consult_ref AS care_consult_ref`;
}

export default { consultStartJoin, careStartColumns };
