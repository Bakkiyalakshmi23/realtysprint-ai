/**
 * RealtySprint AI — Agent Core: Base Agent
 * agents/core/agentBase.js
 *
 * All agents extend this BaseAgent.
 * Enforces the execution lifecycle:
 *
 *   receive context
 *   → validate context
 *   → validate agent is registered
 *   → validate action is supported
 *   → check permission policy
 *   → execute safe action
 *   → create agentResult
 *   → log structured execution
 *   → return result
 *
 * Subclasses MUST implement:
 *   - getSupportedActions()  → string[]
 *   - executeAction(action, context) → Promise<agentResult>
 */

'use strict';

const agentContext   = require('./agentContext');
const agentResult    = require('./agentResult');
const permissionPolicy = require('./permissionPolicy');

class BaseAgent {
  constructor({ id, name, slug, description, status, capabilities }) {
    if (!slug) throw new Error('BaseAgent requires a slug.');
    this.id           = id   || slug;
    this.name         = name || slug;
    this.slug         = slug;
    this.description  = description || '';
    this.status       = status || 'online';
    this.capabilities = Array.isArray(capabilities) ? capabilities : [];
  }

  // ── Override in subclass ─────────────────────────────────────────────────

  /**
   * Return the list of action strings this agent supports.
   * @returns {string[]}
   */
  getSupportedActions() {
    throw new Error(`${this.slug}.getSupportedActions() must be implemented.`);
  }

  /**
   * Execute a validated, permitted action.
   * Called only after all guards pass.
   * @param {string} action
   * @param {object} context - validated AgentContext
   * @returns {Promise<object>} agentResult
   */
  async executeAction(action, context) {
    throw new Error(`${this.slug}.executeAction() must be implemented.`);
  }

  // ── Public interface ─────────────────────────────────────────────────────

  /**
   * Primary entry point. Full execution lifecycle with all guards.
   * @param {object} rawContext - raw input (validated internally)
   * @returns {Promise<object>} agentResult
   */
  async run(rawContext) {
    // 1. Validate context
    const ctxResult = agentContext.create(rawContext);
    if (!ctxResult.ok) {
      return agentResult.failed({
        agent:  this.slug,
        action: rawContext?.action || 'unknown',
        error:  `Invalid context: ${ctxResult.error}`,
      });
    }

    const ctx = ctxResult.context;

    // 2. Validate agent matches
    if (ctx.agent !== this.slug) {
      return agentResult.failed({
        agent:  this.slug,
        action: ctx.action,
        error:  `Agent mismatch: context targets "${ctx.agent}" but this is "${this.slug}".`,
        traceId: ctx.traceId,
      });
    }

    // 3. Validate agent status
    if (this.status !== 'online') {
      return agentResult.failed({
        agent:   this.slug,
        action:  ctx.action,
        error:   `Agent "${this.slug}" is currently ${this.status}. Cannot execute.`,
        traceId: ctx.traceId,
      });
    }

    // 4. Permission policy check. Global blocks and approval gates apply even
    // when an action is not part of this agent's normal capability list.
    const permission = permissionPolicy.evaluate(ctx.action, ctx);

    if (permission.tier === 'blocked') {
      this._log('blocked', ctx, permission.reason);
      return agentResult.blocked({
        agent:   this.slug,
        action:  ctx.action,
        reason:  permission.reason,
        traceId: ctx.traceId,
      });
    }

    if (permission.tier === 'requires_approval') {
      this._log('pending_approval', ctx, permission.reason);
      // Let the agent create the approval draft
      try {
        const draft = await this.createApprovalDraft(ctx.action, ctx);
        return agentResult.pendingApproval({
          agent:   this.slug,
          action:  ctx.action,
          draft,
          reason:  permission.reason,
          traceId: ctx.traceId,
        });
      } catch (err) {
        return agentResult.pendingApproval({
          agent:   this.slug,
          action:  ctx.action,
          draft:   null,
          reason:  permission.reason,
          traceId: ctx.traceId,
        });
      }
    }

    if (permission.tier === 'invalid') {
      return agentResult.failed({
        agent: this.slug,
        action: ctx.action,
        error: permission.reason,
        traceId: ctx.traceId,
      });
    }

    // 5. Safe actions must also be explicitly supported by this agent.
    const supported = this.getSupportedActions();
    if (!supported.includes(ctx.action)) {
      return agentResult.failed({
        agent: this.slug,
        action: ctx.action,
        error: `Action "${ctx.action}" is not supported by agent "${this.slug}". Supported: [${supported.join(', ')}]`,
        traceId: ctx.traceId,
      });
    }

    // 6. Execute safe action
    try {
      this._log('executing', ctx, `Executing safe action: ${ctx.action}`);
      const result = await this.executeAction(ctx.action, ctx);
      this._log('completed', ctx, 'Execution complete.');
      return result;
    } catch (err) {
      this._log('failed', ctx, err.message);
      return agentResult.failed({
        agent:   this.slug,
        action:  ctx.action,
        error:   err.message || 'Unexpected error during agent execution.',
        traceId: ctx.traceId,
      });
    }
  }

  /**
   * Create a draft payload for approval-required actions.
   * Subclasses may override to provide richer drafts.
   * @param {string} action
   * @param {object} context
   * @returns {Promise<object>}
   */
  async createApprovalDraft(action, context) {
    return {
      action,
      input:  context.input,
      note:   'This action requires human approval before it can be executed.',
      demoMode: context.demoMode,
    };
  }

  /**
   * Agent definition for registry / API exposure.
   */
  toDefinition() {
    return {
      id:           this.id,
      name:         this.name,
      slug:         this.slug,
      description:  this.description,
      status:       this.status,
      capabilities: this.capabilities,
    };
  }

  // ── Internal ─────────────────────────────────────────────────────────────

  _log(event, context, message) {
    console.log(JSON.stringify({
      level:   'info',
      source:  'agent',
      agent:   this.slug,
      action:  context?.action || 'unknown',
      event,
      traceId: context?.traceId || null,
      message,
      timestamp: new Date().toISOString(),
    }));
  }
}

module.exports = BaseAgent;
