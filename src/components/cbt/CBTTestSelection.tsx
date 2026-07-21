/**
 * CBT Test Selection Component
 * Displays available tests for the trainee's level, with progress and eligibility.
 *
 * All displayed rules are derived from CBT_CONFIG or from the CBTTest objects
 * themselves — no hardcoded question counts, durations or pass marks, so the
 * copy on screen cannot drift away from the rules actually enforced.
 */

import React, { useCallback, useEffect, useState } from 'react';
import { TrainingLevel } from '../../services/medicalTrainingService';
import { cbtService, CBTTest, CBTProgress, CBT_CONFIG, getTestWindowLabel } from '../../services/cbtService';

interface CBTTestSelectionProps {
  level: TrainingLevel;
  onStartTest: (test: CBTTest) => void;
  onViewResults: (testNumber: number) => void;
  /** Bumping this re-reads progress — e.g. after a test is submitted. */
  refreshKey?: number;
}

type TestCardState = 'completed' | 'next' | 'locked';

const CBTTestSelection: React.FC<CBTTestSelectionProps> = ({
  level,
  onStartTest,
  onViewResults,
  refreshKey = 0,
}) => {
  const [loading, setLoading] = useState(true);
  const [tests, setTests] = useState<CBTTest[]>([]);
  const [progress, setProgress] = useState<CBTProgress | null>(null);
  const [nextTestNumber, setNextTestNumber] = useState(1);
  const [weeklyStatus, setWeeklyStatus] = useState<{ attempted: boolean; lastAttemptDate: string | null }>({
    attempted: false,
    lastAttemptDate: null,
  });

  const isWithinWindow = cbtService.isWithinTestWindow();
  const windowEnforced = CBT_CONFIG.window.enforced;

  // Progress is read synchronously from localStorage, but the service hydrates
  // it from IndexedDB asynchronously. Awaiting `ready` stops the first paint
  // from rendering a permanent, uncorrected "0 tests / 0%".
  const load = useCallback(async () => {
    await cbtService.ready;
    const userId = cbtService.getCurrentUserId();
    setTests(cbtService.generateTestsForLevel(level));
    setProgress(cbtService.getProgress(level, userId));
    setNextTestNumber(cbtService.getNextTestNumber(level, userId));
    setWeeklyStatus(cbtService.hasAttemptedThisWeek(level, userId));
    setLoading(false);
  }, [level]);

  useEffect(() => {
    setLoading(true);
    load();
  }, [load, refreshKey]);

  const levelGradient = (l: TrainingLevel) => {
    switch (l) {
      case 'house_officer': return 'from-blue-500 to-blue-600';
      case 'junior_resident': return 'from-green-500 to-green-600';
      case 'senior_resident': return 'from-purple-500 to-purple-600';
      default: return 'from-gray-500 to-gray-600';
    }
  };

  const formatDateTime = (date: Date) =>
    date.toLocaleDateString(undefined, {
      weekday: 'long',
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
    });

  if (loading || !progress) {
    return (
      <div className="space-y-6" role="status" aria-busy="true" aria-label="Loading tests">
        <div className="h-40 rounded-xl bg-gray-200 animate-pulse" />
        <div className="h-16 rounded-lg bg-gray-100 animate-pulse" />
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="h-44 rounded-xl bg-gray-100 animate-pulse" />
          ))}
        </div>
      </div>
    );
  }

  const hasAttemptedThisWeek = weeklyStatus.attempted;
  const nextWindow = cbtService.getNextTestWindow();
  // Guard against a zero denominator — totalTests is level-derived and could be
  // 0, which produced `width: NaN%` and an invisible bar.
  const completionPct = progress.totalTests > 0
    ? Math.min(100, Math.round((progress.completedTests / progress.totalTests) * 100))
    : 0;

  // Every test shares the same shape, so the first one describes the format.
  const sample = tests[0];
  const questionCount = sample?.questions.length ?? CBT_CONFIG.questionsPerTest;
  const durationMinutes = Math.round((sample?.duration ?? CBT_CONFIG.durationSeconds) / 60);
  const marksPerQuestion = sample?.questions[0]?.marks ?? CBT_CONFIG.marksPerQuestion;
  const totalMarks = sample?.totalMarks ?? questionCount * marksPerQuestion;
  const passMark = sample?.passMark ?? CBT_CONFIG.passMarkPercentage;

  const cardState = (test: CBTTest): TestCardState => {
    const attempt = progress.attempts.find(a => a.testNumber === test.testNumber);
    if (attempt?.completed) return 'completed';
    // Keyed on testNumber rather than array index, so a non-contiguous set of
    // completed tests can't mark the wrong card as next/locked.
    if (test.testNumber === nextTestNumber) return 'next';
    return test.testNumber > nextTestNumber ? 'locked' : 'next';
  };

  const canStart = isWithinWindow && !hasAttemptedThisWeek;

  return (
    <div className="space-y-6">
      {/* ── Progress overview ─────────────────────────────────────────── */}
      <div className={`bg-gradient-to-r ${levelGradient(level)} rounded-xl p-5 sm:p-6 text-white`}>
        <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
          <div className="min-w-0">
            <h2 className="text-lg sm:text-2xl font-bold truncate">
              {cbtService.getLevelDisplayName(level)} CBT
            </h2>
            <p className="opacity-90 mt-1 text-sm sm:text-base">
              Weekly Computer-Based Tests • {questionCount} MCQs • {durationMinutes} minutes
            </p>
          </div>
          <div className="flex items-center gap-6 sm:gap-8 shrink-0">
            <div className="text-center">
              <div className="text-xl sm:text-2xl lg:text-3xl font-bold tabular-nums">
                {progress.completedTests}
              </div>
              <div className="text-xs sm:text-sm opacity-90">of {progress.totalTests} tests</div>
            </div>
            <div className="text-center">
              <div className="text-xl sm:text-2xl lg:text-3xl font-bold tabular-nums">
                {progress.averageScore.toFixed(0)}%
              </div>
              <div className="text-xs sm:text-sm opacity-90">This cycle</div>
            </div>
          </div>
        </div>

        <div className="mt-4">
          <div
            className="h-2 bg-white/30 rounded-full overflow-hidden"
            role="progressbar"
            aria-valuenow={completionPct}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-label={`${progress.completedTests} of ${progress.totalTests} tests completed`}
          >
            <div
              className="h-full bg-white rounded-full transition-all duration-500"
              style={{ width: `${completionPct}%` }}
            />
          </div>
        </div>

        <div className="mt-3 flex flex-wrap gap-2 text-xs sm:text-sm">
          {progress.currentPostingCycle > 1 && (
            <span className="bg-white/20 px-3 py-1 rounded-full">
              Posting cycle {progress.currentPostingCycle}
            </span>
          )}
          <span className="bg-white/20 px-3 py-1 rounded-full tabular-nums">
            Cumulative average: {progress.cumulativeAverage.toFixed(0)}%
          </span>
          <span className={`px-3 py-1 rounded-full ${progress.passMarkReached ? 'bg-green-400/30' : 'bg-red-400/30'}`}>
            Sign-out: {progress.passMarkReached ? '✓ Eligible' : `needs ${passMark}%`}
          </span>
        </div>
      </div>

      {/* ── Weekly attempt limit ──────────────────────────────────────── */}
      {hasAttemptedThisWeek && (
        <div className="p-4 rounded-lg flex items-start gap-3 bg-red-50 border border-red-200">
          <div className="p-2 rounded-full bg-red-100 shrink-0">
            <svg className="w-5 h-5 text-red-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <div className="min-w-0">
            <p className="text-red-800 font-medium">
              Weekly limit reached — one CBT per week.
            </p>
            <p className="text-red-600 text-sm mt-1">
              Last attempt:{' '}
              {weeklyStatus.lastAttemptDate
                ? new Date(weeklyStatus.lastAttemptDate).toLocaleDateString(undefined, {
                    weekday: 'long', month: 'short', day: 'numeric',
                  })
                : 'unknown'}
              . Your next test unlocks on Monday.
            </p>
          </div>
        </div>
      )}

      {/* ── Posting cycle context ─────────────────────────────────────── */}
      {progress.currentPostingCycle > 1 && (
        <div className="p-4 rounded-lg flex items-start gap-3 bg-purple-50 border border-purple-200">
          <div className="p-2 rounded-full bg-purple-100 shrink-0">
            <svg className="w-5 h-5 text-purple-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
          </div>
          <div className="min-w-0">
            <p className="text-purple-800 font-medium">
              Posting cycle {progress.currentPostingCycle} — scores accumulate across cycles
            </p>
            <p className="text-purple-600 text-sm mt-1">
              Your cumulative average is <strong>{progress.cumulativeAverage.toFixed(1)}%</strong>; sign-out needs{' '}
              <strong>{passMark}%</strong>.
              {!progress.passMarkReached && ' Marks from new tests are added to your previous scores.'}
            </p>
          </div>
        </div>
      )}

      {/* ── Test window ───────────────────────────────────────────────── */}
      {/* Only shown when the window is actually enforced. It used to render
          unconditionally, advertising a Tuesday-only restriction that the
          service never applied. */}
      {windowEnforced && (
        <div className={`p-4 rounded-lg flex items-start gap-3 ${
          isWithinWindow ? 'bg-green-50 border border-green-200' : 'bg-amber-50 border border-amber-200'
        }`}>
          <div className={`p-2 rounded-full shrink-0 ${isWithinWindow ? 'bg-green-100' : 'bg-amber-100'}`}>
            {isWithinWindow ? (
              <svg className="w-5 h-5 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            ) : (
              <svg className="w-5 h-5 text-amber-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            )}
          </div>
          <div className="min-w-0">
            {isWithinWindow ? (
              <p className="text-green-800 font-medium">Test window is open — you can take this week's test now.</p>
            ) : (
              <p className="text-amber-800">
                <span className="font-medium">Next test window:</span> {formatDateTime(nextWindow)}
                <span className="text-amber-600 text-sm ml-2">({getTestWindowLabel()})</span>
              </p>
            )}
          </div>
        </div>
      )}

      {/* ── Test cards ────────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
        {tests.map(test => {
          const state = cardState(test);
          const attempt = progress.attempts.find(a => a.testNumber === test.testNumber);
          const passed = attempt?.passed ?? false;
          const score = attempt?.percentage ?? 0;

          return (
            <div
              key={test.id}
              className={`rounded-xl border-2 transition-all duration-200 flex flex-col ${
                state === 'completed'
                  ? passed ? 'border-green-200 bg-green-50' : 'border-red-200 bg-red-50'
                  : state === 'next'
                    ? 'border-green-400 bg-white hover:shadow-lg'
                    : 'border-gray-200 bg-gray-50 opacity-60'
              }`}
            >
              <div className="p-4 flex flex-col flex-1">
                <div className="flex items-start justify-between mb-3">
                  <div className={`w-10 h-10 rounded-lg flex items-center justify-center text-lg font-bold shrink-0 ${
                    state === 'completed'
                      ? passed ? 'bg-green-500 text-white' : 'bg-red-500 text-white'
                      : state === 'next'
                        ? 'bg-green-500 text-white'
                        : 'bg-gray-200 text-gray-500'
                  }`}>
                    {test.testNumber}
                  </div>

                  {state === 'completed' ? (
                    <span className={`px-2 py-1 rounded text-xs font-medium ${
                      passed ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
                    }`}>
                      {passed ? 'PASSED' : 'FAILED'}
                    </span>
                  ) : state === 'locked' ? (
                    <svg className="w-5 h-5 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-label="Locked">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                    </svg>
                  ) : null}
                </div>

                <h3 className="font-semibold text-gray-800 mb-1">Week {test.testNumber} test</h3>
                <p className="text-sm text-gray-500 mb-3">
                  {test.questions.length} questions • {Math.round(test.duration / 60)} min
                </p>

                <div className="mt-auto">
                  {state === 'completed' ? (
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-sm text-gray-600">Score</span>
                        <span className={`font-bold tabular-nums ${passed ? 'text-green-600' : 'text-red-600'}`}>
                          {score.toFixed(0)}%
                        </span>
                      </div>
                      <button
                        onClick={() => onViewResults(test.testNumber)}
                        className="w-full py-2 px-4 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg text-sm font-medium transition-colors"
                      >
                        View results
                      </button>
                    </div>
                  ) : state === 'next' && canStart ? (
                    <button
                      onClick={() => onStartTest(test)}
                      className="w-full py-2 px-4 bg-green-500 hover:bg-green-600 text-white rounded-lg font-medium transition-colors flex items-center justify-center gap-2"
                    >
                      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                      Start test
                    </button>
                  ) : state === 'next' && hasAttemptedThisWeek ? (
                    <p className="text-center py-2 text-red-600 text-sm font-medium">Weekly limit reached</p>
                  ) : state === 'next' ? (
                    <p className="text-center py-2 text-amber-600 text-sm">Available {getTestWindowLabel()}</p>
                  ) : (
                    <p className="text-center py-2 text-gray-400 text-sm">Complete previous test first</p>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* ── Instructions (derived, not hardcoded) ─────────────────────── */}
      <div className="bg-blue-50 border border-blue-200 rounded-xl p-5 sm:p-6">
        <h3 className="text-lg font-semibold text-blue-800 mb-3 flex items-center gap-2">
          <svg className="w-5 h-5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          Test instructions
        </h3>
        <ul className="space-y-2 text-blue-700 text-sm">
          {[
            <>Each test contains <strong>{questionCount} clinical scenario MCQs</strong> with options A–E</>,
            <>Select the <strong>single best answer</strong> for each question</>,
            <>Each question carries <strong>{marksPerQuestion} marks</strong> (total: {totalMarks} marks)</>,
            <>You have <strong>{durationMinutes} minutes</strong>; the test auto-submits when time runs out</>,
            ...(windowEnforced
              ? [<>Tests are available <strong>{getTestWindowLabel()}</strong></>]
              : []),
            <><strong>One CBT per week</strong> — Monday to Sunday</>,
            <>Sign-out requires a <strong>{passMark}% cumulative average</strong> across all your tests</>,
            <>If you finish a posting below {passMark}%, <strong>a new cycle starts</strong> and scores keep accumulating until you pass</>,
            <><strong>Anti-cheating measures are active</strong> — tab switching is monitored and recorded</>,
            <>Tests work <strong>offline</strong>; results sync when you reconnect</>,
          ].map((item, i) => (
            <li key={i} className="flex items-start gap-2">
              <span className="text-blue-400 mt-0.5 shrink-0">•</span>
              <span>{item}</span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
};

export default CBTTestSelection;
