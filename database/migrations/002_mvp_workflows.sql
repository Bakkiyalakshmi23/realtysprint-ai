-- MVP business workflows: proposals, won-client handover, delivery, and revenue.
ALTER TABLE leads DROP CONSTRAINT IF EXISTS leads_status_check;
ALTER TABLE leads ADD CONSTRAINT leads_status_check
  CHECK (status IN ('new', 'in_review', 'qualified', 'proposal', 'awaiting_approval', 'approved', 'won', 'handed_over', 'lost', 'rejected', 'archived'));

CREATE TABLE IF NOT EXISTS proposals (
  id           SERIAL PRIMARY KEY,
  lead_id      INTEGER NOT NULL REFERENCES leads(id) ON DELETE CASCADE,
  approval_id  INTEGER REFERENCES approvals(id) ON DELETE SET NULL,
  status       VARCHAR(40) NOT NULL DEFAULT 'draft'
               CHECK (status IN ('draft', 'pending_approval', 'approved', 'rejected', 'won', 'lost')),
  content      JSONB NOT NULL,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_proposals_lead_status ON proposals(lead_id, status);

CREATE TABLE IF NOT EXISTS clients (
  id             SERIAL PRIMARY KEY,
  lead_id        INTEGER NOT NULL UNIQUE REFERENCES leads(id) ON DELETE RESTRICT,
  company_id     INTEGER REFERENCES companies(id) ON DELETE SET NULL,
  contact_id     INTEGER REFERENCES contacts(id) ON DELETE SET NULL,
  status         VARCHAR(40) NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'paused', 'completed')),
  requirements   JSONB NOT NULL DEFAULT '[]',
  handed_over_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS projects (
  id          SERIAL PRIMARY KEY,
  client_id   INTEGER NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  title       VARCHAR(500) NOT NULL,
  status      VARCHAR(40) NOT NULL DEFAULT 'planned' CHECK (status IN ('planned', 'in_progress', 'blocked', 'at_risk', 'completed', 'cancelled')),
  risk_level  VARCHAR(20) NOT NULL DEFAULT 'low' CHECK (risk_level IN ('low', 'medium', 'high')),
  due_at      TIMESTAMPTZ,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_projects_client_status ON projects(client_id, status);

CREATE TABLE IF NOT EXISTS revenue_records (
  id                  SERIAL PRIMARY KEY,
  lead_id             INTEGER REFERENCES leads(id) ON DELETE SET NULL,
  client_id           INTEGER REFERENCES clients(id) ON DELETE SET NULL,
  amount              NUMERIC(14,2) NOT NULL CHECK (amount >= 0),
  currency            VARCHAR(3) NOT NULL DEFAULT 'INR',
  recognition_status  VARCHAR(20) NOT NULL DEFAULT 'expected' CHECK (recognition_status IN ('expected', 'actual')),
  received_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  notes               TEXT,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_revenue_records_recognition_date ON revenue_records(recognition_status, received_at);

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'set_updated_at' AND tgrelid = 'proposals'::regclass) THEN
    CREATE TRIGGER set_updated_at BEFORE UPDATE ON proposals FOR EACH ROW EXECUTE FUNCTION trigger_set_updated_at();
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'set_updated_at' AND tgrelid = 'projects'::regclass) THEN
    CREATE TRIGGER set_updated_at BEFORE UPDATE ON projects FOR EACH ROW EXECUTE FUNCTION trigger_set_updated_at();
  END IF;
END $$;
