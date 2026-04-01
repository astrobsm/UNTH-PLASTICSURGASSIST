// Substance Use Assessments & Detoxification API endpoint
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
  const pathParts = url.pathname.replace('/api/substance-assessments', '').split('/').filter(Boolean);
  const resourceId = pathParts[0];
  const subResource = pathParts[1]; // e.g. 'monitoring', 'follow-ups', 'summary'
  const subResourceId = pathParts[2];

  try {
    // Sub-resource routing
    if (resourceId && subResource === 'monitoring') {
      return await handleMonitoring(method, resourceId, subResourceId, req.body, auth.user, res);
    }
    if (resourceId && subResource === 'follow-ups') {
      return await handleFollowUps(method, resourceId, subResourceId, req.body, auth.user, res);
    }
    if (resourceId && subResource === 'summary') {
      return await handleSummary(method, resourceId, req.body, auth.user, res);
    }

    // Main assessment routes
    switch (method) {
      case 'GET':
        if (resourceId) return await getAssessment(resourceId, res);
        return await getAllAssessments(url.searchParams, res);
      case 'POST':
        return await createAssessment(req.body, auth.user, res);
      case 'PUT':
      case 'PATCH':
        if (!resourceId) return res.status(400).json({ error: 'Assessment ID required' });
        return await updateAssessment(resourceId, req.body, auth.user, res);
      case 'DELETE':
        if (!resourceId) return res.status(400).json({ error: 'Assessment ID required' });
        return await deleteAssessment(resourceId, res);
      default:
        res.status(405).json({ error: 'Method not allowed' });
    }
  } catch (error) {
    console.error('Substance assessments API error:', error);
    res.status(500).json({ error: 'Internal server error', message: error.message });
  }
}

// ============ ASSESSMENTS ============

async function getAllAssessments(searchParams, res) {
  const patientId = searchParams.get('patientId');
  const status = searchParams.get('status');

  let queryStr = 'SELECT * FROM substance_use_assessments WHERE 1=1';
  const params = [];
  let paramCount = 1;

  if (patientId) {
    queryStr += ` AND patient_id = $${paramCount}`;
    params.push(patientId);
    paramCount++;
  }
  if (status) {
    queryStr += ` AND status = $${paramCount}`;
    params.push(status);
    paramCount++;
  }

  queryStr += ' ORDER BY created_at DESC';
  const result = await query(queryStr, params);
  res.status(200).json({ assessments: result.rows });
}

async function getAssessment(id, res) {
  const result = await query('SELECT * FROM substance_use_assessments WHERE id = $1', [id]);
  if (result.rows.length === 0) return res.status(404).json({ error: 'Assessment not found' });
  res.status(200).json({ assessment: result.rows[0] });
}

async function createAssessment(data, user, res) {
  const {
    patientId, patientName, hospitalNumber, hospitalId, primarySubstance,
    substances, polySubstanceUse, addictionSeverityScore, withdrawalRiskPrediction,
    careSettingDecision, painManagementSupport, comorbidities, comorbidityModifications,
    socialFactors, previousDetoxAttempts, previousTreatmentHistory,
    consentObtained, consentDocument, status = 'initial_assessment'
  } = data;

  if (!patientId || !primarySubstance) {
    return res.status(400).json({ error: 'Patient ID and primary substance are required' });
  }

  const result = await query(
    `INSERT INTO substance_use_assessments (
      patient_id, patient_name, hospital_number, hospital_id, primary_substance,
      substances, poly_substance_use, addiction_severity_score, withdrawal_risk_prediction,
      care_setting_decision, pain_management_support, comorbidities, comorbidity_modifications,
      social_factors, previous_detox_attempts, previous_treatment_history,
      consent_obtained, consent_document, status, assessed_by, assessment_date, audit_log
    ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,NOW(),$21)
    RETURNING *`,
    [
      patientId, patientName, hospitalNumber, hospitalId, primarySubstance,
      JSON.stringify(substances || []), polySubstanceUse || false,
      JSON.stringify(addictionSeverityScore || {}), JSON.stringify(withdrawalRiskPrediction || {}),
      JSON.stringify(careSettingDecision || {}), JSON.stringify(painManagementSupport || null),
      JSON.stringify(comorbidities || []), JSON.stringify(comorbidityModifications || []),
      JSON.stringify(socialFactors || {}), previousDetoxAttempts || 0,
      previousTreatmentHistory || '',
      consentObtained || false, JSON.stringify(consentDocument || null),
      status, user.username || user.id,
      JSON.stringify([{ action: 'assessment_created', performedBy: user.username || user.id, performedAt: new Date().toISOString() }])
    ]
  );

  res.status(201).json({ assessment: result.rows[0] });
}

async function updateAssessment(id, data, user, res) {
  const fields = [];
  const values = [];
  let paramCount = 1;

  const fieldMap = {
    status: 'status',
    primarySubstance: 'primary_substance',
    substances: 'substances',
    polySubstanceUse: 'poly_substance_use',
    addictionSeverityScore: 'addiction_severity_score',
    withdrawalRiskPrediction: 'withdrawal_risk_prediction',
    careSettingDecision: 'care_setting_decision',
    painManagementSupport: 'pain_management_support',
    comorbidities: 'comorbidities',
    comorbidityModifications: 'comorbidity_modifications',
    socialFactors: 'social_factors',
    consentObtained: 'consent_obtained',
    consentDocument: 'consent_document',
    clinicianOverride: 'clinician_override',
  };

  const jsonFields = [
    'substances', 'addictionSeverityScore', 'withdrawalRiskPrediction',
    'careSettingDecision', 'painManagementSupport', 'comorbidities',
    'comorbidityModifications', 'socialFactors', 'consentDocument', 'clinicianOverride'
  ];

  for (const [key, dbField] of Object.entries(fieldMap)) {
    if (data[key] !== undefined) {
      fields.push(`${dbField} = $${paramCount}`);
      values.push(jsonFields.includes(key) ? JSON.stringify(data[key]) : data[key]);
      paramCount++;
    }
  }

  if (fields.length === 0) return res.status(400).json({ error: 'No fields to update' });

  fields.push('updated_at = NOW()');

  // Append audit log entry
  fields.push(`audit_log = COALESCE(audit_log, '[]'::jsonb) || $${paramCount}::jsonb`);
  values.push(JSON.stringify([{ action: 'assessment_updated', performedBy: user.username || user.id, performedAt: new Date().toISOString(), details: `Updated fields: ${Object.keys(data).join(', ')}` }]));
  paramCount++;

  values.push(id);
  const result = await query(
    `UPDATE substance_use_assessments SET ${fields.join(', ')} WHERE id = $${paramCount} RETURNING *`,
    values
  );

  if (result.rows.length === 0) return res.status(404).json({ error: 'Assessment not found' });
  res.status(200).json({ assessment: result.rows[0] });
}

async function deleteAssessment(id, res) {
  const result = await query('DELETE FROM substance_use_assessments WHERE id = $1 RETURNING id', [id]);
  if (result.rows.length === 0) return res.status(404).json({ error: 'Assessment not found' });
  res.status(200).json({ message: 'Assessment deleted successfully' });
}

// ============ MONITORING ============

async function handleMonitoring(method, assessmentId, recordId, body, user, res) {
  switch (method) {
    case 'GET':
      if (recordId) {
        const r = await query('SELECT * FROM detox_monitoring_records WHERE id = $1 AND assessment_id = $2', [recordId, assessmentId]);
        if (r.rows.length === 0) return res.status(404).json({ error: 'Monitoring record not found' });
        return res.status(200).json({ record: r.rows[0] });
      }
      const records = await query('SELECT * FROM detox_monitoring_records WHERE assessment_id = $1 ORDER BY recorded_at DESC', [assessmentId]);
      return res.status(200).json({ records: records.rows });

    case 'POST': {
      const {
        patientId, vitalSigns, withdrawalScaleScore, withdrawalScaleType,
        symptomChecklist, medicationsGiven, clinicalNotes, escalationTriggered, escalationReason
      } = body;
      const result = await query(
        `INSERT INTO detox_monitoring_records (
          assessment_id, patient_id, vital_signs, withdrawal_scale_score,
          withdrawal_scale_type, symptom_checklist, medications_given,
          clinical_notes, escalation_triggered, escalation_reason,
          monitored_by, recorded_at
        ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,NOW()) RETURNING *`,
        [
          assessmentId, patientId, JSON.stringify(vitalSigns || {}),
          withdrawalScaleScore || null, withdrawalScaleType || null,
          JSON.stringify(symptomChecklist || []), JSON.stringify(medicationsGiven || []),
          clinicalNotes || '', escalationTriggered || false, escalationReason || null,
          user.username || user.id
        ]
      );
      return res.status(201).json({ record: result.rows[0] });
    }
    default:
      return res.status(405).json({ error: 'Method not allowed for monitoring' });
  }
}

// ============ FOLLOW-UPS ============

async function handleFollowUps(method, assessmentId, followUpId, body, user, res) {
  switch (method) {
    case 'GET':
      if (followUpId) {
        const r = await query('SELECT * FROM detox_follow_ups WHERE id = $1 AND assessment_id = $2', [followUpId, assessmentId]);
        if (r.rows.length === 0) return res.status(404).json({ error: 'Follow-up not found' });
        return res.status(200).json({ followUp: r.rows[0] });
      }
      const followUps = await query('SELECT * FROM detox_follow_ups WHERE assessment_id = $1 ORDER BY scheduled_date ASC', [assessmentId]);
      return res.status(200).json({ followUps: followUps.rows });

    case 'POST': {
      const { patientId, scheduledDate, followUpType, notes } = body;
      const result = await query(
        `INSERT INTO detox_follow_ups (
          assessment_id, patient_id, scheduled_date, follow_up_type, notes, status
        ) VALUES ($1,$2,$3,$4,$5,'scheduled') RETURNING *`,
        [assessmentId, patientId, scheduledDate, followUpType || 'clinic', notes || '']
      );
      return res.status(201).json({ followUp: result.rows[0] });
    }

    case 'PUT':
    case 'PATCH': {
      if (!followUpId) return res.status(400).json({ error: 'Follow-up ID required' });
      const flds = [];
      const vals = [];
      let pc = 1;
      const map = {
        scheduledDate: 'scheduled_date', actualDate: 'actual_date',
        status: 'status', notes: 'notes', followUpType: 'follow_up_type',
        relapseSinceLastVisit: 'relapse_since_last_visit',
        currentSubstanceUse: 'current_substance_use', mentalHealthStatus: 'mental_health_status'
      };
      for (const [k, f] of Object.entries(map)) {
        if (body[k] !== undefined) { flds.push(`${f} = $${pc}`); vals.push(body[k]); pc++; }
      }
      if (!flds.length) return res.status(400).json({ error: 'No fields to update' });
      flds.push('updated_at = NOW()');
      vals.push(followUpId);
      const result = await query(`UPDATE detox_follow_ups SET ${flds.join(', ')} WHERE id = $${pc} AND assessment_id = $${pc + 1} RETURNING *`, [...vals, assessmentId]);
      if (result.rows.length === 0) return res.status(404).json({ error: 'Follow-up not found' });
      return res.status(200).json({ followUp: result.rows[0] });
    }
    default:
      return res.status(405).json({ error: 'Method not allowed for follow-ups' });
  }
}

// ============ CLINICAL SUMMARY ============

async function handleSummary(method, assessmentId, body, user, res) {
  switch (method) {
    case 'GET': {
      const results = await query('SELECT * FROM substance_use_clinical_summaries WHERE assessment_id = $1 ORDER BY generated_at DESC', [assessmentId]);
      return res.status(200).json({ summaries: results.rows });
    }
    case 'POST': {
      const { patientId, patientName, hospitalName, addictionScoreSummary, riskClassification, recommendedPathway, keyFindings, recommendedInterventions, monitoringChecklist, followUpSchedule, disclaimers } = body;
      const result = await query(
        `INSERT INTO substance_use_clinical_summaries (
          assessment_id, patient_id, patient_name, hospital_name,
          addiction_score_summary, risk_classification, recommended_pathway,
          key_findings, recommended_interventions, monitoring_checklist,
          follow_up_schedule, disclaimers, generated_by, generated_at, assessment_date
        ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,NOW(),NOW()) RETURNING *`,
        [
          assessmentId, patientId, patientName || '', hospitalName || '',
          JSON.stringify(addictionScoreSummary || {}), riskClassification || '',
          recommendedPathway || '', JSON.stringify(keyFindings || []),
          JSON.stringify(recommendedInterventions || []), JSON.stringify(monitoringChecklist || []),
          JSON.stringify(followUpSchedule || []), JSON.stringify(disclaimers || []),
          user.username || user.id
        ]
      );
      return res.status(201).json({ summary: result.rows[0] });
    }
    default:
      return res.status(405).json({ error: 'Method not allowed for summary' });
  }
}
