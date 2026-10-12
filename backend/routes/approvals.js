/**
 * GET /api/approvals
 * Returns pending approval requests.
 * Queries DB when available; falls back to demo data.
 */

const express    = require('express');
const router     = express.Router();
const { pool }   = require('../db/pool');
const { getApprovals } = require('../services/demoData');
const { requireAuth } = require('../middleware/authMiddleware');
const { reviewApproval } = require('../services/workflows');

router.get('/', requireAuth, async (req, res, next) => {
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
    const data = getApprovals().map(a => ({ ...a, actionType: a.actionType || a.action }));
    return res.json({ success: true, source: 'demo', count: data.length, data });
  }
});

router.post('/:id/review', requireAuth, async (req, res) => {
  const decision = req.body?.decision;
  if (!['approve', 'reject'].includes(decision)) {
    return res.status(400).json({ success: false, error: 'decision must be "approve" or "reject".' });
  }
  const result = await reviewApproval(req.params.id, decision);
  if (!result) return res.status(404).json({ success: false, error: 'Pending approval not found.' });
  return res.json({ success: true, data: result, communicationSent: false });
});

router.post('/:id/dispatch', requireAuth, async (req, res) => {
  const { dispatchApprovedDraft } = require('../services/dispatchService');
  const { recipient, subject, body } = req.body;
  try {
    const result = await dispatchApprovedDraft({
      approvalId: req.params.id,
      expectedRecipient: recipient,
      expectedSubject: subject,
      expectedBody: body
    });
    return res.json({ success: true, dispatchId: result.dispatchId, status: result.status, provider_message_id: result.provider_message_id });
  } catch (err) {
    return res.status(400).json({ success: false, error: err.message });
  }
});

module.exports = router;
