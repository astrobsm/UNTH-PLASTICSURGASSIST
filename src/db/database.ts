import Dexie, { Table } from 'dexie';
import { CMETopic, CMEQuestion, TestSession, CMEProgress, CMECertificate } from '../services/aiService';
import { WardRound, ClinicSession, SurgeryBooking } from '../services/schedulingService';
import { LabInvestigation, LabResult, GFRCalculation } from '../services/labService';
import { BaseRiskAssessment, DVTRiskAssessment, PressureSoreRiskAssessment, NutritionalRiskAssessment } from '../services/riskAssessmentService';
import { ClinicalTopic, GeneratedMCQ, MCQTestSchedule, MCQTestSession, StudyMaterial, NotificationSchedule } from '../services/mcqGenerationService';
import { EducationalTopic, WeeklyContent, TopicSchedule, UserProgress } from '../services/topicManagementService';
import { PendingUser, ApprovedUser } from '../services/userManagementService';

// Define the data structures for offline storage
export interface Patient {
  id?: number;
  serverId?: string; // Server ID when synced
  hospital_number: string;
  first_name: string;
  last_name: string;
  dob: string;
  sex: 'male' | 'female' | 'other';
  phone?: string;
  address?: string;
  allergies?: string[];
  comorbidities?: string[];
  created_at: Date;
  updated_at: Date;
  synced: boolean;
  deleted?: boolean;
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

    // Add hooks to automatically track changes
    this.patients.hook('creating', (primKey, obj, trans) => {
      obj.created_at = new Date();
      obj.updated_at = new Date();
      obj.synced = false;
      // Ensure deleted is explicitly false on creation
      if (obj.deleted === undefined) {
        obj.deleted = false;
      }
    });

    this.patients.hook('updating', (modifications, primKey, obj, trans) => {
      (modifications as any).updated_at = new Date();
      if (!modifications.hasOwnProperty('synced')) {
        (modifications as any).synced = false;
      }
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
      obj.created_at = new Date();
      obj.updated_at = new Date();
      obj.synced = false;
      // Ensure deleted is explicitly false on creation
      if (obj.deleted === undefined) {
        obj.deleted = false;
      }
    });

    this.treatment_plans.hook('updating', (modifications, primKey, obj, trans) => {
      (modifications as any).updated_at = new Date();
      if (!modifications.hasOwnProperty('synced')) {
        (modifications as any).synced = false;
      }
      // Prevent accidental deletion
      if ((modifications as any).deleted === undefined && obj.deleted === undefined) {
        (modifications as any).deleted = false;
      }
    });

    this.plan_steps.hook('creating', (primKey, obj, trans) => {
      obj.created_at = new Date();
      obj.updated_at = new Date();
      obj.synced = false;
      // Ensure deleted is explicitly false on creation
      if (obj.deleted === undefined) {
        obj.deleted = false;
      }
    });

    this.plan_steps.hook('updating', (modifications, primKey, obj, trans) => {
      (modifications as any).updated_at = new Date();
      if (!modifications.hasOwnProperty('synced')) {
        (modifications as any).synced = false;
      }
      // Prevent accidental deletion
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
  }
}

// Create the database instance
export const db = new PlasticSurgeonDB();