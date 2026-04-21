/**
 * CBT Exam Interface Component
 * Main test-taking interface with timer, anti-cheat measures, and question navigation
 */

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { CBTTest, CBTAttempt, CBTQuestion, cbtService } from '../../services/cbtService';

interface CBTExamInterfaceProps {
  test: CBTTest;
  attempt: CBTAttempt;
  onSubmit: (test: CBTTest, attempt: CBTAttempt) => void;
  onExit: () => void;
}

const CBTExamInterface: React.FC<CBTExamInterfaceProps> = ({ test, attempt, onSubmit, onExit }) => {
  const [currentQuestion, setCurrentQuestion] = useState(0);
  const [answers, setAnswers] = useState<{ [key: string]: 'A' | 'B' | 'C' | 'D' | 'E' | null }>(attempt.answers);
  const [flaggedQuestions, setFlaggedQuestions] = useState<Set<string>>(new Set(attempt.flaggedForReview));
  const [timeRemaining, setTimeRemaining] = useState(test.duration);
  const [showWarning, setShowWarning] = useState(false);
  const [warningMessage, setWarningMessage] = useState('');
  const [tabSwitchCount, setTabSwitchCount] = useState(attempt.tabSwitchCount);
  const [showSubmitConfirm, setShowSubmitConfirm] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [attentionWarnings, setAttentionWarnings] = useState(0);
  const [showAttentionAlert, setShowAttentionAlert] = useState(false);
  const examRef = useRef<HTMLDivElement>(null);
  const lastInteractionRef = useRef<number>(Date.now());
  
  // ========== ADVANCED ANTI-CHEATING MEASURES ==========
  
  // Anti-cheat: Prevent screenshots via PrintScreen key
  useEffect(() => {
    const handleKeyUp = (e: KeyboardEvent) => {
      if (e.key === 'PrintScreen') {
        // Clear clipboard
        navigator.clipboard?.writeText('Screenshots are disabled during examination').catch(() => {});
        setWarningMessage('⚠️ SCREENSHOT ATTEMPT DETECTED! Screenshots are prohibited during the examination. This has been logged.');
        setShowWarning(true);
        setTabSwitchCount(prev => {
          const newCount = prev + 1;
          cbtService.recordTabSwitch(attempt.id);
          return newCount;
        });
      }
    };
    
    document.addEventListener('keyup', handleKeyUp);
    return () => document.removeEventListener('keyup', handleKeyUp);
  }, [attempt.id]);
  
  // Anti-cheat: Block Windows screenshot shortcuts (Win+Shift+S, Win+PrtSc)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Block Win+Shift+S (Snipping Tool)
      if (e.metaKey && e.shiftKey && e.key === 'S') {
        e.preventDefault();
        setWarningMessage('⚠️ Screen capture tool blocked! Do not attempt to capture the screen during examination.');
        setShowWarning(true);
      }
      // Block Ctrl+PrtSc
      if (e.ctrlKey && e.key === 'PrintScreen') {
        e.preventDefault();
        navigator.clipboard?.writeText('').catch(() => {});
      }
    };
    
    document.addEventListener('keydown', handleKeyDown, true);
    return () => document.removeEventListener('keydown', handleKeyDown, true);
  }, []);
  
  // Anti-cheat: Detect screen recording/capture APIs
  useEffect(() => {
    // Detect if getDisplayMedia is being called (screen recording)
    const originalGetDisplayMedia = navigator.mediaDevices?.getDisplayMedia;
    if (navigator.mediaDevices && originalGetDisplayMedia) {
      navigator.mediaDevices.getDisplayMedia = async function() {
        setWarningMessage('⚠️ SCREEN RECORDING ATTEMPT BLOCKED! This activity has been logged and may result in test invalidation.');
        setShowWarning(true);
        throw new Error('Screen recording is disabled during examination');
      };
      
      return () => {
        if (navigator.mediaDevices) {
          navigator.mediaDevices.getDisplayMedia = originalGetDisplayMedia;
        }
      };
    }
  }, []);
  
  // Anti-cheat: CSS-based screenshot and photo prevention
  useEffect(() => {
    // Add anti-screenshot CSS styles
    const style = document.createElement('style');
    style.id = 'cbt-anti-cheat-styles';
    style.textContent = `
      /* Make screen captures show a black/warning overlay */
      @media print {
        body * { display: none !important; }
        body::after {
          content: "EXAMINATION CONTENT - PRINTING PROHIBITED";
          display: block !important;
          font-size: 48px;
          color: red;
          text-align: center;
          padding: 200px 20px;
        }
      }
      
      /* Add a subtle dynamic watermark pattern that's hard to photograph */
      .cbt-exam-watermark {
        position: fixed;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        pointer-events: none;
        z-index: 9999;
        opacity: 0.04;
        background-image: repeating-linear-gradient(
          45deg,
          transparent,
          transparent 100px,
          rgba(0,0,0,0.1) 100px,
          rgba(0,0,0,0.1) 101px
        );
        animation: cbt-watermark-shift 3s linear infinite;
      }
      
      @keyframes cbt-watermark-shift {
        0% { transform: translateX(0) translateY(0); }
        100% { transform: translateX(10px) translateY(10px); }
      }
      
      /* Moire pattern that interferes with phone camera captures */
      .cbt-moire-overlay {
        position: fixed;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        pointer-events: none;
        z-index: 9998;
        opacity: 0.015;
        background: repeating-linear-gradient(
          0deg,
          #000 0px,
          transparent 1px,
          transparent 3px
        );
      }
    `;
    document.head.appendChild(style);
    
    return () => {
      const existingStyle = document.getElementById('cbt-anti-cheat-styles');
      if (existingStyle) existingStyle.remove();
    };
  }, []);
  
  // Anti-cheat: Monitor user attention (inactivity detection)
  useEffect(() => {
    const INACTIVITY_THRESHOLD = 30000; // 30 seconds of no interaction
    
    const updateInteraction = () => {
      lastInteractionRef.current = Date.now();
      if (showAttentionAlert) setShowAttentionAlert(false);
    };
    
    const checkInactivity = setInterval(() => {
      const elapsed = Date.now() - lastInteractionRef.current;
      if (elapsed > INACTIVITY_THRESHOLD) {
        setAttentionWarnings(prev => prev + 1);
        setShowAttentionAlert(true);
        setWarningMessage('⚠️ ATTENTION CHECK: No activity detected. Please focus on your examination. Extended inactivity may be flagged as suspicious.');
        setShowWarning(true);
        lastInteractionRef.current = Date.now(); // Reset to avoid spam
      }
    }, 5000);
    
    // Track mouse/touch/keyboard interactions
    document.addEventListener('mousemove', updateInteraction);
    document.addEventListener('mousedown', updateInteraction);
    document.addEventListener('touchstart', updateInteraction);
    document.addEventListener('keydown', updateInteraction);
    document.addEventListener('scroll', updateInteraction);
    
    return () => {
      clearInterval(checkInactivity);
      document.removeEventListener('mousemove', updateInteraction);
      document.removeEventListener('mousedown', updateInteraction);
      document.removeEventListener('touchstart', updateInteraction);
      document.removeEventListener('keydown', updateInteraction);
      document.removeEventListener('scroll', updateInteraction);
    };
  }, [showAttentionAlert]);
  
  // Anti-cheat: Detect window resize (possible screen sharing)
  useEffect(() => {
    let lastWidth = window.innerWidth;
    let lastHeight = window.innerHeight;
    
    const handleResize = () => {
      const widthDiff = Math.abs(window.innerWidth - lastWidth);
      const heightDiff = Math.abs(window.innerHeight - lastHeight);
      
      // Significant resize may indicate screen sharing or dev tools
      if (widthDiff > 200 || heightDiff > 200) {
        setWarningMessage('⚠️ Significant window resize detected. Please maintain fullscreen mode during the examination.');
        setShowWarning(true);
      }
      
      lastWidth = window.innerWidth;
      lastHeight = window.innerHeight;
    };
    
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);
  
  // Anti-cheat: Prevent drag/drop of content from exam
  useEffect(() => {
    const handleDrag = (e: DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
    };
    
    document.addEventListener('dragstart', handleDrag, true);
    document.addEventListener('drop', handleDrag, true);
    
    return () => {
      document.removeEventListener('dragstart', handleDrag, true);
      document.removeEventListener('drop', handleDrag, true);
    };
  }, []);
  
  // ========== END ANTI-CHEATING MEASURES ==========
  
  // Timer effect
  useEffect(() => {
    const timer = setInterval(() => {
      setTimeRemaining(prev => {
        if (prev <= 1) {
          clearInterval(timer);
          handleAutoSubmit();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    
    return () => clearInterval(timer);
  }, []);
  
  // Anti-cheat: Detect tab/window visibility changes
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.hidden) {
        const newCount = tabSwitchCount + 1;
        setTabSwitchCount(newCount);
        cbtService.recordTabSwitch(attempt.id);
        
        if (newCount >= 3) {
          setWarningMessage('⚠️ CRITICAL: Multiple tab switches detected! Your test may be flagged for review.');
        } else if (newCount >= 2) {
          setWarningMessage(`⚠️ WARNING: Tab switch detected (${newCount}/3). Further switches may result in test termination.`);
        } else {
          setWarningMessage('⚠️ CAUTION: Tab switch detected. Please remain on this page during the test.');
        }
        setShowWarning(true);
      }
    };
    
    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
  }, [tabSwitchCount, attempt.id]);
  
  // Anti-cheat: Disable right-click context menu
  useEffect(() => {
    const handleContextMenu = (e: MouseEvent) => {
      e.preventDefault();
      setWarningMessage('Right-click is disabled during the examination.');
      setShowWarning(true);
    };
    
    document.addEventListener('contextmenu', handleContextMenu);
    return () => document.removeEventListener('contextmenu', handleContextMenu);
  }, []);
  
  // Anti-cheat: Disable copy/paste
  useEffect(() => {
    const handleCopy = (e: ClipboardEvent) => {
      e.preventDefault();
      setWarningMessage('Copy/Paste is disabled during the examination.');
      setShowWarning(true);
    };
    
    document.addEventListener('copy', handleCopy);
    document.addEventListener('paste', handleCopy);
    document.addEventListener('cut', handleCopy);
    
    return () => {
      document.removeEventListener('copy', handleCopy);
      document.removeEventListener('paste', handleCopy);
      document.removeEventListener('cut', handleCopy);
    };
  }, []);
  
  // Anti-cheat: Detect dev tools
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Disable F12, Ctrl+Shift+I, Ctrl+Shift+J, Ctrl+U
      if (
        e.key === 'F12' ||
        (e.ctrlKey && e.shiftKey && (e.key === 'I' || e.key === 'J')) ||
        (e.ctrlKey && e.key === 'u')
      ) {
        e.preventDefault();
        setWarningMessage('Developer tools are disabled during the examination.');
        setShowWarning(true);
      }
    };
    
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, []);
  
  // Request fullscreen on start
  useEffect(() => {
    const requestFullscreen = async () => {
      try {
        if (examRef.current && document.fullscreenEnabled) {
          await examRef.current.requestFullscreen();
          setIsFullscreen(true);
        }
      } catch (error) {
        console.log('Fullscreen not available');
      }
    };
    
    requestFullscreen();
    
    const handleFullscreenChange = () => {
      setIsFullscreen(!!document.fullscreenElement);
      if (!document.fullscreenElement) {
        setWarningMessage('Fullscreen mode exited. Please stay in fullscreen during the exam.');
        setShowWarning(true);
      }
    };
    
    document.addEventListener('fullscreenchange', handleFullscreenChange);
    return () => document.removeEventListener('fullscreenchange', handleFullscreenChange);
  }, []);
  
  const handleAutoSubmit = useCallback(() => {
    const updatedAttempt = { ...attempt, answers, tabSwitchCount };
    onSubmit(test, updatedAttempt);
  }, [test, attempt, answers, tabSwitchCount, onSubmit]);
  
  const handleAnswerSelect = (questionId: string, answer: 'A' | 'B' | 'C' | 'D' | 'E') => {
    const newAnswers = { ...answers, [questionId]: answer };
    setAnswers(newAnswers);
    cbtService.updateAnswer(attempt.id, questionId, answer);
    
    // Save to localStorage for offline persistence
    localStorage.setItem(`cbt_answers_${attempt.id}`, JSON.stringify(newAnswers));
  };
  
  const handleFlagQuestion = (questionId: string) => {
    const newFlagged = new Set(flaggedQuestions);
    if (newFlagged.has(questionId)) {
      newFlagged.delete(questionId);
    } else {
      newFlagged.add(questionId);
    }
    setFlaggedQuestions(newFlagged);
  };
  
  const handleSubmit = () => {
    const unanswered = test.questions.filter(q => !answers[q.id]).length;
    if (unanswered > 0) {
      setShowSubmitConfirm(true);
    } else {
      confirmSubmit();
    }
  };
  
  const confirmSubmit = () => {
    setShowSubmitConfirm(false);
    const updatedAttempt = { 
      ...attempt, 
      answers, 
      tabSwitchCount,
      flaggedForReview: Array.from(flaggedQuestions)
    };
    onSubmit(test, updatedAttempt);
  };
  
  const formatTime = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };
  
  const getAnsweredCount = () => Object.values(answers).filter(a => a !== null).length;
  
  const question = test.questions[currentQuestion];
  const isTimeWarning = timeRemaining <= 120; // 2 minutes warning
  const isTimeCritical = timeRemaining <= 60; // 1 minute critical
  
  return (
    <div ref={examRef} className="fixed inset-0 bg-gray-100 z-50 flex flex-col" style={{ userSelect: 'none', WebkitUserSelect: 'none' }}>
      {/* Anti-screenshot watermark overlay */}
      <div className="cbt-exam-watermark" />
      {/* Anti-phone-photo moire overlay */}
      <div className="cbt-moire-overlay" />
      
      {/* Attention monitoring indicator */}
      {attentionWarnings > 0 && (
        <div className="absolute top-16 right-4 z-40 flex items-center gap-2 bg-amber-100 border border-amber-300 rounded-full px-3 py-1 text-xs text-amber-800">
          <span className="w-2 h-2 bg-amber-500 rounded-full animate-pulse" />
          Attention alerts: {attentionWarnings}
        </div>
      )}
      {/* Warning Modal */}
      {showWarning && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-start sm:items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white rounded-xl p-6 max-w-md w-full shadow-2xl my-4 sm:my-8 max-h-[calc(100vh-2rem)] overflow-y-auto">
            <div className="text-center">
              <div className="w-16 h-16 mx-auto mb-4 bg-amber-100 rounded-full flex items-center justify-center">
                <svg className="w-8 h-8 text-amber-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
              </div>
              <p className="text-gray-800 font-medium mb-4">{warningMessage}</p>
              <button
                onClick={() => setShowWarning(false)}
                className="px-6 py-2 bg-green-500 text-white rounded-lg font-medium hover:bg-green-600 transition-colors"
              >
                I Understand
              </button>
            </div>
          </div>
        </div>
      )}
      
      {/* Submit Confirmation Modal */}
      {showSubmitConfirm && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-start sm:items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white rounded-xl p-6 max-w-md w-full shadow-2xl my-4 sm:my-8 max-h-[calc(100vh-2rem)] overflow-y-auto">
            <h3 className="text-lg font-bold text-gray-800 mb-2">Submit Test?</h3>
            <p className="text-gray-600 mb-4">
              You have <strong>{test.questions.length - getAnsweredCount()}</strong> unanswered question(s).
              Are you sure you want to submit?
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => setShowSubmitConfirm(false)}
                className="flex-1 py-2 px-4 bg-gray-200 text-gray-700 rounded-lg font-medium hover:bg-gray-300 transition-colors"
              >
                Continue Test
              </button>
              <button
                onClick={confirmSubmit}
                className="flex-1 py-2 px-4 bg-green-500 text-white rounded-lg font-medium hover:bg-green-600 transition-colors"
              >
                Submit Anyway
              </button>
            </div>
          </div>
        </div>
      )}
      
      {/* Header */}
      <div className="bg-white border-b shadow-sm px-4 py-3">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-4">
            <h1 className="text-lg font-bold text-gray-800">
              {test.title}
            </h1>
            {tabSwitchCount > 0 && (
              <span className="px-2 py-1 bg-red-100 text-red-700 text-xs font-medium rounded">
                Tab switches: {tabSwitchCount}
              </span>
            )}
          </div>
          
          <div className="flex items-center gap-4">
            {/* Timer */}
            <div className={`flex items-center gap-2 px-4 py-2 rounded-lg font-mono text-lg font-bold ${
              isTimeCritical 
                ? 'bg-red-100 text-red-600 animate-pulse' 
                : isTimeWarning 
                  ? 'bg-amber-100 text-amber-600'
                  : 'bg-gray-100 text-gray-700'
            }`}>
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              {formatTime(timeRemaining)}
            </div>
            
            {/* Progress */}
            <div className="hidden md:flex items-center gap-2 text-sm text-gray-600">
              <span className="font-medium">{getAnsweredCount()}</span>
              <span>/</span>
              <span>{test.questions.length}</span>
              <span>answered</span>
            </div>
            
            {/* Submit Button */}
            <button
              onClick={handleSubmit}
              className="px-4 py-2 bg-green-500 hover:bg-green-600 text-white rounded-lg font-medium transition-colors flex items-center gap-2"
            >
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
              Submit
            </button>
          </div>
        </div>
      </div>
      
      {/* Main Content */}
      <div className="flex-1 flex min-h-0">
        {/* Question Navigation Sidebar */}
        <div className="hidden md:block w-24 bg-white border-r overflow-y-auto p-2 flex-shrink-0">
          <div className="grid grid-cols-5 gap-1">
            {test.questions.map((q, index) => {
              const isAnswered = answers[q.id] !== null;
              const isFlagged = flaggedQuestions.has(q.id);
              const isCurrent = index === currentQuestion;
              
              return (
                <button
                  key={q.id}
                  onClick={() => setCurrentQuestion(index)}
                  className={`relative aspect-square rounded text-sm font-medium transition-all ${
                    isCurrent
                      ? 'bg-green-500 text-white ring-2 ring-green-300'
                      : isAnswered
                        ? 'bg-green-100 text-green-700 hover:bg-green-200'
                        : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                  }`}
                >
                  {index + 1}
                  {isFlagged && (
                    <span className="absolute -top-1 -right-1 w-3 h-3 bg-amber-400 rounded-full" />
                  )}
                </button>
              );
            })}
          </div>
          
          <div className="mt-4 pt-4 border-t space-y-2 text-xs">
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 bg-green-100 rounded" />
              <span className="text-gray-600">Answered</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 bg-gray-100 rounded" />
              <span className="text-gray-600">Unanswered</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 bg-amber-400 rounded-full" />
              <span className="text-gray-600">Flagged</span>
            </div>
          </div>
        </div>
        
        {/* Question Content */}
        <div className="flex-1 overflow-y-auto p-4 md:p-8 min-w-0">
          <div className="max-w-4xl mx-auto">
            {/* Mobile Question Navigator */}
            <div className="md:hidden mb-4">
              <div className="flex items-center gap-2 overflow-x-auto pb-2">
                {test.questions.map((q, index) => {
                  const isAnswered = answers[q.id] !== null;
                  const isCurrent = index === currentQuestion;
                  return (
                    <button
                      key={q.id}
                      onClick={() => setCurrentQuestion(index)}
                      className={`flex-shrink-0 w-8 h-8 rounded-full text-xs font-bold transition-all ${
                        isCurrent
                          ? 'bg-green-500 text-white ring-2 ring-green-300'
                          : isAnswered
                            ? 'bg-green-100 text-green-700'
                            : 'bg-gray-200 text-gray-600'
                      }`}
                    >
                      {index + 1}
                    </button>
                  );
                })}
              </div>
            </div>
            {/* Question Header */}
            <div className="flex items-center justify-between mb-4">
              <span className="text-sm text-gray-500">
                Question {currentQuestion + 1} of {test.questions.length} • {question.marks} marks
              </span>
              <button
                onClick={() => handleFlagQuestion(question.id)}
                className={`flex items-center gap-1 px-3 py-1 rounded-full text-sm transition-colors ${
                  flaggedQuestions.has(question.id)
                    ? 'bg-amber-100 text-amber-700'
                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }`}
              >
                <svg className="w-4 h-4" fill={flaggedQuestions.has(question.id) ? 'currentColor' : 'none'} viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 5a2 2 0 012-2h10a2 2 0 012 2v16l-7-3.5L5 21V5z" />
                </svg>
                {flaggedQuestions.has(question.id) ? 'Flagged' : 'Flag for review'}
              </button>
            </div>
            
            {/* Topic Badge */}
            <div className="mb-4">
              <span className="inline-block px-3 py-1 bg-blue-100 text-blue-700 text-sm rounded-full">
                {question.topic}
              </span>
            </div>
            
            {/* Clinical Scenario */}
            <div className="bg-blue-50 border border-blue-200 rounded-xl p-5 md:p-8 mb-6">
              <h3 className="text-sm font-semibold text-blue-800 mb-3 uppercase tracking-wide">Clinical Scenario</h3>
              <p className="text-blue-900 text-lg md:text-xl leading-relaxed whitespace-pre-wrap break-words">{question.clinicalScenario}</p>
            </div>
            
            {/* Question */}
            <div className="mb-8 bg-gray-50 border border-gray-200 rounded-xl p-5 md:p-8">
              <h3 className="text-sm font-semibold text-gray-500 mb-3 uppercase tracking-wide">Question</h3>
              <p className="text-xl md:text-2xl font-semibold text-gray-900 leading-relaxed break-words">{question.question}</p>
            </div>
            
            {/* Options */}
            <div className="space-y-3">
              {(['A', 'B', 'C', 'D', 'E'] as const).map(option => (
                question.options[option] ? (
                <button
                  key={option}
                  onClick={() => handleAnswerSelect(question.id, option)}
                  className={`w-full text-left p-4 md:p-5 rounded-xl border-2 transition-all ${
                    answers[question.id] === option
                      ? 'border-green-500 bg-green-50 shadow-md'
                      : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50'
                  }`}
                >
                  <div className="flex items-start gap-3">
                    <span className={`flex-shrink-0 w-9 h-9 rounded-full flex items-center justify-center font-bold text-base ${
                      answers[question.id] === option
                        ? 'bg-green-500 text-white'
                        : 'bg-gray-200 text-gray-600'
                    }`}>
                      {option}
                    </span>
                    <span className={`flex-1 text-base md:text-lg leading-relaxed break-words ${answers[question.id] === option ? 'text-green-900 font-medium' : 'text-gray-700'}`}>
                      {question.options[option]}
                    </span>
                  </div>
                </button>
                ) : null
              ))}
            </div>
            
            {/* Navigation */}
            <div className="flex items-center justify-between mt-8 pt-6 border-t">
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
              
              <span className="text-gray-500">
                {currentQuestion + 1} / {test.questions.length}
              </span>
              
              {currentQuestion < test.questions.length - 1 ? (
                <button
                  onClick={() => setCurrentQuestion(prev => Math.min(test.questions.length - 1, prev + 1))}
                  className="flex items-center gap-2 px-4 py-2 bg-green-500 text-white rounded-lg font-medium hover:bg-green-600 transition-colors"
                >
                  Next
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                  </svg>
                </button>
              ) : (
                <button
                  onClick={handleSubmit}
                  className="flex items-center gap-2 px-4 py-2 bg-blue-500 text-white rounded-lg font-medium hover:bg-blue-600 transition-colors"
                >
                  Review & Submit
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                </button>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default CBTExamInterface;
