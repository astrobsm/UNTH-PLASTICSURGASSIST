/**
 * The weekly CBT paper built on the device (used when the question bank cannot
 * be reached) never asks the same question twice and is scored on the
 * questions it actually contains.
 */
import { describe, it, expect } from 'vitest';

describe('offline weekly paper', () => {
  it('never repeats a question within a paper', async () => {
    const { cbtService } = await import('../services/cbtService');
    for (const level of ['house_officer', 'junior_resident', 'senior_resident'] as const) {
      for (const t of cbtService.generateTestsForLevel(level)) {
        const stems = t.questions.map(q => (q.clinicalScenario + '|' + q.question).toLowerCase());
        expect(new Set(stems).size, `${level} test ${t.testNumber}`).toBe(stems.length);
        expect(t.totalMarks).toBe(t.questions.length * 4);
      }
    }
  });
});

