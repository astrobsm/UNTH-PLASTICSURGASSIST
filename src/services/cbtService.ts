/**
 * Computer-Based Test (CBT) Service
 * Manages weekly MCQ examinations for medical training
 */

import { TrainingLevel, CMEModule, HOUSE_OFFICER_MODULES, JUNIOR_RESIDENT_MODULES, SENIOR_RESIDENT_MODULES } from './medicalTrainingService';
import { db } from '../db/database';
import { syncService } from '../db/syncService';

export interface CBTQuestion {
  id: string;
  questionNumber: number;
  clinicalScenario: string;
  question: string;
  options: {
    A: string;
    B: string;
    C: string;
    D: string;
    E: string;
  };
  correctAnswer: 'A' | 'B' | 'C' | 'D' | 'E';
  explanation: string;
  topic: string;
  marks: number;
}

export interface CBTTest {
  id: string;
  testNumber: number;
  level: TrainingLevel;
  title: string;
  questions: CBTQuestion[];
  duration: number; // in seconds (600 = 10 minutes)
  totalMarks: number;
  passMark: number;
  scheduledDay: 'Tuesday';
  scheduledTimeStart: string; // "08:00"
  scheduledTimeEnd: string; // "10:00"
}

export interface CBTAttempt {
  id: string;
  testId: string;
  level: TrainingLevel;
  testNumber: number;
  userId: string;
  startTime: string;
  endTime: string;
  answers: { [questionId: string]: 'A' | 'B' | 'C' | 'D' | 'E' | null };
  score: number;
  totalMarks: number;
  percentage: number;
  passed: boolean;
  completed: boolean;
  flaggedForReview: string[]; // question IDs
  tabSwitchCount: number;
  suspiciousActivity: boolean;
  postingCycle?: number; // Track which posting cycle this attempt belongs to
}

export interface CBTProgress {
  level: TrainingLevel;
  totalTests: number;
  completedTests: number;
  averageScore: number;
  attempts: CBTAttempt[];
  currentPostingCycle: number;
  cumulativeAverage: number; // Average across all posting cycles
  passMarkReached: boolean;
}

// Posting duration configuration (in weeks)
const POSTING_DURATION: Record<TrainingLevel, number> = {
  house_officer: 4,
  junior_resident: 12,
  senior_resident: 24,
};

const PASS_MARK_PERCENTAGE = 75; // 75% pass mark for posting sign-out

// Clinical scenario templates for generating questions
const CLINICAL_SCENARIOS = {
  house_officer: [
    "A 45-year-old man presents to the emergency department with",
    "During a ward round, you notice a patient who has",
    "You are called to assess a post-operative patient who developed",
    "A 30-year-old woman is admitted with a 2-day history of",
    "While on call, you receive a referral for a patient with",
    "A 55-year-old diabetic patient presents with",
    "During your shift, a nurse alerts you to a patient showing signs of",
    "A 60-year-old man with multiple comorbidities develops",
    "You are assessing a trauma patient who has sustained",
    "A young adult presents to casualty following",
  ],
  junior_resident: [
    "A 50-year-old man is brought to the trauma bay following a high-speed MVA. He has",
    "During emergency surgery for a perforated viscus, you encounter",
    "A burns patient with 40% TBSA presents 6 hours post-injury with",
    "In the ICU, a post-operative patient develops respiratory failure with",
    "A septic patient on vasopressors shows signs of",
    "During damage control surgery, you identify",
    "A trauma patient has persistent hemorrhagic shock despite",
    "Post-operatively, a patient develops signs and symptoms consistent with",
    "A critically ill patient's arterial blood gas shows",
    "During resuscitation of a major trauma patient, you note",
  ],
  senior_resident: [
    "A patient is referred for reconstruction following oncologic resection of",
    "During a free flap procedure, you notice the flap becoming",
    "A child presents with a complete unilateral cleft requiring",
    "Post-mastectomy, a patient desires reconstruction and has",
    "A mandibular defect following tumor resection requires",
    "You are assessing a complex flexor tendon injury in",
    "A patient presents for rhinoplasty with concerns about",
    "An abdominal wall defect with mesh infection requires",
    "A hypospadias repair has developed a complication with",
    "During microsurgical anastomosis, you encounter",
  ]
};

// Question bank generated from CME content
const generateQuestionsFromCME = (level: TrainingLevel, testNumber: number): CBTQuestion[] => {
  const modules = getModulesForLevel(level);
  const questions: CBTQuestion[] = [];
  const scenarios = CLINICAL_SCENARIOS[level];
  
  // Generate 25 questions for each test
  for (let i = 0; i < 25; i++) {
    const moduleIndex = (testNumber + i) % modules.length;
    const module = modules[moduleIndex];
    const topicIndex = i % module.topics.length;
    const topic = module.topics[topicIndex];
    const article = topic.article;
    
    // Get key points and create clinical question
    const keyPoints = article.keyPoints || [];
    const examTips = article.examTips || [];
    const clinicalPearls = article.clinicalPearls || [];
    const commonMistakes = article.commonMistakes || [];
    
    const scenarioIndex = i % scenarios.length;
    const scenario = scenarios[scenarioIndex];
    
    // Generate question from content
    const question = generateQuestionFromContent(
      i + 1,
      testNumber,
      level,
      topic.title,
      scenario,
      keyPoints,
      examTips,
      clinicalPearls,
      commonMistakes,
      article.selfAssessment || []
    );
    
    questions.push(question);
  }
  
  return questions;
};

const generateQuestionFromContent = (
  questionNumber: number,
  testNumber: number,
  level: TrainingLevel,
  topicTitle: string,
  scenarioPrefix: string,
  keyPoints: string[],
  examTips: string[],
  clinicalPearls: string[],
  commonMistakes: string[],
  selfAssessment: { question: string; options: string[]; correctAnswer: number; explanation: string }[]
): CBTQuestion => {
  // Use existing self-assessment questions when available, otherwise generate
  const seed = (testNumber * 100) + questionNumber;
  
  if (selfAssessment.length > 0) {
    const saIndex = seed % selfAssessment.length;
    const sa = selfAssessment[saIndex];
    
    // Ensure we have 5 options
    const options = [...sa.options];
    while (options.length < 5) {
      options.push("None of the above");
    }
    
    return {
      id: `cbt-${level}-${testNumber}-${questionNumber}`,
      questionNumber,
      clinicalScenario: scenarioPrefix + " the following clinical presentation:",
      question: sa.question,
      options: {
        A: options[0],
        B: options[1],
        C: options[2],
        D: options[3],
        E: options[4] || "All of the above"
      },
      correctAnswer: ['A', 'B', 'C', 'D', 'E'][sa.correctAnswer] as 'A' | 'B' | 'C' | 'D' | 'E',
      explanation: sa.explanation,
      topic: topicTitle,
      marks: 4
    };
  }
  
  // Generate from key points if no self-assessment available
  const allContent = [...keyPoints, ...examTips, ...clinicalPearls];
  const contentIndex = seed % Math.max(allContent.length, 1);
  const correctContent = allContent[contentIndex] || keyPoints[0] || "Standard management applies";
  
  // Create distractors from common mistakes
  const distractors = commonMistakes.length >= 4 
    ? commonMistakes.slice(0, 4) 
    : [
        "Immediate surgical intervention without stabilization",
        "Conservative management only",
        "Delay treatment pending further investigations",
        "Empirical broad-spectrum antibiotics alone"
      ];
  
  const correctPosition = seed % 5;
  const options: string[] = [];
  let distractorIndex = 0;
  
  for (let i = 0; i < 5; i++) {
    if (i === correctPosition) {
      options.push(correctContent);
    } else {
      options.push(distractors[distractorIndex % distractors.length]);
      distractorIndex++;
    }
  }
  
  return {
    id: `cbt-${level}-${testNumber}-${questionNumber}`,
    questionNumber,
    clinicalScenario: scenarioPrefix + " findings consistent with the topic area.",
    question: `Based on this clinical scenario regarding ${topicTitle}, what is the MOST appropriate next step in management?`,
    options: {
      A: options[0],
      B: options[1],
      C: options[2],
      D: options[3],
      E: options[4]
    },
    correctAnswer: ['A', 'B', 'C', 'D', 'E'][correctPosition] as 'A' | 'B' | 'C' | 'D' | 'E',
    explanation: `The correct answer relates to: ${correctContent}. This is a key concept from ${topicTitle}.`,
    topic: topicTitle,
    marks: 4
  };
};

const getModulesForLevel = (level: TrainingLevel): CMEModule[] => {
  switch (level) {
    case 'house_officer':
      return HOUSE_OFFICER_MODULES;
    case 'junior_resident':
      return JUNIOR_RESIDENT_MODULES;
    case 'senior_resident':
      return SENIOR_RESIDENT_MODULES;
    default:
      return [];
  }
};

const getTotalTestsForLevel = (level: TrainingLevel): number => {
  switch (level) {
    case 'house_officer':
      return 4;
    case 'junior_resident':
      return 12;
    case 'senior_resident':
      return 24;
    default:
      return 0;
  }
};

const getLevelDisplayName = (level: TrainingLevel): string => {
  switch (level) {
    case 'house_officer':
      return 'House Officer';
    case 'junior_resident':
      return 'Junior Resident';
    case 'senior_resident':
      return 'Senior Resident';
    default:
      return '';
  }
};

// Generate all tests for a level
const generateTestsForLevel = (level: TrainingLevel): CBTTest[] => {
  const totalTests = getTotalTestsForLevel(level);
  const tests: CBTTest[] = [];
  
  for (let i = 1; i <= totalTests; i++) {
    tests.push({
      id: `test-${level}-${i}`,
      testNumber: i,
      level,
      title: `${getLevelDisplayName(level)} Weekly Test ${i}`,
      questions: generateQuestionsFromCME(level, i),
      duration: 600, // 10 minutes in seconds
      totalMarks: 100, // 25 questions × 4 marks
      passMark: 75, // 75% for posting sign-out
      scheduledDay: 'Tuesday',
      scheduledTimeStart: '08:00',
      scheduledTimeEnd: '10:00'
    });
  }
  
  return tests;
};

// Check if current time is within test window
const isWithinTestWindow = (): boolean => {
  const now = new Date();
  const day = now.getDay(); // 0 = Sunday, 2 = Tuesday
  const hours = now.getHours();
  
  // For development/demo, allow anytime. In production, enforce Tuesday 8-10 AM
  const isDevelopment = true; // Set to false in production
  
  if (isDevelopment) {
    return true;
  }
  
  // Tuesday = 2, hours between 8 and 10
  return day === 2 && hours >= 8 && hours < 10;
};

// Get next test window
const getNextTestWindow = (): Date => {
  const now = new Date();
  const nextTuesday = new Date(now);
  
  // Find next Tuesday
  const daysUntilTuesday = (2 - now.getDay() + 7) % 7 || 7;
  nextTuesday.setDate(now.getDate() + daysUntilTuesday);
  nextTuesday.setHours(8, 0, 0, 0);
  
  // If it's Tuesday before 10 AM, use today
  if (now.getDay() === 2 && now.getHours() < 10) {
    nextTuesday.setDate(now.getDate());
  }
  
  return nextTuesday;
};

// Storage keys
const STORAGE_KEYS = {
  ATTEMPTS: 'cbt_attempts',
  CURRENT_TEST: 'cbt_current_test',
  PROGRESS: 'cbt_progress'
};

// API helper for server sync
const syncToServer = async (action: string, data: any): Promise<any> => {
  try {
    const token = localStorage.getItem('auth_token');
    if (!token) {
      console.warn('⚠️ No auth token, CBT progress will only be saved locally');
      return null;
    }
    
    const response = await fetch(`/api/cbt?action=${action}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify(data)
    });
    
    if (response.ok) {
      const result = await response.json();
      console.log(`✅ CBT ${action} synced to server`);
      return result;
    } else {
      console.warn(`⚠️ Failed to sync CBT ${action}:`, response.status);
      return null;
    }
  } catch (error) {
    console.warn('⚠️ CBT sync failed (offline?):', error);
    return null;
  }
};

// Fetch progress from server
const fetchFromServer = async (action: string, params: Record<string, string> = {}): Promise<any> => {
  try {
    const token = localStorage.getItem('auth_token');
    if (!token) return null;
    
    const queryString = new URLSearchParams({ action, ...params }).toString();
    const response = await fetch(`/api/cbt?${queryString}`, {
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });
    
    if (response.ok) {
      return await response.json();
    }
    return null;
  } catch (error) {
    console.warn('⚠️ Failed to fetch CBT data from server:', error);
    return null;
  }
};

// Save attempt to localStorage + IndexedDB (works offline, syncs to cloud)
const saveAttempt = (attempt: CBTAttempt): void => {
  const attempts = getAttempts();
  const existingIndex = attempts.findIndex(a => a.id === attempt.id);
  
  if (existingIndex >= 0) {
    attempts[existingIndex] = attempt;
  } else {
    attempts.push(attempt);
  }
  
  // Keep localStorage as fast synchronous cache
  localStorage.setItem(STORAGE_KEYS.ATTEMPTS, JSON.stringify(attempts));

  // Also persist to IndexedDB + sync queue for cloud persistence
  (async () => {
    try {
      const dbRecord = {
        ...attempt,
        answers: JSON.stringify(attempt.answers),
        flagged_for_review: JSON.stringify(attempt.flaggedForReview),
        updated_at: new Date().toISOString()
      };
      await (db as any).table('cbt_attempts').put(dbRecord);
      // Queue for cloud sync
      await syncService.queueAction(
        existingIndex >= 0 ? 'update' : 'create',
        'cbt_attempts',
        attempt.id as any,
        dbRecord
      );
    } catch (e) {
      console.warn('⚠️ Could not persist CBT attempt to IndexedDB:', e);
    }
  })();
};

// Get all attempts
const getAttempts = (): CBTAttempt[] => {
  const stored = localStorage.getItem(STORAGE_KEYS.ATTEMPTS);
  return stored ? JSON.parse(stored) : [];
};

// Get attempts for a specific level
const getAttemptsForLevel = (level: TrainingLevel): CBTAttempt[] => {
  return getAttempts().filter(a => a.level === level);
};

// Check if test is already completed
const isTestCompleted = (level: TrainingLevel, testNumber: number): boolean => {
  const attempts = getAttemptsForLevel(level);
  return attempts.some(a => a.testNumber === testNumber && a.completed);
};

// Get progress for a level (with posting cycle tracking)
const getProgress = (level: TrainingLevel): CBTProgress => {
  const allAttempts = getAttemptsForLevel(level).filter(a => a.completed);
  const totalTests = getTotalTestsForLevel(level);
  
  // Determine current posting cycle
  const currentCycle = getCurrentPostingCycle(level);
  
  // Current cycle attempts
  const currentCycleAttempts = allAttempts.filter(a => (a.postingCycle || 1) === currentCycle);
  const completedTests = new Set(currentCycleAttempts.map(a => a.testNumber)).size;
  const currentAverage = currentCycleAttempts.length > 0
    ? currentCycleAttempts.reduce((sum, a) => sum + a.percentage, 0) / currentCycleAttempts.length
    : 0;
  
  // Cumulative average across ALL posting cycles
  const cumulativeAverage = allAttempts.length > 0
    ? allAttempts.reduce((sum, a) => sum + a.percentage, 0) / allAttempts.length
    : 0;
  
  const passMarkReached = cumulativeAverage >= PASS_MARK_PERCENTAGE;
  
  return {
    level,
    totalTests,
    completedTests,
    averageScore: currentAverage,
    attempts: currentCycleAttempts,
    currentPostingCycle: currentCycle,
    cumulativeAverage,
    passMarkReached,
  };
};

// Calculate score
const calculateScore = (test: CBTTest, answers: { [questionId: string]: 'A' | 'B' | 'C' | 'D' | 'E' | null }): number => {
  let score = 0;
  
  test.questions.forEach(q => {
    if (answers[q.id] === q.correctAnswer) {
      score += q.marks;
    }
  });
  
  return score;
};

// Check if user has already taken a CBT this week
const hasAttemptedThisWeek = (level: TrainingLevel, userId: string): { attempted: boolean; lastAttemptDate: string | null } => {
  const attempts = getAttemptsForLevel(level).filter(a => a.completed && a.userId === userId);
  if (attempts.length === 0) return { attempted: false, lastAttemptDate: null };
  
  // Get the most recent completed attempt
  const sortedAttempts = [...attempts].sort((a, b) => 
    new Date(b.endTime).getTime() - new Date(a.endTime).getTime()
  );
  const lastAttempt = sortedAttempts[0];
  const lastAttemptDate = new Date(lastAttempt.endTime);
  
  // Calculate the start of the current week (Monday)
  const now = new Date();
  const dayOfWeek = now.getDay();
  const mondayOffset = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
  const startOfWeek = new Date(now);
  startOfWeek.setDate(now.getDate() + mondayOffset);
  startOfWeek.setHours(0, 0, 0, 0);
  
  const attempted = lastAttemptDate >= startOfWeek;
  return { 
    attempted, 
    lastAttemptDate: lastAttempt.endTime 
  };
};

// Get current posting cycle for a level
const getCurrentPostingCycle = (level: TrainingLevel): number => {
  const allAttempts = getAttemptsForLevel(level).filter(a => a.completed);
  const totalTests = getTotalTestsForLevel(level);
  
  if (allAttempts.length === 0) return 1;
  
  // Count how many full cycles have been completed
  // A cycle is complete when all tests in the level have been attempted
  const cycleAttempts: Record<number, Set<number>> = {};
  
  allAttempts.forEach(a => {
    const cycle = a.postingCycle || 1;
    if (!cycleAttempts[cycle]) cycleAttempts[cycle] = new Set();
    cycleAttempts[cycle].add(a.testNumber);
  });
  
  // Find the latest cycle
  const maxCycle = Math.max(...Object.keys(cycleAttempts).map(Number));
  
  // If the latest cycle is complete AND cumulative average < 75%, start a new cycle
  if (cycleAttempts[maxCycle] && cycleAttempts[maxCycle].size >= totalTests) {
    const allCompleted = allAttempts.filter(a => a.completed);
    const cumulativeAvg = allCompleted.reduce((sum, a) => sum + a.percentage, 0) / allCompleted.length;
    
    if (cumulativeAvg < PASS_MARK_PERCENTAGE) {
      return maxCycle + 1; // Start new cycle
    }
  }
  
  return maxCycle;
};

// Get next available test number in current cycle
const getNextTestNumber = (level: TrainingLevel): number => {
  const currentCycle = getCurrentPostingCycle(level);
  const allAttempts = getAttemptsForLevel(level).filter(a => a.completed);
  const currentCycleAttempts = allAttempts.filter(a => (a.postingCycle || 1) === currentCycle);
  const completedTestNumbers = new Set(currentCycleAttempts.map(a => a.testNumber));
  
  const totalTests = getTotalTestsForLevel(level);
  for (let i = 1; i <= totalTests; i++) {
    if (!completedTestNumbers.has(i)) return i;
  }
  
  return totalTests; // All complete
};

// Export the service
class CBTService {
  constructor() {
    // On startup, load attempts from IndexedDB into localStorage cache
    this.initFromLocalDB();
  }

  /** Load persisted attempts from IndexedDB into localStorage cache */
  private async initFromLocalDB(): Promise<void> {
    try {
      const dbAttempts: any[] = await (db as any).table('cbt_attempts').toArray();
      if (dbAttempts.length > 0) {
        const localAttempts = getAttempts();
        const localMap = new Map(localAttempts.map(a => [a.id, a]));

        for (const rec of dbAttempts) {
          if (!localMap.has(rec.id)) {
            const attempt: CBTAttempt = {
              ...rec,
              answers: typeof rec.answers === 'string' ? JSON.parse(rec.answers) : rec.answers,
              flaggedForReview: typeof rec.flagged_for_review === 'string' ? JSON.parse(rec.flagged_for_review) : (rec.flaggedForReview || []),
            };
            localAttempts.push(attempt);
          }
        }
        localStorage.setItem(STORAGE_KEYS.ATTEMPTS, JSON.stringify(localAttempts));
      }
    } catch (e) {
      console.warn('⚠️ Could not load CBT attempts from IndexedDB:', e);
    }
  }

  generateTestsForLevel = generateTestsForLevel;
  getTotalTestsForLevel = getTotalTestsForLevel;
  getLevelDisplayName = getLevelDisplayName;
  isWithinTestWindow = isWithinTestWindow;
  getNextTestWindow = getNextTestWindow;
  saveAttempt = saveAttempt;
  getAttempts = getAttempts;
  getAttemptsForLevel = getAttemptsForLevel;
  isTestCompleted = isTestCompleted;
  getProgress = getProgress;
  calculateScore = calculateScore;
  hasAttemptedThisWeek = hasAttemptedThisWeek;
  getCurrentPostingCycle = getCurrentPostingCycle;
  getNextTestNumber = getNextTestNumber;
  PASS_MARK_PERCENTAGE = PASS_MARK_PERCENTAGE;
  
  // Start a new test attempt
  startTest(test: CBTTest, userId: string): CBTAttempt {
    const currentCycle = getCurrentPostingCycle(test.level);
    const attempt: CBTAttempt = {
      id: `attempt-${test.id}-${Date.now()}`,
      testId: test.id,
      level: test.level,
      testNumber: test.testNumber,
      userId,
      startTime: new Date().toISOString(),
      endTime: '',
      answers: {},
      score: 0,
      totalMarks: test.totalMarks,
      percentage: 0,
      passed: false,
      completed: false,
      flaggedForReview: [],
      tabSwitchCount: 0,
      suspiciousActivity: false,
      postingCycle: currentCycle
    };
    
    // Initialize all answers as null
    test.questions.forEach(q => {
      attempt.answers[q.id] = null;
    });
    
    saveAttempt(attempt);
    localStorage.setItem(STORAGE_KEYS.CURRENT_TEST, JSON.stringify({ test, attempt }));
    
    // Sync to server
    syncToServer('start', {
      testId: test.id,
      level: test.level,
      testNumber: test.testNumber
    });
    
    return attempt;
  }
  
  // Update answer
  updateAnswer(attemptId: string, questionId: string, answer: 'A' | 'B' | 'C' | 'D' | 'E'): void {
    const attempts = getAttempts();
    const attempt = attempts.find(a => a.id === attemptId);
    
    if (attempt) {
      attempt.answers[questionId] = answer;
      saveAttempt(attempt);
    }
  }
  
  // Submit test
  submitTest(test: CBTTest, attempt: CBTAttempt): CBTAttempt {
    const score = calculateScore(test, attempt.answers);
    const percentage = (score / test.totalMarks) * 100;
    
    attempt.endTime = new Date().toISOString();
    attempt.score = score;
    attempt.percentage = percentage;
    attempt.passed = percentage >= PASS_MARK_PERCENTAGE;
    attempt.completed = true;
    
    saveAttempt(attempt);
    localStorage.removeItem(STORAGE_KEYS.CURRENT_TEST);
    
    // Sync completed test to server
    syncToServer('submit', {
      attemptId: attempt.id,
      testId: test.id,
      level: attempt.level,
      testNumber: attempt.testNumber,
      answers: attempt.answers,
      score: attempt.score,
      percentage: attempt.percentage,
      passed: attempt.passed,
      tabSwitchCount: attempt.tabSwitchCount,
      startTime: attempt.startTime,
      endTime: attempt.endTime
    });
    
    return attempt;
  }
  
  // Record tab switch (anti-cheat)
  recordTabSwitch(attemptId: string): void {
    const attempts = getAttempts();
    const attempt = attempts.find(a => a.id === attemptId);
    
    if (attempt) {
      attempt.tabSwitchCount += 1;
      if (attempt.tabSwitchCount >= 3) {
        attempt.suspiciousActivity = true;
      }
      saveAttempt(attempt);
    }
  }
  
  // Get current test in progress
  getCurrentTest(): { test: CBTTest; attempt: CBTAttempt } | null {
    const stored = localStorage.getItem(STORAGE_KEYS.CURRENT_TEST);
    return stored ? JSON.parse(stored) : null;
  }
  
  // Clear current test
  clearCurrentTest(): void {
    localStorage.removeItem(STORAGE_KEYS.CURRENT_TEST);
  }
}

export const cbtService = new CBTService();
