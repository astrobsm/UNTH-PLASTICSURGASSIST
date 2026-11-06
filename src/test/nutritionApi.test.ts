// @vitest-environment node
/**
 * Nutrition API: the schema in the migration and in the self-healing DDL stay
 * identical, roles gate what each grade may do, measurements are validated,
 * lab analytes are read out of free-form lab results in SI units, and
 * approval is limited to dietitian / consultant / senior registrar.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import fs from 'fs';
import path from 'path';

const calls: Array<{ sql: string; params: any[] }> = [];
let next: any[] = [];
vi.mock('../../api/_lib/db.js', () => ({
  query: vi.fn(async (sql: string, params: any[] = []) => { calls.push({ sql, params }); return { rows: next.shift() ?? [], rowCount: 0 }; }),
}));
vi.mock('../../api/_lib/auth.js', () => ({
  cors: () => false,
  authenticateRequest: (req: any) => (req.headers.role ? { authenticated: true, user: { id: 1, full_name: 'Dr T', role: req.headers.role } } : { authenticated: false, error: 'no' }),
}));

import {
  NUTRITION_DDL, parseLabAnalytes, toSI, validateMeasurement, canApprove, canDraft, canRecord, transition,
} from '../../api/_lib/nutrition.js';
import { inputsFromMeasurements } from '../clinical/nutrition/fromRecord';
import handler from '../../api/nutrition.js';

const norm = (s: string) => s.replace(/--.*$/gm, '').replace(/\s+/g, ' ').trim();
const res = () => ({ statusCode: 200, body: null as any, status(c: number) { this.statusCode = c; return this; }, json(b: any) { this.body = b; return this; } }) as any;
const req = (role: string | null, url: string, body: any = {}, method = 'POST') => ({ method, url, headers: { host: 'x', ...(role ? { role } : {}) }, body });

beforeEach(() => { calls.length = 0; next = []; });

describe('nutrition schema', () => {
  it('the migration and the self-healing DDL are the same statements', () => {
    const sql = fs.readFileSync(path.resolve(__dirname, '../../database/migrations/024_clinical_nutrition.up.sql'), 'utf8');
    const fromFile = norm(sql).split(';').map(s => s.trim()).filter(Boolean);
    expect(fromFile).toEqual(NUTRITION_DDL.map(norm));
  });
});

describe('nutrition roles', () => {
  it('approvers are dietitian, consultant and senior registrar only', () => {
    for (const r of ['dietitian', 'consultant', 'senior_registrar']) expect(canApprove({ role: r })).toBe(true);
    for (const r of ['registrar', 'house_officer', 'nurse', 'admin', 'super_admin']) expect(canApprove({ role: r })).toBe(false);
  });
  it('nurses record but do not draft; lab and pharmacy have no access', () => {
    expect(canRecord({ role: 'nurse' })).toBe(true);
    expect(canDraft({ role: 'nurse' })).toBe(false);
    expect(canDraft({ role: 'house_officer' })).toBe(true);
    expect(canRecord({ role: 'lab' })).toBe(false);
  });
  it('the dietitian role is registered and assignable', () => {
    const roles = fs.readFileSync(path.resolve(__dirname, '../../api/_lib/roles.js'), 'utf8');
    expect(roles).toMatch(/key: 'dietitian'/);
  });
});

describe('measurements', () => {
  it('validates kind, number and plausible range', () => {
    expect(validateMeasurement({ kind: 'weight', value: 70 })).toBeNull();
    expect(validateMeasurement({ kind: 'weight', value: 700 })).toMatch(/outside the plausible range/);
    expect(validateMeasurement({ kind: 'nope', value: 1 })).toMatch(/Unknown/);
    expect(validateMeasurement({ kind: 'muac', value: 'abc' })).toMatch(/number/);
    expect(validateMeasurement({ kind: 'muac', value: 25, measured_at: '2999-01-01' })).toMatch(/future/);
  });
});

describe('lab analytes from lab_orders.results', () => {
  it('reads arrays, keyed objects and flat maps, converting to SI', () => {
    expect(parseLabAnalytes([{ name: 'Serum Albumin', value: '2.8', unit: 'g/dL' }, { parameter: 'CRP', result: 45, unit: 'mg/L' }]))
      .toEqual([{ kind: 'albumin', value: 28, unit: 'g/L' }, { kind: 'crp', value: 45, unit: 'mg/L' }]);
    expect(parseLabAnalytes({ potassium: { value: 3.1, unit: 'mmol/L' }, Phosphate: '0.6', Magnesium: 0.7 }).map(a => a.kind).sort()).toEqual(['k', 'mg', 'po4']);
    expect(parseLabAnalytes(JSON.stringify({ tests: [{ test: 'Prealbumin', value: 15, unit: 'mg/dL' }] }))).toEqual([{ kind: 'prealbumin', value: 0.15, unit: 'g/L' }]);
    expect(parseLabAnalytes({ remarks: 'haemolysed', Hb: 'not done' })).toEqual([]);
    expect(parseLabAnalytes('not json')).toEqual([]);
  });
  it('unit conversion', () => {
    expect(toSI('glucose', 180, 'mg/dL')).toBe(10);
    expect(toSI('creatinine', 1, 'mg/dL')).toBe(88.4);
    expect(toSI('albumin', 35, 'g/L')).toBe(35);
  });
});

describe('engine inputs from the stored record', () => {
  it('latest of each kind wins; weights become the history', () => {
    const i = inputsFromMeasurements([
      { id: 1, kind: 'weight', value: 70, unit: 'kg', method: 'measured', measured_at: '2026-10-01' },
      { id: 'vs-2', kind: 'weight', value: 66, unit: 'kg', method: 'measured', measured_at: '2026-11-01', source: 'vital_signs' },
      { id: 3, kind: 'muac', value: 24, unit: 'cm', measured_at: '2026-11-01' },
      { id: 'lab-4-albumin', kind: 'albumin', value: 28, unit: 'g/L', measured_at: '2026-11-02', source: 'lab_orders' },
    ]);
    expect(i.weightKg).toBe(66);
    expect(i.weightHistory).toHaveLength(2);
    expect(i.muacCm).toBe(24);
    expect(i.labs?.albuminGL).toBe(28);
  });
});

describe('nutrition handler', () => {
  it('rejects unauthenticated and no-access roles', async () => {
    const a = res(); await handler(req(null, '/api/nutrition?patient_id=1', {}, 'GET'), a); expect(a.statusCode).toBe(401);
    const b = res(); await handler(req('pharmacy', '/api/nutrition?patient_id=1', {}, 'GET'), b); expect(b.statusCode).toBe(403);
  });
  it('a nurse may record a measurement but not save an assessment', async () => {
    const ok = res();
    next = Array(NUTRITION_DDL.length).fill([]).concat([[{ id: 5, patient_id: '1', kind: 'muac' }]]);
    await handler(req('nurse', '/api/nutrition?action=measurement', { patient_id: '1', kind: 'muac', value: 24 }), ok);
    expect(ok.statusCode).toBe(201);
    expect(calls.some(c => /INSERT INTO nutrition_measurements/.test(c.sql))).toBe(true);
    const no = res();
    await handler(req('nurse', '/api/nutrition?action=save&kind=assessment', { patient_id: '1', config_version: '1.0.0' }), no);
    expect(no.statusCode).toBe(403);
  });
  it('a registrar cannot approve; a dietitian can', async () => {
    next = [[{ id: 9, status: 'draft', version: 1, patient_id: '1' }]];
    expect((await transition('assessment', 9, 1, { role: 'registrar' }, 'approved')).status).toBe(403);
    next = [[{ id: 9, status: 'draft', version: 1, patient_id: '1' }], [{ id: 9, status: 'approved', version: 2 }]];
    const r = await transition('assessment', 9, 1, { role: 'dietitian', full_name: 'Dt A' }, 'approved');
    expect(r.status).toBe(200);
    expect(calls.some(c => /SET status = 'approved'/.test(c.sql) && c.params.includes('dietitian'))).toBe(true);
  });
  it('a stale version is refused', async () => {
    next = [[{ id: 9, status: 'draft', version: 3, patient_id: '1' }]];
    expect((await transition('plan', 9, 1, { role: 'consultant' }, 'approved')).status).toBe(409);
  });
  it('only food admins can import foods, and rows need energy and protein', async () => {
    const no = res(); await handler(req('house_officer', '/api/nutrition?action=import_foods', { source: { code: 'X', name: 'X' }, rows: [] }), no);
    expect(no.statusCode).toBe(403);
    const ok = res();
    await handler(req('dietitian', '/api/nutrition?action=import_foods', { source: { code: 'WAFCT2019', name: 'WAFCT' }, rows: [{ food_code: '01_001', name: 'Maize', per100g: { energy_kcal: 350, protein_g: 9 } }, { food_code: '01_002', name: 'Bad', per100g: {} }] }), ok);
    expect(ok.statusCode).toBe(200);
    expect(ok.body.imported).toBe(1);
    expect(ok.body.rejected).toHaveLength(1);
  });
});
