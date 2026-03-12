// Sync API endpoint for offline data synchronization
import { query } from '../_lib/db.js';
import { cors, authenticateRequest } from '../_lib/auth.js';

export default async function handler(req, res) {
  if (cors(req, res)) return;

  const auth = authenticateRequest(req);
  if (!auth.authenticated) {
    return res.status(401).json({ error: auth.error });
  }

  const { method } = req;
  const url = new URL(req.url, `http://${req.headers.host}`);
  const pathParts = url.pathname.replace('/api/sync', '').split('/').filter(Boolean);
  const action = pathParts[0];
  const subId = pathParts[1]; // e.g. patient ID for /sync/patients/40

  try {
    switch (method) {
      case 'POST':
        if (action === 'push') {
          return await handlePush(req.body, auth.user, res);
        }
        if (action === 'pull') {
          return await handlePull(req.body, auth.user, res);
        }
        return await handleFullSync(req.body, auth.user, res);
      case 'GET':
        // Handle /sync/patients, /sync/surgeries, etc.
        if (action === 'patients') {
          if (subId) {
            return await getSyncPatientById(subId, res);
          }
          return await getSyncPatients(res);
        }
        if (action === 'surgeries' || action === 'surgery-bookings') {
          return await getSyncEntity('surgeries', res);
        }
        if (action === 'admissions') {
          return await getSyncEntity('admissions', res);
        }
        if (action === 'treatment-plans') {
          return await getSyncEntity('treatment_plans', res);
        }
        if (action === 'lab-orders' || action === 'lab-investigations') {
          return await getSyncEntity('lab_orders', res);
        }
        if (action === 'prescriptions') {
          return await getSyncEntity('prescriptions', res);
        }
        if (action === 'wound-care') {
          return await getSyncEntity('wound_care_records', res);
        }
        if (action === 'ward-rounds') {
          return await getSyncEntity('ward_rounds', res);
        }
        if (action === 'discharges' || action === 'discharge-summaries') {
          return await getSyncEntity('discharge_summaries', res);
        }
        // MDT tables
        if (action === 'mdt-patient-teams' || action === 'mdt_patient_teams') {
          return await getSyncEntity('mdt_patient_teams', res);
        }
        if (action === 'mdt-meetings' || action === 'mdt_meetings') {
          return await getSyncEntity('mdt_meetings', res);
        }
        if (action === 'mdt-contact-logs' || action === 'mdt_contact_logs') {
          return await getSyncEntity('mdt_contact_logs', res);
        }
        // Clinical assessment tables
        if (action === 'blood-transfusions' || action === 'blood_transfusions') {
          return await getSyncEntity('blood_transfusions', res);
        }
        if (action === 'burn-patients' || action === 'burn_patients') {
          return await getSyncEntity('burn_patients', res);
        }
        if (action === 'diabetic-foot-assessments' || action === 'diabetic_foot_assessments') {
          return await getSyncEntity('diabetic_foot_assessments', res);
        }
        if (action === 'preoperative-assessments' || action === 'preoperative_assessments') {
          return await getSyncEntity('preoperative_assessments', res);
        }
        if (action === 'dvt-assessments' || action === 'dvt_assessments') {
          return await getSyncEntity('dvt_assessments', res);
        }
        if (action === 'pressure-sore-assessments' || action === 'pressure_sore_assessments') {
          return await getSyncEntity('pressure_sore_assessments', res);
        }
        if (action === 'nutritional-assessments' || action === 'nutritional_assessments') {
          return await getSyncEntity('nutritional_assessments', res);
        }
        if (action === 'procedures') {
          return await getSyncEntity('procedures', res);
        }
        if (action === 'who-safety-checklists' || action === 'who_safety_checklists') {
          return await getSyncEntity('who_safety_checklists', res);
        }
        // Paperwork, CME, Education tables
        if (action === 'paperwork-documents' || action === 'paperwork_documents') {
          return await getSyncEntity('paperwork_documents', res);
        }
        if (action === 'cme-topics' || action === 'cme_topics') {
          return await getSyncEntity('cme_topics', res);
        }
        if (action === 'cme-test-sessions' || action === 'cme_test_sessions') {
          return await getSyncEntity('cme_test_sessions', res);
        }
        if (action === 'cme-progress' || action === 'cme_progress') {
          return await getSyncEntity('cme_progress', res);
        }
        if (action === 'cme-certificates' || action === 'cme_certificates') {
          return await getSyncEntity('cme_certificates', res);
        }
        if (action === 'cme-articles' || action === 'cme_articles') {
          return await getSyncEntity('cme_articles', res);
        }
        if (action === 'cme-reading-progress' || action === 'cme_reading_progress') {
          return await getSyncEntity('cme_reading_progress', res);
        }
        if (action === 'educational-topics' || action === 'educational_topics') {
          return await getSyncEntity('educational_topics', res);
        }
        if (action === 'weekly-contents' || action === 'weekly_contents') {
          return await getSyncEntity('weekly_contents', res);
        }
        if (action === 'topic-schedules' || action === 'topic_schedules') {
          return await getSyncEntity('topic_schedules', res);
        }
        if (action === 'education-user-progress' || action === 'education_user_progress') {
          return await getSyncEntity('education_user_progress', res);
        }
        if (action === 'ps-unit-rosters' || action === 'ps_unit_rosters') {
          return await getSyncEntity('ps_unit_rosters', res);
        }
        return await getSyncStatus(auth.user, res);
      default:
        res.status(405).json({ error: 'Method not allowed' });
    }
  } catch (error) {
    console.error('Sync API error:', error);
    res.status(500).json({ error: 'Internal server error', message: error.message });
  }
}

async function getSyncPatients(res) {
  const result = await query(
    `SELECT id, hospital_number, first_name, last_name, date_of_birth, gender, 
            phone, email, address, blood_group, allergies, medical_history,
            created_at, updated_at
     FROM patients ORDER BY updated_at DESC LIMIT 500`
  );
  res.status(200).json(result.rows);
}

async function getSyncPatientById(id, res) {
  const numericId = parseInt(id, 10);
  let result;
  if (!isNaN(numericId)) {
    result = await query(
      `SELECT id, hospital_number, first_name, last_name, date_of_birth, gender,
              phone, email, address, blood_group, allergies, medical_history,
              primary_diagnosis, secondary_diagnoses, ward, bed_number,
              emergency_contact_name, emergency_contact_phone,
              created_at, updated_at
       FROM patients WHERE id = $1`, [numericId]
    );
  }
  if (!result || result.rows.length === 0) {
    // Try by hospital_number
    result = await query(
      `SELECT id, hospital_number, first_name, last_name, date_of_birth, gender,
              phone, email, address, blood_group, allergies, medical_history,
              primary_diagnosis, secondary_diagnoses, ward, bed_number,
              emergency_contact_name, emergency_contact_phone,
              created_at, updated_at
       FROM patients WHERE hospital_number = $1`, [id]
    );
  }
  if (result.rows.length === 0) {
    return res.status(404).json({ error: 'Patient not found' });
  }
  res.status(200).json({ patient: result.rows[0] });
}

async function getSyncEntity(tableName, res) {
  const result = await query(
    `SELECT * FROM ${tableName} ORDER BY updated_at DESC LIMIT 500`
  );
  res.status(200).json(result.rows);
}

async function getSyncStatus(user, res) {
  const result = await query(
    `SELECT COUNT(*) as pending, MAX(created_at) as last_sync
     FROM sync_queue WHERE user_id = $1 AND status = 'pending'`,
    [user.id]
  );

  res.status(200).json({
    pendingChanges: parseInt(result.rows[0].pending),
    lastSync: result.rows[0].last_sync,
    serverTime: new Date().toISOString()
  });
}

async function handlePush(data, user, res) {
  const { changes } = data;
  
  if (!changes || !Array.isArray(changes)) {
    return res.status(400).json({ error: 'Changes array is required' });
  }

  console.log(`[SYNC PUSH] Received ${changes.length} changes from user ${user.id}`);
  const results = [];
  
  for (const change of changes) {
    const { entityType, entityId, action, payload } = change;
    console.log(`[SYNC PUSH] Processing ${entityType}: ${entityId}`);
    
    try {
      // Handle MDT entities directly for immediate sync
      if (entityType === 'mdt_patient_teams' && payload) {
        const { patient_id, patient_name, hospital_number, primary_specialty, specialties } = payload;
        console.log(`[MDT PUSH] patient_id=${patient_id}, name=${patient_name}, hospital=${hospital_number}`);
        
        if (patient_id) {
          // Convert patient_id to integer (it may come as string from frontend)
          const patientIdInt = parseInt(patient_id, 10);
          if (isNaN(patientIdInt)) {
            console.warn(`[MDT PUSH] Invalid patient_id: ${patient_id} (type: ${typeof patient_id})`);
            results.push({ entityId, status: 'error', error: `Invalid patient_id: ${patient_id}`, debug: { patient_id, type: typeof patient_id } });
            continue;
          }
          
          // Check if patient exists
          const patientExists = await query('SELECT id FROM patients WHERE id = $1', [patientIdInt]);
          console.log(`[MDT PUSH] Patient ${patientIdInt} exists: ${patientExists.rows.length > 0}`);
          
          if (patientExists.rows.length === 0) {
            // List available patients for debugging
            const allPatients = await query('SELECT id, hospital_number FROM patients LIMIT 20');
            console.warn(`[MDT PUSH] Patient not found: ${patientIdInt}. Available: ${JSON.stringify(allPatients.rows)}`);
            results.push({ 
              entityId, 
              status: 'error', 
              error: `Patient ID ${patientIdInt} not found in database`,
              availablePatients: allPatients.rows
            });
            continue;
          }
          
          // Check if MDT team exists for this patient
          const existing = await query('SELECT id FROM mdt_patient_teams WHERE patient_id = $1', [patientIdInt]);
          if (existing.rows.length > 0) {
            await query(
              `UPDATE mdt_patient_teams SET patient_name = $1, hospital_number = $2, 
               primary_specialty = $3, specialties = $4, updated_at = CURRENT_TIMESTAMP 
               WHERE patient_id = $5`,
              [patient_name, hospital_number, primary_specialty || 'Plastic Surgery', 
               JSON.stringify(specialties || []), patientIdInt]
            );
            console.log(`✅ Updated MDT team for patient ${patientIdInt}`);
          } else {
            await query(
              `INSERT INTO mdt_patient_teams (patient_id, patient_name, hospital_number, 
               primary_specialty, specialties, is_active) VALUES ($1, $2, $3, $4, $5, true)`,
              [patientIdInt, patient_name, hospital_number, primary_specialty || 'Plastic Surgery', 
               JSON.stringify(specialties || [])]
            );
            console.log(`✅ Inserted MDT team for patient ${patientIdInt}`);
          }
          results.push({ entityId, status: 'synced', patientId: patientIdInt });
          continue;
        }
      }
      
      if (entityType === 'mdt_meetings' && payload) {
        const { patient_id, meeting_date, meeting_title } = payload;
        if (patient_id && meeting_date) {
          const patientIdInt = parseInt(patient_id, 10);
          await query(
            `INSERT INTO mdt_meetings (patient_id, patient_name, hospital_number, meeting_title, 
             meeting_date, meeting_time, location, meeting_type, status, agenda, 
             attending_specialties, created_by) 
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
             ON CONFLICT (patient_id, meeting_date) DO UPDATE SET 
             meeting_title = EXCLUDED.meeting_title, updated_at = CURRENT_TIMESTAMP`,
            [patientIdInt, payload.patient_name, payload.hospital_number, meeting_title,
             meeting_date, payload.meeting_time, payload.location, payload.meeting_type || 'routine',
             payload.status || 'scheduled', payload.agenda, 
             JSON.stringify(payload.attending_specialties || []), payload.created_by]
          );
          results.push({ entityId, status: 'synced' });
          continue;
        }
      }
      
      if (entityType === 'mdt_contact_logs' && payload) {
        const { patient_id, contact_date, specialty_id } = payload;
        if (patient_id && contact_date) {
          const patientIdInt = parseInt(patient_id, 10);
          await query(
            `INSERT INTO mdt_contact_logs (patient_id, patient_name, hospital_number, 
             specialty_id, specialty_name, contact_type, contact_date, contact_time, 
             contacted_person, reason, discussion_summary, outcome, follow_up_required, 
             follow_up_date, created_by) 
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15)`,
            [patientIdInt, payload.patient_name, payload.hospital_number, specialty_id,
             payload.specialty_name, payload.contact_type, contact_date, payload.contact_time,
             payload.contacted_person, payload.reason, payload.discussion_summary, 
             payload.outcome, payload.follow_up_required || false, payload.follow_up_date,
             payload.created_by]
          );
          results.push({ entityId, status: 'synced' });
          continue;
        }
      }

      // Handle PS Unit Roster entities
      if (entityType === 'ps_unit_rosters' && payload) {
        try {
          const { start_date, rotation_weeks, senior_registrars, house_officers, is_active } = payload;
          if (start_date) {
            // Deactivate all existing rosters first
            await query('UPDATE ps_unit_rosters SET is_active = false, updated_at = CURRENT_TIMESTAMP');
            // Insert the new active roster
            await query(
              `INSERT INTO ps_unit_rosters (start_date, rotation_weeks, senior_registrars, house_officers, is_active)
               VALUES ($1, $2, $3, $4, $5)`,
              [start_date, rotation_weeks || 2, JSON.stringify(senior_registrars || []),
               JSON.stringify(house_officers || []), is_active !== false]
            );
            results.push({ entityId, status: 'synced' });
            continue;
          }
        } catch (err) {
          console.error('Error syncing roster:', err);
          results.push({ entityId, status: 'error', message: err.message });
          continue;
        }
      }

      // Handle patient entities - upsert by hospital_number (special case: SERIAL primary key)
      if (entityType === 'patients' && payload) {
        try {
          const { hospital_number, first_name, last_name, date_of_birth, gender, phone, email,
                  address, blood_group, allergies, medical_history, primary_diagnosis, 
                  secondary_diagnoses, ward, bed_number, emergency_contact_name, emergency_contact_phone } = payload;
          
          if (hospital_number) {
            const existing = await query('SELECT id FROM patients WHERE hospital_number = $1', [hospital_number]);
            if (existing.rows.length > 0) {
              await query(
                `UPDATE patients SET first_name = COALESCE($1, first_name), last_name = COALESCE($2, last_name), 
                 date_of_birth = COALESCE($3, date_of_birth), gender = COALESCE($4, gender), 
                 phone = COALESCE($5, phone), email = COALESCE($6, email), address = COALESCE($7, address),
                 blood_group = COALESCE($8, blood_group), allergies = COALESCE($9, allergies), 
                 medical_history = COALESCE($10, medical_history), primary_diagnosis = COALESCE($11, primary_diagnosis),
                 updated_at = CURRENT_TIMESTAMP WHERE hospital_number = $12`,
                [first_name, last_name, date_of_birth, gender, phone, email, address,
                 blood_group, allergies, medical_history, primary_diagnosis, hospital_number]
              );
            } else {
              await query(
                `INSERT INTO patients (hospital_number, first_name, last_name, date_of_birth, gender, phone, email, 
                 address, blood_group, allergies, medical_history, primary_diagnosis)
                 VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)`,
                [hospital_number, first_name, last_name, date_of_birth, gender, phone, email, 
                 address, blood_group, allergies, medical_history, primary_diagnosis]
              );
            }
            results.push({ entityId, status: 'synced' });
          } else {
            results.push({ entityId, status: 'skipped', message: 'No hospital_number' });
          }
          continue;
        } catch (err) {
          console.error('Error syncing patient:', err);
          results.push({ entityId, status: 'error', message: err.message });
          continue;
        }
      }

      // Handle clinical assessment entities with upsert
      const clinicalEntities = [
        'blood_transfusions', 'burn_patients', 'diabetic_foot_assessments',
        'preoperative_assessments', 'dvt_assessments', 'pressure_sore_assessments',
        'nutritional_assessments', 'procedures', 'who_safety_checklists',
        'paperwork_documents', 'cme_topics', 'cme_test_sessions',
        'cme_progress', 'cme_certificates', 'cme_articles', 'cme_reading_progress',
        'educational_topics', 'weekly_contents', 'topic_schedules', 'education_user_progress',
        'wound_care_records', 'ward_rounds', 'discharge_summaries',
        'admissions', 'surgeries', 'treatment_plans', 'prescriptions', 'lab_orders',
        'chat_messages', 'chat_rooms', 'audit_logs', 'user_activities'
      ];
      
      if (clinicalEntities.includes(entityType) && payload) {
        try {
          // Tables with SERIAL (integer) primary keys - local auto-increment ids should NOT be used for lookup
          const serialKeyTables = [
            'wound_care_records', 'ward_rounds', 'discharge_summaries',
            'admissions', 'surgeries', 'treatment_plans', 'prescriptions', 'lab_orders'
          ];
          const isSerialKey = serialKeyTables.includes(entityType);

          // Build dynamic upsert query - filter out internal fields and local-only id for SERIAL tables
          const skipKeys = ['serverId', 'synced', 'deleted'];
          if (isSerialKey) skipKeys.push('id'); // don't use local auto-increment id
          const columns = Object.keys(payload).filter(k => !skipKeys.includes(k));
          const values = columns.map(k => {
            const v = payload[k];
            return (v !== null && typeof v === 'object') ? JSON.stringify(v) : v;
          });
          const placeholders = columns.map((_, i) => `$${i + 1}`).join(', ');
          
          // Check if record exists
          let existing = null;
          
          if (!isSerialKey) {
            // VARCHAR id tables: look up by id directly
            const existingId = payload.serverId || payload.id;
            if (existingId) {
              existing = await query(`SELECT id FROM ${entityType} WHERE id = $1`, [existingId]);
            }
          }
          
          // For all entities with patient_id, try lookup by patient_id + date
          if ((!existing || existing.rows.length === 0) && payload.patient_id) {
            const dateFieldMap = {
              'dvt_assessments': 'assessment_date',
              'pressure_sore_assessments': 'assessment_date',
              'nutritional_assessments': 'assessment_date',
              'diabetic_foot_assessments': 'assessment_date',
              'preoperative_assessments': 'assessed_at',
              'blood_transfusions': 'transfusion_date',
              'burn_patients': 'admission_date',
              'procedures': 'scheduled_date',
              'who_safety_checklists': 'created_at',
              'wound_care_records': 'recorded_at',
              'ward_rounds': 'round_date',
              'admissions': 'admission_date',
              'surgeries': 'scheduled_date',
              'prescriptions': 'prescribed_at',
              'lab_orders': 'ordered_at',
              'discharge_summaries': 'discharge_date'
            };
            const dateField = dateFieldMap[entityType];
            if (dateField && payload[dateField]) {
              existing = await query(
                `SELECT id FROM ${entityType} WHERE patient_id = $1 AND ${dateField} = $2`,
                [payload.patient_id, payload[dateField]]
              );
            }
          }
          
          if (existing && existing.rows.length > 0) {
            // Update
            const setClause = columns.map((col, i) => `${col} = $${i + 1}`).join(', ');
            await query(
              `UPDATE ${entityType} SET ${setClause}, updated_at = CURRENT_TIMESTAMP WHERE id = $${columns.length + 1}`,
              [...values, existing.rows[0].id]
            );
          } else {
            // Insert (for SERIAL tables, PostgreSQL auto-generates the id)
            await query(
              `INSERT INTO ${entityType} (${columns.join(', ')}) VALUES (${placeholders})`,
              values
            );
          }
          results.push({ entityId, status: 'synced' });
          continue;
        } catch (err) {
          console.error(`Error syncing ${entityType}:`, err);
          results.push({ entityId, status: 'error', message: err.message });
          continue;
        }
      }
      
      // Queue other changes for processing
      await query(
        `INSERT INTO sync_queue (user_id, entity_type, entity_id, action, data, status)
         VALUES ($1, $2, $3, $4, $5, 'pending')`,
        [user.id, entityType, entityId, action, JSON.stringify(payload)]
      );
      
      results.push({ entityId, status: 'queued' });
    } catch (error) {
      results.push({ entityId, status: 'error', message: error.message });
    }
  }

  res.status(200).json({ 
    success: true, 
    processed: results.length,
    results 
  });
}

async function handlePull(data, user, res) {
  const { since, entities } = data;
  const sinceDate = since ? new Date(since) : new Date(0);
  
  const updates = {};
  
  // Define entities to sync - table names must match init-db.js
  const entityConfigs = {
    patients: { table: 'patients', userField: null },
    surgeries: { table: 'surgeries', userField: null },
    surgery_bookings: { table: 'surgeries', userField: null }, // Frontend uses surgery_bookings
    treatment_plans: { table: 'treatment_plans', userField: null },
    treatmentPlans: { table: 'treatment_plans', userField: null }, // Alias for camelCase
    admissions: { table: 'admissions', userField: null },
    lab_investigations: { table: 'lab_orders', userField: null }, // Frontend uses lab_investigations
    labOrders: { table: 'lab_orders', userField: null },
    prescriptions: { table: 'prescriptions', userField: null },
    wound_care: { table: 'wound_care_records', userField: null }, // Frontend uses wound_care
    woundCare: { table: 'wound_care_records', userField: null },
    ward_rounds: { table: 'ward_rounds', userField: null },
    discharges: { table: 'discharge_summaries', userField: null },
    discharge_summaries: { table: 'discharge_summaries', userField: null },
    // MDT tables
    mdt_patient_teams: { table: 'mdt_patient_teams', userField: null },
    mdt_meetings: { table: 'mdt_meetings', userField: null },
    mdt_contact_logs: { table: 'mdt_contact_logs', userField: null },
    // Clinical assessment tables
    blood_transfusions: { table: 'blood_transfusions', userField: null },
    burn_patients: { table: 'burn_patients', userField: null },
    diabetic_foot_assessments: { table: 'diabetic_foot_assessments', userField: null },
    preoperative_assessments: { table: 'preoperative_assessments', userField: null },
    dvt_assessments: { table: 'dvt_assessments', userField: null },
    pressure_sore_assessments: { table: 'pressure_sore_assessments', userField: null },
    nutritional_assessments: { table: 'nutritional_assessments', userField: null },
    procedures: { table: 'procedures', userField: null },
    who_safety_checklists: { table: 'who_safety_checklists', userField: null },
    // CBT/Education tables
    cbt_tests: { table: 'cbt_tests', userField: null },
    cbt_attempts: { table: 'cbt_attempts', userField: 'user_id' },
    activity_logs: { table: 'activity_logs', userField: 'user_id' },
    duty_assignments: { table: 'duty_assignments', userField: 'user_id' },
    // Paperwork, CME, Education tables
    paperwork_documents: { table: 'paperwork_documents', userField: null },
    cme_topics: { table: 'cme_topics', userField: null },
    cme_test_sessions: { table: 'cme_test_sessions', userField: null },
    cme_progress: { table: 'cme_progress', userField: null },
    cme_certificates: { table: 'cme_certificates', userField: null },
    cme_articles: { table: 'cme_articles', userField: null },
    cme_reading_progress: { table: 'cme_reading_progress', userField: null },
    educational_topics: { table: 'educational_topics', userField: null },
    weekly_contents: { table: 'weekly_contents', userField: null },
    topic_schedules: { table: 'topic_schedules', userField: null },
    education_user_progress: { table: 'education_user_progress', userField: null },
    ps_unit_rosters: { table: 'ps_unit_rosters', userField: null }
  };

  for (const [entityName, config] of Object.entries(entityConfigs)) {
    if (!entities || entities.includes(entityName)) {
      try {
        const result = await query(
          `SELECT * FROM ${config.table} WHERE updated_at > $1 ORDER BY updated_at DESC LIMIT 1000`,
          [sinceDate]
        );
        updates[entityName] = result.rows;
      } catch (error) {
        console.error(`Error pulling ${entityName}:`, error);
        updates[entityName] = [];
      }
    }
  }

  res.status(200).json({
    success: true,
    serverTime: new Date().toISOString(),
    updates
  });
}

async function handleFullSync(data, user, res) {
  // Full sync: push then pull
  const pushResult = data.changes ? await processChanges(data.changes, user) : { processed: 0 };
  
  // Note: Table names must match init-db.js created tables
  const pullResult = await query(`
    SELECT 
      (SELECT json_agg(row_to_json(p)) FROM patients p) as patients,
      (SELECT json_agg(row_to_json(s)) FROM surgeries s) as surgeries,
      (SELECT json_agg(row_to_json(tp)) FROM treatment_plans tp) as treatment_plans,
      (SELECT json_agg(row_to_json(a)) FROM admissions a) as admissions,
      (SELECT json_agg(row_to_json(lo)) FROM lab_orders lo) as lab_investigations,
      (SELECT json_agg(row_to_json(p)) FROM prescriptions p) as prescriptions,
      (SELECT json_agg(row_to_json(wcr)) FROM wound_care_records wcr) as wound_care,
      (SELECT json_agg(row_to_json(wr)) FROM ward_rounds wr) as ward_rounds
  `);

  res.status(200).json({
    success: true,
    serverTime: new Date().toISOString(),
    pushed: pushResult.processed,
    data: pullResult.rows[0]
  });
}

async function processChanges(changes, user) {
  let processed = 0;
  for (const change of changes) {
    try {
      await query(
        `INSERT INTO sync_queue (user_id, entity_type, entity_id, action, data, status)
         VALUES ($1, $2, $3, $4, $5, 'processed')`,
        [user.id, change.entityType, change.entityId, change.action, JSON.stringify(change.payload)]
      );
      processed++;
    } catch (error) {
      console.error('Error processing change:', error);
    }
  }
  return { processed };
}
