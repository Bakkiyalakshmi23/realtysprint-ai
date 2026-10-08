'use strict';

const string = { type: 'string' };
const number = { type: 'number' };
const strings = { type: 'array', items: string };
const object = properties => ({
  type: 'object',
  properties,
  required: Object.keys(properties),
  additionalProperties: false,
});

const schemas = {
  company_report: object({
    summary: string,
    today_revenue: number,
    actual_revenue: number,
    expected_revenue: number,
    revenue_target: number,
    remaining_target: number,
    revenue_gap: number,
    revenue_currency: string,
    revenue_status: string,
    revenue_progress: string,
    required_pace: string,
    revenue_data_quality: string,
    target_status: object({ target: string, period: string, progress: string, gap: string }),
    pipeline_status: object({ total_leads: number, qualified_leads: number, conversations: number, proposals: number, won_clients: number, conversion_rate: string }),
    client_acquisition_status: object({ summary: string, risks: strings, recommended_actions: strings }),
    delivery_status: object({ active_projects: number, overdue: number, blocked: number, at_risk: number, summary: string }),
    blockers: strings,
    overdue_work: strings,
    founder_attention: strings,
    tomorrow_priorities: strings,
    recommendations: strings,
  }),
  company_performance: object({
    leads: number, qualified_leads: number, proposals: number, wins: number,
    conversion: string, follow_up_activity: string, risks: strings, recommended_actions: strings,
  }),
  company_priorities: object({ priorities: { type: 'array', items: object({
    priority: string, reason: string, urgency: string, recommended_action: string, owner: string, dependency: string,
  }) } }),
  lead_qualification: object({
    qualification: string,
    score: { type: 'integer', minimum: 0, maximum: 100 },
    reasons: strings,
    missing_information: strings,
    recommended_next_step: string,
    risks: strings,
  }),
  proposal_draft: object({
    client: string,
    requirements: strings,
    recommended_solution: string,
    scope: strings,
    pricing: object({ amount: { type: ['number', 'null'] }, currency: string, note: string }),
    assumptions: strings,
    risks: strings,
    next_step: string,
  }),
  follow_up_draft: object({ channel: string, objective: string, message: string, timing: string, reason: string }),
};

function getSchema(name) {
  const schema = schemas[name];
  if (!schema) throw new Error(`Unsupported structured output schema: ${name}`);
  return schema;
}

module.exports = { schemas, getSchema };
