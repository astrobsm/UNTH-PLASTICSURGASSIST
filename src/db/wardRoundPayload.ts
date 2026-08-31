/**
 * Translates a locally-held ward round into the shape /api/ward-rounds accepts.
 *
 * WHY THIS LIVES HERE RATHER THAN IN wardRoundsService
 * Both the online path (wardRoundsService) and the offline retry (syncService)
 * need it, and wardRoundsService now queues through syncService — so keeping
 * the mapping in either one would make the two import each other.
 *
 * The handler destructures `patientId` / `roundDate` / `roundType` and returns
 * 400 without the first, while the local round carries `patient_id` and
 * `round_date`. It also collapses the round's many clinical fields into the
 * three columns the table actually has (findings / vitalSigns / plan), which is
 * why this is a real translation and not a rename.
 */

export function toWardRoundPayload(round: any): Record<string, any> {
  const findingsObj = {
    chief_complaint: round.chief_complaint || '',
    clinical_notes: round.clinical_notes || '',
    examination_findings: round.examination_findings || '',
    assessment_notes: round.assessment_notes || '',
    doctor_role: round.doctor_role || '',
    accompanying_team: round.accompanying_team || [],
    recent_labs_reviewed: round.recent_labs_reviewed || false,
    lab_notes: round.lab_notes || '',
    treatment_plan_updated: round.treatment_plan_updated || false,
    medications_changed: round.medications_changed || false,
    medication_changes: round.medication_changes || '',
    progress_status: round.progress_status || 'stable',
    complications: round.complications || '',
    discharge_planning: round.discharge_planning || '',
    wound_assessment_done: round.wound_assessment_done || false,
    wound_notes: round.wound_notes || '',
    consultation_requested: round.consultation_requested || false,
    consultation_specialty: round.consultation_specialty || '',
    consultation_reason: round.consultation_reason || '',
    reviewing_doctor: round.reviewing_doctor || '',
    lmp: round.lmp || '',
    patient_name: round.patient_name || '',
    hospital_number: round.hospital_number || '',
    round_type: round.round_type || 'house_officers_round',
    round_time: round.round_time || '',
    clinical_images: round.clinical_images || []
  };

  const vitalSigns: any = {};
  if (round.temperature) vitalSigns.temperature = round.temperature;
  if (round.pulse) vitalSigns.pulse = round.pulse;
  if (round.bp_systolic) vitalSigns.bp_systolic = round.bp_systolic;
  if (round.bp_diastolic) vitalSigns.bp_diastolic = round.bp_diastolic;
  if (round.respiratory_rate) vitalSigns.respiratory_rate = round.respiratory_rate;
  if (round.spo2) vitalSigns.spo2 = round.spo2;

  return {
    patientId: round.patient_id,
    roundDate: round.round_date instanceof Date
      ? round.round_date.toISOString().split('T')[0]
      : typeof round.round_date === 'string'
        ? new Date(round.round_date).toISOString().split('T')[0]
        : new Date().toISOString().split('T')[0],
    roundType: round.round_type || 'routine',
    findings: JSON.stringify(findingsObj),
    vitalSigns,
    newOrders: round.new_orders ? [round.new_orders] : [],
    plan: round.follow_up_plan || round.chief_complaint || '',
    issues: round.complications ? [round.complications] : [],
    nursingNotes: round.wound_notes || ''
  };
}
