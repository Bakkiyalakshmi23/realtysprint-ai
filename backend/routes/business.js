'use strict';

const express = require('express');
const router = express.Router();
const { getCompanySnapshot } = require('../services/workflows');
const { requireDemoAuth } = require('../middleware/demoAuth');

// Revenue and delivery aggregates are private company data; require the same
// server-side demo auth gate used by agent execution.
router.get('/summary', requireDemoAuth, async (req, res) => {
  const data = await getCompanySnapshot();
  return res.json({ success: true, source: data.source, data });
});

module.exports = router;
