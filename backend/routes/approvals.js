const express = require('express');
const router = express.Router();
const demoData = require('../services/demoData');

/**
 * GET /api/approvals
 * Returns human-in-the-loop action approval requests
 */
router.get('/', (req, res) => {
  const approvals = demoData.getApprovals();
  res.status(200).json({
    success: true,
    count: approvals.length,
    data: approvals
  });
});

module.exports = router;
