// @vitest-environment node
/**
 * A ward round documented offline must reach the server.
 *
 * wardRoundsService saved the round to IndexedDB and, when there was no
 * connection, simply returned — nothing queued it, so `synced: false` was where
 * that round stayed. The sync service did have a handler for ward rounds, but
 * it posted the raw local row to the bare path, and the endpoint both dispatches
 * on ?action and reads camelCase, so that retry could not have worked either.
 */

import { describe, it, expect } from 'vitest';
import { toWardRoundPayload } from '../db/wardRoundPayload';

const localRound = {
  id: 'e6f1-uuid',
  patient_id: '412',
  patient_name: 'A. Patient',
  round_date: new Date('2026-08-30T08:15:00.000Z'),
  round_type: 'consultants_round',
  clinical_notes: 'Graft take good.',
  examination_findings: 'No collection.',
  follow_up_plan: 'Re-dress Thursday.',
  complications: 'Nil',
  wound_notes: 'Dressing dry.',
  new_orders: 'Continue antibiotics',
  temperature: 37.1,
  pulse: 82,
  bp_systolic: 118,
  bp_diastolic: 74,
};

describe('ward round sync payload', () => {
  it('supplies the field the handler rejects the request without', () => {
    expect(toWardRoundPayload(localRound).patientId).toBe('412');
  });

  it('sends the round date as a plain date the column accepts', () => {
    // The column is cast $4::date; an ISO datetime or a Date object would not
    // survive that cast.
    expect(toWardRoundPayload(localRound).roundDate).toBe('2026-08-30');
  });

  it('defaults the date rather than sending nothing', () => {
    const p = toWardRoundPayload({ patient_id: '1' });
    expect(String(p.roundDate)).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  it('carries the clinical detail into the findings column', () => {
    // The table has three columns for what the form collects as a dozen fields,
    // so the rest travels as JSON rather than being dropped.
    const findings = JSON.parse(toWardRoundPayload(localRound).findings);
    expect(findings.clinical_notes).toBe('Graft take good.');
    expect(findings.examination_findings).toBe('No collection.');
  });

  it('collects the vitals that were actually recorded', () => {
    const p = toWardRoundPayload(localRound);
    expect(p.vitalSigns).toMatchObject({ temperature: 37.1, pulse: 82, bp_systolic: 118 });
    expect(p.vitalSigns).not.toHaveProperty('spo2');
  });

  it('survives a round with almost nothing filled in', () => {
    const p = toWardRoundPayload({ patient_id: '9' });
    expect(p.patientId).toBe('9');
    expect(p.vitalSigns).toEqual({});
    expect(() => JSON.parse(p.findings)).not.toThrow();
  });
});
