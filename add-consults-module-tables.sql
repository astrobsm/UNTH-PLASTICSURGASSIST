-- ============================================================================
-- Native Consults Module — schema migration
-- Adds tables for received electronic consults (with public-link submission),
-- delivered consults (OCR'd handwritten responses), status workflow, attachments,
-- digital chart reconstruction and SMS feedback log.
--
-- Safe to run repeatedly (uses IF NOT EXISTS / ON CONFLICT DO NOTHING).
-- ============================================================================

-- Tracks per-unit shareable submission links given to other clinical units
CREATE TABLE IF NOT EXISTS consult_submission_links (
    id              SERIAL PRIMARY KEY,
    token           VARCHAR(64) UNIQUE NOT NULL,
    unit_label      VARCHAR(120) NOT NULL,           -- e.g. "General Surgery, Ward 4B"
    description     TEXT,
    is_active       BOOLEAN DEFAULT TRUE,
    submission_count INTEGER DEFAULT 0,
    created_by      INTEGER,                         -- user id of person who created the link
    created_at      TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    last_used_at    TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS idx_consult_links_token ON consult_submission_links(token) WHERE is_active = TRUE;

-- Received consults (other unit -> our plastic surgery unit)
CREATE TABLE IF NOT EXISTS received_consults (
    id                      SERIAL PRIMARY KEY,
    consult_ref             VARCHAR(40) UNIQUE NOT NULL,         -- human readable e.g. RC-2026-0001
    submission_token        VARCHAR(64),                          -- which shareable link was used (nullable for staff-entered)
    source                  VARCHAR(20) DEFAULT 'public_form',    -- 'public_form' | 'staff_entry' | 'phone_dictation'

    -- Patient identifiers
    patient_name            VARCHAR(255) NOT NULL,
    hospital_number         VARCHAR(60),
    age                     INTEGER,
    sex                     VARCHAR(10),
    ward                    VARCHAR(120),
    bed_number              VARCHAR(40),

    -- Submitting (referring) unit info
    referring_unit          VARCHAR(180) NOT NULL,
    referring_consultant    VARCHAR(180),
    referring_doctor_name   VARCHAR(180) NOT NULL,
    referring_doctor_role   VARCHAR(80),
    referring_phone         VARCHAR(40) NOT NULL,                 -- mandatory for SMS feedback
    referring_alt_phone     VARCHAR(40),

    -- Clinical content
    primary_diagnosis       TEXT,
    presenting_complaint    TEXT,
    history_summary         TEXT,
    examination_summary     TEXT,
    investigations_summary  TEXT,
    indication              TEXT NOT NULL,                        -- reason for plastic surgery consult
    urgency                 VARCHAR(20) DEFAULT 'routine',        -- 'emergency' | 'urgent' | 'routine'
    requested_input         TEXT,

    -- Status workflow
    status                  VARCHAR(30) DEFAULT 'received',       -- received | acknowledged | reviewed | plan_approved | plan_implemented | closed | cancelled
    acknowledged_by         INTEGER,
    acknowledged_at         TIMESTAMPTZ,
    reviewed_by             INTEGER,
    reviewed_at             TIMESTAMPTZ,
    plan_approved_by        INTEGER,
    plan_approved_at        TIMESTAMPTZ,
    plan_implemented_by     INTEGER,
    plan_implemented_at     TIMESTAMPTZ,
    closed_at               TIMESTAMPTZ,

    -- Clinical assessment (filled progressively as status advances)
    review_notes            TEXT,
    proposed_plan           TEXT,
    plan_approval_notes     TEXT,
    implementation_notes    TEXT,

    -- Tracking
    created_at              TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    updated_at              TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    last_feedback_sent_at   TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS idx_received_consults_status   ON received_consults(status);
CREATE INDEX IF NOT EXISTS idx_received_consults_urgency  ON received_consults(urgency);
CREATE INDEX IF NOT EXISTS idx_received_consults_created  ON received_consults(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_received_consults_hosp     ON received_consults(hospital_number);

-- Delivered consults (our unit -> other units; OCR'd handwritten consult notes)
CREATE TABLE IF NOT EXISTS delivered_consults (
    id                      SERIAL PRIMARY KEY,
    consult_ref             VARCHAR(40) UNIQUE NOT NULL,         -- e.g. DC-2026-0001
    patient_name            VARCHAR(255) NOT NULL,
    hospital_number         VARCHAR(60),

    -- Receiving unit (the unit that wrote the consult to)
    receiving_unit          VARCHAR(180) NOT NULL,
    receiving_consultant    VARCHAR(180),
    receiver_name           VARCHAR(180) NOT NULL,                -- who at the receiving unit accepted
    receiver_phone          VARCHAR(40) NOT NULL,
    receiver_role           VARCHAR(80),

    -- Source author at our unit
    written_by_user_id      INTEGER,
    written_by_name         VARCHAR(180),

    -- OCR content (scanned handwritten consult page)
    handwritten_image_url   TEXT,                                 -- data URL or remote URL
    ocr_raw_text            TEXT,
    ocr_structured          JSONB,                                -- AI-structured fields
    consult_summary         TEXT,                                 -- editable summary text
    delivered_at            TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,

    -- Status
    status                  VARCHAR(30) DEFAULT 'delivered',      -- delivered | acknowledged | responded | closed
    acknowledged_at         TIMESTAMPTZ,
    response_received_at    TIMESTAMPTZ,
    response_text           TEXT,

    created_at              TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    updated_at              TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_delivered_consults_status  ON delivered_consults(status);
CREATE INDEX IF NOT EXISTS idx_delivered_consults_created ON delivered_consults(created_at DESC);

-- Audit trail of every status transition (both received & delivered)
CREATE TABLE IF NOT EXISTS consult_status_history (
    id              SERIAL PRIMARY KEY,
    consult_kind    VARCHAR(20) NOT NULL,         -- 'received' | 'delivered'
    consult_id      INTEGER NOT NULL,
    from_status     VARCHAR(30),
    to_status       VARCHAR(30) NOT NULL,
    notes           TEXT,
    actor_user_id   INTEGER,
    actor_name      VARCHAR(180),
    created_at      TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_consult_status_hx ON consult_status_history(consult_kind, consult_id, created_at DESC);

-- Attachments: clinical photographs, OCR investigation scans, digital chart screenshots
CREATE TABLE IF NOT EXISTS consult_attachments (
    id              SERIAL PRIMARY KEY,
    consult_kind    VARCHAR(20) NOT NULL,         -- 'received' | 'delivered'
    consult_id      INTEGER NOT NULL,
    kind            VARCHAR(30) NOT NULL,         -- 'clinical_photo' | 'investigation_ocr' | 'chart_ocr' | 'digital_chart' | 'document'
    file_name       VARCHAR(255),
    mime_type       VARCHAR(80),
    data_url        TEXT,                         -- inline base64 (small images) – downscaled before storage
    remote_url      TEXT,                         -- optional cloud blob URL
    ocr_text        TEXT,                         -- extracted text if OCR was run
    ocr_structured  JSONB,                        -- structured fields (lab values, vitals, etc.)
    metadata        JSONB,                        -- caption, tags, body region, etc.
    uploaded_by     INTEGER,
    uploaded_by_name VARCHAR(180),
    created_at      TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_consult_attach ON consult_attachments(consult_kind, consult_id, created_at DESC);

-- Digital chart reconstructions (vitals/fluid/etc. recreated from OCR'd paper charts)
CREATE TABLE IF NOT EXISTS consult_digital_charts (
    id              SERIAL PRIMARY KEY,
    consult_kind    VARCHAR(20) NOT NULL,
    consult_id      INTEGER NOT NULL,
    chart_type      VARCHAR(40) NOT NULL,         -- 'vital_signs' | 'fluid_balance' | 'glucose' | 'pain_score' | 'custom'
    title           VARCHAR(180),
    series          JSONB NOT NULL,               -- [{ label, color, points: [{ t, v }] }]
    source_attachment_id INTEGER,                 -- OCR scan it was derived from (FK soft-link)
    notes           TEXT,
    created_by      INTEGER,
    created_by_name VARCHAR(180),
    created_at      TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    updated_at      TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_consult_charts ON consult_digital_charts(consult_kind, consult_id);

-- SMS feedback log to referring units
CREATE TABLE IF NOT EXISTS consult_feedback_log (
    id              SERIAL PRIMARY KEY,
    consult_kind    VARCHAR(20) NOT NULL,
    consult_id      INTEGER NOT NULL,
    channel         VARCHAR(20) DEFAULT 'sms',    -- 'sms' | 'whatsapp' | 'email'
    to_phone        VARCHAR(40),
    to_name         VARCHAR(180),
    message         TEXT NOT NULL,
    status          VARCHAR(20) DEFAULT 'queued', -- 'queued' | 'sent' | 'failed'
    provider        VARCHAR(40),                  -- 'twilio' | 'termii' | 'console'
    provider_id     VARCHAR(120),
    error_message   TEXT,
    sent_by         INTEGER,
    sent_by_name    VARCHAR(180),
    created_at      TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    sent_at         TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS idx_consult_feedback ON consult_feedback_log(consult_kind, consult_id, created_at DESC);

-- ============================================================================
-- Notes:
--   * data_url payloads should be downscaled client-side (the OCR service already
--     does this via prepareUploadImage at <=2400px JPEG @0.85). For very large
--     attachments, consider uploading to object storage and storing the URL in
--     remote_url instead of data_url.
--   * The submission token is generated server-side (32 bytes hex) so other units
--     can be given a URL like https://app.example.com/submit-consult/<token>
--     without exposing internal IDs.
-- ============================================================================
