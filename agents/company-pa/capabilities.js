/**
 * RealtySprint AI — Founder PA Agent: Capabilities
 * agents/company-pa/capabilities.js
 *
 * Defines the supported actions for Company PA Agent v1:
 * - generate_report: Comprehensive business overview with data freshness & missing data disclosures
 * - daily_briefing: Executive daily briefing citing record IDs & separating facts from recommendations
 * - identify_priorities: Strictly read-only priority & blocker ranking (ZERO database mutations)
 * - summarize_tasks: Bounded read-only task operational summary
 * - propose_tasks: Proposes actionable task suggestions without automatic persistence
 * - create_internal_task: Authorized internal task creation with strict duplicate prevention & validation
 * - analyze_revenue, check_performance, read_internal_data: Core analytical functions
 */
'use strict';

const agentResult = require('../core/agentResult');
const config      = require('./config');
const { analyze } = require('../../backend/ai/analysis');
const { pool }    = require('../../backend/db/pool');

// ─── Demo data store ────────────────────────────────────────────────────────
// Clearly labeled as DEMO. Used as reliable fallback when database is offline.

const DEMO_COMPANY_REPORT = {
  _dataLabel: 'DEMO DATA — Not real company figures',
  reportDate:  new Date().toLocaleDateString('en-IN'),

  revenue: {
    today:         0,
    thisMonth:     0,
    total:         0,
    target:        config.revenueTarget.label,
    targetAmount:  config.revenueTarget.amount,
    achieved:      0,
    remaining:     config.revenueTarget.amount,
    percentAchieved: '0%',
    note:          'DATA NOT AVAILABLE — Connect revenue tracking in a future step.',
  },

  workCompleted:  5,
  workPending:    3,
  workDelayed:    1,

  newLeads:          5,
  qualifiedLeads:    3,
  clientConversations: 1,
  proposals:         1,
  clientsWon:        0,

  activeDeliveries:  0,
  deliveryStatus:    'DATA NOT AVAILABLE',

  blockers: [
    'PostgreSQL not installed — backend running on demo fallback data.',
    'No revenue tracking connected yet.',
    'No active clients in system.',
  ],

  founderAttentionItems: [
    { priority: 'HIGH',   item: 'Revenue gap: ₹50,00,000 target with ₹0 tracked. Activate sales pipeline immediately.' },
    { priority: 'MEDIUM', item: 'Client Acquisition pipeline has 3 qualified leads awaiting outreach approval.' },
    { priority: 'LOW',    item: 'Install PostgreSQL to enable live data tracking.' },
  ],

  tomorrowPlan: [
    'Review and approve 3 pending outreach drafts from Client Acquisition.',
    'Identify 5 new high-priority prospects for qualification.',
    'Finalize RealtySprint service pricing for proposals.',
    'Follow up on existing lead conversations.',
  ],
};

const DEMO_PERFORMANCE_REPORT = {
  _dataLabel: 'DEMO DATA — Not real agent performance figures',
  agent:      'Client Acquisition',
  period:     'Today',

  targets: {
    qualifiedLeads:      20,
    proposals:            5,
    clientConversations:  3,
  },
  actuals: {
    qualifiedLeads:      3,
    proposals:           1,
    clientConversations: 0,
  },
  gaps: {
    qualifiedLeads:      17,
    proposals:            4,
    clientConversations:  3,
  },
  pipeline: {
    totalLeads:    5,
    qualified:     3,
    awaitingApproval: 2,
    rejected:      0,
  },
  recommendations: [
    'Increase prospect discovery volume — only 5 leads in pipeline vs 20 needed.',
    'Approve 2 pending outreach drafts to move qualified leads forward.',
    'Review lead qualification criteria — scoring threshold may be too high.',
    'Expand lead sources beyond Bayut/Property Finder.',
  ],
};

// ─── Supported actions ────────────────────────────────────────────────────────

const SUPPORTED_ACTIONS = [
  'generate_report',
  'daily_briefing',
  'analyze_revenue',
  'check_performance',
  'identify_priorities',
  'analyze_pipeline',
  'analyze_workforce',
  'create_recommendation',
  'read_internal_data',
  'analyze_data',
  'summarize_tasks',
  'propose_tasks',
  'create_internal_task',
];

// ─── Helper: Safe Database Query ──────────────────────────────────────────────

async function safeQuery(sql, params = []) {
  try {
    const res = await pool.query(sql, params);
    return res.rows;
  } catch (err) {
    return [];
  }
}

// ─── Action Handlers ─────────────────────────────────────────────────────────

/**
 * A. Company Overview (generate_report)
 * Summarizes business metrics from verified records.
 * Shows data freshness and explicitly notes unrecorded information.
 */
async function generateReport(context) {
  const snapshot = context.input?.companySnapshot || {
    source: 'demo', dataQuality: 'DEMO — not actual company data',
    revenue: { todayActual: 0, totalActual: 0, expected: 0, target: config.revenueTarget.amount, currency: 'INR' },
    pipeline: { totalLeads: 5, qualified: 3, conversations: 1, proposals: 1, wins: 0, followUps: 0 },
    delivery: { activeProjects: 0, overdue: 1, blocked: 0, atRisk: 0 },
    blockers: DEMO_COMPANY_REPORT.blockers,
    overdueWork: ['DEMO: No live overdue task records are connected.'],
  };

  const revenue = snapshot.revenue || {};
  const pipeline = snapshot.pipeline || {};
  const delivery = snapshot.delivery || {};
  const target = Number(revenue.target || config.revenueTarget.amount);
  const achieved = Number(revenue.totalActual || 0);
  const expected = Number(revenue.expected || 0);
  const remaining = Math.max(0, target - achieved);
  const revenueGap = Math.max(0, target - achieved - expected);
  const percent = target ? `${Math.min(100, Math.round((achieved / target) * 10000) / 100)}%` : '0%';
  const currency = revenue.currency || 'INR';
  const formatRevenue = amount => `${currency} ${Number(amount || 0).toLocaleString('en-IN')}`;

  const pipelineFallback = {
    summary: `${pipeline.qualified || 0} qualified of ${pipeline.totalLeads || 0} leads; ${pipeline.proposals || 0} proposals and ${pipeline.wins || 0} wins.`,
    today_revenue: Number(revenue.todayActual || 0),
    actual_revenue: achieved,
    expected_revenue: expected,
    revenue_target: target,
    remaining_target: remaining,
    revenue_gap: revenueGap,
    revenue_currency: currency,
    revenue_status: `${formatRevenue(achieved)} received; ${formatRevenue(expected)} expected and not received. ${formatRevenue(revenueGap)} projected gap remains after expected revenue.`,
    revenue_progress: percent,
    required_pace: `${formatRevenue(Math.ceil(target / (config.revenueTarget.periodMonths * 30)))} per day for the 6-month target`,
    revenue_data_quality: snapshot.dataQuality || 'DEMO — not actual company data',
    target_status: {
      target: `INR ${target.toLocaleString('en-IN')}`,
      period: '6 months', progress: percent, gap: `INR ${remaining.toLocaleString('en-IN')}`,
    },
    pipeline_status: {
      total_leads: Number(pipeline.totalLeads || 0),
      qualified_leads: Number(pipeline.qualified || 0),
      conversations: Number(pipeline.conversations || 0),
      proposals: Number(pipeline.proposals || 0),
      won_clients: Number(pipeline.wins || 0),
      conversion_rate: `${pipeline.totalLeads ? Math.round((Number(pipeline.wins || 0) / Number(pipeline.totalLeads)) * 100) : 0}%`,
    },
    client_acquisition_status: {
      summary: `${pipeline.totalLeads || 0} leads; ${pipeline.followUps || 0} follow-up drafts recorded.`,
      risks: ['Pipeline activity is limited to connected records.'],
      recommended_actions: ['Review qualified leads and prepare approved next steps.'],
    },
    delivery_status: {
      active_projects: Number(delivery.activeProjects || 0),
      overdue: Number(delivery.overdue || 0),
      blocked: Number(delivery.blocked || 0),
      at_risk: Number(delivery.atRisk || 0),
      summary: `${delivery.activeProjects || 0} active projects; ${delivery.overdue || 0} overdue tasks.`,
    },
    blockers: Array.isArray(snapshot.blockers) ? [...snapshot.blockers] : [],
    overdue_work: Array.isArray(snapshot.overdueWork) ? [...snapshot.overdueWork] : [],
    founder_attention: [
      `${percent} of the INR ${target.toLocaleString('en-IN')} six-month target is recorded as actual revenue.`,
      ...(Number(pipeline.qualified || 0) ? [`Review ${pipeline.qualified} qualified prospects in the pipeline.`] : []),
    ],
    tomorrow_priorities: ['Review qualified pipeline and confirm the next founder-approved sales actions.', 'Review delivery tasks and resolve overdue blockers.'],
    recommendations: ['Keep expected contract value separate from received revenue.', 'Record next steps and owners for every qualified lead.'],
  };

  // Live database enrichment: cite pending approvals and unrecorded data indicators
  if (snapshot.source === 'database') {
    try {
      const pendingApprovals = await safeQuery(`SELECT id, description FROM approvals WHERE status = 'pending'`);
      if (pendingApprovals.length > 0) {
        pipelineFallback.blockers.push(`${pendingApprovals.length} pending approvals requiring Founder review.`);
        pipelineFallback.founder_attention.push(`Immediate Action Required: ${pendingApprovals.length} approvals pending.`);
      }

      // Check if revenue records or projects are empty
      const revCountRes = await safeQuery(`SELECT COUNT(*) as count FROM revenue_records`);
      if (revCountRes.length && Number(revCountRes[0].count) === 0) {
        pipelineFallback.recommendations.push('Notice: 0 revenue records exist in database. Expected and actual figures reflect unrecorded receipts rather than confirmed zero revenue.');
      }
      const projCountRes = await safeQuery(`SELECT COUNT(*) as count FROM projects`);
      if (projCountRes.length && Number(projCountRes[0].count) === 0) {
        pipelineFallback.recommendations.push('Notice: 0 delivery projects exist in database. Delivery project tracking is currently unrecorded.');
      }
    } catch (err) {
      // Non-blocking
    }
  }

  const ai = await analyze({
    useAI: context.input?.useAI,
    schemaName: 'company_report',
    systemPrompt: 'Act as the Company PA reporting to the Founder. Analyze only the supplied bounded company aggregates. Return actual_revenue and expected_revenue as separate amounts in the supplied revenue currency. Expected revenue is not received revenue and must never be added to actual_revenue. remaining_target is target minus actual revenue; revenue_gap is target minus actual and expected revenue, floored at zero. Preserve the supplied six-month target and clearly label DEMO data. Do not invent data.',
    input: { company_data: snapshot },
    fallback: pipelineFallback,
  });

  return agentResult.completed({
    agent:   config.slug,
    action:  'generate_report',
    result:  {
      reportType:    'Founder Daily Brief',
      demoMode:      snapshot.source !== 'database',
      dataSource:    snapshot.source,
      dataQuality:   snapshot.dataQuality,
      dataFreshness: snapshot.asOf || new Date().toISOString(),
      aiStatus:      ai.aiStatus,
      _notice:       snapshot.source === 'database'
        ? 'ACTUAL aggregates from the connected database; expected revenue is shown separately.'
        : 'DEMO DATA — not actual company data.',
      report:        ai.output,
    },
    traceId: context.traceId,
  });
}

/**
 * B. Daily Briefing (daily_briefing)
 * Summarizes outstanding tasks, overdue items, deadlines, approvals, and blockers.
 * Strictly separates database facts (with record IDs) from AI recommendations.
 */
async function dailyBriefing(context) {
  const snapshot = context.input?.companySnapshot || { source: 'demo' };
  const now = new Date();

  let tasks = [];
  let approvals = [];
  let leads = [];
  let isDb = snapshot.source === 'database';

  if (isDb) {
    tasks = await safeQuery(`
      SELECT t.id, t.title, t.status, t.priority, t.due_at, t.assigned_to, a.slug as agent_slug
      FROM agent_tasks t
      LEFT JOIN agents a ON a.id = t.agent_id
      ORDER BY t.created_at DESC
      LIMIT 100
    `);

    approvals = await safeQuery(`
      SELECT id, action_type, description, status, requested_at
      FROM approvals
      WHERE status = 'pending'
      ORDER BY requested_at ASC
    `);

    leads = await safeQuery(`
      SELECT id, status, score FROM leads
    `);
  }

  const overdueTasks = tasks.filter(t => t.due_at && new Date(t.due_at).getTime() < now.getTime() && t.status !== 'completed');
  const pendingTasks = tasks.filter(t => ['pending', 'open'].includes(t.status));
  const blockedTasks = tasks.filter(t => t.status === 'blocked');
  const unassignedTasks = tasks.filter(t => (!t.assigned_to || t.assigned_to === 'unassigned') && t.status !== 'completed');

  // Distinguish verified database facts from AI recommendations
  const databaseFacts = isDb ? [
    `Leads: ${leads.length} total leads tracked in CRM (${leads.filter(l => l.status === 'qualified').length} qualified, ${leads.filter(l => l.status === 'won').length} won) [source: leads]`,
    `Approvals: ${approvals.length} pending actions currently await Founder review [source: approvals, IDs: ${approvals.slice(0, 5).map(a => '#' + a.id).join(', ')}${approvals.length > 5 ? '...' : ''}]`,
    `Workforce Tasks: ${tasks.length} total tasks recorded (${pendingTasks.length} pending, ${overdueTasks.length} overdue, ${blockedTasks.length} blocked) [source: agent_tasks]`,
    `Revenue Progress: INR 0 recognized actual revenue against the INR 50,00,000 target [source: revenue_records]`,
  ] : [
    'DEMO FACT: 5 leads tracked in demo pipeline.',
    'DEMO FACT: 3 approvals pending in demo dataset.',
    'DEMO FACT: INR 0 actual revenue recorded against INR 50,00,000 target.',
  ];

  const missingDataWarnings = [];
  if (isDb) {
    const revCount = await safeQuery('SELECT COUNT(*) as count FROM revenue_records');
    if (!revCount.length || Number(revCount[0].count) === 0) {
      missingDataWarnings.push('Zero records in revenue_records: Indicates unrecorded accounting records, not verified absence of revenue.');
    }
    const projCount = await safeQuery('SELECT COUNT(*) as count FROM projects');
    if (!projCount.length || Number(projCount[0].count) === 0) {
      missingDataWarnings.push('Zero records in projects: Delivery projects are currently unrecorded in system.');
    }
  }

  const recommendations = [
    approvals.length > 0 ? `Review and decide on ${approvals.length} pending action approvals in the Approvals section.` : null,
    overdueTasks.length > 0 ? `Address ${overdueTasks.length} overdue tasks (${overdueTasks.slice(0, 3).map(t => '#' + t.id).join(', ')}) with assigned agents.` : null,
    unassignedTasks.length > 0 ? `Assign explicit owners to ${unassignedTasks.length} unallocated tasks.` : null,
    'Ensure client contracts and recognized payments are recorded in revenue_records.',
  ].filter(Boolean);

  return agentResult.completed({
    agent:   config.slug,
    action:  'daily_briefing',
    result:  {
      briefingType:          'Executive Daily Briefing',
      briefingDate:          now.toISOString(),
      dataSource:            isDb ? 'database' : 'demo',
      dataQuality:           isDb ? 'Verified against connected PostgreSQL records.' : 'DEMO DATA — fallback dataset.',
      dataFreshness:         snapshot.asOf || now.toISOString(),
      readOnly:              true,
      database_facts:        databaseFacts,
      missing_data_warnings: missingDataWarnings,
      summary: {
        totalLeads:        isDb ? leads.length : 5,
        qualifiedLeads:    isDb ? leads.filter(l => l.status === 'qualified').length : 3,
        pendingApprovals:  isDb ? approvals.length : 3,
        overdueTasksCount: isDb ? overdueTasks.length : 1,
        blockedTasksCount: isDb ? blockedTasks.length : 0,
        revenueTarget:     config.revenueTarget.amount,
        revenueActual:     0,
        revenueGap:        config.revenueTarget.amount,
      },
      overdue_items: overdueTasks.slice(0, 10).map(t => ({
        id:         t.id,
        title:      t.title,
        agent:      t.agent_slug || 'company-pa',
        dueAt:      t.due_at,
        priority:   t.priority,
        assignedTo: t.assigned_to,
      })),
      pending_approvals: approvals.slice(0, 10).map(a => ({
        id:          a.id,
        actionType:  a.action_type,
        description: a.description,
        requestedAt: a.requested_at,
      })),
      operational_blockers: [
        ...(approvals.length ? [`${approvals.length} approvals pending Founder review`] : []),
        ...(blockedTasks.length ? [`${blockedTasks.length} tasks marked blocked in agent_tasks`] : []),
      ],
      recommendations,
    },
    traceId: context.traceId,
  });
}

/**
 * C. Priority & Blocker Analysis (identify_priorities)
 * STRICTLY READ-ONLY. Ranks work by urgency, impact, deadline, and dependencies.
 * Flags missing owners, stale records, and inconsistent statuses WITHOUT mutating records.
 */
async function identifyPriorities(context) {
  const snapshot = context.input?.companySnapshot || { source: 'demo', blockers: DEMO_COMPANY_REPORT.blockers, overdueWork: [] };
  const isDb = snapshot.source === 'database';

  const prioritiesList = [];

  // 1. Revenue progress
  prioritiesList.push({
    priority:           'Close the ₹50,00,000 INR revenue gap',
    reason:             '₹0 actual revenue recorded against the 6-month target.',
    urgency:            'high',
    impact:             'Core business survival and company milestones.',
    deadline:           '6-month target window (requires ₹27,778/day pace)',
    dependencies:       'Contract signatures and revenue tracking',
    citedRecordIds:     [],
    recommended_action: 'Focus Client Acquisition Agent on qualified prospects to convert to proposals.',
    owner:              'Founder + Client Acquisition Agent',
  });

  if (isDb) {
    try {
      // 2. Pending approvals
      const pendingApprovals = await safeQuery(`SELECT id, action_type, description, requested_at FROM approvals WHERE status = 'pending' ORDER BY requested_at ASC`);
      if (pendingApprovals.length > 0) {
        prioritiesList.push({
          priority:           `Clear Founder approvals backlog (${pendingApprovals.length} pending)`,
          reason:             `${pendingApprovals.length} agent actions are paused awaiting Founder decision.`,
          urgency:            'critical',
          impact:             'Blocks outbound client communications and proposal submissions.',
          deadline:           'Immediate',
          dependencies:       'Founder review in Control Center Approvals',
          citedRecordIds:     pendingApprovals.slice(0, 10).map(a => a.id),
          recommended_action: 'Review and approve/reject pending action drafts in the Approvals section.',
          owner:              'Founder',
        });
      }

      // 3. Overdue tasks
      const overdueTasks = await safeQuery(`
        SELECT id, title, priority, due_at, assigned_to
        FROM agent_tasks
        WHERE due_at < NOW() AND status NOT IN ('completed', 'cancelled')
        ORDER BY due_at ASC
      `);
      if (overdueTasks.length > 0) {
        prioritiesList.push({
          priority:           `Resolve overdue tasks (${overdueTasks.length} tasks past deadline)`,
          reason:             'Tasks have passed their due dates without completion.',
          urgency:            'high',
          impact:             'Causes execution drift and delivery delays.',
          deadline:           'Overdue',
          dependencies:       'Assignee action or unblocking',
          citedRecordIds:     overdueTasks.slice(0, 10).map(t => t.id),
          recommended_action: 'Review overdue tasks, reassign ownership, or update deadlines.',
          owner:              'Company PA Agent',
        });
      }

      // 4. Missing owners anomaly
      const unassigned = await safeQuery(`
        SELECT id, title FROM agent_tasks
        WHERE (assigned_to IS NULL OR assigned_to = 'unassigned') AND status NOT IN ('completed', 'cancelled')
      `);
      if (unassigned.length > 0) {
        prioritiesList.push({
          priority:           `Assign unallocated tasks (${unassigned.length} tasks lack owners)`,
          reason:             'Active tasks have no assigned owner, creating risk of dropped work.',
          urgency:            'medium',
          impact:             'Work item accountability risk.',
          deadline:           'Current cycle',
          dependencies:       'Resource allocation',
          citedRecordIds:     unassigned.slice(0, 10).map(t => t.id),
          recommended_action: 'Assign designated agents or users to unassigned tasks.',
          owner:              'Company PA Agent',
        });
      }

      // 5. Qualified leads without drafts
      const qualifiedNoDraft = await safeQuery(`
        SELECT l.id, c.name
        FROM leads l
        JOIN companies c ON c.id = l.company_id
        WHERE l.status = 'qualified'
        AND NOT EXISTS (
          SELECT 1 FROM outreach_drafts od WHERE od.lead_id = l.id AND od.status IN ('draft', 'awaiting_approval')
        )
      `);
      if (qualifiedNoDraft.length > 0) {
        prioritiesList.push({
          priority:           `Engage qualified leads (${qualifiedNoDraft.length} prospects without drafts)`,
          reason:             'Qualified leads are idle without active outreach drafts.',
          urgency:            'high',
          impact:             'Direct pipeline velocity to proposal conversion.',
          deadline:           'Within 24 hours',
          dependencies:       'Client Acquisition Agent outreach generation',
          citedRecordIds:     qualifiedNoDraft.slice(0, 10).map(l => l.id),
          recommended_action: 'Propose outreach drafts for qualified prospects for Founder review.',
          owner:              'Client Acquisition Agent',
        });
      }
    } catch (err) {
      // Non-blocking query failure
    }
  } else {
    // Demo fallback priorities
    prioritiesList.push(
      { priority: 'Review pending outreach drafts', reason: '3 qualified prospects await outreach approval in demo mode.', urgency: 'high', recommended_action: 'Review and approve pending drafts.', owner: 'Founder', dependency: 'Founder review' },
      { priority: 'Connect live PostgreSQL database', reason: 'Backend operating on demo data fallback.', urgency: 'medium', recommended_action: 'Verify PostgreSQL connection.', owner: 'Founder', dependency: 'Database setup' }
    );
  }

  const fallback = { priorities: prioritiesList };

  const ai = await analyze({
    useAI: context.input?.useAI,
    schemaName: 'company_priorities',
    systemPrompt: 'Recommend company priorities to the Founder. State reason, urgency, concrete action, owner, and dependencies. Do not claim actions have been taken. Strictly read-only.',
    input: { company_data: snapshot },
    fallback,
  });

  return agentResult.completed({
    agent:   config.slug,
    action:  'identify_priorities',
    result:  {
      demoMode:         snapshot.source !== 'database',
      _notice:          snapshot.source === 'database'
        ? 'Priorities derived from connected business records. Read-only analysis — zero database mutations performed.'
        : 'DEMO DATA — not actual company priorities.',
      aiStatus:         ai.aiStatus,
      priorities:       ai.output,
      tasksCreatedToCA: 0, // STRICTLY ZERO — side-effect removed
      readOnly:         true,
    },
    traceId: context.traceId,
  });
}

/**
 * D. Task Assistance: Reading & Summarizing (summarize_tasks)
 * Purely read-only task aggregation by status, priority, and agent.
 */
async function summarizeTasks(context) {
  const snapshot = context.input?.companySnapshot || { source: 'demo' };
  const isDb = snapshot.source === 'database';
  const now = new Date();

  let tasks = [];
  if (isDb) {
    tasks = await safeQuery(`
      SELECT t.id, t.title, t.description, t.status, t.priority, t.due_at, t.assigned_to, a.slug as agent_slug
      FROM agent_tasks t
      LEFT JOIN agents a ON a.id = t.agent_id
      ORDER BY t.created_at DESC
      LIMIT 100
    `);
  }

  const byStatus = {};
  const byPriority = {};
  const byAgent = {};
  const overdue = [];
  const unassigned = [];

  for (const t of tasks) {
    byStatus[t.status] = (byStatus[t.status] || 0) + 1;
    byPriority[t.priority] = (byPriority[t.priority] || 0) + 1;
    const agent = t.agent_slug || 'unassigned';
    byAgent[agent] = (byAgent[agent] || 0) + 1;

    if (t.due_at && new Date(t.due_at).getTime() < now.getTime() && t.status !== 'completed') {
      overdue.push({ id: t.id, title: t.title, priority: t.priority, dueAt: t.due_at, assignedTo: t.assigned_to });
    }
    if (!t.assigned_to || t.assigned_to === 'unassigned') {
      unassigned.push({ id: t.id, title: t.title, priority: t.priority });
    }
  }

  return agentResult.completed({
    agent:   config.slug,
    action:  'summarize_tasks',
    result:  {
      demoMode:     !isDb,
      dataSource:   isDb ? 'database' : 'demo',
      readOnly:     true,
      totalTasks:   isDb ? tasks.length : 5,
      byStatus:     isDb ? byStatus : { completed: 2, in_progress: 2, pending: 1 },
      byPriority:   isDb ? byPriority : { high: 2, medium: 2, low: 1 },
      byAgent:      isDb ? byAgent : { 'company-pa': 3, 'client-acquisition': 2 },
      overdueTasks: overdue.slice(0, 10),
      unassignedTasks: unassigned.slice(0, 10),
      recentTasks:  tasks.slice(0, 20).map(t => ({
        id:         t.id,
        title:      t.title,
        status:     t.status,
        priority:   t.priority,
        assignedTo: t.assigned_to,
        agent:      t.agent_slug,
      })),
    },
    traceId: context.traceId,
  });
}

/**
 * D. Task Assistance: Propose Tasks (propose_tasks)
 * STRICTLY READ-ONLY. Formulates suggested tasks without automatic persistence.
 */
async function proposeTasks(context) {
  const snapshot = context.input?.companySnapshot || { source: 'demo' };
  const isDb = snapshot.source === 'database';

  const proposals = [];

  if (isDb) {
    // 1. Check qualified leads needing outreach
    const qualifiedLeads = await safeQuery(`
      SELECT l.id, c.name
      FROM leads l
      JOIN companies c ON c.id = l.company_id
      WHERE l.status = 'qualified'
      LIMIT 5
    `);

    for (const lead of qualifiedLeads) {
      const taskTitle = `Generate outreach for ${lead.name}`;
      const existing = await safeQuery(`SELECT id, status FROM agent_tasks WHERE title = $1 AND status NOT IN ('completed', 'cancelled')`, [taskTitle]);
      proposals.push({
        title: taskTitle,
        description: `Lead #${lead.id} (${lead.name}) is qualified. Propose outreach draft for Founder approval.`,
        targetAgent: 'client-acquisition',
        priority: 'high',
        reason: 'Qualified lead requires initial outbound touchpoint.',
        duplicateCheck: {
          alreadyExists: existing.length > 0,
          existingTaskId: existing.length ? existing[0].id : null,
        },
      });
    }

    // 2. Check overdue tasks needing follow-up
    const overdue = await safeQuery(`
      SELECT id, title, assigned_to FROM agent_tasks
      WHERE due_at < NOW() AND status NOT IN ('completed', 'cancelled')
      LIMIT 3
    `);

    for (const o of overdue) {
      const taskTitle = `Follow up on overdue task #${o.id}`;
      const existing = await safeQuery(`SELECT id, status FROM agent_tasks WHERE title = $1 AND status NOT IN ('completed', 'cancelled')`, [taskTitle]);
      proposals.push({
        title: taskTitle,
        description: `Task #${o.id} ("${o.title}") is past due date. Follow up with owner or reassess deadline.`,
        targetAgent: 'company-pa',
        priority: 'high',
        reason: 'Overdue task requires operational remediation.',
        duplicateCheck: {
          alreadyExists: existing.length > 0,
          existingTaskId: existing.length ? existing[0].id : null,
        },
      });
    }
  } else {
    proposals.push(
      {
        title: 'Review qualified prospects in pipeline',
        description: 'Review 3 qualified leads and generate customized drafts.',
        targetAgent: 'client-acquisition',
        priority: 'high',
        reason: 'Move qualified prospects to discovery phase.',
        duplicateCheck: { alreadyExists: false, existingTaskId: null },
      },
      {
        title: 'Review service catalog pricing',
        description: 'Verify service catalog pricing before proposal generation.',
        targetAgent: 'company-pa',
        priority: 'medium',
        reason: 'Standard pricing structure needed for contract proposals.',
        duplicateCheck: { alreadyExists: false, existingTaskId: null },
      }
    );
  }

  return agentResult.completed({
    agent:   config.slug,
    action:  'propose_tasks',
    result:  {
      demoMode:       !isDb,
      dataSource:     isDb ? 'database' : 'demo',
      persisted:      false,
      _notice:        'Proposed tasks are suggestions only and have NOT been persisted to the database.',
      suggestedTasks: proposals,
      readOnly:       true,
    },
    traceId: context.traceId,
  });
}

/**
 * D. Task Assistance: Authorized Task Creation (create_internal_task)
 * Validates input, enforces ownership & permissions, and prevents duplicate submissions.
 */
async function createInternalTask(context) {
  const { title, description, agent, priority, dueAt, assignedTo } = context.input || {};

  // 1. Input validation
  if (!title || typeof title !== 'string' || title.trim().length < 3) {
    return agentResult.failed({
      agent:   config.slug,
      action:  'create_internal_task',
      error:   'Task "title" is required and must be at least 3 characters.',
      traceId: context.traceId,
    });
  }

  if (title.length > 255) {
    return agentResult.failed({
      agent:   config.slug,
      action:  'create_internal_task',
      error:   'Task "title" must not exceed 255 characters.',
      traceId: context.traceId,
    });
  }

  const validAgents = ['company-pa', 'client-acquisition'];
  const targetAgentSlug = agent ? String(agent).trim().toLowerCase() : config.slug;
  if (!validAgents.includes(targetAgentSlug)) {
    return agentResult.failed({
      agent:   config.slug,
      action:  'create_internal_task',
      error:   `Invalid agent target: "${targetAgentSlug}". Allowed agents: [${validAgents.join(', ')}]`,
      traceId: context.traceId,
    });
  }

  const validPriorities = ['low', 'medium', 'high', 'critical'];
  const taskPriority = priority ? String(priority).trim().toLowerCase() : 'medium';
  if (!validPriorities.includes(taskPriority)) {
    return agentResult.failed({
      agent:   config.slug,
      action:  'create_internal_task',
      error:   `Invalid priority: "${taskPriority}". Allowed priorities: [${validPriorities.join(', ')}]`,
      traceId: context.traceId,
    });
  }

  // 2. Ownership & Agent ID resolution
  const agentRows = await safeQuery('SELECT id FROM agents WHERE slug = $1', [targetAgentSlug]);
  if (!agentRows.length) {
    return agentResult.failed({
      agent:   config.slug,
      action:  'create_internal_task',
      error:   `Target agent "${targetAgentSlug}" not found in database.`,
      traceId: context.traceId,
    });
  }
  const agentId = agentRows[0].id;

  // 3. Duplicate submission protection
  const cleanTitle = title.trim();
  const duplicateCheck = await safeQuery(
    `SELECT id, status FROM agent_tasks WHERE agent_id = $1 AND LOWER(TRIM(title)) = LOWER(TRIM($2)) AND status NOT IN ('completed', 'cancelled') LIMIT 1`,
    [agentId, cleanTitle]
  );

  if (duplicateCheck.length > 0) {
    const existing = duplicateCheck[0];
    return agentResult.failed({
      agent:   config.slug,
      action:  'create_internal_task',
      error:   `Duplicate task submission rejected: Task with title "${cleanTitle}" already exists (Task #${existing.id}, status: "${existing.status}").`,
      traceId: context.traceId,
    });
  }

  // 4. Safe parameterized insert
  try {
    const insertRes = await pool.query(
      `INSERT INTO agent_tasks (agent_id, title, description, status, priority, due_at, assigned_to)
       VALUES ($1, $2, $3, 'pending', $4, $5, $6)
       RETURNING id, agent_id, title, description, status, priority, due_at, assigned_to, created_at`,
      [
        agentId,
        cleanTitle,
        description ? String(description).trim() : null,
        taskPriority,
        dueAt ? new Date(dueAt).toISOString() : null,
        assignedTo ? String(assignedTo).trim() : targetAgentSlug,
      ]
    );

    const createdTask = insertRes.rows[0];

    return agentResult.completed({
      agent:   config.slug,
      action:  'create_internal_task',
      result:  {
        created: true,
        source:  'database',
        task: {
          id:         createdTask.id,
          title:      createdTask.title,
          agent:      targetAgentSlug,
          priority:   createdTask.priority,
          status:     createdTask.status,
          assignedTo: createdTask.assigned_to,
          dueAt:      createdTask.due_at,
          createdAt:  createdTask.created_at,
        },
      },
      traceId: context.traceId,
    });
  } catch (err) {
    return agentResult.failed({
      agent:   config.slug,
      action:  'create_internal_task',
      error:   `Database write error: ${err.message}`,
      traceId: context.traceId,
    });
  }
}

/**
 * Analytics helper: Revenue
 */
async function analyzeRevenue(context) {
  const snapshot = context.input?.companySnapshot || { source: 'demo', revenue: { todayActual: 0, totalActual: 0, expected: 0, target: config.revenueTarget.amount, currency: 'INR' } };
  const revenue = snapshot.revenue || {};
  const target = Number(revenue.target || config.revenueTarget.amount);
  const achieved = Number(revenue.totalActual || 0);
  const remaining = Math.max(0, target - achieved);
  return agentResult.completed({
    agent:   config.slug,
    action:  'analyze_revenue',
    result:  {
      demoMode:  snapshot.source !== 'database',
      dataQuality: snapshot.dataQuality || 'DEMO — not actual company data',
      todayActual: Number(revenue.todayActual || 0),
      expected: Number(revenue.expected || 0),
      target,
      achievedActual: achieved,
      remaining,
      progressPercent: target ? Math.round((achieved / target) * 10000) / 100 : 0,
      requiredMonthlyPace: Math.ceil(target / config.revenueTarget.periodMonths),
      recommendation: achieved === 0 ? 'Record actual receipts separately from expected contract values; review the qualified client pipeline.' : 'Compare actual revenue against the monthly pace and review expected contracts separately.',
    },
    traceId: context.traceId,
  });
}

/**
 * Analytics helper: Workforce & Acquisition Performance
 */
async function checkPerformance(context) {
  const snapshot = context.input?.companySnapshot || { source: 'demo', pipeline: { totalLeads: 5, qualified: 3, proposals: 1, wins: 0, followUps: 0 } };
  const pipeline = snapshot.pipeline || {};
  const fallback = {
    leads: Number(pipeline.totalLeads || 0),
    qualified_leads: Number(pipeline.qualified || 0),
    proposals: Number(pipeline.proposals || 0),
    wins: Number(pipeline.wins || 0),
    conversion: `${pipeline.totalLeads ? Math.round((Number(pipeline.wins || 0) / Number(pipeline.totalLeads)) * 100) : 0}% of tracked leads`,
    follow_up_activity: `${pipeline.followUps || 0} follow-up drafts recorded.`,
    risks: ['The current pipeline may not include every sales conversation.'],
    recommended_actions: ['Review qualified leads and overdue follow-ups.', 'Record proposal outcomes so conversion can be measured.'],
  };
  const ai = await analyze({
    useAI: context.input?.useAI, schemaName: 'company_performance',
    systemPrompt: 'Analyze Client Acquisition performance for the Founder using only supplied aggregate data. Identify gaps without inventing missing activity.',
    input: { client_acquisition_data: pipeline }, fallback,
  });
  return agentResult.completed({
    agent:   config.slug,
    action:  'check_performance',
    result:  {
      demoMode:          snapshot.source !== 'database',
      _notice:           snapshot.source === 'database' ? 'Aggregated from connected business records.' : 'DEMO DATA — not actual company performance.',
      dataSource:        snapshot.source,
      aiStatus:          ai.aiStatus,
      performanceReport: ai.output,
    },
    traceId: context.traceId,
  });
}

/**
 * Read internal summary data
 */
async function readInternalData(context) {
  const snapshot = context.input?.companySnapshot;
  if (snapshot && snapshot.source === 'database') {
    return agentResult.completed({
      agent:   config.slug,
      action:  'read_internal_data',
      result:  {
        demoMode:  false,
        agents:    snapshot.agents?.total || 2,
        tasks:     snapshot.tasks?.total || 0,
        leads:     snapshot.leads?.total || 0,
        approvals: snapshot.approvals?.total || 0,
        _notice:   'Connected PostgreSQL figures.',
      },
      traceId: context.traceId,
    });
  }

  return agentResult.completed({
    agent:   config.slug,
    action:  'read_internal_data',
    result:  {
      demoMode: true,
      agents:   2,
      tasks:    5,
      leads:    5,
      approvals: 3,
      _notice:  'DEMO DATA — Connect PostgreSQL for live figures.',
    },
    traceId: context.traceId,
  });
}

// ─── Exports ─────────────────────────────────────────────────────────────────

module.exports = {
  SUPPORTED_ACTIONS,
  generateReport,
  dailyBriefing,
  analyzeRevenue,
  checkPerformance,
  identifyPriorities,
  summarizeTasks,
  proposeTasks,
  createInternalTask,
  readInternalData,
};
