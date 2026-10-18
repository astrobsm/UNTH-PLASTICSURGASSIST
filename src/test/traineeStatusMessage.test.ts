/** The trainee status message is paced to the day of the rotation. */
import { describe, it, expect } from 'vitest';
import { buildTraineeStatusMessage, rotationPace, dueByNow } from '../services/traineeStatusMessage';

const now = new Date('2026-10-18T10:00:00Z');
const base = {
  full_name: 'Nnolum Chioma',
  metrics: { overallScore: 10.4, cbtTestsCompleted: 0, patientEntries: 0, dutiesCompleted: 2 },
  requirements: { cbtTests: 4, patientEntries: 30, duties: 20 },
};

describe('trainee status message', () => {
  it('does not call a trainee in their first week "below expectations"', () => {
    const msg = buildTraineeStatusMessage({ ...base, rotation: { start_date: '2026-10-16', expected_end_date: '2027-01-14' } }, now);
    expect(msg).toMatch(/day 3 of 90/);
    expect(msg).not.toMatch(/below expectations|urgently/i);
    expect(msg).toMatch(/settling into the posting/);
  });
  it('later on, judges against what is due by now', () => {
    const msg = buildTraineeStatusMessage({ ...base, rotation: { start_date: '2026-09-18', expected_end_date: '2026-12-17' } }, now);
    expect(msg).toMatch(/day 31 of 90/);
    expect(msg).toMatch(/Several areas are behind/);
  });
  it('on track when the paced targets are met', () => {
    const msg = buildTraineeStatusMessage({
      ...base,
      metrics: { overallScore: 40, cbtTestsCompleted: 2, patientEntries: 11, dutiesCompleted: 7 },
      rotation: { start_date: '2026-09-18', expected_end_date: '2026-12-17' },
    }, now);
    expect(msg).toMatch(/on track/);
  });
  it('pace helpers', () => {
    expect(rotationPace({ start_date: '2026-10-18' }, now)).toMatchObject({ day: 1, totalDays: 90 });
    expect(rotationPace(null, now)).toBeNull();
    expect(dueByNow(30, 0.5)).toBe(15);
  });
});
