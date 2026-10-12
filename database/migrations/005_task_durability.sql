-- ────────────────────────────────────────────────────────────
-- Migration 005: Task Durability, Retry and Recovery
-- ────────────────────────────────────────────────────────────

-- 1. Add durability and retry tracking columns to agent_tasks
ALTER TABLE agent_tasks
  ADD COLUMN IF NOT EXISTS attempts INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS max_attempts INTEGER NOT NULL DEFAULT 3,
  ADD COLUMN IF NOT EXISTS last_error TEXT,
  ADD COLUMN IF NOT EXISTS next_retry_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS locked_until TIMESTAMPTZ;

-- 2. Expand status constraint to include retry and recovery states
ALTER TABLE agent_tasks DROP CONSTRAINT IF EXISTS agent_tasks_status_check;

ALTER TABLE agent_tasks ADD CONSTRAINT agent_tasks_status_check
  CHECK (status IN (
    'pending',
    'in_progress',
    'completed',
    'failed',
    'awaiting_approval',
    'cancelled',
    'retry_scheduled',
    'awaiting_input',
    'permanent_failure',
    'manual_reconciliation'
  ));

CREATE INDEX IF NOT EXISTS idx_agent_tasks_retry ON agent_tasks (status, next_retry_at) WHERE status = 'retry_scheduled';
CREATE INDEX IF NOT EXISTS idx_agent_tasks_locked ON agent_tasks (status, locked_until) WHERE status = 'in_progress';
