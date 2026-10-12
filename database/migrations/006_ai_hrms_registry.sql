-- ============================================================
-- RealtySprint AI — Migration: 006_ai_hrms_registry.sql
-- Description: Extends the agents table for HRMS Registry
-- ============================================================

-- 1. Add HRMS columns to agents table
ALTER TABLE agents
  ADD COLUMN employee_id VARCHAR(50) UNIQUE,
  ADD COLUMN worker_type VARCHAR(50) DEFAULT 'ai_agent',
  ADD COLUMN department VARCHAR(255),
  ADD COLUMN reporting_manager VARCHAR(255) DEFAULT 'Founder',
  ADD COLUMN role VARCHAR(255),
  ADD COLUMN kpis JSONB DEFAULT '{}'::jsonb,
  ADD COLUMN responsibilities JSONB DEFAULT '[]'::jsonb,
  ADD COLUMN permissions JSONB DEFAULT '[]'::jsonb;

-- 2. Backfill existing agents safely
DO $$
DECLARE
  v_company_pa_id INTEGER;
  v_client_acq_id INTEGER;
BEGIN
  -- Verify expected slugs exist exactly once
  SELECT COUNT(id) INTO v_company_pa_id FROM agents WHERE slug = 'company-pa';
  IF v_company_pa_id != 1 THEN
    RAISE EXCEPTION 'Migration failed: Expected exactly 1 record for slug company-pa, found %', v_company_pa_id;
  END IF;

  SELECT COUNT(id) INTO v_client_acq_id FROM agents WHERE slug = 'client-acquisition';
  IF v_client_acq_id != 1 THEN
    RAISE EXCEPTION 'Migration failed: Expected exactly 1 record for slug client-acquisition, found %', v_client_acq_id;
  END IF;

  SELECT id INTO v_company_pa_id FROM agents WHERE slug = 'company-pa';
  SELECT id INTO v_client_acq_id FROM agents WHERE slug = 'client-acquisition';

  -- Verify employee IDs are not already in use
  IF EXISTS (SELECT 1 FROM agents WHERE employee_id IN ('AI-EMP-001', 'AI-EMP-002')) THEN
    RAISE EXCEPTION 'Migration failed: Employee IDs AI-EMP-001 or AI-EMP-002 are already in use.';
  END IF;

  -- Update Company PA
  UPDATE agents SET
    employee_id = 'AI-EMP-001',
    worker_type = 'ai_agent',
    department = 'Operations',
    role = 'Internal Operations Assistant',
    reporting_manager = 'Founder',
    responsibilities = '["Task Management", "KPI Monitoring", "Daily Reporting", "Follow-ups", "Workload Analysis", "Operational Insights"]'::jsonb,
    permissions = '["read_internal_data", "analyze_pipeline", "prepare_conversation"]'::jsonb
  WHERE id = v_company_pa_id;

  -- Update Client Acquisition
  UPDATE agents SET
    employee_id = 'AI-EMP-002',
    worker_type = 'ai_agent',
    department = 'Sales',
    role = 'Prospecting Assistant',
    reporting_manager = 'Founder',
    responsibilities = '["Prospect Research", "Lead Qualification", "Lead Scoring", "Company Research", "Outreach Drafts", "Pipeline Tracking"]'::jsonb,
    permissions = '["read_internal_data", "qualify_lead", "score_lead", "create_draft", "REQUIRES_APPROVAL:send_email", "REQUIRES_APPROVAL:send_proposal"]'::jsonb
  WHERE id = v_client_acq_id;
END $$;

-- 3. Enforce strictly NOT NULL constraints after backfilling
ALTER TABLE agents
  ALTER COLUMN worker_type SET NOT NULL,
  ADD CONSTRAINT chk_worker_type CHECK (worker_type = 'ai_agent');
