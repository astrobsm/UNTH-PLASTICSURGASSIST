#!/usr/bin/env node
/**
 * Create Missing Tables - Adds tables needed for full sync
 */

import pg from 'pg';

const { Pool } = pg;

const DATABASE_URL = 'postgresql://postgres.mgblgewvpzcaimqaeqcp:VMBaD8okNXl2K9pV@aws-1-eu-central-1.pooler.supabase.com:5432/postgres';

const pool = new Pool({
  connectionString: DATABASE_URL,
  ssl: { rejectUnauthorized: false },
  connectionTimeoutMillis: 30000,
});

async function createMissingTables() {
  console.log('🔧 Creating missing tables for sync...\n');
  
  const client = await pool.connect();
  
  try {
    // 1. Create wound_care table (alias view for wound_care_records)
    console.log('📋 Creating wound_care view...');
    await client.query(`
      CREATE OR REPLACE VIEW wound_care AS
      SELECT * FROM wound_care_records;
    `);
    console.log('✅ wound_care view created (points to wound_care_records)\n');
    
    // 2. Create burn_patients table
    console.log('📋 Creating burn_patients table...');
    await client.query(`
      CREATE TABLE IF NOT EXISTS burn_patients (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        patient_id UUID,
        admission_id UUID,
        
        -- Burn Details
        burn_date TIMESTAMP WITH TIME ZONE,
        mechanism_of_injury VARCHAR(100),
        place_of_occurrence VARCHAR(255),
        first_aid_given BOOLEAN DEFAULT FALSE,
        first_aid_details TEXT,
        
        -- TBSA Assessment
        tbsa_percentage NUMERIC(5,2),
        burn_depth VARCHAR(100),
        burn_areas TEXT,
        
        -- Vital Signs at Presentation
        weight_kg NUMERIC(5,2),
        heart_rate INTEGER,
        blood_pressure_systolic INTEGER,
        blood_pressure_diastolic INTEGER,
        respiratory_rate INTEGER,
        temperature NUMERIC(4,1),
        oxygen_saturation INTEGER,
        
        -- Fluid Resuscitation (Parkland Formula)
        parkland_volume_ml NUMERIC(10,2),
        first_8hrs_volume_ml NUMERIC(10,2),
        next_16hrs_volume_ml NUMERIC(10,2),
        fluid_start_time TIMESTAMP WITH TIME ZONE,
        
        -- Airway Assessment
        inhalation_injury BOOLEAN DEFAULT FALSE,
        airway_secured BOOLEAN DEFAULT FALSE,
        intubation_required BOOLEAN DEFAULT FALSE,
        
        -- Status
        status VARCHAR(50) DEFAULT 'Active' CHECK (status IN ('Active', 'Stable', 'Critical', 'Discharged', 'Deceased')),
        
        -- AI Summary
        ai_summary TEXT,
        ai_recommendations TEXT,
        
        notes TEXT,
        
        created_by UUID,
        updated_by UUID,
        deleted BOOLEAN DEFAULT FALSE,
        synced BOOLEAN DEFAULT FALSE,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      );
    `);
    console.log('✅ burn_patients table created\n');
    
    // 3. Add indexes for burn_patients
    console.log('📋 Creating indexes for burn_patients...');
    try {
      await client.query(`CREATE INDEX IF NOT EXISTS idx_burn_patients_patient_id ON burn_patients(patient_id);`);
      await client.query(`CREATE INDEX IF NOT EXISTS idx_burn_patients_status ON burn_patients(status);`);
      await client.query(`CREATE INDEX IF NOT EXISTS idx_burn_patients_created_at ON burn_patients(created_at);`);
      console.log('✅ Indexes created\n');
    } catch (e) {
      console.log('⏭️  Indexes already exist\n');
    }
    
    // 4. Add trigger for updated_at
    console.log('📋 Adding update trigger for burn_patients...');
    try {
      await client.query(`
        CREATE TRIGGER update_burn_patients_updated_at 
        BEFORE UPDATE ON burn_patients 
        FOR EACH ROW 
        EXECUTE FUNCTION update_updated_at_column();
      `);
      console.log('✅ Trigger created\n');
    } catch (e) {
      console.log('⏭️  Trigger already exists\n');
    }
    
    // Verify all tables now exist
    console.log('🔍 Verifying all sync tables...');
    const result = await client.query(`
      SELECT table_name, table_type
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
      AND table_name IN ('wound_care', 'wound_care_records', 'burn_patients')
      ORDER BY table_name
    `);
    
    result.rows.forEach(row => {
      console.log(`   ✅ ${row.table_name} (${row.table_type})`);
    });
    
    console.log('\n✅ All missing tables created successfully!');
    
  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    client.release();
    await pool.end();
  }
}

createMissingTables();
