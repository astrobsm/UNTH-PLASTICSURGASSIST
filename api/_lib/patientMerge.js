// ============================================================================
// Merging two registrations of the same patient.
//
// Everything recorded against the duplicate — admissions, ward rounds,
// prescriptions, wounds, labs, consults, plans — is moved to the record being
// kept, in one transaction. The tables are found from the schema (every base
// table with a patient_id column), not from a list that would fall behind.
//
// The duplicate is not deleted (several tables cascade on delete, and the
// audit trail must survive): it is deactivated, marked merged_into, and its
// number is retired as MERGED-<id>-<number> so the number is free again and
// the unique patient-number index can be built.
//
// A table whose rows cannot be moved (e.g. a one-row-per-patient table where
// both patients already have a row) is reported, not forced; its rows stay on
// the retired record and are listed back to the administrator.
// ============================================================================

import { getPool, query } from './db.js';
import { hospitalNumberKey, normalizeHospitalNumber, ensureHospitalNumberIndex, resetHospitalNumberIndexAttempt } from './hospitalNumber.js';

// Patient fields the kept record takes from the duplicate when it has none.
const FILL_FIELDS = [
  'date_of_birth', 'gender', 'phone', 'email', 'address', 'blood_group', 'genotype',
  'allergies', 'medical_history', 'primary_diagnosis', 'emergency_contact_name',
  'emergency_contact_phone', 'ward', 'bed_number', 'other_names',
];

async function patientIdTables(db) {
  const r = await db.query(
    `SELECT c.table_name, c.data_type,
            EXISTS (SELECT 1 FROM information_schema.columns h
                     WHERE h.table_schema = c.table_schema AND h.table_name = c.table_name
                       AND h.column_name = 'hospital_number') AS has_hn
       FROM information_schema.columns c
       JOIN information_schema.tables t
         ON t.table_schema = c.table_schema AND t.table_name = c.table_name AND t.table_type = 'BASE TABLE'
      WHERE c.table_schema = 'public' AND c.column_name = 'patient_id' AND c.table_name <> 'patients'
      ORDER BY c.table_name`);
  return r.rows;
}

const castFor = (dataType) =>
  /integer|bigint|smallint/.test(dataType) ? 'int' : dataType === 'uuid' ? 'uuid' : 'text';

/** How many records each patient has, by table — so the right one is kept. */
export async function recordCounts(patientIds) {
  const ids = patientIds.map(String);
  const totals = Object.fromEntries(ids.map((id) => [id, { total: 0, tables: {} }]));
  for (const { table_name } of await patientIdTables({ query })) {
    try {
      const r = await query(
        `SELECT patient_id::text AS pid, COUNT(*)::int AS n FROM "${table_name}"
          WHERE patient_id::text = ANY($1::text[]) GROUP BY 1`, [ids]);
      for (const row of r.rows) {
        if (!totals[row.pid]) continue;
        totals[row.pid].total += row.n;
        totals[row.pid].tables[table_name] = row.n;
      }
    } catch { /* unreadable table: counted as none */ }
  }
  return totals;
}

export async function mergePatients({ keepId, dropId, user, force = false }) {
  if (keepId == null || dropId == null) throw Object.assign(new Error('keepId and dropId are required'), { status: 400 });
  if (String(keepId) === String(dropId)) throw Object.assign(new Error('Choose two different patients'), { status: 400 });

  // Columns used to mark the retired record; added once, outside the transaction.
  await query(`ALTER TABLE patients ADD COLUMN IF NOT EXISTS merged_into TEXT`).catch(() => {});
  await query(`ALTER TABLE patients ADD COLUMN IF NOT EXISTS merged_at TIMESTAMPTZ`).catch(() => {});
  await query(`ALTER TABLE patients ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT TRUE`).catch(() => {});

  const client = await getPool().connect();
  const moved = {};
  const notMoved = [];
  try {
    await client.query('BEGIN');
    const rows = (await client.query(
      `SELECT * FROM patients WHERE id::text = ANY($1::text[]) FOR UPDATE`, [[String(keepId), String(dropId)]])).rows;
    const keep = rows.find((r) => String(r.id) === String(keepId));
    const drop = rows.find((r) => String(r.id) === String(dropId));
    if (!keep || !drop) throw Object.assign(new Error('One of the patients was not found'), { status: 404 });
    if (drop.merged_into) throw Object.assign(new Error('That record has already been merged'), { status: 409 });
    if (!force && hospitalNumberKey(keep.hospital_number) !== hospitalNumberKey(drop.hospital_number)) {
      throw Object.assign(new Error('These two patients have different patient numbers. Confirm to merge them anyway.'),
        { status: 409, code: 'DIFFERENT_NUMBERS' });
    }

    // The kept record's number in its written form (PT-12345).
    const keepNumber = normalizeHospitalNumber(keep.hospital_number) || keep.hospital_number;

    for (const t of await patientIdTables(client)) {
      const cast = castFor(t.data_type);
      await client.query('SAVEPOINT mv');
      try {
        const r = await client.query(
          `UPDATE "${t.table_name}" SET patient_id = $1::${cast}${t.has_hn ? ', hospital_number = $3' : ''}
            WHERE patient_id::text = $2::text`,
          t.has_hn ? [String(keep.id), String(drop.id), keepNumber] : [String(keep.id), String(drop.id)]);
        if (r.rowCount) moved[t.table_name] = r.rowCount;
        // The kept patient's own rows carry the same written number.
        if (t.has_hn) {
          await client.query(
            `UPDATE "${t.table_name}" SET hospital_number = $1
              WHERE patient_id::text = $2::text AND hospital_number IS DISTINCT FROM $1`,
            [keepNumber, String(keep.id)]);
        }
        await client.query('RELEASE SAVEPOINT mv');
      } catch (e) {
        await client.query('ROLLBACK TO SAVEPOINT mv');
        const left = await client.query(
          `SELECT COUNT(*)::int AS n FROM "${t.table_name}" WHERE patient_id::text = $1::text`, [String(drop.id)])
          .catch(() => ({ rows: [{ n: 0 }] }));
        if (left.rows[0].n) notMoved.push({ table: t.table_name, rows: left.rows[0].n, reason: e.message });
      }
    }

    // Fill the kept record's blanks from the duplicate.
    const present = new Set((await client.query(
      `SELECT column_name FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'patients'`)).rows
      .map((r) => r.column_name));
    const fills = FILL_FIELDS.filter((c) => present.has(c));
    // One column at a time, each in a savepoint, so an odd column type never
    // aborts the merge; a field the kept record already has is never overwritten.
    for (const c of fills) {
      await client.query('SAVEPOINT fl');
      try {
        await client.query(
          `UPDATE patients k SET "${c}" = d."${c}" FROM patients d
            WHERE k.id = $1 AND d.id = $2
              AND (k."${c}" IS NULL OR k."${c}"::text = '')
              AND d."${c}" IS NOT NULL AND d."${c}"::text <> ''`,
          [keep.id, drop.id]);
        await client.query('RELEASE SAVEPOINT fl');
      } catch { await client.query('ROLLBACK TO SAVEPOINT fl'); }
    }

    // Retire the duplicate.
    await client.query(
      `UPDATE patients SET is_active = FALSE, merged_into = $2, merged_at = NOW(),
              hospital_number = 'MERGED-' || id::text || '-' || COALESCE(hospital_number, ''),
              updated_at = NOW()
        WHERE id = $1`, [drop.id, String(keep.id)]);

    if (keepNumber && keepNumber !== keep.hospital_number) {
      await client.query('SAVEPOINT nm');
      try {
        await client.query(`UPDATE patients SET hospital_number = $2 WHERE id = $1`, [keep.id, keepNumber]);
        await client.query('RELEASE SAVEPOINT nm');
        keep.hospital_number = keepNumber;
      } catch { await client.query('ROLLBACK TO SAVEPOINT nm'); }
    }

    await client.query('SAVEPOINT au');
    try {
      await client.query(
        `INSERT INTO audit_logs (user_id, user_name, user_role, action, resource_type, resource_id, details)
         VALUES ($1, $2, $3, 'patient_merged', 'patient', $4, $5)`,
        [String(user?.id ?? ''), user?.name || user?.fullName || null, user?.role || null, String(keep.id),
         JSON.stringify({ kept: { id: keep.id, hospital_number: keep.hospital_number, name: `${keep.first_name} ${keep.last_name}` },
                          merged: { id: drop.id, hospital_number: drop.hospital_number, name: `${drop.first_name} ${drop.last_name}` },
                          moved, notMoved })]);
      await client.query('RELEASE SAVEPOINT au');
    } catch { await client.query('ROLLBACK TO SAVEPOINT au'); }

    await client.query('COMMIT');

    // With the duplicate's number retired, the unique index may now be buildable.
    resetHospitalNumberIndexAttempt();
    await ensureHospitalNumberIndex(query);

    return {
      kept: { id: keep.id, hospital_number: keep.hospital_number },
      merged: { id: drop.id, hospital_number: drop.hospital_number },
      moved, movedTotal: Object.values(moved).reduce((a, b) => a + b, 0), notMoved,
    };
  } catch (e) {
    await client.query('ROLLBACK').catch(() => {});
    throw e;
  } finally {
    client.release();
  }
}
