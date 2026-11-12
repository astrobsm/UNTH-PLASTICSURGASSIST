// @vitest-environment node
/**
 * Critical-care AI layer: output is coerced to the specification's schema,
 * the app's numbers are sent for recomputation and discrepancies surfaced,
 * the unit's AI governance switch is honoured, the case is de-identified and
 * every request is audited.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

let aiAllowed = true;
let modelOut: any = {};
const sent: any[] = [];
const audits: any[] = [];
vi.mock('../../api/_lib/auth.js', () => ({ cors: () => false, authenticateRequest: (req: any) => (req.headers.role ? { authenticated: true, user: { id: 1, role: req.headers.role } } : { authenticated: false, error: 'no' }) }));
vi.mock('../../api/_lib/governance.js', () => ({ externalAiAllowed: async () => aiAllowed }));
vi.mock('../../api/_lib/openai.js', () => ({
  getOpenAIKey: () => 'k', OpenAIError: class extends Error { status = 500 },
  chatJSON: vi.fn(async (params: any) => { sent.push(params); return modelOut; }),
}));
vi.mock('../../api/_lib/deidentify.js', () => ({
  identifiersForPatient: async () => ['Adaeze Okafor', 'PT-123'],
  deidentifyText: (t: string, ids: string[]) => ids.reduce((s, id) => s.split(id).join('[REDACTED]'), t),
}));
vi.mock('../../api/_lib/clinicalRecords.js', () => ({ auditClinical: vi.fn(async (_u: any, e: any) => { audits.push(e); }) }));

import handler, { appCalculations, discrepancies } from '../../api/critical-care.js';
import { normaliseCriticalReview, CC_DISCLAIMER } from '../../api/_lib/criticalCareNormalise.js';
import { emptyReport } from '../clinical/critical/types';
import { analyseCritical } from '../clinical/critical/analyse';

const res = () => ({ statusCode: 200, body: null as any, status(c: number) { this.statusCode = c; return this; }, json(b: any) { this.body = b; return this; } }) as any;
const req = (role: string | null, body: any) => ({ method: 'POST', url: '/api/critical-care?action=review', headers: { host: 'x', ...(role ? { role } : {}) }, body });
const keys = (o: object) => Object.keys(o).sort();

beforeEach(() => { aiAllowed = true; modelOut = {}; sent.length = 0; audits.length = 0; });

describe('normaliseCriticalReview', () => {
  it('fills every key from garbage and keeps the specification disclaimer', () => {
    const n = normaliseCriticalReview('not an object');
    expect(keys(n)).toEqual(keys(emptyReport()));
    expect(keys(n.plan)).toEqual(keys(emptyReport().plan));
    expect(n.disclaimer).toBe(CC_DISCLAIMER);
  });
  it('clamps enums, coerces numbers and drops empty rows', () => {
    const n = normaliseCriticalReview({
      critical_alerts: [{ finding: 'K 6.8', severity: 'EXTREME', action: 'calcium' }, { finding: '' }],
      renal_function: { egfr_ckd_epi_2021: '26 mL/min', weight_used: 'heavy' },
      medication_review: [{ drug: 'Lisinopril', recommendation: 'Hold', interactions: [{ with: 'spironolactone', severity: 'severe' }] }],
      differential_diagnosis: [{ diagnosis: 'AKI', likelihood: 'certain' }],
      disclaimer: 'none',
    });
    expect(n.critical_alerts).toEqual([{ finding: 'K 6.8', severity: 'high', action: 'calcium', timeframe: '' }]);
    expect(n.renal_function.egfr_ckd_epi_2021).toBe(26);
    expect(n.renal_function.weight_used).toBe('');
    expect(n.medication_review[0].recommendation).toBe('hold');
    expect(n.medication_review[0].interactions[0].severity).toBe('moderate');
    expect(n.differential_diagnosis[0]).toMatchObject({ rank: 1, likelihood: 'moderate', cant_miss: false });
    expect(n.disclaimer).toBe(CC_DISCLAIMER);
  });
});

describe('app calculations and discrepancies', () => {
  const rule = analyseCritical({ patient: { age_years: 54, sex: 'male', weight_kg: 70, height_cm: 170 }, labs: [{ test: 'Potassium', value: 6.9, unit: 'mmol/L' }, { test: 'Creatinine', value: 250, unit: 'µmol/L' }] });
  it('sends the app eGFR/CrCl for recomputation', () => {
    expect(appCalculations(rule)).toMatchObject({ egfr_ckd_epi_2021: 26 });
  });
  it('flags a differing eGFR and a missed critical alert', () => {
    const d = discrepancies(rule, normaliseCriticalReview({ renal_function: { egfr_ckd_epi_2021: 60 }, critical_alerts: [] }));
    expect(d.some(x => /eGFR: app 26, AI 60/.test(x))).toBe(true);
    expect(d.some(x => /did not list/.test(x))).toBe(true);
  });
});

describe('critical-care handler', () => {
  it('requires auth and blocks students', async () => {
    const a = res(); await handler(req(null, {}), a); expect(a.statusCode).toBe(401);
    const b = res(); await handler(req('student', { input: {} }), b); expect(b.statusCode).toBe(403);
  });
  it('honours the unit AI switch', async () => {
    aiAllowed = false;
    const r = res(); await handler(req('registrar', { input: { patient: {} } }), r);
    expect(r.statusCode).toBe(403);
    expect(r.body.code).toBe('AI_DISABLED');
    expect(sent).toHaveLength(0);
  });
  it('de-identifies, uses the specification prompt, normalises and audits', async () => {
    modelOut = { clinical_summary: 'ok', critical_alerts: [{ finding: 'Hyperkalaemia', severity: 'critical', action: 'x', timeframe: 'now' }] };
    const r = res();
    await handler(req('consultant', { patient_id: '9', input: { patient: { age_years: 54 }, presenting_complaint: 'Adaeze Okafor PT-123 breathless' }, rule_report: emptyReport() }), r);
    expect(r.statusCode).toBe(200);
    expect(r.body.review.clinical_summary).toBe('ok');
    expect(keys(r.body.review)).toEqual(keys(emptyReport()));
    const userMsg = sent[0].messages[1].content;
    expect(userMsg).not.toMatch(/Adaeze|PT-123/);
    expect(sent[0].messages[0].content).toMatch(/consultant intensivist/);
    expect(sent[0].messages[0].content).toMatch(/Never state a drug dose from vague memory/);
    expect(audits[0]).toMatchObject({ action: 'ai_request', entity: 'critical_care_review' });
    expect(audits[0].detail.deidentified).toBe(true);
  });
});
