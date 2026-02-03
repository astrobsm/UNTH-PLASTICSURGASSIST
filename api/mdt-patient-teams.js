// MDT Patient Teams sync endpoint
import { query } from './_lib/db.js';
import { cors, authenticateRequest } from './_lib/auth.js';

export default async function handler(req, res) {
  if (cors(req, res)) return;

  const auth = authenticateRequest(req);
  if (!auth.authenticated) {
    return res.status(401).json({ error: auth.error });
  }

  if (req.method === 'GET') {
    try {
      const result = await query(
        `SELECT * FROM mdt_patient_teams 
         WHERE is_active = true 
         ORDER BY updated_at DESC 
         LIMIT 500`
      );
      return res.status(200).json(result.rows);
    } catch (error) {
      console.error('Error fetching MDT patient teams:', error);
      return res.status(500).json({ error: error.message });
    }
  }

  if (req.method === 'POST') {
    try {
      const { patient_id, patient_name, hospital_number, primary_specialty, specialties } = req.body;
      
      // Check if team already exists for this patient
      const existing = await query(
        'SELECT id FROM mdt_patient_teams WHERE patient_id = $1',
        [patient_id]
      );
      
      if (existing.rows.length > 0) {
        // Update existing team
        const result = await query(
          `UPDATE mdt_patient_teams SET
           patient_name = $1,
           hospital_number = $2,
           primary_specialty = $3,
           specialties = $4,
           updated_at = CURRENT_TIMESTAMP
           WHERE patient_id = $5
           RETURNING *`,
          [patient_name, hospital_number, primary_specialty || 'Plastic Surgery', JSON.stringify(specialties || []), patient_id]
        );
        return res.status(200).json(result.rows[0]);
      } else {
        // Insert new team
        const result = await query(
          `INSERT INTO mdt_patient_teams 
           (patient_id, patient_name, hospital_number, primary_specialty, specialties, is_active)
           VALUES ($1, $2, $3, $4, $5, true)
           RETURNING *`,
          [patient_id, patient_name, hospital_number, primary_specialty || 'Plastic Surgery', JSON.stringify(specialties || [])]
        );
        return res.status(201).json(result.rows[0]);
      }
    } catch (error) {
      console.error('Error creating MDT patient team:', error);
      return res.status(500).json({ error: error.message });
    }
  }

  res.status(405).json({ error: 'Method not allowed' });
}
