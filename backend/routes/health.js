const express = require('express');
const router = express.Router();

/**
 * GET /api/health
 * Returns status of the RealtySprint AI API server
 */
router.get('/', (req, res) => {
  res.status(200).json({
    success: true,
    service: 'RealtySprint AI API',
    status: 'online',
    timestamp: new Date().toISOString()
  });
});

module.exports = router;
