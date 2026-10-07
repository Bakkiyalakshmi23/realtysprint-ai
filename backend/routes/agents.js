const express = require('express');
const router = express.Router();
const demoData = require('../services/demoData');

/**
 * GET /api/agents
 * Returns list of AI agents
 */
router.get('/', (req, res) => {
  const agents = demoData.getAgents();
  res.status(200).json({
    success: true,
    count: agents.length,
    data: agents
  });
});

module.exports = router;
