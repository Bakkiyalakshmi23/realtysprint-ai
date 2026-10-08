/**
 * RealtySprint AI — Backend: Agent Execution Route
 * backend/routes/agentExecute.js
 *
 * POST /api/agents/execute
 *
 * Validates session, builds context, dispatches to agent registry.
 * Permission decisions happen here on the server — never on the frontend.
 *
 * SECURITY:
 * - Requires valid demo session header
 * - Validates agent slug against registry
 * - Validates action string
 * - Enforces permission policy (via BaseAgent lifecycle)
 * - Never executes external communications
 * - Never exposes secrets
 */
'use strict';

const express  = require('express');
const router   = express.Router();
const permissionPolicy = require('../../agents/core/permissionPolicy');
const { requireDemoAuth } = require('../middleware/demoAuth');
const workflows = require('../services/workflows');

// Lazy-load agent system to avoid circular deps at startup
let agentSystem = null;
function getAgentSystem() {
  if (!agentSystem) {
    agentSystem = require('../../agents');
  }
  return agentSystem;
}

// ─── POST /api/agents/execute ─────────────────────────────────────────────────
router.post('/execute', requireDemoAuth, async (req, res, next) => {
  try {
    const { agent: agentSlug, action, input, demoMode } = req.body || {};

    // 2. Validate required fields
    if (!agentSlug || typeof agentSlug !== 'string') {
      return res.status(400).json({ success: false, error: '"agent" slug is required.' });
    }
    if (!action || typeof action !== 'string') {
      return res.status(400).json({ success: false, error: '"action" string is required.' });
    }
    if (!permissionPolicy.isKnownAction(action)) {
      return res.status(400).json({ success: false, error: `Unknown action: "${action}".` });
    }
    if (input !== undefined && (!input || typeof input !== 'object' || Array.isArray(input))) {
      return res.status(400).json({ success: false, error: '"input" must be a JSON object.' });
    }

    // 3. Validate agent exists in registry
    const { registry } = getAgentSystem();
    if (!registry.hasAgent(agentSlug)) {
      return res.status(400).json({
        success: false,
        error:   `Unknown agent: "${agentSlug}". Registered agents: [${registry.listSlugs().join(', ')}]`,
      });
    }

    const normalizedAction = action.trim().toLowerCase();
    const isGlobalPolicyAction = permissionPolicy.isBlocked(normalizedAction) || permissionPolicy.requiresApproval(normalizedAction);
    const selectedAgent = registry.getAgent(agentSlug);
    if (!isGlobalPolicyAction && !selectedAgent.getSupportedActions().includes(normalizedAction)) {
      return res.status(400).json({ success: false, error: `Action "${action}" is not supported by agent "${agentSlug}".` });
    }

    // 4. Build context
    const rawContext = {
      agent:    agentSlug,
      action,
      user: req.demoUser,
      input:    input === undefined ? {} : { ...input },
      demoMode: demoMode !== false,
      traceId: req.headers['x-correlation-id'] || req.headers['x-request-id'],
    };

    const snapshotActions = agentSlug.trim().toLowerCase() === 'company-pa'
      ? ['generate_report', 'analyze_revenue', 'check_performance', 'identify_priorities', 'analyze_pipeline', 'analyze_workforce']
      : ['analyze_pipeline'];
    if (snapshotActions.includes(normalizedAction)) {
      rawContext.input.companySnapshot = await workflows.getCompanySnapshot();
    }

    // 5. Run agent (full lifecycle: validation → permission → execution)
    let result = await selectedAgent.run(rawContext);
    const persistence = await workflows.recordExecution({ agentSlug: selectedAgent.slug, action: normalizedAction, result, traceId: result.traceId });

    if (result.status === 'completed' && normalizedAction === 'qualify_lead') {
      const qualification = result.result?.qualification;
      if (qualification) {
        const updatedLead = await workflows.updateLeadQualification(rawContext.input.lead || { company: result.result.lead }, qualification);
        if (updatedLead) result.result.persistence = { leadId: updatedLead.id, source: updatedLead.source };
      }
    }

    if (result.status === 'completed' && normalizedAction === 'create_draft' && rawContext.input.draftType !== 'follow-up') {
      const proposal = await workflows.persistProposal({
        agentSlug: selectedAgent.slug,
        agentRunId: persistence.runId,
        lead: rawContext.input.lead || result.result?.lead || 'Demo prospect',
        content: result.result?.draft,
      });
      result.result.approval = { ...proposal, status: 'pending_approval', sent: false };
    }

    res.set('X-Correlation-ID', result.traceId || '');

    // 6. Return result
    const httpStatus = result.status === 'completed'
      ? 200
      : result.status === 'pending_approval'
        ? 202
        : result.status === 'blocked'
          ? 403
          : 422;

    return res.status(httpStatus).json(result);

  } catch (err) {
    next(err);
  }
});

module.exports = router;
