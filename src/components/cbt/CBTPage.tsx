/**
 * CBT Page Component
 * Container component for the Computer-Based Testing system
 */

import React, { useCallback, useEffect, useState } from 'react';
import { TrainingLevel } from '../../services/medicalTrainingService';
import { CBTTest, CBTAttempt, cbtService, CBT_CONFIG, getTestWindowLabel } from '../../services/cbtService';
import CBTTestSelection from './CBTTestSelection';
import CBTExamInterface from './CBTExamInterface';
import CBTResults from './CBTResults';

interface CBTPageProps {
  level: TrainingLevel;
  onBack: () => void;
  /** Optional: called after a test is submitted (used to record student participation). */
  onResult?: (result: { testNumber: number; score: number; total: number; percentage: number }) => void;
}

type CBTView = 'selection' | 'exam' | 'results';

const CBTPage: React.FC<CBTPageProps> = ({ level, onBack, onResult }) => {
  const [currentView, setCurrentView] = useState<CBTView>('selection');
  const [currentTest, setCurrentTest] = useState<CBTTest | null>(null);
  const [currentAttempt, setCurrentAttempt] = useState<CBTAttempt | null>(null);
  const [completedAttempt, setCompletedAttempt] = useState<CBTAttempt | null>(null);
  const [showPreExamModal, setShowPreExamModal] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  // Bumped after a submission so the selection screen re-reads progress
  // instead of showing the pre-test state it rendered on mount.
  const [refreshKey, setRefreshKey] = useState(0);

  // Resume a test that was already in progress for this level
  useEffect(() => {
    const inProgress = cbtService.getCurrentTest();
    if (inProgress && inProgress.test.level === level) {
      setCurrentTest(inProgress.test);
      setCurrentAttempt(inProgress.attempt);
      setCurrentView('exam');
    }
  }, [level]);

  // Dismiss the inline notice automatically.
  useEffect(() => {
    if (!notice) return;
    const t = setTimeout(() => setNotice(null), 6000);
    return () => clearTimeout(t);
  }, [notice]);

  /**
   * The signed-in user. Previously each call site did
   * `localStorage.getItem('userId') || \`user-${Date.now()}\`` — when userId was
   * missing that minted a BRAND NEW id on every call, so the weekly-limit check
   * never matched a prior attempt and results were saved under throwaway ids.
   */
  const resolveUserId = useCallback((): string | null => cbtService.getCurrentUserId() || null, []);

  const handleStartTest = (test: CBTTest) => {
    const userId = resolveUserId();
    if (!userId) {
      setNotice('We could not identify your account. Please sign out and back in before starting a test.');
      return;
    }

    const { attempted, lastAttemptDate } = cbtService.hasAttemptedThisWeek(level, userId);
    if (attempted) {
      const when = lastAttemptDate
        ? new Date(lastAttemptDate).toLocaleDateString(undefined, { weekday: 'long', month: 'short', day: 'numeric' })
        : 'earlier this week';
      setNotice(`You have already taken a CBT this week (${when}). You may take one test per week — your next test unlocks on Monday.`);
      setRefreshKey(k => k + 1);
      return;
    }

    setCurrentTest(test);
    setShowPreExamModal(true);
  };

  const confirmStartTest = () => {
    if (!currentTest) return;
    const userId = resolveUserId();
    if (!userId) {
      setShowPreExamModal(false);
      setNotice('We could not identify your account. Please sign out and back in before starting a test.');
      return;
    }

    // Re-check at the moment of starting: the modal may have sat open across a
    // week boundary, or another device may have recorded an attempt.
    if (cbtService.hasAttemptedThisWeek(level, userId).attempted) {
      setShowPreExamModal(false);
      setNotice('You have already taken a CBT this week. Please come back next week.');
      setRefreshKey(k => k + 1);
      return;
    }

    const attempt = cbtService.startTest(currentTest, userId);
    setCurrentAttempt(attempt);
    setShowPreExamModal(false);
    setCurrentView('exam');
  };

  const handleSubmitTest = (test: CBTTest, attempt: CBTAttempt) => {
    const finished = cbtService.submitTest(test, attempt);
    setCompletedAttempt(finished);
    setCurrentView('results');
    setRefreshKey(k => k + 1);
    onResult?.({
      testNumber: test.testNumber ?? 0,
      score: finished.score ?? 0,
      total: test.totalMarks ?? test.questions?.length ?? 0,
      percentage: finished.percentage ?? 0,
    });
  };

  const handleViewResults = (testNumber: number) => {
    const userId = resolveUserId() || undefined;
    const attempt = cbtService
      .getAttemptsForLevel(level, userId)
      .find(a => a.testNumber === testNumber && a.completed);
    if (!attempt) {
      setNotice('That result could not be found on this device. It may still be syncing.');
      return;
    }

    const test = cbtService.generateTestsForLevel(level).find(t => t.testNumber === testNumber);
    if (!test) {
      setNotice('That test is no longer available for your level.');
      return;
    }

    setCurrentTest(test);
    setCompletedAttempt(attempt);
    setCurrentView('results');
  };

  const handleReturnToTests = () => {
    setCurrentTest(null);
    setCurrentAttempt(null);
    setCompletedAttempt(null);
    setCurrentView('selection');
    setRefreshKey(k => k + 1);
  };

  const handleExitExam = () => {
    cbtService.clearCurrentTest();
    handleReturnToTests();
  };

  // ── Exam ────────────────────────────────────────────────────────────
  if (currentView === 'exam' && currentTest && currentAttempt) {
    return (
      <CBTExamInterface
        test={currentTest}
        attempt={currentAttempt}
        onSubmit={handleSubmitTest}
        onExit={handleExitExam}
      />
    );
  }

  // ── Results ─────────────────────────────────────────────────────────
  if (currentView === 'results' && currentTest && completedAttempt) {
    return (
      <CBTResults
        test={currentTest}
        attempt={completedAttempt}
        onReturnToTests={handleReturnToTests}
      />
    );
  }

  // ── Selection (+ pre-exam modal layered over it) ────────────────────
  // The modal used to be an early `return`, so its translucent backdrop
  // darkened an empty page instead of the test list behind it.
  const questionCount = currentTest?.questions.length ?? CBT_CONFIG.questionsPerTest;
  const durationMinutes = Math.round((currentTest?.duration ?? CBT_CONFIG.durationSeconds) / 60);
  const marksPerQuestion = currentTest?.questions[0]?.marks ?? CBT_CONFIG.marksPerQuestion;
  const passMark = currentTest?.passMark ?? CBT_CONFIG.passMarkPercentage;

  return (
    <div className="min-h-screen bg-gray-50 p-4 md:p-8">
      <div className="max-w-7xl mx-auto mb-6">
        <button
          onClick={onBack}
          className="flex items-center gap-2 text-gray-600 hover:text-gray-800 transition-colors mb-4"
        >
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
          Back to training
        </button>

        <h1 className="text-xl sm:text-2xl lg:text-3xl font-bold text-gray-800">Computer-Based Tests</h1>
        <p className="text-gray-600 mt-1">
          Weekly MCQ examinations for {cbtService.getLevelDisplayName(level)}s
        </p>
      </div>

      {notice && (
        <div className="max-w-7xl mx-auto mb-4">
          <div className="bg-amber-50 border border-amber-200 text-amber-800 rounded-lg px-4 py-3 flex items-start gap-3">
            <svg className="w-5 h-5 shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <p className="flex-1 text-sm">{notice}</p>
            <button onClick={() => setNotice(null)} className="text-amber-600 hover:text-amber-800" aria-label="Dismiss">
              ✕
            </button>
          </div>
        </div>
      )}

      <div className="max-w-7xl mx-auto">
        <CBTTestSelection
          level={level}
          onStartTest={handleStartTest}
          onViewResults={handleViewResults}
          refreshKey={refreshKey}
        />
      </div>

      {showPreExamModal && currentTest && (
        <div
          className="fixed inset-0 bg-black/50 z-50 flex items-start sm:items-center justify-center p-4 overflow-y-auto"
          role="dialog"
          aria-modal="true"
          aria-labelledby="cbt-preexam-title"
        >
          <div className="bg-white rounded-2xl max-w-lg w-full shadow-2xl my-4 sm:my-8 max-h-[calc(100vh-2rem)] flex flex-col">
            <div className="bg-gradient-to-r from-green-500 to-green-600 p-6 text-white rounded-t-2xl flex-shrink-0">
              <h2 id="cbt-preexam-title" className="text-lg sm:text-2xl font-bold">Ready to start?</h2>
              <p className="opacity-90 mt-1">{currentTest.title}</p>
            </div>

            <div className="p-6 overflow-y-auto flex-1">
              <h3 className="font-semibold text-gray-800 mb-4">Before you begin</h3>

              <ul className="space-y-3 mb-6">
                {[
                  {
                    tone: 'blue', badge: '1', title: 'Test format',
                    body: `${questionCount} clinical scenario MCQs with 5 options each`,
                  },
                  {
                    tone: 'blue', badge: '2', title: 'Time limit',
                    body: `${durationMinutes} minutes. The test auto-submits when time runs out.`,
                  },
                  {
                    tone: 'blue', badge: '3', title: 'Scoring',
                    // Was hardcoded "Pass mark = 50%" while the rule is 75%.
                    body: `Each question is worth ${marksPerQuestion} marks. Pass mark is ${passMark}%.`,
                  },
                  {
                    tone: 'amber', badge: '!', title: 'Anti-cheating measures',
                    body: 'Tab switching is monitored and recorded. Stay on this page during the test.',
                  },
                  {
                    tone: 'green', badge: '✓', title: 'Offline support',
                    body: 'The test works offline. Your results sync when you reconnect.',
                  },
                ].map(item => (
                  <li key={item.title} className="flex items-start gap-3">
                    <div className={`w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5 ${
                      item.tone === 'amber' ? 'bg-amber-100' : item.tone === 'green' ? 'bg-green-100' : 'bg-blue-100'
                    }`}>
                      <span className={`text-sm font-bold ${
                        item.tone === 'amber' ? 'text-amber-600' : item.tone === 'green' ? 'text-green-600' : 'text-blue-600'
                      }`}>
                        {item.badge}
                      </span>
                    </div>
                    <div>
                      <p className="text-gray-800 font-medium">{item.title}</p>
                      <p className="text-gray-600 text-sm">{item.body}</p>
                    </div>
                  </li>
                ))}
              </ul>

              <div className="bg-gray-50 rounded-xl p-4 mb-6">
                <h4 className="font-medium text-gray-800 mb-2">Recommended</h4>
                <ul className="text-sm text-gray-600 space-y-1">
                  <li>• Close all other browser tabs</li>
                  <li>• Find a quiet environment</li>
                  <li>• Have pen and paper ready for calculations</li>
                  {CBT_CONFIG.window.enforced && <li>• Tests run {getTestWindowLabel()}</li>}
                </ul>
              </div>

              <div className="flex gap-3">
                <button
                  onClick={() => setShowPreExamModal(false)}
                  className="flex-1 py-3 px-4 bg-gray-200 hover:bg-gray-300 text-gray-700 rounded-xl font-medium transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={confirmStartTest}
                  className="flex-1 py-3 px-4 bg-green-500 hover:bg-green-600 text-white rounded-xl font-medium transition-colors flex items-center justify-center gap-2"
                >
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  Start test
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default CBTPage;
