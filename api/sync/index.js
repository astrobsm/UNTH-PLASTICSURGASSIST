// Sync API endpoint for offline data synchronization
import { query } from '../_lib/db.js';
import { cors, authenticateRequest } from '../_lib/auth.js';

// Cache table columns to avoid repeated information_schema queries
const tableColumnsCache = {};
async function getTableColumns(tableName) {
  if (!tableColumnsCache[tableName]) {
    try {
      const result = await query(
        "SELECT column_name FROM information_schema.columns WHERE table_schema = 'public' AND table_name = $1",
        [tableName]
      );
      const cols = new Set(result.rows.map(r => r.column_name));
      // If table doesn't exist (0 columns), return null to skip validation (fail open)
      // rather than an empty set which would filter out ALL columns
      tableColumnsCache[tableName] = cols.size > 0 ? cols : null;
    } catch {
      return null; // Fail open — skip validation if schema query fails
    }
  }
  return tableColumnsCache[tableName];
}

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
          return await getSyncPatients(res, url.searchParams);
        }

        // Lookup table mapping URL action to database table name
        const actionToTable = {
          'surgeries': 'surgeries', 'surgery-bookings': 'surgeries',
          'admissions': 'admissions',
          'treatment-plans': 'treatment_plans',
          'lab-orders': 'lab_orders', 'lab-investigations': 'lab_orders',
          'prescriptions': 'prescriptions',
          'wound-care': 'wound_care_records', 
          'ward-rounds': 'ward_rounds',
          'discharges': 'discharge_summaries', 'discharge-summaries': 'discharge_summaries',
          'mdt-patient-teams': 'mdt_patient_teams', 'mdt_patient_teams': 'mdt_patient_teams',
          'mdt-meetings': 'mdt_meetings', 'mdt_meetings': 'mdt_meetings',
          'mdt-contact-logs': 'mdt_contact_logs', 'mdt_contact_logs': 'mdt_contact_logs',
          'blood-transfusions': 'blood_transfusions', 'blood_transfusions': 'blood_transfusions',
          'burn-patients': 'burn_patients', 'burn_patients': 'burn_patients',
          'diabetic-foot-assessments': 'diabetic_foot_assessments', 'diabetic_foot_assessments': 'diabetic_foot_assessments',
          'preoperative-assessments': 'preoperative_assessments', 'preoperative_assessments': 'preoperative_assessments',
          'dvt-assessments': 'dvt_assessments', 'dvt_assessments': 'dvt_assessments',
          'pressure-sore-assessments': 'pressure_sore_assessments', 'pressure_sore_assessments': 'pressure_sore_assessments',
          'nutritional-assessments': 'nutritional_assessments', 'nutritional_assessments': 'nutritional_assessments',
          'procedures': 'procedures',
          'who-safety-checklists': 'who_safety_checklists', 'who_safety_checklists': 'who_safety_checklists',
          'progress-notes': 'progress_notes', 'progress_notes': 'progress_notes',
          'paperwork-documents': 'paperwork_documents', 'paperwork_documents': 'paperwork_documents',
          'cme-topics': 'cme_topics', 'cme_topics': 'cme_topics',
          'cme-test-sessions': 'cme_test_sessions', 'cme_test_sessions': 'cme_test_sessions',
          'cme-progress': 'cme_progress', 'cme_progress': 'cme_progress',
          'cme-certificates': 'cme_certificates', 'cme_certificates': 'cme_certificates',
          'cme-articles': 'cme_articles', 'cme_articles': 'cme_articles',
          'cme-reading-progress': 'cme_reading_progress', 'cme_reading_progress': 'cme_reading_progress',
          'educational-topics': 'educational_topics', 'educational_topics': 'educational_topics',
          'weekly-contents': 'weekly_contents', 'weekly_contents': 'weekly_contents',
          'topic-schedules': 'topic_schedules', 'topic_schedules': 'topic_schedules',
          'education-user-progress': 'education_user_progress', 'education_user_progress': 'education_user_progress',
          'ps-unit-rosters': 'ps_unit_rosters', 'ps_unit_rosters': 'ps_unit_rosters',
          'shopping-lists': 'shopping_lists', 'shopping_lists': 'shopping_lists',
          'call-duty-roster': 'call_duty_roster', 'call_duty_roster': 'call_duty_roster',
          'clinic-duty-logs': 'clinic_duty_logs', 'clinic_duty_logs': 'clinic_duty_logs',
          'cbt-attempts': 'cbt_attempts', 'cbt_attempts': 'cbt_attempts',
          'substance-use-assessments': 'substance_use_assessments', 'substance_use_assessments': 'substance_use_assessments',
          'detox-monitoring-records': 'detox_monitoring_records', 'detox_monitoring_records': 'detox_monitoring_records',
          'detox-follow-ups': 'detox_follow_ups', 'detox_follow_ups': 'detox_follow_ups',
          'substance-use-clinical-summaries': 'substance_use_clinical_summaries', 'substance_use_clinical_summaries': 'substance_use_clinical_summaries',
          'patient-assignments': 'patient_assignments', 'patient_assignments': 'patient_assignments',
          'investigation-uploads': 'investigation_uploads', 'investigation_uploads': 'investigation_uploads',
        };

        if (action && actionToTable[action]) {
          return await getSyncEntity(actionToTable[action], res, url.searchParams);
        }

        return await getSyncStatus(auth.user, res);
      default:
        res.status(405).json({ error: 'Method not allowed' });
    }
  } catch (error) {
    console.error('Sync API error:', error);
    // If a table doesn't exist yet, return empty array for GET requests
    if (error.message && error.message.includes('does not exist') && method === 'GET') {
      return res.status(200).json([]);
    }
    res.status(500).json({ error: 'Internal server error', message: error.message });
  }
}

async function getSyncPatients(res, searchParams) {
  const since = searchParams?.get('since');
  let queryStr = `SELECT id, hospital_number, first_name, last_name, date_of_birth, gender, 
            phone, email, address, blood_group, allergies, medical_history,
            created_at, updated_at
     FROM patients`;
  const params = [];

  if (since) {
    queryStr += ` WHERE updated_at > $1`;
    params.push(since);
  }

  queryStr += ` ORDER BY updated_at DESC LIMIT 500`;
  const result = await query(queryStr, params);
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

async function getSyncEntity(tableName, res, searchParams) {
  const since = searchParams?.get('since');
  const patientId = searchParams?.get('patientId');
  let queryStr;
  let params = [];

  // Tables that are NOT patient-scoped (global/system tables)
  const nonPatientTables = [
    'cme_topics', 'cme_articles', 'cme_reading_progress', 'cme_test_sessions',
    'cme_progress', 'cme_certificates', 'educational_topics', 'weekly_contents',
    'topic_schedules', 'education_user_progress', 'ps_unit_rosters',
    'shopping_lists', 'call_duty_roster', 'clinic_duty_logs', 'cbt_attempts', 'notice_board',
    'rotation_configs', 'assigned_responsibilities'
  ];

  const isPatientScoped = !nonPatientTables.includes(tableName);

  if (isPatientScoped && patientId) {
    // Patient-scoped query: ALWAYS filter by patient_id when provided
    const parsedPatientId = parseInt(patientId, 10);
    if (isNaN(parsedPatientId)) {
      return res.status(400).json({ error: 'Invalid patientId' });
    }
    if (since) {
      queryStr = `SELECT * FROM ${tableName} WHERE patient_id = $1 AND updated_at > $2 ORDER BY updated_at DESC LIMIT 1000`;
      params = [parsedPatientId, since];
    } else {
      queryStr = `SELECT * FROM ${tableName} WHERE patient_id = $1 ORDER BY updated_at DESC LIMIT 1000`;
      params = [parsedPatientId];
    }
  } else if (isPatientScoped && !patientId) {
    // Patient-scoped table but no patientId provided: return empty to prevent data leakage
    // Callers MUST provide patientId for patient-scoped tables
    return res.status(400).json({ error: 'patientId is required for patient-scoped data' });
  } else {
    // Non-patient-scoped table: return all (with since filter if applicable)
    if (since) {
      queryStr = `SELECT * FROM ${tableName} WHERE updated_at > $1 ORDER BY updated_at DESC LIMIT 5000`;
      params = [since];
    } else {
      queryStr = `SELECT * FROM ${tableName} ORDER BY updated_at DESC LIMIT 5000`;
    }
  }

  const result = await query(queryStr, params);
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
        const { patient_id, patient_name, hospital_number, primary_specialty, specialties, team_reviews, weekly_harmonizations } = payload;
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
               primary_specialty = $3, specialties = $4, team_reviews = $5, 
               weekly_harmonizations = $6, updated_at = CURRENT_TIMESTAMP 
               WHERE patient_id = $7`,
              [patient_name, hospital_number, primary_specialty || 'Plastic Surgery', 
               JSON.stringify(specialties || []), JSON.stringify(team_reviews || []),
               JSON.stringify(weekly_harmonizations || []), patientIdInt]
            );
            console.log(`✅ Updated MDT team for patient ${patientIdInt}`);
          } else {
            await query(
              `INSERT INTO mdt_patient_teams (patient_id, patient_name, hospital_number, 
               primary_specialty, specialties, team_reviews, weekly_harmonizations, is_active) 
               VALUES ($1, $2, $3, $4, $5, $6, $7, true)`,
              [patientIdInt, patient_name, hospital_number, primary_specialty || 'Plastic Surgery', 
               JSON.stringify(specialties || []), JSON.stringify(team_reviews || []),
               JSON.stringify(weekly_harmonizations || [])]
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
                  secondary_diagnoses, ward, bed_number, emergency_contact_name, emergency_contact_phone,
                  full_name, name, patient_name } = payload;
          
          // Resolve first/last names from all possible fields
          let resolvedFirst = first_name;
          let resolvedLast = last_name;
          if (!resolvedFirst && !resolvedLast) {
            // Try full_name, name, or patient_name and split
            const combinedName = full_name || name || patient_name || '';
            const parts = combinedName.trim().split(/\s+/);
            resolvedFirst = parts[0] || null;
            resolvedLast = parts.slice(1).join(' ') || null;
          }
          // Ensure NOT NULL constraints are satisfied
          resolvedFirst = resolvedFirst || 'Unknown';
          resolvedLast = resolvedLast || 'Patient';
          
          // Generate a fallback hospital_number for records that don't have one
          const effectiveHospitalNumber = hospital_number || 
            `AUTO-${resolvedFirst.substring(0,3).toUpperCase()}${resolvedLast.substring(0,3).toUpperCase()}-${Date.now().toString(36)}`;
          
          const existing = await query('SELECT id FROM patients WHERE hospital_number = $1', [effectiveHospitalNumber]);
          if (existing.rows.length > 0) {
            await query(
              `UPDATE patients SET first_name = COALESCE($1, first_name), last_name = COALESCE($2, last_name), 
               date_of_birth = COALESCE($3, date_of_birth), gender = COALESCE($4, gender), 
               phone = COALESCE($5, phone), email = COALESCE($6, email), address = COALESCE($7, address),
               blood_group = COALESCE($8, blood_group), allergies = COALESCE($9, allergies), 
               medical_history = COALESCE($10, medical_history), primary_diagnosis = COALESCE($11, primary_diagnosis),
               created_by = COALESCE(created_by, $13),
               updated_at = CURRENT_TIMESTAMP WHERE hospital_number = $12`,
              [resolvedFirst, resolvedLast, date_of_birth, gender, phone, email, address,
               blood_group, allergies, medical_history, primary_diagnosis, effectiveHospitalNumber, user.id]
            );
          } else {
            await query(
              `INSERT INTO patients (hospital_number, first_name, last_name, date_of_birth, gender, phone, email, 
               address, blood_group, allergies, medical_history, primary_diagnosis, created_by)
               VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)`,
              [effectiveHospitalNumber, resolvedFirst, resolvedLast, date_of_birth, gender, phone, email, 
               address, blood_group, allergies, medical_history, primary_diagnosis, user.id]
            );
          }
          results.push({ entityId, status: 'synced' });
          continue;
        } catch (err) {
          console.error('Error syncing patient:', err);
          results.push({ entityId, status: 'error', message: err.message });
          continue;
        }
      }

      // Map client-side IndexedDB table names to server PostgreSQL table names
      const tableNameMap = {
        'wound_care': 'wound_care_records',
        'surgery_bookings': 'surgeries',
        'lab_investigations': 'lab_orders',
        'discharges': 'discharge_summaries',
      };
      const resolvedEntityType = tableNameMap[entityType] || entityType;

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
        'chat_messages', 'chat_rooms', 'audit_logs', 'user_activities',
        'shopping_lists', 'call_duty_roster', 'clinic_duty_logs',
        'substance_use_assessments', 'detox_monitoring_records', 'detox_follow_ups',
        'substance_use_clinical_summaries',
        'progress_notes', 'sjs_assessments', 'ward_rounds_clinical',
        'investigation_uploads', 'notice_board', 'patient_transfers',
        'ho_tracking_assignments', 'ho_task_logs'
      ];
      
      if (clinicalEntities.includes(resolvedEntityType) && payload) {
        try {
          // Convert camelCase keys to snake_case for PostgreSQL column names
          const toSnakeCase = (str) => str.replace(/[A-Z]/g, letter => `_${letter.toLowerCase()}`);
          const snakePayload = {};
          for (const [key, val] of Object.entries(payload)) {
            snakePayload[toSnakeCase(key)] = val;
          }

          // Inject created_by from authenticated user if not present in payload
          // This ensures clinical records are attributed to the user who synced them
          const tablesWithCreatedBy = [
            'treatment_plans', 'admissions', 'prescriptions', 'ward_rounds', 'lab_orders',
            'surgeries', 'wound_care_records', 'discharge_summaries', 'procedures',
            'progress_notes', 'who_safety_checklists'
          ];
          if (tablesWithCreatedBy.includes(resolvedEntityType) && !snakePayload.created_by && user.id) {
            snakePayload.created_by = user.id;
          }

          // Fix column name mismatches between local IndexedDB and PostgreSQL
          if (resolvedEntityType === 'preoperative_assessments') {
            if (snakePayload.assessed_at && !snakePayload.assessment_date) {
              snakePayload.assessment_date = snakePayload.assessed_at;
              delete snakePayload.assessed_at;
            }
            if (!snakePayload.assessment_date) {
              snakePayload.assessment_date = snakePayload.created_at || snakePayload.updated_at || new Date().toISOString();
            }
            if (snakePayload.surgery_booking_id && !snakePayload.surgery_id) {
              snakePayload.surgery_id = snakePayload.surgery_booking_id;
              delete snakePayload.surgery_booking_id;
            }
            // Map local risk assessment objects to PostgreSQL JSONB columns
            if (snakePayload.cardiovascular_risk) {
              snakePayload.cardiovascular = snakePayload.cardiovascular_risk;
              delete snakePayload.cardiovascular_risk;
            }
            if (snakePayload.bleeding_risk) {
              snakePayload.hematologic = snakePayload.bleeding_risk;
              delete snakePayload.bleeding_risk;
            }
            // Pack extra local fields into notes JSONB so data is not lost
            const extraFields = ['dvt_risk', 'pressure_sore_risk', 'comorbidities_medications',
              'consent_document', 'payment_evidence', 'insurance_covered',
              'comprehensive_summary', 'preop_instructions'];
            const extras = {};
            for (const f of extraFields) {
              if (snakePayload[f] !== undefined) {
                extras[f] = snakePayload[f];
                delete snakePayload[f];
              }
            }
            if (Object.keys(extras).length > 0) {
              snakePayload.notes = JSON.stringify(extras);
            }
          }

          // Ensure audit_logs NOT NULL fields have default values
          if (resolvedEntityType === 'audit_logs') {
            if (!snakePayload.action) snakePayload.action = 'unknown';
            if (!snakePayload.resource_type) snakePayload.resource_type = 'unknown';
            if (!snakePayload.resource_id) snakePayload.resource_id = 'unknown';
          }

          // Ensure NOT NULL date fields have default values
          if (resolvedEntityType === 'admissions') {
            if (!snakePayload.admission_date) {
              snakePayload.admission_date = snakePayload.created_at || new Date().toISOString();
            }
          }
          if (resolvedEntityType === 'ward_rounds') {
            if (!snakePayload.round_date) {
              snakePayload.round_date = snakePayload.created_at || new Date().toISOString().split('T')[0];
            }
          }

          // Coerce patient_id to integer for tables with INTEGER REFERENCES patients(id)
          const integerPatientIdTables = [
            'dvt_assessments', 'pressure_sore_assessments', 'nutritional_assessments',
            'diabetic_foot_assessments', 'preoperative_assessments', 'blood_transfusions',
            'burn_patients', 'procedures', 'who_safety_checklists',
            'wound_care_records', 'ward_rounds', 'admissions', 'surgeries',
            'treatment_plans', 'prescriptions', 'lab_orders', 'discharge_summaries',
            'progress_notes', 'sjs_assessments'
          ];
          if (integerPatientIdTables.includes(resolvedEntityType) && snakePayload.patient_id) {
            const parsed = parseInt(snakePayload.patient_id, 10);
            if (!isNaN(parsed)) {
              snakePayload.patient_id = parsed;
            }
          }

          // Tables with SERIAL (integer) primary keys - local auto-increment ids should NOT be used for lookup
          const serialKeyTables = [
            'wound_care_records', 'ward_rounds', 'discharge_summaries',
            'admissions', 'surgeries', 'treatment_plans', 'prescriptions', 'lab_orders',
            'call_duty_roster', 'clinic_duty_logs',
            'dvt_assessments', 'pressure_sore_assessments', 'nutritional_assessments',
            'diabetic_foot_assessments', 'preoperative_assessments', 'audit_logs',
            'blood_transfusions', 'burn_patients', 'procedures',
            'who_safety_checklists', 'progress_notes', 'sjs_assessments',
            'investigation_uploads', 'notice_board', 'patient_transfers',
            'vital_signs', 'fluid_balance', 'clinic_appointments',
            'gfr_calculations', 'lymphedema_assessments', 'clinic_sessions',
            'chat_rooms', 'chat_messages', 'video_conferences',
            'call_duty_handover_notes', 'patient_assignments',
            'keloid_care_plans', 'keloid_pretreatment_tests', 'keloid_injections',
            'rotation_configs', 'assigned_responsibilities',
            'students', 'student_patient_assignments', 'student_clerkings', 'student_treatment_plans'
          ];
          const isSerialKey = serialKeyTables.includes(resolvedEntityType);

          // Build dynamic upsert query - filter out internal fields and local-only id for SERIAL tables
          const skipKeys = ['server_id', 'synced', 'deleted', 'local_id'];
          if (isSerialKey) skipKeys.push('id'); // don't use local auto-increment id

          // Dynamically validate columns against the actual database schema
          // This prevents INSERT failures from unknown columns for ALL tables
          let columns = Object.keys(snakePayload).filter(k => !skipKeys.includes(k));
          let validColumns = await getTableColumns(resolvedEntityType);
          if (validColumns) {
            columns = columns.filter(k => validColumns.has(k));
          }
          
          // Ensure the table exists — all tables should be created by init-db.js
          // If a table doesn't exist, log a warning (init-db POST should be run first)
          if (validColumns === null) {
            console.warn(`⚠️ Table "${resolvedEntityType}" not found in database. Run POST /api/init-db to create all tables.`);
          }

          // Compute values and placeholders AFTER table creation and column validation
          const values = columns.map(k => {
            const v = snakePayload[k];
            return (v !== null && typeof v === 'object') ? JSON.stringify(v) : v;
          });
          const placeholders = columns.map((_, i) => `$${i + 1}`).join(', ');

          // Check if record exists
          let existing = null;
          
          if (!isSerialKey) {
            // VARCHAR id tables: look up by id directly
            const existingId = snakePayload.server_id || snakePayload.id;
            if (existingId) {
              try {
                existing = await query(`SELECT id FROM ${resolvedEntityType} WHERE id = $1`, [existingId]);
              } catch (lookupErr) {
                // Table might not exist — will fail at INSERT with clearer message
                console.error(`Lookup failed for ${resolvedEntityType}:`, lookupErr.message);
                existing = null;
              }
            }
          }
          
          // For all entities with patient_id, try lookup by patient_id + date
          if ((!existing || existing.rows.length === 0) && snakePayload.patient_id) {
            const dateFieldMap = {
              'dvt_assessments': 'assessment_date',
              'pressure_sore_assessments': 'assessment_date',
              'nutritional_assessments': 'assessment_date',
              'diabetic_foot_assessments': 'assessment_date',
              'preoperative_assessments': 'assessment_date',
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
            const dateField = dateFieldMap[resolvedEntityType];
            if (dateField && snakePayload[dateField]) {
              existing = await query(
                `SELECT id FROM ${resolvedEntityType} WHERE patient_id = $1 AND ${dateField} = $2`,
                [snakePayload.patient_id, snakePayload[dateField]]
              );
            }
          }
          
          if (existing && existing.rows.length > 0) {
            // Update — quote column names to handle reserved words like "timestamp"
            // Only append updated_at = CURRENT_TIMESTAMP if the table has that column AND it's not already in the payload
            const hasUpdatedAtColumn = validColumns ? validColumns.has('updated_at') : true;
            const payloadHasUpdatedAt = columns.includes('updated_at');
            const updatedAtSuffix = (hasUpdatedAtColumn && !payloadHasUpdatedAt) ? ', updated_at = CURRENT_TIMESTAMP' : '';
            const setClause = columns.map((col, i) => `"${col}" = $${i + 1}`).join(', ');
            await query(
              `UPDATE ${resolvedEntityType} SET ${setClause}${updatedAtSuffix} WHERE id = $${columns.length + 1}`,
              [...values, existing.rows[0].id]
            );
          } else {
            // Insert (for SERIAL tables, PostgreSQL auto-generates the id)
            const quotedColumns = columns.map(c => `"${c}"`).join(', ');
            await query(
              `INSERT INTO ${resolvedEntityType} (${quotedColumns}) VALUES (${placeholders})`,
              values
            );
          }
          results.push({ entityId, status: 'synced' });
          continue;
        } catch (err) {
          console.error(`Error syncing ${entityType} (id: ${entityId}):`, err.message, err.detail || '', err.where || '');
          results.push({ entityId, status: 'error', message: `${err.message}${err.detail ? ' | ' + err.detail : ''}` });
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
    ps_unit_rosters: { table: 'ps_unit_rosters', userField: null },
    shopping_lists: { table: 'shopping_lists', userField: null },
    call_duty_roster: { table: 'call_duty_roster', userField: null },
    clinic_duty_logs: { table: 'clinic_duty_logs', userField: 'user_id' },
    // Substance detox tables
    substance_use_assessments: { table: 'substance_use_assessments', userField: null },
    detox_monitoring_records: { table: 'detox_monitoring_records', userField: null },
    detox_follow_ups: { table: 'detox_follow_ups', userField: null },
    substance_use_clinical_summaries: { table: 'substance_use_clinical_summaries', userField: null },
    // Additional clinical tables
    progress_notes: { table: 'progress_notes', userField: null },
    sjs_assessments: { table: 'sjs_assessments', userField: null },
    notice_board: { table: 'notice_board', userField: null },
    patient_transfers: { table: 'patient_transfers', userField: null },
    ho_tracking_assignments: { table: 'ho_tracking_assignments', userField: null },
    ho_task_logs: { table: 'ho_task_logs', userField: null }
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
