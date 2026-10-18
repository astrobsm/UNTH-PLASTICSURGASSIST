// ============================================================================
// Patient (hospital) numbers: one written form, one matching key.
//
// The unit writes patient numbers as PT-12345. They were stored exactly as
// typed, and the duplicate check was an exact match, so "pt-12345",
// "PT 12345" and "PT-12345" were three different patients — the same person
// could be registered again by typing the number slightly differently.
//
//   normalizeHospitalNumber  the form to store and show ("PT-12345")
//   hospitalNumberKey        the form to compare: upper case, letters and
//                            digits only ("PT12345") — case, spaces, dashes,
//                            slashes and dots never make two numbers differ
//
// Keep in step with src/utils/hospitalNumber.ts (a test checks they agree).
// ============================================================================

const PT_FORM = /^P\s*T[\s\-_/.:]*(\d{1,10})$/i;

export function normalizeHospitalNumber(raw) {
  if (raw === null || raw === undefined) return '';
  const s = String(raw).trim().replace(/\s+/g, ' ');
  if (!s) return '';
  const m = PT_FORM.exec(s);
  if (m) return `PT-${m[1]}`;
  // Bare digits are a PT number typed without its prefix.
  if (/^\d{1,10}$/.test(s)) return `PT-${s}`;
  // Anything else (older UNTH/2024/0001 style numbers) keeps its shape, upper-cased.
  return s.toUpperCase().replace(/\s*([\-/])\s*/g, '$1');
}

export function hospitalNumberKey(raw) {
  return normalizeHospitalNumber(raw).toUpperCase().replace(/[^A-Z0-9]/g, '');
}

export function isPtFormat(raw) {
  return /^PT-\d{1,10}$/.test(normalizeHospitalNumber(raw));
}

/** SQL expression giving the matching key of a hospital_number column. */
export const KEY_SQL = (col = 'hospital_number') =>
  `regexp_replace(upper(coalesce(${col}, '')), '[^A-Z0-9]', '', 'g')`;

/**
 * Registered patients whose number matches, ignoring case and punctuation.
 * `excludeId` leaves out the patient being edited.
 */
export async function findPatientsByHospitalNumber(query, raw, excludeId = null) {
  const key = hospitalNumberKey(raw);
  if (!key) return [];
  await ensureHospitalNumberIndex(query);
  const r = await query(
    `SELECT id, hospital_number, first_name, last_name, date_of_birth, gender, created_at
       FROM patients
      WHERE ${KEY_SQL()} = $1
        AND ($2::text IS NULL OR id::text <> $2::text)
        AND COALESCE(is_active, TRUE) = TRUE
      ORDER BY created_at ASC
      LIMIT 5`,
    [key, excludeId == null ? null : String(excludeId)],
  ).catch(async (e) => {
    // Deployments without patients.is_active.
    if (!/is_active/.test(e.message || '')) throw e;
    return query(
      `SELECT id, hospital_number, first_name, last_name, date_of_birth, gender, created_at
         FROM patients WHERE ${KEY_SQL()} = $1 AND ($2::text IS NULL OR id::text <> $2::text)
        ORDER BY created_at ASC LIMIT 5`,
      [key, excludeId == null ? null : String(excludeId)]);
  });
  return r.rows;
}

/** The 409 body for a number that is already taken. */
export function duplicateResponse(rows, raw) {
  const p = rows[0];
  const name = `${p.first_name || ''} ${p.last_name || ''}`.trim() || 'another patient';
  return {
    error: `Patient number ${normalizeHospitalNumber(raw)} is already registered to ${name}.`,
    code: 'DUPLICATE_HOSPITAL_NUMBER',
    existing: rows.map((x) => ({
      id: x.id, hospital_number: x.hospital_number,
      name: `${x.first_name || ''} ${x.last_name || ''}`.trim(),
      date_of_birth: x.date_of_birth, gender: x.gender, created_at: x.created_at,
    })),
  };
}

/**
 * The guarantee behind every route: a unique index on the matching key, so no
 * path — the registration form, quick add, consult intake, bulk admit, sync
 * replay of an offline registration — can store the same number twice.
 *
 * It cannot be built while the table already holds two patients with the
 * same key; then it is skipped (each route still checks before inserting)
 * and the duplicates are listed by listDuplicateHospitalNumbers() for an
 * administrator to merge. Tried once per instance; never throws.
 */
let indexTried = false;
export async function ensureHospitalNumberIndex(query) {
  if (indexTried) return;
  indexTried = true;
  try {
    await query(
      `CREATE UNIQUE INDEX IF NOT EXISTS ux_patients_hospital_number_key
         ON patients ((${KEY_SQL()}))
         WHERE hospital_number IS NOT NULL AND hospital_number <> ''`);
  } catch (e) {
    console.warn('ux_patients_hospital_number_key not created (existing duplicates?):', e.message);
  }
}

/** Groups of patients that share a patient number (ignoring case and punctuation). */
export async function listDuplicateHospitalNumbers(query) {
  const r = await query(
    `SELECT ${KEY_SQL()} AS key,
            json_agg(json_build_object(
              'id', id, 'hospital_number', hospital_number,
              'name', trim(coalesce(first_name, '') || ' ' || coalesce(last_name, '')),
              'created_at', created_at) ORDER BY created_at) AS patients
       FROM patients
      WHERE hospital_number IS NOT NULL AND hospital_number <> ''
      GROUP BY 1 HAVING COUNT(*) > 1
      ORDER BY 1`);
  return r.rows;
}
