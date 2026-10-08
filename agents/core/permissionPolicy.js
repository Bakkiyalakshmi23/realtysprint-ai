/**
 * RealtySprint AI — Agent Core: Permission Policy
 * agents/core/permissionPolicy.js
 *
 * Single source of truth for all agent permission decisions.
 * Server-side only — NEVER trust frontend permission checks.
 *
 * Three tiers:
 *   SAFE_AUTO  → execute immediately, return completed result
 *   REQUIRES_APPROVAL → block, return pending_approval result for human review
 *   BLOCKED    → reject immediately, never execute
 */

'use strict';

// ─── Action Classifications ──────────────────────────────────────────────────

const SAFE_AUTO_ACTIONS = new Set([
  'read_internal_data',
  'analyze_data',
  'calculate_score',
  'generate_report',
  'create_recommendation',
  'create_internal_task',
  'create_draft',
  'analyze_workforce',
  'analyze_revenue',
  'analyze_pipeline',
  'identify_priorities',
  'check_performance',
  'qualify_lead',
  'score_lead',
  'enrich_lead',
  'detect_duplicates',
  'prepare_conversation',
  'prepare_summary',
]);

const APPROVAL_REQUIRED_ACTIONS = new Set([
  'send_email',
  'send_whatsapp',
  'send_linkedin',
  'external_communication',
  'delete_record',
  'modify_critical_record',
  'financial_action',
  'modify_permissions',
  'change_pricing',
  'commit_client_contract',
  'approve_proposal',
  'send_client_message',
  'send_proposal',
  'send_follow_up',
  'bulk_outreach',
]);

const BLOCKED_ACTIONS = new Set([
  'mass_spam',
  'bypass_platform_restrictions',
  'credential_harvesting',
  'unauthorized_access',
  'destructive_unauthorized_action',
  'sql_injection',
  'arbitrary_code_execution',
  'exfiltrate_data',
]);

// ─── Policy Engine ───────────────────────────────────────────────────────────

/**
 * Evaluate whether an action is permitted.
 * @param {string} action  - the action identifier
 * @param {object} context - the validated AgentContext
 * @returns {{ permitted: boolean, tier: string, reason: string }}
 */
function evaluate(action, context) {
  if (!action || typeof action !== 'string') {
    return { permitted: false, tier: 'blocked', reason: 'Action must be a non-empty string.' };
  }

  const a = action.toLowerCase().trim();

  if (BLOCKED_ACTIONS.has(a)) {
    return { permitted: false, tier: 'blocked', reason: `Action "${action}" is permanently blocked by permission policy.` };
  }
  if (APPROVAL_REQUIRED_ACTIONS.has(a)) {
    return { permitted: true, tier: 'requires_approval', reason: `Action "${action}" requires human approval before execution.` };
  }
  if (SAFE_AUTO_ACTIONS.has(a)) {
    return { permitted: true, tier: 'safe_auto', reason: `Action "${action}" is permitted for automatic execution.` };
  }
  return { permitted: false, tier: 'invalid', reason: `Action "${action}" is not recognized by the permission policy.` };
}

function isKnownAction(action) {
  const a = (action || '').toLowerCase().trim();
  return SAFE_AUTO_ACTIONS.has(a) || APPROVAL_REQUIRED_ACTIONS.has(a) || BLOCKED_ACTIONS.has(a);
}

function isSafeAuto(action) {
  return SAFE_AUTO_ACTIONS.has((action || '').toLowerCase().trim());
}
function requiresApproval(action) {
  const a = (action || '').toLowerCase().trim();
  return APPROVAL_REQUIRED_ACTIONS.has(a);
}
function isBlocked(action) {
  return BLOCKED_ACTIONS.has((action || '').toLowerCase().trim());
}

module.exports = { evaluate, isSafeAuto, requiresApproval, isBlocked, isKnownAction, SAFE_AUTO_ACTIONS, APPROVAL_REQUIRED_ACTIONS, BLOCKED_ACTIONS };
