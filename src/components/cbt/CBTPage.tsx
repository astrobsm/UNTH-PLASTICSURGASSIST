/**
 * CBT Page Component
 * Container component for the Computer-Based Testing system
 */

import React, { useState, useEffect } from 'react';
import { TrainingLevel } from '../../services/medicalTrainingService';
import { CBTTest, CBTAttempt, cbtService } from '../../services/cbtService';
import CBTTestSelection from './CBTTestSelection';
import CBTExamInterface from './CBTExamInterface';
import CBTResults from './CBTResults';

interface CBTPageProps {
  level: TrainingLevel;
  onBack: () => void;
}

type CBTView = 'selection' | 'exam' | 'results';

const CBTPage: React.FC<CBTPageProps> = ({ level, onBack }) => {
  const [currentView, setCurrentView] = useState<CBTView>('selection');
  const [currentTest, setCurrentTest] = useState<CBTTest | null>(null);
  const [currentAttempt, setCurrentAttempt] = useState<CBTAttempt | null>(null);
  const [completedAttempt, setCompletedAttempt] = useState<CBTAttempt | null>(null);
  const [showPreExamModal, setShowPreExamModal] = useState(false);
  
  // Check for test in progress on mount
  useEffect(() => {
    const inProgress = cbtService.getCurrentTest();
    if (inProgress && inProgress.test.level === level) {
      setCurrentTest(inProgress.test);
      setCurrentAttempt(inProgress.attempt);
      setCurrentView('exam');
    }
  }, [level]);
  
  const handleStartTest = (test: CBTTest) => {
    setCurrentTest(test);
    setShowPreExamModal(true);
  };
  
  const confirmStartTest = () => {
    if (currentTest) {
      const userId = localStorage.getItem('userId') || `user-${Date.now()}`;
      const attempt = cbtService.startTest(currentTest, userId);
      setCurrentAttempt(attempt);
      setShowPreExamModal(false);
      setCurrentView('exam');
    }
  };
  
  const handleSubmitTest = (test: CBTTest, attempt: CBTAttempt) => {
    const completedAttempt = cbtService.submitTest(test, attempt);
    setCompletedAttempt(completedAttempt);
    setCurrentView('results');
  };
  
  const handleViewResults = (testNumber: number) => {
    const attempts = cbtService.getAttemptsForLevel(level);
    const attempt = attempts.find(a => a.testNumber === testNumber && a.completed);
    
    if (attempt) {
      const tests = cbtService.generateTestsForLevel(level);
      const test = tests.find(t => t.testNumber === testNumber);
      
      if (test) {
        setCurrentTest(test);
        setCompletedAttempt(attempt);
        setCurrentView('results');
      }
    }
  };
  
  const handleReturnToTests = () => {
    setCurrentTest(null);
    setCurrentAttempt(null);
    setCompletedAttempt(null);
    setCurrentView('selection');
  };
  
  const handleExitExam = () => {
    cbtService.clearCurrentTest();
    handleReturnToTests();
  };
  
  // Pre-exam confirmation modal
  if (showPreExamModal && currentTest) {
    return (
      <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl max-w-lg w-full shadow-2xl overflow-hidden">
          {/* Header */}
          <div className="bg-gradient-to-r from-green-500 to-green-600 p-6 text-white">
            <h2 className="text-2xl font-bold">Ready to Start?</h2>
            <p className="opacity-90 mt-1">{currentTest.title}</p>
          </div>
          
          {/* Content */}
          <div className="p-6">
            <h3 className="font-semibold text-gray-800 mb-4">Before You Begin:</h3>
            
            <ul className="space-y-3 mb-6">
              <li className="flex items-start gap-3">
                <div className="w-6 h-6 bg-blue-100 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5">
                  <span className="text-blue-600 text-sm font-bold">1</span>
                </div>
                <div>
                  <p className="text-gray-800 font-medium">Test Format</p>
                  <p className="text-gray-600 text-sm">25 clinical scenario-based MCQs with 5 options each</p>
                </div>
              </li>
              <li className="flex items-start gap-3">
                <div className="w-6 h-6 bg-blue-100 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5">
                  <span className="text-blue-600 text-sm font-bold">2</span>
                </div>
                <div>
                  <p className="text-gray-800 font-medium">Time Limit</p>
                  <p className="text-gray-600 text-sm">10 minutes. Test auto-submits when time runs out.</p>
                </div>
              </li>
              <li className="flex items-start gap-3">
                <div className="w-6 h-6 bg-blue-100 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5">
                  <span className="text-blue-600 text-sm font-bold">3</span>
                </div>
                <div>
                  <p className="text-gray-800 font-medium">Scoring</p>
                  <p className="text-gray-600 text-sm">Each question = 4 marks. Pass mark = 50%</p>
                </div>
              </li>
              <li className="flex items-start gap-3">
                <div className="w-6 h-6 bg-amber-100 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5">
                  <span className="text-amber-600 text-sm font-bold">!</span>
                </div>
                <div>
                  <p className="text-gray-800 font-medium">Anti-Cheating Measures</p>
                  <p className="text-gray-600 text-sm">Tab switching is monitored. Stay on this page during the test.</p>
                </div>
              </li>
              <li className="flex items-start gap-3">
                <div className="w-6 h-6 bg-green-100 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5">
                  <span className="text-green-600 text-sm font-bold">✓</span>
                </div>
                <div>
                  <p className="text-gray-800 font-medium">Offline Support</p>
                  <p className="text-gray-600 text-sm">Test works offline. Results sync when online.</p>
                </div>
              </li>
            </ul>
            
            {/* Environment Check */}
            <div className="bg-gray-50 rounded-xl p-4 mb-6">
              <h4 className="font-medium text-gray-800 mb-2">Recommended:</h4>
              <ul className="text-sm text-gray-600 space-y-1">
                <li>• Close all other browser tabs</li>
                <li>• Ensure stable internet connection (for sync)</li>
                <li>• Find a quiet environment</li>
                <li>• Have a pen and paper ready for calculations</li>
              </ul>
            </div>
            
            {/* Actions */}
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
                Start Test
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }
  
  // Exam view
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
  
  // Results view
  if (currentView === 'results' && currentTest && completedAttempt) {
    return (
      <CBTResults
        test={currentTest}
        attempt={completedAttempt}
        onReturnToTests={handleReturnToTests}
      />
    );
  }
  
  // Selection view (default)
  return (
    <div className="min-h-screen bg-gray-50 p-4 md:p-8">
      {/* Header */}
      <div className="max-w-7xl mx-auto mb-6">
        <button
          onClick={onBack}
          className="flex items-center gap-2 text-gray-600 hover:text-gray-800 transition-colors mb-4"
        >
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
          Back to Training
        </button>
        
        <h1 className="text-3xl font-bold text-gray-800">Computer-Based Tests</h1>
        <p className="text-gray-600 mt-1">
          Weekly MCQ examinations for {cbtService.getLevelDisplayName(level)}s
        </p>
      </div>
      
      {/* Test Selection */}
      <div className="max-w-7xl mx-auto">
        <CBTTestSelection
          level={level}
          onStartTest={handleStartTest}
          onViewResults={handleViewResults}
        />
      </div>
    </div>
  );
};

export default CBTPage;
