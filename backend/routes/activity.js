/**
 * GET /api/activity
 * Returns recent agent run / activity log entries.
 * Queries DB when available; falls back to demo data.
 */

const express    = require('express');
const router     = express.Router();
const { pool }   = require('../db/pool');
const { getActivity } = require('../services/demoData');
const { requireAuth } = require('../middleware/authMiddleware');

router.get('/', requireAuth, async (req, res, next) => {
  try {
    const result = await pool.query(`
      SELECT
        ar.id,
        ar.status,
        ar.started_at    AS "startedAt",
        ar.completed_at  AS "completedAt",
        ar.result_summary AS "resultSummary",
        a.id             AS "agentId",
        a.name           AS "agentName",
        a.slug           AS "agentSlug"
      FROM agent_runs ar
      JOIN agents a ON a.id = ar.agent_id
      ORDER BY ar.started_at DESC
      LIMIT 50
    `);

    return res.json({
      success: true,
      source:  'database',
      count:   result.rows.length,
      data:    result.rows,
    });
  } catch (err) {
    console.warn('[activity] DB unavailable, serving demo data:', err.message);
    const data = getActivity();
    return res.json({ success: true, source: 'demo', count: data.length, data });
  }
});

module.exports = router;
