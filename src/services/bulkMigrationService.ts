/**
 * Bulk Migration Service
 * Pushes ALL existing local IndexedDB data to the server for cross-device sync.
 * Handles field mapping from local (camelCase) to server (snake_case) format.
 */
import { db } from '../db/database';
import { apiClient } from './apiClient';

export interface MigrationProgress {
  table: string;
  total: number;
  synced: number;
  errors: number;
  status: 'pending' | 'in-progress' | 'done' | 'error';
}

export interface MigrationResult {
  totalTables: number;
  totalRecords: number;
  totalSynced: number;
  totalErrors: number;
  details: MigrationProgress[];
  duration: number;
}

type ProgressCallback = (progress: MigrationProgress[]) => void;

class BulkMigrationService {
  private BATCH_SIZE = 10; // Push 10 records at a time to avoid timeouts

  /**
   * Push ALL local data to the server.
   * Call this to migrate pre-existing data for cross-device sync.
   */
  async migrateAllToServer(onProgress?: ProgressCallback): Promise<MigrationResult> {
    const startTime = Date.now();

    // Define all tables and their field mappers
    const tableMigrations = [
      { name: 'patients', table: () => db.patients, mapper: this.mapPatient },
      { name: 'treatment_plans', table: () => db.treatment_plans, mapper: this.mapTreatmentPlan },
      { name: 'admissions', table: () => db.admissions, mapper: this.mapAdmission },
      { name: 'surgeries', table: () => db.surgery_bookings, mapper: this.mapSurgery, entityType: 'surgeries' },
      { name: 'prescriptions', table: () => db.prescriptions, mapper: this.mapPrescription },
      { name: 'lab_orders', table: () => db.lab_investigations, mapper: this.mapLabOrder, entityType: 'lab_orders' },
      { name: 'ward_rounds', table: () => db.ward_rounds, mapper: this.mapWardRound },
      { name: 'wound_care_records', table: () => db.wound_care, mapper: this.mapWoundCare, entityType: 'wound_care_records' },
      { name: 'blood_transfusions', table: () => db.blood_transfusions, mapper: this.mapDirect },
      { name: 'burn_patients', table: () => db.burn_patients, mapper: this.mapDirect },
      { name: 'dvt_assessments', table: () => db.dvt_assessments, mapper: this.mapDirect },
      { name: 'pressure_sore_assessments', table: () => db.pressure_sore_assessments, mapper: this.mapDirect },
      { name: 'nutritional_assessments', table: () => db.nutritional_assessments, mapper: this.mapDirect },
      { name: 'diabetic_foot_assessments', table: () => db.diabetic_foot_assessments, mapper: this.mapDirect },
      { name: 'preoperative_assessments', table: () => db.preoperative_assessments, mapper: this.mapDirect },
      { name: 'procedures', table: () => db.procedures, mapper: this.mapDirect },
      { name: 'who_safety_checklists', table: () => db.who_safety_checklists, mapper: this.mapDirect },
      { name: 'paperwork_documents', table: () => db.paperwork_documents, mapper: this.mapPaperwork },
      { name: 'cme_topics', table: () => db.cmeTopics, mapper: this.mapCmeTopic, entityType: 'cme_topics' },
      { name: 'cme_test_sessions', table: () => db.testSessions, mapper: this.mapCmeTestSession, entityType: 'cme_test_sessions' },
      { name: 'cme_progress', table: () => db.cmeProgress, mapper: this.mapCmeProgress, entityType: 'cme_progress' },
      { name: 'cme_certificates', table: () => db.cmeCertificates, mapper: this.mapCmeCertificate, entityType: 'cme_certificates' },
      { name: 'cme_articles', table: () => db.cme_articles, mapper: this.mapCmeArticle, entityType: 'cme_articles' },
      { name: 'cme_reading_progress', table: () => db.cme_reading_progress, mapper: this.mapCmeReadingProgress, entityType: 'cme_reading_progress' },
      { name: 'educational_topics', table: () => db.educational_topics, mapper: this.mapEducationalTopic },
      { name: 'weekly_contents', table: () => db.weekly_contents, mapper: this.mapWeeklyContent },
      { name: 'topic_schedules', table: () => db.topic_schedules, mapper: this.mapTopicSchedule },
      { name: 'education_user_progress', table: () => db.user_progress, mapper: this.mapUserProgress, entityType: 'education_user_progress' },
      { name: 'audit_logs', table: () => db.audit_logs, mapper: this.mapDirect },
      { name: 'user_activities', table: () => db.user_activities, mapper: this.mapDirect },
      { name: 'substance_use_assessments', table: () => db.substance_use_assessments, mapper: this.mapDirect },
      { name: 'detox_monitoring_records', table: () => db.detox_monitoring_records, mapper: this.mapDirect },
      { name: 'detox_follow_ups', table: () => db.detox_follow_ups, mapper: this.mapDirect },
      { name: 'substance_use_clinical_summaries', table: () => db.substance_use_clinical_summaries, mapper: this.mapDirect },
    ];

    const progressList: MigrationProgress[] = tableMigrations.map(t => ({
      table: t.name,
      total: 0,
      synced: 0,
      errors: 0,
      status: 'pending' as const
    }));

    for (let i = 0; i < tableMigrations.length; i++) {
      const migration = tableMigrations[i];
      const progress = progressList[i];

      try {
        progress.status = 'in-progress';
        onProgress?.(progressList);

        let records: any[];
        try {
          records = await migration.table().toArray();
        } catch {
          // Table may not exist in this DB version
          progress.status = 'done';
          onProgress?.(progressList);
          continue;
        }

        progress.total = records.length;
        onProgress?.(progressList);

        if (records.length === 0) {
          progress.status = 'done';
          onProgress?.(progressList);
          continue;
        }

        // Process in batches
        for (let j = 0; j < records.length; j += this.BATCH_SIZE) {
          const batch = records.slice(j, j + this.BATCH_SIZE);
          const changes = batch.map(record => {
            try {
              const mapped = migration.mapper(record);
              return {
                entityType: migration.entityType || migration.name,
                entityId: String(record.id || record.serverId || `migrate_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`),
                action: 'upsert',
                payload: mapped
              };
            } catch (mapErr) {
              console.warn(`Error mapping ${migration.name} record:`, mapErr);
              progress.errors++;
              return null;
            }
          }).filter(Boolean);

          if (changes.length === 0) continue;

          try {
            const response = await apiClient.post('/sync/push', { changes });
            if (response?.results) {
              for (const r of response.results) {
                if (r.status === 'synced') {
                  progress.synced++;
                } else {
                  progress.errors++;
                  const errMsg = r.message || r.status;
                  console.warn(`Sync error for ${migration.name} [${r.entityId}]:`, errMsg);
                  // Store last error message for display
                  (progress as any).lastError = errMsg;
                }
              }
            } else {
              progress.synced += changes.length;
            }
          } catch (pushErr) {
            console.error(`Failed to push batch for ${migration.name}:`, pushErr);
            progress.errors += changes.length;
          }

          onProgress?.(progressList);
        }

        progress.status = 'done';
      } catch (err) {
        console.error(`Migration error for ${migration.name}:`, err);
        progress.status = 'error';
      }

      onProgress?.(progressList);
    }

    const totalRecords = progressList.reduce((s, p) => s + p.total, 0);
    const totalSynced = progressList.reduce((s, p) => s + p.synced, 0);
    const totalErrors = progressList.reduce((s, p) => s + p.errors, 0);

    return {
      totalTables: tableMigrations.length,
      totalRecords,
      totalSynced,
      totalErrors,
      details: progressList,
      duration: Date.now() - startTime
    };
  }

  // ---- Field Mappers ----
  // Each mapper transforms a local IndexedDB record into server-column-compatible payload.

  private mapPatient(record: any): any {
    return {
      hospital_number: record.hospital_number,
      first_name: record.first_name,
      last_name: record.last_name,
      date_of_birth: record.date_of_birth || record.dob || null,
      gender: record.gender || record.sex || null,
      phone: record.phone || null,
      email: record.email || null,
      address: record.address || null,
      blood_group: record.blood_group || null,
      allergies: record.allergies || null,
      medical_history: record.medical_history || record.comorbidities || null,
      primary_diagnosis: record.primary_diagnosis || record.diagnosis || null,
    };
  }

  private mapTreatmentPlan(record: any): any {
    return {
      patient_id: record.patient_id,
      diagnosis: record.diagnosis || '',
      treatment_type: record.treatment_type || null,
      description: record.description || record.title || '',
      objectives: record.objectives || [],
      procedures: record.procedures || record.planned_procedures || [],
      medications: record.medications || record.planned_medications || [],
      investigations: record.investigations || [],
      follow_up_schedule: record.follow_up_schedule || record.planned_reviews || [],
      notes: record.notes || '',
      status: record.status || 'draft',
    };
  }

  private mapAdmission(record: any): any {
    return {
      patient_id: record.patient_id,
      admission_date: record.admission_date,
      discharge_date: record.discharge_date || null,
      ward: record.ward || record.ward_location || null,
      bed_number: record.bed_number || null,
      admitting_diagnosis: record.admitting_diagnosis || record.provisional_diagnosis || record.reasons_for_admission || null,
      discharge_diagnosis: record.discharge_diagnosis || null,
      status: record.status || 'admitted',
      notes: record.notes || record.presenting_complaint || null,
    };
  }

  private mapSurgery(record: any): any {
    return {
      patient_id: record.patient_id,
      procedure_name: record.procedure_name || '',
      procedure_type: record.procedure_type || null,
      scheduled_date: record.date || record.scheduled_date || record.start_time || null,
      estimated_duration: record.estimated_duration_minutes || record.estimated_duration || null,
      anesthesia_type: record.anaesthesia_type || record.anesthesia_type || null,
      operating_room: record.theatre_number || record.operating_room || null,
      pre_op_notes: record.pre_op_notes || record.special_requirements || null,
      required_equipment: record.equipment_needed || record.required_equipment || [],
      status: record.status || 'scheduled',
    };
  }

  private mapPrescription(record: any): any {
    return {
      patient_id: record.patient_id,
      medication_name: record.medication_name || record.medicationName || '',
      dosage: record.dosage || null,
      frequency: record.frequency || null,
      duration: record.duration || null,
      route: record.route || null,
      instructions: record.instructions || record.indication || null,
      status: record.status || 'active',
      prescribed_at: record.prescribed_date || record.prescribed_at || record.created_at || null,
    };
  }

  private mapLabOrder(record: any): any {
    return {
      patient_id: record.patient_id,
      test_type: record.test_type || record.investigation_type || 'General',
      test_name: record.test_name || record.investigation_name || '',
      priority: record.priority || record.urgency || 'routine',
      clinical_notes: record.clinical_notes || record.clinical_indication || null,
      status: record.status || 'pending',
      results: record.results || null,
      ordered_at: record.request_date || record.ordered_at || record.created_at || null,
    };
  }

  private mapWardRound(record: any): any {
    // Pack clinical data into findings JSON
    const findings = {
      chief_complaint: record.chief_complaint,
      clinical_notes: record.clinical_notes,
      examination_findings: record.examination_findings,
      assessment_notes: record.assessment_notes,
      doctor_role: record.doctor_role,
      progress_status: record.progress_status,
      complications: record.complications,
      discharge_planning: record.discharge_planning,
      wound_notes: record.wound_notes,
      reviewing_doctor: record.reviewing_doctor,
      patient_name: record.patient_name,
      hospital_number: record.hospital_number,
    };

    const vitalSigns = {
      temperature: record.temperature,
      pulse: record.pulse,
      bp_systolic: record.bp_systolic,
      bp_diastolic: record.bp_diastolic,
      respiratory_rate: record.respiratory_rate,
      spo2: record.spo2,
    };

    return {
      patient_id: record.patient_id,
      round_date: record.round_date || record.date || null,
      round_type: record.round_type || 'routine',
      findings: JSON.stringify(findings),
      plan: record.follow_up_plan || record.chief_complaint || null,
      vital_signs: vitalSigns,
      new_orders: record.new_orders || [],
      issues: record.complications ? [record.complications] : [],
      nursing_notes: record.wound_notes || null,
    };
  }

  private mapWoundCare(record: any): any {
    return {
      patient_id: record.patient_id,
      wound_location: record.wound_location || null,
      wound_type: record.wound_type || null,
      wound_size: record.wound_size || null,
      wound_stage: record.wound_stage || null,
      treatment_provided: record.treatment_provided || null,
      dressing_used: record.dressing_used || null,
      observations: record.observations || null,
      next_dressing_date: record.next_dressing_date || null,
      images: record.images || [],
      recorded_at: record.assessment_date || record.recorded_at || record.created_at || null,
    };
  }

  private mapPaperwork(record: any): any {
    return {
      id: record.id,
      type: record.type,
      patient_id: record.patient_id,
      content: record.content,
      data: typeof record.data === 'object' ? JSON.stringify(record.data) : record.data,
      status: record.status,
      created_by: record.created_by,
      created_at: record.created_at,
    };
  }

  private mapCmeTopic(record: any): any {
    return {
      id: record.id,
      title: record.title,
      category: record.category,
      content: record.content || null,
      questions: record.questions || [],
      learning_objectives: record.learningObjectives || record.learning_objectives || [],
      key_points: record.keyPoints || record.key_points || [],
      clinical_pearls: record.clinicalPearls || record.clinical_pearls || [],
      generated_from: record.generatedFrom || record.generated_from || {},
      week_of: record.weekOf || record.week_of || null,
      estimated_duration: record.estimatedDuration || record.estimated_duration || 30,
    };
  }

  private mapCmeTestSession(record: any): any {
    return {
      id: record.id,
      user_id: record.userId || record.user_id,
      topic_id: record.topicId || record.topic_id,
      questions: record.questions || [],
      answers: record.answers || [],
      score: record.score,
      passed: record.passed,
      certificate_eligible: record.certificateEligible || record.certificate_eligible,
      started_at: record.startedAt || record.started_at,
      completed_at: record.completedAt || record.completed_at,
    };
  }

  private mapCmeProgress(record: any): any {
    return {
      id: record.id,
      user_id: record.userId || record.user_id,
      topic_id: record.topicId || record.topic_id,
      score: record.score,
      attempts: record.attempts,
      certificate_earned: record.certificateEarned || record.certificate_earned,
      completed: record.completed,
      last_attempt: record.lastAttempt || record.last_attempt,
    };
  }

  private mapCmeCertificate(record: any): any {
    return {
      id: record.id,
      user_id: record.userId || record.user_id,
      topic_id: record.topicId || record.topic_id,
      issued_at: record.issuedAt || record.issued_at,
      valid_until: record.validUntil || record.valid_until,
      credits_earned: record.creditsEarned || record.credits_earned,
    };
  }

  private mapCmeArticle(record: any): any {
    return {
      id: record.id,
      topic: record.topic,
      category: record.category,
      subcategory: record.subcategory,
      title: record.title,
      summary: record.summary,
      content: record.content,
      learning_objectives: record.learning_objectives || record.learningObjectives || [],
      key_points: record.key_points || record.keyPoints || [],
      clinical_pearls: record.clinical_pearls || record.clinicalPearls || [],
      case_studies: record.case_studies || record.caseStudies || [],
      references_list: record.references || record.references_list || [],
      difficulty_level: record.difficulty_level || record.difficultyLevel || 'intermediate',
      reading_time_minutes: record.reading_time_minutes || record.readingTimeMinutes || 15,
      published_date: record.published_date || record.publishedDate,
      view_count: record.view_count || 0,
      like_count: record.like_count || 0,
    };
  }

  private mapCmeReadingProgress(record: any): any {
    return {
      id: record.id,
      user_id: record.user_id,
      article_id: record.article_id,
      progress_percentage: record.progress_percentage || 0,
      time_spent_seconds: record.time_spent_seconds || 0,
      liked: record.liked || false,
      bookmarked: record.bookmarked || false,
      started_at: record.started_at,
      completed_at: record.completed_at,
    };
  }

  private mapEducationalTopic(record: any): any {
    return {
      id: record.id,
      title: record.title,
      category: record.category,
      description: record.description || '',
      target_levels: record.targetLevels || record.target_levels || [],
      keywords: record.keywords || [],
      difficulty: record.difficulty || 'intermediate',
      estimated_study_time: record.estimatedStudyTime || record.estimated_study_time || 30,
      uploaded_by: record.uploadedBy || record.uploaded_by || '',
      uploaded_at: record.uploadedAt || record.uploaded_at,
      status: record.status || 'active',
      weekly_content_generated: record.weeklyContentGenerated || record.weekly_content_generated || false,
      last_content_generated_at: record.lastContentGeneratedAt || record.last_content_generated_at || null,
    };
  }

  private mapWeeklyContent(record: any): any {
    return {
      id: record.id,
      topic_id: record.topicId || record.topic_id,
      week_number: record.weekNumber || record.week_number,
      year: record.year,
      content: record.content || '',
      references_list: record.references || record.references_list || [],
      learning_objectives: record.learningObjectives || record.learning_objectives || [],
      key_takeaways: record.keyTakeaways || record.key_takeaways || [],
      clinical_pearls: record.clinicalPearls || record.clinical_pearls || [],
      case_studies: record.caseStudies || record.case_studies || [],
      generated_at: record.generatedAt || record.generated_at,
      published_at: record.publishedAt || record.published_at,
      view_count: record.viewCount || record.view_count || 0,
      target_levels: record.targetLevels || record.target_levels || [],
    };
  }

  private mapTopicSchedule(record: any): any {
    return {
      id: record.id,
      topic_id: record.topicId || record.topic_id,
      scheduled_week: record.scheduledWeek || record.scheduled_week,
      status: record.status || 'scheduled',
      notifications_sent: record.notificationsSent || record.notifications_sent || false,
      target_levels: record.targetLevels || record.target_levels || [],
      created_at: record.createdAt || record.created_at,
    };
  }

  private mapUserProgress(record: any): any {
    return {
      id: record.id,
      user_id: record.userId || record.user_id,
      topic_id: record.topicId || record.topic_id,
      weekly_content_id: record.weeklyContentId || record.weekly_content_id,
      read_at: record.readAt || record.read_at,
      completion_percentage: record.completionPercentage || record.completion_percentage || 0,
      time_spent: record.timeSpent || record.time_spent || 0,
      mcq_test_taken: record.mcqTestTaken || record.mcq_test_taken || false,
      mcq_score: record.mcqScore || record.mcq_score,
      notes: record.notes || '',
    };
  }

  /** Pass through record as-is (for tables already using snake_case) */
  private mapDirect(record: any): any {
    // Remove Dexie internal fields
    const { synced, deleted, serverId, ...rest } = record;
    return rest;
  }
}

export const bulkMigrationService = new BulkMigrationService();
