'use strict';

const { pool } = require('../db/pool');
const demoData = require('./demoData');

function numeric(value, fallback = 0) {
  const result = Number(value);
  return Number.isFinite(result) ? result : fallback;
}

async function getCompanySnapshot() {
  try {
    const result = await pool.query(`
      SELECT
        COALESCE((SELECT SUM(amount) FROM revenue_records WHERE currency = 'INR' AND recognition_status = 'actual' AND received_at::date = CURRENT_DATE), 0) AS revenue_today,
        COALESCE((SELECT SUM(amount) FROM revenue_records WHERE currency = 'INR' AND recognition_status = 'actual'), 0) AS revenue_actual,
        COALESCE((SELECT SUM(amount) FROM revenue_records WHERE currency = 'INR' AND recognition_status = 'expected'), 0) AS revenue_expected,
        (SELECT COUNT(*) FROM leads) AS leads_total,
        (SELECT COUNT(*) FROM leads WHERE status IN ('qualified','awaiting_approval','approved','proposal','won','handed_over')) AS leads_qualified,
        (SELECT COUNT(*) FROM leads WHERE status IN ('proposal','won','handed_over')) AS proposals,
        (SELECT COUNT(*) FROM leads WHERE status IN ('won','handed_over')) AS wins,
        (SELECT COUNT(*) FROM agent_tasks WHERE due_at < NOW() AND status NOT IN ('completed','cancelled')) AS tasks_overdue,
        (SELECT COUNT(*) FROM agent_tasks WHERE status = 'blocked') AS tasks_blocked,
        (SELECT COUNT(*) FROM projects WHERE status IN ('planned','in_progress','blocked','at_risk')) AS projects_active,
        (SELECT COUNT(*) FROM projects WHERE status = 'blocked') AS projects_blocked,
        (SELECT COUNT(*) FROM projects WHERE status = 'at_risk' OR risk_level = 'high') AS projects_at_risk,
        (SELECT COUNT(*) FROM proposals WHERE status IN ('draft','pending_approval')) AS proposals_pending,
        (SELECT COUNT(*) FROM agent_actions WHERE action_type = 'create_draft' AND created_at >= NOW() - INTERVAL '30 days') AS followups
    `);
    const row = result.rows[0];
    return {
      source: 'database', dataQuality: 'ACTUAL — INR-denominated amounts aggregated from connected database; other currencies excluded from INR target totals.', asOf: new Date().toISOString(),
      revenue: { todayActual: numeric(row.revenue_today), totalActual: numeric(row.revenue_actual), expected: numeric(row.revenue_expected), target: 5000000, currency: 'INR' },
      pipeline: { totalLeads: numeric(row.leads_total), qualified: numeric(row.leads_qualified), conversations: 0, proposals: numeric(row.proposals), wins: numeric(row.wins), followUps: numeric(row.followups), proposalsPending: numeric(row.proposals_pending) },
      delivery: { activeProjects: numeric(row.projects_active), overdue: numeric(row.tasks_overdue), blocked: numeric(row.tasks_blocked) + numeric(row.projects_blocked), atRisk: numeric(row.projects_at_risk) },
      blockers: [],
      overdueWork: [],
    };
  } catch {
    return demoData.getBusinessSnapshot();
  }
}

async function ensureAgent(client, slug) {
  if (!['company-pa', 'client-acquisition'].includes(slug)) throw new Error('Unknown agent.');
  const name = slug === 'company-pa' ? 'Company PA Agent' : 'Client Acquisition Agent';
  const result = await client.query(
    `INSERT INTO agents (name, slug, status, capabilities) VALUES ($1, $2, 'online', '[]'::jsonb)
     ON CONFLICT (slug) DO UPDATE SET status = 'online' RETURNING id`,
    [name, slug],
  );
  return result.rows[0].id;
}

async function recordExecution({ agentSlug, action, result, traceId }) {
  let runId = null;
  try {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      const agentId = await ensureAgent(client, agentSlug);
      const runStatus = result.status === 'failed' ? 'failed' : 'completed';
      const summary = { action, status: result.status, message: result.error || `${action} ${result.status}`, traceId };
      const run = await client.query(
        `INSERT INTO agent_runs (agent_id, status, completed_at, result_summary) VALUES ($1, $2, NOW(), $3::jsonb) RETURNING id`,
        [agentId, runStatus, JSON.stringify(summary)],
      );
      runId = run.rows[0].id;
      const actionStatus = result.status === 'failed' ? 'failed' : 'completed';
      await client.query(
        `INSERT INTO agent_actions (agent_run_id, action_type, action_status, output_data)
         VALUES ($1, $2, $3, $4::jsonb)`,
        [run.rows[0].id, action, actionStatus, JSON.stringify(result)],
      );

      if (result.status === 'pending_approval') {
        await client.query(
          `INSERT INTO approvals (agent_id, agent_run_id, action_type, description, status)
           VALUES ($1, $2, $3, $4, 'pending')`,
          [agentId, run.rows[0].id, action, `${action}: approval required. Draft was not sent.`],
        );
      }
      await client.query('COMMIT');
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
    return { source: 'database', runId };
  } catch {
    demoData.recordActivity({ agentSlug, action, status: result.status, message: result.error || `${action} ${result.status}`, traceId });
    if (result.status === 'pending_approval') {
      demoData.addApproval({
        agentId: agentSlug,
        agentName: agentSlug === 'company-pa' ? 'Company PA Agent' : 'Client Acquisition Agent',
        actionType: action,
        action,
        description: `${action}: approval required. Draft was not sent.`,
        riskLevel: 'medium',
        result: result.result,
      });
    }
    return { source: 'demo', runId: null };
  }
}

async function updateLeadQualification(lead, qualification) {
  const id = typeof lead === 'object' ? lead.id : null;
  const company = typeof lead === 'object' ? lead.company || lead.name : lead;
  if (/^\d+$/.test(String(id || ''))) {
    try {
      const result = await pool.query(
        `UPDATE leads SET score = $1, qualification = $2::jsonb, status = $3
         WHERE id = $4 RETURNING id, status, score`,
        [qualification.score, JSON.stringify(qualification), qualification.qualification === 'qualified' ? 'qualified' : 'in_review', Number(id)],
      );
      if (result.rows[0]) return { ...result.rows[0], source: 'database' };
    } catch { /* Fall back to the deterministic demo lead record. */ }
  }
  const demoLead = demoData.updateLeadQualification(id || company, qualification);
  return demoLead ? { ...demoLead, source: 'demo' } : null;
}

async function persistProposal({ agentSlug, agentRunId, lead, content }) {
  const company = typeof lead === 'string' ? lead : lead?.company || lead?.name;
  try {
    const agentResult = await pool.query('SELECT id FROM agents WHERE slug = $1', [agentSlug]);
    const leadResult = await pool.query(
      `SELECT l.id FROM leads l LEFT JOIN companies c ON c.id = l.company_id
       WHERE ($1::integer IS NOT NULL AND l.id = $1) OR ($2::text IS NOT NULL AND c.name = $2)
       ORDER BY l.id LIMIT 1`,
      [/^\d+$/.test(String(lead?.id || '')) ? Number(lead.id) : null, company || null],
    );
    if (!agentResult.rows[0] || !leadResult.rows[0]) throw new Error('No persisted lead match.');
    const proposal = await pool.query(
      `INSERT INTO proposals (lead_id, status, content) VALUES ($1, 'pending_approval', $2::jsonb) RETURNING id`,
      [leadResult.rows[0].id, JSON.stringify(content)],
    );
    const approval = await pool.query(
      `INSERT INTO approvals (agent_id, agent_run_id, action_type, description, status)
       VALUES ($1, $2, 'approve_proposal', $3, 'pending') RETURNING id`,
      [agentResult.rows[0].id, agentRunId || null, `Review proposal draft for ${company || 'prospect'}. No message has been sent.`],
    );
    await pool.query(`UPDATE proposals SET approval_id = $1 WHERE id = $2`, [approval.rows[0].id, proposal.rows[0].id]);
    return { id: proposal.rows[0].id, approvalId: approval.rows[0].id, source: 'database' };
  } catch {
    const proposal = demoData.saveProposal({ agentId: agentSlug, lead: company || 'Demo prospect', content });
    const approval = demoData.addApproval({
      agentId: agentSlug,
      agentName: 'Client Acquisition Agent',
      actionType: 'approve_proposal',
      action: 'approve_proposal',
      description: `Review proposal draft for ${company || 'prospect'}. No message has been sent.`,
      riskLevel: 'medium',
      result: content,
    });
    proposal.approvalId = approval.id;
    return { id: proposal.id, approvalId: approval.id, source: 'demo' };
  }
}

async function reviewApproval(id, decision) {
  const nextStatus = decision === 'approve' ? 'approved' : 'rejected';
  if (/^\d+$/.test(String(id))) {
    try {
      const result = await pool.query(
        `UPDATE approvals SET status = $1, reviewed_at = NOW(), review_notes = $2
         WHERE id = $3 AND status = 'pending' RETURNING id, status, action_type AS "actionType", reviewed_at AS "reviewedAt"`,
        [nextStatus, 'Reviewed by Founder in RealtySprint AI dashboard. Approval does not send external communication.', Number(id)],
      );
      if (result.rows[0]) {
        await pool.query('UPDATE proposals SET status = $1 WHERE approval_id = $2', [nextStatus, Number(id)]);
        return { ...result.rows[0], source: 'database', communicationSent: false };
      }
    } catch { /* Continue with the local DEMO queue when DB is unavailable. */ }
  }
  const saved = demoData.reviewApproval(id, nextStatus);
  return saved ? { ...saved, source: 'demo' } : null;
}

async function handoverWonLead(id, { projectTitle, requirements, amount, currency = 'INR', founderConfirmedWon = false }) {
  if (/^\d+$/.test(String(id))) {
    let client;
    try {
      client = await pool.connect();
      await client.query('BEGIN');
      const leadResult = await client.query(
        `SELECT l.id, l.status, l.company_id AS "companyId", l.contact_id AS "contactId", c.name AS company
         FROM leads l LEFT JOIN companies c ON c.id = l.company_id WHERE l.id = $1 FOR UPDATE OF l`, [Number(id)],
      );
      let lead = leadResult.rows[0];
      if (lead && lead.status === 'handed_over') {
        const existing = await client.query(
          `SELECT cl.id AS "clientId", p.id AS "projectId", t.id AS "taskId", r.id AS "revenueId", r.amount, r.currency
           FROM clients cl LEFT JOIN projects p ON p.client_id = cl.id
           LEFT JOIN agent_tasks t ON t.title = $2
           LEFT JOIN revenue_records r ON r.client_id = cl.id
           WHERE cl.lead_id = $1 ORDER BY p.id DESC, r.id DESC LIMIT 1`,
          [lead.id, `Kick off delivery: ${projectTitle}`],
        );
        await client.query('ROLLBACK');
        return { source: 'database', leadId: lead.id, ...(existing.rows[0] || {}), alreadyHandedOver: true };
      }
      if (lead && !founderConfirmedWon && lead.status !== 'won') {
        await client.query('ROLLBACK');
        return { error: 'Founder confirmation that the client is won is required.', status: 409 };
      }
      if (lead) {
        if (lead.status !== 'won') {
          await client.query(`UPDATE leads SET status = 'won' WHERE id = $1`, [lead.id]);
          lead.status = 'won';
        }
        let clientResult = await client.query(
          `INSERT INTO clients (lead_id, company_id, contact_id, requirements)
           VALUES ($1, $2, $3, $4::jsonb) ON CONFLICT (lead_id) DO UPDATE SET lead_id = EXCLUDED.lead_id RETURNING id`,
          [lead.id, lead.companyId, lead.contactId, JSON.stringify(requirements)],
        );
        const clientId = clientResult.rows[0].id;
        const project = await client.query(
          `INSERT INTO projects (client_id, title, status, risk_level) VALUES ($1, $2, 'planned', 'low') RETURNING id`,
          [clientId, projectTitle],
        );
        const agentId = await ensureAgent(client, 'company-pa');
        const task = await client.query(
          `INSERT INTO agent_tasks (agent_id, title, description, status, priority)
           VALUES ($1, $2, $3, 'pending', 'high') RETURNING id, title, status`,
          [agentId, `Kick off delivery: ${projectTitle}`, `Review handover requirements for ${lead.company || 'new client'} and set the first delivery milestone.`],
        );
        const revenue = await client.query(
          `INSERT INTO revenue_records (lead_id, client_id, amount, currency, recognition_status, notes)
           VALUES ($1, $2, $3, $4, 'expected', 'Expected contract value; not recorded as received revenue.') RETURNING id, amount, currency, recognition_status AS "recognitionStatus"`,
          [lead.id, clientId, amount, currency],
        );
        await client.query(`UPDATE leads SET status = 'handed_over' WHERE id = $1`, [lead.id]);
        await client.query('COMMIT');
        return { source: 'database', leadId: lead.id, clientId, projectId: project.rows[0].id, task: task.rows[0], revenue: revenue.rows[0] };
      }
      await client.query('ROLLBACK');
    } catch {
      if (client) { try { await client.query('ROLLBACK'); } catch { /* ignored */ } }
    } finally {
      client?.release();
    }
  }
  const demoResult = demoData.handoverLead(id, { projectTitle, requirements, amount, currency, founderConfirmedWon });
  if (!demoResult) return { error: 'Won lead not found.', status: 404 };
  if (demoResult.error) return demoResult;
  return { source: 'demo', ...demoResult };
}

module.exports = { getCompanySnapshot, recordExecution, updateLeadQualification, persistProposal, reviewApproval, handoverWonLead };
