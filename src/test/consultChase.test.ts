/**
 * Consult chase: who is chased and what they are told.
 */
import { describe, it, expect } from 'vitest';
import { chaseRecipients, composeConsultChase, patientLabel, elapsed, NEXT_STEP } from '../../api/_lib/consultChase.js';

const consult = {
  id: 1, consult_ref: 'RC-2026-933959', status: 'received', urgency: 'emergency',
  patient_name: 'Udeh Roseline', hospital_number: 'UN0042', ward: 'MMW', bed_number: '7',
  referring_unit: 'Cardiology', indication: 'Expert review and management.',
  created_at: '2026-11-13T10:00:00Z',
  oncall_senior_registrar_id: '11', oncall_registrar_id: '12', oncall_house_officer_id: '13', oncall_ho_ward_id: '13',
  oncall_team: JSON.stringify({
    consultant: { id: '10', name: 'Dr Ogbuishi' },
    senior_registrar: { id: '11', name: 'Dr SR Snapshot', phone: '0801' },
    registrar: { id: '12', name: 'Dr Reg' },
    house_officer: { id: '13', name: 'Dr HO' },
    ho_ward: { id: '13', name: 'Dr HO' },
  }),
};
const users = [{ id: 11, full_name: 'Dr Senior Reg', phone: '08031111111' }, { id: 12, full_name: 'Dr Registrar', phone: null }];

describe('consult chase', () => {
  it('chases SR, registrar and HO — never the consultant — once per person', () => {
    const r = chaseRecipients(consult, users);
    expect(r.map(x => x.role)).toEqual(['senior_registrar', 'registrar', 'house_officer']); // ward HO is the same person
    expect(r[0]).toMatchObject({ name: 'Dr Senior Reg', phone: '08031111111' }); // users table wins over snapshot
    expect(r[1].phone).toBeNull();
    expect(r[2]).toMatchObject({ name: 'Dr HO', id: '13' });
  });
  it('no team recorded → nobody to chase', () => {
    expect(chaseRecipients({ ...consult, oncall_team: null, oncall_senior_registrar_id: null, oncall_registrar_id: null, oncall_house_officer_id: null, oncall_ho_ward_id: null })).toEqual([]);
  });
  it('the message names the patient by initials and says what is owed', () => {
    const [sr] = chaseRecipients(consult, users);
    const msg = composeConsultChase(consult, sr, { senderName: 'Dr Douglas', appUrl: 'https://x.app', now: new Date('2026-11-13T12:30:00Z') });
    expect(msg).toMatch(/^Dear Dr Senior Reg,/);
    expect(msg).toMatch(/EMERGENCY consult RC-2026-933959 from Cardiology, received 2 h 30 min ago/);
    expect(msg).toContain('Patient: U. R. · Hosp. no. UN0042 · MMW, bed 7');
    expect(msg).not.toMatch(/Udeh|Roseline/);
    expect(msg).toContain(NEXT_STEP.received);
    expect(msg).toContain('https://x.app/consults');
    expect(msg).toMatch(/— Dr Douglas$/);
  });
  it('later stages say how long the consult has sat there', () => {
    const c = { ...consult, status: 'acknowledged', acknowledged_at: '2026-11-13T11:00:00Z' };
    const msg = composeConsultChase(c, { name: 'Dr Reg', label: 'Registrar' }, { now: new Date('2026-11-13T14:00:00Z') });
    expect(msg).toContain('not yet reviewed');
    expect(msg).toContain('(at this stage for 3 h.)');
  });
  it('helpers', () => {
    expect(patientLabel({ patient_name: '' })).toBe('Patient');
    expect(elapsed('2026-11-10T00:00:00Z', new Date('2026-11-13T00:00:00Z'))).toBe('3 days');
    expect(elapsed('bad')).toBeNull();
  });
});
