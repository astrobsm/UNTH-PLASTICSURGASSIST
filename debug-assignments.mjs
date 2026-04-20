import 'dotenv/config';
import { query } from './api/_lib/db.js';

try {
  const r = await query("SELECT id, full_name FROM users WHERE full_name ILIKE '%Obetta%'");
  console.log('User:', JSON.stringify(r.rows));
  
  const uid = r.rows[0]?.id;
  if (uid) {
    // Check with various matching approaches
    const a1 = await query(
      "SELECT COUNT(*) as cnt FROM patient_assignments WHERE house_officer_id = $1::text AND is_active = true",
      [uid]
    );
    console.log('Match by int::text:', a1.rows[0]);

    const a2 = await query(
      "SELECT COUNT(*) as cnt FROM patient_assignments WHERE house_officer_id = $1 AND is_active = true",
      [String(uid)]
    );
    console.log('Match by String(id):', a2.rows[0]);

    // Show all distinct house_officer_id values
    const all = await query(
      "SELECT house_officer_id, COUNT(*) as cnt FROM patient_assignments WHERE is_active = true AND house_officer_id IS NOT NULL GROUP BY house_officer_id ORDER BY cnt DESC LIMIT 15"
    );
    console.log('All HO assignments:', JSON.stringify(all.rows));

    // Show a sample row for this user
    const sample = await query(
      "SELECT id, patient_id, house_officer_id, is_active FROM patient_assignments WHERE house_officer_id IS NOT NULL LIMIT 5"
    );
    console.log('Sample rows:', JSON.stringify(sample.rows));
  }
  process.exit(0);
} catch (e) {
  console.error('Error:', e.message);
  process.exit(1);
}
