import Dexie, { Table } from 'dexie';
import { CMETopic, CMEQuestion, TestSession, CMEProgress, CMECertificate } from '../services/aiService';
import { WardRound, ClinicSession, SurgeryBooking } from '../services/schedulingService';
import { LabInvestigation, LabResult, GFRCalculation } from '../services/labService';
import { BaseRiskAssessment, DVTRiskAssessment, PressureSoreRiskAssessment, NutritionalRiskAssessment } from '../services/riskAssessmentService';
import { ClinicalTopic, GeneratedMCQ, MCQTestSchedule, MCQTestSession, StudyMaterial, NotificationSchedule } from '../services/mcqGenerationService';
import { EducationalTopic, WeeklyContent, TopicSchedule, UserProgress } from '../services/topicManagementService';
import { PendingUser, ApprovedUser } from '../services/userManagementService';

// Database recovery utility
export async function recoverDatabase(): Promise<boolean> {
  try {
    console.log('🔧 Attempting database recovery...');
    
    // Try to delete the corrupted database
    await Dexie.delete('PlasticSurgeonDB');
    console.log('✅ Old database deleted successfully');
    
    // Clear any cached data
    if ('caches' in window) {
      const cacheKeys = await caches.keys();
      await Promise.all(cacheKeys.map(key => caches.delete(key)));
      console.log('✅ Caches cleared');
    }
    
    // Reload to reinitialize
    window.location.reload();
    return true;
  } catch (error) {
    console.error('❌ Database recovery failed:', error);
    return false;
  }
}

// Check if database is healthy
export async function checkDatabaseHealth(): Promise<boolean> {
  try {
    const testDb = new Dexie('PlasticSurgeonDB');
    await testDb.open();
    await testDb.close();
    return true;
  } catch (error) {
    console.error('❌ Database health check failed:', error);
    return false;
  }
}

// Define the data structures for offline storage
export interface Patient {
  id?: number;
  serverId?: string; // Server ID when synced
  hospital_number: string;
  first_name: string;
  last_name: string;
  dob: string;
  date_of_birth?: string; // Alias for dob (server uses this name)
  sex: string;
  gender?: string; // Alias for sex (server uses this name)
  phone?: string;
  email?: string;
  address?: string;
  city?: string;
  state?: string;
  country?: string;
  other_names?: string;
  full_name?: string;
  allergies?: string[];
  comorbidities?: string[];
  blood_group?: string;
  genotype?: string;
  emergency_contact_name?: string;
  emergency_contact_phone?: string;
  emergency_contact_relationship?: string;
  chronic_conditions?: string;
  current_medications?: string;
  // UNTH extras from registration
  consultant_in_charge?: string;
  resident_in_charge?: string;
  ward_id?: string;
  bed_number?: string;
  patient_type?: string;
  admission_type?: string;
  referring_hospital?: string;
  registration_date?: Date;
  admission_date?: Date;
  created_at: Date;
  updated_at: Date;
  synced: boolean;
  deleted?: boolean;
  [key: string]: any; // Allow additional dynamic fields from server
}

export interface TreatmentPlan {
  id?: number;
  serverId?: string;
  patient_id: number;
  patient_name?: string; // For enhanced treatment planning
  hospital_number?: string; // For enhanced treatment planning
  admission_date?: Date; // For enhanced treatment planning
  title: string;
  diagnosis: string;
  status: 'draft' | 'active' | 'completed' | 'archived';
  start_date: Date;
  planned_end_date?: Date;
  description?: string;
  created_by: string; // user ID
  // Enhanced treatment planning fields
  reviews?: any[]; // TreatmentPlanReview[]
  lab_works?: any[]; // LabWork[]
  procedures?: any[]; // PlannedProcedure[]
  medications?: any[]; // MedicationAdministration[]
  discharge_timeline?: any; // DischargeTimeline
  notes?: string;
  created_at: Date;
  updated_at: Date;
  synced: boolean;
  deleted?: boolean;
}

export interface PlanStep {
  id?: number;
  serverId?: string;
  plan_id: number;
  step_number: number;
  title: string;
  description?: string;
  assigned_to?: string;
  due_date?: Date;
  duration?: number; // minutes
  status: 'pending' | 'in_progress' | 'completed' | 'overdue';
  completed_at?: Date;
  notes?: string;
  created_at: Date;
  updated_at: Date;
  synced: boolean;
  deleted?: boolean;
}

export interface SyncQueue {
  id?: number;
  action: 'create' | 'update' | 'delete';
  table: string;
  local_id: number;
  data: any;
  created_at: Date;
  retries: number;
  last_error?: string;
  /** Stable UUID stamped at queue insert; sent as X-Idempotency-Key on every replay attempt
   *  so the server can dedupe replayed mutations on flaky networks. */
  idempotency_key?: string;
}

// Define the database
export class PlasticSurgeonDB extends Dexie {
  patients!: Table<Patient>;
  treatment_plans!: Table<TreatmentPlan>;
  plan_steps!: Table<PlanStep>;
  sync_queue!: Table<SyncQueue>;
  cmeTopics!: Table<CMETopic>;
  testSessions!: Table<TestSession>;
  cmeProgress!: Table<CMEProgress>;
  cmeCertificates!: Table<CMECertificate>;
  ward_rounds!: Table<WardRound>;
  clinic_sessions!: Table<ClinicSession>;
  surgery_bookings!: Table<SurgeryBooking>;
  lab_investigations!: Table<LabInvestigation>;
  lab_results!: Table<LabResult>;
  gfr_calculations!: Table<GFRCalculation>;
  dvt_assessments!: Table<DVTRiskAssessment>;
  pressure_sore_assessments!: Table<PressureSoreRiskAssessment>;
  nutritional_assessments!: Table<NutritionalRiskAssessment>;
  clinical_topics!: Table<ClinicalTopic>;
  generated_mcqs!: Table<GeneratedMCQ>;
  mcq_test_schedules!: Table<MCQTestSchedule>;
  mcq_test_sessions!: Table<MCQTestSession>;
  study_materials!: Table<StudyMaterial>;
  notification_schedules!: Table<NotificationSchedule>;
  educational_topics!: Table<EducationalTopic>;
  weekly_contents!: Table<WeeklyContent>;
  topic_schedules!: Table<TopicSchedule>;
  user_progress!: Table<UserProgress>;
  users!: Table<any>; // For user management
  pending_users!: Table<PendingUser>;
  approved_users!: Table<ApprovedUser>;
  patient_summaries!: Table<any>; // For AI-powered patient summaries
  paperwork_documents!: Table<any>; // For AI-generated paperwork
  mdt_patient_teams!: Table<any>; // For MDT patient teams
  mdt_meetings!: Table<any>; // For MDT meetings
  mdt_contact_logs!: Table<any>; // For MDT contact logs
  admissions!: Table<any>; // For patient admissions
  discharges!: Table<any>; // For patient discharges
  cme_articles!: Table<any>; // For CME WACS articles
  cme_reading_progress!: Table<any>; // For CME reading progress tracking
  preoperative_assessments!: Table<any>; // For preoperative assessments
  blood_transfusions!: Table<any>; // For blood transfusion records
  transfusion_vitals!: Table<any>; // For pre/post transfusion vitals
  transfusion_complications!: Table<any>; // For transfusion complications
  ward_rounds_clinical!: Table<any>; // For clinical ward rounds
  user_activities!: Table<any>; // For user activity tracking and analytics
  prescriptions!: Table<any>; // For prescription management
  wound_care!: Table<any>; // For wound care protocols
  diabetic_foot_assessments!: Table<any>; // For diabetic foot limb salvage assessments
  burn_patients!: Table<any>; // For burn care management
  cbt_tests!: Table<any>; // For CBT weekly tests
  cbt_attempts!: Table<any>; // For CBT test attempts
  cbt_progress!: Table<any>; // For CBT progress tracking
  performance_metrics!: Table<any>; // For performance tracking
  activity_logs!: Table<any>; // For activity logging
  duty_assignments!: Table<any>; // For duty assignments
  rotation_records!: Table<any>; // For rotation tracking
  chat_messages!: Table<any>; // For chat messages
  chat_rooms!: Table<any>; // For chat rooms
  video_conferences!: Table<any>; // For video conferences
  who_safety_checklists!: Table<any>; // For WHO surgical safety checklists
  procedures!: Table<any>; // For surgical procedures
  system_settings!: Table<any>; // For system settings
  system_logs!: Table<any>; // For system logs
  backup_records!: Table<any>; // For backup records
  patient_assignments!: Table<any>; // For automatic patient assignment to medical team
  pushSubscriptions!: Table<any>; // For push notification subscriptions
  audit_logs!: Table<any>; // For PHI access audit logs (HIPAA compliance)
  call_duty_roster!: Table<any>; // For 48-hour call duty roster
  clinic_duty_logs!: Table<any>; // For clinic duty tracking & logs
  notice_board!: Table<any>; // For notice board posts and announcements
  ps_unit_rosters!: Table<any>; // For PS Unit rotation roster configs
  shopping_lists!: Table<any>; // For saved shopping lists with cloud persistence
  progress_notes!: Table<any>; // For SOAP progress notes
  api_cache!: Table<any>; // Generic API response cache for offline-first
  sjs_assessments!: Table<any>; // For SJS/TEN clinical assessments
  investigation_uploads!: Table<any>; // For investigation form/result uploads
  substance_use_assessments!: Table<any>; // For substance use disorder assessments
  detox_monitoring_records!: Table<any>; // For detox vital signs / withdrawal monitoring
  detox_follow_ups!: Table<any>; // For detox follow-up visits
  substance_use_clinical_summaries!: Table<any>; // For generated clinical summaries
  lymphedema_assessments!: Table<any>; // For lymphedema assessments
  call_duty_handover_notes!: Table<any>; // For call duty handover notes & outstanding tasks
  fluid_balance!: Table<any>; // For fluid input/output balance tracking
  offline_credentials!: Table<any>; // Offline auth: hashed credentials for offline login
  sync_conflicts!: Table<any>; // Sync conflict log for manual resolution
  sync_dead_letter!: Table<any>; // Dead letter queue for permanently failed sync items
  vital_signs!: Table<any>; // For vital signs records with server persistence
  wounds!: Table<any>; // WoundProgress Monitor: first-class longitudinal wound entity
  wound_assessments!: Table<any>; // WoundProgress Monitor: serial assessment timeline

  constructor() {
    super('PlasticSurgeonDB');
    
    // Version 1: Initial schema
    this.version(1).stores({
      patients: '++id, serverId, hospital_number, first_name, last_name, created_at, synced, deleted',
      treatment_plans: '++id, serverId, patient_id, title, status, created_at, synced, deleted',
      plan_steps: '++id, serverId, plan_id, step_number, status, due_date, created_at, synced, deleted',
      sync_queue: '++id, action, table, local_id, created_at, retries',
      cmeTopics: '++id, title, category, weekOf, estimatedDuration',
      testSessions: '++id, userId, topicId, startedAt, completedAt',
      cmeProgress: '++id, [userId+topicId], userId, topicId, completed, lastAttempt',
      cmeCertificates: '++id, userId, topicId, issuedAt, validUntil',
      ward_rounds: '++id, date, ward_name, consultant, status, created_at',
      clinic_sessions: '++id, date, clinic_type, consultant, status, created_at',
      surgery_bookings: '++id, date, theatre_number, primary_surgeon, patient_id, status, created_at',
      lab_investigations: '++id, patient_id, request_date, requested_by, status, urgency, created_at',
      lab_results: '++id, investigation_id, patient_id, test_id, result_date, abnormal_flag, created_at'
    });

    // Version 2: Add GFR calculations table
    this.version(2).stores({
      patients: '++id, serverId, hospital_number, first_name, last_name, created_at, synced, deleted',
      treatment_plans: '++id, serverId, patient_id, title, status, created_at, synced, deleted',
      plan_steps: '++id, serverId, plan_id, step_number, status, due_date, created_at, synced, deleted',
      sync_queue: '++id, action, table, local_id, created_at, retries',
      cmeTopics: '++id, title, category, weekOf, estimatedDuration',
      testSessions: '++id, userId, topicId, startedAt, completedAt',
      cmeProgress: '++id, [userId+topicId], userId, topicId, completed, lastAttempt',
      cmeCertificates: '++id, userId, topicId, issuedAt, validUntil',
      ward_rounds: '++id, date, ward_name, consultant, status, created_at',
      clinic_sessions: '++id, date, clinic_type, consultant, status, created_at',
      surgery_bookings: '++id, date, theatre_number, primary_surgeon, patient_id, status, created_at',
      lab_investigations: '++id, patient_id, request_date, requested_by, status, urgency, created_at',
      lab_results: '++id, investigation_id, patient_id, test_id, result_date, abnormal_flag, created_at',
      gfr_calculations: '++id, patient_id, calculation_date, gfr_value, ckd_stage, created_at'
    });

    // Version 3: Add risk assessment tables
    this.version(3).stores({
      patients: '++id, serverId, hospital_number, first_name, last_name, created_at, synced, deleted',
      treatment_plans: '++id, serverId, patient_id, title, status, created_at, synced, deleted',
      plan_steps: '++id, serverId, plan_id, step_number, status, due_date, created_at, synced, deleted',
      sync_queue: '++id, action, table, local_id, created_at, retries',
      cmeTopics: '++id, title, category, weekOf, estimatedDuration',
      testSessions: '++id, userId, topicId, startedAt, completedAt',
      cmeProgress: '++id, [userId+topicId], userId, topicId, completed, lastAttempt',
      cmeCertificates: '++id, userId, topicId, issuedAt, validUntil',
      ward_rounds: '++id, date, ward_name, consultant, status, created_at',
      clinic_sessions: '++id, date, clinic_type, consultant, status, created_at',
      surgery_bookings: '++id, date, theatre_number, primary_surgeon, patient_id, status, created_at',
      lab_investigations: '++id, patient_id, request_date, requested_by, status, urgency, created_at',
      lab_results: '++id, investigation_id, patient_id, test_id, result_date, abnormal_flag, created_at',
      gfr_calculations: '++id, patient_id, calculation_date, gfr_value, ckd_stage, created_at',
      dvt_assessments: '++id, patient_id, assessment_date, assessment_type, risk_level, score, status, assessed_by, created_at',
      pressure_sore_assessments: '++id, patient_id, assessment_date, assessment_type, risk_level, score, status, assessed_by, created_at',
      nutritional_assessments: '++id, patient_id, assessment_date, assessment_type, risk_level, score, status, assessed_by, created_at'
    });

    // Version 4: Add MCQ generation and assessment tables
    this.version(4).stores({
      patients: '++id, serverId, hospital_number, first_name, last_name, created_at, synced, deleted',
      treatment_plans: '++id, serverId, patient_id, title, status, created_at, synced, deleted',
      plan_steps: '++id, serverId, plan_id, step_number, status, due_date, created_at, synced, deleted',
      sync_queue: '++id, action, table, local_id, created_at, retries',
      cmeTopics: '++id, title, category, weekOf, estimatedDuration',
      testSessions: '++id, userId, topicId, startedAt, completedAt',
      cmeProgress: '++id, [userId+topicId], userId, topicId, completed, lastAttempt',
      cmeCertificates: '++id, userId, topicId, issuedAt, validUntil',
      ward_rounds: '++id, date, ward_name, consultant, status, created_at',
      clinic_sessions: '++id, date, clinic_type, consultant, status, created_at',
      surgery_bookings: '++id, date, theatre_number, primary_surgeon, patient_id, status, created_at',
      lab_investigations: '++id, patient_id, request_date, requested_by, status, urgency, created_at',
      lab_results: '++id, investigation_id, patient_id, test_id, result_date, abnormal_flag, created_at',
      gfr_calculations: '++id, patient_id, calculation_date, gfr_value, ckd_stage, created_at',
      dvt_assessments: '++id, patient_id, assessment_date, assessment_type, risk_level, score, status, assessed_by, created_at',
      pressure_sore_assessments: '++id, patient_id, assessment_date, assessment_type, risk_level, score, status, assessed_by, created_at',
      nutritional_assessments: '++id, patient_id, assessment_date, assessment_type, risk_level, score, status, assessed_by, created_at',
      clinical_topics: '++id, title, category, uploadedAt, status, uploadedBy',
      generated_mcqs: '++id, topicId, targetLevel, difficulty, category, generatedAt',
      mcq_test_schedules: '++id, topicId, scheduledFor, status, notificationSent',
      mcq_test_sessions: '++id, userId, scheduleId, topicId, startedAt, completedAt, userLevel',
      study_materials: '++id, sessionId, userId, generatedAt',
      notification_schedules: '++id, userId, scheduleId, scheduledFor, sent, sentAt, type'
    });

    // Version 5: Add Topic Management System tables
    this.version(5).stores({
      patients: '++id, serverId, hospital_number, first_name, last_name, created_at, synced, deleted',
      treatment_plans: '++id, serverId, patient_id, title, status, created_at, synced, deleted',
      plan_steps: '++id, serverId, plan_id, step_number, status, due_date, created_at, synced, deleted',
      sync_queue: '++id, action, table, local_id, created_at, retries',
      cmeTopics: '++id, title, category, weekOf, estimatedDuration',
      testSessions: '++id, userId, topicId, startedAt, completedAt',
      cmeProgress: '++id, [userId+topicId], userId, topicId, completed, lastAttempt',
      cmeCertificates: '++id, userId, topicId, issuedAt, validUntil',
      ward_rounds: '++id, date, ward_name, consultant, status, created_at',
      clinic_sessions: '++id, date, clinic_type, consultant, status, created_at',
      surgery_bookings: '++id, date, theatre_number, primary_surgeon, patient_id, status, created_at',
      lab_investigations: '++id, patient_id, request_date, requested_by, status, urgency, created_at',
      lab_results: '++id, investigation_id, patient_id, test_id, result_date, abnormal_flag, created_at',
      gfr_calculations: '++id, patient_id, calculation_date, gfr_value, ckd_stage, created_at',
      dvt_assessments: '++id, patient_id, assessment_date, assessment_type, risk_level, score, status, assessed_by, created_at',
      pressure_sore_assessments: '++id, patient_id, assessment_date, assessment_type, risk_level, score, status, assessed_by, created_at',
      nutritional_assessments: '++id, patient_id, assessment_date, assessment_type, risk_level, score, status, assessed_by, created_at',
      clinical_topics: '++id, title, category, uploadedAt, status, uploadedBy',
      generated_mcqs: '++id, topicId, targetLevel, difficulty, category, generatedAt',
      mcq_test_schedules: '++id, topicId, scheduledFor, status, notificationSent',
      mcq_test_sessions: '++id, userId, scheduleId, topicId, startedAt, completedAt, userLevel',
      study_materials: '++id, sessionId, userId, generatedAt',
      notification_schedules: '++id, userId, scheduleId, scheduledFor, sent, sentAt, type',
      educational_topics: '++id, title, category, uploadedAt, status, uploadedBy, weeklyContentGenerated',
      weekly_contents: '++id, topicId, [topicId+weekNumber+year], weekNumber, year, publishedAt, generatedAt',
      topic_schedules: '++id, topicId, scheduledWeek, status, notificationsSent, createdAt',
      user_progress: '++id, [userId+topicId], userId, topicId, weeklyContentId, readAt, mcqTestTaken',
      users: '++id, role, created_at'
    });

    // Version 6: Add User Management System tables
    this.version(6).stores({
      patients: '++id, serverId, hospital_number, first_name, last_name, created_at, synced, deleted',
      treatment_plans: '++id, serverId, patient_id, title, status, created_at, synced, deleted',
      plan_steps: '++id, serverId, plan_id, step_number, status, due_date, created_at, synced, deleted',
      sync_queue: '++id, action, table, local_id, created_at, retries',
      cmeTopics: '++id, title, category, weekOf, estimatedDuration',
      testSessions: '++id, userId, topicId, startedAt, completedAt',
      cmeProgress: '++id, [userId+topicId], userId, topicId, completed, lastAttempt',
      cmeCertificates: '++id, userId, topicId, issuedAt, validUntil',
      ward_rounds: '++id, date, ward_name, consultant, status, created_at',
      clinic_sessions: '++id, date, clinic_type, consultant, status, created_at',
      surgery_bookings: '++id, date, theatre_number, primary_surgeon, patient_id, status, created_at',
      lab_investigations: '++id, patient_id, request_date, requested_by, status, urgency, created_at',
      lab_results: '++id, investigation_id, patient_id, test_id, result_date, abnormal_flag, created_at',
      gfr_calculations: '++id, patient_id, calculation_date, gfr_value, ckd_stage, created_at',
      dvt_assessments: '++id, patient_id, assessment_date, assessment_type, risk_level, score, status, assessed_by, created_at',
      pressure_sore_assessments: '++id, patient_id, assessment_date, assessment_type, risk_level, score, status, assessed_by, created_at',
      nutritional_assessments: '++id, patient_id, assessment_date, assessment_type, risk_level, score, status, assessed_by, created_at',
      clinical_topics: '++id, title, category, uploadedAt, status, uploadedBy',
      generated_mcqs: '++id, topicId, targetLevel, difficulty, category, generatedAt',
      mcq_test_schedules: '++id, topicId, scheduledFor, status, notificationSent',
      mcq_test_sessions: '++id, userId, scheduleId, topicId, startedAt, completedAt, userLevel',
      study_materials: '++id, sessionId, userId, generatedAt',
      notification_schedules: '++id, userId, scheduleId, scheduledFor, sent, sentAt, type',
      educational_topics: '++id, title, category, uploadedAt, status, uploadedBy, weeklyContentGenerated',
      weekly_contents: '++id, topicId, [topicId+weekNumber+year], weekNumber, year, publishedAt, generatedAt',
      topic_schedules: '++id, topicId, scheduledWeek, status, notificationsSent, createdAt',
      user_progress: '++id, [userId+topicId], userId, topicId, weeklyContentId, readAt, mcqTestTaken',
      users: '++id, role, created_at',
      pending_users: '++id, email, status, requested_at, reviewed_at',
      approved_users: '++id, email, role, is_active, created_at, last_login'
    });

    // Version 7: Add Enhanced Treatment Planning, Patient Summaries, and Paperwork tables
    this.version(7).stores({
      patients: '++id, serverId, hospital_number, first_name, last_name, created_at, synced, deleted',
      treatment_plans: '++id, serverId, patient_id, title, status, created_at, synced, deleted',
      plan_steps: '++id, serverId, plan_id, step_number, status, due_date, created_at, synced, deleted',
      sync_queue: '++id, action, table, local_id, created_at, retries',
      cmeTopics: '++id, title, category, weekOf, estimatedDuration',
      testSessions: '++id, userId, topicId, startedAt, completedAt',
      cmeProgress: '++id, [userId+topicId], userId, topicId, completed, lastAttempt',
      cmeCertificates: '++id, userId, topicId, issuedAt, validUntil',
      ward_rounds: '++id, date, ward_name, consultant, status, created_at',
      clinic_sessions: '++id, date, clinic_type, consultant, status, created_at',
      surgery_bookings: '++id, date, theatre_number, primary_surgeon, patient_id, status, created_at',
      lab_investigations: '++id, patient_id, request_date, requested_by, status, urgency, created_at',
      lab_results: '++id, investigation_id, patient_id, test_id, result_date, abnormal_flag, created_at',
      gfr_calculations: '++id, patient_id, calculation_date, gfr_value, ckd_stage, created_at',
      dvt_assessments: '++id, patient_id, assessment_date, assessment_type, risk_level, score, status, assessed_by, created_at',
      pressure_sore_assessments: '++id, patient_id, assessment_date, assessment_type, risk_level, score, status, assessed_by, created_at',
      nutritional_assessments: '++id, patient_id, assessment_date, assessment_type, risk_level, score, status, assessed_by, created_at',
      clinical_topics: '++id, title, category, uploadedAt, status, uploadedBy',
      generated_mcqs: '++id, topicId, targetLevel, difficulty, category, generatedAt',
      mcq_test_schedules: '++id, topicId, scheduledFor, status, notificationSent',
      mcq_test_sessions: '++id, userId, scheduleId, topicId, startedAt, completedAt, userLevel',
      study_materials: '++id, sessionId, userId, generatedAt',
      notification_schedules: '++id, userId, scheduleId, scheduledFor, sent, sentAt, type',
      educational_topics: '++id, title, category, uploadedAt, status, uploadedBy, weeklyContentGenerated',
      weekly_contents: '++id, topicId, [topicId+weekNumber+year], weekNumber, year, publishedAt, generatedAt',
      topic_schedules: '++id, topicId, scheduledWeek, status, notificationsSent, createdAt',
      user_progress: '++id, [userId+topicId], userId, topicId, weeklyContentId, readAt, mcqTestTaken',
      users: '++id, role, created_at',
      pending_users: '++id, email, status, requested_at, reviewed_at',
      approved_users: '++id, email, role, is_active, created_at, last_login',
      patient_summaries: '++id, patient_id, admission_date, generated_at, generated_by',
      paperwork_documents: '++id, patient_id, type, status, created_at, created_by'
    });

    // Version 8: Add MDT (Multidisciplinary Team) tables
    this.version(8).stores({
      patients: '++id, serverId, hospital_number, first_name, last_name, created_at, synced, deleted',
      treatment_plans: '++id, serverId, patient_id, title, status, created_at, synced, deleted',
      plan_steps: '++id, serverId, plan_id, step_number, status, due_date, created_at, synced, deleted',
      sync_queue: '++id, action, table, local_id, created_at, retries',
      cmeTopics: '++id, title, category, weekOf, estimatedDuration',
      testSessions: '++id, userId, topicId, startedAt, completedAt',
      cmeProgress: '++id, [userId+topicId], userId, topicId, completed, lastAttempt',
      cmeCertificates: '++id, userId, topicId, issuedAt, validUntil',
      ward_rounds: '++id, date, ward_name, consultant, status, created_at',
      clinic_sessions: '++id, date, clinic_type, consultant, status, created_at',
      surgery_bookings: '++id, date, theatre_number, primary_surgeon, patient_id, status, created_at',
      lab_investigations: '++id, patient_id, request_date, requested_by, status, urgency, created_at',
      lab_results: '++id, investigation_id, patient_id, test_id, result_date, abnormal_flag, created_at',
      gfr_calculations: '++id, patient_id, calculation_date, gfr_value, ckd_stage, created_at',
      dvt_assessments: '++id, patient_id, assessment_date, assessment_type, risk_level, score, status, assessed_by, created_at',
      pressure_sore_assessments: '++id, patient_id, assessment_date, assessment_type, risk_level, score, status, assessed_by, created_at',
      nutritional_assessments: '++id, patient_id, assessment_date, assessment_type, risk_level, score, status, assessed_by, created_at',
      clinical_topics: '++id, title, category, uploadedAt, status, uploadedBy',
      generated_mcqs: '++id, topicId, targetLevel, difficulty, category, generatedAt',
      mcq_test_schedules: '++id, topicId, scheduledFor, status, notificationSent',
      mcq_test_sessions: '++id, userId, scheduleId, topicId, startedAt, completedAt, userLevel',
      study_materials: '++id, sessionId, userId, generatedAt',
      notification_schedules: '++id, userId, scheduleId, scheduledFor, sent, sentAt, type',
      educational_topics: '++id, title, category, uploadedAt, status, uploadedBy, weeklyContentGenerated',
      weekly_contents: '++id, topicId, [topicId+weekNumber+year], weekNumber, year, publishedAt, generatedAt',
      topic_schedules: '++id, topicId, scheduledWeek, status, notificationsSent, createdAt',
      user_progress: '++id, [userId+topicId], userId, topicId, weeklyContentId, readAt, mcqTestTaken',
      users: '++id, role, created_at',
      pending_users: '++id, email, status, requested_at, reviewed_at',
      approved_users: '++id, email, role, is_active, created_at, last_login',
      patient_summaries: '++id, patient_id, admission_date, generated_at, generated_by',
      paperwork_documents: '++id, patient_id, type, status, created_at, created_by',
      mdt_patient_teams: '++id, patient_id, hospital_number, is_active, created_at',
      mdt_meetings: '++id, patient_id, meeting_date, status, created_at, created_by',
      mdt_contact_logs: '++id, patient_id, specialty_id, contact_date, follow_up_required, created_at'
    });

    // Version 9: Add Admissions and Discharges tables
    this.version(9).stores({
      patients: '++id, serverId, hospital_number, first_name, last_name, created_at, synced, deleted',
      treatment_plans: '++id, serverId, patient_id, title, status, created_at, synced, deleted',
      plan_steps: '++id, serverId, plan_id, step_number, status, due_date, created_at, synced, deleted',
      sync_queue: '++id, action, table, local_id, created_at, retries',
      cmeTopics: '++id, title, category, weekOf, estimatedDuration',
      testSessions: '++id, userId, topicId, startedAt, completedAt',
      cmeProgress: '++id, [userId+topicId], userId, topicId, completed, lastAttempt',
      cmeCertificates: '++id, userId, topicId, issuedAt, validUntil',
      ward_rounds: '++id, date, ward_name, consultant, status, created_at',
      clinic_sessions: '++id, date, clinic_type, consultant, status, created_at',
      surgery_bookings: '++id, date, theatre_number, primary_surgeon, patient_id, status, created_at',
      lab_investigations: '++id, patient_id, request_date, requested_by, status, urgency, created_at',
      lab_results: '++id, investigation_id, patient_id, test_id, result_date, abnormal_flag, created_at',
      gfr_calculations: '++id, patient_id, calculation_date, gfr_value, ckd_stage, created_at',
      dvt_assessments: '++id, patient_id, assessment_date, assessment_type, risk_level, score, status, assessed_by, created_at',
      pressure_sore_assessments: '++id, patient_id, assessment_date, assessment_type, risk_level, score, status, assessed_by, created_at',
      nutritional_assessments: '++id, patient_id, assessment_date, assessment_type, risk_level, score, status, assessed_by, created_at',
      clinical_topics: '++id, title, category, uploadedAt, status, uploadedBy',
      generated_mcqs: '++id, topicId, targetLevel, difficulty, category, generatedAt',
      mcq_test_schedules: '++id, topicId, scheduledFor, status, notificationSent',
      mcq_test_sessions: '++id, userId, scheduleId, topicId, startedAt, completedAt, userLevel',
      study_materials: '++id, sessionId, userId, generatedAt',
      notification_schedules: '++id, userId, scheduleId, scheduledFor, sent, sentAt, type',
      educational_topics: '++id, title, category, uploadedAt, status, uploadedBy, weeklyContentGenerated',
      weekly_contents: '++id, topicId, [topicId+weekNumber+year], weekNumber, year, publishedAt, generatedAt',
      topic_schedules: '++id, topicId, scheduledWeek, status, notificationsSent, createdAt',
      user_progress: '++id, [userId+topicId], userId, topicId, weeklyContentId, readAt, mcqTestTaken',
      users: '++id, role, created_at',
      pending_users: '++id, email, status, requested_at, reviewed_at',
      approved_users: '++id, email, role, is_active, created_at, last_login',
      patient_summaries: '++id, patient_id, admission_date, generated_at, generated_by',
      paperwork_documents: '++id, patient_id, type, status, created_at, created_by',
      mdt_patient_teams: '++id, patient_id, hospital_number, is_active, created_at',
      mdt_meetings: '++id, patient_id, meeting_date, status, created_at, created_by',
      mdt_contact_logs: '++id, patient_id, specialty_id, contact_date, follow_up_required, created_at',
      admissions: '++id, patient_id, hospital_number, admission_date, ward_location, route_of_admission, status, created_at',
      discharges: '++id, admission_id, patient_id, hospital_number, discharge_date, discharge_status, created_at'
    });

    // Version 10: Add CME WACS Articles and Reading Progress tables
    this.version(10).stores({
      patients: '++id, serverId, hospital_number, first_name, last_name, created_at, synced, deleted',
      treatment_plans: '++id, serverId, patient_id, title, status, created_at, synced, deleted',
      plan_steps: '++id, serverId, plan_id, step_number, status, due_date, created_at, synced, deleted',
      sync_queue: '++id, action, table, local_id, created_at, retries',
      cmeTopics: '++id, title, category, weekOf, estimatedDuration',
      testSessions: '++id, userId, topicId, startedAt, completedAt',
      cmeProgress: '++id, [userId+topicId], userId, topicId, completed, lastAttempt',
      cmeCertificates: '++id, userId, topicId, issuedAt, validUntil',
      ward_rounds: '++id, date, ward_name, consultant, status, created_at',
      clinic_sessions: '++id, date, clinic_type, consultant, status, created_at',
      surgery_bookings: '++id, date, theatre_number, primary_surgeon, patient_id, status, created_at',
      lab_investigations: '++id, patient_id, request_date, requested_by, status, urgency, created_at',
      lab_results: '++id, investigation_id, patient_id, test_id, result_date, abnormal_flag, created_at',
      gfr_calculations: '++id, patient_id, calculation_date, gfr_value, ckd_stage, created_at',
      dvt_assessments: '++id, patient_id, assessment_date, assessment_type, risk_level, score, status, assessed_by, created_at',
      pressure_sore_assessments: '++id, patient_id, assessment_date, assessment_type, risk_level, score, status, assessed_by, created_at',
      nutritional_assessments: '++id, patient_id, assessment_date, assessment_type, risk_level, score, status, assessed_by, created_at',
      clinical_topics: '++id, title, category, uploadedAt, status, uploadedBy',
      generated_mcqs: '++id, topicId, targetLevel, difficulty, category, generatedAt',
      mcq_test_schedules: '++id, topicId, scheduledFor, status, notificationSent',
      mcq_test_sessions: '++id, userId, scheduleId, topicId, startedAt, completedAt, userLevel',
      study_materials: '++id, sessionId, userId, generatedAt',
      notification_schedules: '++id, userId, scheduleId, scheduledFor, sent, sentAt, type',
      educational_topics: '++id, title, category, uploadedAt, status, uploadedBy, weeklyContentGenerated',
      weekly_contents: '++id, topicId, [topicId+weekNumber+year], weekNumber, year, publishedAt, generatedAt',
      topic_schedules: '++id, topicId, scheduledWeek, status, notificationsSent, createdAt',
      user_progress: '++id, [userId+topicId], userId, topicId, weeklyContentId, readAt, mcqTestTaken',
      users: '++id, role, created_at',
      pending_users: '++id, email, status, requested_at, reviewed_at',
      approved_users: '++id, email, role, is_active, created_at, last_login',
      patient_summaries: '++id, patient_id, admission_date, generated_at, generated_by',
      paperwork_documents: '++id, patient_id, type, status, created_at, created_by',
      mdt_patient_teams: '++id, patient_id, hospital_number, is_active, created_at',
      mdt_meetings: '++id, patient_id, meeting_date, status, created_at, created_by',
      mdt_contact_logs: '++id, patient_id, specialty_id, contact_date, follow_up_required, created_at',
      admissions: '++id, patient_id, hospital_number, admission_date, ward_location, route_of_admission, status, created_at',
      discharges: '++id, admission_id, patient_id, hospital_number, discharge_date, discharge_status, created_at',
      cme_articles: '++id, topic, category, subcategory, published_date, difficulty_level, view_count, like_count, created_at',
      cme_reading_progress: '++id, [user_id+article_id], user_id, article_id, started_at, completed_at, bookmarked, created_at'
    });

    // Version 11: Add Preoperative Assessment tables
    this.version(11).stores({
      patients: '++id, serverId, hospital_number, first_name, last_name, created_at, synced, deleted',
      treatment_plans: '++id, serverId, patient_id, title, status, created_at, synced, deleted',
      plan_steps: '++id, serverId, plan_id, step_number, status, due_date, created_at, synced, deleted',
      sync_queue: '++id, action, table, local_id, created_at, retries',
      cmeTopics: '++id, title, category, weekOf, estimatedDuration',
      testSessions: '++id, userId, topicId, startedAt, completedAt',
      cmeProgress: '++id, [userId+topicId], userId, topicId, completed, lastAttempt',
      cmeCertificates: '++id, userId, topicId, issuedAt, validUntil',
      ward_rounds: '++id, date, ward_name, consultant, status, created_at',
      clinic_sessions: '++id, date, clinic_type, consultant, status, created_at',
      surgery_bookings: '++id, date, theatre_number, primary_surgeon, patient_id, status, created_at',
      lab_investigations: '++id, patient_id, request_date, requested_by, status, urgency, created_at',
      lab_results: '++id, investigation_id, patient_id, test_id, result_date, abnormal_flag, created_at',
      gfr_calculations: '++id, patient_id, calculation_date, gfr_value, ckd_stage, created_at',
      dvt_assessments: '++id, patient_id, assessment_date, assessment_type, risk_level, score, status, assessed_by, created_at',
      pressure_sore_assessments: '++id, patient_id, assessment_date, assessment_type, risk_level, score, status, assessed_by, created_at',
      nutritional_assessments: '++id, patient_id, assessment_date, assessment_type, risk_level, score, status, assessed_by, created_at',
      clinical_topics: '++id, title, category, uploadedAt, status, uploadedBy',
      generated_mcqs: '++id, topicId, targetLevel, difficulty, category, generatedAt',
      mcq_test_schedules: '++id, topicId, scheduledFor, status, notificationSent',
      mcq_test_sessions: '++id, userId, scheduleId, topicId, startedAt, completedAt, userLevel',
      study_materials: '++id, sessionId, userId, generatedAt',
      notification_schedules: '++id, userId, scheduleId, scheduledFor, sent, sentAt, type',
      educational_topics: '++id, title, category, uploadedAt, status, uploadedBy, weeklyContentGenerated',
      weekly_contents: '++id, topicId, [topicId+weekNumber+year], weekNumber, year, publishedAt, generatedAt',
      topic_schedules: '++id, topicId, scheduledWeek, status, notificationsSent, createdAt',
      user_progress: '++id, [userId+topicId], userId, topicId, weeklyContentId, readAt, mcqTestTaken',
      users: '++id, role, created_at',
      pending_users: '++id, email, status, requested_at, reviewed_at',
      approved_users: '++id, email, role, is_active, created_at, last_login',
      patient_summaries: '++id, patient_id, admission_date, generated_at, generated_by',
      paperwork_documents: '++id, patient_id, type, status, created_at, created_by',
      mdt_patient_teams: '++id, patient_id, hospital_number, is_active, created_at',
      mdt_meetings: '++id, patient_id, meeting_date, status, created_at, created_by',
      mdt_contact_logs: '++id, patient_id, specialty_id, contact_date, follow_up_required, created_at',
      admissions: '++id, patient_id, hospital_number, admission_date, ward_location, route_of_admission, status, created_at',
      discharges: '++id, admission_id, patient_id, hospital_number, discharge_date, discharge_status, created_at',
      cme_articles: '++id, topic, category, subcategory, published_date, difficulty_level, view_count, like_count, created_at',
      cme_reading_progress: '++id, [user_id+article_id], user_id, article_id, started_at, completed_at, bookmarked, created_at',
      preoperative_assessments: '++id, patient_id, surgery_booking_id, assessed_at, assessed_by, updated_at'
    });

    // Version 12: Add Blood Transfusion Management tables
    this.version(12).stores({
      patients: '++id, serverId, hospital_number, first_name, last_name, created_at, synced, deleted',
      treatment_plans: '++id, serverId, patient_id, title, status, created_at, synced, deleted',
      plan_steps: '++id, serverId, plan_id, step_number, status, due_date, created_at, synced, deleted',
      sync_queue: '++id, action, table, local_id, created_at, retries',
      cmeTopics: '++id, title, category, weekOf, estimatedDuration',
      testSessions: '++id, userId, topicId, startedAt, completedAt',
      cmeProgress: '++id, [userId+topicId], userId, topicId, completed, lastAttempt',
      cmeCertificates: '++id, userId, topicId, issuedAt, validUntil',
      ward_rounds: '++id, date, ward_name, consultant, status, created_at',
      clinic_sessions: '++id, date, clinic_type, consultant, status, created_at',
      surgery_bookings: '++id, date, theatre_number, primary_surgeon, patient_id, status, created_at',
      lab_investigations: '++id, patient_id, request_date, requested_by, status, urgency, created_at',
      lab_results: '++id, investigation_id, patient_id, test_id, result_date, abnormal_flag, created_at',
      gfr_calculations: '++id, patient_id, calculation_date, gfr_value, ckd_stage, created_at',
      dvt_assessments: '++id, patient_id, assessment_date, assessment_type, risk_level, score, status, assessed_by, created_at',
      pressure_sore_assessments: '++id, patient_id, assessment_date, assessment_type, risk_level, score, status, assessed_by, created_at',
      nutritional_assessments: '++id, patient_id, assessment_date, assessment_type, risk_level, score, status, assessed_by, created_at',
      clinical_topics: '++id, title, category, uploadedAt, status, uploadedBy',
      generated_mcqs: '++id, topicId, targetLevel, difficulty, category, generatedAt',
      mcq_test_schedules: '++id, topicId, scheduledFor, status, notificationSent',
      mcq_test_sessions: '++id, userId, scheduleId, topicId, startedAt, completedAt, userLevel',
      study_materials: '++id, sessionId, userId, generatedAt',
      notification_schedules: '++id, userId, scheduleId, scheduledFor, sent, sentAt, type',
      educational_topics: '++id, title, category, uploadedAt, status, uploadedBy, weeklyContentGenerated',
      weekly_contents: '++id, topicId, [topicId+weekNumber+year], weekNumber, year, publishedAt, generatedAt',
      topic_schedules: '++id, topicId, scheduledWeek, status, notificationsSent, createdAt',
      user_progress: '++id, [userId+topicId], userId, topicId, weeklyContentId, readAt, mcqTestTaken',
      users: '++id, role, created_at',
      pending_users: '++id, email, status, requested_at, reviewed_at',
      approved_users: '++id, email, role, is_active, created_at, last_login',
      patient_summaries: '++id, patient_id, admission_date, generated_at, generated_by',
      paperwork_documents: '++id, patient_id, type, status, created_at, created_by',
      mdt_patient_teams: '++id, patient_id, hospital_number, is_active, created_at',
      mdt_meetings: '++id, patient_id, meeting_date, status, created_at, created_by',
      mdt_contact_logs: '++id, patient_id, specialty_id, contact_date, follow_up_required, created_at',
      admissions: '++id, patient_id, hospital_number, admission_date, ward_location, route_of_admission, status, created_at',
      discharges: '++id, admission_id, patient_id, hospital_number, discharge_date, discharge_status, created_at',
      cme_articles: '++id, topic, category, subcategory, published_date, difficulty_level, view_count, like_count, created_at',
      cme_reading_progress: '++id, [user_id+article_id], user_id, article_id, started_at, completed_at, bookmarked, created_at',
      preoperative_assessments: '++id, patient_id, surgery_booking_id, assessed_at, assessed_by, updated_at',
      blood_transfusions: '++id, patient_id, hospital_number, transfusion_date, indication, status, administered_by, created_at',
      transfusion_vitals: '++id, transfusion_id, patient_id, measurement_type, recorded_at, recorded_by',
      transfusion_complications: '++id, transfusion_id, patient_id, complication_type, severity, detected_at, resolved_at'
    });

    // Version 13: Add ward rounds clinical review table
    this.version(13).stores({
      patients: '++id, serverId, hospital_number, first_name, last_name, created_at, synced, deleted',
      treatment_plans: '++id, serverId, patient_id, title, status, created_at, synced, deleted',
      plan_steps: '++id, serverId, plan_id, step_number, status, due_date, created_at, synced, deleted',
      sync_queue: '++id, action, table, local_id, created_at, retries',
      cmeTopics: '++id, title, category, weekOf, estimatedDuration',
      testSessions: '++id, userId, topicId, startedAt, completedAt',
      cmeProgress: '++id, [userId+topicId], userId, topicId, completed, lastAttempt',
      cmeCertificates: '++id, userId, topicId, issuedAt, validUntil',
      ward_rounds: '++id, date, ward_name, consultant, status, created_at',
      clinic_sessions: '++id, date, clinic_type, consultant, status, created_at',
      surgery_bookings: '++id, date, theatre_number, primary_surgeon, patient_id, status, created_at',
      lab_investigations: '++id, patient_id, request_date, requested_by, status, urgency, created_at',
      lab_results: '++id, investigation_id, patient_id, test_id, result_date, abnormal_flag, created_at',
      gfr_calculations: '++id, patient_id, calculation_date, gfr_value, ckd_stage, created_at',
      dvt_assessments: '++id, patient_id, assessment_date, assessment_type, risk_level, score, status, assessed_by, created_at',
      pressure_sore_assessments: '++id, patient_id, assessment_date, assessment_type, risk_level, score, status, assessed_by, created_at',
      nutritional_assessments: '++id, patient_id, assessment_date, assessment_type, risk_level, score, status, assessed_by, created_at',
      clinical_topics: '++id, title, category, uploadedAt, status, uploadedBy',
      generated_mcqs: '++id, topicId, targetLevel, difficulty, category, generatedAt',
      mcq_test_schedules: '++id, topicId, scheduledFor, status, notificationSent',
      mcq_test_sessions: '++id, userId, scheduleId, topicId, startedAt, completedAt, userLevel',
      study_materials: '++id, sessionId, userId, generatedAt',
      notification_schedules: '++id, userId, scheduleId, scheduledFor, sent, sentAt, type',
      educational_topics: '++id, title, category, uploadedAt, status, uploadedBy, weeklyContentGenerated',
      weekly_contents: '++id, topicId, [topicId+weekNumber+year], weekNumber, year, publishedAt, generatedAt',
      topic_schedules: '++id, topicId, scheduledWeek, status, notificationsSent, createdAt',
      user_progress: '++id, [userId+topicId], userId, topicId, weeklyContentId, readAt, mcqTestTaken',
      users: '++id, role, created_at',
      pending_users: '++id, email, status, requested_at, reviewed_at',
      approved_users: '++id, email, role, is_active, created_at, last_login',
      patient_summaries: '++id, patient_id, admission_date, generated_at, generated_by',
      paperwork_documents: '++id, patient_id, type, status, created_at, created_by',
      mdt_patient_teams: '++id, patient_id, hospital_number, is_active, created_at',
      mdt_meetings: '++id, patient_id, meeting_date, status, created_at, created_by',
      mdt_contact_logs: '++id, patient_id, specialty_id, contact_date, follow_up_required, created_at',
      admissions: '++id, patient_id, hospital_number, admission_date, ward_location, route_of_admission, status, created_at',
      discharges: '++id, admission_id, patient_id, hospital_number, discharge_date, discharge_status, created_at',
      cme_articles: '++id, topic, category, subcategory, published_date, difficulty_level, view_count, like_count, created_at',
      cme_reading_progress: '++id, [user_id+article_id], user_id, article_id, started_at, completed_at, bookmarked, created_at',
      preoperative_assessments: '++id, patient_id, surgery_booking_id, assessed_at, assessed_by, updated_at',
      blood_transfusions: '++id, patient_id, hospital_number, transfusion_date, indication, status, administered_by, created_at',
      transfusion_vitals: '++id, transfusion_id, patient_id, measurement_type, recorded_at, recorded_by',
      transfusion_complications: '++id, transfusion_id, patient_id, complication_type, severity, detected_at, resolved_at',
      ward_rounds_clinical: '++id, patient_id, round_date, clinical_status, reviewed_by, created_at',
      user_activities: '++id, user_name, action, patient_id, timestamp, synced'
    });

    // Version 14: Ensure user_activities table is properly created (force schema update)
    this.version(14).stores({
      patients: '++id, serverId, hospital_number, first_name, last_name, created_at, synced, deleted',
      treatment_plans: '++id, serverId, patient_id, title, status, created_at, synced, deleted',
      plan_steps: '++id, serverId, plan_id, step_number, status, due_date, created_at, synced, deleted',
      sync_queue: '++id, action, table, local_id, created_at, retries',
      cmeTopics: '++id, title, category, weekOf, estimatedDuration',
      testSessions: '++id, userId, topicId, startedAt, completedAt',
      cmeProgress: '++id, [userId+topicId], userId, topicId, completed, lastAttempt',
      cmeCertificates: '++id, userId, topicId, issuedAt, validUntil',
      ward_rounds: '++id, date, ward_name, consultant, status, created_at',
      clinic_sessions: '++id, date, clinic_type, consultant, status, created_at',
      surgery_bookings: '++id, date, theatre_number, primary_surgeon, patient_id, status, created_at',
      lab_investigations: '++id, patient_id, request_date, requested_by, status, urgency, created_at',
      lab_results: '++id, investigation_id, patient_id, test_id, result_date, abnormal_flag, created_at',
      gfr_calculations: '++id, patient_id, calculation_date, gfr_value, ckd_stage, created_at',
      dvt_assessments: '++id, patient_id, assessment_date, assessment_type, risk_level, score, status, assessed_by, created_at',
      pressure_sore_assessments: '++id, patient_id, assessment_date, assessment_type, risk_level, score, status, assessed_by, created_at',
      nutritional_assessments: '++id, patient_id, assessment_date, assessment_type, risk_level, score, status, assessed_by, created_at',
      clinical_topics: '++id, title, category, uploadedAt, status, uploadedBy',
      generated_mcqs: '++id, topicId, targetLevel, difficulty, category, generatedAt',
      mcq_test_schedules: '++id, topicId, scheduledFor, status, notificationSent',
      mcq_test_sessions: '++id, userId, scheduleId, topicId, startedAt, completedAt, userLevel',
      study_materials: '++id, sessionId, userId, generatedAt',
      notification_schedules: '++id, userId, scheduleId, scheduledFor, sent, sentAt, type',
      educational_topics: '++id, title, category, uploadedAt, status, uploadedBy, weeklyContentGenerated',
      weekly_contents: '++id, topicId, [topicId+weekNumber+year], weekNumber, year, publishedAt, generatedAt',
      topic_schedules: '++id, topicId, scheduledWeek, status, notificationsSent, createdAt',
      user_progress: '++id, [userId+topicId], userId, topicId, weeklyContentId, readAt, mcqTestTaken',
      users: '++id, role, created_at',
      pending_users: '++id, email, status, requested_at, reviewed_at',
      approved_users: '++id, email, role, is_active, created_at, last_login',
      patient_summaries: '++id, patient_id, admission_date, generated_at, generated_by',
      paperwork_documents: '++id, patient_id, type, status, created_at, created_by',
      mdt_patient_teams: '++id, patient_id, hospital_number, is_active, created_at',
      mdt_meetings: '++id, patient_id, meeting_date, status, created_at, created_by',
      mdt_contact_logs: '++id, patient_id, specialty_id, contact_date, follow_up_required, created_at',
      admissions: '++id, patient_id, hospital_number, admission_date, ward_location, route_of_admission, status, created_at',
      discharges: '++id, admission_id, patient_id, hospital_number, discharge_date, discharge_status, created_at',
      cme_articles: '++id, topic, category, subcategory, published_date, difficulty_level, view_count, like_count, created_at',
      cme_reading_progress: '++id, [user_id+article_id], user_id, article_id, started_at, completed_at, bookmarked, created_at',
      preoperative_assessments: '++id, patient_id, surgery_booking_id, assessed_at, assessed_by, updated_at',
      blood_transfusions: '++id, patient_id, hospital_number, transfusion_date, indication, status, administered_by, created_at',
      transfusion_vitals: '++id, transfusion_id, patient_id, measurement_type, recorded_at, recorded_by',
      transfusion_complications: '++id, transfusion_id, patient_id, complication_type, severity, detected_at, resolved_at',
      ward_rounds_clinical: '++id, patient_id, round_date, clinical_status, reviewed_by, created_at',
      user_activities: '++id, user_name, action, patient_id, timestamp, synced'
    });

    // Version 15: Add all missing tables for comprehensive clinical modules
    this.version(15).stores({
      patients: '++id, serverId, hospital_number, first_name, last_name, created_at, synced, deleted',
      treatment_plans: '++id, serverId, patient_id, title, status, created_at, synced, deleted',
      plan_steps: '++id, serverId, plan_id, step_number, status, due_date, created_at, synced, deleted',
      sync_queue: '++id, action, table, local_id, created_at, retries',
      cmeTopics: '++id, title, category, weekOf, estimatedDuration',
      testSessions: '++id, userId, topicId, startedAt, completedAt',
      cmeProgress: '++id, [userId+topicId], userId, topicId, completed, lastAttempt',
      cmeCertificates: '++id, userId, topicId, issuedAt, validUntil',
      ward_rounds: '++id, date, ward_name, consultant, status, created_at',
      clinic_sessions: '++id, date, clinic_type, consultant, status, created_at',
      surgery_bookings: '++id, date, theatre_number, primary_surgeon, patient_id, status, created_at',
      lab_investigations: '++id, patient_id, request_date, requested_by, status, urgency, created_at',
      lab_results: '++id, investigation_id, patient_id, test_id, result_date, abnormal_flag, created_at',
      gfr_calculations: '++id, patient_id, calculation_date, gfr_value, ckd_stage, created_at',
      dvt_assessments: '++id, patient_id, assessment_date, assessment_type, risk_level, score, status, assessed_by, created_at',
      pressure_sore_assessments: '++id, patient_id, assessment_date, assessment_type, risk_level, score, status, assessed_by, created_at',
      nutritional_assessments: '++id, patient_id, assessment_date, assessment_type, risk_level, score, status, assessed_by, created_at',
      clinical_topics: '++id, title, category, uploadedAt, status, uploadedBy',
      generated_mcqs: '++id, topicId, targetLevel, difficulty, category, generatedAt',
      mcq_test_schedules: '++id, topicId, scheduledFor, status, notificationSent',
      mcq_test_sessions: '++id, userId, scheduleId, topicId, startedAt, completedAt, userLevel',
      study_materials: '++id, sessionId, userId, generatedAt',
      notification_schedules: '++id, userId, scheduleId, scheduledFor, sent, sentAt, type',
      educational_topics: '++id, title, category, uploadedAt, status, uploadedBy, weeklyContentGenerated',
      weekly_contents: '++id, topicId, [topicId+weekNumber+year], weekNumber, year, publishedAt, generatedAt',
      topic_schedules: '++id, topicId, scheduledWeek, status, notificationsSent, createdAt',
      user_progress: '++id, [userId+topicId], userId, topicId, weeklyContentId, readAt, mcqTestTaken',
      users: '++id, role, created_at',
      pending_users: '++id, email, status, requested_at, reviewed_at',
      approved_users: '++id, email, role, is_active, created_at, last_login',
      patient_summaries: '++id, patient_id, admission_date, generated_at, generated_by',
      paperwork_documents: '++id, patient_id, type, status, created_at, created_by',
      mdt_patient_teams: '++id, patient_id, hospital_number, is_active, created_at',
      mdt_meetings: '++id, patient_id, meeting_date, status, created_at, created_by',
      mdt_contact_logs: '++id, patient_id, specialty_id, contact_date, follow_up_required, created_at',
      admissions: '++id, patient_id, hospital_number, admission_date, ward_location, route_of_admission, status, created_at',
      discharges: '++id, admission_id, patient_id, hospital_number, discharge_date, discharge_status, created_at',
      cme_articles: '++id, topic, category, subcategory, published_date, difficulty_level, view_count, like_count, created_at',
      cme_reading_progress: '++id, [user_id+article_id], user_id, article_id, started_at, completed_at, bookmarked, created_at',
      preoperative_assessments: '++id, patient_id, surgery_booking_id, assessed_at, assessed_by, updated_at',
      blood_transfusions: '++id, patient_id, hospital_number, transfusion_date, indication, status, administered_by, created_at',
      transfusion_vitals: '++id, transfusion_id, patient_id, measurement_type, recorded_at, recorded_by',
      transfusion_complications: '++id, transfusion_id, patient_id, complication_type, severity, detected_at, resolved_at',
      ward_rounds_clinical: '++id, patient_id, round_date, clinical_status, reviewed_by, created_at',
      user_activities: '++id, user_name, action, patient_id, timestamp, synced',
      // New tables for comprehensive clinical modules
      prescriptions: '++id, patient_id, medication_name, dosage, frequency, route, prescribed_by, prescribed_date, status, created_at',
      wound_care: '++id, patient_id, wound_type, wound_location, wound_stage, assessment_date, assessed_by, created_at',
      diabetic_foot_assessments: '++id, patient_id, assessment_date, wagner_grade, texas_stage, wifi_score, total_score, risk_category, status, assessed_by, created_at',
      burn_patients: '++id, patient_id, admission_date, tbsa_percentage, mechanism, baux_score, disposition, status, created_at',
      cbt_tests: '++id, test_number, level, title, scheduled_day, duration, total_marks, pass_mark, created_at',
      cbt_attempts: '++id, test_id, user_id, level, start_time, end_time, score, passed, completed, created_at',
      cbt_progress: '++id, user_id, level, total_tests, completed_tests, average_score, updated_at',
      performance_metrics: '++id, user_id, level, cbt_score, patient_care_score, duty_score, attendance_score, overall_score, calculated_at',
      activity_logs: '++id, user_id, type, description, points, timestamp, created_at',
      duty_assignments: '++id, user_id, title, assigned_at, due_at, status, priority, promptness_score, created_at',
      rotation_records: '++id, user_id, level, start_date, expected_end_date, actual_end_date, status, extension_count, created_at',
      chat_messages: '++id, room_id, sender_id, content, type, timestamp, is_read, created_at',
      chat_rooms: '++id, name, type, patient_id, is_active, created_at, updated_at',
      video_conferences: '++id, room_id, patient_id, host_id, status, started_at, ended_at, created_at',
      who_safety_checklists: '++id, procedure_id, patient_id, phase, overall_completion, created_at, updated_at',
      procedures: '++id, patient_id, procedure_name, procedure_type, scheduled_date, surgeon, status, created_at',
      system_settings: '++id, key, value, updated_by, updated_at',
      system_logs: '++id, level, category, message, user_id, timestamp',
      backup_records: '++id, backup_name, backup_type, file_size, status, created_by, created_at'
    });

    // Version 16: Add patient_assignments table for automatic team assignment
    this.version(16).stores({
      patients: '++id, serverId, hospital_number, first_name, last_name, created_at, synced, deleted',
      treatment_plans: '++id, serverId, patient_id, title, status, created_at, synced, deleted',
      plan_steps: '++id, serverId, plan_id, step_number, status, due_date, created_at, synced, deleted',
      sync_queue: '++id, action, table, local_id, created_at, retries',
      cmeTopics: '++id, title, category, weekOf, estimatedDuration',
      testSessions: '++id, userId, topicId, startedAt, completedAt',
      cmeProgress: '++id, [userId+topicId], userId, topicId, completed, lastAttempt',
      cmeCertificates: '++id, userId, topicId, issuedAt, validUntil',
      ward_rounds: '++id, date, ward_name, consultant, status, created_at',
      clinic_sessions: '++id, date, clinic_type, consultant, status, created_at',
      surgery_bookings: '++id, date, theatre_number, primary_surgeon, patient_id, status, created_at',
      lab_investigations: '++id, patient_id, request_date, requested_by, status, urgency, created_at',
      lab_results: '++id, investigation_id, patient_id, test_id, result_date, abnormal_flag, created_at',
      gfr_calculations: '++id, patient_id, calculation_date, gfr_value, ckd_stage, created_at',
      dvt_assessments: '++id, patient_id, assessment_date, assessment_type, risk_level, score, status, assessed_by, created_at',
      pressure_sore_assessments: '++id, patient_id, assessment_date, assessment_type, risk_level, score, status, assessed_by, created_at',
      nutritional_assessments: '++id, patient_id, assessment_date, assessment_type, risk_level, score, status, assessed_by, created_at',
      clinical_topics: '++id, title, category, uploadedAt, status, uploadedBy',
      generated_mcqs: '++id, topicId, targetLevel, difficulty, category, generatedAt',
      mcq_test_schedules: '++id, topicId, scheduledFor, status, notificationSent',
      mcq_test_sessions: '++id, userId, scheduleId, topicId, startedAt, completedAt, userLevel',
      study_materials: '++id, sessionId, userId, generatedAt',
      notification_schedules: '++id, userId, scheduleId, scheduledFor, sent, sentAt, type',
      educational_topics: '++id, title, category, uploadedAt, status, uploadedBy, weeklyContentGenerated',
      weekly_contents: '++id, topicId, [topicId+weekNumber+year], weekNumber, year, publishedAt, generatedAt',
      topic_schedules: '++id, topicId, scheduledWeek, status, notificationsSent, createdAt',
      user_progress: '++id, [userId+topicId], userId, topicId, weeklyContentId, readAt, mcqTestTaken',
      users: '++id, role, created_at',
      pending_users: '++id, email, status, requested_at, reviewed_at',
      approved_users: '++id, email, role, is_active, created_at, last_login',
      patient_summaries: '++id, patient_id, admission_date, generated_at, generated_by',
      paperwork_documents: '++id, patient_id, type, status, created_at, created_by',
      mdt_patient_teams: '++id, patient_id, hospital_number, is_active, created_at',
      mdt_meetings: '++id, patient_id, meeting_date, status, created_at, created_by',
      mdt_contact_logs: '++id, patient_id, specialty_id, contact_date, follow_up_required, created_at',
      admissions: '++id, patient_id, hospital_number, admission_date, ward_location, route_of_admission, status, created_at',
      discharges: '++id, admission_id, patient_id, hospital_number, discharge_date, discharge_status, created_at',
      cme_articles: '++id, topic, category, subcategory, published_date, difficulty_level, view_count, like_count, created_at',
      cme_reading_progress: '++id, [user_id+article_id], user_id, article_id, started_at, completed_at, bookmarked, created_at',
      preoperative_assessments: '++id, patient_id, surgery_booking_id, assessed_at, assessed_by, updated_at',
      blood_transfusions: '++id, patient_id, hospital_number, transfusion_date, indication, status, administered_by, created_at',
      transfusion_vitals: '++id, transfusion_id, patient_id, measurement_type, recorded_at, recorded_by',
      transfusion_complications: '++id, transfusion_id, patient_id, complication_type, severity, detected_at, resolved_at',
      ward_rounds_clinical: '++id, patient_id, round_date, clinical_status, reviewed_by, created_at',
      user_activities: '++id, user_name, action, patient_id, timestamp, synced',
      prescriptions: '++id, patient_id, medication_name, dosage, frequency, route, prescribed_by, prescribed_date, status, created_at',
      wound_care: '++id, patient_id, wound_type, wound_location, wound_stage, assessment_date, assessed_by, created_at',
      diabetic_foot_assessments: '++id, patient_id, assessment_date, wagner_grade, texas_stage, wifi_score, total_score, risk_category, status, assessed_by, created_at',
      burn_patients: '++id, patient_id, admission_date, tbsa_percentage, mechanism, baux_score, disposition, status, created_at',
      cbt_tests: '++id, test_number, level, title, scheduled_day, duration, total_marks, pass_mark, created_at',
      cbt_attempts: '++id, test_id, user_id, level, start_time, end_time, score, passed, completed, created_at',
      cbt_progress: '++id, user_id, level, total_tests, completed_tests, average_score, updated_at',
      performance_metrics: '++id, user_id, level, cbt_score, patient_care_score, duty_score, attendance_score, overall_score, calculated_at',
      activity_logs: '++id, user_id, type, description, points, timestamp, created_at',
      duty_assignments: '++id, user_id, title, assigned_at, due_at, status, priority, promptness_score, created_at',
      rotation_records: '++id, user_id, level, start_date, expected_end_date, actual_end_date, status, extension_count, created_at',
      chat_messages: '++id, room_id, sender_id, content, type, timestamp, is_read, created_at',
      chat_rooms: '++id, name, type, patient_id, is_active, created_at, updated_at',
      video_conferences: '++id, room_id, patient_id, host_id, status, started_at, ended_at, created_at',
      who_safety_checklists: '++id, procedure_id, patient_id, phase, overall_completion, created_at, updated_at',
      procedures: '++id, patient_id, procedure_name, procedure_type, scheduled_date, surgeon, status, created_at',
      system_settings: '++id, key, value, updated_by, updated_at',
      system_logs: '++id, level, category, message, user_id, timestamp',
      backup_records: '++id, backup_name, backup_type, file_size, status, created_by, created_at',
      patient_assignments: '++id, patient_id, hospital_number, consultant_id, senior_registrar_id, registrar_id, house_officer_id, admission_type, assigned_at, is_active'
    });

    // Version 17: Add pushSubscriptions table for push notifications
    this.version(17).stores({
      patients: '++id, serverId, hospital_number, first_name, last_name, created_at, synced, deleted',
      treatment_plans: '++id, serverId, patient_id, title, status, created_at, synced, deleted',
      plan_steps: '++id, serverId, plan_id, step_number, status, due_date, created_at, synced, deleted',
      sync_queue: '++id, action, table, local_id, created_at, retries',
      cmeTopics: '++id, title, category, weekOf, estimatedDuration',
      testSessions: '++id, userId, topicId, startedAt, completedAt',
      cmeProgress: '++id, [userId+topicId], userId, topicId, completed, lastAttempt',
      cmeCertificates: '++id, userId, topicId, issuedAt, validUntil',
      ward_rounds: '++id, date, ward_name, consultant, status, created_at',
      clinic_sessions: '++id, date, clinic_type, consultant, status, created_at',
      surgery_bookings: '++id, date, theatre_number, primary_surgeon, patient_id, status, created_at',
      lab_investigations: '++id, patient_id, request_date, requested_by, status, urgency, created_at',
      lab_results: '++id, investigation_id, patient_id, test_id, result_date, abnormal_flag, created_at',
      gfr_calculations: '++id, patient_id, calculation_date, gfr_value, ckd_stage, created_at',
      dvt_assessments: '++id, patient_id, assessment_date, assessment_type, risk_level, score, status, assessed_by, created_at',
      pressure_sore_assessments: '++id, patient_id, assessment_date, assessment_type, risk_level, score, status, assessed_by, created_at',
      nutritional_assessments: '++id, patient_id, assessment_date, assessment_type, risk_level, score, status, assessed_by, created_at',
      clinical_topics: '++id, title, category, uploadedAt, status, uploadedBy',
      generated_mcqs: '++id, topicId, targetLevel, difficulty, category, generatedAt',
      mcq_test_schedules: '++id, topicId, scheduledFor, status, notificationSent',
      mcq_test_sessions: '++id, userId, scheduleId, topicId, startedAt, completedAt, userLevel',
      study_materials: '++id, sessionId, userId, generatedAt',
      notification_schedules: '++id, userId, scheduleId, scheduledFor, sent, sentAt, type',
      educational_topics: '++id, title, category, uploadedAt, status, uploadedBy, weeklyContentGenerated',
      weekly_contents: '++id, topicId, [topicId+weekNumber+year], weekNumber, year, publishedAt, generatedAt',
      topic_schedules: '++id, topicId, scheduledWeek, status, notificationsSent, createdAt',
      user_progress: '++id, [userId+topicId], userId, topicId, weeklyContentId, readAt, mcqTestTaken',
      users: '++id, role, created_at',
      pending_users: '++id, email, status, requested_at, reviewed_at',
      approved_users: '++id, email, role, is_active, created_at, last_login',
      patient_summaries: '++id, patient_id, admission_date, generated_at, generated_by',
      paperwork_documents: '++id, patient_id, type, status, created_at, created_by',
      mdt_patient_teams: '++id, patient_id, hospital_number, is_active, created_at',
      mdt_meetings: '++id, patient_id, meeting_date, status, created_at, created_by',
      mdt_contact_logs: '++id, patient_id, specialty_id, contact_date, follow_up_required, created_at',
      admissions: '++id, patient_id, hospital_number, admission_date, ward_location, route_of_admission, status, created_at',
      discharges: '++id, admission_id, patient_id, hospital_number, discharge_date, discharge_status, created_at',
      cme_articles: '++id, topic, category, subcategory, published_date, difficulty_level, view_count, like_count, created_at',
      cme_reading_progress: '++id, [user_id+article_id], user_id, article_id, started_at, completed_at, bookmarked, created_at',
      preoperative_assessments: '++id, patient_id, surgery_booking_id, assessed_at, assessed_by, updated_at',
      blood_transfusions: '++id, patient_id, hospital_number, transfusion_date, indication, status, administered_by, created_at',
      transfusion_vitals: '++id, transfusion_id, patient_id, measurement_type, recorded_at, recorded_by',
      transfusion_complications: '++id, transfusion_id, patient_id, complication_type, severity, detected_at, resolved_at',
      ward_rounds_clinical: '++id, patient_id, round_date, clinical_status, reviewed_by, created_at',
      user_activities: '++id, user_name, action, patient_id, timestamp, synced',
      prescriptions: '++id, patient_id, medication_name, dosage, frequency, route, prescribed_by, prescribed_date, status, created_at',
      wound_care: '++id, patient_id, wound_type, wound_location, wound_stage, assessment_date, assessed_by, created_at',
      diabetic_foot_assessments: '++id, patient_id, assessment_date, wagner_grade, texas_stage, wifi_score, total_score, risk_category, status, assessed_by, created_at',
      burn_patients: '++id, patient_id, admission_date, tbsa_percentage, mechanism, baux_score, disposition, status, created_at',
      cbt_tests: '++id, test_number, level, title, scheduled_day, duration, total_marks, pass_mark, created_at',
      cbt_attempts: '++id, test_id, user_id, level, start_time, end_time, score, passed, completed, created_at',
      cbt_progress: '++id, user_id, level, total_tests, completed_tests, average_score, updated_at',
      performance_metrics: '++id, user_id, level, cbt_score, patient_care_score, duty_score, attendance_score, overall_score, calculated_at',
      activity_logs: '++id, user_id, type, description, points, timestamp, created_at',
      duty_assignments: '++id, user_id, title, assigned_at, due_at, status, priority, promptness_score, created_at',
      rotation_records: '++id, user_id, level, start_date, expected_end_date, actual_end_date, status, extension_count, created_at',
      chat_messages: '++id, room_id, sender_id, content, type, timestamp, is_read, created_at',
      chat_rooms: '++id, name, type, patient_id, is_active, created_at, updated_at',
      video_conferences: '++id, room_id, patient_id, host_id, status, started_at, ended_at, created_at',
      who_safety_checklists: '++id, procedure_id, patient_id, phase, overall_completion, created_at, updated_at',
      procedures: '++id, patient_id, procedure_name, procedure_type, scheduled_date, surgeon, status, created_at',
      system_settings: '++id, key, value, updated_by, updated_at',
      system_logs: '++id, level, category, message, user_id, timestamp',
      backup_records: '++id, backup_name, backup_type, file_size, status, created_by, created_at',
      patient_assignments: '++id, patient_id, hospital_number, consultant_id, senior_registrar_id, registrar_id, house_officer_id, admission_type, assigned_at, is_active',
      pushSubscriptions: '++id, user_id, endpoint, created_at'
    });

    // Version 18: Add audit logging and security improvements
    this.version(18).stores({
      patients: '++id, serverId, hospital_number, first_name, last_name, created_at, synced, deleted',
      treatment_plans: '++id, serverId, patient_id, title, status, created_at, synced, deleted',
      plan_steps: '++id, serverId, plan_id, step_number, status, due_date, created_at, synced, deleted',
      sync_queue: '++id, action, table, local_id, created_at, retries',
      cmeTopics: '++id, title, category, weekOf, estimatedDuration',
      testSessions: '++id, userId, topicId, startedAt, completedAt',
      cmeProgress: '++id, [userId+topicId], userId, topicId, completed, lastAttempt',
      cmeCertificates: '++id, userId, topicId, issuedAt, validUntil',
      ward_rounds: '++id, date, ward_name, consultant, status, created_at',
      clinic_sessions: '++id, date, clinic_type, consultant, status, created_at',
      surgery_bookings: '++id, date, theatre_number, primary_surgeon, patient_id, status, created_at',
      lab_investigations: '++id, patient_id, request_date, requested_by, status, urgency, created_at',
      lab_results: '++id, investigation_id, patient_id, test_id, result_date, abnormal_flag, created_at',
      gfr_calculations: '++id, patient_id, calculation_date, gfr_value, ckd_stage, created_at',
      dvt_assessments: '++id, patient_id, assessment_date, assessment_type, risk_level, score, status, assessed_by, created_at',
      pressure_sore_assessments: '++id, patient_id, assessment_date, assessment_type, risk_level, score, status, assessed_by, created_at',
      nutritional_assessments: '++id, patient_id, assessment_date, assessment_type, risk_level, score, status, assessed_by, created_at',
      clinical_topics: '++id, title, category, uploadedAt, status, uploadedBy',
      generated_mcqs: '++id, topicId, targetLevel, difficulty, category, generatedAt',
      mcq_test_schedules: '++id, topicId, scheduledFor, status, notificationSent',
      mcq_test_sessions: '++id, userId, scheduleId, topicId, startedAt, completedAt, userLevel',
      study_materials: '++id, sessionId, userId, generatedAt',
      notification_schedules: '++id, userId, scheduleId, scheduledFor, sent, sentAt, type',
      educational_topics: '++id, title, category, uploadedAt, status, uploadedBy, weeklyContentGenerated',
      weekly_contents: '++id, topicId, [topicId+weekNumber+year], weekNumber, year, publishedAt, generatedAt',
      topic_schedules: '++id, topicId, scheduledWeek, status, notificationsSent, createdAt',
      user_progress: '++id, [userId+topicId], userId, topicId, weeklyContentId, readAt, mcqTestTaken',
      users: '++id, role, created_at',
      pending_users: '++id, email, status, requested_at, reviewed_at',
      approved_users: '++id, email, role, is_active, created_at, last_login',
      patient_summaries: '++id, patient_id, admission_date, generated_at, generated_by',
      paperwork_documents: '++id, patient_id, type, status, created_at, created_by',
      mdt_patient_teams: '++id, patient_id, hospital_number, is_active, created_at',
      mdt_meetings: '++id, patient_id, meeting_date, status, created_at, created_by',
      mdt_contact_logs: '++id, patient_id, specialty_id, contact_date, follow_up_required, created_at',
      admissions: '++id, patient_id, hospital_number, admission_date, ward_location, route_of_admission, status, created_at',
      discharges: '++id, admission_id, patient_id, hospital_number, discharge_date, discharge_status, created_at',
      cme_articles: '++id, topic, category, subcategory, published_date, difficulty_level, view_count, like_count, created_at',
      cme_reading_progress: '++id, [user_id+article_id], user_id, article_id, started_at, completed_at, bookmarked, created_at',
      preoperative_assessments: '++id, patient_id, surgery_booking_id, assessed_at, assessed_by, updated_at',
      blood_transfusions: '++id, patient_id, hospital_number, transfusion_date, indication, status, administered_by, created_at',
      transfusion_vitals: '++id, transfusion_id, patient_id, measurement_type, recorded_at, recorded_by',
      transfusion_complications: '++id, transfusion_id, patient_id, complication_type, severity, detected_at, resolved_at',
      ward_rounds_clinical: '++id, patient_id, round_date, clinical_status, reviewed_by, created_at',
      user_activities: '++id, user_name, action, patient_id, timestamp, synced',
      prescriptions: '++id, patient_id, medication_name, dosage, frequency, route, prescribed_by, prescribed_date, status, created_at',
      wound_care: '++id, patient_id, wound_type, wound_location, wound_stage, assessment_date, assessed_by, created_at',
      diabetic_foot_assessments: '++id, patient_id, assessment_date, wagner_grade, texas_stage, wifi_score, total_score, risk_category, status, assessed_by, created_at',
      burn_patients: '++id, patient_id, admission_date, tbsa_percentage, mechanism, baux_score, disposition, status, created_at',
      cbt_tests: '++id, test_number, level, title, scheduled_day, duration, total_marks, pass_mark, created_at',
      cbt_attempts: '++id, test_id, user_id, level, start_time, end_time, score, passed, completed, created_at',
      cbt_progress: '++id, user_id, level, total_tests, completed_tests, average_score, updated_at',
      performance_metrics: '++id, user_id, level, cbt_score, patient_care_score, duty_score, attendance_score, overall_score, calculated_at',
      activity_logs: '++id, user_id, type, description, points, timestamp, created_at',
      duty_assignments: '++id, user_id, title, assigned_at, due_at, status, priority, promptness_score, created_at',
      rotation_records: '++id, user_id, level, start_date, expected_end_date, actual_end_date, status, extension_count, created_at',
      chat_messages: '++id, room_id, sender_id, content, type, timestamp, is_read, created_at',
      chat_rooms: '++id, name, type, patient_id, is_active, created_at, updated_at',
      video_conferences: '++id, room_id, patient_id, host_id, status, started_at, ended_at, created_at',
      who_safety_checklists: '++id, procedure_id, patient_id, phase, overall_completion, created_at, updated_at',
      procedures: '++id, patient_id, procedure_name, procedure_type, scheduled_date, surgeon, status, created_at',
      system_settings: '++id, key, value, updated_by, updated_at',
      system_logs: '++id, level, category, message, user_id, timestamp',
      backup_records: '++id, backup_name, backup_type, file_size, status, created_by, created_at',
      patient_assignments: '++id, patient_id, hospital_number, consultant_id, senior_registrar_id, registrar_id, house_officer_id, admission_type, assigned_at, is_active',
      pushSubscriptions: '++id, user_id, endpoint, created_at',
      audit_logs: '++id, user_id, resource_type, resource_id, action, timestamp, synced'
    });

    // Version 19: Add patient_id index to ward_rounds for patient-based queries
    this.version(19).stores({
      patients: '++id, serverId, hospital_number, first_name, last_name, created_at, synced, deleted',
      treatment_plans: '++id, serverId, patient_id, title, status, created_at, synced, deleted',
      plan_steps: '++id, serverId, plan_id, step_number, status, due_date, created_at, synced, deleted',
      sync_queue: '++id, action, table, local_id, created_at, retries',
      cmeTopics: '++id, title, category, weekOf, estimatedDuration',
      testSessions: '++id, userId, topicId, startedAt, completedAt',
      cmeProgress: '++id, [userId+topicId], userId, topicId, completed, lastAttempt',
      cmeCertificates: '++id, userId, topicId, issuedAt, validUntil',
      ward_rounds: '++id, patient_id, date, ward_name, consultant, status, created_at',
      clinic_sessions: '++id, patient_id, date, clinic_type, consultant, status, created_at',
      surgery_bookings: '++id, date, theatre_number, primary_surgeon, patient_id, status, created_at',
      lab_investigations: '++id, patient_id, request_date, requested_by, status, urgency, created_at',
      lab_results: '++id, investigation_id, patient_id, test_id, result_date, abnormal_flag, created_at',
      gfr_calculations: '++id, patient_id, calculation_date, gfr_value, ckd_stage, created_at',
      dvt_assessments: '++id, patient_id, assessment_date, assessment_type, risk_level, score, status, assessed_by, created_at',
      pressure_sore_assessments: '++id, patient_id, assessment_date, assessment_type, risk_level, score, status, assessed_by, created_at',
      nutritional_assessments: '++id, patient_id, assessment_date, assessment_type, risk_level, score, status, assessed_by, created_at',
      clinical_topics: '++id, title, category, uploadedAt, status, uploadedBy',
      generated_mcqs: '++id, topicId, targetLevel, difficulty, category, generatedAt',
      mcq_test_schedules: '++id, topicId, scheduledFor, status, notificationSent',
      mcq_test_sessions: '++id, userId, scheduleId, topicId, startedAt, completedAt, userLevel',
      study_materials: '++id, sessionId, userId, generatedAt',
      notification_schedules: '++id, userId, scheduleId, scheduledFor, sent, sentAt, type',
      educational_topics: '++id, title, category, uploadedAt, status, uploadedBy, weeklyContentGenerated',
      weekly_contents: '++id, topicId, [topicId+weekNumber+year], weekNumber, year, publishedAt, generatedAt',
      topic_schedules: '++id, topicId, scheduledWeek, status, notificationsSent, createdAt',
      user_progress: '++id, [userId+topicId], userId, topicId, weeklyContentId, readAt, mcqTestTaken',
      users: '++id, role, created_at',
      pending_users: '++id, email, status, requested_at, reviewed_at',
      approved_users: '++id, email, role, is_active, created_at, last_login',
      patient_summaries: '++id, patient_id, admission_date, generated_at, generated_by',
      paperwork_documents: '++id, patient_id, type, status, created_at, created_by',
      mdt_patient_teams: '++id, patient_id, hospital_number, is_active, created_at',
      mdt_meetings: '++id, patient_id, meeting_date, status, created_at, created_by',
      mdt_contact_logs: '++id, patient_id, specialty_id, contact_date, follow_up_required, created_at',
      admissions: '++id, patient_id, hospital_number, admission_date, ward_location, route_of_admission, status, created_at',
      discharges: '++id, admission_id, patient_id, hospital_number, discharge_date, discharge_status, created_at',
      cme_articles: '++id, topic, category, subcategory, published_date, difficulty_level, view_count, like_count, created_at',
      cme_reading_progress: '++id, [user_id+article_id], user_id, article_id, started_at, completed_at, bookmarked, created_at',
      preoperative_assessments: '++id, patient_id, surgery_booking_id, assessed_at, assessed_by, updated_at',
      blood_transfusions: '++id, patient_id, hospital_number, transfusion_date, indication, status, administered_by, created_at',
      transfusion_vitals: '++id, transfusion_id, patient_id, measurement_type, recorded_at, recorded_by',
      transfusion_complications: '++id, transfusion_id, patient_id, complication_type, severity, detected_at, resolved_at',
      ward_rounds_clinical: '++id, patient_id, round_date, clinical_status, reviewed_by, created_at',
      user_activities: '++id, user_name, action, patient_id, timestamp, synced',
      prescriptions: '++id, patient_id, medication_name, dosage, frequency, route, prescribed_by, prescribed_date, status, created_at',
      wound_care: '++id, patient_id, wound_type, wound_location, wound_stage, assessment_date, assessed_by, created_at',
      diabetic_foot_assessments: '++id, patient_id, assessment_date, wagner_grade, texas_stage, wifi_score, total_score, risk_category, status, assessed_by, created_at',
      burn_patients: '++id, patient_id, admission_date, tbsa_percentage, mechanism, baux_score, disposition, status, created_at',
      cbt_tests: '++id, test_number, level, title, scheduled_day, duration, total_marks, pass_mark, created_at',
      cbt_attempts: '++id, test_id, user_id, level, start_time, end_time, score, passed, completed, created_at',
      cbt_progress: '++id, user_id, level, total_tests, completed_tests, average_score, updated_at',
      performance_metrics: '++id, user_id, level, cbt_score, patient_care_score, duty_score, attendance_score, overall_score, calculated_at',
      activity_logs: '++id, user_id, type, description, points, timestamp, created_at',
      duty_assignments: '++id, user_id, title, assigned_at, due_at, status, priority, promptness_score, created_at',
      rotation_records: '++id, user_id, level, start_date, expected_end_date, actual_end_date, status, extension_count, created_at',
      chat_messages: '++id, room_id, sender_id, content, type, timestamp, is_read, created_at',
      chat_rooms: '++id, name, type, patient_id, is_active, created_at, updated_at',
      video_conferences: '++id, room_id, patient_id, host_id, status, started_at, ended_at, created_at',
      who_safety_checklists: '++id, procedure_id, patient_id, phase, overall_completion, created_at, updated_at',
      procedures: '++id, patient_id, procedure_name, procedure_type, scheduled_date, surgeon, status, created_at',
      system_settings: '++id, key, value, updated_by, updated_at',
      system_logs: '++id, level, category, message, user_id, timestamp',
      backup_records: '++id, backup_name, backup_type, file_size, status, created_by, created_at',
      patient_assignments: '++id, patient_id, hospital_number, consultant_id, senior_registrar_id, registrar_id, house_officer_id, admission_type, assigned_at, is_active',
      pushSubscriptions: '++id, user_id, endpoint, created_at',
      audit_logs: '++id, user_id, resource_type, resource_id, action, timestamp, synced'
    });

    // Version 20: Add patient_id index to activity_logs for patient activity queries
    this.version(20).stores({
      patients: '++id, serverId, hospital_number, first_name, last_name, created_at, synced, deleted',
      treatment_plans: '++id, serverId, patient_id, title, status, created_at, synced, deleted',
      plan_steps: '++id, serverId, plan_id, step_number, status, due_date, created_at, synced, deleted',
      sync_queue: '++id, action, table, local_id, created_at, retries',
      cmeTopics: '++id, title, category, weekOf, estimatedDuration',
      testSessions: '++id, userId, topicId, startedAt, completedAt',
      cmeProgress: '++id, [userId+topicId], userId, topicId, completed, lastAttempt',
      cmeCertificates: '++id, userId, topicId, issuedAt, validUntil',
      ward_rounds: '++id, patient_id, date, ward_name, consultant, status, created_at',
      clinic_sessions: '++id, patient_id, date, clinic_type, consultant, status, created_at',
      surgery_bookings: '++id, date, theatre_number, primary_surgeon, patient_id, status, created_at',
      lab_investigations: '++id, patient_id, request_date, requested_by, status, urgency, created_at',
      lab_results: '++id, investigation_id, patient_id, test_id, result_date, abnormal_flag, created_at',
      gfr_calculations: '++id, patient_id, calculation_date, gfr_value, ckd_stage, created_at',
      dvt_assessments: '++id, patient_id, assessment_date, assessment_type, risk_level, score, status, assessed_by, created_at',
      pressure_sore_assessments: '++id, patient_id, assessment_date, assessment_type, risk_level, score, status, assessed_by, created_at',
      nutritional_assessments: '++id, patient_id, assessment_date, assessment_type, risk_level, score, status, assessed_by, created_at',
      clinical_topics: '++id, title, category, uploadedAt, status, uploadedBy',
      generated_mcqs: '++id, topicId, targetLevel, difficulty, category, generatedAt',
      mcq_test_schedules: '++id, topicId, scheduledFor, status, notificationSent',
      mcq_test_sessions: '++id, userId, scheduleId, topicId, startedAt, completedAt, userLevel',
      study_materials: '++id, sessionId, userId, generatedAt',
      notification_schedules: '++id, userId, scheduleId, scheduledFor, sent, sentAt, type',
      educational_topics: '++id, title, category, uploadedAt, status, uploadedBy, weeklyContentGenerated',
      weekly_contents: '++id, topicId, [topicId+weekNumber+year], weekNumber, year, publishedAt, generatedAt',
      topic_schedules: '++id, topicId, scheduledWeek, status, notificationsSent, createdAt',
      user_progress: '++id, [userId+topicId], userId, topicId, weeklyContentId, readAt, mcqTestTaken',
      users: '++id, role, created_at',
      pending_users: '++id, email, status, requested_at, reviewed_at',
      approved_users: '++id, email, role, is_active, created_at, last_login',
      patient_summaries: '++id, patient_id, admission_date, generated_at, generated_by',
      paperwork_documents: '++id, patient_id, type, status, created_at, created_by',
      mdt_patient_teams: '++id, patient_id, hospital_number, is_active, created_at',
      mdt_meetings: '++id, patient_id, meeting_date, status, created_at, created_by',
      mdt_contact_logs: '++id, patient_id, specialty_id, contact_date, follow_up_required, created_at',
      admissions: '++id, patient_id, hospital_number, admission_date, ward_location, route_of_admission, status, created_at',
      discharges: '++id, admission_id, patient_id, hospital_number, discharge_date, discharge_status, created_at',
      cme_articles: '++id, topic, category, subcategory, published_date, difficulty_level, view_count, like_count, created_at',
      cme_reading_progress: '++id, [user_id+article_id], user_id, article_id, started_at, completed_at, bookmarked, created_at',
      preoperative_assessments: '++id, patient_id, surgery_booking_id, assessed_at, assessed_by, updated_at',
      blood_transfusions: '++id, patient_id, hospital_number, transfusion_date, indication, status, administered_by, created_at',
      transfusion_vitals: '++id, transfusion_id, patient_id, measurement_type, recorded_at, recorded_by',
      transfusion_complications: '++id, transfusion_id, patient_id, complication_type, severity, detected_at, resolved_at',
      ward_rounds_clinical: '++id, patient_id, round_date, clinical_status, reviewed_by, created_at',
      user_activities: '++id, user_name, action, patient_id, timestamp, synced',
      prescriptions: '++id, patient_id, medication_name, dosage, frequency, route, prescribed_by, prescribed_date, status, created_at',
      wound_care: '++id, patient_id, wound_type, wound_location, wound_stage, assessment_date, assessed_by, created_at',
      diabetic_foot_assessments: '++id, patient_id, assessment_date, wagner_grade, texas_stage, wifi_score, total_score, risk_category, status, assessed_by, created_at',
      burn_patients: '++id, patient_id, admission_date, tbsa_percentage, mechanism, baux_score, disposition, status, created_at',
      cbt_tests: '++id, test_number, level, title, scheduled_day, duration, total_marks, pass_mark, created_at',
      cbt_attempts: '++id, test_id, user_id, level, start_time, end_time, score, passed, completed, created_at',
      cbt_progress: '++id, user_id, level, total_tests, completed_tests, average_score, updated_at',
      performance_metrics: '++id, user_id, level, cbt_score, patient_care_score, duty_score, attendance_score, overall_score, calculated_at',
      activity_logs: '++id, patient_id, user_id, type, description, points, timestamp, created_at',
      duty_assignments: '++id, user_id, title, assigned_at, due_at, status, priority, promptness_score, created_at',
      rotation_records: '++id, user_id, level, start_date, expected_end_date, actual_end_date, status, extension_count, created_at',
      chat_messages: '++id, room_id, sender_id, content, type, timestamp, is_read, created_at',
      chat_rooms: '++id, name, type, patient_id, is_active, created_at, updated_at',
      video_conferences: '++id, room_id, patient_id, host_id, status, started_at, ended_at, created_at',
      who_safety_checklists: '++id, procedure_id, patient_id, phase, overall_completion, created_at, updated_at',
      procedures: '++id, patient_id, procedure_name, procedure_type, scheduled_date, surgeon, status, created_at',
      system_settings: '++id, key, value, updated_by, updated_at',
      system_logs: '++id, level, category, message, user_id, timestamp',
      backup_records: '++id, backup_name, backup_type, file_size, status, created_by, created_at',
      patient_assignments: '++id, patient_id, hospital_number, consultant_id, senior_registrar_id, registrar_id, house_officer_id, admission_type, assigned_at, is_active',
      pushSubscriptions: '++id, user_id, endpoint, created_at',
      audit_logs: '++id, user_id, resource_type, resource_id, action, timestamp, synced'
    });

    // Version 21: Add call duty roster and clinic duty logs
    this.version(21).stores({
      patients: '++id, serverId, hospital_number, first_name, last_name, created_at, synced, deleted',
      treatment_plans: '++id, serverId, patient_id, title, status, created_at, synced, deleted',
      plan_steps: '++id, serverId, plan_id, step_number, status, due_date, created_at, synced, deleted',
      sync_queue: '++id, action, table, local_id, created_at, retries',
      cmeTopics: '++id, title, category, weekOf, estimatedDuration',
      testSessions: '++id, userId, topicId, startedAt, completedAt',
      cmeProgress: '++id, [userId+topicId], userId, topicId, completed, lastAttempt',
      cmeCertificates: '++id, userId, topicId, issuedAt, validUntil',
      ward_rounds: '++id, patient_id, date, ward_name, consultant, status, created_at',
      clinic_sessions: '++id, patient_id, date, clinic_type, consultant, status, created_at',
      surgery_bookings: '++id, date, theatre_number, primary_surgeon, patient_id, status, created_at',
      lab_investigations: '++id, patient_id, request_date, requested_by, status, urgency, created_at',
      lab_results: '++id, investigation_id, patient_id, test_id, result_date, abnormal_flag, created_at',
      gfr_calculations: '++id, patient_id, calculation_date, gfr_value, ckd_stage, created_at',
      dvt_assessments: '++id, patient_id, assessment_date, assessment_type, risk_level, score, status, assessed_by, created_at',
      pressure_sore_assessments: '++id, patient_id, assessment_date, assessment_type, risk_level, score, status, assessed_by, created_at',
      nutritional_assessments: '++id, patient_id, assessment_date, assessment_type, risk_level, score, status, assessed_by, created_at',
      clinical_topics: '++id, title, category, uploadedAt, status, uploadedBy',
      generated_mcqs: '++id, topicId, targetLevel, difficulty, category, generatedAt',
      mcq_test_schedules: '++id, topicId, scheduledFor, status, notificationSent',
      mcq_test_sessions: '++id, userId, scheduleId, topicId, startedAt, completedAt, userLevel',
      study_materials: '++id, sessionId, userId, generatedAt',
      notification_schedules: '++id, userId, scheduleId, scheduledFor, sent, sentAt, type',
      educational_topics: '++id, title, category, uploadedAt, status, uploadedBy, weeklyContentGenerated',
      weekly_contents: '++id, topicId, [topicId+weekNumber+year], weekNumber, year, publishedAt, generatedAt',
      topic_schedules: '++id, topicId, scheduledWeek, status, notificationsSent, createdAt',
      user_progress: '++id, [userId+topicId], userId, topicId, weeklyContentId, readAt, mcqTestTaken',
      users: '++id, role, created_at',
      pending_users: '++id, email, status, requested_at, reviewed_at',
      approved_users: '++id, email, role, is_active, created_at, last_login',
      patient_summaries: '++id, patient_id, admission_date, generated_at, generated_by',
      paperwork_documents: '++id, patient_id, type, status, created_at, created_by',
      mdt_patient_teams: '++id, patient_id, hospital_number, is_active, created_at',
      mdt_meetings: '++id, patient_id, meeting_date, status, created_at, created_by',
      mdt_contact_logs: '++id, patient_id, specialty_id, contact_date, follow_up_required, created_at',
      admissions: '++id, patient_id, hospital_number, admission_date, ward_location, route_of_admission, status, created_at',
      discharges: '++id, admission_id, patient_id, hospital_number, discharge_date, discharge_status, created_at',
      cme_articles: '++id, topic, category, subcategory, published_date, difficulty_level, view_count, like_count, created_at',
      cme_reading_progress: '++id, [user_id+article_id], user_id, article_id, started_at, completed_at, bookmarked, created_at',
      preoperative_assessments: '++id, patient_id, surgery_booking_id, assessed_at, assessed_by, updated_at',
      blood_transfusions: '++id, patient_id, hospital_number, transfusion_date, indication, status, administered_by, created_at',
      transfusion_vitals: '++id, transfusion_id, patient_id, measurement_type, recorded_at, recorded_by',
      transfusion_complications: '++id, transfusion_id, patient_id, complication_type, severity, detected_at, resolved_at',
      ward_rounds_clinical: '++id, patient_id, round_date, clinical_status, reviewed_by, created_at',
      user_activities: '++id, user_name, action, patient_id, timestamp, synced',
      prescriptions: '++id, patient_id, medication_name, dosage, frequency, route, prescribed_by, prescribed_date, status, created_at',
      wound_care: '++id, patient_id, wound_type, wound_location, wound_stage, assessment_date, assessed_by, created_at',
      diabetic_foot_assessments: '++id, patient_id, assessment_date, wagner_grade, texas_stage, wifi_score, total_score, risk_category, status, assessed_by, created_at',
      burn_patients: '++id, patient_id, admission_date, tbsa_percentage, mechanism, baux_score, disposition, status, created_at',
      cbt_tests: '++id, test_number, level, title, scheduled_day, duration, total_marks, pass_mark, created_at',
      cbt_attempts: '++id, test_id, user_id, level, start_time, end_time, score, passed, completed, created_at',
      cbt_progress: '++id, user_id, level, total_tests, completed_tests, average_score, updated_at',
      performance_metrics: '++id, user_id, level, cbt_score, patient_care_score, duty_score, attendance_score, overall_score, calculated_at',
      activity_logs: '++id, patient_id, user_id, type, description, points, timestamp, created_at',
      duty_assignments: '++id, user_id, title, assigned_at, due_at, status, priority, promptness_score, created_at',
      rotation_records: '++id, user_id, level, start_date, expected_end_date, actual_end_date, status, extension_count, created_at',
      chat_messages: '++id, room_id, sender_id, content, type, timestamp, is_read, created_at',
      chat_rooms: '++id, name, type, patient_id, is_active, created_at, updated_at',
      video_conferences: '++id, room_id, patient_id, host_id, status, started_at, ended_at, created_at',
      who_safety_checklists: '++id, procedure_id, patient_id, phase, overall_completion, created_at, updated_at',
      procedures: '++id, patient_id, procedure_name, procedure_type, scheduled_date, surgeon, status, created_at',
      system_settings: '++id, key, value, updated_by, updated_at',
      system_logs: '++id, level, category, message, user_id, timestamp',
      backup_records: '++id, backup_name, backup_type, file_size, status, created_by, created_at',
      patient_assignments: '++id, patient_id, hospital_number, consultant_id, senior_registrar_id, registrar_id, house_officer_id, admission_type, assigned_at, is_active',
      pushSubscriptions: '++id, user_id, endpoint, created_at',
      audit_logs: '++id, user_id, resource_type, resource_id, action, timestamp, synced',
      call_duty_roster: '++id, start_date, end_date, month_key, shift_number, senior_registrar_id, senior_registrar_name, registrar_id, registrar_name, house_officer_id, house_officer_name, status, created_by, created_at',
      clinic_duty_logs: '++id, user_id, user_name, user_role, duty_type, duty_category, patient_id, patient_name, description, notes, status, assigned_date, completed_date, week_number, year, created_at'
    });

    // Version 22: Add notice board table
    this.version(22).stores({
      notice_board: '++id, title, category, content, posted_by, posted_by_name, posted_by_role, is_pinned, is_active, created_at, updated_at'
    });

    // Version 23: Add rotation config and assigned responsibilities tables
    this.version(23).stores({
      rotation_configs: '++id, level, department, commencement_date, end_date, is_active, created_by, created_at, updated_at',
      assigned_responsibilities: '++id, rotation_config_id, user_id, user_name, title, description, priority, status, due_date, assigned_by, assigned_at, completed_at'
    });

    // Version 24: Add AI Medical Scribe sessions table
    this.version(24).stores({
      scribe_sessions: 'id, patient_id, context, status, ward_round_id, recorded_by, created_at'
    });

    // Version 25: Add PS Unit roster configuration table
    this.version(25).stores({
      ps_unit_rosters: '++id, isActive, startDate, createdAt'
    });

    // Version 26: Add shopping_lists table for cloud persistence
    this.version(26).stores({
      shopping_lists: '++id, patient_id, patient_name, hospital_number, category, created_at, created_by'
    });

    // Version 27: Add progress_notes table for SOAP progress notes
    this.version(27).stores({
      progress_notes: '++id, patient_id, patient_name, author, date, synced, created_at'
    });

    // Version 28: Add generic API cache table for offline-first support
    this.version(28).stores({
      api_cache: 'endpoint, updated_at'
    });

    // Version 29: Add SJS/TEN assessments and investigation uploads tables
    this.version(29).stores({
      sjs_assessments: '++id, patient_id, hospital_number, date_of_assessment, classification, status, created_at',
      investigation_uploads: '++id, patient_id, hospital_number, upload_type, status, created_at'
    });

    // Version 30: Add Substance Use Disorder Assessment & Detoxification tables
    this.version(30).stores({
      substance_use_assessments: 'id, patientId, hospitalId, hospitalNumber, primarySubstance, status, assessedBy, synced, createdAt',
      detox_monitoring_records: 'id, assessmentId, patientId, recordedAt, synced',
      detox_follow_ups: 'id, assessmentId, patientId, scheduledDate, status, synced, createdAt',
      substance_use_clinical_summaries: 'id, assessmentId, patientId, generatedAt'
    });

    // Version 31: Add Lymphedema assessments table
    this.version(31).stores({
      lymphedema_assessments: '++id, patient_id, hospital_number, assessment_date, isl_stage, campisi_stage, affected_limb, status, assessed_by, created_at'
    });

    // Version 32: Extend call duty roster with HO ward/emergency/off assignments + handover notes
    this.version(32).stores({
      call_duty_roster: '++id, start_date, end_date, month_key, shift_number, senior_registrar_id, senior_registrar_name, registrar_id, registrar_name, house_officer_id, house_officer_name, ho_ward_id, ho_emergency_id, ho_off_id, ho_count, status, created_by, created_at',
      call_duty_handover_notes: '++id, shift_id, roster_key, author_id, assignment, created_at'
    });

    // Version 33: Add fluid balance tracking table
    this.version(33).stores({
      fluid_balance: '++id, patient_id, hospital_number, chart_date, recorded_at, entry_type, fluid_type, volume_ml, route, recorded_by, created_at'
    });

    // Version 34: Offline auth credentials + sync conflict log
    this.version(34).stores({
      offline_credentials: '++id, &email, userId, updatedAt',
      sync_conflicts: '++id, entity, entityId, resolvedAt, created_at'
    });

    // Version 35: Dead letter queue for permanently failed sync items
    this.version(35).stores({
      sync_dead_letter: '++id, table, action, local_id, created_at, failed_at, retries, last_error'
    });

    // Version 36: Vital signs table for offline-first vital signs caching
    this.version(36).stores({
      vital_signs: '++id, patient_id, hospital_number, date, created_at'
    });

    // Version 37: WoundProgress Monitor — first-class longitudinal wound entity
    // (wounds) and its serial assessment timeline (wound_assessments). synced
    // and serverId are indexed so the shared sync layer can reconcile them.
    this.version(37).stores({
      wounds: '++id, serverId, patient_id, status, healing_status, updated_at, synced',
      wound_assessments: '++id, serverId, wound_id, patient_id, assessed_at, synced'
    });

    // Add hooks to automatically track changes
    this.patients.hook('creating', (primKey, obj, trans) => {
      obj.created_at = obj.created_at || new Date();
      obj.updated_at = obj.updated_at || new Date();
      // Only default synced to false if not explicitly set (e.g. from server pull)
      if (obj.synced === undefined || obj.synced === null) {
        obj.synced = false;
      }
      // Ensure deleted is explicitly false on creation
      if (obj.deleted === undefined) {
        obj.deleted = false;
      }
    });

    this.patients.hook('updating', (modifications, primKey, obj, trans) => {
      // Only set updated_at if not explicitly provided
      if (!modifications.hasOwnProperty('updated_at')) {
        (modifications as any).updated_at = new Date();
      }
      // Don't auto-reset synced — callers explicitly set synced status
      // Prevent accidental deletion - must be explicit
      if ((modifications as any).deleted === undefined && obj.deleted === undefined) {
        (modifications as any).deleted = false;
      }
    });

    // Add hook to track deletions
    this.patients.hook('deleting', (primKey, obj, trans) => {
      // Soft delete logic handled elsewhere
    });

    this.treatment_plans.hook('creating', (primKey, obj, trans) => {
      obj.created_at = obj.created_at || new Date();
      obj.updated_at = obj.updated_at || new Date();
      if (obj.synced === undefined || obj.synced === null) {
        obj.synced = false;
      }
      if (obj.deleted === undefined) {
        obj.deleted = false;
      }
    });

    this.treatment_plans.hook('updating', (modifications, primKey, obj, trans) => {
      if (!modifications.hasOwnProperty('updated_at')) {
        (modifications as any).updated_at = new Date();
      }
      if ((modifications as any).deleted === undefined && obj.deleted === undefined) {
        (modifications as any).deleted = false;
      }
    });

    this.plan_steps.hook('creating', (primKey, obj, trans) => {
      obj.created_at = obj.created_at || new Date();
      obj.updated_at = obj.updated_at || new Date();
      if (obj.synced === undefined || obj.synced === null) {
        obj.synced = false;
      }
      if (obj.deleted === undefined) {
        obj.deleted = false;
      }
    });

    this.plan_steps.hook('updating', (modifications, primKey, obj, trans) => {
      if (!modifications.hasOwnProperty('updated_at')) {
        (modifications as any).updated_at = new Date();
      }
      if ((modifications as any).deleted === undefined && obj.deleted === undefined) {
        (modifications as any).deleted = false;
      }
    });

    // Add hooks for risk assessment tables
    this.dvt_assessments.hook('creating', (primKey, obj, trans) => {
      obj.created_at = new Date();
      obj.updated_at = new Date();
    });

    this.dvt_assessments.hook('updating', (modifications, primKey, obj, trans) => {
      (modifications as any).updated_at = new Date();
    });

    this.pressure_sore_assessments.hook('creating', (primKey, obj, trans) => {
      obj.created_at = new Date();
      obj.updated_at = new Date();
    });

    this.pressure_sore_assessments.hook('updating', (modifications, primKey, obj, trans) => {
      (modifications as any).updated_at = new Date();
    });

    this.nutritional_assessments.hook('creating', (primKey, obj, trans) => {
      obj.created_at = new Date();
      obj.updated_at = new Date();
    });

    this.nutritional_assessments.hook('updating', (modifications, primKey, obj, trans) => {
      (modifications as any).updated_at = new Date();
    });

    // Progress notes hooks
    this.progress_notes.hook('creating', (primKey, obj, trans) => {
      obj.created_at = obj.created_at || new Date();
      obj.updated_at = obj.updated_at || new Date();
      if (obj.synced === undefined || obj.synced === null) {
        obj.synced = false;
      }
    });

    this.progress_notes.hook('updating', (modifications, primKey, obj, trans) => {
      if (!modifications.hasOwnProperty('updated_at')) {
        (modifications as any).updated_at = new Date();
      }
    });
  }
}

// Create the database instance with error recovery
export const db = new PlasticSurgeonDB();

// Handle version changes from other tabs gracefully
// Don't force-close mid-write — let the user finish their current action
db.on('versionchange', (event) => {
  // Only close if no active transactions are likely in flight.
  // Forcing db.close() while DataSyncService is writing 5000+ items
  // leaves IndexedDB in a half-written state (= corruption).
  console.warn('⚠️ Database schema updated in another tab. Please reload when ready.');
  // Defer the close for a few seconds to let pending writes complete
  setTimeout(() => {
    db.close();
    window.location.reload();
  }, 3000);
});

// Handle database open errors
db.open().catch(async (error) => {
  console.error('❌ Failed to open database:', error);
  
  // Check if it's a corruption error
  if (error.name === 'UnknownError' || 
      error.message?.includes('Internal error') ||
      error.message?.includes('backing store')) {
    console.warn('🔧 Database appears corrupted. Attempting recovery...');
    
    // Show user a message
    const shouldRecover = window.confirm(
      'The local database appears to be corrupted. Would you like to reset it? ' +
      'Your data on the server will be preserved and re-synced.'
    );
    
    if (shouldRecover) {
      await recoverDatabase();
    }
  }
});