// MDT (Multidisciplinary Team) API endpoint
import { query } from './_lib/db.js';
import { cors, authenticateRequest } from './_lib/auth.js';

export default async function handler(req, res) {
  if (cors(req, res)) return;

  const auth = authenticateRequest(req);
  if (!auth.authenticated) {
    return res.status(401).json({ error: auth.error });
  }

  const { method } = req;
  const url = new URL(req.url, `http://${req.headers.host}`);
  const pathParts = url.pathname.replace('/api/mdt', '').split('/').filter(Boolean);
  const resource = pathParts[0]; // patient-teams, meetings, contact-logs
  const id = pathParts[1];

  try {
    // Route to appropriate handler
    if (resource === 'patient-teams' || !resource) {
      return await handlePatientTeams(method, id, req.body, res);
    }
    if (resource === 'meetings') {
      return await handleMeetings(method, id, req.body, res);
    }
    if (resource === 'contact-logs') {
      return await handleContactLogs(method, id, req.body, res);
    }
    if (resource === 'set-patient-type') {
      return await handleSetPatientType(method, req.body, res);
    }
    if (resource === 'patient-info') {
      return await handleGetPatientMDTInfo(method, id, res);
    }

    res.status(404).json({ error: 'Resource not found' });
  } catch (error) {
    console.error('MDT API error:', error);
    res.status(500).json({ error: 'Internal server error', message: error.message });
  }
}

// MDT Patient Teams CRUD
async function handlePatientTeams(method, id, body, res) {
  switch (method) {
    case 'GET':
      if (id) {
        const result = await query('SELECT * FROM mdt_patient_teams WHERE id = $1', [id]);
        if (result.rows.length === 0) {
          return res.status(404).json({ error: 'MDT team not found' });
        }
        return res.status(200).json(result.rows[0]);
      }
      const teams = await query(
        'SELECT * FROM mdt_patient_teams WHERE is_active = true ORDER BY updated_at DESC'
      );
      return res.status(200).json(teams.rows);

    case 'POST':
      const { patient_id, patient_name, hospital_number, primary_specialty, specialties } = body;
      const insertResult = await query(
        `INSERT INTO mdt_patient_teams 
         (patient_id, patient_name, hospital_number, primary_specialty, specialties, is_active)
         VALUES ($1, $2, $3, $4, $5, true)
         RETURNING *`,
        [patient_id, patient_name, hospital_number, primary_specialty || 'Plastic Surgery', JSON.stringify(specialties || [])]
      );
      return res.status(201).json(insertResult.rows[0]);

    case 'PUT':
      if (!id) return res.status(400).json({ error: 'ID required' });
      const updateResult = await query(
        `UPDATE mdt_patient_teams SET
         patient_name = COALESCE($1, patient_name),
         hospital_number = COALESCE($2, hospital_number),
         primary_specialty = COALESCE($3, primary_specialty),
         specialties = COALESCE($4, specialties),
         is_active = COALESCE($5, is_active),
         updated_at = CURRENT_TIMESTAMP
         WHERE id = $6
         RETURNING *`,
        [body.patient_name, body.hospital_number, body.primary_specialty, 
         body.specialties ? JSON.stringify(body.specialties) : null, body.is_active, id]
      );
      if (updateResult.rows.length === 0) {
        return res.status(404).json({ error: 'MDT team not found' });
      }
      return res.status(200).json(updateResult.rows[0]);

    case 'DELETE':
      if (!id) return res.status(400).json({ error: 'ID required' });
      await query('UPDATE mdt_patient_teams SET is_active = false, updated_at = CURRENT_TIMESTAMP WHERE id = $1', [id]);
      return res.status(200).json({ success: true });

    default:
      return res.status(405).json({ error: 'Method not allowed' });
  }
}

// MDT Meetings CRUD
async function handleMeetings(method, id, body, res) {
  switch (method) {
    case 'GET':
      if (id) {
        const result = await query('SELECT * FROM mdt_meetings WHERE id = $1', [id]);
        if (result.rows.length === 0) {
          return res.status(404).json({ error: 'Meeting not found' });
        }
        return res.status(200).json(result.rows[0]);
      }
      const meetings = await query(
        'SELECT * FROM mdt_meetings ORDER BY meeting_date DESC, created_at DESC LIMIT 100'
      );
      return res.status(200).json(meetings.rows);

    case 'POST':
      const insertResult = await query(
        `INSERT INTO mdt_meetings 
         (patient_id, patient_name, hospital_number, meeting_title, meeting_date, meeting_time,
          location, meeting_type, status, agenda, attending_specialties, discussion_points,
          decisions_made, action_items, next_meeting_date, created_by)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16)
         RETURNING *`,
        [body.patient_id, body.patient_name, body.hospital_number, body.meeting_title,
         body.meeting_date, body.meeting_time, body.location, body.meeting_type || 'routine',
         body.status || 'scheduled', body.agenda, JSON.stringify(body.attending_specialties || []),
         body.discussion_points, body.decisions_made, JSON.stringify(body.action_items || []),
         body.next_meeting_date, body.created_by]
      );
      return res.status(201).json(insertResult.rows[0]);

    case 'PUT':
      if (!id) return res.status(400).json({ error: 'ID required' });
      const updateResult = await query(
        `UPDATE mdt_meetings SET
         meeting_title = COALESCE($1, meeting_title),
         meeting_date = COALESCE($2, meeting_date),
         meeting_time = COALESCE($3, meeting_time),
         location = COALESCE($4, location),
         meeting_type = COALESCE($5, meeting_type),
         status = COALESCE($6, status),
         agenda = COALESCE($7, agenda),
         attending_specialties = COALESCE($8, attending_specialties),
         discussion_points = COALESCE($9, discussion_points),
         decisions_made = COALESCE($10, decisions_made),
         action_items = COALESCE($11, action_items),
         next_meeting_date = COALESCE($12, next_meeting_date),
         updated_at = CURRENT_TIMESTAMP
         WHERE id = $13
         RETURNING *`,
        [body.meeting_title, body.meeting_date, body.meeting_time, body.location,
         body.meeting_type, body.status, body.agenda,
         body.attending_specialties ? JSON.stringify(body.attending_specialties) : null,
         body.discussion_points, body.decisions_made,
         body.action_items ? JSON.stringify(body.action_items) : null,
         body.next_meeting_date, id]
      );
      if (updateResult.rows.length === 0) {
        return res.status(404).json({ error: 'Meeting not found' });
      }
      return res.status(200).json(updateResult.rows[0]);

    case 'DELETE':
      if (!id) return res.status(400).json({ error: 'ID required' });
      await query('DELETE FROM mdt_meetings WHERE id = $1', [id]);
      return res.status(200).json({ success: true });

    default:
      return res.status(405).json({ error: 'Method not allowed' });
  }
}

// MDT Contact Logs CRUD
async function handleContactLogs(method, id, body, res) {
  switch (method) {
    case 'GET':
      if (id) {
        const result = await query('SELECT * FROM mdt_contact_logs WHERE id = $1', [id]);
        if (result.rows.length === 0) {
          return res.status(404).json({ error: 'Contact log not found' });
        }
        return res.status(200).json(result.rows[0]);
      }
      const logs = await query(
        'SELECT * FROM mdt_contact_logs ORDER BY contact_date DESC, created_at DESC LIMIT 100'
      );
      return res.status(200).json(logs.rows);

    case 'POST':
      const insertResult = await query(
        `INSERT INTO mdt_contact_logs 
         (patient_id, patient_name, hospital_number, specialty_id, specialty_name,
          contact_type, contact_date, contact_time, contacted_person, reason,
          discussion_summary, outcome, follow_up_required, follow_up_date, created_by)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15)
         RETURNING *`,
        [body.patient_id, body.patient_name, body.hospital_number, body.specialty_id,
         body.specialty_name, body.contact_type, body.contact_date, body.contact_time,
         body.contacted_person, body.reason, body.discussion_summary, body.outcome,
         body.follow_up_required || false, body.follow_up_date, body.created_by]
      );
      return res.status(201).json(insertResult.rows[0]);

    case 'PUT':
      if (!id) return res.status(400).json({ error: 'ID required' });
      const updateResult = await query(
        `UPDATE mdt_contact_logs SET
         specialty_name = COALESCE($1, specialty_name),
         contact_type = COALESCE($2, contact_type),
         contacted_person = COALESCE($3, contacted_person),
         reason = COALESCE($4, reason),
         discussion_summary = COALESCE($5, discussion_summary),
         outcome = COALESCE($6, outcome),
         follow_up_required = COALESCE($7, follow_up_required),
         follow_up_date = COALESCE($8, follow_up_date),
         updated_at = CURRENT_TIMESTAMP
         WHERE id = $9
         RETURNING *`,
        [body.specialty_name, body.contact_type, body.contacted_person, body.reason,
         body.discussion_summary, body.outcome, body.follow_up_required, body.follow_up_date, id]
      );
      if (updateResult.rows.length === 0) {
        return res.status(404).json({ error: 'Contact log not found' });
      }
      return res.status(200).json(updateResult.rows[0]);

    case 'DELETE':
      if (!id) return res.status(400).json({ error: 'ID required' });
      await query('DELETE FROM mdt_contact_logs WHERE id = $1', [id]);
      return res.status(200).json({ success: true });

    default:
      return res.status(405).json({ error: 'Method not allowed' });
  }
}

// Set patient type (primary vs consult) and auto-register MDT
async function handleSetPatientType(method, body, res) {
  if (method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { patient_id, patient_type, consulting_unit, referring_hospital, specialties, patient_name, hospital_number } = body;
  if (!patient_id || !patient_type) {
    return res.status(400).json({ error: 'patient_id and patient_type are required' });
  }

  // Update patient record
  try {
    await query(`
      DO $$ BEGIN
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'patients' AND column_name = 'patient_type') THEN
          ALTER TABLE patients ADD COLUMN patient_type VARCHAR(50) DEFAULT 'primary';
        END IF;
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'patients' AND column_name = 'consulting_unit') THEN
          ALTER TABLE patients ADD COLUMN consulting_unit VARCHAR(255);
        END IF;
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'patients' AND column_name = 'referring_hospital') THEN
          ALTER TABLE patients ADD COLUMN referring_hospital VARCHAR(255);
        END IF;
      END $$;
    `);
  } catch (e) { /* columns may already exist */ }

  await query(
    `UPDATE patients SET patient_type = $1, consulting_unit = $2, referring_hospital = $3, updated_at = CURRENT_TIMESTAMP WHERE id = $4`,
    [patient_type, consulting_unit || null, referring_hospital || null, parseInt(patient_id, 10)]
  );

  // If consult, auto-register/update MDT team
  if (patient_type === 'consult') {
    const existing = await query('SELECT id FROM mdt_patient_teams WHERE patient_id = $1', [parseInt(patient_id, 10)]);
    if (existing.rows.length > 0) {
      await query(
        `UPDATE mdt_patient_teams SET specialties = $1, is_active = true, updated_at = CURRENT_TIMESTAMP WHERE patient_id = $2`,
        [JSON.stringify(specialties || [consulting_unit].filter(Boolean)), parseInt(patient_id, 10)]
      );
    } else {
      await query(
        `INSERT INTO mdt_patient_teams (patient_id, patient_name, hospital_number, primary_specialty, specialties, is_active)
         VALUES ($1, $2, $3, $4, $5, true)`,
        [
          parseInt(patient_id, 10),
          patient_name || '',
          hospital_number || '',
          consulting_unit || 'Plastic Surgery',
          JSON.stringify(specialties || [consulting_unit].filter(Boolean))
        ]
      );
    }
  } else {
    // If setting back to primary, deactivate MDT team
    await query(
      `UPDATE mdt_patient_teams SET is_active = false, updated_at = CURRENT_TIMESTAMP WHERE patient_id = $1`,
      [parseInt(patient_id, 10)]
    );
  }

  return res.status(200).json({ success: true, patient_type });
}

// Get patient MDT info (type, team, specialties)
async function handleGetPatientMDTInfo(method, patientId, res) {
  if (method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });
  if (!patientId) return res.status(400).json({ error: 'Patient ID required' });

  // Get patient type info
  let patientInfo = { patient_type: 'primary', consulting_unit: null, referring_hospital: null };
  try {
    const pResult = await query(
      'SELECT patient_type, consulting_unit, referring_hospital FROM patients WHERE id = $1',
      [parseInt(patientId, 10)]
    );
    if (pResult.rows.length > 0) {
      patientInfo = pResult.rows[0];
    }
  } catch {
    // columns may not exist yet
  }

  // Get MDT team
  let mdtTeam = null;
  try {
    const tResult = await query(
      'SELECT * FROM mdt_patient_teams WHERE patient_id = $1 AND is_active = true',
      [parseInt(patientId, 10)]
    );
    if (tResult.rows.length > 0) {
      mdtTeam = tResult.rows[0];
    }
  } catch { /* table may not exist */ }

  return res.status(200).json({
    patient_type: patientInfo.patient_type || 'primary',
    consulting_unit: patientInfo.consulting_unit,
    referring_hospital: patientInfo.referring_hospital,
    mdt_team: mdtTeam,
  });
}
