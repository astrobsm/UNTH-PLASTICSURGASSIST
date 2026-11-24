/**
 * Ward ordering, the Claude helper's request translation, and the AI unit
 * summary's de-identification and ref mapping.
 */
import { describe, it, expect, vi } from 'vitest';
vi.mock('../../api/_lib/db.js', () => ({ query: vi.fn() }));
import { sortByWard, wardLabel } from '../utils/wardSort';
import { toClaudeRequest, extractJSONText, AI_MODEL } from '../../api/_lib/claude.js';
import { buildUnitRows, normaliseUnitSummary, ageFrom } from '../../api/_lib/unitSummary.js';

describe('ward ordering', () => {
  it('ward (natural) → bed (numeric) → name; no ward last', () => {
    const list = [
      { name: 'Zed', ward: 'Ward 10', bed: '1' },
      { name: 'Ada', ward: '', bed: '' },
      { name: 'Obi', ward: 'Ward 2', bed: '12' },
      { name: 'Eze', ward: 'Ward 2', bed: '3' },
      { name: 'Ama', ward: 'Ward 2', bed: '' },
      { name: 'Ike', ward: 'MMW', bed: '7' },
      { name: 'Bob', ward: 'ward 2', bed: '3' },
    ];
    expect(sortByWard(list).map(p => p.name)).toEqual(['Ike', 'Bob', 'Eze', 'Obi', 'Ama', 'Zed', 'Ada']);
    expect(wardLabel('  ')).toBe('Ward not recorded');
  });
});

describe('Claude helper', () => {
  it('uses Claude Opus 5.5', () => expect(AI_MODEL).toBe('claude-opus-5-5'));
  it('moves system messages to the system prompt and converts images', () => {
    const r = toClaudeRequest([
      { role: 'system', content: 'You are a scribe.' },
      { role: 'user', content: [{ type: 'text', text: 'Read this' }, { type: 'image_url', image_url: { url: 'data:image/png;base64,AAAA', detail: 'high' } }] },
    ], { json: true });
    expect(r.system).toMatch(/^You are a scribe\.\n\nRespond with one JSON object only/);
    expect(r.messages).toEqual([{ role: 'user', content: [{ type: 'text', text: 'Read this' }, { type: 'image', source: { type: 'base64', media_type: 'image/png', data: 'AAAA' } }] }]);
  });
  it('never ends on an assistant turn (no prefill)', () => {
    const r = toClaudeRequest([{ role: 'user', content: 'a' }, { role: 'assistant', content: '{' }]);
    expect(r.messages).toEqual([{ role: 'user', content: 'a' }]);
  });
  it('pulls the JSON object out of fences or prose', () => {
    expect(JSON.parse(extractJSONText('```json\n{"a":1}\n```'))).toEqual({ a: 1 });
    expect(JSON.parse(extractJSONText('Here it is: {"a":"}"} done'))).toEqual({ a: '}' });
  });
});

describe('AI unit summary', () => {
  const now = new Date('2026-11-24T08:00:00Z');
  const patients = [
    { id: 7, name: 'Okeruoa Ifechukwu', hospital_number: 'PS745162301', ward: 'Ward 2', bed: '4' },
    { id: 9, name: 'Egbo Edmund', hospital_number: 'PS745244503', ward: 'Ward 2', bed: '' },
  ];
  const adm = new Map([
    ['7', { admission_date: '2026-11-10T08:00:00Z', date_of_birth: '1990-01-01', gender: 'male', first_name: 'Okeruoa', last_name: 'Ifechukwu',
      provisional_diagnosis: 'Okeruoa has a 20% TBSA flame burn; call 08031234567', reasons_for_admission: 'Resuscitation' }],
  ]);
  it('sends references, never names, hospital numbers or phones', () => {
    const { rows, refs } = buildUnitRows(patients, adm, now);
    const sent = JSON.stringify(rows);
    expect(sent).not.toMatch(/Okeruoa|Ifechukwu|Egbo|Edmund|PS745|0803/);
    expect(rows[0]).toMatchObject({ ref: 'P1', ward: 'Ward 2', bed: '4', age: 36, sex: 'male', days_on_admission: 14, reason: 'Resuscitation' });
    expect(rows[0].diagnosis).toContain('20% TBSA flame burn');
    expect(rows[1]).toMatchObject({ ref: 'P2', age: null });
    expect(refs.P2).toMatchObject({ id: '9', name: 'Egbo Edmund' });
  });
  it('maps refs back to patients and drops unknown refs', () => {
    const { refs } = buildUnitRows(patients, adm, now);
    const s = normaliseUnitSummary({
      overview: 'Two patients.', by_ward: [{ ward: 'Ward 2', count: 2, summary: 'Burns.' }],
      priorities: [{ ref: 'p1', concern: 'Fluid balance', action: 'Review urine output' }, { ref: 'P99', concern: 'x', action: 'y' }],
      long_stay: [], discharge_candidates: [{ ref: 'P2', reason: 'Plan complete' }], data_gaps: ['P2 has no diagnosis'],
    }, refs);
    expect(s.priorities).toEqual([{ ref: 'P1', patient_id: '7', name: 'Okeruoa Ifechukwu', hospital_number: 'PS745162301', ward: 'Ward 2', bed: '4', concern: 'Fluid balance', action: 'Review urine output' }]);
    expect(s.discharge_candidates[0]).toMatchObject({ name: 'Egbo Edmund', reason: 'Plan complete' });
    expect(normaliseUnitSummary(null, refs)).toMatchObject({ overview: '', priorities: [], data_gaps: [] });
  });
  it('age helper', () => { expect(ageFrom('bad')).toBeNull(); expect(ageFrom('2000-11-25', now)).toBe(25); });
});
