/**
 * GET /api/leads
 * Returns leads with company and contact info.
 * Queries DB when available; falls back to demo data.
 */

const express    = require('express');
const router     = express.Router();
const { pool }   = require('../db/pool');
const { getLeads } = require('../services/demoData');
const { handoverWonLead } = require('../services/workflows');
const { requireDemoAuth } = require('../middleware/demoAuth');

router.get('/', requireDemoAuth, async (req, res, next) => {
  try {
    const result = await pool.query(`
      SELECT
        l.id,
        l.source,
        l.status,
        l.score,
        l.qualification,
        l.notes,
        l.created_at   AS "createdAt",
        l.updated_at   AS "updatedAt",
        c.id           AS "companyId",
        c.name         AS "company",
        c.location,
        ct.id          AS "contactId",
        ct.name        AS "contact",
        ct.job_title   AS "jobTitle",
        ct.email       AS "contactEmail"
      FROM leads l
      LEFT JOIN companies c  ON c.id  = l.company_id
      LEFT JOIN contacts  ct ON ct.id = l.contact_id
      ORDER BY l.score DESC
    `);

    return res.json({
      success: true,
      source:  'database',
      count:   result.rows.length,
      data:    result.rows,
    });
  } catch (err) {
    console.warn('[leads] DB unavailable, serving demo data:', err.message);
    const data = getLeads();
    return res.json({ success: true, source: 'demo', count: data.length, data });
  }
});

router.post('/:id/handover', requireDemoAuth, async (req, res) => {
  const { founderConfirmedWon, projectTitle, requirements, contractValue, currency } = req.body || {};
  if (founderConfirmedWon !== true) {
    return res.status(400).json({ success: false, error: 'Founder must confirm that the client is won before handover.' });
  }
  if (typeof projectTitle !== 'string' || !projectTitle.trim() || projectTitle.length > 200) {
    return res.status(400).json({ success: false, error: 'projectTitle must be 1–200 characters.' });
  }
  if (!Array.isArray(requirements) || requirements.length > 20 || requirements.some(item => typeof item !== 'string' || item.length > 500)) {
    return res.status(400).json({ success: false, error: 'requirements must be an array of up to 20 strings (500 characters each).'});
  }
  const amount = Number(contractValue);
  if (!Number.isFinite(amount) || amount < 0 || amount > 100000000000) {
    return res.status(400).json({ success: false, error: 'contractValue must be a non-negative finite number.' });
  }
  const normalizedCurrency = String(currency || 'INR').toUpperCase();
  if (!['INR', 'AED', 'USD'].includes(normalizedCurrency)) {
    return res.status(400).json({ success: false, error: 'currency must be INR, AED, or USD.' });
  }

  const result = await handoverWonLead(req.params.id, {
    founderConfirmedWon,
    projectTitle: projectTitle.trim(),
    requirements,
    amount,
    currency: normalizedCurrency,
  });
  if (result.error) return res.status(result.status || 400).json({ success: false, error: result.error });
  return res.status(result.alreadyHandedOver ? 200 : 201).json({ success: true, data: result, revenueStatus: 'expected', actualRevenueRecorded: false });
});

module.exports = router;
