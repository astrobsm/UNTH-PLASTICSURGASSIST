import pg from 'pg';

const pool = new pg.Pool({
  connectionString: 'postgresql://postgres.mgblgewvpzcaimqaeqcp:VMBaD8okNXl2K9pV@aws-1-eu-central-1.pooler.supabase.com:5432/postgres',
  ssl: { rejectUnauthorized: false }
});

async function addMissingColumns() {
  const client = await pool.connect();
  console.log('🔧 Adding missing columns to existing tables...\n');
  
  const alterations = [
    // Users table - add missing columns
    { table: 'users', column: 'full_name', sql: `ALTER TABLE users ADD COLUMN IF NOT EXISTS full_name VARCHAR(255)` },
    { table: 'users', column: 'department', sql: `ALTER TABLE users ADD COLUMN IF NOT EXISTS department VARCHAR(100)` },
    { table: 'users', column: 'is_approved', sql: `ALTER TABLE users ADD COLUMN IF NOT EXISTS is_approved BOOLEAN DEFAULT TRUE` },
    
    // Patients table - add missing columns
    { table: 'patients', column: 'other_names', sql: `ALTER TABLE patients ADD COLUMN IF NOT EXISTS other_names VARCHAR(100)` },
    { table: 'patients', column: 'country', sql: `ALTER TABLE patients ADD COLUMN IF NOT EXISTS country VARCHAR(100) DEFAULT 'Nigeria'` },
    { table: 'patients', column: 'current_medications', sql: `ALTER TABLE patients ADD COLUMN IF NOT EXISTS current_medications TEXT` },
    { table: 'patients', column: 'created_by', sql: `ALTER TABLE patients ADD COLUMN IF NOT EXISTS created_by UUID` },
    { table: 'patients', column: 'updated_by', sql: `ALTER TABLE patients ADD COLUMN IF NOT EXISTS updated_by UUID` },
    { table: 'patients', column: 'deleted', sql: `ALTER TABLE patients ADD COLUMN IF NOT EXISTS deleted BOOLEAN DEFAULT FALSE` },
    { table: 'patients', column: 'synced', sql: `ALTER TABLE patients ADD COLUMN IF NOT EXISTS synced BOOLEAN DEFAULT FALSE` },
    
    // Treatment plans - add missing columns
    { table: 'treatment_plans', column: 'plan_name', sql: `ALTER TABLE treatment_plans ADD COLUMN IF NOT EXISTS plan_name VARCHAR(255)` },
    { table: 'treatment_plans', column: 'diagnosis', sql: `ALTER TABLE treatment_plans ADD COLUMN IF NOT EXISTS diagnosis TEXT` },
    { table: 'treatment_plans', column: 'plan_type', sql: `ALTER TABLE treatment_plans ADD COLUMN IF NOT EXISTS plan_type VARCHAR(50)` },
    { table: 'treatment_plans', column: 'priority', sql: `ALTER TABLE treatment_plans ADD COLUMN IF NOT EXISTS priority VARCHAR(50)` },
    { table: 'treatment_plans', column: 'treatment_goals', sql: `ALTER TABLE treatment_plans ADD COLUMN IF NOT EXISTS treatment_goals TEXT` },
    { table: 'treatment_plans', column: 'expected_outcomes', sql: `ALTER TABLE treatment_plans ADD COLUMN IF NOT EXISTS expected_outcomes TEXT` },
    { table: 'treatment_plans', column: 'target_completion_date', sql: `ALTER TABLE treatment_plans ADD COLUMN IF NOT EXISTS target_completion_date DATE` },
    { table: 'treatment_plans', column: 'actual_completion_date', sql: `ALTER TABLE treatment_plans ADD COLUMN IF NOT EXISTS actual_completion_date DATE` },
    { table: 'treatment_plans', column: 'primary_surgeon_id', sql: `ALTER TABLE treatment_plans ADD COLUMN IF NOT EXISTS primary_surgeon_id UUID` },
    { table: 'treatment_plans', column: 'assisting_surgeon_id', sql: `ALTER TABLE treatment_plans ADD COLUMN IF NOT EXISTS assisting_surgeon_id UUID` },
    { table: 'treatment_plans', column: 'responsible_resident_id', sql: `ALTER TABLE treatment_plans ADD COLUMN IF NOT EXISTS responsible_resident_id UUID` },
    { table: 'treatment_plans', column: 'ai_recommendations', sql: `ALTER TABLE treatment_plans ADD COLUMN IF NOT EXISTS ai_recommendations TEXT` },
    { table: 'treatment_plans', column: 'risk_assessment', sql: `ALTER TABLE treatment_plans ADD COLUMN IF NOT EXISTS risk_assessment TEXT` },
    { table: 'treatment_plans', column: 'deleted', sql: `ALTER TABLE treatment_plans ADD COLUMN IF NOT EXISTS deleted BOOLEAN DEFAULT FALSE` },
    { table: 'treatment_plans', column: 'synced', sql: `ALTER TABLE treatment_plans ADD COLUMN IF NOT EXISTS synced BOOLEAN DEFAULT FALSE` },
    { table: 'treatment_plans', column: 'admission_id', sql: `ALTER TABLE treatment_plans ADD COLUMN IF NOT EXISTS admission_id UUID` },
    
    // Treatment plans - JSONB columns needed by API and new TreatmentPlanCreator/Manager
    { table: 'treatment_plans', column: 'objectives', sql: `ALTER TABLE treatment_plans ADD COLUMN IF NOT EXISTS objectives JSONB DEFAULT '[]'` },
    { table: 'treatment_plans', column: 'procedures', sql: `ALTER TABLE treatment_plans ADD COLUMN IF NOT EXISTS procedures JSONB DEFAULT '[]'` },
    { table: 'treatment_plans', column: 'medications', sql: `ALTER TABLE treatment_plans ADD COLUMN IF NOT EXISTS medications JSONB DEFAULT '[]'` },
    { table: 'treatment_plans', column: 'investigations', sql: `ALTER TABLE treatment_plans ADD COLUMN IF NOT EXISTS investigations JSONB DEFAULT '[]'` },
    { table: 'treatment_plans', column: 'follow_up_schedule', sql: `ALTER TABLE treatment_plans ADD COLUMN IF NOT EXISTS follow_up_schedule JSONB DEFAULT '[]'` },
    { table: 'treatment_plans', column: 'medical_team', sql: `ALTER TABLE treatment_plans ADD COLUMN IF NOT EXISTS medical_team JSONB` },
    { table: 'treatment_plans', column: 'discharge_plan', sql: `ALTER TABLE treatment_plans ADD COLUMN IF NOT EXISTS discharge_plan JSONB` },
    { table: 'treatment_plans', column: 'risk_assessments', sql: `ALTER TABLE treatment_plans ADD COLUMN IF NOT EXISTS risk_assessments JSONB DEFAULT '[]'` },
    { table: 'treatment_plans', column: 'meal_plan', sql: `ALTER TABLE treatment_plans ADD COLUMN IF NOT EXISTS meal_plan JSONB` },
    { table: 'treatment_plans', column: 'ward_round_schedule', sql: `ALTER TABLE treatment_plans ADD COLUMN IF NOT EXISTS ward_round_schedule JSONB` },
    { table: 'treatment_plans', column: 'discharge_criteria', sql: `ALTER TABLE treatment_plans ADD COLUMN IF NOT EXISTS discharge_criteria JSONB DEFAULT '[]'` },
    { table: 'treatment_plans', column: 'treatment_type', sql: `ALTER TABLE treatment_plans ADD COLUMN IF NOT EXISTS treatment_type VARCHAR(100)` },
    { table: 'treatment_plans', column: 'description', sql: `ALTER TABLE treatment_plans ADD COLUMN IF NOT EXISTS description TEXT` },
    { table: 'treatment_plans', column: 'created_by', sql: `ALTER TABLE treatment_plans ADD COLUMN IF NOT EXISTS created_by VARCHAR(255)` },
  ];
  
  let successCount = 0;
  let skipCount = 0;
  
  for (const alt of alterations) {
    try {
      await client.query(alt.sql);
      console.log(`  ✅ Added ${alt.table}.${alt.column}`);
      successCount++;
    } catch (err) {
      if (err.message.includes('already exists')) {
        skipCount++;
      } else {
        console.log(`  ❌ ${alt.table}.${alt.column}: ${err.message}`);
      }
    }
  }
  
  console.log(`\n✅ Columns added: ${successCount}, Skipped: ${skipCount}`);
  client.release();
}

async function createMissingTables() {
  const client = await pool.connect();
  console.log('\n📋 Creating missing tables...\n');
  
  const tables = [
    // AI Settings
    `CREATE TABLE IF NOT EXISTS ai_settings (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      setting_key VARCHAR(100) UNIQUE NOT NULL,
      setting_value TEXT,
      is_encrypted BOOLEAN DEFAULT TRUE,
      updated_by UUID,
      created_at TIMESTAMPTZ DEFAULT NOW(),
      updated_at TIMESTAMPTZ DEFAULT NOW()
    )`,
    
    // Patient Admissions
    `CREATE TABLE IF NOT EXISTS patient_admissions (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      patient_id UUID NOT NULL,
      admission_number VARCHAR(50) UNIQUE NOT NULL,
      admission_date TIMESTAMPTZ NOT NULL,
      discharge_date TIMESTAMPTZ,
      admission_type VARCHAR(50),
      ward VARCHAR(100),
      bed_number VARCHAR(20),
      consultant_id UUID,
      presenting_complaint TEXT,
      history_of_presenting_complaint TEXT,
      past_medical_history TEXT,
      past_surgical_history TEXT,
      family_history TEXT,
      social_history TEXT,
      examination_findings TEXT,
      provisional_diagnosis TEXT,
      ai_summary TEXT,
      ai_generated_at TIMESTAMPTZ,
      status VARCHAR(50) DEFAULT 'Active',
      created_by UUID,
      updated_by UUID,
      deleted BOOLEAN DEFAULT FALSE,
      synced BOOLEAN DEFAULT FALSE,
      created_at TIMESTAMPTZ DEFAULT NOW(),
      updated_at TIMESTAMPTZ DEFAULT NOW()
    )`,
    
    // Treatment Plan Steps
    `CREATE TABLE IF NOT EXISTS treatment_plan_steps (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      treatment_plan_id UUID NOT NULL,
      step_number INTEGER NOT NULL,
      step_name VARCHAR(255) NOT NULL,
      step_type VARCHAR(50),
      description TEXT,
      scheduled_date DATE,
      completed_date DATE,
      status VARCHAR(50) DEFAULT 'Pending',
      assigned_to UUID,
      notes TEXT,
      created_by UUID,
      updated_by UUID,
      deleted BOOLEAN DEFAULT FALSE,
      synced BOOLEAN DEFAULT FALSE,
      created_at TIMESTAMPTZ DEFAULT NOW(),
      updated_at TIMESTAMPTZ DEFAULT NOW()
    )`,
    
    // Surgery Bookings
    `CREATE TABLE IF NOT EXISTS surgery_bookings (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      patient_id UUID NOT NULL,
      treatment_plan_id UUID,
      procedure_name VARCHAR(255) NOT NULL,
      procedure_code VARCHAR(50),
      procedure_type VARCHAR(100),
      scheduled_date DATE NOT NULL,
      scheduled_time TIME NOT NULL,
      estimated_duration INTEGER,
      theatre_number VARCHAR(50),
      ward VARCHAR(100),
      primary_surgeon_id UUID,
      assistant_surgeon_id UUID,
      anaesthetist_id UUID,
      scrub_nurse_id UUID,
      pre_op_diagnosis TEXT,
      planned_procedure TEXT,
      consent_obtained BOOLEAN DEFAULT FALSE,
      consent_date TIMESTAMPTZ,
      actual_start_time TIMESTAMPTZ,
      actual_end_time TIMESTAMPTZ,
      anaesthesia_type VARCHAR(100),
      findings TEXT,
      procedure_performed TEXT,
      complications TEXT,
      post_op_diagnosis TEXT,
      post_op_instructions TEXT,
      status VARCHAR(50) DEFAULT 'Scheduled',
      created_by UUID,
      updated_by UUID,
      deleted BOOLEAN DEFAULT FALSE,
      synced BOOLEAN DEFAULT FALSE,
      created_at TIMESTAMPTZ DEFAULT NOW(),
      updated_at TIMESTAMPTZ DEFAULT NOW()
    )`,
    
    // Surgical Checklists
    `CREATE TABLE IF NOT EXISTS surgical_checklists (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      surgery_booking_id UUID NOT NULL,
      sign_in_completed BOOLEAN DEFAULT FALSE,
      sign_in_completed_by UUID,
      sign_in_completed_at TIMESTAMPTZ,
      patient_identity_confirmed BOOLEAN DEFAULT FALSE,
      site_marked BOOLEAN DEFAULT FALSE,
      consent_confirmed BOOLEAN DEFAULT FALSE,
      allergies_checked BOOLEAN DEFAULT FALSE,
      equipment_issues_check BOOLEAN DEFAULT FALSE,
      time_out_completed BOOLEAN DEFAULT FALSE,
      time_out_completed_by UUID,
      time_out_completed_at TIMESTAMPTZ,
      team_introductions BOOLEAN DEFAULT FALSE,
      procedure_confirmed BOOLEAN DEFAULT FALSE,
      critical_steps_reviewed BOOLEAN DEFAULT FALSE,
      anticipated_events BOOLEAN DEFAULT FALSE,
      sign_out_completed BOOLEAN DEFAULT FALSE,
      sign_out_completed_by UUID,
      sign_out_completed_at TIMESTAMPTZ,
      procedure_recorded BOOLEAN DEFAULT FALSE,
      instrument_count_correct BOOLEAN DEFAULT FALSE,
      specimen_labeled BOOLEAN DEFAULT FALSE,
      equipment_problems BOOLEAN DEFAULT FALSE,
      notes TEXT,
      created_at TIMESTAMPTZ DEFAULT NOW(),
      updated_at TIMESTAMPTZ DEFAULT NOW()
    )`,
    
    // Lab Investigations
    `CREATE TABLE IF NOT EXISTS lab_investigations (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      patient_id UUID NOT NULL,
      treatment_plan_id UUID,
      investigation_type VARCHAR(100) NOT NULL,
      test_name VARCHAR(255) NOT NULL,
      ordered_date TIMESTAMPTZ DEFAULT NOW(),
      ordered_by UUID,
      priority VARCHAR(50),
      sample_type VARCHAR(100),
      sample_collected BOOLEAN DEFAULT FALSE,
      sample_collection_date TIMESTAMPTZ,
      result_date TIMESTAMPTZ,
      results TEXT,
      result_values JSONB,
      interpretation TEXT,
      reference_ranges TEXT,
      status VARCHAR(50) DEFAULT 'Ordered',
      lab_number VARCHAR(50),
      performed_by UUID,
      reviewed_by UUID,
      notes TEXT,
      created_by UUID,
      updated_by UUID,
      deleted BOOLEAN DEFAULT FALSE,
      synced BOOLEAN DEFAULT FALSE,
      created_at TIMESTAMPTZ DEFAULT NOW(),
      updated_at TIMESTAMPTZ DEFAULT NOW()
    )`,
    
    // Prescription Items
    `CREATE TABLE IF NOT EXISTS prescription_items (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      prescription_id UUID NOT NULL,
      medication_name VARCHAR(255) NOT NULL,
      medication_type VARCHAR(100),
      dosage VARCHAR(100) NOT NULL,
      route VARCHAR(50) NOT NULL,
      frequency VARCHAR(100) NOT NULL,
      duration VARCHAR(100),
      quantity INTEGER,
      unit VARCHAR(50),
      instructions TEXT,
      special_instructions TEXT,
      dispensed BOOLEAN DEFAULT FALSE,
      dispensed_date TIMESTAMPTZ,
      dispensed_by UUID,
      created_at TIMESTAMPTZ DEFAULT NOW(),
      updated_at TIMESTAMPTZ DEFAULT NOW()
    )`,
    
    // Wound Care Records
    `CREATE TABLE IF NOT EXISTS wound_care_records (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      patient_id UUID NOT NULL,
      treatment_plan_id UUID,
      wound_location VARCHAR(255) NOT NULL,
      wound_type VARCHAR(100),
      assessment_date TIMESTAMPTZ DEFAULT NOW(),
      wound_dimensions VARCHAR(100),
      wound_appearance TEXT,
      exudate_type VARCHAR(50),
      exudate_amount VARCHAR(50),
      signs_of_infection BOOLEAN DEFAULT FALSE,
      treatment_performed TEXT,
      dressing_type VARCHAR(100),
      products_used TEXT,
      healing_status VARCHAR(50),
      next_dressing_date DATE,
      care_plan TEXT,
      performed_by UUID,
      notes TEXT,
      created_by UUID,
      deleted BOOLEAN DEFAULT FALSE,
      synced BOOLEAN DEFAULT FALSE,
      created_at TIMESTAMPTZ DEFAULT NOW(),
      updated_at TIMESTAMPTZ DEFAULT NOW()
    )`,
    
    // CME Topics
    `CREATE TABLE IF NOT EXISTS cme_topics (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      topic_name VARCHAR(255) NOT NULL,
      category VARCHAR(100),
      description TEXT,
      content TEXT,
      learning_objectives TEXT,
      references TEXT,
      ai_generated BOOLEAN DEFAULT FALSE,
      ai_generated_at TIMESTAMPTZ,
      difficulty_level VARCHAR(50),
      estimated_duration INTEGER,
      created_by UUID,
      updated_by UUID,
      deleted BOOLEAN DEFAULT FALSE,
      is_published BOOLEAN DEFAULT FALSE,
      published_at TIMESTAMPTZ,
      created_at TIMESTAMPTZ DEFAULT NOW(),
      updated_at TIMESTAMPTZ DEFAULT NOW()
    )`,
    
    // MCQ Questions
    `CREATE TABLE IF NOT EXISTS mcq_questions (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      cme_topic_id UUID,
      question_text TEXT NOT NULL,
      question_type VARCHAR(50) DEFAULT 'Single Choice',
      options JSONB NOT NULL,
      difficulty VARCHAR(50),
      explanation TEXT,
      created_by UUID,
      deleted BOOLEAN DEFAULT FALSE,
      created_at TIMESTAMPTZ DEFAULT NOW(),
      updated_at TIMESTAMPTZ DEFAULT NOW()
    )`,
    
    // User Assessments
    `CREATE TABLE IF NOT EXISTS user_assessments (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id UUID NOT NULL,
      cme_topic_id UUID NOT NULL,
      started_at TIMESTAMPTZ DEFAULT NOW(),
      completed_at TIMESTAMPTZ,
      score NUMERIC(5,2),
      total_questions INTEGER,
      correct_answers INTEGER,
      answers JSONB,
      status VARCHAR(50) DEFAULT 'In Progress',
      created_at TIMESTAMPTZ DEFAULT NOW(),
      updated_at TIMESTAMPTZ DEFAULT NOW()
    )`,
    
    // Surgical Consumables
    `CREATE TABLE IF NOT EXISTS surgical_consumables (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      item_name VARCHAR(255) NOT NULL,
      item_code VARCHAR(50) UNIQUE,
      category VARCHAR(100),
      description TEXT,
      unit VARCHAR(50),
      minimum_stock_level INTEGER DEFAULT 0,
      reorder_level INTEGER DEFAULT 0,
      unit_cost NUMERIC(10,2),
      is_active BOOLEAN DEFAULT TRUE,
      created_by UUID,
      updated_by UUID,
      created_at TIMESTAMPTZ DEFAULT NOW(),
      updated_at TIMESTAMPTZ DEFAULT NOW()
    )`,
    
    // Consumable Usage
    `CREATE TABLE IF NOT EXISTS consumable_usage (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      consumable_id UUID NOT NULL,
      patient_id UUID,
      surgery_booking_id UUID,
      quantity_used INTEGER NOT NULL,
      usage_date TIMESTAMPTZ DEFAULT NOW(),
      recorded_by UUID,
      notes TEXT,
      created_at TIMESTAMPTZ DEFAULT NOW()
    )`,
    
    // MDT Cases
    `CREATE TABLE IF NOT EXISTS mdt_cases (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      mdt_meeting_id UUID NOT NULL,
      patient_id UUID NOT NULL,
      case_summary TEXT NOT NULL,
      presenting_clinician_id UUID,
      discussion_points TEXT,
      recommendations TEXT,
      action_plan TEXT,
      follow_up_required BOOLEAN DEFAULT FALSE,
      follow_up_date DATE,
      created_at TIMESTAMPTZ DEFAULT NOW(),
      updated_at TIMESTAMPTZ DEFAULT NOW()
    )`,
    
    // Chat Room Participants
    `CREATE TABLE IF NOT EXISTS chat_room_participants (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      room_id UUID NOT NULL,
      user_id UUID NOT NULL,
      joined_at TIMESTAMPTZ DEFAULT NOW(),
      last_read_at TIMESTAMPTZ,
      is_admin BOOLEAN DEFAULT FALSE,
      is_active BOOLEAN DEFAULT TRUE,
      UNIQUE(room_id, user_id)
    )`,
    
    // Chat Message Reactions
    `CREATE TABLE IF NOT EXISTS chat_message_reactions (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      message_id UUID NOT NULL,
      user_id UUID NOT NULL,
      emoji VARCHAR(50) NOT NULL,
      created_at TIMESTAMPTZ DEFAULT NOW(),
      UNIQUE(message_id, user_id, emoji)
    )`,
    
    // Chat Read Receipts
    `CREATE TABLE IF NOT EXISTS chat_read_receipts (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      message_id UUID NOT NULL,
      user_id UUID NOT NULL,
      read_at TIMESTAMPTZ DEFAULT NOW(),
      UNIQUE(message_id, user_id)
    )`,
    
    // Conference Rooms
    `CREATE TABLE IF NOT EXISTS conference_rooms (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      name VARCHAR(255) NOT NULL,
      room_type VARCHAR(50) DEFAULT 'general',
      host_id UUID NOT NULL,
      max_participants INTEGER DEFAULT 50,
      allow_screen_share BOOLEAN DEFAULT TRUE,
      allow_recording BOOLEAN DEFAULT FALSE,
      allow_chat BOOLEAN DEFAULT TRUE,
      waiting_room_enabled BOOLEAN DEFAULT FALSE,
      is_active BOOLEAN DEFAULT TRUE,
      started_at TIMESTAMPTZ,
      ended_at TIMESTAMPTZ,
      created_at TIMESTAMPTZ DEFAULT NOW(),
      updated_at TIMESTAMPTZ DEFAULT NOW()
    )`,
    
    // Conference Participants
    `CREATE TABLE IF NOT EXISTS conference_participants (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      room_id UUID NOT NULL,
      user_id UUID NOT NULL,
      joined_at TIMESTAMPTZ DEFAULT NOW(),
      left_at TIMESTAMPTZ,
      duration_seconds INTEGER,
      was_presenter BOOLEAN DEFAULT FALSE
    )`,
    
    // Patient Assignments (team assignment tracking - matches IndexedDB schema)
    `CREATE TABLE IF NOT EXISTS patient_assignments (
      id SERIAL PRIMARY KEY,
      patient_id INTEGER NOT NULL,
      hospital_number VARCHAR(100),
      consultant_id INTEGER,
      senior_registrar_id INTEGER,
      registrar_id INTEGER,
      house_officer_id INTEGER,
      assigned_date TIMESTAMPTZ DEFAULT NOW(),
      is_active BOOLEAN DEFAULT TRUE,
      created_by VARCHAR(255),
      deleted BOOLEAN DEFAULT FALSE,
      synced BOOLEAN DEFAULT FALSE,
      created_at TIMESTAMPTZ DEFAULT NOW(),
      updated_at TIMESTAMPTZ DEFAULT NOW()
    )`,
  ];
  
  let successCount = 0;
  let skipCount = 0;
  
  for (const sql of tables) {
    const tableName = sql.match(/CREATE TABLE IF NOT EXISTS (\w+)/)?.[1];
    try {
      await client.query(sql);
      console.log(`  ✅ Created table: ${tableName}`);
      successCount++;
    } catch (err) {
      if (err.message.includes('already exists')) {
        console.log(`  ⏭️ Table exists: ${tableName}`);
        skipCount++;
      } else {
        console.log(`  ❌ ${tableName}: ${err.message}`);
      }
    }
  }
  
  console.log(`\n✅ Tables created: ${successCount}, Already existed: ${skipCount}`);
  client.release();
}

async function insertSeedData() {
  const client = await pool.connect();
  console.log('\n🌱 Inserting seed data...\n');
  
  // Insert sample surgical consumables
  try {
    await client.query(`
      INSERT INTO surgical_consumables (item_name, item_code, category, unit, minimum_stock_level, reorder_level, unit_cost, is_active)
      VALUES
        ('Surgical Gloves (Size 7.5)', 'CONS-001', 'PPE', 'Pair', 100, 200, 50.00, TRUE),
        ('Suture 3-0 Vicryl', 'CONS-002', 'Sutures', 'Pack', 50, 100, 500.00, TRUE),
        ('Surgical Mask', 'CONS-003', 'PPE', 'Piece', 200, 300, 25.00, TRUE),
        ('Gauze Swabs', 'CONS-004', 'Dressing', 'Pack', 100, 150, 150.00, TRUE),
        ('Surgical Drape', 'CONS-005', 'Theatre', 'Piece', 50, 75, 300.00, TRUE),
        ('Local Anaesthetic (Lidocaine)', 'CONS-006', 'Medications', 'Vial', 30, 50, 200.00, TRUE),
        ('IV Cannula 18G', 'CONS-007', 'Disposables', 'Piece', 100, 150, 75.00, TRUE),
        ('Adhesive Tape', 'CONS-008', 'Dressing', 'Roll', 50, 80, 100.00, TRUE)
      ON CONFLICT (item_code) DO NOTHING
    `);
    console.log('  ✅ Inserted surgical consumables');
  } catch (err) {
    console.log('  ⏭️ Consumables already exist or error:', err.message);
  }
  
  // Insert AI settings placeholder
  try {
    await client.query(`
      INSERT INTO ai_settings (setting_key, setting_value, is_encrypted)
      VALUES ('openai_api_key', '', TRUE)
      ON CONFLICT (setting_key) DO NOTHING
    `);
    console.log('  ✅ Inserted AI settings');
  } catch (err) {
    console.log('  ⏭️ AI settings already exist');
  }
  
  client.release();
}

async function verifyDatabase() {
  const client = await pool.connect();
  console.log('\n🔍 Verifying database...\n');
  
  // Count tables
  const tables = await client.query(`
    SELECT table_name 
    FROM information_schema.tables 
    WHERE table_schema = 'public' 
    AND table_type = 'BASE TABLE'
    ORDER BY table_name
  `);
  
  console.log(`📊 Total tables in database: ${tables.rows.length}`);
  
  // List key tables
  const keyTables = [
    'users', 'patients', 'treatment_plans', 'treatment_plan_steps',
    'surgery_bookings', 'surgical_checklists', 'lab_investigations',
    'prescriptions', 'prescription_items', 'wound_care_records',
    'cme_topics', 'mcq_questions', 'user_assessments',
    'surgical_consumables', 'ai_settings', 'chat_rooms', 'chat_messages'
  ];
  
  console.log('\n📋 Key tables status:');
  for (const tableName of keyTables) {
    const exists = tables.rows.some(r => r.table_name === tableName);
    console.log(`  ${exists ? '✅' : '❌'} ${tableName}`);
  }
  
  // Count users
  const users = await client.query('SELECT COUNT(*) FROM users');
  console.log(`\n👥 Total users: ${users.rows[0].count}`);
  
  // Count patients
  const patients = await client.query('SELECT COUNT(*) FROM patients');
  console.log(`👤 Total patients: ${patients.rows[0].count}`);
  
  client.release();
}

async function main() {
  console.log('🚀 Database Migration - Adding Missing Tables and Columns\n');
  console.log('=' .repeat(60));
  
  try {
    await addMissingColumns();
    await createMissingTables();
    await insertSeedData();
    await verifyDatabase();
    
    console.log('\n' + '=' .repeat(60));
    console.log('🎉 Migration completed successfully!');
    console.log('\n📝 Next steps:');
    console.log('  1. Update DATABASE_URL in Vercel environment variables');
    console.log('  2. Push changes to GitHub');
    console.log('  3. Test the app at https://plasticsurgassisstant.vercel.app');
    
  } catch (error) {
    console.error('❌ Migration failed:', error.message);
  } finally {
    await pool.end();
  }
}

main();
