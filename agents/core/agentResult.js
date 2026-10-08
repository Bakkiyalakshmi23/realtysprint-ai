/**
 * RealtySprint AI — Agent Core: Agent Result
 * agents/core/agentResult.js
 *
 * Every agent operation returns one of these structured objects.
 * Consistent contract across all agents and all actions.
 *
 * Allowed statuses:
 *   completed         – action ran successfully
 *   pending_approval  – action requires human review before execution
 *   blocked           – action is permanently disallowed
 *   failed            – action ran but encountered an error
 */

'use strict';

const VALID_STATUSES = new Set(['completed', 'pending_approval', 'blocked', 'failed']);

/**
 * Create a successful completed result.
 * @param {object} opts
 * @param {string} opts.agent   - agent slug
 * @param {string} opts.action  - action identifier
 * @param {*}      opts.result  - payload
 * @param {string} [opts.traceId]
 */
function completed({ agent, action, result, traceId }) {
  return {
    success: true,
    agent,
    action,
    status: 'completed',
    requiresApproval: false,
    result: result || null,
    error: null,
    traceId: traceId || null,
    timestamp: new Date().toISOString(),
  };
}

/**
 * Create a pending_approval result. Action must NOT be executed until approved.
 * @param {object} opts
 * @param {string} opts.agent
 * @param {string} opts.action
 * @param {*}      opts.draft   - draft payload for human review
 * @param {string} opts.reason  - why approval is needed
 * @param {string} [opts.traceId]
 */
function pendingApproval({ agent, action, draft, reason, traceId }) {
  return {
    success: true,
    agent,
    action,
    status: 'pending_approval',
    requiresApproval: true,
    result: {
      draft: draft || null,
      reason: reason || 'This action requires human approval before execution.',
      approvalRequired: true,
    },
    error: null,
    traceId: traceId || null,
    timestamp: new Date().toISOString(),
  };
}

/**
 * Create a blocked result. Action is permanently disallowed.
 * @param {object} opts
 * @param {string} opts.agent
 * @param {string} opts.action
 * @param {string} opts.reason
 * @param {string} [opts.traceId]
 */
function blocked({ agent, action, reason, traceId }) {
  return {
    success: false,
    agent,
    action,
    status: 'blocked',
    requiresApproval: false,
    result: null,
    error: reason || 'Action is blocked by permission policy.',
    traceId: traceId || null,
    timestamp: new Date().toISOString(),
  };
}

/**
 * Create a failed result. Action ran but encountered an error.
 * @param {object} opts
 * @param {string} opts.agent
 * @param {string} opts.action
 * @param {string} opts.error
 * @param {string} [opts.traceId]
 */
function failed({ agent, action, error, traceId }) {
  return {
    success: false,
    agent,
    action,
    status: 'failed',
    requiresApproval: false,
    result: null,
    error: error || 'An unexpected error occurred.',
    traceId: traceId || null,
    timestamp: new Date().toISOString(),
  };
}

/**
 * Validate that a result object matches the contract.
 * Used for testing and logging.
 */
function validate(result) {
  if (!result || typeof result !== 'object') return false;
  if (typeof result.success !== 'boolean') return false;
  if (!VALID_STATUSES.has(result.status)) return false;
  if (typeof result.requiresApproval !== 'boolean') return false;
  return true;
}

module.exports = { completed, pendingApproval, blocked, failed, validate, VALID_STATUSES };
