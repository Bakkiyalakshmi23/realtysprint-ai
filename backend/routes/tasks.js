const express = require('express');
const router = express.Router();
const demoData = require('../services/demoData');

/**
 * GET /api/tasks
 * Returns list of AI workforce tasks
 */
router.get('/', (req, res) => {
  const tasks = demoData.getTasks();
  res.status(200).json({
    success: true,
    count: tasks.length,
    data: tasks
  });
});

module.exports = router;
