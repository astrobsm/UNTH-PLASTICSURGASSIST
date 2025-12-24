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
      date_of_birth DATE,
      gender VARCHAR(20),
      phone VARCHAR(50),
      email VARCHAR(255),
      address TEXT,
      blood_group VARCHAR(10),
      allergies TEXT,
      medical_history TEXT,
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
