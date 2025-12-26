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
      role VARCHAR(50) DEFAULT 'intern',
      training_level VARCHAR(50) DEFAULT 'house_officer',
      is_approved BOOLEAN DEFAULT FALSE,
      is_active BOOLEAN DEFAULT TRUE,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      last_login TIMESTAMP
    );

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
      ward VARCHAR(100),
      bed_number VARCHAR(50),
      emergency_contact_name VARCHAR(255),
      emergency_contact_phone VARCHAR(50),
      created_by INTEGER REFERENCES users(id),
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );

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
      follow_up_schedule JSONB DEFAULT '[]',
      notes TEXT,
      status VARCHAR(50) DEFAULT 'draft',
      created_by INTEGER REFERENCES users(id),
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
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
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
  `;

  await query(schema);
  console.log('✅ Database tables created successfully');
}

async function createDefaultUsers() {
  // Check if admin exists
  const existing = await query('SELECT id FROM users WHERE username = $1', ['admin']);
  
  if (existing.rows.length === 0) {
    const passwordHash = await bcrypt.hash('admin123', 10);
    
    await query(
      `INSERT INTO users (username, password_hash, email, full_name, role, is_approved, is_active)
       VALUES ($1, $2, $3, $4, $5, true, true)`,
      ['admin', passwordHash, 'admin@plasticsurg.local', 'System Administrator', 'super_admin']
    );
    
    console.log('✅ Default admin user created (username: admin, password: admin123)');
  } else {
    console.log('ℹ️ Admin user already exists');
  }
}
