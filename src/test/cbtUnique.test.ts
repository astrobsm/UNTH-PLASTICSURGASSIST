// @vitest-environment node
/**
 * CBT questions are unique: one copy per stem, never a question the learner
 * has already been given, options shuffled per draw and marked correctly, and
 * the offline weekly paper never repeats a question inside itself.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import fs from 'fs';
import path from 'path';

const calls: Array<{ sql: string; params: any[] }> = [];
let poolRows: any[] = [];
vi.mock('../../api/_lib/db.js', () => ({
  query: vi.fn(async (sql: string, params: any[] = []) => {
    calls.push({ sql, params });
    if (/FROM cbt_papers/.test(sql) && /unnest/.test(sql)) return { rows: [{ s: 'previouslyonapaper' }] };
    if (/WITH seen AS/.test(sql)) return { rows: poolRows.slice(0, params[2]) };
    return { rows: [] };
  }),
}));

import { permutation, shuffleRow, toOriginalLetter, toDisplayedLetter, normaliseStem, drawQuestions, LETTERS } from '../../api/_lib/questionDraw.js';

beforeEach(() => { calls.length = 0; poolRows = []; });

const row = { id: 'q1', option_a: 'Alpha', option_b: 'Bravo', option_c: 'Charlie', option_d: 'Delta', option_e: 'Echo', correct_option: 'B' };

describe('option shuffling', () => {
  it('is a stable permutation of A–E per draw and question', () => {
    const p = permutation('seed1', 'q1');
    expect([...p].sort()).toEqual(LETTERS);
    expect(permutation('seed1', 'q1')).toEqual(p);
    // across many draws the key is spread over all five letters
    const positions = new Set(Array.from({ length: 60 }, (_, i) => shuffleRow(row, `s${i}`).correct));
    expect(positions.size).toBe(5);
  });
  it('maps the shown letter back to the stored key, and the key to the shown letter', () => {
    for (let i = 0; i < 20; i++) {
      const seed = `draw${i}`;
      const { options, correct } = shuffleRow(row, seed);
      expect(options[correct!]).toBe('Bravo');
      expect(toOriginalLetter(correct, seed, 'q1')).toBe('B');
      expect(toDisplayedLetter('B', seed, 'q1')).toBe(correct);
    }
  });
});

describe('drawing questions', () => {
  it('collapses repeated stems, puts unseen first and leaves out earlier papers and flawed items', async () => {
    poolRows = Array.from({ length: 30 }, (_, i) => ({ id: `id${i}`, question_text: `Q ${i}`, stem: `q${i}` }));
    const rows = await drawQuestions({ categoryIds: ['c1'], learnerKind: 'user', learnerId: 7, limit: 25 });
    expect(rows).toHaveLength(25);
    const main = calls.find(c => /WITH seen AS/.test(c.sql))!;
    expect(main.sql).toMatch(/DISTINCT ON \(x\.stem\)/);
    expect(main.sql).toMatch(/ORDER BY \(s\.last_seen IS NOT NULL\), s\.last_seen NULLS FIRST/);
    expect(main.sql).toMatch(/\(all\|none\) of the above/);
    expect(main.params[5]).toContain('previouslyonapaper');
    expect(main.params[4]).toBe(7);
  });
  it('normalises stems the same way as the SQL', () => {
    expect(normaliseStem('Flail chest is defined as:')).toBe(normaliseStem('  flail CHEST is defined as '));
  });
});

describe('wiring', () => {
  const read = (p: string) => fs.readFileSync(path.resolve(__dirname, '..', '..', p), 'utf8');
  it('the weekly CBT asks the bank for the trainee’s own paper first', () => {
    expect(read('src/components/cbt/CBTPage.tsx')).toMatch(/learningContentService\.cbtPaper\(/);
  });
  it('bank tests send the draw seed so shuffled answers are marked right', () => {
    expect(read('src/components/learning/PoolTestRunner.tsx')).toMatch(/drawSeed: drawSeed\.current/);
    expect(read('api/learning-content.js')).toMatch(/toOriginalLetter\(shown, seed, q\.id\)/);
  });
  it('residents map onto the curriculum keys', () => {
    expect(read('api/learning-content.js')).toMatch(/junior_resident: \['junior_resident', 'junior_registrar', 'registrar'\]/);
  });
});
