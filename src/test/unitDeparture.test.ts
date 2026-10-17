// @vitest-environment node
/**
 * When a doctor leaves the unit their patients stay in their own unit, their
 * name comes off the unit lists and the PS unit roster, and nobody inactive is
 * expected on the morning round.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import fs from 'fs';
import path from 'path';

const calls: Array<{ sql: string; params: any[] }> = [];
let assignments: any[] = [];
let psRoster: any[] = [];
let savedUnits: any = null;

vi.mock('../../api/_lib/db.js', () => ({
  query: vi.fn(async (sql: string, params: any[] = []) => {
    calls.push({ sql, params });
    if (/FROM patient_assignments WHERE is_active = TRUE AND house_officer_id = \$1/.test(sql)) {
      return { rows: assignments.filter(a => a.house_officer_id === params[0]) };
    }
    if (/FROM patient_assignments WHERE is_active = TRUE AND \w+_id = \$1/.test(sql)) return { rows: [] };
    if (/FROM admissions/.test(sql)) return { rows: [{ pid: 'p1', assigned_unit: 'PS-UNIT-1' }, { pid: 'p2', assigned_unit: 'PS-UNIT-2' }] };
    if (/u\.id::text = ANY\(\$1::text\[\]\)/.test(sql)) return { rows: params[0].length ? [{ id: params[0][0] }] : [] };
    if (/FROM ps_unit_rosters/.test(sql)) return { rows: psRoster };
    return { rows: [], rowCount: 0 };
  }),
}));
vi.mock('../../api/_lib/callRoster.js', () => ({
  onCallTeamAt: vi.fn(),
  getUnitConfig: vi.fn(async () => ({
    anchor_date: '2026-09-28', rotation: { enabled: false },
    units: [], current_units: [
      { key: 'unit1', name: 'PS Unit 1', consultant_ids: ['C1'], senior_registrar_ids: [], registrar_ids: [], house_officer_ids: ['HO_A', 'HO_U1'] },
      { key: 'unit2', name: 'PS Unit 2', consultant_ids: ['C2'], senior_registrar_ids: [], registrar_ids: [], house_officer_ids: ['HO_S', 'HO_U2'] },
    ],
  })),
  saveUnitConfig: vi.fn(async (raw: any) => { savedUnits = raw.units; return { config: {} }; }),
}));
vi.mock('../../api/_lib/staffAbsence.js', () => ({ getAbsentUserIds: async () => [] }));

import { reassignDeactivatedUser, removeFromUnits } from '../../api/_lib/teamAssignment.js';
import { removeFromPsUnitRoster } from '../../api/_lib/unitDeparture.js';

beforeEach(() => { calls.length = 0; assignments = []; psRoster = []; savedUnits = null; });

describe('a house officer leaves', () => {
  it('each patient goes to a house officer of the patient’s own unit', async () => {
    assignments = [
      { id: 1, patient_id: 'p1', consultant_id: 'C1', house_officer_id: 'HO_S' }, // Unit 1 patient
      { id: 2, patient_id: 'p2', consultant_id: 'C2', house_officer_id: 'HO_S' }, // Unit 2 patient
    ];
    const r = await reassignDeactivatedUser('HO_S');
    expect(r).toMatchObject({ reassigned: 2, outsideUnit: 0 });
    const picks = calls.filter(c => /u\.id::text = ANY\(\$1::text\[\]\)/.test(c.sql)).map(c => c.params[0]);
    expect(picks[0]).toEqual(['HO_A', 'HO_U1']);           // Unit 1 candidates only
    expect(picks[1]).toEqual(['HO_U2']);                   // Unit 2, without the leaver
    const updates = calls.filter(c => /UPDATE patient_assignments/.test(c.sql)).map(c => c.params[0]);
    expect(updates).toEqual(['HO_A', 'HO_U2']);
  });

  it('is taken out of both units’ lists', async () => {
    const r = await removeFromUnits('HO_S');
    expect(r.removed).toBe(1);
    expect(savedUnits[1].house_officer_ids).toEqual(['HO_U2']);
    expect(savedUnits[0].house_officer_ids).toEqual(['HO_A', 'HO_U1']);
  });

  it('comes off the PS unit roster, which stores names', async () => {
    psRoster = [{ id: 7, is_active: true, house_officers: ['ABRAHAM NWUSULOR', 'Nnolum Chioma'], junior_registrars: '["Ndiana-Abasi George Tom"]', senior_registrars: [] }];
    expect(await removeFromPsUnitRoster('Abraham Nwusulor ')).toEqual({ removed: 1 });
    const upd = calls.find(c => /UPDATE ps_unit_rosters/.test(c.sql))!;
    expect(JSON.parse(upd.params[0])).toEqual(['Nnolum Chioma']);
  });
});

describe('wiring', () => {
  const read = (p: string) => fs.readFileSync(path.resolve(__dirname, '..', '..', p), 'utf8');
  it('sign-out releases the doctor from everything; the heartbeat cleans up anyone deactivated by hand', () => {
    expect(read('api/users/sign-out.js')).toMatch(/releaseFromUnit\(/);
    expect(read('api/call-duty-roster.js')).toMatch(/reconcileInactiveStaff\(\)/);
  });
  it('only active house officers are expected on, or shown in, the morning round', () => {
    expect(read('api/_lib/morningRounds.js')).toMatch(/JOIN users u ON u\.id::text = pa\.house_officer_id::text AND u\.is_active = TRUE/);
    expect(read('api/ward-rounds.js')).toMatch(/AND is_active = TRUE`, \[\[\.\.\.hoIds\]\]/);
  });
});
