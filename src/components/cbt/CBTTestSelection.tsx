/**
 * CBT Test Selection Component
 * Displays available tests for each training level
 */

import React from 'react';
import { TrainingLevel } from '../../services/medicalTrainingService';
import { cbtService, CBTTest, CBTProgress } from '../../services/cbtService';

interface CBTTestSelectionProps {
  level: TrainingLevel;
  onStartTest: (test: CBTTest) => void;
  onViewResults: (testNumber: number) => void;
}

const CBTTestSelection: React.FC<CBTTestSelectionProps> = ({ level, onStartTest, onViewResults }) => {
  const tests = cbtService.generateTestsForLevel(level);
  const progress = cbtService.getProgress(level);
  const isWithinWindow = cbtService.isWithinTestWindow();
  const nextWindow = cbtService.getNextTestWindow();
  
  const getLevelColor = (level: TrainingLevel) => {
    switch (level) {
      case 'house_officer':
        return 'from-blue-500 to-blue-600';
      case 'junior_resident':
        return 'from-green-500 to-green-600';
      case 'senior_resident':
        return 'from-purple-500 to-purple-600';
      default:
        return 'from-gray-500 to-gray-600';
    }
  };
  
  const getTestStatus = (testNumber: number) => {
    const attempt = progress.attempts.find(a => a.testNumber === testNumber);
    if (attempt && attempt.completed) {
      return {
        status: 'completed',
        score: attempt.percentage,
        passed: attempt.passed
      };
    }
    return { status: 'pending', score: 0, passed: false };
  };
  
  const formatDate = (date: Date) => {
    return date.toLocaleDateString('en-US', {
      weekday: 'long',
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit'
    });
  };

  return (
    <div className="space-y-6">
      {/* Progress Overview */}
      <div className={`bg-gradient-to-r ${getLevelColor(level)} rounded-xl p-6 text-white`}>
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <h2 className="text-2xl font-bold">
              {cbtService.getLevelDisplayName(level)} CBT
            </h2>
            <p className="opacity-90 mt-1">
              Weekly Computer-Based Tests • 25 MCQs • 10 Minutes
            </p>
          </div>
          <div className="flex items-center gap-6">
            <div className="text-center">
              <div className="text-3xl font-bold">{progress.completedTests}</div>
              <div className="text-sm opacity-90">of {progress.totalTests} Tests</div>
            </div>
            <div className="text-center">
              <div className="text-3xl font-bold">{progress.averageScore.toFixed(0)}%</div>
              <div className="text-sm opacity-90">Average Score</div>
            </div>
          </div>
        </div>
        
        {/* Progress Bar */}
        <div className="mt-4">
          <div className="h-2 bg-white/30 rounded-full overflow-hidden">
            <div 
              className="h-full bg-white rounded-full transition-all duration-500"
              style={{ width: `${(progress.completedTests / progress.totalTests) * 100}%` }}
            />
          </div>
        </div>
      </div>
      
      {/* Test Window Status */}
      <div className={`p-4 rounded-lg flex items-center gap-3 ${
        isWithinWindow 
          ? 'bg-green-50 border border-green-200' 
          : 'bg-amber-50 border border-amber-200'
      }`}>
        <div className={`p-2 rounded-full ${
          isWithinWindow ? 'bg-green-100' : 'bg-amber-100'
        }`}>
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
        <div>
          {isWithinWindow ? (
            <p className="text-green-800 font-medium">
              Test window is OPEN. You can take your weekly test now.
            </p>
          ) : (
            <p className="text-amber-800">
              <span className="font-medium">Next test window:</span> {formatDate(nextWindow)}
              <span className="text-amber-600 text-sm ml-2">(Tuesdays 8-10 AM)</span>
            </p>
          )}
        </div>
      </div>
      
      {/* Test Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
        {tests.map((test, index) => {
          const { status, score, passed } = getTestStatus(test.testNumber);
          const isCompleted = status === 'completed';
          const isNext = !isCompleted && index === progress.completedTests;
          const isLocked = index > progress.completedTests;
          
          return (
            <div
              key={test.id}
              className={`rounded-xl border-2 transition-all duration-200 ${
                isCompleted
                  ? passed 
                    ? 'border-green-200 bg-green-50'
                    : 'border-red-200 bg-red-50'
                  : isNext
                    ? 'border-green-400 bg-white hover:shadow-lg cursor-pointer'
                    : isLocked
                      ? 'border-gray-200 bg-gray-50 opacity-60'
                      : 'border-gray-200 bg-white'
              }`}
            >
              <div className="p-4">
                {/* Test Header */}
                <div className="flex items-start justify-between mb-3">
                  <div className={`w-10 h-10 rounded-lg flex items-center justify-center text-lg font-bold ${
                    isCompleted
                      ? passed ? 'bg-green-500 text-white' : 'bg-red-500 text-white'
                      : isNext
                        ? 'bg-green-500 text-white'
                        : 'bg-gray-200 text-gray-500'
                  }`}>
                    {test.testNumber}
                  </div>
                  
                  {isCompleted ? (
                    <div className={`px-2 py-1 rounded text-xs font-medium ${
                      passed ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
                    }`}>
                      {passed ? 'PASSED' : 'FAILED'}
                    </div>
                  ) : isLocked ? (
                    <svg className="w-5 h-5 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                    </svg>
                  ) : null}
                </div>
                
                {/* Test Info */}
                <h3 className="font-semibold text-gray-800 mb-1">
                  Week {test.testNumber} Test
                </h3>
                <p className="text-sm text-gray-500 mb-3">
                  {test.questions.length} Questions • {test.duration / 60} min
                </p>
                
                {/* Score or Action */}
                {isCompleted ? (
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-gray-600">Score</span>
                      <span className={`font-bold ${passed ? 'text-green-600' : 'text-red-600'}`}>
                        {score.toFixed(0)}%
                      </span>
                    </div>
                    <button
                      onClick={() => onViewResults(test.testNumber)}
                      className="w-full py-2 px-4 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg text-sm font-medium transition-colors"
                    >
                      View Results
                    </button>
                  </div>
                ) : isNext && isWithinWindow ? (
                  <button
                    onClick={() => onStartTest(test)}
                    className="w-full py-2 px-4 bg-green-500 hover:bg-green-600 text-white rounded-lg font-medium transition-colors flex items-center justify-center gap-2"
                  >
                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    Start Test
                  </button>
                ) : isNext ? (
                  <div className="text-center py-2 text-amber-600 text-sm">
                    Available Tuesday 8-10 AM
                  </div>
                ) : (
                  <div className="text-center py-2 text-gray-400 text-sm">
                    Complete previous test first
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
      
      {/* Test Instructions */}
      <div className="bg-blue-50 border border-blue-200 rounded-xl p-6">
        <h3 className="text-lg font-semibold text-blue-800 mb-3 flex items-center gap-2">
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          Test Instructions
        </h3>
        <ul className="space-y-2 text-blue-700 text-sm">
          <li className="flex items-start gap-2">
            <span className="text-blue-400 mt-0.5">•</span>
            Each test contains <strong>25 clinical scenario-based MCQs</strong> with options A-E
          </li>
          <li className="flex items-start gap-2">
            <span className="text-blue-400 mt-0.5">•</span>
            Select the <strong>single best answer</strong> for each question
          </li>
          <li className="flex items-start gap-2">
            <span className="text-blue-400 mt-0.5">•</span>
            Each question carries <strong>4 marks</strong> (Total: 100 marks)
          </li>
          <li className="flex items-start gap-2">
            <span className="text-blue-400 mt-0.5">•</span>
            You have <strong>10 minutes</strong> to complete the test
          </li>
          <li className="flex items-start gap-2">
            <span className="text-blue-400 mt-0.5">•</span>
            Tests are available <strong>every Tuesday between 8-10 AM</strong>
          </li>
          <li className="flex items-start gap-2">
            <span className="text-blue-400 mt-0.5">•</span>
            <strong>Anti-cheating measures</strong> are in place - tab switching is monitored
          </li>
          <li className="flex items-start gap-2">
            <span className="text-blue-400 mt-0.5">•</span>
            Tests can be taken <strong>offline</strong> - results sync when online
          </li>
        </ul>
      </div>
    </div>
  );
};

export default CBTTestSelection;
