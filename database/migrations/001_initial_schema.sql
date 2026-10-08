-- ============================================================
-- RealtySprint AI — Step 5B
-- Migration: 001_initial_schema.sql
-- Creates all 13 core tables for the two-agent AI system.
-- ============================================================

-- ────────────────────────────────────────────────────────────
-- 1. USERS
-- ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS users (
  id           SERIAL        PRIMARY KEY,
  name         VARCHAR(255)  NOT NULL,
  email        VARCHAR(255)  NOT NULL UNIQUE,
  password_hash VARCHAR(255) NOT NULL,
  role         VARCHAR(50)   NOT NULL DEFAULT 'user'
                             CHECK (role IN ('admin', 'user', 'viewer')),
  created_at   TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  updated_at   TIMESTAMPTZ   NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_users_email ON users (email);

-- ────────────────────────────────────────────────────────────
-- 2. AGENTS
-- ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS agents (
  id           SERIAL        PRIMARY KEY,
  name         VARCHAR(255)  NOT NULL,
  slug         VARCHAR(100)  NOT NULL UNIQUE,
  description  TEXT,
  status       VARCHAR(50)   NOT NULL DEFAULT 'offline'
                             CHECK (status IN ('online', 'offline', 'paused', 'error')),
  capabilities JSONB         NOT NULL DEFAULT '[]',
  created_at   TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  updated_at   TIMESTAMPTZ   NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_agents_slug   ON agents (slug);
CREATE INDEX IF NOT EXISTS idx_agents_status ON agents (status);

-- ────────────────────────────────────────────────────────────
-- 3. AGENT_TASKS
-- ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS agent_tasks (
  id          SERIAL        PRIMARY KEY,
  agent_id    INTEGER       NOT NULL REFERENCES agents (id) ON DELETE CASCADE,
  title       VARCHAR(500)  NOT NULL,
  description TEXT,
  status      VARCHAR(50)   NOT NULL DEFAULT 'pending'
                            CHECK (status IN ('pending', 'in_progress', 'completed', 'failed', 'awaiting_approval', 'cancelled')),
  priority    VARCHAR(20)   NOT NULL DEFAULT 'normal'
                            CHECK (priority IN ('low', 'normal', 'medium', 'high', 'critical')),
  assigned_to VARCHAR(255),
  due_at      TIMESTAMPTZ,
  created_at  TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ   NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_agent_tasks_agent_id ON agent_tasks (agent_id);
CREATE INDEX IF NOT EXISTS idx_agent_tasks_status   ON agent_tasks (status);
CREATE INDEX IF NOT EXISTS idx_agent_tasks_priority ON agent_tasks (priority);

-- ────────────────────────────────────────────────────────────
-- 4. AGENT_RUNS
-- ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS agent_runs (
  id             SERIAL       PRIMARY KEY,
  agent_id       INTEGER      NOT NULL REFERENCES agents (id) ON DELETE CASCADE,
  task_id        INTEGER      REFERENCES agent_tasks (id) ON DELETE SET NULL,
  status         VARCHAR(50)  NOT NULL DEFAULT 'running'
                              CHECK (status IN ('running', 'completed', 'failed', 'cancelled')),
  started_at     TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  completed_at   TIMESTAMPTZ,
  error_message  TEXT,
  result_summary JSONB
);

CREATE INDEX IF NOT EXISTS idx_agent_runs_agent_id ON agent_runs (agent_id);
CREATE INDEX IF NOT EXISTS idx_agent_runs_task_id  ON agent_runs (task_id);
CREATE INDEX IF NOT EXISTS idx_agent_runs_status   ON agent_runs (status);

-- ────────────────────────────────────────────────────────────
-- 5. AGENT_ACTIONS
-- ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS agent_actions (
  id           SERIAL       PRIMARY KEY,
  agent_run_id INTEGER      NOT NULL REFERENCES agent_runs (id) ON DELETE CASCADE,
  action_type  VARCHAR(100) NOT NULL,
  action_status VARCHAR(50) NOT NULL DEFAULT 'pending'
                            CHECK (action_status IN ('pending', 'running', 'completed', 'failed', 'skipped')),
  input_data   JSONB,
  output_data  JSONB,
  created_at   TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_agent_actions_run_id ON agent_actions (agent_run_id);

-- ────────────────────────────────────────────────────────────
-- 6. APPROVALS
-- ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS approvals (
  id           SERIAL       PRIMARY KEY,
  agent_id     INTEGER      NOT NULL REFERENCES agents (id) ON DELETE CASCADE,
  agent_run_id INTEGER      REFERENCES agent_runs (id) ON DELETE SET NULL,
  action_type  VARCHAR(100) NOT NULL,
  description  TEXT         NOT NULL,
  status       VARCHAR(50)  NOT NULL DEFAULT 'pending'
                            CHECK (status IN ('pending', 'approved', 'rejected', 'expired')),
  requested_at TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  reviewed_at  TIMESTAMPTZ,
  reviewed_by  INTEGER      REFERENCES users (id) ON DELETE SET NULL,
  review_notes TEXT
);

CREATE INDEX IF NOT EXISTS idx_approvals_agent_id ON approvals (agent_id);
CREATE INDEX IF NOT EXISTS idx_approvals_status   ON approvals (status);

-- ────────────────────────────────────────────────────────────
-- 7. COMPANIES
-- ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS companies (
  id         SERIAL       PRIMARY KEY,
  name       VARCHAR(255) NOT NULL,
  website    VARCHAR(500),
  location   VARCHAR(255),
  industry   VARCHAR(100),
  created_at TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_companies_name ON companies (name);

-- ────────────────────────────────────────────────────────────
-- 8. CONTACTS
-- ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS contacts (
  id           SERIAL       PRIMARY KEY,
  company_id   INTEGER      REFERENCES companies (id) ON DELETE SET NULL,
  name         VARCHAR(255) NOT NULL,
  email        VARCHAR(255),
  phone        VARCHAR(50),
  job_title    VARCHAR(255),
  linkedin_url VARCHAR(500),
  created_at   TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  updated_at   TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_contacts_company_id ON contacts (company_id);
CREATE INDEX IF NOT EXISTS idx_contacts_email      ON contacts (email);

-- ────────────────────────────────────────────────────────────
-- 9. LEADS
-- ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS leads (
  id            SERIAL       PRIMARY KEY,
  company_id    INTEGER      REFERENCES companies (id) ON DELETE SET NULL,
  contact_id    INTEGER      REFERENCES contacts (id) ON DELETE SET NULL,
  source        VARCHAR(100),
  status        VARCHAR(50)  NOT NULL DEFAULT 'new'
                             CHECK (status IN ('new', 'in_review', 'qualified', 'awaiting_approval', 'approved', 'rejected', 'archived')),
  score         SMALLINT     CHECK (score BETWEEN 0 AND 100),
  qualification JSONB,
  notes         TEXT,
  created_at    TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_leads_company_id ON leads (company_id);
CREATE INDEX IF NOT EXISTS idx_leads_contact_id ON leads (contact_id);
CREATE INDEX IF NOT EXISTS idx_leads_status     ON leads (status);
CREATE INDEX IF NOT EXISTS idx_leads_score      ON leads (score);

-- ────────────────────────────────────────────────────────────
-- 10. OUTREACH_DRAFTS
-- ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS outreach_drafts (
  id         SERIAL       PRIMARY KEY,
  lead_id    INTEGER      NOT NULL REFERENCES leads (id) ON DELETE CASCADE,
  channel    VARCHAR(50)  NOT NULL DEFAULT 'email'
                          CHECK (channel IN ('email', 'whatsapp', 'linkedin', 'sms', 'other')),
  subject    VARCHAR(500),
  message    TEXT         NOT NULL,
  status     VARCHAR(50)  NOT NULL DEFAULT 'draft'
                          CHECK (status IN ('draft', 'awaiting_approval', 'approved', 'sent', 'rejected')),
  created_at TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_outreach_drafts_lead_id ON outreach_drafts (lead_id);
CREATE INDEX IF NOT EXISTS idx_outreach_drafts_status  ON outreach_drafts (status);

-- ────────────────────────────────────────────────────────────
-- 11. SCHEDULES
-- ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS schedules (
  id              SERIAL       PRIMARY KEY,
  agent_id        INTEGER      NOT NULL REFERENCES agents (id) ON DELETE CASCADE,
  name            VARCHAR(255) NOT NULL,
  schedule_type   VARCHAR(50)  NOT NULL DEFAULT 'cron'
                               CHECK (schedule_type IN ('cron', 'interval', 'once')),
  cron_expression VARCHAR(100),
  enabled         BOOLEAN      NOT NULL DEFAULT TRUE,
  created_at      TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_schedules_agent_id ON schedules (agent_id);
CREATE INDEX IF NOT EXISTS idx_schedules_enabled  ON schedules (enabled);

-- ────────────────────────────────────────────────────────────
-- 12. NOTIFICATIONS
-- ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS notifications (
  id         SERIAL       PRIMARY KEY,
  user_id    INTEGER      REFERENCES users (id) ON DELETE CASCADE,
  type       VARCHAR(50)  NOT NULL DEFAULT 'info'
                          CHECK (type IN ('info', 'success', 'warning', 'error', 'approval_request')),
  title      VARCHAR(255) NOT NULL,
  message    TEXT         NOT NULL,
  read_at    TIMESTAMPTZ,
  created_at TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_notifications_user_id ON notifications (user_id);
CREATE INDEX IF NOT EXISTS idx_notifications_read_at ON notifications (read_at);

-- ────────────────────────────────────────────────────────────
-- 13. ERRORS
-- ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS errors (
  id           SERIAL       PRIMARY KEY,
  agent_id     INTEGER      REFERENCES agents (id) ON DELETE SET NULL,
  agent_run_id INTEGER      REFERENCES agent_runs (id) ON DELETE SET NULL,
  error_type   VARCHAR(100) NOT NULL,
  message      TEXT         NOT NULL,
  stack_trace  TEXT,
  created_at   TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_errors_agent_id     ON errors (agent_id);
CREATE INDEX IF NOT EXISTS idx_errors_agent_run_id ON errors (agent_run_id);
CREATE INDEX IF NOT EXISTS idx_errors_created_at   ON errors (created_at);

-- ────────────────────────────────────────────────────────────
-- Trigger function: auto-update updated_at
-- ────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION trigger_set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DO $$
DECLARE
  tbl TEXT;
BEGIN
  FOREACH tbl IN ARRAY ARRAY[
    'users','agents','agent_tasks','companies','contacts',
    'leads','outreach_drafts','schedules'
  ] LOOP
    EXECUTE format(
      'DROP TRIGGER IF EXISTS set_updated_at ON %I;
       CREATE TRIGGER set_updated_at BEFORE UPDATE ON %I
       FOR EACH ROW EXECUTE FUNCTION trigger_set_updated_at();', tbl, tbl
    );
  END LOOP;
END;
$$;
