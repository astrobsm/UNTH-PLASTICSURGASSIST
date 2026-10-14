/**
 * Everything the ward-round form collects must survive save → server row →
 * read back (S3), and fields left blank must stay "not recorded" instead of
 * turning into reassuring defaults (S4).
 */
import { describe, it, expect } from 'vitest';
import { toWardRoundPayload } from '../db/wardRoundPayload';
import { fromServerFormat } from '../services/wardRoundsService';

const asServerRow = (payload: any) => ({
  id: 7, patient_id: 412, round_date: '2026-10-14', round_type: payload.roundType,
  findings: payload.findings, vital_signs: payload.vitalSigns, plan: payload.plan,
  issues: JSON.stringify(payload.issues), nursing_notes: payload.nursingNotes,
  new_orders: payload.newOrders, folder_updated: payload.folderUpdated ?? false,
});

describe('ward round round trip', () => {
  it('keeps the fields that used to be dropped', () => {
    const round: any = {
      patient_id: '412', round_date: new Date('2026-10-14T07:30:00Z'), round_type: 'house_officers_round',
      chief_complaint: 'Pain at donor site', pain_score: 6, sleep_quality: 'poor', appetite: 'fair',
      bowel_movement: 'not_opened', general_appearance: 'Comfortable at rest', drain_output: 'D1 40 mL serous',
      mobility_status: 'Bed-bound', clinical_impression: 'Day 2 post STSG',
      continue_medications: ['Paracetamol'], stop_medications: ['Tramadol'],
      new_medications: [{ name: 'Ibuprofen', dose: '400 mg', frequency: 'TDS', route: 'oral' }],
      investigations_ordered: ['FBC'], procedures_planned: ['Dressing change day 5'],
      treatment_plan_changes: 'Add NSAID', dietary_modifications: 'High protein',
      activity_orders: 'Elevate limb', nursing_instructions: 'Check graft dressing 4-hourly',
      consultant_notified: true,
    };
    const back = fromServerFormat(asServerRow(toWardRoundPayload(round)));
    for (const k of Object.keys(round).filter(k => !['patient_id', 'round_date', 'round_type'].includes(k))) {
      expect((back as any)[k], k).toEqual(round[k]);
    }
  });

  it('leaves unrecorded fields unrecorded', () => {
    const back = fromServerFormat(asServerRow(toWardRoundPayload({
      patient_id: '412', round_date: new Date('2026-10-14T07:30:00Z'), round_type: 'house_officers_round',
      chief_complaint: '', pain_score: null, sleep_quality: null, appetite: null, bowel_movement: null,
    })));
    expect(back.pain_score).toBeNull();
    expect(back.sleep_quality).toBeNull();
    expect(back.appetite).toBeNull();
    expect(back.bowel_movement).toBeNull();
    // A blank complaint must not come back as "No complaints" or as the raw JSON.
    expect(back.chief_complaint).toBe('');
  });
});
