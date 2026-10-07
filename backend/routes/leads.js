const express = require('express');
const router = express.Router();
const demoData = require('../services/demoData');

/**
 * GET /api/leads
 * Returns real estate lead pipeline opportunities
 */
router.get('/', (req, res) => {
  const leads = demoData.getLeads();
  res.status(200).json({
    success: true,
    count: leads.length,
    data: leads
  });
});

module.exports = router;
