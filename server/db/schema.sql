-- =====================================================
-- PLASTIC SURGEON ASSISTANT - PostgreSQL Database Schema
-- Digital Ocean Managed PostgreSQL
-- =====================================================

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- =====================================================
-- CORE TABLES
-- =====================================================

-- Users table (already exists, but recreating for PostgreSQL)
CREATE TABLE IF NOT EXISTS users (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    email VARCHAR(255) UNIQUE NOT NULL,
    password VARCHAR(255) NOT NULL,
    full_name VARCHAR(255) NOT NULL,
    role VARCHAR(50) NOT NULL CHECK (role IN (
        'super_admin', 'consultant', 'senior_registrar', 
        'junior_registrar', 'house_officer', 'medical_officer',
        'nursing', 'lab', 'pharmacy'
    )),
    department VARCHAR(100),
    specialization VARCHAR(100),
    license_number VARCHAR(50),
    phone VARCHAR(20),
    is_approved BOOLEAN DEFAULT FALSE,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- AI Settings table
CREATE TABLE IF NOT EXISTS ai_settings (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    setting_key VARCHAR(100) UNIQUE NOT NULL,
    setting_value TEXT,
    is_encrypted BOOLEAN DEFAULT TRUE,
    updated_by UUID REFERENCES users(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- =====================================================
-- PATIENT MANAGEMENT
-- =====================================================

-- Patients table
CREATE TABLE IF NOT EXISTS patients (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    hospital_number VARCHAR(50) UNIQUE NOT NULL,
    first_name VARCHAR(100) NOT NULL,
    last_name VARCHAR(100) NOT NULL,
    other_names VARCHAR(100),
    date_of_birth DATE NOT NULL,
    gender VARCHAR(20) NOT NULL CHECK (gender IN ('Male', 'Female', 'Other')),
    phone VARCHAR(20),
    email VARCHAR(100),
    address TEXT,
    city VARCHAR(100),
    state VARCHAR(100),
    country VARCHAR(100) DEFAULT 'Nigeria',
    
    -- Emergency Contact
    emergency_contact_name VARCHAR(200),
    emergency_contact_phone VARCHAR(20),
    emergency_contact_relationship VARCHAR(100),
    
    -- Medical Information
    blood_group VARCHAR(10),
    genotype VARCHAR(10),
    allergies TEXT,
    chronic_conditions TEXT,
    current_medications TEXT,
    
    -- System fields
    created_by UUID REFERENCES users(id),
    updated_by UUID REFERENCES users(id),
    deleted BOOLEAN DEFAULT FALSE,
    synced BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Patient Admissions
CREATE TABLE IF NOT EXISTS patient_admissions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    patient_id UUID NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
    admission_number VARCHAR(50) UNIQUE NOT NULL,
    admission_date TIMESTAMP WITH TIME ZONE NOT NULL,
    discharge_date TIMESTAMP WITH TIME ZONE,
    
    -- Admission Details
    admission_type VARCHAR(50) CHECK (admission_type IN ('Emergency', 'Elective', 'Transfer')),
    ward VARCHAR(100),
    bed_number VARCHAR(20),
    consultant_id UUID REFERENCES users(id),
    
    -- Clinical Information
    presenting_complaint TEXT,
    history_of_presenting_complaint TEXT,
    past_medical_history TEXT,
    past_surgical_history TEXT,
    family_history TEXT,
    social_history TEXT,
    examination_findings TEXT,
    provisional_diagnosis TEXT,
    
    -- Admission Summary (AI Generated)
    ai_summary TEXT,
    ai_generated_at TIMESTAMP WITH TIME ZONE,
    
    -- Status
    status VARCHAR(50) DEFAULT 'Active' CHECK (status IN ('Active', 'Discharged', 'Transferred', 'Deceased')),
    
    created_by UUID REFERENCES users(id),
    updated_by UUID REFERENCES users(id),
    deleted BOOLEAN DEFAULT FALSE,
    synced BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- =====================================================
-- TREATMENT PLANNING
-- =====================================================

-- Treatment Plans
CREATE TABLE IF NOT EXISTS treatment_plans (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    patient_id UUID NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
    admission_id UUID REFERENCES patient_admissions(id) ON DELETE SET NULL,
    
    plan_name VARCHAR(255) NOT NULL,
    diagnosis TEXT NOT NULL,
    plan_type VARCHAR(50) CHECK (plan_type IN ('Surgical', 'Conservative', 'Combined')),
    priority VARCHAR(50) CHECK (priority IN ('Elective', 'Urgent', 'Emergency')),
    
    -- Goals and Objectives
    treatment_goals TEXT,
    expected_outcomes TEXT,
    
    -- Timeline
    start_date DATE,
    target_completion_date DATE,
    actual_completion_date DATE,
    
    -- Status
    status VARCHAR(50) DEFAULT 'Draft' CHECK (status IN ('Draft', 'Active', 'Completed', 'Cancelled', 'On Hold')),
    
    -- Clinical Team
    primary_surgeon_id UUID REFERENCES users(id),
    assisting_surgeon_id UUID REFERENCES users(id),
    responsible_resident_id UUID REFERENCES users(id),
    
    -- AI Insights
    ai_recommendations TEXT,
    risk_assessment TEXT,
    
    created_by UUID REFERENCES users(id),
    updated_by UUID REFERENCES users(id),
    deleted BOOLEAN DEFAULT FALSE,
    synced BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Treatment Plan Steps
CREATE TABLE IF NOT EXISTS treatment_plan_steps (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    treatment_plan_id UUID NOT NULL REFERENCES treatment_plans(id) ON DELETE CASCADE,
    
    step_number INTEGER NOT NULL,
    step_name VARCHAR(255) NOT NULL,
    step_type VARCHAR(50) CHECK (step_type IN ('Investigation', 'Procedure', 'Medication', 'Monitoring', 'Other')),
    description TEXT,
    
    -- Scheduling
    scheduled_date DATE,
    completed_date DATE,
    
    -- Status
    status VARCHAR(50) DEFAULT 'Pending' CHECK (status IN ('Pending', 'In Progress', 'Completed', 'Cancelled', 'Deferred')),
    
    -- Assignment
    assigned_to UUID REFERENCES users(id),
    notes TEXT,
    
    created_by UUID REFERENCES users(id),
    updated_by UUID REFERENCES users(id),
    deleted BOOLEAN DEFAULT FALSE,
    synced BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    
    UNIQUE(treatment_plan_id, step_number)
);

-- =====================================================
-- SURGICAL PROCEDURES
-- =====================================================

-- Surgery Bookings
CREATE TABLE IF NOT EXISTS surgery_bookings (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    patient_id UUID NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
    treatment_plan_id UUID REFERENCES treatment_plans(id) ON DELETE SET NULL,
    
    procedure_name VARCHAR(255) NOT NULL,
    procedure_code VARCHAR(50),
    procedure_type VARCHAR(100),
    
    -- Scheduling
    scheduled_date DATE NOT NULL,
    scheduled_time TIME NOT NULL,
    estimated_duration INTEGER, -- minutes
    
    -- Venue
    theatre_number VARCHAR(50),
    ward VARCHAR(100),
    
    -- Team
    primary_surgeon_id UUID REFERENCES users(id),
    assistant_surgeon_id UUID REFERENCES users(id),
    anaesthetist_id UUID REFERENCES users(id),
    scrub_nurse_id UUID REFERENCES users(id),
    
    -- Pre-operative
    pre_op_diagnosis TEXT,
    planned_procedure TEXT,
    consent_obtained BOOLEAN DEFAULT FALSE,
    consent_date TIMESTAMP WITH TIME ZONE,
    
    -- Intra-operative
    actual_start_time TIMESTAMP WITH TIME ZONE,
    actual_end_time TIMESTAMP WITH TIME ZONE,
    anaesthesia_type VARCHAR(100),
    findings TEXT,
    procedure_performed TEXT,
    complications TEXT,
    
    -- Post-operative
    post_op_diagnosis TEXT,
    post_op_instructions TEXT,
    
    -- Status
    status VARCHAR(50) DEFAULT 'Scheduled' CHECK (status IN ('Scheduled', 'Confirmed', 'In Progress', 'Completed', 'Cancelled', 'Postponed')),
    
    created_by UUID REFERENCES users(id),
    updated_by UUID REFERENCES users(id),
    deleted BOOLEAN DEFAULT FALSE,
    synced BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Surgical Safety Checklist
CREATE TABLE IF NOT EXISTS surgical_checklists (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    surgery_booking_id UUID NOT NULL REFERENCES surgery_bookings(id) ON DELETE CASCADE,
    
    -- Sign In (Before Induction)
    sign_in_completed BOOLEAN DEFAULT FALSE,
    sign_in_completed_by UUID REFERENCES users(id),
    sign_in_completed_at TIMESTAMP WITH TIME ZONE,
    patient_identity_confirmed BOOLEAN DEFAULT FALSE,
    site_marked BOOLEAN DEFAULT FALSE,
    consent_confirmed BOOLEAN DEFAULT FALSE,
    allergies_checked BOOLEAN DEFAULT FALSE,
    equipment_issues_check BOOLEAN DEFAULT FALSE,
    
    -- Time Out (Before Skin Incision)
    time_out_completed BOOLEAN DEFAULT FALSE,
    time_out_completed_by UUID REFERENCES users(id),
    time_out_completed_at TIMESTAMP WITH TIME ZONE,
    team_introductions BOOLEAN DEFAULT FALSE,
    procedure_confirmed BOOLEAN DEFAULT FALSE,
    critical_steps_reviewed BOOLEAN DEFAULT FALSE,
    anticipated_events BOOLEAN DEFAULT FALSE,
    
    -- Sign Out (Before Patient Leaves)
    sign_out_completed BOOLEAN DEFAULT FALSE,
    sign_out_completed_by UUID REFERENCES users(id),
    sign_out_completed_at TIMESTAMP WITH TIME ZONE,
    procedure_recorded BOOLEAN DEFAULT FALSE,
    instrument_count_correct BOOLEAN DEFAULT FALSE,
    specimen_labeled BOOLEAN DEFAULT FALSE,
    equipment_problems BOOLEAN DEFAULT FALSE,
    
    notes TEXT,
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- =====================================================
-- LABORATORY INVESTIGATIONS
-- =====================================================

-- Lab Investigations
CREATE TABLE IF NOT EXISTS lab_investigations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    patient_id UUID NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
    treatment_plan_id UUID REFERENCES treatment_plans(id) ON DELETE SET NULL,
    
    investigation_type VARCHAR(100) NOT NULL,
    test_name VARCHAR(255) NOT NULL,
    
    -- Ordering
    ordered_date TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    ordered_by UUID REFERENCES users(id),
    priority VARCHAR(50) CHECK (priority IN ('Routine', 'Urgent', 'STAT')),
    
    -- Sample
    sample_type VARCHAR(100),
    sample_collected BOOLEAN DEFAULT FALSE,
    sample_collection_date TIMESTAMP WITH TIME ZONE,
    
    -- Results
    result_date TIMESTAMP WITH TIME ZONE,
    results TEXT,
    result_values JSONB,
    interpretation TEXT,
    reference_ranges TEXT,
    
    -- Status
    status VARCHAR(50) DEFAULT 'Ordered' CHECK (status IN ('Ordered', 'Sample Collected', 'Processing', 'Completed', 'Cancelled')),
    
    -- Lab Info
    lab_number VARCHAR(50),
    performed_by UUID REFERENCES users(id),
    reviewed_by UUID REFERENCES users(id),
    
    notes TEXT,
    
    created_by UUID REFERENCES users(id),
    updated_by UUID REFERENCES users(id),
    deleted BOOLEAN DEFAULT FALSE,
    synced BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- =====================================================
-- PRESCRIPTIONS & MEDICATIONS
-- =====================================================

-- Prescriptions
CREATE TABLE IF NOT EXISTS prescriptions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    patient_id UUID NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
    treatment_plan_id UUID REFERENCES treatment_plans(id) ON DELETE SET NULL,
    admission_id UUID REFERENCES patient_admissions(id) ON DELETE SET NULL,
    
    prescribed_by UUID REFERENCES users(id),
    prescribed_date TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    
    -- Prescription Details
    prescription_type VARCHAR(50) CHECK (prescription_type IN ('Inpatient', 'Outpatient', 'Discharge')),
    diagnosis TEXT,
    
    -- Status
    status VARCHAR(50) DEFAULT 'Active' CHECK (status IN ('Active', 'Completed', 'Cancelled', 'On Hold')),
    
    notes TEXT,
    
    created_by UUID REFERENCES users(id),
    updated_by UUID REFERENCES users(id),
    deleted BOOLEAN DEFAULT FALSE,
    synced BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Prescription Items
CREATE TABLE IF NOT EXISTS prescription_items (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    prescription_id UUID NOT NULL REFERENCES prescriptions(id) ON DELETE CASCADE,
    
    medication_name VARCHAR(255) NOT NULL,
    medication_type VARCHAR(100),
    
    -- Dosage
    dosage VARCHAR(100) NOT NULL,
    route VARCHAR(50) NOT NULL,
    frequency VARCHAR(100) NOT NULL,
    duration VARCHAR(100),
    
    -- Quantity
    quantity INTEGER,
    unit VARCHAR(50),
    
    -- Instructions
    instructions TEXT,
    special_instructions TEXT,
    
    -- Status
    dispensed BOOLEAN DEFAULT FALSE,
    dispensed_date TIMESTAMP WITH TIME ZONE,
    dispensed_by UUID REFERENCES users(id),
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- =====================================================
-- WOUND CARE & PROCEDURES
-- =====================================================

-- Wound Care Records
CREATE TABLE IF NOT EXISTS wound_care_records (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    patient_id UUID NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
    treatment_plan_id UUID REFERENCES treatment_plans(id) ON DELETE SET NULL,
    
    wound_location VARCHAR(255) NOT NULL,
    wound_type VARCHAR(100) CHECK (wound_type IN ('Surgical', 'Traumatic', 'Chronic', 'Burn', 'Pressure Ulcer', 'Other')),
    
    -- Assessment
    assessment_date TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    wound_dimensions VARCHAR(100), -- e.g., "5cm x 3cm x 2cm"
    wound_appearance TEXT,
    exudate_type VARCHAR(50),
    exudate_amount VARCHAR(50),
    signs_of_infection BOOLEAN DEFAULT FALSE,
    
    -- Treatment
    treatment_performed TEXT,
    dressing_type VARCHAR(100),
    products_used TEXT,
    
    -- Progress
    healing_status VARCHAR(50) CHECK (healing_status IN ('Improving', 'Static', 'Deteriorating')),
    
    -- Next Care
    next_dressing_date DATE,
    care_plan TEXT,
    
    performed_by UUID REFERENCES users(id),
    
    notes TEXT,
    
    created_by UUID REFERENCES users(id),
    deleted BOOLEAN DEFAULT FALSE,
    synced BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- =====================================================
-- CONTINUING MEDICAL EDUCATION (CME)
-- =====================================================

-- CME Topics
CREATE TABLE IF NOT EXISTS cme_topics (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    
    topic_name VARCHAR(255) NOT NULL,
    category VARCHAR(100),
    description TEXT,
    
    -- Content
    content TEXT,
    learning_objectives TEXT,
    references TEXT,
    
    -- AI Generated
    ai_generated BOOLEAN DEFAULT FALSE,
    ai_generated_at TIMESTAMP WITH TIME ZONE,
    
    -- Metadata
    difficulty_level VARCHAR(50) CHECK (difficulty_level IN ('Beginner', 'Intermediate', 'Advanced')),
    estimated_duration INTEGER, -- minutes
    
    created_by UUID REFERENCES users(id),
    updated_by UUID REFERENCES users(id),
    deleted BOOLEAN DEFAULT FALSE,
    is_published BOOLEAN DEFAULT FALSE,
    published_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- MCQ Questions
CREATE TABLE IF NOT EXISTS mcq_questions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    cme_topic_id UUID REFERENCES cme_topics(id) ON DELETE CASCADE,
    
    question_text TEXT NOT NULL,
    question_type VARCHAR(50) DEFAULT 'Single Choice' CHECK (question_type IN ('Single Choice', 'Multiple Choice', 'True/False')),
    
    -- Options (stored as JSONB)
    options JSONB NOT NULL, -- [{text: "Option A", isCorrect: true}, ...]
    
    -- Metadata
    difficulty VARCHAR(50) CHECK (difficulty IN ('Easy', 'Medium', 'Hard')),
    explanation TEXT,
    
    created_by UUID REFERENCES users(id),
    deleted BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- User Assessment Results
CREATE TABLE IF NOT EXISTS user_assessments (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    cme_topic_id UUID NOT NULL REFERENCES cme_topics(id) ON DELETE CASCADE,
    
    -- Assessment
    started_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    completed_at TIMESTAMP WITH TIME ZONE,
    
    -- Results
    score NUMERIC(5,2),
    total_questions INTEGER,
    correct_answers INTEGER,
    
    -- Answers (stored as JSONB)
    answers JSONB, -- [{questionId: "uuid", selectedOptions: ["option1"], correct: true}, ...]
    
    -- Status
    status VARCHAR(50) DEFAULT 'In Progress' CHECK (status IN ('In Progress', 'Completed', 'Abandoned')),
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- =====================================================
-- CONSUMABLES & INVENTORY
-- =====================================================

-- Surgical Consumables
CREATE TABLE IF NOT EXISTS surgical_consumables (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    
    item_name VARCHAR(255) NOT NULL,
    item_code VARCHAR(50) UNIQUE,
    category VARCHAR(100),
    description TEXT,
    
    -- Stock
    unit VARCHAR(50),
    minimum_stock_level INTEGER DEFAULT 0,
    reorder_level INTEGER DEFAULT 0,
    
    -- Pricing
    unit_cost NUMERIC(10,2),
    
    is_active BOOLEAN DEFAULT TRUE,
    
    created_by UUID REFERENCES users(id),
    updated_by UUID REFERENCES users(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Consumable Usage
CREATE TABLE IF NOT EXISTS consumable_usage (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    consumable_id UUID NOT NULL REFERENCES surgical_consumables(id),
    
    patient_id UUID REFERENCES patients(id) ON DELETE SET NULL,
    surgery_booking_id UUID REFERENCES surgery_bookings(id) ON DELETE SET NULL,
    
    quantity_used INTEGER NOT NULL,
    usage_date TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    
    recorded_by UUID REFERENCES users(id),
    notes TEXT,
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- =====================================================
-- MULTIDISCIPLINARY TEAM (MDT) MEETINGS
-- =====================================================

-- MDT Meetings
CREATE TABLE IF NOT EXISTS mdt_meetings (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    
    meeting_title VARCHAR(255) NOT NULL,
    meeting_date DATE NOT NULL,
    meeting_time TIME NOT NULL,
    
    venue VARCHAR(255),
    chairperson_id UUID REFERENCES users(id),
    
    agenda TEXT,
    minutes TEXT,
    
    status VARCHAR(50) DEFAULT 'Scheduled' CHECK (status IN ('Scheduled', 'In Progress', 'Completed', 'Cancelled')),
    
    created_by UUID REFERENCES users(id),
    deleted BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- MDT Cases
CREATE TABLE IF NOT EXISTS mdt_cases (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    mdt_meeting_id UUID NOT NULL REFERENCES mdt_meetings(id) ON DELETE CASCADE,
    patient_id UUID NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
    
    case_summary TEXT NOT NULL,
    presenting_clinician_id UUID REFERENCES users(id),
    
    -- Discussion
    discussion_points TEXT,
    recommendations TEXT,
    action_plan TEXT,
    
    -- Follow-up
    follow_up_required BOOLEAN DEFAULT FALSE,
    follow_up_date DATE,
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- =====================================================
-- AUDIT LOGS
-- =====================================================

-- Audit Trail
CREATE TABLE IF NOT EXISTS audit_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    
    user_id UUID REFERENCES users(id) ON DELETE SET NULL,
    action VARCHAR(100) NOT NULL,
    table_name VARCHAR(100),
    record_id UUID,
    
    old_values JSONB,
    new_values JSONB,
    
    ip_address VARCHAR(45),
    user_agent TEXT,
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- =====================================================
-- INDEXES FOR PERFORMANCE
-- =====================================================

-- Patient indexes
CREATE INDEX idx_patients_hospital_number ON patients(hospital_number);
CREATE INDEX idx_patients_name ON patients(last_name, first_name);
CREATE INDEX idx_patients_created_at ON patients(created_at);
CREATE INDEX idx_patients_deleted ON patients(deleted);

-- Admission indexes
CREATE INDEX idx_admissions_patient ON patient_admissions(patient_id);
CREATE INDEX idx_admissions_status ON patient_admissions(status);
CREATE INDEX idx_admissions_date ON patient_admissions(admission_date);

-- Treatment plan indexes
CREATE INDEX idx_treatment_plans_patient ON treatment_plans(patient_id);
CREATE INDEX idx_treatment_plans_status ON treatment_plans(status);
CREATE INDEX idx_treatment_plan_steps_plan ON treatment_plan_steps(treatment_plan_id);

-- Surgery indexes
CREATE INDEX idx_surgery_patient ON surgery_bookings(patient_id);
CREATE INDEX idx_surgery_date ON surgery_bookings(scheduled_date);
CREATE INDEX idx_surgery_status ON surgery_bookings(status);

-- Lab indexes
CREATE INDEX idx_lab_patient ON lab_investigations(patient_id);
CREATE INDEX idx_lab_status ON lab_investigations(status);
CREATE INDEX idx_lab_ordered_date ON lab_investigations(ordered_date);

-- Prescription indexes
CREATE INDEX idx_prescriptions_patient ON prescriptions(patient_id);
CREATE INDEX idx_prescriptions_status ON prescriptions(status);

-- CME indexes
CREATE INDEX idx_cme_topics_category ON cme_topics(category);
CREATE INDEX idx_cme_published ON cme_topics(is_published);
CREATE INDEX idx_user_assessments_user ON user_assessments(user_id);
CREATE INDEX idx_user_assessments_topic ON user_assessments(cme_topic_id);

-- Audit log indexes
CREATE INDEX idx_audit_user ON audit_logs(user_id);
CREATE INDEX idx_audit_table ON audit_logs(table_name);
CREATE INDEX idx_audit_created ON audit_logs(created_at);

-- =====================================================
-- TRIGGERS FOR UPDATED_AT
-- =====================================================

CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Apply trigger to all tables with updated_at
CREATE TRIGGER update_users_updated_at BEFORE UPDATE ON users FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_ai_settings_updated_at BEFORE UPDATE ON ai_settings FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_patients_updated_at BEFORE UPDATE ON patients FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_admissions_updated_at BEFORE UPDATE ON patient_admissions FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_treatment_plans_updated_at BEFORE UPDATE ON treatment_plans FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_treatment_plan_steps_updated_at BEFORE UPDATE ON treatment_plan_steps FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_surgery_bookings_updated_at BEFORE UPDATE ON surgery_bookings FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_surgical_checklists_updated_at BEFORE UPDATE ON surgical_checklists FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_lab_investigations_updated_at BEFORE UPDATE ON lab_investigations FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_prescriptions_updated_at BEFORE UPDATE ON prescriptions FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_prescription_items_updated_at BEFORE UPDATE ON prescription_items FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_wound_care_records_updated_at BEFORE UPDATE ON wound_care_records FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_cme_topics_updated_at BEFORE UPDATE ON cme_topics FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_mcq_questions_updated_at BEFORE UPDATE ON mcq_questions FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_user_assessments_updated_at BEFORE UPDATE ON user_assessments FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_surgical_consumables_updated_at BEFORE UPDATE ON surgical_consumables FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_mdt_meetings_updated_at BEFORE UPDATE ON mdt_meetings FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_mdt_cases_updated_at BEFORE UPDATE ON mdt_cases FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
-- =====================================================
-- CHAT AND VIDEO CONFERENCE TABLES
-- =====================================================

-- Chat Rooms
CREATE TABLE IF NOT EXISTS chat_rooms (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(255) NOT NULL,
    type VARCHAR(50) NOT NULL CHECK (type IN ('direct', 'group', 'conference', 'patient')),
    patient_id UUID REFERENCES patients(id) ON DELETE SET NULL,
    created_by UUID REFERENCES users(id),
    is_active BOOLEAN DEFAULT TRUE,
    last_message_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Chat Room Participants
CREATE TABLE IF NOT EXISTS chat_room_participants (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    room_id UUID NOT NULL REFERENCES chat_rooms(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    joined_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    last_read_at TIMESTAMP WITH TIME ZONE,
    is_admin BOOLEAN DEFAULT FALSE,
    is_active BOOLEAN DEFAULT TRUE,
    UNIQUE(room_id, user_id)
);

-- Chat Messages
CREATE TABLE IF NOT EXISTS chat_messages (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    room_id UUID NOT NULL REFERENCES chat_rooms(id) ON DELETE CASCADE,
    sender_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    content TEXT NOT NULL,
    message_type VARCHAR(50) DEFAULT 'text' CHECK (message_type IN ('text', 'file', 'image', 'system', 'reaction')),
    file_url TEXT,
    file_name VARCHAR(255),
    file_size BIGINT,
    reply_to UUID REFERENCES chat_messages(id) ON DELETE SET NULL,
    is_edited BOOLEAN DEFAULT FALSE,
    edited_at TIMESTAMP WITH TIME ZONE,
    is_deleted BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Chat Message Reactions
CREATE TABLE IF NOT EXISTS chat_message_reactions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    message_id UUID NOT NULL REFERENCES chat_messages(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    emoji VARCHAR(50) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(message_id, user_id, emoji)
);

-- Chat Message Read Receipts
CREATE TABLE IF NOT EXISTS chat_read_receipts (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    message_id UUID NOT NULL REFERENCES chat_messages(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    read_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(message_id, user_id)
);

-- Video Conference Rooms
CREATE TABLE IF NOT EXISTS conference_rooms (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(255) NOT NULL,
    room_type VARCHAR(50) DEFAULT 'general' CHECK (room_type IN ('mdt', 'consultation', 'education', 'general')),
    host_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    max_participants INTEGER DEFAULT 50,
    allow_screen_share BOOLEAN DEFAULT TRUE,
    allow_recording BOOLEAN DEFAULT FALSE,
    allow_chat BOOLEAN DEFAULT TRUE,
    waiting_room_enabled BOOLEAN DEFAULT FALSE,
    is_active BOOLEAN DEFAULT TRUE,
    started_at TIMESTAMP WITH TIME ZONE,
    ended_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Conference Participants Log
CREATE TABLE IF NOT EXISTS conference_participants (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    room_id UUID NOT NULL REFERENCES conference_rooms(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    joined_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    left_at TIMESTAMP WITH TIME ZONE,
    duration_seconds INTEGER,
    was_presenter BOOLEAN DEFAULT FALSE
);

-- Indexes for chat tables
CREATE INDEX IF NOT EXISTS idx_chat_rooms_created_by ON chat_rooms(created_by);
CREATE INDEX IF NOT EXISTS idx_chat_rooms_patient_id ON chat_rooms(patient_id);
CREATE INDEX IF NOT EXISTS idx_chat_room_participants_room ON chat_room_participants(room_id);
CREATE INDEX IF NOT EXISTS idx_chat_room_participants_user ON chat_room_participants(user_id);
CREATE INDEX IF NOT EXISTS idx_chat_messages_room ON chat_messages(room_id);
CREATE INDEX IF NOT EXISTS idx_chat_messages_sender ON chat_messages(sender_id);
CREATE INDEX IF NOT EXISTS idx_chat_messages_created ON chat_messages(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_chat_reactions_message ON chat_message_reactions(message_id);
CREATE INDEX IF NOT EXISTS idx_conference_rooms_host ON conference_rooms(host_id);
CREATE INDEX IF NOT EXISTS idx_conference_participants_room ON conference_participants(room_id);

-- Triggers for chat tables
CREATE TRIGGER update_chat_rooms_updated_at BEFORE UPDATE ON chat_rooms FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_conference_rooms_updated_at BEFORE UPDATE ON conference_rooms FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();