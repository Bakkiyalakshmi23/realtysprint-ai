/**
 * GET /api/agents
 * Lists the AI Employee Registry (HRMS) from the database.
 */

const express = require('express');
const router = express.Router();
const { pool } = require('../db/pool');
const { getAgents } = require('../services/demoData');
const { requireAuth } = require('../middleware/authMiddleware');

router.get('/', requireAuth, async (req, res) => {
  try {
    // KPI Formulas:
    // 1. Task counts are calculated using GROUP BY to avoid join multiplication.
    // 2. We handle zero-task cases using COALESCE.
    // 3. Timezone for "today" filtering is UTC.
    const query = `
      SELECT
        a.slug AS id,
        a.slug AS "agentId",
        a.name,
        a.description,
        a.status,
        a.employee_id,
        a.worker_type,
        a.department,
        a.reporting_manager,
        a.role,
        a.kpis,
        a.responsibilities,
        a.permissions,
        COALESCE(t.tasks_today, 0) AS "tasksToday",
        COALESCE(t.completed_today, 0) AS "completedToday",
        COALESCE(t.failed_today, 0) AS "failedToday",
        CASE
          WHEN COALESCE(t.tasks_today, 0) = 0 THEN 'N/A'
          ELSE ROUND((COALESCE(t.completed_today, 0)::NUMERIC / t.tasks_today) * 100, 1) || '%'
        END AS "successRate",
        t.last_activity AS "lastActivity"
      FROM agents a
      LEFT JOIN (
        SELECT
          agent_id,
          COUNT(*) FILTER (WHERE DATE(created_at AT TIME ZONE 'UTC') = DATE(NOW() AT TIME ZONE 'UTC')) AS tasks_today,
          COUNT(*) FILTER (WHERE status = 'completed' AND DATE(updated_at AT TIME ZONE 'UTC') = DATE(NOW() AT TIME ZONE 'UTC')) AS completed_today,
          COUNT(*) FILTER (WHERE status = 'failed' AND DATE(updated_at AT TIME ZONE 'UTC') = DATE(NOW() AT TIME ZONE 'UTC')) AS failed_today,
          TO_CHAR(MAX(updated_at AT TIME ZONE 'UTC'), 'HH:MI AM') AS last_activity
        FROM agent_tasks
        GROUP BY agent_id
      ) t ON a.id = t.agent_id
      ORDER BY a.id ASC;
    `;

    const { rows } = await pool.query(query);

    // Fallback logic for when migration 006 hasn't run yet (to prevent crashes during deploy)
    // If employee_id is missing, the frontend will fall back gracefully.
    return res.json({ success: true, count: rows.length, data: rows });
  } catch (err) {
    console.warn('[agents] DB unavailable, serving demo data:', err.message);
    const data = getAgents().map(a => ({ ...a, agentId: a.id }));
    return res.json({ success: true, source: 'demo', count: data.length, data });
  }
});

module.exports = router;
