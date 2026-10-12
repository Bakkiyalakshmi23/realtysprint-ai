const { getCompanySnapshot } = require('./companyPaData');

const ALLOWED_COORDINATION_ACTIONS = Object.freeze({
  'company-pa': [
    'review_pipeline',
    'prioritize_leads',
    'qualify_leads',
    'review_followups',
    'prepare_proposal',
    'review_client_requirements',
    'identify_revenue_opportunities',
    'report_status'
  ],
  'client-acquisition': [
    'pipeline_status',
    'qualification_results',
    'proposal_status',
    'followup_status',
    'revenue_opportunities',
    'blocker_report',
    'handover_ready'
  ]
});

const COMPANY_PA_TO_ACQUISITION = new Set([
  'review_pipeline',
  'prioritize_leads',
  'qualify_leads',
  'review_followups',
  'prepare_proposal',
  'review_client_requirements',
  'identify_revenue_opportunities',
  'report_status'
]);

const ACQUISITION_TO_COMPANY_PA = new Set([
  'pipeline_status',
  'qualification_results',
  'proposal_status',
  'followup_status',
  'revenue_opportunities',
  'blocker_report',
  'handover_ready'
]);

const EXTERNAL_OR_APPROVAL_ACTIONS = new Set([
  'send_email',
  'send_whatsapp',
  'send_linkedin',
  'external_communication',
  'change_pricing',
  'financial_action',
  'approve_proposal',
  'commit_client_contract',
  'delete_record',
  'modify_permissions'
]);

function createCorrelationId() {
  return `coord-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

function normalizeAgent(agent) {
  return String(agent || '').trim().toLowerCase();
}

function validateDirection(fromAgent, toAgent) {
  if (
    fromAgent === 'company-pa' &&
    toAgent === 'client-acquisition'
  ) {
    return true;
  }

  if (
    fromAgent === 'client-acquisition' &&
    toAgent === 'company-pa'
  ) {
    return true;
  }

  return false;
}

function validateAction(fromAgent, action) {
  const actions = ALLOWED_COORDINATION_ACTIONS[fromAgent];

  return Boolean(
    actions &&
    actions.includes(action)
  );
}

function createInstruction({
  fromAgent,
  toAgent,
  action,
  objective,
  priority = 'medium',
  context = {},
  requestedActions = [],
  expectedOutput = [],
  requiresApproval = false,
  correlationId
}) {
  const normalizedFrom = normalizeAgent(fromAgent);
  const normalizedTo = normalizeAgent(toAgent);

  if (!validateDirection(normalizedFrom, normalizedTo)) {
    throw new Error(
      `Invalid coordination direction: ${normalizedFrom} -> ${normalizedTo}`
    );
  }

  if (!validateAction(normalizedFrom, action)) {
    throw new Error(
      `Invalid coordination action '${action}' for agent '${normalizedFrom}'`
    );
  }

  if (!objective || !String(objective).trim()) {
    throw new Error('Coordination objective is required');
  }

  return {
    coordinationId: createCorrelationId(),
    correlationId: correlationId || createCorrelationId(),
    fromAgent: normalizedFrom,
    toAgent: normalizedTo,
    action,
    objective: String(objective).trim(),
    priority,
    context,
    requestedActions: Array.isArray(requestedActions)
      ? requestedActions
      : [],
    expectedOutput: Array.isArray(expectedOutput)
      ? expectedOutput
      : [],
    requiresApproval: Boolean(requiresApproval),
    status: requiresApproval
      ? 'requires_approval'
      : 'pending',
    createdAt: new Date().toISOString()
  };
}

function validateInstruction(instruction) {
  if (!instruction || typeof instruction !== 'object') {
    return {
      valid: false,
      reason: 'Instruction is required'
    };
  }

  const fromAgent = normalizeAgent(instruction.fromAgent);
  const toAgent = normalizeAgent(instruction.toAgent);

  if (!validateDirection(fromAgent, toAgent)) {
    return {
      valid: false,
      reason: 'Invalid agent coordination direction'
    };
  }

  if (!validateAction(fromAgent, instruction.action)) {
    return {
      valid: false,
      reason: 'Action is not allowed for source agent'
    };
  }

  if (!instruction.coordinationId) {
    return {
      valid: false,
      reason: 'coordinationId is required'
    };
  }

  if (!instruction.correlationId) {
    return {
      valid: false,
      reason: 'correlationId is required'
    };
  }

  return {
    valid: true,
    reason: null
  };
}

function classifyActionSafety(action) {
  if (EXTERNAL_OR_APPROVAL_ACTIONS.has(action)) {
    return {
      allowed: false,
      status: 'requires_approval',
      reason: `Action '${action}' requires explicit approval`
    };
  }

  return {
    allowed: true,
    status: 'internal'
  };
}

async function createCompanyPaInstruction({
  action,
  objective,
  priority = 'medium',
  context = {},
  requestedActions = [],
  expectedOutput = [],
  correlationId
}) {
  const snapshot = await getCompanySnapshot();

  const instructionContext = {
    revenue: snapshot.revenue,
    leads: snapshot.leads,
    pipeline: snapshot.pipeline,
    clients: snapshot.clients,
    risks: snapshot.risks,
    priorities: snapshot.priorities,
    clientAcquisitionPerformance:
      snapshot.clientAcquisitionPerformance
  };

  return createInstruction({
    fromAgent: 'company-pa',
    toAgent: 'client-acquisition',
    action,
    objective,
    priority,
    context: {
      ...instructionContext,
      ...context
    },
    requestedActions,
    expectedOutput,
    requiresApproval: false,
    correlationId
  });
}

function createResult({
  instruction,
  status = 'completed',
  summary = '',
  findings = [],
  metrics = {},
  recommendedNextActions = [],
  blockers = [],
  requiresFounderAttention = false,
  requiresApproval = false
}) {
  if (!instruction) {
    throw new Error('Instruction is required');
  }

  return {
    coordinationId: instruction.coordinationId,
    correlationId: instruction.correlationId,
    fromAgent: instruction.toAgent,
    toAgent: instruction.fromAgent,
    action: instruction.action,
    status,
    summary,
    findings: Array.isArray(findings) ? findings : [],
    metrics,
    recommendedNextActions:
      Array.isArray(recommendedNextActions)
        ? recommendedNextActions
        : [],
    blockers: Array.isArray(blockers) ? blockers : [],
    requiresFounderAttention:
      Boolean(requiresFounderAttention),
    requiresApproval:
      Boolean(requiresApproval),
    createdAt: new Date().toISOString()
  };
}

function validateResult(result) {
  if (!result || typeof result !== 'object') {
    return {
      valid: false,
      reason: 'Result is required'
    };
  }

  const requiredFields = [
    'coordinationId',
    'correlationId',
    'fromAgent',
    'toAgent',
    'action',
    'status'
  ];

  for (const field of requiredFields) {
    if (!result[field]) {
      return {
        valid: false,
        reason: `${field} is required`
      };
    }
  }

  return {
    valid: true,
    reason: null
  };
}

function createBlockedResult(instruction, reason) {
  return createResult({
    instruction,
    status: 'blocked',
    summary: reason,
    blockers: [reason],
    requiresFounderAttention: true
  });
}

function createApprovalRequiredResult(instruction, reason) {
  return createResult({
    instruction,
    status: 'requires_approval',
    summary: reason,
    requiresApproval: true,
    requiresFounderAttention: true
  });
}

function createFailedResult(instruction, error) {
  return createResult({
    instruction,
    status: 'failed',
    summary: error instanceof Error
      ? error.message
      : String(error),
    blockers: [
      error instanceof Error
        ? error.message
        : String(error)
    ],
    requiresFounderAttention: true
  });
}

module.exports = {
  ALLOWED_COORDINATION_ACTIONS,
  COMPANY_PA_TO_ACQUISITION,
  ACQUISITION_TO_COMPANY_PA,
  EXTERNAL_OR_APPROVAL_ACTIONS,
  createInstruction,
  validateInstruction,
  classifyActionSafety,
  createCompanyPaInstruction,
  createResult,
  validateResult,
  createBlockedResult,
  createApprovalRequiredResult,
  createFailedResult
};