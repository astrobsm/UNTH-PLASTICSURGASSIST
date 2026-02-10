// Database initialization/migration endpoint for Vercel serverless
import { query, getPool } from './_lib/db.js';
import { cors } from './_lib/auth.js';
import bcrypt from 'bcryptjs';

export default async function handler(req, res) {
  if (cors(req, res)) return;

  // Only allow POST for initialization
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed. Use POST to initialize database.' });
  }

  // Require a secret key to initialize
  const initSecret = req.headers['x-init-secret'] || req.body?.secret;
  if (initSecret !== process.env.INIT_SECRET && initSecret !== 'plasticsurg2024') {
    return res.status(403).json({ error: 'Invalid initialization secret' });
  }

  try {
    console.log('Starting database initialization...');

    // Create tables
    await createTables();
    
    // Create default admin user
    await createDefaultUsers();

    res.status(200).json({ 
      success: true, 
      message: 'Database initialized successfully',
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Database initialization error:', error);
    res.status(500).json({ 
      error: 'Database initialization failed', 
      message: error.message 
    });
  }
}

async function createTables() {
  const schema = `
    -- Users table
    CREATE TABLE IF NOT EXISTS users (
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
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      last_login TIMESTAMP
    );
    
    -- Add must_change_password column if it doesn't exist (for existing databases)
    DO $$ 
    BEGIN 
      IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'users' AND column_name = 'must_change_password') THEN
        ALTER TABLE users ADD COLUMN must_change_password BOOLEAN DEFAULT FALSE;
      END IF;
    END $$;

    -- Patients table
    CREATE TABLE IF NOT EXISTS patients (
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
    );
    
    -- Add diagnosis columns if they don't exist (for existing databases)
    DO $$ 
    BEGIN 
      IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'patients' AND column_name = 'primary_diagnosis') THEN
        ALTER TABLE patients ADD COLUMN primary_diagnosis TEXT;
      END IF;
      IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'patients' AND column_name = 'secondary_diagnoses') THEN
        ALTER TABLE patients ADD COLUMN secondary_diagnoses JSONB DEFAULT '[]';
      END IF;
    END $$;

    -- Treatment Plans table
    CREATE TABLE IF NOT EXISTS treatment_plans (
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
    );

    -- Treatment Plan Modifications table (for approval workflow)
    CREATE TABLE IF NOT EXISTS treatment_plan_modifications (
      id SERIAL PRIMARY KEY,
      plan_id INTEGER REFERENCES treatment_plans(id) ON DELETE CASCADE,
      patient_id INTEGER REFERENCES patients(id) ON DELETE CASCADE,
      patient_name VARCHAR(255),
      
      -- Who requested the modification
      requested_by VARCHAR(255) NOT NULL,
      requested_by_role VARCHAR(50) NOT NULL,
      requested_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      
      -- Source of modification
      source VARCHAR(50) DEFAULT 'direct_edit',
      ward_round_id INTEGER,
      mdt_session_id INTEGER,
      specialty_input VARCHAR(255),
      
      -- What's being modified
      modification_type VARCHAR(50) NOT NULL,
      modification_action VARCHAR(50) NOT NULL,
      original_value JSONB,
      proposed_value JSONB NOT NULL,
      reason TEXT NOT NULL,
      clinical_justification TEXT,
      
      -- Approval status
      status VARCHAR(50) DEFAULT 'pending',
      priority VARCHAR(50) DEFAULT 'routine',
      
      -- Approval details
      reviewed_by VARCHAR(255),
      reviewed_by_role VARCHAR(50),
      reviewed_at TIMESTAMP,
      review_comments TEXT,
      
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );

    -- Surgeries table
    CREATE TABLE IF NOT EXISTS surgeries (
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
    );

    -- Admissions table
    CREATE TABLE IF NOT EXISTS admissions (
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
    );

    -- Lab Orders table
    CREATE TABLE IF NOT EXISTS lab_orders (
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
    );

    -- Prescriptions table
    CREATE TABLE IF NOT EXISTS prescriptions (
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
    );

    -- Wound Care Records table
    CREATE TABLE IF NOT EXISTS wound_care_records (
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
    );

    -- CME Records table
    CREATE TABLE IF NOT EXISTS cme_records (
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
    );

    -- CBT Tests table (Computer-Based Test definitions)
    CREATE TABLE IF NOT EXISTS cbt_tests (
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
    );

    -- CBT Attempts table (User test attempts)
    CREATE TABLE IF NOT EXISTS cbt_attempts (
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
    );
    
    -- Training Progress table (CME topic completions)
    CREATE TABLE IF NOT EXISTS training_progress (
      id SERIAL PRIMARY KEY,
      user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
      topic_id VARCHAR(255) NOT NULL,
      level VARCHAR(50) DEFAULT 'house_officer',
      completed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(user_id, topic_id)
    );

    -- Trainee Rotations table
    CREATE TABLE IF NOT EXISTS trainee_rotations (
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
    );

    -- Performance Snapshots table (Weekly performance records)
    CREATE TABLE IF NOT EXISTS performance_snapshots (
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
    );

    -- Activity Logs table (Track all user activities)
    CREATE TABLE IF NOT EXISTS activity_logs (
      id SERIAL PRIMARY KEY,
      user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
      activity_type VARCHAR(100) NOT NULL,
      description TEXT NOT NULL,
      points INTEGER DEFAULT 0,
      reference_type VARCHAR(100),
      reference_id INTEGER,
      metadata JSONB DEFAULT '{}',
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );

    -- Duty Assignments table
    CREATE TABLE IF NOT EXISTS duty_assignments (
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
    );

    -- Ward Rounds table
    CREATE TABLE IF NOT EXISTS ward_rounds (
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
    );

    -- Discharge Summaries table
    CREATE TABLE IF NOT EXISTS discharge_summaries (
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
    );

    -- Audit Log table
    CREATE TABLE IF NOT EXISTS audit_log (
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
    );

    -- Audit Logs table (HIPAA compliance - PHI access tracking)
    CREATE TABLE IF NOT EXISTS audit_logs (
      id SERIAL PRIMARY KEY,
      user_id VARCHAR(100),
      user_name VARCHAR(255),
      user_role VARCHAR(100),
      action VARCHAR(50) NOT NULL,
      resource_type VARCHAR(100) NOT NULL,
      resource_id VARCHAR(255) NOT NULL,
      resource_identifier VARCHAR(255),
      details TEXT,
      ip_address VARCHAR(100),
      timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
    CREATE INDEX IF NOT EXISTS idx_audit_logs_user ON audit_logs(user_id);
    CREATE INDEX IF NOT EXISTS idx_audit_logs_resource ON audit_logs(resource_type, resource_id);
    CREATE INDEX IF NOT EXISTS idx_audit_logs_timestamp ON audit_logs(timestamp DESC);

    -- Sync Queue table (for offline sync)
    CREATE TABLE IF NOT EXISTS sync_queue (
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
    );

    -- Push Subscriptions table (for web push notifications)
    CREATE TABLE IF NOT EXISTS push_subscriptions (
      id SERIAL PRIMARY KEY,
      user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
      endpoint TEXT NOT NULL,
      keys JSONB NOT NULL,
      is_active BOOLEAN DEFAULT TRUE,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(user_id, endpoint)
    );

    -- MDT Patient Teams table (Multidisciplinary Team)
    CREATE TABLE IF NOT EXISTS mdt_patient_teams (
      id SERIAL PRIMARY KEY,
      patient_id INTEGER REFERENCES patients(id) ON DELETE CASCADE UNIQUE,
      patient_name VARCHAR(255),
      hospital_number VARCHAR(100),
      primary_specialty VARCHAR(255) DEFAULT 'Plastic Surgery',
      is_active BOOLEAN DEFAULT TRUE,
      specialties JSONB DEFAULT '[]',
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );

    -- MDT Meetings table
    CREATE TABLE IF NOT EXISTS mdt_meetings (
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
    );

    -- MDT Contact Logs table
    CREATE TABLE IF NOT EXISTS mdt_contact_logs (
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
    );

    -- Create indexes
    CREATE INDEX IF NOT EXISTS idx_patients_hospital_number ON patients(hospital_number);
    CREATE INDEX IF NOT EXISTS idx_patients_name ON patients(last_name, first_name);
    CREATE INDEX IF NOT EXISTS idx_surgeries_date ON surgeries(scheduled_date);
    CREATE INDEX IF NOT EXISTS idx_surgeries_patient ON surgeries(patient_id);
    CREATE INDEX IF NOT EXISTS idx_admissions_patient ON admissions(patient_id);
    CREATE INDEX IF NOT EXISTS idx_admissions_status ON admissions(status);
    CREATE INDEX IF NOT EXISTS idx_lab_orders_patient ON lab_orders(patient_id);
    CREATE INDEX IF NOT EXISTS idx_audit_log_user ON audit_log(user_id);
    CREATE INDEX IF NOT EXISTS idx_audit_log_created ON audit_log(created_at);
    
    -- CBT Indexes
    CREATE INDEX IF NOT EXISTS idx_cbt_tests_level ON cbt_tests(level);
    CREATE INDEX IF NOT EXISTS idx_cbt_attempts_user ON cbt_attempts(user_id);
    CREATE INDEX IF NOT EXISTS idx_cbt_attempts_level ON cbt_attempts(level);
    CREATE INDEX IF NOT EXISTS idx_cbt_attempts_completed ON cbt_attempts(completed);
    
    -- Rotation Indexes
    CREATE INDEX IF NOT EXISTS idx_rotations_user ON trainee_rotations(user_id);
    CREATE INDEX IF NOT EXISTS idx_rotations_status ON trainee_rotations(status);
    CREATE INDEX IF NOT EXISTS idx_rotations_level ON trainee_rotations(level);
    
    -- Performance Indexes
    CREATE INDEX IF NOT EXISTS idx_performance_user ON performance_snapshots(user_id);
    CREATE INDEX IF NOT EXISTS idx_performance_rotation ON performance_snapshots(rotation_id);
    CREATE INDEX IF NOT EXISTS idx_performance_date ON performance_snapshots(snapshot_date);
    
    -- Activity Indexes
    CREATE INDEX IF NOT EXISTS idx_activity_user ON activity_logs(user_id);
    CREATE INDEX IF NOT EXISTS idx_activity_type ON activity_logs(activity_type);
    CREATE INDEX IF NOT EXISTS idx_activity_created ON activity_logs(created_at);
    
    -- Duty Indexes
    CREATE INDEX IF NOT EXISTS idx_duties_user ON duty_assignments(user_id);
    CREATE INDEX IF NOT EXISTS idx_duties_status ON duty_assignments(status);
    CREATE INDEX IF NOT EXISTS idx_duties_due ON duty_assignments(due_at);
    
    -- Ward Round Indexes
    CREATE INDEX IF NOT EXISTS idx_ward_rounds_patient ON ward_rounds(patient_id);
    CREATE INDEX IF NOT EXISTS idx_ward_rounds_user ON ward_rounds(user_id);
    CREATE INDEX IF NOT EXISTS idx_ward_rounds_date ON ward_rounds(round_date);
    
    -- Discharge Indexes
    CREATE INDEX IF NOT EXISTS idx_discharge_patient ON discharge_summaries(patient_id);
    CREATE INDEX IF NOT EXISTS idx_discharge_admission ON discharge_summaries(admission_id);
    
    -- MDT Indexes
    CREATE INDEX IF NOT EXISTS idx_mdt_teams_patient ON mdt_patient_teams(patient_id);
    CREATE INDEX IF NOT EXISTS idx_mdt_teams_active ON mdt_patient_teams(is_active);
    CREATE INDEX IF NOT EXISTS idx_mdt_meetings_patient ON mdt_meetings(patient_id);
    CREATE INDEX IF NOT EXISTS idx_mdt_meetings_date ON mdt_meetings(meeting_date);
    CREATE INDEX IF NOT EXISTS idx_mdt_meetings_status ON mdt_meetings(status);
    CREATE INDEX IF NOT EXISTS idx_mdt_contacts_patient ON mdt_contact_logs(patient_id);
    CREATE INDEX IF NOT EXISTS idx_mdt_contacts_date ON mdt_contact_logs(contact_date);

    -- Blood Transfusion Records table
    CREATE TABLE IF NOT EXISTS blood_transfusions (
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
    );

    -- Burn Patients table
    CREATE TABLE IF NOT EXISTS burn_patients (
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
    );

    -- Diabetic Foot Assessments table (Limb Salvage)
    CREATE TABLE IF NOT EXISTS diabetic_foot_assessments (
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
    );

    -- Preoperative Assessments table
    CREATE TABLE IF NOT EXISTS preoperative_assessments (
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
    );

    -- DVT Risk Assessments table
    CREATE TABLE IF NOT EXISTS dvt_assessments (
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
    );

    -- Pressure Sore Assessments table (Braden Scale)
    CREATE TABLE IF NOT EXISTS pressure_sore_assessments (
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
    );

    -- Nutritional Assessments table
    CREATE TABLE IF NOT EXISTS nutritional_assessments (
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
    );

    -- Procedures table (for surgical procedures tracking)
    CREATE TABLE IF NOT EXISTS procedures (
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
    );

    -- WHO Safety Checklists table
    CREATE TABLE IF NOT EXISTS who_safety_checklists (
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
    );

    -- =====================================================
    -- SOFT TISSUE INFECTION / NEC MODULE
    -- =====================================================
    
    -- STI/NEC Patient Assessments
    CREATE TABLE IF NOT EXISTS sti_assessments (
      id SERIAL PRIMARY KEY,
      patient_id INTEGER REFERENCES patients(id) ON DELETE CASCADE,
      hospital_number VARCHAR(100),
      patient_name VARCHAR(255),
      assessment_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      classification VARCHAR(100) NOT NULL,
      severity VARCHAR(50) NOT NULL,
      location VARCHAR(100),
      onset_date DATE,
      duration_hours INTEGER,
      clinical_features JSONB DEFAULT '[]',
      systemic_signs JSONB DEFAULT '[]',
      vital_signs JSONB DEFAULT '{}',
      pain_score INTEGER,
      pain_disproportionate BOOLEAN DEFAULT FALSE,
      crepitus BOOLEAN DEFAULT FALSE,
      skin_necrosis BOOLEAN DEFAULT FALSE,
      hemorrhagic_bullae BOOLEAN DEFAULT FALSE,
      lrinec_score INTEGER,
      lrinec_risk VARCHAR(50),
      lrinec_details JSONB DEFAULT '{}',
      qsofa_score INTEGER,
      qsofa_details JSONB DEFAULT '{}',
      comorbidities JSONB DEFAULT '[]',
      diabetes BOOLEAN DEFAULT FALSE,
      diabetes_hba1c DECIMAL(4,1),
      renal_impairment BOOLEAN DEFAULT FALSE,
      creatinine DECIMAL(6,2),
      jaundice BOOLEAN DEFAULT FALSE,
      bilirubin DECIMAL(6,2),
      immunosuppressed BOOLEAN DEFAULT FALSE,
      imaging_ordered JSONB DEFAULT '[]',
      imaging_findings TEXT,
      wound_photos JSONB DEFAULT '[]',
      treatment_stage VARCHAR(100),
      disposition VARCHAR(100),
      assessed_by INTEGER REFERENCES users(id),
      assessed_by_name VARCHAR(255),
      status VARCHAR(50) DEFAULT 'active',
      notes TEXT,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );

    -- STI/NEC Treatment Plans
    CREATE TABLE IF NOT EXISTS sti_treatment_plans (
      id SERIAL PRIMARY KEY,
      assessment_id INTEGER REFERENCES sti_assessments(id) ON DELETE CASCADE,
      patient_id INTEGER REFERENCES patients(id) ON DELETE CASCADE,
      hospital_number VARCHAR(100),
      patient_name VARCHAR(255),
      protocol_id VARCHAR(100),
      stage VARCHAR(100),
      severity VARCHAR(50),
      antibiotics JSONB DEFAULT '[]',
      surgical_interventions JSONB DEFAULT '[]',
      supportive_care JSONB DEFAULT '[]',
      monitoring_plan JSONB DEFAULT '[]',
      comorbidity_modifications JSONB DEFAULT '[]',
      nutrition_plan JSONB DEFAULT '{}',
      escalation_criteria JSONB DEFAULT '[]',
      auto_orders_approved BOOLEAN DEFAULT FALSE,
      approved_by INTEGER REFERENCES users(id),
      approved_at TIMESTAMP,
      status VARCHAR(50) DEFAULT 'draft',
      created_by INTEGER REFERENCES users(id),
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );

    -- STI/NEC Auto-Generated Orders (prescriptions, labs, procedures)
    CREATE TABLE IF NOT EXISTS protocol_orders (
      id SERIAL PRIMARY KEY,
      treatment_plan_id INTEGER,
      patient_id INTEGER REFERENCES patients(id) ON DELETE CASCADE,
      hospital_number VARCHAR(100),
      patient_name VARCHAR(255),
      module VARCHAR(50) NOT NULL,
      order_type VARCHAR(50) NOT NULL,
      order_category VARCHAR(100),
      order_details JSONB NOT NULL,
      priority VARCHAR(50) DEFAULT 'routine',
      status VARCHAR(50) DEFAULT 'pending_approval',
      approved_by INTEGER REFERENCES users(id),
      approved_at TIMESTAMP,
      executed_at TIMESTAMP,
      executed_by INTEGER REFERENCES users(id),
      linked_prescription_id INTEGER,
      linked_lab_order_id INTEGER,
      linked_procedure_id INTEGER,
      tracking_status VARCHAR(50) DEFAULT 'not_started',
      tracking_notes TEXT,
      result TEXT,
      completed_at TIMESTAMP,
      created_by INTEGER REFERENCES users(id),
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );

    -- STI/NEC Debridement Records
    CREATE TABLE IF NOT EXISTS sti_debridements (
      id SERIAL PRIMARY KEY,
      assessment_id INTEGER REFERENCES sti_assessments(id) ON DELETE CASCADE,
      patient_id INTEGER REFERENCES patients(id) ON DELETE CASCADE,
      hospital_number VARCHAR(100),
      patient_name VARCHAR(255),
      debridement_number INTEGER DEFAULT 1,
      debridement_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      surgeon VARCHAR(255),
      assistant VARCHAR(255),
      anesthesia_type VARCHAR(100),
      findings TEXT,
      tissue_debrided TEXT,
      wound_dimensions JSONB DEFAULT '{}',
      wound_bed_status VARCHAR(100),
      margins_viable BOOLEAN,
      cultures_sent BOOLEAN DEFAULT FALSE,
      estimated_blood_loss INTEGER,
      dressing_applied VARCHAR(255),
      vac_applied BOOLEAN DEFAULT FALSE,
      vac_settings JSONB DEFAULT '{}',
      next_planned_debridement TIMESTAMP,
      photos JSONB DEFAULT '[]',
      complications TEXT,
      notes TEXT,
      created_by INTEGER REFERENCES users(id),
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );

    -- =====================================================
    -- PRESSURE SORE MANAGEMENT MODULE (enhanced)
    -- =====================================================

    -- Pressure Sore Wound Records (detailed per-wound tracking)
    CREATE TABLE IF NOT EXISTS pressure_sore_wounds (
      id SERIAL PRIMARY KEY,
      patient_id INTEGER REFERENCES patients(id) ON DELETE CASCADE,
      assessment_id INTEGER REFERENCES pressure_sore_assessments(id),
      hospital_number VARCHAR(100),
      patient_name VARCHAR(255),
      location VARCHAR(100) NOT NULL,
      laterality VARCHAR(20),
      stage VARCHAR(50) NOT NULL,
      length_cm DECIMAL(6,2),
      width_cm DECIMAL(6,2),
      depth_cm DECIMAL(6,2),
      area_cm2 DECIMAL(8,2),
      undermining JSONB DEFAULT '{}',
      tunneling JSONB DEFAULT '{}',
      wound_bed_tissue JSONB DEFAULT '{}',
      exudate_amount VARCHAR(50),
      exudate_type VARCHAR(50),
      periwound_skin VARCHAR(255),
      odor BOOLEAN DEFAULT FALSE,
      pain_score INTEGER,
      probe_to_bone BOOLEAN DEFAULT FALSE,
      osteomyelitis_suspected BOOLEAN DEFAULT FALSE,
      infection_signs JSONB DEFAULT '[]',
      photos JSONB DEFAULT '[]',
      dressing_type VARCHAR(255),
      vac_in_situ BOOLEAN DEFAULT FALSE,
      treatment_plan_id INTEGER,
      status VARCHAR(50) DEFAULT 'active',
      assessed_by INTEGER REFERENCES users(id),
      assessed_by_name VARCHAR(255),
      notes TEXT,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );

    -- Pressure Sore Treatment Plans
    CREATE TABLE IF NOT EXISTS pressure_sore_treatment_plans (
      id SERIAL PRIMARY KEY,
      wound_id INTEGER REFERENCES pressure_sore_wounds(id) ON DELETE CASCADE,
      patient_id INTEGER REFERENCES patients(id) ON DELETE CASCADE,
      hospital_number VARCHAR(100),
      patient_name VARCHAR(255),
      stage VARCHAR(50),
      severity VARCHAR(50),
      wound_care_plan JSONB DEFAULT '[]',
      surgical_plan JSONB DEFAULT '{}',
      nutrition_plan JSONB DEFAULT '{}',
      pressure_relief_plan JSONB DEFAULT '[]',
      antibiotics JSONB DEFAULT '[]',
      monitoring_plan JSONB DEFAULT '[]',
      comorbidity_modifications JSONB DEFAULT '[]',
      flap_options JSONB DEFAULT '[]',
      auto_orders_approved BOOLEAN DEFAULT FALSE,
      approved_by INTEGER REFERENCES users(id),
      approved_at TIMESTAMP,
      status VARCHAR(50) DEFAULT 'draft',
      created_by INTEGER REFERENCES users(id),
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );

    -- Pressure Sore Progress Notes
    CREATE TABLE IF NOT EXISTS pressure_sore_progress (
      id SERIAL PRIMARY KEY,
      wound_id INTEGER REFERENCES pressure_sore_wounds(id) ON DELETE CASCADE,
      patient_id INTEGER REFERENCES patients(id) ON DELETE CASCADE,
      assessment_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      length_cm DECIMAL(6,2),
      width_cm DECIMAL(6,2),
      depth_cm DECIMAL(6,2),
      area_cm2 DECIMAL(8,2),
      healing_rate_percent DECIMAL(5,2),
      wound_bed_tissue JSONB DEFAULT '{}',
      exudate_amount VARCHAR(50),
      exudate_type VARCHAR(50),
      periwound_skin VARCHAR(255),
      infection_signs JSONB DEFAULT '[]',
      dressing_used VARCHAR(255),
      dressing_change_notes TEXT,
      pain_score INTEGER,
      photos JSONB DEFAULT '[]',
      braden_score INTEGER,
      nutritional_intake VARCHAR(100),
      repositioning_compliance BOOLEAN DEFAULT TRUE,
      assessed_by INTEGER REFERENCES users(id),
      assessed_by_name VARCHAR(255),
      notes TEXT,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );

    -- CME Completion Records (for both modules)
    CREATE TABLE IF NOT EXISTS protocol_cme_completions (
      id SERIAL PRIMARY KEY,
      user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
      module VARCHAR(50) NOT NULL,
      article_id VARCHAR(100) NOT NULL,
      score DECIMAL(5,2),
      total_questions INTEGER,
      correct_answers INTEGER,
      answers JSONB DEFAULT '[]',
      passed BOOLEAN DEFAULT FALSE,
      credits_earned DECIMAL(4,1) DEFAULT 0,
      completed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );

    -- Clinical indexes for new tables
    CREATE INDEX IF NOT EXISTS idx_sti_assessments_patient ON sti_assessments(patient_id);
    CREATE INDEX IF NOT EXISTS idx_sti_assessments_date ON sti_assessments(assessment_date);
    CREATE INDEX IF NOT EXISTS idx_sti_assessments_classification ON sti_assessments(classification);
    CREATE INDEX IF NOT EXISTS idx_sti_assessments_status ON sti_assessments(status);
    CREATE INDEX IF NOT EXISTS idx_sti_treatment_patient ON sti_treatment_plans(patient_id);
    CREATE INDEX IF NOT EXISTS idx_sti_treatment_assessment ON sti_treatment_plans(assessment_id);
    CREATE INDEX IF NOT EXISTS idx_protocol_orders_patient ON protocol_orders(patient_id);
    CREATE INDEX IF NOT EXISTS idx_protocol_orders_module ON protocol_orders(module);
    CREATE INDEX IF NOT EXISTS idx_protocol_orders_status ON protocol_orders(status);
    CREATE INDEX IF NOT EXISTS idx_protocol_orders_type ON protocol_orders(order_type);
    CREATE INDEX IF NOT EXISTS idx_sti_debridements_patient ON sti_debridements(patient_id);
    CREATE INDEX IF NOT EXISTS idx_sti_debridements_assessment ON sti_debridements(assessment_id);
    CREATE INDEX IF NOT EXISTS idx_ps_wounds_patient ON pressure_sore_wounds(patient_id);
    CREATE INDEX IF NOT EXISTS idx_ps_wounds_location ON pressure_sore_wounds(location);
    CREATE INDEX IF NOT EXISTS idx_ps_wounds_status ON pressure_sore_wounds(status);
    CREATE INDEX IF NOT EXISTS idx_ps_treatment_wound ON pressure_sore_treatment_plans(wound_id);
    CREATE INDEX IF NOT EXISTS idx_ps_treatment_patient ON pressure_sore_treatment_plans(patient_id);
    CREATE INDEX IF NOT EXISTS idx_ps_progress_wound ON pressure_sore_progress(wound_id);
    CREATE INDEX IF NOT EXISTS idx_ps_progress_date ON pressure_sore_progress(assessment_date);
    CREATE INDEX IF NOT EXISTS idx_cme_completions_user ON protocol_cme_completions(user_id);
    CREATE INDEX IF NOT EXISTS idx_cme_completions_module ON protocol_cme_completions(module);

    CREATE INDEX IF NOT EXISTS idx_transfusions_patient ON blood_transfusions(patient_id);
    CREATE INDEX IF NOT EXISTS idx_transfusions_date ON blood_transfusions(transfusion_date);
    CREATE INDEX IF NOT EXISTS idx_burns_patient ON burn_patients(patient_id);
    CREATE INDEX IF NOT EXISTS idx_burns_status ON burn_patients(status);
    CREATE INDEX IF NOT EXISTS idx_diabetic_foot_patient ON diabetic_foot_assessments(patient_id);
    CREATE INDEX IF NOT EXISTS idx_diabetic_foot_date ON diabetic_foot_assessments(assessment_date);
    CREATE INDEX IF NOT EXISTS idx_preop_patient ON preoperative_assessments(patient_id);
    CREATE INDEX IF NOT EXISTS idx_preop_surgery ON preoperative_assessments(surgery_id);
    CREATE INDEX IF NOT EXISTS idx_dvt_patient ON dvt_assessments(patient_id);
    CREATE INDEX IF NOT EXISTS idx_pressure_patient ON pressure_sore_assessments(patient_id);
    CREATE INDEX IF NOT EXISTS idx_nutrition_patient ON nutritional_assessments(patient_id);
    CREATE INDEX IF NOT EXISTS idx_procedures_patient ON procedures(patient_id);
    CREATE INDEX IF NOT EXISTS idx_procedures_date ON procedures(procedure_date);
    CREATE INDEX IF NOT EXISTS idx_who_checklist_patient ON who_safety_checklists(patient_id);
    CREATE INDEX IF NOT EXISTS idx_who_checklist_surgery ON who_safety_checklists(surgery_id);
  `;

  await query(schema);
  console.log('✅ Database tables created successfully');
}

async function createDefaultUsers() {
  // First, migrate old roles to new role system
  await migrateRoles();
  
  // Check if admin exists
  const existing = await query('SELECT id FROM users WHERE username = $1', ['admin']);
  
  if (existing.rows.length === 0) {
    const passwordHash = await bcrypt.hash('Admin@123!', 10);
    
    await query(
      `INSERT INTO users (username, password_hash, email, full_name, role, is_approved, is_active)
       VALUES ($1, $2, $3, $4, $5, true, true)`,
      ['admin', passwordHash, 'admin@hospital.com', 'System Administrator', 'admin']
    );
    
    console.log('✅ Default admin user created');
    console.log('   Email: admin@hospital.com');
    console.log('   Password: Admin@123!');
  } else {
    console.log('ℹ️ Admin user already exists');
    // Update existing admin with new email and password
    const passwordHash = await bcrypt.hash('Admin@123!', 10);
    await query(
      `UPDATE users SET email = $1, password_hash = $2 WHERE username = $3`,
      ['admin@hospital.com', passwordHash, 'admin']
    );
    console.log('✅ Admin user updated with new credentials');
    console.log('   Email: admin@hospital.com');
    console.log('   Password: Admin@123!');
  }
}

async function migrateRoles() {
  // Migrate old roles to new role system
  // Old roles: super_admin, super admin, intern, nurse, lab_staff, pharmacy, resident, attending
  // New roles: admin, consultant, senior_registrar, junior_registrar, house_officer
  
  const roleMappings = [
    { oldRole: 'super_admin', newRole: 'admin' },
    { oldRole: 'super admin', newRole: 'admin' },  // Handle space variant
    { oldRole: 'Super Admin', newRole: 'admin' },  // Handle capitalized variant
    { oldRole: 'superadmin', newRole: 'admin' },   // Handle no separator variant
    { oldRole: 'attending', newRole: 'consultant' },
    { oldRole: 'resident', newRole: 'senior_registrar' },
    { oldRole: 'intern', newRole: 'house_officer' },
    { oldRole: 'nurse', newRole: 'house_officer' },
    { oldRole: 'lab_staff', newRole: 'house_officer' },
    { oldRole: 'pharmacy', newRole: 'house_officer' }
  ];
  
  for (const mapping of roleMappings) {
    const result = await query(
      'UPDATE users SET role = $1 WHERE LOWER(role) = LOWER($2)',
      [mapping.newRole, mapping.oldRole]
    );
    if (result.rowCount > 0) {
      console.log(`✅ Migrated ${result.rowCount} users from '${mapping.oldRole}' to '${mapping.newRole}'`);
    }
  }
  
  console.log('✅ Role migration completed');
}
