-- Migration 009: WhatsApp Delivery and Opt-Ins
CREATE TABLE IF NOT EXISTS whatsapp_opt_ins (
  phone_number VARCHAR(50) PRIMARY KEY,
  has_opted_in BOOLEAN DEFAULT false,
  opted_in_at TIMESTAMPTZ,
  last_inbound_at TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS whatsapp_dispatches (
  id SERIAL PRIMARY KEY,
  approval_id INTEGER UNIQUE REFERENCES approvals(id) ON DELETE RESTRICT,
  outreach_draft_id INTEGER REFERENCES outreach_drafts(id) ON DELETE SET NULL,
  recipient_phone VARCHAR(50) NOT NULL,
  template_name VARCHAR(255),
  template_data JSONB,
  status VARCHAR(50) DEFAULT 'pending' CHECK (status IN ('pending', 'sent', 'delivered', 'read', 'failed', 'unknown')),
  provider_message_id VARCHAR(255),
  error_details TEXT,
  dispatched_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_whatsapp_dispatches_status ON whatsapp_dispatches(status);
