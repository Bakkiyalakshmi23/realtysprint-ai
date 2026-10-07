const express = require('express');
const router = express.Router();
const demoData = require('../services/demoData');

/**
 * GET /api/activity
 * Returns chronological agent activity logs
 */
router.get('/', (req, res) => {
  const activity = demoData.getActivity();
  res.status(200).json({
    success: true,
    count: activity.length,
    data: activity
  });
});

module.exports = router;
