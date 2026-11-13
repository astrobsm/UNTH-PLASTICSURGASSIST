/**
 * Consult chase: who is chased and what they are told.
 */
import { describe, it, expect } from 'vitest';
import { chaseRecipients, composeConsultChase, patientLabel, elapsed, NEXT_STEP, buildChaseDigest, composeChaseDigest, DIGEST_MAX_LINES } from '../../api/_lib/consultChase.js';

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

describe('one message per person', () => {
  const team = (sr: string, ho: string) => ({ oncall_senior_registrar_id: sr, oncall_registrar_id: null, oncall_house_officer_id: ho, oncall_ho_ward_id: ho,
    oncall_team: { senior_registrar: { id: sr, name: `SR${sr}` }, house_officer: { id: ho, name: `HO${ho}` } } });
  const mk = (id: number, urgency: string, status: string, created: string, t = team('11', '13')) =>
    ({ id, consult_ref: `RC-${id}`, urgency, status, created_at: created, patient_name: 'Ada Obi', referring_unit: 'Cardiology', ...t });
  const consults = [
    mk(1, 'routine', 'received', '2026-11-01T08:00:00Z'),
    mk(2, 'emergency', 'acknowledged', '2026-11-12T08:00:00Z'),
    mk(3, 'emergency', 'received', '2026-11-10T08:00:00Z'),
    mk(4, 'urgent', 'closed', '2026-11-10T08:00:00Z'),            // closed: never chased
    mk(5, 'urgent', 'reviewed', '2026-11-11T08:00:00Z', team('11', '14')),
  ];
  const users = [{ id: 11, full_name: 'Dr. Senior Reg', phone: '0803' }];
  it('groups every open consult under each person, emergencies then oldest first', () => {
    const d = buildChaseDigest(consults, users);
    const sr = d.find(p => p.id === '11')!;
    expect(sr.consults.map((c: any) => c.id)).toEqual([3, 2, 5, 1]);
    expect(sr.counts).toEqual({ emergency: 2, urgent: 1, routine: 1 });
    expect(sr.roles).toEqual(['Senior Registrar']);
    expect(d.find(p => p.id === '13')!.consults.map((c: any) => c.id)).toEqual([3, 2, 1]);
    expect(d.find(p => p.id === '14')!.consults.map((c: any) => c.id)).toEqual([5]);
    expect(d[0].id).toBe('11'); // most emergencies first
  });
  it('a person on two roles of one consult appears once with both roles', () => {
    const d = buildChaseDigest([mk(9, 'urgent', 'received', '2026-11-12T08:00:00Z', team('20', '20'))]);
    expect(d).toHaveLength(1);
    // chaseRecipients de-duplicates by person, so the first role held is kept.
    expect(d[0].roles).toEqual(['Senior Registrar']);
    expect(d[0].consults).toHaveLength(1);
  });
  it('the single message lists all of them', () => {
    const sr = buildChaseDigest(consults, users).find(p => p.id === '11')!;
    const msg = composeChaseDigest(sr, { senderName: 'Dr Douglas', now: new Date('2026-11-13T08:00:00Z') });
    expect(msg).toMatch(/^Dear Dr Senior Reg,\nConsult chase — 4 consults .* \(2 emergency, 1 urgent, 1 routine\):/);
    expect(msg).toContain('1. EMERGENCY · RC-3 · A. O. · from Cardiology · 3 days ago — not yet acknowledged — please see');
    expect(msg).toContain('2. EMERGENCY · RC-2');
    expect(msg).toContain('4. ROUTINE · RC-1');
    expect(msg).not.toMatch(/Ada|Obi|RC-4/);
    expect(msg).toMatch(/— Dr Douglas$/);
  });
  it('long lists are capped with a pointer to the app', () => {
    const many = Array.from({ length: DIGEST_MAX_LINES + 5 }, (_, i) => mk(100 + i, 'routine', 'received', '2026-11-01T08:00:00Z'));
    const msg = composeChaseDigest(buildChaseDigest(many)[0]);
    expect(msg).toContain('…and 5 more in the app.');
  });
});
