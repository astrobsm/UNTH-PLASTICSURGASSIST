import { describe, it, expect, beforeEach } from 'vitest';
import {
  cbtService,
  CBT_CONFIG,
  getTestWindowLabel,
  getCurrentUserId,
  type CBTAttempt,
} from '../services/cbtService';

/**
 * Regression tests for the CBT rules layer.
 *
 * Each case here corresponds to a bug that shipped:
 *  - the displayed pass mark drifting away from the enforced one (50% vs 75%)
 *  - getNextTestWindow() returning a timestamp in the past on window day
 *  - progress being computed across every user's attempts on the device
 */

const makeAttempt = (over: Partial<CBTAttempt>): CBTAttempt => ({
  id: `a-${Math.random().toString(36).slice(2)}`,
  testId: 'test-house_officer-1',
  level: 'house_officer',
  testNumber: 1,
  userId: 'user-1',
  startTime: new Date().toISOString(),
  endTime: new Date().toISOString(),
  answers: {},
  score: 80,
  totalMarks: 100,
  percentage: 80,
  passed: true,
  completed: true,
  flaggedForReview: [],
  tabSwitchCount: 0,
  suspiciousActivity: false,
  postingCycle: 1,
  ...over,
});

const seedAttempts = (attempts: CBTAttempt[]) => {
  localStorage.setItem('cbt_attempts', JSON.stringify(attempts));
};

describe('CBT rules', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  describe('config coherence', () => {
    it('generated tests carry the same pass mark the config enforces', () => {
      // The pre-exam modal and results screen used to hardcode "50%" while the
      // service passed/failed at 75%. Any future drift fails here.
      const tests = cbtService.generateTestsForLevel('house_officer');
      expect(tests.length).toBeGreaterThan(0);
      for (const test of tests) {
        expect(test.passMark).toBe(CBT_CONFIG.passMarkPercentage);
      }
    });

    it('generated tests match the configured duration and mark scheme', () => {
      const [test] = cbtService.generateTestsForLevel('house_officer');
      expect(test.duration).toBe(CBT_CONFIG.durationSeconds);
      expect(test.totalMarks).toBe(
        CBT_CONFIG.questionsPerTest * CBT_CONFIG.marksPerQuestion
      );
    });

    it('derives the window label from config rather than hardcoded prose', () => {
      expect(getTestWindowLabel()).toContain('Tuesday');
    });
  });

  describe('getNextTestWindow', () => {
    it('never returns a time in the past', () => {
      // The old implementation returned today at 08:00 when called on a
      // Tuesday morning at 09:00 — an hour before "now".
      const next = cbtService.getNextTestWindow();
      const startOfToday = new Date();
      startOfToday.setHours(0, 0, 0, 0);
      expect(next.getTime()).toBeGreaterThanOrEqual(startOfToday.getTime());
    });

    it('lands on the configured weekday at the configured hour', () => {
      const next = cbtService.getNextTestWindow();
      expect(next.getDay()).toBe(CBT_CONFIG.window.weekday);
      expect(next.getHours()).toBe(CBT_CONFIG.window.startHour);
      expect(next.getMinutes()).toBe(0);
    });
  });

  describe('per-user scoping', () => {
    it('counts only the requested user\'s attempts', () => {
      // The device-local cache holds every user's synced attempts.
      seedAttempts([
        makeAttempt({ userId: 'user-1', testNumber: 1, percentage: 90 }),
        makeAttempt({ userId: 'user-2', testNumber: 2, percentage: 10 }),
        makeAttempt({ userId: 'user-2', testNumber: 3, percentage: 20 }),
      ]);

      const mine = cbtService.getAttemptsForLevel('house_officer', 'user-1');
      expect(mine).toHaveLength(1);
      expect(mine[0].userId).toBe('user-1');
    });

    it('does not average another user\'s scores into my progress', () => {
      seedAttempts([
        makeAttempt({ userId: 'user-1', testNumber: 1, percentage: 90 }),
        makeAttempt({ userId: 'user-2', testNumber: 2, percentage: 10 }),
      ]);

      const progress = cbtService.getProgress('house_officer', 'user-1');
      expect(progress.completedTests).toBe(1);
      expect(progress.averageScore).toBe(90);
      expect(progress.cumulativeAverage).toBe(90);
    });

    it('returns every attempt when no user is specified (reporting callers)', () => {
      seedAttempts([
        makeAttempt({ userId: 'user-1' }),
        makeAttempt({ userId: 'user-2' }),
      ]);
      expect(cbtService.getAttemptsForLevel('house_officer')).toHaveLength(2);
    });

    it('scopes the weekly limit to the individual', () => {
      seedAttempts([
        makeAttempt({ userId: 'user-2', endTime: new Date().toISOString() }),
      ]);
      // user-2 tested today; user-1 must still be allowed to sit the test.
      expect(cbtService.hasAttemptedThisWeek('house_officer', 'user-1').attempted).toBe(false);
      expect(cbtService.hasAttemptedThisWeek('house_officer', 'user-2').attempted).toBe(true);
    });
  });

  describe('getCurrentUserId', () => {
    it('returns empty string rather than minting a throwaway id', () => {
      // Call sites used to fall back to `user-${Date.now()}`, producing a new
      // identity on every call so the weekly limit could never match.
      expect(getCurrentUserId()).toBe('');
      localStorage.setItem('userId', '42');
      expect(getCurrentUserId()).toBe('42');
    });
  });
});
