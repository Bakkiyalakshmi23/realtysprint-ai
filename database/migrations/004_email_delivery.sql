-- ────────────────────────────────────────────────────────────
-- Migration 004: Email Delivery Idempotency and Integration
-- ────────────────────────────────────────────────────────────

-- 1. Add approval_id to outreach_drafts to map drafts to approvals
ALTER TABLE outreach_drafts ADD COLUMN IF NOT EXISTS approval_id INTEGER REFERENCES approvals(id) ON DELETE SET NULL;

-- 2. Create email_dispatches table for idempotent, tracked dispatch
CREATE TABLE IF NOT EXISTS email_dispatches (
  id SERIAL PRIMARY KEY,
  approval_id INTEGER UNIQUE REFERENCES approvals(id) ON DELETE RESTRICT,
  outreach_draft_id INTEGER REFERENCES outreach_drafts(id) ON DELETE SET NULL,
  recipient VARCHAR(255) NOT NULL,
  subject VARCHAR(500),
  body TEXT,
  status VARCHAR(50) DEFAULT 'pending' CHECK (status IN ('pending', 'sent', 'failed', 'unknown')),
  provider_message_id VARCHAR(255),
  error_details TEXT,
  dispatched_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_email_dispatches_status ON email_dispatches (status);
