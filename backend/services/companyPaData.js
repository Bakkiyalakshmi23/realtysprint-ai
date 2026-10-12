const { pool } = require('../db/pool');

const REVENUE_TARGET_INR = 5_000_000;

function toNumber(value) {
  if (value === null || value === undefined || value === '') return null;

  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

function sum(values) {
  return values.reduce((total, value) => {
    const number = toNumber(value);
    return total + (number ?? 0);
  }, 0);
}

function countBy(rows, field) {
  return rows.reduce((result, row) => {
    const key = row[field] ?? 'unknown';
    result[key] = (result[key] || 0) + 1;
    return result;
  }, {});
}

function isToday(value, now) {
  if (!value) return false;

  const date = new Date(value);

  return (
    date.getFullYear() === now.getFullYear() &&
    date.getMonth() === now.getMonth() &&
    date.getDate() === now.getDate()
  );
}

function isOverdue(value, now) {
  if (!value) return false;
  return new Date(value).getTime() < now.getTime();
}

function daysSince(value, now) {
  if (!value) return null;

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) return null;

  return Math.floor(
    (now.getTime() - date.getTime()) / (24 * 60 * 60 * 1000)
  );
}

function currencyTotals(rows, amountField = 'amount') {
  const result = {};

  for (const row of rows) {
    const currency = row.currency || 'UNKNOWN';
    const amount = toNumber(row[amountField]);

    if (amount === null) continue;

    result[currency] = (result[currency] || 0) + amount;
  }

  return result;
}

async function query(sql, params = []) {
  const result = await pool.query(sql, params);
  return result.rows;
}

async function getRevenue(now) {
  const rows = await query(`
    SELECT
      id,
      lead_id,
      client_id,
      amount,
      currency,
      recognition_status,
      received_at,
      notes,
      created_at
    FROM revenue_records
    ORDER BY received_at DESC NULLS LAST, created_at DESC
  `);

  const actualINR = sum(
    rows
      .filter(
        row =>
          row.recognition_status === 'actual' &&
          String(row.currency || '').toUpperCase() === 'INR'
      )
      .map(row => row.amount)
  );

  const expectedINR = sum(
    rows
      .filter(
        row =>
          row.recognition_status === 'expected' &&
          String(row.currency || '').toUpperCase() === 'INR'
      )
      .map(row => row.amount)
  );

  const actualByCurrency = currencyTotals(
    rows.filter(row => row.recognition_status === 'actual')
  );

  const expectedByCurrency = currencyTotals(
    rows.filter(row => row.recognition_status === 'expected')
  );

  const remainingTarget = Math.max(REVENUE_TARGET_INR - actualINR, 0);

  const revenueGap = Math.max(
    REVENUE_TARGET_INR - actualINR - expectedINR,
    0
  );

  const progressPercent =
    REVENUE_TARGET_INR > 0
      ? Number(((actualINR / REVENUE_TARGET_INR) * 100).toFixed(2))
      : null;

  const todayRevenue = sum(
    rows
      .filter(
        row =>
          row.recognition_status === 'actual' &&
          String(row.currency || '').toUpperCase() === 'INR' &&
          isToday(row.received_at || row.created_at, now)
      )
      .map(row => row.amount)
  );

  return {
    target: REVENUE_TARGET_INR,
    targetCurrency: 'INR',

    actual: actualINR,
    expected: expectedINR,

    remainingTarget,
    revenueGap,
    progressPercent,

    todayRevenue,

    actualByCurrency,
    expectedByCurrency,

    recordCount: rows.length,

    recentRecords: rows.slice(0, 20).map(row => ({
      id: row.id,
      leadId: row.lead_id,
      clientId: row.client_id,
      amount: toNumber(row.amount),
      currency: row.currency,
      recognitionStatus: row.recognition_status,
      receivedAt: row.received_at,
      notes: row.notes
    }))
  };
}

async function getLeads() {
  const rows = await query(`
    SELECT
      id,
      company_id,
      contact_id,
      source,
      status,
      score,
      qualification,
      notes,
      created_at,
      updated_at
    FROM leads
    ORDER BY created_at DESC
  `);

  const scores = rows
    .map(row => toNumber(row.score))
    .filter(value => value !== null);

  const averageScore =
    scores.length > 0
      ? Number((sum(scores) / scores.length).toFixed(2))
      : null;

  return {
    total: rows.length,
    byStatus: countBy(rows, 'status'),
    averageScore,

    qualified: rows.filter(row => row.status === 'qualified').length,
    proposals: rows.filter(row => row.status === 'proposal').length,
    won: rows.filter(row => row.status === 'won').length,
    lost: rows.filter(row => row.status === 'lost').length,

    recent: rows.slice(0, 20).map(row => ({
      id: row.id,
      companyId: row.company_id,
      contactId: row.contact_id,
      source: row.source,
      status: row.status,
      score: toNumber(row.score),
      qualification: row.qualification,
      notes: row.notes,
      createdAt: row.created_at,
      updatedAt: row.updated_at
    }))
  };
}

async function getProposals() {
  const rows = await query(`
    SELECT
      id,
      lead_id,
      approval_id,
      status,
      content,
      created_at,
      updated_at
    FROM proposals
    ORDER BY created_at DESC
  `);

  return {
    total: rows.length,
    byStatus: countBy(rows, 'status'),

    recent: rows.slice(0, 20).map(row => ({
      id: row.id,
      leadId: row.lead_id,
      approvalId: row.approval_id,
      status: row.status,
      content: row.content,
      createdAt: row.created_at,
      updatedAt: row.updated_at
    }))
  };
}

async function getClients() {
  const rows = await query(`
    SELECT
      c.id,
      c.lead_id,
      c.company_id,
      c.contact_id,
      c.status,
      c.requirements,
      c.handed_over_at,
      c.created_at,

      co.name AS company_name,
      co.website AS company_website,
      co.location AS company_location,
      co.industry AS company_industry,

      ct.name AS contact_name,
      ct.email AS contact_email,
      ct.phone AS contact_phone,
      ct.job_title AS contact_job_title,

      l.status AS lead_status,
      l.score AS lead_score
    FROM clients c
    LEFT JOIN companies co ON co.id = c.company_id
    LEFT JOIN contacts ct ON ct.id = c.contact_id
    LEFT JOIN leads l ON l.id = c.lead_id
    ORDER BY c.created_at DESC
  `);

  return {
    total: rows.length,

    byStatus: countBy(rows, 'status'),

    active: rows.filter(row => row.status === 'active').length,
    paused: rows.filter(row => row.status === 'paused').length,
    completed: rows.filter(row => row.status === 'completed').length,

    recent: rows.slice(0, 20).map(row => ({
      id: row.id,
      leadId: row.lead_id,
      companyId: row.company_id,
      contactId: row.contact_id,
      status: row.status,
      requirements: row.requirements,
      handedOverAt: row.handed_over_at,
      createdAt: row.created_at,

      company: {
        name: row.company_name,
        website: row.company_website,
        location: row.company_location,
        industry: row.company_industry
      },

      contact: {
        name: row.contact_name,
        email: row.contact_email,
        phone: row.contact_phone,
        jobTitle: row.contact_job_title
      },

      lead: {
        status: row.lead_status,
        score: toNumber(row.lead_score)
      }
    }))
  };
}

async function getPipeline(now) {
  const rows = await query(`
    SELECT
      cp.id,
      cp.client_id,
      cp.stage,
      cp.expected_revenue,
      cp.currency,
      cp.probability,
      cp.next_action,
      cp.next_action_at,
      cp.created_at,
      cp.updated_at,

      co.name AS company_name
    FROM client_pipeline cp
    LEFT JOIN clients c ON c.id = cp.client_id
    LEFT JOIN companies co ON co.id = c.company_id
    ORDER BY cp.updated_at DESC
  `);

  const weightedINR = sum(
    rows
      .filter(row => String(row.currency || '').toUpperCase() === 'INR')
      .map(row => {
        const revenue = toNumber(row.expected_revenue);
        const probability = toNumber(row.probability);

        if (revenue === null || probability === null) return 0;

        return revenue * (probability / 100);
      })
  );

  const expectedINR = sum(
    rows
      .filter(row => String(row.currency || '').toUpperCase() === 'INR')
      .map(row => row.expected_revenue)
  );

  const probabilities = rows
    .map(row => toNumber(row.probability))
    .filter(value => value !== null);

  const averageProbability =
    probabilities.length > 0
      ? Number((sum(probabilities) / probabilities.length).toFixed(2))
      : null;

  const overdueNextActions = rows.filter(
    row => row.next_action_at && isOverdue(row.next_action_at, now)
  );

  const withoutNextAction = rows.filter(
    row => !row.next_action || !String(row.next_action).trim()
  );

  return {
    total: rows.length,

    byStage: countBy(rows, 'stage'),

    expectedByCurrency: currencyTotals(rows, 'expected_revenue'),

    expectedINR,
    weightedINR,
    averageProbability,

    overdueNextActions: overdueNextActions.length,
    withoutNextAction: withoutNextAction.length,

    records: rows.slice(0, 50).map(row => ({
      id: row.id,
      clientId: row.client_id,
      companyName: row.company_name,
      stage: row.stage,
      expectedRevenue: toNumber(row.expected_revenue),
      currency: row.currency,
      probability: toNumber(row.probability),
      nextAction: row.next_action,
      nextActionAt: row.next_action_at,
      overdue: Boolean(
        row.next_action_at && isOverdue(row.next_action_at, now)
      )
    }))
  };
}

async function getRequirements(now) {
  const rows = await query(`
    SELECT
      id,
      client_id,
      requirement,
      priority,
      budget,
      currency,
      timeline,
      status,
      created_at,
      updated_at
    FROM client_requirements
    ORDER BY updated_at DESC
  `);

  return {
    total: rows.length,

    open: rows.filter(row => row.status === 'open').length,

    highPriority: rows.filter(
      row => String(row.priority || '').toLowerCase() === 'high'
    ).length,

    byCurrency: currencyTotals(rows, 'budget'),

    oldOpen: rows
      .filter(
        row =>
          row.status === 'open' &&
          daysSince(row.created_at, now) !== null &&
          daysSince(row.created_at, now) >= 14
      )
      .map(row => ({
        id: row.id,
        clientId: row.client_id,
        requirement: row.requirement,
        priority: row.priority,
        budget: toNumber(row.budget),
        currency: row.currency,
        timeline: row.timeline,
        ageDays: daysSince(row.created_at, now)
      })),

    recent: rows.slice(0, 20).map(row => ({
      id: row.id,
      clientId: row.client_id,
      requirement: row.requirement,
      priority: row.priority,
      budget: toNumber(row.budget),
      currency: row.currency,
      timeline: row.timeline,
      status: row.status,
      createdAt: row.created_at,
      updatedAt: row.updated_at
    }))
  };
}

async function getInteractions() {
  const rows = await query(`
    SELECT
      id,
      client_id,
      contact_id,
      channel,
      direction,
      interaction_type,
      content,
      status,
      requires_approval,
      created_by,
      created_at
    FROM client_interactions
    ORDER BY created_at DESC
  `);

  return {
    total: rows.length,

    byChannel: countBy(rows, 'channel'),
    byDirection: countBy(rows, 'direction'),

    requiringApproval: rows.filter(
      row => row.requires_approval === true
    ).length,

    recent: rows.slice(0, 20).map(row => ({
      id: row.id,
      clientId: row.client_id,
      contactId: row.contact_id,
      channel: row.channel,
      direction: row.direction,
      interactionType: row.interaction_type,
      content: row.content,
      status: row.status,
      requiresApproval: row.requires_approval,
      createdBy: row.created_by,
      createdAt: row.created_at
    }))
  };
}

async function getSources() {
  const rows = await query(`
    SELECT
      id,
      client_id,
      source_type,
      source_reference,
      discovered_at
    FROM client_sources
    ORDER BY discovered_at DESC
  `);

  return {
    total: rows.length,
    bySource: countBy(rows, 'source_type'),

    recent: rows.slice(0, 20).map(row => ({
      id: row.id,
      clientId: row.client_id,
      sourceType: row.source_type,
      sourceReference: row.source_reference,
      discoveredAt: row.discovered_at
    }))
  };
}

async function getDeduplication() {
  const rows = await query(`
    SELECT
      id,
      client_id,
      possible_duplicate_client_id,
      match_type,
      match_score,
      status,
      reviewed_by,
      reviewed_at,
      created_at
    FROM dedupe_candidates
    ORDER BY created_at DESC
  `);

  const scores = rows
    .map(row => toNumber(row.match_score))
    .filter(value => value !== null);

  return {
    total: rows.length,

    byStatus: countBy(rows, 'status'),

    pendingReview: rows.filter(
      row => row.status === 'pending_review'
    ).length,

    reviewed: rows.filter(
      row => row.status !== 'pending_review'
    ).length,

    highMatchScore: rows.filter(row => {
      const score = toNumber(row.match_score);
      return score !== null && score >= 80;
    }).length,

    candidates: rows.slice(0, 20).map(row => ({
      id: row.id,
      clientId: row.client_id,
      possibleDuplicateClientId: row.possible_duplicate_client_id,
      matchType: row.match_type,
      matchScore: toNumber(row.match_score),
      status: row.status,
      reviewedBy: row.reviewed_by,
      reviewedAt: row.reviewed_at,
      createdAt: row.created_at
    })),

    averageMatchScore:
      scores.length > 0
        ? Number((sum(scores) / scores.length).toFixed(2))
        : null
  };
}

async function getMergeHistory() {
  const rows = await query(`
    SELECT
      id,
      canonical_client_id,
      merged_client_id,
      reason,
      merged_by,
      metadata,
      created_at
    FROM client_merge_history
    ORDER BY created_at DESC
  `);

  return {
    total: rows.length,

    recent: rows.slice(0, 20).map(row => ({
      id: row.id,
      canonicalClientId: row.canonical_client_id,
      mergedClientId: row.merged_client_id,
      reason: row.reason,
      mergedBy: row.merged_by,
      metadata: row.metadata,
      createdAt: row.created_at
    }))
  };
}

async function getActivity() {
  const rows = await query(`
    SELECT
      id,
      client_id,
      actor_type,
      actor_id,
      action,
      description,
      metadata,
      created_at
    FROM client_activity
    ORDER BY created_at DESC
    LIMIT 100
  `);

  return {
    totalRecent: rows.length,

    byAction: countBy(rows, 'action'),

    recent: rows.map(row => ({
      id: row.id,
      clientId: row.client_id,
      actorType: row.actor_type,
      actorId: row.actor_id,
      action: row.action,
      description: row.description,
      metadata: row.metadata,
      createdAt: row.created_at
    }))
  };
}

async function getAgents() {
  const rows = await query(`
    SELECT
      id,
      name,
      slug,
      description,
      status,
      capabilities,
      created_at,
      updated_at
    FROM agents
    ORDER BY id
  `);

  return {
    total: rows.length,

    active: rows.filter(row => row.status === 'active').length,

    byStatus: countBy(rows, 'status'),

    list: rows.map(row => ({
      id: row.id,
      name: row.name,
      slug: row.slug,
      description: row.description,
      status: row.status,
      capabilities: row.capabilities
    }))
  };
}

async function getTasks(now) {
  const rows = await query(`
    SELECT
      id,
      agent_id,
      title,
      description,
      status,
      priority,
      assigned_to,
      due_at,
      created_at,
      updated_at
    FROM agent_tasks
    ORDER BY created_at DESC
  `);

  const completed = rows.filter(row => row.status === 'completed');

  const overdue = rows.filter(
    row =>
      row.due_at &&
      isOverdue(row.due_at, now) &&
      row.status !== 'completed'
  );

  const dueToday = rows.filter(
    row =>
      row.due_at &&
      isToday(row.due_at, now) &&
      row.status !== 'completed'
  );

  return {
    total: rows.length,

    byStatus: countBy(rows, 'status'),
    byPriority: countBy(rows, 'priority'),

    pending: rows.filter(
      row =>
        row.status === 'pending' ||
        row.status === 'open' ||
        row.status === 'retry_scheduled'
    ).length,

    inProgress: rows.filter(
      row => row.status === 'in_progress'
    ).length,

    completed: completed.length,
    blocked: rows.filter(row => row.status === 'blocked').length,
    permanentFailure: rows.filter(row => row.status === 'permanent_failure').length,

    overdue: overdue.length,
    dueToday: dueToday.length,

    overdueTasks: overdue.slice(0, 20).map(row => ({
      id: row.id,
      agentId: row.agent_id,
      title: row.title,
      status: row.status,
      priority: row.priority,
      assignedTo: row.assigned_to,
      dueAt: row.due_at
    })),

    recent: rows.slice(0, 30).map(row => ({
      id: row.id,
      agentId: row.agent_id,
      title: row.title,
      description: row.description,
      status: row.status,
      priority: row.priority,
      assignedTo: row.assigned_to,
      dueAt: row.due_at,
      createdAt: row.created_at,
      updatedAt: row.updated_at
    }))
  };
}

async function getApprovals(now) {
  const rows = await query(`
    SELECT
      id,
      agent_id,
      agent_run_id,
      action_type,
      description,
      status,
      requested_at,
      reviewed_at,
      reviewed_by,
      review_notes
    FROM approvals
    ORDER BY requested_at DESC
  `);

  const pending = rows.filter(row => row.status === 'pending');

  return {
    total: rows.length,

    byStatus: countBy(rows, 'status'),

    pending: pending.length,

    approved: rows.filter(row => row.status === 'approved').length,

    rejected: rows.filter(row => row.status === 'rejected').length,

    oldPending: pending
      .filter(row => daysSince(row.requested_at, now) >= 1)
      .map(row => ({
        id: row.id,
        agentId: row.agent_id,
        actionType: row.action_type,
        description: row.description,
        requestedAt: row.requested_at,
        ageDays: daysSince(row.requested_at, now)
      })),

    recent: rows.slice(0, 20).map(row => ({
      id: row.id,
      agentId: row.agent_id,
      agentRunId: row.agent_run_id,
      actionType: row.action_type,
      description: row.description,
      status: row.status,
      requestedAt: row.requested_at,
      reviewedAt: row.reviewed_at,
      reviewedBy: row.reviewed_by,
      reviewNotes: row.review_notes
    }))
  };
}

async function getProjects(now) {
  const rows = await query(`
    SELECT
      id,
      client_id,
      title,
      status,
      risk_level,
      due_at,
      created_at,
      updated_at
    FROM projects
    ORDER BY created_at DESC
  `);

  const overdue = rows.filter(
    row =>
      row.due_at &&
      isOverdue(row.due_at, now) &&
      !['completed', 'cancelled'].includes(row.status)
  );

  return {
    total: rows.length,

    byStatus: countBy(rows, 'status'),
    byRiskLevel: countBy(rows, 'risk_level'),

    planned: rows.filter(row => row.status === 'planned').length,
    inProgress: rows.filter(row => row.status === 'in_progress').length,
    blocked: rows.filter(row => row.status === 'blocked').length,
    atRisk: rows.filter(row => row.status === 'at_risk').length,
    completed: rows.filter(row => row.status === 'completed').length,
    cancelled: rows.filter(row => row.status === 'cancelled').length,

    highRisk: rows.filter(row => row.risk_level === 'high').length,

    overdue: overdue.length,

    blockedProjects: rows
      .filter(row => row.status === 'blocked')
      .slice(0, 20)
      .map(row => ({
        id: row.id,
        clientId: row.client_id,
        title: row.title,
        status: row.status,
        riskLevel: row.risk_level,
        dueAt: row.due_at
      })),

    atRiskProjects: rows
      .filter(row => row.status === 'at_risk')
      .slice(0, 20)
      .map(row => ({
        id: row.id,
        clientId: row.client_id,
        title: row.title,
        status: row.status,
        riskLevel: row.risk_level,
        dueAt: row.due_at
      })),

    overdueProjects: overdue.slice(0, 20).map(row => ({
      id: row.id,
      clientId: row.client_id,
      title: row.title,
      status: row.status,
      riskLevel: row.risk_level,
      dueAt: row.due_at
    }))
  };
}

function buildRisks(data) {
  const risks = [];

  if (data.revenue.revenueGap > 0) {
    risks.push({
      type: 'revenue_gap',
      severity: 'high',
      title: 'Revenue target gap remains',
      description:
        `₹${data.revenue.revenueGap.toLocaleString('en-IN')} remains uncovered after expected INR revenue.`,
      source: 'revenue_records',
      recommendedAction:
        'Increase qualified pipeline and accelerate high-probability opportunities.'
    });
  }

  if (data.tasks.overdue > 0) {
    risks.push({
      type: 'overdue_tasks',
      severity: 'high',
      title: 'Overdue tasks require attention',
      description: `${data.tasks.overdue} task(s) are overdue.`,
      source: 'agent_tasks',
      recommendedAction: 'Review ownership and unblock or reassign overdue work.'
    });
  }

  if (data.tasks.blocked > 0) {
    risks.push({
      type: 'blocked_tasks',
      severity: 'high',
      title: 'Blocked tasks detected',
      description: `${data.tasks.blocked} task(s) are blocked.`,
      source: 'agent_tasks',
      recommendedAction: 'Identify blockers and assign explicit next actions.'
    });
  }

  if (data.tasks.permanentFailure > 0) {
    risks.push({
      type: 'failed_tasks',
      severity: 'high',
      title: 'Permanently failed tasks',
      description: `${data.tasks.permanentFailure} task(s) failed permanently.`,
      source: 'agent_tasks',
      recommendedAction: 'Manually reconcile failures or reassign the work.'
    });
  }

  if (data.approvals.pending > 0) {
    risks.push({
      type: 'pending_approvals',
      severity: 'medium',
      title: 'Pending approvals',
      description: `${data.approvals.pending} approval(s) are awaiting review.`,
      source: 'approvals',
      recommendedAction: 'Review approvals that are blocking business progress.'
    });
  }

  if (data.projects.blocked > 0) {
    risks.push({
      type: 'blocked_projects',
      severity: 'high',
      title: 'Blocked delivery projects',
      description: `${data.projects.blocked} project(s) are blocked.`,
      source: 'projects',
      recommendedAction: 'Escalate blockers and define a recovery action.'
    });
  }

  if (data.projects.atRisk > 0) {
    risks.push({
      type: 'at_risk_projects',
      severity: 'high',
      title: 'Projects are at risk',
      description: `${data.projects.atRisk} project(s) are marked at risk.`,
      source: 'projects',
      recommendedAction: 'Review delivery dates, ownership and blockers.'
    });
  }

  if (data.projects.overdue > 0) {
    risks.push({
      type: 'overdue_projects',
      severity: 'high',
      title: 'Overdue project delivery',
      description: `${data.projects.overdue} project(s) are past their due date.`,
      source: 'projects',
      recommendedAction: 'Create a recovery plan for overdue delivery.'
    });
  }

  if (data.pipeline.overdueNextActions > 0) {
    risks.push({
      type: 'pipeline_overdue_actions',
      severity: 'medium',
      title: 'Pipeline actions are overdue',
      description:
        `${data.pipeline.overdueNextActions} pipeline record(s) have overdue next actions.`,
      source: 'client_pipeline',
      recommendedAction: 'Prioritize follow-up and update the next action.'
    });
  }

  if (data.pipeline.withoutNextAction > 0) {
    risks.push({
      type: 'pipeline_missing_next_action',
      severity: 'medium',
      title: 'Pipeline records lack next actions',
      description:
        `${data.pipeline.withoutNextAction} pipeline record(s) have no next action.`,
      source: 'client_pipeline',
      recommendedAction: 'Assign a concrete next action and owner.'
    });
  }

  if (data.deduplication.pendingReview > 0) {
    risks.push({
      type: 'duplicate_review',
      severity: 'low',
      title: 'Duplicate candidates need review',
      description:
        `${data.deduplication.pendingReview} possible duplicate(s) await review.`,
      source: 'dedupe_candidates',
      recommendedAction: 'Review duplicate candidates before further client processing.'
    });
  }

  if (data.requirements.oldOpen.length > 0) {
    risks.push({
      type: 'stale_requirements',
      severity: 'medium',
      title: 'Client requirements are aging',
      description:
        `${data.requirements.oldOpen.length} open requirement(s) are at least 14 days old.`,
      source: 'client_requirements',
      recommendedAction: 'Confirm requirements and timeline with the responsible owner.'
    });
  }

  return risks;
}

function buildPriorities(data, risks) {
  const priorities = [];

  if (data.revenue.revenueGap > 0) {
    priorities.push({
      priority: 1,
      severity: 'high',
      title: 'Close the revenue gap',
      reason: `₹${data.revenue.revenueGap.toLocaleString('en-IN')} remains uncovered.`,
      recommendedAction:
        'Focus Client Acquisition on high-probability revenue opportunities.',
      source: 'revenue_records'
    });
  }

  if (data.projects.overdue > 0) {
    priorities.push({
      priority: 2,
      severity: 'high',
      title: 'Recover overdue delivery',
      reason: `${data.projects.overdue} project(s) are overdue.`,
      recommendedAction: 'Create and assign a recovery plan.',
      source: 'projects'
    });
  }

  if (data.tasks.overdue > 0) {
    priorities.push({
      priority: 3,
      severity: 'high',
      title: 'Resolve overdue work',
      reason: `${data.tasks.overdue} task(s) are overdue.`,
      recommendedAction: 'Review ownership and unblock overdue tasks.',
      source: 'agent_tasks'
    });
  }

  if (data.pipeline.overdueNextActions > 0) {
    priorities.push({
      priority: 4,
      severity: 'medium',
      title: 'Move stalled pipeline',
      reason:
        `${data.pipeline.overdueNextActions} pipeline action(s) are overdue.`,
      recommendedAction: 'Review and execute the next acquisition actions.',
      source: 'client_pipeline'
    });
  }

  if (data.approvals.pending > 0) {
    priorities.push({
      priority: 5,
      severity: 'medium',
      title: 'Clear pending approvals',
      reason: `${data.approvals.pending} approval(s) are waiting.`,
      recommendedAction: 'Review approvals that block execution.',
      source: 'approvals'
    });
  }

  if (data.deduplication.pendingReview > 0) {
    priorities.push({
      priority: 6,
      severity: 'low',
      title: 'Review duplicate candidates',
      reason:
        `${data.deduplication.pendingReview} duplicate candidate(s) await review.`,
      recommendedAction: 'Review candidates without automatically merging records.',
      source: 'dedupe_candidates'
    });
  }

  return priorities
    .sort((a, b) => a.priority - b.priority)
    .map((item, index) => ({
      ...item,
      priority: index + 1
    }))
    .slice(0, 10);
}

async function getClientAcquisitionPerformance(data) {
  const acquisitionAgent = data.agents.list.find(
    agent =>
      agent.slug === 'client-acquisition' ||
      String(agent.name || '').toLowerCase().includes('client acquisition')
  );

  const agentId = acquisitionAgent?.id ?? null;

  const acquisitionTasks = data.tasks.recent.filter(
    task => agentId !== null && task.agentId === agentId
  );

  return {
    agent: acquisitionAgent || null,

    leads: {
      total: data.leads.total,
      qualified: data.leads.qualified,
      proposals: data.leads.proposals,
      won: data.leads.won
    },

    pipeline: {
      total: data.pipeline.total,
      expectedINR: data.pipeline.expectedINR,
      weightedINR: data.pipeline.weightedINR,
      averageProbability: data.pipeline.averageProbability
    },

    revenue: {
      actualINR: data.revenue.actual,
      expectedINR: data.revenue.expected
    },

    tasks: {
      totalRecent: acquisitionTasks.length,
      overdue: acquisitionTasks.filter(task => {
        if (!task.dueAt || task.status === 'completed') return false;
        return new Date(task.dueAt).getTime() < Date.now();
      }).length
    },

    pendingApprovals: data.approvals.pending,

    performanceRisks: data.risks.filter(risk =>
      [
        'revenue_gap',
        'pipeline_overdue_actions',
        'pipeline_missing_next_action',
        'pending_approvals'
      ].includes(risk.type)
    ),

    recommendedActions: [
      data.revenue.revenueGap > 0
        ? 'Prioritize acquisition activity that can create qualified INR revenue.'
        : null,
      data.pipeline.overdueNextActions > 0
        ? 'Resolve overdue pipeline next actions.'
        : null,
      data.pipeline.withoutNextAction > 0
        ? 'Ensure every active pipeline record has a next action.'
        : null
    ].filter(Boolean)
  };
}

async function getCompanySnapshot(options = {}) {
  const now = options.now ? new Date(options.now) : new Date();

  if (Number.isNaN(now.getTime())) {
    throw new Error('Invalid options.now supplied to getCompanySnapshot');
  }

  const [
    revenue,
    leads,
    proposals,
    clients,
    pipeline,
    requirements,
    interactions,
    sources,
    deduplication,
    mergeHistory,
    activity,
    agents,
    tasks,
    approvals,
    projects
  ] = await Promise.all([
    getRevenue(now),
    getLeads(),
    getProposals(),
    getClients(),
    getPipeline(now),
    getRequirements(now),
    getInteractions(),
    getSources(),
    getDeduplication(),
    getMergeHistory(),
    getActivity(),
    getAgents(),
    getTasks(now),
    getApprovals(now),
    getProjects(now)
  ]);

  const base = {
    generatedAt: now.toISOString(),
    source: 'postgresql',

    revenue,
    leads,
    proposals,
    clients,
    pipeline,
    requirements,
    interactions,
    sources,
    deduplication,
    mergeHistory,
    activity,
    agents,
    tasks,
    approvals,
    projects
  };

  const risks = buildRisks(base);

  const withRisks = {
    ...base,
    risks: risks.sort((a, b) => {
      const order = {
        high: 1,
        medium: 2,
        low: 3
      };

      return (order[a.severity] || 9) - (order[b.severity] || 9);
    })
  };

  return {
    ...withRisks,

    priorities: buildPriorities(withRisks, risks),

    clientAcquisitionPerformance:
      await getClientAcquisitionPerformance(withRisks),

    founderDailySnapshot: {
      todayRevenue: revenue.todayRevenue,
      actualRevenue: revenue.actual,
      expectedRevenue: revenue.expected,
      revenueTarget: revenue.target,
      remainingTarget: revenue.remainingTarget,
      revenueGap: revenue.revenueGap,
      revenueProgressPercent: revenue.progressPercent,

      leads: leads,
      pipeline: pipeline,
      clients: clients,

      workforce: {
        agents: agents,
        tasks: tasks
      },

      approvals,
      delivery: projects,

      risks: withRisks.risks,
      priorities: buildPriorities(withRisks, risks),

      clientAcquisitionPerformance:
        await getClientAcquisitionPerformance(withRisks),

      recentActivity: activity.recent.slice(0, 20)
    }
  };
}

module.exports = {
  REVENUE_TARGET_INR,
  getCompanySnapshot
};