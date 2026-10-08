/**
 * GET /api/approvals
 * Returns pending approval requests.
 * Queries DB when available; falls back to demo data.
 */

const express    = require('express');
const router     = express.Router();
const { pool }   = require('../db/pool');
const { getApprovals } = require('../services/demoData');
const { requireDemoAuth } = require('../middleware/demoAuth');
const { reviewApproval } = require('../services/workflows');

router.get('/', requireDemoAuth, async (req, res, next) => {
  try {
    const result = await pool.query(`
      SELECT
        ap.id,
        ap.action_type    AS "actionType",
        ap.description,
        ap.status,
        ap.requested_at   AS "requestedAt",
        ap.reviewed_at    AS "reviewedAt",
        ap.review_notes   AS "reviewNotes",
        a.id              AS "agentId",
        a.name            AS "agentName",
        a.slug            AS "agentSlug",
        u.name            AS "reviewedByName",
        (SELECT aa.output_data FROM agent_actions aa WHERE aa.agent_run_id = ap.agent_run_id ORDER BY aa.created_at DESC LIMIT 1) AS result
      FROM approvals ap
      JOIN agents a ON a.id = ap.agent_id
      LEFT JOIN users u ON u.id = ap.reviewed_by
      ORDER BY ap.requested_at DESC
    `);

    return res.json({
      success: true,
      source:  'database',
      count:   result.rows.length,
      data:    result.rows,
    });
  } catch (err) {
    console.warn('[approvals] DB unavailable, serving demo data:', err.message);
    const data = getApprovals();
    return res.json({ success: true, source: 'demo', count: data.length, data });
  }
});

router.post('/:id/review', requireDemoAuth, async (req, res) => {
  const decision = req.body?.decision;
  if (!['approve', 'reject'].includes(decision)) {
    return res.status(400).json({ success: false, error: 'decision must be "approve" or "reject".' });
  }
  const result = await reviewApproval(req.params.id, decision);
  if (!result) return res.status(404).json({ success: false, error: 'Pending approval not found.' });
  return res.json({ success: true, data: result, communicationSent: false });
});

module.exports = router;
