BEGIN;

-- ============================================================
-- REALTYSPRINT AI — STEP 5F
-- Client Intelligence, Conversations & Deduplication
--
-- IMPORTANT:
-- The existing CRM tables are preserved:
-- companies
-- contacts
-- leads
-- clients
--
-- This migration adds intelligence/history around them.
-- ============================================================


-- ============================================================
-- 1. CLIENT SOURCES
-- Tracks where a client/prospect record came from.
-- ============================================================

CREATE TABLE IF NOT EXISTS client_sources (
    id BIGSERIAL PRIMARY KEY,
    client_id INTEGER NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
    source_type VARCHAR(100) NOT NULL,
    source_reference TEXT,
    discovered_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_client_sources_client
    ON client_sources(client_id);


-- ============================================================
-- 2. CLIENT INTERACTIONS
-- Internal record of conversations/interactions.
--
-- External communication remains approval-controlled.
-- This table does NOT send messages.
-- ============================================================

CREATE TABLE IF NOT EXISTS client_interactions (
    id BIGSERIAL PRIMARY KEY,
    client_id INTEGER NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
    contact_id INTEGER REFERENCES contacts(id) ON DELETE SET NULL,

    channel VARCHAR(50) NOT NULL,
    direction VARCHAR(30) NOT NULL,
    interaction_type VARCHAR(100) NOT NULL,

    content TEXT,

    status VARCHAR(50) NOT NULL DEFAULT 'draft',

    requires_approval BOOLEAN NOT NULL DEFAULT FALSE,

    created_by VARCHAR(100),

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_client_interactions_client
    ON client_interactions(client_id);

CREATE INDEX IF NOT EXISTS idx_client_interactions_contact
    ON client_interactions(contact_id);

CREATE INDEX IF NOT EXISTS idx_client_interactions_created
    ON client_interactions(created_at DESC);


-- ============================================================
-- 3. CLIENT REQUIREMENTS
-- Structured requirements captured by Client Acquisition.
-- ============================================================

CREATE TABLE IF NOT EXISTS client_requirements (
    id BIGSERIAL PRIMARY KEY,

    client_id INTEGER NOT NULL REFERENCES clients(id) ON DELETE CASCADE,

    requirement TEXT NOT NULL,

    priority VARCHAR(30),

    budget NUMERIC,

    currency VARCHAR(10) DEFAULT 'INR',

    timeline TEXT,

    status VARCHAR(50) NOT NULL DEFAULT 'open',

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_client_requirements_client
    ON client_requirements(client_id);


-- ============================================================
-- 4. CLIENT PIPELINE
-- Acquisition lifecycle.
-- ============================================================

CREATE TABLE IF NOT EXISTS client_pipeline (
    id BIGSERIAL PRIMARY KEY,

    client_id INTEGER NOT NULL REFERENCES clients(id) ON DELETE CASCADE,

    stage VARCHAR(50) NOT NULL DEFAULT 'prospect',

    expected_revenue NUMERIC,

    currency VARCHAR(10) DEFAULT 'INR',

    probability NUMERIC
        CHECK (probability >= 0 AND probability <= 100),

    next_action TEXT,

    next_action_at TIMESTAMPTZ,

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_client_pipeline_client
    ON client_pipeline(client_id);

CREATE INDEX IF NOT EXISTS idx_client_pipeline_stage
    ON client_pipeline(stage);


-- ============================================================
-- 5. CLIENT ACTIVITY
-- Complete client-level audit timeline.
-- ============================================================

CREATE TABLE IF NOT EXISTS client_activity (
    id BIGSERIAL PRIMARY KEY,

    client_id INTEGER NOT NULL REFERENCES clients(id) ON DELETE CASCADE,

    actor_type VARCHAR(50) NOT NULL,

    actor_id VARCHAR(100),

    action VARCHAR(100) NOT NULL,

    description TEXT,

    metadata JSONB NOT NULL DEFAULT '{}'::jsonb,

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_client_activity_client
    ON client_activity(client_id);

CREATE INDEX IF NOT EXISTS idx_client_activity_created
    ON client_activity(created_at DESC);


-- ============================================================
-- 6. DEDUPLICATION CANDIDATES
--
-- Possible duplicates are NEVER automatically deleted.
-- They require explicit human review.
-- ============================================================

CREATE TABLE IF NOT EXISTS dedupe_candidates (
    id BIGSERIAL PRIMARY KEY,

    client_id INTEGER NOT NULL REFERENCES clients(id) ON DELETE CASCADE,

    possible_duplicate_client_id INTEGER NOT NULL
        REFERENCES clients(id) ON DELETE CASCADE,

    match_type VARCHAR(50) NOT NULL,

    match_score NUMERIC NOT NULL
        CHECK (match_score >= 0 AND match_score <= 100),

    status VARCHAR(50) NOT NULL DEFAULT 'pending_review',

    reviewed_by VARCHAR(100),

    reviewed_at TIMESTAMPTZ,

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT dedupe_not_self
        CHECK (client_id <> possible_duplicate_client_id)
);

CREATE INDEX IF NOT EXISTS idx_dedupe_candidates_status
    ON dedupe_candidates(status);

CREATE INDEX IF NOT EXISTS idx_dedupe_candidates_client
    ON dedupe_candidates(client_id);


-- ============================================================
-- 7. CLIENT MERGE HISTORY
--
-- Preserves an audit record whenever one client record is
-- merged into another.
-- ============================================================

CREATE TABLE IF NOT EXISTS client_merge_history (
    id BIGSERIAL PRIMARY KEY,

    canonical_client_id INTEGER NOT NULL
        REFERENCES clients(id),

    merged_client_id INTEGER NOT NULL
        REFERENCES clients(id),

    reason TEXT,

    merged_by VARCHAR(100),

    metadata JSONB NOT NULL DEFAULT '{}'::jsonb,

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT merge_not_self
        CHECK (canonical_client_id <> merged_client_id)
);

CREATE INDEX IF NOT EXISTS idx_client_merge_canonical
    ON client_merge_history(canonical_client_id);

CREATE INDEX IF NOT EXISTS idx_client_merge_merged
    ON client_merge_history(merged_client_id);


-- ============================================================
-- 8. SAFE DEDUPLICATION INDEXES
--
-- These help identify exact duplicates in the existing
-- companies/contacts data without deleting anything.
--
-- We intentionally do NOT create UNIQUE constraints because
-- existing duplicate records may already exist.
-- ============================================================

CREATE INDEX IF NOT EXISTS idx_companies_name_lower
    ON companies (LOWER(TRIM(name)));

CREATE INDEX IF NOT EXISTS idx_companies_website_lower
    ON companies (LOWER(TRIM(website)));

CREATE INDEX IF NOT EXISTS idx_contacts_email_lower
    ON contacts (LOWER(TRIM(email)));

CREATE INDEX IF NOT EXISTS idx_contacts_phone
    ON contacts (TRIM(phone));


COMMIT;