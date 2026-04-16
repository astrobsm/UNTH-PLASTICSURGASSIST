// ⚠️ DEPRECATED: One-time migration script. Production schema is managed by api/init-db.js.
// Do NOT run on production. Kept for historical reference only.
//
// Migration script to initialize the NEW Supabase database (eu-west-1)
// Run: node migrate-to-new-db.mjs

import pg from 'pg';
import bcrypt from 'bcryptjs';

const NEW_DB_URL = 'postgresql://postgres.lienvjmyymwwbaunemiz:LDkajqnTzO9VxtLU@aws-1-eu-west-1.pooler.supabase.com:5432/postgres';

const pool = new pg.Pool({
  connectionString: NEW_DB_URL,
  ssl: { rejectUnauthorized: false },
  max: 5,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 10000
});

async function query(text, params) {
  const client = await pool.connect();
  try {
    return await client.query(text, params);
  } finally {
    client.release();
  }
}

async function runMigration() {
  console.log('Connecting to NEW Supabase database (eu-west-1)...');
  
  try {
    const res = await query('SELECT NOW() as time, current_database() as db');
    console.log('Connected! Database:', res.rows[0].db, 'Time:', res.rows[0].time);
  } catch (err) {
    console.error('Failed to connect:', err.message);
    process.exit(1);
  }

  // STEP 1: Core tables
  console.log('\nSTEP 1: Creating core tables...');

  const tables = [
    { name: 'users', sql: `CREATE TABLE IF NOT EXISTS users (
      id SERIAL PRIMARY KEY,
      username VARCHAR(100) UNIQUE NOT NULL,
      password_hash VARCHAR(255) NOT NULL,
      email VARCHAR(255),
      full_name VARCHAR(255),
      role VARCHAR(50) DEFAULT 'house_officer',
      training_level VARCHAR(50) DEFAULT 'house_officer',
      is_approved BOOLEAN DEFAULT FALSE,
      is_active BOOLEAN DEFAULT TRUE,
      must_change_password BOOLEAN DEFAULT FALSE,
      app_id VARCHAR(50) DEFAULT 'psa',
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      last_login TIMESTAMP
    )` },
    { name: 'patients', sql: `CREATE TABLE IF NOT EXISTS patients (
      id SERIAL PRIMARY KEY,
      hospital_number VARCHAR(100) UNIQUE,
      first_name VARCHAR(100) NOT NULL,
      last_name VARCHAR(100) NOT NULL,
      full_name VARCHAR(255) GENERATED ALWAYS AS (first_name || ' ' || last_name) STORED,
      date_of_birth DATE,
      gender VARCHAR(20),
      phone VARCHAR(50),
      email VARCHAR(255),
      address TEXT,
      blood_group VARCHAR(10),
      allergies TEXT,
      medical_history TEXT,
      primary_diagnosis TEXT,
      secondary_diagnoses JSONB DEFAULT '[]',
      ward VARCHAR(100),
      bed_number VARCHAR(50),
      emergency_contact_name VARCHAR(255),
      emergency_contact_phone VARCHAR(50),
      created_by INTEGER REFERENCES users(id),
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )` },
    { name: 'treatment_plans', sql: `CREATE TABLE IF NOT EXISTS treatment_plans (
      id SERIAL PRIMARY KEY,
      patient_id INTEGER REFERENCES patients(id) ON DELETE CASCADE,
      diagnosis TEXT NOT NULL,
      treatment_type VARCHAR(100),
      description TEXT,
      objectives JSONB DEFAULT '[]',
      procedures JSONB DEFAULT '[]',
      medications JSONB DEFAULT '[]',
      investigations JSONB DEFAULT '[]',
      follow_up_schedule JSONB DEFAULT '[]',
      medical_team JSONB,
      discharge_plan JSONB,
      notes TEXT,
      status VARCHAR(50) DEFAULT 'draft',
      created_by INTEGER REFERENCES users(id),
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )` },
    { name: 'treatment_plan_modifications', sql: `CREATE TABLE IF NOT EXISTS treatment_plan_modifications (
      id SERIAL PRIMARY KEY,
      plan_id INTEGER REFERENCES treatment_plans(id) ON DELETE CASCADE,
      patient_id INTEGER REFERENCES patients(id) ON DELETE CASCADE,
      patient_name VARCHAR(255),
      requested_by VARCHAR(255) NOT NULL,
      requested_by_role VARCHAR(50) NOT NULL,
      requested_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      source VARCHAR(50) DEFAULT 'direct_edit',
      ward_round_id INTEGER,
      mdt_session_id INTEGER,
      specialty_input VARCHAR(255),
      modification_type VARCHAR(50) NOT NULL,
      modification_action VARCHAR(50) NOT NULL,
      original_value JSONB,
      proposed_value JSONB NOT NULL,
      reason TEXT NOT NULL,
      clinical_justification TEXT,
      status VARCHAR(50) DEFAULT 'pending',
      priority VARCHAR(50) DEFAULT 'routine',
      reviewed_by VARCHAR(255),
      reviewed_by_role VARCHAR(50),
      reviewed_at TIMESTAMP,
      review_comments TEXT,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )` },
    { name: 'surgeries', sql: `CREATE TABLE IF NOT EXISTS surgeries (
      id SERIAL PRIMARY KEY,
      patient_id INTEGER REFERENCES patients(id) ON DELETE CASCADE,
      procedure_name VARCHAR(255) NOT NULL,
      procedure_type VARCHAR(100),
      scheduled_date TIMESTAMP NOT NULL,
      estimated_duration INTEGER,
      surgeon_id INTEGER REFERENCES users(id),
      anesthesia_type VARCHAR(100),
      operating_room VARCHAR(100),
      pre_op_notes TEXT,
      post_op_notes TEXT,
      required_equipment JSONB DEFAULT '[]',
      status VARCHAR(50) DEFAULT 'scheduled',
      actual_start_time TIMESTAMP,
      actual_end_time TIMESTAMP,
      created_by INTEGER REFERENCES users(id),
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )` },
    { name: 'admissions', sql: `CREATE TABLE IF NOT EXISTS admissions (
      id SERIAL PRIMARY KEY,
      patient_id INTEGER REFERENCES patients(id) ON DELETE CASCADE,
      admission_date TIMESTAMP NOT NULL,
      discharge_date TIMESTAMP,
      ward VARCHAR(100),
      bed_number VARCHAR(50),
      admitting_diagnosis TEXT,
      discharge_diagnosis TEXT,
      status VARCHAR(50) DEFAULT 'admitted',
      notes TEXT,
      created_by INTEGER REFERENCES users(id),
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )` },
    { name: 'lab_orders', sql: `CREATE TABLE IF NOT EXISTS lab_orders (
      id SERIAL PRIMARY KEY,
      patient_id INTEGER REFERENCES patients(id) ON DELETE CASCADE,
      test_type VARCHAR(255) NOT NULL,
      test_name VARCHAR(255),
      priority VARCHAR(50) DEFAULT 'routine',
      clinical_notes TEXT,
      status VARCHAR(50) DEFAULT 'pending',
      results JSONB,
      ordered_by INTEGER REFERENCES users(id),
      ordered_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      completed_at TIMESTAMP,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )` },
    { name: 'prescriptions', sql: `CREATE TABLE IF NOT EXISTS prescriptions (
      id SERIAL PRIMARY KEY,
      patient_id INTEGER REFERENCES patients(id) ON DELETE CASCADE,
      medication_name VARCHAR(255) NOT NULL,
      dosage VARCHAR(100),
      frequency VARCHAR(100),
      duration VARCHAR(100),
      route VARCHAR(100),
      instructions TEXT,
      status VARCHAR(50) DEFAULT 'active',
      prescribed_by INTEGER REFERENCES users(id),
      prescribed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )` },
    { name: 'wound_care_records', sql: `CREATE TABLE IF NOT EXISTS wound_care_records (
      id SERIAL PRIMARY KEY,
      patient_id INTEGER REFERENCES patients(id) ON DELETE CASCADE,
      wound_location VARCHAR(255),
      wound_type VARCHAR(100),
      wound_size TEXT,
      wound_stage VARCHAR(50),
      treatment_provided TEXT,
      dressing_used TEXT,
      observations TEXT,
      next_dressing_date DATE,
      images JSONB DEFAULT '[]',
      recorded_by INTEGER REFERENCES users(id),
      recorded_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )` },
    { name: 'cme_records', sql: `CREATE TABLE IF NOT EXISTS cme_records (
      id SERIAL PRIMARY KEY,
      user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
      topic_id VARCHAR(100),
      topic_title VARCHAR(255),
      category VARCHAR(100),
      score DECIMAL(5,2),
      total_questions INTEGER,
      correct_answers INTEGER,
      time_spent INTEGER,
      completed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )` },
    { name: 'cbt_tests', sql: `CREATE TABLE IF NOT EXISTS cbt_tests (
      id SERIAL PRIMARY KEY,
      test_number INTEGER NOT NULL,
      level VARCHAR(50) NOT NULL,
      title VARCHAR(255) NOT NULL,
      description TEXT,
      questions JSONB NOT NULL DEFAULT '[]',
      duration INTEGER DEFAULT 600,
      total_marks INTEGER DEFAULT 100,
      pass_mark INTEGER DEFAULT 50,
      scheduled_day VARCHAR(20) DEFAULT 'Tuesday',
      scheduled_time_start VARCHAR(10) DEFAULT '08:00',
      scheduled_time_end VARCHAR(10) DEFAULT '10:00',
      is_active BOOLEAN DEFAULT TRUE,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(test_number, level)
    )` },
    { name: 'cbt_attempts', sql: `CREATE TABLE IF NOT EXISTS cbt_attempts (
      id SERIAL PRIMARY KEY,
      test_id INTEGER REFERENCES cbt_tests(id) ON DELETE CASCADE,
      user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
      level VARCHAR(50) NOT NULL,
      test_number INTEGER NOT NULL,
      start_time TIMESTAMP NOT NULL,
      end_time TIMESTAMP,
      answers JSONB DEFAULT '{}',
      score INTEGER DEFAULT 0,
      total_marks INTEGER DEFAULT 100,
      percentage DECIMAL(5,2) DEFAULT 0,
      passed BOOLEAN DEFAULT FALSE,
      completed BOOLEAN DEFAULT FALSE,
      flagged_for_review JSONB DEFAULT '[]',
      tab_switch_count INTEGER DEFAULT 0,
      suspicious_activity BOOLEAN DEFAULT FALSE,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(user_id, level, test_number)
    )` },
    { name: 'training_progress', sql: `CREATE TABLE IF NOT EXISTS training_progress (
      id SERIAL PRIMARY KEY,
      user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
      topic_id VARCHAR(255) NOT NULL,
      level VARCHAR(50) DEFAULT 'house_officer',
      completed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(user_id, topic_id)
    )` },
    { name: 'trainee_rotations', sql: `CREATE TABLE IF NOT EXISTS trainee_rotations (
      id SERIAL PRIMARY KEY,
      user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
      level VARCHAR(50) NOT NULL,
      department VARCHAR(255) DEFAULT 'Plastic Surgery',
      start_date DATE NOT NULL,
      expected_end_date DATE NOT NULL,
      actual_end_date DATE,
      status VARCHAR(50) DEFAULT 'active',
      extension_count INTEGER DEFAULT 0,
      extension_reasons JSONB DEFAULT '[]',
      sign_out_approved BOOLEAN DEFAULT FALSE,
      sign_out_approved_by INTEGER REFERENCES users(id),
      sign_out_approved_at TIMESTAMP,
      sign_out_comments TEXT,
      self_assessment JSONB,
      supervisor_feedback JSONB,
      final_score DECIMAL(5,2),
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )` },
    { name: 'performance_snapshots', sql: `CREATE TABLE IF NOT EXISTS performance_snapshots (
      id SERIAL PRIMARY KEY,
      user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
      rotation_id INTEGER REFERENCES trainee_rotations(id) ON DELETE CASCADE,
      week_number INTEGER NOT NULL,
      cbt_score DECIMAL(5,2) DEFAULT 0,
      patient_care_score DECIMAL(5,2) DEFAULT 0,
      duty_promptness_score DECIMAL(5,2) DEFAULT 0,
      attendance_score DECIMAL(5,2) DEFAULT 0,
      overall_score DECIMAL(5,2) DEFAULT 0,
      snapshot_date DATE NOT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )` },
    { name: 'activity_logs', sql: `CREATE TABLE IF NOT EXISTS activity_logs (
      id SERIAL PRIMARY KEY,
      user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
      activity_type VARCHAR(100) NOT NULL,
      description TEXT NOT NULL,
      points INTEGER DEFAULT 0,
      reference_type VARCHAR(100),
      reference_id INTEGER,
      metadata JSONB DEFAULT '{}',
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )` },
    { name: 'duty_assignments', sql: `CREATE TABLE IF NOT EXISTS duty_assignments (
      id SERIAL PRIMARY KEY,
      user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
      title VARCHAR(255) NOT NULL,
      description TEXT,
      category VARCHAR(100),
      priority VARCHAR(20) DEFAULT 'medium',
      assigned_by INTEGER REFERENCES users(id),
      assigned_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      due_at TIMESTAMP NOT NULL,
      responded_at TIMESTAMP,
      completed_at TIMESTAMP,
      status VARCHAR(50) DEFAULT 'pending',
      promptness_score INTEGER,
      completion_notes TEXT,
      outcome VARCHAR(100),
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )` },
    { name: 'ward_rounds', sql: `CREATE TABLE IF NOT EXISTS ward_rounds (
      id SERIAL PRIMARY KEY,
      patient_id INTEGER REFERENCES patients(id) ON DELETE CASCADE,
      admission_id INTEGER REFERENCES admissions(id),
      user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
      round_date DATE NOT NULL,
      round_type VARCHAR(50) DEFAULT 'routine',
      findings TEXT,
      plan TEXT,
      vital_signs JSONB DEFAULT '{}',
      current_medications JSONB DEFAULT '[]',
      new_orders JSONB DEFAULT '[]',
      consultant_instructions TEXT,
      issues JSONB DEFAULT '[]',
      nursing_notes TEXT,
      addendum TEXT,
      consultant_reviewed BOOLEAN DEFAULT FALSE,
      consultant_reviewed_by INTEGER REFERENCES users(id),
      consultant_reviewed_at TIMESTAMP,
      consultant_feedback TEXT,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )` },
    { name: 'discharge_summaries', sql: `CREATE TABLE IF NOT EXISTS discharge_summaries (
      id SERIAL PRIMARY KEY,
      patient_id INTEGER REFERENCES patients(id) ON DELETE CASCADE,
      admission_id INTEGER REFERENCES admissions(id) ON DELETE CASCADE,
      prepared_by INTEGER REFERENCES users(id),
      discharge_date DATE NOT NULL,
      admission_date DATE,
      primary_diagnosis TEXT NOT NULL,
      secondary_diagnoses JSONB DEFAULT '[]',
      hospital_course TEXT,
      procedures JSONB DEFAULT '[]',
      investigations JSONB DEFAULT '[]',
      discharge_medications JSONB DEFAULT '[]',
      follow_up_instructions TEXT,
      follow_up_date DATE,
      follow_up_clinic VARCHAR(255),
      dietary_advice TEXT,
      activity_restrictions TEXT,
      wound_care_instructions TEXT,
      warning_symptoms JSONB DEFAULT '[]',
      emergency_contact VARCHAR(255),
      referrals JSONB DEFAULT '[]',
      condition_on_discharge VARCHAR(100),
      discharge_type VARCHAR(50) DEFAULT 'routine',
      notes TEXT,
      status VARCHAR(50) DEFAULT 'draft',
      approved_by INTEGER REFERENCES users(id),
      approved_at TIMESTAMP,
      approval_feedback TEXT,
      required_changes JSONB DEFAULT '[]',
      amendments JSONB DEFAULT '[]',
      finalized_at TIMESTAMP,
      self_assessment JSONB,
      supervisor_feedback JSONB,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )` },
    { name: 'audit_log', sql: `CREATE TABLE IF NOT EXISTS audit_log (
      id SERIAL PRIMARY KEY,
      user_id INTEGER REFERENCES users(id),
      action VARCHAR(100) NOT NULL,
      entity_type VARCHAR(100),
      entity_id INTEGER,
      old_values JSONB,
      new_values JSONB,
      ip_address VARCHAR(50),
      user_agent TEXT,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )` },
    { name: 'sync_queue', sql: `CREATE TABLE IF NOT EXISTS sync_queue (
      id SERIAL PRIMARY KEY,
      user_id INTEGER REFERENCES users(id),
      entity_type VARCHAR(100) NOT NULL,
      entity_id VARCHAR(100),
      action VARCHAR(50) NOT NULL,
      data JSONB,
      status VARCHAR(50) DEFAULT 'pending',
      error_message TEXT,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      processed_at TIMESTAMP
    )` },
    { name: 'push_subscriptions', sql: `CREATE TABLE IF NOT EXISTS push_subscriptions (
      id SERIAL PRIMARY KEY,
      user_id TEXT NOT NULL,
      endpoint TEXT NOT NULL,
      keys JSONB NOT NULL,
      is_active BOOLEAN DEFAULT TRUE,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(user_id, endpoint)
    )` },
    { name: 'mdt_patient_teams', sql: `CREATE TABLE IF NOT EXISTS mdt_patient_teams (
      id SERIAL PRIMARY KEY,
      patient_id INTEGER REFERENCES patients(id) ON DELETE CASCADE UNIQUE,
      patient_name VARCHAR(255),
      hospital_number VARCHAR(100),
      primary_specialty VARCHAR(255) DEFAULT 'Plastic Surgery',
      is_active BOOLEAN DEFAULT TRUE,
      specialties JSONB DEFAULT '[]',
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )` },
    { name: 'mdt_meetings', sql: `CREATE TABLE IF NOT EXISTS mdt_meetings (
      id SERIAL PRIMARY KEY,
      patient_id INTEGER REFERENCES patients(id) ON DELETE CASCADE,
      patient_name VARCHAR(255),
      hospital_number VARCHAR(100),
      meeting_title VARCHAR(255),
      meeting_date DATE NOT NULL,
      meeting_time VARCHAR(20),
      location VARCHAR(255),
      meeting_type VARCHAR(50) DEFAULT 'routine',
      status VARCHAR(50) DEFAULT 'scheduled',
      agenda TEXT,
      attending_specialties JSONB DEFAULT '[]',
      discussion_points TEXT,
      decisions_made TEXT,
      action_items JSONB DEFAULT '[]',
      next_meeting_date DATE,
      created_by VARCHAR(255),
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )` },
    { name: 'mdt_contact_logs', sql: `CREATE TABLE IF NOT EXISTS mdt_contact_logs (
      id SERIAL PRIMARY KEY,
      patient_id INTEGER REFERENCES patients(id) ON DELETE CASCADE,
      patient_name VARCHAR(255),
      hospital_number VARCHAR(100),
      specialty_id VARCHAR(100),
      specialty_name VARCHAR(255),
      contact_type VARCHAR(50),
      contact_date DATE NOT NULL,
      contact_time VARCHAR(20),
      contacted_person VARCHAR(255),
      reason TEXT,
      discussion_summary TEXT,
      outcome TEXT,
      follow_up_required BOOLEAN DEFAULT FALSE,
      follow_up_date DATE,
      created_by VARCHAR(255),
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )` },
    { name: 'blood_transfusions', sql: `CREATE TABLE IF NOT EXISTS blood_transfusions (
      id SERIAL PRIMARY KEY,
      patient_id INTEGER REFERENCES patients(id) ON DELETE CASCADE,
      hospital_number VARCHAR(100),
      patient_name VARCHAR(255),
      transfusion_date DATE NOT NULL,
      blood_product VARCHAR(100) NOT NULL,
      blood_group VARCHAR(20),
      units INTEGER DEFAULT 1,
      indication TEXT,
      pre_transfusion_hb DECIMAL(5,2),
      post_transfusion_hb DECIMAL(5,2),
      status VARCHAR(50) DEFAULT 'pending',
      adverse_reactions TEXT,
      administered_by VARCHAR(255),
      verified_by VARCHAR(255),
      notes TEXT,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )` },
    { name: 'burn_patients', sql: `CREATE TABLE IF NOT EXISTS burn_patients (
      id SERIAL PRIMARY KEY,
      patient_id INTEGER REFERENCES patients(id) ON DELETE CASCADE,
      hospital_number VARCHAR(100),
      patient_name VARCHAR(255),
      admission_date DATE NOT NULL,
      burn_date DATE,
      mechanism VARCHAR(255),
      tbsa_percentage DECIMAL(5,2) NOT NULL,
      burn_depth VARCHAR(100),
      burn_areas JSONB DEFAULT '[]',
      inhalation_injury BOOLEAN DEFAULT FALSE,
      baux_score INTEGER,
      fluid_requirements JSONB DEFAULT '{}',
      disposition VARCHAR(100),
      status VARCHAR(50) DEFAULT 'admitted',
      notes TEXT,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )` },
    { name: 'diabetic_foot_assessments', sql: `CREATE TABLE IF NOT EXISTS diabetic_foot_assessments (
      id SERIAL PRIMARY KEY,
      patient_id INTEGER REFERENCES patients(id) ON DELETE CASCADE,
      hospital_number VARCHAR(100),
      patient_name VARCHAR(255),
      assessment_date DATE NOT NULL,
      affected_limb VARCHAR(50),
      wagner_grade INTEGER,
      texas_stage VARCHAR(10),
      wifi_wound INTEGER,
      wifi_ischemia INTEGER,
      wifi_infection INTEGER,
      wifi_score INTEGER,
      abi_left DECIMAL(4,2),
      abi_right DECIMAL(4,2),
      tbi_left DECIMAL(4,2),
      tbi_right DECIMAL(4,2),
      risk_category VARCHAR(50),
      treatment_plan TEXT,
      amputation_risk VARCHAR(50),
      status VARCHAR(50) DEFAULT 'active',
      assessed_by VARCHAR(255),
      notes TEXT,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )` },
    { name: 'preoperative_assessments', sql: `CREATE TABLE IF NOT EXISTS preoperative_assessments (
      id SERIAL PRIMARY KEY,
      patient_id INTEGER REFERENCES patients(id) ON DELETE CASCADE,
      surgery_id INTEGER REFERENCES surgeries(id),
      hospital_number VARCHAR(100),
      patient_name VARCHAR(255),
      assessment_date DATE NOT NULL,
      asa_class INTEGER,
      mallampati_score INTEGER,
      airway_assessment JSONB DEFAULT '{}',
      cardiovascular JSONB DEFAULT '{}',
      respiratory JSONB DEFAULT '{}',
      renal JSONB DEFAULT '{}',
      hepatic JSONB DEFAULT '{}',
      endocrine JSONB DEFAULT '{}',
      hematologic JSONB DEFAULT '{}',
      current_medications JSONB DEFAULT '[]',
      allergies TEXT,
      fasting_status TEXT,
      consent_obtained BOOLEAN DEFAULT FALSE,
      blood_available BOOLEAN DEFAULT FALSE,
      icu_bed_reserved BOOLEAN DEFAULT FALSE,
      fitness_for_surgery VARCHAR(50),
      anesthesia_plan TEXT,
      assessed_by VARCHAR(255),
      notes TEXT,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )` },
    { name: 'dvt_assessments', sql: `CREATE TABLE IF NOT EXISTS dvt_assessments (
      id SERIAL PRIMARY KEY,
      patient_id INTEGER REFERENCES patients(id) ON DELETE CASCADE,
      hospital_number VARCHAR(100),
      patient_name VARCHAR(255),
      assessment_date DATE NOT NULL,
      assessment_type VARCHAR(50) DEFAULT 'caprini',
      risk_factors JSONB DEFAULT '[]',
      score INTEGER DEFAULT 0,
      risk_level VARCHAR(50),
      prophylaxis_recommended TEXT,
      prophylaxis_given BOOLEAN DEFAULT FALSE,
      contraindications TEXT,
      assessed_by VARCHAR(255),
      status VARCHAR(50) DEFAULT 'active',
      notes TEXT,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )` },
    { name: 'pressure_sore_assessments', sql: `CREATE TABLE IF NOT EXISTS pressure_sore_assessments (
      id SERIAL PRIMARY KEY,
      patient_id INTEGER REFERENCES patients(id) ON DELETE CASCADE,
      hospital_number VARCHAR(100),
      patient_name VARCHAR(255),
      assessment_date DATE NOT NULL,
      assessment_type VARCHAR(50) DEFAULT 'braden',
      sensory_perception INTEGER,
      moisture INTEGER,
      activity INTEGER,
      mobility INTEGER,
      nutrition INTEGER,
      friction_shear INTEGER,
      score INTEGER DEFAULT 0,
      risk_level VARCHAR(50),
      prevention_measures JSONB DEFAULT '[]',
      existing_ulcers JSONB DEFAULT '[]',
      assessed_by VARCHAR(255),
      status VARCHAR(50) DEFAULT 'active',
      notes TEXT,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )` },
    { name: 'nutritional_assessments', sql: `CREATE TABLE IF NOT EXISTS nutritional_assessments (
      id SERIAL PRIMARY KEY,
      patient_id INTEGER REFERENCES patients(id) ON DELETE CASCADE,
      hospital_number VARCHAR(100),
      patient_name VARCHAR(255),
      assessment_date DATE NOT NULL,
      assessment_type VARCHAR(50) DEFAULT 'must',
      bmi DECIMAL(5,2),
      weight_loss_percentage DECIMAL(5,2),
      acute_illness_effect BOOLEAN DEFAULT FALSE,
      score INTEGER DEFAULT 0,
      risk_level VARCHAR(50),
      nutritional_plan TEXT,
      dietitian_referral BOOLEAN DEFAULT FALSE,
      supplements_prescribed JSONB DEFAULT '[]',
      assessed_by VARCHAR(255),
      status VARCHAR(50) DEFAULT 'active',
      notes TEXT,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )` },
    { name: 'procedures', sql: `CREATE TABLE IF NOT EXISTS procedures (
      id SERIAL PRIMARY KEY,
      patient_id INTEGER REFERENCES patients(id) ON DELETE CASCADE,
      surgery_id INTEGER REFERENCES surgeries(id),
      hospital_number VARCHAR(100),
      patient_name VARCHAR(255),
      procedure_name VARCHAR(255) NOT NULL,
      procedure_code VARCHAR(50),
      procedure_type VARCHAR(100),
      procedure_date DATE NOT NULL,
      surgeon VARCHAR(255),
      assistant VARCHAR(255),
      anesthetist VARCHAR(255),
      anesthesia_type VARCHAR(100),
      duration_minutes INTEGER,
      blood_loss_ml INTEGER,
      findings TEXT,
      complications TEXT,
      implants_used JSONB DEFAULT '[]',
      status VARCHAR(50) DEFAULT 'completed',
      notes TEXT,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )` },
    { name: 'who_safety_checklists', sql: `CREATE TABLE IF NOT EXISTS who_safety_checklists (
      id SERIAL PRIMARY KEY,
      patient_id INTEGER REFERENCES patients(id) ON DELETE CASCADE,
      surgery_id INTEGER REFERENCES surgeries(id),
      procedure_id INTEGER REFERENCES procedures(id),
      hospital_number VARCHAR(100),
      patient_name VARCHAR(255),
      procedure_name VARCHAR(255),
      checklist_date DATE NOT NULL,
      sign_in JSONB DEFAULT '{}',
      time_out JSONB DEFAULT '{}',
      sign_out JSONB DEFAULT '{}',
      sign_in_completed BOOLEAN DEFAULT FALSE,
      sign_in_by VARCHAR(255),
      sign_in_at TIMESTAMP,
      time_out_completed BOOLEAN DEFAULT FALSE,
      time_out_by VARCHAR(255),
      time_out_at TIMESTAMP,
      sign_out_completed BOOLEAN DEFAULT FALSE,
      sign_out_by VARCHAR(255),
      sign_out_at TIMESTAMP,
      overall_completion DECIMAL(5,2) DEFAULT 0,
      issues_identified JSONB DEFAULT '[]',
      status VARCHAR(50) DEFAULT 'in_progress',
      notes TEXT,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )` },
    { name: 'keloid_care_plans', sql: `CREATE TABLE IF NOT EXISTS keloid_care_plans (
      id SERIAL PRIMARY KEY,
      patient_id INTEGER NOT NULL REFERENCES patients(id),
      clinical_summary TEXT NOT NULL,
      keloid_locations TEXT[] DEFAULT '{}',
      problems_concerns TEXT[] DEFAULT '{}',
      comorbidities TEXT[] DEFAULT '{}',
      has_no_comorbidities BOOLEAN DEFAULT FALSE,
      risk_factors TEXT[] DEFAULT '{}',
      preop_triamcinolone_count INTEGER DEFAULT 0,
      preop_injection_interval_weeks INTEGER DEFAULT 3,
      surgery_planned BOOLEAN DEFAULT FALSE,
      surgery_date DATE,
      surgery_technique TEXT,
      surgery_notes TEXT,
      postop_triamcinolone_count INTEGER DEFAULT 0,
      postop_injection_interval_weeks INTEGER DEFAULT 3,
      silicone_sheet_start_date DATE,
      silicone_sheet_duration_months INTEGER,
      compression_therapy_start_date DATE,
      compression_therapy_duration_months INTEGER,
      radiotherapy_indicated BOOLEAN DEFAULT FALSE,
      radiotherapy_indications TEXT[] DEFAULT '{}',
      radiotherapy_timing TEXT,
      radiotherapy_dose TEXT,
      radiotherapy_fractions INTEGER,
      radiotherapy_side_effects TEXT[] DEFAULT '{}',
      radiotherapy_management TEXT,
      status VARCHAR(50) DEFAULT 'active',
      phase VARCHAR(50) DEFAULT 'pre_treatment',
      compliance_notes TEXT,
      created_by INTEGER REFERENCES users(id),
      created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
    )` },
    { name: 'keloid_pretreatment_tests', sql: `CREATE TABLE IF NOT EXISTS keloid_pretreatment_tests (
      id SERIAL PRIMARY KEY,
      keloid_plan_id INTEGER NOT NULL REFERENCES keloid_care_plans(id) ON DELETE CASCADE,
      test_type VARCHAR(100) NOT NULL,
      test_name VARCHAR(255) NOT NULL,
      ordered_date DATE NOT NULL,
      result_date DATE,
      result_value TEXT,
      result_status VARCHAR(50) DEFAULT 'pending',
      is_within_normal BOOLEAN,
      notes TEXT,
      created_by INTEGER REFERENCES users(id),
      created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
    )` },
    { name: 'keloid_injections', sql: `CREATE TABLE IF NOT EXISTS keloid_injections (
      id SERIAL PRIMARY KEY,
      keloid_plan_id INTEGER NOT NULL REFERENCES keloid_care_plans(id) ON DELETE CASCADE,
      injection_number INTEGER NOT NULL,
      injection_phase VARCHAR(20) NOT NULL,
      scheduled_date DATE NOT NULL,
      actual_date DATE,
      dose_mg DECIMAL(10,2),
      concentration VARCHAR(50),
      volume_ml DECIMAL(10,2),
      injection_site TEXT,
      response_notes TEXT,
      adverse_effects TEXT,
      administered_by INTEGER REFERENCES users(id),
      status VARCHAR(50) DEFAULT 'scheduled',
      created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
    )` },
    { name: 'team_activities', sql: `CREATE TABLE IF NOT EXISTS team_activities (
      id SERIAL PRIMARY KEY,
      patient_id INTEGER NOT NULL,
      user_id INTEGER NOT NULL,
      assigned_staff_id INTEGER,
      activity_type VARCHAR(100) NOT NULL,
      description TEXT,
      notes TEXT,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )` },
    { name: 'patient_assignments', sql: `CREATE TABLE IF NOT EXISTS patient_assignments (
      id SERIAL PRIMARY KEY,
      patient_id VARCHAR(255) NOT NULL,
      hospital_number VARCHAR(100),
      consultant_id VARCHAR(50),
      senior_registrar_id VARCHAR(50),
      registrar_id VARCHAR(50),
      house_officer_id VARCHAR(50),
      admission_type VARCHAR(50),
      assigned_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      is_active BOOLEAN DEFAULT TRUE,
      UNIQUE(patient_id)
    )` }
  ];

  let created = 0;
  for (const table of tables) {
    try {
      await query(table.sql);
      console.log('  + ' + table.name);
      created++;
    } catch (err) {
      console.error('  X ' + table.name + ':', err.message);
    }
  }
  console.log(`Created ${created}/${tables.length} tables`);

  // STEP 2: Indexes
  console.log('\nSTEP 2: Creating indexes...');
  const indexStatements = [
    'CREATE INDEX IF NOT EXISTS idx_patients_hospital_number ON patients(hospital_number)',
    'CREATE INDEX IF NOT EXISTS idx_patients_name ON patients(last_name, first_name)',
    'CREATE INDEX IF NOT EXISTS idx_surgeries_date ON surgeries(scheduled_date)',
    'CREATE INDEX IF NOT EXISTS idx_surgeries_patient ON surgeries(patient_id)',
    'CREATE INDEX IF NOT EXISTS idx_admissions_patient ON admissions(patient_id)',
    'CREATE INDEX IF NOT EXISTS idx_admissions_status ON admissions(status)',
    'CREATE INDEX IF NOT EXISTS idx_lab_orders_patient ON lab_orders(patient_id)',
    'CREATE INDEX IF NOT EXISTS idx_audit_log_user ON audit_log(user_id)',
    'CREATE INDEX IF NOT EXISTS idx_audit_log_created ON audit_log(created_at)',
    'CREATE INDEX IF NOT EXISTS idx_cbt_tests_level ON cbt_tests(level)',
    'CREATE INDEX IF NOT EXISTS idx_cbt_attempts_user ON cbt_attempts(user_id)',
    'CREATE INDEX IF NOT EXISTS idx_cbt_attempts_level ON cbt_attempts(level)',
    'CREATE INDEX IF NOT EXISTS idx_cbt_attempts_completed ON cbt_attempts(completed)',
    'CREATE INDEX IF NOT EXISTS idx_rotations_user ON trainee_rotations(user_id)',
    'CREATE INDEX IF NOT EXISTS idx_rotations_status ON trainee_rotations(status)',
    'CREATE INDEX IF NOT EXISTS idx_rotations_level ON trainee_rotations(level)',
    'CREATE INDEX IF NOT EXISTS idx_performance_user ON performance_snapshots(user_id)',
    'CREATE INDEX IF NOT EXISTS idx_performance_rotation ON performance_snapshots(rotation_id)',
    'CREATE INDEX IF NOT EXISTS idx_performance_date ON performance_snapshots(snapshot_date)',
    'CREATE INDEX IF NOT EXISTS idx_activity_user ON activity_logs(user_id)',
    'CREATE INDEX IF NOT EXISTS idx_activity_type ON activity_logs(activity_type)',
    'CREATE INDEX IF NOT EXISTS idx_activity_created ON activity_logs(created_at)',
    'CREATE INDEX IF NOT EXISTS idx_duties_user ON duty_assignments(user_id)',
    'CREATE INDEX IF NOT EXISTS idx_duties_status ON duty_assignments(status)',
    'CREATE INDEX IF NOT EXISTS idx_duties_due ON duty_assignments(due_at)',
    'CREATE INDEX IF NOT EXISTS idx_ward_rounds_patient ON ward_rounds(patient_id)',
    'CREATE INDEX IF NOT EXISTS idx_ward_rounds_user ON ward_rounds(user_id)',
    'CREATE INDEX IF NOT EXISTS idx_ward_rounds_date ON ward_rounds(round_date)',
    'CREATE INDEX IF NOT EXISTS idx_discharge_patient ON discharge_summaries(patient_id)',
    'CREATE INDEX IF NOT EXISTS idx_discharge_admission ON discharge_summaries(admission_id)',
    'CREATE INDEX IF NOT EXISTS idx_mdt_teams_patient ON mdt_patient_teams(patient_id)',
    'CREATE INDEX IF NOT EXISTS idx_mdt_teams_active ON mdt_patient_teams(is_active)',
    'CREATE INDEX IF NOT EXISTS idx_mdt_meetings_patient ON mdt_meetings(patient_id)',
    'CREATE INDEX IF NOT EXISTS idx_mdt_meetings_date ON mdt_meetings(meeting_date)',
    'CREATE INDEX IF NOT EXISTS idx_mdt_meetings_status ON mdt_meetings(status)',
    'CREATE INDEX IF NOT EXISTS idx_mdt_contacts_patient ON mdt_contact_logs(patient_id)',
    'CREATE INDEX IF NOT EXISTS idx_mdt_contacts_date ON mdt_contact_logs(contact_date)',
    'CREATE INDEX IF NOT EXISTS idx_transfusions_patient ON blood_transfusions(patient_id)',
    'CREATE INDEX IF NOT EXISTS idx_transfusions_date ON blood_transfusions(transfusion_date)',
    'CREATE INDEX IF NOT EXISTS idx_burns_patient ON burn_patients(patient_id)',
    'CREATE INDEX IF NOT EXISTS idx_burns_status ON burn_patients(status)',
    'CREATE INDEX IF NOT EXISTS idx_diabetic_foot_patient ON diabetic_foot_assessments(patient_id)',
    'CREATE INDEX IF NOT EXISTS idx_diabetic_foot_date ON diabetic_foot_assessments(assessment_date)',
    'CREATE INDEX IF NOT EXISTS idx_preop_patient ON preoperative_assessments(patient_id)',
    'CREATE INDEX IF NOT EXISTS idx_preop_surgery ON preoperative_assessments(surgery_id)',
    'CREATE INDEX IF NOT EXISTS idx_dvt_patient ON dvt_assessments(patient_id)',
    'CREATE INDEX IF NOT EXISTS idx_pressure_patient ON pressure_sore_assessments(patient_id)',
    'CREATE INDEX IF NOT EXISTS idx_nutrition_patient ON nutritional_assessments(patient_id)',
    'CREATE INDEX IF NOT EXISTS idx_procedures_patient ON procedures(patient_id)',
    'CREATE INDEX IF NOT EXISTS idx_procedures_date ON procedures(procedure_date)',
    'CREATE INDEX IF NOT EXISTS idx_who_checklist_patient ON who_safety_checklists(patient_id)',
    'CREATE INDEX IF NOT EXISTS idx_who_checklist_surgery ON who_safety_checklists(surgery_id)',
    'CREATE INDEX IF NOT EXISTS idx_keloid_plans_patient ON keloid_care_plans(patient_id)',
    'CREATE INDEX IF NOT EXISTS idx_keloid_injections_plan ON keloid_injections(keloid_plan_id)',
    'CREATE INDEX IF NOT EXISTS idx_keloid_tests_plan ON keloid_pretreatment_tests(keloid_plan_id)'
  ];

  let idxCreated = 0;
  for (const idx of indexStatements) {
    try {
      await query(idx);
      idxCreated++;
    } catch (err) {
      console.error('  Index error:', err.message);
    }
  }
  console.log(`  Created ${idxCreated}/${indexStatements.length} indexes`);

  // STEP 3: Admin users
  console.log('\nSTEP 3: Creating admin users...');

  try {
    const existing = await query('SELECT id FROM users WHERE username = $1', ['admin']);
    if (existing.rows.length === 0) {
      const hash = await bcrypt.hash('Admin@123!', 10);
      await query(
        `INSERT INTO users (username, password_hash, email, full_name, role, is_approved, is_active, app_id)
         VALUES ($1, $2, $3, $4, $5, true, true, $6)`,
        ['admin', hash, 'admin@hospital.com', 'System Administrator', 'admin', 'psa']
      );
      console.log('  + admin / Admin@123!');
    } else {
      console.log('  = admin already exists');
    }
  } catch (err) {
    console.error('  X admin:', err.message);
  }

  try {
    const existing = await query('SELECT id FROM users WHERE email = $1', ['douglas@unth.ng']);
    if (existing.rows.length === 0) {
      const hash = await bcrypt.hash('Surgeon@2026', 10);
      await query(
        `INSERT INTO users (username, password_hash, email, full_name, role, is_approved, is_active, app_id)
         VALUES ($1, $2, $3, $4, $5, true, true, $6)`,
        ['douglas', hash, 'douglas@unth.ng', 'Dr. Douglas', 'super_admin', 'psa']
      );
      console.log('  + douglas@unth.ng / Surgeon@2026');
    } else {
      console.log('  = douglas@unth.ng already exists');
    }
  } catch (err) {
    console.error('  X douglas@unth.ng:', err.message);
  }

  // STEP 4: Verify
  console.log('\nSTEP 4: Verification...');
  try {
    const tc = await query(`SELECT COUNT(*) as count FROM information_schema.tables WHERE table_schema = 'public' AND table_type = 'BASE TABLE'`);
    console.log('  Total tables:', tc.rows[0].count);

    const tl = await query(`SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' AND table_type = 'BASE TABLE' ORDER BY table_name`);
    tl.rows.forEach(t => console.log('    -', t.table_name));

    const uc = await query('SELECT id, username, email, role, is_approved, app_id FROM users');
    console.log('  Users:', uc.rows.length);
    uc.rows.forEach(u => console.log('    -', u.username, `(${u.email})`, `[${u.role}]`, 'approved=' + u.is_approved));
  } catch (err) {
    console.error('  Verification error:', err.message);
  }

  console.log('\n========================================');
  console.log('DATABASE MIGRATION COMPLETE!');
  console.log('========================================');
}

runMigration()
  .then(() => { console.log('\nDone!'); process.exit(0); })
  .catch(err => { console.error('\nFailed:', err); process.exit(1); });
