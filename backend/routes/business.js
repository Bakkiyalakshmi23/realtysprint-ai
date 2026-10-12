'use strict';

const express = require('express');
const router = express.Router();
const { getCompanySnapshot } = require('../services/workflows');
const { requireAuth } = require('../middleware/authMiddleware');

// Revenue and delivery aggregates are private company data; require the same
// server-side demo auth gate used by agent execution.
router.get('/summary', requireAuth, async (req, res, next) => {
  try {
    const data = await getCompanySnapshot();
    return res.json({ success: true, source: data.source, data });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
