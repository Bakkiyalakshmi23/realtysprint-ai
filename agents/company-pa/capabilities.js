/**
 * RealtySprint AI — Founder PA Agent: Capabilities
 * agents/company-pa/capabilities.js
 *
 * Defines the supported actions and their demo implementations.
 * These are deterministic outputs — clearly labeled DEMO DATA.
 * No LLM integration. No external calls.
 */
'use strict';

const agentResult = require('../core/agentResult');
const config      = require('./config');
const { analyze } = require('../../backend/ai/analysis');

// ─── Demo data store ────────────────────────────────────────────────────────
// Clearly labeled as DEMO. Must never be presented as real company data.

const DEMO_COMPANY_REPORT = {
  _dataLabel: 'DEMO DATA — Not real company figures',
  reportDate:  new Date().toLocaleDateString('en-IN'),

  // Revenue
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

  // Workforce activity
  workCompleted:  5,
  workPending:    3,
  workDelayed:    1,

  // Lead pipeline
  newLeads:          5,
  qualifiedLeads:    3,
  clientConversations: 1,
  proposals:         1,
  clientsWon:        0,

  // Delivery
  activeDeliveries:  0,
  deliveryStatus:    'DATA NOT AVAILABLE',

  // Blockers & attention items
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

const DEMO_PRIORITIES = {
  _dataLabel: 'DEMO DATA — Priorities derived from current system state',
  analysisDate: new Date().toISOString(),

  criticalPriorities: [
    {
      rank:        1,
      priority:    'CRITICAL',
      category:    'Revenue',
      description: '₹50L target with ₹0 achieved. Business development must begin immediately.',
      action:      'Activate Client Acquisition pipeline and begin client conversations.',
    },
  ],

  highPriorities: [
    {
      rank:        2,
      priority:    'HIGH',
      category:    'Sales',
      description: '3 qualified leads awaiting outreach approval.',
      action:      'Review and approve pending outreach drafts in Approvals section.',
    },
    {
      rank:        3,
      priority:    'HIGH',
      category:    'Infrastructure',
      description: 'Backend running on demo data. No live business intelligence available.',
      action:      'Install PostgreSQL and connect to live data.',
    },
  ],

  mediumPriorities: [
    {
      rank:        4,
      priority:    'MEDIUM',
      category:    'Pipeline',
      description: 'Only 5 leads in pipeline against 20 daily target.',
      action:      'Expand prospect discovery. Review Client Acquisition configuration.',
    },
    {
      rank:        5,
      priority:    'MEDIUM',
      category:    'Product',
      description: 'RealtySprint service pricing not stored in system.',
      action:      'Add service catalog and pricing to system for proposal generation.',
    },
  ],
};

// ─── Supported actions ────────────────────────────────────────────────────────

const SUPPORTED_ACTIONS = [
  'generate_report',
  'analyze_revenue',
  'check_performance',
  'identify_priorities',
  'analyze_pipeline',
  'analyze_workforce',
  'create_recommendation',
  'read_internal_data',
  'analyze_data',
];

// ─── Action handlers ─────────────────────────────────────────────────────────

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
    blockers: snapshot.blockers || [],
    overdue_work: snapshot.overdueWork || [],
    founder_attention: [
      `${percent} of the INR ${target.toLocaleString('en-IN')} six-month target is recorded as actual revenue.`,
      ...(Number(pipeline.qualified || 0) ? [`Review ${pipeline.qualified} qualified prospects in the pipeline.`] : []),
    ],
    tomorrow_priorities: ['Review qualified pipeline and confirm the next founder-approved sales actions.', 'Review delivery tasks and resolve overdue blockers.'],
    recommendations: ['Keep expected contract value separate from received revenue.', 'Record next steps and owners for every qualified lead.'],
  };
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
      aiStatus:      ai.aiStatus,
      _notice:       snapshot.source === 'database' ? 'ACTUAL aggregates from the connected database; expected revenue is shown separately.' : 'DEMO DATA — not actual company data.',
      report:        ai.output,
    },
    traceId: context.traceId,
  });
}

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

async function identifyPriorities(context) {
  const snapshot = context.input?.companySnapshot || { source: 'demo', blockers: DEMO_COMPANY_REPORT.blockers, overdueWork: [] };
  const fallback = { priorities: [
    { priority: 'Revenue progress', reason: 'The six-month target has little or no actual revenue recorded.', urgency: 'high', recommended_action: 'Review the qualified pipeline and confirm a founder-approved acquisition plan.', owner: 'Founder + Client Acquisition Agent', dependency: 'Accurate actual revenue and pipeline outcomes' },
    ...(snapshot.overdueWork || []).map(title => ({ priority: `Overdue: ${title}`, reason: 'A task is overdue.', urgency: 'high', recommended_action: 'Assign an owner and updated due date.', owner: 'Company PA Agent', dependency: 'Founder review if reassignment is needed' })),
  ] };
  const ai = await analyze({
    useAI: context.input?.useAI, schemaName: 'company_priorities',
    systemPrompt: 'Recommend company priorities to the Founder. State reason, urgency, concrete action, owner, and dependencies. Do not claim actions have been taken.',
    input: { company_data: snapshot }, fallback,
  });
  return agentResult.completed({
    agent:   config.slug,
    action:  'identify_priorities',
    result:  {
      demoMode:   snapshot.source !== 'database',
      _notice:    snapshot.source === 'database' ? 'Priorities derived from connected business records.' : 'DEMO DATA — not actual company priorities.',
      aiStatus:   ai.aiStatus,
      priorities: ai.output,
    },
    traceId: context.traceId,
  });
}

async function readInternalData(context) {
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
  analyzeRevenue,
  checkPerformance,
  identifyPriorities,
  readInternalData,
};
