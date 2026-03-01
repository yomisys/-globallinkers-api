-- ============================================================
-- GLOBAL LINKERS LTD — PostgreSQL Database Schema
-- Run this file once to set up your database:
--   psql -U postgres -d globallinkers -f schema.sql
-- ============================================================

-- Enable extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ============================================================
-- ADMINS
-- ============================================================
CREATE TABLE IF NOT EXISTS admins (
    id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    email       VARCHAR(255) UNIQUE NOT NULL,
    password    VARCHAR(255) NOT NULL,          -- bcrypt hash
    full_name   VARCHAR(255) NOT NULL,
    role        VARCHAR(50) DEFAULT 'admin',    -- 'superadmin' | 'admin' | 'recruiter'
    is_active   BOOLEAN DEFAULT TRUE,
    last_login  TIMESTAMPTZ,
    created_at  TIMESTAMPTZ DEFAULT NOW(),
    updated_at  TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- JOBS
-- ============================================================
CREATE TABLE IF NOT EXISTS jobs (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    title           VARCHAR(255) NOT NULL,
    company         VARCHAR(255) NOT NULL,
    location        VARCHAR(255) NOT NULL,
    job_type        VARCHAR(50) NOT NULL,       -- Full-time | Part-time | Contract | Remote
    category        VARCHAR(100),
    experience      VARCHAR(100),
    salary_min      INTEGER,                    -- Monthly in Naira
    salary_max      INTEGER,
    salary_display  VARCHAR(100),               -- e.g. "₦400k–₦600k/mo"
    description     TEXT NOT NULL,
    requirements    TEXT,
    benefits        TEXT,
    logo_initials   VARCHAR(5),
    logo_color      VARCHAR(10) DEFAULT '#0A3D91',
    is_featured     BOOLEAN DEFAULT FALSE,
    is_active       BOOLEAN DEFAULT TRUE,
    applications_count INTEGER DEFAULT 0,
    views_count     INTEGER DEFAULT 0,
    deadline        DATE,
    posted_by       UUID REFERENCES admins(id) ON DELETE SET NULL,
    created_at      TIMESTAMPTZ DEFAULT NOW(),
    updated_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_jobs_active ON jobs(is_active);
CREATE INDEX IF NOT EXISTS idx_jobs_category ON jobs(category);
CREATE INDEX IF NOT EXISTS idx_jobs_type ON jobs(job_type);
CREATE INDEX IF NOT EXISTS idx_jobs_created ON jobs(created_at DESC);

-- ============================================================
-- APPLICATIONS (Candidates applying for jobs)
-- ============================================================
CREATE TABLE IF NOT EXISTS applications (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    job_id          UUID REFERENCES jobs(id) ON DELETE CASCADE,
    -- Applicant Info
    full_name       VARCHAR(255) NOT NULL,
    email           VARCHAR(255) NOT NULL,
    phone           VARCHAR(30),
    location        VARCHAR(255),
    -- Professional
    current_role    VARCHAR(255),
    experience_years INTEGER,
    current_employer VARCHAR(255),
    linkedin_url    VARCHAR(500),
    portfolio_url   VARCHAR(500),
    -- Application
    cover_letter    TEXT,
    cv_filename     VARCHAR(255),               -- stored file path
    cv_url          VARCHAR(500),
    -- Status
    status          VARCHAR(50) DEFAULT 'new',  -- new | reviewing | shortlisted | interview | offered | placed | rejected
    stage_notes     TEXT,
    interview_date  TIMESTAMPTZ,
    assigned_to     UUID REFERENCES admins(id) ON DELETE SET NULL,
    -- Metadata
    source          VARCHAR(100) DEFAULT 'website',
    ip_address      INET,
    created_at      TIMESTAMPTZ DEFAULT NOW(),
    updated_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_apps_job ON applications(job_id);
CREATE INDEX IF NOT EXISTS idx_apps_email ON applications(email);
CREATE INDEX IF NOT EXISTS idx_apps_status ON applications(status);
CREATE INDEX IF NOT EXISTS idx_apps_created ON applications(created_at DESC);

-- ============================================================
-- EMPLOYER REQUESTS (Employers posting job requests)
-- ============================================================
CREATE TABLE IF NOT EXISTS employer_requests (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    -- Company Info
    company_name    VARCHAR(255) NOT NULL,
    industry        VARCHAR(100),
    company_size    VARCHAR(50),               -- SME | Large | Multinational
    website         VARCHAR(500),
    -- Contact
    contact_name    VARCHAR(255) NOT NULL,
    contact_email   VARCHAR(255) NOT NULL,
    contact_phone   VARCHAR(30),
    contact_title   VARCHAR(255),
    -- Job Request
    job_title       VARCHAR(255) NOT NULL,
    department      VARCHAR(255),
    job_type        VARCHAR(50),
    location        VARCHAR(255),
    salary_range    VARCHAR(100),
    experience_required VARCHAR(100),
    vacancies       INTEGER DEFAULT 1,
    description     TEXT,
    urgency         VARCHAR(20) DEFAULT 'normal', -- low | normal | high | urgent
    -- Status
    status          VARCHAR(50) DEFAULT 'new',   -- new | reviewing | in_progress | fulfilled | closed
    assigned_to     UUID REFERENCES admins(id) ON DELETE SET NULL,
    notes           TEXT,
    -- Package
    package_type    VARCHAR(50),               -- starter | professional | enterprise
    -- Metadata
    created_at      TIMESTAMPTZ DEFAULT NOW(),
    updated_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_employer_req_status ON employer_requests(status);
CREATE INDEX IF NOT EXISTS idx_employer_req_created ON employer_requests(created_at DESC);

-- ============================================================
-- ENQUIRIES (General contact form messages)
-- ============================================================
CREATE TABLE IF NOT EXISTS enquiries (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    full_name       VARCHAR(255) NOT NULL,
    email           VARCHAR(255) NOT NULL,
    phone           VARCHAR(30),
    user_type       VARCHAR(50),               -- Job Seeker | Employer | Corporate Client | Partner | Other
    subject         VARCHAR(500) NOT NULL,
    message         TEXT NOT NULL,
    -- Status
    status          VARCHAR(50) DEFAULT 'new', -- new | read | replied | closed
    replied_by      UUID REFERENCES admins(id) ON DELETE SET NULL,
    reply_text      TEXT,
    replied_at      TIMESTAMPTZ,
    -- Metadata
    ip_address      INET,
    created_at      TIMESTAMPTZ DEFAULT NOW(),
    updated_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_enquiries_status ON enquiries(status);
CREATE INDEX IF NOT EXISTS idx_enquiries_created ON enquiries(created_at DESC);

-- ============================================================
-- PLACEMENTS (Successful placements tracker)
-- ============================================================
CREATE TABLE IF NOT EXISTS placements (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    application_id  UUID REFERENCES applications(id) ON DELETE SET NULL,
    candidate_name  VARCHAR(255) NOT NULL,
    candidate_email VARCHAR(255),
    company         VARCHAR(255) NOT NULL,
    role            VARCHAR(255) NOT NULL,
    placement_type  VARCHAR(50),               -- Permanent | Contract | Temporary
    start_date      DATE,
    end_date        DATE,                      -- for contracts
    salary          INTEGER,                   -- Monthly Naira
    status          VARCHAR(50) DEFAULT 'active', -- active | completed | terminated
    notes           TEXT,
    placed_by       UUID REFERENCES admins(id) ON DELETE SET NULL,
    created_at      TIMESTAMPTZ DEFAULT NOW(),
    updated_at      TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- AUDIT LOG
-- ============================================================
CREATE TABLE IF NOT EXISTS audit_log (
    id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    admin_id    UUID REFERENCES admins(id) ON DELETE SET NULL,
    action      VARCHAR(100) NOT NULL,         -- e.g. 'job.created', 'application.status_changed'
    entity      VARCHAR(100),                  -- table name
    entity_id   UUID,
    old_value   JSONB,
    new_value   JSONB,
    ip_address  INET,
    created_at  TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_audit_admin ON audit_log(admin_id);
CREATE INDEX IF NOT EXISTS idx_audit_entity ON audit_log(entity, entity_id);

-- ============================================================
-- AUTO-UPDATE updated_at TRIGGER
-- ============================================================
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE TRIGGER trg_jobs_updated
    BEFORE UPDATE ON jobs
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE OR REPLACE TRIGGER trg_apps_updated
    BEFORE UPDATE ON applications
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE OR REPLACE TRIGGER trg_employer_req_updated
    BEFORE UPDATE ON employer_requests
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE OR REPLACE TRIGGER trg_enquiries_updated
    BEFORE UPDATE ON enquiries
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE OR REPLACE TRIGGER trg_admins_updated
    BEFORE UPDATE ON admins
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ============================================================
-- SEED: Default superadmin (password: Admin@GL2025!)
-- Change this immediately after first login!
-- ============================================================
INSERT INTO admins (email, password, full_name, role)
VALUES (
    'admin@globallinkers.ng',
    '$2a$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQyCgvj/GV8C9CmM8dBQ7Tzqe',
    'System Administrator',
    'superadmin'
) ON CONFLICT (email) DO NOTHING;

-- ============================================================
-- SEED: Sample jobs (optional — comment out in production)
-- ============================================================
INSERT INTO jobs (title, company, location, job_type, category, experience, salary_min, salary_max, salary_display, description, logo_initials, logo_color, is_featured)
VALUES
('Senior Data Analyst', 'Zenith Bank Plc', 'Lagos Island, Lagos', 'Full-time', 'Finance', '4–6 years', 450000, 650000, '₦450k–₦650k/mo', 'Analyze complex financial datasets, build dashboards, and present actionable insights to senior management.', 'ZB', '#0A3D91', true),
('HR Business Partner', 'MTN Nigeria', 'Victoria Island, Lagos', 'Full-time', 'Human Resources', '5+ years', 500000, 750000, '₦500k–₦750k/mo', 'Partner with business units to align HR strategies, drive performance management, and foster a high-performance culture.', 'MT', '#e4b913', false),
('Software Engineer (React)', 'Flutterwave', 'Remote', 'Remote', 'Technology', '3–5 years', 700000, 1200000, '₦700k–₦1.2M/mo', 'Build scalable front-end applications using React and TypeScript.', 'FW', '#e63b2e', true),
('Supply Chain Manager', 'Dangote Industries', 'Apapa, Lagos', 'Full-time', 'Operations', '7–10 years', 600000, 900000, '₦600k–₦900k/mo', 'Oversee end-to-end supply chain operations including procurement, logistics, and inventory management.', 'DG', '#1a8a3c', false),
('Petroleum Engineer', 'Shell Nigeria', 'Port Harcourt, Rivers', 'Contract', 'Engineering', '6–10 years', 1200000, 2000000, '₦1.2M–₦2M/mo', 'Design and implement production optimization strategies for onshore and offshore oil fields.', 'SH', '#e4b913', true)
ON CONFLICT DO NOTHING;

-- Done!
SELECT 'Schema created successfully.' AS status;
