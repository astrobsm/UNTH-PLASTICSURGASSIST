/**
 * CBT Results Component
 * Displays test score with correct answers and explanations
 */

import React, { useState } from 'react';
import { CBTTest, CBTAttempt, cbtService } from '../../services/cbtService';

interface CBTResultsProps {
  test: CBTTest;
  attempt: CBTAttempt;
  onReturnToTests: () => void;
}

const CBTResults: React.FC<CBTResultsProps> = ({ test, attempt, onReturnToTests }) => {
  const [showReview, setShowReview] = useState(false);
  const [currentQuestion, setCurrentQuestion] = useState(0);
  const [filterMode, setFilterMode] = useState<'all' | 'correct' | 'incorrect'>('all');
  
  const correctAnswers = test.questions.filter(q => attempt.answers[q.id] === q.correctAnswer).length;
  const incorrectAnswers = test.questions.length - correctAnswers;
  const percentage = attempt.percentage;
  const passed = attempt.passed;
  
  const filteredQuestions = test.questions.filter(q => {
    const isCorrect = attempt.answers[q.id] === q.correctAnswer;
    if (filterMode === 'correct') return isCorrect;
    if (filterMode === 'incorrect') return !isCorrect;
    return true;
  });
  
  const getGrade = (percentage: number): { grade: string; color: string; bgColor: string } => {
    if (percentage >= 90) return { grade: 'A+', color: 'text-green-600', bgColor: 'bg-green-100' };
    if (percentage >= 80) return { grade: 'A', color: 'text-green-600', bgColor: 'bg-green-100' };
    if (percentage >= 70) return { grade: 'B', color: 'text-blue-600', bgColor: 'bg-blue-100' };
    if (percentage >= 60) return { grade: 'C', color: 'text-amber-600', bgColor: 'bg-amber-100' };
    if (percentage >= 50) return { grade: 'D', color: 'text-orange-600', bgColor: 'bg-orange-100' };
    return { grade: 'F', color: 'text-red-600', bgColor: 'bg-red-100' };
  };
  
  const { grade, color, bgColor } = getGrade(percentage);
  
  if (showReview && filteredQuestions.length > 0) {
    const question = filteredQuestions[currentQuestion];
    const userAnswer = attempt.answers[question.id];
    const isCorrect = userAnswer === question.correctAnswer;
    
    return (
      <div className="min-h-screen bg-gray-50 p-4 md:p-8">
        <div className="max-w-4xl mx-auto">
          {/* Header */}
          <div className="flex items-center justify-between mb-6">
            <button
              onClick={() => setShowReview(false)}
              className="flex items-center gap-2 text-gray-600 hover:text-gray-800 transition-colors"
            >
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
              Back to Summary
            </button>
            
            {/* Filter */}
            <div className="flex items-center gap-2">
              <button
                onClick={() => { setFilterMode('all'); setCurrentQuestion(0); }}
                className={`px-3 py-1 rounded-full text-sm font-medium transition-colors ${
                  filterMode === 'all' ? 'bg-gray-800 text-white' : 'bg-gray-200 text-gray-600 hover:bg-gray-300'
                }`}
              >
                All ({test.questions.length})
              </button>
              <button
                onClick={() => { setFilterMode('correct'); setCurrentQuestion(0); }}
                className={`px-3 py-1 rounded-full text-sm font-medium transition-colors ${
                  filterMode === 'correct' ? 'bg-green-600 text-white' : 'bg-green-100 text-green-700 hover:bg-green-200'
                }`}
              >
                Correct ({correctAnswers})
              </button>
              <button
                onClick={() => { setFilterMode('incorrect'); setCurrentQuestion(0); }}
                className={`px-3 py-1 rounded-full text-sm font-medium transition-colors ${
                  filterMode === 'incorrect' ? 'bg-red-600 text-white' : 'bg-red-100 text-red-700 hover:bg-red-200'
                }`}
              >
                Incorrect ({incorrectAnswers})
              </button>
            </div>
          </div>
          
          {/* Question Review Card */}
          <div className="bg-white rounded-2xl shadow-lg overflow-hidden">
            {/* Question Header */}
            <div className={`p-4 ${isCorrect ? 'bg-green-500' : 'bg-red-500'} text-white`}>
              <div className="flex items-center justify-between">
                <span className="font-medium">
                  Question {currentQuestion + 1} of {filteredQuestions.length}
                </span>
                <span className={`px-3 py-1 rounded-full text-sm font-bold ${
                  isCorrect ? 'bg-green-400' : 'bg-red-400'
                }`}>
                  {isCorrect ? '✓ CORRECT' : '✗ INCORRECT'}
                </span>
              </div>
            </div>
            
            <div className="p-6">
              {/* Topic */}
              <div className="mb-4">
                <span className="inline-block px-3 py-1 bg-blue-100 text-blue-700 text-sm rounded-full">
                  {question.topic}
                </span>
              </div>
              
              {/* Clinical Scenario */}
              <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 mb-6">
                <h3 className="text-sm font-medium text-blue-800 mb-2">Clinical Scenario</h3>
                <p className="text-blue-900">{question.clinicalScenario}</p>
              </div>
              
              {/* Question */}
              <div className="mb-6">
                <p className="text-lg font-medium text-gray-800">{question.question}</p>
              </div>
              
              {/* Options with Answers */}
              <div className="space-y-3 mb-6">
                {(['A', 'B', 'C', 'D', 'E'] as const).map(option => {
                  const isUserAnswer = userAnswer === option;
                  const isCorrectAnswer = question.correctAnswer === option;
                  
                  let optionStyle = 'border-gray-200 bg-white';
                  let circleStyle = 'bg-gray-200 text-gray-600';
                  
                  if (isCorrectAnswer) {
                    optionStyle = 'border-green-500 bg-green-50';
                    circleStyle = 'bg-green-500 text-white';
                  } else if (isUserAnswer && !isCorrect) {
                    optionStyle = 'border-red-500 bg-red-50';
                    circleStyle = 'bg-red-500 text-white';
                  }
                  
                  return (
                    <div
                      key={option}
                      className={`p-4 rounded-xl border-2 ${optionStyle}`}
                    >
                      <div className="flex items-start gap-3">
                        <span className={`flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center font-bold text-sm ${circleStyle}`}>
                          {option}
                        </span>
                        <span className="flex-1 text-gray-700">
                          {question.options[option]}
                        </span>
                        <div className="flex-shrink-0">
                          {isCorrectAnswer && (
                            <svg className="w-6 h-6 text-green-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                            </svg>
                          )}
                          {isUserAnswer && !isCorrectAnswer && (
                            <svg className="w-6 h-6 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                            </svg>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
              
              {/* Explanation */}
              <div className={`p-4 rounded-xl ${isCorrect ? 'bg-green-50 border border-green-200' : 'bg-amber-50 border border-amber-200'}`}>
                <h4 className={`font-medium mb-2 ${isCorrect ? 'text-green-800' : 'text-amber-800'}`}>
                  Explanation
                </h4>
                <p className={isCorrect ? 'text-green-700' : 'text-amber-700'}>
                  {question.explanation}
                </p>
              </div>
            </div>
            
            {/* Navigation */}
            <div className="px-6 py-4 border-t flex items-center justify-between">
              <button
                onClick={() => setCurrentQuestion(prev => Math.max(0, prev - 1))}
                disabled={currentQuestion === 0}
                className={`flex items-center gap-2 px-4 py-2 rounded-lg font-medium transition-colors ${
                  currentQuestion === 0
                    ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                    : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                }`}
              >
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                </svg>
                Previous
              </button>
              
              <button
                onClick={() => setCurrentQuestion(prev => Math.min(filteredQuestions.length - 1, prev + 1))}
                disabled={currentQuestion >= filteredQuestions.length - 1}
                className={`flex items-center gap-2 px-4 py-2 rounded-lg font-medium transition-colors ${
                  currentQuestion >= filteredQuestions.length - 1
                    ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                    : 'bg-green-500 text-white hover:bg-green-600'
                }`}
              >
                Next
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }
  
  return (
    <div className="min-h-screen bg-gray-50 p-4 md:p-8">
      <div className="max-w-3xl mx-auto">
        {/* Results Card */}
        <div className="bg-white rounded-2xl shadow-lg overflow-hidden">
          {/* Header */}
          <div className={`p-8 text-center ${passed ? 'bg-gradient-to-r from-green-500 to-green-600' : 'bg-gradient-to-r from-red-500 to-red-600'} text-white`}>
            <div className="mb-4">
              {passed ? (
                <div className="w-20 h-20 mx-auto bg-white/20 rounded-full flex items-center justify-center">
                  <svg className="w-12 h-12 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </div>
              ) : (
                <div className="w-20 h-20 mx-auto bg-white/20 rounded-full flex items-center justify-center">
                  <svg className="w-12 h-12 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </div>
              )}
            </div>
            
            <h1 className="text-3xl font-bold mb-2">
              {passed ? 'Congratulations!' : 'Keep Trying!'}
            </h1>
            <p className="text-white/90">
              {passed 
                ? 'You have successfully passed this test.' 
                : 'You did not meet the passing score. Review the material and try again.'
              }
            </p>
          </div>
          
          {/* Score Display */}
          <div className="p-8 -mt-8">
            <div className="bg-white rounded-xl shadow-lg p-6 border">
              <div className="grid grid-cols-3 gap-4 text-center">
                {/* Score */}
                <div>
                  <div className={`text-4xl font-bold ${color}`}>
                    {attempt.score}
                  </div>
                  <div className="text-sm text-gray-500 mt-1">
                    of {attempt.totalMarks} marks
                  </div>
                </div>
                
                {/* Percentage */}
                <div>
                  <div className={`text-4xl font-bold ${color}`}>
                    {percentage.toFixed(0)}%
                  </div>
                  <div className="text-sm text-gray-500 mt-1">
                    Percentage
                  </div>
                </div>
                
                {/* Grade */}
                <div>
                  <div className={`text-4xl font-bold ${color}`}>
                    {grade}
                  </div>
                  <div className="text-sm text-gray-500 mt-1">
                    Grade
                  </div>
                </div>
              </div>
            </div>
          </div>
          
          {/* Statistics */}
          <div className="px-8 pb-6">
            <div className="grid grid-cols-2 gap-4">
              <div className="bg-green-50 rounded-xl p-4 border border-green-200">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-green-100 rounded-full flex items-center justify-center">
                    <svg className="w-6 h-6 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                  </div>
                  <div>
                    <div className="text-2xl font-bold text-green-600">{correctAnswers}</div>
                    <div className="text-sm text-green-700">Correct</div>
                  </div>
                </div>
              </div>
              
              <div className="bg-red-50 rounded-xl p-4 border border-red-200">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-red-100 rounded-full flex items-center justify-center">
                    <svg className="w-6 h-6 text-red-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </div>
                  <div>
                    <div className="text-2xl font-bold text-red-600">{incorrectAnswers}</div>
                    <div className="text-sm text-red-700">Incorrect</div>
                  </div>
                </div>
              </div>
            </div>
            
            {/* Time Stats */}
            <div className="mt-4 bg-gray-50 rounded-xl p-4 border border-gray-200">
              <div className="grid grid-cols-2 gap-4 text-center">
                <div>
                  <div className="text-sm text-gray-500">Test Duration</div>
                  <div className="font-semibold text-gray-800">10 minutes</div>
                </div>
                <div>
                  <div className="text-sm text-gray-500">Pass Mark</div>
                  <div className="font-semibold text-gray-800">50%</div>
                </div>
              </div>
            </div>
            
            {/* Suspicious Activity Warning */}
            {attempt.suspiciousActivity && (
              <div className="mt-4 bg-amber-50 border border-amber-200 rounded-xl p-4">
                <div className="flex items-start gap-3">
                  <svg className="w-6 h-6 text-amber-600 flex-shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                  </svg>
                  <div>
                    <h4 className="font-medium text-amber-800">Activity Notice</h4>
                    <p className="text-sm text-amber-700 mt-1">
                      This test was flagged for review due to {attempt.tabSwitchCount} tab switch(es) detected during the examination.
                    </p>
                  </div>
                </div>
              </div>
            )}
          </div>
          
          {/* Action Buttons */}
          <div className="px-8 pb-8 space-y-3">
            <button
              onClick={() => setShowReview(true)}
              className="w-full py-3 px-4 bg-blue-500 hover:bg-blue-600 text-white rounded-xl font-medium transition-colors flex items-center justify-center gap-2"
            >
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
              Review Answers & Explanations
            </button>
            
            <button
              onClick={onReturnToTests}
              className="w-full py-3 px-4 bg-gray-200 hover:bg-gray-300 text-gray-700 rounded-xl font-medium transition-colors flex items-center justify-center gap-2"
            >
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 17l-5-5m0 0l5-5m-5 5h12" />
              </svg>
              Return to Tests
            </button>
          </div>
        </div>
        
        {/* Performance Tips */}
        <div className="mt-6 bg-blue-50 border border-blue-200 rounded-xl p-6">
          <h3 className="font-semibold text-blue-800 mb-3 flex items-center gap-2">
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
            </svg>
            Study Tips
          </h3>
          <ul className="space-y-2 text-blue-700 text-sm">
            {incorrectAnswers > 0 && (
              <li className="flex items-start gap-2">
                <span className="text-blue-400 mt-0.5">•</span>
                Review the {incorrectAnswers} question(s) you got wrong and understand the correct answers
              </li>
            )}
            <li className="flex items-start gap-2">
              <span className="text-blue-400 mt-0.5">•</span>
              Revisit the CME topics related to questions you found challenging
            </li>
            <li className="flex items-start gap-2">
              <span className="text-blue-400 mt-0.5">•</span>
              Practice clinical reasoning with the self-assessment questions in each module
            </li>
            <li className="flex items-start gap-2">
              <span className="text-blue-400 mt-0.5">•</span>
              Focus on key points and exam tips highlighted in the learning materials
            </li>
          </ul>
        </div>
      </div>
    </div>
  );
};

export default CBTResults;
