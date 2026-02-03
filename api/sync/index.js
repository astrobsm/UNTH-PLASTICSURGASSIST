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
  const action = url.pathname.replace('/api/sync', '').split('/').filter(Boolean)[0];

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

  const results = [];
  
  for (const change of changes) {
    const { entityType, entityId, action, payload } = change;
    
    try {
      // Handle MDT entities directly for immediate sync
      if (entityType === 'mdt_patient_teams' && payload) {
        const { patient_id, patient_name, hospital_number, primary_specialty, specialties } = payload;
        if (patient_id) {
          // Check if exists
          const existing = await query('SELECT id FROM mdt_patient_teams WHERE patient_id = $1', [patient_id]);
          if (existing.rows.length > 0) {
            await query(
              `UPDATE mdt_patient_teams SET patient_name = $1, hospital_number = $2, 
               primary_specialty = $3, specialties = $4, updated_at = CURRENT_TIMESTAMP 
               WHERE patient_id = $5`,
              [patient_name, hospital_number, primary_specialty || 'Plastic Surgery', 
               JSON.stringify(specialties || []), patient_id]
            );
          } else {
            await query(
              `INSERT INTO mdt_patient_teams (patient_id, patient_name, hospital_number, 
               primary_specialty, specialties, is_active) VALUES ($1, $2, $3, $4, $5, true)`,
              [patient_id, patient_name, hospital_number, primary_specialty || 'Plastic Surgery', 
               JSON.stringify(specialties || [])]
            );
          }
          results.push({ entityId, status: 'synced' });
          continue;
        }
      }
      
      if (entityType === 'mdt_meetings' && payload) {
        const { patient_id, meeting_date, meeting_title } = payload;
        if (patient_id && meeting_date) {
          await query(
            `INSERT INTO mdt_meetings (patient_id, patient_name, hospital_number, meeting_title, 
             meeting_date, meeting_time, location, meeting_type, status, agenda, 
             attending_specialties, created_by) 
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)`,
            [patient_id, payload.patient_name, payload.hospital_number, meeting_title,
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
          await query(
            `INSERT INTO mdt_contact_logs (patient_id, patient_name, hospital_number, 
             specialty_id, specialty_name, contact_type, contact_date, contact_time, 
             contacted_person, reason, discussion_summary, outcome, follow_up_required, 
             follow_up_date, created_by) 
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15)`,
            [patient_id, payload.patient_name, payload.hospital_number, specialty_id,
             payload.specialty_name, payload.contact_type, contact_date, payload.contact_time,
             payload.contacted_person, payload.reason, payload.discussion_summary, 
             payload.outcome, payload.follow_up_required || false, payload.follow_up_date,
             payload.created_by]
          );
          results.push({ entityId, status: 'synced' });
          continue;
        }
      }

      // Handle clinical assessment entities with upsert
      const clinicalEntities = [
        'blood_transfusions', 'burn_patients', 'diabetic_foot_assessments',
        'preoperative_assessments', 'dvt_assessments', 'pressure_sore_assessments',
        'nutritional_assessments', 'procedures', 'who_safety_checklists'
      ];
      
      if (clinicalEntities.includes(entityType) && payload) {
        try {
          // Build dynamic upsert query
          const columns = Object.keys(payload).filter(k => k !== 'id' && k !== 'serverId' && k !== 'synced');
          const values = columns.map(k => {
            const v = payload[k];
            return typeof v === 'object' ? JSON.stringify(v) : v;
          });
          const placeholders = columns.map((_, i) => `$${i + 1}`).join(', ');
          
          // Check if record exists by patient_id or id
          const existingId = payload.serverId || payload.id;
          let existing = null;
          if (existingId) {
            existing = await query(`SELECT id FROM ${entityType} WHERE id = $1`, [existingId]);
          } else if (payload.patient_id) {
            // For some entities, check by patient_id + date
            const dateField = entityType.includes('assessment') ? 'assessment_date' : 
                             entityType === 'blood_transfusions' ? 'transfusion_date' :
                             entityType === 'burn_patients' ? 'admission_date' :
                             entityType === 'procedures' ? 'procedure_date' : 'checklist_date';
            if (payload[dateField]) {
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
            // Insert
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
    duty_assignments: { table: 'duty_assignments', userField: 'user_id' }
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
