/**
 * GET /api/health
 * Health check — includes database connectivity status.
 */

const express = require('express');
const router  = express.Router();
const { testConnection } = require('../db/pool');

router.get('/', async (req, res) => {
  // Test DB connection (non-blocking — always returns a response)
  const dbStatus = await testConnection();

  res.json({
    success:   true,
    service:   'RealtySprint AI API',
    status:    'online',
    timestamp: new Date().toISOString(),
    database: {
      connected: dbStatus.connected,
      ...(dbStatus.connected
        ? { latencyMs: dbStatus.latencyMs }
        : { error: dbStatus.error }),
    },
  });
});

module.exports = router;
