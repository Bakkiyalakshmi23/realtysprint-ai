/**
 * GET /api/tasks
 * Returns agent tasks. Queries DB when available; falls back to demo data.
 */

const express    = require('express');
const router     = express.Router();
const { pool }   = require('../db/pool');
const { getTasks } = require('../services/demoData');
const { requireDemoAuth } = require('../middleware/demoAuth');

router.get('/', requireDemoAuth, async (req, res, next) => {
  try {
    const result = await pool.query(`
      SELECT
        t.id,
        t.title,
        t.description,
        t.status,
        t.priority,
        t.assigned_to   AS "assignedTo",
        t.due_at        AS "dueAt",
        t.created_at    AS "createdAt",
        t.updated_at    AS "updatedAt",
        a.id            AS "agentId",
        a.name          AS "agentName",
        a.slug          AS "agentSlug"
      FROM agent_tasks t
      JOIN agents a ON a.id = t.agent_id
      ORDER BY t.created_at DESC
    `);

    return res.json({
      success: true,
      source:  'database',
      count:   result.rows.length,
      data:    result.rows,
    });
  } catch (err) {
    console.warn('[tasks] DB unavailable, serving demo data:', err.message);
    const data = getTasks();
    return res.json({ success: true, source: 'demo', count: data.length, data });
  }
});

module.exports = router;
