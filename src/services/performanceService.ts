/**
 * Performance Tracking Service
 * 
 * Comprehensive trainee performance assessment system
 * 
 * PERFORMANCE ASSESSMENT FLOW:
 * ============================
 * 
 * 1. ROTATION PERIODS:
 *    - House Officers: 1 month (30 days)
 *    - Junior Residents: 3 months (90 days)
 *    - Senior Residents: 6 months (180 days)
 * 
 * 2. PERFORMANCE COMPONENTS (Weighted):
 *    a) CBT Performance (30%): Average score from weekly tests
 *    b) Patient Care Activity (35%): Entries, updates, documentation
 *    c) Duty Promptness (25%): Response time to assigned duties
 *    d) Attendance & Engagement (10%): Login frequency, session duration
 * 
 * 3. SIGN-OUT REQUIREMENTS:
 *    - Minimum 70% overall performance required
 *    - Must complete minimum required activities per rotation
 *    - Must complete all mandatory CBT tests
 * 
 * 4. EXTENSION LOGIC:
 *    - If below 70% at rotation end, trainee continues
 *    - Weekly reassessment until 70% achieved
 *    - Performance improvement plan generated
 */

import { TrainingLevel } from './medicalTrainingService';

// ============== TYPES & INTERFACES ==============

export interface PerformanceMetrics {
  cbtScore: number;           // 0-100
  patientCareScore: number;   // 0-100
  dutyPromptnessScore: number; // 0-100
  attendanceScore: number;    // 0-100
  overallScore: number;       // Weighted average
}

export interface ActivityLog {
  id: string;
  userId: string;
  type: ActivityType;
  description: string;
  timestamp: string;
  points: number;
  metadata?: Record<string, any>;
}

export type ActivityType = 
  | 'login'
  | 'patient_entry'
  | 'patient_update'
  | 'treatment_plan'
  | 'prescription'
  | 'wound_care'
  | 'surgery_booking'
  | 'lab_order'
  | 'discharge_summary'
  | 'ward_round'
  | 'duty_response'
  | 'cbt_completed'
  | 'cme_completed';

export interface DutyAssignment {
  id: string;
  userId: string;
  title: string;
  description: string;
  assignedAt: string;
  dueAt: string;
  respondedAt?: string;
  completedAt?: string;
  status: 'pending' | 'in_progress' | 'completed' | 'overdue';
  priority: 'low' | 'medium' | 'high' | 'urgent';
  promptnessScore?: number; // 0-100 based on response time
}

export interface RotationRecord {
  id: string;
  odId: string;
  level: TrainingLevel;
  startDate: string;
  expectedEndDate: string;
  actualEndDate?: string;
  status: 'active' | 'extended' | 'completed' | 'signed_out';
  extensionCount: number;
  extensionReasons: string[];
  performanceHistory: PerformanceSnapshot[];
  signOutApproval?: SignOutApproval;
}

export interface PerformanceSnapshot {
  date: string;
  metrics: PerformanceMetrics;
  weekNumber: number;
}

export interface SignOutApproval {
  approved: boolean;
  approvedBy?: string;
  approvedAt?: string;
  comments?: string;
  finalScore: number;
}

export interface TraineeProfile {
  userId: string;
  name: string;
  level: TrainingLevel;
  currentRotation: RotationRecord;
  activities: ActivityLog[];
  duties: DutyAssignment[];
  performance: PerformanceMetrics;
  canSignOut: boolean;
  requiresExtension: boolean;
}

// ============== CONFIGURATION ==============

export const ROTATION_DURATIONS: Record<TrainingLevel, number> = {
  house_officer: 30,    // 1 month in days
  junior_resident: 90,  // 3 months in days
  senior_resident: 180  // 6 months in days
};

export const PERFORMANCE_WEIGHTS = {
  cbt: 0.30,           // 30%
  patientCare: 0.35,   // 35%
  dutyPromptness: 0.25, // 25%
  attendance: 0.10     // 10%
};

export const SIGN_OUT_THRESHOLD = 70; // 70% required to sign out

export const MINIMUM_REQUIREMENTS: Record<TrainingLevel, {
  cbtTests: number;
  patientEntries: number;
  dutiesCompleted: number;
  loginDays: number;
}> = {
  house_officer: {
    cbtTests: 4,
    patientEntries: 30,
    dutiesCompleted: 20,
    loginDays: 25
  },
  junior_resident: {
    cbtTests: 12,
    patientEntries: 100,
    dutiesCompleted: 60,
    loginDays: 75
  },
  senior_resident: {
    cbtTests: 24,
    patientEntries: 200,
    dutiesCompleted: 120,
    loginDays: 150
  }
};

export const ACTIVITY_POINTS: Record<ActivityType, number> = {
  login: 1,
  patient_entry: 10,
  patient_update: 5,
  treatment_plan: 15,
  prescription: 8,
  wound_care: 12,
  surgery_booking: 20,
  lab_order: 6,
  discharge_summary: 15,
  ward_round: 10,
  duty_response: 5,
  cbt_completed: 25,
  cme_completed: 20
};

// ============== STORAGE KEYS ==============

const STORAGE_KEYS = {
  ACTIVITIES: 'performance_activities',
  DUTIES: 'performance_duties',
  ROTATIONS: 'performance_rotations',
  PROFILES: 'performance_profiles'
};

// ============== HELPER FUNCTIONS ==============

const generateId = (): string => `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

const getCurrentUserId = (): string => {
  return localStorage.getItem('userId') || `user-${Date.now()}`;
};

const getCurrentUserLevel = (): TrainingLevel => {
  const stored = localStorage.getItem('userLevel');
  return (stored as TrainingLevel) || 'house_officer';
};

// ============== ACTIVITY TRACKING ==============

const getActivities = (userId?: string): ActivityLog[] => {
  const stored = localStorage.getItem(STORAGE_KEYS.ACTIVITIES);
  const activities: ActivityLog[] = stored ? JSON.parse(stored) : [];
  if (userId) {
    return activities.filter(a => a.userId === userId);
  }
  return activities;
};

const logActivity = (
  type: ActivityType,
  description: string,
  metadata?: Record<string, any>
): ActivityLog => {
  const userId = getCurrentUserId();
  const activity: ActivityLog = {
    id: generateId(),
    userId,
    type,
    description,
    timestamp: new Date().toISOString(),
    points: ACTIVITY_POINTS[type],
    metadata
  };
  
  const activities = getActivities();
  activities.push(activity);
  localStorage.setItem(STORAGE_KEYS.ACTIVITIES, JSON.stringify(activities));
  
  // Also sync to server when online
  syncActivityToServer(activity);
  
  return activity;
};

const syncActivityToServer = async (activity: ActivityLog): Promise<void> => {
  // Queue for sync when online
  const pendingSync = JSON.parse(localStorage.getItem('pendingSyncActivities') || '[]');
  pendingSync.push(activity);
  localStorage.setItem('pendingSyncActivities', JSON.stringify(pendingSync));
  
  // Try to sync if online
  if (navigator.onLine) {
    try {
      // API call would go here
      // await fetch('/api/activities', { method: 'POST', body: JSON.stringify(activity) });
      // Clear from pending on success
    } catch (error) {
      console.log('Activity will be synced when online');
    }
  }
};

// ============== DUTY MANAGEMENT ==============

const getDuties = (userId?: string): DutyAssignment[] => {
  const stored = localStorage.getItem(STORAGE_KEYS.DUTIES);
  const duties: DutyAssignment[] = stored ? JSON.parse(stored) : [];
  if (userId) {
    return duties.filter(d => d.userId === userId);
  }
  return duties;
};

const assignDuty = (
  userId: string,
  title: string,
  description: string,
  dueInMinutes: number,
  priority: DutyAssignment['priority'] = 'medium'
): DutyAssignment => {
  const now = new Date();
  const dueAt = new Date(now.getTime() + dueInMinutes * 60000);
  
  const duty: DutyAssignment = {
    id: generateId(),
    userId,
    title,
    description,
    assignedAt: now.toISOString(),
    dueAt: dueAt.toISOString(),
    status: 'pending',
    priority
  };
  
  const duties = getDuties();
  duties.push(duty);
  localStorage.setItem(STORAGE_KEYS.DUTIES, JSON.stringify(duties));
  
  return duty;
};

const respondToDuty = (dutyId: string): DutyAssignment | null => {
  const duties = getDuties();
  const duty = duties.find(d => d.id === dutyId);
  
  if (!duty) return null;
  
  const now = new Date();
  const assignedTime = new Date(duty.assignedAt);
  const dueTime = new Date(duty.dueAt);
  
  duty.respondedAt = now.toISOString();
  duty.status = 'in_progress';
  
  // Calculate promptness score
  const totalAllowedTime = dueTime.getTime() - assignedTime.getTime();
  const actualResponseTime = now.getTime() - assignedTime.getTime();
  
  if (now > dueTime) {
    // Late response
    duty.status = 'overdue';
    duty.promptnessScore = Math.max(0, 50 - ((actualResponseTime - totalAllowedTime) / 60000)); // Deduct per minute late
  } else {
    // On time - score based on how quickly responded
    const responsePercentage = actualResponseTime / totalAllowedTime;
    if (responsePercentage <= 0.25) {
      duty.promptnessScore = 100; // Excellent - responded in first quarter
    } else if (responsePercentage <= 0.50) {
      duty.promptnessScore = 90; // Very good
    } else if (responsePercentage <= 0.75) {
      duty.promptnessScore = 80; // Good
    } else {
      duty.promptnessScore = 70; // Acceptable
    }
  }
  
  localStorage.setItem(STORAGE_KEYS.DUTIES, JSON.stringify(duties));
  logActivity('duty_response', `Responded to duty: ${duty.title}`, { dutyId, promptnessScore: duty.promptnessScore });
  
  return duty;
};

const completeDuty = (dutyId: string): DutyAssignment | null => {
  const duties = getDuties();
  const duty = duties.find(d => d.id === dutyId);
  
  if (!duty) return null;
  
  duty.completedAt = new Date().toISOString();
  duty.status = 'completed';
  
  localStorage.setItem(STORAGE_KEYS.DUTIES, JSON.stringify(duties));
  
  return duty;
};

// ============== ROTATION MANAGEMENT ==============

const getRotations = (userId?: string): RotationRecord[] => {
  const stored = localStorage.getItem(STORAGE_KEYS.ROTATIONS);
  const rotations: RotationRecord[] = stored ? JSON.parse(stored) : [];
  if (userId) {
    return rotations.filter(r => r.odId === userId);
  }
  return rotations;
};

const getCurrentRotation = (userId?: string): RotationRecord | null => {
  const id = userId || getCurrentUserId();
  const rotations = getRotations(id);
  return rotations.find(r => r.status === 'active' || r.status === 'extended') || null;
};

const startRotation = (userId: string, level: TrainingLevel): RotationRecord => {
  const now = new Date();
  const duration = ROTATION_DURATIONS[level];
  const endDate = new Date(now.getTime() + duration * 24 * 60 * 60 * 1000);
  
  const rotation: RotationRecord = {
    id: generateId(),
    odId: userId,
    level,
    startDate: now.toISOString(),
    expectedEndDate: endDate.toISOString(),
    status: 'active',
    extensionCount: 0,
    extensionReasons: [],
    performanceHistory: []
  };
  
  const rotations = getRotations();
  rotations.push(rotation);
  localStorage.setItem(STORAGE_KEYS.ROTATIONS, JSON.stringify(rotations));
  
  logActivity('login', `Started ${level.replace('_', ' ')} rotation`);
  
  return rotation;
};

const extendRotation = (rotationId: string, reason: string): RotationRecord | null => {
  const rotations = getRotations();
  const rotation = rotations.find(r => r.id === rotationId);
  
  if (!rotation) return null;
  
  // Extend by 1 week
  const currentEnd = new Date(rotation.expectedEndDate);
  const newEnd = new Date(currentEnd.getTime() + 7 * 24 * 60 * 60 * 1000);
  
  rotation.expectedEndDate = newEnd.toISOString();
  rotation.status = 'extended';
  rotation.extensionCount += 1;
  rotation.extensionReasons.push(`Week ${rotation.extensionCount}: ${reason}`);
  
  localStorage.setItem(STORAGE_KEYS.ROTATIONS, JSON.stringify(rotations));
  
  return rotation;
};

const signOutRotation = (
  rotationId: string, 
  approvedBy: string, 
  comments: string
): RotationRecord | null => {
  const rotations = getRotations();
  const rotation = rotations.find(r => r.id === rotationId);
  
  if (!rotation) return null;
  
  const metrics = calculatePerformanceMetrics(rotation.odId, rotation.level);
  
  if (metrics.overallScore < SIGN_OUT_THRESHOLD) {
    return null; // Cannot sign out - below threshold
  }
  
  rotation.status = 'signed_out';
  rotation.actualEndDate = new Date().toISOString();
  rotation.signOutApproval = {
    approved: true,
    approvedBy,
    approvedAt: new Date().toISOString(),
    comments,
    finalScore: metrics.overallScore
  };
  
  localStorage.setItem(STORAGE_KEYS.ROTATIONS, JSON.stringify(rotations));
  
  return rotation;
};

// ============== PERFORMANCE CALCULATION ==============

const calculateCBTScore = (userId: string): number => {
  const stored = localStorage.getItem('cbt_attempts');
  const attempts = stored ? JSON.parse(stored) : [];
  const userAttempts = attempts.filter((a: any) => a.userId === userId && a.completed);
  
  if (userAttempts.length === 0) return 0;
  
  const totalScore = userAttempts.reduce((sum: number, a: any) => sum + a.percentage, 0);
  return totalScore / userAttempts.length;
};

const calculatePatientCareScore = (userId: string, level: TrainingLevel): number => {
  const activities = getActivities(userId);
  const requirements = MINIMUM_REQUIREMENTS[level];
  
  const patientActivities = activities.filter(a => 
    ['patient_entry', 'patient_update', 'treatment_plan', 'prescription', 
     'wound_care', 'surgery_booking', 'lab_order', 'discharge_summary', 'ward_round']
    .includes(a.type)
  );
  
  const totalPoints = patientActivities.reduce((sum, a) => sum + a.points, 0);
  const expectedPoints = requirements.patientEntries * 10; // Base expectation
  
  // Score based on percentage of expected activities, capped at 100
  return Math.min(100, (totalPoints / expectedPoints) * 100);
};

const calculateDutyPromptnessScore = (userId: string): number => {
  const duties = getDuties(userId).filter(d => d.status === 'completed' || d.status === 'overdue');
  
  if (duties.length === 0) return 0;
  
  const dutiesWithScores = duties.filter(d => d.promptnessScore !== undefined);
  if (dutiesWithScores.length === 0) return 0;
  
  const totalScore = dutiesWithScores.reduce((sum, d) => sum + (d.promptnessScore || 0), 0);
  return totalScore / dutiesWithScores.length;
};

const calculateAttendanceScore = (userId: string, level: TrainingLevel): number => {
  const activities = getActivities(userId);
  const requirements = MINIMUM_REQUIREMENTS[level];
  
  // Count unique login days
  const loginDays = new Set(
    activities
      .filter(a => a.type === 'login')
      .map(a => new Date(a.timestamp).toDateString())
  );
  
  const loginScore = Math.min(100, (loginDays.size / requirements.loginDays) * 100);
  
  return loginScore;
};

const calculatePerformanceMetrics = (userId: string, level: TrainingLevel): PerformanceMetrics => {
  const cbtScore = calculateCBTScore(userId);
  const patientCareScore = calculatePatientCareScore(userId, level);
  const dutyPromptnessScore = calculateDutyPromptnessScore(userId);
  const attendanceScore = calculateAttendanceScore(userId, level);
  
  const overallScore = 
    (cbtScore * PERFORMANCE_WEIGHTS.cbt) +
    (patientCareScore * PERFORMANCE_WEIGHTS.patientCare) +
    (dutyPromptnessScore * PERFORMANCE_WEIGHTS.dutyPromptness) +
    (attendanceScore * PERFORMANCE_WEIGHTS.attendance);
  
  return {
    cbtScore: Math.round(cbtScore * 10) / 10,
    patientCareScore: Math.round(patientCareScore * 10) / 10,
    dutyPromptnessScore: Math.round(dutyPromptnessScore * 10) / 10,
    attendanceScore: Math.round(attendanceScore * 10) / 10,
    overallScore: Math.round(overallScore * 10) / 10
  };
};

// ============== SIGN-OUT ELIGIBILITY ==============

const checkSignOutEligibility = (userId: string, level: TrainingLevel): {
  eligible: boolean;
  metrics: PerformanceMetrics;
  requirements: {
    met: string[];
    notMet: string[];
  };
  daysRemaining: number;
  recommendation: string;
} => {
  const metrics = calculatePerformanceMetrics(userId, level);
  const rotation = getCurrentRotation(userId);
  const requirements = MINIMUM_REQUIREMENTS[level];
  const activities = getActivities(userId);
  const duties = getDuties(userId);
  
  const met: string[] = [];
  const notMet: string[] = [];
  
  // Check CBT completion
  const cbtAttempts = JSON.parse(localStorage.getItem('cbt_attempts') || '[]')
    .filter((a: any) => a.userId === userId && a.completed);
  if (cbtAttempts.length >= requirements.cbtTests) {
    met.push(`Completed ${cbtAttempts.length}/${requirements.cbtTests} CBT tests`);
  } else {
    notMet.push(`CBT tests: ${cbtAttempts.length}/${requirements.cbtTests} completed`);
  }
  
  // Check patient entries
  const patientEntries = activities.filter(a => a.type === 'patient_entry').length;
  if (patientEntries >= requirements.patientEntries) {
    met.push(`Completed ${patientEntries}/${requirements.patientEntries} patient entries`);
  } else {
    notMet.push(`Patient entries: ${patientEntries}/${requirements.patientEntries}`);
  }
  
  // Check duties
  const completedDuties = duties.filter(d => d.status === 'completed').length;
  if (completedDuties >= requirements.dutiesCompleted) {
    met.push(`Completed ${completedDuties}/${requirements.dutiesCompleted} duties`);
  } else {
    notMet.push(`Duties: ${completedDuties}/${requirements.dutiesCompleted} completed`);
  }
  
  // Check login days
  const loginDays = new Set(
    activities.filter(a => a.type === 'login').map(a => new Date(a.timestamp).toDateString())
  ).size;
  if (loginDays >= requirements.loginDays) {
    met.push(`Login days: ${loginDays}/${requirements.loginDays}`);
  } else {
    notMet.push(`Login days: ${loginDays}/${requirements.loginDays}`);
  }
  
  // Check overall score
  if (metrics.overallScore >= SIGN_OUT_THRESHOLD) {
    met.push(`Overall score: ${metrics.overallScore}% (≥70%)`);
  } else {
    notMet.push(`Overall score: ${metrics.overallScore}% (need 70%)`);
  }
  
  // Calculate days remaining
  let daysRemaining = 0;
  if (rotation) {
    const endDate = new Date(rotation.expectedEndDate);
    const now = new Date();
    daysRemaining = Math.max(0, Math.ceil((endDate.getTime() - now.getTime()) / (24 * 60 * 60 * 1000)));
  }
  
  // Determine eligibility
  const eligible = notMet.length === 0 && metrics.overallScore >= SIGN_OUT_THRESHOLD;
  
  // Generate recommendation
  let recommendation = '';
  if (eligible) {
    recommendation = 'Congratulations! You have met all requirements for sign-out. Please request approval from your supervisor.';
  } else if (metrics.overallScore >= SIGN_OUT_THRESHOLD && notMet.length > 0) {
    recommendation = `Your score is ${metrics.overallScore}%, but you need to complete: ${notMet.join(', ')}`;
  } else {
    const deficit = SIGN_OUT_THRESHOLD - metrics.overallScore;
    recommendation = `You need to improve your score by ${deficit.toFixed(1)}% to reach the 70% threshold. Focus on: `;
    
    if (metrics.cbtScore < 70) recommendation += 'CBT performance, ';
    if (metrics.patientCareScore < 70) recommendation += 'patient care activities, ';
    if (metrics.dutyPromptnessScore < 70) recommendation += 'duty response time, ';
    if (metrics.attendanceScore < 70) recommendation += 'attendance, ';
    
    recommendation = recommendation.replace(/, $/, '.');
  }
  
  return {
    eligible,
    metrics,
    requirements: { met, notMet },
    daysRemaining,
    recommendation
  };
};

// ============== PERFORMANCE IMPROVEMENT PLAN ==============

interface ImprovementPlan {
  userId: string;
  createdAt: string;
  weeklyTargets: {
    week: number;
    cbtTarget: string;
    activityTarget: string;
    dutyTarget: string;
  }[];
  focusAreas: string[];
  estimatedCompletionDate: string;
}

const generateImprovementPlan = (userId: string, level: TrainingLevel): ImprovementPlan => {
  const metrics = calculatePerformanceMetrics(userId, level);
  const deficit = SIGN_OUT_THRESHOLD - metrics.overallScore;
  const weeksNeeded = Math.ceil(deficit / 5); // Assume 5% improvement per week max
  
  const focusAreas: string[] = [];
  if (metrics.cbtScore < 70) focusAreas.push('CBT Performance');
  if (metrics.patientCareScore < 70) focusAreas.push('Patient Care Documentation');
  if (metrics.dutyPromptnessScore < 70) focusAreas.push('Duty Response Time');
  if (metrics.attendanceScore < 70) focusAreas.push('Regular Attendance');
  
  const weeklyTargets = [];
  for (let i = 1; i <= weeksNeeded; i++) {
    weeklyTargets.push({
      week: i,
      cbtTarget: metrics.cbtScore < 70 ? 'Complete weekly CBT with ≥70% score' : 'Maintain CBT performance',
      activityTarget: metrics.patientCareScore < 70 
        ? `Log at least ${Math.ceil(MINIMUM_REQUIREMENTS[level].patientEntries / weeksNeeded)} patient activities`
        : 'Continue regular documentation',
      dutyTarget: metrics.dutyPromptnessScore < 70
        ? 'Respond to all duties within 25% of allocated time'
        : 'Maintain prompt duty responses'
    });
  }
  
  const estimatedDate = new Date();
  estimatedDate.setDate(estimatedDate.getDate() + (weeksNeeded * 7));
  
  return {
    userId,
    createdAt: new Date().toISOString(),
    weeklyTargets,
    focusAreas,
    estimatedCompletionDate: estimatedDate.toISOString()
  };
};

// ============== EXPORTED SERVICE ==============

class PerformanceService {
  // Activity Tracking
  logActivity = logActivity;
  getActivities = getActivities;
  
  // Duty Management
  getDuties = getDuties;
  assignDuty = assignDuty;
  respondToDuty = respondToDuty;
  completeDuty = completeDuty;
  
  // Rotation Management
  getRotations = getRotations;
  getCurrentRotation = getCurrentRotation;
  startRotation = startRotation;
  extendRotation = extendRotation;
  signOutRotation = signOutRotation;
  
  // Performance Metrics
  calculatePerformanceMetrics = calculatePerformanceMetrics;
  calculateCBTScore = calculateCBTScore;
  calculatePatientCareScore = calculatePatientCareScore;
  calculateDutyPromptnessScore = calculateDutyPromptnessScore;
  calculateAttendanceScore = calculateAttendanceScore;
  
  // Sign-out
  checkSignOutEligibility = checkSignOutEligibility;
  generateImprovementPlan = generateImprovementPlan;
  
  // Configuration
  ROTATION_DURATIONS = ROTATION_DURATIONS;
  PERFORMANCE_WEIGHTS = PERFORMANCE_WEIGHTS;
  SIGN_OUT_THRESHOLD = SIGN_OUT_THRESHOLD;
  MINIMUM_REQUIREMENTS = MINIMUM_REQUIREMENTS;
  ACTIVITY_POINTS = ACTIVITY_POINTS;
  
  // Helpers
  getCurrentUserId = getCurrentUserId;
  getCurrentUserLevel = getCurrentUserLevel;
  
  // Record daily login
  recordLogin = (): void => {
    const userId = getCurrentUserId();
    const today = new Date().toDateString();
    const lastLogin = localStorage.getItem('lastLoginDate');
    
    if (lastLogin !== today) {
      logActivity('login', 'Daily login recorded');
      localStorage.setItem('lastLoginDate', today);
    }
  };
  
  // Get trainee profile summary
  getTraineeProfile = (userId?: string): TraineeProfile => {
    const id = userId || getCurrentUserId();
    const level = getCurrentUserLevel();
    const rotation = getCurrentRotation(id);
    const activities = getActivities(id);
    const duties = getDuties(id);
    const metrics = calculatePerformanceMetrics(id, level);
    const eligibility = checkSignOutEligibility(id, level);
    
    return {
      userId: id,
      name: localStorage.getItem('userName') || 'Trainee',
      level,
      currentRotation: rotation || {
        id: '',
        odId: id,
        level,
        startDate: new Date().toISOString(),
        expectedEndDate: new Date(Date.now() + ROTATION_DURATIONS[level] * 24 * 60 * 60 * 1000).toISOString(),
        status: 'active',
        extensionCount: 0,
        extensionReasons: [],
        performanceHistory: []
      },
      activities,
      duties,
      performance: metrics,
      canSignOut: eligibility.eligible,
      requiresExtension: metrics.overallScore < SIGN_OUT_THRESHOLD && eligibility.daysRemaining <= 0
    };
  };
}

export const performanceService = new PerformanceService();
