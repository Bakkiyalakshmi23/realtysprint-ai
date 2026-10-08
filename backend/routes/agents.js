/**
 * GET /api/agents
 * Lists the exact two agents available in the executable registry.
 */

const express = require('express');
const router = express.Router();
const { registry } = require('../../agents');
const { getAgents } = require('../services/demoData');
const { requireDemoAuth } = require('../middleware/demoAuth');

router.get('/', requireDemoAuth, (req, res) => {
  const dashboardData = new Map(getAgents().map(agent => [agent.id, agent]));
  const data = registry.listDefinitions().map(agent => ({
    ...(dashboardData.get(agent.slug) || {}),
    ...agent,
    id: agent.slug,
    agentId: agent.slug,
  }));

  return res.json({ success: true, source: 'demo', count: data.length, data });
});

module.exports = router;
