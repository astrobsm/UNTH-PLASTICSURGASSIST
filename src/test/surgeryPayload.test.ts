// @vitest-environment node
/**
 * A surgery booking made offline must reach the server when the ward gets a
 * connection back.
 *
 * schedulingService mapped the booking to the handler's camelCase names for the
 * online attempt, then queued the RAW local booking when that attempt failed.
 * The retry therefore posted `patient_id` / `procedure_name` / `date` to a
 * handler that reads `patientId` / `procedureName` / `scheduledDate` and 400s
 * without them — so it failed on every retry until the queue gave up on it.
 * The offline path is the only reason the retry exists, and it was the only one
 * that could not work.
 */

import { describe, it, expect } from 'vitest';
import { toSurgeryPayload } from '../db/surgeryPayload';

/** The shape schedulingService stores in db.surgery_bookings. */
const localBooking = {
  id: 'surgery_1730000000000_abc',
  patient_id: '412',
  patient_name: 'A. Patient',
  procedure_name: 'Split-thickness skin graft',
  procedure_type: 'reconstructive',
  date: '2026-09-04',
  theatre_number: 'Theatre 2',
  start_time: '09:00',
  primary_surgeon: 'Mr Okafor',
  anaesthesia_type: 'general',
  estimated_duration_minutes: 120,
  equipment_needed: ['Dermatome'],
  diagnosis: 'Post-burn contracture',
  case_category: 'intermediate',
  proposed_ward: 'Ward 4',
  is_emergency: false,
  is_diabetic: true,
  patient_age_at_booking: 34,
  patient_gender: 'F',
  status: 'scheduled',
};

describe('surgery booking sync payload', () => {
  it('supplies the three fields the handler rejects the request without', () => {
    const p = toSurgeryPayload(localBooking);
    expect(p.patientId).toBe('412');
    expect(p.procedureName).toBe('Split-thickness skin graft');
    expect(p.scheduledDate).toBe('2026-09-04');
  });

  it('carries the rest of the booking across', () => {
    const p = toSurgeryPayload(localBooking);
    expect(p.operatingRoom).toBe('Theatre 2');
    expect(p.anesthesiaType).toBe('general');
    expect(p.estimatedDuration).toBe(120);
    expect(p.primarySurgeon).toBe('Mr Okafor');
    expect(p.startTime).toBe('09:00');
    expect(p.caseCategory).toBe('intermediate');
    expect(p.ward).toBe('Ward 4');
    expect(p.requiredEquipment).toEqual(['Dermatome']);
    expect(p.isDiabetic).toBe(true);
    expect(p.patientAgeAtBooking).toBe(34);
  });

  it('does not lose a false or zero value to a default', () => {
    // `||` chains would turn these into true/60; the booking would then claim
    // an emergency case and an hour of theatre time that nobody asked for.
    const p = toSurgeryPayload({
      ...localBooking,
      is_emergency: false,
      is_diabetic: false,
      estimated_duration_minutes: 0,
      blood_units_requested: 0,
    });
    expect(p.isEmergency).toBe(false);
    expect(p.isDiabetic).toBe(false);
    expect(p.estimatedDuration).toBe(0);
    expect(p.bloodUnitsRequested).toBe(0);
  });

  it('accepts a booking already written in the handler\'s own names', () => {
    const p = toSurgeryPayload({
      patientId: 7,
      procedureName: 'Flap revision',
      scheduledDate: '2026-09-10',
    });
    expect(p.patientId).toBe(7);
    expect(p.procedureName).toBe('Flap revision');
    expect(p.scheduledDate).toBe('2026-09-10');
  });

  it('defaults the date rather than sending nothing the handler will reject', () => {
    const p = toSurgeryPayload({ patient_id: 1, procedure_name: 'Debridement' });
    expect(String(p.scheduledDate)).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });
});
