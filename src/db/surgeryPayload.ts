/**
 * Translates a locally-held surgery booking into the shape /api/surgeries
 * accepts.
 *
 * WHY THIS IS SHARED
 * schedulingService built this mapping inline for the online path, then, when
 * that request failed, queued the RAW local booking for the sync service to
 * retry. The two shapes are not the same: the local booking carries
 * `patient_id`, `procedure_name` and `date`, while the handler reads
 * `patientId`, `procedureName` and `scheduledDate` and rejects the request
 * without all three.
 *
 * So a booking made with a connection synced, and a booking made without one
 * never did — it 400'd on every retry until the queue gave up and moved it to
 * the dead-letter table. The offline path is exactly the one that has to work,
 * and it was the only one that could not.
 *
 * One definition, used by both paths, so they cannot drift apart again.
 */

export function toSurgeryPayload(booking: any): Record<string, any> {
  const b = booking || {};
  return {
    patientId: b.patient_id ?? b.patientId,
    procedureName: b.procedure_name ?? b.procedureName,
    procedureType: b.procedure_type ?? b.procedureType ?? '',
    scheduledDate: b.date ?? b.scheduledDate ?? new Date().toISOString().split('T')[0],
    estimatedDuration:
      b.estimated_duration_minutes ?? b.estimated_duration ?? b.estimatedDuration ?? 60,
    surgeonId: b.surgeon_id ?? b.surgeonId ?? null,
    anesthesiaType: b.anaesthesia_type ?? b.anesthesia_type ?? b.anesthesiaType ?? '',
    operatingRoom: b.theatre_number ?? b.operatingRoom ?? '',
    preOpNotes: b.diagnosis ?? b.preOpNotes ?? '',
    requiredEquipment: b.equipment_needed ?? b.requiredEquipment ?? [],
    status: b.status || 'scheduled',
    diagnosis: b.diagnosis ?? '',
    primarySurgeon: b.primary_surgeon ?? b.primarySurgeon ?? '',
    startTime: b.start_time ?? b.startTime ?? '',
    caseCategory: b.case_category ?? b.caseCategory ?? '',
    ward: b.proposed_ward ?? b.ward ?? '',
    patientAgeAtBooking: b.patient_age_at_booking ?? b.patientAgeAtBooking ?? null,
    patientGender: b.patient_gender ?? b.patientGender ?? '',
    needsBloodTransfusion: b.needs_blood_transfusion ?? b.needsBloodTransfusion ?? false,
    bloodUnitsRequested: b.blood_units_requested ?? b.bloodUnitsRequested ?? 0,
    isEmergency: b.is_emergency ?? b.isEmergency ?? false,
    isDiabetic: b.is_diabetic ?? b.isDiabetic ?? false,
  };
}
